#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const FILES = {
  customerReportsApi: 'apps/web/src/api/customerReports.ts',
  customerDashboardExport: 'apps/web/src/views/CustomerDashboardExportPage.tsx',
  fieldExport: 'apps/web/src/views/FieldReportExportPage.tsx',
  operationExportAlias: 'apps/web/src/views/OperationReportExportPage.tsx',
  customerReportExport: 'apps/web/src/views/CustomerReportExportPage.tsx',
  exportBlocks: 'apps/web/src/components/customer/CustomerExportBlocks.tsx',
  dashboardVm: 'apps/web/src/viewmodels/customerDashboardVm.ts',
  safeText: 'apps/web/src/lib/customerSafeText.ts',
  reportMainVisualVm: 'apps/web/src/viewmodels/customerReportMainVisualVm.ts',
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

  const customerReportsApi = read(FILES.customerReportsApi);
  const dashboardExport = read(FILES.customerDashboardExport);
  const fieldExport = read(FILES.fieldExport);
  const operationExportAlias = read(FILES.operationExportAlias);
  const customerReportExport = read(FILES.customerReportExport);
  const exportBlocks = read(FILES.exportBlocks);
  const dashboardVm = read(FILES.dashboardVm);
  const safeText = read(FILES.safeText);

  assertContains(customerReportsApi, /fetchCustomerDashboardAggregate/, 'customerReports.ts must expose fetchCustomerDashboardAggregate', failures);
  assertContains(customerReportsApi, /fetchFieldReport/, 'customerReports.ts must expose fetchFieldReport', failures);
  assertContains(customerReportsApi, /fetchOperationReport/, 'customerReports.ts must expose fetchOperationReport', failures);

  assertContains(dashboardExport, /from\s+["']\.\.\/api\/customerReports["']/, 'CustomerDashboardExportPage must import from ../api/customerReports', failures);
  assertContains(fieldExport, /from\s+["']\.\.\/api\/customerReports["']/, 'FieldReportExportPage must import from ../api/customerReports', failures);
  assertContains(customerReportExport, /from\s+["']\.\.\/api\/customerReports["']/, 'CustomerReportExportPage must import from ../api/customerReports', failures);
  assertContains(exportBlocks, /from\s+["']\.\.\/\.\.\/api\/customerReports["']/, 'CustomerExportBlocks must import report types from ../../api/customerReports', failures);

  for (const [name, text] of Object.entries({ dashboardExport, fieldExport, customerReportExport, exportBlocks })) {
    assertNotContains(text, /from\s+["'][^"']*api\/reports["']/, `${name} must not import from api/reports`, failures);
  }

  assertContains(dashboardExport, /fetchCustomerDashboardAggregate\s*\(/, 'CustomerDashboardExportPage must fetch via fetchCustomerDashboardAggregate', failures);
  assertContains(fieldExport, /fetchFieldReport\s*\(/, 'FieldReportExportPage must fetch via fetchFieldReport', failures);
  assertContains(customerReportExport, /fetchFieldReport\s*\(/, 'CustomerReportExportPage must fetch field via fetchFieldReport', failures);
  assertContains(customerReportExport, /fetchOperationReport\s*\(/, 'CustomerReportExportPage must fetch operation via fetchOperationReport', failures);
  assertContains(customerReportExport, /fetchCustomerDashboardAggregate\s*\(/, 'CustomerReportExportPage must fetch dashboard via fetchCustomerDashboardAggregate', failures);

  const forbiddenFetchers = [/fetch\w*Legacy\w*\s*\(/, /fetchCustomerReportsCenter\s*\(/, /fetchCustomerReport\s*\(/, /fetchCustomerFields\s*\(/, /fetchCustomerOperations\s*\(/, /apiRequest\s*\(/, /apiRequestWithPolicy\s*\(/];
  for (const re of forbiddenFetchers) {
    assertNotContains(dashboardExport, re, `CustomerDashboardExportPage contains forbidden fetch path: ${re}`, failures);
    assertNotContains(fieldExport, re, `FieldReportExportPage contains forbidden fetch path: ${re}`, failures);
    assertNotContains(customerReportExport, re, `CustomerReportExportPage contains forbidden fetch path: ${re}`, failures);
  }

  const reportMainVisual = read(FILES.reportMainVisualVm);
  read(FILES.scenarioLabels);
  assertContains(exportBlocks, /buildCustomerFieldReportMainVisualVm\s*\(/, 'CustomerExportBlocks must use buildCustomerFieldReportMainVisualVm', failures);
  assertContains(exportBlocks, /buildCustomerOperationReportMainVisualVm\s*\(/, 'CustomerExportBlocks must use buildCustomerOperationReportMainVisualVm', failures);
  assertContains(exportBlocks, /MainVisualExportBlocks/, 'CustomerExportBlocks must render through MainVisualExportBlocks', failures);
  assertContains(exportBlocks, /mainVisual\.rows\.map/, 'CustomerExportBlocks must render CustomerReportMainVisualVm rows', failures);
  assertContains(reportMainVisual, /INSUFFICIENT_REPORT/, 'CustomerReportMainVisualVm must own insufficient report state', failures);
  assertContains(reportMainVisual, /缺少正式 report API 数据/, 'CustomerReportMainVisualVm must own missing report wording', failures);

  assertNotContains(exportBlocks, /buildFormalScenarioVm/, 'export must not build formal scenario directly', failures);
  assertNotContains(exportBlocks, /buildEvidenceVm/, 'export must not build evidence directly', failures);
  assertNotContains(exportBlocks, /customerGuardedStatusText/, 'export must not call customerTrustGate status helper directly', failures);
  assertNotContains(exportBlocks, /customerGuardedEvidenceText/, 'export must not call customerTrustGate evidence helper directly', failures);
  assertNotContains(exportBlocks, /customerGuardedAcceptanceText/, 'export must not call customerTrustGate acceptance helper directly', failures);
  assertNotContains(exportBlocks, /pdiEvidenceBasisRows/, 'export must not use legacy PDI evidence rows directly', failures);

  assertNotContains(exportBlocks, /\bSUCCESS\b\s*[:=]|\bPASS\b\s*[:=]/, 'CustomerExportBlocks must not hardcode SUCCESS/PASS mapping', failures);
  const rawLeakPatterns = [
    ['PENDING_ACCEPTANCE', /\bPENDING_ACCEPTANCE\b/],
    ['PENDING_ACCEPTANCE_REQUIRES_FORMAL_REVIEW', /PENDING_ACCEPTANCE_REQUIRES_FORMAL_REVIEW/],
    ['soil_moisture_below_threshold', /soil_moisture_below_threshold/],
    ['no_rain_forecast', /no_rain_forecast/],
    ['BLOCKED', /\bBLOCKED\b/],
    ['field.geometry', /field\.geometry/i],
    ['geometry_id', /geometry_id/i],
  ];
  for (const [label, pattern] of rawLeakPatterns) assertNotContains(exportBlocks, pattern, `CustomerExportBlocks must not expose raw customer code literal: ${label}`, failures);
  for (const helper of ['customerReasonText', 'customerOperationStateText', 'customerNeedsReviewText', 'customerEvidenceStateText']) assertContains(exportBlocks, new RegExp(`\\b${helper}\\b`), `CustomerExportBlocks must route through ${helper}`, failures);
  assertContains(exportBlocks, /key === "true" \|\| key === "false"/, 'CustomerExportBlocks safeExportText must explicitly detect true/false', failures);
  assertContains(exportBlocks, /customerNeedsReviewText\(text\)/, 'CustomerExportBlocks must convert true/false through customerNeedsReviewText', failures);
  assertNotContains(exportBlocks, /<td[^>]*>\{\s*cell\s*(?:\|\||\?\?|\})/, 'CustomerExportBlocks must not render raw table cell values directly', failures);

  assertNotContains(dashboardVm, /scenarioTypeText:\s*formalVm\.rawScenarioType/, 'Dashboard VM must not pass raw scenario type to export', failures);
  assertNotContains(dashboardVm, /formalChainStatusText:\s*formalVm\.formalChainStatus/, 'Dashboard VM must not pass raw formal chain status to export', failures);
  assertNotContains(dashboardVm, /evidenceStatusText:\s*formalVm\.rawEvidenceStatus/, 'Dashboard VM must not pass raw evidence status to export', failures);
  assertNotContains(dashboardVm, /needsReviewText:\s*formalVm\.needsReview\s*\?\s*["']true["']\s*:\s*["']false["']/, 'Dashboard VM must not pass raw boolean review state to export', failures);
  for (const helper of ['customerFormalChainText', 'customerEvidenceStateText', 'customerNeedsReviewText']) assertContains(dashboardVm, new RegExp(`\\b${helper}\\b`), `Dashboard VM must route through ${helper}`, failures);

  for (const phrase of ['等待正式验收', '需正式验收后确认', '土壤水分偏低', '近期无降雨预报', '暂不形成正式结论', '需要人工复核', '暂不需要人工复核', '链路待校验', '链路已通过', '有限记录', '证据待补充', '证据已通过']) {
    if (!safeText.includes(phrase)) failures.push(`customerSafeText missing phrase: ${phrase}`);
  }

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
