'use strict';

// scripts/h53/ACCEPTANCE_H53_3_FORECAST_SCENARIO_V1.cjs
// Purpose: verify H53.3 forecast/scenario generation and boundaries.
// Boundary: read-only acceptance; it writes no facts or projections.

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const DB = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const SRC = 'H53_3_FORECAST_SCENARIO_DERIVATION_V1';
const VER = 'h53.3.v1';
const S = { tenant_id:'tenantA', project_id:'projectA', group_id:'groupA', field_id:'field_c8_demo' };
const BASE = process.env.GEOX_BASE_URL || '';
const TOKEN = process.env.GEOX_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-admin';
const forbidden = ['decision_recommendation_v1','approval_request_v1','approval_decision_v1','operation_plan_v1','ao_act_task_v0','ao_act_receipt_v1','as_executed_record_v1','evidence_artifact_v1','acceptance_result_v1','water_response_verification_v1','roi_ledger_v1','field_memory_v1'];

function fail(error, details = {}) { console.error(JSON.stringify({ ok:false, acceptance:'ACCEPTANCE_H53_3_FORECAST_SCENARIO_V1', error, details }, null, 2)); process.exit(1); }
function ok(x, e, d = {}) { if (!x) fail(e, d); }
function read(file) { return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'); }
function has(file, token) { ok(read(file).includes(token), 'TOKEN_MISSING', { file, token }); }

function staticChecks() {
  has('scripts/h53/DERIVE_H53_3_FORECAST_SCENARIO_V1.cjs', SRC);
  has('scripts/h53/DERIVE_H53_3_FORECAST_SCENARIO_V1.cjs', VER);
  has('scripts/h53/DERIVE_H53_3_FORECAST_SCENARIO_V1.cjs', 'root_zone_soil_water_forecast_v1');
  has('scripts/h53/DERIVE_H53_3_FORECAST_SCENARIO_V1.cjs', 'irrigation_scenario_set_v1');
  has('scripts/h53/DERIVE_H53_3_FORECAST_SCENARIO_V1.cjs', 'recommendation_created:false');
}

async function dbChecks() {
  const c = new Client({ connectionString: DB });
  await c.connect();
  try {
    const f = await c.query(`select fact_id,record_json::jsonb as record_json from facts where source=$1 and record_json::jsonb->>'type'='root_zone_soil_water_forecast_v1' and record_json::jsonb#>>'{payload,derivation_version}'=$2 and record_json::jsonb#>>'{payload,tenant_id}'=$3 and record_json::jsonb#>>'{payload,project_id}'=$4 and record_json::jsonb#>>'{payload,group_id}'=$5 and record_json::jsonb#>>'{payload,field_id}'=$6 order by occurred_at desc,fact_id desc limit 1`, [SRC,VER,S.tenant_id,S.project_id,S.group_id,S.field_id]);
    ok(f.rows.length === 1, 'FORECAST_FACT_MISSING');
    const forecast = f.rows[0].record_json.payload || {};
    ok(Array.isArray(forecast.daily_forecast) && forecast.daily_forecast.length === 7, 'FORECAST_DAYS_INVALID', forecast);
    ok(forecast.forecast_status === 'ESTIMATED', 'FORECAST_STATUS_INVALID', forecast);

    const s = await c.query(`select fact_id,record_json::jsonb as record_json from facts where source=$1 and record_json::jsonb->>'type'='irrigation_scenario_set_v1' and record_json::jsonb#>>'{payload,derivation_version}'=$2 and record_json::jsonb#>>'{payload,tenant_id}'=$3 and record_json::jsonb#>>'{payload,project_id}'=$4 and record_json::jsonb#>>'{payload,group_id}'=$5 and record_json::jsonb#>>'{payload,field_id}'=$6 order by occurred_at desc,fact_id desc limit 1`, [SRC,VER,S.tenant_id,S.project_id,S.group_id,S.field_id]);
    ok(s.rows.length === 1, 'SCENARIO_FACT_MISSING');
    const scenario = s.rows[0].record_json.payload || {};
    ok(scenario.no_action_baseline_present === true, 'NO_ACTION_BASELINE_REQUIRED', scenario);
    ok(Array.isArray(scenario.options) && scenario.options.length === 4, 'SCENARIO_OPTIONS_INVALID', scenario);
    ok(scenario.selected_option_id === null, 'SCENARIO_MUST_NOT_SELECT_OPTION', scenario);
    ok(scenario.recommendation_created === false, 'SCENARIO_MUST_NOT_CREATE_RECOMMENDATION', scenario);
    for (const option of scenario.options) ok(option.recommendation_selected === false, 'OPTION_MUST_NOT_BE_SELECTED', option);

    const bad = await c.query(`select record_json::jsonb->>'type' as type,count(*)::int as count from facts where source=$1 and record_json::jsonb->>'type'=any($2::text[]) group by 1`, [SRC, forbidden]);
    ok(bad.rows.length === 0, 'FORBIDDEN_FACT_WRITTEN_BY_H53_3', { rows: bad.rows });
    return { forecast_id: forecast.forecast_id, scenario_set_id: scenario.scenario_set_id, option_count: scenario.options.length };
  } finally { await c.end(); }
}

async function endpointCheck() {
  if (!BASE) return { skipped: true, reason: 'GEOX_BASE_URL not set' };
  const url = new URL(`/api/v1/operator/fields/${S.field_id}/evidence-twin`, BASE);
  url.searchParams.set('loop','water-stress');
  url.searchParams.set('tenant_id',S.tenant_id);
  url.searchParams.set('project_id',S.project_id);
  url.searchParams.set('group_id',S.group_id);
  const response = await fetch(url, { headers: { authorization: `Bearer ${TOKEN}` } });
  const body = await response.text();
  ok(response.status === 200, 'ENDPOINT_NOT_200', { status: response.status, body: body.slice(0,1000) });
  const json = JSON.parse(body);
  const loop = json.operator_evidence_twin_v1?.water_stress_loop;
  ok(loop?.forecast?.status === 'AVAILABLE', 'FORECAST_NOT_AVAILABLE_IN_ENDPOINT', { status: loop?.forecast?.status });
  ok(loop?.scenario?.status === 'AVAILABLE', 'SCENARIO_NOT_AVAILABLE_IN_ENDPOINT', { status: loop?.scenario?.status });
  ok(loop?.recommendation?.status === 'DERIVED_PENDING', 'RECOMMENDATION_SHOULD_STAY_PENDING', { status: loop?.recommendation?.status });
  ok(loop?.approval?.status === 'DERIVED_PENDING', 'APPROVAL_SHOULD_STAY_PENDING', { status: loop?.approval?.status });
  return { skipped:false, forecast: loop.forecast.expand_payload, scenario_set_id: loop.scenario.scenario_set_id, option_count: loop.scenario.options.length };
}

(async function main(){ staticChecks(); const db = await dbChecks(); const endpoint = await endpointCheck(); console.log(JSON.stringify({ ok:true, acceptance:'ACCEPTANCE_H53_3_FORECAST_SCENARIO_V1', db, endpoint }, null, 2)); })().catch((error)=>fail(error.message));
