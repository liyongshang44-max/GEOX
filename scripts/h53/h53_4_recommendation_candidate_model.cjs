'use strict';

// scripts/h53/h53_4_recommendation_candidate_model.cjs
// Purpose: build deterministic H53.4 recommendation candidate payload from H53.2/H53.3 read models.

const crypto = require('node:crypto');

const SOURCE = 'H53_4_RECOMMENDATION_CANDIDATE_DERIVATION_V1';
const VERSION = 'h53.4.v1';
const COMPUTED_AT = '2026-06-26T00:00:00.000Z';
const SCOPE = { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', field_id: 'field_c8_demo' };

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function payload(row) {
  return row?.payload_json || row?.record_json?.payload || {};
}

function selectScenarioOption(scenario, forecast) {
  const options = Array.isArray(scenario.options) ? scenario.options : [];
  if (!options.length) return null;
  const noAction = options.find((option) => option.option_id === 'NO_ACTION');
  const baselineStress = numberOrNull(forecast.stress_day_count) ?? numberOrNull(noAction?.stress_day_count) ?? 999;
  const baselineMin = numberOrNull(forecast.min_available_water_fraction) ?? numberOrNull(noAction?.min_available_water_fraction) ?? 0;
  if (noAction && baselineStress === 0 && baselineMin >= 0.5) return noAction;
  return [...options].sort((a, b) => {
    const stressA = numberOrNull(a.stress_day_count) ?? 999;
    const stressB = numberOrNull(b.stress_day_count) ?? 999;
    if (stressA !== stressB) return stressA - stressB;
    return (numberOrNull(b.min_available_water_fraction) ?? -1) - (numberOrNull(a.min_available_water_fraction) ?? -1);
  })[0];
}

function buildRecommendation(stateRow, forecastRow, scenarioRow) {
  if (!stateRow) throw new Error('H53_2_STATE_MISSING');
  if (!forecastRow) throw new Error('H53_3_FORECAST_MISSING');
  if (!scenarioRow) throw new Error('H53_3_SCENARIO_MISSING');
  const state = payload(stateRow);
  const forecast = payload(forecastRow);
  const scenario = payload(scenarioRow);
  const option = selectScenarioOption(scenario, forecast);
  const status = option ? 'RECOMMENDED' : 'UNKNOWN';
  const recommendationHash = hash({ version: VERSION, state_fact_id: stateRow.fact_id, forecast_fact_id: forecastRow.fact_id, scenario_fact_id: scenarioRow.fact_id, option_id: option?.option_id || null });
  const recommendationId = `rec_h53_4_${recommendationHash.slice(0, 16)}`;
  const action = option ? { action_type: option.option_id === 'NO_ACTION' ? 'NO_ACTION' : 'IRRIGATION_REVIEW_CANDIDATE', amount_mm: numberOrNull(option.amount_mm) ?? 0, water_mm: numberOrNull(option.amount_mm) ?? 0, scheduled_day: option.scheduled_day ?? null, selected_scenario_option_id: option.option_id, source_scenario_set_id: scenario.scenario_set_id, no_direct_execution: true, human_approval_required: true } : null;
  const summary = { source_forecast_id: forecast.forecast_id, source_scenario_set_id: scenario.scenario_set_id, baseline_min_available_water_fraction: numberOrNull(forecast.min_available_water_fraction), baseline_stress_day_count: numberOrNull(forecast.stress_day_count), selected_option_id: option?.option_id || null, selected_min_available_water_fraction: numberOrNull(option?.min_available_water_fraction), selected_stress_day_count: numberOrNull(option?.stress_day_count), risk_delta: option?.option_id === 'NO_ACTION' ? 'NO_ACTION_BASELINE_ACCEPTABLE' : 'SCENARIO_OPTION_SELECTED_FOR_REVIEW' };
  return { type: 'decision_recommendation_v1', payload: { ...SCOPE, recommendation_id: recommendationId, season_id: state.season_id || scenario.season_id || null, recommendation_status: status, selected_scenario_option_id: option?.option_id || null, source_water_state_estimate_id: state.estimate_id || stateRow.fact_id, source_scenario_set_id: scenario.scenario_set_id, source_requirement_id: null, suggested_action: action, suggested_action_json: action, scenario_summary: summary, scenario_summary_json: summary, input_refs: { source_state_fact_id: stateRow.fact_id, source_forecast_fact_id: forecastRow.fact_id, source_scenario_fact_id: scenarioRow.fact_id }, evidence_refs: [{ kind: 'state_estimate', ref_id: stateRow.fact_id, schema_ref: 'water_state_estimate_v1' }, { kind: 'forecast', ref_id: forecastRow.fact_id, schema_ref: 'root_zone_soil_water_forecast_v1' }, { kind: 'scenario', ref_id: scenarioRow.fact_id, schema_ref: 'irrigation_scenario_set_v1' }], derivation: { derivation_version: VERSION, source: SOURCE, derivation_type: 'water_stress_recommendation_candidate_from_scenario_v1', no_direct_execution: true, no_approval_created: true, no_task_created: true }, quality: { status: option ? 'RECOMMENDABLE' : 'UNKNOWN', input_binding_status: option ? 'INPUTS_BOUND' : 'INPUT_NOT_USABLE', reason_codes: option ? [] : ['SCENARIO_OPTION_MISSING'] }, confidence: { level: option ? 'MEDIUM' : 'LOW', score: option ? 0.68 : 0.25 }, human_approval_required: true, no_direct_execution: true, approval_created: false, operation_plan_created: false, task_created: false, derivation_version: VERSION, derivation_source: SOURCE, computed_at: COMPUTED_AT, determinism_hash: recommendationHash } };
}

module.exports = { SOURCE, VERSION, COMPUTED_AT, SCOPE, buildRecommendation };
