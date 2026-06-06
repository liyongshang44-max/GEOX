#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED = 'scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs';
const FIELD_MEMORY_SERVICE = 'apps/server/src/services/field_memory_service.ts';
const FIELD_MEMORY_ROUTE = 'apps/server/src/routes/field_memory_v1.ts';
const CUSTOMER_ROUTE = 'apps/server/src/routes/customer_v1.ts';
const REPORTS_ROUTE = 'apps/server/src/routes/reports_v1.ts';
const DASHBOARD_PROJECTION = 'apps/server/src/projections/report_dashboard_v1.ts';
const GUARDED_REPORT = 'apps/server/src/projections/guarded_report_v1.ts';
const ROI_ROUTE = 'apps/server/src/routes/roi_ledger_v1.ts';
const ROI_DOMAIN = 'apps/server/src/domain/roi/roi_ledger_v1.ts';
const ROI_TRUST = 'apps/server/src/domain/roi/roi_trust_v1.ts';
const AS_EXECUTED_DOMAIN = 'apps/server/src/domain/execution/as_executed_v1.ts';

const CHAIN_ID = 'C8_FORMAL_IRRIGATION_FULL_CHAIN_V1';
const FORMAL_OP = 'op_plan_c8_irrigation_formal_001';
const PENDING_OP = 'op_plan_c8_irrigation_pending_001';
const FORMAL_TASK = 'act_c8_irrigation_formal_001';
const FORMAL_RECEIPT = 'receipt_c8_irrigation_formal_001';
const FORMAL_ACC = 'acc_c8_irrigation_formal_001';
const FORMAL_FIELD = 'field_c8_demo';
const FORMAL_MEMORY = 'fm_c8_irrigation_response_001';
const FORMAL_ROI = 'roi_c8_irrigation_formal_001';
let failed = false;

function fail(message, detail) { console.error(`[controlled-pilot-full-review-seed] ${message}`); if (detail !== undefined) console.error(JSON.stringify(detail, null, 2)); failed = true; }
function assert(ok, message, detail) { if (!ok) fail(message, detail); }
function nearly(actual, expected, message) { assert(Math.abs(Number(actual) - Number(expected)) < 0.0001, `${message}: expected ${expected}, got ${actual}`); }
function read(rel) { const file = path.join(ROOT, rel); assert(fs.existsSync(file), `missing file ${rel}`); return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
function need(scope, text, items) { for (const item of items) assert(text.includes(item), `${scope} missing ${item}`); }
function ban(scope, text, pairs) { for (const [label, pattern] of pairs) assert(!pattern.test(text), `${scope} forbidden ${label}`); }
function runJson(args) { const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) { console.error(r.stdout); console.error(r.stderr); throw new Error(args.join(' ')); } return JSON.parse(r.stdout); }
function hasAll(list, expected) { return expected.every((x) => Array.isArray(list) && list.includes(x)); }
function payloads(exported, type) { return Array.isArray(exported?.facts_by_type?.[type]) ? exported.facts_by_type[type].map((x) => x.record_json?.payload || {}) : []; }
function firstPayload(exported, type, predicate) { return payloads(exported, type).find(predicate) || null; }
function authHeaders() { const token = process.env.ADMIN_TOKEN || process.env.TOKEN_ADMIN || process.env.AO_ACT_TOKEN || process.env.GEOX_AO_ACT_TOKEN || process.env.TOKEN || 'admin_token'; return { accept: 'application/json', authorization: `Bearer ${token}`, 'x-geox-token': token, 'x-geox-ao-act-token': token, 'x-ao-act-token': token }; }
function httpOk(url) { return new Promise((resolve) => { const req = http.get(url, { headers: authHeaders() }, (res) => { res.resume(); resolve(Boolean(res.statusCode && res.statusCode < 500)); }); req.on('error', () => resolve(false)); req.setTimeout(1000, () => { req.destroy(); resolve(false); }); }); }

function assertApprovalDecision(exported) {
  const d = firstPayload(exported, 'approval_decision_v1', (x) => x.decision_id === 'approval_decision_c8_irrigation_001');
  assert(d?.request_id === 'approval_c8_irrigation_001', 'approval decision request_id mismatch', d);
  assert(d?.approval_request_id === 'approval_c8_irrigation_001', 'approval decision approval_request_id mismatch', d);
  assert(d?.decision === 'APPROVED', 'approval decision mismatch', d);
  assert(d?.actor_id === 'tok_admin_actor', 'approval actor_id mismatch', d);
  assert(d?.actor_name === '运营管理员', 'approval actor_name mismatch', d);
  assert(d?.actor_role === 'operation_approver', 'approval actor_role mismatch', d);
  assert(String(d?.note || '').includes('22mm'), 'approval note missing 22mm', d);
  assert(d?.decided_by === 'tok_admin_actor', 'approval decided_by mismatch', d);
}

function assertFormalFieldMemory(memory) {
  assert(memory?.memory_id === FORMAL_MEMORY, 'formal memory id mismatch', memory);
  assert(memory?.memory_type === 'FIELD_RESPONSE_MEMORY', 'formal memory_type mismatch', memory);
  assert(memory?.memory_lane === 'FORMAL_FIELD_MEMORY', 'formal memory_lane mismatch', memory);
  assert(memory?.trust_level === 'FORMAL_ACCEPTED', 'formal memory trust_level mismatch', memory);
  assert(memory?.formal_acceptance_id === FORMAL_ACC, 'formal memory formal_acceptance_id mismatch', memory);
  assert(memory?.source_lane === 'FORMAL_OPERATION', 'formal memory source_lane mismatch', memory);
  assert(memory?.customer_visible_memory === true, 'formal memory customer_visible_memory mismatch', memory);
  assert(memory?.learning_eligible === true, 'formal memory learning_eligible mismatch', memory);
  nearly(memory?.before_value, 18.4, 'formal memory before_value');
  nearly(memory?.after_value, 24.8, 'formal memory after_value');
  nearly(memory?.delta_value, 6.4, 'formal memory delta_value');
}

function assertFormalChain(exported) {
  const c = exported.formal_chain || {};
  assert(exported.ok === true && exported.chain_id === CHAIN_ID && c.chain_id === CHAIN_ID, 'chain id invalid', exported);
  for (const key of ['field','boundary','devices','observations','diagnosis','recommendation','prescription','approval','operation_plan','ao_act_task','receipt','as_executed_expected','as_applied_expected','evidence','acceptance','roi','field_memory','report_expectations']) assert(c[key] !== undefined, `formal_chain missing ${key}`);
  assert(c.field?.field_id === FORMAL_FIELD && Number(c.field?.area_mu) === 30 && c.field?.crop_name === '玉米' && c.field?.season_id === 'season_2026_c8_corn', 'field context invalid', c.field);
  for (const id of ['dev_soil_c8_001','dev_valve_pump_c8_001','dev_weather_station_c8_001']) { const d = (c.devices || []).find((x) => x.device_id === id); assert(d?.display_kind_text && d?.sensing_role_text && d?.capability_text && d?.field_role_text, `device context invalid: ${id}`, d); }
  const metrics = new Set((c.observations || []).map((x) => x.metric));
  for (const metric of ['soil_moisture_percent','forecast_rain_72h_mm','temperature_max_c','soil_moisture_after_percent']) assert(metrics.has(metric), `formal chain observation missing ${metric}`, [...metrics]);
  assert(c.operation_plan?.operation_plan_id === FORMAL_OP && c.operation_plan?.prescription_id === 'presc_c8_irrigation_001', 'operation plan invalid', c.operation_plan);
  assert(hasAll(c.operation_plan?.expected_evidence, ['water_delivery_receipt','post_soil_moisture_metric']), 'operation expected_evidence incomplete', c.operation_plan);
  assert(c.ao_act_task?.act_task_id === FORMAL_TASK && c.ao_act_task?.parameters?.amount === 22 && c.ao_act_task?.parameters?.target_soil_moisture_percent === 24, 'AO-ACT task invalid', c.ao_act_task);
  assert(c.receipt?.receipt_id === FORMAL_RECEIPT && c.receipt?.task_id === FORMAL_TASK && c.receipt?.status === 'executed', 'formal receipt identity/status invalid', c.receipt);
  nearly(c.receipt?.observed_parameters?.executed_amount, 21.6, 'receipt executed_amount');
  nearly(c.receipt?.observed_parameters?.coverage_percent, 100, 'receipt coverage_percent');
  assert(c.acceptance?.acceptance_id === FORMAL_ACC && c.acceptance?.formal_acceptance === true && c.acceptance?.formal_evidence_passed === true && c.acceptance?.chain_validation_passed === true, 'formal acceptance gate invalid', c.acceptance);
  assert(c.as_executed_expected?.task_id === FORMAL_TASK && c.as_executed_expected?.receipt_id === FORMAL_RECEIPT && c.as_executed_expected?.field_id === FORMAL_FIELD && c.as_executed_expected?.status === 'CONFIRMED', 'as-executed expectation invalid', c.as_executed_expected);
  nearly(c.as_executed_expected?.planned_amount, 22, 'as-executed planned amount');
  nearly(c.as_executed_expected?.executed_amount, 21.6, 'as-executed executed amount');
  assert(c.as_applied_expected?.field_id === FORMAL_FIELD, 'as-applied field invalid', c.as_applied_expected);
  nearly(c.as_applied_expected?.coverage_percent, 100, 'as-applied coverage');
  assert(c.roi?.roi_ledger_id === FORMAL_ROI, 'formal ROI id invalid', c.roi);
  assert(c.roi?.source_lane === 'FORMAL_ACCEPTANCE' && c.roi?.trust_level === 'FORMAL_ACCEPTED' && c.roi?.customer_visible_value === true, 'formal ROI trust invalid', c.roi);
  assert(c.roi?.as_executed_id && String(c.roi.as_executed_id) !== 'null', 'formal ROI as_executed_id must be non-null placeholder or actual id', c.roi);
  assert(c.roi?.formal_acceptance_id === FORMAL_ACC, 'formal ROI formal_acceptance_id invalid', c.roi);
  assert(c.roi?.roi_type === 'SOIL_MOISTURE_RESPONSE' && c.roi?.value_kind === 'MEASURED', 'formal ROI type/value_kind invalid', c.roi);
  nearly(c.roi?.before_value, 18.4, 'formal ROI before_value');
  nearly(c.roi?.after_value, 24.8, 'formal ROI after_value');
  nearly(c.roi?.actual_value, 21.6, 'formal ROI actual_value');
  nearly(c.roi?.delta_value, 6.4, 'formal ROI delta_value');
  assertFormalFieldMemory(c.field_memory);
}

function assertProfileIsolation(c8Exported, c8Dry) {
  assert(c8Dry.profile === 'c8-formal-chain' && c8Dry.planned_counts?.fields === 1 && c8Dry.planned_counts?.devices === 3 && c8Dry.planned_counts?.pending_operations === 0 && c8Dry.planned_counts?.device_offline_cases === 0, 'c8 dry-run profile counts invalid', c8Dry.planned_counts);
  assert((c8Exported.tables?.field_index_v1 || []).length === 1 && c8Exported.tables.field_index_v1[0].field_id === FORMAL_FIELD, 'c8 profile must export only field_c8_demo', c8Exported.tables?.field_index_v1);
  assert(!payloads(c8Exported, 'operation_plan_v1').some((x) => x.operation_plan_id === PENDING_OP), 'c8 profile leaked pending operation', payloads(c8Exported, 'operation_plan_v1'));
  assert(!(c8Exported.tables?.device_index_v1 || []).some((x) => x.device_id === 'dev_gateway_offline_001'), 'c8 profile leaked offline gateway', c8Exported.tables?.device_index_v1);
  assert((c8Exported.tables?.alert_event_index_v1 || []).length === 0, 'c8 profile leaked alert rows', c8Exported.tables?.alert_event_index_v1);
  assert(JSON.stringify(c8Exported.derived_expectations?.customer_operations || []) === JSON.stringify([FORMAL_OP]), 'c8 customer operation expectation must be formal only', c8Exported.derived_expectations?.customer_operations);
}

function assertRoiExportContract(exported) {
  assert(exported.manifest?.formalized_by_seed === true, 'manifest must mark formalized_by_seed', exported.manifest);
  assert(hasAll(exported.manifest?.roi_flow, ['as_executed_record_v1','AS_EXECUTED_SIGNAL','FORMAL_ACCEPTANCE']), 'manifest roi_flow incomplete', exported.manifest?.roi_flow);
  assert(Array.isArray(exported.tables?.roi_ledger_v1_optional) && exported.tables.roi_ledger_v1_optional.length === 0, 'seed must not export static formal ROI rows', exported.tables?.roi_ledger_v1_optional);
  assert(!JSON.stringify(exported).includes('"as_executed_id":null'), 'export-json leaked as_executed_id:null');
}

function assertFieldMemoryExportContract(exported) {
  const rows = exported.tables?.field_memory_v1 || [];
  assertFormalFieldMemory(rows.find((x) => x.memory_id === FORMAL_MEMORY));
  const technical = rows.find((x) => x.memory_lane === 'TECHNICAL_SKILL_MEMORY' || x.trust_level === 'TECHNICAL_SIGNAL');
  assert(technical?.customer_visible_memory === false && technical?.learning_eligible === false, 'technical memory must be internal only', technical);
}

async function main() {
  const seed = read(SEED);
  const fieldMemoryService = read(FIELD_MEMORY_SERVICE);
  const fieldMemoryRoute = read(FIELD_MEMORY_ROUTE);
  const customerRoute = read(CUSTOMER_ROUTE);
  const reportsRoute = read(REPORTS_ROUTE);
  const dashboardProjection = read(DASHBOARD_PROJECTION);
  const guardedReport = read(GUARDED_REPORT);
  const routeRoi = read(ROI_ROUTE);
  const domainRoi = read(ROI_DOMAIN);
  const trustRoi = read(ROI_TRUST);
  const asExecutedDomain = read(AS_EXECUTED_DOMAIN);
  const pkg = read('package.json');

  need('package scripts', pkg, ['seed:controlled-pilot:full-review:dry-run', 'seed:controlled-pilot:full-review:apply', 'seed:controlled-pilot:full-review:export-json', 'seed:controlled-pilot:full-review:verify', 'acceptance:controlled-pilot:full-review-seed']);
  need('seed commands and guards', seed, ['ALLOWED_TENANTS', 'demo', 'tenantA', '--apply requires explicit --tenant', 'BEGIN', 'COMMIT', 'ROLLBACK', 'pg_advisory_lock', 'pg_advisory_unlock', 'controlled_pilot_full_review_manifest_v1', 'seed_owned_ids', 'ON CONFLICT', 'export-json', 'export-db-json', 'verify-api', 'verify-clean']);
  need('seed structured verify-api contract', seed, [
    'assertOperationReportJson', 'assertFieldReportJson', 'assertCustomerMemoryJson', 'getAsExecutedList', 'getJson', 'postJson', 'assertMetricSet', 'checked_endpoints',
    '/api/v1/reports/operation/', '/api/v1/reports/field/', '/api/v1/as-executed/by-task/', '/api/v1/customer/fields/',
    'OPERATION_REPORT_JSON_REQUIRED', 'FIELD_REPORT_JSON_REQUIRED', 'AS_EXECUTED_BY_TASK_REQUIRED', 'CUSTOMER_MEMORY_API_REQUIRED',
    'OPERATION_FIELD_ID_MISMATCH', 'OPERATION_RECOMMENDATION_ID_MISMATCH', 'OPERATION_APPROVAL_ID_MISMATCH', 'OPERATION_RECEIPT_ID_MISMATCH', 'OPERATION_PRESCRIPTION_ID_MISMATCH', 'OPERATION_AS_EXECUTED_ID_REQUIRED',
    'OPERATION_APPROVAL_ACTOR_ID_MISMATCH', 'OPERATION_APPROVAL_ACTOR_NAME_MISMATCH', 'OPERATION_DIAGNOSTIC_OBSERVATION_MISSING', 'OPERATION_AS_EXECUTED_STATUS_MISMATCH', 'OPERATION_AS_APPLIED_COVERAGE_MISMATCH', 'OPERATION_ROI_CUSTOMER_VALUE_MISMATCH', 'OPERATION_FIELD_MEMORY_MISSING',
    'FIELD_REPORT_FIELD_ID_MISMATCH', 'FIELD_REPORT_AREA_MU_MISMATCH', 'FIELD_REPORT_BOUNDARY_STATUS_MISMATCH', 'FIELD_REPORT_CROP_NAME_MISMATCH', 'FIELD_REPORT_SEASON_ID_MISMATCH', 'FIELD_REPORT_SENSING_DEVICES_MISMATCH', 'FIELD_REPORT_SENSING_OBSERVATION_MISSING', 'FIELD_REPORT_CUSTOMER_VALUE_MISMATCH', 'FIELD_REPORT_FORMAL_MEMORY_COUNT_MISMATCH',
    'soil_moisture_percent', 'forecast_rain_72h_mm', 'temperature_max_c', 'soil_moisture_after_percent', 'BOUNDARY_AVAILABLE', 'season_2026_c8_corn', '运营管理员', 'tok_admin_actor', 'CONFIRMED',
  ]);
  need('seed approval/as-executed/ROI/field-memory flow', seed, ['actor_id', 'tok_admin_actor', 'actor_name', '运营管理员', 'actor_role', 'operation_approver', '同意按 22mm 灌溉处方执行。', '/api/v1/as-executed/from-receipt', '/api/v1/roi-ledger/from-as-executed', '/api/v1/roi-ledger/formalize-from-acceptance', '/api/v1/field-memory/from-acceptance', 'ROI_INTERIM_SIGNAL_READBACK_REQUIRED', 'isInterimRoiForAsExecuted', 'FORMAL_FIELD_MEMORY_REQUIRED', 'CUSTOMER_FORMAL_MEMORY_REQUIRED', 'TECHNICAL_SKILL_MEMORY']);
  need('field memory service formal gate', fieldMemoryService, ['createFormalFieldMemoryFromAcceptanceV1', 'validateFormalFieldMemoryAcceptanceV1', 'FORMAL_FIELD_MEMORY', 'FORMAL_ACCEPTED', 'formal_acceptance_id', 'customer_visible_memory', 'learning_eligible', 'ACCEPTANCE_VERDICT_NOT_PASS', 'FORMAL_EVIDENCE_NOT_PASSED', 'CHAIN_VALIDATION_NOT_PASSED']);
  need('field memory route formal derivation', fieldMemoryRoute, ['/api/v1/field-memory/from-acceptance', 'FORMAL_FIELD_MEMORY', 'FORMAL_ACCEPTED', 'customer_visible_memory', 'learning_eligible', 'formal_acceptance_id']);
  need('customer memory route formal filter', customerRoute, ['/api/v1/customer/fields/:fieldId/memory', "memory_lane = 'FORMAL_FIELD_MEMORY'", "trust_level = 'FORMAL_ACCEPTED'", 'customer_visible_memory = true', 'learning_eligible = true', 'formal_acceptance_id IS NOT NULL']);
  need('reports route field memory projection', reportsRoute, ['field_memory_v1', 'field_response_memory', 'device_reliability_memory', 'skill_performance_memory']);
  need('dashboard learning summary formal filter', dashboardProjection, ['isFormalFieldResponseMemory', 'FORMAL_FIELD_MEMORY', 'FORMAL_ACCEPTED', 'customer_visible_memory', 'learning_eligible', 'formal_memory_count', 'latest_formal_acceptance_id']);
  need('guarded report hides technical field memory', guardedReport, ['isFormalFieldResponseMemory', 'formal_memory_filter', 'hidden_counts', 'device_reliability_memory', 'skill_performance_memory', 'hidden_by_guard']);
  need('ROI route/domain/trust support', routeRoi, ['/api/v1/roi-ledger/from-as-executed', '/api/v1/roi-ledger/formalize-from-acceptance', 'mode: result.mode', 'roi_ledgers']);
  need('ROI domain support', domainRoi, ['findInterimRoiByAsExecutedId', 'AS_EXECUTED_SIGNAL', 'INTERIM_SUPPORTED', 'FORMAL_ACCEPTANCE', 'FORMAL_ACCEPTED', 'customer_visible_value', 'upsertFormalRoiFromInterim', 'formalRoiTypeFromInterim', 'SOIL_MOISTURE_RESPONSE']);
  need('ROI trust support', trustRoi, ['AS_EXECUTED_SIGNAL', 'INTERIM_SUPPORTED', 'FORMAL_ACCEPTANCE', 'FORMAL_ACCEPTED', 'customer_visible_value']);
  need('as_executed receipt status compatibility', asExecutedDomain, ['normalizeReceiptStatus', 'EXECUTED', 'SUCCEEDED', 'SUCCESS', 'CONFIRMED', 'NOT_EXECUTED', 'FAILED', 'ERROR', 'INSUFFICIENT_RECEIPT']);
  ban('seed source', seed, [
    ['raw response string include check', /\.raw\.includes\(/],
    ['response body string include check', /\.body\.includes\(/],
    ['verify-api raw has_customer_visible_value check', /has_customer_visible_value[^\n]+raw\.includes/],
    ['static formal ROI null binding', /as_executed_id\s*:\s*null/],
    ['json formal ROI null binding', /"as_executed_id"\s*:\s*null/],
    ['truncate', /\bTRUNCATE\b/i],
    ['broad facts tenant cleanup', /DELETE\s+FROM\s+facts\s+WHERE\s+tenant_id/i],
    ['broad field tenant cleanup', /DELETE\s+FROM\s+field_index_v1\s+WHERE\s+tenant_id/i],
    ['production bypass', /NODE_ENV\s*===\s*['"]production['"]/],
    ['allow all tenants', /ALLOWED_TENANTS[^\n]*(?:['"]all['"]|\*)/i],
    ['development evidence marker', /sim_trace|flight_table|dev_source/i],
  ]);

  const dry = runJson([SEED, '--dry-run', '--tenant', 'tenantA']);
  assert(dry.ok === true && dry.profile === 'full-review' && dry.chain_id === CHAIN_ID && dry.apply === false, 'dry-run envelope invalid', dry);
  for (const [key, min] of Object.entries({ fields: 3, devices: 4, formal_operations: 1, pending_operations: 1, recommendations: 2, approval_requests: 2, receipts: 2, formal_evidence: 2, acceptance_results: 2, field_memory: 1, formal_field_memory: 1, technical_memory: 1, prescriptions: 1, device_offline_cases: 1, negative_cases: 1 })) assert(Number(dry.planned_counts?.[key] || 0) >= min, `dry-run planned_counts.${key} < ${min}`, dry.planned_counts);
  assert(Number(dry.planned_counts?.roi_static_rows || 0) === 0, 'dry-run must not plan static ROI rows', dry.planned_counts);

  const exported = runJson([SEED, '--export-json', '--tenant', 'tenantA']);
  assertFormalChain(exported);
  assertApprovalDecision(exported);
  assertRoiExportContract(exported);
  assertFieldMemoryExportContract(exported);
  assert((exported.system_domains || []).length >= 26, 'system domains A-Z coverage missing');

  const c8Dry = runJson([SEED, '--dry-run', '--tenant', 'tenantA', '--profile', 'c8-formal-chain']);
  const c8Exported = runJson([SEED, '--export-json', '--tenant', 'tenantA', '--profile', 'c8-formal-chain']);
  assertFormalChain(c8Exported);
  assertApprovalDecision(c8Exported);
  assertRoiExportContract(c8Exported);
  assertFieldMemoryExportContract(c8Exported);
  assertProfileIsolation(c8Exported, c8Dry);

  const apiBase = process.env.CONTROLLED_PILOT_VERIFY_API_BASE || process.env.API_BASE_URL || '';
  if (apiBase && await httpOk(`${apiBase.replace(/\/+$/, '')}/api/health`)) {
    const r = spawnSync(process.execPath, [SEED, '--verify-api', '--tenant', 'tenantA', '--profile', 'c8-formal-chain', '--base-url', apiBase], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) { console.error(r.stdout); console.error(r.stderr); failed = true; }
  }

  if (failed) { console.error('[controlled-pilot-full-review-seed] FAIL'); process.exit(1); }
  console.log('[controlled-pilot-full-review-seed] PASS');
}
main().catch((error) => { console.error(error && (error.stack || error.message) ? (error.stack || error.message) : error); process.exit(1); });
