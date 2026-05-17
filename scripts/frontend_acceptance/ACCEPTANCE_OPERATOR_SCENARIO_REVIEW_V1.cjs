#!/usr/bin/env node
/*
 * GEOX operator scenario review acceptance v1.
 *
 * Validate that operator evidence review surfaces required formal-scenario
 * diagnostics and does not violate acceptance semantics constraints.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const FILES = {
  view: 'apps/web/src/views/operator/OperatorEvidencePage.tsx',
  panels: 'apps/web/src/components/operator/OperatorScenarioReviewPanels.tsx',
};

function read(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`missing required file: ${relPath}`);
  }
  return fs.readFileSync(abs, 'utf8');
}

function includesAll(text, required, scope) {
  const missing = required.filter((needle) => !text.includes(needle));
  if (missing.length) {
    throw new Error(`${scope} missing required tokens:\n- ${missing.join('\n- ')}`);
  }
}

function assertNoForbidden(text, forbidden, scope) {
  const hits = forbidden.filter((rule) => rule.pattern.test(text)).map((rule) => rule.name);
  if (hits.length) {
    throw new Error(`${scope} found forbidden patterns:\n- ${hits.join('\n- ')}`);
  }
}

function main() {
  const view = read(FILES.view);
  const panels = read(FILES.panels);

  includesAll(view, [
    'aria-label="formal-scenario-review"',
    'OperatorFormalChainTimeline',
    'OperatorEvidenceGapPanel',
    'OperatorAcceptanceReasonPanel',
    'OperatorFailSafePanel',
    'OperatorManualTakeoverPanel',
    'OperatorZoneMatrixPanel',
    'ROI Trust Lane',
    'Field Memory Lane',
  ], FILES.view);

  includesAll(panels, [
    'Formal Chain Timeline',
    'Formal evidence refs',
    'Missing Evidence Gaps',
    'Fail-safe / Device Health',
    'Manual Takeover State',
    'Zone-level Evidence Matrix',
    'Operation rollup policy',
    'Acceptance Reason Codes',
    'Approval state',
    'Task state',
    'Receipt state',
  ], FILES.panels);

  assertNoForbidden(panels, [
    {
      name: 'frontend recompute acceptance result',
      pattern: /zone_acceptance_result\s*=\s*[^=]|acceptance\s*\.\s*status\s*=|acceptance\s*\.\s*verdict\s*=/,
    },
    {
      name: 'receipt success treated as pass',
      pattern: /receipt[^\n]*PASS|PASS[^\n]*receipt|receipt[^\n]*SUCCESS[^\n]*PASS/i,
    },
    {
      name: 'mutating customer report status',
      pattern: /customer\s*report[^\n]*status\s*=|setCustomerReportStatus|updateCustomerReportStatus/i,
    },
  ], FILES.panels);

  console.log('[ACCEPTANCE_OPERATOR_SCENARIO_REVIEW_V1] PASSED');
  console.log(`- checked: ${FILES.view}`);
  console.log(`- checked: ${FILES.panels}`);
}

try {
  main();
} catch (error) {
  console.error('[ACCEPTANCE_OPERATOR_SCENARIO_REVIEW_V1] FAILED');
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
}
