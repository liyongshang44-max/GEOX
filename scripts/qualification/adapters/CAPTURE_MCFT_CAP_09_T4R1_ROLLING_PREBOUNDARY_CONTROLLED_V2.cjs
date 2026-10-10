#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  appendLog,
  exec,
  finalizePackage,
  hostPreflight,
  output,
  requirePinnedImage,
  requireSha,
  sha256Buffer,
  sha256File,
  writeJson,
} = require('../qualification_core_v1.cjs');

const POLICY_ID = 'mcft-cap-09-rolling-preboundary-capture';
const SOURCE_BINDING_REF = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CONTROLLED-CAPTURE-SOURCE-BINDING-V1.json';
const MATERIALIZER_REF = 'scripts/qualification/PREPARE_MCFT_CAP09_CONTROLLED_T4R1_CAPTURE_SOURCE_V1.cjs';
const PLANNER_REF = 'scripts/runtime_acceptance/PLAN_MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.cjs';
const PLANNER_BLOB = '42f5cc0c3b216d83ebf4471c8ddb544347a0bc8e';
const ASSEMBLER_REF = 'scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.cjs';
const ASSEMBLER_BLOB = '4e0934fd339bbba09782655869cdefa32ae45c2d';
const SOURCE_REF = 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts';
const SOURCE_COMMIT = 'f1c43c5c7379748c5609184cd8acc86ff9b1608e';
const SOURCE_BLOB = '26dd21c5a0b7a60fca06e5e4c2ec92289a102a47';
const HISTORICAL_WORKFLOW_COMMIT = '75d4961279bd64dc1c9dd7d68aac189c72c98846';
const HISTORICAL_WORKFLOW_REF = '.github/workflows/mcft-cap-09-t4r1-rolling-preboundary-capture.yml';
const HISTORICAL_WORKFLOW_BLOB = '800cbd91a5d84801405affa6f372c0aa6388b173';
const HISTORICAL_COMPAT_REF = 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_DEADLINE_COMPAT.cjs';
const HISTORICAL_COMPAT_BLOB = '9d0ba5913fada1573da954c24b59490376a32ef7';
const CANDIDATE_NAME = 'MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json';
const PYTHON_PACKAGES = ['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2'];

function usage() {
  process.stderr.write('Usage: CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V2.cjs run --producer-subject <40hex> --postgres-image <name@sha256:...> [--root <path>]\n');
}
function parseArgs(argv) {
  if (argv[0] !== 'run') throw new Error('CONTROLLED_CAPTURE_V2_COMMAND_RUN_REQUIRED');
  const args = {};
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`CONTROLLED_CAPTURE_V2_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`CONTROLLED_CAPTURE_V2_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  for (const key of ['producer-subject', 'postgres-image']) if (!args[key]) throw new Error(`CONTROLLED_CAPTURE_V2_ARGUMENT_REQUIRED:${key}`);
  return args;
}
function requiredHostEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`CONTROLLED_CAPTURE_V2_HOST_ENV_REQUIRED:${name}`);
  return value;
}
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function captureId(producer) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').toLowerCase();
  return `mcft_cap09_t4r1_controlled_capture_v2-${stamp}-${producer.slice(0, 12)}-${crypto.randomBytes(4).toString('hex')}`;
}
function tokenFor(id) { return crypto.createHash('sha256').update(id).digest('hex').slice(0, 16); }
function venvPython(dir) { return process.platform === 'win32' ? path.join(dir, 'Scripts', 'python.exe') : path.join(dir, 'bin', 'python'); }
function cleanupWorkspace(repoRoot, workspaceDir, logFile) {
  if (!fs.existsSync(workspaceDir)) { exec('git', ['worktree', 'prune'], { cwd: repoRoot, allowFailure: true, logFile }); return; }
  exec('git', ['clean', '-ffdx'], { cwd: workspaceDir, allowFailure: true, logFile });
  const removal = exec('git', ['worktree', 'remove', '--force', workspaceDir], { cwd: repoRoot, allowFailure: true, logFile });
  if (removal.status !== 0 && fs.existsSync(workspaceDir)) fs.rmSync(workspaceDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  exec('git', ['worktree', 'prune'], { cwd: repoRoot, allowFailure: true, logFile });
  if (fs.existsSync(workspaceDir)) throw new Error('CONTROLLED_CAPTURE_V2_WORKSPACE_CLEANUP_FAILED');
}
function waitForDatabase(container, logFile) {
  for (let i = 0; i < 90; i += 1) {
    const state = exec('docker', ['inspect', '--format', '{{.State.Status}}', container], { allowFailure: true, logFile }).stdout.trim();
    if (state === 'exited' || state === 'dead') {
      exec('docker', ['logs', container], { allowFailure: true, logFile });
      throw new Error(`CONTROLLED_CAPTURE_V2_POSTGRES_TERMINATED:${state}`);
    }
    const probe = exec('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'ea5e2_readiness', '-v', 'ON_ERROR_STOP=1', '-Atc', 'SELECT 1;'], { allowFailure: true, logFile });
    if (probe.status === 0 && probe.stdout.trim() === '1') return;
    sleep(1000);
  }
  exec('docker', ['logs', container], { allowFailure: true, logFile });
  throw new Error('CONTROLLED_CAPTURE_V2_POSTGRES_NOT_READY');
}
function assertCandidate(candidate, producerSubject) {
  if (candidate.schema_version !== 'geox_mcft_cap09_rolling_preboundary_candidate_v1' || candidate.status !== 'PASS') throw new Error('CONTROLLED_CAPTURE_V2_CANDIDATE_SCHEMA_OR_STATUS_INVALID');
  if (candidate.temporal_authority !== 'PROVIDER_AVAILABILITY_WATERMARK_V1') throw new Error('CONTROLLED_CAPTURE_V2_TEMPORAL_AUTHORITY_INVALID');
  if (candidate.producer_subject_sha !== producerSubject || candidate.subject_sha !== producerSubject) throw new Error('CONTROLLED_CAPTURE_V2_PRODUCER_SUBJECT_MISMATCH');
  if (candidate.consumption_contract?.producer_exact_main_capture_proof_required !== true) throw new Error('CONTROLLED_CAPTURE_V2_EXACT_MAIN_CONTRACT_REQUIRED');
  if (candidate.consumption_contract?.consumer_subject_may_differ_from_producer !== true) throw new Error('CONTROLLED_CAPTURE_V2_SUCCESSOR_CONSUMPTION_REQUIRED');
  const side = candidate.side_effects;
  if (!side) throw new Error('CONTROLLED_CAPTURE_V2_SIDE_EFFECTS_REQUIRED');
  for (const key of ['formal_database_write_count', 'formal_r2_prefix_write_count', 'scheduler_write_count', 'runtime_write_count']) if (side[key] !== 0) throw new Error(`CONTROLLED_CAPTURE_V2_ZERO_FORMAL_EFFECT_REQUIRED:${key}`);
  if (side.crop_authority_effect !== 'NONE' || side.formal_effect !== false || candidate.raw_values_emitted !== false) throw new Error('CONTROLLED_CAPTURE_V2_FORMAL_EFFECT_FORBIDDEN');
  if (!Array.isArray(candidate.raw_retention_refs) || candidate.raw_retention_refs.length < 2) throw new Error('CONTROLLED_CAPTURE_V2_RETAINED_RAW_REFS_REQUIRED');
  const expires = Date.parse(String(candidate.candidate_expires_at ?? ''));
  if (!Number.isFinite(expires) || Date.now() >= expires) throw new Error('CONTROLLED_CAPTURE_V2_CANDIDATE_EXPIRED');
}
function copyExclusive(source, destination) {
  if (!fs.existsSync(source)) throw new Error(`CONTROLLED_CAPTURE_V2_REQUIRED_OUTPUT_MISSING:${source}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (String(process.env.GITHUB_ACTIONS ?? '').toLowerCase() === 'true') throw new Error('CONTROLLED_CAPTURE_V2_GITHUB_ACTIONS_FORBIDDEN');
  const repoRoot = output('git', ['rev-parse', '--show-toplevel'], { errorCode: 'CONTROLLED_CAPTURE_V2_REPOSITORY_REQUIRED' });
  if (output('git', ['status', '--porcelain'], { cwd: repoRoot }) !== '') throw new Error('CONTROLLED_CAPTURE_V2_DIRTY_LAUNCHER_FORBIDDEN');
  const launcherSubject = requireSha(output('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }), 'CONTROLLED_CAPTURE_V2_LAUNCHER_SHA_INVALID');
  const producerSubject = requireSha(args['producer-subject'], 'CONTROLLED_CAPTURE_V2_PRODUCER_SHA_REQUIRED');
  const postgresImage = requirePinnedImage(args['postgres-image'], 'CONTROLLED_CAPTURE_V2_PINNED_POSTGRES_IMAGE_REQUIRED');
  const s3Endpoint = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_ENDPOINT');
  const s3Bucket = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_BUCKET');
  const s3Region = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_REGION');
  const s3AccessKey = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID');
  const s3SecretKey = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY');

  const root = path.resolve(args.root ?? process.env.GEOX_QUALIFICATION_ROOT ?? path.join(os.homedir(), '.geox', 'qualification'));
  const versions = hostPreflight({ qualificationRoot: root });
  const id = captureId(producerSubject);
  const token = tokenFor(id);
  const captureDir = path.join(root, 'captures', id);
  const workspaceDir = path.join(root, 'capture-workspaces', id);
  const venvDir = path.join(root, 'capture-venvs', token);
  if ([captureDir, workspaceDir, venvDir].some((p) => fs.existsSync(p))) throw new Error('CONTROLLED_CAPTURE_V2_ID_COLLISION');
  for (const d of ['evidence', 'logs', 'provenance', 'candidate']) fs.mkdirSync(path.join(captureDir, d), { recursive: true });
  const logFile = path.join(captureDir, 'logs', 'capture.log');
  const startedAt = new Date().toISOString();
  let container = null;
  let workspaceAdded = false;
  let terminalStatus = 'FAIL';
  let terminalError = null;
  let candidate = null;
  let candidateDigest = null;
  let originMainAtCapture = null;
  let materialization = null;

  try {
    exec('git', ['fetch', '--no-tags', 'origin', 'main'], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_V2_ORIGIN_MAIN_FETCH_FAILED' });
    originMainAtCapture = requireSha(output('git', ['rev-parse', 'origin/main'], { cwd: repoRoot, logFile }), 'CONTROLLED_CAPTURE_V2_ORIGIN_MAIN_SHA_INVALID');
    if (originMainAtCapture !== producerSubject) throw new Error(`CONTROLLED_CAPTURE_V2_EXACT_PROTECTED_MAIN_REQUIRED:${originMainAtCapture}:${producerSubject}`);
    for (const [ref, expected] of [[PLANNER_REF, PLANNER_BLOB], [ASSEMBLER_REF, ASSEMBLER_BLOB]]) {
      const actual = output('git', ['rev-parse', `${producerSubject}:${ref}`], { cwd: repoRoot, logFile });
      if (actual !== expected) throw new Error(`CONTROLLED_CAPTURE_V2_PRODUCER_BLOB_DRIFT:${ref}:${actual}:${expected}`);
    }
    const exactSourceBlob = output('git', ['rev-parse', `${SOURCE_COMMIT}:${SOURCE_REF}`], { cwd: repoRoot, logFile });
    if (exactSourceBlob !== SOURCE_BLOB) throw new Error(`CONTROLLED_CAPTURE_V2_HISTORICAL_SOURCE_BLOB_DRIFT:${exactSourceBlob}:${SOURCE_BLOB}`);
    const workflowBlob = output('git', ['rev-parse', `${HISTORICAL_WORKFLOW_COMMIT}:${HISTORICAL_WORKFLOW_REF}`], { cwd: repoRoot, logFile });
    const compatBlob = output('git', ['rev-parse', `${HISTORICAL_WORKFLOW_COMMIT}:${HISTORICAL_COMPAT_REF}`], { cwd: repoRoot, logFile });
    if (workflowBlob !== HISTORICAL_WORKFLOW_BLOB || compatBlob !== HISTORICAL_COMPAT_BLOB) throw new Error('CONTROLLED_CAPTURE_V2_HISTORICAL_AUTHORITY_BLOB_DRIFT');

    exec('node', [MATERIALIZER_REF, 'selftest'], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_V2_SOURCE_MATERIALIZER_SELFTEST_FAILED' });
    exec('docker', ['pull', postgresImage], { logFile, errorCode: 'CONTROLLED_CAPTURE_V2_POSTGRES_PULL_FAILED' });
    const imageDigest = postgresImage.slice(postgresImage.indexOf('@') + 1);
    if (!output('docker', ['image', 'inspect', '--format', '{{json .RepoDigests}}', postgresImage], { logFile }).includes(imageDigest)) throw new Error('CONTROLLED_CAPTURE_V2_POSTGRES_DIGEST_VERIFICATION_FAILED');

    exec('git', ['worktree', 'add', '--detach', workspaceDir, producerSubject], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_V2_WORKTREE_ADD_FAILED' });
    workspaceAdded = true;
    if (output('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, logFile }) !== producerSubject) throw new Error('CONTROLLED_CAPTURE_V2_WORKTREE_HEAD_MISMATCH');
    if (output('git', ['status', '--porcelain'], { cwd: workspaceDir, logFile }) !== '') throw new Error('CONTROLLED_CAPTURE_V2_WORKTREE_DIRTY');

    exec('pnpm', ['install', '--frozen-lockfile'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V2_PNPM_INSTALL_FAILED' });
    exec('python', ['-m', 'venv', venvDir], { logFile, errorCode: 'CONTROLLED_CAPTURE_V2_VENV_FAILED' });
    const py = venvPython(venvDir);
    exec(py, ['-m', 'pip', 'install', '--disable-pip-version-check', ...PYTHON_PACKAGES], { logFile, errorCode: 'CONTROLLED_CAPTURE_V2_PYTHON_INSTALL_FAILED' });
    exec(py, ['-m', 'eccodes', 'selfcheck'], { logFile, errorCode: 'CONTROLLED_CAPTURE_V2_ECCODES_SELFCHECK_FAILED' });
    exec(py, [path.join(workspaceDir, 'scripts', 'runtime_acceptance', 'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'), 'selftest-et0-decimal-normalization'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V2_ET0_SELFTEST_FAILED' });

    container = `geox-t4r1-cap2-${token}`;
    exec('docker', ['run', '--detach', '--name', container, '--label', `geox.qualification.capture_id=${id}`, '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_PASSWORD=postgres', '-e', 'POSTGRES_DB=ea5e2_readiness', '-p', '127.0.0.1::5432', postgresImage], { logFile, errorCode: 'CONTROLLED_CAPTURE_V2_POSTGRES_START_FAILED' });
    waitForDatabase(container, logFile);
    const portLine = output('docker', ['port', container, '5432/tcp'], { logFile });
    const m = portLine.match(/127\.0\.0\.1:(\d+)/) ?? portLine.match(/:(\d+)$/);
    if (!m) throw new Error(`CONTROLLED_CAPTURE_V2_POSTGRES_PORT_UNRESOLVED:${portLine}`);
    const databaseUrl = `postgres://postgres:postgres@127.0.0.1:${m[1]}/ea5e2_readiness`;

    exec('node', [PLANNER_REF, 'plan'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V2_TARGET_PLAN_FAILED' });
    const planPath = path.join(workspaceDir, 'acceptance-output', 'MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.json');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    if (plan.status !== 'PASS' || plan.temporal_authority !== 'PROVIDER_AVAILABILITY_WATERMARK_V1') throw new Error('CONTROLLED_CAPTURE_V2_TARGET_PLAN_INVALID');

    const generatedPath = path.join(workspaceDir, 'scripts', 'runtime_acceptance', '.generated_CONTROLLED_T4R1_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2_V2.ts');
    const materialized = exec('node', [MATERIALIZER_REF, 'materialize', '--out', generatedPath], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_V2_SOURCE_MATERIALIZATION_FAILED' });
    materialization = JSON.parse(materialized.stdout);
    if (materialization.status !== 'PASS' || materialization.provider_runner_blob !== SOURCE_BLOB || materialization.provider_runner_source_commit !== SOURCE_COMMIT) throw new Error('CONTROLLED_CAPTURE_V2_SOURCE_MATERIALIZATION_INVALID');

    const qenv = {};
    const safe = new Set(['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'SystemRoot', 'ComSpec', 'PATHEXT', 'PNPM_HOME', 'LANG', 'TZ']);
    for (const [name, value] of Object.entries(process.env)) if (safe.has(name) || name.startsWith('LC_') || name.startsWith('NPM_CONFIG_')) qenv[name] = value;
    Object.assign(qenv, {
      DATABASE_URL: databaseUrl,
      PYTHON: py,
      MCFT_EA5E2_SUBJECT_SHA: producerSubject,
      MCFT_EA5E2_LIVE_PHASE: 'PRE_BOUNDARY_CAUSAL',
      MCFT_EA5E2_TARGET_T: plan.target_t,
      MCFT_EA5E2_ISOLATED_READINESS_ACK: 'true',
      MCFT_EA5E2_TRANSIENT_S3_ENDPOINT: s3Endpoint,
      MCFT_EA5E2_TRANSIENT_S3_BUCKET: s3Bucket,
      MCFT_EA5E2_TRANSIENT_S3_REGION: s3Region,
      MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID: s3AccessKey,
      MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY: s3SecretKey,
      MCFT_QMIG_CAPTURE_POLICY_IDENTITY: POLICY_ID,
      MCFT_QMIG_RUN_ID: token,
      MCFT_QMIG_RUN_ATTEMPT: '1',
      MCFT_QMIG_EVENT_NAME: 'workflow_dispatch',
      MCFT_QMIG_REF: 'refs/heads/main',
      MCFT_QMIG_SUBJECT_SHA: producerSubject,
    });
    exec('pnpm', ['exec', 'tsx', generatedPath], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'CONTROLLED_CAPTURE_V2_PROVIDER_EXECUTION_FAILED' });
    exec('node', [ASSEMBLER_REF], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'CONTROLLED_CAPTURE_V2_CANDIDATE_ASSEMBLY_FAILED' });

    const candidatePath = path.join(workspaceDir, 'acceptance-output', CANDIDATE_NAME);
    candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
    assertCandidate(candidate, producerSubject);
    candidate.controlled_capture_provenance = {
      schema_version: 'geox_mcft_cap09_controlled_capture_provenance_v2',
      execution_plane: 'GEOX_CONTROLLED_QUALIFICATION_HOST_V1',
      github_actions_execution: false,
      policy_identity: POLICY_ID,
      namespace_mode: 'TARGET_PLUS_QMIG_RUN_ID_ATTEMPT',
      capture_id: id,
      producer_subject_sha: producerSubject,
      origin_main_sha_at_capture: originMainAtCapture,
      launcher_subject_sha: launcherSubject,
      capture_adapter_ref: 'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V2.cjs',
      capture_adapter_git_blob_sha: output('git', ['rev-parse', `${launcherSubject}:scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V2.cjs`], { cwd: repoRoot, logFile }),
      source_binding_ref: SOURCE_BINDING_REF,
      source_binding_git_blob_sha: output('git', ['rev-parse', `${launcherSubject}:${SOURCE_BINDING_REF}`], { cwd: repoRoot, logFile }),
      source_materializer_ref: MATERIALIZER_REF,
      source_materializer_git_blob_sha: output('git', ['rev-parse', `${launcherSubject}:${MATERIALIZER_REF}`], { cwd: repoRoot, logFile }),
      source_runner_source_commit_sha: SOURCE_COMMIT,
      source_runner_ref: SOURCE_REF,
      source_runner_git_blob_sha: SOURCE_BLOB,
      generated_source_sha256: materialization.generated_sha256,
      historical_deadline_compat_ref: HISTORICAL_COMPAT_REF,
      historical_deadline_compat_git_blob_sha: HISTORICAL_COMPAT_BLOB,
      historical_workflow_ref: HISTORICAL_WORKFLOW_REF,
      historical_workflow_commit_sha: HISTORICAL_WORKFLOW_COMMIT,
      historical_workflow_git_blob_sha: HISTORICAL_WORKFLOW_BLOB,
      planner_ref: PLANNER_REF,
      planner_git_blob_sha: PLANNER_BLOB,
      assembler_ref: ASSEMBLER_REF,
      assembler_git_blob_sha: ASSEMBLER_BLOB,
      zero_formal_effect_verified: true,
      producer_exact_main_verified: true,
    };
    fs.writeFileSync(candidatePath, JSON.stringify(candidate, null, 2) + '\n');
    assertCandidate(JSON.parse(fs.readFileSync(candidatePath, 'utf8')), producerSubject);

    copyExclusive(planPath, path.join(captureDir, 'evidence', 'MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.json'));
    copyExclusive(path.join(workspaceDir, 'acceptance-output', 'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PREBOUNDARY_SAFE_PROOF.json'), path.join(captureDir, 'evidence', 'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PREBOUNDARY_SAFE_PROOF.json'));
    copyExclusive(path.join(workspaceDir, 'acceptance-output', 'MCFT_CAP_09_EA5E2_TRANSIENT_R2_REFS.json'), path.join(captureDir, 'evidence', 'MCFT_CAP_09_EA5E2_TRANSIENT_R2_REFS.json'));
    const packagedCandidate = path.join(captureDir, 'candidate', CANDIDATE_NAME);
    copyExclusive(candidatePath, packagedCandidate);
    candidateDigest = sha256File(packagedCandidate);

    writeJson(path.join(captureDir, 'provenance', 'source-materialization.json'), materialization);
    writeJson(path.join(captureDir, 'provenance', 'git.json'), candidate.controlled_capture_provenance);
    writeJson(path.join(captureDir, 'environment-manifest.json'), {
      schema_version: 'geox_controlled_rolling_capture_environment_v2',
      host_class: 'GEOX_CONTROLLED_QUALIFICATION_HOST_V1',
      os: `${os.platform()} ${os.release()}`,
      architecture: os.arch(),
      git_version: versions.git,
      docker_version: versions.docker,
      compose_version: versions.compose,
      node_version: versions.node,
      pnpm_version: versions.pnpm,
      python_version: versions.python,
      container_image: postgresImage,
      dependency_lock_digest: sha256File(path.join(workspaceDir, 'pnpm-lock.yaml')),
      producer_subject_sha: producerSubject,
      launcher_subject_sha: launcherSubject,
      historical_provider_source_commit_sha: SOURCE_COMMIT,
      historical_provider_source_blob_sha: SOURCE_BLOB,
      retained_raw_store: {
        endpoint_identity_digest: sha256Buffer(String(s3Endpoint)),
        bucket_identity_digest: sha256Buffer(String(s3Bucket)),
        region: s3Region,
        credential_values_recorded: false,
      },
      generated_at: new Date().toISOString(),
    });
    terminalStatus = 'PASS';
  } catch (error) {
    terminalError = error;
    appendLog(logFile, `${error.stack ?? error}`);
  } finally {
    if (container) exec('docker', ['rm', '-f', container], { allowFailure: true, logFile });
    try { if (workspaceAdded) cleanupWorkspace(repoRoot, workspaceDir, logFile); } catch (error) { appendLog(logFile, `${error.stack ?? error}`); if (terminalStatus === 'PASS') { terminalStatus = 'FAIL'; terminalError = error; } }
    try { if (fs.existsSync(venvDir)) fs.rmSync(venvDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); } catch (error) { appendLog(logFile, `${error.stack ?? error}`); if (terminalStatus === 'PASS') { terminalStatus = 'FAIL'; terminalError = error; } }
  }

  writeJson(path.join(captureDir, 'result.json'), {
    schema_version: 'geox_controlled_rolling_capture_result_v2',
    status: terminalStatus,
    capture_id: id,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    producer_subject_sha: producerSubject,
    origin_main_sha_at_capture: originMainAtCapture,
    launcher_subject_sha: launcherSubject,
    candidate_digest: candidateDigest,
    target_t: candidate?.target_t ?? null,
    candidate_expires_at: candidate?.candidate_expires_at ?? null,
    historical_provider_source_commit_sha: SOURCE_COMMIT,
    historical_provider_source_blob_sha: SOURCE_BLOB,
    runtime_mutated: false,
    production_mutation: false,
    formal_effect: false,
    github_owner_reactivated: false,
    tests_failed: terminalStatus === 'PASS' ? [] : [terminalError?.message ?? 'UNKNOWN_FAILURE'],
  });
  const packageDigest = finalizePackage(captureDir);
  const packagedCandidate = path.join(captureDir, 'candidate', CANDIDATE_NAME);
  const sourceRef = terminalStatus === 'PASS'
    ? `geox-controlled-capture-v2://${id}/${CANDIDATE_NAME}?package_digest=${encodeURIComponent(packageDigest)}&candidate_digest=${encodeURIComponent(candidateDigest)}`
    : null;
  process.stdout.write(JSON.stringify({
    status: terminalStatus,
    capture_id: id,
    capture_dir: captureDir,
    capture_package_digest: packageDigest,
    candidate_path: terminalStatus === 'PASS' ? packagedCandidate : null,
    candidate_digest: candidateDigest,
    candidate_source_ref: sourceRef,
    producer_subject_sha: producerSubject,
    launcher_subject_sha: launcherSubject,
    historical_provider_source_commit_sha: SOURCE_COMMIT,
    historical_provider_source_blob_sha: SOURCE_BLOB,
    runtime_mutated: false,
    production_mutation: false,
    github_owner_reactivated: false,
  }, null, 2) + '\n');
  if (terminalStatus !== 'PASS') process.exitCode = 1;
}

main();
