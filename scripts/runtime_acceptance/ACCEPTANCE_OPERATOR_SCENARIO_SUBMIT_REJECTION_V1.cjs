#!/usr/bin/env node
const { randomUUID } = require('crypto');
const { Pool } = require('pg');

const BASE = String(process.env.GEOX_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const TENANT = String(process.env.TENANT_ID || process.env.GEOX_TENANT_ID || 'tenantA');
const PROJECT = String(process.env.PROJECT_ID || process.env.GEOX_PROJECT_ID || 'projectA');
const GROUP = String(process.env.GROUP_ID || process.env.GEOX_GROUP_ID || 'groupA');
const RUN = `h28_rejection_${randomUUID()}`;
const FIELD = `${RUN}_field`;
const GOOD_SCENARIO_SET = `${RUN}_scenario_good`;
const BLOCKING_SCENARIO_SET = `${RUN}_scenario_blocking`;

function assert(condition, message, detail) { if (!condition) throw new Error(message + (detail ? ` ${JSON.stringify(detail)}` : '')); }
async function tableExists(pool, table) { const r = await pool.query('SELECT to_regclass($1)::text AS name', [`public.${table}`]); return Boolean(r.rows[0]?.name); }
async function seedField(pool) {
  await pool.query(`INSERT INTO field_index_v1 (tenant_id, field_id, name, area_ha, status, created_ts_ms, updated_ts_ms)
    VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [TENANT, FIELD, 'H28 Rejection Field', 1.4, 'ACTIVE', Date.now(), Date.now()]);
}
async function seedScenario(pool, scenarioSetId, qualityStatus) {
  const now = new Date().toISOString();
  const options = [
    { option_id: 'no_action', label: 'No action', risk_delta: 'baseline', confidence_text: 'HIGH', evidence_refs: [`evidence:${scenarioSetId}:baseline`] },
    { option_id: 'irrigate_22mm', label: 'Irrigate 22mm', risk_delta: 'LOWER_DEFICIT_RISK', confidence_text: 'HIGH', failure_conditions: [], evidence_refs: [`evidence:${scenarioSetId}:option`] },
  ];
  await pool.query(`INSERT INTO irrigation_scenario_set_index_v1 (
    scenario_set_id, tenant_id, project_id, group_id, field_id, season_id,
    baseline_water_state, baseline_soil_moisture_percent, target_min_soil_moisture_percent,
    target_max_soil_moisture_percent, net_irrigation_mm, gross_irrigation_requirement_mm,
    options_json, recommended_option_id, input_refs_json, evidence_refs_json, derivation_json,
    quality_json, confidence_json, source_fact_id, created_at, updated_at
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20,$21,$21)
  ON CONFLICT (scenario_set_id) DO UPDATE SET options_json=EXCLUDED.options_json, evidence_refs_json=EXCLUDED.evidence_refs_json, quality_json=EXCLUDED.quality_json, updated_at=EXCLUDED.updated_at`, [
    scenarioSetId, TENANT, PROJECT, GROUP, FIELD, `${RUN}_season`, 'MODERATE_DEFICIT', 18, 24, 32, 22, 24,
    JSON.stringify(options), 'irrigate_22mm', JSON.stringify({ acceptance: 'H28_REJECTION' }), JSON.stringify([`evidence:${scenarioSetId}:set`]),
    JSON.stringify({ source: 'runtime_acceptance', evidence_quality: qualityStatus }), JSON.stringify({ status: qualityStatus }), JSON.stringify({ level: 'HIGH', score: 0.95 }), `fact:${scenarioSetId}`, now,
  ]);
}
async function postScenario({ scenarioSetId = GOOD_SCENARIO_SET, optionId = 'irrigate_22mm', tenant = TENANT, project = PROJECT, group = GROUP, reason = 'H28 rejection acceptance' }) {
  const url = `${BASE}/api/v1/operator/twin/fields/${encodeURIComponent(FIELD)}/scenarios/${encodeURIComponent(scenarioSetId)}/options/${encodeURIComponent(optionId)}/submit-recommendation`;
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ tenant_id: tenant, project_id: project, group_id: group, operator_id: 'operator_h28_runtime', submission_reason: reason, idempotency_key: `${RUN}:${scenarioSetId}:${optionId}:${tenant}:${project}:${group}:${randomUUID()}` }) });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { throw new Error(`NON_JSON_RESPONSE ${response.status} ${text.slice(0, 300)}`); }
  return { statusCode: response.status, body };
}
function assertRejected(result, status) {
  const submission = result.body.operator_scenario_recommendation_submission_v1;
  assert(result.statusCode >= 400, `${status} must return non-2xx`, result);
  assert(submission, `${status} response must include submission envelope`, result);
  assert(submission.status === status, `expected ${status}`, result);
  for (const key of ['approval_created', 'operation_plan_created', 'task_created', 'dispatch_created']) assert(submission[key] === false, `${status} ${key} must be false`, submission);
}
async function assertNoFacts(pool) {
  const r = await pool.query(`SELECT fact_id, record_json::jsonb->>'type' AS type FROM facts
    WHERE source = 'operator_scenario_recommendation_submission_api'
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,field_id}') = $2
      AND ((record_json::jsonb#>>'{payload,scenario_set_id}') = $3 OR (record_json::jsonb#>>'{payload,scenario_set_id}') = $4)`, [TENANT, FIELD, GOOD_SCENARIO_SET, BLOCKING_SCENARIO_SET]);
  assert(r.rows.length === 0, 'rejected submissions must not write facts', r.rows);
}
async function cleanup(pool) {
  await pool.query(`DELETE FROM facts WHERE source = 'operator_scenario_recommendation_submission_api' AND (record_json::jsonb#>>'{payload,field_id}')=$1`, [FIELD]).catch(() => {});
  await pool.query('DELETE FROM irrigation_scenario_set_index_v1 WHERE tenant_id=$1 AND scenario_set_id = ANY($2::text[])', [TENANT, [GOOD_SCENARIO_SET, BLOCKING_SCENARIO_SET]]).catch(() => {});
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
    await seedScenario(pool, GOOD_SCENARIO_SET, 'PASS');
    await seedScenario(pool, BLOCKING_SCENARIO_SET, 'BLOCKING');

    assertRejected(await postScenario({ optionId: 'no_action' }), 'REJECTED_NO_ACTION');
    assertRejected(await postScenario({ optionId: 'missing_option' }), 'REJECTED_OPTION_NOT_FOUND');
    assertRejected(await postScenario({ project: `${PROJECT}_mismatch` }), 'REJECTED_SCOPE_MISMATCH');
    assertRejected(await postScenario({ scenarioSetId: BLOCKING_SCENARIO_SET, optionId: 'irrigate_22mm' }), 'REJECTED_EVIDENCE_BLOCKING');
    await assertNoFacts(pool);
    console.log('[operator-scenario-submit-rejection] PASS');
  } finally {
    await cleanup(pool).catch(() => {});
    await pool.end().catch(() => {});
  }
}
main().catch((error) => { console.error('[operator-scenario-submit-rejection] FAIL'); console.error(error && error.stack ? error.stack : error); process.exit(1); });
