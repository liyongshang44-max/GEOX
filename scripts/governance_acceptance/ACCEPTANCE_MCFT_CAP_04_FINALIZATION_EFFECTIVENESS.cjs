// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_FINALIZATION_EFFECTIVENESS.cjs
// Purpose: validate reconciled MCFT-CAP-04 COMPLETE state, the full v0.5 exact deliverable package, and machine-readable historical-snapshot isolation.
// Boundary: governance/package acceptance only; no Runtime execution, persistence write, route, scheduler, recommendation, decision, action, calibration, or successor authorization.
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '4aa3877f80b3864e6bb6a248199c21dafaac115b';
const S10 = 'MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : 'final';
const COMPLETE_CLAIMS = [
  'MCFT_CAP_04_COMPLETE',
  'SUCCESSFUL_72_HOUR_FORECAST_RUNTIME_ESTABLISHED',
  'EXACT_72_POINT_FORECAST_HORIZON_ESTABLISHED',
  'FORECAST_T_PLUS_1_TO_T_PLUS_72_TIME_CONTRACT_ESTABLISHED',
  'JOINT_FORECAST_FORCING_CYCLE_PAIR_SELECTION_ESTABLISHED',
  'FORECAST_FUTURE_FORCING_TRACE_ESTABLISHED',
  'FORECAST_NO_FUTURE_OBSERVATION_LEAKAGE_ESTABLISHED',
  'FORECAST_ADDITIVE_UNCERTAINTY_PROPAGATION_ESTABLISHED',
  'FORECAST_95_PERCENT_INTERVAL_TRACE_ESTABLISHED',
  'FORECAST_PHYSICAL_BOUND_TRACE_ESTABLISHED',
  'A1_COMPLETED_CANONICAL_PERSISTENCE_ESTABLISHED',
  'A2_BLOCKED_FORECAST_DEGRADED_PATH_ESTABLISHED',
  'A1_A2_CROSS_VARIANT_TERMINAL_UNIQUENESS_ESTABLISHED',
  'THREE_FIXED_IRRIGATION_SCENARIOS_ESTABLISHED',
  'NO_ACTION_SCENARIO_BASELINE_EQUIVALENCE_ESTABLISHED',
  'IRRIGATE_NOW_15MM_SCENARIO_ESTABLISHED',
  'IRRIGATE_NOW_25MM_SCENARIO_ESTABLISHED',
  'SCENARIO_RESOURCE_AND_STRESS_SUMMARY_ESTABLISHED',
  'SCENARIO_SET_CANONICAL_PERSISTENCE_ESTABLISHED',
  'FORECAST_SCENARIO_IDEMPOTENCY_ESTABLISHED',
  'MISSING_SCENARIO_RECOVERY_BARRIER_ESTABLISHED',
  'TWENTY_FOUR_FORECAST_SCENARIO_TICKS_PERSISTED',
  'FORECAST_SCENARIO_RESTART_BACKFILL_PROVEN',
  'VERSIONED_CAP_04_RECORD_SET_COMPATIBILITY_ESTABLISHED',
];
const CHANGED_FILES = [
  'apps/server/package.json',
  'apps/server/scripts/mcft/MCFT_CAP_04_FORECAST_SCENARIO_RUNNER.ts',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-CLOSURE-RECORD.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FORECAST-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-RUNTIME-CONFIG-CHAIN.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-RUNTIME-CONFIG-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-SCENARIO-CONTRACT.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_04_24_TICK_EXPECTED.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_04_CONFIG_CHAIN_EXPECTED.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_04_SINGLE_TICK_FORECAST_EXPECTED.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_04_SINGLE_TICK_SCENARIOS_EXPECTED.json',
  'fixtures/mcft/water_state/negative/MCFT_CAP_04_NEGATIVE_FIXTURES.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_FINALIZATION_EFFECTIVENESS.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_24_TICK.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FORECAST_MATH.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SCENARIO_MATH.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK.ts',
];
const REQUIRED_DELIVERABLES = [
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-P0-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PREDECESSOR-LOCK.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-RUNTIME-CONFIG-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-RUNTIME-CONFIG-CHAIN.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FUTURE-FORCING-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FORECAST-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-SCENARIO-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PERSISTENCE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FAILURE-RECOVERY-CONTRACT.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-CLOSURE-RECORD.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-MAIN-VERIFICATION.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FINALIZATION-EFFECTIVENESS.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_04_SINGLE_TICK_FORECAST_EXPECTED.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_04_SINGLE_TICK_SCENARIOS_EXPECTED.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_04_24_TICK_EXPECTED.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_04_CONFIG_CHAIN_EXPECTED.json',
  'fixtures/mcft/water_state/negative/MCFT_CAP_04_NEGATIVE_FIXTURES.json',
  'apps/server/scripts/mcft/MCFT_CAP_04_FORECAST_SCENARIO_RUNNER.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PREDECESSOR_PREFLIGHT.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_CONTRACTS_CONFIG.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FUTURE_FORCING.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FORECAST_MATH.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SCENARIO_MATH.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PERSISTENCE_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_24_TICK.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FAILURE_RECOVERY.ts',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_AUTHORIZATION.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_CLOSURE.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_FINALIZATION_EFFECTIVENESS.cjs',
];
const NEGATIVE_REQUIRED_FIELDS = [
  'fixture_id',
  'expected_reason_code',
  'expected_failure_stage',
  'expected_no_current_operation_partial_canonical_write',
  'expected_no_current_operation_partial_projection_write',
  'expected_checkpoint_behavior',
  'expected_state_latest_behavior',
  'expected_forecast_latest_behavior',
  'expected_successful_forecast_behavior',
  'expected_scenario_latest_behavior',
  'expected_active_lineage_behavior',
  'optional_operational_audit_allowed',
];

let pass = 0;
let fail = 0;
const check = (value, message) => {
  if (value) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
};
const git = (args) => cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const readText = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(readText(relativePath));
const exactSet = (actual, expected, message) => check(
  JSON.stringify([...(actual || [])].sort()) === JSON.stringify([...expected].sort()),
  message,
);

for (const file of REQUIRED_DELIVERABLES) {
  check(fs.existsSync(path.join(ROOT, file)), `required deliverable exists ${file}`);
}

const auth = readJson('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json');
const delivery = readJson('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json');
const closure = readJson('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-CLOSURE-STATUS.json');
const record = readJson('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-CLOSURE-RECORD.json');
const finalization = readJson('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FINALIZATION-STATUS.json');
const mainVerification = readJson('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-MAIN-VERIFICATION.json');
const effectiveness = readJson('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FINALIZATION-EFFECTIVENESS.json');
const slice = delivery.slices.find((item) => item.delivery_slice_id === S10);

check(auth.implementation_status === 'COMPLETE' && auth.active_delivery_slice_id === null, 'authorization COMPLETE inactive');
check(delivery.status === 'COMPLETE' && delivery.active_delivery_slice_id === null, 'delivery COMPLETE inactive');
for (const object of [slice, closure, record, finalization, mainVerification, effectiveness]) {
  check(object.closure_effective === true, 'closure effective');
  check(object.capability_status === 'COMPLETE' || object.capability_complete === true, 'capability complete');
  exactSet(object.pending_completion_claims, [], 'pending completion claims empty');
  exactSet(object.effective_completion_claims, COMPLETE_CLAIMS, 'effective completion claims exact');
}
check(record.status === 'COMPLETE' && record.implementation_status === 'COMPLETE', 'Closure Record COMPLETE');
check(record.record_revision === 'v0.5-deliverable-and-ssot-remediation-v1', 'Closure Record remediation revision');
check(record.branch === null && record.active_delivery_slice_id === null, 'Closure Record inactive current identity');
check(record.current_authority?.authority_kind === 'FINALIZATION_EFFECTIVENESS', 'Closure Record current authority explicit');
check(record.current_authority?.completion_activation_merge_commit === BASE, 'Closure Record completion merge exact');
for (const key of ['pending_claim_support', 'finalization_candidate', 'main_verification_candidate', 'finalization_effectiveness_candidate']) {
  check(!(key in record), `legacy conflicting top-level snapshot removed ${key}`);
}

const snapshots = record.historical_snapshots?.snapshots;
check(record.historical_snapshots?.authoritative === false && snapshots && typeof snapshots === 'object', 'historical snapshot namespace non-authoritative');
check(Object.keys(snapshots || {}).length === 4, 'four historical lifecycle snapshots retained');
for (const [name, snapshot] of Object.entries(snapshots || {})) {
  check(snapshot.historical_snapshot === true, `${name} marked historical`);
  check(snapshot.authoritative === false, `${name} marked non-authoritative`);
  check(snapshot.superseded === true, `${name} marked superseded`);
  check(snapshot.superseded_by_ref === 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FINALIZATION-EFFECTIVENESS.json', `${name} superseded-by authority exact`);
}
const s9ClaimSnapshot = snapshots?.s9_pending_claim_support;
check(s9ClaimSnapshot?.claim_count === COMPLETE_CLAIMS.length, 'historical S9 claim support count exact');
check(s9ClaimSnapshot?.effective_at_snapshot === false && s9ClaimSnapshot?.current_effective === true, 'historical S9 snapshot distinguishes past from current state');

function scanForUnmarkedConflict(value, objectPath, inheritedHistorical) {
  if (!value || typeof value !== 'object') return;
  const localHistorical = inheritedHistorical || (
    value.historical_snapshot === true
    && value.authoritative === false
    && value.superseded === true
  );
  if (!localHistorical) {
    if (typeof value.status === 'string' && /(PENDING|CANDIDATE)/.test(value.status)) {
      check(false, `unmarked conflicting status rejected at ${objectPath}.status`);
    }
    if (value.completion_claims_status === 'PENDING') {
      check(false, `unmarked pending claims status rejected at ${objectPath}.completion_claims_status`);
    }
    if (value.effectiveness_condition_satisfied === false) {
      check(false, `unmarked false effectiveness rejected at ${objectPath}.effectiveness_condition_satisfied`);
    }
    if (value.effective === false) {
      check(false, `unmarked ineffective claim rejected at ${objectPath}.effective`);
    }
  }
  for (const [key, child] of Object.entries(value)) {
    scanForUnmarkedConflict(child, `${objectPath}.${key}`, localHistorical || key === 'historical_snapshots');
  }
}
const failBeforeConflictScan = fail;
scanForUnmarkedConflict(record, 'closure_record', false);
check(fail === failBeforeConflictScan, 'no unmarked nested conflicting state');
exactSet(record.exact_changed_file_boundary, CHANGED_FILES, 'Closure Record remediation boundary exact');

const runtimeConfigContract = readJson('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-RUNTIME-CONFIG-CONTRACT.json');
const runtimeConfigChain = readJson('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-RUNTIME-CONFIG-CHAIN.json');
const forecastContract = readJson('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FORECAST-CONTRACT.json');
const scenarioContract = readJson('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-SCENARIO-CONTRACT.json');
check(runtimeConfigContract.contract_id === 'MCFT_CAP_04_RUNTIME_CONFIG_V1', 'Runtime Config contract identity');
check(runtimeConfigChain.config_count === 24 && runtimeConfigChain.first_effective_logical_time === '2026-06-03T02:00:00.000Z', 'Runtime Config chain boundary');
check(forecastContract.variants.A1_COMPLETED.point_count === 72 && forecastContract.time_contract.first_target === 'T+1H', 'Forecast contract boundary');
check(scenarioContract.option_count === 3 && scenarioContract.assumption_authority.representation === 'assumption_basis', 'Scenario contract boundary');

const forecastExpected = readJson('fixtures/mcft/water_state/expected/MCFT_CAP_04_SINGLE_TICK_FORECAST_EXPECTED.json');
const scenariosExpected = readJson('fixtures/mcft/water_state/expected/MCFT_CAP_04_SINGLE_TICK_SCENARIOS_EXPECTED.json');
const rangeExpected = readJson('fixtures/mcft/water_state/expected/MCFT_CAP_04_24_TICK_EXPECTED.json');
const configExpected = readJson('fixtures/mcft/water_state/expected/MCFT_CAP_04_CONFIG_CHAIN_EXPECTED.json');
check(forecastExpected.point_count === 72 && forecastExpected.first_point.horizon_hour === 1 && forecastExpected.last_point.horizon_hour === 72, 'single-tick Forecast expected fixture');
check(scenariosExpected.option_count === 3 && scenariosExpected.scenario_point_count === 216, 'single-tick Scenario expected fixture');
check(rangeExpected.tick_count === 24 && rangeExpected.forecast_point_count === 1728 && rangeExpected.scenario_point_count === 5184, '24-tick expected fixture');
check(configExpected.config_count === 24 && configExpected.step_hours === 1, 'config-chain expected fixture');

const negative = readJson('fixtures/mcft/water_state/negative/MCFT_CAP_04_NEGATIVE_FIXTURES.json');
check(Array.isArray(negative.fixtures) && negative.fixtures.length >= 16, 'unified negative fixture suites present');
const fixtureIds = new Set();
for (const fixture of negative.fixtures || []) {
  for (const field of NEGATIVE_REQUIRED_FIELDS) {
    check(Object.prototype.hasOwnProperty.call(fixture, field), `${fixture.fixture_id} has ${field}`);
  }
  check(typeof fixture.fixture_id === 'string' && !fixtureIds.has(fixture.fixture_id), `negative fixture id unique ${fixture.fixture_id}`);
  fixtureIds.add(fixture.fixture_id);
  check(Array.isArray(fixture.covered_cases) && fixture.covered_cases.length > 0, `${fixture.fixture_id} covers task cases`);
}
check(fixtureIds.has('cap04_complete_ssot_rejects_unmarked_historical_pending_state'), 'SSOT conflict negative fixture present');

const runner = readText('apps/server/scripts/mcft/MCFT_CAP_04_FORECAST_SCENARIO_RUNNER.ts');
const packageJson = readJson('apps/server/package.json');
check(packageJson.scripts['mcft:cap04:forecast-scenario'] === 'pnpm -w exec tsx apps/server/scripts/mcft/MCFT_CAP_04_FORECAST_SCENARIO_RUNNER.ts', 'runner package command exact');
check(runner.includes('Cap04PendingScenarioBarrierSingleTickServiceV1') && runner.includes('Cap04ForecastScenarioRangeServiceV1') && runner.includes('Cap04ForecastScenarioRestartResumeServiceV1'), 'runner reuses verified services');
check(!/Fastify|setInterval|setTimeout|Date\.now|Math\.random/.test(runner), 'runner has no route scheduler wall-clock or random authority');

const wrapperExpectations = {
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FORECAST_MATH.ts': ['ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH.ts', 'ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH_NEGATIVE.ts'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SCENARIO_MATH.ts': ['ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH.ts', 'ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH_NEGATIVE.ts'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK.ts': ['ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts', 'ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_NEGATIVE.ts'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_24_TICK.ts': ['ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE.ts', 'ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE_NEGATIVE.ts'],
};
for (const [wrapper, imports] of Object.entries(wrapperExpectations)) {
  const text = readText(wrapper);
  check(imports.every((name) => text.includes(name)), `thin wrapper reuses existing suites ${wrapper}`);
}

const tracked = git(['diff', '--name-only', BASE]).split(/\r?\n/).filter(Boolean);
const untracked = git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
const changed = [...new Set([...tracked, ...untracked])].sort();
exactSet(changed, CHANGED_FILES, 'exact remediation changed-file boundary');
for (const file of changed) {
  check(!file.startsWith('apps/server/src/'), `no Runtime source change ${file}`);
  check(!file.startsWith('apps/server/db/migrations/'), `no migration change ${file}`);
  check(!file.startsWith('apps/web/'), `no web change ${file}`);
  check(!file.startsWith('.github/workflows/'), `no workflow retained ${file}`);
}
check(delivery.successor_authorized === false && effectiveness.successor_authorized === false && record.successor_authorized === false, 'MCFT-CAP-05 remains unauthorized');

if (MODE === 'postmerge') {
  check(git(['branch', '--show-current']) === 'main', 'postmerge runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge main equals origin/main');
}
console.log(`MCFT-CAP-04 v0.5 closure package remediation ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
