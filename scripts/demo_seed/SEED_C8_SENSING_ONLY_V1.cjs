#!/usr/bin/env node
'use strict';

// scripts/demo_seed/SEED_C8_SENSING_ONLY_V1.cjs
// Purpose: derive a C8 sensing-only seed plan from the existing C8 builder without copying a separate data story.
// Boundary: this script only emits RawSignal / Observation layer facts and rows; it never emits State, Decision, Execution, Acceptance, ROI, or Field Memory objects.

const fs = require('node:fs');
const path = require('node:path');

const {
  C8_FORMAL_IRRIGATION_FULL_CHAIN_V1,
  buildC8FormalIrrigationFullChainDataset,
} = require('./datasets/C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.cjs');

const SOURCE_CHAIN_ID = C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.chain_id;
const PROFILE = 'c8-sensing-only';
const CHAIN_ID = 'C8_SENSING_ONLY_V1';
const SEED_OWNER = 'controlled_pilot_full_review_v1';
const SOURCE = 'C8_SENSING_ONLY_SEED_V1';
const PROJECT_ID = C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.project_id;
const GROUP_ID = C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.group_id;
const FIELD_ID = C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.field_id;
const DATASET_VERSION = C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.dataset_version;
const ALLOWED_TENANTS = new Set(['tenantA', 'demo']);
const RAW_BUILDER_PROFILE = 'c8-formal-chain';

const ALLOWED_TABLES = [
  'field_index_v1',
  'field_polygon_v1',
  'device_index_v1',
  'device_binding_index_v1',
  'device_status_index_v1',
  'device_capability',
  'telemetry_index_v1',
  'device_observation_index_v1',
  'soil_moisture_sensing_window_index_v1',
  'weather_forecast_index_v1',
];

const ALLOWED_FACT_TYPES = [
  'field_crop_season_v1',
  'device_observation_context_v1',
  'telemetry_observation_v1',
  'weather_forecast_fact_v1',
  'soil_moisture_sensing_window_v1',
  'controlled_pilot_full_review_manifest_v1',
  'sensing_only_manifest_v1',
];

const FORBIDDEN_FACT_TYPES = [
  'irrigation_requirement_skill_input_v1',
  'irrigation_requirement_v1',
  'water_state_estimate_v1',
  'root_zone_soil_water_state_v1',
  'root_zone_soil_water_forecast_v1',
  'irrigation_scenario_set_v1',
  'decision_recommendation_v1',
  'prescription_v1',
  'prescription_contract_v1',
  'approval_request_v1',
  'approval_decision_v1',
  'operation_plan_v1',
  'operation_plan_transition_v1',
  'operation_state_v1',
  'ao_act_task_v0',
  'ao_act_receipt_v1',
  'as_executed_record_v1',
  'evidence_artifact_v1',
  'acceptance_result_v1',
  'stage1_sensing_summary_v1',
  'skill_run_v1',
  'value_record_v1',
  'problem_state_v1',
  'problem_state_index_v1',
  'roi_ledger_v1',
  'field_memory_v1',
  'customer_report_v1',
  'projectReportV1',
  'customer_report_projection_v1',
  'project_report_v1',
  'report_projection_v1',
];

const FORBIDDEN_TABLES = [
  'irrigation_requirement_skill_input_index_v1',
  'irrigation_requirement_index_v1',
  'water_state_estimate_index_v1',
  'irrigation_scenario_set_index_v1',
  'decision_recommendation_index_v1',
  'prescription_contract_v1',
  'approval_requests_v1',
  'operation_state_v1',
  'operation_state_v1_optional',
  'roi_ledger_v1',
  'roi_ledger_v1_optional',
  'field_memory_v1',
  'field_memory_v1_optional',
  'customer_report_projection_v1',
  'project_report_v1',
  'report_projection_v1',
];

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^[\"']|[\"']$/g, '');
  }
}

loadEnv(path.resolve(process.cwd(), '.env.ci'));
loadEnv(path.resolve(process.cwd(), '.env'));

function parseArgs(argv) {
  const out = { mode: 'dry-run', apply: false, tenant: 'tenantA', explicitTenant: false, out: '', nowMs: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--apply') out.apply = true;
    else if (['--dry-run', '--export-json'].includes(item)) out.mode = item.slice(2);
    else if (item === '--tenant') { out.tenant = String(argv[++i] || '').trim(); out.explicitTenant = true; }
    else if (item.startsWith('--tenant=')) { out.tenant = item.slice('--tenant='.length).trim(); out.explicitTenant = true; }
    else if (item === '--profile') {
      const profile = String(argv[++i] || '').trim();
      if (profile !== PROFILE) throw new Error(`profile not allowed: ${profile}`);
    }
    else if (item.startsWith('--profile=')) {
      const profile = item.slice('--profile='.length).trim();
      if (profile !== PROFILE) throw new Error(`profile not allowed: ${profile}`);
    }
    else if (item === '--out') out.out = String(argv[++i] || '').trim();
    else if (item.startsWith('--out=')) out.out = item.slice('--out='.length).trim();
    else if (item === '--now-ms') out.nowMs = Number(argv[++i]);
    else if (item.startsWith('--now-ms=')) out.nowMs = Number(item.slice('--now-ms='.length));
  }
  if (out.apply && !out.explicitTenant) throw new Error('--apply requires explicit --tenant');
  if (!ALLOWED_TENANTS.has(out.tenant)) throw new Error(`tenant not allowed: ${out.tenant}`);
  if (out.nowMs !== null && !Number.isFinite(out.nowMs)) throw new Error('--now-ms must be finite');
  if (out.apply && out.mode === 'dry-run') out.mode = 'apply';
  return out;
}

function prefixOf(tenant) {
  return `c8_sensing_only_seed_${tenant}`;
}

function rawDataset(tenant, nowMs) {
  const resolvedNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  return buildC8FormalIrrigationFullChainDataset({
    tenant,
    profile: RAW_BUILDER_PROFILE,
    nowMs: resolvedNowMs,
    nowIso: new Date(resolvedNowMs).toISOString(),
  });
}

function factType(fact) {
  return String(fact?.record_json?.type || '').trim();
}

function cloneSensingFact(fact, tenant) {
  const prefix = prefixOf(tenant);
  const oldId = String(fact.fact_id || '').trim();
  const newId = oldId.startsWith('full_review_seed_')
    ? oldId.replace(/^full_review_seed_[^_]+/, prefix)
    : `${prefix}_${oldId || factType(fact)}`;
  const payload = { ...(fact?.record_json?.payload || {}) };
  payload.tenant_id = payload.tenant_id || tenant;
  payload.project_id = payload.project_id || PROJECT_ID;
  payload.group_id = payload.group_id || GROUP_ID;
  payload.field_id = payload.field_id || FIELD_ID;
  payload.seed_profile = PROFILE;
  payload.seed_owner = SEED_OWNER;
  payload.chain_mode = 'SENSING_ONLY';
  payload.source_chain_id = SOURCE_CHAIN_ID;
  payload.sensing_only = true;
  return {
    ...fact,
    fact_id: newId,
    source: SOURCE,
    record_json: { type: factType(fact), payload },
  };
}

function sensingManifest(tenant, nowIso) {
  return {
    sensing_only: true,
    seed_profile: PROFILE,
    seed_owner: SEED_OWNER,
    chain_mode: 'SENSING_ONLY',
    formalized_by_seed: false,
    source_chain_id: SOURCE_CHAIN_ID,
    chain_id: CHAIN_ID,
    tenant_id: tenant,
    project_id: PROJECT_ID,
    group_id: GROUP_ID,
    field_id: FIELD_ID,
    generated_at: nowIso,
    allowed_table_rows: ALLOWED_TABLES,
    allowed_fact_types: ALLOWED_FACT_TYPES,
    seed_forbidden_fact_types: FORBIDDEN_FACT_TYPES,
    seed_forbidden_table_rows: FORBIDDEN_TABLES,
  };
}

function createManifestFacts(tenant, nowIso) {
  const manifest = sensingManifest(tenant, nowIso);
  return [
    {
      fact_id: `${prefixOf(tenant)}_controlled_pilot_full_review_manifest_001`,
      occurred_at: nowIso,
      source: SOURCE,
      record_json: { type: 'controlled_pilot_full_review_manifest_v1', payload: manifest },
    },
    {
      fact_id: `${prefixOf(tenant)}_sensing_only_manifest_001`,
      occurred_at: nowIso,
      source: SOURCE,
      record_json: { type: 'sensing_only_manifest_v1', payload: manifest },
    },
  ];
}

function factsByType(facts) {
  const out = {};
  for (const fact of facts) (out[factType(fact)] ||= []).push(fact);
  for (const type of [...ALLOWED_FACT_TYPES, ...FORBIDDEN_FACT_TYPES]) out[type] ||= [];
  return out;
}

function weatherIndexRowsFromFacts(facts) {
  return facts
    .filter((fact) => factType(fact) === 'weather_forecast_fact_v1')
    .map((fact) => {
      const payload = fact.record_json.payload || {};
      const generatedAt = payload.generated_at || fact.occurred_at || new Date().toISOString();
      return {
        forecast_id: payload.forecast_id || fact.fact_id,
        tenant_id: payload.tenant_id,
        project_id: payload.project_id,
        group_id: payload.group_id,
        field_id: payload.field_id,
        provider: payload.provider || 'C8_EXTERNAL_WEATHER_SAMPLE',
        source_type: payload.source_type || 'CONTROLLED_PILOT_SEED',
        source_id: payload.source_id || SOURCE,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        generated_at: generatedAt,
        issue_time: payload.issue_time || generatedAt,
        forecast_version: payload.forecast_version || payload.forecast_id || fact.fact_id,
        provider_run_id: payload.provider_run_id ?? null,
        external_forecast_id: payload.external_forecast_id ?? null,
        version_json: payload.version || {},
        valid_from: payload.valid_from || generatedAt,
        valid_to: payload.valid_to || new Date(Date.parse(generatedAt) + 72 * 60 * 60 * 1000).toISOString(),
        horizon_hours: payload.horizon_hours || 72,
        rainfall_forecast_mm_72h: payload.rainfall_forecast_mm_72h ?? null,
        temperature_max_c_72h: payload.temperature_max_c_72h ?? null,
        et0_mm_72h: payload.et0_mm_72h ?? null,
        hourly_json: Array.isArray(payload.hourly) ? payload.hourly : [],
        quality_json: payload.quality || {},
        raw_payload_json: payload.raw_payload || null,
        source_fact_id: fact.fact_id,
      };
    });
}

function soilMoistureWindowRowsFromFacts(facts) {
  return facts
    .filter((fact) => factType(fact) === 'soil_moisture_sensing_window_v1')
    .map((fact) => {
      const payload = fact.record_json.payload || {};
      const minSamplesPerRequiredMetric = Number(
        typeof payload.min_samples_per_required_metric === 'object' && payload.min_samples_per_required_metric !== null
          ? payload.min_samples_per_required_metric[payload.metric]
          : payload.min_samples_per_required_metric,
      );
      return {
        window_id: payload.window_id || fact.fact_id,
        tenant_id: payload.tenant_id,
        project_id: payload.project_id,
        group_id: payload.group_id,
        field_id: payload.field_id,
        device_id: payload.device_id || 'dev_soil_c8_001',
        metric: payload.metric || 'soil_moisture_percent',
        window_start: payload.window_start,
        window_end: payload.window_end,
        expected_interval_ms: Number(payload.expected_interval_ms || 60000),
        expected_points: Number(payload.expected_points || payload.actual_points || 1),
        actual_points: Number(payload.actual_points || 1),
        min_total_samples_required: Number(payload.min_total_samples_required || 1),
        min_samples_per_required_metric: Number.isFinite(minSamplesPerRequiredMetric) ? minSamplesPerRequiredMetric : Number(payload.min_total_samples_required || 1),
        coverage_ratio: Number(payload.coverage_ratio ?? 1),
        min_coverage_ratio: Number(payload.min_coverage_ratio ?? 0),
        max_gap_ms: payload.max_gap_ms == null ? null : Number(payload.max_gap_ms),
        max_allowed_gap_ms: Number(payload.max_allowed_gap_ms || 900000),
        gap_count: Number(payload.gap_count || 0),
        quality_status: payload.quality_status || 'UNKNOWN',
        confidence_json: payload.confidence || {},
        summary_json: payload.summary || {},
        config_snapshot_json: payload.config_snapshot || {},
        evidence_refs_json: Array.isArray(payload.evidence_refs) ? payload.evidence_refs : [],
        source_fact_ids_json: Array.isArray(payload.source_fact_ids) ? payload.source_fact_ids : [],
        source_observation_ids_json: Array.isArray(payload.source_observation_ids) ? payload.source_observation_ids : [],
        source_fact_id: fact.fact_id,
      };
    })
    .filter((row) => row.window_start && row.window_end);
}

function filterRows(rows, facts) {
  const out = {};
  for (const table of ALLOWED_TABLES) out[table] = Array.isArray(rows?.[table]) ? rows[table] : [];
  out.soil_moisture_sensing_window_index_v1 = soilMoistureWindowRowsFromFacts(facts);
  if (!out.weather_forecast_index_v1.length) out.weather_forecast_index_v1 = weatherIndexRowsFromFacts(facts);
  return out;
}

function buildPlan(tenant, nowMs) {
  const builtAtMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const builtAtIso = new Date(builtAtMs).toISOString();
  const raw = rawDataset(tenant, builtAtMs);
  const sensingFacts = (raw.facts || [])
    .filter((fact) => ALLOWED_FACT_TYPES.includes(factType(fact)))
    .filter((fact) => !['controlled_pilot_full_review_manifest_v1'].includes(factType(fact)))
    .map((fact) => cloneSensingFact(fact, tenant));
  const facts = [...sensingFacts, ...createManifestFacts(tenant, builtAtIso)];
  const tables = filterRows(raw.rows || {}, facts);
  const manifest = sensingManifest(tenant, builtAtIso);
  return {
    ok: true,
    apply: false,
    tenant,
    tenant_id: tenant,
    project_id: PROJECT_ID,
    group_id: GROUP_ID,
    profile: PROFILE,
    chain_id: CHAIN_ID,
    source_chain_id: SOURCE_CHAIN_ID,
    source_lane: 'SENSING_ONLY',
    dataset_version: DATASET_VERSION,
    manifest,
    planned: {
      facts: facts.length,
      tables: Object.fromEntries(Object.entries(tables).map(([key, value]) => [key, value.length])),
      scenarios: ['/app/operator/fields/field_c8_demo/evidence-twin'],
    },
    planned_counts: {
      fields: tables.field_index_v1.length,
      devices: tables.device_index_v1.length,
      telemetry_rows: tables.telemetry_index_v1.length,
      device_observations: tables.device_observation_index_v1.length,
      soil_moisture_sensing_windows: tables.soil_moisture_sensing_window_index_v1.length,
      weather_forecast_rows: tables.weather_forecast_index_v1.length,
      sensing_facts: facts.length,
      forbidden_fact_rows: FORBIDDEN_FACT_TYPES.reduce((sum, type) => sum + (factsByType(facts)[type] || []).length, 0),
    },
    tables,
    facts,
    facts_by_type: factsByType(facts),
    warnings: [],
  };
}

function exportPlan(plan) {
  return {
    ok: true,
    tenant_id: plan.tenant_id,
    project_id: plan.project_id,
    group_id: plan.group_id,
    profile: plan.profile,
    chain_id: plan.chain_id,
    source_chain_id: plan.source_chain_id,
    source_lane: plan.source_lane,
    dataset_version: plan.dataset_version,
    manifest: plan.manifest,
    tables: plan.tables,
    facts_by_type: plan.facts_by_type,
    planned_counts: plan.planned_counts,
  };
}

function writeOut(obj, out) {
  const text = JSON.stringify(obj, null, 2);
  if (!out) {
    console.log(text);
    return;
  }
  const fullPath = path.resolve(out);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${text}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, out: fullPath }, null, 2));
}

function dbConfig() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL
    ? { connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL }
    : {
        host: process.env.PGHOST || '127.0.0.1',
        port: Number(process.env.PGPORT || 5433),
        user: process.env.PGUSER || 'landos',
        password: process.env.PGPASSWORD || 'landos_pwd',
        database: process.env.PGDATABASE || 'landos',
      };
}

async function columns(client, table) {
  const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table]).catch(() => ({ rows: [] }));
  return new Set((result.rows || []).map((row) => row.column_name));
}

async function insertRows(client, table, rows) {
  const cols = await columns(client, table);
  if (!cols.size) return 0;
  let count = 0;
  for (const row of rows) {
    const keys = Object.keys(row).filter((key) => cols.has(key));
    if (!keys.length) continue;
    const values = keys.map((key) => (row[key] && typeof row[key] === 'object') ? JSON.stringify(row[key]) : row[key]);
    const placeholders = keys.map((_key, index) => `$${index + 1}`).join(',');
    await client.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
    count += 1;
  }
  return count;
}

async function insertFacts(client, facts) {
  const cols = await columns(client, 'facts');
  if (!cols.size) return 0;
  let count = 0;
  for (const fact of facts) {
    const keys = Object.keys(fact).filter((key) => cols.has(key));
    if (!keys.length) continue;
    const values = keys.map((key) => (fact[key] && typeof fact[key] === 'object') ? JSON.stringify(fact[key]) : fact[key]);
    const placeholders = keys.map((_key, index) => `$${index + 1}`).join(',');
    await client.query(`INSERT INTO facts (${keys.join(',')}) VALUES (${placeholders}) ON CONFLICT (fact_id) DO NOTHING`, values);
    count += 1;
  }
  return count;
}

async function applyPlan(plan) {
  const { Pool } = require('pg');
  const pool = new Pool(dbConfig());
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tableCounts = {};
    for (const table of ALLOWED_TABLES) tableCounts[table] = await insertRows(client, table, plan.tables[table] || []);
    const factCount = await insertFacts(client, plan.facts);
    await client.query('COMMIT');
    return { ok: true, apply: true, tenant: plan.tenant, tenant_id: plan.tenant_id, project_id: plan.project_id, group_id: plan.group_id, profile: PROFILE, chain_id: CHAIN_ID, inserted: { facts: factCount, tables: tableCounts }, forbidden_fact_types: FORBIDDEN_FACT_TYPES, forbidden_table_rows: FORBIDDEN_TABLES };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const plan = buildPlan(args.tenant, args.nowMs);
  if (args.mode === 'export-json') return writeOut(exportPlan(plan), args.out);
  if (args.mode === 'dry-run') return writeOut({ ...plan, facts: undefined, tables: undefined, facts_by_type: undefined }, args.out);
  if (args.mode === 'apply') return writeOut(await applyPlan(plan), args.out);
  throw new Error(`unsupported mode: ${args.mode}`);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error) }, null, 2));
  process.exit(1);
});
