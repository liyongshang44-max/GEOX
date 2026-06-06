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
const FIELD_ID = 'field_c8_demo';
const TASK_ID = 'act_c8_irrigation_formal_001';
const OPERATION_ID = 'op_plan_c8_irrigation_formal_001';
const ACCEPTANCE_ID = 'acc_c8_irrigation_formal_001';
const MEMORY_ID = 'fm_c8_irrigation_response_001';

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
  assertOk(source.includes(PROFILE), 'E2E_PROFILE_LITERAL_REQUIRED', { profile: PROFILE });
  assertOk(source.includes('field_memory_written_by_seed'), 'E2E_FIELD_MEMORY_MANIFEST_FLAG_REQUIRED', null);
  assertOk(source.includes('field_memory_flow'), 'E2E_FIELD_MEMORY_FLOW_REQUIRED', null);
  assertOk(source.includes('/api/v1/device-observations/from-telemetry-facts'), 'E2E_DEVICE_OBSERVATION_DERIVATION_API_REQUIRED', null);
  assertOk(source.includes('/api/v1/field-memory/from-acceptance'), 'E2E_FIELD_MEMORY_DERIVATION_API_REQUIRED', null);
  assertOk(source.includes('/api/v1/as-executed/from-receipt'), 'E2E_AS_EXECUTED_DERIVATION_API_REQUIRED', null);
  assertOk(source.includes('/api/v1/roi-ledger/from-as-executed'), 'E2E_INTERIM_ROI_DERIVATION_API_REQUIRED', null);
  assertOk(source.includes('/api/v1/roi-ledger/formalize-from-acceptance'), 'E2E_FORMAL_ROI_DERIVATION_API_REQUIRED', null);
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
    'prescription_contract_v1',
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
  for (const type of ['stage1_sensing_summary_v1', 'skill_run_v1', 'value_record_v1']) {
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

  const formalChain = plan.formal_chain || {};
  assertOk(formalChain.operation_plan && formalChain.operation_plan.operation_plan_id === OPERATION_ID, 'E2E_FORMAL_OPERATION_PLAN_REQUIRED', formalChain.operation_plan || null);
  assertOk(formalChain.acceptance && formalChain.acceptance.acceptance_id === ACCEPTANCE_ID, 'E2E_FORMAL_ACCEPTANCE_REQUIRED', formalChain.acceptance || null);
  assertOk(!formalChain.field_memory || formalChain.field_memory.memory_id === MEMORY_ID, 'E2E_FORMAL_CHAIN_MEMORY_POINTER_INVALID', formalChain.field_memory || null);
}

function assertRuntimeResult(result, code) {
  assertOk(result && result.ok === true, code, result);
}

function runRuntime(args) {
  const common = ['--tenant', args.tenant, '--profile', PROFILE, '--base-url', args.baseUrl];
  const apply = runNode(args.seed, ['--apply', ...common], 'E2E_RUNTIME_APPLY_FAILED');
  assertRuntimeResult(apply, 'E2E_RUNTIME_APPLY_NOT_OK');

  const verify = runNode(args.seed, ['--verify-api', ...common], 'E2E_RUNTIME_VERIFY_API_FAILED');
  assertRuntimeResult(verify, 'E2E_RUNTIME_VERIFY_API_NOT_OK');

  assertOk(verify.customer_memory_count >= 1 || verify.customer_memory_count === undefined, 'E2E_CUSTOMER_MEMORY_MISSING', verify);
  assertOk(verify.checked_endpoints === undefined || verify.checked_endpoints.some((x) => String(x).includes('/api/v1/reports/operation')), 'E2E_OPERATION_REPORT_ENDPOINT_NOT_CHECKED', verify.checked_endpoints);
  assertOk(verify.checked_endpoints === undefined || verify.checked_endpoints.some((x) => String(x).includes('/api/v1/reports/field')), 'E2E_FIELD_REPORT_ENDPOINT_NOT_CHECKED', verify.checked_endpoints);

  return { apply, verify };
}

function main() {
  const args = parseArgs(process.argv);
  const seedPath = path.resolve(process.cwd(), args.seed);
  assertOk(fs.existsSync(seedPath), 'E2E_SEED_SCRIPT_NOT_FOUND', { seedPath });
  assertStaticSource(seedPath);

  const plan = runNode(args.seed, ['--export-json', '--tenant', args.tenant, '--profile', PROFILE], 'E2E_EXPORT_JSON_FAILED');
  assertExportContract(plan);

  const runtime = args.runtime ? runRuntime(args) : null;
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
      'prescription_contract_v1',
      'approval_requests_v1',
    ],
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error), detail: error && error.detail ? error.detail : null }, null, 2));
  process.exit(1);
}
