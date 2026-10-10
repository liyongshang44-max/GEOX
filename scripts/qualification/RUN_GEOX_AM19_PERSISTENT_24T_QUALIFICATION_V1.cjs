#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  appendLog,
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
  process.stderr.write('Usage: RUN_GEOX_AM19_PERSISTENT_24T_QUALIFICATION_V1.cjs run --contract <path> --subject <40hex> --runtime <40hex> --candidate <path> --candidate-source-ref <immutable-ref> --postgres-image <name@sha256:...> [--root <path>]\n');
}

function parseArgs(argv) {
  if (argv[0] !== 'run') throw new Error('AM19_QMIG_COMMAND_RUN_REQUIRED');
  const args = {};
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`AM19_QMIG_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`AM19_QMIG_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  for (const key of ['contract', 'subject', 'runtime', 'candidate', 'candidate-source-ref', 'postgres-image']) {
    if (!args[key]) throw new Error(`AM19_QMIG_ARGUMENT_REQUIRED:${key}`);
  }
  if (/latest/i.test(args['candidate-source-ref'])) throw new Error('AM19_QMIG_LATEST_CANDIDATE_FALLBACK_FORBIDDEN');
  return args;
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function safeRunId(contractId, subject) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').toLowerCase();
  return `${contractId.toLowerCase()}-${stamp}-${subject.slice(0, 12)}-${crypto.randomBytes(4).toString('hex')}`;
}
function shortRunTag(runId) { return crypto.createHash('sha256').update(runId).digest('hex').slice(0, 16); }
function requiredHostEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`AM19_QMIG_HOST_ENV_REQUIRED:${name}`);
  return value;
}
function canonicalIso(value, code) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}
function canonicalHour(value, code) {
  const out = canonicalIso(value, code);
  if (!out.endsWith(':00:00.000Z')) throw new Error(code);
  return out;
}
function copyRequired(source, destination) {
  if (!fs.existsSync(source)) throw new Error(`AM19_QMIG_REQUIRED_EVIDENCE_MISSING:${source}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
}
function assertCandidate(candidate, contract) {
  if (candidate.schema_version !== contract.candidate_schema_version) throw new Error('AM19_QMIG_CANDIDATE_SCHEMA_REQUIRED');
  if (candidate.status !== 'PASS' || candidate.temporal_authority !== contract.candidate_temporal_authority) throw new Error('AM19_QMIG_CANDIDATE_AUTHORITY_REQUIRED');
  if (!/^[0-9a-f]{40}$/.test(String(candidate.producer_subject_sha ?? ''))) throw new Error('AM19_QMIG_CANDIDATE_PRODUCER_SHA_REQUIRED');
  if (candidate.subject_sha !== undefined && candidate.subject_sha !== candidate.producer_subject_sha) throw new Error('AM19_QMIG_CANDIDATE_SUBJECT_PRODUCER_MISMATCH');
  canonicalHour(String(candidate.target_t ?? ''), 'AM19_QMIG_CANDIDATE_TARGET_HOUR_REQUIRED');
  const captured = canonicalIso(String(candidate.captured_at ?? ''), 'AM19_QMIG_CANDIDATE_CAPTURED_AT_REQUIRED');
  const expires = canonicalIso(String(candidate.candidate_expires_at ?? ''), 'AM19_QMIG_CANDIDATE_EXPIRY_REQUIRED');
  if (Date.parse(captured) > Date.parse(candidate.target_t)) throw new Error('AM19_QMIG_CANDIDATE_CAPTURE_AFTER_TARGET_FORBIDDEN');
  if (Date.now() >= Date.parse(expires)) throw new Error('AM19_QMIG_CANDIDATE_EXPIRED');
  const types = ['future_et0_assumption_v1', 'future_weather_assumption_v1', 'soil_moisture_observation_v1'];
  if (!Array.isArray(candidate.record_types) || canonicalJson([...candidate.record_types].sort()) !== canonicalJson(types)) throw new Error('AM19_QMIG_CANDIDATE_EXACT_THREE_RECORD_TYPES_REQUIRED');
  const side = candidate.side_effects;
  if (!side || typeof side !== 'object' || Array.isArray(side)) throw new Error('AM19_QMIG_CANDIDATE_SIDE_EFFECTS_REQUIRED');
  for (const key of ['formal_database_write_count', 'formal_r2_prefix_write_count', 'scheduler_write_count', 'runtime_write_count']) {
    if (side[key] !== 0) throw new Error(`AM19_QMIG_CANDIDATE_ZERO_FORMAL_EFFECT_REQUIRED:${key}`);
  }
  if (side.crop_authority_effect !== 'NONE') throw new Error('AM19_QMIG_CANDIDATE_CROP_AUTHORITY_EFFECT_FORBIDDEN');
  if (candidate.raw_values_emitted !== false) throw new Error('AM19_QMIG_CANDIDATE_RAW_VALUES_EMITTED_FORBIDDEN');
}
function safeParentBinding(raw, expectedDatabase) {
  const u = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(u.protocol)) throw new Error('AM19_QMIG_POSTGRES_PARENT_REQUIRED');
  if (['localhost', '127.0.0.1', '::1'].includes(u.hostname)) throw new Error('AM19_QMIG_REMOTE_PARENT_REQUIRED');
  const database = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (database !== expectedDatabase) throw new Error(`AM19_QMIG_PARENT_DATABASE_IDENTITY_REQUIRED:${database}`);
  const query = [...u.searchParams.entries()].sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  const identity = { protocol: u.protocol, hostname: u.hostname, port: u.port || 'default', database, query };
  return { database, endpoint_identity_digest: sha256Buffer(canonicalJson(identity)) };
}
function safeS3Binding(endpoint, bucket, region) {
  return {
    endpoint_identity_digest: sha256Buffer(String(endpoint)),
    bucket_identity_digest: sha256Buffer(String(bucket)),
    region: String(region),
    credential_values_recorded: false,
  };
}
function waitForDatabase(container, database, logFile) {
  for (let i = 0; i < 90; i += 1) {
    const stateProbe = exec('docker', ['inspect', '--format', '{{.State.Status}}', container], { allowFailure: true, logFile });
    const state = stateProbe.stdout.trim();
    if (state === 'exited' || state === 'dead') {
      exec('docker', ['logs', container], { allowFailure: true, logFile });
      throw new Error(`AM19_QMIG_LOCAL_POSTGRES_TERMINATED:${state}`);
    }
    const probe = exec('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atc', 'SELECT 1;'], { allowFailure: true, logFile });
    if (probe.status === 0 && probe.stdout.trim() === '1') return;
    sleep(1000);
  }
  exec('docker', ['logs', container], { allowFailure: true, logFile });
  throw new Error('AM19_QMIG_LOCAL_POSTGRES_NOT_READY');
}
function cleanupWorkspace(repoRoot, workspaceDir, logFile) {
  if (!fs.existsSync(workspaceDir)) {
    exec('git', ['worktree', 'prune'], { cwd: repoRoot, allowFailure: true, logFile });
    return;
  }
  exec('git', ['clean', '-ffdx'], { cwd: workspaceDir, allowFailure: true, logFile });
  const removal = exec('git', ['worktree', 'remove', '--force', workspaceDir], { cwd: repoRoot, allowFailure: true, logFile });
  if (removal.status !== 0 && fs.existsSync(workspaceDir)) fs.rmSync(workspaceDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  exec('git', ['worktree', 'prune'], { cwd: repoRoot, allowFailure: true, logFile });
  if (fs.existsSync(workspaceDir)) throw new Error('AM19_QMIG_WORKSPACE_CLEANUP_FAILED');
}
function venvPython(venvDir) {
  return process.platform === 'win32' ? path.join(venvDir, 'Scripts', 'python.exe') : path.join(venvDir, 'bin', 'python');
}
function requireFreshPersistentResult(result, contract, subject, mainDb, blockedDb) {
  if (result.status !== 'PASS') throw new Error(`AM19_QMIG_FRESH_PASS_REQUIRED:${result.status}`);
  if (result.subject_sha !== subject || result.qualified_subject_sha !== subject) throw new Error('AM19_QMIG_EXACT_QUALIFICATION_SUBJECT_REQUIRED');
  if (result.main_database_name !== mainDb || result.blocked_database_name !== blockedDb) throw new Error('AM19_QMIG_RUN_SCOPED_DATABASE_BINDING_REQUIRED');
  if (result.static_blocker_count !== 0) throw new Error('AM19_QMIG_STATIC_BLOCKER_COUNT_NONZERO');
  for (const key of contract.required_machine_statuses) {
    if (result.machine_statuses?.[key] !== 'PASS') throw new Error(`AM19_QMIG_MACHINE_STATUS_NOT_PASS:${key}`);
  }
  for (const key of ['production_scheduler_reused', 'production_lease_fencing_reused', 'production_runner_reused', 'production_persistent_tick_service_reused', 'production_persistence_repositories_reused']) {
    if (result[key] !== true) throw new Error(`AM19_QMIG_PRODUCTION_GRAPH_REUSE_REQUIRED:${key}`);
  }
  if (result.bootstrap_lease_real_expiry_required !== true || result.lease_and_fencing_clock_substitution !== false) throw new Error('AM19_QMIG_LEASE_FENCING_CLOCK_BOUNDARY_DRIFT');
  if (result.accelerated_clock_scope !== contract.accelerated_clock_scope) throw new Error('AM19_QMIG_ACCELERATED_CLOCK_SCOPE_DRIFT');
  if (result.final_actual_24h_still_required !== true || result.final_actual_24h_substituted_by_this_run !== false) throw new Error('AM19_QMIG_REAL_24H_REQUIREMENT_WEAKENED');
  if (result.future_formal_epoch_selected !== false || result.formal_o00_started !== false || result.mcft_cap09_completed !== false) throw new Error('AM19_QMIG_PREMATURE_FORMAL_EFFECT');
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (error) { usage(); throw error; }

  if (String(process.env.GITHUB_ACTIONS ?? '').toLowerCase() === 'true') throw new Error('AM19_QMIG_GITHUB_ACTIONS_EXECUTION_FORBIDDEN');
  const repoRoot = output('git', ['rev-parse', '--show-toplevel'], { errorCode: 'AM19_QMIG_REPOSITORY_REQUIRED' });
  const launcherHead = requireSha(output('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }), 'AM19_QMIG_LAUNCHER_HEAD_INVALID');
  const subjectSha = requireSha(args.subject, 'AM19_QMIG_SUBJECT_SHA_REQUIRED');
  const runtimeSha = requireSha(args.runtime, 'AM19_QMIG_RUNTIME_SHA_REQUIRED');
  if (launcherHead !== subjectSha) throw new Error(`AM19_QMIG_LAUNCHER_MUST_EQUAL_SUBJECT:${launcherHead}:${subjectSha}`);
  if (output('git', ['status', '--porcelain'], { cwd: repoRoot }) !== '') throw new Error('AM19_QMIG_DIRTY_LAUNCHER_WORKTREE_FORBIDDEN');

  const contractPath = path.resolve(repoRoot, args.contract);
  if (!contractPath.startsWith(`${path.resolve(repoRoot)}${path.sep}`)) throw new Error('AM19_QMIG_CONTRACT_OUTSIDE_REPOSITORY_FORBIDDEN');
  const contract = readJson(contractPath);
  if (contract.schema_version !== 'geox_qualification_contract_v1' || contract.contract_id !== 'MCFT_CAP09_AM19_PERSISTENT_24T_V1') throw new Error('AM19_QMIG_CONTRACT_SCHEMA_OR_ID_UNSUPPORTED');
  if (contract.run_class !== 'L3_REALITY_COUPLED') throw new Error('AM19_QMIG_RUN_CLASS_REQUIRED');
  if (contract.github_actions_execution !== 'FORBIDDEN') throw new Error('AM19_QMIG_GITHUB_EXECUTION_POLICY_WEAKENED');
  if (contract.frozen_runtime_sha !== runtimeSha) throw new Error('AM19_QMIG_RUNTIME_CONTRACT_MISMATCH');
  const postgresImage = requirePinnedImage(args['postgres-image'], 'AM19_QMIG_PINNED_POSTGRES_IMAGE_REQUIRED');

  const candidateSourcePath = path.resolve(args.candidate);
  if (!fs.existsSync(candidateSourcePath) || !fs.statSync(candidateSourcePath).isFile()) throw new Error('AM19_QMIG_CANDIDATE_FILE_REQUIRED');
  const candidate = readJson(candidateSourcePath);
  assertCandidate(candidate, contract);
  const candidateDigest = sha256File(candidateSourcePath);

  const parentRaw = requiredHostEnv('MCFT_CAP09_PARENT_DATABASE_URL');
  const parentClass = requiredHostEnv('GEOX_AM19_PARENT_DATABASE_CLASS');
  if (parentClass !== 'QUALIFICATION_T4R1_NONPRODUCTION') throw new Error('AM19_QMIG_PARENT_DATABASE_CLASS_REQUIRED');
  const parentBinding = safeParentBinding(parentRaw, contract.parent_database_name);
  const s3Endpoint = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_ENDPOINT');
  const s3Bucket = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_BUCKET');
  const s3Region = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_REGION');
  const s3AccessKey = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID');
  const s3SecretKey = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY');
  const s3Binding = safeS3Binding(s3Endpoint, s3Bucket, s3Region);

  const qualificationRoot = path.resolve(args.root ?? process.env.GEOX_QUALIFICATION_ROOT ?? path.join(os.homedir(), '.geox', 'qualification'));
  const versions = hostPreflight({ qualificationRoot });
  const runId = safeRunId(contract.contract_id, subjectSha);
  const runTag = shortRunTag(runId);
  const mainDb = `geox_mcft_cap09_am19_q_${runTag}`;
  const blockedDb = `geox_mcft_cap09_am19_b_${runTag}`;
  const runDir = path.join(qualificationRoot, 'runs', runId);
  const workspaceDir = path.join(qualificationRoot, 'workspaces', runId);
  const venvDir = path.join(qualificationRoot, 'venvs', runTag);
  if (fs.existsSync(runDir) || fs.existsSync(workspaceDir) || fs.existsSync(venvDir)) throw new Error('AM19_QMIG_RUN_ID_COLLISION');
  for (const dir of ['evidence', 'logs', 'database', 'provenance', 'provenance/inputs']) fs.mkdirSync(path.join(runDir, dir), { recursive: true });
  const logFile = path.join(runDir, 'logs', 'runner.log');
  const runnerPath = path.join(repoRoot, contract.qualification_runner_ref);
  const startedAt = new Date().toISOString();
  let container = null;
  let workspaceAdded = false;
  let terminalStatus = 'FAIL';
  let terminalError = null;

  const runManifest = {
    schema_version: 'geox_qualification_run_manifest_v1',
    qualification_run_id: runId,
    contract_id: contract.contract_id,
    contract_version: contract.contract_version,
    subject_sha: subjectSha,
    runtime_sha: runtimeSha,
    base_sha: contract.pilot_base_sha,
    closure_semantic_subject_sha: contract.closure_semantic_subject_sha,
    started_at: startedAt,
    completed_at: null,
    environment_digest: null,
    run_class: contract.run_class,
    external_execution_ref: null,
    authority_ceiling: contract.authority_ceiling,
  };

  try {
    for (const sha of [subjectSha, runtimeSha, contract.closure_semantic_subject_sha, contract.pilot_base_sha]) {
      exec('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: repoRoot, logFile, errorCode: `AM19_QMIG_REQUIRED_COMMIT_MISSING:${sha}` });
    }
    exec('git', ['merge-base', '--is-ancestor', contract.pilot_base_sha, subjectSha], { cwd: repoRoot, logFile, errorCode: 'AM19_QMIG_BASE_ANCESTRY_REQUIRED' });
    exec('git', ['merge-base', '--is-ancestor', contract.closure_semantic_subject_sha, subjectSha], { cwd: repoRoot, logFile, errorCode: 'AM19_QMIG_CLOSURE_SEMANTIC_SUBJECT_ANCESTRY_REQUIRED' });
    const historicalBlob = output('git', ['rev-parse', `${subjectSha}:${contract.historical_runner_ref}`], { cwd: repoRoot, logFile });
    if (historicalBlob !== contract.historical_runner_blob_sha) throw new Error('AM19_QMIG_HISTORICAL_RUNNER_BLOB_DRIFT');
    const runtimeBlobAtSubject = output('git', ['rev-parse', `${subjectSha}:${contract.runtime_source_path}`], { cwd: repoRoot, logFile });
    const runtimeBlobAtFrozen = output('git', ['rev-parse', `${runtimeSha}:${contract.runtime_source_path}`], { cwd: repoRoot, logFile });
    if (runtimeBlobAtSubject !== contract.runtime_source_blob_sha || runtimeBlobAtFrozen !== contract.runtime_source_blob_sha) throw new Error('AM19_QMIG_FROZEN_RUNTIME_SOURCE_IDENTITY_MISMATCH');
    exec('git', ['diff', '--quiet', runtimeSha, subjectSha, '--', contract.runtime_source_path], { cwd: repoRoot, logFile, errorCode: 'AM19_QMIG_FROZEN_RUNTIME_SOURCE_MUTATION_FORBIDDEN' });
    exec('git', ['diff', '--quiet', contract.closure_semantic_subject_sha, subjectSha, '--', ...contract.governed_dependency_refs], { cwd: repoRoot, logFile, errorCode: 'AM19_QMIG_GOVERNED_DEPENDENCY_DRIFT_FROM_CLOSURE_SUBJECT' });

    exec('docker', ['pull', postgresImage], { logFile, errorCode: 'AM19_QMIG_PINNED_POSTGRES_PULL_FAILED' });
    const expectedImageDigest = postgresImage.slice(postgresImage.indexOf('@') + 1);
    const repoDigests = output('docker', ['image', 'inspect', '--format', '{{json .RepoDigests}}', postgresImage], { logFile });
    if (!repoDigests.includes(expectedImageDigest)) throw new Error('AM19_QMIG_POSTGRES_DIGEST_VERIFICATION_FAILED');

    exec('git', ['worktree', 'add', '--detach', workspaceDir, subjectSha], { cwd: repoRoot, logFile, errorCode: 'AM19_QMIG_EXACT_WORKSPACE_CHECKOUT_FAILED' });
    workspaceAdded = true;
    if (output('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, logFile }) !== subjectSha) throw new Error('AM19_QMIG_WORKSPACE_SUBJECT_MISMATCH');
    if (output('git', ['status', '--porcelain'], { cwd: workspaceDir, logFile }) !== '') throw new Error('AM19_QMIG_WORKSPACE_NOT_CLEAN');

    const workspaceCandidate = path.join(workspaceDir, 'rolling-candidate', 'MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json');
    fs.mkdirSync(path.dirname(workspaceCandidate), { recursive: true });
    fs.copyFileSync(candidateSourcePath, workspaceCandidate, fs.constants.COPYFILE_EXCL);
    if (sha256File(workspaceCandidate) !== candidateDigest) throw new Error('AM19_QMIG_CANDIDATE_COPY_DIGEST_MISMATCH');

    exec('pnpm', ['install', '--frozen-lockfile'], { cwd: workspaceDir, logFile, errorCode: 'AM19_QMIG_DEPENDENCY_INSTALL_FAILED' });
    exec('python', ['-m', 'venv', venvDir], { logFile, errorCode: 'AM19_QMIG_PYTHON_VENV_FAILED' });
    const py = venvPython(venvDir);
    exec(py, ['-m', 'pip', 'install', '--disable-pip-version-check', ...contract.python_packages], { logFile, errorCode: 'AM19_QMIG_PYTHON_DEPENDENCY_INSTALL_FAILED' });
    exec(py, ['-m', 'eccodes', 'selfcheck'], { logFile, errorCode: 'AM19_QMIG_ECCODES_SELFCHECK_FAILED' });
    exec(py, [path.join(workspaceDir, 'scripts', 'runtime_acceptance', 'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'), 'selftest-et0-decimal-normalization'], { cwd: workspaceDir, logFile, errorCode: 'AM19_QMIG_ET0_NORMALIZATION_SELFTEST_FAILED' });
    const pipFreeze = output(py, ['-m', 'pip', 'freeze'], { logFile });

    container = `geox-am19-q-${runTag}`;
    exec('docker', ['run', '--detach', '--name', container, '--label', `geox.qualification.run_id=${runId}`, '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_PASSWORD=postgres', '-e', 'POSTGRES_DB=ea5e2_readiness', '-p', '127.0.0.1::5432', postgresImage], { logFile, errorCode: 'AM19_QMIG_LOCAL_POSTGRES_START_FAILED' });
    waitForDatabase(container, 'ea5e2_readiness', logFile);
    const portLine = output('docker', ['port', container, '5432/tcp'], { logFile });
    const match = portLine.match(/127\.0\.0\.1:(\d+)/) ?? portLine.match(/:(\d+)$/);
    if (!match) throw new Error(`AM19_QMIG_LOCAL_POSTGRES_PORT_UNRESOLVED:${portLine}`);
    const localDatabaseUrl = `postgres://postgres:postgres@127.0.0.1:${match[1]}/ea5e2_readiness`;

    const qenv = {};
    const safeExact = new Set(['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'SystemRoot', 'ComSpec', 'PATHEXT', 'PNPM_HOME', 'LANG', 'TZ']);
    for (const [name, value] of Object.entries(process.env)) if (safeExact.has(name) || name.startsWith('LC_') || name.startsWith('NPM_CONFIG_')) qenv[name] = value;
    Object.assign(qenv, {
      SUBJECT_SHA: subjectSha,
      DATABASE_URL: localDatabaseUrl,
      PYTHON: py,
      GEOX_QUALIFICATION_SUBJECT_SHA: subjectSha,
      GEOX_AM19_QMIG_MAIN_DB: mainDb,
      GEOX_AM19_QMIG_BLOCKED_DB: blockedDb,
      MCFT_CAP09_SUBJECT_SHA: subjectSha,
      MCFT_CAP09_CONSUMER_SUBJECT_SHA: subjectSha,
      MCFT_CAP09_ROLLING_CANDIDATE_PATH: workspaceCandidate,
      MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA: candidate.producer_subject_sha,
      MCFT_CAP09_ROLLING_TARGET_T: candidate.target_t,
      MCFT_CAP09_ROLLING_REHYDRATION_ISOLATED_DB_ACK: 'true',
      MCFT_CAP09_PARENT_DATABASE_URL: parentRaw,
      MCFT_EA5E2_TRANSIENT_S3_ENDPOINT: s3Endpoint,
      MCFT_EA5E2_TRANSIENT_S3_BUCKET: s3Bucket,
      MCFT_EA5E2_TRANSIENT_S3_REGION: s3Region,
      MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID: s3AccessKey,
      MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY: s3SecretKey,
    });

    const runnerInWorkspace = path.join(workspaceDir, contract.qualification_runner_ref);
    const contractInWorkspace = path.join(workspaceDir, path.relative(repoRoot, contractPath));
    const controlledEnvSummary = {
      candidate_digest: candidateDigest,
      candidate_source_ref: args['candidate-source-ref'],
      candidate_producer_subject_sha: candidate.producer_subject_sha,
      parent_database_class: parentClass,
      parent_database: parentBinding,
      retained_raw_store: s3Binding,
      qualification_main_database: mainDb,
      qualification_blocked_database: blockedDb,
      credential_names_present: ['MCFT_CAP09_PARENT_DATABASE_URL', 'MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID', 'MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY'],
      credential_values_recorded: false,
    };
    const environmentManifest = {
      schema_version: 'geox_qualification_environment_manifest_v1',
      host_class: 'GEOX_CONTROLLED_QUALIFICATION_HOST_V1',
      os: `${os.platform()} ${os.release()}`,
      architecture: os.arch(),
      git_version: versions.git,
      docker_version: versions.docker,
      compose_version: versions.compose,
      node_version: versions.node,
      pnpm_version: versions.pnpm,
      python_version: versions.python,
      python_package_set_digest: sha256Buffer(pipFreeze),
      python_packages_required: contract.python_packages,
      container_images: [{ image: postgresImage, digest: expectedImageDigest }],
      dependency_lock_digest: sha256File(path.join(workspaceDir, 'pnpm-lock.yaml')),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UNKNOWN',
      locale: Intl.DateTimeFormat().resolvedOptions().locale ?? 'UNKNOWN',
      qualification_runner_ref: contract.qualification_runner_ref,
      qualification_runner_digest: sha256File(runnerInWorkspace),
      qualification_contract_ref: path.relative(repoRoot, contractPath).replaceAll('\\', '/'),
      qualification_contract_digest: sha256File(contractInWorkspace),
      repository_subject_sha: subjectSha,
      runtime_sha: runtimeSha,
      closure_semantic_subject_sha: contract.closure_semantic_subject_sha,
      contract_id: contract.contract_id,
      contract_version: contract.contract_version,
      environment_variable_names: Object.keys(qenv).filter((name) => name.startsWith('MCFT_') || name.startsWith('GEOX_') || name === 'DATABASE_URL' || name === 'PYTHON').sort(),
      environment_variables_digest: sha256Buffer(canonicalJson(controlledEnvSummary)),
      environment_variables_digest_policy: 'SECRET_VALUES_EXCLUDED_ONLY_EXPLICIT_IDENTITY_BINDINGS_DIGESTED',
      input_binding_summary: controlledEnvSummary,
      generated_at: new Date().toISOString(),
    };
    const envFingerprint = { ...environmentManifest };
    delete envFingerprint.generated_at;
    environmentManifest.environment_digest = sha256Buffer(canonicalJson(envFingerprint));
    writeJson(path.join(runDir, 'environment-manifest.json'), environmentManifest);
    runManifest.environment_digest = environmentManifest.environment_digest;

    exec('pnpm', ['exec', 'tsx', contract.controlled_adapter_ref, 'selftest'], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'AM19_QMIG_CONTROLLED_ADAPTER_SELFTEST_FAILED' });
    assertCandidate(readJson(workspaceCandidate), contract);
    exec('node', [contract.crop_preflight_ref, 'run'], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'AM19_QMIG_CROP_WINDOW_PREFLIGHT_FAILED' });
    exec('pnpm', ['exec', 'tsx', contract.rehydration_ref, 'run'], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'AM19_QMIG_REHYDRATION_FAILED' });

    const outputRoot = path.join(workspaceDir, 'acceptance-output');
    const rehydration = readJson(path.join(outputRoot, 'MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION.json'));
    if (rehydration.status !== 'PASS' || rehydration.consumer_subject_sha !== subjectSha || rehydration.producer_subject_sha !== candidate.producer_subject_sha || rehydration.target_t !== candidate.target_t) throw new Error('AM19_QMIG_REHYDRATION_IDENTITY_REQUIRED');
    if (rehydration.semantic_manifest_match !== true || rehydration.producer_bound_raw_reverification !== true || rehydration.provider_refetch_count !== 0 || rehydration.private_r2_put_count !== 0 || rehydration.private_r2_delete_count !== 0) throw new Error('AM19_QMIG_REHYDRATION_PROVENANCE_REQUIRED');
    for (const key of ['formal_database_write_count', 'formal_r2_prefix_write_count', 'scheduler_write_count', 'runtime_write_count']) if (rehydration[key] !== 0) throw new Error(`AM19_QMIG_REHYDRATION_ZERO_FORMAL_EFFECT_REQUIRED:${key}`);
    if (rehydration.formal_effect !== false || rehydration.raw_values_emitted !== false) throw new Error('AM19_QMIG_REHYDRATION_FORMAL_EFFECT_FORBIDDEN');

    exec('pnpm', ['exec', 'tsx', contract.persistence_free_ref], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'AM19_QMIG_PERSISTENCE_FREE_PROOF_FAILED' });
    const persistenceFree = readJson(path.join(outputRoot, 'MCFT_CAP_09_AMENDMENT_19_PERSISTENCE_FREE_24T_RESULT.json'));
    if (persistenceFree.status !== 'PASS' || persistenceFree.machine_statuses?.PERSISTENCE_FREE_24T !== 'PASS' || persistenceFree.canonical_tick_count !== 24 || persistenceFree.provider_wait_count !== 0 || persistenceFree.database_write_count !== 0 || persistenceFree.provider_request_count !== 0) throw new Error('AM19_QMIG_PERSISTENCE_FREE_BOUNDARY_DRIFT');

    assertCandidate(readJson(workspaceCandidate), contract);
    exec('pnpm', ['exec', 'tsx', contract.controlled_adapter_ref, 'run'], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'AM19_QMIG_PERSISTENT_24T_EXECUTION_FAILED' });
    const persistent = readJson(path.join(outputRoot, 'MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_RESULT.json'));
    requireFreshPersistentResult(persistent, contract, subjectSha, mainDb, blockedDb);

    for (const name of contract.required_evidence_files) copyRequired(path.join(outputRoot, name), path.join(runDir, 'evidence', name));
    const packagedCandidate = path.join(runDir, 'provenance', 'inputs', 'MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json');
    copyRequired(workspaceCandidate, packagedCandidate);

    const repositoryInputs = [...new Set([...contract.governed_dependency_refs, contract.historical_runner_ref, contract.controlled_adapter_ref])].sort().map((ref) => ({
      ref,
      git_blob_sha: output('git', ['rev-parse', `${subjectSha}:${ref}`], { cwd: workspaceDir, logFile }),
    }));
    writeJson(path.join(runDir, 'provenance', 'input-artifacts.json'), {
      schema_version: 'geox_qualification_input_artifacts_v1',
      external_artifacts: [{
        kind: 'ROLLING_PREBOUNDARY_CANDIDATE',
        package_path: 'provenance/inputs/MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json',
        sha256: sha256File(packagedCandidate),
        source_ref: args['candidate-source-ref'],
        producer_subject_sha: candidate.producer_subject_sha,
        target_t: candidate.target_t,
        candidate_expires_at: candidate.candidate_expires_at,
      }],
      repository_inputs: repositoryInputs,
      external_service_bindings: [
        { kind: 'POSTGRES_T4R1_PARENT', database_name: parentBinding.database, endpoint_identity_digest: parentBinding.endpoint_identity_digest, database_class: parentClass, credential_value_recorded: false },
        { kind: 'RETAINED_RAW_OBJECT_STORE', ...s3Binding },
      ],
      latest_run_fallback_used: false,
    });
    writeJson(path.join(runDir, 'database', 'am19-persistent24-proof.json'), {
      schema_version: 'geox_am19_persistent24_database_proof_v1',
      parent_database_name: parentBinding.database,
      parent_database_class: parentClass,
      parent_endpoint_identity_digest: parentBinding.endpoint_identity_digest,
      qualification_main_database: mainDb,
      qualification_blocked_database: blockedDb,
      remote_qualification_database_mutation: true,
      production_database_mutation: false,
      formal_v5_mutation: false,
      candidate_producer_subject_sha: candidate.producer_subject_sha,
      candidate_digest: candidateDigest,
    });
    writeJson(path.join(runDir, 'provenance', 'git.json'), {
      schema_version: 'geox_qualification_git_provenance_v1',
      subject_sha: subjectSha,
      runtime_sha: runtimeSha,
      base_sha: contract.pilot_base_sha,
      closure_semantic_subject_sha: contract.closure_semantic_subject_sha,
      runtime_source_path: contract.runtime_source_path,
      runtime_source_blob_sha: runtimeBlobAtSubject,
      semantic_revision_sha: contract.semantic_revision_sha,
      historical_runner_ref: contract.historical_runner_ref,
      historical_runner_blob_sha: historicalBlob,
      contract_digest: sha256File(contractPath),
      runner_digest: sha256File(runnerPath),
      governed_dependency_refs: contract.governed_dependency_refs,
      closure_authoritative_dependency_digest: contract.closure_authoritative_dependency_digest,
    });

    exec('git', ['diff', '--quiet', subjectSha, '--', contract.runtime_source_path, ...contract.governed_dependency_refs], { cwd: workspaceDir, logFile, errorCode: 'AM19_QMIG_GOVERNED_SOURCE_MUTATED_DURING_RUN' });
    terminalStatus = 'PASS';
  } catch (error) {
    terminalError = error;
    appendLog(logFile, `${error.stack ?? error}`);
  } finally {
    if (container) exec('docker', ['rm', '-f', container], { allowFailure: true, logFile });
    try { if (workspaceAdded) cleanupWorkspace(repoRoot, workspaceDir, logFile); } catch (error) {
      appendLog(logFile, `${error.stack ?? error}`);
      if (terminalStatus === 'PASS') { terminalStatus = 'FAIL'; terminalError = error; }
    }
    try { if (fs.existsSync(venvDir)) fs.rmSync(venvDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); } catch (error) {
      appendLog(logFile, `${error.stack ?? error}`);
      if (terminalStatus === 'PASS') { terminalStatus = 'FAIL'; terminalError = error; }
    }
  }

  const evidenceSurface = digestEvidenceSurface(runDir);
  runManifest.completed_at = new Date().toISOString();
  writeJson(path.join(runDir, 'manifest.json'), runManifest);
  writeJson(path.join(runDir, 'result.json'), {
    schema_version: 'geox_qualification_result_v1',
    status: terminalStatus,
    contract_id: contract.contract_id,
    contract_version: contract.contract_version,
    subject_sha: subjectSha,
    runtime_sha: runtimeSha,
    closure_semantic_subject_sha: contract.closure_semantic_subject_sha,
    environment_digest: runManifest.environment_digest,
    evidence_digest: evidenceSurface.evidence_digest,
    tests_passed: terminalStatus === 'PASS' ? contract.required_proof_surface : [],
    tests_failed: terminalStatus === 'PASS' ? [] : [terminalError?.message ?? 'UNKNOWN_FAILURE'],
    runtime_mutated: false,
    production_mutation: false,
    qcp_semantics_mutated: false,
    closure_subject_mutated: false,
    latest_run_fallback_used: false,
    limitations: [
      'QUALIFICATION_HOST_IS_EVIDENCE_PRODUCER_NOT_AUTHORITY_SYSTEM',
      'FRESH_ACCELERATED_PERSISTENT_24T_DOES_NOT_SUBSTITUTE_FINAL_REAL_CLOCK_O00_O23',
      'CLOSURE_TEAM_RETAINS_LEGACY_AM19_PERSISTENT_24T_BLOCKER_ADJUDICATION_AUTHORITY',
      'GITHUB_OLD_LANE_NOT_SUPERSEDED_BY_THIS_RUN'
    ]
  });
  const packageDigest = finalizePackage(runDir);
  process.stdout.write(JSON.stringify({ status: terminalStatus, qualification_run_id: runId, run_dir: runDir, evidence_package_digest: packageDigest, qualification_subject_sha: subjectSha, runtime_subject_sha: runtimeSha, closure_semantic_subject_sha: contract.closure_semantic_subject_sha }, null, 2) + '\n');
  if (terminalStatus !== 'PASS') process.exitCode = 1;
}

main();
