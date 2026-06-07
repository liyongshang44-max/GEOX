#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const rels = {
  formalCards: 'apps/web/src/components/customer/FormalScenarioCards.tsx',
  exportBlocks: 'apps/web/src/components/customer/CustomerExportBlocks.tsx',
  dashboardVm: 'apps/web/src/viewmodels/customerDashboardVm.ts',
  fieldVm: 'apps/web/src/viewmodels/fieldReportVm.ts',
  operationVm: 'apps/web/src/viewmodels/operationReportVm.ts',
  trustGate: 'apps/web/src/lib/customerTrustGate.ts',
  formalVm: 'apps/web/src/lib/formalScenarioViewModel.ts',
  scenarioLabels: 'apps/web/src/lib/customerScenarioLabels.ts',
  productLanguage: 'apps/web/src/lib/customerProductLanguage.ts',
  recentOps: 'apps/web/src/components/cockpit/RecentOperationsSection.tsx',
  fieldPage: 'apps/web/src/views/FieldReportPage.tsx',
  operationPage: 'apps/web/src/views/OperationReportPage.tsx',
  dashboardPage: 'apps/web/src/views/CustomerDashboardPage.tsx',
  productGate: 'scripts/agronomy_acceptance/ACCEPTANCE_SCENARIO_PRODUCTIZATION_RELEASE_GATE.cjs',
  reportMainVisualVm: 'apps/web/src/viewmodels/customerReportMainVisualVm.ts',
};

const failures = [];
function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    failures.push(`missing file: ${rel}`);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}
function assert(re, text, msg) {
  if (!re.test(text)) failures.push(msg);
}
function assertNot(re, text, msg) {
  if (re.test(text)) failures.push(msg);
}

const formalCards = read(rels.formalCards);
const exportBlocks = read(rels.exportBlocks);
const dashboardVm = read(rels.dashboardVm);
const fieldVm = read(rels.fieldVm);
const operationVm = read(rels.operationVm);
const trustGate = read(rels.trustGate);
const formalVm = read(rels.formalVm);
const scenarioLabels = read(rels.scenarioLabels);
const productLanguage = read(rels.productLanguage);
const recentOps = read(rels.recentOps);
const fieldPage = read(rels.fieldPage);
const operationPage = read(rels.operationPage);
const dashboardPage = read(rels.dashboardPage);
const productGate = read(rels.productGate);
const reportMainVisualVm = read(rels.reportMainVisualVm);

// Required components exist and expose controlled-pilot summaries.
for (const symbol of ['FormalScenarioBadge', 'FormalChainSummaryCard', 'ScenarioAcceptanceSummary', 'ScenarioValueMemorySummary', 'FailSafeCustomerNotice']) {
  assert(new RegExp(`export\\s+function\\s+${symbol}\\s*\\(`), formalCards, `${symbol} must exist in FormalScenarioCards`);
}
assert(/闭环明细|closureSteps/, formalCards, 'ScenarioAcceptanceSummary must show closure details');
if (!(/ROI trust lane/.test(formalVm) && /Field Memory trust lane/.test(formalVm))) failures.push('ScenarioValueMemorySummary must separate ROI and Field Memory trust lanes at VM level');
if (!(/trusted/.test(formalVm) && /estimate/.test(formalVm) && /hypothesis/.test(formalVm) && /insufficient evidence/.test(formalVm))) failures.push('ROI must distinguish trusted / estimate / hypothesis / insufficient evidence');
if (!(/formal memory/.test(formalVm) && /technical memory/.test(formalVm) && /simulated memory/.test(formalVm))) failures.push('Field Memory must distinguish formal / technical / simulated memory');

// PASS/SUCCESS must be guarded by backend chain_validation + explicit customer_visible_eligible.
assert(/const visibleEligible = ctx\.customer_visible_eligible === true/, trustGate, 'customer_visible_eligible must be explicitly true for formal pass');
assert(/chainPassed && visibleEligible && !needsReview/, trustGate, 'formal pass requires backend chain and visible eligibility');
assert(/mapGuardedOperationStatusToCustomerLabel/, operationVm, 'operation VM must route raw status through guarded mapper');
assertNot(/if\s*\(\s*\[[^\]]*(SUCCESS|PASS)[^\]]*\]\.includes\([^)]*\)\s*\)\s*return\s*["'`](正式完成|验收通过|已完成|已通过)/, dashboardVm + fieldVm + operationVm + formalCards, 'No raw SUCCESS/PASS mapping to formal completion without guarded backend status');

// Dashboard / field recent operations must keep formal status in VM but render productized text in UI.
for (const token of ['scenarioTypeText', 'formalChainStatusText', 'evidenceStatusText', 'needsReviewText']) {
  assert(new RegExp(token), dashboardVm, `dashboard VM recent operations must include ${token}`);
  assert(new RegExp(token), fieldVm, `field VM recent operations must include ${token}`);
}
assert(/正式链路：\{customerProductText\(item\.scenarioSummaryText/, recentOps, 'dashboard recent operations UI must render productized formal scenario summary');
assert(/复核状态：\{customerReviewStateText\(item\.needsReviewText\)/, recentOps, 'dashboard recent operations UI must render productized review state');
assert(/正式链路：\{customerProductText\(item\.formalScenarioText/, fieldPage, 'field recent operations UI must render productized formal scenario summary');
assert(/复核状态：\{customerReviewStateText\(item\.needsReviewText\)/, fieldPage, 'field recent operations UI must render productized review state');
assertNot(/guarded payload|scenario_type|formal_chain_status|evidence_status|needs_review\s*[=:：]/i, recentOps + fieldPage, 'customer recent operations must not render raw guarded payload labels');

// Product language adapter must translate known raw backend labels if they enter text fields.
for (const token of ['scenarioType', 'formalChainStatus', 'evidenceStatus', 'needsReview']) {
  assert(new RegExp(token), productLanguage, `customerProductLanguage must define ${token} replacement`);
}

// Three pilot scenarios must be recognizable; fertilization must remain experimental / non-selling.
for (const scenario of ['FORMAL_IRRIGATION', 'FORMAL_PEST_DISEASE_INSPECTION', 'DEVICE_ANOMALY']) {
  assert(new RegExp(scenario), scenarioLabels + formalVm + operationPage + dashboardPage, `${scenario} must be recognizable on customer pages`);
}
assert(/FORMAL_FERTILIZATION/, scenarioLabels + formalVm, 'FORMAL_FERTILIZATION must be handled if shown');
assert(/实验性\s*\/\s*non-selling|experimental\s*\/\s*non-selling/i, scenarioLabels + formalVm, 'FORMAL_FERTILIZATION must be marked experimental / non-selling');
assertNot(/FORMAL_FERTILIZATION[\s\S]{0,120}pilot eligible/i, scenarioLabels + formalVm + formalCards, 'FORMAL_FERTILIZATION must not be wrapped as pilot eligible');

// Export must reuse unified report-backed main visual VMs instead of page-field scatter assembly.
assert(/buildCustomerOperationReportMainVisualVm/, exportBlocks, 'operation export must use buildCustomerOperationReportMainVisualVm');
assert(/buildCustomerFieldReportMainVisualVm/, exportBlocks, 'field export must use buildCustomerFieldReportMainVisualVm');
assert(/mainVisual\.rows\.map/, exportBlocks, 'export must render CustomerReportMainVisualVm rows');
assert(/MainVisualExportBlocks/, exportBlocks, 'export must render through MainVisualExportBlocks');
assert(/INSUFFICIENT_REPORT/, reportMainVisualVm, 'CustomerReportMainVisualVm must expose INSUFFICIENT_REPORT');

// Fallback / limited data must remain review-only.
if (!(/fallback_limited/.test(trustGate) && /LIMITED_FALLBACK/.test(trustGate) && /return "LIMITED"/.test(trustGate))) failures.push('fallback / limited data must be explicitly handled');
if (!(/有限记录/.test(trustGate) && /需复核/.test(trustGate))) failures.push('limited/fallback text must not render formal completion');
assert(/ACCEPTANCE_CONTROLLED_PILOT_FRONTEND_AUDIT_V1\.cjs/, productGate, 'scenario productization gate must include controlled pilot frontend audit');

if (failures.length) {
  console.error('ACCEPTANCE_CONTROLLED_PILOT_FRONTEND_AUDIT_V1 failed');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('ACCEPTANCE_CONTROLLED_PILOT_FRONTEND_AUDIT_V1 passed');
