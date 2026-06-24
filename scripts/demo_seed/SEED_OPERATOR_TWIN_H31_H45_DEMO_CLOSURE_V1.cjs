#!/usr/bin/env node
'use strict';

// scripts/demo_seed/SEED_OPERATOR_TWIN_H31_H45_DEMO_CLOSURE_V1.cjs
// Purpose: seed a self-contained Operator Twin H31-H45 demo closure for local demonstration.
// Boundary: this seed writes demo facts and required read-model rows only; it never writes ROI, Field Memory, operation_state, reports, or customer delivery rows.

const { Pool } = require('pg');

const PROJECT_ID = 'projectA';
const GROUP_ID = 'groupA';
const FIELD_ID = 'field_c8_demo';
const ZONE_ID = 'zone_c8_root_zone_001';
const SEASON_ID = 'season_2026_c8_corn';
const FORECAST_ID = 'forecast_c8_irrigation_001';
const SCENARIO_SET_ID = 'scenario_set_c8_irrigation_001';
const RECOMMENDATION_ID = 'rec_c8_irrigation_001';
const APPROVAL_REQUEST_ID = 'approval_req_c8_irrigation_001';
const APPROVAL_DECISION_ID = 'approval_decision_c8_irrigation_001';
const OPERATION_ID = 'op_plan_c8_irrigation_formal_001';
const TRANSITION_ID = 'plan_transition_c8_irrigation_ready_001';
const TASK_ID = 'act_c8_irrigation_formal_001';
const RECEIPT_ID = 'receipt_c8_irrigation_formal_001';
const ACCEPTANCE_ID = 'acc_c8_irrigation_formal_001';
const AS_EXECUTED_ID = 'as_executed_c8_irrigation_formal_001';
const WATER_RESPONSE_ID = 'wrv_c8_irrigation_formal_001';
const PRE_STATE_ID = 'wstate_c8_irrigation_pre_001';
const POST_STATE_ID = 'wstate_c8_irrigation_post_response_001';
const POST_WINDOW_ID = 'sw_c8_soil_moisture_post_irrigation_001';
const EVIDENCE_ID = 'ev_c8_irrigation_water_delivery_001';
const SOURCE = 'scripts/demo_seed/operator_twin_h31_h45_demo_closure_v1';

function arg(name, fallback) { const i = process.argv.indexOf(name); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; }
function hasFlag(name) { return process.argv.includes(name); }
function iso(ms) { return new Date(ms).toISOString(); }
function prefix(tenant) { return `full_review_seed_${tenant}`; }
function json(value) { return JSON.stringify(value); }
function factId(tenant, suffix) { return `${prefix(tenant)}_${suffix}`; }
function fact(tenant, suffix, type, payload, occurredAt) {
  return { fact_id: factId(tenant, suffix), occurred_at: occurredAt, source: SOURCE, record_json: json({ type, payload: { tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, ...payload } }) };
}
async function tableExists(client, table) { const r = await client.query('SELECT to_regclass($1)::text AS name', [`public.${table}`]); return Boolean(r.rows[0]?.name); }
async function tableColumns(client, table) { const r = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table]); return new Set(r.rows.map((x) => String(x.column_name))); }
async function requiredColumns(client, table) {
  const r = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_nullable='NO' AND column_default IS NULL ORDER BY ordinal_position", [table]);
  return r.rows.map((x) => String(x.column_name));
}
function ensureRequiredRowColumns(table, row, required, cols) {
  const missing = required.filter((column) => cols.has(column) && (row[column] === undefined || row[column] === null));
  if (!missing.length) return;
  const error = new Error('SEED_ROW_MISSING_REQUIRED_COLUMNS');
  error.detail = { table, missing, row_keys: Object.keys(row).sort() };
  throw error;
}
async function insertFacts(client, rows) {
  for (const row of rows) await client.query('INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb) ON CONFLICT (fact_id) DO UPDATE SET occurred_at=EXCLUDED.occurred_at, source=EXCLUDED.source, record_json=EXCLUDED.record_json', [row.fact_id, row.occurred_at, row.source, row.record_json]);
}
async function deleteExistingRow(client, table, cols, row) {
  const candidates = {
    soil_moisture_sensing_window_index_v1: ['tenant_id', 'window_id'],
    water_state_estimate_index_v1: ['estimate_id'],
    water_response_verification_index_v1: ['verification_id'],
  }[table] || [];
  const keys = candidates.filter((key) => cols.has(key) && row[key] !== undefined && row[key] !== null);
  if (!keys.length) return;
  await client.query(`DELETE FROM ${table} WHERE ${keys.map((key, index) => `${key}=$${index + 1}`).join(' AND ')}`, keys.map((key) => row[key]));
}
async function insertRows(client, table, rows) {
  if (!(await tableExists(client, table))) return;
  const cols = await tableColumns(client, table);
  const required = await requiredColumns(client, table);
  for (const row of rows) {
    ensureRequiredRowColumns(table, row, required, cols);
    await deleteExistingRow(client, table, cols, row);
    const keys = Object.keys(row).filter((key) => cols.has(key));
    if (!keys.length) continue;
    const values = keys.map((key) => row[key]);
    await client.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, values);
  }
}
function closureRows(tenant) {
  const nowMs = Date.now();
  const executedEndMs = nowMs - 900000;
  const postEndMs = executedEndMs + 180000;
  const occurredAt = iso(postEndMs);
  const preStateFactId = factId(tenant, 'water_state_estimate_c8_pre_irrigation_001');
  const postWindowFactId = factId(tenant, 'soil_moisture_sensing_window_c8_post_irrigation_001');
  const postStateFactId = factId(tenant, 'water_state_estimate_c8_post_response_001');
  const responseFactId = factId(tenant, 'water_response_verification_c8_001');
  const acceptanceFactId = factId(tenant, 'acceptance_result_c8_irrigation_formal_001');
  const common = { tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, season_id: SEASON_ID };
  const preWaterStateIndex = { ...common, estimate_id: PRE_STATE_ID, source_fact_id: preStateFactId, state: 'LOW', classification: 'pre_irrigation', water_state: 'LOW', root_zone_soil_moisture_percent: 18.4, soil_moisture_value: 18.4, target_min_soil_moisture_percent: 22, target_max_soil_moisture_percent: 28, net_irrigation_mm: 22, gross_irrigation_requirement_mm: 22, input_refs_json: json({ mode: 'demo_pre_irrigation_state' }), evidence_refs_json: json(['telemetry_soil_before_001']), calculation_inputs_json: json({ root_zone_soil_moisture_percent: 18.4 }), derivation_json: json({ source: SOURCE, mode: 'demo_pre_irrigation_state' }), quality_json: json({ status: 'PASS' }), confidence_json: json({ level: 'HIGH', score: 0.93 }), confidence_level: 'HIGH', computed_at: iso(executedEndMs - 600000), created_at: iso(executedEndMs - 600000), updated_at: iso(executedEndMs - 600000), updated_ts_ms: executedEndMs - 600000, created_ts_ms: executedEndMs - 600000 };
  const postWindowPayload = { ...common, window_id: POST_WINDOW_ID, device_id: 'dev_soil_c8_001', metric: 'soil_moisture_percent', metric_role: 'post_irrigation_response', window_start: iso(executedEndMs + 60000), window_end: occurredAt, expected_interval_ms: 60000, expected_points: 3, actual_points: 3, min_total_samples_required: 3, min_samples_per_required_metric: 1, coverage_ratio: 1, min_coverage_ratio: 0.8, max_gap_ms: 60000, max_allowed_gap_ms: 120000, gap_count: 0, quality_status: 'PASS', confidence: { level: 'HIGH', score: 0.95 }, summary: { last_value: 24.8, mean_value: 24.7, root_zone_soil_moisture_percent: 24.8 }, evidence_refs: ['telemetry_soil_after_001', RECEIPT_ID, ACCEPTANCE_ID] };
  const postWindowIndex = { ...common, device_id: 'dev_soil_c8_001', metric: 'soil_moisture_percent', metric_role: 'post_irrigation_response', window_id: POST_WINDOW_ID, source_fact_id: postWindowFactId, window_start: postWindowPayload.window_start, window_end: postWindowPayload.window_end, expected_interval_ms: 60000, expected_points: 3, actual_points: 3, min_total_samples_required: 3, min_samples_per_required_metric: 1, coverage_ratio: 1, min_coverage_ratio: 0.8, max_gap_ms: 60000, max_allowed_gap_ms: 120000, gap_count: 0, quality_status: 'PASS', confidence_level: 'HIGH', confidence_json: json({ level: 'HIGH', score: 0.95 }), last_value: 24.8, root_zone_soil_moisture_percent: 24.8, soil_moisture_value: 24.8, summary_json: json(postWindowPayload.summary), config_snapshot_json: json({ source: SOURCE, expected_interval_ms: 60000, min_coverage_ratio: 0.8 }), evidence_refs_json: json(postWindowPayload.evidence_refs), source_fact_ids_json: json([postWindowFactId]), source_observation_ids_json: json(['telemetry_soil_after_001']), updated_ts_ms: postEndMs, created_ts_ms: postEndMs };
  const postWaterStateIndex = { ...common, estimate_id: POST_STATE_ID, source_fact_id: postStateFactId, state: 'NORMAL', classification: 'post_irrigation_response', water_state: 'NORMAL', root_zone_soil_moisture_percent: 24.8, soil_moisture_value: 24.8, target_min_soil_moisture_percent: 22, target_max_soil_moisture_percent: 28, net_irrigation_mm: 22, gross_irrigation_requirement_mm: 22, source_sensing_window_id: POST_WINDOW_ID, source_sensing_window_fact_id: postWindowFactId, input_refs_json: json({ sensing_window_id: POST_WINDOW_ID, pre_state_id: PRE_STATE_ID }), evidence_refs_json: json([POST_WINDOW_ID, RECEIPT_ID]), calculation_inputs_json: json({ before_soil_moisture: 18.4, after_soil_moisture: 24.8 }), derivation_json: json({ source: SOURCE, mode: 'demo_post_irrigation_response' }), quality_json: json({ status: 'PASS' }), confidence_json: json({ level: 'HIGH', score: 0.95 }), confidence_level: 'HIGH', computed_at: occurredAt, created_at: occurredAt, updated_at: occurredAt, updated_ts_ms: postEndMs, created_ts_ms: postEndMs };
  const forecastPayload = { ...common, forecast_id: FORECAST_ID, provider: 'DEMO', generated_at: iso(executedEndMs - 3600000), valid_from: iso(executedEndMs - 3600000), valid_to: iso(postEndMs + 72 * 3600000), horizon_hours: 72, rainfall_forecast_mm_72h: 0, et0_mm_72h: 12.4, quality: { status: 'PASS' } };
  const scenarioPayload = { ...common, scenario_set_id: SCENARIO_SET_ID, source_water_state_estimate_id: PRE_STATE_ID, options: [{ option_id: 'irr_22mm', irrigation_mm: 22, projected_soil_moisture_percent: 24.8 }], recommended_option_id: 'irr_22mm', evidence_refs: [PRE_STATE_ID, FORECAST_ID] };
  const recommendationPayload = { ...common, recommendation_id: RECOMMENDATION_ID, recommendation_status: 'RECOMMENDED', source_scenario_set_id: SCENARIO_SET_ID, selected_scenario_option_id: 'irr_22mm', suggested_action: { action_type: 'IRRIGATE', amount_mm: 22 }, evidence_refs: [SCENARIO_SET_ID] };
  const approvalRequestPayload = { ...common, approval_request_id: APPROVAL_REQUEST_ID, recommendation_id: RECOMMENDATION_ID, status: 'REQUESTED', evidence_refs: [RECOMMENDATION_ID] };
  const approvalDecisionPayload = { ...common, approval_decision_id: APPROVAL_DECISION_ID, approval_request_id: APPROVAL_REQUEST_ID, recommendation_id: RECOMMENDATION_ID, decision: 'APPROVED', status: 'APPROVED', evidence_refs: [APPROVAL_REQUEST_ID] };
  const operationPlanPayload = { ...common, operation_plan_id: OPERATION_ID, plan_id: OPERATION_ID, approval_decision_id: APPROVAL_DECISION_ID, recommendation_id: RECOMMENDATION_ID, status: 'READY', action_type: 'IRRIGATE', planned_amount_mm: 22, evidence_refs: [APPROVAL_DECISION_ID] };
  const transitionPayload = { ...common, transition_id: TRANSITION_ID, operation_plan_id: OPERATION_ID, from_state: 'APPROVED', to_state: 'READY', status: 'READY', evidence_refs: [OPERATION_ID] };
  const taskPayload = { ...common, act_task_id: TASK_ID, task_id: TASK_ID, operation_id: OPERATION_ID, operation_plan_id: OPERATION_ID, action_type: 'IRRIGATE', status: 'ISSUED', parameters: { amount_mm: 22 }, evidence_refs: [OPERATION_ID] };
  const receiptPayload = { ...common, receipt_id: RECEIPT_ID, act_task_id: TASK_ID, task_id: TASK_ID, operation_plan_id: OPERATION_ID, status: 'SUCCEEDED', result_status: 'CONFIRMED', executed_amount_mm: 21.6, observed_parameters: { amount: 21.6, unit: 'mm', before_soil_moisture: 18.4, after_soil_moisture: 24.8 }, evidence_refs: [TASK_ID] };
  const asExecutedPayload = { ...common, as_executed_id: AS_EXECUTED_ID, record_id: AS_EXECUTED_ID, operation_id: OPERATION_ID, operation_plan_id: OPERATION_ID, act_task_id: TASK_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID, action_type: 'IRRIGATION', status: 'CONFIRMED', planned_amount_mm: 22, executed_amount_mm: 21.6, unit: 'mm', completed_at: iso(executedEndMs), executed_at: iso(executedEndMs), metrics: { before_soil_moisture: 18.4, after_soil_moisture: 24.8, soil_moisture_delta: 6.4 }, evidence_refs: [RECEIPT_ID, EVIDENCE_ID] };
  const evidencePayload = { ...common, evidence_artifact_id: EVIDENCE_ID, evidence_id: EVIDENCE_ID, operation_plan_id: OPERATION_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID, as_executed_id: AS_EXECUTED_ID, status: 'RECORDED', evidence_kind: 'WATER_DELIVERY_CONFIRMATION', evidence_refs: [RECEIPT_ID, AS_EXECUTED_ID] };
  const acceptancePayload = { ...common, acceptance_id: ACCEPTANCE_ID, acceptance_result_id: ACCEPTANCE_ID, operation_plan_id: OPERATION_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID, as_executed_id: AS_EXECUTED_ID, evidence_artifact_id: EVIDENCE_ID, status: 'ACCEPTED', acceptance_status: 'ACCEPTED', evidence_refs: [EVIDENCE_ID, AS_EXECUTED_ID] };
  const responsePayload = { ...common, zone_id: ZONE_ID, verification_id: WATER_RESPONSE_ID, operation_id: OPERATION_ID, operation_plan_id: OPERATION_ID, act_task_id: TASK_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID, as_executed_id: AS_EXECUTED_ID, acceptance_id: ACCEPTANCE_ID, acceptance_result_fact_id: acceptanceFactId, pre_state_id: PRE_STATE_ID, post_state_id: POST_STATE_ID, response_verdict: 'RESPONSE_OBSERVED', class_transition: 'LOW_TO_NORMAL', status: 'RESPONSE_OBSERVED', verification_status: 'RESPONSE_OBSERVED', before_value: 18.4, after_value: 24.8, delta_value: 6.4, before_soil_moisture: 18.4, after_soil_moisture: 24.8, soil_moisture_delta: 6.4, available_water_fraction_delta: 0.24, weighted_matric_potential_kpa_delta: 18, blocking_reasons_json: json([]), evidence_refs_json: json([POST_WINDOW_ID, RECEIPT_ID, AS_EXECUTED_ID, ACCEPTANCE_ID]), source_fact_id: responseFactId, observed_at: occurredAt, computed_at: occurredAt, created_at: occurredAt, updated_at: occurredAt, field_memory_candidate: false, roi_candidate: false, write_ready: false, evidence_refs: [POST_WINDOW_ID, RECEIPT_ID, AS_EXECUTED_ID, ACCEPTANCE_ID] };
  return {
    facts: [
      fact(tenant, 'water_state_estimate_c8_pre_irrigation_001', 'water_state_estimate_v1', preWaterStateIndex, preWaterStateIndex.computed_at),
      fact(tenant, 'soil_moisture_sensing_window_c8_post_irrigation_001', 'soil_moisture_sensing_window_v1', postWindowPayload, occurredAt),
      fact(tenant, 'water_state_estimate_c8_post_response_001', 'water_state_estimate_v1', postWaterStateIndex, occurredAt),
      fact(tenant, 'weather_forecast_c8_irrigation_001', 'weather_forecast_fact_v1', forecastPayload, forecastPayload.generated_at),
      fact(tenant, 'irrigation_scenario_set_c8_001', 'irrigation_scenario_set_v1', scenarioPayload, occurredAt),
      fact(tenant, 'decision_recommendation_c8_001', 'decision_recommendation_v1', recommendationPayload, occurredAt),
      fact(tenant, 'approval_request_c8_001', 'approval_request_v1', approvalRequestPayload, occurredAt),
      fact(tenant, 'approval_decision_c8_001', 'approval_decision_v1', approvalDecisionPayload, occurredAt),
      fact(tenant, 'operation_plan_c8_irrigation_formal_001', 'operation_plan_v1', operationPlanPayload, occurredAt),
      fact(tenant, 'operation_plan_transition_c8_ready_001', 'operation_plan_transition_v1', transitionPayload, occurredAt),
      fact(tenant, 'ao_act_task_c8_irrigation_formal_001', 'ao_act_task_v0', taskPayload, occurredAt),
      fact(tenant, 'ao_act_receipt_c8_irrigation_formal_001', 'ao_act_receipt_v1', receiptPayload, occurredAt),
      fact(tenant, 'as_executed_c8_irrigation_formal_001', 'as_executed_record_v1', asExecutedPayload, occurredAt),
      fact(tenant, 'evidence_artifact_c8_irrigation_formal_001', 'evidence_artifact_v1', evidencePayload, occurredAt),
      fact(tenant, 'acceptance_result_c8_irrigation_formal_001', 'acceptance_result_v1', acceptancePayload, occurredAt),
      fact(tenant, 'water_response_verification_c8_001', 'water_response_verification_v1', responsePayload, occurredAt),
    ],
    indexes: {
      soil_moisture_sensing_window_index_v1: [postWindowIndex],
      water_state_estimate_index_v1: [preWaterStateIndex, postWaterStateIndex],
      water_response_verification_index_v1: [responsePayload],
    },
  };
}
async function main() {
  const tenant = arg('--tenant', 'tenantA');
  const dryRun = hasFlag('--dry-run');
  const rows = closureRows(tenant);
  const summary = { ok: true, seed: 'operator_twin_h31_h45_demo_closure_v1', tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, zone_id: ZONE_ID, season_id: SEASON_ID, base_seed: 'skipped_by_default', generated_facts: rows.facts.map((row) => JSON.parse(row.record_json).type), written_index_tables: Object.keys(rows.indexes), not_written: ['roi_ledger_v1', 'field_memory_v1', 'operation_state_v1', 'customer_delivery', 'projectReportV1', 'field_report'] };
  if (dryRun) return console.log(JSON.stringify(summary, null, 2));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try { await client.query('BEGIN'); await insertFacts(client, rows.facts); await insertRows(client, 'soil_moisture_sensing_window_index_v1', rows.indexes.soil_moisture_sensing_window_index_v1); await insertRows(client, 'water_state_estimate_index_v1', rows.indexes.water_state_estimate_index_v1); await insertRows(client, 'water_response_verification_index_v1', rows.indexes.water_response_verification_index_v1); await client.query('COMMIT'); } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; } finally { client.release(); await pool.end(); }
  console.log(JSON.stringify(summary, null, 2));
}
main().catch((error) => { console.error(error); if (error.detail) console.error(JSON.stringify(error.detail, null, 2)); process.exit(1); });
