#!/usr/bin/env node
'use strict';

// scripts/frontend_acceptance/ACCEPTANCE_H53_1A_EVIDENCE_TWIN_DISPLAY_CLEANUP_V1.cjs
// Purpose: lock H53.1a Operator Evidence Twin display cleanup for sensing readback and pending-stage grouping.
// Boundary: this acceptance is static and read-only; it checks that the page does not add write methods or control-plane action imports.

const fs = require('node:fs');
const path = require('node:path');

const PAGE = 'apps/web/src/features/operator/pages/OperatorEvidenceTwinPage.tsx';

function fail(error, detail) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H53_1A_EVIDENCE_TWIN_DISPLAY_CLEANUP_V1', error, detail }, null, 2));
  process.exit(1);
}

function assertOk(condition, error, detail = null) {
  if (!condition) fail(error, detail);
}

function read(file) {
  const fullPath = path.resolve(process.cwd(), file);
  assertOk(fs.existsSync(fullPath), 'FILE_MISSING', { file });
  return fs.readFileSync(fullPath, 'utf8');
}

function main() {
  const page = read(PAGE);

  assertOk(page.includes('data-card="h53-1a-status-summary"'), 'STATUS_SUMMARY_CARD_REQUIRED');
  assertOk(page.includes('data-card="h53-sensing-readback"'), 'SENSING_READBACK_CARD_REQUIRED');
  assertOk(page.includes('data-card="h53-1a-sensing-metric-cards"'), 'SENSING_METRIC_CARDS_REQUIRED');
  assertOk(page.includes('data-card="h53-1a-pending-phases"'), 'PENDING_PHASE_GROUPING_REQUIRED');

  for (const token of [
    'soil_moisture_percent',
    'coverage_ratio',
    'quality_status',
    'actual_points',
    'expected_points',
    'rainfall_forecast_mm_72h',
    'et0_mm_72h',
    'temperature_max_c_72h',
  ]) {
    assertOk(page.includes(token), 'SENSING_FIELD_COPY_REQUIRED', { token });
  }

  for (const token of [
    '已完成输入层',
    '等待系统推导',
    '等待人工与控制链',
    '等待执行与验收闭环',
    '等待经营沉淀',
    'WaterStressState / Forecast / Scenario / RecommendationCandidate',
    'Human Approval / OperationPlan / AO-ACT Task',
    'AsExecuted / Evidence / Acceptance / WaterResponseVerification',
    'ROI / Field Memory',
  ]) {
    assertOk(page.includes(token), 'PHASE_COPY_REQUIRED', { token });
  }

  assertOk(page.includes('fetch(evidenceTwinReadUrl(fieldId)'), 'READ_ONLY_FETCH_REQUIRED');
  assertOk(page.includes('method') === false || page.includes('method: "GET"'), 'ONLY_GET_FETCH_ALLOWED');

  for (const token of [
    'method: "POST"',
    "method: 'POST'",
    'method: "PUT"',
    "method: 'PUT'",
    'method: "PATCH"',
    "method: 'PATCH'",
    'method: "DELETE"',
    "method: 'DELETE'",
  ]) {
    assertOk(!page.includes(token), 'FORBIDDEN_HTTP_METHOD_IN_PAGE', { token });
  }

  for (const token of [
    'SubmitScenarioToRecommendationPanel',
    'submitOperatorScenarioRecommendation',
    'createApproval',
    'createOperationPlan',
    'createAoActTask',
    'sendReceipt',
    '/api/v1/operator/recommendations/',
    '/api/v1/actions/task',
    '/api/v1/acceptance/evaluate',
  ]) {
    assertOk(!page.includes(token), 'FORBIDDEN_WRITE_IMPORT_ROUTE_OR_CALL_IN_PAGE', { token });
  }

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H53_1A_EVIDENCE_TWIN_DISPLAY_CLEANUP_V1', page: PAGE }, null, 2));
}

main();
