// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_AUTHORIZATION.cjs
// Purpose: validate the MCFT-CAP-03 governance-only S0 authorization, PostgreSQL predecessor lock, task, delivery graph, matrix/map readiness, nonclaims, and exact changed-file boundary.
// Boundary: governance acceptance only; no CAP-03 Runtime source, assimilation, selector, persistence transaction, migration, route, scheduler, web, tick, Forecast success, or CAP-04 authorization.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'd1a3948d06e4c7896d513168d31ef52409c3e0f0';
const BRANCH = 'mcft-cap-03-gov-authorization-and-predecessor-lock-v1';
const S0 = 'MCFT-CAP-03.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1';
const S1 = 'MCFT-CAP-03.MCFT-02-07-08.ASSIMILATION-CONTRACTS-CONFIG-V1';
const MODE = process.argv.includes('--draft')
  ? 'draft'
  : process.argv.includes('--postmerge')
    ? 'postmerge'
    : 'final';

const TASK_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TASK.md';
const ALIGNMENT_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S0-ALIGNMENT-REVIEW.md';
const ERRATUM_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-02-HANDOFF-ERRATUM-01.json';
const AUTHORIZATION_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-AUTHORIZATION.md';
const AUTHORIZATION_STATUS_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-AUTHORIZATION-STATUS.json';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const LOCK_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-PREDECESSOR-LOCK.json';
const MATRIX_PATH = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const MAP_PATH = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';
const PREFLIGHT_PATH = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_PREDECESSOR_PREFLIGHT.cjs';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_AUTHORIZATION.cjs';

const EXACT_CHANGED_FILES = Object.freeze([
  MAP_PATH,
  MATRIX_PATH,
  ERRATUM_PATH,
  AUTHORIZATION_PATH,
  AUTHORIZATION_STATUS_PATH,
  DELIVERY_PATH,
  LOCK_PATH,
  ALIGNMENT_PATH,
  TASK_PATH,
  GATE_PATH,
  PREFLIGHT_PATH,
].sort());

const CLOSURE_PRESERVED_NONCLAIMS = Object.freeze([
  'NO_FORECAST_RESIDUAL',
  'NO_SUCCESSFUL_FORECAST',
  'NO_72_HOUR_FORECAST',
  'NO_SCENARIO',
  'NO_RECOMMENDATION',
  'NO_POLICY_EVALUATION',
  'NO_DECISION',
  'NO_AO_ACT',
  'NO_CALIBRATION_CANDIDATE',
  'NO_SHADOW_EVALUATION',
  'NO_MODEL_ACTIVATION',
  'NO_ACTIVE_MODEL_PARAMETER_CHANGE',
  'NO_CALIBRATED_CONFIDENCE_MODEL',
  'NO_MULTI_SENSOR_FUSION',
  'NO_DYNAMIC_ROOT_ZONE_GEOMETRY',
  'NO_LATE_EVIDENCE_REVISION',
  'NO_AUTOMATIC_RECOMPUTE_ON_LATE_EVIDENCE',
  'NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION',
  'NO_CONTINUOUS_RUNTIME',
  'NO_CONTINUOUS_SCHEDULER',
  'NO_720_TICK_REPLAY_CLOSURE',
  'NO_LIVE_FIELD_CLAIM',
  'NO_FIELD_VALIDATED_OBSERVATION_OPERATOR',
  'NO_FIELD_CALIBRATED_ASSIMILATION_NOISE_MODEL',
  'NO_MCFT_GATE_A_CLOSURE',
  'NO_MCFT_GATE_B_CLOSURE',
  'NO_MCFT_GATE_C_CLOSURE',
  'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
]);

const PREAUTH_NONCLAIMS = Object.freeze([
  'NO_MCFT_CAP_03_RUNTIME_AUTHORIZATION',
  'NO_MCFT_CAP_03_COMPLETE_CLAIM',
  'NO_OBSERVATION_UPDATE_APPLIED',
  'NO_OBSERVATION_INNOVATION_COMPUTED',
  ...CLOSURE_PRESERVED_NONCLAIMS,
]);

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

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function git(args) {
  return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', args, {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

function checkArrayExact(actual, expected, label) {
  check(Array.isArray(actual), `${label} is array`);
  if (!Array.isArray(actual)) return;
  check(JSON.stringify(actual) === JSON.stringify(expected), `${label} exact`);
}

function checkArrayIncludesAll(actual, expected, label) {
  check(Array.isArray(actual), `${label} is array`);
  if (!Array.isArray(actual)) return;
  for (const item of expected) check(actual.includes(item), `${label}: ${item}`);
}

function changedFiles() {
  const tracked = git(['diff', '--name-only', BASELINE]).split(/\r?\n/).filter(Boolean);
  const untrackedExpected = git(['ls-files', '--others', '--exclude-standard', '--', ...EXACT_CHANGED_FILES])
    .split(/\r?\n/)
    .filter(Boolean);
  return [...new Set([...tracked, ...untrackedExpected])].sort();
}

function checkRequiredFiles() {
  const draftRequired = [ALIGNMENT_PATH, ERRATUM_PATH, AUTHORIZATION_STATUS_PATH, DELIVERY_PATH, LOCK_PATH];
  const finalRequired = EXACT_CHANGED_FILES;
  for (const file of MODE === 'draft' ? draftRequired : finalRequired) check(exists(file), `${MODE} file exists: ${file}`);
}

function checkTask() {
  if (!exists(TASK_PATH)) {
    if (MODE === 'draft') check(true, 'draft task may remain pending');
    return;
  }
  const task = readText(TASK_PATH);
  for (const marker of [
    'FINAL_FROZEN_CANDIDATE_V1_2',
    'AssimilatedContinuationEvidenceWindowV1',
    'MALFORMED_CANONICAL_OBSERVATION',
    'candidate_assimilation_gain',
    'applied_assimilation_gain',
    'NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION',
    'NO_720_TICK_REPLAY_CLOSURE',
    'S8_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_FINALIZATION_GATE_PASS',
  ]) check(task.includes(marker), `task marker: ${marker}`);
}

function checkLockAndErratum() {
  if (!exists(LOCK_PATH) || !exists(ERRATUM_PATH)) return;
  const lock = readJson(LOCK_PATH);
  const erratum = readJson(ERRATUM_PATH);

  if (MODE === 'draft' && lock.status !== 'COMPLETE') {
    check(lock.status === 'PENDING_POSTGRESQL_CANONICAL_READ', 'draft predecessor lock is explicitly pending');
    return;
  }

  check(lock.schema_version === 'geox_mcft_cap_03_predecessor_lock_v2', 'predecessor lock schema v2');
  check(lock.status === 'COMPLETE', 'predecessor lock COMPLETE');
  check(lock.baseline_main_commit === BASELINE, 'predecessor baseline exact');
  check(lock.identity_extraction_source === 'ISOLATED_POSTGRESQL_CANONICAL_READ_PATH', 'predecessor extraction source exact');
  check(lock.expected_checkpoint?.tick_sequence === 24, 'expected checkpoint sequence 24');
  check(lock.expected_checkpoint?.next_tick_logical_time === '2026-06-02T02:00:00.000Z', 'expected next tick 02:00');
  for (const field of [
    'active_lineage_ref',
    'lineage_id',
    'revision_id',
    'latest_state_ref',
    'latest_state_hash',
    'latest_checkpoint_ref',
    'latest_checkpoint_hash',
    'latest_forecast_result_ref',
    'latest_forecast_result_hash',
    'runtime_config_ref',
    'runtime_config_hash',
  ]) {
    check(typeof lock.canonical_identity?.[field] === 'string' && lock.canonical_identity[field].length > 0, `lock field populated: ${field}`);
  }
  check(lock.canonical_identity?.latest_successful_forecast_ref === null, 'latest successful Forecast remains null');
  checkArrayIncludesAll(lock.preserved_nonclaims, PREAUTH_NONCLAIMS, 'lock nonclaim');

  check(erratum.status === 'READY_FOR_MERGE_CANONICAL_CHECKPOINT_VERIFIED', 'erratum canonical checkpoint verified');
  check(erratum.canonical_authority?.postgresql_read_status === 'PASS', 'erratum PostgreSQL read PASS');
  check(erratum.canonical_authority?.observed_value === '2026-06-02T02:00:00.000Z', 'erratum observed next time exact');
  check(erratum.canonical_authority?.checkpoint_tick_sequence === 24, 'erratum observed sequence exact');
  check(erratum.mutation_policy?.predecessor_historical_artifact_rewrite === 'FORBIDDEN', 'erratum forbids predecessor rewrite');
}

function checkAuthorizationAndDelivery() {
  if (!exists(AUTHORIZATION_STATUS_PATH) || !exists(DELIVERY_PATH)) return;
  const status = readJson(AUTHORIZATION_STATUS_PATH);
  const delivery = readJson(DELIVERY_PATH);

  if (MODE === 'draft' && status.status !== 'READY_FOR_MERGE') {
    check(status.status === 'S0_DRAFT_IN_PROGRESS', 'draft authorization status explicit');
    check(status.authorization_effective === false, 'draft authorization ineffective');
    check(status.runtime_source_authorized === false, 'draft Runtime source unauthorized');
    return;
  }

  check(status.schema_version === 'geox_mcft_cap_03_authorization_status_v2', 'authorization status schema v2');
  check(status.status === 'READY_FOR_MERGE', 'authorization READY_FOR_MERGE');
  check(status.design_status === 'FINAL_FROZEN_CANDIDATE_V1_2', 'design remains final frozen candidate premerge');
  check(status.implementation_status === 'NOT_AUTHORIZED', 'implementation remains unauthorized premerge');
  check(status.authorization_effective === false, 'authorization ineffective before merged-main Gate');
  check(status.runtime_source_authorized === false, 'Runtime source unauthorized in S0');
  check(status.predecessor?.postgresql_canonical_lock_status === 'COMPLETE', 'status records complete PostgreSQL lock');
  check(status.predecessor?.checkpoint_tick_sequence === 24, 'status records sequence 24');
  check(status.predecessor?.next_tick_logical_time === '2026-06-02T02:00:00.000Z', 'status records next tick 02:00');
  checkArrayExact(status.current_blockers, [
    'MCFT_CAP_03_S0_PR_MERGED',
    'MCFT_CAP_03_S0_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
  ], 'remaining blockers');
  checkArrayIncludesAll(status.preserved_nonclaims, PREAUTH_NONCLAIMS, 'authorization status nonclaim');
  checkArrayExact([...status.exact_changed_file_boundary].sort(), EXACT_CHANGED_FILES, 'authorization exact boundary');

  check(delivery.schema_version === 'geox_mcft_cap_03_delivery_slice_status_v2', 'delivery schema v2');
  check(delivery.status === 'AUTHORIZATION_READY_FOR_MERGE', 'delivery authorization ready');
  check(delivery.active_delivery_slice_id === S0, 'S0 remains active premerge');
  check(delivery.authorization_effective === false, 'delivery authorization ineffective');
  check(delivery.runtime_source_authorized === false, 'delivery Runtime unauthorized');
  check(delivery.slices?.length === 10, 'delivery graph has 10 slices');
  check(delivery.slices?.[0]?.delivery_slice_id === S0, 'S0 first');
  check(delivery.slices?.[0]?.status === 'READY_FOR_MERGE', 'S0 READY_FOR_MERGE');
  checkArrayExact([...delivery.slices[0].exact_changed_file_boundary].sort(), EXACT_CHANGED_FILES, 'S0 exact boundary');
  for (const slice of delivery.slices.slice(1)) {
    check(slice.status === 'BLOCKED', `downstream BLOCKED: ${slice.delivery_slice_id}`);
    check(slice.activation_fields_status === 'TO_BE_FROZEN_AT_SLICE_ACTIVATION', `downstream activation fields pending: ${slice.delivery_slice_id}`);
    check(slice.baseline_main_commit === null && slice.branch === null, `downstream baseline and branch unset: ${slice.delivery_slice_id}`);
    check(Array.isArray(slice.allowed_claims) && slice.allowed_claims.length === 0, `downstream claims empty: ${slice.delivery_slice_id}`);
    check(Array.isArray(slice.exact_changed_file_boundary) && slice.exact_changed_file_boundary.length === 0, `downstream boundary empty: ${slice.delivery_slice_id}`);
  }
  checkArrayExact(delivery.next_authorized_slice_ids, [], 'no downstream slice authorized premerge');
  check(delivery.next_authorized_slice_id_after_s0_effectiveness === S1, 'only S1 eligible after effectiveness');
  check(delivery.successor_authorized === false, 'MCFT-CAP-04 unauthorized');
  checkArrayIncludesAll(delivery.preserved_nonclaims, PREAUTH_NONCLAIMS, 'delivery nonclaim');
}

function checkMatrixAndMap() {
  if (!exists(MATRIX_PATH) || !exists(MAP_PATH)) return;
  const matrix = readJson(MATRIX_PATH);
  const line = matrix.capability_lines?.find((item) => item.capability_line_id === 'MCFT-CAP-03');
  check(matrix.schema_version === 'geox_mcft_vertical_capability_line_matrix_v5', 'matrix schema v5');
  check(Boolean(line), 'matrix contains MCFT-CAP-03');
  check(line?.status === 'AUTHORIZATION_READY_FOR_MERGE', 'matrix authorization ready');
  check(line?.authorization_status === 'READY_FOR_MERGE', 'matrix status ready');
  check(line?.authorization_effective === false, 'matrix authorization ineffective');
  check(line?.runtime_source_authorized === false, 'matrix Runtime unauthorized');
  check(line?.design_status === 'FINAL_FROZEN_CANDIDATE_V1_2', 'matrix design candidate exact');
  check(line?.implementation_status === 'NOT_AUTHORIZED', 'matrix implementation unauthorized');
  check(line?.active_delivery_slice_id === S0, 'matrix S0 active');
  checkArrayExact(line?.next_authorized_slice_ids, [], 'matrix authorizes no next slice');
  check(line?.next_authorized_slice_id_after_merge_and_postmerge_gate === S1, 'matrix identifies S1 after effectiveness');
  check(line?.successor_authorized === false, 'matrix MCFT-CAP-04 unauthorized');
  checkArrayIncludesAll(line?.preserved_nonclaims, PREAUTH_NONCLAIMS, 'matrix nonclaim');

  const map = readText(MAP_PATH);
  check(map.includes('## 14. MCFT-CAP-03 S0 authorization readiness'), 'implementation map CAP-03 section');
  check(map.includes('authorization:\nREADY_FOR_MERGE'), 'implementation map authorization ready');
  check(map.includes('authorization effective:\nfalse'), 'implementation map authorization ineffective');
  check(map.includes('canonical next logical tick:\n2026-06-02T02:00:00.000Z'), 'implementation map next tick exact');
  check(map.includes('MCFT-CAP-04 authorized:\nfalse'), 'implementation map successor blocked');
}

function checkAuthorizationDocument() {
  if (!exists(AUTHORIZATION_PATH)) return;
  const document = readText(AUTHORIZATION_PATH);
  for (const marker of [
    'MCFT-CAP-03-AUTHORIZATION-V1',
    BASELINE,
    'authorization_status:\nREADY_FOR_MERGE',
    'authorization_effective:\nfalse',
    'runtime_source_authorized:\nfalse',
    'checkpoint.tick_sequence:\n24',
    'checkpoint.next_tick_logical_time:\n2026-06-02T02:00:00.000Z',
    S1,
    'MCFT-CAP-04:\nNOT_AUTHORIZED',
  ]) check(document.includes(marker), `authorization document marker: ${marker}`);
  for (const nonclaim of PREAUTH_NONCLAIMS) check(document.includes(nonclaim), `authorization document nonclaim: ${nonclaim}`);
}

function checkGitBoundary() {
  try {
    cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', BASELINE, 'HEAD'], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    check(true, 'S0 history descends from exact baseline');
  } catch {
    check(false, 'S0 history descends from exact baseline');
  }

  try {
    const changed = changedFiles();
    const outOfBoundary = changed.filter((file) => !EXACT_CHANGED_FILES.includes(file));
    check(outOfBoundary.length === 0, `no tracked change outside boundary: ${outOfBoundary.join(',')}`);
    if (MODE !== 'draft') checkArrayExact(changed, EXACT_CHANGED_FILES, 'exact 11-file changed set');
    const forbidden = changed.filter((file) =>
      file.startsWith('apps/server/src/') ||
      file.startsWith('apps/server/db/migrations/') ||
      file.startsWith('apps/server/scripts/') ||
      file.startsWith('apps/web/') ||
      file.startsWith('fixtures/')
    );
    check(forbidden.length === 0, `no Runtime/migration/route/web/fixture change: ${forbidden.join(',')}`);
  } catch (error) {
    check(false, `changed-file boundary readable: ${error.message}`);
  }

  try {
    git(['diff', '--check', BASELINE]);
    check(true, 'S0 diff check PASS');
  } catch (error) {
    check(false, `S0 diff check PASS: ${error.message}`);
  }
}

function checkContext() {
  try {
    const branch = git(['branch', '--show-current']);
    if (MODE === 'postmerge') {
      check(branch === 'main', 'postmerge Gate runs on main');
      const head = git(['rev-parse', 'HEAD']);
      const originMain = git(['rev-parse', 'refs/remotes/origin/main']);
      check(head === originMain, 'postmerge local main equals origin/main');
      check(head !== BASELINE, 'postmerge main advanced beyond baseline');
      check(true, 'postmerge context makes S0 authorization effective without premerge status mutation');
    } else {
      check(branch === BRANCH, `${MODE} Gate runs on S0 branch`);
    }
  } catch (error) {
    check(false, `Git context readable: ${error.message}`);
  }
}

checkRequiredFiles();
checkTask();
checkLockAndErratum();
checkAuthorizationAndDelivery();
checkMatrixAndMap();
checkAuthorizationDocument();
checkGitBoundary();
checkContext();

console.log(`MCFT-CAP-03 authorization ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
