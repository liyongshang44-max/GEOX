#!/usr/bin/env node
'use strict';

// scripts/demo_seed/SEED_OPERATOR_TWIN_H31_H45_DEMO_CLOSURE_V1.cjs
// Purpose: seed the Operator Twin H31-H45 demo closure rows directly.
// Boundary: this seed excludes ROI, Field Memory, operation_state, reports, and customer delivery rows.

const { Pool } = require('pg');

const PROJECT_ID = 'projectA';
const GROUP_ID = 'groupA';
const FIELD_ID = 'field_c8_demo';
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
function json(value) { return JSON.stringify(value); }
function fact(tenant, suffix, type, payload, occurredAt) {
  return { fact_id: `${prefix(tenant)}_${suffix}`, occurred_at: occurredAt, source: SOURCE, record_json: json({ type, payload: { tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, ...payload } }) };
}
async function tableExists(client, table) { const r = await client.query('SELECT to_regclass($1)::text AS name', [`public.${table}`]); return Boolean(r.rows[0]?.name); }
async function tableColumns(client, table) { const r = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table]); return new Set(r.rows.map((x) => String(x.column_name))); }
async function insertFacts(client, rows) {
  for (const row of rows) await client.query('INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb) ON CONFLICT (fact_id) DO UPDATE SET occurred_at=EXCLUDED.occurred_at, source=EXCLUDED.source, record_json=EXCLUDED.record_json', [row.fact_id, row.occurred_at, row.source, row.record_json]);
}
async function deleteExistingRow(client, table, cols, row) {
  const candidates = {
    soil_moisture_sensing_window_index_v1: ['tenant_id', 'window_id'],
    water_state_estimate_index_v1: cols.has('estimate_id') ? ['tenant_id', 'project_id', 'group_id', 'field_id', 'estimate_id'] : ['tenant_id', 'project_id', 'group_id', 'field_id'],
    water_response_verification_index_v1: cols.has('verification_id') ? ['tenant_id', 'project_id', 'group_id', 'field_id', 'verification_id'] : ['tenant_id', 'project_id', 'group_id', 'field_id'],
  }[table] || [];
  const keys = candidates.filter((key) => cols.has(key) && row[key] !== undefined);
  if (!keys.length) return;
  await client.query(`DELETE FROM ${table} WHERE ${keys.map((key, index) => `${key}=$${index + 1}`).join(' AND ')}`, keys.map((key) => row[key]));
}
async function insertRows(client, table, rows) {
  if (!(await tableExists(client, table))) return;
  const cols = await tableColumns(client, table);
  for (const row of rows) {
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
  const common = { tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID };
  const windowFactId = `${prefix(tenant)}_soil_moisture_sensing_window_c8_post_irrigation_001`;
  const waterStateFactId = `${prefix(tenant)}_water_state_estimate_c8_post_response_001`;
  const postWindowId = 'sw_c8_soil_moisture_post_irrigation_001';
  const postWaterStateId = 'wstate_c8_irrigation_post_response_001';
  const postWindowPayload = { ...common, window_id: postWindowId, device_id: 'dev_soil_c8_001', metric: 'soil_moisture_percent', metric_role: 'post_irrigation_response', window_start: iso(executedEndMs + 60000), window_end: occurredAt, expected_interval_ms: 60000, expected_points: 3, actual_points: 3, min_total_samples_required: 3, min_samples_per_required_metric: 1, coverage_ratio: 1, min_coverage_ratio: 0.8, max_gap_ms: 60000, max_allowed_gap_ms: 120000, gap_count: 0, quality_status: 'PASS', confidence: { level: 'HIGH', score: 0.95 }, summary: { last_value: 24.8, mean_value: 24.7, root_zone_soil_moisture_percent: 24.8 }, evidence_refs: ['telemetry_soil_after_001', RECEIPT_ID, ACCEPTANCE_ID] };
  const postWindowIndex = { ...common, device_id: 'dev_soil_c8_001', metric: 'soil_moisture_percent', metric_role: 'post_irrigation_response', window_id: postWindowId, source_fact_id: windowFactId, window_start: postWindowPayload.window_start, window_end: postWindowPayload.window_end, expected_interval_ms: 60000, expected_points: 3, actual_points: 3, min_total_samples_required: 3, min_samples_per_required_metric: 1, coverage_ratio: 1, min_coverage_ratio: 0.8, max_gap_ms: 60000, max_allowed_gap_ms: 120000, gap_count: 0, quality_status: 'PASS', confidence_level: 'HIGH', confidence_json: json({ level: 'HIGH', score: 0.95 }), last_value: 24.8, root_zone_soil_moisture_percent: 24.8, soil_moisture_value: 24.8, summary_json: json(postWindowPayload.summary), config_snapshot_json: json({ source: SOURCE, expected_interval_ms: 60000, min_coverage_ratio: 0.8 }), evidence_refs_json: json(postWindowPayload.evidence_refs), source_fact_ids_json: json([windowFactId]), source_observation_ids_json: json(['telemetry_soil_after_001']), updated_ts_ms: postEndMs, created_ts_ms: postEndMs };
  const postWaterStateIndex = { ...common, estimate_id: postWaterStateId, source_fact_id: waterStateFactId, state: 'NORMAL', classification: 'post_irrigation_response', water_state: 'NORMAL', root_zone_soil_moisture_percent: 24.8, soil_moisture_value: 24.8, target_min_soil_moisture_percent: 22, target_max_soil_moisture_percent: 28, confidence_level: 'HIGH', computed_at: occurredAt, updated_ts_ms: postEndMs, created_ts_ms: postEndMs };
  const asExecutedPayload = { ...common, as_executed_id: AS_EXECUTED_ID, record_id: AS_EXECUTED_ID, operation_id: OPERATION_ID, operation_plan_id: OPERATION_ID, act_task_id: TASK_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID, action_type: 'IRRIGATION', status: 'CONFIRMED', planned_amount_mm: 22, executed_amount_mm: 21.6, unit: 'mm', completed_at: iso(executedEndMs), executed_at: iso(executedEndMs), metrics: { before_soil_moisture: 18.4, after_soil_moisture: 24.8, soil_moisture_delta: 6.4 }, evidence_refs: [RECEIPT_ID, 'ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'] };
  const responsePayload = { ...common, verification_id: WATER_RESPONSE_ID, operation_id: OPERATION_ID, operation_plan_id: OPERATION_ID, act_task_id: TASK_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID, as_executed_id: AS_EXECUTED_ID, acceptance_id: ACCEPTANCE_ID, status: 'RESPONSE_OBSERVED', verification_status: 'RESPONSE_OBSERVED', before_value: 18.4, after_value: 24.8, delta_value: 6.4, before_soil_moisture: 18.4, after_soil_moisture: 24.8, soil_moisture_delta: 6.4, observed_at: occurredAt, computed_at: occurredAt, field_memory_candidate: false, roi_candidate: false, write_ready: false, evidence_refs: [postWindowId, RECEIPT_ID, AS_EXECUTED_ID, ACCEPTANCE_ID] };
  return { facts: [fact(tenant, 'soil_moisture_sensing_window_c8_post_irrigation_001', 'soil_moisture_sensing_window_v1', postWindowPayload, occurredAt), fact(tenant, 'water_state_estimate_c8_post_response_001', 'water_state_estimate_v1', postWaterStateIndex, occurredAt), fact(tenant, 'as_executed_c8_irrigation_formal_001', 'as_executed_record_v1', asExecutedPayload, occurredAt), fact(tenant, 'water_response_verification_c8_001', 'water_response_verification_v1', responsePayload, occurredAt)], indexes: { soil_moisture_sensing_window_index_v1: [postWindowIndex], water_state_estimate_index_v1: [postWaterStateIndex], water_response_verification_index_v1: [{ ...common, ...responsePayload, updated_ts_ms: postEndMs, created_ts_ms: postEndMs }] } };
}
async function main() {
  const tenant = arg('--tenant', 'tenantA');
  const dryRun = hasFlag('--dry-run');
  const rows = closureRows(tenant);
  const summary = { ok: true, seed: 'operator_twin_h31_h45_demo_closure_v1', tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, base_seed: 'skipped_by_default', generated_facts: rows.facts.map((row) => JSON.parse(row.record_json).type), written_index_tables: Object.keys(rows.indexes), not_written: ['roi_ledger_v1', 'field_memory_v1', 'operation_state_v1', 'customer_delivery', 'projectReportV1', 'field_report'] };
  if (dryRun) return console.log(JSON.stringify(summary, null, 2));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try { await client.query('BEGIN'); await insertFacts(client, rows.facts); await insertRows(client, 'soil_moisture_sensing_window_index_v1', rows.indexes.soil_moisture_sensing_window_index_v1); await insertRows(client, 'water_state_estimate_index_v1', rows.indexes.water_state_estimate_index_v1); await insertRows(client, 'water_response_verification_index_v1', rows.indexes.water_response_verification_index_v1); await client.query('COMMIT'); } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; } finally { client.release(); await pool.end(); }
  console.log(JSON.stringify(summary, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
