#!/usr/bin/env node
const { randomUUID } = require('crypto');
const { Pool } = require('pg');

const BASE = String(process.env.GEOX_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const TENANT = process.env.TENANT_ID || process.env.GEOX_TENANT_ID || 'tenantA';
const PROJECT = process.env.PROJECT_ID || process.env.GEOX_PROJECT_ID || 'projectA';
const GROUP = process.env.GROUP_ID || process.env.GEOX_GROUP_ID || 'groupA';
const TOKEN = process.env.GEOX_ACCEPTANCE_TOKEN || process.env.ACCEPTANCE_TOKEN || process.env.AUTH_TOKEN || process.env.CUSTOMER_TOKEN || process.env.OPERATOR_TOKEN || process.env.ADMIN_TOKEN || '';
const RUN = `h30_no_cross_${randomUUID()}`;
const FIELD = `${RUN}_field`;
const SET = `${RUN}_scenario_set`;
const OPTION = 'irrigate_22mm';
const PLAN = `${RUN}_plan`;
const TASK = `${RUN}_task`;
const REC = `${RUN}_rec`;
const SUBMIT_OPERATOR = `${RUN}_operator`;
const IDEMPOTENCY_KEY = `${RUN}_submit`;

function assert(condition, message, detail) { if (!condition) throw new Error(message + (detail ? ` ${JSON.stringify(detail)}` : '')); }
function authHeaders(extra = {}) { return { accept: 'application/json', ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}), ...extra }; }
function factWhereClause() {
  return `source IN ('three_surface_no_cross_write_seed', 'operator_scenario_recommendation_submission_api')
    AND (
      fact_id LIKE $1
      OR record_json::jsonb #>> '{payload,field_id}' = $2
      OR record_json::jsonb #>> '{payload,scenario_set_id}' = $3
      OR record_json::jsonb #>> '{payload,idempotency_key}' = $4
      OR record_json::jsonb #>> '{payload,operator_id}' = $5
    )`;
}
function factParams() { return [`${RUN}%`, FIELD, SET, IDEMPOTENCY_KEY, SUBMIT_OPERATOR]; }
async function count(pool) { const q = await pool.query(`SELECT COUNT(*)::int count FROM facts WHERE ${factWhereClause()}`, factParams()); return Number(q.rows[0]?.count || 0); }
async function countType(pool, type) { const q = await pool.query(`SELECT COUNT(*)::int count FROM facts WHERE ${factWhereClause()} AND record_json::jsonb->>'type'=$6`, [...factParams(), type]); return Number(q.rows[0]?.count || 0); }
async function insertFact(pool, suffix, type, payload, offsetSeconds) {
  await pool.query(
    `INSERT INTO facts(fact_id, occurred_at, source, record_json)
       VALUES($1, NOW()+($2||' sec')::interval, $3, $4::jsonb)
       ON CONFLICT(fact_id) DO UPDATE SET record_json=EXCLUDED.record_json, source=EXCLUDED.source, occurred_at=EXCLUDED.occurred_at`,
    [`${RUN}_${suffix}`, String(offsetSeconds), 'three_surface_no_cross_write_seed', JSON.stringify({ type, schema_version: '1', payload })],
  );
}
async function seed(pool) {
  await pool.query(`INSERT INTO field_index_v1(tenant_id, field_id, name, area_ha, status, created_ts_ms, updated_ts_ms) VALUES($1,$2,'H30 No Cross Field',1,'ACTIVE',$3,$3) ON CONFLICT DO NOTHING`, [TENANT, FIELD, Date.now()]);
  await pool.query(
    `INSERT INTO irrigation_scenario_set_index_v1(scenario_set_id, tenant_id, project_id, group_id, field_id, season_id, baseline_water_state, baseline_soil_moisture_percent, target_min_soil_moisture_percent, target_max_soil_moisture_percent, net_irrigation_mm, gross_irrigation_requirement_mm, options_json, recommended_option_id, input_refs_json, evidence_refs_json, derivation_json, quality_json, confidence_json, source_fact_id, created_at, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,'MODERATE_DEFICIT',18,24,32,22,24,$7::jsonb,$8,'{}'::jsonb,'[]'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,$9,NOW(),NOW())
       ON CONFLICT(scenario_set_id) DO UPDATE SET options_json=EXCLUDED.options_json`,
    [SET, TENANT, PROJECT, GROUP, FIELD, `${RUN}_season`, JSON.stringify([{ option_id: 'no_action' }, { option_id: OPTION, amount_mm: 22 }]), OPTION, `${RUN}_fact`],
  );
  const base = { tenant_id: TENANT, project_id: PROJECT, group_id: GROUP, field_id: FIELD, recommendation_id: REC, operation_plan_id: PLAN, act_task_id: TASK };
  await insertFact(pool, 'rec', 'decision_recommendation_v1', { ...base, amount_mm: 22 }, 1);
  await insertFact(pool, 'plan', 'operation_plan_v1', base, 2);
  await insertFact(pool, 'task', 'ao_act_task_v0', base, 3);
  await insertFact(pool, 'receipt', 'ao_act_receipt_v1', { ...base, status: 'SUCCEEDED' }, 4);
  await insertFact(pool, 'accept', 'acceptance_result_v1', { ...base, verdict: 'PASS', formal: true }, 5);
}
async function cleanup(pool) {
  await pool.query(`DELETE FROM facts WHERE ${factWhereClause()}`, factParams()).catch(() => {});
  await pool.query('DELETE FROM irrigation_scenario_set_index_v1 WHERE scenario_set_id=$1', [SET]).catch(() => {});
  await pool.query('DELETE FROM field_index_v1 WHERE field_id=$1', [FIELD]).catch(() => {});
}
async function get(path) { const r = await fetch(BASE + path, { headers: authHeaders() }); const j = await r.json().catch(() => null); assert(r.ok, `GET failed ${path}`, { status: r.status, body: j }); return j; }
async function unchanged(pool, label, fn) { const before = await count(pool); await fn(); const after = await count(pool); assert(before === after, `${label} changed facts`, { before, after }); }
async function submitRecommendation() {
  const r = await fetch(`${BASE}/api/v1/operator/twin/fields/${FIELD}/scenarios/${SET}/options/${OPTION}/submit-recommendation`, { method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ tenant_id: TENANT, project_id: PROJECT, group_id: GROUP, operator_id: SUBMIT_OPERATOR, idempotency_key: IDEMPOTENCY_KEY }) });
  const body = await r.json().catch(() => null); assert(r.ok, 'submit failed', body); return body;
}
(async () => {
  assert(TOKEN, 'GEOX_ACCEPTANCE_TOKEN / ACCEPTANCE_TOKEN / AUTH_TOKEN required for protected runtime acceptance');
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  assert(connectionString, 'DATABASE_URL/POSTGRES_URL/PG_URL required');
  const pool = new Pool({ connectionString });
  try {
    await cleanup(pool); await seed(pool);
    const query = `tenant_id=${TENANT}&project_id=${PROJECT}&group_id=${GROUP}`;
    await unchanged(pool, 'customer confirmed summary', () => get(`/api/v1/customer/fields/${FIELD}/confirmed-twin-summary?${query}`));
    await unchanged(pool, 'customer operation report', () => get(`/api/v1/reports/operation/${PLAN}?${query}`));
    for (const path of ['/api/v1/admin/dashboard', '/api/v1/admin/operations', '/api/v1/admin/evidence']) await unchanged(pool, path, () => get(path));
    for (const path of ['forecast', 'scenarios', 'evidence', 'calibration', 'post-irrigation']) await unchanged(pool, `operator ${path}`, () => get(`/api/v1/operator/twin/fields/${FIELD}/${path}?${query}`));
    const before = { sub: await countType(pool, 'operator_scenario_recommendation_submission_v1'), rec: await countType(pool, 'decision_recommendation_v1'), approval: await countType(pool, 'approval_request_v1'), plan: await countType(pool, 'operation_plan_v1'), task: await countType(pool, 'ao_act_task_v0'), roi: await countType(pool, 'roi_ledger_v1'), memory: await countType(pool, 'field_memory_v1') };
    await submitRecommendation();
    const after = { sub: await countType(pool, 'operator_scenario_recommendation_submission_v1'), rec: await countType(pool, 'decision_recommendation_v1'), approval: await countType(pool, 'approval_request_v1'), plan: await countType(pool, 'operation_plan_v1'), task: await countType(pool, 'ao_act_task_v0'), roi: await countType(pool, 'roi_ledger_v1'), memory: await countType(pool, 'field_memory_v1') };
    assert(after.sub === before.sub + 1 && after.rec === before.rec + 1, 'submit must add only submission/recommendation', { before, after });
    for (const key of ['approval', 'plan', 'task', 'roi', 'memory']) assert(after[key] === before[key], `submit added forbidden ${key}`, { before, after });
    console.log('[three-surface-no-cross-write] PASS');
  } finally { await cleanup(pool); await pool.end(); }
})().catch((error) => { console.error('[three-surface-no-cross-write] FAIL'); console.error(error.stack || error); process.exit(1); });
