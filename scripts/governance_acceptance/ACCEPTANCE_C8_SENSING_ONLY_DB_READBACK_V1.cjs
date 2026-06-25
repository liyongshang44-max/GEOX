#!/usr/bin/env node
'use strict';

// scripts/governance_acceptance/ACCEPTANCE_C8_SENSING_ONLY_DB_READBACK_V1.cjs
// Purpose: verify H53.1 sensing-only DB rows and official Operator Evidence Twin readback.
// Boundary: read-only acceptance; it writes no facts, approvals, tasks, reports, ROI, or memory records.

const { Client } = require('pg');

const SOURCE = 'C8_SENSING_ONLY_SEED_V1';
const DB = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const BASE = process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001';
const TOKEN = process.env.GEOX_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-admin';
const FIELD_ID = 'field_c8_demo';
const SCOPE = ['tenantA', 'projectA', 'groupA', FIELD_ID];

const REQUIRED_FACT_TYPES = [
  'telemetry_observation_v1',
  'weather_forecast_fact_v1',
  'soil_moisture_sensing_window_v1',
  'sensing_only_manifest_v1',
];

const FORBIDDEN_FACT_TYPES = [
  'irrigation_requirement_v1',
  'water_state_estimate_v1',
  'irrigation_scenario_set_v1',
  'decision_recommendation_v1',
  'approval_request_v1',
  'operation_plan_v1',
  'ao_act_task_v0',
  'ao_act_receipt_v1',
  'evidence_artifact_v1',
  'acceptance_result_v1',
  'roi_ledger_v1',
  'field_memory_v1',
];

const REQUIRED_TABLES = [
  'telemetry_index_v1',
  'device_observation_index_v1',
  'soil_moisture_sensing_window_index_v1',
  'weather_forecast_index_v1',
];

const PENDING_NODES = [
  'water_stress_state',
  'forecast',
  'scenario',
  'recommendation',
  'approval',
  'operation',
  'ao_act',
  'as_executed',
  'evidence',
  'acceptance',
  'verification',
];

function fail(code, details = {}) {
  const error = new Error(code);
  error.details = details;
  throw error;
}

function assert(condition, code, details = {}) {
  if (!condition) fail(code, details);
}

async function readDb() {
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    const factRows = await client.query(
      `select record_json::jsonb->>'type' as type, count(*)::int as count from facts where source=$1 group by 1`,
      [SOURCE],
    );
    const factCounts = Object.fromEntries(factRows.rows.map((row) => [row.type, Number(row.count || 0)]));
    for (const type of REQUIRED_FACT_TYPES) assert((factCounts[type] || 0) > 0, 'REQUIRED_FACT_TYPE_MISSING', { type, factCounts });
    for (const type of FORBIDDEN_FACT_TYPES) assert((factCounts[type] || 0) === 0, 'FORBIDDEN_FACT_TYPE_PRESENT', { type, factCounts });

    const tableCounts = {};
    for (const table of REQUIRED_TABLES) {
      const result = await client.query(
        `select count(*)::int as count from ${table} where tenant_id=$1 and project_id=$2 and group_id=$3 and field_id=$4`,
        SCOPE,
      );
      tableCounts[table] = Number(result.rows[0]?.count || 0);
      assert(tableCounts[table] > 0, 'REQUIRED_TABLE_EMPTY', { table, tableCounts });
    }
    return { factCounts, tableCounts };
  } finally {
    await client.end();
  }
}

async function readApi() {
  const url = new URL(`/api/v1/operator/fields/${FIELD_ID}/evidence-twin`, BASE);
  url.searchParams.set('loop', 'water-stress');
  url.searchParams.set('tenant_id', SCOPE[0]);
  url.searchParams.set('project_id', SCOPE[1]);
  url.searchParams.set('group_id', SCOPE[2]);
  const response = await fetch(url, { headers: { authorization: `Bearer ${TOKEN}` } });
  const text = await response.text();
  assert(response.status === 200, 'ENDPOINT_NOT_200', { status: response.status, body: text.slice(0, 1000) });
  return JSON.parse(text);
}

function checkClosedWritePolicy(node, code) {
  assert(node?.write_policy?.write_ready === false, code, { write_policy: node?.write_policy });
  assert(Array.isArray(node?.write_policy?.allowed_actions) && node.write_policy.allowed_actions.length === 0, code, { write_policy: node?.write_policy });
}

function validateApi(payload) {
  assert(payload.ok === true, 'API_OK_FALSE', { ok: payload.ok });
  for (const flag of ['writeReady', 'dispatchReady', 'approvalReady', 'taskCreationReady', 'memoryWriteReady', 'roiWriteReady']) assert(payload[flag] === false, 'BOUNDARY_FLAG_NOT_FALSE', { flag, value: payload[flag] });

  const loop = payload.operator_evidence_twin_v1?.water_stress_loop;
  assert(loop?.inputs, 'LOOP_INPUTS_MISSING');
  assert((loop.inputs.soil_moisture || []).some((node) => node.status === 'AVAILABLE'), 'SOIL_MOISTURE_NOT_AVAILABLE');
  assert((loop.inputs.weather_forecast || []).some((node) => node.status === 'AVAILABLE'), 'WEATHER_FORECAST_NOT_AVAILABLE');

  for (const key of PENDING_NODES) {
    assert(loop[key]?.status === 'DERIVED_PENDING', 'DERIVED_NODE_NOT_PENDING', { key, status: loop[key]?.status });
    checkClosedWritePolicy(loop[key], 'DERIVED_NODE_WRITE_POLICY_OPEN');
  }
}

async function main() {
  const db = await readDb();
  const api = await readApi();
  validateApi(api);
  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_C8_SENSING_ONLY_DB_READBACK_V1', db }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_C8_SENSING_ONLY_DB_READBACK_V1', error: error.message, details: error.details || null }, null, 2));
  process.exit(1);
});
