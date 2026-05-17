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

  includesAll(evidenceVm, ['export type EvidenceVm', 'refs:', 'gaps:', 'trustLevel:'], FILES.evidenceVm);
  includesAll(components, [
    'export function EvidenceRefList',
    'export function EvidenceGapPanel',
    'export function FormalEvidenceBadge',
    'export function TechnicalSignalBadge',
    'export function SimulatedOrDebugEvidenceBadge',
    'export function MissingEvidenceBadge',
    'export function EvidenceTrustLegend',
  ], FILES.evidenceComponents);

  includesAll(operationView, ['统一证据视图', 'EvidenceTrustLegend', 'EvidenceRefList', 'EvidenceGapPanel', 'EvidenceTrustBadge'], FILES.operationView);
  includesAll(operatorView, ['Unified Evidence Viewer', 'EvidenceTrustLegend', 'EvidenceRefList', 'EvidenceGapPanel', 'EvidenceTrustBadge'], FILES.operatorView);
  includesAll(fieldView, ['统一证据视图', 'EvidenceTrustLegend', 'EvidenceRefList', 'EvidenceGapPanel', 'EvidenceTrustBadge'], FILES.fieldView);

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
