#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'acceptance-output');

const SUBJECT = '15cdb24667d43cf7c21294d22b68160c6668cf73';
const CANDIDATE_BASE = '7bb23bae7951325257292cd6a494b11931f2168b';
const CANDIDATE_HEAD = '7ebc34b968df6e95d13bcb905434a962959e4f4b';
const CANDIDATE_TREE = '1ce5a049c9c3ffcce6a17f565939b2b0b439d037';
const CANDIDATE_PR = 2900;
const FOCUSED_RUN = 31066566600;
const FOCUSED_ARTIFACT = 8954037604;
const FOCUSED_DIGEST = 'sha256:bac8fa6b0cde49aafa84eeaf0a2d505841883888ee9d1bcb926549114aaaf793';
const STANDARD_CI = 31066566555;

const ROUTE_REPAIR_MERGE = 'aed32435bf1bbc6bd50af5cd46c7bb8dc29d0803';
const ROUTE_REPAIR_HEAD = '535c66011624378fd7a149ddf053230354740a79';
const ROUTE_REPAIR_TREE = '15583ba0e7f3e1d3efdbd4aad3fe5a7793e06508';
const ROUTE_REPAIR_PR = 2903;

const WORKFLOW = '.github/workflows/mcft-cap-09-s3-exact-sha-attestation.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION_V1.cjs';
const CONTROL_FILES = [WORKFLOW, VALIDATOR].sort();

const CANDIDATE_FILES = [
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
const CANDIDATE_BLOBS = [
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

const git = (...args) => cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const must = (value, code) => { if (!value) throw new Error(code); };
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

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonical(value)).digest('hex')}`;
}

async function githubApi(endpoint) {
  must(process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY, 'GITHUB_ENV_REQUIRED');
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-cap09-s3-exact-sha',
    },
  });
  const body = await response.text();
  must(response.ok, `GITHUB_API_${response.status}:${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : {};
}

function verifyFixedBlobs(sha, files, blobs, prefix) {
  for (let index = 0; index < files.length; index += 1) {
    must(blob(sha, files[index]) === blobs[index], `${prefix}_BLOB_DRIFT:${files[index]}`);
  }
}

function falseAuthorities(authority) {
  for (const key of [
    'implementation_authorized',
    'runtime_source_authorized',
    'live_ingestion_authorized',
    'background_scheduler_authorized',
    'canonical_write_authorized',
    'public_http_writer_authorized',
    'model_activation_authorized',
    'controlled_action_authorized',
  ]) must(authority[key] === false, `AUTHORITY_MUST_REMAIN_FALSE:${key}`);
}

function controlPlaneCandidate() {
  const base = process.env.MCFT_BASE_SHA;
  const head = git('rev-parse', 'HEAD');
  must(base === ROUTE_REPAIR_MERGE, 'EXACT_CONTROL_PLANE_BASE_REQUIRED');
  must(git('rev-list', '--count', `${base}..${head}`) === '1', 'ONE_COMMIT_REQUIRED');
  equal(changedFiles(base, head), CONTROL_FILES, 'EXACT_TWO_FILE_CONTROL_PLANE_REQUIRED');

  const marker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
  must(!read(WORKFLOW).includes(marker) && !read(VALIDATOR).includes(marker),
    'CONTROL_PLANE_CANDIDATE_DECLARATION_FORBIDDEN');

  const workflow = read(WORKFLOW);
  for (const token of [
    'name: mcft-cap-09-s3-exact-sha-attestation',
    'push:',
    'branches: [main]',
    SUBJECT,
    ROUTE_REPAIR_MERGE,
    'MCFT_SUBJECT_SHA',
    '--attest',
    'MCFT_RETENTION_LEVEL: R2',
    "MCFT_RETENTION_DAYS: '730'",
    'mcft-cap-09/s3-exact-sha-attestation',
    'candidate_to_merge_tree_delta',
  ]) must(workflow.includes(token), `WORKFLOW_TOKEN_REQUIRED:${token}`);

  const validator = read(VALIDATOR);
  for (const token of [
    SUBJECT,
    CANDIDATE_HEAD,
    FOCUSED_RUN,
    FOCUSED_ARTIFACT,
    FOCUSED_DIGEST,
    STANDARD_CI,
    ROUTE_REPAIR_MERGE,
    'semantic_artifact_digest',
    'candidate_to_merge_tree_delta',
    's3_persistent_sequential_scheduler_effective',
    'MCFT_CAP_09_S4_REGISTRY_REGISTRATION',
  ]) must(validator.includes(String(token)), `VALIDATOR_TOKEN_REQUIRED:${token}`);

  verifyFixedBlobs(SUBJECT, CANDIDATE_FILES, CANDIDATE_BLOBS, 'SUBJECT');
  verifyFixedBlobs(head, CANDIDATE_FILES, CANDIDATE_BLOBS, 'CONTROL_HEAD_CANDIDATE');
  verifyFixedBlobs(ROUTE_REPAIR_MERGE, ROUTE_FILES, ROUTE_BLOBS, 'ROUTE_MERGE');
  verifyFixedBlobs(head, ROUTE_FILES, ROUTE_BLOBS, 'CONTROL_HEAD_ROUTE');

  const result = {
    schema_version: 'geox_mcft_cap09_s3_exact_sha_control_plane_result_v1',
    status: 'PASS',
    change_class: 'MCFT_CAP_09_S3_EXACT_SHA_R2_CONTROL_PLANE_CANDIDATE',
    base_sha: base,
    head_sha: head,
    changed_files: CONTROL_FILES,
    s3_subject_sha: SUBJECT,
    candidate_head_sha: CANDIDATE_HEAD,
    focused_run_id: FOCUSED_RUN,
    focused_artifact_id: FOCUSED_ARTIFACT,
    standard_ci_run_id: STANDARD_CI,
    semantic_digest_policy: 'CANONICAL_SORTED_KEYS_V1',
    external_effectiveness: false,
    runtime_source_delta: 0,
    registry_delta: 0,
    taskbook_delta: 0,
    first_legal_next_action: 'PROTECTED_MERGE_TRIGGERS_S3_EXACT_SHA_R2_ATTESTATION',
  };
  writeJson('MCFT_CAP_09_S3_EXACT_SHA_CONTROL_PLANE_RESULT.json', result);
  console.log(JSON.stringify(result, null, 2));
}

async function attest() {
  must(process.env.MCFT_SUBJECT_SHA === SUBJECT, 'EXACT_SUBJECT_REQUIRED');
  const controlMerge = git('rev-parse', 'HEAD');

  equal(parents(SUBJECT), [SUBJECT, CANDIDATE_BASE, CANDIDATE_HEAD], 'S3_SUBJECT_PARENT_IDENTITY');
  must(git('rev-parse', `${CANDIDATE_HEAD}^{tree}`) === CANDIDATE_TREE, 'CANDIDATE_HEAD_TREE_REQUIRED');
  must(git('rev-parse', `${SUBJECT}^{tree}`) === CANDIDATE_TREE, 'S3_SUBJECT_TREE_REQUIRED');
  equal(changedFiles(CANDIDATE_BASE, CANDIDATE_HEAD), [...CANDIDATE_FILES].sort(),
    'EXACT_S3_CANDIDATE_BOUNDARY_REQUIRED');

  equal(parents(ROUTE_REPAIR_MERGE), [ROUTE_REPAIR_MERGE, SUBJECT, ROUTE_REPAIR_HEAD],
    'ROUTE_REPAIR_PARENT_IDENTITY');
  must(git('rev-parse', `${ROUTE_REPAIR_HEAD}^{tree}`) === ROUTE_REPAIR_TREE, 'ROUTE_REPAIR_HEAD_TREE_REQUIRED');
  must(git('rev-parse', `${ROUTE_REPAIR_MERGE}^{tree}`) === ROUTE_REPAIR_TREE, 'ROUTE_REPAIR_MERGE_TREE_REQUIRED');
  equal(changedFiles(SUBJECT, ROUTE_REPAIR_HEAD), [...ROUTE_FILES].sort(), 'EXACT_ROUTE_REPAIR_BOUNDARY_REQUIRED');

  const controlParents = parents(controlMerge);
  must(controlParents.length === 3 && controlParents[1] === ROUTE_REPAIR_MERGE,
    'CONTROL_PLANE_MERGE_FIRST_PARENT_REQUIRED');
  const controlHead = controlParents[2];
  equal(parents(controlHead), [controlHead, ROUTE_REPAIR_MERGE], 'CONTROL_PLANE_HEAD_PARENT_REQUIRED');
  equal(changedFiles(ROUTE_REPAIR_MERGE, controlHead), CONTROL_FILES, 'EXACT_CONTROL_PLANE_BOUNDARY_REQUIRED');
  must(git('rev-parse', `${controlHead}^{tree}`) === git('rev-parse', `${controlMerge}^{tree}`),
    'CONTROL_PLANE_HEAD_MERGE_TREE_IDENTITY');
  equal(changedFiles(ROUTE_REPAIR_MERGE, controlMerge), CONTROL_FILES, 'CONTROL_PLANE_MERGE_DELTA_REQUIRED');

  verifyFixedBlobs(CANDIDATE_HEAD, CANDIDATE_FILES, CANDIDATE_BLOBS, 'CANDIDATE_HEAD');
  verifyFixedBlobs(SUBJECT, CANDIDATE_FILES, CANDIDATE_BLOBS, 'S3_SUBJECT');
  verifyFixedBlobs(ROUTE_REPAIR_MERGE, CANDIDATE_FILES, CANDIDATE_BLOBS, 'ROUTE_MERGE_CANDIDATE');
  verifyFixedBlobs(controlMerge, CANDIDATE_FILES, CANDIDATE_BLOBS, 'CONTROL_MERGE_CANDIDATE');
  verifyFixedBlobs(ROUTE_REPAIR_HEAD, ROUTE_FILES, ROUTE_BLOBS, 'ROUTE_HEAD');
  verifyFixedBlobs(ROUTE_REPAIR_MERGE, ROUTE_FILES, ROUTE_BLOBS, 'ROUTE_MERGE');
  verifyFixedBlobs(controlMerge, ROUTE_FILES, ROUTE_BLOBS, 'CONTROL_MERGE_ROUTE');

  const candidatePulls = await githubApi(`/commits/${SUBJECT}/pulls`);
  const candidatePr = candidatePulls.find((pr) =>
    pr.number === CANDIDATE_PR
      && pr.merge_commit_sha === SUBJECT
      && pr.head?.sha === CANDIDATE_HEAD
      && pr.base?.sha === CANDIDATE_BASE);
  must(Boolean(candidatePr), 'CANDIDATE_PR_BINDING_REQUIRED');
  const marker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
  must(String(candidatePr.body || '').includes(`<!-- ${marker}`), 'CANDIDATE_DECLARATION_REQUIRED');

  const routePulls = await githubApi(`/commits/${ROUTE_REPAIR_MERGE}/pulls`);
  const routePr = routePulls.find((pr) =>
    pr.number === ROUTE_REPAIR_PR
      && pr.merge_commit_sha === ROUTE_REPAIR_MERGE
      && pr.head?.sha === ROUTE_REPAIR_HEAD
      && pr.base?.sha === SUBJECT);
  must(Boolean(routePr), 'ROUTE_REPAIR_PR_BINDING_REQUIRED');

  const focusedRun = await githubApi(`/actions/runs/${FOCUSED_RUN}`);
  must(focusedRun.name === 'mcft-cap-09-s3-persistent-sequential-scheduler', 'FOCUSED_WORKFLOW_NAME');
  must(focusedRun.head_sha === CANDIDATE_HEAD && focusedRun.conclusion === 'success', 'FOCUSED_RUN_BINDING');
  const focusedArtifacts = await githubApi(`/actions/runs/${FOCUSED_RUN}/artifacts`);
  const focusedArtifact = focusedArtifacts.artifacts?.find((item) => Number(item.id) === FOCUSED_ARTIFACT);
  must(Boolean(focusedArtifact), 'FOCUSED_ARTIFACT_REQUIRED');
  must(focusedArtifact.expired === false && focusedArtifact.digest === FOCUSED_DIGEST, 'FOCUSED_ARTIFACT_DIGEST');

  const standardRun = await githubApi(`/actions/runs/${STANDARD_CI}`);
  must(standardRun.name === 'ci' && standardRun.head_sha === CANDIDATE_HEAD && standardRun.conclusion === 'success',
    'STANDARD_CI_BINDING');

  const candidateToMergeTreeDelta = changedFiles(CANDIDATE_HEAD, SUBJECT).length;
  must(candidateToMergeTreeDelta === 0, 'CANDIDATE_TO_MERGE_TREE_DELTA_MUST_BE_ZERO');

  const semanticArtifact = {
    schema_version: 'geox_mcft_cap09_s3_semantic_artifact_v1',
    subject_sha: SUBJECT,
    candidate_base_sha: CANDIDATE_BASE,
    candidate_head_sha: CANDIDATE_HEAD,
    candidate_tree_sha: CANDIDATE_TREE,
    candidate_pr_number: CANDIDATE_PR,
    semantic_files: CANDIDATE_FILES.map((file, index) => ({ path: file, blob_sha: CANDIDATE_BLOBS[index] })),
    focused_workflow_run_id: FOCUSED_RUN,
    focused_artifact_id: FOCUSED_ARTIFACT,
    focused_artifact_digest: FOCUSED_DIGEST,
    standard_ci_run_id: STANDARD_CI,
    route_repair_merge_sha: ROUTE_REPAIR_MERGE,
    route_repair_head_sha: ROUTE_REPAIR_HEAD,
    route_repair_tree_sha: ROUTE_REPAIR_TREE,
    control_plane_merge_sha: controlMerge,
    candidate_to_merge_tree_delta: candidateToMergeTreeDelta,
  };
  const semanticArtifactDigest = digest(semanticArtifact);

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
  falseAuthorities(effectiveAuthority);

  const attestation = {
    schema_version: 'geox_mcft_cap09_s3_exact_sha_attestation_v1',
    status: 'PASS',
    authority_claim: 'MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER_EFFECTIVE',
    subject_sha: SUBJECT,
    candidate_head_sha: CANDIDATE_HEAD,
    candidate_tree_sha: CANDIDATE_TREE,
    candidate_to_merge_tree_delta: candidateToMergeTreeDelta,
    route_repair_merge_sha: ROUTE_REPAIR_MERGE,
    control_plane_merge_sha: controlMerge,
    focused_run_id: FOCUSED_RUN,
    focused_artifact_id: FOCUSED_ARTIFACT,
    focused_artifact_digest: FOCUSED_DIGEST,
    standard_ci_run_id: STANDARD_CI,
    semantic_digest_policy: process.env.MCFT_SEMANTIC_DIGEST_POLICY || 'CANONICAL_SORTED_KEYS_V1',
    semantic_artifact: semanticArtifact,
    semantic_artifact_digest: semanticArtifactDigest,
    effective_authority: effectiveAuthority,
    retention_required: { level: 'R2', days: 730, readback_required: true, locked_delete_denial_required: true },
  };
  writeJson('MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION.json', attestation);
  console.log(JSON.stringify(attestation, null, 2));
}

(async () => {
  try {
    if (process.argv.includes('--control-plane-candidate')) controlPlaneCandidate();
    else if (process.argv.includes('--attest')) await attest();
    else throw new Error('MODE_REQUIRED');
  } catch (error) {
    const name = process.argv.includes('--control-plane-candidate')
      ? 'MCFT_CAP_09_S3_EXACT_SHA_CONTROL_PLANE_RESULT.json'
      : 'MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION.json';
    const failure = { status: 'FAIL', error: String(error instanceof Error ? error.message : error) };
    writeJson(name, failure);
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  }
})();
