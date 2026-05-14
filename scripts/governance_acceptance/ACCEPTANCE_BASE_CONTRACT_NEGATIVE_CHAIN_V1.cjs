#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(full, 'utf8');
}
function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label}: missing ${needle}`);
}
function assertNotIncludes(text, needle, label) {
  if (text.includes(needle)) throw new Error(`${label}: must not include ${needle}`);
}
function assertRegex(text, regex, label) {
  if (!regex.test(text)) throw new Error(`${label}: missing ${regex}`);
}

const acceptanceFallback = read('apps/server/src/domain/acceptance/acceptance_engine_v1.ts');
const acceptanceEngine = read('apps/server/src/domain/acceptance/engine_v1.ts');
const evidencePolicy = read('apps/server/src/domain/acceptance/evidence_policy.ts');
const evidenceSummary = read('apps/server/src/projections/operation_evidence_summary_v1.ts');
const operationState = read('apps/server/src/projections/operation_state_v1.ts');
const guardedReport = read('apps/server/src/projections/guarded_report_v1.ts');
const reportHook = read('apps/server/src/routes/operation_report_chain_hook_v1.ts');
const customerTrustGate = read('apps/web/src/lib/customerTrustGate.ts');
const reportsApi = read('apps/web/src/api/reports.ts');
const roiTrust = read('apps/server/src/domain/roi/roi_trust_v1.ts');
const fieldMemory = read('apps/server/src/services/field_memory_service.ts');
const operatorLearning = read('apps/web/src/viewmodels/operatorLearningClosureVm.ts');
const variableTaskStatic = read('scripts/governance_acceptance/ACCEPTANCE_VARIABLE_TASK_NOT_AUTO_ACKED_V1.cjs');

assertIncludes(acceptanceFallback, 'formal_acceptance_required', 'receipt + artifact fallback must require formal acceptance');
assertIncludes(acceptanceFallback, 'verdict: "PENDING"', 'fallback acceptance result must remain pending');
assertNotIncludes(acceptanceFallback, 'verdict: "PASS"', 'fallback must not create PASS');
assertIncludes(acceptanceEngine, 'formalEvidencePolicy', 'acceptance engine must consume formal evidence policy');
assertIncludes(acceptanceEngine, 'INCONCLUSIVE', 'acceptance engine must downgrade missing formal evidence');
assertIncludes(acceptanceEngine, 'SIMULATED_OR_DEV_CHAIN', 'acceptance engine must downgrade simulated/dev chain');
assertIncludes(evidencePolicy, 'evaluateFormalEvidencePolicyV1', 'legacy evidence policy wrapper must use formal classifier');

assertIncludes(evidenceSummary, 'evaluateFormalEvidencePolicyV1', 'evidence summary must use formal evidence policy');
assertIncludes(evidenceSummary, 'const evidenceCount = formalPolicy.formal_artifact_count', 'evidence_count must count formal evidence only');
assertIncludes(evidenceSummary, 'receipt_present: receiptPresent', 'receipt presence may be surfaced as raw signal only');
assertIncludes(evidenceSummary, 'acceptance_present: acceptancePresent', 'acceptance presence may be surfaced as raw signal only');
assertNotIncludes(evidenceSummary, 'receiptPresent ? 1', 'receipt presence must not increase evidence count');
assertNotIncludes(evidenceSummary, 'acceptancePresent ? 1', 'acceptance presence must not increase evidence count');

assertIncludes(operationState, 'pendingAcceptanceAfterExecutedReceipt', 'operation_state must gate executed receipt behind pending acceptance');
assertIncludes(operationState, 'PENDING_ACCEPTANCE', 'receipt success must not directly finalize success');
assertIncludes(operationState, '!acceptanceCompleted', 'SUCCESS must be blocked without acceptance completion');
assertIncludes(operationState, 'INVALID_EXECUTION', 'invalid execution lane must remain available for missing formal evidence');
assertNotIncludes(operationState, 'receipt && !acceptanceFact\n        ? "SUCCESS"', 'receipt without acceptance must not become SUCCESS');

assertIncludes(guardedReport, 'applyGuardedOperationReportV1', 'operation report guard must exist');
assertIncludes(guardedReport, 'customer_visible_eligible', 'report guard must drive customer visible eligibility');
assertIncludes(guardedReport, 'NEEDS_REVIEW', 'report guard must downgrade weak payloads');
assertIncludes(guardedReport, 'SIMULATED_DEV_ONLY', 'report guard must downgrade simulated/dev payloads');
assertIncludes(guardedReport, 'has_customer_visible_value: trusted', 'ROI visibility must be gated by trusted chain');
assertIncludes(guardedReport, 'hidden_by_guard', 'field memory must be hidden when chain is not trusted');
assertIncludes(reportHook, 'applyGuardedCustomerOperationsResponseV1', 'customer operations must be guarded at API boundary');
assertIncludes(reportHook, 'applyGuardedDashboardAggregateV1', 'dashboard aggregate must be guarded at API boundary');

assertIncludes(roiTrust, 'trustLevel === "FORMAL_ACCEPTED"', 'ROI customer visible value must require formal accepted');
assertIncludes(roiTrust, 'AS_EXECUTED_SIGNAL', 'as_executed ROI must be an interim signal lane');
assertIncludes(roiTrust, 'HYPOTHESIS_ONLY', 'assumption/default ROI must be hypothesis only');
assertIncludes(fieldMemory, 'SKILL_RUN_IS_NOT_FORMAL_FIELD_LEARNING', 'skill_run memory must not become formal learning');
assertIncludes(fieldMemory, 'FORMAL_ACCEPTANCE_ID_REQUIRED', 'formal field memory must require formal acceptance id');

assertIncludes(customerTrustGate, 'isCustomerFormalChainPassed', 'frontend customer trust helper must exist');
assertIncludes(customerTrustGate, 'customer_visible_value === true', 'frontend customer value must require customer visible value');
assertIncludes(reportsApi, 'mapGuardedReportCode', 'frontend report code mapping must have guarded variant');
assertIncludes(reportsApi, 'successLike', 'success-like report codes must be guarded');
assertIncludes(reportsApi, '需复核', 'weak success-like status must downgrade to review');
assertIncludes(operatorLearning, '仅作为学习信号', 'skillTrace.enteredLearning must be raw signal only');
assertIncludes(operatorLearning, '未通过正式学习门禁', 'operator learning closure must downgrade raw learning signals');
assertIncludes(variableTaskStatic, 'operation_plan_not_auto_acked', 'variable task auto-ACK negative gate must exist');

console.log('[BASE_CONTRACT_NEGATIVE_CHAIN_V1] PASSED');
console.log('[BASE_CONTRACT_NEGATIVE_CHAIN_V1] Checked negative base-contract boundaries across acceptance, evidence, operation_state, reports, ROI, memory, frontend, operator, and variable-task gates.');
