#!/usr/bin/env node
'use strict';

// scripts/derivations/DERIVE_H53_2_WATER_STRESS_STATE_V1.cjs
// Purpose: derive a deterministic H53.2 water_state_estimate_v1 from H53.1 current sensing-only inputs.
// Boundary: this script only writes water_state_estimate_v1 and water_state_estimate_index_v1; it does not write forecast, scenario, recommendation, approval, AO-ACT, receipt, evidence, acceptance, verification, ROI, or Field Memory.
// H53.2 guardrail: the current-state derivation must not use post-irrigation sensing windows as its input.

const crypto = require('node:crypto');
const { Client } = require('pg');

const DB = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const SOURCE = 'H53_2_WATER_STRESS_STATE_DERIVATION_V1';
const INPUT_SOURCE = 'C8_SENSING_ONLY_SEED_V1';
const VERSION = 'h53.2.v1';
const SCOPE = { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', field_id: 'field_c8_demo' };
const SEASON_ID = 'season_h53_2_c8_demo';

const forbiddenFactTypes = ['root_zone_soil_water_state_v1','root_zone_soil_water_forecast_v1','irrigation_scenario_set_v1','decision_recommendation_v1','approval_request_v1','approval_decision_v1','operation_plan_v1','ao_act_task_v0','ao_act_receipt_v1','as_executed_record_v1','evidence_artifact_v1','acceptance_result_v1','water_response_verification_v1','roi_ledger_v1','field_memory_v1'];

function arg(name) { return process.argv.includes(name); }
function text(value) { return String(value ?? '').trim(); }
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function parseJson(value) { if (!value) return null; if (typeof value === 'object') return value; try { return JSON.parse(String(value)); } catch { return null; } }
function asArray(value) { const parsed = parseJson(value); if (Array.isArray(value)) return value; return Array.isArray(parsed) ? parsed : []; }
function hashOf(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function die(error, details = {}) { console.error(JSON.stringify({ ok:false, derivation:'DERIVE_H53_2_WATER_STRESS_STATE_V1', error, details }, null, 2)); process.exit(1); }

function classifyWaterState(soilMoisturePercent) {
  if (soilMoisturePercent < 16) return 'SEVERE_DEFICIT';
  if (soilMoisturePercent < 22) return 'MODERATE_DEFICIT';
  if (soilMoisturePercent < 30) return 'ADEQUATE';
  return 'WET';
}

function confidenceFor(input) {
  const reasons = [];
  let score = 0.82;
  if (input.coverage_ratio == null || input.coverage_ratio < 0.8) { score -= 0.25; reasons.push('LOW_SENSING_COVERAGE'); }
  if (text(input.quality_status) !== 'PASS') { score -= 0.2; reasons.push('SENSING_WINDOW_NOT_PASS'); }
  if (input.soil_moisture_percent == null) { score -= 0.4; reasons.push('SOIL_MOISTURE_MISSING'); }
  if (input.rainfall_forecast_mm_72h == null || input.et0_mm_72h == null) { score -= 0.1; reasons.push('WEATHER_INPUT_PARTIAL'); }
  const bounded = Math.max(0.05, Math.min(0.95, Number(score.toFixed(2))));
  return { score: bounded, level: bounded >= 0.75 ? 'HIGH' : bounded >= 0.5 ? 'MEDIUM' : 'LOW', blocking_reasons: reasons };
}

async function tableColumns(client, table) {
  const r = await client.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1", [table]);
  return new Set(r.rows.map((row) => row.column_name));
}

function rejectPostIrrigationInput(input) {
  const values = [input.source_sensing_window_id, input.source_sensing_window_fact_id, input.source_observation_id, input.source_observation_fact_id]
    .map((value) => text(value).toLowerCase());
  if (values.some((value) => value.includes('post_irrigation'))) die('POST_IRRIGATION_INPUT_FORBIDDEN_IN_H53_2_CURRENT_STATE', { values });
}

async function readInputs(client) {
  const manifest = await client.query(
    "select fact_id, record_json::jsonb as record_json from facts where source=$1 and record_json::jsonb->>'type'='sensing_only_manifest_v1' order by occurred_at desc limit 1",
    [INPUT_SOURCE],
  );
  if (!manifest.rows.length) die('H53_1_SENSING_ONLY_MANIFEST_MISSING');

  const window = await client.query(
    `select * from soil_moisture_sensing_window_index_v1
      where tenant_id=$1 and project_id=$2 and group_id=$3 and field_id=$4
        and lower(coalesce(window_id,'')) not like '%post_irrigation%'
        and lower(coalesce(source_fact_id,'')) not like '%post_irrigation%'
      order by updated_at desc nulls last, window_end desc
      limit 1`,
    [SCOPE.tenant_id, SCOPE.project_id, SCOPE.group_id, SCOPE.field_id],
  );
  if (!window.rows.length) die('CURRENT_SOIL_MOISTURE_SENSING_WINDOW_MISSING');

  const win = window.rows[0];
  const sourceObservationIds = asArray(win.source_observation_ids_json).map(text).filter(Boolean);
  const observation = await client.query(
    `select * from device_observation_index_v1
      where tenant_id=$1 and project_id=$2 and group_id=$3 and field_id=$4 and metric='soil_moisture_percent'
        and (
          cardinality($5::text[]) = 0
          or fact_id = any($5::text[])
          or source_fact_id = any($5::text[])
          or observation_id = any($5::text[])
        )
      order by observed_at desc
      limit 1`,
    [SCOPE.tenant_id, SCOPE.project_id, SCOPE.group_id, SCOPE.field_id, sourceObservationIds],
  );
  if (!observation.rows.length) die('SOIL_MOISTURE_OBSERVATION_FOR_CURRENT_WINDOW_MISSING', { sourceObservationIds });

  const weather = await client.query(
    "select * from weather_forecast_index_v1 where tenant_id=$1 and project_id=$2 and group_id=$3 and field_id=$4 order by generated_at desc limit 1",
    [SCOPE.tenant_id, SCOPE.project_id, SCOPE.group_id, SCOPE.field_id],
  );
  if (!weather.rows.length) die('WEATHER_FORECAST_INPUT_MISSING');

  const obs = observation.rows[0];
  const wx = weather.rows[0];
  const input = {
    manifest_fact_id: manifest.rows[0].fact_id,
    observation_fact_id: text(obs.fact_id || obs.source_fact_id),
    source_observation_id: text(obs.observation_id || obs.fact_id || obs.source_fact_id),
    source_sensing_window_id: text(win.window_id),
    source_sensing_window_fact_id: text(win.source_fact_id),
    source_weather_forecast_id: text(wx.forecast_id),
    source_weather_forecast_fact_id: text(wx.source_fact_id || wx.forecast_id),
    soil_moisture_percent: num(obs.value_num),
    coverage_ratio: num(win.coverage_ratio),
    quality_status: text(win.quality_status),
    actual_points: num(win.actual_points),
    expected_points: num(win.expected_points),
    rainfall_forecast_mm_72h: num(wx.rainfall_forecast_mm_72h),
    et0_mm_72h: num(wx.et0_mm_72h),
    temperature_max_c_72h: num(wx.temperature_max_c_72h),
    source_input_role: 'CURRENT_STATE_INPUT',
  };
  rejectPostIrrigationInput(input);
  return input;
}

function buildPayload(input) {
  if (input.soil_moisture_percent == null) die('SOIL_MOISTURE_VALUE_MISSING');
  const water_state = classifyWaterState(input.soil_moisture_percent);
  const water_balance_72h_mm = input.rainfall_forecast_mm_72h == null || input.et0_mm_72h == null ? null : Number((input.rainfall_forecast_mm_72h - input.et0_mm_72h).toFixed(2));
  const confidence = confidenceFor(input);
  const hashInput = { version: VERSION, scope: SCOPE, input, water_state, water_balance_72h_mm, confidence };
  const determinism_hash = hashOf(hashInput);
  const estimate_id = `wse_h53_2_${determinism_hash.slice(0, 16)}`;
  return {
    type: 'water_state_estimate_v1',
    payload: {
      ...SCOPE,
      estimate_id,
      season_id: SEASON_ID,
      state: water_state,
      water_state,
      water_stress_state: water_state,
      latest_soil_moisture_percent: input.soil_moisture_percent,
      rainfall_forecast_mm_72h: input.rainfall_forecast_mm_72h,
      et0_mm_72h: input.et0_mm_72h,
      temperature_max_c_72h: input.temperature_max_c_72h,
      water_balance_72h_mm,
      confidence,
      confidence_level: confidence.level,
      confidence_score: confidence.score,
      derivation_version: VERSION,
      derivation_source: SOURCE,
      source_lane: 'H53_1_SENSING_ONLY_INPUTS',
      source_profile: 'c8-sensing-only',
      source_chain_id: 'C8_SENSING_ONLY_V1',
      source_input_role: input.source_input_role,
      source_manifest_fact_id: input.manifest_fact_id,
      source_observation_id: input.source_observation_id,
      source_observation_fact_id: input.observation_fact_id,
      source_sensing_window_id: input.source_sensing_window_id,
      source_sensing_window_fact_id: input.source_sensing_window_fact_id,
      source_weather_forecast_id: input.source_weather_forecast_id,
      source_weather_forecast_fact_id: input.source_weather_forecast_fact_id,
      evidence_refs: [
        { kind:'observation', ref_id: input.source_observation_id, schema_ref:'device_observation_index_v1' },
        { kind:'sensing_window', ref_id: input.source_sensing_window_id, schema_ref:'soil_moisture_sensing_window_index_v1' },
        { kind:'weather_forecast', ref_id: input.source_weather_forecast_id, schema_ref:'weather_forecast_index_v1' },
      ],
      rule: {
        name: 'H53_2_SIMPLE_SOIL_MOISTURE_THRESHOLD_V1',
        thresholds: { severe_deficit_lt: 16, moderate_deficit_lt: 22, adequate_lt: 30 },
        no_recommendation_created: true,
        current_state_only: true,
        post_irrigation_window_forbidden: true,
      },
      determinism_hash,
    },
  };
}

function recordForIndex(payload, factId) {
  return {
    tenant_id: payload.tenant_id,
    project_id: payload.project_id,
    group_id: payload.group_id,
    field_id: payload.field_id,
    estimate_id: payload.estimate_id,
    state_id: payload.estimate_id,
    season_id: payload.season_id,
    state: payload.state,
    water_state: payload.water_state,
    water_stress_state: payload.water_stress_state,
    confidence_level: payload.confidence_level,
    confidence_score: payload.confidence_score,
    evidence_refs_json: payload.evidence_refs,
    derivation_json: payload.rule,
    confidence_json: payload.confidence,
    calculation_inputs_json: payload,
    determinism_hash: payload.determinism_hash,
    source_fact_id: factId,
    computed_at: new Date(1700000000000).toISOString(),
    created_at: new Date(1700000000000).toISOString(),
    updated_at: new Date(1700000000000).toISOString(),
    status: 'AVAILABLE',
  };
}

async function insertIndex(client, payload, factId) {
  const columns = await tableColumns(client, 'water_state_estimate_index_v1');
  if (!columns.size) return { skipped: true, reason: 'TABLE_MISSING' };
  const row = recordForIndex(payload, factId);
  const keys = Object.keys(row).filter((key) => columns.has(key));
  const placeholders = keys.map((_, index) => `$${index + 1}`);
  const values = keys.map((key) => key.endsWith('_json') || key === 'calculation_inputs_json' || key === 'derivation_json' || key === 'confidence_json' ? JSON.stringify(row[key]) : row[key]);
  await client.query(`insert into water_state_estimate_index_v1 (${keys.join(',')}) values (${placeholders.join(',')}) on conflict do nothing`, values);
  return { skipped: false, columns: keys };
}

async function apply(record) {
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    const factId = record.payload.estimate_id;
    await client.query('BEGIN');
    await client.query(
      'insert into facts (fact_id, occurred_at, source, record_json) values ($1, now(), $2, $3::jsonb) on conflict do nothing',
      [factId, SOURCE, JSON.stringify(record)],
    );
    const indexResult = await insertIndex(client, record.payload, factId);
    await client.query('COMMIT');
    return { fact_id: factId, index: indexResult };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const dryRun = arg('--dry-run') || !arg('--apply');
  const client = new Client({ connectionString: DB });
  await client.connect();
  let input;
  try { input = await readInputs(client); } finally { await client.end(); }
  const record = buildPayload(input);
  for (const forbidden of forbiddenFactTypes) if (record.type === forbidden) die('FORBIDDEN_FACT_TYPE_BUILT', { forbidden });
  const result = dryRun ? null : await apply(record);
  console.log(JSON.stringify({ ok:true, derivation:'DERIVE_H53_2_WATER_STRESS_STATE_V1', dry_run:dryRun, source:SOURCE, fact_type:record.type, payload:record.payload, write_result:result }, null, 2));
}

main().catch((error) => die(error.message));
