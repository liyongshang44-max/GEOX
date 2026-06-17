#!/usr/bin/env node
'use strict';

// scripts/governance_acceptance/ACCEPTANCE_DECISION_RECOMMENDATION_SEED_READBACK_V1.cjs
// Purpose: prove H16 C8 seed projects scenario-derived decision_recommendation_v1 rows into decision_recommendation_index_v1.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const ACCEPTANCE = 'ACCEPTANCE_DECISION_RECOMMENDATION_SEED_READBACK_V1';
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const POSITIVE_ID = 'rec_c8_irrigation_001';
const UNKNOWN_ID = 'rec_c8_irrigation_unknown_001';

function fail(message, detail) {
  console.error(`[${ACCEPTANCE}] FAIL:`, message);
  if (detail !== undefined) console.error(typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

function nearly(actual, expected, message) {
  assert(Math.abs(Number(actual) - Number(expected)) < 0.0001, `${message}: expected ${expected}, got ${actual}`, { actual, expected });
}

function parseSeedFailure(stdout, stderr) {
  const text = `${stdout || ''}\n${stderr || ''}`;
  const match = text.match(/\{\s*"ok"\s*:\s*false[\s\S]*?\n\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function readRow(client, id) {
  const result = await client.query(
    `SELECT *
       FROM public.decision_recommendation_index_v1
      WHERE recommendation_id=$1`,
    [id],
  );
  assert(result.rows.length === 1, `expected one recommendation row for ${id}`, result.rows);
  return result.rows[0];
}

(async () => {
  assert(DATABASE_URL, 'DATABASE_URL is required');

  const migrationPath = path.join(process.cwd(), 'apps/server/db/migrations/2026_06_17_decision_recommendation_index_v1.sql');
  assert(fs.existsSync(migrationPath), 'migration file missing', migrationPath);

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query(fs.readFileSync(migrationPath, 'utf8'));
    await client.query(
      'DELETE FROM public.decision_recommendation_index_v1 WHERE recommendation_id = ANY($1::text[])',
      [[POSITIVE_ID, UNKNOWN_ID]],
    );
  } finally {
    await client.end().catch(() => {});
  }

  const run = spawnSync(
    process.execPath,
    ['scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs', '--apply', '--tenant', 'tenantA', '--profile', 'c8-formal-chain'],
    { cwd: process.cwd(), env: process.env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );

  let toleratedLateSeedFailure = false;

  if (run.status !== 0) {
    const parsed = parseSeedFailure(run.stdout, run.stderr);
    const message = String(parsed?.error || parsed?.code || run.stderr || run.stdout || '');

    if (message.includes('AS_EXECUTED_DERIVATION_REQUIRED')) {
      toleratedLateSeedFailure = true;
    } else {
      fail('seed apply failed before H16 recommendation readback', {
        status: run.status,
        stdout: run.stdout,
        stderr: run.stderr,
        parsed,
      });
    }
  }

  const readClient = new Client({ connectionString: DATABASE_URL });
  await readClient.connect();

  try {
    const positive = await readRow(readClient, POSITIVE_ID);

    assert(positive.tenant_id === 'tenantA', 'positive tenant mismatch', positive);
    assert(positive.project_id === 'projectA', 'positive project mismatch', positive);
    assert(positive.group_id === 'groupA', 'positive group mismatch', positive);
    assert(positive.field_id === 'field_c8_demo', 'positive field mismatch', positive);
    assert(positive.season_id === 'season_2026_c8_corn', 'positive season mismatch', positive);
    assert(positive.recommendation_status === 'RECOMMENDED', 'positive recommendation_status mismatch', positive);
    assert(positive.selected_scenario_option_id === 'irrigate_22mm', 'positive selected option mismatch', positive);
    assert(positive.source_water_state_estimate_id === 'full_review_seed_tenantA_wstate_c8_irrigation_001', 'positive water state source mismatch', positive);
    assert(positive.source_scenario_set_id === 'full_review_seed_tenantA_iscen_c8_irrigation_001', 'positive scenario source mismatch', positive);
    assert(positive.source_requirement_id === 'ireq_c8_irrigation_001', 'positive requirement source mismatch', positive);
    assert(positive.human_approval_required === true, 'positive human approval flag mismatch', positive);
    assert(positive.source_fact_id === 'full_review_seed_tenantA_rec_c8_irrigation_001', 'positive source fact mismatch', positive);

    assert(positive.suggested_action_json?.action_type === 'IRRIGATION', 'positive suggested action type mismatch', positive.suggested_action_json);
    nearly(positive.suggested_action_json?.amount_mm, 22, 'positive suggested action amount_mm');
    nearly(positive.suggested_action_json?.water_mm, 22, 'positive suggested action water_mm');
    assert(positive.suggested_action_json?.selected_scenario_option_id === 'irrigate_22mm', 'positive suggested action option mismatch', positive.suggested_action_json);
    assert(positive.suggested_action_json?.source_requirement_id === 'ireq_c8_irrigation_001', 'positive suggested action requirement mismatch', positive.suggested_action_json);
    assert(positive.suggested_action_json?.source_scenario_set_id === 'full_review_seed_tenantA_iscen_c8_irrigation_001', 'positive suggested action scenario mismatch', positive.suggested_action_json);

    assert(positive.scenario_summary_json?.risk_after === 'NORMAL', 'positive scenario risk_after mismatch', positive.scenario_summary_json);
    assert(positive.scenario_summary_json?.risk_delta === 'IMPROVED', 'positive scenario risk_delta mismatch', positive.scenario_summary_json);
    nearly(positive.scenario_summary_json?.assumed_irrigation_mm, 22, 'positive scenario assumed_irrigation_mm');

    assert(positive.quality_json?.status === 'RECOMMENDABLE', 'positive quality status mismatch', positive.quality_json);
    assert(positive.quality_json?.input_binding_status === 'INPUTS_BOUND', 'positive input binding mismatch', positive.quality_json);
    assert(Array.isArray(positive.quality_json?.reason_codes) && positive.quality_json.reason_codes.length === 0, 'positive reason codes must be empty', positive.quality_json);
    assert(positive.confidence_json?.level === 'HIGH', 'positive confidence level mismatch', positive.confidence_json);
    assert(Array.isArray(positive.confidence_json?.reasons) && positive.confidence_json.reasons.includes('selected_option_improves_risk'), 'positive confidence reasons mismatch', positive.confidence_json);
    assert(positive.derivation_json?.derivation_type === 'decision_recommendation_from_scenario_requirement_v1', 'positive derivation type mismatch', positive.derivation_json);
    assert(positive.derivation_json?.no_direct_execution === true, 'positive no_direct_execution mismatch', positive.derivation_json);

    const factPayload = await readClient.query(`
      SELECT record_json->'payload' AS payload
        FROM public.facts
       WHERE fact_id=$1
         AND record_json->>'type'='decision_recommendation_v1'
    `, ['full_review_seed_tenantA_rec_c8_irrigation_001']);
    assert(factPayload.rows.length === 1, 'positive recommendation fact missing', factPayload.rows);
    assert(factPayload.rows[0].payload?.source_scenario_set_id === 'full_review_seed_tenantA_iscen_c8_irrigation_001', 'positive recommendation fact was not updated to H16 source binding', factPayload.rows[0]);
    assert(factPayload.rows[0].payload?.selected_scenario_option_id === 'irrigate_22mm', 'positive recommendation fact selected option mismatch', factPayload.rows[0]);
    assert(factPayload.rows[0].payload?.suggested_action?.amount_mm === 22, 'positive recommendation fact suggested amount mismatch', factPayload.rows[0]);

    const unknown = await readRow(readClient, UNKNOWN_ID);

    assert(unknown.recommendation_status === 'UNKNOWN', 'unknown recommendation_status mismatch', unknown);
    assert(unknown.selected_scenario_option_id === null, 'unknown selected option must be null', unknown);
    assert(unknown.suggested_action_json === null, 'unknown suggested_action must be null', unknown);
    assert(unknown.human_approval_required === false, 'unknown human approval flag mismatch', unknown);
    assert(unknown.source_water_state_estimate_id === 'full_review_seed_tenantA_wstate_c8_irrigation_unknown_001', 'unknown water state source mismatch', unknown);
    assert(unknown.source_scenario_set_id === 'full_review_seed_tenantA_iscen_c8_irrigation_unknown_001', 'unknown scenario source mismatch', unknown);
    assert(unknown.source_requirement_id === 'ireq_c8_irrigation_001', 'unknown requirement source mismatch', unknown);
    assert(unknown.quality_json?.status === 'UNKNOWN', 'unknown quality status mismatch', unknown.quality_json);
    assert(unknown.quality_json?.input_binding_status === 'INPUT_NOT_USABLE', 'unknown input binding mismatch', unknown.quality_json);
    assert(Array.isArray(unknown.quality_json?.reason_codes) && unknown.quality_json.reason_codes.includes('WATER_STATE_UNKNOWN'), 'unknown WATER_STATE_UNKNOWN reason missing', unknown.quality_json);
    assert(unknown.confidence_json?.level === 'LOW', 'unknown confidence level mismatch', unknown.confidence_json);

    const unknownFactPayload = await readClient.query(`
      SELECT record_json->'payload' AS payload
        FROM public.facts
       WHERE fact_id=$1
         AND record_json->>'type'='decision_recommendation_v1'
    `, ['full_review_seed_tenantA_rec_c8_irrigation_unknown_001']);
    assert(unknownFactPayload.rows.length === 1, 'UNKNOWN recommendation fact missing', unknownFactPayload.rows);
    assert(unknownFactPayload.rows[0].payload?.recommendation_status === 'UNKNOWN', 'UNKNOWN recommendation fact status mismatch', unknownFactPayload.rows[0]);
    assert(unknownFactPayload.rows[0].payload?.selected_scenario_option_id === null, 'UNKNOWN recommendation fact selected option must be null', unknownFactPayload.rows[0]);
    assert(unknownFactPayload.rows[0].payload?.suggested_action === null, 'UNKNOWN recommendation fact suggested_action must be null', unknownFactPayload.rows[0]);

    console.log(JSON.stringify({
      ok: true,
      acceptance: ACCEPTANCE,
      tolerated_late_seed_failure: toleratedLateSeedFailure,
      positive_recommendation_id: positive.recommendation_id,
      selected_scenario_option_id: positive.selected_scenario_option_id,
      suggested_action_amount_mm: positive.suggested_action_json.amount_mm,
      risk_delta: positive.scenario_summary_json.risk_delta,
      unknown_recommendation_id: unknown.recommendation_id,
      unknown_status: unknown.recommendation_status,
      unknown_suggested_action: unknown.suggested_action_json,
    }, null, 2));
  } finally {
    await readClient.end().catch(() => {});
  }
})().catch((error) => fail(error.message || 'unexpected failure', error.stack || error));
