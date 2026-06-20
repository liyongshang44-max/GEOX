#!/usr/bin/env node
const { randomUUID } = require('crypto');
const { Pool } = require('pg');

const BASE = String(process.env.GEOX_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const TENANT = String(process.env.TENANT_ID || process.env.GEOX_TENANT_ID || 'tenantA');
const PROJECT = String(process.env.PROJECT_ID || process.env.GEOX_PROJECT_ID || 'projectA');
const GROUP = String(process.env.GROUP_ID || process.env.GEOX_GROUP_ID || 'groupA');
const RUN = `customer_confirmed_twin_${randomUUID()}`;
const FIELD = `${RUN}_field`;
const EMPTY_FIELD = `${RUN}_empty_field`;
const REC = `${RUN}_rec_current`;
const DECOY_REC = `${RUN}_rec_decoy`;
const APPROVAL = `${RUN}_approval_current`;
const DECOY_APPROVAL = `${RUN}_approval_decoy`;
const PLAN = `${RUN}_plan_current`;
const DECOY_PLAN = `${RUN}_plan_decoy`;

function assert(condition, message, detail) { if (!condition) throw new Error(message + (detail ? ` ${JSON.stringify(detail)}` : '')); }
async function tableExists(pool, table) { const r = await pool.query('SELECT to_regclass($1)::text AS name', [`public.${table}`]); return Boolean(r.rows[0]?.name); }
async function factCount(pool) { const r = await pool.query(`SELECT COUNT(*)::int AS count FROM facts WHERE source = $1 OR fact_id LIKE $2`, ['customer_confirmed_twin_summary_seed', `${RUN}%`]); return Number(r.rows[0]?.count || 0); }
async function insertFact(pool, suffix, type, payload, secondsOffset) {
  await pool.query(`INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW() + ($2 || ' seconds')::interval, $3, $4::jsonb) ON CONFLICT (fact_id) DO UPDATE SET occurred_at=EXCLUDED.occurred_at, source=EXCLUDED.source, record_json=EXCLUDED.record_json`, [`${RUN}_${suffix}`, String(secondsOffset), 'customer_confirmed_twin_summary_seed', JSON.stringify({ type, schema_version: '1', payload })]);
}
async function seed(pool) {
  const now = new Date().toISOString();
  for (const field of [FIELD, EMPTY_FIELD]) {
    await pool.query(`INSERT INTO field_index_v1 (tenant_id, field_id, name, area_ha, status, created_ts_ms, updated_ts_ms) VALUES ($1,$2,$3,$4,$5,$6,$6) ON CONFLICT DO NOTHING`, [TENANT, field, field, 1.2, 'ACTIVE', Date.now()]);
  }
  const base = { tenant_id: TENANT, project_id: PROJECT, group_id: GROUP, field_id: FIELD };
  await insertFact(pool, 'submission_decoy', 'operator_scenario_recommendation_submission_v1', { ...base, recommendation_id: DECOY_REC, recommendation_type: 'IRRIGATION', amount_mm: 99, submitted_at: now, evidence_refs: [`evidence:${RUN}:decoy`] }, -90);
  await insertFact(pool, 'recommendation_decoy', 'decision_recommendation_v1', { ...base, recommendation_id: DECOY_REC, recommendation_type: 'IRRIGATION', action_summary: 'Wrong chain irrigation', amount_mm: 99, human_approval_required: true, evidence_refs: [`evidence:${RUN}:decoy`] }, -80);
  await insertFact(pool, 'approval_decoy', 'approval_request_v1', { ...base, recommendation_id: DECOY_REC, approval_request_id: DECOY_APPROVAL, request_id: DECOY_APPROVAL, status: 'DECOY_APPROVAL_SHOULD_NOT_APPEAR' }, 80);
  await insertFact(pool, 'plan_decoy', 'operation_plan_v1', { ...base, recommendation_id: DECOY_REC, approval_request_id: DECOY_APPROVAL, operation_plan_id: DECOY_PLAN, status: 'DECOY_PLAN_SHOULD_NOT_APPEAR' }, 90);
  await insertFact(pool, 'task_decoy', 'ao_act_task_v0', { ...base, recommendation_id: DECOY_REC, operation_plan_id: DECOY_PLAN, act_task_id: `${RUN}_task_decoy`, status: 'DECOY_TASK_SHOULD_NOT_APPEAR' }, 100);
  await insertFact(pool, 'submission_current', 'operator_scenario_recommendation_submission_v1', { ...base, recommendation_id: REC, recommendation_type: 'IRRIGATION', amount_mm: 22, submitted_at: now, water_state: 'MODERATE_DEFICIT', primary_risk: 'WATER_DEFICIT', risk_level: 'MODERATE', evidence_refs: [`evidence:${RUN}:current_submission`] }, 10);
  await insertFact(pool, 'recommendation_current', 'decision_recommendation_v1', { ...base, recommendation_id: REC, recommendation_type: 'IRRIGATION', action_summary: 'Irrigation recommended', amount_mm: 22, human_approval_required: true, evidence_refs: [`evidence:${RUN}:current_rec`] }, 11);
  await insertFact(pool, 'evidence_current', 'operator_field_twin_evidence_quality_v1', { ...base, recommendation_id: REC, evidence_refs: [`evidence:${RUN}:current_rec`, `evidence:${RUN}:sensor`], quality_status: 'SUFFICIENT', missing_reasons: [] }, 12);
  await insertFact(pool, 'approval_current', 'approval_request_v1', { ...base, recommendation_id: REC, approval_request_id: APPROVAL, request_id: APPROVAL, status: 'CURRENT_APPROVAL_PENDING' }, 13);
  await insertFact(pool, 'plan_current', 'operation_plan_v1', { ...base, recommendation_id: REC, approval_request_id: APPROVAL, operation_plan_id: PLAN, status: 'CURRENT_PLAN_READY' }, 14);
  await insertFact(pool, 'task_current', 'ao_act_task_v0', { ...base, recommendation_id: REC, operation_plan_id: PLAN, act_task_id: `${RUN}_task_current`, status: 'CURRENT_TASK_READY' }, 15);
}
async function cleanup(pool) {
  await pool.query('DELETE FROM facts WHERE source=$1 OR fact_id LIKE $2', ['customer_confirmed_twin_summary_seed', `${RUN}%`]).catch(() => {});
  await pool.query('DELETE FROM field_index_v1 WHERE tenant_id=$1 AND field_id = ANY($2::text[])', [TENANT, [FIELD, EMPTY_FIELD]]).catch(() => {});
}
async function getSummary(field) {
  const q = new URLSearchParams({ tenant_id: TENANT, project_id: PROJECT, group_id: GROUP });
  const response = await fetch(`${BASE}/api/v1/customer/fields/${encodeURIComponent(field)}/confirmed-twin-summary?${q}`, { headers: { accept: 'application/json' } });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { throw new Error(`NON_JSON_RESPONSE ${response.status} ${text.slice(0, 300)}`); }
  assert(response.ok, 'HTTP failed', { status: response.status, body });
  return body;
}
async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  assert(connectionString, 'DATABASE_URL/POSTGRES_URL/PG_URL required for seeded runtime acceptance');
  const pool = new Pool({ connectionString });
  try {
    assert(await tableExists(pool, 'facts'), 'facts table required');
    assert(await tableExists(pool, 'field_index_v1'), 'field_index_v1 table required');
    await cleanup(pool);
    const before = await factCount(pool);
    await seed(pool);
    const afterSeed = await factCount(pool);
    assert(afterSeed > before, 'seed should add facts');
    const body = await getSummary(FIELD);
    const summary = body.customer_confirmed_twin_summary_v1;
    assert(summary?.summary_status === 'AVAILABLE', 'summary must be available', summary);
    assert(summary.recommendation_summary?.recommendation_id === REC, 'recommendation_id must be current chain', summary.recommendation_summary);
    assert(summary.recommendation_summary?.recommendation_type === 'IRRIGATION', 'recommendation_type');
    assert(summary.recommendation_summary?.amount_mm === 22, 'amount_mm must be current chain', summary.recommendation_summary);
    assert(summary.recommendation_summary?.human_approval_required === true, 'human approval required');
    assert(summary.recommendation_summary?.approval_status === 'CURRENT_APPROVAL_PENDING', 'approval status must be linked current chain', summary.recommendation_summary);
    assert(summary.recommendation_summary?.operation_plan_status === 'CURRENT_PLAN_READY', 'plan status must be linked current chain', summary.recommendation_summary);
    assert(summary.recommendation_summary?.task_status === 'CURRENT_TASK_READY', 'task status must be linked current chain', summary.recommendation_summary);
    assert(summary.evidence_summary?.evidence_count > 0, 'evidence_count > 0', summary.evidence_summary);
    const text = JSON.stringify(body);
    for (const token of ['DECOY_APPROVAL_SHOULD_NOT_APPEAR', 'DECOY_PLAN_SHOULD_NOT_APPEAR', 'DECOY_TASK_SHOULD_NOT_APPEAR', 'scenario options', 'forecast raw timeline']) assert(!text.includes(token), `forbidden or crossed-chain token ${token}`);
    assert(await factCount(pool) === afterSeed, 'GET must not create facts');
    const empty = (await getSummary(EMPTY_FIELD)).customer_confirmed_twin_summary_v1;
    assert(empty?.summary_status === 'NOT_AVAILABLE', 'empty summary must not be available', empty);
    assert(empty?.reason === 'NO_CONFIRMED_OPERATOR_RECOMMENDATION', 'empty reason mismatch', empty);
    console.log('[customer-confirmed-twin-summary-seeded] PASS');
  } finally { await cleanup(pool); await pool.end(); }
}
main().catch((error) => { console.error('[customer-confirmed-twin-summary-seeded] FAIL'); console.error(error && error.stack ? error.stack : error); process.exit(1); });
