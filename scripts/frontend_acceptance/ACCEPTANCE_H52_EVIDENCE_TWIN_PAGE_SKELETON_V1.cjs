#!/usr/bin/env node
// scripts/frontend_acceptance/ACCEPTANCE_H52_EVIDENCE_TWIN_PAGE_SKELETON_V1.cjs
'use strict';

// Purpose: statically verify the H52 Operator Evidence Twin read-only page skeleton.
// Boundary: this script reads repository files only; it does not start the app, call APIs, write facts, or modify runtime state.

const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function ok(condition, message) {
  if (!condition) throw new Error(message);
  console.log('[h52-evidence-twin-page-skeleton] ok:', message);
}

const pagePath = 'apps/web/src/features/operator/pages/OperatorEvidenceTwinPage.tsx';
const adapterPath = 'apps/web/src/features/operator/evidenceTwin/evidenceTwinAdapter.ts';
const appPath = 'apps/web/src/app/App.tsx';
const acceptancePath = 'docs/frontend-reset/H52.1-WATER-STRESS-LOOP-ACCEPTANCE.md';
const guardrailPath = 'docs/frontend-reset/H52.1-a-IMPLEMENTATION-GUARDRAILS.md';

const page = read(pagePath);
const adapter = read(adapterPath);
const app = read(appPath);
const acceptance = read(acceptancePath);
const guardrail = read(guardrailPath);

ok(guardrail.includes('每次任务的文档阅读门槛'), 'H52.1-a guardrails are available');
ok(acceptance.includes('前端不得为了页面完整而造假'), 'acceptance forbids fabricated completeness');
ok(page.includes('// apps/web/src/features/operator/pages/OperatorEvidenceTwinPage.tsx'), 'page has path header');
ok(page.includes('buildOperatorEvidenceTwinEnvelope'), 'page consumes Evidence Twin adapter envelope');
ok(page.includes('data-contract="operator_evidence_twin_v1"'), 'page declares operator_evidence_twin_v1 contract');
ok(page.includes('data-surface="operator-evidence-twin"'), 'page declares operator evidence twin surface');
ok(page.includes('操作员证据孪生'), 'page uses formal operator evidence twin product name');
ok(page.includes('地块证据孪生'), 'page uses formal field evidence twin name');
ok(page.includes('水分压力闭环'), 'page renders water stress loop label');
ok(page.includes('猎鹰 1 号'), 'page renders Falcon 1 subtitle');
ok(page.includes('RawSignal → Observation → StateEstimate → Evidence → Verification'), 'page renders evidence lineage chain');
ok(page.includes('data-table="h52-water-stress-steps"'), 'page renders Water Stress Loop step table');
ok(page.includes('RAW_SIGNAL') && page.includes('OBSERVATION') && page.includes('WATER_STRESS_STATE'), 'page imports step codes through rendered step table data');
ok(page.includes('allowed_actions=[]'), 'page explicitly shows empty allowed actions');
ok(page.includes('data-write-ready={String(envelope.writeReady)}'), 'page exposes writeReady=false as data attr');
ok(page.includes('data-dispatch-ready={String(envelope.dispatchReady)}'), 'page exposes dispatchReady=false as data attr');
ok(page.includes('data-approval-ready={String(envelope.approvalReady)}'), 'page exposes approvalReady=false as data attr');
ok(page.includes('data-task-creation-ready={String(envelope.taskCreationReady)}'), 'page exposes taskCreationReady=false as data attr');
ok(page.includes('只读') && page.includes('不审批') && page.includes('不派单') && page.includes('不创建 AO-ACT task'), 'page displays read-only action boundaries');
ok(page.includes('缺口显式'), 'page renders explicit gaps section');
ok(page.includes('只读边界'), 'page renders boundary rules section');
ok(page.includes('旧入口策略：URL-only'), 'page keeps legacy route policy visible');

ok(!page.includes('SubmitScenarioToRecommendationPanel'), 'page does not import or mention scenario submit panel');
ok(!page.includes('submitOperatorScenarioRecommendation'), 'page does not import or mention scenario submit API');
ok(!page.includes('apiRequestWithPolicy'), 'page performs no API requests');
ok(!page.includes('fetchOperator'), 'page does not call Operator Twin fetchers');
ok(!page.includes('useEffect'), 'page skeleton has no runtime data-loading effect');
ok(!page.includes('<button'), 'page contains no button element');
ok(!page.includes('提交为建议候选'), 'page contains no submit-recommendation copy');
ok(!page.includes('创建 AO-ACT task'), 'page contains no task creation command copy except negative boundary is checked separately');

ok(adapter.includes('report_kind: "OPERATOR_EVIDENCE_TWIN"'), 'adapter still targets final Evidence Twin report kind');
ok(!app.includes('OperatorEvidenceTwinPage'), 'App routes are not changed in this PR');

console.log('[h52-evidence-twin-page-skeleton] PASS');
