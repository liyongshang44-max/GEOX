// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_AUTHORIZATION.cjs
// Purpose: validate the MCFT-CAP-02 authorization slice, predecessor merged-main evidence, PostgreSQL-derived identity lock, delivery graph, matrix readiness, nonclaims, and exact changed-file boundary.
// Boundary: static governance acceptance only; no Runtime execution, continuation State write, propagation, Forecast success, Scenario, Recommendation, Decision, AO-ACT, scheduler, or production claim.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '7da8fee4daf1f022edff29078a1bbac207d1a32f';
const IMPLEMENTATION_CANDIDATE = '193f9785e42eb146e300e2a64abeed455f10e54e';
const FINAL_CLOSURE_HEAD = '7fedd85815cd65f0e3d2aedc74e4d0d9ed1b0558';
const SLICE = 'MCFT-CAP-02.GOV-AUTHORIZATION-V1';
const PHASE = process.argv.includes('--draft') ? 'draft' : 'final';

const EXACT_CHANGED_FILES = [
  'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-TASK.md',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-AUTHORIZATION.md',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PREDECESSOR_PREFLIGHT.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_AUTHORIZATION.cjs'
].sort();

const PRESERVED_NONCLAIMS = [
  'NO_RUNTIME_SOURCE_AUTHORIZED_BEFORE_AUTHORIZATION_MERGE',
  'NO_HOURLY_DYNAMICS_IMPLEMENTED',
  'NO_CONTINUATION_STATE_PERSISTED',
  'NO_OBSERVATION_UPDATE_APPLIED',
  'NO_OBSERVATION_INNOVATION_COMPUTED',
  'NO_FORECAST_RESIDUAL',
  'NO_SUCCESSFUL_FORECAST',
  'NO_SCENARIO',
  'NO_RECOMMENDATION',
  'NO_DECISION',
  'NO_AO_ACT',
  'NO_CALIBRATED_CONFIDENCE_MODEL',
  'NO_MODEL_ACTIVATION',
  'NO_LATE_EVIDENCE_REVISION',
  'NO_DYNAMIC_ROOT_ZONE_GEOMETRY',
  'NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION',
  'NO_CONTINUOUS_RUNTIME',
  'NO_CONTINUOUS_SCHEDULER',
  'NO_720_TICK_REPLAY_CLOSURE',
  'NO_LIVE_FIELD_CLAIM',
  'NO_MCFT_GATE_A_CLOSURE',
  'NO_MCFT_GATE_B_CLOSURE',
  'NO_MCFT_GATE_C_CLOSURE',
  'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM'
];

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
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function checkArrayIncludesAll(actual, required, label) {
  check(Array.isArray(actual), `${label} is an array`);
  if (!Array.isArray(actual)) return;
  for (const item of required) check(actual.includes(item), `${label}: ${item}`);
}

const taskPath = 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-TASK.md';
const authorizationPath = 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-AUTHORIZATION.md';
const authorizationStatusPath = 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-AUTHORIZATION-STATUS.json';
const deliveryPath = 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json';
const verificationPath = 'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json';
const lockPath = 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json';
const matrixPath = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const implementationMapPath = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';

for (const requiredPath of [taskPath, authorizationPath, authorizationStatusPath, deliveryPath]) {
  check(exists(requiredPath), `draft authorization file exists: ${requiredPath}`);
}

if (exists(taskPath)) {
  const task = readText(taskPath);
  check(task.includes('GEOX-MCFT-CAP-02-TASK-V2.2'), 'task identity is v2.2');
  check(task.includes('mass_balance_trace\n  does not contain any self-hash field'), 'task freezes non-recursive mass-balance hashing');
  check(task.includes('available_water_fraction\n  computed from storage computation basis'), 'task freezes storage-basis AWF');
  check(task.includes('GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json'), 'task freezes exact merged-main verification path');
}

if (exists(authorizationPath)) {
  const authorization = readText(authorizationPath);
  check(authorization.includes('MCFT-CAP-02-AUTHORIZATION-V1'), 'authorization identity exact');
  check(authorization.includes(IMPLEMENTATION_CANDIDATE), 'authorization implementation candidate exact');
  check(authorization.includes(FINAL_CLOSURE_HEAD), 'authorization final closure head exact');
  check(authorization.includes(BASELINE), 'authorization predecessor merge commit exact');
  check(authorization.includes('Every edge is merge-before-next'), 'authorization freezes merge-before-next');
  check(authorization.includes('No Runtime, domain, persistence, adapter, projection, migration, route, web'), 'authorization forbids Runtime source changes');
  for (const nonclaim of PRESERVED_NONCLAIMS) check(authorization.includes(nonclaim), `authorization nonclaim: ${nonclaim}`);
}

let authorizationStatus;
if (exists(authorizationStatusPath)) {
  authorizationStatus = readJson(authorizationStatusPath);
  check(authorizationStatus.authorization_id === 'MCFT-CAP-02-AUTHORIZATION-V1', 'authorization status identity exact');
  check(authorizationStatus.capability_line_id === 'MCFT-CAP-02', 'authorization status capability exact');
  check(authorizationStatus.baseline_main_commit === BASELINE, 'authorization status baseline exact');
  check(authorizationStatus.predecessor?.implementation_candidate_head === IMPLEMENTATION_CANDIDATE, 'authorization status implementation candidate exact');
  check(authorizationStatus.predecessor?.final_closure_head === FINAL_CLOSURE_HEAD, 'authorization status final closure exact');
  check(authorizationStatus.predecessor?.merge_commit === BASELINE, 'authorization status merge commit exact');
  check(authorizationStatus.runtime_source_authorized === false, 'draft authorization does not authorize Runtime source');
  checkArrayIncludesAll(authorizationStatus.preserved_nonclaims, PRESERVED_NONCLAIMS, 'authorization status nonclaim');
}

let delivery;
if (exists(deliveryPath)) {
  delivery = readJson(deliveryPath);
  check(delivery.capability_line_id === 'MCFT-CAP-02', 'delivery status capability exact');
  check(delivery.baseline_main_commit === BASELINE, 'delivery status baseline exact');
  check(delivery.slices?.length === 10, 'delivery graph has exactly ten slices');
  check(delivery.slices?.[0]?.delivery_slice_id === SLICE, 'authorization is first delivery slice');
  for (let index = 1; index < (delivery.slices || []).length; index += 1) {
    check(delivery.slices[index].status === 'BLOCKED', `downstream slice remains blocked: ${delivery.slices[index].delivery_slice_id}`);
  }
}

try {
  cp.execFileSync('git', ['merge-base', '--is-ancestor', BASELINE, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
  check(true, 'authorization branch descends from exact predecessor merge commit');
} catch {
  check(false, 'authorization branch descends from exact predecessor merge commit');
}

try {
  const changed = git(['diff', '--name-only', `${BASELINE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  const outOfBoundary = changed.filter((file) => !EXACT_CHANGED_FILES.includes(file));
  check(outOfBoundary.length === 0, `no changed file outside authorization boundary: ${outOfBoundary.join(',')}`);
  const runtimeChanges = changed.filter((file) =>
    file.startsWith('apps/server/src/') ||
    file.startsWith('apps/server/db/migrations/') ||
    file.startsWith('apps/server/scripts/mcft/') ||
    file.startsWith('apps/web/') ||
    file.startsWith('fixtures/mcft/water_state/replay_v1/')
  );
  check(runtimeChanges.length === 0, `no Runtime/domain/persistence/migration/web/Evidence change: ${runtimeChanges.join(',')}`);
  if (PHASE === 'final') check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), `final exact changed-file set has ${EXACT_CHANGED_FILES.length} files`);
} catch (error) {
  check(false, `changed-file boundary unavailable: ${error.message}`);
}

if (PHASE === 'final') {
  for (const requiredPath of [verificationPath, lockPath, matrixPath, implementationMapPath]) {
    check(exists(requiredPath), `final authorization file exists: ${requiredPath}`);
  }

  if (exists(verificationPath)) {
    const verification = readJson(verificationPath);
    check(verification.schema_version === 'geox_mcft_cap_01_main_verification_v1', 'verification schema exact');
    check(verification.implementation_candidate_head === IMPLEMENTATION_CANDIDATE, 'verification implementation candidate exact');
    check(verification.final_closure_head === FINAL_CLOSURE_HEAD, 'verification final closure head exact');
    check(verification.merge_commit === BASELINE && verification.main_head_verified === BASELINE, 'verification merged-main SHA exact');
    check(verification.final_closure_gate === '173_PASS_0_FAIL', 'verification final closure Gate exact');
    check(verification.server_typecheck === 'PASS', 'verification server typecheck PASS');
    check(verification.server_build === 'PASS', 'verification server build PASS');
    check(verification.git_diff_check === 'PASS', 'verification git diff check PASS');
    check(verification.working_tree === 'CLEAN', 'verification worktree CLEAN');
    check(verification.canonical_identity_extraction === 'PASS', 'verification canonical identity extraction PASS');
    check(verification.verification_status === 'COMPLETE', 'verification status COMPLETE');
  }

  if (exists(lockPath)) {
    const lock = readJson(lockPath);
    check(lock.schema_version === 'geox_mcft_cap_02_predecessor_lock_v1', 'predecessor lock schema exact');
    check(lock.status === 'COMPLETE', 'predecessor lock COMPLETE');
    check(lock.predecessor_implementation_candidate_head === IMPLEMENTATION_CANDIDATE, 'lock implementation candidate exact');
    check(lock.predecessor_final_closure_head === FINAL_CLOSURE_HEAD, 'lock final closure head exact');
    check(lock.predecessor_merge_commit === BASELINE, 'lock merge commit exact');
    check(typeof lock.predecessor_main_verification_commit === 'string' && /^[0-9a-f]{40}$/.test(lock.predecessor_main_verification_commit), 'lock references verification commit');
    for (const field of [
      'active_lineage_object_ref',
      'lineage_id',
      'revision_id',
      'bootstrap_state_ref',
      'bootstrap_state_hash',
      'bootstrap_checkpoint_ref',
      'bootstrap_checkpoint_hash',
      'bootstrap_runtime_config_ref',
      'bootstrap_runtime_config_hash'
    ]) check(typeof lock[field] === 'string' && lock[field].length > 0, `lock field populated: ${field}`);
    check(lock.next_logical_tick_time === '2026-06-01T02:00:00.000Z', 'lock next logical tick exact');
    check(lock.identity_extraction_source === 'ISOLATED_POSTGRESQL_CANONICAL_READ_PATH', 'lock extraction source is PostgreSQL canonical read path');
  }

  if (authorizationStatus) {
    check(authorizationStatus.status === 'COMPLETE', 'authorization status COMPLETE');
    check(authorizationStatus.authorization_effective === true, 'authorization effective on merge');
    check(authorizationStatus.predecessor?.main_verification_status === 'COMPLETE', 'authorization records main verification COMPLETE');
    check(authorizationStatus.predecessor?.canonical_identity_lock_status === 'COMPLETE', 'authorization records predecessor lock COMPLETE');
    check(Array.isArray(authorizationStatus.current_blockers) && authorizationStatus.current_blockers.length === 0, 'authorization blockers cleared');
    check(authorizationStatus.runtime_source_authorized === false, 'authorization slice itself contains no Runtime source');
  }

  if (delivery) {
    check(delivery.status === 'READY_FOR_IMPLEMENTATION', 'delivery status READY_FOR_IMPLEMENTATION');
    check(delivery.active_delivery_slice_id === null, 'no active implementation slice before next branch');
    check(delivery.slices?.[0]?.status === 'COMPLETE', 'authorization slice COMPLETE');
    check(delivery.next_authorized_slice_ids?.length === 1 && delivery.next_authorized_slice_ids[0] === 'MCFT-CAP-02.MCFT-02.CONTINUATION-CONTRACTS-CONFIG-V1', 'only contracts/config slice is next authorized');
  }

  if (exists(matrixPath)) {
    const matrix = readJson(matrixPath);
    const line = matrix.capability_lines?.find((item) => item.capability_line_id === 'MCFT-CAP-02');
    check(Boolean(line), 'matrix contains MCFT-CAP-02');
    check(line?.status === 'READY_FOR_IMPLEMENTATION', 'matrix MCFT-CAP-02 READY_FOR_IMPLEMENTATION');
    check(line?.predecessor_merge_commit === BASELINE, 'matrix predecessor merge exact');
    check(line?.active_delivery_slice_id === null, 'matrix has no active downstream slice');
    check(line?.next_authorized_slice_ids?.length === 1 && line.next_authorized_slice_ids[0] === 'MCFT-CAP-02.MCFT-02.CONTINUATION-CONTRACTS-CONFIG-V1', 'matrix authorizes only contracts/config next');
    checkArrayIncludesAll(line?.preserved_nonclaims, PRESERVED_NONCLAIMS, 'matrix nonclaim');
  }

  if (exists(implementationMapPath)) {
    const implementationMap = readText(implementationMapPath);
    check(implementationMap.includes('MCFT-CAP-02 authorization status:\nREADY_FOR_IMPLEMENTATION'), 'implementation map records authorization readiness');
    check(implementationMap.includes('Runtime source implementation begins only after this authorization is merged'), 'implementation map preserves merge-before-runtime boundary');
    check(implementationMap.includes('MCFT-CAP-03 remains unauthorized'), 'implementation map blocks successor');
  }
}

console.log(`MCFT-CAP-02 authorization ${PHASE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
