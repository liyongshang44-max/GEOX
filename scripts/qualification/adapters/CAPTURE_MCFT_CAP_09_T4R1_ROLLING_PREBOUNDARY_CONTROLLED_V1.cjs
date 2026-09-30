#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  appendLog,
  canonicalJson,
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
const HISTORICAL_WORKFLOW_COMMIT = '75d4961279bd64dc1c9dd7d68aac189c72c98846';
const HISTORICAL_WORKFLOW_REF = '.github/workflows/mcft-cap-09-t4r1-rolling-preboundary-capture.yml';
const HISTORICAL_WORKFLOW_BLOB = '800cbd91a5d84801405affa6f372c0aa6388b173';
const PLANNER_REF = 'scripts/runtime_acceptance/PLAN_MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.cjs';
const PLANNER_BLOB = '42f5cc0c3b216d83ebf4471c8ddb544347a0bc8e';
const SOURCE_REF = 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts';
const SOURCE_BLOB = '26dd21c5a0b7a60fca06e5e4c2ec92289a102a47';
const HISTORICAL_COMPAT_REF = 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_DEADLINE_COMPAT.cjs';
const HISTORICAL_COMPAT_BLOB = '9d0ba5913fada1573da954c24b59490376a32ef7';
const ASSEMBLER_REF = 'scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.cjs';
const ASSEMBLER_BLOB = '4e0934fd339bbba09782655869cdefa32ae45c2d';
const CANDIDATE_NAME = 'MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json';
const PYTHON_PACKAGES = ['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2'];

const HISTORICAL_NAMESPACE = 'namespace: namespaceFor(target)';
const CONTROLLED_NAMESPACE = 'namespace: `${namespaceFor(target)}-${required("GEOX_QUALIFICATION_CAPTURE_RUN_TOKEN")}`';
const HISTORICAL_RETRIEVAL_VALIDATION = 'canonicalIso(input.retrieved_at, "EA5E2_TRANSIENT_RETRIEVED_AT_INVALID");';
const CURRENT_RETRIEVAL_CLOCK = 'const retrievedAt = canonicalIso(input.retrieved_at, "EA5E2_TRANSIENT_RETRIEVED_AT_INVALID");';
const HISTORICAL_REUSE_BLOCK = `if (probe.status === 200) {
      const retainedAt = this.validateHead({ retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength }, key, probe);
      return { retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE", retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength, retained_at: retainedAt, externally_publishable: false };
    }`;
const CAUSAL_REUSE_BLOCK = `if (probe.status === 200) {
      const retainedAt = this.validateHead({ retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength }, key, probe);
      if (Date.parse(retainedAt) >= Date.parse(retrievedAt)) {
        return { retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE", retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength, retained_at: retainedAt, externally_publishable: false };
      }
      await this.deleteRetainedRawEvidence(ref);
    }`;
const LEGACY_MARGIN_SELECTOR = 'const MIN_INGRESS_MARGIN_MINUTES = process.env.GITHUB_WORKFLOW === "mcft-cap-09-rolling-preboundary-capture" ? 0 : 5;';
const CONTROLLED_MARGIN_SELECTOR = `const CONTROLLED_CAPTURE_POLICY_IDENTITY = required("GEOX_QUALIFICATION_CAPTURE_POLICY_ID");
if (CONTROLLED_CAPTURE_POLICY_IDENTITY !== "${POLICY_ID}") throw new Error("EA5E2_CONTROLLED_CAPTURE_POLICY_IDENTITY_REQUIRED");
const MIN_INGRESS_MARGIN_MINUTES = 0;`;

function usage() {
  process.stderr.write('Usage: CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V1.cjs run --producer-subject <40hex> --postgres-image <name@sha256:...> [--root <path>]\n');
}
function parseArgs(argv) {
  if (argv[0] !== 'run') throw new Error('CONTROLLED_CAPTURE_COMMAND_RUN_REQUIRED');
  const args = {};
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`CONTROLLED_CAPTURE_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`CONTROLLED_CAPTURE_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  for (const key of ['producer-subject', 'postgres-image']) if (!args[key]) throw new Error(`CONTROLLED_CAPTURE_ARGUMENT_REQUIRED:${key}`);
  return args;
}
function exactReplace(source, oldValue, newValue, code) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`${code}:${count}`);
  return source.replace(oldValue, newValue);
}
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function safeCaptureId(producer) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').toLowerCase();
  return `mcft_cap09_t4r1_controlled_capture_v1-${stamp}-${producer.slice(0, 12)}-${crypto.randomBytes(4).toString('hex')}`;
}
function captureToken(captureId) { return crypto.createHash('sha256').update(captureId).digest('hex').slice(0, 16); }
function requiredHostEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`CONTROLLED_CAPTURE_HOST_ENV_REQUIRED:${name}`);
  return value;
}
function executable(name) { return process.platform === 'win32' && name === 'pnpm' ? 'pnpm.cmd' : name; }
function venvPython(venvDir) { return process.platform === 'win32' ? path.join(venvDir, 'Scripts', 'python.exe') : path.join(venvDir, 'bin', 'python'); }
function cleanupWorkspace(repoRoot, workspaceDir, logFile) {
  if (!fs.existsSync(workspaceDir)) { exec('git', ['worktree', 'prune'], { cwd: repoRoot, allowFailure: true, logFile }); return; }
  exec('git', ['clean', '-ffdx'], { cwd: workspaceDir, allowFailure: true, logFile });
  const removal = exec('git', ['worktree', 'remove', '--force', workspaceDir], { cwd: repoRoot, allowFailure: true, logFile });
  if (removal.status !== 0 && fs.existsSync(workspaceDir)) fs.rmSync(workspaceDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  exec('git', ['worktree', 'prune'], { cwd: repoRoot, allowFailure: true, logFile });
  if (fs.existsSync(workspaceDir)) throw new Error('CONTROLLED_CAPTURE_WORKSPACE_CLEANUP_FAILED');
}
function waitForDatabase(container, logFile) {
  for (let i = 0; i < 90; i += 1) {
    const stateProbe = exec('docker', ['inspect', '--format', '{{.State.Status}}', container], { allowFailure: true, logFile });
    const state = stateProbe.stdout.trim();
    if (state === 'exited' || state === 'dead') {
      exec('docker', ['logs', container], { allowFailure: true, logFile });
      throw new Error(`CONTROLLED_CAPTURE_POSTGRES_TERMINATED:${state}`);
    }
    const probe = exec('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'ea5e2_readiness', '-v', 'ON_ERROR_STOP=1', '-Atc', 'SELECT 1;'], { allowFailure: true, logFile });
    if (probe.status === 0 && probe.stdout.trim() === '1') return;
    sleep(1000);
  }
  exec('docker', ['logs', container], { allowFailure: true, logFile });
  throw new Error('CONTROLLED_CAPTURE_POSTGRES_NOT_READY');
}
function assertCandidate(candidate, producerSubject) {
  if (candidate.schema_version !== 'geox_mcft_cap09_rolling_preboundary_candidate_v1' || candidate.status !== 'PASS') throw new Error('CONTROLLED_CAPTURE_CANDIDATE_SCHEMA_OR_STATUS_INVALID');
  if (candidate.temporal_authority !== 'PROVIDER_AVAILABILITY_WATERMARK_V1') throw new Error('CONTROLLED_CAPTURE_TEMPORAL_AUTHORITY_INVALID');
  if (candidate.producer_subject_sha !== producerSubject || candidate.subject_sha !== producerSubject) throw new Error('CONTROLLED_CAPTURE_PRODUCER_SUBJECT_MISMATCH');
  if (candidate.consumption_contract?.producer_exact_main_capture_proof_required !== true) throw new Error('CONTROLLED_CAPTURE_EXACT_MAIN_CONTRACT_REQUIRED');
  if (candidate.consumption_contract?.consumer_subject_may_differ_from_producer !== true) throw new Error('CONTROLLED_CAPTURE_SUCCESSOR_CONSUMPTION_REQUIRED');
  const side = candidate.side_effects;
  if (!side) throw new Error('CONTROLLED_CAPTURE_SIDE_EFFECTS_REQUIRED');
  for (const key of ['formal_database_write_count', 'formal_r2_prefix_write_count', 'scheduler_write_count', 'runtime_write_count']) if (side[key] !== 0) throw new Error(`CONTROLLED_CAPTURE_ZERO_FORMAL_EFFECT_REQUIRED:${key}`);
  if (side.crop_authority_effect !== 'NONE' || side.formal_effect !== false || candidate.raw_values_emitted !== false) throw new Error('CONTROLLED_CAPTURE_FORMAL_EFFECT_FORBIDDEN');
  if (!Array.isArray(candidate.raw_retention_refs) || candidate.raw_retention_refs.length < 2) throw new Error('CONTROLLED_CAPTURE_RETAINED_RAW_REFS_REQUIRED');
  const expires = Date.parse(String(candidate.candidate_expires_at ?? ''));
  if (!Number.isFinite(expires) || Date.now() >= expires) throw new Error('CONTROLLED_CAPTURE_CANDIDATE_EXPIRED');
}
function copyExclusive(source, destination) {
  if (!fs.existsSync(source)) throw new Error(`CONTROLLED_CAPTURE_REQUIRED_OUTPUT_MISSING:${source}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
}
function buildGeneratedRunner(workspaceDir) {
  const sourcePath = path.join(workspaceDir, SOURCE_REF);
  let generated = fs.readFileSync(sourcePath, 'utf8');
  generated = exactReplace(generated, HISTORICAL_NAMESPACE, CONTROLLED_NAMESPACE, 'CONTROLLED_CAPTURE_NAMESPACE_REPLACEMENT_CARDINALITY');
  generated = exactReplace(generated, HISTORICAL_RETRIEVAL_VALIDATION, CURRENT_RETRIEVAL_CLOCK, 'CONTROLLED_CAPTURE_RETRIEVAL_CLOCK_REPLACEMENT_CARDINALITY');
  generated = exactReplace(generated, HISTORICAL_REUSE_BLOCK, CAUSAL_REUSE_BLOCK, 'CONTROLLED_CAPTURE_CAUSAL_REUSE_REPLACEMENT_CARDINALITY');
  generated = exactReplace(generated, LEGACY_MARGIN_SELECTOR, CONTROLLED_MARGIN_SELECTOR, 'CONTROLLED_CAPTURE_MARGIN_SELECTOR_REPLACEMENT_CARDINALITY');
  if (!generated.includes(CONTROLLED_NAMESPACE) || !generated.includes(CONTROLLED_MARGIN_SELECTOR)) throw new Error('CONTROLLED_CAPTURE_IDENTITY_REWRITE_REQUIRED');
  if (!generated.includes('Date.parse(retainedAt) >= Date.parse(retrievedAt)') || !generated.includes('await this.deleteRetainedRawEvidence(ref);')) throw new Error('CONTROLLED_CAPTURE_CAUSAL_REUSE_GUARD_REQUIRED');
  return generated;
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (error) { usage(); throw error; }
  if (String(process.env.GITHUB_ACTIONS ?? '').toLowerCase() === 'true') throw new Error('CONTROLLED_CAPTURE_GITHUB_ACTIONS_FORBIDDEN');
  const repoRoot = output('git', ['rev-parse', '--show-toplevel'], { errorCode: 'CONTROLLED_CAPTURE_REPOSITORY_REQUIRED' });
  if (output('git', ['status', '--porcelain'], { cwd: repoRoot }) !== '') throw new Error('CONTROLLED_CAPTURE_DIRTY_LAUNCHER_FORBIDDEN');
  const launcherSubject = requireSha(output('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }), 'CONTROLLED_CAPTURE_LAUNCHER_SHA_INVALID');
  const producerSubject = requireSha(args['producer-subject'], 'CONTROLLED_CAPTURE_PRODUCER_SHA_REQUIRED');
  const postgresImage = requirePinnedImage(args['postgres-image'], 'CONTROLLED_CAPTURE_PINNED_POSTGRES_IMAGE_REQUIRED');
  const s3Endpoint = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_ENDPOINT');
  const s3Bucket = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_BUCKET');
  const s3Region = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_REGION');
  const s3AccessKey = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID');
  const s3SecretKey = requiredHostEnv('MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY');

  const root = path.resolve(args.root ?? process.env.GEOX_QUALIFICATION_ROOT ?? path.join(os.homedir(), '.geox', 'qualification'));
  const versions = hostPreflight({ qualificationRoot: root });
  const captureId = safeCaptureId(producerSubject);
  const token = captureToken(captureId);
  const captureDir = path.join(root, 'captures', captureId);
  const workspaceDir = path.join(root, 'capture-workspaces', captureId);
  const venvDir = path.join(root, 'capture-venvs', token);
  if ([captureDir, workspaceDir, venvDir].some((p) => fs.existsSync(p))) throw new Error('CONTROLLED_CAPTURE_ID_COLLISION');
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

  try {
    exec('git', ['fetch', '--no-tags', 'origin', 'main'], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_ORIGIN_MAIN_FETCH_FAILED' });
    originMainAtCapture = requireSha(output('git', ['rev-parse', 'origin/main'], { cwd: repoRoot, logFile }), 'CONTROLLED_CAPTURE_ORIGIN_MAIN_SHA_INVALID');
    if (originMainAtCapture !== producerSubject) throw new Error(`CONTROLLED_CAPTURE_EXACT_PROTECTED_MAIN_REQUIRED:${originMainAtCapture}:${producerSubject}`);
    exec('git', ['cat-file', '-e', `${producerSubject}^{commit}`], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_PRODUCER_COMMIT_MISSING' });
    const expectedBlobs = [[PLANNER_REF, PLANNER_BLOB], [SOURCE_REF, SOURCE_BLOB], [HISTORICAL_COMPAT_REF, HISTORICAL_COMPAT_BLOB], [ASSEMBLER_REF, ASSEMBLER_BLOB]];
    for (const [ref, expected] of expectedBlobs) {
      const actual = output('git', ['rev-parse', `${producerSubject}:${ref}`], { cwd: repoRoot, logFile });
      if (actual !== expected) throw new Error(`CONTROLLED_CAPTURE_SOURCE_BLOB_DRIFT:${ref}:${actual}:${expected}`);
    }
    const historicalWorkflowBlob = output('git', ['rev-parse', `${HISTORICAL_WORKFLOW_COMMIT}:${HISTORICAL_WORKFLOW_REF}`], { cwd: repoRoot, logFile });
    if (historicalWorkflowBlob !== HISTORICAL_WORKFLOW_BLOB) throw new Error('CONTROLLED_CAPTURE_HISTORICAL_WORKFLOW_BLOB_DRIFT');

    exec('docker', ['pull', postgresImage], { logFile, errorCode: 'CONTROLLED_CAPTURE_POSTGRES_PULL_FAILED' });
    const imageDigest = postgresImage.slice(postgresImage.indexOf('@') + 1);
    const repoDigests = output('docker', ['image', 'inspect', '--format', '{{json .RepoDigests}}', postgresImage], { logFile });
    if (!repoDigests.includes(imageDigest)) throw new Error('CONTROLLED_CAPTURE_POSTGRES_DIGEST_VERIFICATION_FAILED');

    exec('git', ['worktree', 'add', '--detach', workspaceDir, producerSubject], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_WORKTREE_ADD_FAILED' });
    workspaceAdded = true;
    if (output('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, logFile }) !== producerSubject) throw new Error('CONTROLLED_CAPTURE_WORKTREE_HEAD_MISMATCH');
    if (output('git', ['status', '--porcelain'], { cwd: workspaceDir, logFile }) !== '') throw new Error('CONTROLLED_CAPTURE_WORKTREE_DIRTY');

    exec(executable('pnpm'), ['install', '--frozen-lockfile'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_PNPM_INSTALL_FAILED' });
    exec('python', ['-m', 'venv', venvDir], { logFile, errorCode: 'CONTROLLED_CAPTURE_VENV_FAILED' });
    const py = venvPython(venvDir);
    exec(py, ['-m', 'pip', 'install', '--disable-pip-version-check', ...PYTHON_PACKAGES], { logFile, errorCode: 'CONTROLLED_CAPTURE_PYTHON_INSTALL_FAILED' });
    exec(py, ['-m', 'eccodes', 'selfcheck'], { logFile, errorCode: 'CONTROLLED_CAPTURE_ECCODES_SELFCHECK_FAILED' });
    exec(py, [path.join(workspaceDir, 'scripts', 'runtime_acceptance', 'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'), 'selftest-et0-decimal-normalization'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_ET0_SELFTEST_FAILED' });

    container = `geox-t4r1-cap-${token}`;
    exec('docker', ['run', '--detach', '--name', container, '--label', `geox.qualification.capture_id=${captureId}`, '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_PASSWORD=postgres', '-e', 'POSTGRES_DB=ea5e2_readiness', '-p', '127.0.0.1::5432', postgresImage], { logFile, errorCode: 'CONTROLLED_CAPTURE_POSTGRES_START_FAILED' });
    waitForDatabase(container, logFile);
    const portLine = output('docker', ['port', container, '5432/tcp'], { logFile });
    const m = portLine.match(/127\.0\.0\.1:(\d+)/) ?? portLine.match(/:(\d+)$/);
    if (!m) throw new Error(`CONTROLLED_CAPTURE_POSTGRES_PORT_UNRESOLVED:${portLine}`);
    const databaseUrl = `postgres://postgres:postgres@127.0.0.1:${m[1]}/ea5e2_readiness`;

    exec('node', [PLANNER_REF, 'plan'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_TARGET_PLAN_FAILED' });
    const planPath = path.join(workspaceDir, 'acceptance-output', 'MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.json');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    if (plan.status !== 'PASS' || plan.temporal_authority !== 'PROVIDER_AVAILABILITY_WATERMARK_V1') throw new Error('CONTROLLED_CAPTURE_TARGET_PLAN_INVALID');

    const generatedPath = path.join(workspaceDir, 'scripts', 'runtime_acceptance', '.generated_CONTROLLED_T4R1_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts');
    fs.writeFileSync(generatedPath, buildGeneratedRunner(workspaceDir), { flag: 'wx' });
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
      GEOX_QUALIFICATION_CAPTURE_RUN_TOKEN: token,
      GEOX_QUALIFICATION_CAPTURE_POLICY_ID: POLICY_ID,
    });
    exec(executable('pnpm'), ['exec', 'tsx', generatedPath], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'CONTROLLED_CAPTURE_PROVIDER_EXECUTION_FAILED' });
    exec('node', [ASSEMBLER_REF], { cwd: workspaceDir, env: { ...qenv, MCFT_EA5E2_SUBJECT_SHA: producerSubject }, logFile, errorCode: 'CONTROLLED_CAPTURE_CANDIDATE_ASSEMBLY_FAILED' });

    const candidatePath = path.join(workspaceDir, 'acceptance-output', CANDIDATE_NAME);
    candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
    assertCandidate(candidate, producerSubject);
    candidate.controlled_capture_provenance = {
      schema_version: 'geox_mcft_cap09_controlled_capture_provenance_v1',
      execution_plane: 'GEOX_CONTROLLED_QUALIFICATION_HOST_V1',
      github_actions_execution: false,
      policy_identity: POLICY_ID,
      namespace_mode: 'TARGET_PLUS_CONTROLLED_CAPTURE_RUN_TOKEN',
      capture_id: captureId,
      producer_subject_sha: producerSubject,
      origin_main_sha_at_capture: originMainAtCapture,
      launcher_subject_sha: launcherSubject,
      capture_adapter_ref: 'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V1.cjs',
      capture_adapter_git_blob_sha: output('git', ['rev-parse', `${launcherSubject}:scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V1.cjs`], { cwd: repoRoot, logFile }),
      source_runner_ref: SOURCE_REF,
      source_runner_git_blob_sha: SOURCE_BLOB,
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

    writeJson(path.join(captureDir, 'environment-manifest.json'), {
      schema_version: 'geox_controlled_rolling_capture_environment_v1',
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
      retained_raw_store: {
        endpoint_identity_digest: sha256Buffer(String(s3Endpoint)),
        bucket_identity_digest: sha256Buffer(String(s3Bucket)),
        region: s3Region,
        credential_values_recorded: false,
      },
      generated_at: new Date().toISOString(),
    });
    writeJson(path.join(captureDir, 'provenance', 'git.json'), candidate.controlled_capture_provenance);
    terminalStatus = 'PASS';
  } catch (error) {
    terminalError = error;
    appendLog(logFile, `${error.stack ?? error}`);
  } finally {
    if (container) exec('docker', ['rm', '-f', container], { allowFailure: true, logFile });
    try { if (workspaceAdded) cleanupWorkspace(repoRoot, workspaceDir, logFile); } catch (error) { appendLog(logFile, `${error.stack ?? error}`); if (terminalStatus === 'PASS') { terminalStatus = 'FAIL'; terminalError = error; } }
    try { if (fs.existsSync(venvDir)) fs.rmSync(venvDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); } catch (error) { appendLog(logFile, `${error.stack ?? error}`); if (terminalStatus === 'PASS') { terminalStatus = 'FAIL'; terminalError = error; } }
  }

  const completedAt = new Date().toISOString();
  writeJson(path.join(captureDir, 'result.json'), {
    schema_version: 'geox_controlled_rolling_capture_result_v1',
    status: terminalStatus,
    capture_id: captureId,
    started_at: startedAt,
    completed_at: completedAt,
    producer_subject_sha: producerSubject,
    origin_main_sha_at_capture: originMainAtCapture,
    launcher_subject_sha: launcherSubject,
    candidate_digest: candidateDigest,
    target_t: candidate?.target_t ?? null,
    candidate_expires_at: candidate?.candidate_expires_at ?? null,
    runtime_mutated: false,
    production_mutation: false,
    formal_effect: false,
    github_owner_reactivated: false,
    tests_failed: terminalStatus === 'PASS' ? [] : [terminalError?.message ?? 'UNKNOWN_FAILURE'],
  });
  const packageDigest = finalizePackage(captureDir);
  const candidatePath = path.join(captureDir, 'candidate', CANDIDATE_NAME);
  const sourceRef = terminalStatus === 'PASS'
    ? `geox-controlled-capture://${captureId}/${CANDIDATE_NAME}?package_digest=${encodeURIComponent(packageDigest)}&candidate_digest=${encodeURIComponent(candidateDigest)}`
    : null;
  process.stdout.write(JSON.stringify({
    status: terminalStatus,
    capture_id: captureId,
    capture_dir: captureDir,
    capture_package_digest: packageDigest,
    candidate_path: terminalStatus === 'PASS' ? candidatePath : null,
    candidate_digest: candidateDigest,
    candidate_source_ref: sourceRef,
    producer_subject_sha: producerSubject,
    launcher_subject_sha: launcherSubject,
    runtime_mutated: false,
    production_mutation: false,
    github_owner_reactivated: false,
  }, null, 2) + '\n');
  if (terminalStatus !== 'PASS') process.exitCode = 1;
}

main();
