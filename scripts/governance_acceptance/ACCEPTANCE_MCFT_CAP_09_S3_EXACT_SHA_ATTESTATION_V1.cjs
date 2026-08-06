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
const FOCUSED_ARTIFACT = 8954037604;
const FOCUSED_DIGEST = 'sha256:bac8fa6b0cde49aafa84eeaf0a2d505841883888ee9d1bcb926549114aaaf793';
const STANDARD_CI_RUN = 31066566555;
const ROUTE_MERGE = 'aed32435bf1bbc6bd50af5cd46c7bb8dc29d0803';
const ROUTE_HEAD = '535c66011624378fd7a149ddf053230354740a79';
const ROUTE_TREE = '15583ba0e7f3e1d3efdbd4aad3fe5a7793e06508';
const ROUTE_PR = 2903;
const FAILED_CONTROL_MERGE = '41d763c7b1b1c9f35efc702b965ab0cea4632447';
const FAILED_CONTROL_HEAD = '83deb238efb372dc4f573ab71cf49088004b7ac8';
const FAILED_CONTROL_TREE = 'f04dbb31e5824fb3fcb99cc9ecd99b3303507c6a';
const FAILED_RUN = 31068800943;
const WORKFLOW = '.github/workflows/mcft-cap-09-s3-exact-sha-attestation.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION_V1.cjs';
const CONTROL_FILES = [WORKFLOW, VALIDATOR].sort();
const FAILED_CONTROL_BLOBS = [
'b185b1e40f6b6a2c64445548bcb549fa5fa36121',
'9d50947fa0ae77dac91fd6a8a4bceaa2fb20eb8d',
];
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
const candidateDeclarationMarker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
function git(...args) {
return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function must(value, code) {
if (!value) throw new Error(code);
}
function equal(actual, expected, code) {
try {
assert.deepEqual(actual, expected);
} catch {
throw new Error(code);
}
}
function parents(sha) {
return git('rev-list', '--parents', '-n', '1', sha).split(/\s+/);
}
function changedFiles(base, head) {
return git('diff', '--name-only', `${base}...${head}`)
.split(/\r?\n/)
.filter(Boolean)
.sort();
}
function blobAt(sha, file) {
return git('rev-parse', `${sha}:${file}`);
}
function read(file) {
return fs.readFileSync(file, 'utf8');
}
function write(name, value) {
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(value, null, 2)}\n`);
}
function assertFixedBlobs(sha, files, blobs, prefix) {
files.forEach((file, index) => {
must(blobAt(sha, file) === blobs[index], `${prefix}_BLOB_DRIFT:${file}`);
});
}
function canonical(value) {
if (Array.isArray(value)) return `[${value.map(canonical)}]`;
if (value && typeof value === 'object') {
return `{${Object.keys(value)
.sort()
.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)}}`;
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
'User-Agent': 'geox-cap09-s3-exact-sha-repair',
},
});
const text = await response.text();
must(response.ok, `GITHUB_API_${response.status}:${text.slice(0, 300)}`);
return text ? JSON.parse(text) : {};
}
function assertNoRuntimeAuthority(authority) {
for (const key of [
'implementation_authorized',
'runtime_source_authorized',
'live_ingestion_authorized',
'background_scheduler_authorized',
'canonical_write_authorized',
'public_http_writer_authorized',
'model_activation_authorized',
'controlled_action_authorized',
]) {
must(authority[key] === false, `AUTHORITY_MUST_REMAIN_FALSE:${key}`);
}
}
function validateControlPlaneCandidate() {
const base = process.env.MCFT_BASE_SHA;
const head = git('rev-parse', 'HEAD');
must(base === FAILED_CONTROL_MERGE, 'EXACT_CONTROL_PLANE_REPAIR_BASE_REQUIRED');
must(git('rev-list', '--count', `${base}..${head}`) === '1', 'ONE_COMMIT_REQUIRED');
equal(changedFiles(base, head), CONTROL_FILES, 'EXACT_TWO_FILE_CONTROL_PLANE_REPAIR_REQUIRED');
equal(
parents(FAILED_CONTROL_MERGE),
[FAILED_CONTROL_MERGE, ROUTE_MERGE, FAILED_CONTROL_HEAD],
'FAILED_CONTROL_MERGE_PARENT_IDENTITY',
);
equal(
parents(FAILED_CONTROL_HEAD),
[FAILED_CONTROL_HEAD, ROUTE_MERGE],
'FAILED_CONTROL_HEAD_PARENT_IDENTITY',
);
must(
git('rev-parse', `${FAILED_CONTROL_HEAD}^{tree}`) === FAILED_CONTROL_TREE &&
git('rev-parse', `${FAILED_CONTROL_MERGE}^{tree}`) === FAILED_CONTROL_TREE,
'FAILED_CONTROL_TREE_REQUIRED',
);
equal(changedFiles(ROUTE_MERGE, FAILED_CONTROL_HEAD), CONTROL_FILES, 'FAILED_CONTROL_BOUNDARY_REQUIRED');
assertFixedBlobs(FAILED_CONTROL_MERGE, CONTROL_FILES, FAILED_CONTROL_BLOBS, 'FAILED_CONTROL');
const workflow = read(WORKFLOW);
const validator = read(VALIDATOR);
must(!workflow.includes(candidateDeclarationMarker), 'WORKFLOW_CANDIDATE_DECLARATION_FORBIDDEN');
must(!validator.includes(candidateDeclarationMarker), 'VALIDATOR_CANDIDATE_DECLARATION_FORBIDDEN');
for (const token of [
'S3_EXACT_SHA_R2_REPAIR_V2',
SUBJECT,
ROUTE_MERGE,
FAILED_CONTROL_MERGE,
'MCFT_SUBJECT_SHA',
'--attest',
"MCFT_RETENTION_DAYS: '730'",
'mcft-cap-09/s3-exact-sha-attestation',
]) {
must(workflow.includes(token), `WORKFLOW_TOKEN:${token}`);
}
for (const token of [
SUBJECT,
CANDIDATE_HEAD,
FOCUSED_RUN,
FOCUSED_ARTIFACT,
FOCUSED_DIGEST,
STANDARD_CI_RUN,
ROUTE_MERGE,
FAILED_CONTROL_MERGE,
FAILED_RUN,
'semantic_artifact_digest',
'candidate_to_merge_tree_delta',
's3_persistent_sequential_scheduler_effective',
'MCFT_CAP_09_S4_REGISTRY_REGISTRATION',
"focusedRun.event==='pull_request'",
"job.name==='s3-persistent-sequential-scheduler'",
]) {
must(validator.includes(String(token)), `VALIDATOR_TOKEN:${token}`);
}
const brittleFocusedWorkflowNameExpression = [
'focusedRun',
'.name===',
JSON.stringify(['mcft','cap','09','s3','persistent','sequential','scheduler'].join('-')),
].join('');
must(
!validator.includes(brittleFocusedWorkflowNameExpression),
'BRITTLE_NAME_CHECK_FORBIDDEN',
);
assertFixedBlobs(SUBJECT, SCHEDULER_FILES, SCHEDULER_BLOBS, 'SUBJECT');
assertFixedBlobs(head, SCHEDULER_FILES, SCHEDULER_BLOBS, 'REPAIR_HEAD_CANDIDATE');
assertFixedBlobs(ROUTE_MERGE, ROUTE_FILES, ROUTE_BLOBS, 'ROUTE_MERGE');
assertFixedBlobs(head, ROUTE_FILES, ROUTE_BLOBS, 'REPAIR_HEAD_ROUTE');
const result = {
schema_version: 'geox_mcft_cap09_s3_exact_sha_control_plane_repair_result_v2',
status: 'PASS',
change_class: 'MCFT_CAP_09_S3_EXACT_SHA_R2_CONTROL_PLANE_REPAIR_CANDIDATE',
base_sha: base,
head_sha: head,
changed_files: CONTROL_FILES,
s3_subject_sha: SUBJECT,
failed_control_plane_merge_sha: FAILED_CONTROL_MERGE,
failed_attestation_run_id: FAILED_RUN,
failure_root_cause: 'BRITTLE_GITHUB_WORKFLOW_DISPLAY_NAME_EQUALITY_AND_DECLARATION_SELF_SCAN',
exact_run_identity_preserved: true,
historical_candidate_declaration_verification_preserved: true,
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
must(
process.env.MCFT_FAILED_CONTROL_PLANE_SHA === FAILED_CONTROL_MERGE,
'FAILED_CONTROL_ENV_REQUIRED',
);
const controlMerge = git('rev-parse', 'HEAD');
equal(parents(SUBJECT), [SUBJECT, CANDIDATE_BASE, CANDIDATE_HEAD], 'SUBJECT_PARENTS');
must(
git('rev-parse', `${CANDIDATE_HEAD}^{tree}`) === CANDIDATE_TREE &&
git('rev-parse', `${SUBJECT}^{tree}`) === CANDIDATE_TREE,
'SUBJECT_TREE',
);
equal(changedFiles(CANDIDATE_BASE, CANDIDATE_HEAD), [...SCHEDULER_FILES].sort(), 'CANDIDATE_BOUNDARY');
equal(parents(ROUTE_MERGE), [ROUTE_MERGE, SUBJECT, ROUTE_HEAD], 'ROUTE_PARENTS');
must(
git('rev-parse', `${ROUTE_HEAD}^{tree}`) === ROUTE_TREE &&
git('rev-parse', `${ROUTE_MERGE}^{tree}`) === ROUTE_TREE,
'ROUTE_TREE',
);
equal(changedFiles(SUBJECT, ROUTE_HEAD), [...ROUTE_FILES].sort(), 'ROUTE_BOUNDARY');
equal(
parents(FAILED_CONTROL_MERGE),
[FAILED_CONTROL_MERGE, ROUTE_MERGE, FAILED_CONTROL_HEAD],
'FAILED_CONTROL_PARENTS',
);
equal(
parents(FAILED_CONTROL_HEAD),
[FAILED_CONTROL_HEAD, ROUTE_MERGE],
'FAILED_CONTROL_HEAD_PARENT',
);
must(
git('rev-parse', `${FAILED_CONTROL_HEAD}^{tree}`) === FAILED_CONTROL_TREE &&
git('rev-parse', `${FAILED_CONTROL_MERGE}^{tree}`) === FAILED_CONTROL_TREE,
'FAILED_CONTROL_TREE',
);
equal(changedFiles(ROUTE_MERGE, FAILED_CONTROL_HEAD), CONTROL_FILES, 'FAILED_CONTROL_BOUNDARY');
assertFixedBlobs(FAILED_CONTROL_MERGE, CONTROL_FILES, FAILED_CONTROL_BLOBS, 'FAILED_CONTROL');
const controlParents = parents(controlMerge);
must(
controlParents.length === 3 && controlParents[1] === FAILED_CONTROL_MERGE,
'REPAIR_MERGE_FIRST_PARENT',
);
const repairHead = controlParents[2];
equal(parents(repairHead), [repairHead, FAILED_CONTROL_MERGE], 'REPAIR_HEAD_PARENT');
equal(changedFiles(FAILED_CONTROL_MERGE, repairHead), CONTROL_FILES, 'REPAIR_BOUNDARY');
must(
git('rev-parse', `${repairHead}^{tree}`) === git('rev-parse', `${controlMerge}^{tree}`),
'REPAIR_TREE_IDENTITY',
);
equal(changedFiles(FAILED_CONTROL_MERGE, controlMerge), CONTROL_FILES, 'REPAIR_MERGE_DELTA');
for (const sha of [CANDIDATE_HEAD, SUBJECT, ROUTE_MERGE, FAILED_CONTROL_MERGE, controlMerge]) {
assertFixedBlobs(sha, SCHEDULER_FILES, SCHEDULER_BLOBS, `${sha.slice(0, 8)}_CANDIDATE`);
}
for (const sha of [ROUTE_HEAD, ROUTE_MERGE, controlMerge]) {
assertFixedBlobs(sha, ROUTE_FILES, ROUTE_BLOBS, `${sha.slice(0, 8)}_ROUTE`);
}
const candidatePulls = await githubApi(`/commits/${SUBJECT}/pulls`);
const candidatePr = candidatePulls.find(
(entry) =>
entry.number === CANDIDATE_PR &&
entry.merge_commit_sha === SUBJECT &&
entry.head?.sha === CANDIDATE_HEAD &&
entry.base?.sha === CANDIDATE_BASE,
);
must(
candidatePr && String(candidatePr.body || '').includes(candidateDeclarationMarker),
'CANDIDATE_PR_BINDING',
);
const routePulls = await githubApi(`/commits/${ROUTE_MERGE}/pulls`);
must(
routePulls.some(
(entry) =>
entry.number === ROUTE_PR &&
entry.merge_commit_sha === ROUTE_MERGE &&
entry.head?.sha === ROUTE_HEAD &&
entry.base?.sha === SUBJECT,
),
'ROUTE_PR_BINDING',
);
const failedRun = await githubApi(`/actions/runs/${FAILED_RUN}`);
must(
Number(failedRun.id) === FAILED_RUN &&
failedRun.head_sha === FAILED_CONTROL_MERGE &&
failedRun.event === 'push' &&
failedRun.conclusion === 'failure',
'FAILED_RUN_BINDING',
);
const focusedRun = await githubApi(`/actions/runs/${FOCUSED_RUN}`);
must(
Number(focusedRun.id) === FOCUSED_RUN &&
focusedRun.head_sha === CANDIDATE_HEAD &&
focusedRun.event==='pull_request' &&
focusedRun.conclusion === 'success',
'FOCUSED_RUN_BINDING',
);
const focusedJobs = await githubApi(`/actions/runs/${FOCUSED_RUN}/jobs?per_page=100`);
must(
focusedJobs.jobs?.some(
(job) => job.name==='s3-persistent-sequential-scheduler' && job.conclusion === 'success',
),
'FOCUSED_JOB_SUCCESS',
);
const focusedArtifacts = await githubApi(`/actions/runs/${FOCUSED_RUN}/artifacts`);
const focusedArtifact = focusedArtifacts.artifacts?.find(
(entry) => Number(entry.id) === FOCUSED_ARTIFACT,
);
must(
focusedArtifact &&
focusedArtifact.expired === false &&
focusedArtifact.digest === FOCUSED_DIGEST,
'FOCUSED_ARTIFACT_BINDING',
);
const standardRun = await githubApi(`/actions/runs/${STANDARD_CI_RUN}`);
must(
Number(standardRun.id) === STANDARD_CI_RUN &&
standardRun.head_sha === CANDIDATE_HEAD &&
standardRun.event === 'pull_request' &&
standardRun.conclusion === 'success',
'STANDARD_CI_BINDING',
);
const standardJobs = await githubApi(`/actions/runs/${STANDARD_CI_RUN}/jobs?per_page=100`);
for (const jobName of ['build-test', 'acceptance']) {
must(
standardJobs.jobs?.some((job) => job.name === jobName && job.conclusion === 'success'),
`STANDARD_JOB:${jobName}`,
);
}
const candidateToMergeTreeDelta = changedFiles(CANDIDATE_HEAD, SUBJECT).length;
must(candidateToMergeTreeDelta === 0, 'CANDIDATE_TO_MERGE_TREE_DELTA');
const semanticArtifact = {
schema_version: 'geox_mcft_cap09_s3_semantic_artifact_v2',
subject_sha: SUBJECT,
candidate_base_sha: CANDIDATE_BASE,
candidate_head_sha: CANDIDATE_HEAD,
candidate_tree_sha: CANDIDATE_TREE,
candidate_pr_number: CANDIDATE_PR,
semantic_files: SCHEDULER_FILES.map((file, index) => ({
path: file,
blob_sha: SCHEDULER_BLOBS[index],
})),
focused_workflow_run_id: FOCUSED_RUN,
focused_artifact_id: FOCUSED_ARTIFACT,
focused_artifact_digest: FOCUSED_DIGEST,
standard_ci_run_id: STANDARD_CI_RUN,
route_repair_merge_sha: ROUTE_MERGE,
failed_control_plane_merge_sha: FAILED_CONTROL_MERGE,
failed_attestation_run_id: FAILED_RUN,
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
schema_version: 'geox_mcft_cap09_s3_exact_sha_attestation_v2',
status: 'PASS',
authority_claim: 'MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER_EFFECTIVE',
subject_sha: SUBJECT,
candidate_head_sha: CANDIDATE_HEAD,
candidate_tree_sha: CANDIDATE_TREE,
candidate_to_merge_tree_delta: candidateToMergeTreeDelta,
route_repair_merge_sha: ROUTE_MERGE,
failed_control_plane_merge_sha: FAILED_CONTROL_MERGE,
failed_attestation_run_id: FAILED_RUN,
control_plane_repair_merge_sha: controlMerge,
focused_run_id: FOCUSED_RUN,
focused_artifact_id: FOCUSED_ARTIFACT,
focused_artifact_digest: FOCUSED_DIGEST,
standard_ci_run_id: STANDARD_CI_RUN,
semantic_digest_policy:
process.env.MCFT_SEMANTIC_DIGEST_POLICY || 'CANONICAL_SORTED_KEYS_V1',
semantic_artifact: semanticArtifact,
semantic_artifact_digest: semanticDigest(semanticArtifact),
effective_authority: effectiveAuthority,
retention_required: {
level: 'R2',
days: 730,
readback_required: true,
locked_delete_denial_required: true,
},
};
write('MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION.json', attestation);
console.log(JSON.stringify(attestation, null, 2));
}
(async () => {
try {
if (process.argv.includes('--control-plane-candidate')) {
validateControlPlaneCandidate();
} else if (process.argv.includes('--attest')) {
await deriveAttestation();
} else {
throw new Error('MODE_REQUIRED');
}
} catch (error) {
const name = process.argv.includes('--control-plane-candidate')
? 'MCFT_CAP_09_S3_EXACT_SHA_CONTROL_PLANE_RESULT.json'
: 'MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION.json';
const failure = {
status: 'FAIL',
error: String(error instanceof Error ? error.message : error),
};
write(name, failure);
console.error(JSON.stringify(failure, null, 2));
process.exitCode = 1;
}
})();
