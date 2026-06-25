#!/usr/bin/env node
'use strict';

// scripts/governance_acceptance/ACCEPTANCE_C8_SENSING_ONLY_SEED_CONTRACT_V1.cjs
// Purpose: lock the H53.1 c8-sensing-only seed contract so it cannot emit State, Decision, Execution, Acceptance, ROI, or Field Memory rows.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SEED_SCRIPT = 'scripts/demo_seed/SEED_C8_SENSING_ONLY_V1.cjs';
const PROFILE = 'c8-sensing-only';
const TENANT = 'tenantA';
const FIXED_NOW_MS = process.env.CONTROLLED_PILOT_SEED_NOW_MS || '1710000000000';

const REQUIRED_FACT_TYPES = [
  'field_crop_season_v1',
  'device_observation_context_v1',
  'telemetry_observation_v1',
  'weather_forecast_fact_v1',
  'soil_moisture_sensing_window_v1',
  'controlled_pilot_full_review_manifest_v1',
  'sensing_only_manifest_v1',
];

const REQUIRED_TABLES = [
  'field_index_v1',
  'field_polygon_v1',
  'device_index_v1',
  'device_binding_index_v1',
  'device_status_index_v1',
  'device_capability',
  'telemetry_index_v1',
  'device_observation_index_v1',
  'soil_moisture_sensing_window_index_v1',
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

function fail(error, detail) {
  console.error(JSON.stringify({ ok: false, error, detail }, null, 2));
  process.exit(1);
}

function assertOk(condition, error, detail) {
  if (!condition) fail(error, detail);
}

function runSeedExport() {
  assertOk(fs.existsSync(SEED_SCRIPT), 'SEED_SCRIPT_NOT_FOUND', { seed: SEED_SCRIPT });
  const result = spawnSync(process.execPath, [SEED_SCRIPT, '--export-json', '--tenant', TENANT, '--profile', PROFILE, '--now-ms', FIXED_NOW_MS], { cwd: process.cwd(), encoding: 'utf8', env: process.env });
  assertOk(result.status === 0, 'SEED_EXPORT_FAILED', { status: result.status, stdout: result.stdout, stderr: result.stderr });
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail('SEED_EXPORT_JSON_PARSE_FAILED', { stdout: result.stdout, stderr: result.stderr, error: String(error && error.message ? error.message : error) });
  }
}

function factCount(plan, type) {
  const rows = plan && plan.facts_by_type ? plan.facts_by_type[type] : undefined;
  return Array.isArray(rows) ? rows.length : 0;
}

function tableCount(plan, table) {
  const rows = plan && plan.tables ? plan.tables[table] : undefined;
  return Array.isArray(rows) ? rows.length : 0;
}

function assertSourceReuse() {
  const source = fs.readFileSync(path.resolve(process.cwd(), SEED_SCRIPT), 'utf8');
  assertOk(source.includes('buildC8FormalIrrigationFullChainDataset'), 'C8_BUILDER_REUSE_REQUIRED', null);
  assertOk(source.includes('RAW_BUILDER_PROFILE'), 'C8_BUILDER_PROFILE_BRANCH_REQUIRED', null);
  assertOk(!source.includes('decision_recommendation_v1\'') || source.includes('FORBIDDEN_FACT_TYPES'), 'FORBIDDEN_DECISION_TYPE_LIST_REQUIRED', null);
}

function main() {
  assertSourceReuse();
  const plan = runSeedExport();
  const manifest = plan.manifest || {};
  assertOk(plan.ok === true, 'PLAN_NOT_OK', plan);
  assertOk(plan.profile === PROFILE, 'PROFILE_MISMATCH', { actual: plan.profile });
  assertOk(plan.chain_id === 'C8_SENSING_ONLY_V1', 'CHAIN_ID_MISMATCH', { actual: plan.chain_id });
  assertOk(manifest.sensing_only === true, 'MANIFEST_SENSING_ONLY_REQUIRED', manifest);
  assertOk(manifest.seed_profile === PROFILE, 'MANIFEST_PROFILE_REQUIRED', manifest);
  assertOk(manifest.seed_owner === 'controlled_pilot_full_review_v1', 'MANIFEST_SEED_OWNER_REQUIRED', manifest);
  assertOk(manifest.chain_mode === 'SENSING_ONLY', 'MANIFEST_CHAIN_MODE_REQUIRED', manifest);
  assertOk(manifest.formalized_by_seed === false, 'MANIFEST_FORMALIZED_BY_SEED_FALSE_REQUIRED', manifest);

  for (const type of REQUIRED_FACT_TYPES) assertOk(factCount(plan, type) >= 1, 'REQUIRED_FACT_TYPE_MISSING', { type, count: factCount(plan, type) });
  for (const table of REQUIRED_TABLES) assertOk(tableCount(plan, table) >= 1, 'REQUIRED_TABLE_ROWS_MISSING', { table, count: tableCount(plan, table) });
  for (const type of FORBIDDEN_FACT_TYPES) assertOk(factCount(plan, type) === 0, 'FORBIDDEN_FACT_TYPE_PRESENT', { type, count: factCount(plan, type) });
  for (const table of FORBIDDEN_TABLES) assertOk(tableCount(plan, table) === 0, 'FORBIDDEN_TABLE_ROWS_PRESENT', { table, count: tableCount(plan, table) });

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_C8_SENSING_ONLY_SEED_CONTRACT_V1', profile: PROFILE, tenant: TENANT, required_fact_types: REQUIRED_FACT_TYPES, required_tables: REQUIRED_TABLES, forbidden_fact_types: FORBIDDEN_FACT_TYPES, forbidden_tables: FORBIDDEN_TABLES }, null, 2));
}

main();
