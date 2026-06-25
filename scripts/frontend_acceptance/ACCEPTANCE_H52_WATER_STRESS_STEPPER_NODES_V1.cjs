#!/usr/bin/env node
// scripts/frontend_acceptance/ACCEPTANCE_H52_WATER_STRESS_STEPPER_NODES_V1.cjs
'use strict';

// Purpose: statically verify the H52 Water Stress Loop stepper node refinement.
// Boundary: this script reads repository files only; it does not start the app, call APIs, write facts, or modify runtime state.

const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function ok(condition, message) {
  if (!condition) throw new Error(message);
  console.log('[h52-water-stress-stepper-nodes] ok:', message);
}

const adapterPath = 'apps/web/src/features/operator/evidenceTwin/evidenceTwinAdapter.ts';
const pagePath = 'apps/web/src/features/operator/pages/OperatorEvidenceTwinPage.tsx';
const routeAliasAcceptancePath = 'scripts/frontend_acceptance/ACCEPTANCE_H52_EVIDENCE_TWIN_ROUTE_ALIAS_V1.cjs';
const contractPath = 'docs/frontend-reset/H52.1-EVIDENCE-TWIN-VIEW-MODEL-CONTRACT.md';
const acceptancePath = 'docs/frontend-reset/H52.1-WATER-STRESS-LOOP-ACCEPTANCE.md';
const guardrailPath = 'docs/frontend-reset/H52.1-a-IMPLEMENTATION-GUARDRAILS.md';

const adapter = read(adapterPath);
const page = read(pagePath);
const routeAliasAcceptance = read(routeAliasAcceptancePath);
const contract = read(contractPath);
const acceptance = read(acceptancePath);
const guardrail = read(guardrailPath);

ok(guardrail.includes('每次任务的文档阅读门槛'), 'H52.1-a guardrail is present');
ok(contract.includes('EvidenceTwinNodeV1'), 'view model contract defines EvidenceTwinNodeV1');
ok(acceptance.includes('每个主要节点必须能展开看到'), 'acceptance requires expandable major nodes');
ok(acceptance.includes('前端不得为了页面完整而造假'), 'acceptance forbids fabricated completeness');

ok(adapter.includes('const STEP_DEFINITIONS'), 'adapter defines fixed Water Stress Loop step definitions');
ok(adapter.includes('function rawSignalNodes'), 'adapter maps RawSignal nodes from read surfaces');
ok(adapter.includes('function observationNodes'), 'adapter maps Observation nodes from read surfaces');
ok(adapter.includes('function stateEstimateNodes'), 'adapter maps WaterStressState nodes from workspace current state');
ok(adapter.includes('function forecastNode'), 'adapter maps Forecast node from forecast read surface');
ok(adapter.includes('function scenarioNode'), 'adapter maps Scenario node from scenario read surface');
ok(adapter.includes('function recommendationNode'), 'adapter maps RecommendationCandidate node from workspace read surface');
ok(adapter.includes('function closureNode'), 'adapter maps approval/operation/AO-ACT/as-executed/evidence/acceptance nodes from closure input');
ok(adapter.includes('function verificationNode'), 'adapter maps WaterResponseVerification node from post-irrigation or closure input');
ok(adapter.includes('function waterStressSteps'), 'adapter builds Water Stress Loop stepper rows');

for (const step of [
  'RAW_SIGNAL',
  'OBSERVATION',
  'WATER_STRESS_STATE',
  'FORECAST',
  'SCENARIO',
  'RECOMMENDATION',
  'APPROVAL',
  'OPERATION_PLAN',
  'AO_ACT',
  'AS_EXECUTED',
  'EVIDENCE',
  'ACCEPTANCE',
  'VERIFICATION',
]) {
  ok(adapter.includes('code: "' + step + '"') || adapter.includes(step + ':'), 'adapter preserves step code: ' + step);
}

for (const label of [
  '原始信号',
  '标准化观测',
  '水分压力状态',
  '水分预测',
  '灌溉情景',
  '建议候选',
  '人工审批',
  '作业计划',
  'AO-ACT',
  '实执记录',
  '执行证据',
  '执行验收',
  '灌后水分响应验证',
]) {
  ok(adapter.includes(label), 'adapter preserves step label: ' + label);
}

ok(adapter.includes('sourceIndexInventory'), 'adapter still accepts source index inventory input');
ok(adapter.includes('evidenceQuality'), 'adapter still accepts evidence quality input');
ok(adapter.includes('workspace'), 'adapter still accepts workspace input');
ok(adapter.includes('forecastPanel'), 'adapter still accepts forecast panel input');
ok(adapter.includes('scenarioCompare'), 'adapter still accepts scenario compare input');
ok(adapter.includes('postIrrigationVerification'), 'adapter still accepts post-irrigation verification input');
ok(adapter.includes('h31H45Closure'), 'adapter still accepts H31-H45 closure input');

ok(adapter.includes('RAW_SIGNAL_SOURCE_NOT_EXPOSED'), 'adapter still preserves raw signal source-not-exposed gap');
ok(adapter.includes('OBSERVATION_SOURCE_NOT_EXPOSED'), 'adapter still preserves observation source-not-exposed gap');
ok(adapter.includes('ROOT_ZONE_SOIL_WATER_FORECAST_MISSING'), 'adapter still preserves forecast missing gap');
ok(adapter.includes('SCENARIO_OPTIONS_MISSING'), 'adapter still preserves scenario options missing gap');
ok(adapter.includes('NO_ACTION_BASELINE_OR_OPTIONS_NOT_AVAILABLE'), 'adapter still preserves no-action baseline gap');
ok(adapter.includes('CANOPY_TEMPERATURE_NOT_IN_MAIN_LOOP'), 'adapter still preserves canopy temperature gap');
ok(adapter.includes('WATER_RESPONSE_VERIFICATION_MISSING'), 'adapter still preserves verification missing gap');

ok(adapter.includes('write_ready: false'), 'adapter keeps node write policy false');
ok(adapter.includes('allowed_actions: []'), 'adapter keeps allowed actions empty');
ok(adapter.includes('writeReady: false'), 'adapter keeps envelope writeReady false');
ok(adapter.includes('dispatchReady: false'), 'adapter keeps envelope dispatchReady false');
ok(adapter.includes('approvalReady: false'), 'adapter keeps envelope approvalReady false');
ok(adapter.includes('taskCreationReady: false'), 'adapter keeps envelope taskCreationReady false');
ok(adapter.includes('memoryWriteReady: false'), 'adapter keeps envelope memoryWriteReady false');
ok(adapter.includes('roiWriteReady: false'), 'adapter keeps envelope roiWriteReady false');

ok(!adapter.includes('apiRequestWithPolicy'), 'adapter performs no API requests');
ok(!adapter.includes('fetchOperator'), 'adapter does not call Operator Twin fetchers');
ok(!adapter.includes('from "react"') && !adapter.includes("from 'react'"), 'adapter does not import React');
ok(!adapter.includes('SubmitScenarioToRecommendationPanel'), 'adapter does not import or mention scenario submit panel');
ok(!adapter.includes('submitOperatorScenarioRecommendation'), 'adapter does not import or mention scenario submit API');
ok(!adapter.includes('OPERATOR_TWIN_H31_H45_DEMO_CLOSURE'), 'adapter does not expose demo closure report kind');
ok(!adapter.includes('operator_twin_h31_h45_closure_v1'), 'adapter does not expose closure input key as final contract');

ok(page.includes('data-table="h52-water-stress-steps"'), 'page still renders Water Stress Loop table');
ok(page.includes('steps={twin.water_stress_loop.steps}'), 'page still consumes adapter stepper output');
ok(routeAliasAcceptance.includes('controlled H52 Evidence Twin route alias exists'), 'route alias acceptance remains available');

console.log('[h52-water-stress-stepper-nodes] PASS');
