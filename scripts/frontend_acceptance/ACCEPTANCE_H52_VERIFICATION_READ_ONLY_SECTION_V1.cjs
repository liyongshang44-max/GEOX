#!/usr/bin/env node
// scripts/frontend_acceptance/ACCEPTANCE_H52_VERIFICATION_READ_ONLY_SECTION_V1.cjs
'use strict';

// Purpose: statically verify the H52 post-irrigation verification read-only section.
// Boundary: this script reads repository files only; it does not start the app, call APIs, write facts, or modify runtime state.

const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function ok(condition, message) {
  if (!condition) throw new Error(message);
  console.log('[h52-verification-read-only-section] ok:', message);
}

const pagePath = 'apps/web/src/features/operator/pages/OperatorEvidenceTwinPage.tsx';
const adapterPath = 'apps/web/src/features/operator/evidenceTwin/evidenceTwinAdapter.ts';
const acceptancePath = 'docs/frontend-reset/H52.1-WATER-STRESS-LOOP-ACCEPTANCE.md';
const guardrailPath = 'docs/frontend-reset/H52.1-a-IMPLEMENTATION-GUARDRAILS.md';
const postIrrigationPagePath = 'apps/web/src/features/operator/pages/OperatorFieldTwinPostIrrigationPage.tsx';

const page = read(pagePath);
const adapter = read(adapterPath);
const acceptance = read(acceptancePath);
const guardrail = read(guardrailPath);
const postIrrigationPage = read(postIrrigationPagePath);
const pageWithoutNegativeTaskBoundary = page.replaceAll('不创建 AO-ACT task', '');

ok(acceptance.includes('显示执行后证据'), 'acceptance allows displaying post-execution evidence');
ok(acceptance.includes('显示验证结果'), 'acceptance allows displaying verification results');
ok(acceptance.includes('water_response_verification_v1'), 'acceptance requires water response verification gap handling');
ok(acceptance.includes('acceptance_result_v1'), 'acceptance requires acceptance result gap handling');
ok(acceptance.includes('证据引用缺失'), 'acceptance requires missing evidence refs to be visible');
ok(guardrail.includes('water_stress_loop.verification'), 'H52.1-a maps closure source into verification node');
ok(guardrail.includes('writeReady=false'), 'H52.1-a preserves writeReady=false invariant');

ok(page.includes('function VerificationReadOnlyPanel'), 'page defines VerificationReadOnlyPanel');
ok(page.includes('data-card="h52-verification-read-only"'), 'page renders verification read-only card');
ok(page.includes('data-verification-read-only="true"'), 'verification section is explicitly marked read-only');
ok(page.includes('data-table="h52-post-irrigation-verification-nodes"'), 'page renders verification node table');
ok(page.includes('data-verification-node='), 'page renders verification node rows');
ok(page.includes('VerificationReadOnlyPanel twin={twin}'), 'page mounts VerificationReadOnlyPanel in Evidence Twin layout');
ok(page.includes('Post-Irrigation Verification read-only section'), 'page labels post-irrigation verification section');
ok(page.includes('灌后验证只读'), 'page renders Chinese verification section title');

for (const nodeCode of ['AS_EXECUTED', 'EVIDENCE', 'ACCEPTANCE', 'VERIFICATION']) {
  ok(page.includes(nodeCode), 'page renders verification chain node code: ' + nodeCode);
}

ok(page.includes('loop.as_executed'), 'page reads as_executed from Evidence Twin loop');
ok(page.includes('loop.evidence'), 'page reads execution evidence from Evidence Twin loop');
ok(page.includes('loop.acceptance'), 'page reads acceptance from Evidence Twin loop');
ok(page.includes('loop.verification'), 'page reads verification from Evidence Twin loop');
ok(page.includes('nodeRefsText(row.node)'), 'page renders node refs instead of hiding them');
ok(page.includes('证据引用缺失'), 'page displays missing evidence refs copy');
ok(page.includes('blockingReasonsText(row.node)'), 'page renders blocking reasons');
ok(page.includes('expandPayloadText(row.node)'), 'page renders expand payload keys');
ok(page.includes('WATER_RESPONSE_VERIFICATION_MISSING'), 'page displays verification missing gap code');
ok(page.includes('ACCEPTANCE_RESULT_MISSING'), 'page displays acceptance missing gap code');

ok(adapter.includes('function verificationNode'), 'adapter still owns verification mapping');
ok(adapter.includes('postIrrigationVerification'), 'adapter accepts post-irrigation verification read surface');
ok(adapter.includes('WATER_RESPONSE_VERIFICATION_MISSING'), 'adapter preserves verification missing gap');
ok(adapter.includes('acceptance_result_v1'), 'adapter preserves acceptance result schema');
ok(adapter.includes('as_executed_record_v1'), 'adapter preserves as-executed schema');
ok(adapter.includes('evidence_artifact_v1'), 'adapter preserves evidence artifact schema');

ok(postIrrigationPage.includes('post-irrigation'), 'legacy post-irrigation page remains present outside H52 section');
ok(!page.includes('apiRequestWithPolicy'), 'H52 page performs no API requests');
ok(!page.includes('fetchOperator'), 'H52 page does not call Operator Twin fetchers');
ok(!page.includes('<button'), 'H52 page contains no button');
ok(!page.includes('提交 receipt'), 'H52 page contains no receipt-submission command copy');
ok(!page.includes('写 evidence_artifact'), 'H52 page contains no evidence write command copy');
ok(!page.includes('写 acceptance_result'), 'H52 page contains no acceptance write command copy');
ok(!page.includes('写 water_response_verification'), 'H52 page contains no verification write command copy');
ok(!page.includes('创建 approval'), 'H52 page contains no approval creation command copy');
ok(!pageWithoutNegativeTaskBoundary.includes('创建 AO-ACT task'), 'H52 page contains no positive task creation command copy');

console.log('[h52-verification-read-only-section] PASS');
