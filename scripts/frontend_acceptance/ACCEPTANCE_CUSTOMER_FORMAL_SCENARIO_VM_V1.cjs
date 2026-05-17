#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

function rel(p) { return path.relative(repoRoot, p).replace(/\\/g, '/'); }
function read(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

const targets = {
  formalVm: path.join(repoRoot, 'apps/web/src/lib/formalScenarioViewModel.ts'),
  dashboardVm: path.join(repoRoot, 'apps/web/src/viewmodels/customerDashboardVm.ts'),
  operationVm: path.join(repoRoot, 'apps/web/src/viewmodels/operationReportVm.ts'),
  fieldVm: path.join(repoRoot, 'apps/web/src/viewmodels/fieldReportVm.ts'),
  trustGate: path.join(repoRoot, 'apps/web/src/lib/customerTrustGate.ts'),
  reportsApi: path.join(repoRoot, 'apps/web/src/api/reports.ts'),
};

const failures = [];

for (const file of Object.values(targets)) {
  if (!fs.existsSync(file)) failures.push(`missing file: ${rel(file)}`);
}

const formalText = read(targets.formalVm) || '';
if (!/export\s+function\s+buildFormalScenarioVm\s*\(/.test(formalText)) {
  failures.push(`missing buildFormalScenarioVm export in ${rel(targets.formalVm)}`);
}

const requiredReuse = [
  'customerGuardedStatusText',
  'customerGuardedAcceptanceText',
  'customerGuardedEvidenceText',
  'mapGuardedReportCode',
];
for (const symbol of requiredReuse) {
  if (!new RegExp(`\\b${symbol}\\b`).test(formalText)) {
    failures.push(`${rel(targets.formalVm)} must reuse ${symbol}`);
  }
}

const dashboardText = read(targets.dashboardVm) || '';
if (!/buildFormalScenarioVm\s*\(/.test(dashboardText)
    && !/customerGuardedStatusText|customerGuardedAcceptanceText|customerGuardedEvidenceText/.test(dashboardText)) {
  failures.push(`${rel(targets.dashboardVm)} must use formal scenario VM or guarded helpers`);
}

const operationText = read(targets.operationVm) || '';
if (!/buildFormalScenarioVm\s*\(/.test(operationText)
    && !/customerGuardedStatusText|customerGuardedAcceptanceText|customerGuardedEvidenceText/.test(operationText)) {
  failures.push(`${rel(targets.operationVm)} must use formal scenario VM or guarded helpers`);
}

// Ban direct raw enum -> customer copy mapping in operation/field/dashboard/formal vm.
const rawEnumDangerRules = [
  { re: /status\s*===\s*['\"]PASS['\"]\s*\)\s*return\s*['\"][^'\"]*(通过|完成)/, msg: 'PASS directly rendered to customer success copy' },
  { re: /\[\s*['\"]SUCCESS['\"][^\]]*\]\s*\.includes\(status\)\s*\)\s*return\s*['\"][^'\"]*(完成|通过)/, msg: 'SUCCESS-like enum list directly rendered to customer success copy' },
];

const strictFiles = [targets.formalVm, targets.dashboardVm, targets.fieldVm];
for (const file of strictFiles) {
  const text = read(file) || '';
  for (const rule of rawEnumDangerRules) {
    if (rule.re.test(text)) failures.push(`${rel(file)}: ${rule.msg}`);
  }
}

if (failures.length) {
  console.error('ACCEPTANCE_CUSTOMER_FORMAL_SCENARIO_VM_V1 failed');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}

console.log('ACCEPTANCE_CUSTOMER_FORMAL_SCENARIO_VM_V1 passed');
