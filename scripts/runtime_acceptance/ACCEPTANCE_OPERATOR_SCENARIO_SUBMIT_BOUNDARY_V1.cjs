#!/usr/bin/env node
const { randomUUID } = require('crypto');
const { Pool } = require('pg');

const BASE = String(process.env.GEOX_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const TENANT = String(process.env.TENANT_ID || process.env.GEOX_TENANT_ID || 'tenantA');
const PROJECT = String(process.env.PROJECT_ID || process.env.GEOX_PROJECT_ID || 'projectA');
const GROUP = String(process.env.GROUP_ID || process.env.GEOX_GROUP_ID || 'groupA');
const RUN = `h28_boundary_${randomUUID()}`;
const FIELD = `${RUN}_field`;
const SCENARIO_SET = `${RUN}_scenario_set`;
const OPTION = 'irrigate_22mm';
const IDEMPOTENCY_KEY = `${RUN}_idempotency`;
const ALLOWED_TYPES = new Set(['operator_scenario_recommendation_submission_v1', 'decision_recommendation_v1']);
const FORBIDDEN_TYPES = new Set(['approval_request_v1', 'approval_decision_v1', 'operation_plan_v1', 'operation_plan_transition_v1', 'ao_act_task_v0', 'ao_act_receipt_v1', 'as_executed_record_v1', 'acceptance_result_v1', 'roi_ledger_v1', 'field_memory_v1']);

function assert(condition, message, detail) {
  if (!condition) throw new Error(message + (detail ? ` ${JSON.stringify(detail)}` : ''));
}
async function tableExists(pool, table) {
  const r = await pool.query('SELECT to_regclass($1)::text AS name', [`public.${table}`]);
  return Boolean(r.rows[0]?.name);
}
async function seedField(pool) {
  await pool.query(`INSERT INTO field_index_v1 (tenant_id, field_id, name, area_ha, status, created_ts_ms, updated_ts_ms)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT DO NOTHING`, [TENANT, FIELD, 'H28 Boundary Field', 1.2, 'ACTIVE', Date.now(), Date.now()]);
}
async function seedScenario(pool) {
  const now = new Date().toISOString();
  const options = [
    { option_id: 'no_action', label: 'No action', risk_delta: 'baseline', confidence_text: 'HIGH', evidence_refs: [`evidence:${RUN}:baseline`] },
    { option_id: OPTION, label: 'Irrigate 22mm', risk_delta: 'LOWER_DEFICIT_RISK', confidence_text: 'HIGH', failure_conditions: [], evidence_refs: [`evidence:${RUN}:option`] },
  ];
  await pool.query(`INSERT INTO irrigation_scenario_set_index_v1 (
    scenario_set_id, tenant_id, project_id, group_id, field_id, season_id,
    baseline_water_state, baseline_soil_moisture_percent, target_min_soil_moisture_percent,
    target_max_soil_moisture_percent, net_irrigation_mm, gross_irrigation_requirement_mm,
    options_json, recommended_option_id, input_refs_json, evidence_refs_json, derivation_json,
    quality_json, confidence_json, source_fact_id, created_at, updated_at
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20,$21,$21)
  ON CONFLICT (scenario_set_id) DO UPDATE SET options_json=EXCLUDED.options_json, evidence_refs_json=EXCLUDED.evidence_refs_json, quality_json=EXCLUDED.quality_json, updated_at=EXCLUDED.updated_at`, [
    SCENARIO_SET, TENANT, PROJECT, GROUP, FIELD, `${RUN}_season`, 'MODERATE_DEFICIT', 18, 24, 32, 22, 24,
    JSON.stringify(options), OPTION, JSON.stringify({ acceptance: 'H28_BOUNDARY' }), JSON.stringify([`evidence:${RUN}:set`]),
    JSON.stringify({ source: 'runtime_acceptance' }), JSON.stringify({ status: 'PASS' }), JSON.stringify({ level: 'HIGH', score: 0.95 }), `fact:${RUN}:scenario`, now,
  ]);
}
async function postSubmit() {
  const url = `${BASE}/api/v1/operator/twin/fields/${encodeURIComponent(FIELD)}/scenarios/${encodeURIComponent(SCENARIO_SET)}/options/${encodeURIComponent(OPTION)}/submit-recommendation`;
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ tenant_id: TENANT, project_id: PROJECT, group_id: GROUP, operator_id: 'operator_h28_runtime', submission_reason: 'H28 runtime boundary acceptance', idempotency_key: IDEMPOTENCY_KEY }) });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { throw new Error(`NON_JSON_RESPONSE ${response.status} ${text.slice(0, 300)}`); }
  assert(response.ok, 'submit HTTP must succeed', { status: response.status, body });
  return body;
}
async function queryCreatedFactTypes(pool) {
  const r = await pool.query(`SELECT fact_id, record_json::jsonb AS record_json
    FROM facts
    WHERE source = 'operator_scenario_recommendation_submission_api'
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,field_id}') = $2
      AND (record_json::jsonb#>>'{payload,scenario_set_id}') = $3
    ORDER BY occurred_at ASC, fact_id ASC`, [TENANT, FIELD, SCENARIO_SET]);
  return r.rows.map((row) => ({ fact_id: row.fact_id, type: String(row.record_json?.type || ''), payload: row.record_json?.payload || {} }));
}
async function cleanup(pool) {
  await pool.query(`DELETE FROM facts WHERE source = 'operator_scenario_recommendation_submission_api' AND (record_json::jsonb#>>'{payload,tenant_id}')=$1 AND (record_json::jsonb#>>'{payload,field_id}')=$2 AND (record_json::jsonb#>>'{payload,scenario_set_id}')=$3`, [TENANT, FIELD, SCENARIO_SET]).catch(() => {});
  await pool.query('DELETE FROM irrigation_scenario_set_index_v1 WHERE tenant_id=$1 AND scenario_set_id=$2', [TENANT, SCENARIO_SET]).catch(() => {});
  await pool.query('DELETE FROM field_index_v1 WHERE tenant_id=$1 AND field_id=$2', [TENANT, FIELD]).catch(() => {});
}
async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  assert(connectionString, 'DATABASE_URL/POSTGRES_URL/PG_URL required for runtime acceptance');
  const pool = new Pool({ connectionString });
  try {
    assert(await tableExists(pool, 'facts'), 'facts table required');
    assert(await tableExists(pool, 'field_index_v1'), 'field_index_v1 table required');
    assert(await tableExists(pool, 'irrigation_scenario_set_index_v1'), 'irrigation_scenario_set_index_v1 table required');
    await seedField(pool);
    await seedScenario(pool);

    const first = await postSubmit();
    const submission = first.operator_scenario_recommendation_submission_v1;
    assert(first.ok === true, 'response.ok must be true', first);
    assert(submission, 'missing submission envelope', first);
    assert(submission.status === 'SUBMITTED_TO_RECOMMENDATION', 'status must be submitted', submission);
    assert(typeof submission.recommendation_id === 'string' && submission.recommendation_id.length > 4, 'recommendation_id required', submission);
    for (const key of ['approval_created', 'operation_plan_created', 'task_created', 'dispatch_created']) assert(submission[key] === false, `${key} must be false`, submission);

    const afterFirst = await queryCreatedFactTypes(pool);
    assert(afterFirst.length === 2, 'first submit must create exactly two facts', afterFirst);
    for (const fact of afterFirst) assert(ALLOWED_TYPES.has(fact.type), 'created fact type must be allowed', fact);
    for (const bad of FORBIDDEN_TYPES) assert(!afterFirst.some((fact) => fact.type === bad), `forbidden fact type created: ${bad}`, afterFirst);
    assert(afterFirst.some((fact) => fact.type === 'operator_scenario_recommendation_submission_v1'), 'submission fact missing', afterFirst);
    assert(afterFirst.some((fact) => fact.type === 'decision_recommendation_v1'), 'decision recommendation fact missing', afterFirst);

    const duplicate = await postSubmit();
    assert(duplicate.operator_scenario_recommendation_submission_v1?.status === 'REJECTED_DUPLICATE', 'duplicate idempotency key must return REJECTED_DUPLICATE', duplicate);
    const afterDuplicate = await queryCreatedFactTypes(pool);
    assert(afterDuplicate.length === afterFirst.length, 'duplicate submit must not create extra facts', { afterFirst, afterDuplicate });
    console.log('[operator-scenario-submit-boundary] PASS');
  } finally {
    await cleanup(pool).catch(() => {});
    await pool.end().catch(() => {});
  }
}
main().catch((error) => { console.error('[operator-scenario-submit-boundary] FAIL'); console.error(error && error.stack ? error.stack : error); process.exit(1); });
