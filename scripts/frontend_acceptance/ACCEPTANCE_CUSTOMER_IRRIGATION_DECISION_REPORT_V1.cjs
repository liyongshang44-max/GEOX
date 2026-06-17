#!/usr/bin/env node
'use strict';

// scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_IRRIGATION_DECISION_REPORT_V1.cjs
// Purpose: static frontend acceptance for H17 customer irrigation decision report rendering.

const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE = 'ACCEPTANCE_CUSTOMER_IRRIGATION_DECISION_REPORT_V1';
const ROOT = process.cwd();

function fail(message, detail) {
  console.error('[' + ACCEPTANCE + '] FAIL:', message);
  if (detail !== undefined) console.error(typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

function read(rel) {
  const file = path.join(ROOT, rel);
  assert(fs.existsSync(file), 'required file missing: ' + rel);
  return fs.readFileSync(file, 'utf8');
}

const page = read('apps/web/src/views/OperationReportPage.tsx');
const card = read('apps/web/src/components/customer/IrrigationDecisionReportCard.tsx');
const vm = read('apps/web/src/viewmodels/irrigationDecisionReportVm.ts');
const labels = read('apps/web/src/lib/irrigationDecisionLabels.ts');
const customerIndex = read('apps/web/src/components/customer/index.ts');
const exportPagePath = path.join(ROOT, 'apps/web/src/views/CustomerReportExportPage.tsx');
const exportPage = fs.existsSync(exportPagePath) ? fs.readFileSync(exportPagePath, 'utf8') : '';

assert(page.includes('IrrigationDecisionReportCard'), 'OperationReportPage must import/use IrrigationDecisionReportCard');
assert(page.includes('<IrrigationDecisionReportCard report={report} />'), 'OperationReportPage must render H17 card from operation report');
assert(customerIndex.includes('IrrigationDecisionReportCard'), 'customer component index must export IrrigationDecisionReportCard');
assert(card.includes('灌溉决策依据'), 'card must expose customer title');
assert(card.includes('审批与执行边界'), 'card must render approval/execution boundary');
assert(card.includes('失败条件') || card.includes('失效条件'), 'card must render scenario failure condition label');
assert(vm.includes('buildIrrigationDecisionReportVm'), 'VM builder missing');
assert(vm.includes('当前证据不足，不能生成可执行灌溉建议'), 'VM must provide UNKNOWN customer copy');
assert(vm.includes('系统建议灌溉 22mm'), 'VM must provide positive recommendation copy');
assert(vm.includes('failureConditionText'), 'VM must expose scenario failureConditionText');
assert(labels.includes('灌溉 22mm'), 'labels must map irrigate_22mm');
assert(labels.includes('风险降低'), 'labels must map risk_delta');

for (const forbidden of [
  'field_c8_demo',
  'dev_soil_c8_001',
  'dev_valve_pump_c8_001',
  'full_review_seed_',
  'rec_c8_irrigation_001',
  'op_plan_c8_irrigation_formal_001',
]) {
  assert(!card.includes(forbidden), 'card leaks forbidden customer token: ' + forbidden);
  assert(!vm.includes(forbidden), 'VM leaks forbidden customer token: ' + forbidden);
}

if (exportPage) {
  assert(exportPage.includes('fetchOperationReport'), 'export page must use fetchOperationReport as source');
  assert(!exportPage.includes('/api/v1/customer/irrigation-decision'), 'export page must not fetch separate irrigation decision API');
  assert(!exportPage.includes('decision_recommendation_index_v1'), 'export page must not fetch recommendation index directly');
  assert(!exportPage.includes('irrigation_scenario_set_index_v1'), 'export page must not fetch scenario index directly');
}

console.log('[' + ACCEPTANCE + '] PASS');
