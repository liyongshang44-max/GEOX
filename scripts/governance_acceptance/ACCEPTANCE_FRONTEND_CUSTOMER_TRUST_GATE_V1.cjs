#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const webSrc = path.join(root, 'apps/web/src');
const files = {
  customerTrustGate: path.join(webSrc, 'lib/customerTrustGate.ts'),
  operationReportVm: path.join(webSrc, 'viewmodels/operationReportVm.ts'),
  customerDashboardVm: path.join(webSrc, 'viewmodels/customerDashboardVm.ts'),
  aggregateGate: path.join(root, 'scripts/governance_acceptance/ACCEPTANCE_BASE_CONTRACT_P0_RELEASE_GATE_V1.cjs'),
  packageJson: path.join(root, 'package.json'),
};

function read(file) { return fs.readFileSync(file, 'utf8'); }
function fail(message) { console.error(`[frontend-customer-trust-gate] FAIL: ${message}`); process.exit(1); }
function assert(condition, message) { if (!condition) fail(message); }
function assertIncludes(source, needle, label) { assert(source.includes(needle), `${label} must include ${needle}`); }
function assertNotIncludes(source, needle, label) { assert(!source.includes(needle), `${label} must not include ${needle}`); }
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const customerTrustGate = read(files.customerTrustGate);
const operationReportVm = read(files.operationReportVm);
const customerDashboardVm = read(files.customerDashboardVm);
const aggregateGate = read(files.aggregateGate);
const packageJson = read(files.packageJson);

for (const fn of [
  'customerTrustContextFromReportLike',
  'isCustomerFormalChainPassed',
  'customerGuardedStatusText',
  'customerGuardedAcceptanceText',
  'customerGuardedEvidenceText',
  'customerValueSummaryText',
  'mapGuardedOperationStatusToCustomerLabel',
]) assertIncludes(customerTrustGate, fn, 'customerTrustGate');

assertIncludes(customerTrustGate, 'if (!ctx) return "需复核"', 'status mapper safe default');
assertIncludes(customerTrustGate, 'return "正式完成"', 'formal guarded completion text');
assertIncludes(customerTrustGate, 'return "验收通过"', 'formal guarded acceptance text');
assertIncludes(customerTrustGate, '缺少正式链路校验时不形成收益结论', 'weak value text');

assertIncludes(operationReportVm, 'customerGuardedStatusText', 'operation report VM status trust gate');
assertIncludes(operationReportVm, 'customerGuardedAcceptanceText', 'operation report VM acceptance trust gate');
assertIncludes(operationReportVm, 'customerGuardedEvidenceText', 'operation report VM evidence trust gate');
assertIncludes(operationReportVm, 'isTrustedCustomerValue', 'operation report VM ROI trust gate');
assertIncludes(operationReportVm, 'mapGuardedOperationStatusToCustomerLabel(report.execution.final_status, trustContext)', 'operation report VM guarded status mapping');
assertIncludes(operationReportVm, '技术状态/审计字段：raw_enum', 'raw status must be technical foldout only');
assertIncludes(operationReportVm, 'ASSUMPTION_BASED、估算、模拟或未通过正式链路的 ROI 不进入客户可信收益', 'weak ROI customer text');
assertNotIncludes(operationReportVm, 'if (["SUCCESS", "DONE", "COMPLETED", "APPROVED", "PASS", "VALID"].includes(status)) return "已完成"', 'raw success mapping forbidden');
assertNotIncludes(operationReportVm, 'function mapOperationStatusToCustomerLabel(value: unknown): string', 'status mapper must require context');

for (const fn of ['customerGuardedStatusText', 'customerGuardedAcceptanceText', 'customerGuardedEvidenceText', 'customerValueSummaryText', 'isTrustedDashboardValueSummary']) {
  assertIncludes(customerDashboardVm, fn, 'customer dashboard VM trust gate');
}

const customerFiles = walk(webSrc).filter((file) => {
  const rel = path.relative(webSrc, file).replace(/\\/g, '/');
  return rel.includes('views/') || rel.includes('viewmodels/') || rel.includes('components/customer') || rel.includes('lib/customer');
});
const dangerousRules = [
  { status: 'SUCCESS', label: '已完成' },
  { status: 'PASS', label: '验收通过' },
  { status: 'VALID', label: '已完成' },
];
for (const file of customerFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const source = read(file);
  const hasTrustGate = /customerTrustGate|customerGuarded|mapGuardedOperationStatusToCustomerLabel|isCustomerFormalChainPassed|isTrustedCustomerValue/.test(source);
  const allowTechnical = /技术状态\/审计字段|customer-boundary-allow|ACCEPTANCE_FRONTEND_CUSTOMER_TRUST_GATE/.test(source);
  for (const rule of dangerousRules) {
    const statusIdx = source.indexOf(rule.status);
    const labelIdx = source.indexOf(rule.label);
    if (statusIdx >= 0 && labelIdx >= 0 && !hasTrustGate && !allowTechnical) {
      fail(`${rel} appears to map raw ${rule.status} to ${rule.label} without customer trust context`);
    }
  }
}

assertIncludes(packageJson, 'ci:frontend:customer-trust-gate', 'package script');
assertIncludes(aggregateGate, 'ACCEPTANCE_FRONTEND_CUSTOMER_TRUST_GATE_V1', 'Base Contract P0 aggregate gate');
assertIncludes(aggregateGate, 'scripts/governance_acceptance/ACCEPTANCE_FRONTEND_CUSTOMER_TRUST_GATE_V1.cjs', 'Base Contract P0 aggregate gate');

const fixture = String.raw`
(async () => {
const gate = await import('./src/lib/customerTrustGate.ts');
const vm = await import('./src/viewmodels/operationReportVm.ts');
function assertRuntime(condition, message) { if (!condition) throw new Error(message); }
const weak = { execution: { final_status: 'SUCCESS' }, acceptance: { status: 'PASS' }, evidence: { evidence_status: 'MISSING' }, chain_validation: { passed: false }, customer_visible_eligible: false, fallback_limited: true, trust_level: 'LIMITED_FALLBACK' };
assertRuntime(gate.mapGuardedOperationStatusToCustomerLabel('SUCCESS') === '需复核', 'raw SUCCESS without trust context must be review');
assertRuntime(gate.mapGuardedOperationStatusToCustomerLabel('PASS') === '需复核', 'raw PASS without trust context must be review');
assertRuntime(gate.mapGuardedOperationStatusToCustomerLabel('VALID') === '需复核', 'raw VALID without trust context must be review');
assertRuntime(gate.customerGuardedStatusText(weak) !== '正式完成', 'weak report must not show formal completion');
assertRuntime(gate.customerGuardedAcceptanceText(weak) !== '验收通过', 'weak report must not show acceptance pass');
const formal = { execution: { final_status: 'SUCCESS' }, acceptance: { status: 'PASS', formal_acceptance: true }, evidence_status: 'FORMAL_PASSED', chain_validation: { passed: true }, customer_visible_eligible: true, needs_review: false, fallback_limited: false, trust_level: 'FORMAL_CHAIN_PASSED', guarded_projection: { passed: true, trust_level: 'FORMAL_CHAIN_PASSED', chain_status: 'PASSED' } };
assertRuntime(gate.mapGuardedOperationStatusToCustomerLabel('SUCCESS', formal) === '正式完成', 'formal guarded SUCCESS may show formal completion');
assertRuntime(gate.customerGuardedAcceptanceText(formal) === '验收通过', 'formal guarded report may show acceptance pass');
const assumptionSummary = { has_customer_visible_value: false, trust_level: 'HYPOTHESIS_ONLY', total_roi_items: 1 };
assertRuntime(!gate.customerValueSummaryText(assumptionSummary, 1, String).includes('正式可信价值记录'), 'assumption ROI must not show trusted value');
const minimalReport = { identifiers: { operation_id: 'op1', operation_plan_id: 'op1', field_id: 'field1' }, generated_at: new Date().toISOString(), workflow: {}, risk: { level: 'LOW', reasons: [] }, execution: { final_status: 'SUCCESS' }, acceptance: { status: 'PASS', missing_evidence: false }, evidence: { artifacts_count: 1, logs_count: 1, media_count: 0, metrics_count: 0 }, sla: {}, cost: {}, roi_ledger: { items: [{ value_kind: 'ASSUMPTION_BASED', customer_visible_value: false, trust_level: 'HYPOTHESIS_ONLY', estimated_money_value: 1 }] }, chain_validation: { passed: false }, customer_visible_eligible: false, fallback_limited: true, trust_level: 'LIMITED_FALLBACK' };
const built = vm.buildOperationReportVm(minimalReport);
assertRuntime(built.operation.finalStatusLabel !== '已完成' && built.operation.finalStatusLabel !== '正式完成', 'weak VM must not show completed');
assertRuntime(built.acceptance.statusText !== '验收通过', 'weak VM must not show acceptance pass');
assertRuntime(!built.value.fallbackText.includes('可信收益已记录'), 'assumption ROI must not show trusted earning');
})();
`;
const runtime = spawnSync('pnpm', ['--filter', '@geox/web', 'exec', 'tsx', '-e', fixture], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (runtime.status !== 0) { process.stderr.write(runtime.stdout || ''); process.stderr.write(runtime.stderr || ''); fail('runtime fixture failed'); }

console.log('[frontend-customer-trust-gate] PASS');
