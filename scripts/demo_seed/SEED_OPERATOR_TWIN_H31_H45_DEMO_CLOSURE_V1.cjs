#!/usr/bin/env node
'use strict';

// scripts/demo_seed/SEED_OPERATOR_TWIN_H31_H45_DEMO_CLOSURE_V1.cjs
// Purpose: seed the Operator Twin H31-H45 demo closure rows directly against the declared demo read-model schema.
// Boundary: this seed excludes ROI, Field Memory, operation_state, reports, and customer delivery rows.

const { Pool } = require('pg');

const PROJECT_ID = 'projectA';
const GROUP_ID = 'groupA';
const FIELD_ID = 'field_c8_demo';
const ZONE_ID = 'zone_c8_root_zone_001';
const SEASON_ID = 'season_2026_c8_corn';
const PRE_STATE_ID = 'wstate_c8_irrigation_001';
const OPERATION_ID = 'op_plan_c8_irrigation_formal_001';
const TASK_ID = 'act_c8_irrigation_formal_001';
const RECEIPT_ID = 'receipt_c8_irrigation_formal_001';
const ACCEPTANCE_ID = 'acc_c8_irrigation_formal_001';
const AS_EXECUTED_ID = 'as_executed_c8_irrigation_formal_001';
const WATER_RESPONSE_ID = 'wrv_c8_irrigation_formal_001';
const SOURCE = 'scripts/demo_seed/operator_twin_h31_h45_demo_closure_v1';

function arg(name, fallback) { const i = process.argv.indexOf(name); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; }
function hasFlag(name) { return process.argv.includes(name); }
function iso(ms) { return new Date(ms).toISOString(); }
function prefix(tenant) { return `full_review_seed_${tenant}`; }
function factId(tenant, suffix) { return `${prefix(tenant)}_${suffix}`; }
function toJson(value) { return JSON.stringify(value); }
function fact(tenant, suffix, type, payload, occurredAt) {
  return { fact_id: factId(tenant, suffix), occurred_at: occurredAt, source: SOURCE, record_json: toJson({ type, payload: { tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, ...payload } }) };
}
async function requiredColumns(client, table) {
  const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_nullable='NO' AND column_default IS NULL ORDER BY ordinal_position", [table]);
  return result.rows.map((row) => String(row.column_name));
}
function assertRequired(table, row, required) {
  const missing = required.filter((column) => row[column] === undefined || row[column] === null);
  if (!missing.length) return;
  const error = new Error('SEED_ROW_MISSING_REQUIRED_COLUMNS');
  error.detail = { table, missing, row_id: row.verification_id || row.estimate_id || row.window_id || null };
  throw error;
}
async function insertFacts(client, rows) {
  for (const row of rows) await client.query('INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb) ON CONFLICT (fact_id) DO UPDATE SET occurred_at=EXCLUDED.occurred_at, source=EXCLUDED.source, record_json=EXCLUDED.record_json', [row.fact_id, row.occurred_at, row.source, row.record_json]);
}
async function insertSensingWindow(client, row) {
  assertRequired('soil_moisture_sensing_window_index_v1', row, await requiredColumns(client, 'soil_moisture_sensing_window_index_v1'));
  await client.query(`INSERT INTO soil_moisture_sensing_window_index_v1 (window_id,tenant_id,project_id,group_id,field_id,device_id,metric,window_start,window_end,expected_interval_ms,expected_points,actual_points,min_total_samples_required,min_samples_per_required_metric,coverage_ratio,min_coverage_ratio,max_gap_ms,max_allowed_gap_ms,gap_count,quality_status,confidence_json,summary_json,config_snapshot_json,evidence_refs_json,source_fact_ids_json,source_observation_ids_json,source_fact_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22::jsonb,$23::jsonb,$24::jsonb,$25::jsonb,$26::jsonb,$27,$28,$29) ON CONFLICT (tenant_id,window_id) DO UPDATE SET project_id=EXCLUDED.project_id,group_id=EXCLUDED.group_id,field_id=EXCLUDED.field_id,device_id=EXCLUDED.device_id,metric=EXCLUDED.metric,window_start=EXCLUDED.window_start,window_end=EXCLUDED.window_end,expected_interval_ms=EXCLUDED.expected_interval_ms,expected_points=EXCLUDED.expected_points,actual_points=EXCLUDED.actual_points,min_total_samples_required=EXCLUDED.min_total_samples_required,min_samples_per_required_metric=EXCLUDED.min_samples_per_required_metric,coverage_ratio=EXCLUDED.coverage_ratio,min_coverage_ratio=EXCLUDED.min_coverage_ratio,max_gap_ms=EXCLUDED.max_gap_ms,max_allowed_gap_ms=EXCLUDED.max_allowed_gap_ms,gap_count=EXCLUDED.gap_count,quality_status=EXCLUDED.quality_status,confidence_json=EXCLUDED.confidence_json,summary_json=EXCLUDED.summary_json,config_snapshot_json=EXCLUDED.config_snapshot_json,evidence_refs_json=EXCLUDED.evidence_refs_json,source_fact_ids_json=EXCLUDED.source_fact_ids_json,source_observation_ids_json=EXCLUDED.source_observation_ids_json,source_fact_id=EXCLUDED.source_fact_id,updated_at=EXCLUDED.updated_at`, [row.window_id,row.tenant_id,row.project_id,row.group_id,row.field_id,row.device_id,row.metric,row.window_start,row.window_end,row.expected_interval_ms,row.expected_points,row.actual_points,row.min_total_samples_required,row.min_samples_per_required_metric,row.coverage_ratio,row.min_coverage_ratio,row.max_gap_ms,row.max_allowed_gap_ms,row.gap_count,row.quality_status,row.confidence_json,row.summary_json,row.config_snapshot_json,row.evidence_refs_json,row.source_fact_ids_json,row.source_observation_ids_json,row.source_fact_id,row.created_at,row.updated_at]);
}
async function insertWaterState(client, row) {
  assertRequired('water_state_estimate_index_v1', row, await requiredColumns(client, 'water_state_estimate_index_v1'));
  await client.query(`INSERT INTO water_state_estimate_index_v1 (estimate_id,tenant_id,project_id,group_id,field_id,season_id,state,root_zone_soil_moisture_percent,target_min_soil_moisture_percent,target_max_soil_moisture_percent,net_irrigation_mm,gross_irrigation_requirement_mm,source_sensing_window_id,source_sensing_window_fact_id,input_refs_json,evidence_refs_json,calculation_inputs_json,derivation_json,quality_json,confidence_json,source_fact_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20::jsonb,$21,$22,$23) ON CONFLICT (estimate_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,project_id=EXCLUDED.project_id,group_id=EXCLUDED.group_id,field_id=EXCLUDED.field_id,season_id=EXCLUDED.season_id,state=EXCLUDED.state,root_zone_soil_moisture_percent=EXCLUDED.root_zone_soil_moisture_percent,target_min_soil_moisture_percent=EXCLUDED.target_min_soil_moisture_percent,target_max_soil_moisture_percent=EXCLUDED.target_max_soil_moisture_percent,net_irrigation_mm=EXCLUDED.net_irrigation_mm,gross_irrigation_requirement_mm=EXCLUDED.gross_irrigation_requirement_mm,source_sensing_window_id=EXCLUDED.source_sensing_window_id,source_sensing_window_fact_id=EXCLUDED.source_sensing_window_fact_id,input_refs_json=EXCLUDED.input_refs_json,evidence_refs_json=EXCLUDED.evidence_refs_json,calculation_inputs_json=EXCLUDED.calculation_inputs_json,derivation_json=EXCLUDED.derivation_json,quality_json=EXCLUDED.quality_json,confidence_json=EXCLUDED.confidence_json,source_fact_id=EXCLUDED.source_fact_id,updated_at=EXCLUDED.updated_at`, [row.estimate_id,row.tenant_id,row.project_id,row.group_id,row.field_id,row.season_id,row.state,row.root_zone_soil_moisture_percent,row.target_min_soil_moisture_percent,row.target_max_soil_moisture_percent,row.net_irrigation_mm,row.gross_irrigation_requirement_mm,row.source_sensing_window_id,row.source_sensing_window_fact_id,row.input_refs_json,row.evidence_refs_json,row.calculation_inputs_json,row.derivation_json,row.quality_json,row.confidence_json,row.source_fact_id,row.created_at,row.updated_at]);
}
async function insertWaterResponse(client, row) {
  assertRequired('water_response_verification_index_v1', row, await requiredColumns(client, 'water_response_verification_index_v1'));
  await client.query(`INSERT INTO water_response_verification_index_v1 (verification_id,tenant_id,project_id,group_id,field_id,zone_id,acceptance_id,acceptance_result_fact_id,as_executed_id,task_id,receipt_id,operation_plan_id,pre_state_id,post_state_id,response_verdict,available_water_fraction_delta,weighted_matric_potential_kpa_delta,class_transition,blocking_reasons_json,evidence_refs_json,source_fact_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,$21,$22,$23) ON CONFLICT (verification_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,project_id=EXCLUDED.project_id,group_id=EXCLUDED.group_id,field_id=EXCLUDED.field_id,zone_id=EXCLUDED.zone_id,acceptance_id=EXCLUDED.acceptance_id,acceptance_result_fact_id=EXCLUDED.acceptance_result_fact_id,as_executed_id=EXCLUDED.as_executed_id,task_id=EXCLUDED.task_id,receipt_id=EXCLUDED.receipt_id,operation_plan_id=EXCLUDED.operation_plan_id,pre_state_id=EXCLUDED.pre_state_id,post_state_id=EXCLUDED.post_state_id,response_verdict=EXCLUDED.response_verdict,available_water_fraction_delta=EXCLUDED.available_water_fraction_delta,weighted_matric_potential_kpa_delta=EXCLUDED.weighted_matric_potential_kpa_delta,class_transition=EXCLUDED.class_transition,blocking_reasons_json=EXCLUDED.blocking_reasons_json,evidence_refs_json=EXCLUDED.evidence_refs_json,source_fact_id=EXCLUDED.source_fact_id,updated_at=EXCLUDED.updated_at`, [row.verification_id,row.tenant_id,row.project_id,row.group_id,row.field_id,row.zone_id,row.acceptance_id,row.acceptance_result_fact_id,row.as_executed_id,row.task_id,row.receipt_id,row.operation_plan_id,row.pre_state_id,row.post_state_id,row.response_verdict,row.available_water_fraction_delta,row.weighted_matric_potential_kpa_delta,row.class_transition,row.blocking_reasons_json,row.evidence_refs_json,row.source_fact_id,row.created_at,row.updated_at]);
}
function closureRows(tenant) {
  const nowMs = Date.now();
  const executedEndMs = nowMs - 900000;
  const postEndMs = executedEndMs + 180000;
  const occurredAt = iso(postEndMs);
  const common = { tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, season_id: SEASON_ID };
  const windowFactId = factId(tenant, 'soil_moisture_sensing_window_c8_post_irrigation_001');
  const waterStateFactId = factId(tenant, 'water_state_estimate_c8_post_response_001');
  const acceptanceFactId = factId(tenant, 'acceptance_result_c8_irrigation_formal_001');
  const waterResponseFactId = factId(tenant, 'water_response_verification_c8_001');
  const postWindowId = 'sw_c8_soil_moisture_post_irrigation_001';
  const postWaterStateId = 'wstate_c8_irrigation_post_response_001';
  const evidenceRefs = [postWindowId, RECEIPT_ID, AS_EXECUTED_ID, ACCEPTANCE_ID];
  const postWindowPayload = { ...common, window_id: postWindowId, device_id: 'dev_soil_c8_001', metric: 'soil_moisture_percent', metric_role: 'post_irrigation_response', window_start: iso(executedEndMs + 60000), window_end: occurredAt, expected_interval_ms: 60000, expected_points: 3, actual_points: 3, min_total_samples_required: 3, min_samples_per_required_metric: 1, coverage_ratio: 1, min_coverage_ratio: 0.8, max_gap_ms: 60000, max_allowed_gap_ms: 120000, gap_count: 0, quality_status: 'PASS', confidence: { level: 'HIGH', score: 0.95 }, summary: { last_value: 24.8, mean_value: 24.7, root_zone_soil_moisture_percent: 24.8 }, evidence_refs: ['telemetry_soil_after_001', RECEIPT_ID, ACCEPTANCE_ID] };
  const postWindowIndex = { ...common, device_id: 'dev_soil_c8_001', metric: 'soil_moisture_percent', window_id: postWindowId, source_fact_id: windowFactId, window_start: postWindowPayload.window_start, window_end: postWindowPayload.window_end, expected_interval_ms: 60000, expected_points: 3, actual_points: 3, min_total_samples_required: 3, min_samples_per_required_metric: 1, coverage_ratio: 1, min_coverage_ratio: 0.8, max_gap_ms: 60000, max_allowed_gap_ms: 120000, gap_count: 0, quality_status: 'PASS', confidence_json: toJson({ level: 'HIGH', score: 0.95 }), summary_json: toJson(postWindowPayload.summary), config_snapshot_json: toJson({ source: SOURCE, expected_interval_ms: 60000, min_coverage_ratio: 0.8 }), evidence_refs_json: toJson(postWindowPayload.evidence_refs), source_fact_ids_json: toJson([windowFactId]), source_observation_ids_json: toJson(['telemetry_soil_after_001']), created_at: occurredAt, updated_at: occurredAt };
  const postWaterStateIndex = { ...common, estimate_id: postWaterStateId, source_fact_id: waterStateFactId, state: 'NORMAL', root_zone_soil_moisture_percent: 24.8, target_min_soil_moisture_percent: 22, target_max_soil_moisture_percent: 28, net_irrigation_mm: 0, gross_irrigation_requirement_mm: 0, source_sensing_window_id: postWindowId, source_sensing_window_fact_id: windowFactId, input_refs_json: toJson({ sensing_window_id: postWindowId, pre_state_id: PRE_STATE_ID }), evidence_refs_json: toJson([postWindowId]), calculation_inputs_json: toJson({ before_soil_moisture: 18.4, after_soil_moisture: 24.8 }), derivation_json: toJson({ source: SOURCE, mode: 'demo_post_irrigation_response' }), quality_json: toJson({ status: 'PASS' }), confidence_json: toJson({ level: 'HIGH', score: 0.95 }), created_at: occurredAt, updated_at: occurredAt };
  const asExecutedPayload = { ...common, zone_id: ZONE_ID, as_executed_id: AS_EXECUTED_ID, record_id: AS_EXECUTED_ID, operation_id: OPERATION_ID, operation_plan_id: OPERATION_ID, act_task_id: TASK_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID, action_type: 'IRRIGATION', status: 'CONFIRMED', planned_amount_mm: 22, executed_amount_mm: 21.6, unit: 'mm', completed_at: iso(executedEndMs), executed_at: iso(executedEndMs), metrics: { before_soil_moisture: 18.4, after_soil_moisture: 24.8, soil_moisture_delta: 6.4 }, evidence_refs: [RECEIPT_ID, 'ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'] };
  const evidencePayload = { ...common, zone_id: ZONE_ID, evidence_artifact_id: 'ev_c8_irrigation_response_001', artifact_id: 'ev_c8_irrigation_response_001', operation_id: OPERATION_ID, operation_plan_id: OPERATION_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID, as_executed_id: AS_EXECUTED_ID, artifact_type: 'POST_IRRIGATION_RESPONSE', status: 'AVAILABLE', evidence_refs: [postWindowId, AS_EXECUTED_ID] };
  const acceptancePayload = { ...common, zone_id: ZONE_ID, acceptance_id: ACCEPTANCE_ID, acceptance_result_id: ACCEPTANCE_ID, operation_id: OPERATION_ID, operation_plan_id: OPERATION_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID, as_executed_id: AS_EXECUTED_ID, status: 'ACCEPTED', acceptance_status: 'ACCEPTED', accepted: true, evidence_artifact_ids: ['ev_c8_irrigation_response_001'], evidence_refs: [postWindowId, AS_EXECUTED_ID] };
  const responsePayload = { ...common, zone_id: ZONE_ID, verification_id: WATER_RESPONSE_ID, operation_id: OPERATION_ID, operation_plan_id: OPERATION_ID, act_task_id: TASK_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID, as_executed_id: AS_EXECUTED_ID, acceptance_id: ACCEPTANCE_ID, acceptance_result_fact_id: acceptanceFactId, pre_state_id: PRE_STATE_ID, post_state_id: postWaterStateId, status: 'RESPONSE_OBSERVED', verification_status: 'RESPONSE_OBSERVED', response_verdict: 'RESPONSE_OBSERVED', class_transition: 'DRY_TO_NORMAL', before_value: 18.4, after_value: 24.8, delta_value: 6.4, before_soil_moisture: 18.4, after_soil_moisture: 24.8, soil_moisture_delta: 6.4, available_water_fraction_delta: 0.064, weighted_matric_potential_kpa_delta: 18.2, blocking_reasons_json: toJson([]), observed_at: occurredAt, computed_at: occurredAt, field_memory_candidate: false, roi_candidate: false, write_ready: false, evidence_refs: evidenceRefs, evidence_refs_json: toJson(evidenceRefs), source_fact_id: waterResponseFactId, created_at: occurredAt, updated_at: occurredAt };
  return { facts: [fact(tenant, 'soil_moisture_sensing_window_c8_post_irrigation_001', 'soil_moisture_sensing_window_v1', postWindowPayload, occurredAt), fact(tenant, 'water_state_estimate_c8_post_response_001', 'water_state_estimate_v1', postWaterStateIndex, occurredAt), fact(tenant, 'as_executed_c8_irrigation_formal_001', 'as_executed_record_v1', asExecutedPayload, occurredAt), fact(tenant, 'evidence_artifact_c8_irrigation_formal_001', 'evidence_artifact_v1', evidencePayload, occurredAt), fact(tenant, 'acceptance_result_c8_irrigation_formal_001', 'acceptance_result_v1', acceptancePayload, occurredAt), fact(tenant, 'water_response_verification_c8_001', 'water_response_verification_v1', responsePayload, occurredAt)], indexes: { soil_moisture_sensing_window_index_v1: [postWindowIndex], water_state_estimate_index_v1: [postWaterStateIndex], water_response_verification_index_v1: [responsePayload] } };
}
async function main() {
  const tenant = arg('--tenant', 'tenantA');
  const dryRun = hasFlag('--dry-run');
  const rows = closureRows(tenant);
  const summary = { ok: true, seed: 'operator_twin_h31_h45_demo_closure_v1', tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, zone_id: ZONE_ID, season_id: SEASON_ID, base_seed: 'skipped_by_default', generated_facts: rows.facts.map((row) => JSON.parse(row.record_json).type), written_index_tables: Object.keys(rows.indexes), schema_preflight: 'enabled', not_written: ['roi_ledger_v1', 'field_memory_v1', 'operation_state_v1', 'customer_delivery', 'projectReportV1', 'field_report'] };
  if (dryRun) return console.log(JSON.stringify(summary, null, 2));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try { await client.query('BEGIN'); await insertFacts(client, rows.facts); for (const row of rows.indexes.soil_moisture_sensing_window_index_v1) await insertSensingWindow(client, row); for (const row of rows.indexes.water_state_estimate_index_v1) await insertWaterState(client, row); for (const row of rows.indexes.water_response_verification_index_v1) await insertWaterResponse(client, row); await client.query('COMMIT'); } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; } finally { client.release(); await pool.end(); }
  console.log(JSON.stringify(summary, null, 2));
}
main().catch((error) => { console.error(error); if (error.detail) console.error(JSON.stringify(error.detail, null, 2)); process.exit(1); });
