// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_STRICT_FORECAST_AVAILABILITY.cjs
// Purpose: verify strict pre-observation Forecast availability and lifecycle-aware acceptance orchestration after the S8 Runtime merge.
// Boundary: static governance and repository-shape checks only; no database mutation, Runtime execution, route, network or wall-clock authority.

'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const HARDENING = 'MCFT-CAP-05.S8.STRICT-FORECAST-AVAILABILITY-V1';
const BASELINE = '0610ed542067e699b7dd9828199661f12e1cdbde';
const expectedFiles = [
  'apps/server/src/runtime/twin_runtime/historical_forecast_residual_selector_v1.ts',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S8-STRICT-FORECAST-AVAILABILITY-STATUS.json',
  'scripts/dev/assert_local_pnpm_runtime.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_STRICT_FORECAST_AVAILABILITY.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK.ts',
].sort();

let pass = 0;
let fail = 0;
function check(condition, label) {
  if (condition) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.error(`FAIL ${label}`);
  }
}
function read(file) { return fs.readFileSync(file, 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function changedFilesV1() {
  let emptyResult = null;
  const ranges = [
    `${BASELINE}..HEAD`,
    'HEAD^1..HEAD',
    'origin/main...HEAD',
    'origin/main..HEAD',
  ];
  for (const range of ranges) {
    try {
      const files = execFileSync('git', ['diff', '--name-only', range], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().split(/\r?\n/).filter(Boolean).sort();
      if (files.length > 0) return files;
      emptyResult = [];
    } catch {
      // Continue through frozen-baseline, pull-request merge-parent and remote-main fallbacks.
    }
  }
  return emptyResult;
}

const selector = read(expectedFiles[0]);
const status = json(expectedFiles[1]);
const wrapper = read(expectedFiles[2]);
const acceptance = read(expectedFiles[4]);
const s8Status = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S8-STATUS.json');

check(status.hardening_id === HARDENING && status.status === 'IMPLEMENTATION_CANDIDATE', 'strict availability hardening identity is explicit');
check(status.baseline_main_commit === BASELINE && status.baseline_runtime_pr_number === 2473, 'hardening starts from the merged S8 Runtime baseline');
check(status.baseline_runtime_gate === '81_PASS_0_FAIL' && status.trigger?.runtime_failure === false, 'hardening does not misclassify the probe orchestration failure as Runtime failure');
check(status.trigger?.probe_orchestration_failure === true, 'probe orchestration failure is recorded explicitly');
check(s8Status.delivery_slice_id === status.delivery_slice_id && s8Status.effectiveness_condition_satisfied === false, 'S8 remains pre-settlement while hardening is validated');

check(selector.includes('Date.parse(createdAt) >= Date.parse(input.observation_available_to_runtime_at)'), 'selector requires Forecast created_at strictly before observation availability');
check(selector.includes('FORECAST_NOT_AVAILABLE_BEFORE_OBSERVATION'), 'selector freezes equality-safe availability reason code');
check(selector.includes('EXCLUDED_NOT_AVAILABLE_BEFORE_OBSERVATION'), 'selector preserves explicit exclusion disposition');
check(!selector.includes('Date.parse(createdAt) > Date.parse(input.observation_available_to_runtime_at)'), 'non-strict Forecast availability comparison is removed');

check(acceptance.includes('created_at = CAP05_S8_OUTCOME_TIME_V1'), 'acceptance constructs Forecast created exactly when observation becomes available');
check(acceptance.includes('FORECAST_NOT_AVAILABLE_BEFORE_OBSERVATION'), 'acceptance verifies equality is rejected for the frozen reason');
check(acceptance.includes('created_at equal to observation availability is ineligible'), 'acceptance materializes the hindsight-boundary negative case');
check(acceptance.includes('assert.equal(pass, 16)'), 'in-memory acceptance freezes 16 PASS cardinality');

check(wrapper.includes('runHistoricalGovernance'), 'generic wrapper has explicit historical-governance control');
check(wrapper.includes('s8RuntimeActive'), 'generic wrapper detects the merged S8 Runtime lifecycle frontier');
check(wrapper.includes('strictForecastAvailabilityActive'), 'generic wrapper detects the strict-availability hardening frontier');
check(wrapper.includes('runHistoricalGovernance: !s8RuntimeActive'), 'historical remediation static boundary is not reasserted after S8 Runtime materializes');
check(wrapper.includes('runHistoricalGovernance: !strictForecastAvailabilityActive'), 'historical S8 Runtime static boundary is not reasserted after hardening materializes');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_05_S8_STRICT_FORECAST_AVAILABILITY.cjs'), 'generic wrapper invokes the current strict-availability governance gate');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_CONFORMANCE.ts'), 'historical residual contract behavior remains a permanent regression');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK.ts'), 'S8 in-memory Runtime behavior remains a permanent regression');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK_DB.ts'), 'S8 PostgreSQL Runtime behavior remains a permanent regression');

check(status.selector_contract?.comparison === 'forecast.created_at < observation.available_to_runtime_at', 'status freezes strict less-than semantics');
check(status.selector_contract?.hindsight_or_backfill_acceptance === false, 'status rejects hindsight and backfill acceptance at equal timestamps');
check(status.acceptance?.target_in_memory_pass_count === 16 && status.acceptance?.required_fail_count === 0, 'status freezes acceptance cardinality');
check(status.acceptance?.historical_remediation_static_gate_is_superseded === true, 'status records remediation static-gate supersession');
check(status.acceptance?.historical_s8_runtime_static_gate_is_superseded_after_this_candidate === true, 'status records S8 static-gate supersession after hardening');
check(status.orchestration?.generic_acceptance_wrapper_remains_generic === true, 'probe-specific logic is excluded from the generic acceptance orchestrator');

for (const nonclaim of [
  'NO_NEW_CANONICAL_OBJECT_TYPE',
  'NO_NEW_TRANSACTION_FAMILY',
  'NO_MIGRATION',
  'NO_PUBLIC_ROUTE',
  'NO_RANGE_LOOP',
  'NO_RESTART_OR_BACKFILL_MODE',
  'NO_AUTOMATIC_LATE_HISTORY_REWRITE',
  'NO_CAUSAL_EFFECT_ATTRIBUTION',
  'NO_CALIBRATION_CANDIDATE',
  'NO_SUCCESSOR_SLICE_AUTHORIZATION',
  'NO_CAP_06_AUTHORIZATION',
  'NO_S8_EFFECTIVENESS_CLAIM',
  'NO_GLOBAL_SSOT_SETTLEMENT',
]) check(status.preserved_nonclaims.includes(nonclaim), `preserved nonclaim ${nonclaim}`);

const changed = changedFilesV1();
const frozenBoundary = Array.isArray(status.exact_changed_file_boundary)
  ? [...status.exact_changed_file_boundary].sort()
  : null;
const statusBoundaryMatches = JSON.stringify(frozenBoundary) === JSON.stringify(expectedFiles);
const mode = process.argv.includes('--candidate') ? 'candidate' : process.argv.includes('--postmerge') ? 'postmerge' : 'auto';
if (mode === 'candidate') {
  check((changed && JSON.stringify(changed) === JSON.stringify(expectedFiles))
    || (changed === null && statusBoundaryMatches),
  'exact five-file strict-availability candidate boundary');
} else if (mode === 'postmerge') {
  check(changed !== null && changed.length === 0, 'postmerge main has no strict-availability delta against frozen baseline');
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, 'auto mode recognizes exact strict-availability candidate boundary');
} else if (changed && changed.length === 0) {
  check(true, 'auto mode recognizes merged-main strict-availability hardening');
} else if (changed === null && statusBoundaryMatches) {
  check(true, 'auto mode verifies frozen strict-availability boundary in shallow checkout');
} else {
  console.error(`OBSERVED_CHANGED_FILES ${JSON.stringify(changed)}`);
  check(false, 'auto mode rejects an unexpected strict-availability boundary');
}

check(!expectedFiles.some((file) => file.includes('/migrations/') || file.includes('/routes/') || file.startsWith('apps/web/')), 'hardening boundary excludes migrations, routes and web');
check(!expectedFiles.some((file) => file.includes('AUTHORIZATION-STATUS') || file.includes('DELIVERY-SLICE-STATUS') || file.endsWith('GEOX-MCFT-CAP-05-TASK.md')), 'hardening excludes global SSOT mutation');

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
