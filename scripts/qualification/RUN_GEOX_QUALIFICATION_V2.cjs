#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
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
} = require('./qualification_core_v1.cjs');

function usage() {
  process.stderr.write('Usage: RUN_GEOX_QUALIFICATION_V2.cjs run --contract <path> --subject <40hex> --runtime <40hex> --postgres-image <name@sha256:...> [--root <path>]\n');
}

function parseArgs(argv) {
  if (argv[0] !== 'run') throw new Error('QUALIFICATION_COMMAND_RUN_REQUIRED');
  const args = {};
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`QUALIFICATION_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`QUALIFICATION_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  return args;
}

function safeRunId(contractId, subject) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').toLowerCase();
  return `${contractId.toLowerCase()}-${stamp}-${subject.slice(0, 12)}-${crypto.randomBytes(4).toString('hex')}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function copyRequired(source, destination) {
  if (!fs.existsSync(source)) throw new Error(`QUALIFICATION_REQUIRED_EVIDENCE_MISSING:${source}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
}

function waitForTargetDatabase(container, logFile) {
  for (let i = 0; i < 90; i += 1) {
    const stateProbe = exec('docker', ['inspect', '--format', '{{.State.Status}}', container], {
      allowFailure: true,
      logFile,
    });
    const state = stateProbe.stdout.trim();
    if (state === 'exited' || state === 'dead') {
      exec('docker', ['logs', container], { allowFailure: true, logFile });
      throw new Error(`QUALIFICATION_POSTGRES_CONTAINER_TERMINATED:${state}`);
    }
    const dbProbe = exec('docker', [
      'exec', container,
      'psql', '-U', 'postgres', '-d', 'causal_revision_qv1',
      '-v', 'ON_ERROR_STOP=1', '-Atc', 'SELECT 1;',
    ], { allowFailure: true, logFile });
    if (dbProbe.status === 0 && dbProbe.stdout.trim() === '1') return;
    sleep(1000);
  }
  exec('docker', ['logs', container], { allowFailure: true, logFile });
  throw new Error('QUALIFICATION_POSTGRES_TARGET_DATABASE_NOT_READY');
}

function cleanupWorkspace(repoRoot, workspaceDir, logFile) {
  if (!fs.existsSync(workspaceDir)) {
    exec('git', ['worktree', 'prune'], { cwd: repoRoot, allowFailure: true, logFile });
    return;
  }
  exec('git', ['clean', '-ffdx'], { cwd: workspaceDir, allowFailure: true, logFile });
  const removal = exec('git', ['worktree', 'remove', '--force', workspaceDir], {
    cwd: repoRoot,
    allowFailure: true,
    logFile,
  });
  if (removal.status !== 0 && fs.existsSync(workspaceDir)) {
    fs.rmSync(workspaceDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  }
  exec('git', ['worktree', 'prune'], { cwd: repoRoot, allowFailure: true, logFile });
  if (fs.existsSync(workspaceDir)) throw new Error('QUALIFICATION_WORKSPACE_CLEANUP_FAILED');
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    usage();
    throw error;
  }

  const repoRoot = output('git', ['rev-parse', '--show-toplevel'], { errorCode: 'QUALIFICATION_REPOSITORY_REQUIRED' });
  const launcherHead = requireSha(output('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }), 'QUALIFICATION_LAUNCHER_HEAD_INVALID');
  const subjectSha = requireSha(args.subject, 'QUALIFICATION_SUBJECT_SHA_REQUIRED');
  const runtimeSha = requireSha(args.runtime, 'QUALIFICATION_RUNTIME_SHA_REQUIRED');
  if (launcherHead !== subjectSha) throw new Error(`QUALIFICATION_LAUNCHER_MUST_EQUAL_SUBJECT:${launcherHead}:${subjectSha}`);
  if (output('git', ['status', '--porcelain'], { cwd: repoRoot }) !== '') throw new Error('QUALIFICATION_DIRTY_LAUNCHER_WORKTREE_FORBIDDEN');

  const contractPath = path.resolve(repoRoot, args.contract ?? '');
  if (!contractPath.startsWith(`${path.resolve(repoRoot)}${path.sep}`)) throw new Error('QUALIFICATION_CONTRACT_OUTSIDE_REPOSITORY_FORBIDDEN');
  const contract = readJson(contractPath);
  if (contract.schema_version !== 'geox_qualification_contract_v1') throw new Error('QUALIFICATION_CONTRACT_SCHEMA_UNSUPPORTED');
  if (contract.frozen_runtime_sha !== runtimeSha) throw new Error('QUALIFICATION_RUNTIME_CONTRACT_MISMATCH');
  if (contract.run_class !== 'L2_CONTROLLED_STATEFUL') throw new Error('QUALIFICATION_RUN_CLASS_UNSUPPORTED');
  const postgresImage = requirePinnedImage(args['postgres-image'], 'QUALIFICATION_PINNED_POSTGRES_IMAGE_REQUIRED');

  const qualificationRoot = path.resolve(args.root ?? process.env.GEOX_QUALIFICATION_ROOT ?? path.join(os.homedir(), '.geox', 'qualification'));
  const versions = hostPreflight({ qualificationRoot });
  const runId = safeRunId(contract.contract_id, subjectSha);
  const runDir = path.join(qualificationRoot, 'runs', runId);
  const workspaceDir = path.join(qualificationRoot, 'workspaces', runId);
  if (fs.existsSync(runDir) || fs.existsSync(workspaceDir)) throw new Error('QUALIFICATION_RUN_ID_COLLISION');
  for (const dir of ['evidence', 'logs', 'database', 'provenance']) fs.mkdirSync(path.join(runDir, dir), { recursive: true });
  const logFile = path.join(runDir, 'logs', 'runner.log');
  const runnerPath = path.join(repoRoot, 'scripts', 'qualification', 'RUN_GEOX_QUALIFICATION_V2.cjs');
  let container = null;
  let workspaceAdded = false;
  let terminalStatus = 'FAIL';
  let terminalError = null;
  const manifest = {
    schema_version: 'geox_qualification_run_manifest_v1',
    qualification_run_id: runId,
    contract_id: contract.contract_id,
    contract_version: contract.contract_version,
    subject_sha: subjectSha,
    runtime_sha: runtimeSha,
    base_sha: contract.pilot_base_sha,
    started_at: new Date().toISOString(),
    completed_at: null,
    environment_digest: null,
    run_class: contract.run_class,
    external_execution_ref: null,
    authority_ceiling: contract.authority_ceiling,
  };

  try {
    exec('git', ['cat-file', '-e', `${subjectSha}^{commit}`], { cwd: repoRoot, logFile, errorCode: 'QUALIFICATION_SUBJECT_NOT_FOUND' });
    exec('git', ['cat-file', '-e', `${runtimeSha}^{commit}`], { cwd: repoRoot, logFile, errorCode: 'QUALIFICATION_RUNTIME_NOT_FOUND' });
    const subjectBlob = output('git', ['rev-parse', `${subjectSha}:${contract.runtime_source_path}`], { cwd: repoRoot, logFile });
    const runtimeBlob = output('git', ['rev-parse', `${runtimeSha}:${contract.runtime_source_path}`], { cwd: repoRoot, logFile });
    if (subjectBlob !== contract.runtime_source_blob_sha || runtimeBlob !== contract.runtime_source_blob_sha) throw new Error('QUALIFICATION_FROZEN_RUNTIME_SOURCE_IDENTITY_MISMATCH');
    exec('git', ['merge-base', '--is-ancestor', contract.semantic_revision_sha, runtimeSha], { cwd: repoRoot, logFile, errorCode: 'QUALIFICATION_SEMANTIC_REVISION_ANCESTRY_REQUIRED' });
    exec('git', ['diff', '--quiet', runtimeSha, subjectSha, '--', contract.runtime_source_path], { cwd: repoRoot, logFile, errorCode: 'QUALIFICATION_FROZEN_RUNTIME_SOURCE_MUTATION_FORBIDDEN' });

    exec('docker', ['pull', postgresImage], { logFile, errorCode: 'QUALIFICATION_PINNED_POSTGRES_PULL_FAILED' });
    const expectedDigest = postgresImage.slice(postgresImage.indexOf('@') + 1);
    const repoDigests = output('docker', ['image', 'inspect', '--format', '{{json .RepoDigests}}', postgresImage], { logFile });
    if (!repoDigests.includes(expectedDigest)) throw new Error('QUALIFICATION_POSTGRES_DIGEST_VERIFICATION_FAILED');

    exec('git', ['worktree', 'add', '--detach', workspaceDir, subjectSha], { cwd: repoRoot, logFile, errorCode: 'QUALIFICATION_EXACT_WORKSPACE_CHECKOUT_FAILED' });
    workspaceAdded = true;
    if (output('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, logFile }) !== subjectSha) throw new Error('QUALIFICATION_WORKSPACE_SUBJECT_MISMATCH');
    if (output('git', ['status', '--porcelain'], { cwd: workspaceDir, logFile }) !== '') throw new Error('QUALIFICATION_WORKSPACE_NOT_CLEAN');

    const environmentManifest = buildEnvironmentManifest({
      repoRoot: workspaceDir,
      subjectSha,
      runtimeSha,
      contract,
      contractPath: path.join(workspaceDir, path.relative(repoRoot, contractPath)),
      runnerPath: path.join(workspaceDir, path.relative(repoRoot, runnerPath)),
      postgresImage,
      versions,
    });
    const fingerprintInput = { ...environmentManifest };
    delete fingerprintInput.generated_at;
    environmentManifest.environment_digest = sha256Buffer(canonicalJson(fingerprintInput));
    writeJson(path.join(runDir, 'environment-manifest.json'), environmentManifest);
    manifest.environment_digest = environmentManifest.environment_digest;

    exec('pnpm', ['install', '--frozen-lockfile'], { cwd: workspaceDir, logFile, errorCode: 'QUALIFICATION_DEPENDENCY_INSTALL_FAILED' });

    container = `geox-q-${runId}`.slice(0, 63);
    exec('docker', [
      'run', '--detach', '--name', container,
      '--label', `geox.qualification.run_id=${runId}`,
      '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_PASSWORD=postgres', '-e', 'POSTGRES_DB=causal_revision_qv1',
      '-p', '127.0.0.1::5432', postgresImage,
    ], { logFile, errorCode: 'QUALIFICATION_POSTGRES_START_FAILED' });
    waitForTargetDatabase(container, logFile);

    const portLine = output('docker', ['port', container, '5432/tcp'], { logFile });
    const match = portLine.match(/127\.0\.0\.1:(\d+)/) ?? portLine.match(/:(\d+)$/);
    if (!match) throw new Error(`QUALIFICATION_POSTGRES_PORT_UNRESOLVED:${portLine}`);
    const port = match[1];
    const adminUrl = `postgres://postgres:postgres@127.0.0.1:${port}/causal_revision_qv1`;
    const qenv = {};
    const safeExact = new Set(['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'SystemRoot', 'ComSpec', 'PATHEXT', 'PNPM_HOME', 'LANG', 'TZ']);
    for (const [name, value] of Object.entries(process.env)) {
      if (safeExact.has(name) || name.startsWith('LC_') || name.startsWith('NPM_CONFIG_')) qenv[name] = value;
    }
    Object.assign(qenv, {
      DATABASE_URL: adminUrl,
      GEOX_DB_PLATFORM_ADMIN_DATABASE_URL: adminUrl,
      GEOX_MIGRATION_DATABASE_URL: `postgres://geox_mcft_migrator_v1:causal-revision-migrator@127.0.0.1:${port}/causal_revision_qv1`,
      GEOX_RUNTIME_DATABASE_URL: `postgres://geox_runtime_v1:causal-revision-runtime@127.0.0.1:${port}/causal_revision_qv1`,
      GEOX_MCFT_MIGRATOR_PASSWORD: 'causal-revision-migrator',
      GEOX_RUNTIME_DATABASE_PASSWORD: 'causal-revision-runtime',
      GEOX_DEPLOYMENT_SUBJECT_COMMIT: subjectSha,
    });

    const initDir = path.join(workspaceDir, 'docker', 'postgres', 'init');
    const initFiles = fs.readdirSync(initDir).filter((name) => name.endsWith('.sql')).sort();
    if (initFiles.length === 0) throw new Error('QUALIFICATION_POSTGRES_INIT_CHAIN_EMPTY');
    for (const name of initFiles) {
      exec('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'causal_revision_qv1', '-v', 'ON_ERROR_STOP=1'], {
        logFile,
        input: fs.readFileSync(path.join(initDir, name), 'utf8'),
        errorCode: `QUALIFICATION_POSTGRES_INIT_FAILED:${name}`,
      });
    }

    exec('pnpm', ['exec', 'tsx', '-e', "import('./apps/server/src/infra/mcft_cap07_database_platform_bootstrap_v1.ts').then(m => m.runMcftCap07DatabasePlatformBootstrapFromEnvironmentV1())"], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'QUALIFICATION_DATABASE_PLATFORM_BOOTSTRAP_FAILED' });
    exec('pnpm', ['exec', 'tsc', '--noEmit', '--pretty', 'false', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--esModuleInterop', '--types', 'node', contract.runtime_acceptance_ref], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'QUALIFICATION_CAUSAL_SEAM_TYPECHECK_FAILED' });
    exec('pnpm', ['exec', 'tsx', contract.runtime_acceptance_ref, 'seed-and-capture'], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'QUALIFICATION_CAUSAL_SEED_FAILED' });
    exec('pnpm', ['exec', 'tsx', contract.runtime_acceptance_ref, 'replay-and-verify'], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'QUALIFICATION_CAUSAL_REPLAY_FAILED' });
    exec('node', [contract.basis_acceptance_ref, '--proof-result', 'acceptance-output/MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_POSTGRES_V1_RESULT.json'], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'QUALIFICATION_CAUSAL_BASIS_ADJUDICATION_FAILED' });

    const outputRoot = path.join(workspaceDir, 'acceptance-output');
    for (const name of [
      'MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_POSTGRES_V1_RESULT.json',
      'MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_POSTGRES_V1_STATE.json',
      'MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_QUALIFICATION_BASIS_V1_RESULT.json',
    ]) copyRequired(path.join(outputRoot, name), path.join(runDir, 'evidence', name));

    const dbVersion = output('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'causal_revision_qv1', '-Atc', 'SHOW server_version;'], { logFile });
    const factCount = output('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'causal_revision_qv1', '-Atc', "SELECT count(*)::text FROM public.facts WHERE fact_id LIKE 'mcft_cap09_causal_revision_temporal_semantics_qv1:%';"], { logFile });
    writeJson(path.join(runDir, 'database', 'postgres-proof.json'), {
      schema_version: 'geox_qualification_postgres_proof_v1',
      database_target_class: 'ISOLATED_LOCALHOST_QUALIFICATION_POSTGRES',
      server_version: dbVersion,
      qualification_fact_count_at_terminal_probe: Number(factCount),
      production_credentials_consumed: false,
      production_database_mutation: false,
    });
    writeJson(path.join(runDir, 'provenance', 'git.json'), {
      schema_version: 'geox_qualification_git_provenance_v1',
      subject_sha: subjectSha,
      runtime_sha: runtimeSha,
      base_sha: contract.pilot_base_sha,
      runtime_source_path: contract.runtime_source_path,
      runtime_source_blob_sha: subjectBlob,
      semantic_revision_sha: contract.semantic_revision_sha,
      contract_digest: sha256File(contractPath),
      runner_digest: sha256File(runnerPath),
    });
    exec('git', ['diff', '--quiet', subjectSha, '--', contract.runtime_source_path], { cwd: workspaceDir, logFile, errorCode: 'QUALIFICATION_RUNTIME_MUTATED_DURING_RUN' });
    terminalStatus = 'PASS';
  } catch (error) {
    terminalError = error;
    appendLog(logFile, `${error.stack ?? error}`);
  } finally {
    if (container) {
      const removal = exec('docker', ['rm', '-f', container], { allowFailure: true, logFile });
      if (removal.status !== 0 && !terminalError) {
        terminalError = new Error('QUALIFICATION_POSTGRES_CLEANUP_FAILED');
        terminalStatus = 'FAIL';
      }
    }
    if (workspaceAdded) {
      try {
        cleanupWorkspace(repoRoot, workspaceDir, logFile);
      } catch (error) {
        appendLog(logFile, `${error.stack ?? error}`);
        if (!terminalError) {
          terminalError = error;
          terminalStatus = 'FAIL';
        }
      }
    }
  }

  const evidenceSurface = digestEvidenceSurface(runDir);
  manifest.completed_at = new Date().toISOString();
  writeJson(path.join(runDir, 'manifest.json'), manifest);
  writeJson(path.join(runDir, 'result.json'), {
    schema_version: 'geox_qualification_result_v1',
    status: terminalStatus,
    contract_id: contract.contract_id,
    contract_version: contract.contract_version,
    subject_sha: subjectSha,
    runtime_sha: runtimeSha,
    environment_digest: manifest.environment_digest,
    evidence_digest: evidenceSurface.evidence_digest,
    tests_passed: terminalStatus === 'PASS' ? contract.required_proof_surface : [],
    tests_failed: terminalStatus === 'PASS' ? [] : [terminalError?.message ?? 'UNKNOWN_FAILURE'],
    runtime_mutated: false,
    production_mutation: false,
    limitations: [
      'QUALIFICATION_HOST_IS_EVIDENCE_PRODUCER_NOT_AUTHORITY_SYSTEM',
      'PILOT_DOES_NOT_AUTHORIZE_MERGE_FORMAL_V5_A0_O00_O23_OR_CAP09_COMPLETION',
      'GITHUB_OLD_LANE_REMAINS_HISTORICAL_FALLBACK_COMPARISON_UNTIL_SUPERSESSION_GATES_PASS'
    ]
  });
  const packageDigest = finalizePackage(runDir);
  process.stdout.write(JSON.stringify({ status: terminalStatus, qualification_run_id: runId, run_dir: runDir, evidence_package_digest: packageDigest }, null, 2) + '\n');
  if (terminalStatus !== 'PASS') process.exitCode = 1;
}

main();
