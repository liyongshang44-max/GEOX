#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const FILES = {
  evidenceComponents: 'apps/web/src/components/evidence/index.tsx',
  evidenceVm: 'apps/web/src/lib/evidenceViewModel.ts',
  customerLabels: 'apps/web/src/lib/customerScenarioLabels.ts',
  operationView: 'apps/web/src/views/OperationReportPage.tsx',
  operatorView: 'apps/web/src/views/operator/OperatorEvidencePage.tsx',
  fieldView: 'apps/web/src/views/FieldReportPage.tsx',
};

function read(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(abs)) throw new Error(`missing required file: ${relPath}`);
  return fs.readFileSync(abs, 'utf8');
}

function includesAll(text, required, scope) {
  const missing = required.filter((needle) => !text.includes(needle));
  if (missing.length) throw new Error(`${scope} missing required tokens:\n- ${missing.join('\n- ')}`);
}

function assertNoForbidden(text, forbidden, scope) {
  const hits = forbidden.filter((rule) => rule.pattern.test(text)).map((rule) => rule.name);
  if (hits.length) throw new Error(`${scope} found forbidden patterns:\n- ${hits.join('\n- ')}`);
}

function main() {
  const components = read(FILES.evidenceComponents);
  const evidenceVm = read(FILES.evidenceVm);
  const operationView = read(FILES.operationView);
  const operatorView = read(FILES.operatorView);
  const fieldView = read(FILES.fieldView);
  const customerLabels = read(FILES.customerLabels);

  includesAll(evidenceVm, ['export type EvidenceVm', 'refs:', 'gaps:', 'operatorGaps?:', 'trustLevel:', 'trustText:'], FILES.evidenceVm);
  includesAll(components, [
    'export function EvidenceRefList',
    'type EvidenceViewMode = "customer" | "operator"',
    'mode = "customer"',
    'mode?: EvidenceViewMode',
    'export function EvidenceGapPanel',
    'export function FormalEvidenceBadge',
    'export function TechnicalSignalBadge',
    'export function SimulatedOrDebugEvidenceBadge',
    'export function MissingEvidenceBadge',
    'export function EvidenceTrustLegend',
    'vm.trustText',
  ], FILES.evidenceComponents);

  includesAll(operationView, ['统一证据视图', 'EvidenceTrustLegend', 'EvidenceRefList', 'EvidenceRefList vm={evidenceVm} mode="customer"', 'EvidenceGapPanel', 'EvidenceTrustBadge'], FILES.operationView);
  includesAll(operatorView, ['Unified Evidence Viewer', 'EvidenceTrustLegend', 'EvidenceRefList', 'EvidenceRefList vm={evidenceVm} mode="operator"', 'EvidenceGapPanel', 'EvidenceTrustBadge'], FILES.operatorView);
  includesAll(fieldView, ['统一证据视图', 'EvidenceTrustLegend', 'EvidenceRefList', 'EvidenceRefList vm={evidenceVm} mode="customer"', 'EvidenceGapPanel', 'EvidenceTrustBadge'], FILES.fieldView);

  const operatorToken = 'if (mode === "operator") {';
  const operatorStart = components.indexOf(operatorToken);
  if (operatorStart < 0) throw new Error(`${FILES.evidenceComponents} missing explicit customer/operator branch in EvidenceRefList`);
  const customerIndex = components.indexOf('const formalCount = vm.refs.filter', operatorStart);
  if (customerIndex < 0) throw new Error(`${FILES.evidenceComponents} missing customer summary branch in EvidenceRefList`);
  const operatorBody = components.slice(operatorStart, customerIndex);
  const customerBody = components.slice(customerIndex, components.indexOf('export function EvidenceGapPanel'));
  if (/\br\.ref\b/.test(customerBody)) throw new Error(`${FILES.evidenceComponents} customer branch must not render r.ref`);
  if (!/\br\.ref\b/.test(operatorBody)) throw new Error(`${FILES.evidenceComponents} operator branch must render r.ref`);
  if (/vm\.refs\.map\(/.test(customerBody)) throw new Error(`${FILES.evidenceComponents} customer branch must not map(vm.refs) to render MISSING refs directly`);
  if (/(证据缺失｜|缺失项)/.test(customerBody)) throw new Error(`${FILES.evidenceComponents} customer branch must not include “证据缺失｜缺失项”`);
  includesAll(customerBody, ['正式证据：{formalCount} 条', '技术信号：{technicalCount} 条', '模拟/调试记录：{simulatedCount} 条，不作为正式结论', '证据缺口：见下方摘要'], `${FILES.evidenceComponents} customer branch`);


  const customerForbidden = /(INSUFFICIENT|SIMULATED_DEV_ONLY|TECHNICAL_ONLY|Stage-1|sensing summary|soil_moisture|threshold|deficit|missing:)/;
  const operationEvidenceView = operationView.match(/统一证据视图[\s\S]*?<\/section>/)?.[0] ?? operationView;
  if (customerForbidden.test(operationEvidenceView)) throw new Error(`${FILES.operationView} customer evidence section leaked technical terms`);
  if (/证据信任级别：\{vm\.trustLevel\}/.test(components)) throw new Error(`${FILES.evidenceComponents} EvidenceTrustLegend must not render vm.trustLevel directly`);
  if (/vm\.gaps\.join\("、"\)/.test(components)) throw new Error(`${FILES.evidenceComponents} EvidenceGapPanel must not directly join raw gaps in customer mode`);
  includesAll(evidenceVm, ['customerEvidenceGapCategory', 'uniqueCategories', '还有 ${hiddenCount} 项需运营复核'], FILES.evidenceVm);
  includesAll(customerLabels, ['正式诊断依据不足', '建议、处方与审批链路尚未闭合', '正式执行回执与验收结果尚未成立', '正式验收未成立', '价值和田块记忆暂不对客展示'], FILES.customerLabels);
  assertNoForbidden(operationView, [{ name: 'page-level trust branching', pattern: /trustLevel\s*===\s*"(FORMAL|SIMULATED|TECHNICAL_ONLY)"/ }], FILES.operationView);
  assertNoForbidden(fieldView, [{ name: 'page-level trust branching', pattern: /trustLevel\s*===\s*"(FORMAL|SIMULATED|TECHNICAL_ONLY)"/ }], FILES.fieldView);

  console.log('[ACCEPTANCE_UNIFIED_EVIDENCE_VIEWER_V1] PASSED');
  Object.values(FILES).forEach((f) => console.log(`- checked: ${f}`));
}

try { main(); } catch (error) {
  console.error('[ACCEPTANCE_UNIFIED_EVIDENCE_VIEWER_V1] FAILED');
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
}
