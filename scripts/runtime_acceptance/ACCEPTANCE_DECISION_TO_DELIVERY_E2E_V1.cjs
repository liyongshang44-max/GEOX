#!/usr/bin/env node
const { randomUUID } = require('crypto');
const { Pool } = require('pg');

const BASE = String(process.env.GEOX_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const TENANT = process.env.TENANT_ID || process.env.GEOX_TENANT_ID || 'tenantA';
const PROJECT = process.env.PROJECT_ID || process.env.GEOX_PROJECT_ID || 'projectA';
const GROUP = process.env.GROUP_ID || process.env.GEOX_GROUP_ID || 'groupA';
const TOKEN = process.env.GEOX_ACCEPTANCE_TOKEN || process.env.ACCEPTANCE_TOKEN || process.env.AUTH_TOKEN || process.env.CUSTOMER_TOKEN || process.env.OPERATOR_TOKEN || process.env.ADMIN_TOKEN || '';
const RUN = `h30_${randomUUID()}`;
const FIELD = `${RUN}_field`;
const SET = `${RUN}_scenario_set`;
const OPTION = 'irrigate_22mm';
const REC = `${RUN}_rec_seed`;
const APPROVAL = `${RUN}_approval`;
const PLAN = `${RUN}_plan`;
const TASK = `${RUN}_task`;
const RECEIPT = `${RUN}_receipt`;
const SUBMIT_OPERATOR = `${RUN}_operator`;
const IDEMPOTENCY_KEY = `${RUN}_submit`;

function assert(condition, message, detail) { if (!condition) throw new Error(message + (detail ? ` ${JSON.stringify(detail)}` : '')); }
function authHeaders(extra = {}) { return { accept: 'application/json', ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}), ...extra }; }
async function table(pool, tableName) { const q = await pool.query('SELECT to_regclass($1)::text name', [`public.${tableName}`]); return Boolean(q.rows[0]?.name); }
function factWhereClause() {
  return `source IN ('decision_to_delivery_e2e_seed', 'operator_scenario_recommendation_submission_api')
    AND (
      fact_id LIKE $1
      OR record_json::jsonb #>> '{payload,field_id}' = $2
      OR record_json::jsonb #>> '{payload,scenario_set_id}' = $3
      OR record_json::jsonb #>> '{payload,idempotency_key}' = $4
      OR record_json::jsonb #>> '{payload,operator_id}' = $5
    )`;
}
function factParams() { return [`${RUN}%`, FIELD, SET, IDEMPOTENCY_KEY, SUBMIT_OPERATOR]; }
async function factCount(pool) { const q = await pool.query(`SELECT COUNT(*)::int count FROM facts WHERE ${factWhereClause()}`, factParams()); return Number(q.rows[0]?.count || 0); }
async function insertFact(pool, suffix, type, payload, offsetSeconds) {
  await pool.query(
    `INSERT INTO facts(fact_id, occurred_at, source, record_json)
       VALUES($1, NOW() + ($2 || ' seconds')::interval, $3, $4::jsonb)
       ON CONFLICT(fact_id) DO UPDATE SET occurred_at=EXCLUDED.occurred_at, source=EXCLUDED.source, record_json=EXCLUDED.record_json`,
    [`${RUN}_${suffix}`, String(offsetSeconds), 'decision_to_delivery_e2e_seed', JSON.stringify({ type, schema_version: '1', payload })],
  );
}
async function seed(pool) {
  const now = new Date().toISOString();
  await pool.query(`INSERT INTO field_index_v1(tenant_id, field_id, name, area_ha, status, created_ts_ms, updated_ts_ms) VALUES($1,$2,$3,1.2,'ACTIVE',$4,$4) ON CONFLICT DO NOTHING`, [TENANT, FIELD, 'H30 Three Surface Field', Date.now()]);
  const scope = { tenant_id: TENANT, project_id: PROJECT, group_id: GROUP, field_id: FIELD, season_id: `${RUN}_season` };
  await pool.query(
    `INSERT INTO irrigation_scenario_set_index_v1(scenario_set_id, tenant_id, project_id, group_id, field_id, season_id, baseline_water_state, baseline_soil_moisture_percent, target_min_soil_moisture_percent, target_max_soil_moisture_percent, net_irrigation_mm, gross_irrigation_requirement_mm, options_json, recommended_option_id, input_refs_json, evidence_refs_json, derivation_json, quality_json, confidence_json, source_fact_id, created_at, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,'MODERATE_DEFICIT',18,24,32,22,24,$7::jsonb,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$15)
       ON CONFLICT (scenario_set_id) DO UPDATE SET options_json=EXCLUDED.options_json, updated_at=EXCLUDED.updated_at`,
    [SET, TENANT, PROJECT, GROUP, FIELD, scope.season_id, JSON.stringify([{ option_id: 'no_action', label: 'No action', risk_delta: 'baseline' }, { option_id: OPTION, label: 'Irrigate 22mm', amount_mm: 22, risk_delta: 'LOWER_DEFICIT_RISK' }]), OPTION, JSON.stringify({}), JSON.stringify([`${RUN}_ev`]), JSON.stringify({ source: 'seed' }), JSON.stringify({ status: 'PASS' }), JSON.stringify({ level: 'HIGH' }), `${RUN}_scenario_fact`, now],
  );
  await insertFact(pool, 'workspace', 'operator_field_twin_workspace_v1', { ...scope, status: 'ACTIVE', water_state: 'MODERATE_DEFICIT' }, 1);
  await insertFact(pool, 'evidence_quality', 'operator_field_twin_evidence_quality_v1', { ...scope, quality_status: 'SUFFICIENT', evidence_refs: [`${RUN}_ev`] }, 2);
  await insertFact(pool, 'submission_seed', 'operator_scenario_recommendation_submission_v1', { ...scope, scenario_set_id: SET, option_id: OPTION, recommendation_id: REC, amount_mm: 22, submitted_at: now }, 3);
  await insertFact(pool, 'rec_seed', 'decision_recommendation_v1', { ...scope, recommendation_id: REC, recommendation_type: 'IRRIGATION', action_summary: 'Irrigate 22mm', amount_mm: 22, human_approval_required: true, evidence_refs: [`${RUN}_ev`] }, 4);
  await insertFact(pool, 'approval', 'approval_request_v1', { ...scope, recommendation_id: REC, request_id: APPROVAL, approval_request_id: APPROVAL, status: 'APPROVED' }, 5);
  await insertFact(pool, 'approval_decision', 'approval_decision_v1', { ...scope, recommendation_id: REC, request_id: APPROVAL, decision_id: `${RUN}_decision`, decision: 'APPROVED' }, 6);
  await insertFact(pool, 'plan', 'operation_plan_v1', { ...scope, recommendation_id: REC, approval_request_id: APPROVAL, operation_plan_id: PLAN, act_task_id: TASK, action_type: 'IRRIGATION', status: 'READY' }, 7);
  await insertFact(pool, 'task', 'ao_act_task_v0', { ...scope, recommendation_id: REC, operation_plan_id: PLAN, act_task_id: TASK, status: 'DISPATCHED', action_type: 'IRRIGATION' }, 8);
  await insertFact(pool, 'receipt', 'ao_act_receipt_v1', { ...scope, operation_plan_id: PLAN, act_task_id: TASK, receipt_id: RECEIPT, status: 'SUCCEEDED', logs_refs: [`${RUN}_log`], metrics: [{ key: 'applied_mm', value: 22 }] }, 9);
  await insertFact(pool, 'as_executed', 'as_executed_record_v1', { ...scope, operation_plan_id: PLAN, act_task_id: TASK, receipt_id: RECEIPT, applied_mm: 22 }, 10);
  await insertFact(pool, 'artifact', 'evidence_artifact_v1', { ...scope, operation_plan_id: PLAN, act_task_id: TASK, kind: 'field_photo', uri: `s3://acceptance/${RUN}` }, 11);
  await insertFact(pool, 'acceptance', 'acceptance_result_v1', { ...scope, operation_plan_id: PLAN, act_task_id: TASK, acceptance_id: `${RUN}_acceptance`, verdict: 'PASS', missing_evidence: [], formal: true }, 12);
  await insertFact(pool, 'roi', 'roi_ledger_v1', { ...scope, operation_id: PLAN, recommendation_id: REC, water_saved_mm: 2 }, 13);
  if (await table(pool, 'field_memory_v1')) {
    await pool.query(`INSERT INTO field_memory_v1(memory_id, tenant_id, project_id, group_id, field_id, operation_id, recommendation_id, memory_type, memory_lane, trust_level, customer_visible_memory, learning_eligible, summary_text, evidence_refs, occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,'FIELD_RESPONSE_MEMORY','ACCEPTED','HIGH',true,false,'H30 field response memory',$8::jsonb,NOW()) ON CONFLICT DO NOTHING`, [`${RUN}_memory`, TENANT, PROJECT, GROUP, FIELD, PLAN, REC, JSON.stringify([`${RUN}_ev`])]).catch(() => {});
  }
}
async function cleanup(pool) {
  await pool.query(`DELETE FROM facts WHERE ${factWhereClause()}`, factParams()).catch(() => {});
  await pool.query('DELETE FROM field_index_v1 WHERE tenant_id=$1 AND field_id=$2', [TENANT, FIELD]).catch(() => {});
  await pool.query('DELETE FROM irrigation_scenario_set_index_v1 WHERE scenario_set_id=$1', [SET]).catch(() => {});
  await pool.query('DELETE FROM field_memory_v1 WHERE memory_id=$1', [`${RUN}_memory`]).catch(() => {});
}
async function get(path) { const r = await fetch(BASE + path, { headers: authHeaders() }); const j = await r.json().catch(() => null); assert(r.ok, `HTTP failed ${path}`, { status: r.status, body: j }); return j; }
async function postSubmit() {
  const r = await fetch(`${BASE}/api/v1/operator/twin/fields/${FIELD}/scenarios/${SET}/options/${OPTION}/submit-recommendation`, { method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ tenant_id: TENANT, project_id: PROJECT, group_id: GROUP, operator_id: SUBMIT_OPERATOR, idempotency_key: IDEMPOTENCY_KEY }) });
  const j = await r.json().catch(() => null); assert(r.ok, 'submit failed', j); return j;
}
(async () => {
  assert(TOKEN, 'GEOX_ACCEPTANCE_TOKEN / ACCEPTANCE_TOKEN / AUTH_TOKEN required for protected runtime acceptance');
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  assert(connectionString, 'DATABASE_URL/POSTGRES_URL/PG_URL required');
  const pool = new Pool({ connectionString });
  try {
    assert(await table(pool, 'facts'), 'facts table required');
    await cleanup(pool); await seed(pool);
    const before = await factCount(pool);
    const twin = await get(`/api/v1/operator/twin/fields/${FIELD}?tenant_id=${TENANT}&project_id=${PROJECT}&group_id=${GROUP}`);
    assert(twin.source === 'operator_field_twin_workspace_api' && twin.dataScope === 'OFFICIAL_OPERATOR_TWIN_API', 'operator twin envelope', twin);
    const scenarios = await get(`/api/v1/operator/twin/fields/${FIELD}/scenarios?tenant_id=${TENANT}&project_id=${PROJECT}&group_id=${GROUP}`);
    assert(JSON.stringify(scenarios).includes('no_action'), 'no_action baseline missing');
    const submit = await postSubmit();
    assert(submit.operator_scenario_recommendation_submission_v1?.approval_created === false && submit.operator_scenario_recommendation_submission_v1?.operation_plan_created === false && submit.operator_scenario_recommendation_submission_v1?.task_created === false, 'submit crossed write boundary', submit);
    const afterSubmit = await factCount(pool);
    assert(afterSubmit === before + 2, 'submit must add exactly two recommendation facts', { before, afterSubmit });
    const summary = await get(`/api/v1/customer/fields/${FIELD}/confirmed-twin-summary?tenant_id=${TENANT}&project_id=${PROJECT}&group_id=${GROUP}`);
    assert(summary.surface === 'CUSTOMER' && summary.dataScope === 'OFFICIAL_CUSTOMER_DELIVERY_PORTAL', 'customer summary envelope', summary);
    assert(JSON.stringify(summary).includes(REC) || JSON.stringify(summary).includes('recommendation'), 'summary cannot read recommendation');
    assert(!JSON.stringify(summary).includes('options_json') && !JSON.stringify(summary).includes(OPTION), 'customer summary leaked scenario options');
    const report = await get(`/api/v1/reports/operation/${PLAN}?tenant_id=${TENANT}&project_id=${PROJECT}&group_id=${GROUP}`);
    assert(JSON.stringify(report).includes(PLAN) && JSON.stringify(report).includes(TASK), 'operation report chain missing');
    const operations = await get('/api/v1/admin/operations'); assert(operations.surface === 'ADMIN' && operations.writeReady === false, 'admin operations read boundary', operations);
    const evidence = await get('/api/v1/admin/evidence'); assert(evidence.surface === 'ADMIN' && evidence.writeReady === false, 'admin evidence read boundary', evidence);
    const dashboard = await get('/api/v1/admin/dashboard'); assert(dashboard.surface === 'ADMIN' && dashboard.dataScope === 'INTERNAL_ADMIN_CONTROL_PLANE', 'admin dashboard envelope', dashboard);
    assert(await factCount(pool) === afterSubmit, 'customer/admin GET must not write facts');
    console.log('[decision-to-delivery-e2e] PASS');
  } finally { await cleanup(pool); await pool.end(); }
})().catch((error) => { console.error('[decision-to-delivery-e2e] FAIL'); console.error(error.stack || error); process.exit(1); });
