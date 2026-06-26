#!/usr/bin/env node
'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H53_2_PREFLIGHT_CAPABILITY_AUDIT_V1.cjs
// Purpose: read-only audit before H53.2 WaterStressState derivation.
// Boundary: no writes; this script only inspects repository text and local Postgres state.

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const DB = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const SOURCE = 'C8_SENSING_ONLY_SEED_V1';
const SCOPE = { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', field_id: 'field_c8_demo' };

const requiredFacts = ['telemetry_observation_v1','weather_forecast_fact_v1','soil_moisture_sensing_window_v1','sensing_only_manifest_v1'];
const forbiddenFacts = ['water_state_estimate_v1','root_zone_soil_water_state_v1','root_zone_soil_water_forecast_v1','irrigation_scenario_set_v1','decision_recommendation_v1','approval_request_v1','approval_decision_v1','operation_plan_v1','ao_act_task_v0','ao_act_receipt_v1','as_executed_record_v1','evidence_artifact_v1','acceptance_result_v1','roi_ledger_v1','field_memory_v1','stage1_sensing_summary_v1','skill_run_v1'];
const tables = ['telemetry_index_v1','device_observation_index_v1','soil_moisture_sensing_window_index_v1','weather_forecast_index_v1','water_state_estimate_index_v1','root_zone_soil_water_state_index_v1','irrigation_scenario_set_index_v1','decision_recommendation_index_v1','operation_plan_index_v1','as_executed_record_v1','as_applied_map_v1','water_response_verification_index_v1','roi_ledger_v1','field_memory_v1'];

function die(error, details = {}) { console.error(JSON.stringify({ ok:false, acceptance:'ACCEPTANCE_H53_2_PREFLIGHT_CAPABILITY_AUDIT_V1', error, details }, null, 2)); process.exit(1); }
function ok(condition, error, details = {}) { if (!condition) die(error, details); }
function read(file) { const p = path.resolve(process.cwd(), file); ok(fs.existsSync(p), 'FILE_MISSING', { file }); return fs.readFileSync(p, 'utf8'); }
function must(file, token) { const text = read(file); ok(text.includes(token), 'TOKEN_MISSING', { file, token }); }

function staticAudit() {
  must('apps/server/src/routes/v1/operator_evidence_twin.ts', 'canopy_temperature: []');
  must('apps/server/src/routes/v1/operator_evidence_twin.ts', 'irrigation_event: []');
  must('apps/server/src/routes/v1/operator_evidence_twin.ts', 'WATER_STRESS_STATE_DERIVED_PENDING');
  must('apps/server/src/routes/v1/operator_evidence_twin.ts', 'FORECAST_DERIVED_PENDING');
  must('apps/server/src/routes/v1/operator_evidence_twin.ts', 'SCENARIO_DERIVED_PENDING');
  must('apps/server/src/routes/v1/operator_evidence_twin.ts', 'RECOMMENDATION_DERIVED_PENDING');
  must('db/contracts/operator_twin_source_indexes_v1.sql', 'water_state_estimate_index_v1');
  must('db/contracts/operator_twin_source_indexes_v1.sql', 'irrigation_scenario_set_index_v1');
  must('db/contracts/operator_twin_source_indexes_v1.sql', 'decision_recommendation_index_v1');
  must('apps/server/db/migrations/2026_06_21_root_zone_soil_water_state_v1.sql', 'root_zone_soil_water_state_index_v1');
  must('apps/server/src/domain/operations/operation_plan_from_approval_decision_builder_v1.ts', 'OPERATION_PLAN_CREATED');
  must('apps/server/src/domain/controlplane/ao_act_task_from_operation_plan_builder_v1.ts', 'AO_ACT_TASK_PROJECTED');
  must('apps/server/src/domain/execution/as_executed_v1.ts', 'INSERT INTO as_executed_record_v1');
  must('apps/server/src/domain/execution/as_executed_v1.ts', 'INSERT INTO as_applied_map_v1');
  must('scripts/governance_acceptance/ACCEPTANCE_EVIDENCE_ARTIFACT_FROM_AS_EXECUTED_V1_BOUNDARY.cjs', 'evidence_artifact_v1');
  must('scripts/governance_acceptance/ACCEPTANCE_RESULT_FROM_EVIDENCE_ARTIFACTS_V1_BOUNDARY.cjs', 'acceptance_result_v1');
  must('apps/server/src/routes/water_response_verification_v1.ts', 'water_response_verification_index_v1');
  must('scripts/governance_acceptance/ACCEPTANCE_ROI_MEMORY_TRUST_LANE_V1.cjs', 'FORMAL_FIELD_MEMORY');
  return { h53_2_needed: true, h54_control_plane_is_existing_capability: true };
}

async function columns(client, table) {
  ok(tables.includes(table), 'UNSAFE_TABLE_NAME', { table });
  const r = await client.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1", [table]);
  return new Set(r.rows.map((x) => x.column_name));
}

async function scopedCount(client, table, metric) {
  const cols = await columns(client, table);
  if (!cols.size) return { exists:false, count:null, scope_columns:[] };
  const where = [];
  const vals = [];
  for (const key of ['tenant_id','project_id','group_id','field_id']) if (cols.has(key)) { vals.push(SCOPE[key]); where.push(`${key}=$${vals.length}`); }
  if (metric && cols.has('metric')) { vals.push(metric); where.push(`metric=$${vals.length}`); }
  const r = await client.query(`select count(*)::int as count from ${table}${where.length ? ' where ' + where.join(' and ') : ''}`, vals);
  return { exists:true, count:Number(r.rows[0].count || 0), scope_columns:where.map((x) => x.split('=')[0]) };
}

async function dbAudit() {
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    const f = await client.query("select record_json::jsonb->>'type' as type, count(*)::int as count from facts where source=$1 group by 1", [SOURCE]);
    const factCounts = Object.fromEntries(f.rows.map((x) => [x.type, Number(x.count || 0)]));
    for (const type of requiredFacts) ok((factCounts[type] || 0) > 0, 'H53_REQUIRED_FACT_MISSING', { type, factCounts });
    for (const type of forbiddenFacts) ok((factCounts[type] || 0) === 0, 'H53_SENSING_ONLY_SOURCE_CONTAMINATED', { type, factCounts });

    const tableCounts = {};
    for (const table of tables) tableCounts[table] = await scopedCount(client, table, null);
    const metrics = {
      soil_moisture_telemetry: await scopedCount(client, 'telemetry_index_v1', 'soil_moisture_percent'),
      soil_moisture_observation: await scopedCount(client, 'device_observation_index_v1', 'soil_moisture_percent'),
      canopy_temperature_telemetry: await scopedCount(client, 'telemetry_index_v1', 'canopy_temperature'),
      canopy_temperature_observation: await scopedCount(client, 'device_observation_index_v1', 'canopy_temperature'),
    };
    return { h53_fact_counts: factCounts, table_counts: tableCounts, metric_counts: metrics };
  } finally {
    await client.end();
  }
}

(async function main() {
  const static_capability = staticAudit();
  const db = await dbAudit();
  console.log(JSON.stringify({ ok:true, acceptance:'ACCEPTANCE_H53_2_PREFLIGHT_CAPABILITY_AUDIT_V1', scope:SCOPE, static_capability, db, next:'H53.2 WaterStressState Derivation' }, null, 2));
})().catch((error) => die(error.message));
