// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE.cjs
// Purpose: gate the exact MCFT-CAP-02 24-tick contiguous range slice, predecessor merged-main proof, bounded range source, pure/negative acceptance, isolated PostgreSQL proof, typecheck, and build.
// Boundary: governance orchestration only; no restart, resume, backfill, scheduler, public route, Forecast success, Scenario, Recommendation, Decision, or action.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '18c921c64463d6d9de5af2b4727c185970d771ef';
const SINGLE_TICK_BASELINE = '1b7ea8058b097b5f5fcc4bf1566462c381bc6d47';
const BRANCH = 'mcft-cap-02-twenty-four-tick-range-v1';
const SLICE = 'MCFT-CAP-02.MCFT-04-08.TWENTY-FOUR-TICK-RANGE-V1';
const PREDECESSOR_SLICE = 'MCFT-CAP-02.MCFT-04-06-08-09.SINGLE-TICK-INTEGRATION-V1';
const NEXT_SLICE = 'MCFT-CAP-02.MCFT-04.RESTART-BACKFILL-V1';
const MODE = process.argv.includes('--draft') ? 'draft' : 'final';

const EXACT_CHANGED_FILES = [
  'apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/contiguous_continuation_range_service_v1.ts',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-TWENTY-FOUR-TICK-RANGE-CONTRACT.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_02_24_TICK_EXPECTED.json',
  'fixtures/mcft/water_state/negative/MCFT_CAP_02_24_TICK_NEGATIVE_FIXTURES.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_02_twenty_four_tick_fixture_v1.ts',
].sort();

const SINGLE_TICK_CHANGED_FILES = [
  'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/ports.ts',
  'apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/continuation_record_set_builder_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.ts',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-SINGLE-TICK-CONTRACT.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_02_SINGLE_TICK_FIXTURES.json',
  'fixtures/mcft/water_state/negative/MCFT_CAP_02_SINGLE_TICK_NEGATIVE_FIXTURES.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_02_single_tick_fixture_v1.ts',
].sort();

const PRESERVED_NONCLAIMS = [
  'NO_RESTART_RESUME_PROOF',
  'NO_BOUNDED_BACKFILL_PROOF',
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
function readText(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }
function readJson(relativePath) { return JSON.parse(readText(relativePath)); }
function git(args) { return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function run(command, args, env = process.env) { return cp.execFileSync(command, args, { cwd: ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function pnpmCommand() { return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'; }
function nodeCommand() { return process.platform === 'win32' ? 'node.exe' : 'node'; }
function runTsx(relativePath, pattern, message, env = process.env) {
  try {
    const output = run(pnpmCommand(), ['exec', 'tsx', relativePath], env);
    process.stdout.write(output);
    check(pattern.test(output), message);
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, message);
  }
}

try {
  cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', BASELINE, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
  check(true, '24-tick range slice descends from verified Single-Tick merge commit');
} catch {
  check(false, '24-tick range slice descends from verified Single-Tick merge commit');
}

try {
  const changed = git(['diff', '--name-only', `${BASELINE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), `exact changed-file set has ${EXACT_CHANGED_FILES.length} files`);
  const forbidden = changed.filter((file) => file.startsWith('apps/web/') || file.startsWith('apps/server/src/routes/') || file.startsWith('apps/server/scripts/mcft/') || file.startsWith('.github/workflows/') || file.startsWith('apps/server/db/migrations/'));
  check(forbidden.length === 0, `no route, runner, workflow, or migration changed: ${forbidden.join(',')}`);
  git(['diff', '--check', `${BASELINE}...HEAD`]);
  check(true, 'git diff --check PASS');
} catch (error) {
  check(false, `changed-file boundary and diff check available: ${error.message}`);
}

try {
  const historical = git(['diff', '--name-only', `${SINGLE_TICK_BASELINE}...${BASELINE}`]).split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(historical) === JSON.stringify(SINGLE_TICK_CHANGED_FILES), 'historical Single-Tick changed-file set has 15 files');
  git(['diff', '--check', `${SINGLE_TICK_BASELINE}...${BASELINE}`]);
  check(true, 'historical Single-Tick git diff --check PASS');
} catch (error) {
  check(false, `historical Single-Tick proof available: ${error.message}`);
}

const delivery = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json');
const predecessor = delivery.slices.find((slice) => slice.delivery_slice_id === PREDECESSOR_SLICE);
const current = delivery.slices.find((slice) => slice.delivery_slice_id === SLICE);
const next = delivery.slices.find((slice) => slice.delivery_slice_id === NEXT_SLICE);
check(delivery.status === (MODE === 'draft' ? 'TWENTY_FOUR_TICK_RANGE_IN_PROGRESS' : 'TWENTY_FOUR_TICK_RANGE_READY_FOR_MERGE'), `${MODE} capability status exact`);
check(delivery.latest_verified_main_commit === BASELINE, 'latest verified main commit is Single-Tick merge commit');
check(delivery.active_delivery_slice_id === SLICE, '24-tick range is active delivery slice');
check(predecessor?.status === 'MERGED', 'Single-Tick predecessor status MERGED');
check(predecessor?.merge_commit === BASELINE, 'Single-Tick predecessor merge commit exact');
check(predecessor?.merged_main_acceptance?.final_gate === '79_PASS_0_FAIL', 'Single-Tick merged-main final Gate evidence exact');
check(predecessor?.merged_main_acceptance?.postgres_single_tick === '6_PASS_0_FAIL', 'Single-Tick PostgreSQL evidence exact');
check(current?.status === (MODE === 'draft' ? 'IN_PROGRESS' : 'READY_FOR_MERGE'), `${MODE} 24-tick slice status exact`);
check(current?.branch === BRANCH, '24-tick branch exact');
check(JSON.stringify(current?.depends_on_delivery_slice_ids) === JSON.stringify([PREDECESSOR_SLICE]), '24-tick dependency exact');
check(JSON.stringify([...(current?.exact_changed_file_boundary || [])].sort()) === JSON.stringify(EXACT_CHANGED_FILES), '24-tick exact changed-file boundary matches Gate');
check(next?.status === 'BLOCKED', 'restart/backfill remains blocked');
check(delivery.completion_claims?.includes('SINGLE_TICK_INTEGRATION_MERGED_MAIN_VERIFIED'), 'Single-Tick merged-main completion claim recorded');
for (const nonclaim of PRESERVED_NONCLAIMS) check(delivery.global_preserved_nonclaims?.includes(nonclaim), `preserved nonclaim: ${nonclaim}`);
if (MODE === 'draft') check(delivery.global_preserved_nonclaims?.includes('NO_TWENTY_FOUR_TICK_RANGE_EXECUTED'), 'draft retains no 24-tick execution claim');

const contract = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-TWENTY-FOUR-TICK-RANGE-CONTRACT.json');
const expected = readJson('fixtures/mcft/water_state/expected/MCFT_CAP_02_24_TICK_EXPECTED.json');
const negative = readJson('fixtures/mcft/water_state/negative/MCFT_CAP_02_24_TICK_NEGATIVE_FIXTURES.json');
check(contract.standard_range?.continuation_tick_count === 24, 'standard continuation tick count frozen');
check(contract.standard_range?.total_state_count === 25, 'standard total State count frozen');
check(contract.standard_range?.a2_fact_count === 192, 'standard A2 fact count frozen');
check(contract.standard_range?.last_continuation_logical_time === '2026-06-02T01:00:00.000Z', 'standard final logical time frozen');
check(contract.standard_final_state?.storage_mean_mm === '56.788512', 'standard final storage frozen');
check(contract.standard_final_state?.storage_variance_mm2 === '247.020977062500', 'standard final variance frozen');
check(contract.range_semantics?.maximum_ticks_per_invocation === 24, 'range cap frozen at 24 ticks');
check(contract.range_semantics?.failure_policy === 'STOP_ON_FIRST_FAILURE', 'stop-on-first-failure policy frozen');
check(expected.et0_series_mm?.length === 24, 'expected fixture has 24 exact-hour ET0 inputs');
check(expected.expected?.checkpoint_tick_sequence === 24, 'expected checkpoint sequence 24 frozen');
check(negative.cases?.length >= 10, 'negative fixture has at least ten cases');

const persistenceSource = readText('apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts');
const rangeSource = readText('apps/server/src/runtime/twin_runtime/contiguous_continuation_range_service_v1.ts');
const tickSource = readText('apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.ts');
check(rangeSource.includes('MAX_CONTIGUOUS_CONTINUATION_TICKS_V1 = 24'), 'production range service freezes maximum 24 ticks');
check(rangeSource.includes('this.tickService.executeOneTick('), 'range service reuses the verified single-tick path');
check(rangeSource.includes('CONTINUATION_RANGE_MAX_TICKS_EXCEEDED'), 'range service rejects invocations above 24 ticks');
check(rangeSource.includes('CONTINUATION_RANGE_NONCONTIGUOUS_COMMITTED_HANDOFF'), 'range service verifies each committed T+1 handoff');
check(rangeSource.includes('status: "ALREADY_COMPLETE"'), 'range service has explicit already-complete idempotency result');
check(!rangeSource.includes('Date.now') && !rangeSource.includes('process.env') && !rangeSource.includes('Fastify') && !rangeSource.includes('setInterval'), 'range service excludes wall clock, environment, routes, and scheduler');
check(tickSource.includes('CONTINUATION_RUNTIME_CONFIG_REF_MISMATCH') && tickSource.includes('CONTINUATION_RUNTIME_CONFIG_HASH_MISMATCH'), 'single-tick path validates carried continuation Runtime Config identity for ticks 2 through 24');
check(persistenceSource.includes('validateContinuationMemberV1') && persistenceSource.includes('currentCheckpointSequence === 1') && persistenceSource.includes('previousObjectValidator'), 'PostgreSQL A2 transaction validates A0 predecessors for tick 1 and continuation predecessors for ticks 2 through 24');

runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE.ts', /MCFT-CAP-02 twenty-four-tick range: \d+ PASS, 0 FAIL/, '24-tick positive acceptance PASS');
runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE_NEGATIVE.ts', /MCFT-CAP-02 twenty-four-tick range negative: \d+ PASS, 0 FAIL/, '24-tick negative acceptance PASS');

if (MODE === 'final') {
  const destructiveEnabled = process.env.MCFT_CAP_02_TWENTY_FOUR_TICK_DESTRUCTIVE_ACCEPTANCE === '1';
  const databaseUrl = process.env.DATABASE_URL;
  let isolatedDatabase = false;
  if (databaseUrl) {
    try { isolatedDatabase = /(mcft|cap02|acceptance|test)/.test(new URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase()); }
    catch { isolatedDatabase = false; }
  }
  check(destructiveEnabled && Boolean(databaseUrl) && isolatedDatabase, 'final Gate requires isolated PostgreSQL 24-tick acceptance environment');
  if (destructiveEnabled && databaseUrl && isolatedDatabase) {
    runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE_DB.ts', /MCFT-CAP-02 twenty-four-tick range DB: \d+ PASS, 0 FAIL/, '24-tick PostgreSQL acceptance PASS');
  }
  for (const [label, args] of [
    ['server typecheck', ['--filter', '@geox/server', 'typecheck']],
    ['server build', ['--filter', '@geox/server', 'build']],
  ]) {
    try {
      const output = run(pnpmCommand(), args);
      process.stdout.write(output);
      check(true, `${label} PASS`);
    } catch (error) {
      process.stderr.write(error.stderr || error.message);
      check(false, `${label} PASS`);
    }
  }
}

console.log(`MCFT-CAP-02 twenty-four-tick range ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
