// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY.cjs
// Purpose: enforce the exact six-file Failure Recovery boundary and run consolidated application, PostgreSQL, typecheck, and build proof.
// Boundary: governance and acceptance orchestration only; no production Runtime implementation, migration, route, scheduler, or capability closure.

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '3166e9fb301f86499c82dce3590cfb6f5db15173';
const BRANCH = 'mcft-cap-02-failure-recovery-v1';
const SLICE_ID = 'MCFT-CAP-02.FAILURE-RECOVERY-V1';
const RESTART_ID = 'MCFT-CAP-02.MCFT-04.RESTART-BACKFILL-V1';
const CLOSURE_ID = 'MCFT-CAP-02.CLOSURE-V1';
const isDraft = process.argv.includes('--draft');

const EXACT_FILES = [
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-FAILURE-RECOVERY-CONTRACT.md',
  'fixtures/mcft/water_state/negative/MCFT_CAP_02_FAILURE_RECOVERY_FIXTURES.json',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY_DB.ts',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY.cjs',
].sort();

const REQUIRED_CLASSES = [
  'fault_injection',
  'stale_fencing',
  'cas_conflict',
  'missing_et0',
  'missing_rainfall',
  'duplicate_conflict',
  'invalid_config',
  'mass_balance_violation',
  'idempotent_crash_retry',
  'projection_divergence',
].sort();

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

const branch = gitText(['branch', '--show-current']);
check(branch === BRANCH || branch === 'main', 'Gate runs only on the frozen branch or merged main');

const mergeBase = gitText(['merge-base', BASELINE, 'HEAD']);
check(mergeBase === BASELINE, 'failure recovery slice descends from the verified restart/backfill main head');

const changedFiles = gitText(['diff', '--name-only', `${BASELINE}...HEAD`])
  .split(/\r?\n/)
  .filter(Boolean)
  .sort();
assert.deepEqual(changedFiles, EXACT_FILES);
check(true, 'exact changed-file set has six files');
check(!changedFiles.some((file) => file.startsWith('apps/server/src/')), 'no production Runtime source changed');
check(!changedFiles.some((file) => file.startsWith('apps/server/db/migrations/')), 'no migration changed');
check(!changedFiles.some((file) => file.startsWith('apps/server/src/routes/')), 'no public write route changed');
check(!changedFiles.some((file) => file.startsWith('apps/web/')), 'no web path changed');
check(!changedFiles.some((file) => file.startsWith('.github/workflows/')), 'no workflow changed');

const diffCheck = spawnSync('git', ['diff', '--check', `${BASELINE}...HEAD`], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert.equal(diffCheck.status, 0, diffCheck.stderr);
check(true, 'git diff --check PASS');

const status = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json');
const restart = status.slices.find((item) => item.delivery_slice_id === RESTART_ID);
const failure = status.slices.find((item) => item.delivery_slice_id === SLICE_ID);
const closure = status.slices.find((item) => item.delivery_slice_id === CLOSURE_ID);

check(status.schema_version === 'geox_mcft_cap_02_delivery_slice_status_v9', 'delivery status schema v9 exact');
check(status.latest_verified_main_commit === BASELINE, 'latest verified main is the restart/backfill merge commit');
check(status.active_delivery_slice_id === SLICE_ID, 'Failure Recovery is the active delivery slice');
check(Boolean(restart), 'restart/backfill predecessor slice exists');
check(restart.status === 'MERGED', 'restart/backfill predecessor is MERGED');
check(restart.merge_commit === BASELINE, 'restart/backfill merge commit exact');
check(restart.implementation_candidate_head === '5384f056ff9a98f784617df681768927b471daba', 'restart/backfill candidate head exact');
check(restart.merged_main_acceptance?.final_gate === '80_PASS_0_FAIL', 'restart/backfill merged-main final Gate evidence exact');
check(restart.merged_main_acceptance?.postgres_restart_backfill === '8_PASS_0_FAIL', 'restart/backfill PostgreSQL evidence exact');
check(status.completion_claims.includes('RESTART_BACKFILL_MERGED_MAIN_VERIFIED'), 'restart/backfill merged-main completion claim recorded');
check(Boolean(failure), 'Failure Recovery slice exists');
check(failure.baseline_main_commit === BASELINE, 'Failure Recovery baseline exact');
check(failure.branch === BRANCH, 'Failure Recovery branch exact');
check(failure.depends_on_delivery_slice_ids.length === 1 && failure.depends_on_delivery_slice_ids[0] === RESTART_ID, 'Failure Recovery dependency exact');
assert.deepEqual([...failure.exact_changed_file_boundary].sort(), EXACT_FILES);
check(true, 'Failure Recovery exact changed-file boundary matches Gate');
check(closure.status === 'BLOCKED', 'Closure remains blocked');

if (isDraft) {
  check(status.status === 'FAILURE_RECOVERY_IN_PROGRESS', 'draft capability status exact');
  check(failure.status === 'IN_PROGRESS', 'draft Failure Recovery status exact');
  check(status.global_preserved_nonclaims.includes('NO_FAILURE_RECOVERY_SLICE_COMPLETION_CLAIM'), 'draft retains Failure Recovery completion nonclaim');
  check(failure.preserved_nonclaims.includes('NO_FAILURE_RECOVERY_SLICE_COMPLETION_CLAIM'), 'draft slice retains Failure Recovery completion nonclaim');
} else {
  check(status.status === 'FAILURE_RECOVERY_READY_FOR_MERGE', 'final capability status exact');
  check(failure.status === 'READY_FOR_MERGE', 'final Failure Recovery status exact');
  check(!status.global_preserved_nonclaims.includes('NO_FAILURE_RECOVERY_SLICE_COMPLETION_CLAIM'), 'final removes Failure Recovery completion nonclaim');
  check(!failure.preserved_nonclaims.includes('NO_FAILURE_RECOVERY_SLICE_COMPLETION_CLAIM'), 'final slice removes Failure Recovery completion nonclaim');
}

for (const nonclaim of [
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
]) {
  check(status.global_preserved_nonclaims.includes(nonclaim), `preserved nonclaim: ${nonclaim}`);
}

const contract = read('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-FAILURE-RECOVERY-CONTRACT.md');
check(contract.includes('GEOX-MCFT-CAP-02-FAILURE-RECOVERY-CONTRACT-V1'), 'Failure Recovery contract identity frozen');
const normalizedContract = contract.toLowerCase().replace(/[^a-z0-9]+/g, '_');
for (const failureClass of REQUIRED_CLASSES) {
  check(normalizedContract.includes(failureClass), `contract covers ${failureClass}`);
}
check(contract.includes('pre-commit crash'), 'contract freezes pre-commit crash proof');
check(contract.includes('post-commit response loss'), 'contract freezes post-commit response-loss proof');
check(contract.includes('stop-on-first-failure') || contract.includes('Stop-on-first-failure'), 'contract freezes stop-on-first-failure');
check(contract.includes('explicit projection rebuild procedure'), 'contract freezes explicit projection repair');

const fixture = readJson('fixtures/mcft/water_state/negative/MCFT_CAP_02_FAILURE_RECOVERY_FIXTURES.json');
check(fixture.schema_version === 'geox_mcft_cap_02_failure_recovery_fixtures_v1', 'Failure Recovery fixture schema exact');
check(fixture.contract_identity === 'GEOX-MCFT-CAP-02-FAILURE-RECOVERY-CONTRACT-V1', 'fixture contract identity exact');
check(fixture.cases.length === 10, 'fixture has exactly ten failure classes');
assert.deepEqual([...new Set(fixture.cases.map((item) => item.failure_class))].sort(), REQUIRED_CLASSES);
check(true, 'fixture failure classes exact');
for (const item of fixture.cases) {
  assert.equal(item.expected_no_current_tick_a2_append, true);
  assert.equal(item.expected_no_current_tick_projection_write, true);
  assert.equal(item.expected_checkpoint_unchanged, true);
  assert.equal(item.expected_state_latest_unchanged, true);
  assert.equal(item.expected_forecast_result_latest_unchanged, true);
  assert.equal(item.expected_active_lineage_unchanged, true);
  assert.equal(item.optional_f_audit_allowed, true);
}
check(true, 'all failure fixtures freeze complete zero-partial-write metadata');

const applicationSource = read('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY.ts');
check(applicationSource.includes('ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK_NEGATIVE.ts'), 'application Gate reuses single-tick negative proof');
check(applicationSource.includes('ACCEPTANCE_MCFT_CAP_02_DYNAMICS_NEGATIVE.ts'), 'application Gate reuses Dynamics invariant proof');
check(applicationSource.includes('ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL_NEGATIVE.ts'), 'application Gate reuses restart divergence proof');

const dbSource = read('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY_DB.ts');
check(dbSource.includes('spawnSync') && dbSource.includes('precommit-crash'), 'PostgreSQL Gate launches a process-boundary pre-commit crash');
check(dbSource.includes('postcommit-loss') && dbSource.includes('retry-existing'), 'PostgreSQL Gate proves post-commit response-loss retry');
check(dbSource.includes('STOP_ON_FIRST_FAILURE_SENTINEL'), 'PostgreSQL Gate proves range stop on first failure');
check(dbSource.includes('CHECKPOINT_PROJECTION_DIVERGENCE'), 'PostgreSQL Gate requires fail-closed projection divergence');
check(dbSource.includes('rebuildContinuationProjections'), 'PostgreSQL Gate invokes explicit projection rebuild');
check(dbSource.includes('EXISTING_IDEMPOTENT_SUCCESS'), 'PostgreSQL Gate requires idempotent existing success');
check(!dbSource.includes('Fastify') && !dbSource.includes('setInterval') && !dbSource.includes('Date.now'), 'Failure Recovery Gate excludes route, scheduler, and implicit wall clock');

const applicationOutput = run('pnpm', ['exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY.ts']);
check(/MCFT-CAP-02 failure recovery: \d+ PASS, 0 FAIL/.test(applicationOutput), 'Failure Recovery application acceptance PASS');

run('pnpm', ['--filter', '@geox/server', 'typecheck']);
check(true, 'server typecheck PASS');

if (!isDraft) {
  check(process.env.MCFT_CAP_02_FAILURE_RECOVERY_DESTRUCTIVE_ACCEPTANCE === '1', 'final Gate requires destructive Failure Recovery acceptance intent');
  const dbOutput = run('pnpm', ['exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY_DB.ts']);
  check(/MCFT-CAP-02 failure recovery DB: 8 PASS, 0 FAIL/.test(dbOutput), 'Failure Recovery PostgreSQL acceptance PASS');
  run('pnpm', ['--filter', '@geox/server', 'build']);
  check(true, 'server build PASS');
}

console.log(`MCFT-CAP-02 failure recovery ${isDraft ? 'draft' : 'final'}: ${pass} PASS, 0 FAIL`);
