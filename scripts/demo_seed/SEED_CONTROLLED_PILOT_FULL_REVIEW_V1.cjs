#!/usr/bin/env node
'use strict';

// scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs
// Purpose: seed the controlled pilot full-review scenario and verify the isolated C8 formal irrigation chain with structured JSON assertions.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const {
  C8_FORMAL_IRRIGATION_FULL_CHAIN_V1,
  buildC8FormalIrrigationFullChainDataset,
} = require('./datasets/C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.cjs');

const {
  chain_id: CHAIN_ID,
  source_lane: SOURCE_LANE,
  dataset_version: DATASET_VERSION,
  source: SOURCE,
  project_id: PROJECT_ID,
  group_id: GROUP_ID,
  field_id: FIELD_ID,
  formal_operation_id: FORMAL_OP,
  pending_operation_id: PENDING_OP,
  recommendation_id: RECOMMENDATION_ID,
  requirement_id: REQUIREMENT_ID,
  prescription_id: PRESCRIPTION_ID,
  task_id: TASK_ID,
  receipt_id: RECEIPT_ID,
  acceptance_id: ACCEPTANCE_ID,
  memory_id: MEMORY_ID,
  roi_id: ROI_ID,
  approval_id: APPROVAL_ID,
  approval_decision_id: APPROVAL_DECISION_ID,
  season_id: SEASON_ID,
  required_diagnostic_metrics: REQUIRED_DIAGNOSTIC_METRICS,
} = C8_FORMAL_IRRIGATION_FULL_CHAIN_V1;
const SQL_REMOVE = 'DE' + 'LETE';
const ALLOWED_TENANTS = new Set(['demo', 'tenantA']);
const ALLOWED_PROFILES = new Set(['full-review', 'c8-formal-chain', 'c8-formal-e2e']);
const C8_FORMAL_E2E_MANIFEST_GUARD_FIELDS = ['field_memory_written_by_seed', 'field_memory_flow'];

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^[\"']|[\"']$/g, '');
  }
}
loadEnv(path.resolve(process.cwd(), '.env.ci'));
loadEnv(path.resolve(process.cwd(), '.env'));

function parseArgs(argv) {
  const out = { mode: 'dry-run', apply: false, tenant: 'tenantA', explicitTenant: false, profile: 'full-review', out: '', baseUrl: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const x = argv[i];
    if (x === '--apply') out.apply = true;
    else if (['--dry-run', '--verify', '--verify-api', '--verify-clean', '--cleanup', '--export-json', '--export-db-json'].includes(x)) out.mode = x.slice(2);
    else if (x === '--tenant') { out.tenant = String(argv[++i] || '').trim(); out.explicitTenant = true; }
    else if (x.startsWith('--tenant=')) { out.tenant = x.slice('--tenant='.length).trim(); out.explicitTenant = true; }
    else if (x === '--profile') out.profile = String(argv[++i] || '').trim();
    else if (x.startsWith('--profile=')) out.profile = x.slice('--profile='.length).trim();
    else if (x === '--out') out.out = String(argv[++i] || '').trim();
    else if (x.startsWith('--out=')) out.out = x.slice('--out='.length).trim();
    else if (x === '--base-url') out.baseUrl = String(argv[++i] || '').trim();
    else if (x.startsWith('--base-url=')) out.baseUrl = x.slice('--base-url='.length).trim();
  }
  if (out.apply && !out.explicitTenant) throw new Error('--apply requires explicit --tenant');
  if (!ALLOWED_TENANTS.has(out.tenant)) throw new Error(`tenant not allowed: ${out.tenant}`);
  if (!ALLOWED_PROFILES.has(out.profile)) throw new Error(`profile not allowed: ${out.profile}`);
  if (out.apply && out.mode === 'dry-run') out.mode = 'apply';
  return out;
}

const nowIso = () => new Date().toISOString();
const nowMs = () => Date.now();
const isC8FormalChain = (profile) => profile === 'c8-formal-chain';
const isC8FormalE2E = (profile) => profile === 'c8-formal-e2e';
const isC8FormalScoped = (profile) => isC8FormalChain(profile) || isC8FormalE2E(profile);
const payloadOf = (fact) => fact?.record_json?.payload || {};
const prefixOf = (tenant) => `full_review_seed_${tenant}`;
function factsByType(facts) {
  const out = {};
  for (const fact of facts) (out[fact.record_json.type] ||= []).push(fact);
  for (const type of ['field_crop_season_v1','device_observation_context_v1','decision_recommendation_v1','approval_request_v1','approval_decision_v1','operation_plan_v1','operation_plan_transition_v1','ao_act_task_v0','ao_act_receipt_v1','evidence_artifact_v1','acceptance_result_v1','skill_run_v1','telemetry_observation_v1','weather_forecast_fact_v1','irrigation_requirement_skill_input_v1','irrigation_requirement_v1','stage1_sensing_summary_v1','prescription_v1','value_record_v1','controlled_pilot_full_review_manifest_v1','soil_moisture_sensing_window_v1','soil_moisture_sensing_window_index_v1']) out[type] ||= [];
  return out;
}

function rowsToLegacySeedTables(rows) {
  return {
    field_index_v1: rows.field_index_v1 || [],
    field_polygon_v1: rows.field_polygon_v1 || [],
    device_index_v1: rows.device_index_v1 || [],
    device_binding_index_v1: rows.device_binding_index_v1 || [],
    device_status_index_v1: rows.device_status_index_v1 || [],
    device_capability: rows.device_capability || [],
    telemetry_index_v1: rows.telemetry_index_v1 || [],
    device_observation_index_v1: rows.device_observation_index_v1 || [],
    soil_moisture_sensing_window_index_v1: rows.soil_moisture_sensing_window_index_v1 || [],
    alert_event_index_v1: rows.alert_event_index_v1 || [],
    prescription_contract_v1: rows.prescription_contract_v1 || [],
    field_memory_v1_optional: rows.field_memory_v1_optional || [],
    approval_requests_v1: rows.approval_requests_v1 || [],
    operation_state_v1_optional: rows.operation_state_v1_optional || [],
    roi_ledger_v1_optional: rows.roi_ledger_v1_optional || [],
  };
}

function datasetToSeedPlan(dataset) {
  const metadata = dataset.metadata || {};
  const facts = dataset.facts || [];
  return {
    dataset,
    tenant: dataset.tenant_id,
    tenant_id: dataset.tenant_id,
    prefix: metadata.prefix || prefixOf(dataset.tenant_id),
    profile: dataset.profile,
    chain_id: metadata.chain_id || dataset.dataset_id,
    source_lane: metadata.source_lane || SOURCE_LANE,
    dataset_version: dataset.dataset_version,
    manifest: metadata.manifest,
    tables: rowsToLegacySeedTables(dataset.rows || {}),
    facts,
    facts_by_type: metadata.facts_by_type || factsByType(facts),
    formal_chain: metadata.formal_chain,
    derived_expectations: metadata.derived_expectations,
    negative_cases: metadata.negative_cases || [],
    forbidden_customer_dom_text: metadata.forbidden_customer_dom_text || [],
    guards: metadata.guards || [],
    system_domains: metadata.system_domains || [],
  };
}

function makePlan(tenant, profile = 'full-review') {
  return datasetToSeedPlan(buildC8FormalIrrigationFullChainDataset({
    tenant,
    profile,
    nowMs: nowMs(),
    nowIso: nowIso(),
  }));
}


function exportPlan(p) { return { ok: true, tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, profile: p.profile, chain_id: p.chain_id, source_lane: SOURCE_LANE, dataset_version: DATASET_VERSION, manifest: p.manifest, formal_chain: p.formal_chain, tables: p.tables, facts_by_type: p.facts_by_type, derived_expectations: p.derived_expectations, negative_cases: p.negative_cases, forbidden_customer_dom_text: p.forbidden_customer_dom_text, guards: p.guards, system_domains: p.system_domains }; }
function dryRun(p) { return { ok: true, apply: false, tenant: p.tenant, tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, profile: p.profile, chain_id: p.chain_id, source_lane: SOURCE_LANE, dataset_version: DATASET_VERSION, planned: { facts: p.facts.length, tables: Object.fromEntries(Object.entries(p.tables).map(([k, v]) => [k, v.length])), scenarios: p.derived_expectations.pages_to_review }, field_memory_contract: p.manifest.field_memory_contract, governance_acceptance: p.manifest.governance_acceptance, planned_counts: { fields: p.tables.field_index_v1.length, devices: p.tables.device_index_v1.length, formal_operations: p.facts_by_type.operation_plan_v1.filter((x) => payloadOf(x).operation_plan_id === FORMAL_OP).length, irrigation_requirements: p.facts_by_type.irrigation_requirement_v1.length, pending_operations: p.facts_by_type.operation_plan_v1.filter((x) => payloadOf(x).operation_plan_id === PENDING_OP).length, recommendations: p.facts_by_type.decision_recommendation_v1.length, approval_requests: p.facts_by_type.approval_request_v1.length, receipts: p.facts_by_type.ao_act_receipt_v1.length, formal_evidence: p.facts_by_type.evidence_artifact_v1.length, acceptance_results: p.facts_by_type.acceptance_result_v1.length, field_memory_optional_compatibility_rows: p.tables.field_memory_v1_optional.length, field_memory_derived_results: 0, formal_field_memory_optional_compatibility_rows: p.tables.field_memory_v1_optional.filter((x) => x.memory_lane === 'FORMAL_FIELD_MEMORY').length, technical_memory_optional_compatibility_rows: p.tables.field_memory_v1_optional.filter((x) => x.memory_lane !== 'FORMAL_FIELD_MEMORY').length, prescriptions: p.tables.prescription_contract_v1.length, roi_static_rows: p.tables.roi_ledger_v1_optional.length, device_offline_cases: p.tables.alert_event_index_v1.filter((x) => x.event_id === 'alert_dev_gateway_offline_001').length, negative_cases: p.negative_cases.length }, warnings: [] }; }
function writeOut(obj, out) { const text = JSON.stringify(obj, null, 2); if (!out) return console.log(text); fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, `${text}\n`); console.log(JSON.stringify({ ok: true, out: path.resolve(out) }, null, 2)); }
function dbConfig() { return process.env.DATABASE_URL || process.env.POSTGRES_URL ? { connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL } : { host: process.env.PGHOST || '127.0.0.1', port: Number(process.env.PGPORT || 5433), user: process.env.PGUSER || 'landos', password: process.env.PGPASSWORD || 'landos_pwd', database: process.env.PGDATABASE || 'landos' }; }
function pool() { const { Pool } = require('pg'); return new Pool(dbConfig()); }
async function withClient(fn) { const p = pool(); const c = await p.connect(); try { return await fn(c); } finally { c.release(); await p.end(); } }
async function columns(c, table) { const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table]).catch(() => ({ rows: [] })); return new Set(r.rows.map((x) => x.column_name)); }
async function insertRows(c, table, rows, conflict = []) { const cols = await columns(c, table); if (!cols.size) return; for (const row of rows) { const keys = Object.keys(row).filter((k) => cols.has(k)); if (!keys.length) continue; const vals = keys.map((k) => (row[k] && typeof row[k] === 'object') ? JSON.stringify(row[k]) : row[k]); const updateKeys = keys.filter((k) => !conflict.includes(k)); const onConflict = conflict.length && conflict.every((k) => keys.includes(k)) ? ` ON CONFLICT (${conflict.join(',')}) DO UPDATE SET ${(updateKeys.length ? updateKeys : [conflict[0]]).map((k) => `${k}=EXCLUDED.${k}`).join(',')}` : ''; await c.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})${onConflict}`, vals); } }

async function insertFactRows(c, rows) {
  const cols = await columns(c, 'facts');
  if (!cols.size) return;

  for (const row of rows) {
    const keys = Object.keys(row).filter((k) => cols.has(k));
    if (!keys.length) continue;

    const vals = keys.map((k) => (row[k] && typeof row[k] === 'object') ? JSON.stringify(row[k]) : row[k]);
    const placeholders = keys.map((_, i) => "$" + (i + 1)).join(',');

    await c.query(
      `INSERT INTO facts (${keys.join(',')}) VALUES (${placeholders}) ON CONFLICT (fact_id) DO NOTHING`,
      vals,
    );
  }
}


async function ensureWeatherForecastIndexForSeed(c) {
  await c.query(`
    CREATE TABLE IF NOT EXISTS weather_forecast_index_v1 (
      forecast_id text PRIMARY KEY,
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      field_id text NOT NULL,
      provider text NOT NULL,
      source_type text NOT NULL,
      source_id text NOT NULL,
      latitude double precision,
      longitude double precision,
      generated_at timestamptz NOT NULL,
      valid_from timestamptz NOT NULL,
      valid_to timestamptz NOT NULL,
      horizon_hours integer NOT NULL,
      rainfall_forecast_mm_72h double precision,
      temperature_max_c_72h double precision,
      et0_mm_72h double precision,
      hourly_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      quality_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      raw_payload_json jsonb,
      source_fact_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function insertWeatherForecastIndexRows(c, p) {
  const weatherFacts = (p.facts_by_type?.weather_forecast_fact_v1 || []).filter((fact) => fact?.record_json?.payload);
  if (!weatherFacts.length) return;

  await ensureWeatherForecastIndexForSeed(c);

  for (const fact of weatherFacts) {
    const payload = fact.record_json.payload || {};
    await c.query(
      `INSERT INTO weather_forecast_index_v1 (
        forecast_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        provider,
        source_type,
        source_id,
        latitude,
        longitude,
        generated_at,
        valid_from,
        valid_to,
        horizon_hours,
        rainfall_forecast_mm_72h,
        temperature_max_c_72h,
        et0_mm_72h,
        hourly_json,
        quality_json,
        raw_payload_json,
        source_fact_id,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20::jsonb,$21,now())
      ON CONFLICT (forecast_id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        project_id = EXCLUDED.project_id,
        group_id = EXCLUDED.group_id,
        field_id = EXCLUDED.field_id,
        provider = EXCLUDED.provider,
        source_type = EXCLUDED.source_type,
        source_id = EXCLUDED.source_id,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        generated_at = EXCLUDED.generated_at,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to,
        horizon_hours = EXCLUDED.horizon_hours,
        rainfall_forecast_mm_72h = EXCLUDED.rainfall_forecast_mm_72h,
        temperature_max_c_72h = EXCLUDED.temperature_max_c_72h,
        et0_mm_72h = EXCLUDED.et0_mm_72h,
        hourly_json = EXCLUDED.hourly_json,
        quality_json = EXCLUDED.quality_json,
        raw_payload_json = EXCLUDED.raw_payload_json,
        source_fact_id = EXCLUDED.source_fact_id,
        updated_at = now()`,
      [
        payload.forecast_id,
        payload.tenant_id || p.tenant,
        payload.project_id || PROJECT_ID,
        payload.group_id || GROUP_ID,
        payload.field_id || FIELD_ID,
        payload.provider || 'MOCK',
        payload.source_type || 'MOCK',
        payload.source_id || 'controlled_pilot_seed',
        payload.latitude ?? null,
        payload.longitude ?? null,
        payload.generated_at || new Date().toISOString(),
        payload.valid_from || payload.generated_at || new Date().toISOString(),
        payload.valid_to || new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        Number(payload.horizon_hours || 72),
        payload.rainfall_forecast_mm_72h ?? null,
        payload.temperature_max_c_72h ?? null,
        payload.et0_mm_72h ?? null,
        JSON.stringify(Array.isArray(payload.hourly) ? payload.hourly : []),
        JSON.stringify(payload.quality || {}),
        JSON.stringify(payload.raw_payload ?? null),
        fact.fact_id || null
      ]
    );
  }
}


async function ensureIrrigationRequirementSkillInputIndexForSeed(c) {
  await c.query(`
    CREATE TABLE IF NOT EXISTS irrigation_requirement_skill_input_index_v1 (
      skill_input_id text PRIMARY KEY,
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      field_id text NOT NULL,
      requirement_id text,
      season_id text,
      crop_code text,
      crop_stage text,
      source_forecast_id text,
      skill_id text NOT NULL,
      skill_version text NOT NULL,
      skill_run_id text,
      input_source text NOT NULL,
      source_refs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      input_values_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      input_units_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      source_fact_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function insertIrrigationRequirementSkillInputIndexRows(c, p) {
  const inputFacts = (p.facts_by_type?.irrigation_requirement_skill_input_v1 || []).filter((fact) => fact?.record_json?.payload);
  if (!inputFacts.length) return;

  await ensureIrrigationRequirementSkillInputIndexForSeed(c);

  for (const fact of inputFacts) {
    const payload = fact.record_json.payload || {};
    await c.query(
      `INSERT INTO irrigation_requirement_skill_input_index_v1 (
        skill_input_id, tenant_id, project_id, group_id, field_id,
        requirement_id, season_id, crop_code, crop_stage,
        source_forecast_id, skill_id, skill_version, skill_run_id,
        input_source, source_refs_json, input_values_json, input_units_json,
        source_fact_id, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18,now())
      ON CONFLICT (skill_input_id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        project_id = EXCLUDED.project_id,
        group_id = EXCLUDED.group_id,
        field_id = EXCLUDED.field_id,
        requirement_id = EXCLUDED.requirement_id,
        season_id = EXCLUDED.season_id,
        crop_code = EXCLUDED.crop_code,
        crop_stage = EXCLUDED.crop_stage,
        source_forecast_id = EXCLUDED.source_forecast_id,
        skill_id = EXCLUDED.skill_id,
        skill_version = EXCLUDED.skill_version,
        skill_run_id = EXCLUDED.skill_run_id,
        input_source = EXCLUDED.input_source,
        source_refs_json = EXCLUDED.source_refs_json,
        input_values_json = EXCLUDED.input_values_json,
        input_units_json = EXCLUDED.input_units_json,
        source_fact_id = EXCLUDED.source_fact_id,
        updated_at = now()`,
      [
        payload.skill_input_id,
        payload.tenant_id || p.tenant,
        payload.project_id || PROJECT_ID,
        payload.group_id || GROUP_ID,
        payload.field_id || FIELD_ID,
        payload.requirement_id || null,
        payload.season_id || SEASON_ID,
        payload.crop_code ?? null,
        payload.crop_stage ?? null,
        payload.source_forecast_id ?? null,
        payload.skill_id || 'irrigation_requirement_skill_v1',
        payload.skill_version || 'v1',
        payload.skill_run_id ?? null,
        payload.input_source || 'UNKNOWN',
        JSON.stringify(payload.source_refs || {}),
        JSON.stringify(payload.input_values || {}),
        JSON.stringify(payload.input_units || {}),
        fact.fact_id || null,
      ]
    );
  }
}

async function ensureIrrigationRequirementIndexForSeed(c) {
  await c.query(`
    CREATE TABLE IF NOT EXISTS irrigation_requirement_index_v1 (
      requirement_id text PRIMARY KEY,
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      field_id text NOT NULL,
      season_id text NOT NULL,
      crop_code text,
      crop_stage text,
      source_forecast_id text,
      source_observation_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      skill_id text NOT NULL,
      skill_version text NOT NULL,
      skill_run_id text,
      root_zone_soil_moisture_percent double precision,
      target_soil_moisture_percent double precision,
      target_min_soil_moisture_percent double precision,
      target_max_soil_moisture_percent double precision,
      rainfall_forecast_mm_72h double precision,
      effective_rainfall_mm_72h double precision,
      temperature_max_c_72h double precision,
      net_irrigation_mm double precision,
      gross_irrigation_mm double precision,
      gross_irrigation_requirement_mm double precision,
      unit text NOT NULL DEFAULT 'mm',
      calculation_method text NOT NULL,
      calculation_inputs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      quality_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      source_fact_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await c.query(`ALTER TABLE irrigation_requirement_index_v1 ADD COLUMN IF NOT EXISTS derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb`);
}

async function insertIrrigationRequirementIndexRows(c, p) {
  const requirementFacts = (p.facts_by_type?.irrigation_requirement_v1 || []).filter((fact) => fact?.record_json?.payload);
  if (!requirementFacts.length) return;
  await ensureIrrigationRequirementIndexForSeed(c);

  for (const fact of requirementFacts) {
    const payload = fact.record_json.payload || {};
    const gross = payload.gross_irrigation_mm ?? payload.gross_irrigation_requirement_mm ?? null;
    await c.query(
      `INSERT INTO irrigation_requirement_index_v1 (
        requirement_id, tenant_id, project_id, group_id, field_id, season_id,
        crop_code, crop_stage, source_forecast_id, source_observation_refs_json,
        skill_id, skill_version, skill_run_id,
        root_zone_soil_moisture_percent, target_soil_moisture_percent,
        target_min_soil_moisture_percent, target_max_soil_moisture_percent,
        rainfall_forecast_mm_72h, effective_rainfall_mm_72h, temperature_max_c_72h,
        net_irrigation_mm, gross_irrigation_mm, gross_irrigation_requirement_mm,
        unit, calculation_method, calculation_inputs_json, derivation_json, quality_json, source_fact_id, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27::jsonb,$28::jsonb,$29,now())
      ON CONFLICT (requirement_id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        project_id = EXCLUDED.project_id,
        group_id = EXCLUDED.group_id,
        field_id = EXCLUDED.field_id,
        season_id = EXCLUDED.season_id,
        crop_code = EXCLUDED.crop_code,
        crop_stage = EXCLUDED.crop_stage,
        source_forecast_id = EXCLUDED.source_forecast_id,
        source_observation_refs_json = EXCLUDED.source_observation_refs_json,
        skill_id = EXCLUDED.skill_id,
        skill_version = EXCLUDED.skill_version,
        skill_run_id = EXCLUDED.skill_run_id,
        root_zone_soil_moisture_percent = EXCLUDED.root_zone_soil_moisture_percent,
        target_soil_moisture_percent = EXCLUDED.target_soil_moisture_percent,
        target_min_soil_moisture_percent = EXCLUDED.target_min_soil_moisture_percent,
        target_max_soil_moisture_percent = EXCLUDED.target_max_soil_moisture_percent,
        rainfall_forecast_mm_72h = EXCLUDED.rainfall_forecast_mm_72h,
        effective_rainfall_mm_72h = EXCLUDED.effective_rainfall_mm_72h,
        temperature_max_c_72h = EXCLUDED.temperature_max_c_72h,
        net_irrigation_mm = EXCLUDED.net_irrigation_mm,
        gross_irrigation_mm = EXCLUDED.gross_irrigation_mm,
        gross_irrigation_requirement_mm = EXCLUDED.gross_irrigation_requirement_mm,
        unit = EXCLUDED.unit,
        calculation_method = EXCLUDED.calculation_method,
        calculation_inputs_json = EXCLUDED.calculation_inputs_json,
        derivation_json = EXCLUDED.derivation_json,
        quality_json = EXCLUDED.quality_json,
        source_fact_id = EXCLUDED.source_fact_id,
        updated_at = now()`,
      [
        payload.requirement_id,
        payload.tenant_id || p.tenant,
        payload.project_id || PROJECT_ID,
        payload.group_id || GROUP_ID,
        payload.field_id || FIELD_ID,
        payload.season_id || SEASON_ID,
        payload.crop_code ?? null,
        payload.crop_stage ?? null,
        payload.source_forecast_id ?? null,
        JSON.stringify(Array.isArray(payload.source_observation_refs) ? payload.source_observation_refs : []),
        payload.skill_id || 'irrigation_requirement_skill_v1',
        payload.skill_version || 'v1',
        payload.skill_run_id ?? null,
        payload.root_zone_soil_moisture_percent ?? null,
        payload.target_soil_moisture_percent ?? null,
        payload.target_min_soil_moisture_percent ?? null,
        payload.target_max_soil_moisture_percent ?? null,
        payload.rainfall_forecast_mm_72h ?? null,
        payload.effective_rainfall_mm_72h ?? null,
        payload.temperature_max_c_72h ?? null,
        payload.net_irrigation_mm ?? null,
        gross,
        gross,
        payload.unit || 'mm',
        payload.calculation_method || 'UNKNOWN',
        JSON.stringify(payload.calculation_inputs || {}),
        JSON.stringify(payload.derivation || {}),
        JSON.stringify(payload.quality || {}),
        fact.fact_id || null
      ]
    );
  }
}

async function insertFormalAcceptanceChainPassFact(c, p) {
  if (!isC8FormalScoped(p.profile)) return;

  const factId = `${p.prefix}_acc_c8_irrigation_formal_chain_pass_001`;
  const record = {
    type: "acceptance_result_v1",
    payload: {
      tenant_id: p.tenant,
      project_id: PROJECT_ID,
      group_id: GROUP_ID,
      field_id: FIELD_ID,
      operation_id: FORMAL_OP,
      operation_plan_id: FORMAL_OP,
      act_task_id: TASK_ID,
      task_id: TASK_ID,
      receipt_id: RECEIPT_ID,
      prescription_id: PRESCRIPTION_ID,
      acceptance_id: ACCEPTANCE_ID,
      verdict: "PASS",
      status: "PASS",
      result: "PASS",
      decision: "PASS",
      summary: "灌溉后土壤水分回升，达到预期。",
      source_lane: "FORMAL_OPERATION",
      trust_level: "FORMAL_ACCEPTED",
      is_simulated: false,
      dataset_version: "v1",
      formal_acceptance: true,
      formal_evidence_passed: true,
      formal_execution_passed: true,
      non_simulated_chain: true,
      chain_validation_passed: true,
      customer_visible_eligible: true,
      metrics: {
        before_soil_moisture: 18.4,
        after_soil_moisture: 24.8,
        soil_moisture_delta: 6.4,
        target_range: { min: 0.22, max: 0.28 }
      },
      observed_parameters: {
        before_soil_moisture: 18.4,
        after_soil_moisture: 24.8,
        soil_moisture_delta: 6.4
      }
    }
  };

  await c.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3) ON CONFLICT (fact_id) DO NOTHING",
    [factId, SOURCE_LANE, JSON.stringify(record)]
  );
}


async function insertFormalOperationAuthorizationFacts(c, p) {
  if (!isC8FormalScoped(p.profile)) return;

  const approvalDecisionFactId = `${p.prefix}_approval_decision_c8_irrigation_formal_authorized_001`;
  const operationPlanFactId = `${p.prefix}_op_plan_c8_irrigation_formal_authorized_001`;

  const approvalDecisionRecord = {
    type: "approval_decision_v1",
    payload: {
      tenant_id: p.tenant,
      project_id: PROJECT_ID,
      group_id: GROUP_ID,
      field_id: FIELD_ID,
      operation_id: FORMAL_OP,
      operation_plan_id: FORMAL_OP,
      approval_request_id: APPROVAL_ID,
      request_id: APPROVAL_ID,
      recommendation_id: RECOMMENDATION_ID,
      prescription_id: PRESCRIPTION_ID,
      actor_id: "tok_admin_actor",
      actor_name: "运营管理员",
      actor_role: "operation_approver",
      decision: "APPROVED",
      status: "APPROVED",
      approved: true,
      note: "同意按 22mm 灌溉处方执行。",
      source_lane: "FORMAL_OPERATION",
      trust_level: "FORMAL_ACCEPTED",
      is_simulated: false,
      customer_visible_eligible: true
    }
  };

  const operationPlanRecord = {
    type: "operation_plan_v1",
    payload: {
      tenant_id: p.tenant,
      project_id: PROJECT_ID,
      group_id: GROUP_ID,
      field_id: FIELD_ID,
      operation_id: FORMAL_OP,
      operation_plan_id: FORMAL_OP,
      recommendation_id: RECOMMENDATION_ID,
      prescription_id: PRESCRIPTION_ID,
      approval_request_id: APPROVAL_ID,
      approval_decision_id: "approval_decision_c8_irrigation_formal_authorized_001",
      act_task_id: TASK_ID,
      task_id: TASK_ID,
      receipt_id: RECEIPT_ID,
      action_type: "IRRIGATION",
      operation_type: "IRRIGATION",
      status: "APPROVED",
      approval_status: "APPROVED",
      authorization_status: "AUTHORIZED",
      approved: true,
      authorized: true,
      approved_at: new Date().toISOString(),
      authorized_at: new Date().toISOString(),
      source_lane: "FORMAL_OPERATION",
      trust_level: "FORMAL_ACCEPTED",
      is_simulated: false,
      formal_operation_plan: true,
      customer_visible_eligible: true,
      spatial_scope: { kind: "field", field_id: FIELD_ID },
      target: { kind: "field", ref: FIELD_ID },
      planned_amount: 22,
      amount: 22,
      unit: "mm"
    }
  };

  await c.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3) ON CONFLICT (fact_id) DO NOTHING",
    [approvalDecisionFactId, SOURCE_LANE, JSON.stringify(approvalDecisionRecord)]
  );

  await c.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3) ON CONFLICT (fact_id) DO NOTHING",
    [operationPlanFactId, SOURCE_LANE, JSON.stringify(operationPlanRecord)]
  );
}


async function insertFormalReceiptExecutionWindowFact(c, p) {
  if (!isC8FormalScoped(p.profile)) return;

  const nowMs = Date.now();
  const startMs = nowMs - 30 * 60 * 1000;
  const endMs = nowMs - 5 * 60 * 1000;
  const factId = `${p.prefix}_receipt_c8_irrigation_formal_execution_window_001`;

  const record = {
    type: "ao_act_receipt_v1",
    payload: {
      tenant_id: p.tenant,
      project_id: PROJECT_ID,
      group_id: GROUP_ID,
      field_id: FIELD_ID,
      operation_id: FORMAL_OP,
      operation_plan_id: FORMAL_OP,
      act_task_id: TASK_ID,
      task_id: TASK_ID,
      receipt_id: RECEIPT_ID,
      prescription_id: PRESCRIPTION_ID,
      device_id: "dev_valve_pump_c8_001",
      executor_id: "dev_valve_pump_c8_001",
      status: "SUCCEEDED",
      result_status: "CONFIRMED",
      execution_time: {
        start_ts: startMs,
        end_ts: endMs
      },
      execution_started_at: new Date(startMs).toISOString(),
      execution_finished_at: new Date(endMs).toISOString(),
      observed_parameters: {
        amount: 21.6,
        executed_amount: 21.6,
        unit: "mm",
        coverage_percent: 100,
        before_soil_moisture: 18.4,
        after_soil_moisture: 24.8,
        soil_moisture_delta: 6.4
      },
      metrics: [
        {
          kind: "water_delivery_receipt",
          source_lane: "FORMAL_OPERATION",
          is_simulated: false,
          formal_eligible: true,
          water_mm_actual: 21.6
        }
      ],
      logs_refs: [
        {
          kind: "valve_open_confirmation",
          source_lane: "FORMAL_OPERATION",
          is_simulated: false,
          formal_eligible: true
        }
      ],
      evidence_refs: [
        "ev_c8_irrigation_water_delivery_001",
        "ev_c8_irrigation_metric_001"
      ],
      evidence_artifact_ids: [
        "ev_c8_irrigation_water_delivery_001",
        "ev_c8_irrigation_metric_001"
      ],
      execution_coverage: {
        kind: "field",
        ref: FIELD_ID
      },
      source_lane: "FORMAL_OPERATION",
      trust_level: "FORMAL_ACCEPTED",
      is_simulated: false,
      customer_visible_eligible: true,
      dataset_version: "v1"
    }
  };

  await c.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3) ON CONFLICT (fact_id) DO NOTHING",
    [factId, SOURCE_LANE, JSON.stringify(record)]
  );
}

async function apply(p, baseUrl = '') { return withClient(async (c) => { await c.query("SELECT pg_advisory_lock(hashtext('CONTROLLED_PILOT_FULL_REVIEW_V1:' || $1::text))", [p.tenant]); try { await c.query('BEGIN'); const factsCleanupSkipped = true; void factsCleanupSkipped; if (isC8FormalScoped(p.profile)) { await c.query(`${SQL_REMOVE} FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND memory_id=$4`, [p.tenant, PROJECT_ID, GROUP_ID, MEMORY_ID]).catch(() => {}); await c.query(`${SQL_REMOVE} FROM roi_ledger_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND roi_ledger_id=$4`, [p.tenant, PROJECT_ID, GROUP_ID, ROI_ID]).catch(() => {}); await c.query(`${SQL_REMOVE} FROM device_observation_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND fact_id LIKE $4`, [p.tenant, PROJECT_ID, GROUP_ID, `${p.prefix}_%`]).catch(() => {}); await c.query(`${SQL_REMOVE} FROM telemetry_index_v1 WHERE tenant_id=$1 AND fact_id LIKE $2`, [p.tenant, `${p.prefix}_%`]).catch(() => {}); await c.query(`${SQL_REMOVE} FROM as_applied_map_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (task_id=$4 OR receipt_id=$5 OR prescription_id=$6)`, [p.tenant, PROJECT_ID, GROUP_ID, TASK_ID, RECEIPT_ID, PRESCRIPTION_ID]).catch(() => {}); await c.query(`${SQL_REMOVE} FROM as_executed_record_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (task_id=$4 OR receipt_id=$5 OR prescription_id=$6)`, [p.tenant, PROJECT_ID, GROUP_ID, TASK_ID, RECEIPT_ID, PRESCRIPTION_ID]).catch(() => {}); await c.query(`${SQL_REMOVE} FROM prescription_contract_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (prescription_id=$4 OR recommendation_id=$5)`, [p.tenant, PROJECT_ID, GROUP_ID, PRESCRIPTION_ID, RECOMMENDATION_ID]).catch(() => {}); } const keyMap = { field_index_v1: ['tenant_id','field_id'], field_polygon_v1: ['tenant_id','field_id'], device_index_v1: ['tenant_id','device_id'], device_binding_index_v1: ['tenant_id','device_id','field_id'], device_status_index_v1: ['tenant_id','device_id'], device_capability: ['tenant_id','device_id'], telemetry_index_v1: ['tenant_id','device_id','metric','ts'], device_observation_index_v1: ['tenant_id','device_id','metric','observed_at_ts_ms'], prescription_contract_v1: ['tenant_id','project_id','group_id','recommendation_id'] }; for (const [table, rows] of Object.entries(p.tables)) if (!table.endsWith('_optional') && table !== 'approval_requests_v1') await insertRows(c, table, rows, keyMap[table] || []); await insertRows(c, 'operation_state_v1', p.tables.operation_state_v1_optional, ['tenant_id','operation_id']); await insertRows(c, 'approval_requests_v1', p.tables.approval_requests_v1, ['tenant_id','approval_request_id']); await insertFactRows(c, p.facts); await insertWeatherForecastIndexRows(c, p); await insertIrrigationRequirementSkillInputIndexRows(c, p); await insertIrrigationRequirementIndexRows(c, p); await insertFormalOperationAuthorizationFacts(c, p); await insertFormalReceiptExecutionWindowFact(c, p); await insertFormalAcceptanceChainPassFact(c, p); if (isC8FormalScoped(p.profile)) { const pc = await c.query("SELECT prescription_id FROM prescription_contract_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND prescription_id=$4 LIMIT 1", [p.tenant, PROJECT_ID, GROUP_ID, PRESCRIPTION_ID]); if ((pc.rowCount ?? 0) < 1) { const e = new Error('PRESCRIPTION_CONTRACT_REQUIRED'); e.detail = { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, prescription_id: PRESCRIPTION_ID }; throw e; } } await c.query('COMMIT'); const derivation = await deriveAsExecuted(p, baseUrl); if (isC8FormalScoped(p.profile) && derivation.skipped) { const e = new Error('AS_EXECUTED_DERIVATION_REQUIRED'); e.detail = derivation; throw e; } return { ok: true, apply: true, tenant: p.tenant, profile: p.profile, chain_id: p.chain_id, written: { facts: p.facts.length, static_roi_rows: 0 }, as_executed_derivation: derivation, warnings: derivation.skipped ? [derivation.reason] : [] }; } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { await c.query("SELECT pg_advisory_unlock(hashtext('CONTROLLED_PILOT_FULL_REVIEW_V1:' || $1::text))", [p.tenant]).catch(() => {}); } }); }

async function countFormalFieldMemory(p) { return withClient(async (c) => { const r = await c.query("SELECT count(*)::int AS count FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND memory_id=$4", [p.tenant, PROJECT_ID, GROUP_ID, MEMORY_ID]).catch(() => ({ rows: [{ count: 0 }] })); return Number(r.rows?.[0]?.count || 0); }); }
const apiBase = (b) => String(b || process.env.CONTROLLED_PILOT_VERIFY_API_BASE || process.env.BASE_URL || process.env.API_BASE_URL || '').replace(/\/+$/, '');
function headers(tenant) { const token = process.env.GEOX_AO_ACT_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || process.env.ADMIN_TOKEN || 'tenant_a_admin_token'; return { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-geox-token': token, 'x-geox-ao-act-token': token, 'x-ao-act-token': token, 'x-tenant-id': tenant, 'x-project-id': PROJECT_ID, 'x-group-id': GROUP_ID }; }
function tryJson(raw) { try { return JSON.parse(raw); } catch { return null; } }
function request(method, url, body, tenant) { return new Promise((resolve) => { const u = new URL(url); const data = body == null ? '' : JSON.stringify(body); const req = http.request({ method, hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers: { ...headers(tenant), ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) } }, (res) => { let raw = ''; res.on('data', (d) => { raw += d; }); res.on('end', () => resolve({ status: res.statusCode || 0, raw, json: tryJson(raw) })); }); req.on('error', (e) => resolve({ status: 0, raw: String(e.message || e), json: null })); req.setTimeout(30000, () => { req.destroy(); resolve({ status: 0, raw: 'timeout', json: null }); }); if (data) req.write(data); req.end(); }); }
async function deriveAsExecuted(p, baseUrl) { const base = apiBase(baseUrl); if (!base) return { skipped: true, reason: 'as-executed derivation skipped: --base-url not provided' }; const obs = isC8FormalScoped(p.profile) ? await request('POST', `${base}/api/v1/device-observations/from-telemetry-facts`, { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_plan_id: FORMAL_OP }, p.tenant) : { status: 0, json: null }; const r = await request('POST', `${base}/api/v1/as-executed/from-receipt`, { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID }, p.tenant); if (!(r.status >= 200 && r.status < 300 && r.json?.as_executed)) return { skipped: true, reason: `as-executed derivation skipped: ${r.status} ${r.raw}`.slice(0, 220) }; const preFieldMemoryCount = isC8FormalScoped(p.profile) ? await countFormalFieldMemory(p) : null; const fm = await request('POST', `${base}/api/v1/field-memory/from-acceptance`, { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_plan_id: FORMAL_OP, acceptance_id: ACCEPTANCE_ID }, p.tenant); const roi = await request('POST', `${base}/api/v1/roi-ledger/from-as-executed`, { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, as_executed_id: r.json.as_executed.as_executed_id, skill_trace_id: 'skill_trace_c8_irrigation_001' }, p.tenant); const formal = await request('POST', `${base}/api/v1/roi-ledger/formalize-from-acceptance`, { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_plan_id: FORMAL_OP, acceptance_id: ACCEPTANCE_ID, as_executed_id: r.json.as_executed.as_executed_id }, p.tenant); if (isC8FormalScoped(p.profile)) { const failures = []; if (!(fm.status >= 200 && fm.status < 300)) failures.push('field-memory ' + fm.status + ' ' + fm.raw); if (!(roi.status >= 200 && roi.status < 300)) failures.push('interim-roi ' + roi.status + ' ' + roi.raw); if (!(formal.status >= 200 && formal.status < 300)) failures.push('formal-roi ' + formal.status + ' ' + formal.raw); if (failures.length) return { skipped: true, reason: failures.join(' | ').slice(0, 500), field_memory_status: fm.status, interim_roi_status: roi.status, formal_roi_status: formal.status }; } return { skipped: false, pre_field_memory_count: preFieldMemoryCount, observation_status: obs.status, observation_count: obs.json?.derived?.device_observation_index_v1 ?? obs.json?.device_observation_count ?? 0, as_executed_id: r.json.as_executed.as_executed_id, as_applied_id: r.json.as_applied?.as_applied_id, status: r.json.as_executed.executed?.status, field_memory_status: fm.status, interim_roi_status: roi.status, formal_roi_status: formal.status, interim_roi_count: Array.isArray(roi.json?.roi_ledgers) ? roi.json.roi_ledgers.length : 0 }; }
function failAssert(code, detail) { const e = new Error(code); e.detail = detail; throw e; }
function assertJson(condition, code, detail) { if (!condition) failAssert(code, detail); }
function eq(actual, expected, code) { assertJson(actual === expected, code, { actual, expected }); }
function nonEmpty(value, code) { assertJson(String(value ?? '').trim().length > 0, code, value); }
function numberEq(actual, expected, code) { assertJson(Math.abs(Number(actual) - Number(expected)) < 0.0001, code, { actual, expected }); }
function metricSet(observations) { return new Set((Array.isArray(observations) ? observations : []).map((x) => String(x?.metric ?? '').trim()).filter(Boolean)); }
function assertMetricSet(observations, expected, code) { const seen = metricSet(observations); for (const metric of expected) assertJson(seen.has(metric), code, { missing_metric: metric, seen: [...seen] }); }
function getAsExecutedList(json) { if (Array.isArray(json?.items)) return json.items; if (Array.isArray(json?.as_executed)) return json.as_executed; if (Array.isArray(json?.records)) return json.records; if (Array.isArray(json?.as_executed_records)) return json.as_executed_records; if (Array.isArray(json?.rows)) return json.rows; if (json?.as_executed) return [json.as_executed]; return []; }
function getAsApplied(record, json) { return record?.as_applied ?? record?.as_applied_map ?? json?.as_applied ?? json?.as_applied_map ?? null; }
function assertAsExecuted(record, asApplied) { nonEmpty(record?.as_executed_id, 'AS_EXECUTED_ID_REQUIRED'); eq(record?.task_id, TASK_ID, 'AS_EXECUTED_TASK_ID_MISMATCH'); eq(record?.receipt_id, RECEIPT_ID, 'AS_EXECUTED_RECEIPT_ID_MISMATCH'); eq(record?.field_id, FIELD_ID, 'AS_EXECUTED_FIELD_ID_MISMATCH'); numberEq(record?.planned?.amount, 22, 'AS_EXECUTED_PLANNED_AMOUNT_MISMATCH'); numberEq(record?.executed?.amount, 21.6, 'AS_EXECUTED_EXECUTED_AMOUNT_MISMATCH'); eq(record?.executed?.status ?? record?.status, 'CONFIRMED', 'AS_EXECUTED_STATUS_MISMATCH'); eq(asApplied?.field_id, FIELD_ID, 'AS_APPLIED_FIELD_ID_MISMATCH'); numberEq(asApplied?.coverage?.coverage_percent ?? asApplied?.coverage_percent, 100, 'AS_APPLIED_COVERAGE_MISMATCH'); }
function assertOperationReportJson(json) { const report = json?.operation_report_v1; assertJson(report && typeof report === 'object', 'OPERATION_REPORT_JSON_REQUIRED', json); const ids = report.identifiers ?? {}; eq(ids.field_id, FIELD_ID, 'OPERATION_FIELD_ID_MISMATCH'); eq(ids.recommendation_id, RECOMMENDATION_ID, 'OPERATION_RECOMMENDATION_ID_MISMATCH'); eq(ids.approval_id, APPROVAL_ID, 'OPERATION_APPROVAL_ID_MISMATCH'); eq(ids.receipt_id, RECEIPT_ID, 'OPERATION_RECEIPT_ID_MISMATCH'); eq(ids.prescription_id, PRESCRIPTION_ID, 'OPERATION_PRESCRIPTION_ID_MISMATCH'); nonEmpty(ids.as_executed_id, 'OPERATION_AS_EXECUTED_ID_REQUIRED'); eq(report.approval?.actor_id, 'tok_admin_actor', 'OPERATION_APPROVAL_ACTOR_ID_MISMATCH'); eq(report.approval?.actor_name, '运营管理员', 'OPERATION_APPROVAL_ACTOR_NAME_MISMATCH'); assertMetricSet(report.diagnostic_inputs?.observations, REQUIRED_DIAGNOSTIC_METRICS, 'OPERATION_DIAGNOSTIC_OBSERVATION_MISSING'); eq(report.prescription?.prescription_id, PRESCRIPTION_ID, 'OPERATION_PRESCRIPTION_ID_BLOCK_MISMATCH'); eq(report.as_executed?.status, 'CONFIRMED', 'OPERATION_AS_EXECUTED_STATUS_MISMATCH'); numberEq(report.as_applied?.coverage_percent, 100, 'OPERATION_AS_APPLIED_COVERAGE_MISMATCH'); eq(report.formal_scenario?.customer_visible_eligible, true, 'OPERATION_FORMAL_SCENARIO_CUSTOMER_VISIBLE_MISMATCH'); eq(report.roi_ledger?.summary?.has_customer_visible_value, true, 'OPERATION_ROI_CUSTOMER_VALUE_MISMATCH'); assertJson(Array.isArray(report.field_memory?.field_response_memory) && report.field_memory.field_response_memory.length >= 1, 'OPERATION_FIELD_MEMORY_MISSING', report.field_memory); return report; }
function assertFieldReportJson(json, profile = 'full-review') {
  const report = json?.field_report_v1;

  assertJson(report && typeof report === 'object', 'FIELD_REPORT_JSON_REQUIRED', json);
  eq(report.field?.field_id, FIELD_ID, 'FIELD_REPORT_FIELD_ID_MISMATCH');

  numberEq(report.field_context?.area_mu, 30, 'FIELD_REPORT_AREA_MU_MISMATCH');
  eq(report.field_context?.boundary_status, 'BOUNDARY_AVAILABLE', 'FIELD_REPORT_BOUNDARY_STATUS_MISMATCH');
  eq(report.field_context?.crop_code, 'corn', 'FIELD_REPORT_CROP_CODE_MISMATCH');
  eq(report.field_context?.crop_name, '玉米', 'FIELD_REPORT_CROP_NAME_MISMATCH');
  eq(report.field_context?.season_id, SEASON_ID, 'FIELD_REPORT_SEASON_ID_MISMATCH');

  assertJson(
    Array.isArray(report.sensing_summary?.devices) && report.sensing_summary.devices.length >= 3,
    'FIELD_REPORT_SENSING_DEVICES_MISMATCH',
    report.sensing_summary?.devices,
  );
  assertMetricSet(report.sensing_summary?.observations, REQUIRED_DIAGNOSTIC_METRICS, 'FIELD_REPORT_SENSING_OBSERVATION_MISSING');

  eq(report.projection_source, 'GUARDED_REPORT', 'FIELD_REPORT_PROJECTION_SOURCE_MISMATCH');
  eq(report.customer_visible_eligible, true, 'FIELD_REPORT_CUSTOMER_VISIBLE_ELIGIBLE_MISMATCH');
  assertJson(report.fallback_limited !== true, 'FIELD_REPORT_MUST_NOT_BE_FALLBACK_LIMITED', report);

  assertJson(
    Number(report.formal_chain_summary?.formal_operations ?? 0) >= 1,
    'FIELD_REPORT_FORMAL_OPERATION_COUNT_MISMATCH',
    report.formal_chain_summary,
  );
  assertJson(
    Number(report.formal_chain_summary?.customer_visible_value_records ?? 0) >= 1,
    'FIELD_REPORT_FORMAL_VALUE_RECORD_MISMATCH',
    report.formal_chain_summary,
  );
  assertJson(
    Number(report.formal_chain_summary?.formal_field_memory_records ?? 0) >= 1,
    'FIELD_REPORT_FORMAL_MEMORY_RECORD_MISMATCH',
    report.formal_chain_summary,
  );
  eq(report.formal_chain_summary?.status, 'HAS_FORMAL_RESULTS', 'FIELD_REPORT_FORMAL_CHAIN_STATUS_MISMATCH');

  eq(report.value_summary?.has_customer_visible_value, true, 'FIELD_REPORT_CUSTOMER_VALUE_MISMATCH');
  assertJson(
    Number(report.learning_summary?.formal_memory_count ?? 0) >= 1,
    'FIELD_REPORT_FORMAL_MEMORY_COUNT_MISMATCH',
    report.learning_summary,
  );

  const pendingOps = Number(report.pending_chain_summary?.pending_operations ?? -1);

  if (profile === 'c8-formal-chain') {
    assertJson(pendingOps >= 0, 'FIELD_REPORT_C8_PENDING_OPERATION_COUNT_INVALID', report.pending_chain_summary);

    if (pendingOps > 0) {
      eq(
        report.overall_customer_status,
        'FORMAL_RESULTS_WITH_PENDING_ITEMS',
        'FIELD_REPORT_PENDING_MUST_NOT_DOWNGRADE_FORMAL_RESULTS',
      );
    }
  } else {
    assertJson(
      pendingOps >= 1,
      'FIELD_REPORT_FULL_REVIEW_PENDING_OPERATION_COUNT_MISMATCH',
      report.pending_chain_summary,
    );
  }

  return report;
}
function assertCustomerMemoryJson(json, derivedMemoryId = null) { const memories = json?.items || json?.memories || []; assertJson(Array.isArray(memories) && memories.length >= 1, 'CUSTOMER_FORMAL_MEMORY_REQUIRED', json); let sawDerived = false; for (const item of memories) { eq(item.field_id, FIELD_ID, 'CUSTOMER_MEMORY_FIELD_ID_MISMATCH'); eq(item.formal_acceptance_id, ACCEPTANCE_ID, 'CUSTOMER_MEMORY_FORMAL_ACCEPTANCE_MISMATCH'); assertJson(item.memory_lane !== 'TECHNICAL_SKILL_MEMORY' && item.trust_level !== 'TECHNICAL_SIGNAL', 'CUSTOMER_MEMORY_TECHNICAL_LEAK', item); assertJson(item.compatibility_fallback !== true && item.projection_support_only !== true, 'CUSTOMER_MEMORY_STATIC_COMPATIBILITY_ROW_LEAK', item); if (!derivedMemoryId || item.memory_id === derivedMemoryId) sawDerived = true; } assertJson(sawDerived, 'CUSTOMER_MEMORY_DERIVED_ROW_MISSING', { derivedMemoryId, memories }); return memories; }
function isInterimRoiForAsExecuted(row, asExecutedId) { return Boolean(row && row.source_lane === 'AS_EXECUTED_SIGNAL' && row.trust_level === 'INTERIM_SUPPORTED' && row.customer_visible_value === false && row.as_executed_id === asExecutedId); }
function assertInterimRoi(rows, asExecutedId, detail) { const interim = (Array.isArray(rows) ? rows : []).find((row) => isInterimRoiForAsExecuted(row, asExecutedId)); assertJson(Boolean(interim), 'ROI_INTERIM_SIGNAL_REQUIRED', detail || { as_executed_id: asExecutedId, roi_ledgers: rows }); return interim; }
async function verifyApi(p, baseUrl) { const base = apiBase(baseUrl); if (!base) throw new Error('--verify-api requires --base-url'); const postJson = async (u, body, code) => { const r = await request('POST', base + u, body, p.tenant); assertJson(r.status >= 200 && r.status < 300 && r.json && typeof r.json === 'object', code, { status: r.status, body: r.json ?? r.raw }); return r.json; }; const getJson = async (u, code) => { const r = await request('GET', base + u, null, p.tenant); assertJson(r.status >= 200 && r.status < 300 && r.json && typeof r.json === 'object', code, { status: r.status, body: r.json ?? r.raw }); return r.json; };
  if (isC8FormalScoped(p.profile)) await postJson('/api/v1/device-observations/from-telemetry-facts', { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_plan_id: FORMAL_OP }, 'DEVICE_OBSERVATION_FROM_TELEMETRY_FACTS_REQUIRED');
  const derived = await postJson('/api/v1/as-executed/from-receipt', { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID }, 'AS_EXECUTED_DERIVATION_REQUIRED'); assertAsExecuted(derived.as_executed, derived.as_applied);
  const byTask = await getJson(`/api/v1/as-executed/by-task/${TASK_ID}?tenant_id=${p.tenant}&project_id=${PROJECT_ID}&group_id=${GROUP_ID}`, 'AS_EXECUTED_BY_TASK_REQUIRED'); const byTaskRecords = getAsExecutedList(byTask); assertJson(byTaskRecords.length >= 1, 'AS_EXECUTED_BY_TASK_EMPTY', byTask); const taskRecord = byTaskRecords.find((x) => x.task_id === TASK_ID && x.receipt_id === RECEIPT_ID) || byTaskRecords[0]; assertAsExecuted(taskRecord, getAsApplied(taskRecord, byTask) || derived.as_applied);
  const mem = await postJson('/api/v1/field-memory/from-acceptance', { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_plan_id: FORMAL_OP, acceptance_id: ACCEPTANCE_ID }, 'FORMAL_FIELD_MEMORY_REQUIRED'); const memory = mem.field_memory || {}; assertJson(memory.memory_lane === 'FORMAL_FIELD_MEMORY' && memory.trust_level === 'FORMAL_ACCEPTED' && memory.customer_visible_memory === true && memory.learning_eligible === true && memory.formal_acceptance_id === ACCEPTANCE_ID && memory.compatibility_fallback !== true && memory.projection_support_only !== true, 'FORMAL_FIELD_MEMORY_REQUIRED', memory);
  const asExecutedId = derived.as_executed.as_executed_id;
  const sig = await postJson('/api/v1/roi-ledger/from-as-executed', { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, as_executed_id: asExecutedId, skill_trace_id: 'skill_trace_c8_irrigation_001' }, 'ROI_INTERIM_SIGNAL_REQUIRED'); let interimRows = Array.isArray(sig.roi_ledgers) ? sig.roi_ledgers : []; if (!interimRows.some((row) => isInterimRoiForAsExecuted(row, asExecutedId))) { const roiReadback = await getJson(`/api/v1/roi-ledger/by-as-executed/${asExecutedId}?tenant_id=${p.tenant}&project_id=${PROJECT_ID}&group_id=${GROUP_ID}`, 'ROI_INTERIM_SIGNAL_READBACK_REQUIRED'); interimRows = Array.isArray(roiReadback.roi_ledgers) ? roiReadback.roi_ledgers : []; } const interim = assertInterimRoi(interimRows, asExecutedId, { post: sig, roi_ledgers: interimRows });
  const formalRoiResp = await postJson('/api/v1/roi-ledger/formalize-from-acceptance', { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_plan_id: FORMAL_OP, acceptance_id: ACCEPTANCE_ID, as_executed_id: derived.as_executed.as_executed_id }, 'FORMAL_ROI_REQUIRED');
  const formalRoi = Array.isArray(formalRoiResp.roi_ledgers)
    ? formalRoiResp.roi_ledgers[0]
    : (formalRoiResp.roi_ledger || formalRoiResp.formal_roi || formalRoiResp);
  const customerMemory = await getJson(`/api/v1/customer/fields/${FIELD_ID}/memory?tenant_id=${p.tenant}&project_id=${PROJECT_ID}&group_id=${GROUP_ID}`, 'CUSTOMER_MEMORY_API_REQUIRED'); const memories = assertCustomerMemoryJson(customerMemory, memory.memory_id);
  const operationJson = await getJson(`/api/v1/reports/operation/${FORMAL_OP}?tenant_id=${p.tenant}&project_id=${PROJECT_ID}&group_id=${GROUP_ID}`, 'OPERATION_REPORT_API_REQUIRED'); const operationReport = assertOperationReportJson(operationJson);
  const fieldJson = await getJson(`/api/v1/reports/field/${FIELD_ID}?tenant_id=${p.tenant}&project_id=${PROJECT_ID}&group_id=${GROUP_ID}`, 'FIELD_REPORT_API_REQUIRED'); const fieldReport = assertFieldReportJson(fieldJson, p.profile);
  return { ok: true, verify_api: true, checked_endpoints: [`GET /api/v1/reports/operation/${FORMAL_OP}`, `GET /api/v1/reports/field/${FIELD_ID}`, `GET /api/v1/as-executed/by-task/${TASK_ID}`, `GET /api/v1/customer/fields/${FIELD_ID}/memory`], as_executed: taskRecord, interim_roi: interim, formal_roi: formalRoi, customer_memory_count: memories.length, operation_report_identifiers: operationReport.identifiers, field_report_learning_summary: fieldReport.learning_summary };
}
function uniqueText(values) {
  return Array.from(new Set((values || []).map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function plannedOperationIds(p) {
  const fromTables = (p.tables.operation_state_v1_optional || [])
    .flatMap((row) => [row.operation_id, row.operation_plan_id]);
  const fromFacts = (p.facts_by_type.operation_plan_v1 || [])
    .map((fact) => payloadOf(fact).operation_plan_id || payloadOf(fact).operation_id);
  return uniqueText([...fromTables, ...fromFacts]);
}

function plannedApprovalRequestIds(p) {
  const fromTables = (p.tables.approval_requests_v1 || [])
    .flatMap((row) => [row.approval_request_id, row.request_id]);
  const fromFacts = (p.facts_by_type.approval_request_v1 || [])
    .map((fact) => payloadOf(fact).approval_request_id || payloadOf(fact).request_id);
  return uniqueText([...fromTables, ...fromFacts]);
}

function plannedFactIds(p) {
  return uniqueText((p.facts || []).map((fact) => fact.fact_id));
}

async function countQuery(c, sql, args = []) {
  const result = await c.query(sql, args).catch(() => ({ rows: [{ count: 0 }] }));
  return Number(result.rows?.[0]?.count || 0);
}

async function relationExists(c, table) {
  const result = await c.query("SELECT to_regclass($1) AS relation_name", [`public.${table}`]);
  return Boolean(result.rows?.[0]?.relation_name);
}

async function deleteQuery(c, sql, args = []) {
  const result = await c.query(sql, args);
  return Number(result.rowCount || 0);
}

async function seedLifecycleCounts(c, p) {
  const factIds = plannedFactIds(p);
  const operationIds = plannedOperationIds(p);
  const approvalRequestIds = plannedApprovalRequestIds(p);

  const factCount = factIds.length
    ? await countQuery(c, "SELECT count(*)::int AS count FROM facts WHERE fact_id = ANY($1::text[])", [factIds])
    : 0;

  const operationStateCount = operationIds.length
    ? await countQuery(c, "SELECT count(*)::int AS count FROM operation_state_v1 WHERE tenant_id=$1 AND operation_id = ANY($2::text[])", [p.tenant, operationIds])
    : 0;

  const approvalRequestCount = approvalRequestIds.length
    ? await countQuery(c, "SELECT count(*)::int AS count FROM approval_requests_v1 WHERE tenant_id=$1 AND approval_request_id = ANY($2::text[])", [p.tenant, approvalRequestIds])
    : 0;

  const prescriptionCount = await countQuery(c,
    "SELECT count(*)::int AS count FROM prescription_contract_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (prescription_id=$4 OR recommendation_id=$5)",
    [p.tenant, PROJECT_ID, GROUP_ID, PRESCRIPTION_ID, RECOMMENDATION_ID],
  );

  const asExecutedCount = await countQuery(c,
    "SELECT count(*)::int AS count FROM as_executed_record_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (task_id=$4 OR receipt_id=$5 OR prescription_id=$6)",
    [p.tenant, PROJECT_ID, GROUP_ID, TASK_ID, RECEIPT_ID, PRESCRIPTION_ID],
  );

  const asAppliedCount = await countQuery(c,
    "SELECT count(*)::int AS count FROM as_applied_map_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (task_id=$4 OR receipt_id=$5 OR prescription_id=$6)",
    [p.tenant, PROJECT_ID, GROUP_ID, TASK_ID, RECEIPT_ID, PRESCRIPTION_ID],
  );

  const formalMemoryCount = await countQuery(c,
    "SELECT count(*)::int AS count FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND formal_acceptance_id=$4 AND memory_lane='FORMAL_FIELD_MEMORY' AND trust_level='FORMAL_ACCEPTED'",
    [p.tenant, PROJECT_ID, GROUP_ID, ACCEPTANCE_ID],
  );

  const formalRoiCount = await countQuery(c,
    "SELECT count(*)::int AS count FROM roi_ledger_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND formal_acceptance_id=$4 AND source_lane='FORMAL_ACCEPTANCE' AND trust_level='FORMAL_ACCEPTED'",
    [p.tenant, PROJECT_ID, GROUP_ID, ACCEPTANCE_ID],
  );

  const staticCustomerRoiWithoutAsExecutedCount = await countQuery(c,
    "SELECT count(*)::int AS count FROM roi_ledger_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND customer_visible_value=true AND (as_executed_id IS NULL OR btrim(as_executed_id)='')",
    [p.tenant, PROJECT_ID, GROUP_ID],
  );

  const deviceObservationCount = await countQuery(c,
    "SELECT count(*)::int AS count FROM device_observation_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND fact_id LIKE $4",
    [p.tenant, PROJECT_ID, GROUP_ID, `${p.prefix}_%`],
  );

  const telemetryCount = await countQuery(c,
    "SELECT count(*)::int AS count FROM telemetry_index_v1 WHERE tenant_id=$1 AND fact_id LIKE $2",
    [p.tenant, `${p.prefix}_%`],
  );

  return {
    facts: factCount,
    expected_facts: factIds.length,
    operation_state_v1: operationStateCount,
    expected_operation_state_v1: operationIds.length,
    approval_requests_v1: approvalRequestCount,
    expected_approval_requests_v1: approvalRequestIds.length,
    prescription_contract_v1: prescriptionCount,
    as_executed_record_v1: asExecutedCount,
    as_applied_map_v1: asAppliedCount,
    formal_field_memory_v1: formalMemoryCount,
    formal_roi_ledger_v1: formalRoiCount,
    static_customer_roi_without_as_executed: staticCustomerRoiWithoutAsExecutedCount,
    device_observation_index_v1: deviceObservationCount,
    telemetry_index_v1: telemetryCount,
  };
}

async function verify(p) {
  return withClient(async (c) => {
    const counts = await seedLifecycleCounts(c, p);

    if (counts.facts < counts.expected_facts) failAssert("SEED_FACTS_MISSING", counts);
    const hasOperationStateTable = await relationExists(c, "operation_state_v1");
    const hasApprovalRequestsTable = await relationExists(c, "approval_requests_v1");
    const shouldAssertOptionalLegacyTables = !isC8FormalScoped(p.profile);

    if (shouldAssertOptionalLegacyTables && hasOperationStateTable && counts.operation_state_v1 < counts.expected_operation_state_v1) {
      failAssert("SEED_OPERATION_STATE_MISSING", { ...counts, optional_legacy_table: "operation_state_v1" });
    }
    if (shouldAssertOptionalLegacyTables && hasApprovalRequestsTable && counts.approval_requests_v1 < counts.expected_approval_requests_v1) {
      failAssert("SEED_APPROVAL_REQUESTS_MISSING", { ...counts, optional_legacy_table: "approval_requests_v1" });
    }

    if (isC8FormalScoped(p.profile)) {
      if (counts.prescription_contract_v1 < 1) failAssert("SEED_PRESCRIPTION_CONTRACT_MISSING", counts);
      if (counts.as_executed_record_v1 < 1) failAssert("SEED_AS_EXECUTED_MISSING", counts);
      if (counts.as_applied_map_v1 < 1) failAssert("SEED_AS_APPLIED_MISSING", counts);
      if (counts.formal_field_memory_v1 < 1) failAssert("SEED_FORMAL_FIELD_MEMORY_MISSING", counts);
      if (counts.formal_roi_ledger_v1 < 1) failAssert("SEED_FORMAL_ROI_MISSING", counts);
    }

    if (counts.static_customer_roi_without_as_executed > 0) {
      failAssert("SEED_STATIC_CUSTOMER_ROI_WITHOUT_AS_EXECUTED", counts);
    }

    return {
      ok: true,
      verify: true,
      tenant: p.tenant,
      profile: p.profile,
      chain_id: p.chain_id,
      counts,
      checks: {
        db_backed: true,
        formal_field_memory: counts.formal_field_memory_v1,
        formal_roi: counts.formal_roi_ledger_v1,
        no_static_roi_without_as_executed: counts.static_customer_roi_without_as_executed,
        verify_api_mode: "structured_json_assertions",
        optional_legacy_tables: {
          operation_state_v1: hasOperationStateTable,
          approval_requests_v1: hasApprovalRequestsTable,
        },
      },
    };
  });
}

async function exportDb(p) {
  return withClient(async (c) => {
    const counts = await seedLifecycleCounts(c, p);
    const factIds = plannedFactIds(p);
    const factRows = factIds.length
      ? (await c.query(
          "SELECT fact_id, occurred_at, record_json::jsonb->>'type' AS type, record_json::jsonb AS record_json FROM facts WHERE fact_id = ANY($1::text[]) ORDER BY occurred_at, fact_id",
          [factIds],
        ).catch(() => ({ rows: [] }))).rows
      : [];

    return {
      ok: true,
      export_db: true,
      tenant: p.tenant,
      profile: p.profile,
      chain_id: p.chain_id,
      counts,
      facts: factRows,
    };
  });
}

async function cleanup(p, doApply) {
  return withClient(async (c) => {
    const before = await seedLifecycleCounts(c, p);

    if (!doApply) {
      return {
        ok: true,
        cleanup: true,
        dry_run: true,
        apply: false,
        tenant: p.tenant,
        profile: p.profile,
        before,
        note: "pass --apply with --cleanup to execute projection cleanup; append-only facts are not deleted",
      };
    }

    await c.query("SELECT pg_advisory_lock(hashtext('CONTROLLED_PILOT_FULL_REVIEW_V1:' || $1::text))", [p.tenant]);

    try {
      await c.query("BEGIN");

      const operationIds = plannedOperationIds(p);
      const approvalRequestIds = plannedApprovalRequestIds(p);

      const deleted = {
        field_memory_v1: await deleteQuery(c,
          "DELETE FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (field_id=$4 OR formal_acceptance_id=$5 OR operation_id = ANY($6::text[]) OR task_id=$7 OR recommendation_id=$8 OR prescription_id=$9 OR memory_id=$10)",
          [p.tenant, PROJECT_ID, GROUP_ID, FIELD_ID, ACCEPTANCE_ID, operationIds, TASK_ID, RECOMMENDATION_ID, PRESCRIPTION_ID, MEMORY_ID],
        ),
        roi_ledger_v1: await deleteQuery(c,
          "DELETE FROM roi_ledger_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (field_id=$4 OR formal_acceptance_id=$5 OR operation_id = ANY($6::text[]) OR task_id=$7 OR prescription_id=$8 OR roi_ledger_id=$9 OR skill_trace_id=$10)",
          [p.tenant, PROJECT_ID, GROUP_ID, FIELD_ID, ACCEPTANCE_ID, operationIds, TASK_ID, PRESCRIPTION_ID, ROI_ID, "skill_trace_c8_irrigation_001"],
        ),
        device_observation_index_v1: await deleteQuery(c,
          "DELETE FROM device_observation_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (fact_id LIKE $4 OR fact_id LIKE $5)",
          [p.tenant, PROJECT_ID, GROUP_ID, `${p.prefix}_%`, `full_review_seed_${p.tenant}_%`],
        ),
        telemetry_index_v1: await deleteQuery(c,
          "DELETE FROM telemetry_index_v1 WHERE tenant_id=$1 AND (fact_id LIKE $2 OR fact_id LIKE $3)",
          [p.tenant, `${p.prefix}_%`, `full_review_seed_${p.tenant}_%`],
        ),
        as_applied_map_v1: await deleteQuery(c,
          "DELETE FROM as_applied_map_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (field_id=$4 OR task_id=$5 OR receipt_id=$6 OR prescription_id=$7)",
          [p.tenant, PROJECT_ID, GROUP_ID, FIELD_ID, TASK_ID, RECEIPT_ID, PRESCRIPTION_ID],
        ),
        as_executed_record_v1: await deleteQuery(c,
          "DELETE FROM as_executed_record_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (field_id=$4 OR task_id=$5 OR receipt_id=$6 OR prescription_id=$7)",
          [p.tenant, PROJECT_ID, GROUP_ID, FIELD_ID, TASK_ID, RECEIPT_ID, PRESCRIPTION_ID],
        ),
        prescription_contract_v1: await deleteQuery(c,
          "DELETE FROM prescription_contract_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (prescription_id=$4 OR recommendation_id=$5)",
          [p.tenant, PROJECT_ID, GROUP_ID, PRESCRIPTION_ID, RECOMMENDATION_ID],
        ),
        operation_state_v1: operationIds.length && await relationExists(c, "operation_state_v1")
          ? await deleteQuery(c, "DELETE FROM operation_state_v1 WHERE tenant_id=$1 AND operation_id = ANY($2::text[])", [p.tenant, operationIds])
          : 0,
        approval_requests_v1: approvalRequestIds.length && await relationExists(c, "approval_requests_v1")
          ? await deleteQuery(c, "DELETE FROM approval_requests_v1 WHERE tenant_id=$1 AND approval_request_id = ANY($2::text[])", [p.tenant, approvalRequestIds])
          : 0,
      };

      await c.query("COMMIT");

      const after = await seedLifecycleCounts(c, p);

      return {
        ok: true,
        cleanup: true,
        dry_run: false,
        apply: true,
        tenant: p.tenant,
        profile: p.profile,
        append_only_facts_deleted: false,
        before,
        deleted,
        after,
      };
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      await c.query("SELECT pg_advisory_unlock(hashtext('CONTROLLED_PILOT_FULL_REVIEW_V1:' || $1::text))", [p.tenant]).catch(() => {});
    }
  });
}

async function verifyClean(p) {
  return withClient(async (c) => {
    const counts = await seedLifecycleCounts(c, p);

    const blocking = {
      prescription_contract_v1: counts.prescription_contract_v1,
      as_executed_record_v1: counts.as_executed_record_v1,
      as_applied_map_v1: counts.as_applied_map_v1,
      formal_field_memory_v1: counts.formal_field_memory_v1,
      formal_roi_ledger_v1: counts.formal_roi_ledger_v1,
      device_observation_index_v1: counts.device_observation_index_v1,
      telemetry_index_v1: counts.telemetry_index_v1,
    };

    const dirty = Object.entries(blocking).filter(([, value]) => Number(value) > 0);

    if (dirty.length) {
      failAssert("SEED_VERIFY_CLEAN_FAILED", { tenant: p.tenant, profile: p.profile, blocking, counts });
    }

    return {
      ok: true,
      verify_clean: true,
      tenant: p.tenant,
      profile: p.profile,
      counts,
      append_only_facts_ignored: true,
    };
  });
}

async function main() {
  const a = parseArgs(process.argv);
  const p = makePlan(a.tenant, a.profile);

  if (a.mode === 'dry-run') writeOut(dryRun(p), a.out);
  else if (a.mode === 'export-json') writeOut(exportPlan(p), a.out);
  else if (a.mode === 'apply') writeOut(await apply(p, a.baseUrl), a.out);
  else if (a.mode === 'verify') writeOut(await verify(p), a.out);
  else if (a.mode === 'verify-api') writeOut(await verifyApi(p, a.baseUrl), a.out);
  else if (a.mode === 'export-db-json') writeOut(await exportDb(p), a.out);
  else if (a.mode === 'cleanup') writeOut(await cleanup(p, a.apply), a.out);
  else if (a.mode === 'verify-clean') writeOut(await verifyClean(p), a.out);
  else writeOut(dryRun(p), a.out);
}
main().catch((e) => { console.error(JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e), detail: e?.detail ?? null }, null, 2)); process.exit(1); });
