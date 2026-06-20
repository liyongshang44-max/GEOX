#!/usr/bin/env node
const { randomUUID } = require('crypto');
const { Pool } = require('pg');
const BASE = String(process.env.GEOX_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const TENANT = String(process.env.TENANT_ID || process.env.GEOX_TENANT_ID || 'tenantA');
const PROJECT = String(process.env.PROJECT_ID || process.env.GEOX_PROJECT_ID || 'projectA');
const GROUP = String(process.env.GROUP_ID || process.env.GEOX_GROUP_ID || 'groupA');
const FIELD = String(process.env.GEOX_FIELD_ID || process.env.FIELD_ID || `h27_field_${randomUUID()}`);
const factIds = [];
const windowIds = [];
function assert(condition, message, detail) { if (!condition) throw new Error(message + (detail ? ' ' + JSON.stringify(detail) : '')); }
function record(type, payload) { return { type, payload: { tenant_id: TENANT, project_id: PROJECT, group_id: GROUP, field_id: FIELD, ...payload } }; }
async function tableExists(pool, table) { const r = await pool.query('SELECT to_regclass($1)::text AS name', ['public.' + table]); return Boolean(r.rows[0]?.name); }
async function insertFact(pool, type, payload) { const factId = `h27_post_irrigation_${type}_${randomUUID()}`; factIds.push(factId); await pool.query('INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2, $3, $4::jsonb)', [factId, payload.occurred_at || new Date().toISOString(), 'acceptance/operator-field-twin-post-irrigation-seeded', record(type, payload)]); return factId; }
async function insertWindow(pool, label, value, startedAt, endedAt) {
  const windowId = `h27_${label}_${randomUUID()}`;
  windowIds.push(windowId);
  await pool.query(`INSERT INTO soil_moisture_sensing_window_index_v1 (
    window_id, tenant_id, project_id, group_id, field_id, device_id, metric,
    window_start, window_end, expected_interval_ms, expected_points, actual_points,
    min_total_samples_required, min_samples_per_required_metric, coverage_ratio, min_coverage_ratio,
    max_gap_ms, max_allowed_gap_ms, gap_count, quality_status, confidence_json, summary_json,
    config_snapshot_json, evidence_refs_json, source_fact_ids_json, source_observation_ids_json, source_fact_id,
    created_at, updated_at
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22::jsonb,$23::jsonb,$24::jsonb,$25::jsonb,$26::jsonb,$27,$28,$29)`, [
    windowId, TENANT, PROJECT, GROUP, FIELD, 'h27_device_soil_001', `soil_moisture_percent_${label}`,
    startedAt, endedAt, 900000, 8, 8, 4, 4, 1, 0.7, 0, 1800000, 0, 'PASS',
    JSON.stringify({ confidence: 'HIGH' }), JSON.stringify({ last_value: value, mean_value: value }), JSON.stringify({ post_irrigation_phase: label }),
    JSON.stringify([`evidence:${windowId}`]), JSON.stringify([]), JSON.stringify([]), `fact:${windowId}`, startedAt, endedAt,
  ]);
  return windowId;
}
async function fetchJson(path) { const r = await fetch(BASE + path, { headers: { accept: 'application/json' } }); const text = await r.text(); let body; try { body = JSON.parse(text); } catch { throw new Error('NON_JSON_RESPONSE ' + text.slice(0, 300)); } assert(r.ok, 'HTTP failed', { status: r.status, body }); return body; }
async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  assert(connectionString, 'DATABASE_URL/POSTGRES_URL/PG_URL required for seeded runtime acceptance');
  const pool = new Pool({ connectionString });
  try {
    assert(await tableExists(pool, 'facts'), 'facts table required');
    assert(await tableExists(pool, 'soil_moisture_sensing_window_index_v1'), 'soil_moisture_sensing_window_index_v1 table required');
    const base = Date.now();
    const preStart = new Date(base - 6 * 60 * 60 * 1000).toISOString();
    const preEnd = new Date(base - 5 * 60 * 60 * 1000).toISOString();
    const executedAt = new Date(base - 3 * 60 * 60 * 1000).toISOString();
    const postStart = new Date(base - 2 * 60 * 60 * 1000).toISOString();
    const postEnd = new Date(base - 1 * 60 * 60 * 1000).toISOString();
    await insertWindow(pool, 'pre', 18.4, preStart, preEnd);
    await insertWindow(pool, 'post_irrigation', 21.2, postStart, postEnd);
    await insertFact(pool, 'operation_plan_v1', { operation_plan_id: 'h27_plan_positive', operation_end_at: executedAt, occurred_at: executedAt });
    await insertFact(pool, 'ao_act_receipt_v1', { receipt_id: 'h27_receipt_positive', operation_plan_id: 'h27_plan_positive', executed_at: executedAt, amount_mm: 22, occurred_at: executedAt });
    await insertFact(pool, 'as_executed_record_v1', { as_executed_id: 'h27_as_executed_positive', receipt_id: 'h27_receipt_positive', completed_at: executedAt, amount_mm: 22, occurred_at: executedAt });
    const p = new URLSearchParams({ tenant_id: TENANT, project_id: PROJECT, group_id: GROUP });
    const body = await fetchJson(`/api/v1/operator/twin/fields/${encodeURIComponent(FIELD)}/post-irrigation?${p}`);
    assert(body.memoryWriteReady === false, 'memoryWriteReady must remain false');
    assert(body.roiWriteReady === false, 'roiWriteReady must remain false');
    const q = body.operator_field_twin_post_irrigation_verification_v1;
    assert(q, 'missing projection');
    assert(q.post_irrigation_state_v1?.available === true, 'post observation must be available', q.post_irrigation_state_v1);
    assert(q.execution_evidence_v1?.receipt_available === true, 'receipt_available must be true', q.execution_evidence_v1);
    assert(q.execution_evidence_v1?.as_executed_available === true, 'as_executed_available must be true', q.execution_evidence_v1);
    assert(q.response_delta_v1?.delta_direction === 'INCREASED' || q.response_delta_v1?.status === 'RESPONSE_OBSERVED', 'expected positive response', q.response_delta_v1);
    assert(!(q.verification_gaps || []).some((gap) => gap.gap_code === 'POST_IRRIGATION_OBSERVATION_NOT_AVAILABLE'), 'post observation gap must be absent', q.verification_gaps);
    console.log('[operator-field-twin-post-irrigation-seeded] PASS');
  } finally {
    if (windowIds.length) await pool.query('DELETE FROM soil_moisture_sensing_window_index_v1 WHERE tenant_id=$1 AND window_id = ANY($2::text[])', [TENANT, windowIds]).catch(() => {});
    if (factIds.length) await pool.query('DELETE FROM facts WHERE fact_id = ANY($1::text[])', [factIds]).catch(() => {});
    await pool.end().catch(() => {});
  }
}
main().catch((error) => { console.error('[operator-field-twin-post-irrigation-seeded] FAIL'); console.error(error && error.stack ? error.stack : error); process.exit(1); });
