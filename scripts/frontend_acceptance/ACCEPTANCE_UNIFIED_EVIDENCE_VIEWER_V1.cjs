#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const FILES = {
  evidenceComponents: 'apps/web/src/components/evidence/index.tsx',
  evidenceVm: 'apps/web/src/lib/evidenceViewModel.ts',
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

  const customerBranch = components.match(/if \(mode === "operator"\) \{([\s\S]*?)\}\s*return <ul className="customerList">([\s\S]*?)<\/ul>;/);
  if (!customerBranch) throw new Error(`${FILES.evidenceComponents} missing explicit customer/operator branch in EvidenceRefList`);
  if (/\br\.ref\b/.test(customerBranch[2])) throw new Error(`${FILES.evidenceComponents} customer branch must not render r.ref`);
  if (!/\br\.ref\b/.test(customerBranch[1])) throw new Error(`${FILES.evidenceComponents} operator branch must render r.ref`);


  const customerForbidden = /(INSUFFICIENT|SIMULATED_DEV_ONLY|TECHNICAL_ONLY|Stage-1|sensing summary|soil_moisture|threshold|deficit|missing:)/;
  const operationEvidenceView = operationView.match(/统一证据视图[\s\S]*?<\/section>/)?.[0] ?? operationView;
  if (customerForbidden.test(operationEvidenceView)) throw new Error(`${FILES.operationView} customer evidence section leaked technical terms`);
  if (/证据信任级别：\{vm\.trustLevel\}/.test(components)) throw new Error(`${FILES.evidenceComponents} EvidenceTrustLegend must not render vm.trustLevel directly`);
  if (/vm\.gaps\.join\("、"\)/.test(components)) throw new Error(`${FILES.evidenceComponents} EvidenceGapPanel must not directly join raw gaps in customer mode`);
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
