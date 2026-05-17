#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const FILES = {
  reportsApi: 'apps/web/src/api/reports.ts',
  customerDashboardExport: 'apps/web/src/views/CustomerDashboardExportPage.tsx',
  fieldExport: 'apps/web/src/views/FieldReportExportPage.tsx',
  operationExportAlias: 'apps/web/src/views/OperationReportExportPage.tsx',
  customerReportExport: 'apps/web/src/views/CustomerReportExportPage.tsx',
  exportBlocks: 'apps/web/src/components/customer/CustomerExportBlocks.tsx',
  formalVm: 'apps/web/src/lib/formalScenarioViewModel.ts',
  trustGate: 'apps/web/src/lib/customerTrustGate.ts',
  evidenceVm: 'apps/web/src/lib/evidenceViewModel.ts',
  scenarioLabels: 'apps/web/src/lib/customerScenarioLabels.ts',
};

function read(rel) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`missing file: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function assertContains(text, re, msg, failures) {
  if (!re.test(text)) failures.push(msg);
}

function assertNotContains(text, re, msg, failures) {
  if (re.test(text)) failures.push(msg);
}

function main() {
  const failures = [];

  const reportsApi = read(FILES.reportsApi);
  const dashboardExport = read(FILES.customerDashboardExport);
  const fieldExport = read(FILES.fieldExport);
  const operationExportAlias = read(FILES.operationExportAlias);
  const customerReportExport = read(FILES.customerReportExport);
  const exportBlocks = read(FILES.exportBlocks);

  // 0) Official reports API must expose exactly required fetchers used by export.
  assertContains(reportsApi, /export\s+async\s+function\s+fetchCustomerDashboardAggregate\s*\(/, 'reports.ts must export fetchCustomerDashboardAggregate', failures);
  assertContains(reportsApi, /export\s+async\s+function\s+fetchFieldReport\s*\(/, 'reports.ts must export fetchFieldReport', failures);
  assertContains(reportsApi, /export\s+async\s+function\s+fetchOperationReport\s*\(/, 'reports.ts must export fetchOperationReport', failures);

  // 1) Export pages/components must consume same-source official reports API directly.
  assertContains(dashboardExport, /from\s+["']\.\.\/api\/reports["']/, 'CustomerDashboardExportPage must import from ../api/reports', failures);
  assertContains(fieldExport, /from\s+["']\.\.\/api\/reports["']/, 'FieldReportExportPage must import from ../api/reports', failures);
  assertContains(customerReportExport, /from\s+["']\.\.\/api\/reports["']/, 'CustomerReportExportPage must import from ../api/reports', failures);
  assertContains(exportBlocks, /from\s+["']\.\.\/\.\.\/api\/reports["']/, 'CustomerExportBlocks must import report types from ../../api/reports', failures);

  // No alias/legacy api import on export route.
  for (const [name, text] of Object.entries({ dashboardExport, fieldExport, customerReportExport, exportBlocks })) {
    assertNotContains(text, /from\s+["'][^"']*api\/customerReports["']/, `${name} must not import from api/customerReports`, failures);
  }

  // 2) Export should only fetch from the three approved methods.
  assertContains(dashboardExport, /fetchCustomerDashboardAggregate\s*\(/, 'CustomerDashboardExportPage must fetch via fetchCustomerDashboardAggregate', failures);
  assertContains(fieldExport, /fetchFieldReport\s*\(/, 'FieldReportExportPage must fetch via fetchFieldReport', failures);
  assertContains(customerReportExport, /fetchFieldReport\s*\(/, 'CustomerReportExportPage must fetch field via fetchFieldReport', failures);
  assertContains(customerReportExport, /fetchOperationReport\s*\(/, 'CustomerReportExportPage must fetch operation via fetchOperationReport', failures);
  assertContains(customerReportExport, /fetchCustomerDashboardAggregate\s*\(/, 'CustomerReportExportPage must fetch dashboard via fetchCustomerDashboardAggregate', failures);

  const forbiddenFetchers = [
    /fetch\w*Legacy\w*\s*\(/,
    /fetchCustomerReportsCenter\s*\(/,
    /fetchCustomerReport\s*\(/,
    /fetchCustomerFields\s*\(/,
    /fetchCustomerOperations\s*\(/,
    /apiRequest\s*\(/,
    /apiRequestWithPolicy\s*\(/,
  ];
  for (const re of forbiddenFetchers) {
    assertNotContains(dashboardExport, re, `CustomerDashboardExportPage contains forbidden fetch path: ${re}`, failures);
    assertNotContains(fieldExport, re, `FieldReportExportPage contains forbidden fetch path: ${re}`, failures);
    assertNotContains(customerReportExport, re, `CustomerReportExportPage contains forbidden fetch path: ${re}`, failures);
  }

  // 3) Export same helper stack: scenario labels/vm, trust gate, evidence vm.
  read(FILES.formalVm);
  read(FILES.trustGate);
  read(FILES.evidenceVm);
  read(FILES.scenarioLabels);
  assertContains(exportBlocks, /buildFormalScenarioVm\s*\(/, 'CustomerExportBlocks must use formalScenarioViewModel', failures);
  assertContains(exportBlocks, /customerGuardedStatusText\s*\(/, 'CustomerExportBlocks must use customerTrustGate status helper', failures);
  assertContains(exportBlocks, /customerGuardedEvidenceText\s*\(/, 'CustomerExportBlocks must use customerTrustGate evidence helper', failures);
  assertContains(exportBlocks, /customerGuardedAcceptanceText\s*\(/, 'CustomerExportBlocks must use customerTrustGate acceptance helper', failures);
  assertContains(exportBlocks, /buildEvidenceVm\s*\(/, 'CustomerExportBlocks must use evidenceViewModel', failures);

  // 4) Ban dangerous direct mapping/leaks in export blocks.
  assertNotContains(exportBlocks, /\bSUCCESS\b\s*[:=]|\bPASS\b\s*[:=]/, 'CustomerExportBlocks must not hardcode SUCCESS/PASS mapping', failures);

  // 5) operation export alias should keep delegation only.
  assertContains(operationExportAlias, /export\s*\{\s*default\s*\}\s*from\s*["']\.\/CustomerReportExportPage["']/, 'OperationReportExportPage must re-export CustomerReportExportPage', failures);

  if (failures.length) {
    console.error('ACCEPTANCE_SCENARIO_EXPORT_SAME_SOURCE_V1 failed');
    for (const item of failures) console.error(` - ${item}`);
    process.exit(1);
  }

  console.log('ACCEPTANCE_SCENARIO_EXPORT_SAME_SOURCE_V1 passed');
}

try { main(); } catch (error) {
  console.error('ACCEPTANCE_SCENARIO_EXPORT_SAME_SOURCE_V1 failed');
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
