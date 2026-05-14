#!/usr/bin/env node
/*
 * GEOX Contract Alignment Acceptance V1
 *
 * This is a static governance gate. It does not prove business correctness.
 * It prevents the most dangerous regressions: official reports and frontend
 * VMs treating helper facts, raw sensing, skill success, receipt success, or
 * fallback data as formal customer/operator conclusions.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const offenders = [];

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function lineOf(text, needle) {
  const index = text.indexOf(needle);
  if (index < 0) return 1;
  return text.slice(0, index).split('\n').length;
}

function fail(file, rule, message, needle = '') {
  const text = read(file) || '';
  offenders.push({ file, line: needle ? lineOf(text, needle) : 1, rule, message });
}

function mustContain(file, token, rule, message) {
  const text = read(file);
  if (text == null) return fail(file, 'missing-file', 'required file is missing');
  if (!text.includes(token)) fail(file, rule, message, token);
}

function mustNotContain(file, token, rule, message) {
  const text = read(file);
  if (text == null) return;
  if (text.includes(token)) fail(file, rule, message, token);
}

function mustMatch(file, regex, rule, message) {
  const text = read(file);
  if (text == null) return fail(file, 'missing-file', 'required file is missing');
  if (!regex.test(text)) fail(file, rule, message);
}

const matrixFile = 'docs/audit/CONTRACT_ALIGNMENT_MATRIX_V1.md';
mustContain(matrixFile, 'Apple I', 'matrix-must-index-apple-i', 'matrix must index Apple I monitor/evidence base');
mustContain(matrixFile, 'Apple II', 'matrix-must-index-apple-ii', 'matrix must index Apple II Judge/ProblemState base');
mustContain(matrixFile, 'Apple III', 'matrix-must-index-apple-iii', 'matrix must index Apple III AO-SENSE base');
mustContain(matrixFile, 'Controlplane', 'matrix-must-index-controlplane', 'matrix must index Controlplane constitution');
mustContain(matrixFile, 'Stage-1 sensing summary', 'matrix-must-index-stage1', 'matrix must index Stage-1 sensing summary contract');
mustContain(matrixFile, 'Flight Table', 'matrix-must-index-flight-table', 'matrix must index Flight Table dev-only boundary');
mustContain(matrixFile, 'Frontend same-source', 'matrix-must-index-frontend', 'matrix must state frontend same-source is not semantic validity');

const reportGuard = 'apps/server/src/projections/operation_report_chain_v1.ts';
mustContain(reportGuard, 'validateOperationChainV1', 'report-must-use-chain-validation', 'operation report projection must delegate chain validity to a backend guard');
mustContain(reportGuard, 'chain_validation', 'report-must-emit-chain-validation', 'operation report payload must emit backend-owned chain_validation');
mustContain(reportGuard, 'stage1_sensing_summary', 'report-must-reference-stage1', 'operation report guard must reference Stage-1 formal sensing summary provenance, not only raw skill metrics');
mustNotContain(reportGuard, 'chain_integrity: "COMPLETE"', 'report-must-not-hardcode-complete', 'operation report projection must not hard-code COMPLETE chain integrity');

const validator = 'apps/server/src/projections/operation_chain_validator_v1.ts';
mustContain(validator, 'receipt_success_is_not_acceptance_pass', 'validator-must-preserve-receipt-boundary', 'validator must preserve receipt success != acceptance pass');
mustContain(validator, 'approval_decision_v1', 'validator-must-require-approval-decision', 'operation plan validity must require a formal approval decision');
mustContain(validator, 'prescription_id_without_formal_prescription_fact', 'validator-must-reject-embedded-prescription-only', 'validator must reject operation_plan-embedded prescription ids without formal prescription facts');
mustContain(validator, 'SIMULATED_CHAIN', 'validator-must-downgrade-simulated-chain', 'validator must downgrade helper/simulated chains');
mustContain(validator, 'stage1_sensing_summary', 'validator-must-use-stage1-formal-trigger', 'validator must use Stage-1 formal trigger provenance for recommendation validity');
mustNotContain(validator, 'soilMoisture != null && threshold != null && deficitDetected === true', 'validator-must-not-formalize-from-raw-skill-metrics', 'validator must not formalize diagnosis solely from raw skill soil moisture/threshold/deficit');

const flightTableSecurity = 'docs/flight-table/FLIGHT_TABLE_SECURITY_BOUNDARY_V1.md';
mustContain(flightTableSecurity, 'customer formal navigation', 'flight-table-doc-boundary', 'Flight Table security boundary must remain documented');

const flightTableApi = 'docs/flight-table/FLIGHT_TABLE_API_CONTRACT_V1.md';
mustContain(flightTableApi, 'Receipt success is not acceptance pass', 'flight-table-receipt-not-acceptance-doc', 'Flight Table API contract must preserve receipt != acceptance');

const flightTableService = 'apps/server/src/services/flight_table/flight_table_operation_v1.ts';
if (read(flightTableService) != null) {
  mustContain(flightTableService, 'receipt_success_is_not_acceptance_pass', 'flight-table-service-must-tag-helper-receipts', 'Flight Table operation helper must tag receipts as not acceptance proof');
}

const operationReportVm = 'apps/web/src/viewmodels/operationReportVm.ts';
if (read(operationReportVm) != null) {
  mustContain(operationReportVm, 'chain_validation', 'frontend-vm-must-consume-backend-validation', 'operation report VM must consume backend-owned chain_validation');
  mustNotContain(operationReportVm, 'receipt_id ? "PASS"', 'frontend-must-not-infer-pass-from-receipt', 'frontend VM must not infer PASS from receipt presence');
  mustNotContain(operationReportVm, 'receipt_id ? "SUCCESS"', 'frontend-must-not-infer-success-from-receipt', 'frontend VM must not infer SUCCESS from receipt presence');
}

const opStatusGate = 'apps/web/scripts/check-operation-status-convergence.mjs';
mustContain(opStatusGate, 'receipt => success/pass inference', 'frontend-gate-must-block-receipt-status-inference', 'frontend gate must block receipt/task/error status inference');

const exportGate = 'apps/web/scripts/check-customer-export-same-source.mjs';
mustContain(exportGate, 'forbiddenExportBusinessApiCalls', 'export-gate-must-forbid-business-refetch', 'customer export gate must forbid business API refetches');

const apiInventory = 'docs/audit/API_ROUTE_INVENTORY.md';
mustContain(apiInventory, 'Customer official API', 'api-inventory-must-classify-customer-official', 'API inventory must classify customer official APIs');
mustContain(apiInventory, 'Customer fallback API', 'api-inventory-must-classify-customer-fallback', 'API inventory must classify customer fallback APIs');
mustContain(apiInventory, 'Operator write API', 'api-inventory-must-classify-operator-write', 'API inventory must classify operator write APIs');

const frontendFallback = 'docs/frontend/FALLBACK_RETIREMENT_PLAN.md';
mustContain(frontendFallback, 'fallback data is read-only', 'fallback-doc-must-disable-write', 'operator fallback must remain read-only');
mustContain(frontendFallback, 'must not fabricate geometry', 'fallback-doc-must-forbid-fabrication', 'customer fallback must forbid fabricated product data');

if (offenders.length) {
  console.error('[CONTRACT_ALIGNMENT_V1] FAILED');
  for (const o of offenders) {
    console.error(`- ${o.file}:${o.line} [${o.rule}] ${o.message}`);
  }
  process.exit(1);
}

console.log('[CONTRACT_ALIGNMENT_V1] PASSED');
console.log('[CONTRACT_ALIGNMENT_V1] Checked base-contract matrix, report guard, validator, Flight Table boundary, and frontend status/export gates.');
