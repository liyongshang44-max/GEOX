#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'acceptance-output');

const SUBJECT = '15cdb24667d43cf7c21294d22b68160c6668cf73';
const CANDIDATE_BASE = '7bb23bae7951325257292cd6a494b11931f2168b';
const CANDIDATE_HEAD = '7ebc34b968df6e95d13bcb905434a962959e4f4b';
const CANDIDATE_TREE = '1ce5a049c9c3ffcce6a17f565939b2b0b439d037';
const CANDIDATE_PR = 2900;
const FOCUSED_RUN = 31066566600;
const FOCUSED_JOB = ['s3', 'persistent', 'sequential', 'scheduler'].join('-');
const FOCUSED_ARTIFACT = 8954037604;
const FOCUSED_DIGEST = 'sha256:bac8fa6b54d56815b1717c8cba2e8aaaec86c2f6658095fcbce323997657b2cf';
const STANDARD_CI_RUN = 31066566555;

const ROUTE_MERGE = 'aed32435bf1bbc6bd50af5cd46c7bb8dc29d0803';
const ROUTE_HEAD = '535c66011624378fd7a149ddf053230354740a79';
const ROUTE_TREE = '15583ba0e7f3e1d3efdbd4aad3fe5a7793e06508';
const ROUTE_PR = 2903;

const FIRST_FAILED = {
  merge: '41d763c7b1b1c9f35efc702b965ab0cea4632447',
  head: '83deb238efb372dc4f573ab71cf49088004b7ac8',
  tree: 'f04dbb31e5824fb3fcb99cc9ecd99b3303507c6a',
  run: 31068800943,
  parent: ROUTE_MERGE,
  blobs: [
    'b185b1e40f6b6a2c64445548bcb549fa5fa36121',
    '9d50947fa0ae77dac91fd6a8a4bceaa2fb20eb8d',
  ],
};
const SECOND_FAILED = {
  merge: 'd86f0c979f69a89807e4cd88faa51928be587993',
  head: 'c38419fb6ebc2e33012c47d4815597a6fa8b7ab5',
  tree: 'a6d8262bcb23511c06a6f518dd1a91555be51d7e',
  run: 31072140910,
  parent: FIRST_FAILED.merge,
  blobs: [
    'e70eded76878000b40bc02b7bc0b3ae7432c4fa7',
    '3bbf9eb5f3c23e244f619bcd1d3ddddd94f99630',
  ],
};

const WORKFLOW = '.github/workflows/mcft-cap-09-s3-exact-sha-attestation.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION_V1.cjs';
const CONTROL_FILES = [WORKFLOW, VALIDATOR].sort();

const SCHEDULER_FILES = [
  '.github/workflows/mcft-cap-09-s3-persistent-sequential-scheduler.yml',
  'apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql',
  'apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-HARD-ACCEPTANCE-EVIDENCE-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CANDIDATE-BOUNDARY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CANDIDATE-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CONFIG-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER.ts',
];
const SCHEDULER_BLOBS = [
  '066d441196850fd62caf0f91e48b05f0043eb701',
  '5f6da30bb9f61776347e8580a2e3972f453090c5',
  '6133206095ca3a98ab5e8ae514ee4610404d2edd',
  '0ae968f90dbbbfce4b7046aabcd22e90059ab0e5',
  'f7bc71bf2e5fcb510601cde5875511fe0d04648a',
  'c3115ac4177e0f57aa4db286a684da2ba0da6944',
  '99418ea10ba43a36a266a35b80b6f078c816221a',
  '60270b80957d52699fe8f71c39579b94fdd24f4c',
  '404791d3320dcd5a28d5c5616813a920c34dd938',
  'bc73986c58b3f1a96355776f9c0e04404d2ccff2',
  'a97d59b10d89ffde65f681614a4f9046cf2f89af',
];
const ROUTE_FILES = [
  '.github/workflows/mcft-cap-09-s2-registry-registration.yml',
  '.github/workflows/mcft-cap-09-s3-registry-registration.yml',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs',
];
const ROUTE_BLOBS = [
  'a348eb38ff8d760173492aa53476d0001f535bae',
  '1505838bace92af2611f458c6108ab0025e5aac5',
  'b0d2f7433ae4aba33f8c10d97a27fe6ab5c5b5e4',
  'cfc84f02dbabaeda967cccaa015bbe26e6cf05d1',
  '15e77014d50ec3acfb4ffc2a9279bc45fbf095c5',
];

const declarationMarker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');

function git(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function must(value, code) {
  if (!value) throw new Error(code);
}
function equal(actual, expected, code) {
  try { assert.deepEqual(actual, expected); } catch { throw new Error(code); }
}
function parents(sha) {
  return git('rev-list', '--parents', '-n', '1', sha).split(/\s+/);
}
function changedFiles(base, head) {
  return git('diff', '--name-only', `${base}...${head}`).split(/\r?\n/).filter(Boolean).sort();
}
function blobAt(sha, file) {
  return git('rev-parse', `${sha}:${file}`);
}
function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}
function write(name, value) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(value, null, 2)}\n`);
}
function assertFixedBlobs(sha, files, blobs, prefix) {
  equal(files.map((file) => blobAt(sha, file)), blobs, `${prefix}_BLOBS`);
}
function assertFailedGeneration(generation, label) {
  equal(parents(generation.merge), [generation.merge, generation.parent, generation.head], `${label}_MERGE_PARENTS`);
  equal(parents(generation.head), [generation.head, generation.parent], `${label}_HEAD_PARENT`);
  must(git('rev-parse', `${generation.head}^{tree}`) === generation.tree, `${label}_HEAD_TREE`);
  must(git('rev-parse', `${generation.merge}^{tree}`) === generation.tree, `${label}_MERGE_TREE`);
  equal(changedFiles(generation.parent, generation.head), CONTROL_FILES, `${label}_BOUNDARY`);
  equal(changedFiles(generation.parent, generation.merge), CONTROL_FILES, `${label}_MERGE_DELTA`);
  assertFixedBlobs(generation.merge, CONTROL_FILES, generation.blobs, label);
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical)}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)}}`;
  }
  return JSON.stringify(value);
}
function semanticDigest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonical(value)).digest('hex')}`;
}
async function githubApi(endpoint) {
  must(process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY, 'GITHUB_ENV_REQUIRED');
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-cap09-s3-exact-sha-v4',
    },
  });
  const text = await response.text();
  must(response.ok, `GITHUB_API_${response.status}:${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}
function assertNoRuntimeAuthority(authority) {
  for (const key of [
    'implementation_authorized', 'runtime_source_authorized', 'live_ingestion_authorized',
    'background_scheduler_authorized', 'canonical_write_authorized',
    'public_http_writer_authorized', 'model_activation_authorized', 'controlled_action_authorized',
  ]) must(authority[key] === false, `AUTHORITY_MUST_REMAIN_FALSE:${key}`);
}

function validateControlPlaneCandidate() {
  const base = process.env.MCFT_BASE_SHA;
  const head = git('rev-parse', 'HEAD');
  must(base === SECOND_FAILED.merge, 'EXACT_CONTROL_PLANE_REPAIR_BASE_REQUIRED');
  must(git('rev-list', '--count', `${base}..${head}`) === '1', 'ONE_COMMIT_REQUIRED');
  equal(changedFiles(base, head), CONTROL_FILES, 'EXACT_TWO_FILE_CONTROL_PLANE_REPAIR_REQUIRED');

  equal(parents(SUBJECT), [SUBJECT, CANDIDATE_BASE, CANDIDATE_HEAD], 'SUBJECT_PARENTS');
  equal(parents(ROUTE_MERGE), [ROUTE_MERGE, SUBJECT, ROUTE_HEAD], 'ROUTE_PARENTS');
  assertFailedGeneration(FIRST_FAILED, 'FIRST_FAILED_CONTROL');
  assertFailedGeneration(SECOND_FAILED, 'SECOND_FAILED_CONTROL');

  const workflow = read(WORKFLOW);
  const validator = read(VALIDATOR);
  must(!workflow.includes(declarationMarker), 'WORKFLOW_DECLARATION_FORBIDDEN');
  must(!validator.includes(declarationMarker), 'VALIDATOR_DECLARATION_FORBIDDEN');
  for (const token of [
    'S3_EXACT_SHA_R2_REPAIR_V4', SUBJECT, ROUTE_MERGE, FIRST_FAILED.merge, SECOND_FAILED.merge,
    'MCFT_SUBJECT_SHA', '--attest', "MCFT_RETENTION_DAYS: '730'", 'mcft-cap-09/s3-exact-sha-attestation',
  ]) must(workflow.includes(token), `WORKFLOW_TOKEN:${token}`);
  for (const token of [
    SUBJECT, CANDIDATE_HEAD, FOCUSED_RUN, FOCUSED_ARTIFACT, FOCUSED_DIGEST, STANDARD_CI_RUN,
    ROUTE_MERGE, FIRST_FAILED.merge, FIRST_FAILED.run, SECOND_FAILED.merge, SECOND_FAILED.run,
    'semantic_artifact_digest', 'candidate_to_merge_tree_delta',
    's3_persistent_sequential_scheduler_effective', 'MCFT_CAP_09_S4_REGISTRY_REGISTRATION',
  ]) must(validator.includes(String(token)), `VALIDATOR_TOKEN:${token}`);

  assertFixedBlobs(SUBJECT, SCHEDULER_FILES, SCHEDULER_BLOBS, 'SUBJECT');
  assertFixedBlobs(head, SCHEDULER_FILES, SCHEDULER_BLOBS, 'REPAIR_HEAD_CANDIDATE');
  assertFixedBlobs(ROUTE_MERGE, ROUTE_FILES, ROUTE_BLOBS, 'ROUTE_MERGE');
  assertFixedBlobs(head, ROUTE_FILES, ROUTE_BLOBS, 'REPAIR_HEAD_ROUTE');

  const result = {
    schema_version: 'geox_mcft_cap09_s3_exact_sha_control_plane_repair_result_v4',
    status: 'PASS',
    change_class: 'MCFT_CAP_09_S3_EXACT_SHA_R2_DUAL_GENERATION_REPAIR_CANDIDATE',
    base_sha: base,
    head_sha: head,
    changed_files: CONTROL_FILES,
    subject_sha: SUBJECT,
    first_failed_control_merge_sha: FIRST_FAILED.merge,
    first_failed_run_id: FIRST_FAILED.run,
    second_failed_control_merge_sha: SECOND_FAILED.merge,
    second_failed_run_id: SECOND_FAILED.run,
    corrected_focused_artifact_digest: FOCUSED_DIGEST,
    external_effectiveness: false,
    runtime_source_delta: 0,
    registry_delta: 0,
    first_legal_next_action: 'PROTECTED_MERGE_RETRIES_S3_EXACT_SHA_R2_ATTESTATION',
  };
  write('MCFT_CAP_09_S3_EXACT_SHA_CONTROL_PLANE_RESULT.json', result);
  console.log(JSON.stringify(result, null, 2));
}

async function deriveAttestation() {
  must(process.env.MCFT_SUBJECT_SHA === SUBJECT, 'EXACT_SUBJECT_REQUIRED');
  must(process.env.MCFT_FAILED_CONTROL_PLANE_SHA === SECOND_FAILED.merge, 'LATEST_FAILED_CONTROL_ENV_REQUIRED');
  const controlMerge = git('rev-parse', 'HEAD');

  equal(parents(SUBJECT), [SUBJECT, CANDIDATE_BASE, CANDIDATE_HEAD], 'SUBJECT_PARENTS');
  must(git('rev-parse', `${CANDIDATE_HEAD}^{tree}`) === CANDIDATE_TREE, 'CANDIDATE_HEAD_TREE');
  must(git('rev-parse', `${SUBJECT}^{tree}`) === CANDIDATE_TREE, 'SUBJECT_TREE');
  equal(changedFiles(CANDIDATE_BASE, CANDIDATE_HEAD), [...SCHEDULER_FILES].sort(), 'CANDIDATE_BOUNDARY');

  equal(parents(ROUTE_MERGE), [ROUTE_MERGE, SUBJECT, ROUTE_HEAD], 'ROUTE_PARENTS');
  must(git('rev-parse', `${ROUTE_HEAD}^{tree}`) === ROUTE_TREE, 'ROUTE_HEAD_TREE');
  must(git('rev-parse', `${ROUTE_MERGE}^{tree}`) === ROUTE_TREE, 'ROUTE_MERGE_TREE');
  equal(changedFiles(SUBJECT, ROUTE_HEAD), [...ROUTE_FILES].sort(), 'ROUTE_BOUNDARY');

  assertFailedGeneration(FIRST_FAILED, 'FIRST_FAILED_CONTROL');
  assertFailedGeneration(SECOND_FAILED, 'SECOND_FAILED_CONTROL');

  const controlParents = parents(controlMerge);
  must(controlParents.length === 3 && controlParents[1] === SECOND_FAILED.merge, 'CURRENT_REPAIR_MERGE_FIRST_PARENT');
  const repairHead = controlParents[2];
  equal(parents(repairHead), [repairHead, SECOND_FAILED.merge], 'CURRENT_REPAIR_HEAD_PARENT');
  equal(changedFiles(SECOND_FAILED.merge, repairHead), CONTROL_FILES, 'CURRENT_REPAIR_BOUNDARY');
  must(git('rev-parse', `${repairHead}^{tree}`) === git('rev-parse', `${controlMerge}^{tree}`), 'CURRENT_REPAIR_TREE_IDENTITY');
  equal(changedFiles(SECOND_FAILED.merge, controlMerge), CONTROL_FILES, 'CURRENT_REPAIR_MERGE_DELTA');

  for (const sha of [CANDIDATE_HEAD, SUBJECT, ROUTE_MERGE, FIRST_FAILED.merge, SECOND_FAILED.merge, controlMerge]) {
    assertFixedBlobs(sha, SCHEDULER_FILES, SCHEDULER_BLOBS, `${sha.slice(0, 8)}_CANDIDATE`);
  }
  for (const sha of [ROUTE_HEAD, ROUTE_MERGE, FIRST_FAILED.merge, SECOND_FAILED.merge, controlMerge]) {
    assertFixedBlobs(sha, ROUTE_FILES, ROUTE_BLOBS, `${sha.slice(0, 8)}_ROUTE`);
  }

  const candidatePulls = await githubApi(`/commits/${SUBJECT}/pulls`);
  const candidatePr = candidatePulls.find((entry) =>
    entry.number === CANDIDATE_PR && entry.merge_commit_sha === SUBJECT &&
    entry.head?.sha === CANDIDATE_HEAD && entry.base?.sha === CANDIDATE_BASE);
  must(candidatePr && String(candidatePr.body || '').includes(declarationMarker), 'CANDIDATE_PR_BINDING');

  const routePulls = await githubApi(`/commits/${ROUTE_MERGE}/pulls`);
  must(routePulls.some((entry) => entry.number === ROUTE_PR && entry.merge_commit_sha === ROUTE_MERGE &&
    entry.head?.sha === ROUTE_HEAD && entry.base?.sha === SUBJECT), 'ROUTE_PR_BINDING');

  for (const [generation, label] of [[FIRST_FAILED, 'FIRST'], [SECOND_FAILED, 'SECOND']]) {
    const failedRun = await githubApi(`/actions/runs/${generation.run}`);
    must(Number(failedRun.id) === generation.run && failedRun.head_sha === generation.merge &&
      failedRun.event === 'push' && failedRun.conclusion === 'failure', `${label}_FAILED_RUN_BINDING`);
  }

  const focusedRun = await githubApi(`/actions/runs/${FOCUSED_RUN}`);
  must(Number(focusedRun.id) === FOCUSED_RUN && focusedRun.head_sha === CANDIDATE_HEAD &&
    focusedRun.event === 'pull_request' && focusedRun.conclusion === 'success', 'FOCUSED_RUN_BINDING');
  const focusedJobs = await githubApi(`/actions/runs/${FOCUSED_RUN}/jobs?per_page=100`);
  must(focusedJobs.jobs?.some((job) => job.name === FOCUSED_JOB && job.conclusion === 'success'), 'FOCUSED_JOB_SUCCESS');
  const focusedArtifacts = await githubApi(`/actions/runs/${FOCUSED_RUN}/artifacts`);
  const focusedArtifact = focusedArtifacts.artifacts?.find((entry) => Number(entry.id) === FOCUSED_ARTIFACT);
  must(focusedArtifact && focusedArtifact.expired === false && focusedArtifact.digest === FOCUSED_DIGEST,
    'FOCUSED_ARTIFACT_BINDING');

  const standardRun = await githubApi(`/actions/runs/${STANDARD_CI_RUN}`);
  must(Number(standardRun.id) === STANDARD_CI_RUN && standardRun.head_sha === CANDIDATE_HEAD &&
    standardRun.event === 'pull_request' && standardRun.conclusion === 'success', 'STANDARD_CI_BINDING');
  const standardJobs = await githubApi(`/actions/runs/${STANDARD_CI_RUN}/jobs?per_page=100`);
  for (const jobName of ['build-test', 'acceptance']) {
    must(standardJobs.jobs?.some((job) => job.name === jobName && job.conclusion === 'success'), `STANDARD_JOB:${jobName}`);
  }

  const candidateToMergeTreeDelta = changedFiles(CANDIDATE_HEAD, SUBJECT).length;
  must(candidateToMergeTreeDelta === 0, 'CANDIDATE_TO_MERGE_TREE_DELTA');
  const semanticArtifact = {
    schema_version: 'geox_mcft_cap09_s3_semantic_artifact_v4',
    subject_sha: SUBJECT,
    candidate_base_sha: CANDIDATE_BASE,
    candidate_head_sha: CANDIDATE_HEAD,
    candidate_tree_sha: CANDIDATE_TREE,
    candidate_pr_number: CANDIDATE_PR,
    semantic_files: SCHEDULER_FILES.map((file, index) => ({ path: file, blob_sha: SCHEDULER_BLOBS[index] })),
    focused_workflow_run_id: FOCUSED_RUN,
    focused_artifact_id: FOCUSED_ARTIFACT,
    focused_artifact_digest: FOCUSED_DIGEST,
    standard_ci_run_id: STANDARD_CI_RUN,
    route_repair_merge_sha: ROUTE_MERGE,
    failed_control_generations: [
      { merge_sha: FIRST_FAILED.merge, run_id: FIRST_FAILED.run, blobs: FIRST_FAILED.blobs },
      { merge_sha: SECOND_FAILED.merge, run_id: SECOND_FAILED.run, blobs: SECOND_FAILED.blobs },
    ],
    control_plane_repair_merge_sha: controlMerge,
    candidate_to_merge_tree_delta: candidateToMergeTreeDelta,
  };
  const effectiveAuthority = {
    s3_persistent_sequential_scheduler_effective: true,
    effective_next_slice: 'S4',
    s4_registry_registration_authorized: true,
    s4_authorized_scope: 'RESTART_BACKFILL_STALE_DETECTION_ONLY',
    implementation_authorized: false,
    runtime_source_authorized: false,
    live_ingestion_authorized: false,
    background_scheduler_authorized: false,
    canonical_write_authorized: false,
    public_http_writer_authorized: false,
    model_activation_authorized: false,
    controlled_action_authorized: false,
    first_legal_next_action: 'MCFT_CAP_09_S4_REGISTRY_REGISTRATION',
  };
  assertNoRuntimeAuthority(effectiveAuthority);
  const attestation = {
    schema_version: 'geox_mcft_cap09_s3_exact_sha_attestation_v4',
    status: 'PASS',
    authority_claim: 'MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER_EFFECTIVE',
    subject_sha: SUBJECT,
    candidate_head_sha: CANDIDATE_HEAD,
    candidate_tree_sha: CANDIDATE_TREE,
    candidate_to_merge_tree_delta: candidateToMergeTreeDelta,
    route_repair_merge_sha: ROUTE_MERGE,
    first_failed_control_plane_merge_sha: FIRST_FAILED.merge,
    first_failed_attestation_run_id: FIRST_FAILED.run,
    second_failed_control_plane_merge_sha: SECOND_FAILED.merge,
    second_failed_attestation_run_id: SECOND_FAILED.run,
    control_plane_repair_merge_sha: controlMerge,
    focused_run_id: FOCUSED_RUN,
    focused_artifact_id: FOCUSED_ARTIFACT,
    focused_artifact_digest: FOCUSED_DIGEST,
    standard_ci_run_id: STANDARD_CI_RUN,
    semantic_digest_policy: process.env.MCFT_SEMANTIC_DIGEST_POLICY || 'CANONICAL_SORTED_KEYS_V1',
    semantic_artifact: semanticArtifact,
    semantic_artifact_digest: semanticDigest(semanticArtifact),
    effective_authority: effectiveAuthority,
    retention_required: { level: 'R2', days: 730, readback_required: true, locked_delete_denial_required: true },
  };
  write('MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION.json', attestation);
  console.log(JSON.stringify(attestation, null, 2));
}

(async () => {
  try {
    if (process.argv.includes('--control-plane-candidate')) validateControlPlaneCandidate();
    else if (process.argv.includes('--attest')) await deriveAttestation();
    else throw new Error('MODE_REQUIRED');
  } catch (error) {
    const name = process.argv.includes('--control-plane-candidate')
      ? 'MCFT_CAP_09_S3_EXACT_SHA_CONTROL_PLANE_RESULT.json'
      : 'MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION.json';
    const failure = { status: 'FAIL', error: String(error instanceof Error ? error.message : error) };
    write(name, failure);
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  }
})();
