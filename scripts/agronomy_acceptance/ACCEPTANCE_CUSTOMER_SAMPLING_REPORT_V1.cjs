#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

function read(rel) {
  return readFileSync(resolve(__dirname, '..', '..', rel), 'utf8');
}

const viewModel = read('apps/web/src/lib/formalScenarioViewModel.ts');
const labels = read('apps/web/src/lib/customerScenarioLabels.ts');

const checks = {
  view_model_has_sampling_summary:
    /function\s+samplingSummaryText\(value:\s*any\):\s*string\s*\|\s*undefined\s*\{/m.test(viewModel) &&
    /const\s+sampling\s*=\s*value\?\.sampling\s*\?\?\s*\{\}/m.test(viewModel) &&
    /return\s*\[\.\.\.scenarioReasons,\s*\.\.\.samplingReasons,\s*\.\.\.missingItems,\s*\.\.\.chainReasons\]/m.test(viewModel),

  view_model_prioritizes_sampling_summary:
    /zoneSummaryText:\s*samplingSummaryText\(reportOrOperation\)\s*\?\?\s*zoneSummaryText\(reportOrOperation\)/m.test(viewModel),

  customer_labels_cover_sampling_cases:
    labels.includes('"sampling_lab_invalid"') &&
    labels.includes('"sampling_simulated"') &&
    labels.includes('"sampling_missing_receipt"') &&
    labels.includes('"sampling_passed"'),
};

const output = {
  ok: Object.values(checks).every(Boolean),
  suite: 'ACCEPTANCE_CUSTOMER_SAMPLING_REPORT_V1',
  checks,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!output.ok) process.exit(1);
