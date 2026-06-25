#!/usr/bin/env node
// scripts/frontend_acceptance/ACCEPTANCE_H52_SCENARIO_READ_ONLY_SECTION_V1.cjs
'use strict';

// Purpose: statically verify the H52 Scenario read-only section.
// Boundary: this script reads repository files only; it does not start the app, call APIs, write facts, or modify runtime state.

const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function ok(condition, message) {
  if (!condition) throw new Error(message);
  console.log('[h52-scenario-read-only-section] ok:', message);
}

const pagePath = 'apps/web/src/features/operator/pages/OperatorEvidenceTwinPage.tsx';
const adapterPath = 'apps/web/src/features/operator/evidenceTwin/evidenceTwinAdapter.ts';
const acceptancePath = 'docs/frontend-reset/H52.1-WATER-STRESS-LOOP-ACCEPTANCE.md';
const guardrailPath = 'docs/frontend-reset/H52.1-a-IMPLEMENTATION-GUARDRAILS.md';
const scenarioPagePath = 'apps/web/src/features/operator/pages/OperatorFieldTwinScenarioComparePage.tsx';

const page = read(pagePath);
const adapter = read(adapterPath);
const acceptance = read(acceptancePath);
const guardrail = read(guardrailPath);
const scenarioPage = read(scenarioPagePath);
const pageWithoutNegativeTaskBoundary = page.replaceAll('不创建 AO-ACT task', '');

ok(guardrail.includes('## 8. Scenario 只迁移 read part'), 'H52.1-a requires Scenario read-only migration only');
ok(guardrail.includes('H52.2 P0 只迁移第一类'), 'H52.1-a limits Scenario migration to read display');
ok(guardrail.includes('不得迁移：') && guardrail.includes('SubmitScenarioToRecommendationPanel'), 'H52.1-a forbids migrating submit panel');
ok(acceptance.includes('scenario.options = []'), 'acceptance requires scenario options gap when empty');
ok(acceptance.includes('no_action_baseline_present = false'), 'acceptance requires no-action baseline gap when false');
ok(acceptance.includes('提交 scenario'), 'acceptance identifies scenario submission as forbidden');

ok(page.includes('function ScenarioReadOnlyPanel'), 'page defines ScenarioReadOnlyPanel');
ok(page.includes('data-card="h52-scenario-read-only"'), 'page renders scenario read-only card');
ok(page.includes('data-scenario-read-only="true"'), 'scenario section is explicitly marked read-only');
ok(page.includes('data-table="h52-scenario-options"'), 'page renders scenario option table');
ok(page.includes('data-scenario-option='), 'page renders scenario option rows');
ok(page.includes('Scenario status'), 'page displays scenario status');
ok(page.includes('No-action baseline'), 'page displays no-action baseline state');
ok(page.includes('Unavailable reason'), 'page displays unavailable reason');
ok(page.includes('Evidence refs'), 'page displays scenario evidence refs');
ok(page.includes('SCENARIO_IS_NOT_TASK'), 'page displays scenario-is-not-task boundary');
ok(page.includes('SCENARIO_OPTIONS_MISSING'), 'page displays scenario options missing gap row');
ok(page.includes('ScenarioReadOnlyPanel twin={twin}'), 'page mounts ScenarioReadOnlyPanel in Evidence Twin layout');

ok(page.includes('twin.water_stress_loop.scenario'), 'page reads scenario from Evidence Twin view model');
ok(page.includes('scenario.no_action_baseline_present'), 'page reads no-action baseline state from adapter contract');
ok(page.includes('scenario.unavailable_reason'), 'page reads unavailable reason from adapter contract');
ok(page.includes('scenario.options.length'), 'page reads scenario options without fabricating defaults');
ok(page.includes('refsText(option)'), 'page renders evidence refs for each scenario option');

ok(adapter.includes('function scenarioNode'), 'adapter still owns scenario mapping');
ok(adapter.includes('scenarioCompare'), 'adapter accepts scenario compare read surface');
ok(adapter.includes('workspace'), 'adapter accepts workspace read surface');
ok(adapter.includes('SCENARIO_OPTIONS_MISSING'), 'adapter preserves missing scenario options gap');
ok(adapter.includes('NO_ACTION_BASELINE_OR_OPTIONS_NOT_AVAILABLE'), 'adapter preserves no-action baseline gap');
ok(adapter.includes('SCENARIO_IS_NOT_TASK'), 'adapter preserves scenario-is-not-task boundary rule');

ok(scenarioPage.includes('SubmitScenarioToRecommendationPanel'), 'legacy scenario page still contains submit panel outside H52 P0');
ok(!page.includes('SubmitScenarioToRecommendationPanel'), 'H52 page does not import or mention legacy submit panel');
ok(!page.includes('submitOperatorScenarioRecommendation'), 'H52 page does not import or mention scenario submit API');
ok(!page.includes('apiRequestWithPolicy'), 'H52 page performs no API requests');
ok(!page.includes('fetchOperator'), 'H52 page does not call Operator Twin fetchers');
ok(!page.includes('<button'), 'H52 page contains no button');
ok(!page.includes('提交为建议候选'), 'H52 page contains no legacy submit-recommendation copy');
ok(!page.includes('Submit Scenario'), 'H52 page contains no Submit Scenario copy');
ok(!page.includes('Submit Recommendation'), 'H52 page contains no Submit Recommendation copy');
ok(!page.includes('创建 approval'), 'H52 page contains no approval creation command copy');
ok(page.includes('不创建 AO-ACT task'), 'H52 page displays negative AO-ACT task boundary copy');
ok(!pageWithoutNegativeTaskBoundary.includes('创建 AO-ACT task'), 'H52 page contains no positive task creation command copy');

console.log('[h52-scenario-read-only-section] PASS');
