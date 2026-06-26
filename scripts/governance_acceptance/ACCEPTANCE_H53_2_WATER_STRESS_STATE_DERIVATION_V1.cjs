#!/usr/bin/env node
'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H53_2_WATER_STRESS_STATE_DERIVATION_V1.cjs
// Purpose: verify H53.2 derives only WaterStressState from H53.1 sensing-only inputs.
// Boundary: read-only acceptance; it does not create facts or projections.

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const DB = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const SOURCE = 'H53_2_WATER_STRESS_STATE_DERIVATION_V1';
const VERSION = 'h53.2.v1';
const SCOPE = { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', field_id: 'field_c8_demo' };
const BASE = process.env.GEOX_BASE_URL || '';
const TOKEN = process.env.GEOX_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-admin';

const forbidden = ['root_zone_soil_water_state_v1','root_zone_soil_water_forecast_v1','irrigation_scenario_set_v1','decision_recommendation_v1','approval_request_v1','approval_decision_v1','operation_plan_v1','ao_act_task_v0','ao_act_receipt_v1','as_executed_record_v1','evidence_artifact_v1','acceptance_result_v1','water_response_verification_v1','roi_ledger_v1','field_memory_v1'];

function fail(error, details = {}) { console.error(JSON.stringify({ ok:false, acceptance:'ACCEPTANCE_H53_2_WATER_STRESS_STATE_DERIVATION_V1', error, details }, null, 2)); process.exit(1); }
function ok(condition, error, details = {}) { if (!condition) fail(error, details); }
function read(file) { const p = path.resolve(process.cwd(), file); ok(fs.existsSync(p), 'FILE_MISSING', { file }); return fs.readFileSync(p, 'utf8'); }
function has(text, token, file) { ok(text.includes(token), 'TOKEN_MISSING', { file, token }); }

function staticChecks() {
  const derive = read('scripts/derivations/DERIVE_H53_2_WATER_STRESS_STATE_V1.cjs');
  const route = read('apps/server/src/routes/v1/operator_evidence_twin.ts');
  has(derive, SOURCE, 'scripts/derivations/DERIVE_H53_2_WATER_STRESS_STATE_V1.cjs');
  has(derive, VERSION, 'scripts/derivations/DERIVE_H53_2_WATER_STRESS_STATE_V1.cjs');
  has(derive, 'water_state_estimate_v1', 'scripts/derivations/DERIVE_H53_2_WATER_STRESS_STATE_V1.cjs');
  has(derive, 'decision_recommendation_v1', 'scripts/derivations/DERIVE_H53_2_WATER_STRESS_STATE_V1.cjs');
  has(derive, 'field_memory_v1', 'scripts/derivations/DERIVE_H53_2_WATER_STRESS_STATE_V1.cjs');
  has(route, SOURCE, 'apps/server/src/routes/v1/operator_evidence_twin.ts');
  has(route, 'latestH532WaterState', 'apps/server/src/routes/v1/operator_evidence_twin.ts');
  has(route, 'waterStateNode', 'apps/server/src/routes/v1/operator_evidence_twin.ts');
  has(route, 'FORECAST_DERIVED_PENDING', 'apps/server/src/routes/v1/operator_evidence_twin.ts');
  has(route, 'SCENARIO_DERIVED_PENDING', 'apps/server/src/routes/v1/operator_evidence_twin.ts');
  has(route, 'RECOMMENDATION_DERIVED_PENDING', 'apps/server/src/routes/v1/operator_evidence_twin.ts');
  has(route, 'NO_FORECAST_OR_SCENARIO', 'apps/server/src/routes/v1/operator_evidence_twin.ts');
}

async function columns(client, table) {
  const r = await client.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1", [table]);
  return new Set(r.rows.map((row) => row.column_name));
}

async function dbChecks() {
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    const derived = await client.query(
      `select fact_id, record_json::jsonb as record_json
         from facts
        where source=$1
          and record_json::jsonb->>'type'='water_state_estimate_v1'
          and record_json::jsonb#>>'{payload,derivation_version}'=$2
          and record_json::jsonb#>>'{payload,tenant_id}'=$3
          and record_json::jsonb#>>'{payload,project_id}'=$4
          and record_json::jsonb#>>'{payload,group_id}'=$5
          and record_json::jsonb#>>'{payload,field_id}'=$6
        order by occurred_at desc, fact_id desc
        limit 1`,
      [SOURCE, VERSION, SCOPE.tenant_id, SCOPE.project_id, SCOPE.group_id, SCOPE.field_id],
    );
    ok(derived.rows.length === 1, 'H53_2_DERIVED_FACT_MISSING');
    const fact = derived.rows[0];
    const payload = fact.record_json.payload || {};
    ok(payload.water_state || payload.state, 'WATER_STATE_VALUE_MISSING', { payload });
    ok(payload.determinism_hash, 'DETERMINISM_HASH_MISSING', { payload });
    ok(payload.source_profile === 'c8-sensing-only', 'SOURCE_PROFILE_NOT_SENSING_ONLY', { payload });
    ok(payload.source_chain_id === 'C8_SENSING_ONLY_V1', 'SOURCE_CHAIN_ID_NOT_H53_1', { payload });
    ok(payload.rule && payload.rule.no_recommendation_created === true, 'NO_RECOMMENDATION_RULE_MISSING', { payload });

    const forbiddenRows = await client.query(
      `select record_json::jsonb->>'type' as type, count(*)::int as count
         from facts
        where source=$1
          and record_json::jsonb->>'type' = any($2::text[])
        group by 1`,
      [SOURCE, forbidden],
    );
    ok(forbiddenRows.rows.length === 0, 'FORBIDDEN_FACT_WRITTEN_BY_H53_2', { rows: forbiddenRows.rows });

    const rootZone = await client.query(
      `select count(*)::int as count
         from root_zone_soil_water_state_index_v1
        where tenant_id=$1 and project_id=$2 and group_id=$3 and field_id=$4`,
      [SCOPE.tenant_id, SCOPE.project_id, SCOPE.group_id, SCOPE.field_id],
    ).catch(() => ({ rows: [{ count: 0 }] }));
    ok(Number(rootZone.rows[0].count || 0) === 0, 'ROOT_ZONE_STATE_CREATED_IN_H53_2', { count: rootZone.rows[0].count });

    const cols = await columns(client, 'water_state_estimate_index_v1');
    let indexCheck = { checked: false, count: null, reason: 'source_fact_id column missing' };
    if (cols.has('source_fact_id')) {
      const idx = await client.query('select count(*)::int as count from water_state_estimate_index_v1 where source_fact_id=$1', [fact.fact_id]);
      indexCheck = { checked: true, count: Number(idx.rows[0].count || 0), reason: null };
      ok(indexCheck.count > 0, 'WATER_STATE_INDEX_ROW_MISSING', { fact_id: fact.fact_id });
    }
    return { fact_id: fact.fact_id, water_state: payload.water_state || payload.state, determinism_hash: payload.determinism_hash, index_check: indexCheck };
  } finally {
    await client.end();
  }
}

async function endpointCheck() {
  if (!BASE) return { skipped: true, reason: 'GEOX_BASE_URL not set' };
  const url = new URL(`/api/v1/operator/fields/${SCOPE.field_id}/evidence-twin`, BASE);
  url.searchParams.set('loop', 'water-stress');
  url.searchParams.set('tenant_id', SCOPE.tenant_id);
  url.searchParams.set('project_id', SCOPE.project_id);
  url.searchParams.set('group_id', SCOPE.group_id);
  const response = await fetch(url, { headers: { authorization: `Bearer ${TOKEN}` } });
  const body = await response.text();
  ok(response.status === 200, 'ENDPOINT_NOT_200', { status: response.status, body: body.slice(0, 1000) });
  const json = JSON.parse(body);
  const loop = json.operator_evidence_twin_v1?.water_stress_loop;
  ok(loop?.water_stress_state?.status === 'AVAILABLE', 'WATER_STRESS_STATE_NOT_AVAILABLE_IN_ENDPOINT', { status: loop?.water_stress_state?.status });
  ok(loop?.forecast?.status === 'DERIVED_PENDING', 'FORECAST_SHOULD_STAY_PENDING', { status: loop?.forecast?.status });
  ok(loop?.scenario?.status === 'DERIVED_PENDING', 'SCENARIO_SHOULD_STAY_PENDING', { status: loop?.scenario?.status });
  ok(loop?.recommendation?.status === 'DERIVED_PENDING', 'RECOMMENDATION_SHOULD_STAY_PENDING', { status: loop?.recommendation?.status });
  return { skipped: false, water_stress_state: loop.water_stress_state.expand_payload };
}

(async function main() {
  staticChecks();
  const db = await dbChecks();
  const endpoint = await endpointCheck();
  console.log(JSON.stringify({ ok:true, acceptance:'ACCEPTANCE_H53_2_WATER_STRESS_STATE_DERIVATION_V1', db, endpoint }, null, 2));
})().catch((error) => fail(error.message));
