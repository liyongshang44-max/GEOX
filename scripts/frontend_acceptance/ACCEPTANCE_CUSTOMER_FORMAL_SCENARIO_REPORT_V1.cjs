#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const FILES = {
  dashboard: 'apps/web/src/views/CustomerDashboardPage.tsx',
  field: 'apps/web/src/views/FieldReportPage.tsx',
  operation: 'apps/web/src/views/OperationReportPage.tsx',
  cards: 'apps/web/src/components/customer/FormalScenarioCards.tsx',
  vm: 'apps/web/src/lib/formalScenarioViewModel.ts',
  labels: 'apps/web/src/lib/customerScenarioLabels.ts',
};

function read(rel) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`missing file: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function fail(msg, failures) { failures.push(msg); }

function assertContains(text, re, msg, failures) {
  if (!re.test(text)) fail(msg, failures);
}

function main() {
  const failures = [];
  const dashboard = read(FILES.dashboard);
  const field = read(FILES.field);
  const operation = read(FILES.operation);
  const cards = read(FILES.cards);
  const vm = read(FILES.vm);
  const labels = read(FILES.labels);

  // Wiring checks
  assertContains(dashboard, /FormalScenarioBadge\s+data=\{aggregate\.recent_operations\[0\]\}/, 'dashboard must render FormalScenarioBadge for latest operation', failures);
  assertContains(field, /FormalChainSummaryCard\s+data=\{reportAny\.recent_operations\[0\]\}/, 'field report must render FormalChainSummaryCard', failures);
  assertContains(field, /ScenarioAcceptanceSummary\s+data=\{reportAny\.recent_operations\[0\]\}/, 'field report must render ScenarioAcceptanceSummary', failures);
  assertContains(operation, /FormalScenarioBadge\s+data=\{report\}/, 'operation report must render FormalScenarioBadge', failures);
  assertContains(operation, /FormalChainSummaryCard\s+data=\{report\}/, 'operation report must render FormalChainSummaryCard', failures);
  assertContains(operation, /ScenarioAcceptanceSummary\s+data=\{report\}/, 'operation report must render ScenarioAcceptanceSummary', failures);
  assertContains(operation, /ScenarioValueMemorySummary\s+data=\{report\}/, 'operation report must render ScenarioValueMemorySummary', failures);
  assertContains(operation, /ZoneRollupSummary\s+data=\{report\}/, 'operation report must render ZoneRollupSummary', failures);
  assertContains(operation, /FailSafeCustomerNotice\s+data=\{report\}/, 'operation report must render FailSafeCustomerNotice', failures);

  // Scenario card rules
  assertContains(cards, /正式证据：\{vm\.evidenceText\}/, 'FormalChainSummaryCard must show formal evidence result', failures);
  assertContains(cards, /建议\/处方\/审批\/执行\/验收闭环：\{vm\.chainText\}/, 'ScenarioAcceptanceSummary must show formal closure chain', failures);
  assertContains(cards, /存在单区失败，必须复核失败分区。/, 'ZoneRollupSummary must force single-zone failure notice', failures);
  assertContains(cards, /全区通过才算通过|多数分区通过即通过|任一区失败则整体失败|按分区独立判定/, 'ZoneRollupSummary must map rollup policy to customer text', failures);

  // DEVICE_ANOMALY and fail-safe display rules
  assertContains(vm, /scenarioKey\s*===\s*"DEVICE_ANOMALY"/, 'formal scenario VM must special-case DEVICE_ANOMALY', failures);
  assertContains(vm, /executionGuardText\s*=\s*scenarioKey\s*===\s*"DEVICE_ANOMALY"/, 'formal scenario VM must provide execution guard text for DEVICE_ANOMALY', failures);
  assertContains(cards, /vm\.scenarioKey\s*!==\s*"DEVICE_ANOMALY"/, 'FailSafeCustomerNotice should keep DEVICE_ANOMALY visible', failures);


  assertContains(labels, /export function customerReasonText\s*\(/, 'customerScenarioLabels must export customerReasonText', failures);
  assertContains(labels, /export function customerEvidenceGapText\s*\(/, 'customerScenarioLabels must export customerEvidenceGapText', failures);
  assertContains(labels, /export function customerTrustLevelText\s*\(/, 'customerScenarioLabels must export customerTrustLevelText', failures);
  // Guardrails: no raw enum shown to customer in formal cards.
  const forbiddenRawEnum = [
    /\bFORMAL_IRRIGATION\b/,
    /\bDEVICE_ANOMALY\b.*<[^>]*>/,
    /\bFORMAL_VARIABLE_OPERATION\b/,
    /operation_rollup_policy\s*:\s*\{/, // direct raw projection hint
  ];
  for (const re of forbiddenRawEnum) {
    if (re.test(cards)) fail(`raw enum or policy object leaked in customer card: ${re}`, failures);
  }

  if (failures.length) {
    console.error('ACCEPTANCE_CUSTOMER_FORMAL_SCENARIO_REPORT_V1 failed');
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }
  console.log('ACCEPTANCE_CUSTOMER_FORMAL_SCENARIO_REPORT_V1 passed');
}

try { main(); } catch (error) {
  console.error('ACCEPTANCE_CUSTOMER_FORMAL_SCENARIO_REPORT_V1 failed');
  console.error(error?.stack || String(error));
  process.exit(1);
}
