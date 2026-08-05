#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'acceptance-output');

const SUBJECT = '126257e1a08d116089f5f28bd733e6abfd92f290';
const CORRECTION_BASE = 'f78f5b32c45348fdb48129c01790933644edc6f0';
const CORRECTION_HEAD = '2fb07da376441c379421775560973a415dfe30be';
const CORRECTION_TREE = 'e12c5a5363930d64df1d88232d771a2bfb1981a6';
const CORRECTION_PR = 2891;
const CORRECTION_FOCUSED_RUN = 31038714244;
const CORRECTION_FOCUSED_ARTIFACT = 8943677048;
const CORRECTION_FOCUSED_DIGEST = 'sha256:51fae8b18b48a07c5359009a937771d4ec705c34f3601726fb2b61817877342d';
const CORRECTION_STANDARD_CI = 31038713924;

const INITIAL_CANDIDATE_MERGE = 'a2e23b47abaf571489458363de48f428262b5f31';
const ROUTE_REPAIR_MERGE = 'f01dc179d145a026f7dbdc99a62b1bfa2c065420';
const ROUTE_REPAIR_HEAD = 'fdae6f13876e22947e6939af80e1e7525846052d';
const ROUTE_REPAIR_TREE = '4a26c6864bebcc871d3f22da0bde6e5099a144ac';
const ROUTE_REPAIR_PR = 2893;

const WORKFLOW = '.github/workflows/mcft-cap-09-s2-exact-sha-attestation.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION_V1.cjs';
const CONTROL_FILES = [WORKFLOW, VALIDATOR].sort();

const CORRECTION_FILES = [
  '.github/workflows/mcft-cap-09-s2-database-evidence-ingress.yml',
  'apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-BOUNDARY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CONFIG-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-HARD-ACCEPTANCE-EVIDENCE-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.ts',
];
const CORRECTION_BLOBS = [
  'b9eee566fdab32fe50377d477e1c47e068021c5a',
  'f97bab90d92ff0804d9c13b1092b3e3457e9cd1b',
  '4bc4cf576405bfb210dd71e6002b965df7315cd8',
  '4112e39f766b9c1a6aa7a4aa2b0446c05e63488f',
  'b5453ca348670512597333375aa994220ff24498',
  '2a5cd1c21d3fd3d2c59e1cd97492f256e30c8134',
  '50b40dbc290b4044be2bec6736d1ffc5dbb6dd98',
  '988533c5c89e4584324090f48084f32d58512a6e',
  'f0afefed2d973f87264090694cb5d6f5f4c65af1',
  'fe4cba92713a88408fdb08fd1aca492c8220f4db',
];
const ROUTE_FILES = [
  '.github/workflows/mcft-cap-09-s2-registry-registration.yml',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
];
const ROUTE_BLOBS = [
  '30ae2c74616928c8947f8893109652bbdb4215cd',
  '460ca3f0dcc60c3c37a5cea8610be36234d46194',
  '03a0a2f04a05acc14056073e07f3956b4c43f762',
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
const read = (file) => fs.readFileSync(file, 'utf8');

function writeJson(name, value) {
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT, name), JSON.stringify(value, null, 2) + '\n');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function githubApi(endpoint) {
  requireTrue(process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY, 'GITHUB_ENV_REQUIRED');
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-cap09-s2-corrected-exact-sha',
    },
  });
  const body = await response.text();
  requireTrue(response.ok, `GITHUB_API_${response.status}:${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : {};
}

function verifyFixedBlobs(sha, files, blobs, prefix) {
  for (let index = 0; index < files.length; index += 1) {
    requireTrue(blob(sha, files[index]) === blobs[index], `${prefix}_BLOB_DRIFT:${files[index]}`);
  }
}

function verifyNoAuthorityExpansion(authority) {
  for (const key of [
    'implementation_authorized',
    'runtime_source_authorized',
    'live_ingestion_authorized',
    'background_scheduler_authorized',
    'canonical_write_authorized',
    'public_http_writer_authorized',
    'model_activation_authorized',
    'controlled_action_authorized',
  ]) requireTrue(authority[key] === false, `AUTHORITY_MUST_REMAIN_FALSE:${key}`);
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
    'name: mcft-cap-09-s2-exact-sha-attestation',
    'push:',
    'branches: [main]',
    SUBJECT,
    ROUTE_REPAIR_MERGE,
    '--attest',
    'MCFT_RETENTION_LEVEL: R2',
    "MCFT_RETENTION_DAYS: '730'",
    'mcft-cap-09/s2-exact-sha-attestation',
    'correction_to_merge_tree_delta',
  ]) requireTrue(workflow.includes(token), `WORKFLOW_TOKEN_REQUIRED:${token}`);

  const validator = read(VALIDATOR);
  for (const token of [
    SUBJECT,
    CORRECTION_HEAD,
    CORRECTION_FOCUSED_RUN,
    CORRECTION_FOCUSED_ARTIFACT,
    CORRECTION_FOCUSED_DIGEST,
    CORRECTION_STANDARD_CI,
    ROUTE_REPAIR_MERGE,
    'semantic_artifact_digest',
    'correction_to_merge_tree_delta',
    'MCFT_CAP_09_S3_REGISTRY_REGISTRATION',
  ]) requireTrue(validator.includes(String(token)), `VALIDATOR_TOKEN_REQUIRED:${token}`);

  verifyFixedBlobs(SUBJECT, CORRECTION_FILES, CORRECTION_BLOBS, 'SUBJECT');
  verifyFixedBlobs(head, CORRECTION_FILES, CORRECTION_BLOBS, 'CONTROL_HEAD_RUNTIME');
  verifyFixedBlobs(ROUTE_REPAIR_MERGE, ROUTE_FILES, ROUTE_BLOBS, 'ROUTE_MERGE');
  verifyFixedBlobs(head, ROUTE_FILES, ROUTE_BLOBS, 'CONTROL_HEAD_ROUTE');

  const result = {
    schema_version: 'geox_mcft_cap09_s2_corrected_exact_sha_control_plane_result_v1',
    status: 'PASS',
    change_class: 'MCFT_CAP_09_S2_CORRECTED_EXACT_SHA_R2_CONTROL_PLANE_CANDIDATE',
    base_sha: base,
    head_sha: head,
    changed_files: CONTROL_FILES,
    corrected_s2_subject_sha: SUBJECT,
    correction_focused_run_id: CORRECTION_FOCUSED_RUN,
    correction_focused_artifact_id: CORRECTION_FOCUSED_ARTIFACT,
    correction_standard_ci_run_id: CORRECTION_STANDARD_CI,
    semantic_digest_policy: 'CANONICAL_SORTED_KEYS_V1',
    external_effectiveness: false,
    runtime_source_delta: 0,
    registry_delta: 0,
    taskbook_delta: 0,
    first_legal_next_action: 'PROTECTED_MERGE_TRIGGERS_CORRECTED_S2_EXACT_SHA_R2_ATTESTATION',
  };
  writeJson('MCFT_CAP_09_S2_EXACT_SHA_CONTROL_PLANE_RESULT.json', result);
  console.log(JSON.stringify(result, null, 2));
}

async function attest() {
  requireTrue(process.env.MCFT_SUBJECT_SHA === SUBJECT, 'EXACT_SUBJECT_REQUIRED');
  const controlMerge = git('rev-parse', 'HEAD');

  equal(parents(SUBJECT), [SUBJECT, CORRECTION_BASE, CORRECTION_HEAD],
    'CORRECTED_SUBJECT_PARENT_IDENTITY');
  requireTrue(git('rev-parse', `${CORRECTION_HEAD}^{tree}`) === CORRECTION_TREE,
    'CORRECTION_HEAD_TREE_REQUIRED');
  requireTrue(git('rev-parse', `${SUBJECT}^{tree}`) === CORRECTION_TREE,
    'CORRECTED_SUBJECT_TREE_REQUIRED');
  equal(changedFiles(CORRECTION_BASE, CORRECTION_HEAD), [...CORRECTION_FILES].sort(),
    'EXACT_CORRECTION_BOUNDARY_REQUIRED');

  equal(parents(ROUTE_REPAIR_MERGE), [ROUTE_REPAIR_MERGE, SUBJECT, ROUTE_REPAIR_HEAD],
    'ROUTE_REPAIR_PARENT_IDENTITY');
  requireTrue(git('rev-parse', `${ROUTE_REPAIR_HEAD}^{tree}`) === ROUTE_REPAIR_TREE,
    'ROUTE_REPAIR_HEAD_TREE_REQUIRED');
  requireTrue(git('rev-parse', `${ROUTE_REPAIR_MERGE}^{tree}`) === ROUTE_REPAIR_TREE,
    'ROUTE_REPAIR_MERGE_TREE_REQUIRED');
  equal(changedFiles(SUBJECT, ROUTE_REPAIR_HEAD), [...ROUTE_FILES].sort(),
    'EXACT_ROUTE_REPAIR_BOUNDARY_REQUIRED');

  const controlParents = parents(controlMerge);
  requireTrue(controlParents.length === 3 && controlParents[1] === ROUTE_REPAIR_MERGE,
    'CONTROL_PLANE_MERGE_FIRST_PARENT_REQUIRED');
  const controlHead = controlParents[2];
  equal(parents(controlHead), [controlHead, ROUTE_REPAIR_MERGE],
    'CONTROL_PLANE_HEAD_PARENT_REQUIRED');
  equal(changedFiles(ROUTE_REPAIR_MERGE, controlHead), CONTROL_FILES,
    'EXACT_CONTROL_PLANE_BOUNDARY_REQUIRED');
  requireTrue(git('rev-parse', `${controlHead}^{tree}`) === git('rev-parse', `${controlMerge}^{tree}`),
    'CONTROL_PLANE_HEAD_MERGE_TREE_IDENTITY');
  equal(changedFiles(ROUTE_REPAIR_MERGE, controlMerge), CONTROL_FILES,
    'CONTROL_PLANE_MERGE_DELTA_REQUIRED');

  verifyFixedBlobs(CORRECTION_HEAD, CORRECTION_FILES, CORRECTION_BLOBS, 'CORRECTION_HEAD');
  verifyFixedBlobs(SUBJECT, CORRECTION_FILES, CORRECTION_BLOBS, 'CORRECTED_MERGE');
  verifyFixedBlobs(ROUTE_REPAIR_MERGE, CORRECTION_FILES, CORRECTION_BLOBS, 'ROUTE_MERGE_RUNTIME');
  verifyFixedBlobs(controlMerge, CORRECTION_FILES, CORRECTION_BLOBS, 'CONTROL_MERGE_RUNTIME');
  verifyFixedBlobs(ROUTE_REPAIR_HEAD, ROUTE_FILES, ROUTE_BLOBS, 'ROUTE_HEAD');
  verifyFixedBlobs(ROUTE_REPAIR_MERGE, ROUTE_FILES, ROUTE_BLOBS, 'ROUTE_MERGE');
  verifyFixedBlobs(controlMerge, ROUTE_FILES, ROUTE_BLOBS, 'CONTROL_MERGE_ROUTE');

  const correctionPulls = await githubApi(`/commits/${SUBJECT}/pulls`);
  const correctionPr = correctionPulls.find((pr) =>
    pr.number === CORRECTION_PR
      && pr.merge_commit_sha === SUBJECT
      && pr.head?.sha === CORRECTION_HEAD
      && pr.base?.sha === CORRECTION_BASE);
  requireTrue(Boolean(correctionPr), 'CORRECTION_PR_BINDING_REQUIRED');
  const marker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
  requireTrue(!String(correctionPr.body || '').includes(`<!-- ${marker}`),
    'CORRECTION_PR_MUST_NOT_DECLARE_NEW_CANDIDATE');

  const routePulls = await githubApi(`/commits/${ROUTE_REPAIR_MERGE}/pulls`);
  const routePr = routePulls.find((pr) =>
    pr.number === ROUTE_REPAIR_PR
      && pr.merge_commit_sha === ROUTE_REPAIR_MERGE
      && pr.head?.sha === ROUTE_REPAIR_HEAD
      && pr.base?.sha === SUBJECT);
  requireTrue(Boolean(routePr), 'ROUTE_REPAIR_PR_BINDING_REQUIRED');

  const focusedRun = await githubApi(`/actions/runs/${CORRECTION_FOCUSED_RUN}`);
  const focusedArtifacts = await githubApi(`/actions/runs/${CORRECTION_FOCUSED_RUN}/artifacts?per_page=100`);
  const focusedArtifact = focusedArtifacts.artifacts.find((artifact) =>
    artifact.id === CORRECTION_FOCUSED_ARTIFACT
      && artifact.name === `mcft-cap-09-s2-database-evidence-${CORRECTION_HEAD}`
      && artifact.expired === false);
  requireTrue(focusedRun.head_sha === CORRECTION_HEAD && focusedRun.conclusion === 'success',
    'CORRECTION_FOCUSED_RUN_REQUIRED');
  requireTrue(Boolean(focusedArtifact) && focusedArtifact.digest === CORRECTION_FOCUSED_DIGEST,
    'CORRECTION_FOCUSED_ARTIFACT_REQUIRED');

  const standardCi = await githubApi(`/actions/runs/${CORRECTION_STANDARD_CI}`);
  const standardJobs = await githubApi(`/actions/runs/${CORRECTION_STANDARD_CI}/jobs?per_page=100`);
  requireTrue(standardCi.head_sha === CORRECTION_HEAD && standardCi.conclusion === 'success',
    'CORRECTION_STANDARD_CI_REQUIRED');
  for (const name of ['build-test', 'acceptance']) {
    requireTrue(standardJobs.jobs.some((job) => job.name === name && job.conclusion === 'success'),
      `CORRECTION_STANDARD_JOB_REQUIRED:${name}`);
  }

  const deliveryStatus = JSON.parse(git('show', `${SUBJECT}:docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json`));
  requireTrue(deliveryStatus.postmerge_semantic_correction_implemented === true,
    'CORRECTION_STATUS_NOT_IMPLEMENTED');
  requireTrue(deliveryStatus.shared_core_duplicate_identity_aligned === true,
    'DUPLICATE_IDENTITY_NOT_ALIGNED');
  requireTrue(deliveryStatus.interval_bucket_coverage_aligned === true,
    'INTERVAL_COVERAGE_NOT_ALIGNED');
  requireTrue(deliveryStatus.explicit_trust_fail_closed === true,
    'TRUST_FAIL_CLOSED_NOT_ALIGNED');
  requireTrue(deliveryStatus.actual_observation_freshness_only === true,
    'ACTUAL_FRESHNESS_NOT_ALIGNED');
  requireTrue(deliveryStatus.externally_effective === false,
    'SUBJECT_MUST_BE_PRE_EFFECTIVENESS_BEFORE_ATTESTATION');
  verifyNoAuthorityExpansion(deliveryStatus);

  const attestation = {
    schema_version: 'geox_mcft_cap09_s2_corrected_exact_sha_r2_attestation_v1',
    status: 'PASS',
    capability_line_id: 'MCFT-CAP-09',
    slice_id: 'MCFT-CAP-09.S2',
    subject_sha: SUBJECT,
    merge_commit_sha: SUBJECT,
    initial_candidate_merge_sha: INITIAL_CANDIDATE_MERGE,
    correction_base_main_sha: CORRECTION_BASE,
    correction_pr_number: CORRECTION_PR,
    correction_head_sha: CORRECTION_HEAD,
    correction_tree_sha: CORRECTION_TREE,
    merge_tree_sha: CORRECTION_TREE,
    correction_to_merge_tree_delta: 0,
    exact_sha_route_repair_pr_number: ROUTE_REPAIR_PR,
    exact_sha_route_repair_merge_sha: ROUTE_REPAIR_MERGE,
    control_plane_head_sha: controlHead,
    control_plane_merge_sha: controlMerge,
    control_plane_changed_files: CONTROL_FILES,
    correction_focused_workflow_run_id: CORRECTION_FOCUSED_RUN,
    correction_focused_artifact_id: CORRECTION_FOCUSED_ARTIFACT,
    correction_focused_artifact_digest: CORRECTION_FOCUSED_DIGEST,
    correction_standard_ci_run_id: CORRECTION_STANDARD_CI,
    s2_effectiveness_resolution: {
      protected_correction_merge_verified: true,
      exact_corrected_merge_subject_verified: true,
      correction_head_tree_equals_merge_tree: true,
      exact_ten_file_correction_boundary_verified: true,
      exact_three_file_route_repair_verified: true,
      exact_two_file_control_plane_verified: true,
      repository_facts_envelope_bound: true,
      six_key_scope_sql_verified: true,
      type_aware_role_time_verified: true,
      open_start_closed_end_window_verified: true,
      read_only_transaction_verified: true,
      shared_core_duplicate_identity_aligned: true,
      semantic_duplicate_conflict_fail_closed: true,
      interval_bucket_coverage_aligned: true,
      explicit_trust_fail_closed: true,
      actual_observation_freshness_only: true,
      future_forcing_known_at_boundary_verified: true,
      real_postgresql_acceptance_pass: true,
      focused_workflow_pass: true,
      standard_ci_pass: true,
    },
    effective_authority: {
      s0_authorization_effective: true,
      s1_adapter_contracts_effective: true,
      s2_database_evidence_ingress_effective: true,
      effective_status: 'IN_PROGRESS',
      effective_next_slice: 'S3',
      s3_registry_registration_authorized: true,
      s3_candidate_declaration_authorized: true,
      s3_candidate_declaration_requires_registry_registration: true,
      s3_authorized_scope: 'PERSISTENT_SEQUENTIAL_SCHEDULER_ONLY',
      implementation_authorized: false,
      runtime_source_authorized: false,
      live_ingestion_authorized: false,
      background_scheduler_authorized: false,
      canonical_write_authorized: false,
      public_http_writer_authorized: false,
      model_activation_authorized: false,
      controlled_action_authorized: false,
    },
    retention_contract: {
      level: 'R2',
      days: 730,
      upload_readback_required: true,
      locked_version_delete_denied_required: true,
    },
    first_legal_next_action: 'MCFT_CAP_09_S3_REGISTRY_REGISTRATION',
    postmerge_ssot_writeback: false,
    nonclaims: [
      'NO_S3_IMPLEMENTATION_BEFORE_REGISTRY_AND_CANDIDATE',
      'NO_LIVE_DEVICE_GATEWAY',
      'NO_BACKGROUND_SCHEDULER_YET',
      'NO_CANONICAL_WRITE',
      'NO_MODEL_ACTIVATION',
      'NO_CONTROLLED_ACTION',
      'NO_MCFT_CAP_09_COMPLETION',
    ],
  };
  const semantic = { ...attestation };
  attestation.semantic_artifact_digest = `sha256:${crypto.createHash('sha256').update(canonical(semantic)).digest('hex')}`;
  writeJson('MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION.json', attestation);
  console.log(JSON.stringify({
    status: 'PASS',
    subject_sha: SUBJECT,
    s2_database_evidence_ingress_effective: true,
    first_legal_next_action: attestation.first_legal_next_action,
  }, null, 2));
}

(async () => {
  const mode = process.argv[2];
  try {
    if (mode === '--control-plane-candidate') controlPlaneCandidate();
    else if (mode === '--attest') await attest();
    else throw new Error('MODE_REQUIRED');
  } catch (error) {
    const failure = {
      status: 'FAIL',
      mode: mode || null,
      error: String(error instanceof Error ? error.message : error),
    };
    writeJson(
      mode === '--attest'
        ? 'MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION.json'
        : 'MCFT_CAP_09_S2_EXACT_SHA_CONTROL_PLANE_RESULT.json',
      failure,
    );
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  }
})();
