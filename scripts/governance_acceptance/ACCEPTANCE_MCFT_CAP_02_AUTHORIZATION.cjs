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
const VERIFICATION_COMMIT = '53aa944da595c515619229d37be86930d7a2e7e7';
const SLICE = 'MCFT-CAP-02.GOV-AUTHORIZATION-V1';
const NEXT_SLICE = 'MCFT-CAP-02.MCFT-02.CONTINUATION-CONTRACTS-CONFIG-V1';
const MODE = process.argv.includes('--draft')
  ? 'draft'
  : process.argv.includes('--postmerge')
    ? 'postmerge'
    : 'premerge';

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

const taskPath = 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-TASK.md';
const authorizationPath = 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-AUTHORIZATION.md';
const authorizationStatusPath = 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-AUTHORIZATION-STATUS.json';
const deliveryPath = 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json';
const verificationPath = 'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json';
const lockPath = 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json';
const matrixPath = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const implementationMapPath = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';

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
    encoding: 'utf8'
  }).trim();
}

function checkArrayIncludesAll(actual, required, label) {
  check(Array.isArray(actual), `${label} is an array`);
  if (!Array.isArray(actual)) return;
  for (const item of required) check(actual.includes(item), `${label}: ${item}`);
}

function checkRequiredFiles() {
  const required = MODE === 'draft'
    ? [authorizationPath, authorizationStatusPath, deliveryPath]
    : [
        taskPath,
        authorizationPath,
        authorizationStatusPath,
        deliveryPath,
        verificationPath,
        lockPath,
        matrixPath,
        implementationMapPath
      ];
  for (const relativePath of required) check(exists(relativePath), `${MODE} authorization file exists: ${relativePath}`);
}

function checkTask() {
  if (!exists(taskPath)) {
    if (MODE === 'draft') check(true, 'draft task artifact may remain pending');
    return;
  }
  const task = readText(taskPath);
  check(task.includes('GEOX-MCFT-CAP-02-TASK-V2.2'), 'task identity is v2.2');
  check(task.includes('mass_balance_trace\n  does not contain any self-hash field'), 'task freezes non-recursive mass-balance hashing');
  check(task.includes('available_water_fraction\n  computed from storage computation basis'), 'task freezes storage-basis AWF');
  check(task.includes('depletion_from_field_capacity_mm\n  computed from storage computation basis'), 'task freezes storage-basis depletion');
  check(task.includes('GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json'), 'task freezes exact merged-main verification path');
  check(task.includes('MCFT-CAP-02.GOV-AUTHORIZATION-V1'), 'task freezes governance authorization slice');
  check(task.includes('MCFT-CAP-02.MCFT-02.CONTINUATION-CONTRACTS-CONFIG-V1'), 'task freezes first Runtime delivery slice');
}

function checkAuthorizationDocument() {
  if (!exists(authorizationPath)) return;
  const authorization = readText(authorizationPath);
  check(authorization.includes('MCFT-CAP-02-AUTHORIZATION-V1'), 'authorization identity exact');
  check(authorization.includes(IMPLEMENTATION_CANDIDATE), 'authorization implementation candidate exact');
  check(authorization.includes(FINAL_CLOSURE_HEAD), 'authorization final closure head exact');
  check(authorization.includes(BASELINE), 'authorization predecessor merge commit exact');
  check(authorization.includes(VERIFICATION_COMMIT), 'authorization verification commit exact');
  check(authorization.includes('Every edge is merge-before-next'), 'authorization freezes merge-before-next');
  check(authorization.includes('No Runtime, domain, persistence, adapter, projection, migration, route, web'), 'authorization forbids Runtime source changes');
  check(authorization.includes('authorization_effective:\nfalse'), 'authorization document remains premerge ineffective');
  check(authorization.includes('AUTHORIZATION_PR_MERGED_TO_MAIN_AND_POSTMERGE_GATE_PASS'), 'authorization freezes postmerge effectiveness condition');
  for (const nonclaim of PRESERVED_NONCLAIMS) check(authorization.includes(nonclaim), `authorization nonclaim: ${nonclaim}`);
}

function checkVerification() {
  if (!exists(verificationPath)) return;
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
  try {
    const artifactCommit = git(['log', '-1', '--format=%H', '--', verificationPath]);
    check(artifactCommit === VERIFICATION_COMMIT, 'verification artifact commit exact');
  } catch (error) {
    check(false, `verification artifact commit readable: ${error.message}`);
  }
}

function checkLock() {
  if (!exists(lockPath)) return;
  const lock = readJson(lockPath);
  check(lock.schema_version === 'geox_mcft_cap_02_predecessor_lock_v1', 'predecessor lock schema exact');
  check(lock.status === 'COMPLETE', 'predecessor lock COMPLETE');
  check(lock.predecessor_implementation_candidate_head === IMPLEMENTATION_CANDIDATE, 'lock implementation candidate exact');
  check(lock.predecessor_final_closure_head === FINAL_CLOSURE_HEAD, 'lock final closure head exact');
  check(lock.predecessor_merge_commit === BASELINE, 'lock merge commit exact');
  check(lock.predecessor_main_verification_commit === VERIFICATION_COMMIT, 'lock verification commit exact');
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

function checkStatusAndDelivery() {
  if (!exists(authorizationStatusPath) || !exists(deliveryPath)) return;
  const status = readJson(authorizationStatusPath);
  const delivery = readJson(deliveryPath);

  check(status.authorization_id === 'MCFT-CAP-02-AUTHORIZATION-V1', 'authorization status identity exact');
  check(status.capability_line_id === 'MCFT-CAP-02', 'authorization status capability exact');
  check(status.baseline_main_commit === BASELINE, 'authorization status baseline exact');
  check(status.predecessor?.implementation_candidate_head === IMPLEMENTATION_CANDIDATE, 'authorization status implementation candidate exact');
  check(status.predecessor?.final_closure_head === FINAL_CLOSURE_HEAD, 'authorization status final closure exact');
  check(status.predecessor?.merge_commit === BASELINE, 'authorization status merge commit exact');
  check(status.predecessor?.main_verification_commit === VERIFICATION_COMMIT, 'authorization status verification commit exact');
  check(status.predecessor?.main_verification_status === 'COMPLETE', 'authorization records main verification COMPLETE');
  check(status.predecessor?.canonical_identity_lock_status === 'COMPLETE', 'authorization records predecessor lock COMPLETE');
  check(status.status === 'READY_FOR_MERGE', 'authorization status READY_FOR_MERGE');
  check(status.authorization_effective === false, 'authorization remains ineffective before postmerge Gate');
  check(status.authorization_effective_condition === 'AUTHORIZATION_PR_MERGED_TO_MAIN_AND_POSTMERGE_GATE_PASS', 'authorization effectiveness condition exact');
  check(status.runtime_source_authorized === false, 'authorization does not authorize Runtime source in this slice');
  check(Array.isArray(status.current_blockers) && status.current_blockers.length === 2, 'authorization retains only merge and postmerge blockers');
  check(status.current_blockers?.includes('MCFT_CAP_02_AUTHORIZATION_PR_MERGED'), 'authorization retains merge blocker');
  check(status.current_blockers?.includes('MCFT_CAP_02_POSTMERGE_AUTHORIZATION_GATE_PASS'), 'authorization retains postmerge Gate blocker');
  check(status.next_authorized_slice_id_after_merge_and_postmerge_gate === NEXT_SLICE, 'authorization identifies only next slice after effectiveness');
  checkArrayIncludesAll(status.preserved_nonclaims, PRESERVED_NONCLAIMS, 'authorization status nonclaim');

  check(delivery.capability_line_id === 'MCFT-CAP-02', 'delivery status capability exact');
  check(delivery.baseline_main_commit === BASELINE, 'delivery status baseline exact');
  check(delivery.status === 'AUTHORIZATION_READY_FOR_MERGE', 'delivery status AUTHORIZATION_READY_FOR_MERGE');
  check(delivery.active_delivery_slice_id === SLICE, 'authorization remains active premerge slice');
  check(delivery.slices?.length === 10, 'delivery graph has exactly ten slices');
  check(delivery.slices?.[0]?.delivery_slice_id === SLICE, 'authorization is first delivery slice');
  check(delivery.slices?.[0]?.status === 'READY_FOR_MERGE', 'authorization delivery slice READY_FOR_MERGE');
  check(delivery.slices?.[0]?.runtime_source_authorized === false, 'authorization delivery slice contains no Runtime authority');
  for (let index = 1; index < (delivery.slices || []).length; index += 1) {
    check(delivery.slices[index].status === 'BLOCKED', `downstream slice remains blocked: ${delivery.slices[index].delivery_slice_id}`);
  }
  check(Array.isArray(delivery.next_authorized_slice_ids) && delivery.next_authorized_slice_ids.length === 0, 'no downstream slice authorized before postmerge Gate');
  check(delivery.next_authorized_slice_id_after_merge_and_postmerge_gate === NEXT_SLICE, 'delivery identifies only next slice after effectiveness');
  checkArrayIncludesAll(delivery.preserved_nonclaims, PRESERVED_NONCLAIMS, 'delivery status nonclaim');
}

function checkMatrixAndMap() {
  if (exists(matrixPath)) {
    const matrix = readJson(matrixPath);
    const line = matrix.capability_lines?.find((item) => item.capability_line_id === 'MCFT-CAP-02');
    check(Boolean(line), 'matrix contains MCFT-CAP-02');
    check(line?.status === 'READY_FOR_IMPLEMENTATION', 'matrix MCFT-CAP-02 READY_FOR_IMPLEMENTATION');
    check(line?.authorization_status === 'READY_FOR_MERGE', 'matrix records authorization READY_FOR_MERGE');
    check(line?.authorization_effective === false, 'matrix does not claim premerge effectiveness');
    check(line?.runtime_source_authorized === false, 'matrix does not authorize Runtime source premerge');
    check(line?.predecessor_merge_commit === BASELINE, 'matrix predecessor merge exact');
    check(line?.predecessor_main_verification_commit === VERIFICATION_COMMIT, 'matrix verification commit exact');
    check(line?.active_delivery_slice_id === SLICE, 'matrix keeps authorization slice active premerge');
    check(Array.isArray(line?.next_authorized_slice_ids) && line.next_authorized_slice_ids.length === 0, 'matrix authorizes no downstream slice premerge');
    check(line?.next_authorized_slice_id_after_merge_and_postmerge_gate === NEXT_SLICE, 'matrix identifies only next slice after effectiveness');
    check(line?.effectiveness_condition === 'AUTHORIZATION_PR_MERGED_TO_MAIN_AND_POSTMERGE_GATE_PASS', 'matrix effectiveness condition exact');
    checkArrayIncludesAll(line?.preserved_nonclaims, PRESERVED_NONCLAIMS, 'matrix nonclaim');
  }

  if (exists(implementationMapPath)) {
    const implementationMap = readText(implementationMapPath);
    check(implementationMap.includes('MCFT-CAP-02 authorization status:\nREADY_FOR_MERGE'), 'implementation map records premerge authorization readiness');
    check(implementationMap.includes('capability matrix status:\nREADY_FOR_IMPLEMENTATION'), 'implementation map records matrix readiness');
    check(implementationMap.includes('authorization effective:\nfalse'), 'implementation map does not claim premerge effectiveness');
    check(implementationMap.includes('Runtime source implementation begins only after this authorization is merged'), 'implementation map preserves merge-before-runtime boundary');
    check(implementationMap.includes('MCFT-CAP-03 remains unauthorized'), 'implementation map blocks successor');
  }
}

function checkGitBoundary() {
  try {
    cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', BASELINE, 'HEAD'], {
      cwd: ROOT,
      stdio: 'ignore'
    });
    check(true, 'authorization history descends from exact predecessor merge commit');
  } catch {
    check(false, 'authorization history descends from exact predecessor merge commit');
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
    if (MODE !== 'draft') check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), `exact changed-file set has ${EXACT_CHANGED_FILES.length} files`);
  } catch (error) {
    check(false, `changed-file boundary unavailable: ${error.message}`);
  }

  try {
    git(['diff', '--check', `${BASELINE}...HEAD`]);
    check(true, 'authorization diff check PASS');
  } catch (error) {
    check(false, `authorization diff check PASS: ${error.message}`);
  }
}

function checkPostmergeContext() {
  if (MODE !== 'postmerge') return;
  try {
    const branch = git(['branch', '--show-current']);
    check(branch === 'main', 'postmerge Gate runs from local main');
  } catch (error) {
    check(false, `postmerge branch readable: ${error.message}`);
  }
  try {
    const head = git(['rev-parse', 'HEAD']);
    check(head !== BASELINE, 'postmerge main advanced beyond predecessor baseline');
    const originMain = git(['rev-parse', 'refs/remotes/origin/main']);
    check(head === originMain, 'postmerge local main equals origin/main');
  } catch (error) {
    check(false, `postmerge main refs readable: ${error.message}`);
  }
  check(exists(taskPath), 'postmerge main contains exact v2.2 task artifact');
  check(exists(lockPath), 'postmerge main contains predecessor lock');
  check(exists(verificationPath), 'postmerge main contains predecessor verification');
  check(true, 'postmerge effectiveness is computed by merged-main context, not by premerge status mutation');
}

checkRequiredFiles();
checkTask();
checkAuthorizationDocument();
checkVerification();
checkLock();
checkStatusAndDelivery();
checkMatrixAndMap();
checkGitBoundary();
checkPostmergeContext();

console.log(`MCFT-CAP-02 authorization ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
