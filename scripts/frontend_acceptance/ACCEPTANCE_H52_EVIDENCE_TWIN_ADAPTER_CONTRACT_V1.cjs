#!/usr/bin/env node
// scripts/frontend_acceptance/ACCEPTANCE_H52_EVIDENCE_TWIN_ADAPTER_CONTRACT_V1.cjs
'use strict';

// Purpose: statically verify the H52 Evidence Twin adapter contract and P0 guardrails.
// Boundary: this script reads repository files only; it does not start the app, call APIs, write facts, or modify runtime state.

const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function ok(condition, message) {
  if (!condition) throw new Error(message);
  console.log('[h52-evidence-twin-adapter-contract] ok:', message);
}

const adapterPath = 'apps/web/src/features/operator/evidenceTwin/evidenceTwinAdapter.ts';
const guardrailsPath = 'docs/frontend-reset/H52.1-a-IMPLEMENTATION-GUARDRAILS.md';
const viewModelContractPath = 'docs/frontend-reset/H52.1-EVIDENCE-TWIN-VIEW-MODEL-CONTRACT.md';
const acceptancePath = 'docs/frontend-reset/H52.1-WATER-STRESS-LOOP-ACCEPTANCE.md';

const adapter = read(adapterPath);
const guardrails = read(guardrailsPath);
const viewModelContract = read(viewModelContractPath);
const acceptance = read(acceptancePath);

ok(guardrails.includes('每次任务的文档阅读门槛'), 'H52.1-a guardrail document is present');
ok(guardrails.includes('目标 Evidence Twin API 不是 H52.2 P0 必须新增项'), 'guardrail keeps target API optional for P0');
ok(viewModelContract.includes('operator_evidence_twin_v1'), 'view model contract names operator_evidence_twin_v1');
ok(acceptance.includes('前端不得为了页面完整而造假'), 'acceptance forbids fabricated completeness');

ok(adapter.includes('// apps/web/src/features/operator/evidenceTwin/evidenceTwinAdapter.ts'), 'adapter has path header');
ok(adapter.includes('OperatorEvidenceTwinV1'), 'adapter exports OperatorEvidenceTwinV1');
ok(adapter.includes('OperatorEvidenceTwinEnvelopeV1'), 'adapter exports envelope type');
ok(adapter.includes('EvidenceTwinRefV1'), 'adapter exports EvidenceTwinRefV1');
ok(adapter.includes('EvidenceTwinNodeV1'), 'adapter exports EvidenceTwinNodeV1');
ok(adapter.includes('WaterStressLoopStepV1'), 'adapter exports WaterStressLoopStepV1');
ok(adapter.includes('buildOperatorEvidenceTwinViewModel'), 'adapter exposes view model builder');
ok(adapter.includes('buildOperatorEvidenceTwinEnvelope'), 'adapter exposes envelope builder');
ok(adapter.includes('normalizeEvidenceTwinRefs'), 'adapter exposes evidence ref normalization');
ok(adapter.includes('inferEvidenceTwinRefKind'), 'adapter exposes ref kind inference');

ok(adapter.includes('report_kind: "OPERATOR_EVIDENCE_TWIN"'), 'adapter maps to final OPERATOR_EVIDENCE_TWIN report kind');
ok(adapter.includes('operator_twin_h31_h45_closure_v1') === false, 'adapter does not expose closure response key as final contract');
ok(adapter.includes('OPERATOR_TWIN_H31_H45_DEMO_CLOSURE') === false, 'adapter does not expose demo closure report kind as final contract');
ok(adapter.includes('water_stress_loop_v1'), 'adapter builds water_stress_loop_v1');
ok(adapter.includes('水分压力闭环'), 'adapter preserves water stress loop label');
ok(adapter.includes('猎鹰 1 号'), 'adapter preserves Falcon 1 subtitle');

ok(adapter.includes('writeReady: false'), 'adapter envelope writeReady is false');
ok(adapter.includes('dispatchReady: false'), 'adapter envelope dispatchReady is false');
ok(adapter.includes('approvalReady: false'), 'adapter envelope approvalReady is false');
ok(adapter.includes('taskCreationReady: false'), 'adapter envelope taskCreationReady is false');
ok(adapter.includes('memoryWriteReady: false'), 'adapter envelope memoryWriteReady is false');
ok(adapter.includes('roiWriteReady: false'), 'adapter envelope roiWriteReady is false');
ok(adapter.includes('allowed_actions: []'), 'adapter node write policy exposes no allowed actions');

ok(adapter.includes('RAW_SIGNAL_SOURCE_NOT_EXPOSED'), 'adapter preserves raw signal source-not-exposed gap');
ok(adapter.includes('OBSERVATION_SOURCE_NOT_EXPOSED'), 'adapter preserves observation source-not-exposed gap');
ok(adapter.includes('SCENARIO_OPTIONS_MISSING'), 'adapter preserves scenario options missing gap');
ok(adapter.includes('NO_ACTION_BASELINE_OR_OPTIONS_NOT_AVAILABLE'), 'adapter preserves no-action baseline gap');
ok(adapter.includes('WATER_RESPONSE_VERIFICATION_MISSING'), 'adapter preserves water response verification gap');
ok(adapter.includes('CANOPY_TEMPERATURE_NOT_IN_MAIN_LOOP'), 'adapter preserves canopy temperature gap');

ok(adapter.includes('NO_AO_ACT_TASK_CREATION'), 'adapter includes AO-ACT task creation boundary');
ok(adapter.includes('NO_DISPATCH'), 'adapter includes no dispatch boundary');
ok(adapter.includes('NO_APPROVAL_BYPASS'), 'adapter includes no approval bypass boundary');
ok(adapter.includes('SCENARIO_IS_NOT_TASK'), 'adapter includes scenario-is-not-task boundary');
ok(adapter.includes('NO_SCENARIO_RECOMMENDATION_SUBMISSION_IN_P0'), 'adapter includes no scenario submission boundary');

ok(!adapter.includes('SubmitScenarioToRecommendationPanel'), 'adapter does not import or mention scenario submit panel');
ok(!adapter.includes('submitOperatorScenarioRecommendation'), 'adapter does not import or mention scenario submit API');
ok(!adapter.includes('apiRequestWithPolicy'), 'adapter performs no API requests');
ok(!adapter.includes('from "react"') && !adapter.includes("from 'react'"), 'adapter does not import React');

ok(adapter.includes('legacy_visible_by_url_only: true'), 'adapter records legacy routes as URL-only');
ok(adapter.includes('delete_old_pages_first: false'), 'adapter forbids deleting old pages first');
ok(adapter.includes('/app/operator/fields/'), 'adapter records canonical H52 route');
ok(adapter.includes('/operator/twin/fields/'), 'adapter records legacy Operator Twin route');

console.log('[h52-evidence-twin-adapter-contract] PASS');
