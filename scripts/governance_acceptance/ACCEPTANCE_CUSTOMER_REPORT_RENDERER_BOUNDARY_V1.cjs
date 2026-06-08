#!/usr/bin/env node
'use strict';

// path: scripts/governance_acceptance/ACCEPTANCE_CUSTOMER_REPORT_RENDERER_BOUNDARY_V1.cjs
// Purpose: enforce that customer pages and export blocks use the generic report-backed main visual renderer.

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const files = {
  renderer: 'apps/web/src/viewmodels/customerReportMainVisualVm.ts',
  c8Adapter: 'apps/web/src/viewmodels/customerC8FormalReportVm.ts',
  fieldPage: 'apps/web/src/views/FieldReportPage.tsx',
  operationPage: 'apps/web/src/views/OperationReportPage.tsx',
  exportBlocks: 'apps/web/src/components/customer/CustomerExportBlocks.tsx',
};

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function has(text, needle, message) {
  assert.equal(text.includes(needle), true, message);
}

function lacks(text, needle, message) {
  assert.equal(text.includes(needle), false, message);
}

function matches(text, pattern, message) {
  assert.equal(pattern.test(text), true, `${message}: ${pattern}`);
}

for (const rel of Object.values(files)) {
  assert.equal(fs.existsSync(path.join(ROOT, rel)), true, `required file missing: ${rel}`);
}

const renderer = read(files.renderer);
const c8Adapter = read(files.c8Adapter);
const fieldPage = read(files.fieldPage);
const operationPage = read(files.operationPage);
const exportBlocks = read(files.exportBlocks);

for (const token of [
  'export type CustomerReportMainVisualVm',
  'export function buildCustomerFieldReportMainVisualVm',
  'export function buildCustomerOperationReportMainVisualVm',
  'FORMAL_READY',
  'INSUFFICIENT_REPORT',
  '缺少正式 report API 数据',
  'fieldFormalValidation',
  'operationFormalValidation',
  'pest_disease_inspection',
]) has(renderer, token, `generic renderer must own ${token}`);

for (const token of [
  'field_c8_demo',
  'op_plan_c8_irrigation_formal_001',
  'dev_soil_c8_001',
  'dev_valve_pump_c8_001',
]) lacks(renderer, token, `generic renderer must not contain C8-only token ${token}`);

for (const token of [
  'buildCustomerFieldReportMainVisualVm',
  'buildCustomerOperationReportMainVisualVm',
  'type CustomerReportMainVisualVm',
  'buildC8FieldMainVisualVm',
  'buildC8OperationMainVisualVm',
  'sanitizeVisibleCustomerText',
  'assertNoForbiddenCustomerTokens',
]) has(c8Adapter, token, `C8 adapter must delegate through generic renderer: ${token}`);

matches(c8Adapter, /buildCustomerFieldReportMainVisualVm\s*\(/, 'C8 field adapter must call generic field renderer');
matches(c8Adapter, /buildCustomerOperationReportMainVisualVm\s*\(/, 'C8 operation adapter must call generic operation renderer');

for (const token of [
  '灌溉作业已通过验收',
  '形成可信价值记录',
  '形成田块记忆',
]) lacks(c8Adapter, token, `C8 adapter must not hard-code formal conclusion text ${token}`);

has(fieldPage, 'fetchFieldReport', 'FieldReportPage must read field report API');
has(fieldPage, 'buildCustomerFieldReportMainVisualVm', 'FieldReportPage must use generic field renderer');
has(fieldPage, 'buildC8FieldMainVisualVm', 'FieldReportPage may keep C8 adapter');
has(fieldPage, 'mainVisual.rows.map', 'FieldReportPage must render main visual rows');
has(fieldPage, 'mainVisual.technicalRows.map', 'FieldReportPage must keep IDs in technical rows');
matches(fieldPage, /const\s+genericMainVisual\s*=\s*buildCustomerFieldReportMainVisualVm\(report\)/, 'FieldReportPage must build generic VM from report');

has(operationPage, 'fetchOperationReport', 'OperationReportPage must read operation report API');
has(operationPage, 'buildCustomerOperationReportMainVisualVm', 'OperationReportPage must use generic operation renderer');
has(operationPage, 'buildC8OperationMainVisualVm', 'OperationReportPage may keep C8 adapter');
has(operationPage, 'mainVisual.rows.map', 'OperationReportPage must render main visual rows');
has(operationPage, 'mainVisual.technicalRows.map', 'OperationReportPage must keep IDs in technical rows');
matches(operationPage, /const\s+genericMainVisual\s*=\s*buildCustomerOperationReportMainVisualVm\(report\)/, 'OperationReportPage must build generic VM from report');

for (const token of [
  'buildCustomerFieldReportMainVisualVm',
  'buildCustomerOperationReportMainVisualVm',
  'function MainVisualExportBlocks',
  'mainVisual.rows.map',
  '<MainVisualExportBlocks mainVisual={mainVisual} />',
]) has(exportBlocks, token, `export blocks must use generic main visual VM: ${token}`);

for (const token of [
  'customerC8FormalReportVm',
  'buildC8FieldMainVisualVm',
  'buildC8OperationMainVisualVm',
  'buildFormalScenarioVm',
  'buildEvidenceVm',
  'customerGuardedStatusText',
  'customerGuardedEvidenceText',
  'customerGuardedAcceptanceText',
  'buildOperationSameSourceExportSummary',
  'buildFieldSameSourceExportSummary',
  'pdiEvidenceBasisRows',
]) lacks(exportBlocks, token, `export blocks must not depend on legacy renderer path ${token}`);

console.log('[ACCEPTANCE_CUSTOMER_REPORT_RENDERER_BOUNDARY_V1] PASS');
