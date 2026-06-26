'use strict';

const { Client } = require('pg');
const { SCOPE } = require('./h53_4_recommendation_candidate_model.cjs');

const DB = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';

async function latestFact(client, source, type, version) {
  const result = await client.query(
    `select fact_id, occurred_at, source, record_json::jsonb as record_json, record_json::jsonb->'payload' as payload_json from facts where source=$1 and record_json::jsonb->>'type'=$2 and record_json::jsonb#>>'{payload,derivation_version}'=$3 and record_json::jsonb#>>'{payload,tenant_id}'=$4 and record_json::jsonb#>>'{payload,project_id}'=$5 and record_json::jsonb#>>'{payload,group_id}'=$6 and record_json::jsonb#>>'{payload,field_id}'=$7 order by occurred_at desc, fact_id desc limit 1`,
    [source, type, version, SCOPE.tenant_id, SCOPE.project_id, SCOPE.group_id, SCOPE.field_id],
  );
  return result.rows[0] || null;
}

async function readInputs() {
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    return {
      stateRow: await latestFact(client, 'H53_2_WATER_STRESS_STATE_DERIVATION_V1', 'water_state_estimate_v1', 'h53.2.v1'),
      forecastRow: await latestFact(client, 'H53_3_FORECAST_SCENARIO_DERIVATION_V1', 'root_zone_soil_water_forecast_v1', 'h53.3.v1'),
      scenarioRow: await latestFact(client, 'H53_3_FORECAST_SCENARIO_DERIVATION_V1', 'irrigation_scenario_set_v1', 'h53.3.v1'),
    };
  } finally {
    await client.end();
  }
}

module.exports = { DB, readInputs };
