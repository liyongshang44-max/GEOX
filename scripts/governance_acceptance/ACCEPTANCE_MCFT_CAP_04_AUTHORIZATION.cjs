// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_AUTHORIZATION.cjs
// Purpose: verify the governance-only MCFT-CAP-04 S0 authorization candidate, its effective P0 baseline, and its PostgreSQL-derived predecessor lock.
// Boundary: repository governance verification only; no database mutation, Runtime implementation, migration, route, scheduler, web, Forecast write, Scenario write, Recommendation, Decision, or AO-ACT.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '30fdd839aa675656dd3dc9d1def57b06f63f86ec';
const BRANCH = 'agent/mcft-cap-04-s0-authorization-predecessor-lock-v1';
const P0 = 'MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1';
const S0 = 'MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1';
const S1 = 'MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1';
const TASK_SHA256 = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';
const EXPECTED_LAST_LOGICAL_TIME = '2026-06-03T01:00:00.000Z';
const EXPECTED_NEXT_LOGICAL_TIME = '2026-06-03T02:00:00.000Z';
const MODE = process.argv.includes('--postmerge')
  ? 'postmerge'
  : process.argv.includes('--final')
    ? 'final'
    : 'draft';

const MAP_PATH = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';
const MATRIX_PATH = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const TASK_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md';
const P0_STATUS_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-P0-STATUS.json';
const AUTHORIZATION_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION.md';
const AUTHORIZATION_STATUS_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json';
const LOCK_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PREDECESSOR-LOCK.json';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json';
const ALIGNMENT_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S0-ALIGNMENT-REVIEW.md';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_AUTHORIZATION.cjs';
const PREFLIGHT_PATH = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PREDECESSOR_PREFLIGHT.ts';
const CAP03_MAIN_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json';
const CAP03_R4_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json';

const FILES = [
  MAP_PATH,
  MATRIX_PATH,
  AUTHORIZATION_PATH,
  AUTHORIZATION_STATUS_PATH,
  LOCK_PATH,
  DELIVERY_PATH,
  ALIGNMENT_PATH,
  GATE_PATH,
  PREFLIGHT_PATH,
].sort();

let pass = 0;
let fail = 0;

function check(value, message) {
  if (value) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
}

function run(executable, args) {
  const result = cp.spawnSync(executable, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`COMMAND_FAILED:${executable} ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}`);
  return String(result.stdout || '').trim();
}

function git(args) {
  return run(process.platform === 'win32' ? 'git.exe' : 'git', args);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function exactSet(actual, expected, label) {
  check(Array.isArray(actual), `${label} is array`);
  if (!Array.isArray(actual)) return;
  check(
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()),
    `${label} exact`,
  );
}

function changedFiles() {
  const range = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE;
  const tracked = git(['diff', '--name-only', range]).split(/\r?\n/).filter(Boolean);
  if (MODE === 'postmerge') return tracked.sort();
  const untracked = git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

function isSha256(value) {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/i.test(value);
}

function isObjectRef(value, prefix) {
  return typeof value === 'string' && value.startsWith(prefix) && value.length > prefix.length;
}

for (const file of [...FILES, TASK_PATH, P0_STATUS_PATH, CAP03_MAIN_PATH, CAP03_R4_PATH]) {
  check(fs.existsSync(path.join(ROOT, file)), `${MODE} file exists: ${file}`);
}

const matrix = readJson(MATRIX_PATH);
const implementationMap = readText(MAP_PATH);
const task = readText(TASK_PATH);
const p0Status = readJson(P0_STATUS_PATH);
const authorization = readText(AUTHORIZATION_PATH);
const authorizationStatus = readJson(AUTHORIZATION_STATUS_PATH);
const lock = readJson(LOCK_PATH);
const delivery = readJson(DELIVERY_PATH);
const alignment = readText(ALIGNMENT_PATH);
const cap03Main = readJson(CAP03_MAIN_PATH);
const cap03R4 = readJson(CAP03_R4_PATH);
const cap03 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-03');
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
const p0Slice = cap04?.delivery_slices?.find((slice) => slice.delivery_slice_id === P0);
const s0Slice = cap04?.delivery_slices?.find((slice) => slice.delivery_slice_id === S0);
const s1Slice = cap04?.delivery_slices?.find((slice) => slice.delivery_slice_id === S1);

check(Buffer.byteLength(task, 'utf8') === 77603, 'complete v0.5 task byte length exact');
check(task.split(/\r?\n/).length === 3724, 'complete v0.5 task line count exact');
check(crypto.createHash('sha256').update(task).digest('hex') === TASK_SHA256, 'complete v0.5 task SHA-256 exact');
for (const marker of [
  'FINAL_FROZEN_CANDIDATE_V0_5',
  P0,
  S0,
  S1,
  'Replay Runtime Config authority is not an active-config pointer.',
  'GEOX-MCFT-CAP-04-PREDECESSOR-LOCK.json',
  'S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
]) check(task.includes(marker), `task marker: ${marker}`);

check(cap03Main.status === 'VERIFIED_ON_MAIN', 'CAP-03 Main Verification verified on main');
check(cap03Main.capability_complete === true, 'CAP-03 capability complete');
check(cap03Main.runtime_evidence.last_checkpoint_sequence === 48, 'CAP-03 checkpoint sequence 48');
check(cap03Main.runtime_evidence.next_tick_logical_time === EXPECTED_NEXT_LOGICAL_TIME, 'CAP-03 next logical tick exact');
check(cap03Main.runtime_evidence.latest_successful_forecast_ref === null, 'CAP-03 latest successful Forecast remains null');
check(cap03R4.status === 'VERIFIED_ON_MAIN', 'CAP-03 R4 verified on main');
check(cap03R4.effectiveness_condition_satisfied === true, 'CAP-03 R4 effectiveness satisfied');
check(cap03R4.task_conformance.remaining_nonconformant_count === 0, 'CAP-03 R4 remaining nonconformance zero');
check(cap03R4.task_conformance.remaining_unadjudicated_contract_deviation_count === 0, 'CAP-03 R4 unadjudicated deviation zero');
check(cap03?.status === 'COMPLETE', 'Matrix CAP-03 COMPLETE');
check(cap03?.implementation_status === 'COMPLETE', 'Matrix CAP-03 implementation COMPLETE');
check(cap03?.active_delivery_slice_id === null, 'Matrix CAP-03 active slice null');

check(p0Status.task_sha256 === TASK_SHA256, 'P0 task integrity authority exact');
check(p0Slice?.status === 'MERGED_EFFECTIVE', 'Matrix P0 status MERGED_EFFECTIVE');
check(p0Slice?.merge_commit === BASELINE, 'Matrix P0 merge commit exact');
check(p0Slice?.postmerge_workflow_run === 29206218494, 'Matrix P0 postmerge workflow exact');
check(p0Slice?.postmerge_gate === 'PASS', 'Matrix P0 postmerge Gate PASS');
check(p0Slice?.effectiveness_condition_satisfied === true, 'Matrix P0 effectiveness satisfied');

check(cap04?.status === 'NOT_AUTHORIZED', 'Matrix CAP-04 remains NOT_AUTHORIZED');
check(cap04?.design_status === 'FINAL_FROZEN_CANDIDATE_V0_5', 'Matrix CAP-04 design candidate exact');
check(cap04?.implementation_status === 'NOT_AUTHORIZED', 'Matrix CAP-04 implementation not authorized');
check(cap04?.authorization_status === 'READY_FOR_MERGE', 'Matrix CAP-04 authorization ready for merge');
check(cap04?.authorization_effective === false, 'Matrix CAP-04 authorization ineffective premerge');
check(cap04?.runtime_source_authorized === false, 'Matrix CAP-04 Runtime source unauthorized');
check(cap04?.predecessor_main_commit === BASELINE, 'Matrix CAP-04 predecessor baseline exact');
check(cap04?.predecessor_lock_ref === LOCK_PATH, 'Matrix CAP-04 predecessor lock ref exact');
check(cap04?.active_delivery_slice_id === S0, 'Matrix CAP-04 active slice S0');
check(cap04?.next_delivery_slice_id === S1, 'Matrix CAP-04 next slice S1');
check(cap04?.next_delivery_slice_authorized === false, 'Matrix CAP-04 S1 not authorized');
check(cap04?.successor_capability_line_id === 'MCFT-CAP-05', 'Matrix CAP-04 successor exact');
check(cap04?.successor_authorized === false, 'Matrix CAP-05 remains unauthorized');
check(matrix.latest_governance_update === S0, 'Matrix latest governance update is S0');
check(s0Slice?.status === 'READY_FOR_MERGE', 'Matrix S0 status ready for merge');
check(s0Slice?.baseline_main_commit === BASELINE, 'Matrix S0 baseline exact');
check(s0Slice?.branch === BRANCH, 'Matrix S0 branch exact');
check(s0Slice?.runtime_source_authorized === false, 'Matrix S0 Runtime source unauthorized');
check(s0Slice?.effectiveness_condition_satisfied === false, 'Matrix S0 ineffective before merged-main Gate');
exactSet(s0Slice?.exact_changed_file_boundary, FILES, 'Matrix S0 exact changed-file boundary');
check(s1Slice?.status === 'BLOCKED', 'Matrix S1 remains blocked');
check(s1Slice?.runtime_source_authorized === false, 'Matrix S1 Runtime source unauthorized');

check(authorizationStatus.status === 'READY_FOR_MERGE', 'Authorization status READY_FOR_MERGE');
check(authorizationStatus.baseline_main_commit === BASELINE, 'Authorization baseline exact');
check(authorizationStatus.branch === BRANCH, 'Authorization branch exact');
check(authorizationStatus.active_delivery_slice_id === S0, 'Authorization active slice S0');
check(authorizationStatus.authorization_effective === false, 'Authorization ineffective premerge');
check(authorizationStatus.runtime_source_authorized === false, 'Authorization Runtime source unauthorized');
check(authorizationStatus.predecessor.postgresql_canonical_lock_status === 'COMPLETE', 'Authorization PostgreSQL predecessor lock complete');
check(authorizationStatus.predecessor.checkpoint_sequence === 48, 'Authorization checkpoint sequence exact');
check(authorizationStatus.predecessor.next_tick_logical_time === EXPECTED_NEXT_LOGICAL_TIME, 'Authorization next tick exact');
check(authorizationStatus.predecessor.latest_successful_forecast_ref === null, 'Authorization successful Forecast pointer null');
check(authorizationStatus.p0_effectiveness.merge_commit === BASELINE, 'Authorization P0 merge exact');
check(authorizationStatus.p0_effectiveness.postmerge_gate === 'PASS', 'Authorization P0 postmerge Gate PASS');
check(authorizationStatus.next_authorized_slice_id_after_effectiveness === S1, 'Authorization next eligible S1 exact');
exactSet(authorizationStatus.exact_changed_file_boundary, FILES, 'Authorization exact changed-file boundary');

check(delivery.status === 'S0_READY_FOR_MERGE', 'Delivery status S0 ready for merge');
check(delivery.baseline_main_commit === BASELINE, 'Delivery baseline exact');
check(delivery.branch === BRANCH, 'Delivery branch exact');
check(delivery.active_delivery_slice_id === S0, 'Delivery active slice S0');
check(delivery.runtime_source_authorized === false, 'Delivery Runtime source unauthorized');
check(delivery.authorization_effective === false, 'Delivery authorization ineffective premerge');
check(delivery.slices.some((slice) => slice.delivery_slice_id === S1 && slice.status === 'BLOCKED'), 'Delivery S1 blocked');
check(delivery.slices.some((slice) => slice.delivery_slice_id === 'MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1'), 'Delivery S10 lifecycle recorded');
check(delivery.next_authorized_slice_id_after_merge_and_postmerge_gate === S1, 'Delivery next eligible S1 exact');

check(lock.status === 'COMPLETE', 'Predecessor lock complete');
check(lock.baseline_main_commit === BASELINE, 'Predecessor lock baseline exact');
check(lock.identity_extraction_source === 'ISOLATED_POSTGRESQL_CANONICAL_READ_PATH', 'Predecessor identity source is PostgreSQL canonical read path');
check(lock.expected_checkpoint.checkpoint_sequence === 48, 'Predecessor lock sequence 48');
check(lock.expected_checkpoint.last_logical_time === EXPECTED_LAST_LOGICAL_TIME, 'Predecessor lock latest logical time exact');
check(lock.expected_checkpoint.next_tick_logical_time === EXPECTED_NEXT_LOGICAL_TIME, 'Predecessor lock next tick exact');
check(isObjectRef(lock.canonical_identity.active_lineage_ref, 'twin_runtime_lineage_'), 'Canonical active lineage ref shape');
check(isObjectRef(lock.canonical_identity.latest_posterior_state_ref, 'twin_state_estimate_'), 'Canonical posterior State ref shape');
check(isObjectRef(lock.canonical_identity.latest_checkpoint_ref, 'twin_runtime_checkpoint_'), 'Canonical checkpoint ref shape');
check(isObjectRef(lock.canonical_identity.latest_forecast_result_ref, 'twin_forecast_run_'), 'Canonical Forecast result ref shape');
check(isObjectRef(lock.canonical_identity.predecessor_state_runtime_config_ref, 'twin_runtime_config_'), 'Canonical State-bound Runtime Config ref shape');
check(typeof lock.canonical_identity.reality_binding_ref === 'string' && lock.canonical_identity.reality_binding_ref.length > 0, 'Canonical Reality Binding ref present');
check(typeof lock.canonical_identity.lineage_id === 'string' && lock.canonical_identity.lineage_id.startsWith('lineage_'), 'Semantic lineage id present and distinct');
check(typeof lock.canonical_identity.revision_id === 'string' && lock.canonical_identity.revision_id.startsWith('revision_'), 'Revision id present');
check(lock.canonical_identity.active_lineage_ref !== lock.canonical_identity.lineage_id, 'Active lineage object ref differs from semantic lineage id');
check(isSha256(lock.canonical_identity.latest_posterior_state_hash), 'Posterior State hash shape');
check(isSha256(lock.canonical_identity.latest_checkpoint_hash), 'Checkpoint hash shape');
check(isSha256(lock.canonical_identity.latest_forecast_result_hash), 'Forecast result hash shape');
check(isSha256(lock.canonical_identity.predecessor_state_runtime_config_hash), 'Runtime Config hash shape');
check(isSha256(lock.canonical_identity.reality_binding_hash), 'Reality Binding hash shape');
check(lock.canonical_identity.latest_successful_forecast_ref === null, 'Predecessor latest successful Forecast null');
check(lock.validated_relations.includes('state_runtime_config_ref_hash_matches_exact_canonical_runtime_config'), 'State-bound Runtime Config relation validated');
check(lock.validated_relations.includes('runtime_config_reality_binding_ref_hash_matches_persisted_authority_snapshot'), 'Reality Binding relation validated');
check(lock.failure_policy.active_config_pointer_substitution === 'FORBIDDEN', 'Active-config pointer substitution forbidden');
check(lock.failure_policy.fixture_object_id_substitution === 'FORBIDDEN', 'Fixture object ID substitution forbidden');

for (const marker of [
  BASELINE,
  S0,
  S1,
  lock.canonical_identity.active_lineage_ref,
  lock.canonical_identity.latest_posterior_state_ref,
  lock.canonical_identity.latest_checkpoint_ref,
  lock.canonical_identity.latest_forecast_result_ref,
  lock.canonical_identity.predecessor_state_runtime_config_ref,
  lock.canonical_identity.reality_binding_ref,
  'authorization_effective:\nfalse',
  'runtime_source_authorized:\nfalse',
]) check(authorization.includes(marker), `Authorization document marker: ${marker}`);

for (const marker of [
  'three_way_alignment:\nPASS',
  'PostgreSQL canonical predecessor lock: PASS',
  BASELINE,
  S0,
  S1,
  EXPECTED_LAST_LOGICAL_TIME,
  EXPECTED_NEXT_LOGICAL_TIME,
  lock.canonical_identity.active_lineage_ref,
]) check(alignment.includes(marker), `Alignment marker: ${marker}`);

for (const marker of [
  'MCFT-CAP-04 S0 authorization readiness',
  `P0 merge commit: ${BASELINE}`,
  'P0 postmerge Gate: PASS',
  'S0 authorization: READY_FOR_MERGE',
  'authorization effective: false',
  'runtime source authorized: false',
  `active delivery slice: ${S0}`,
  `next eligible slice after merge and merged-main Gate: ${S1}`,
  `predecessor lock: ${LOCK_PATH}`,
]) check(implementationMap.includes(marker), `Implementation Map marker: ${marker}`);

const changed = changedFiles();
exactSet(changed, FILES, `${MODE} exact changed-file boundary`);
check(changed.every((file) => !file.startsWith('apps/server/src/')), 'no Runtime source changed');
check(changed.every((file) => !file.startsWith('apps/server/db/migrations/')), 'no migration changed');
check(changed.every((file) => !file.startsWith('apps/web/')), 'no web changed');
check(changed.every((file) => !file.startsWith('.github/workflows/')), 'no workflow changed');
check(changed.every((file) => !file.startsWith('acceptance-output/')), 'no generated acceptance evidence committed');

if (MODE === 'postmerge') {
  check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge local main equals origin/main');
} else {
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate runs on S0 branch`);
  check(git(['rev-parse', 'origin/main']) === BASELINE, `${MODE} origin/main equals P0 merge baseline`);
}

try {
  const range = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE;
  git(['diff', '--check', range]);
  check(true, 'git diff --check PASS');
} catch {
  check(false, 'git diff --check PASS');
}

console.log(`MCFT-CAP-04 authorization ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
