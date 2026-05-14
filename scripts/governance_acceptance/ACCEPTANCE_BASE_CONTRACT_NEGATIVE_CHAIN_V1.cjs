#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
function read(rel) { const full = path.join(root, rel); if (!fs.existsSync(full)) throw new Error(`Missing file: ${rel}`); return fs.readFileSync(full, 'utf8'); }
function has(file, token, label) { const text = read(file); if (!text.includes(token)) throw new Error(`${label}: missing ${token}`); }
function lacks(file, token, label) { const text = read(file); if (text.includes(token)) throw new Error(`${label}: forbidden ${token}`); }

const acceptanceFallback = 'apps/server/src/domain/acceptance/acceptance_engine_v1.ts';
const acceptanceEngine = 'apps/server/src/domain/acceptance/engine_v1.ts';
const evidencePolicy = 'apps/server/src/domain/acceptance/evidence_policy.ts';
const evidenceSummary = 'apps/server/src/projections/operation_evidence_summary_v1.ts';
const operationState = 'apps/server/src/projections/operation_state_v1.ts';
const guardedReport = 'apps/server/src/projections/guarded_report_v1.ts';
const reportHook = 'apps/server/src/routes/operation_report_chain_hook_v1.ts';
const customerTrustGate = 'apps/web/src/lib/customerTrustGate.ts';
const reportsApi = 'apps/web/src/api/reports.ts';
const roiTrust = 'apps/server/src/domain/roi/roi_trust_v1.ts';
const fieldMemory = 'apps/server/src/services/field_memory_service.ts';
const operatorLearning = 'apps/web/src/viewmodels/operatorLearningClosureVm.ts';
const variableTaskStatic = 'scripts/governance_acceptance/ACCEPTANCE_VARIABLE_TASK_NOT_AUTO_ACKED_V1.cjs';

has(acceptanceFallback, 'formal_acceptance_required', 'fallback acceptance requires formal gate');
has(acceptanceFallback, 'verdict: "PENDING"', 'fallback acceptance remains pending');
lacks(acceptanceFallback, 'verdict: "PASS"', 'fallback acceptance must not pass');
has(acceptanceEngine, 'evidencePolicyFromReceiptV1', 'acceptance engine uses formal evidence policy');
has(acceptanceEngine, 'formalGatePassed', 'acceptance engine computes formal gate');
has(acceptanceEngine, 'INCONCLUSIVE', 'acceptance engine downgrades missing formal proof');
has(acceptanceEngine, 'DEV_CHAIN_NOT_FORMAL', 'acceptance engine downgrades dev chain');
has(evidencePolicy, 'evaluateFormalEvidencePolicyV1', 'evidence policy uses formal classifier');

has(evidenceSummary, 'evaluateFormalEvidencePolicyV1', 'evidence summary uses formal policy');
has(evidenceSummary, 'const evidenceCount = formalPolicy.formal_artifact_count', 'evidence count is formal only');
has(evidenceSummary, 'receipt_present: receiptPresent', 'receipt remains raw signal');
has(evidenceSummary, 'acceptance_present: acceptancePresent', 'acceptance remains raw signal');
lacks(evidenceSummary, 'receiptPresent ? 1', 'receipt must not increase evidence count');
lacks(evidenceSummary, 'acceptancePresent ? 1', 'acceptance must not increase evidence count');

has(operationState, 'pendingAcceptanceAfterExecutedReceipt', 'operation state keeps executed receipt pending acceptance');
has(operationState, 'PENDING_ACCEPTANCE', 'operation state supports pending acceptance');
has(operationState, '!acceptanceCompleted', 'operation state blocks success without acceptance completion');
has(operationState, 'INVALID_EXECUTION', 'operation state supports invalid execution');

has(guardedReport, 'applyGuardedOperationReportV1', 'operation report guard exists');
has(guardedReport, 'customer_visible_eligible', 'report guard controls customer visibility');
has(guardedReport, 'NEEDS_REVIEW', 'report guard downgrades weak chain');
has(guardedReport, 'SIMULATED_DEV_ONLY', 'report guard downgrades simulated chain');
has(guardedReport, 'has_customer_visible_value: trusted', 'ROI visibility is trust gated');
has(guardedReport, 'hidden_by_guard', 'field memory hidden when not trusted');
has(reportHook, 'applyGuardedCustomerOperationsResponseV1', 'customer operations response is guarded');
has(reportHook, 'applyGuardedDashboardAggregateV1', 'dashboard response is guarded');

has(roiTrust, 'trustLevel === "FORMAL_ACCEPTED"', 'ROI customer visibility requires formal accepted');
has(roiTrust, 'AS_EXECUTED_SIGNAL', 'as-executed ROI is signal lane');
has(roiTrust, 'HYPOTHESIS_ONLY', 'assumption ROI is hypothesis lane');
has(fieldMemory, 'SKILL_RUN_IS_NOT_FORMAL_FIELD_LEARNING', 'skill run memory stays technical');
has(fieldMemory, 'FORMAL_ACCEPTANCE_ID_REQUIRED', 'formal field memory needs formal acceptance id');
has(customerTrustGate, 'isCustomerFormalChainPassed', 'customer frontend formal chain gate exists');
has(customerTrustGate, 'customer_visible_value === true', 'customer frontend value gate exists');
has(reportsApi, 'mapGuardedReportCode', 'guarded report code mapper exists');
has(reportsApi, 'successLike', 'success-like codes are guarded');
has(reportsApi, '需复核', 'weak success is shown as review');
has(operatorLearning, '仅作为学习信号', 'skill trace learning flag is raw signal');
has(operatorLearning, '未通过正式学习门禁', 'operator closure downgrades raw learning signals');
has(variableTaskStatic, 'operation_plan_not_auto_acked', 'variable task no-auto-ack gate exists');

console.log('[BASE_CONTRACT_NEGATIVE_CHAIN_V1] PASSED');
console.log('[BASE_CONTRACT_NEGATIVE_CHAIN_V1] Checked negative base-contract boundaries across acceptance, evidence, operation_state, reports, ROI, memory, frontend, operator, and variable-task gates.');
