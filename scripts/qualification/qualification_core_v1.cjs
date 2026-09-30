'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function sha256Buffer(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canonicalJson(value), { flag: 'wx' });
}

function appendLog(logFile, payload) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, payload.endsWith('\n') ? payload : `${payload}\n`);
}

function exec(command, args = [], options = {}) {
  const started = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    input: options.input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  if (options.logFile) {
    appendLog(options.logFile, JSON.stringify({ started_at: started, command, args }));
    if (stdout) appendLog(options.logFile, stdout);
    if (stderr) appendLog(options.logFile, stderr);
  }
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const error = new Error(`${options.errorCode ?? 'QUALIFICATION_COMMAND_FAILED'}:${command}:${result.status}`);
    error.command = command;
    error.args = args;
    error.stdout = stdout;
    error.stderr = stderr;
    error.status = result.status;
    throw error;
  }
  return { status: result.status, stdout, stderr };
}

function output(command, args = [], options = {}) {
  return exec(command, args, options).stdout.trim();
}

function requireSha(value, code) {
  if (!/^[0-9a-f]{40}$/.test(String(value ?? ''))) throw new Error(code);
  return value;
}

function requirePinnedImage(value, code) {
  if (!/^.+@sha256:[0-9a-f]{64}$/.test(String(value ?? ''))) throw new Error(code);
  return value;
}

function commandVersion(command, args) {
  return output(command, args, { errorCode: 'QUALIFICATION_ENVIRONMENT_NOT_READY' });
}

function environmentVariableDigest() {
  const rows = Object.keys(process.env)
    .filter((name) => name.startsWith('GEOX_'))
    .sort()
    .map((name) => `${name}=${sha256Buffer(String(process.env[name] ?? ''))}`);
  return { names: rows.map((row) => row.split('=')[0]), digest: sha256Buffer(rows.join('\n')) };
}

function hostPreflight({ qualificationRoot }) {
  if (String(process.env.GITHUB_ACTIONS ?? '').toLowerCase() === 'true') {
    throw new Error('QUALIFICATION_L2_L3_GITHUB_EXECUTION_FORBIDDEN');
  }
  const versions = {
    git: commandVersion('git', ['--version']),
    docker: commandVersion('docker', ['--version']),
    compose: commandVersion('docker', ['compose', 'version']),
    node: commandVersion(process.execPath, ['--version']),
    pnpm: commandVersion('pnpm', ['--version']),
    python: commandVersion('python', ['--version']),
  };
  exec('docker', ['info'], { errorCode: 'QUALIFICATION_ENVIRONMENT_NOT_READY' });
  fs.mkdirSync(qualificationRoot, { recursive: true });
  const probe = path.join(qualificationRoot, `.write-probe-${process.pid}`);
  fs.writeFileSync(probe, 'ok\n', { flag: 'wx' });
  fs.unlinkSync(probe);
  return versions;
}

function buildEnvironmentManifest({ repoRoot, subjectSha, runtimeSha, contract, contractPath, runnerPath, postgresImage, versions }) {
  const envDigest = environmentVariableDigest();
  const lockPath = path.join(repoRoot, 'pnpm-lock.yaml');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UNKNOWN';
  const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'UNKNOWN';
  return {
    schema_version: 'geox_qualification_environment_manifest_v1',
    host_class: 'GEOX_CONTROLLED_QUALIFICATION_HOST_V1',
    os: `${os.platform()} ${os.release()}`,
    architecture: os.arch(),
    docker_version: versions.docker,
    compose_version: versions.compose,
    node_version: versions.node,
    pnpm_version: versions.pnpm,
    python_version: versions.python,
    container_images: [{ image: postgresImage, digest: postgresImage.slice(postgresImage.indexOf('@') + 1) }],
    dependency_lock_digest: sha256File(lockPath),
    timezone,
    locale,
    qualification_runner_ref: path.relative(repoRoot, runnerPath).replaceAll('\\', '/'),
    qualification_runner_digest: sha256File(runnerPath),
    qualification_contract_ref: path.relative(repoRoot, contractPath).replaceAll('\\', '/'),
    qualification_contract_digest: sha256File(contractPath),
    repository_subject_sha: subjectSha,
    runtime_sha: runtimeSha,
    contract_id: contract.contract_id,
    contract_version: contract.contract_version,
    environment_variable_names: envDigest.names,
    environment_variables_digest: envDigest.digest,
    generated_at: new Date().toISOString(),
  };
}

function digestEvidenceSurface(runDir) {
  const roots = ['evidence', 'logs', 'database', 'provenance'];
  const entries = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile()) entries.push({
        path: path.relative(runDir, full).replaceAll('\\', '/'),
        sha256: sha256File(full),
        bytes: stat.size,
      });
    }
  }
  for (const root of roots) walk(path.join(runDir, root));
  return { entries, evidence_digest: sha256Buffer(canonicalJson(entries)) };
}

function finalizePackage(runDir) {
  const excluded = new Set(['digests.json', 'FINALIZED.json']);
  const entries = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const rel = path.relative(runDir, full).replaceAll('\\', '/');
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile() && !excluded.has(rel)) entries.push({ path: rel, sha256: sha256File(full), bytes: stat.size });
    }
  }
  walk(runDir);
  const evidencePackageDigest = sha256Buffer(canonicalJson(entries));
  writeJson(path.join(runDir, 'digests.json'), {
    schema_version: 'geox_qualification_package_digests_v1',
    entries,
    evidence_package_digest: evidencePackageDigest,
  });
  writeJson(path.join(runDir, 'FINALIZED.json'), {
    schema_version: 'geox_qualification_package_finalized_v1',
    finalized: true,
    evidence_package_digest: evidencePackageDigest,
    finalized_at: new Date().toISOString(),
    mutation_rule: 'FINALIZED_PACKAGE_MUST_NOT_BE_MODIFIED_IN_PLACE_NEW_RUN_ID_REQUIRED',
  });
  return evidencePackageDigest;
}

module.exports = {
  appendLog,
  buildEnvironmentManifest,
  canonicalJson,
  digestEvidenceSurface,
  exec,
  finalizePackage,
  hostPreflight,
  output,
  requirePinnedImage,
  requireSha,
  sha256Buffer,
  sha256File,
  writeJson,
};
