#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'acceptance-output');

const SUBJECT = '6a4138e77fe6b838bc0f552a0bc5e2ceb84c026f';
const CANDIDATE_BASE = '48b9a1f86e0351cbaadf941956158095e512a3da';
const CANDIDATE_HEAD = '6165ce5b62c69eb081541365f2397c6418922217';
const CANDIDATE_TREE = 'dc867bc51d6daa1f30fb83b73e1766d6549184ed';
const CANDIDATE_PR = 2932;
const FOCUSED_RUN = 31105698704;
const FOCUSED_ARTIFACT = 8969430571;
const FOCUSED_DIGEST = 'sha256:161e212d47a85eec5d446cb8b30279217a71bfac67a5e10e8b0261c91fd91280';
const STANDARD_CI_RUN = 31105698517;

const ROUTE_REPAIR_MERGE = '6a2e5e11ecb87f4cb2874fd007a08a39684a1574';
const ROUTE_REPAIR_HEAD = '1762a64a8e512cef337abf1ea799089d9a96d1ad';
const ROUTE_REPAIR_TREE = '17fe26e3ad4b3a69fedc064bb76768bb317cea69';
const ROUTE_REPAIR_PR = 2933;

const WORKFLOW = '.github/workflows/mcft-cap-09-s4-exact-sha-attestation.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_EXACT_SHA_ATTESTATION_V1.cjs';
const CONTROL_FILES = [WORKFLOW, VALIDATOR].sort();

const CANDIDATE_BLOBS = Object.freeze({
  '.github/workflows/mcft-cap-09-s4-restart-backfill-stale-detection.yml': '6f0db24c7972e655d84e50d349a7b5948a8a2fee',
  'apps/server/src/runtime/twin_runtime/postgres_expired_slot_recovery_adapter_v1.ts': 'aa16ecdab9c9a9f824783104ce89b36860caef8c',
  'apps/server/src/runtime/twin_runtime/restart_backfill_stale_detection_service_v1.ts': 'afce58bcde5db44ce8d2a86e7d1e8219009f86e3',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-DELIVERY-STATUS-V1.json': '2d8da004c1eab86b2efa2d1086ebbd7eaeddb483',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-HARD-ACCEPTANCE-EVIDENCE-V1.json': '093e614b84b4aafd0de25245c8e77dac7cc15933',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json': 'c8ba0f5c239837e08a248b8bfcb4953d11b4c470',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CANDIDATE-BOUNDARY-V1.json': '3e6ada1f1e3a7f15525cb53032e41e10544c6bf8',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CANDIDATE-V1.json': 'db859da3ddfe3bc23db5a150f2c59fe81c9c92e8',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CONFIG-V1.json': 'd98163984a8a5a399d56cb8f000337a9a25ae96d',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.cjs': '27d987f44b04530ef55918e93f3cbb93119ba0fd',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.ts': '857e0b01f9fc4ceb0095a8f7e4640044874df71a',
});
const ROUTE_BLOBS = Object.freeze({
  '.github/workflows/mcft-cap-09-s2-registry-registration.yml': '56950c5a5c6b46abdb6f090303287e40311ba8a5',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs': '509034b6586e4a1a281cacc54eeab9ed4fb17674',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs': '12175f57894991bdc02fc70e0768771f1b99b0a9',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs': '6bf91744fb59a6b79f32daefeba717770f304a89',
});
const AUTHORITY_FALSE = [
  'implementation_authorized',
  'runtime_source_authorized',
  'live_ingestion_authorized',
  'background_scheduler_authorized',
  'canonical_write_authorized',
  'public_http_writer_authorized',
  'model_activation_authorized',
  'controlled_action_authorized',
];

const git = (...args) => cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const requireTrue = (value, code) => { if (!value) throw new Error(code); };
const equal = (actual, expected, code) => {
  try { assert.deepEqual(actual, expected); } catch { throw new Error(code); }
};
const changedFiles = (base, head) => git('diff', '--name-only', `${base}...${head}`)
  .split(/\r?\n/).filter(Boolean).sort();
const parents = (sha) => git('rev-list', '--parents', '-n', '1', sha).split(/\s+/);
const blob = (sha, file) => git('rev-parse', `${sha}:${file}`);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function writeJson(name, value) {
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT, name), `${JSON.stringify(value, null, 2)}\n`);
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function semanticDigest(value) {
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(value))).digest('hex')}`;
}
async function githubApi(endpoint) {
  requireTrue(process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY, 'GITHUB_ENV_REQUIRED');
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-cap09-s4-exact-sha',
    },
  });
  const body = await response.text();
  requireTrue(response.ok, `GITHUB_API_${response.status}:${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : {};
}
function verifyFixedBlobs(sha, mapping, prefix) {
  for (const [file, expected] of Object.entries(mapping)) {
    requireTrue(blob(sha, file) === expected, `${prefix}_BLOB_DRIFT:${file}`);
  }
}
function verifyNoAuthorityExpansion(authority) {
  for (const key of AUTHORITY_FALSE) {
    requireTrue(authority[key] === false, `AUTHORITY_MUST_REMAIN_FALSE:${key}`);
  }
}
function walk(root) {
  const output = [];
  if (!fs.existsSync(root)) return output;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...walk(full));
    else output.push(full);
  }
  return output;
}
function findJson(root, basename) {
  const file = walk(root).find((candidate) => path.basename(candidate) === basename);
  requireTrue(Boolean(file), `FOCUSED_ARTIFACT_FILE_REQUIRED:${basename}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function controlPlaneCandidate() {
  const base = process.env.MCFT_BASE_SHA;
  const head = git('rev-parse', 'HEAD');
  requireTrue(base === ROUTE_REPAIR_MERGE, 'EXACT_CONTROL_PLANE_BASE_REQUIRED');
  requireTrue(git('rev-list', '--count', `${base}..${head}`) === '1', 'ONE_COMMIT_REQUIRED');
  equal(changedFiles(base, head), CONTROL_FILES, 'EXACT_TWO_FILE_CONTROL_PLANE_REQUIRED');

  const marker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
  requireTrue(!read(WORKFLOW).includes(marker) && !read(VALIDATOR).includes(marker),
    'CONTROL_PLANE_CANDIDATE_DECLARATION_FORBIDDEN');

  const workflow = read(WORKFLOW);
  for (const token of [
    'name: mcft-cap-09-s4-exact-sha-attestation',
    'push:',
    'branches: [main]',
    SUBJECT,
    ROUTE_REPAIR_MERGE,
    String(FOCUSED_RUN),
    String(FOCUSED_ARTIFACT),
    FOCUSED_DIGEST,
    String(STANDARD_CI_RUN),
    '--attest',
    'MCFT_RETENTION_LEVEL: R2',
    "MCFT_RETENTION_DAYS: '730'",
    'mcft-cap-09/s4-exact-sha-attestation',
  ]) requireTrue(workflow.includes(token), `WORKFLOW_TOKEN_REQUIRED:${token}`);

  const validator = read(VALIDATOR);
  for (const token of [
    SUBJECT,
    CANDIDATE_HEAD,
    CANDIDATE_TREE,
    String(CANDIDATE_PR),
    String(FOCUSED_RUN),
    String(FOCUSED_ARTIFACT),
    FOCUSED_DIGEST,
    String(STANDARD_CI_RUN),
    ROUTE_REPAIR_MERGE,
    'semantic_artifact_digest',
    's5_registry_registration_authorized',
    'SHADOW_ONLINE_CANONICAL_INTEGRATION_ONLY',
  ]) requireTrue(validator.includes(token), `VALIDATOR_TOKEN_REQUIRED:${token}`);

  verifyFixedBlobs(SUBJECT, CANDIDATE_BLOBS, 'SUBJECT');
  verifyFixedBlobs(head, CANDIDATE_BLOBS, 'CONTROL_HEAD_S4');
  verifyFixedBlobs(ROUTE_REPAIR_MERGE, ROUTE_BLOBS, 'ROUTE_MERGE');
  verifyFixedBlobs(head, ROUTE_BLOBS, 'CONTROL_HEAD_ROUTE');

  const status = JSON.parse(read('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-DELIVERY-STATUS-V1.json'));
  requireTrue(status.status === 'S4_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE', 'S4_STATUS_REQUIRED');
  requireTrue(status.s4_candidate_implemented === true && status.externally_effective === false,
    'S4_NOT_EFFECTIVE_CONTROL_PLANE_REQUIRED');
  verifyNoAuthorityExpansion(status);

  const result = {
    schema_version: 'geox_mcft_cap09_s4_exact_sha_control_plane_result_v1',
    status: 'PASS',
    change_class: 'MCFT_CAP_09_S4_EXACT_SHA_R2_CONTROL_PLANE_CANDIDATE',
    base_sha: base,
    head_sha: head,
    changed_files: CONTROL_FILES,
    s4_subject_sha: SUBJECT,
    focused_run_id: FOCUSED_RUN,
    focused_artifact_id: FOCUSED_ARTIFACT,
    standard_ci_run_id: STANDARD_CI_RUN,
    semantic_digest_policy: 'CANONICAL_SORTED_KEYS_V1',
    external_effectiveness: false,
    runtime_source_delta: 0,
    registry_delta: 0,
    taskbook_delta: 0,
    first_legal_next_action: 'PROTECTED_MERGE_TRIGGERS_S4_EXACT_SHA_R2_ATTESTATION',
  };
  writeJson('MCFT_CAP_09_S4_EXACT_SHA_CONTROL_PLANE_RESULT.json', result);
  console.log(JSON.stringify(result, null, 2));
}

async function attest() {
  requireTrue(process.env.MCFT_SUBJECT_SHA === SUBJECT, 'EXACT_SUBJECT_REQUIRED');
  const controlMerge = git('rev-parse', 'HEAD');

  equal(parents(SUBJECT), [SUBJECT, CANDIDATE_BASE, CANDIDATE_HEAD], 'S4_SUBJECT_PARENT_IDENTITY');
  requireTrue(git('rev-parse', `${CANDIDATE_HEAD}^{tree}`) === CANDIDATE_TREE, 'CANDIDATE_HEAD_TREE_REQUIRED');
  requireTrue(git('rev-parse', `${SUBJECT}^{tree}`) === CANDIDATE_TREE, 'S4_SUBJECT_TREE_REQUIRED');
  equal(changedFiles(CANDIDATE_BASE, CANDIDATE_HEAD), Object.keys(CANDIDATE_BLOBS).sort(),
    'EXACT_S4_CANDIDATE_BOUNDARY_REQUIRED');

  equal(parents(ROUTE_REPAIR_MERGE), [ROUTE_REPAIR_MERGE, SUBJECT, ROUTE_REPAIR_HEAD],
    'ROUTE_REPAIR_PARENT_IDENTITY');
  requireTrue(git('rev-parse', `${ROUTE_REPAIR_HEAD}^{tree}`) === ROUTE_REPAIR_TREE,
    'ROUTE_REPAIR_HEAD_TREE_REQUIRED');
  requireTrue(git('rev-parse', `${ROUTE_REPAIR_MERGE}^{tree}`) === ROUTE_REPAIR_TREE,
    'ROUTE_REPAIR_MERGE_TREE_REQUIRED');
  equal(changedFiles(SUBJECT, ROUTE_REPAIR_HEAD), Object.keys(ROUTE_BLOBS).sort(),
    'EXACT_ROUTE_REPAIR_BOUNDARY_REQUIRED');

  const controlParents = parents(controlMerge);
  requireTrue(controlParents.length === 3 && controlParents[1] === ROUTE_REPAIR_MERGE,
    'CONTROL_PLANE_MERGE_FIRST_PARENT_REQUIRED');
  const controlHead = controlParents[2];
  equal(parents(controlHead), [controlHead, ROUTE_REPAIR_MERGE], 'CONTROL_PLANE_HEAD_PARENT_REQUIRED');
  equal(changedFiles(ROUTE_REPAIR_MERGE, controlHead), CONTROL_FILES,
    'EXACT_CONTROL_PLANE_HEAD_BOUNDARY_REQUIRED');
  requireTrue(git('rev-parse', `${controlHead}^{tree}`) === git('rev-parse', `${controlMerge}^{tree}`),
    'CONTROL_PLANE_HEAD_MERGE_TREE_IDENTITY');
  equal(changedFiles(ROUTE_REPAIR_MERGE, controlMerge), CONTROL_FILES,
    'EXACT_CONTROL_PLANE_MERGE_BOUNDARY_REQUIRED');

  for (const sha of [CANDIDATE_HEAD, SUBJECT, ROUTE_REPAIR_MERGE, controlMerge]) {
    verifyFixedBlobs(sha, CANDIDATE_BLOBS, `S4_${sha}`);
  }
  for (const sha of [ROUTE_REPAIR_HEAD, ROUTE_REPAIR_MERGE, controlMerge]) {
    verifyFixedBlobs(sha, ROUTE_BLOBS, `ROUTE_${sha}`);
  }

  const candidatePulls = await githubApi(`/commits/${SUBJECT}/pulls`);
  const candidatePr = candidatePulls.find((pr) =>
    pr.number === CANDIDATE_PR
      && pr.merge_commit_sha === SUBJECT
      && pr.head?.sha === CANDIDATE_HEAD
      && pr.base?.sha === CANDIDATE_BASE);
  requireTrue(Boolean(candidatePr), 'S4_CANDIDATE_PR_BINDING_REQUIRED');
  const marker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
  requireTrue(String(candidatePr.body || '').includes(`<!-- ${marker}`), 'S4_CANDIDATE_DECLARATION_REQUIRED');

  const routePulls = await githubApi(`/commits/${ROUTE_REPAIR_MERGE}/pulls`);
  const routePr = routePulls.find((pr) =>
    pr.number === ROUTE_REPAIR_PR
      && pr.merge_commit_sha === ROUTE_REPAIR_MERGE
      && pr.head?.sha === ROUTE_REPAIR_HEAD
      && pr.base?.sha === SUBJECT);
  requireTrue(Boolean(routePr), 'ROUTE_REPAIR_PR_BINDING_REQUIRED');
  requireTrue(!String(routePr.body || '').includes(`<!-- ${marker}`),
    'ROUTE_REPAIR_MUST_NOT_DECLARE_CANDIDATE');

  const focusedRun = await githubApi(`/actions/runs/${FOCUSED_RUN}`);
  requireTrue(focusedRun.conclusion === 'success', 'FOCUSED_RUN_SUCCESS_REQUIRED');
  requireTrue(focusedRun.head_sha === CANDIDATE_HEAD, 'FOCUSED_RUN_HEAD_REQUIRED');
  requireTrue(focusedRun.event === 'pull_request', 'FOCUSED_RUN_EVENT_REQUIRED');
  const focusedArtifacts = await githubApi(`/actions/runs/${FOCUSED_RUN}/artifacts?per_page=100`);
  const focusedArtifact = (focusedArtifacts.artifacts || []).find((item) => item.id === FOCUSED_ARTIFACT);
  requireTrue(Boolean(focusedArtifact), 'FOCUSED_ARTIFACT_REQUIRED');
  requireTrue(focusedArtifact.digest === FOCUSED_DIGEST, 'FOCUSED_ARTIFACT_DIGEST_REQUIRED');

  const focusedRoot = process.env.MCFT_CAP09_S4_FOCUSED_ARTIFACT_DIR;
  requireTrue(focusedRoot && fs.existsSync(focusedRoot), 'FOCUSED_ARTIFACT_DIR_REQUIRED');
  const governance = findJson(focusedRoot, 'MCFT_CAP_09_S4_GOVERNANCE_ACCEPTANCE_RESULT.json');
  const runtime = findJson(focusedRoot, 'MCFT_CAP_09_S4_POSTGRESQL_ACCEPTANCE_RESULT.json');
  requireTrue(governance.status === 'PASS', 'S4_GOVERNANCE_ACCEPTANCE_PASS_REQUIRED');
  requireTrue(runtime.status === 'PASS', 'S4_POSTGRESQL_ACCEPTANCE_PASS_REQUIRED');
  for (const key of [
    'persisted_checkpoint_read_verified',
    'expired_active_slot_recovered',
    'idempotency_key_preserved',
    'fencing_token_advanced',
    'old_claim_rejected',
    'same_owner_retry_idempotent',
    'oldest_missed_slot_first_verified',
    'restart_cursor_readback_verified',
    'stale_database_evidence_degraded',
    'scheduler_lag_runtime_health_verified',
    'no_checkpoint_unavailable_verified',
  ]) requireTrue(runtime[key] === true, `S4_RUNTIME_PROOF_REQUIRED:${key}`);
  requireTrue(runtime.persisted_checkpoint_repository === 'PostgresNextTickRepositoryV1',
    'REAL_POSTGRESQL_CHECKPOINT_REPOSITORY_REQUIRED');
  requireTrue(typeof runtime.persisted_checkpoint_ref === 'string' && runtime.persisted_checkpoint_ref.length > 0,
    'PERSISTED_CHECKPOINT_REF_REQUIRED');
  requireTrue(runtime.duplicate_slot_rows === 0 && runtime.active_slot_count === 0,
    'S4_DUPLICATE_OR_ACTIVE_SLOT_FORBIDDEN');
  requireTrue(runtime.canonical_fact_delta === 0 && runtime.canonical_write_performed === false,
    'S4_CANONICAL_WRITE_FORBIDDEN');
  requireTrue(runtime.background_scheduler_started === false && runtime.production_wiring_present === false,
    'S4_PRODUCTION_WIRING_FORBIDDEN');

  const standardRun = await githubApi(`/actions/runs/${STANDARD_CI_RUN}`);
  requireTrue(standardRun.conclusion === 'success', 'STANDARD_CI_SUCCESS_REQUIRED');
  requireTrue(standardRun.head_sha === CANDIDATE_HEAD, 'STANDARD_CI_HEAD_REQUIRED');
  const standardJobs = await githubApi(`/actions/runs/${STANDARD_CI_RUN}/jobs?per_page=100`);
  for (const name of ['build-test', 'acceptance']) {
    const job = (standardJobs.jobs || []).find((item) => item.name === name);
    requireTrue(job?.conclusion === 'success', `STANDARD_CI_JOB_REQUIRED:${name}`);
  }

  const semanticFiles = Object.entries(CANDIDATE_BLOBS).map(([file, blobSha]) => ({
    path: file,
    blob_sha: blobSha,
  }));
  const attestationWithoutDigest = {
    schema_version: 'geox_mcft_cap09_s4_exact_sha_attestation_v1',
    status: 'PASS',
    capability_line_id: 'MCFT-CAP-09',
    slice_id: 'MCFT-CAP-09.S4',
    authority_claim: 'MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION_EFFECTIVE',
    subject_sha: SUBJECT,
    candidate_head_sha: CANDIDATE_HEAD,
    candidate_tree_sha: CANDIDATE_TREE,
    candidate_to_merge_tree_delta: 0,
    route_repair_merge_sha: ROUTE_REPAIR_MERGE,
    control_plane_merge_sha: controlMerge,
    focused_run_id: FOCUSED_RUN,
    focused_artifact_id: FOCUSED_ARTIFACT,
    focused_artifact_digest: FOCUSED_DIGEST,
    standard_ci_run_id: STANDARD_CI_RUN,
    semantic_digest_policy: 'CANONICAL_SORTED_KEYS_V1',
    semantic_artifact: {
      schema_version: 'geox_mcft_cap09_s4_semantic_artifact_v1',
      subject_sha: SUBJECT,
      candidate_base_sha: CANDIDATE_BASE,
      candidate_head_sha: CANDIDATE_HEAD,
      candidate_tree_sha: CANDIDATE_TREE,
      candidate_pr_number: CANDIDATE_PR,
      semantic_files: semanticFiles,
      focused_workflow_run_id: FOCUSED_RUN,
      focused_artifact_id: FOCUSED_ARTIFACT,
      focused_artifact_digest: FOCUSED_DIGEST,
      standard_ci_run_id: STANDARD_CI_RUN,
      route_repair_merge_sha: ROUTE_REPAIR_MERGE,
      control_plane_merge_sha: controlMerge,
      candidate_to_merge_tree_delta: 0,
      persisted_checkpoint_ref: runtime.persisted_checkpoint_ref,
      persisted_checkpoint_repository: runtime.persisted_checkpoint_repository,
      canonical_fact_delta: runtime.canonical_fact_delta,
      duplicate_slot_rows: runtime.duplicate_slot_rows,
      active_slot_count: runtime.active_slot_count,
    },
    semantic_digest_scope: 'ENTIRE_ATTESTATION_EXCLUDING_SEMANTIC_ARTIFACT_DIGEST',
    effective_authority: {
      s4_restart_backfill_stale_detection_effective: true,
      effective_next_slice: 'S5',
      s5_registry_registration_authorized: true,
      s5_authorized_scope: 'SHADOW_ONLINE_CANONICAL_INTEGRATION_ONLY',
      implementation_authorized: false,
      runtime_source_authorized: false,
      live_ingestion_authorized: false,
      background_scheduler_authorized: false,
      canonical_write_authorized: false,
      public_http_writer_authorized: false,
      model_activation_authorized: false,
      controlled_action_authorized: false,
      first_legal_next_action: 'MCFT_CAP_09_S5_REGISTRY_REGISTRATION',
    },
    retention_required: {
      level: 'R2',
      days: 730,
      readback_required: true,
      locked_delete_denial_required: true,
    },
  };
  verifyNoAuthorityExpansion(attestationWithoutDigest.effective_authority);
  const attestation = {
    ...attestationWithoutDigest,
    semantic_artifact_digest: semanticDigest(attestationWithoutDigest),
  };
  writeJson('MCFT_CAP_09_S4_EXACT_SHA_ATTESTATION.json', attestation);
  console.log(JSON.stringify(attestation, null, 2));
}

const mode = process.argv[2];
(async () => {
  try {
    if (mode === '--control-plane-candidate') controlPlaneCandidate();
    else if (mode === '--attest') await attest();
    else throw new Error(`MODE_INVALID:${mode}`);
  } catch (error) {
    const name = mode === '--attest'
      ? 'MCFT_CAP_09_S4_EXACT_SHA_ATTESTATION.json'
      : 'MCFT_CAP_09_S4_EXACT_SHA_CONTROL_PLANE_RESULT.json';
    writeJson(name, { status: 'FAIL', error: String(error?.message ?? error) });
    console.error(error);
    process.exitCode = 1;
  }
})();
