// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_FORECAST_RESIDUAL_C_COMMIT.cjs
// Purpose: verify the bounded S8 historical Forecast-to-observation Residual C commit without granting restart, range, causal-attribution, calibration, successor-slice or CAP-06 authority.
// Boundary: static governance and repository-shape checks only; no database mutation, Runtime execution, route, network or wall-clock authority.

'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const S8 = 'MCFT-CAP-05.MCFT-07-11.FORECAST-OBSERVATION-RESIDUAL-C-COMMIT-V1';
const BASELINE = '509fe707104a12fbdbbf08823b6d71a70342e0ad';
const expectedFiles = [
  'apps/server/src/persistence/twin_runtime/postgres_forecast_residual_source_v1.ts',
  'apps/server/src/runtime/twin_runtime/forecast_residual_outcome_tick_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/historical_forecast_residual_selector_v1.ts',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S8-FORECAST-RESIDUAL-C-COMMIT.md',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S8-STATUS.json',
  'scripts/dev/assert_local_pnpm_runtime.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_FORECAST_RESIDUAL_C_COMMIT.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK_DB.ts',
  'scripts/runtime_acceptance/mcft_cap_05_s8_forecast_residual_fixture_v1.ts',
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
  for (const range of ['origin/main...HEAD', 'origin/main..HEAD']) {
    try {
      return execFileSync('git', ['diff', '--name-only', range], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().split(/\r?\n/).filter(Boolean).sort();
    } catch {
      // Try the two-tree comparison when the CI checkout is shallow and has no merge base.
    }
  }
  return null;
}

const source = read(expectedFiles[0]);
const service = read(expectedFiles[1]);
const selector = read(expectedFiles[2]);
const authority = read(expectedFiles[3]);
const status = json(expectedFiles[4]);
const wrapper = read(expectedFiles[5]);
const inMemory = read(expectedFiles[7]);
const database = read(expectedFiles[8]);
const fixture = read(expectedFiles[9]);
const authorization = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json');
const delivery = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json');
const remediation = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S8-RESIDUAL-CONTRACT-REMEDIATION-STATUS.json');
const residualContract = read('apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.ts');

check(status.delivery_slice_id === S8 && status.status === 'IMPLEMENTATION_CANDIDATE', 'S8 candidate identity is explicit');
check(status.baseline_main_commit === BASELINE, 'S8 baseline is the remediation-effective main');
check(status.authorization?.activation_pr_number === 2469 && status.authorization?.runtime_source_authorized === true, 'S8 explicit activation is prerequisite authority');
check(status.pre_s8_contract_remediation?.merge_commit === BASELINE && status.pre_s8_contract_remediation?.effective === true, 'S8 status freezes the merged remediation and merged-main probe');
check(authorization.implementation_status === 'S8_AUTHORIZED_NOT_STARTED' && authorization.active_delivery_slice_id === S8, 'baseline Authorization Status explicitly authorizes S8');
const deliveryS8 = delivery.slices.find((slice) => slice.delivery_slice_id === S8);
check(deliveryS8?.status === 'AUTHORIZED_NOT_STARTED' && deliveryS8?.runtime_source_authorized === true, 'Delivery SSOT authorizes S8 Runtime source and no further claim');
check(remediation.remediation_id === 'MCFT-CAP-05.S8.RESIDUAL-CONTRACT-CONFORMANCE-REMEDIATION-V1'
  && remediation.pull_request_number === 2471
  && remediation.validation?.workflow_conclusion === 'SUCCESS'
  && remediation.validation?.required_fail_count === 0,
'validated pre-S8 remediation record remains present as historical candidate evidence');
check(status.runtime_composition?.new_transaction_family_delta === 0 && status.runtime_composition?.new_canonical_object_type_delta === 0 && status.runtime_composition?.migration_delta === 0, 'S8 creates no object type, transaction family or migration');
check(status.effectiveness_condition_satisfied === false, 'Runtime candidate does not self-claim effectiveness');

for (const token of [
  'LATEST_COMPLETED_FORECAST_POINT_TARGETING_OBSERVATION_V1',
  'GEOX_FORECAST_POINT_SEMANTIC_MEMBER_REF_V1',
  'CAP05_FORECAST_RESIDUAL_MATCH_NOT_FOUND',
  'CAP05_FORECAST_RESIDUAL_LATEST_FORECAST_TIE_CONFLICT',
  'source_posterior_action_feedback_refs',
  'EQUIVALENT_TIE_NOT_SELECTED',
  'semantic_digest',
]) check(selector.includes(token), `historical selector freezes ${token}`);
check(selector.includes('validateCap04CanonicalForecastRunPayloadV1'), 'selector validates canonical completed Forecast authority');
check(selector.includes('forecast_issued_at.localeCompare') && selector.includes('forecast_run_ref.localeCompare'), 'selector applies latest-issued then object-id deterministic order');
check(!selector.includes('Date.now(') && !selector.includes('new Date()'), 'selector has no wall-clock selection authority');

check(source.includes('twin_forecast_run_projection_v1') && source.includes('twin_forecast_point_projection_v1'), 'PostgreSQL source reads existing Forecast projections');
check(source.includes('JOIN facts f') && source.includes('forecast_record_json'), 'PostgreSQL source resolves projection pointers through canonical facts');
check(source.includes('CAP05_RESIDUAL_SOURCE_FORECAST_PROJECTION_MISMATCH') && source.includes('CAP05_RESIDUAL_SOURCE_FORECAST_POINT_PROJECTION_MISMATCH'), 'source checks run and point projection-to-fact identity');
check(source.includes('source_posterior_ref') && source.includes('evidence_window_ref'), 'source walks Forecast to source posterior and Evidence Window');
check(source.includes('twin_action_feedback_projection_v1') && source.includes('source_posterior_action_feedback_refs'), 'source proves canonical H consumption through H projection and fact readback');
check(!source.includes('INSERT INTO') && !source.includes('UPDATE ') && !source.includes('DELETE FROM'), 'historical Forecast source is read-only');

check(service.includes('Cap05ForecastResidualOutcomeTickServiceV1') && service.includes('executeOneTickAndCommitResidual'), 'S8 composes one existing outcome tick plus C commit');
check(service.includes('CAP05_RESIDUAL_OUTCOME_SUCCESSFUL_A1_AND_B_REQUIRED'), 'S8 requires successful A1 and B before C');
check(service.includes('CAP05_RESIDUAL_OUTCOME_ASSIMILATION_NOT_APPLIED_TO_OBSERVATION'), 'S8 requires applied Assimilation for the exact observation');
check(service.includes('buildCap05ForecastResidualV1'), 'S8 reuses the remediated pure Forecast Residual contract');
check(service.includes('commitCanonicalObject') && service.includes('readCanonicalObject'), 'S8 uses existing C persistence and canonical readback');
check(service.includes('equivalence_claimed: false') && service.includes('causal_effect_claimed: false'), 'relation trace rejects implicit equivalence and causal effect');
check(!service.includes('executeHourlyWaterBalanceV1') && !service.includes('executeCap04Pure72hForecastMathV1'), 'S8 does not fork Dynamics or Forecast math');
check(!service.includes('INSERT INTO facts') && !service.includes('UPDATE facts'), 'S8 service does not create an alternate persistence path');

for (const token of [
  'CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1',
  'CAP05_TOTAL_RESIDUAL_VARIANCE_NON_POSITIVE',
  'projection_input_hash',
  'projection_trace_hash',
  'FORECAST_PLUS_OBSERVATION_VARIANCE_V1',
  'FORECAST_ERROR_NOT_ASSIMILATION_INNOVATION',
  'FORECAST_ERROR_NOT_CAUSAL_EFFECT',
]) check(residualContract.includes(token), `frozen residual contract retains ${token}`);

for (const needle of [
  'existing CAP-04 A1/B tick',
  'historical post-receipt Forecast horizon-1',
  'source posterior consumed canonical H Action Feedback',
  'Residual and Assimilation share the exact selected observation',
  'Forecast-plus-observation variance normalization',
  'distinct from Assimilation Innovation and causal effect',
  'numerically distinct from current-tick innovation',
  'zero duplicate C write',
  'missing historical Forecast match fails closed',
  'lacks canonical H consumption is ineligible',
  'semantically equivalent latest-issued ties',
  'non-equivalent latest-issued Forecast tie fails closed',
]) check(inMemory.includes(needle), `in-memory acceptance covers ${needle}`);
check(inMemory.includes('assert.equal(pass, 13)'), 'in-memory acceptance freezes 13 PASS cardinality');

for (const needle of [
  'canonical H plus the exact post-receipt State',
  'production PostgreSQL source reconstructs the exact historical Forecast',
  'production C repository append one canonical Forecast Residual',
  'C fact, projection, idempotency guard and canonical readback',
  'full outcome-tick plus C replay is idempotent',
  'exact Reality scope',
  'rebuilds from append-only facts',
  'does not infer Action Feedback consumption',
]) check(database.includes(needle), `PostgreSQL acceptance covers ${needle}`);
check(database.includes('assert.equal(pass, 7)'), 'PostgreSQL acceptance freezes 7 PASS cardinality');

check(fixture.includes('NOT_YET_VALIDATED') && fixture.includes('PARTIALLY_EXECUTED'), 'fixture preserves trustworthy not-yet-validated H orthogonality');
check(fixture.includes('Cap05ReceiptConsumingForecastScenarioTickServiceV1') && fixture.includes('Cap04ForecastScenarioSingleTickServiceV1'), 'fixture executes real post-receipt and outcome tick services');
check(fixture.includes('observed_at: CAP05_S8_OUTCOME_TIME_V1'), 'fixture observation occurs exactly at Forecast target time');
check(fixture.includes('source_posterior_action_feedback_refs: [feedback.object_id]'), 'fixture historical source binds exact consumed H ref');

for (const token of [
  'C_FORECAST_RESIDUAL_COMMIT',
  'LATEST_COMPLETED_FORECAST_POINT_TARGETING_OBSERVATION_V1',
  'FORECAST_PLUS_OBSERVATION_VARIANCE_V1',
  'equivalence_claimed = false',
  'causal_effect_claimed = false',
  'separate SSOT settlement',
]) check(authority.includes(token), `authority document freezes ${token}`);
check(authority.includes('No migration') || authority.includes('No migration and no ninth transaction family'), 'authority document freezes migration and transaction-family boundary');
check(wrapper.includes('MCFT_CAP_05_S8_FORECAST_RESIDUAL_C_COMMIT_GATE_V1'), 'standard acceptance wires the S8 Runtime gate');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK.ts'), 'standard acceptance runs S8 in-memory behavior');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK_DB.ts'), 'standard acceptance runs S8 PostgreSQL behavior');
check(status.preserved_nonclaims.includes('NO_RESIDUAL_ASSIMILATION_IDENTITY_CLAIM') && status.preserved_nonclaims.includes('NO_CAUSAL_EFFECT_ATTRIBUTION'), 'Residual identity and causal nonclaims remain explicit');
check(status.preserved_nonclaims.includes('NO_CAP_06_AUTHORIZATION') && status.preserved_nonclaims.includes('NO_SUCCESSOR_SLICE_AUTHORIZATION_IN_RUNTIME_PR'), 'successor and CAP-06 remain unauthorized');

const changed = changedFilesV1();
const mode = process.argv.includes('--candidate') ? 'candidate' : process.argv.includes('--postmerge') ? 'postmerge' : 'auto';
if (mode === 'candidate') {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), 'exact ten-file S8 Runtime boundary');
} else if (mode === 'postmerge') {
  check(changed === null || changed.length === 0, 'postmerge main has no S8 delta against origin/main');
  check(status.effectiveness_condition_satisfied === false, 'historical candidate status remains pre-settlement evidence');
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, 'auto mode recognizes exact S8 candidate boundary');
} else if (changed && changed.length === 0) {
  check(true, 'auto mode recognizes merged-main S8 Runtime');
} else {
  check(false, 'auto mode rejects an unexpected S8 boundary');
}

check(!expectedFiles.some((file) => file.includes('/migrations/') || file.includes('/routes/') || file.startsWith('apps/web/')), 'S8 boundary excludes migrations, routes and web');
check(!expectedFiles.some((file) => file.includes('GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX') || file.includes('AUTHORIZATION-STATUS') || file.includes('DELIVERY-SLICE-STATUS') || file.endsWith('GEOX-MCFT-CAP-05-TASK.md')), 'Runtime PR excludes global SSOT mutation');

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
