// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_CLOSURE.cjs
// Purpose: validate the exact six-file MCFT-CAP-02 Closure evidence set, aggregate all merged predecessor proofs, and run bounded high-level Runtime acceptance.
// Boundary: governance and acceptance orchestration only; no production Runtime change, migration, route, web, workflow, scheduler, successor authorization, or new model semantics.

'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '9a61e05f683adf3815ee1cc4af182efd23508588';
const ACTIVATION_HEAD = '8f63fc84c298a20d12094d100865af89e812ea31';
const BRANCH = 'mcft-cap-02-closure-v1';
const CAPABILITY = 'MCFT-CAP-02';
const CLOSURE_ID = 'MCFT-CAP-02.CLOSURE-V1';
const MODE = process.argv.includes('--draft') ? 'draft' : 'final';

const EXACT_FILES = [
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CLOSURE-RECORD.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CLOSURE.md',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_CLOSURE.cjs',
].sort();

const PENDING_COMPLETION_CLAIMS = [
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
  'NO_MCFT_CAP_02_COMPLETE_CLAIM',
];

const MERGED_MAIN_CLAIMS = [
  'CONTINUATION_CONTRACTS_CONFIG_MERGED_MAIN_VERIFIED',
  'PURE_HOURLY_DYNAMICS_MERGED_MAIN_VERIFIED',
  'CONTINUATION_EVIDENCE_WINDOW_MERGED_MAIN_VERIFIED',
  'CONTINUATION_PERSISTENCE_MERGED_MAIN_VERIFIED',
  'SINGLE_TICK_INTEGRATION_MERGED_MAIN_VERIFIED',
  'TWENTY_FOUR_TICK_RANGE_MERGED_MAIN_VERIFIED',
  'RESTART_BACKFILL_MERGED_MAIN_VERIFIED',
  'FAILURE_RECOVERY_MERGED_MAIN_VERIFIED',
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

function run(command, args, options = {}) {
  const result = spawnSync(commandName(command), args, {
    cwd: ROOT,
    env: { ...process.env, ...(options.env || {}) },
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
check(branch === BRANCH || branch === 'main', 'Gate runs only on the frozen Closure branch or merged main');

const mergeBase = gitText(['merge-base', BASELINE, 'HEAD']);
check(mergeBase === BASELINE, 'Closure descends from the verified Failure Recovery merge commit');

const trackedChangedFiles = gitText(['diff', '--name-only', BASELINE])
  .split(/\r?\n/)
  .filter(Boolean);
const untrackedExpectedFiles = gitText(['ls-files', '--others', '--exclude-standard', '--', ...EXACT_FILES])
  .split(/\r?\n/)
  .filter(Boolean);
const changedFiles = [...new Set([...trackedChangedFiles, ...untrackedExpectedFiles])].sort();
exactArray(changedFiles, EXACT_FILES, 'exact Closure changed-file set has six files');

check(!changedFiles.some((file) => file.startsWith('apps/server/src/')), 'no production Runtime source changed');
check(!changedFiles.some((file) => file.startsWith('apps/server/db/migrations/')), 'no migration changed');
check(!changedFiles.some((file) => file.startsWith('apps/server/src/routes/')), 'no route changed');
check(!changedFiles.some((file) => file.startsWith('apps/web/')), 'no web path changed');
check(!changedFiles.some((file) => file.startsWith('.github/workflows/')), 'no workflow changed');
check(!changedFiles.some((file) => file.startsWith('fixtures/')), 'no fixture bytes changed');

const diffCheck = spawnSync('git', ['diff', '--check', BASELINE], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert.equal(diffCheck.status, 0, diffCheck.stderr);
check(true, 'git diff --check PASS');

const status = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json');
const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const record = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CLOSURE-RECORD.json');
const closureDoc = read('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CLOSURE.md');
const implementationMap = read('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md');

const closure = status.slices.find((item) => item.delivery_slice_id === CLOSURE_ID);
const predecessors = status.slices.filter((item) => item.delivery_slice_id !== CLOSURE_ID);
const cap02 = matrix.capability_lines.find((item) => item.capability_line_id === CAPABILITY);
const matrixClosure = cap02?.delivery_slices?.find((item) => item.delivery_slice_id === CLOSURE_ID);
const matrixPredecessors = cap02?.delivery_slices?.filter((item) => item.delivery_slice_id !== CLOSURE_ID) || [];

check(status.schema_version === 'geox_mcft_cap_02_delivery_slice_status_v10', 'delivery status schema v10 exact');
check(status.capability_line_id === CAPABILITY, 'delivery capability identity exact');
check(status.latest_verified_main_commit === BASELINE, 'latest verified main is the Failure Recovery merge commit');
check(status.active_delivery_slice_id === CLOSURE_ID, 'Closure is the active delivery slice');
check(predecessors.length === 9, 'exact nine predecessor slices exist');
check(predecessors.every((item) => item.status === 'MERGED'), 'all predecessor slices are MERGED');
check(predecessors.every((item) => typeof item.merge_commit === 'string' && item.merge_commit.length === 40), 'all predecessor merge commits are recorded');
for (const claim of MERGED_MAIN_CLAIMS) {
  check(status.completion_claims.includes(claim), `merged-main predecessor claim recorded: ${claim}`);
}

check(Boolean(closure), 'Closure slice exists');
check(closure.primary_owner_work_package_id === 'MCFT-06', 'Closure primary owner exact');
exactArray(
  closure.contributing_work_package_ids,
  ['MCFT-02', 'MCFT-03', 'MCFT-04', 'MCFT-05', 'MCFT-07', 'MCFT-08', 'MCFT-09'],
  'Closure contributors exact',
);
exactArray(closure.depends_on_delivery_slice_ids, ['MCFT-CAP-02.FAILURE-RECOVERY-V1'], 'Closure dependency exact');
check(closure.baseline_main_commit === BASELINE, 'Closure baseline exact');
check(closure.branch === BRANCH, 'Closure branch exact');
exactArray([...closure.exact_changed_file_boundary].sort(), EXACT_FILES, 'Closure file boundary matches Gate');
exactArray(closure.pending_completion_claims, PENDING_COMPLETION_CLAIMS, 'Closure pending completion claims exact');
exactArray(closure.preserved_nonclaims, PRESERVED_NONCLAIMS, 'Closure preserved nonclaims exact');
check(closure.closure_effective === false, 'Closure is not effective before merged-main verification');
check(closure.successor_authorized === false, 'successor remains unauthorized');

if (MODE === 'draft') {
  check(status.status === 'CLOSURE_IN_PROGRESS', 'draft capability status exact');
  check(closure.status === 'IN_PROGRESS', 'draft Closure status exact');
} else {
  check(status.status === 'CLOSURE_READY_FOR_MERGE', 'final capability status exact');
  check(closure.status === 'READY_FOR_MERGE', 'final Closure status exact');
}
check(status.global_preserved_nonclaims.includes('NO_MCFT_CAP_02_COMPLETE_CLAIM'), 'pre-effectiveness capability completion nonclaim retained');
check(!status.completion_claims.includes('MCFT_CAP_02_COMPLETE'), 'effective capability completion claim is absent before merged-main verification');
exactArray(status.global_preserved_nonclaims, PRESERVED_NONCLAIMS, 'global preserved nonclaims exact');

check(record.schema_version === 'geox_mcft_cap_02_closure_record_v1', 'Closure Record schema exact');
check(record.closure_identity === 'GEOX-MCFT-CAP-02-CLOSURE-V1', 'Closure Record identity exact');
check(record.capability_line_id === CAPABILITY, 'Closure Record capability identity exact');
check(record.delivery_slice_id === CLOSURE_ID, 'Closure Record slice identity exact');
check(record.baseline_main_commit === BASELINE, 'Closure Record baseline exact');
check(record.activation_head === ACTIVATION_HEAD, 'Closure Record activation head exact');
check(record.branch === BRANCH, 'Closure Record branch exact');
check(record.closure_effective === false, 'Closure Record is non-effective before merged-main verification');
if (MODE === 'draft') {
  check(record.status === 'IN_PROGRESS', 'draft Closure Record status exact');
} else {
  check(record.status === 'READY_FOR_MERGE', 'final Closure Record status exact');
}
check(record.completed_predecessor_slices.length === 9, 'Closure Record contains nine predecessor slices');
check(record.completed_predecessor_slices.every((item) => item.status === 'MERGED'), 'Closure Record predecessor slices are MERGED');
exactArray(record.pending_completion_claims, PENDING_COMPLETION_CLAIMS, 'Closure Record pending claims exact');
exactArray(record.preserved_nonclaims, PRESERVED_NONCLAIMS, 'Closure Record nonclaims exact');
check(record.authority.failure_recovery_merge_commit === BASELINE, 'Failure Recovery merge authority exact');
check(record.acceptance_evidence.failure_recovery_application === '6_PASS_0_FAIL', 'Failure Recovery application evidence exact');
check(record.acceptance_evidence.persistence_postgresql === '15_PASS_0_FAIL', 'persistence PostgreSQL evidence exact');
check(record.acceptance_evidence.failure_recovery_postgresql === '8_PASS_0_FAIL', 'Failure Recovery PostgreSQL evidence exact');
check(record.acceptance_evidence.failure_recovery_final_gate === '86_PASS_0_FAIL', 'Failure Recovery final Gate evidence exact');
check(Object.values(record.closure_proof).every((value) => value === true), 'all Closure proof predicates are true');
check(Object.values(record.closure_does_not_change).every((value) => value === true), 'Closure declares all implementation boundaries unchanged');
check(record.successor.capability_line_id === 'MCFT-CAP-03', 'successor identity exact');
check(record.successor.authorized === false && record.successor.authorization_id === null, 'successor authorization remains absent');
exactArray([...record.exact_changed_file_boundary].sort(), EXACT_FILES, 'Closure Record file boundary exact');

check(Boolean(cap02), 'capability matrix contains MCFT-CAP-02');
check(cap02.authorization_status === 'MERGED', 'authorization status corrected to MERGED');
check(cap02.authorization_effective === true, 'authorization is effective');
check(cap02.runtime_source_authorized === true, 'bounded Runtime source authorization is recorded');
check(cap02.latest_verified_main_commit === BASELINE, 'matrix latest verified main exact');
check(cap02.active_delivery_slice_id === CLOSURE_ID, 'matrix active Closure slice exact');
check(matrixPredecessors.length === 9 && matrixPredecessors.every((item) => item.status === 'MERGED'), 'matrix predecessor slices are MERGED');
check(matrixPredecessors.every((item) => typeof item.merge_commit === 'string' && item.merge_commit.length === 40), 'matrix predecessor merge commits recorded');
if (MODE === 'draft') {
  check(cap02.status === 'CLOSURE_IN_PROGRESS', 'draft matrix capability status exact');
  check(matrixClosure.status === 'IN_PROGRESS', 'draft matrix Closure status exact');
  check(cap02.closure.status === 'IN_PROGRESS', 'draft matrix Closure evidence status exact');
} else {
  check(cap02.status === 'CLOSURE_READY_FOR_MERGE', 'final matrix capability status exact');
  check(matrixClosure.status === 'READY_FOR_MERGE', 'final matrix Closure status exact');
  check(cap02.closure.status === 'READY_FOR_MERGE', 'final matrix Closure evidence status exact');
}
check(cap02.closure.effective === false, 'matrix Closure remains non-effective premerge');
exactArray(cap02.pending_completion_claims, PENDING_COMPLETION_CLAIMS, 'matrix pending claims exact');
check(Array.isArray(cap02.completion_claims) && cap02.completion_claims.length === 0, 'matrix has no effective completion claim premerge');
exactArray(cap02.preserved_nonclaims, PRESERVED_NONCLAIMS, 'matrix nonclaims exact');
check(cap02.successor_capability_line_id === 'MCFT-CAP-03', 'matrix successor identity exact');
check(cap02.successor_authorized === false && cap02.successor_authorization_id === null, 'matrix successor remains unauthorized');
check(Object.values(matrix.actual_status_at_mcft_cap_02_closure).every((value) => value === 'PARTIALLY_ESTABLISHED'), 'Closure marks no horizontal owner work package COMPLETE');

check(closureDoc.includes('GEOX-MCFT-CAP-02-CLOSURE-V1'), 'Closure document identity frozen');
check(closureDoc.includes('closure_effective:\nfalse'), 'Closure document non-effective state explicit');
for (const claim of PENDING_COMPLETION_CLAIMS) {
  check(closureDoc.includes(claim), `Closure document records pending claim: ${claim}`);
}
for (const nonclaim of PRESERVED_NONCLAIMS) {
  check(closureDoc.includes(nonclaim), `Closure document preserves nonclaim: ${nonclaim}`);
}
check(closureDoc.includes('successor authorized:\nfalse') || closureDoc.includes('authorized:\nfalse'), 'Closure document keeps successor unauthorized');
check(implementationMap.includes('## 10. MCFT-CAP-02 Closure activation'), 'implementation map contains Closure activation section');
check(implementationMap.includes(BASELINE), 'implementation map records the exact Closure baseline');
check(implementationMap.includes('successor authorized:\nfalse'), 'implementation map keeps successor unauthorized');

const rangeOutput = run('pnpm', ['exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE.ts']);
check(/MCFT-CAP-02 twenty-four-tick range: \d+ PASS, 0 FAIL/.test(rangeOutput), '24-tick positive acceptance PASS');

const restartOutput = run('pnpm', ['exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL.ts']);
check(/MCFT-CAP-02 restart backfill: \d+ PASS, 0 FAIL/.test(restartOutput), 'restart/backfill positive acceptance PASS');

const failureOutput = run('pnpm', ['exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY.ts']);
check(/MCFT-CAP-02 failure recovery: \d+ PASS, 0 FAIL/.test(failureOutput), 'Failure Recovery application acceptance PASS');

run('pnpm', ['--filter', '@geox/server', 'typecheck']);
check(true, 'server typecheck PASS');

if (MODE === 'final') {
  check(process.env.MCFT_CAP_02_CLOSURE_DESTRUCTIVE_ACCEPTANCE === '1', 'final Gate requires explicit destructive Closure acceptance intent');

  const databaseUrl = process.env.DATABASE_URL;
  let isolatedDatabase = false;
  if (databaseUrl) {
    try {
      const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase();
      isolatedDatabase = /(mcft|cap02|acceptance|test)/.test(databaseName);
    } catch {
      isolatedDatabase = false;
    }
  }
  check(Boolean(databaseUrl) && isolatedDatabase, 'final Gate requires an isolated PostgreSQL acceptance database');

  const rangeDbOutput = run('pnpm', ['exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE_DB.ts']);
  check(/MCFT-CAP-02 twenty-four-tick range DB: \d+ PASS, 0 FAIL/.test(rangeDbOutput), '24-tick PostgreSQL acceptance PASS');

  const restartDbOutput = run('pnpm', ['exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL_DB.ts']);
  check(/MCFT-CAP-02 restart backfill DB: \d+ PASS, 0 FAIL/.test(restartDbOutput), 'restart/backfill PostgreSQL acceptance PASS');

  const failureDbOutput = run('pnpm', ['exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY_DB.ts']);
  check(/MCFT-CAP-02 failure recovery DB: 8 PASS, 0 FAIL/.test(failureDbOutput), 'Failure Recovery PostgreSQL acceptance PASS');

  run('pnpm', ['--filter', '@geox/server', 'build']);
  check(true, 'server build PASS');
}

console.log(`MCFT-CAP-02 closure ${MODE}: ${pass} PASS, 0 FAIL`);
