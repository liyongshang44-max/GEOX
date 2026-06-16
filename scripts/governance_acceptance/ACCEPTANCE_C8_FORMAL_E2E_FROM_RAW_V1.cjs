#!/usr/bin/env node
'use strict';

// scripts/governance_acceptance/ACCEPTANCE_C8_FORMAL_E2E_FROM_RAW_V1.cjs
// Purpose: lock the stricter C8 formal raw-evidence-to-report contract so seed cannot directly write derived/customer-visible conclusion projections.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PROFILE = 'c8-formal-e2e';
const DEFAULT_TENANT = 'tenantA';
const DEFAULT_SEED = 'scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs';
const TELEMETRY_ROUTE = 'apps/server/src/routes/telemetry_v1.ts';
const TELEMETRY_MIGRATION = 'apps/server/db/migrations/2026_06_06_c8_formal_e2e_telemetry_projection_v1.sql';
const FIELD_ID = 'field_c8_demo';
const TASK_ID = 'act_c8_irrigation_formal_001';
const OPERATION_ID = 'op_plan_c8_irrigation_formal_001';
const ACCEPTANCE_ID = 'acc_c8_irrigation_formal_001';
const MEMORY_ID = 'fm_c8_irrigation_response_001';
const PROJECT_ID = 'projectA';
const GROUP_ID = 'groupA';

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
  const args = { tenant: DEFAULT_TENANT, baseUrl: '', seed: DEFAULT_SEED, runtime: false };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--tenant') args.tenant = String(argv[++i] || '').trim();
    else if (item.startsWith('--tenant=')) args.tenant = item.slice('--tenant='.length).trim();
    else if (item === '--base-url') args.baseUrl = String(argv[++i] || '').trim();
    else if (item.startsWith('--base-url=')) args.baseUrl = item.slice('--base-url='.length).trim();
    else if (item === '--seed') args.seed = String(argv[++i] || '').trim();
    else if (item.startsWith('--seed=')) args.seed = item.slice('--seed='.length).trim();
    else if (item === '--runtime' || item === '--apply-runtime') args.runtime = true;
  }
  if (args.baseUrl) args.runtime = true;
  return args;
}

function fail(code, detail) {
  const err = new Error(code);
  err.detail = detail;
  throw err;
}

function assertOk(condition, code, detail) {
  if (!condition) fail(code, detail);
}

function runNode(script, cliArgs, code) {
  const result = spawnSync(process.execPath, [script, ...cliArgs], { encoding: 'utf8', cwd: process.cwd(), env: process.env });
  if (result.status !== 0) {
    fail(code, { status: result.status, stdout: result.stdout, stderr: result.stderr });
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`${code}_JSON_PARSE_FAILED`, { stdout: result.stdout, stderr: result.stderr, error: String(error && error.message ? error.message : error) });
  }
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

async function withDb(fn) {
  const { Pool } = require('pg');
  const pool = new Pool(dbConfig());
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

function authHeaders(tenant) {
  const token = process.env.GEOX_AO_ACT_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || process.env.ADMIN_TOKEN || 'tenant_a_admin_token';
  return { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-geox-token': token, 'x-geox-ao-act-token': token, 'x-ao-act-token': token, 'x-tenant-id': tenant, 'x-project-id': PROJECT_ID, 'x-group-id': GROUP_ID };
}

async function postJson(baseUrl, pathName, body, tenant) {
  const res = await fetch(`${baseUrl}${pathName}`, { method: 'POST', headers: authHeaders(tenant), body: JSON.stringify(body) });
  const raw = await res.text();
  let json = null;
  try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
  assertOk(res.status >= 200 && res.status < 300 && json && typeof json === 'object', 'E2E_RUNTIME_POST_FAILED', { path: pathName, status: res.status, raw, json });
  return json;
}

function isInterimRoiForAsExecuted(row, asExecutedId) {
  return Boolean(row && row.source_lane === 'AS_EXECUTED_SIGNAL' && row.trust_level === 'INTERIM_SUPPORTED' && row.customer_visible_value === false && row.as_executed_id === asExecutedId);
}

async function countInterimRoiRows(tenant, asExecutedId) {
  return withDb(async (pool) => {
    const q = await pool.query(
      `SELECT count(*)::int AS count
         FROM roi_ledger_v1
        WHERE tenant_id = $1
          AND project_id = $2
          AND group_id = $3
          AND as_executed_id = $4
          AND source_lane = 'AS_EXECUTED_SIGNAL'
          AND trust_level = 'INTERIM_SUPPORTED'`,
      [tenant, PROJECT_ID, GROUP_ID, asExecutedId],
    );
    return Number(q.rows?.[0]?.count || 0);
  });
}

async function duplicatedRoiTypesByAsExecuted(tenant, asExecutedId) {
  return withDb(async (pool) => {
    const q = await pool.query(
      `SELECT as_executed_id, roi_type, count(*)::int AS count
         FROM roi_ledger_v1
        WHERE tenant_id = $1
          AND project_id = $2
          AND group_id = $3
          AND as_executed_id = $4
        GROUP BY as_executed_id, roi_type
       HAVING count(*) > 1`,
      [tenant, PROJECT_ID, GROUP_ID, asExecutedId],
    );
    return q.rows || [];
  });
}

async function loadFormalMemoryRow(tenant) {
  return withDb(async (pool) => {
    const q = await pool.query(
      `SELECT memory_id, source_type, source_id, memory_lane, trust_level,
              customer_visible_memory, learning_eligible, formal_acceptance_id
         FROM field_memory_v1
        WHERE tenant_id = $1
          AND project_id = $2
          AND group_id = $3
          AND memory_id = $4
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [tenant, PROJECT_ID, GROUP_ID, MEMORY_ID],
    );
    return q.rows?.[0] || null;
  });
}

function tableRows(plan, name) {
  const rows = plan && plan.tables ? plan.tables[name] : undefined;
  return Array.isArray(rows) ? rows : [];
}

function facts(plan, type) {
  const rows = plan && plan.facts_by_type ? plan.facts_by_type[type] : undefined;
  return Array.isArray(rows) ? rows : [];
}

function assertTableEmpty(plan, tableName) {
  const rows = tableRows(plan, tableName);
  assertOk(rows.length === 0, `E2E_FORBIDDEN_SEED_TABLE_${tableName.toUpperCase()}`, { tableName, count: rows.length, sample: rows[0] || null });
}

function assertTablePresent(plan, tableName) {
  const rows = tableRows(plan, tableName);
  assertOk(rows.length >= 1, `E2E_REQUIRED_BASE_TABLE_${tableName.toUpperCase()}`, { tableName });
}

function assertFactPresent(plan, type) {
  const rows = facts(plan, type);
  assertOk(rows.length >= 1, `E2E_REQUIRED_FACT_${type.toUpperCase()}`, { type });
}

function assertStaticSource(seedPath) {
  const source = fs.readFileSync(seedPath, 'utf8');
  const routeSource = fs.readFileSync(path.resolve(process.cwd(), TELEMETRY_ROUTE), 'utf8');
  const migrationSource = fs.readFileSync(path.resolve(process.cwd(), TELEMETRY_MIGRATION), 'utf8');
  assertOk(source.includes(PROFILE), 'E2E_PROFILE_LITERAL_REQUIRED', { profile: PROFILE });
  assertOk(source.includes('field_memory_written_by_seed'), 'E2E_FIELD_MEMORY_MANIFEST_FLAG_REQUIRED', null);
  assertOk(source.includes('field_memory_flow'), 'E2E_FIELD_MEMORY_FLOW_REQUIRED', null);
  assertOk(source.includes('/api/v1/device-observations/from-telemetry-facts'), 'E2E_DEVICE_OBSERVATION_DERIVATION_API_REQUIRED', null);
  assertOk(routeSource.includes('requireAoActScopeV0(req, reply, "telemetry.write")'), 'E2E_DEVICE_OBSERVATION_WRITE_SCOPE_REQUIRED', null);
  assertOk(!routeSource.includes('CREATE TABLE IF NOT EXISTS telemetry_index_v1') && !routeSource.includes('CREATE TABLE IF NOT EXISTS device_observation_index_v1'), 'E2E_ROUTE_MUST_NOT_CREATE_PROJECTION_TABLES', null);
  assertOk(migrationSource.includes('CREATE TABLE IF NOT EXISTS telemetry_index_v1') && migrationSource.includes('CREATE TABLE IF NOT EXISTS device_observation_index_v1'), 'E2E_PROJECTION_SCHEMA_MIGRATION_REQUIRED', null);
  assertOk(source.includes('/api/v1/field-memory/from-acceptance'), 'E2E_FIELD_MEMORY_DERIVATION_API_REQUIRED', null);
  assertOk(source.includes('/api/v1/as-executed/from-receipt'), 'E2E_AS_EXECUTED_DERIVATION_API_REQUIRED', null);
  assertOk(source.includes('/api/v1/roi-ledger/from-as-executed'), 'E2E_INTERIM_ROI_DERIVATION_API_REQUIRED', null);
  assertOk(source.includes('/api/v1/roi-ledger/formalize-from-acceptance'), 'E2E_FORMAL_ROI_DERIVATION_API_REQUIRED', null);
  assertOk(source.includes('ROI_INTERIM_SIGNAL_READBACK_REQUIRED') && source.includes('isInterimRoiForAsExecuted'), 'E2E_INTERIM_ROI_READBACK_DEFENSE_REQUIRED', null);
  const roiDomainSource = fs.readFileSync(path.resolve(process.cwd(), 'apps/server/src/domain/roi/roi_ledger_v1.ts'), 'utf8');
  assertOk(roiDomainSource.includes('formalRoiTypeFromInterim') && roiDomainSource.includes('SOIL_MOISTURE_RESPONSE'), 'E2E_FORMAL_ROI_TYPE_MAPPING_REQUIRED', null);
}

function assertExportContract(plan) {
  assertOk(plan && plan.ok === true, 'E2E_EXPORT_NOT_OK', plan);
  assertOk(plan.profile === PROFILE, 'E2E_EXPORT_PROFILE_MISMATCH', { actual: plan.profile, expected: PROFILE });

  for (const tableName of [
    'device_observation_index_v1',
    'operation_state_v1_optional',
    'field_memory_v1',
    'roi_ledger_v1_optional',
    'customer_report_projection_v1',
    'project_report_v1',
    'report_projection_v1',
    'derived_sensing_state_v1',
    'stage1_sensing_state_v1',
    'telemetry_index_v1',
    'device_status_index_v1',
    'soil_moisture_sensing_window_index_v1',
    'approval_requests_v1',
  ]) {
    assertTableEmpty(plan, tableName);
  }

  for (const tableName of [
    'field_index_v1',
    'field_polygon_v1',
    'device_index_v1',
    'device_binding_index_v1',
    'device_capability',
    'prescription_contract_v1',
  ]) {
    assertTablePresent(plan, tableName);
  }

  for (const type of [
    'decision_recommendation_v1',
    'prescription_v1',
    'approval_request_v1',
    'approval_decision_v1',
    'operation_plan_v1',
    'operation_plan_transition_v1',
    'ao_act_task_v0',
    'ao_act_receipt_v1',
    'acceptance_result_v1',
    'evidence_artifact_v1',
    'telemetry_observation_v1',
  ]) {
    assertFactPresent(plan, type);
  }

  assertOk(facts(plan, 'telemetry_observation_v1').length >= 4, 'E2E_RAW_TELEMETRY_FACTS_REQUIRED', { count: facts(plan, 'telemetry_observation_v1').length });
  assertOk(facts(plan, 'ao_act_receipt_v1').length >= 1, 'E2E_RECEIPT_FACTS_REQUIRED', { count: facts(plan, 'ao_act_receipt_v1').length });
  assertOk(facts(plan, 'acceptance_result_v1').length >= 1, 'E2E_ACCEPTANCE_FACTS_REQUIRED', { count: facts(plan, 'acceptance_result_v1').length });
  assertOk(facts(plan, 'evidence_artifact_v1').length >= 2, 'E2E_FORMAL_EVIDENCE_FACTS_REQUIRED', { count: facts(plan, 'evidence_artifact_v1').length });
  for (const type of ['stage1_sensing_summary_v1', 'skill_run_v1', 'value_record_v1', 'soil_moisture_sensing_window_v1', 'soil_moisture_sensing_window_index_v1']) {
    assertOk(facts(plan, type).length === 0, `E2E_FORBIDDEN_FACT_${type.toUpperCase()}`, { type, count: facts(plan, type).length });
  }

  const manifest = plan.manifest || {};
  assertOk(manifest.raw_to_report_e2e === true, 'E2E_RAW_TO_REPORT_MANIFEST_FLAG_REQUIRED', manifest);
  assertOk(manifest.formalized_by_seed === false, 'E2E_FORMALIZED_BY_SEED_MUST_BE_FALSE', manifest);
  assertOk(manifest.field_memory_written_by_seed === false, 'E2E_FIELD_MEMORY_WRITTEN_BY_SEED_MUST_BE_FALSE', manifest);
  assertOk(Array.isArray(manifest.field_memory_flow), 'E2E_FIELD_MEMORY_FLOW_MISSING', manifest);
  for (const item of ['acceptance_result_v1', 'field-memory/from-acceptance', 'field_memory_v1']) {
    assertOk(manifest.field_memory_flow.includes(item), 'E2E_FIELD_MEMORY_FLOW_INCOMPLETE', { item, flow: manifest.field_memory_flow });
  }
  assertOk(Array.isArray(manifest.seed_forbidden_fact_types) && manifest.seed_forbidden_fact_types.includes('soil_moisture_sensing_window_v1'), 'E2E_SENSING_WINDOW_FACTS_FORBIDDEN_MANIFEST_REQUIRED', manifest);

  const formalChain = plan.formal_chain || {};
  assertOk(formalChain.operation_plan && formalChain.operation_plan.operation_plan_id === OPERATION_ID, 'E2E_FORMAL_OPERATION_PLAN_REQUIRED', formalChain.operation_plan || null);
  assertOk(formalChain.acceptance && formalChain.acceptance.acceptance_id === ACCEPTANCE_ID, 'E2E_FORMAL_ACCEPTANCE_REQUIRED', formalChain.acceptance || null);
  assertOk(!formalChain.field_memory || formalChain.field_memory.memory_id === MEMORY_ID, 'E2E_FORMAL_CHAIN_MEMORY_POINTER_INVALID', formalChain.field_memory || null);
  assertOk(!formalChain.soil_moisture_sensing_window && !formalChain.soil_moisture_sensing_window_negative_fixture, 'E2E_SENSING_WINDOW_FORMAL_CHAIN_FIXTURES_FORBIDDEN', formalChain);
}

function assertRuntimeResult(result, code) {
  assertOk(result && result.ok === true, code, result);
}

async function runRuntime(args) {
  const common = ['--tenant', args.tenant, '--profile', PROFILE, '--base-url', args.baseUrl];
  const apply = runNode(args.seed, ['--apply', ...common], 'E2E_RUNTIME_APPLY_FAILED');
  assertRuntimeResult(apply, 'E2E_RUNTIME_APPLY_NOT_OK');
  assertOk(apply.as_executed_derivation?.pre_field_memory_count === 0, 'E2E_FIELD_MEMORY_SEEDED_BEFORE_DERIVATION', apply.as_executed_derivation);

  const verify = runNode(args.seed, ['--verify-api', ...common], 'E2E_RUNTIME_VERIFY_API_FAILED');
  assertRuntimeResult(verify, 'E2E_RUNTIME_VERIFY_API_NOT_OK');

  assertOk(verify.customer_memory_count >= 1 || verify.customer_memory_count === undefined, 'E2E_CUSTOMER_MEMORY_MISSING', verify);
  assertOk(verify.checked_endpoints === undefined || verify.checked_endpoints.some((x) => String(x).includes('/api/v1/reports/operation')), 'E2E_OPERATION_REPORT_ENDPOINT_NOT_CHECKED', verify.checked_endpoints);
  assertOk(verify.checked_endpoints === undefined || verify.checked_endpoints.some((x) => String(x).includes('/api/v1/reports/field')), 'E2E_FIELD_REPORT_ENDPOINT_NOT_CHECKED', verify.checked_endpoints);

  const memory = await loadFormalMemoryRow(args.tenant);
  assertOk(Boolean(memory), 'E2E_FIELD_MEMORY_ROW_MISSING_AFTER_DERIVATION', null);
  assertOk(memory.source_type === 'acceptance_result_v1', 'E2E_FIELD_MEMORY_SOURCE_TYPE_MISMATCH', memory);
  assertOk(memory.source_id === ACCEPTANCE_ID, 'E2E_FIELD_MEMORY_SOURCE_ID_MISMATCH', memory);
  assertOk(memory.memory_lane === 'FORMAL_FIELD_MEMORY' && memory.trust_level === 'FORMAL_ACCEPTED', 'E2E_FIELD_MEMORY_TRUST_LAYER_MISMATCH', memory);
  assertOk(memory.customer_visible_memory === true && memory.learning_eligible === true, 'E2E_FIELD_MEMORY_VISIBILITY_MISMATCH', memory);
  assertOk(memory.formal_acceptance_id === ACCEPTANCE_ID, 'E2E_FIELD_MEMORY_ACCEPTANCE_MISMATCH', memory);

  const asExecutedId = verify.interim_roi?.as_executed_id || verify.as_executed?.as_executed_id;
  assertOk(Boolean(asExecutedId), 'E2E_INTERIM_ROI_AS_EXECUTED_ID_MISSING', verify.interim_roi || verify.as_executed || null);
  const roiBody = { tenant_id: args.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, as_executed_id: asExecutedId, skill_trace_id: 'skill_trace_c8_irrigation_001' };
  await postJson(args.baseUrl, '/api/v1/roi-ledger/from-as-executed', roiBody, args.tenant);
  const secondRoi = await postJson(args.baseUrl, '/api/v1/roi-ledger/from-as-executed', roiBody, args.tenant);
  const secondRows = Array.isArray(secondRoi.roi_ledgers) ? secondRoi.roi_ledgers : [];
  assertOk(secondRows.some((row) => isInterimRoiForAsExecuted(row, asExecutedId)), 'E2E_INTERIM_ROI_SECOND_DERIVATION_READBACK_REQUIRED', secondRoi);
  const interimCount = await countInterimRoiRows(args.tenant, asExecutedId);
  assertOk(interimCount === 1, 'E2E_INTERIM_ROI_DUPLICATE_ROWS_FORBIDDEN', { as_executed_id: asExecutedId, count: interimCount });
  const duplicatedTypes = await duplicatedRoiTypesByAsExecuted(args.tenant, asExecutedId);
  assertOk(duplicatedTypes.length === 0, 'E2E_ROI_FORMALIZE_DUPLICATED_ROI_TYPE_FORBIDDEN', duplicatedTypes);

  return { apply, verify, memory, repeated_interim_roi: secondRows.find((row) => isInterimRoiForAsExecuted(row, asExecutedId)), interim_roi_count: interimCount, duplicated_roi_types: duplicatedTypes };
}

async function main() {
  const args = parseArgs(process.argv);
  const seedPath = path.resolve(process.cwd(), args.seed);
  assertOk(fs.existsSync(seedPath), 'E2E_SEED_SCRIPT_NOT_FOUND', { seedPath });
  assertStaticSource(seedPath);

  const plan = runNode(args.seed, ['--export-json', '--tenant', args.tenant, '--profile', PROFILE], 'E2E_EXPORT_JSON_FAILED');
  assertExportContract(plan);

  const runtime = args.runtime ? await runRuntime(args) : null;
  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_C8_FORMAL_E2E_FROM_RAW_V1',
    profile: PROFILE,
    tenant: args.tenant,
    runtime_checked: Boolean(runtime),
    forbidden_projection_tables_checked: [
      'device_observation_index_v1',
      'operation_state_v1_optional',
      'field_memory_v1',
      'roi_ledger_v1_optional',
      'customer_report_projection_v1',
      'project_report_v1',
      'report_projection_v1',
      'derived_sensing_state_v1',
      'stage1_sensing_state_v1',
      'telemetry_index_v1',
      'device_status_index_v1',
      'soil_moisture_sensing_window_index_v1',
      'approval_requests_v1',
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error), detail: error && error.detail ? error.detail : null }, null, 2));
  process.exit(1);
});
