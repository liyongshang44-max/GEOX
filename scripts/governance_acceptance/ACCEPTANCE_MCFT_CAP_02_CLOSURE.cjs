// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_CLOSURE.cjs
// Purpose: validate canonical MCFT-CAP-02 completion after PR #2327 merge and merged-main Closure verification.
// Boundary: governance and bounded read/acceptance orchestration only; no Runtime source, migration, route, web, workflow, scheduler, successor authorization, or model-semantic change.

'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const FINALIZATION_BASE = '08f0b5c146959b2a3988cd3ea07647628b0e84ad';
const FINALIZATION_BRANCH = 'mcft-cap-02-closure-finalization-v1';
const FINAL_EVIDENCE_HEAD = '800e1d255414b847587350d0f19b92288b32c1db';
const FINAL_EXACT_HEAD_CI = '4576_SUCCESS';
const MERGED_MAIN_GATE = '161_PASS_0_FAIL';
const CAPABILITY = 'MCFT-CAP-02';
const CLOSURE_ID = 'MCFT-CAP-02.CLOSURE-V1';

const EXACT_FILES = [
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CLOSURE-RECORD.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CLOSURE.md',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-MAIN-VERIFICATION.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_CLOSURE.cjs',
].sort();

const COMPLETION_CLAIMS = [
  'MCFT_CAP_02_COMPLETE',
  'HOURLY_WATER_DYNAMICS_V1_ESTABLISHED',
  'TWENTY_FOUR_CONTINUATION_TICKS_PERSISTED',
  'CONTINUATION_STATE_CHAIN_ESTABLISHED',
  'CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_ESTABLISHED',
  'CONTINUATION_CHECKPOINT_CHAIN_ESTABLISHED',
  'CONTINUATION_OPERATION_IDEMPOTENCY_ESTABLISHED',
  'CONTINUATION_CANONICAL_UNIQUENESS_ESTABLISHED',
  'RESTART_RESUME_PROVEN',
  'BOUNDED_FORWARD_BACKFILL_PROVEN',
  'EXACT_HOURLY_EVIDENCE_SELECTION_ESTABLISHED',
  'EXECUTED_IRRIGATION_INPUT_POLICY_ESTABLISHED',
];

const PRESERVED_NONCLAIMS = [
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
  'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
];

const VERIFIED_DELIVERY_CLAIMS = [
  'CONTINUATION_CONTRACTS_CONFIG_MERGED_MAIN_VERIFIED',
  'PURE_HOURLY_DYNAMICS_MERGED_MAIN_VERIFIED',
  'CONTINUATION_EVIDENCE_WINDOW_MERGED_MAIN_VERIFIED',
  'CONTINUATION_PERSISTENCE_MERGED_MAIN_VERIFIED',
  'SINGLE_TICK_INTEGRATION_MERGED_MAIN_VERIFIED',
  'TWENTY_FOUR_TICK_RANGE_MERGED_MAIN_VERIFIED',
  'RESTART_BACKFILL_MERGED_MAIN_VERIFIED',
  'FAILURE_RECOVERY_MERGED_MAIN_VERIFIED',
  'MCFT_CAP_02_CLOSURE_MERGED_MAIN_VERIFIED',
];

let pass = 0;

function check(condition, message) {
  assert.ok(condition, message);
  pass += 1;
  console.log(`PASS ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function commandName(name) {
  return process.platform === 'win32' && name === 'pnpm' ? 'pnpm.cmd' : name;
}

function run(command, args) {
  const result = spawnSync(commandName(command), args, {
    cwd: ROOT,
    env: { ...process.env },
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  return result.stdout;
}

function gitText(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  return result.stdout.trim();
}

function exactArray(actual, expected, message) {
  assert.deepEqual(actual, expected);
  check(true, message);
}

const branch = gitText(['branch', '--show-current']);
check(branch === FINALIZATION_BRANCH || branch === 'main', 'Gate runs only on the finalization branch or main');

const mergeBase = gitText(['merge-base', FINALIZATION_BASE, 'HEAD']);
check(mergeBase === FINALIZATION_BASE, 'finalization descends from the Closure merge commit');

const trackedChangedFiles = gitText(['diff', '--name-only', FINALIZATION_BASE])
  .split(/\r?\n/)
  .filter(Boolean);
const untrackedExpectedFiles = gitText(['ls-files', '--others', '--exclude-standard', '--', ...EXACT_FILES])
  .split(/\r?\n/)
  .filter(Boolean);
const changedFiles = [...new Set([...trackedChangedFiles, ...untrackedExpectedFiles])].sort();
exactArray(changedFiles, EXACT_FILES, 'exact finalization changed-file set has seven files');

check(!changedFiles.some((file) => file.startsWith('apps/server/src/')), 'no production Runtime source changed');
check(!changedFiles.some((file) => file.startsWith('apps/server/db/migrations/')), 'no migration changed');
check(!changedFiles.some((file) => file.startsWith('apps/server/src/routes/')), 'no route changed');
check(!changedFiles.some((file) => file.startsWith('apps/web/')), 'no web path changed');
check(!changedFiles.some((file) => file.startsWith('.github/workflows/')), 'no workflow changed');
check(!changedFiles.some((file) => file.startsWith('fixtures/')), 'no fixture bytes changed');

const diffCheck = spawnSync('git', ['diff', '--check', FINALIZATION_BASE], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert.equal(diffCheck.status, 0, diffCheck.stderr);
check(true, 'git diff --check PASS');

const status = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json');
const record = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CLOSURE-RECORD.json');
const verification = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-MAIN-VERIFICATION.json');
const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const closureDoc = read('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CLOSURE.md');
const implementationMap = read('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md');

const closure = status.slices.find((item) => item.delivery_slice_id === CLOSURE_ID);
const cap02 = matrix.capability_lines.find((item) => item.capability_line_id === CAPABILITY);
const matrixClosure = cap02?.delivery_slices?.find((item) => item.delivery_slice_id === CLOSURE_ID);

check(status.schema_version === 'geox_mcft_cap_02_delivery_slice_status_v11', 'delivery status schema v11 exact');
check(status.capability_line_id === CAPABILITY, 'delivery status capability identity exact');
check(status.status === 'COMPLETE', 'delivery status capability COMPLETE');
check(status.latest_verified_main_commit === FINALIZATION_BASE, 'delivery status latest verified main exact');
check(status.active_delivery_slice_id === null, 'no active delivery slice after completion');
exactArray(status.completion_claims, COMPLETION_CLAIMS, 'delivery status completion claims exact');
exactArray(status.global_preserved_nonclaims, PRESERVED_NONCLAIMS, 'delivery status preserved nonclaims exact');
exactArray(status.verified_delivery_claims, VERIFIED_DELIVERY_CLAIMS, 'delivery status verified delivery claims exact');
check(status.main_verification_ref.endsWith('GEOX-MCFT-CAP-02-MAIN-VERIFICATION.json'), 'delivery status main-verification ref exact');
exactArray([...status.finalization_exact_changed_file_boundary].sort(), EXACT_FILES, 'delivery status finalization boundary exact');

check(Boolean(closure), 'Closure slice exists');
check(closure.status === 'COMPLETE', 'Closure slice COMPLETE');
check(closure.closure_effective === true, 'Closure slice effective');
check(closure.successor_authorized === false, 'Closure slice keeps successor unauthorized');
check(closure.merge_commit === FINALIZATION_BASE, 'Closure slice merge commit exact');
check(closure.verified_main_commit === FINALIZATION_BASE, 'Closure slice verified main exact');
check(closure.final_evidence_head === FINAL_EVIDENCE_HEAD, 'Closure slice final evidence head exact');
check(closure.final_exact_head_ci === FINAL_EXACT_HEAD_CI, 'Closure slice final exact-head CI exact');
check(closure.merged_main_gate === MERGED_MAIN_GATE, 'Closure slice merged-main Gate exact');
exactArray(closure.completion_claims, COMPLETION_CLAIMS, 'Closure slice completion claims exact');
check(Array.isArray(closure.pending_completion_claims) && closure.pending_completion_claims.length === 0, 'Closure slice has no pending claims');
exactArray([...closure.finalization_exact_changed_file_boundary].sort(), EXACT_FILES, 'Closure slice finalization boundary exact');

check(record.schema_version === 'geox_mcft_cap_02_closure_record_v2', 'Closure Record schema v2 exact');
check(record.status === 'COMPLETE', 'Closure Record COMPLETE');
check(record.closure_effective === true, 'Closure Record effective');
check(record.closure_merge_commit === FINALIZATION_BASE, 'Closure Record merge commit exact');
check(record.verified_main_commit === FINALIZATION_BASE, 'Closure Record verified main exact');
check(record.final_evidence_head === FINAL_EVIDENCE_HEAD, 'Closure Record final evidence head exact');
check(record.final_exact_head_ci === FINAL_EXACT_HEAD_CI, 'Closure Record final exact-head CI exact');
exactArray(record.completion_claims, COMPLETION_CLAIMS, 'Closure Record completion claims exact');
check(Array.isArray(record.pending_completion_claims) && record.pending_completion_claims.length === 0, 'Closure Record has no pending claims');
exactArray(record.preserved_nonclaims, PRESERVED_NONCLAIMS, 'Closure Record preserved nonclaims exact');
exactArray(record.merged_main_completion_claims, VERIFIED_DELIVERY_CLAIMS, 'Closure Record verified delivery claims exact');
check(record.acceptance_evidence.closure_merged_main_gate === MERGED_MAIN_GATE, 'Closure Record merged-main Gate exact');
check(record.acceptance_evidence.closure_merged_main_head === FINALIZATION_BASE, 'Closure Record merged-main head exact');
check(record.acceptance_evidence.merged_main_working_tree === 'CLEAN', 'Closure Record working-tree evidence exact');
check(record.successor.authorized === false && record.successor.authorization_id === null, 'Closure Record successor remains unauthorized');
exactArray([...record.finalization_exact_changed_file_boundary].sort(), EXACT_FILES, 'Closure Record finalization boundary exact');

check(verification.schema_version === 'geox_mcft_cap_02_main_verification_v1', 'main verification schema exact');
check(verification.capability_line_id === CAPABILITY, 'main verification capability identity exact');
check(verification.closure_pr === 2327, 'main verification PR exact');
check(verification.closure_final_evidence_head === FINAL_EVIDENCE_HEAD, 'main verification final evidence head exact');
check(verification.closure_merge_commit === FINALIZATION_BASE, 'main verification merge commit exact');
check(verification.main_head_verified === FINALIZATION_BASE, 'main verification verified head exact');
check(verification.final_exact_head_ci.run_number === 4576, 'main verification final CI run exact');
check(verification.final_exact_head_ci.conclusion === 'success', 'main verification final CI success');
check(verification.merged_main_acceptance.closure_gate === MERGED_MAIN_GATE, 'main verification Closure Gate exact');
check(verification.merged_main_acceptance.twenty_four_tick_postgresql === '8_PASS_0_FAIL', 'main verification 24-tick PostgreSQL exact');
check(verification.merged_main_acceptance.restart_backfill_postgresql === '8_PASS_0_FAIL', 'main verification restart/backfill PostgreSQL exact');
check(verification.merged_main_acceptance.persistence_postgresql === '15_PASS_0_FAIL', 'main verification persistence PostgreSQL exact');
check(verification.merged_main_acceptance.failure_recovery_postgresql === '8_PASS_0_FAIL', 'main verification Failure Recovery PostgreSQL exact');
check(verification.merged_main_acceptance.server_typecheck === 'PASS', 'main verification server typecheck exact');
check(verification.merged_main_acceptance.server_build === 'PASS', 'main verification server build exact');
check(verification.merged_main_acceptance.git_diff_check === 'PASS', 'main verification git diff check exact');
check(verification.merged_main_acceptance.working_tree === 'CLEAN', 'main verification working tree exact');
check(Object.values(verification.completion_standard).every((value) => value === true), 'all completion-standard predicates true');
exactArray(verification.completion_claims, COMPLETION_CLAIMS, 'main verification completion claims exact');
exactArray(verification.preserved_nonclaims, PRESERVED_NONCLAIMS, 'main verification nonclaims exact');
check(verification.successor.authorized === false && verification.successor.authorization_id === null, 'main verification successor remains unauthorized');
check(verification.verification_status === 'COMPLETE', 'main verification status COMPLETE');

check(Boolean(cap02), 'capability matrix contains MCFT-CAP-02');
check(cap02.status === 'COMPLETE', 'matrix capability COMPLETE');
check(cap02.active_delivery_slice_id === null, 'matrix has no active delivery slice');
check(cap02.latest_verified_main_commit === FINALIZATION_BASE, 'matrix latest verified main exact');
exactArray(cap02.completion_claims, COMPLETION_CLAIMS, 'matrix completion claims exact');
check(Array.isArray(cap02.pending_completion_claims) && cap02.pending_completion_claims.length === 0, 'matrix has no pending claims');
exactArray(cap02.preserved_nonclaims, PRESERVED_NONCLAIMS, 'matrix preserved nonclaims exact');
exactArray(cap02.verified_delivery_claims, VERIFIED_DELIVERY_CLAIMS, 'matrix verified delivery claims exact');
check(cap02.successor_capability_line_id === 'MCFT-CAP-03', 'matrix successor identity exact');
check(cap02.successor_authorized === false && cap02.successor_authorization_id === null, 'matrix successor remains unauthorized');
check(Array.isArray(cap02.next_authorized_slice_ids) && cap02.next_authorized_slice_ids.length === 0, 'matrix authorizes no next slice');
check(matrixClosure.status === 'COMPLETE', 'matrix Closure slice COMPLETE');
check(matrixClosure.merge_commit === FINALIZATION_BASE, 'matrix Closure merge commit exact');
check(cap02.closure.status === 'COMPLETE' && cap02.closure.effective === true, 'matrix Closure effective COMPLETE');
check(cap02.closure.merged_main_gate === MERGED_MAIN_GATE, 'matrix Closure merged-main Gate exact');
check(Object.values(matrix.actual_owner_work_package_statuses).every((value) => value !== 'COMPLETE'), 'no horizontal owner work package marked COMPLETE');
check(Object.values(matrix.actual_status_at_mcft_cap_02_closure).every((value) => value !== 'COMPLETE'), 'closure snapshot marks no horizontal owner work package COMPLETE');

check(closureDoc.includes('status:\nCOMPLETE'), 'Closure document status COMPLETE');
check(closureDoc.includes('closure_effective:\ntrue'), 'Closure document effective');
check(closureDoc.includes('## 10. Canonical merged-main finalization'), 'Closure document finalization section present');
check(!closureDoc.includes('NO_MCFT_CAP_02_COMPLETE_CLAIM'), 'temporary completion nonclaim removed from Closure document');
for (const claim of COMPLETION_CLAIMS) check(closureDoc.includes(claim), `Closure document records completion claim: ${claim}`);
for (const nonclaim of PRESERVED_NONCLAIMS) check(closureDoc.includes(nonclaim), `Closure document preserves nonclaim: ${nonclaim}`);
check(closureDoc.includes('MCFT-CAP-03 authorized:\nfalse'), 'Closure document keeps successor unauthorized');

check(implementationMap.includes('## 13. MCFT-CAP-02 canonical completion'), 'implementation map canonical completion section present');
check(implementationMap.includes(FINALIZATION_BASE), 'implementation map records merged-main authority');
check(implementationMap.includes('successor authorized:\nfalse'), 'implementation map keeps successor unauthorized');

const rangeOutput = run('pnpm', ['exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE.ts']);
check(/MCFT-CAP-02 twenty-four-tick range: 9 PASS, 0 FAIL/.test(rangeOutput), '24-tick positive acceptance PASS');

const restartOutput = run('pnpm', ['exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL.ts']);
check(/MCFT-CAP-02 restart backfill: 9 PASS, 0 FAIL/.test(restartOutput), 'restart/backfill positive acceptance PASS');

const failureOutput = run('pnpm', ['exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY.ts']);
check(/MCFT-CAP-02 failure recovery: 6 PASS, 0 FAIL/.test(failureOutput), 'Failure Recovery application acceptance PASS');

run('pnpm', ['--filter', '@geox/server', 'typecheck']);
check(true, 'server typecheck PASS');

run('pnpm', ['--filter', '@geox/server', 'build']);
check(true, 'server build PASS');

console.log(`MCFT-CAP-02 closure finalization: ${pass} PASS, 0 FAIL`);
