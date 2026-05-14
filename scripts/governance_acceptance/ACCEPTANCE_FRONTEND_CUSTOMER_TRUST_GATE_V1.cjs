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

const trustGate = read('apps/web/src/lib/customerTrustGate.ts');
const reportsApi = read('apps/web/src/api/reports.ts');
const dashboardVm = read('apps/web/src/viewmodels/customerDashboardVm.ts');
const fieldReportVm = read('apps/web/src/viewmodels/fieldReportVm.ts');
const operationReportVm = read('apps/web/src/viewmodels/operationReportVm.ts');

for (const token of [
  'isCustomerFormalChainPassed',
  'customerGuardedStatusText',
  'customerGuardedAcceptanceText',
  'customerGuardedEvidenceText',
  'isTrustedCustomerValue',
  'isTrustedDashboardValueSummary',
  'customerValueSummaryText',
  'customerTrustScopeText',
]) {
  assertIncludes(trustGate, token, `customer trust gate ${token}`);
}

assertIncludes(trustGate, 'FORMAL_CHAIN_PASSED', 'formal chain trust level');
assertIncludes(trustGate, 'FORMAL_ACCEPTED', 'formal accepted trust level');
assertIncludes(trustGate, 'SIMULATED_DEV_ONLY', 'simulated downgrade');
assertIncludes(trustGate, 'LIMITED_FALLBACK', 'fallback downgrade');
assertIncludes(trustGate, 'INSUFFICIENT_FORMAL_EVIDENCE', 'insufficient evidence downgrade');
assertRegex(trustGate, /customer_visible_value\s*===\s*true[\s\S]*FORMAL_ACCEPTED/, 'customer value requires formal accepted');

assertIncludes(reportsApi, 'mapGuardedReportCode', 'guarded report code mapper exported');
assertIncludes(reportsApi, 'successLike', 'success-like codes must be guarded');
assertIncludes(reportsApi, '需复核', 'unguarded success-like codes downgrade');
assertNotIncludes(reportsApi, 'PASS: { label: "通过", tone: "success" }\n};\n\nexport function mapGuardedReportCode', 'guarded mapper must not be absent after raw PASS map');

assertIncludes(dashboardVm, 'customerGuardedStatusText(item)', 'dashboard recent status guarded');
assertIncludes(dashboardVm, 'customerGuardedAcceptanceText(item)', 'dashboard acceptance guarded');
assertIncludes(dashboardVm, 'customerGuardedEvidenceText(item)', 'dashboard evidence guarded');
assertIncludes(dashboardVm, 'isTrustedDashboardValueSummary', 'dashboard ROI summary trust gate');
assertIncludes(dashboardVm, '可信价值记录', 'dashboard distinguishes trusted value records');
assertIncludes(dashboardVm, '价值线索', 'dashboard downgrades untrusted value records');
assertNotIncludes(dashboardVm, 'labelFinalStatus(item.final_status)', 'dashboard must not render raw final_status');
assertNotIncludes(dashboardVm, 'labelAcceptanceStatus(item.acceptance_status)', 'dashboard must not render raw acceptance_status');

assertIncludes(fieldReportVm, 'customerGuardedStatusText(item)', 'field report recent status guarded');
assertIncludes(fieldReportVm, 'customerGuardedAcceptanceText(item)', 'field report acceptance guarded');
assertIncludes(fieldReportVm, 'customerGuardedEvidenceText(item)', 'field report evidence guarded');
assertIncludes(fieldReportVm, 'isTrustedDashboardValueSummary(valueSummary)', 'field report ROI summary trust gate');
assertIncludes(fieldReportVm, 'fieldMemoryFormalAvailable', 'field report memory trust gate');
assertIncludes(fieldReportVm, '未通过正式学习门禁', 'field report non-formal memory downgrade');
assertNotIncludes(fieldReportVm, 'labelFinalStatus(item.final_status)', 'field report must not render raw final_status');
assertNotIncludes(fieldReportVm, 'labelAcceptanceStatus(item.acceptance_status', 'field report must not render raw acceptance_status');

assertIncludes(operationReportVm, 'backendChainPassed', 'operation report already has backend chain gate');
assertIncludes(operationReportVm, 'chainPassed ? labelFinalStatus', 'operation report final status must be chain-gated');
assertIncludes(operationReportVm, 'chainPassed ? mapAcceptanceCopy', 'operation report acceptance must be chain-gated');
assertIncludes(operationReportVm, 'chainPassed ? ((report as any).roi_ledger ?? {}) : {}', 'operation report ROI must be chain-gated');
assertIncludes(operationReportVm, 'chainPassed ? ((report as any).field_memory ?? {}) : {}', 'operation report memory must be chain-gated');

console.log('[FRONTEND_CUSTOMER_TRUST_GATE_V1] PASSED');
console.log('[FRONTEND_CUSTOMER_TRUST_GATE_V1] Checked customer trust helper, guarded report code mapper, dashboard VM, field report VM, and operation report chain gate.');
