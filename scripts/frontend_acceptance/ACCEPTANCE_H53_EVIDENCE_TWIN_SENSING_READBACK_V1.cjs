#!/usr/bin/env node
'use strict';

// scripts/frontend_acceptance/ACCEPTANCE_H53_EVIDENCE_TWIN_SENSING_READBACK_V1.cjs
// Purpose: lock H53.1 frontend readback boundaries for Operator Evidence Twin sensing data.

const fs = require('node:fs');
const path = require('node:path');

const PAGE = 'apps/web/src/features/operator/pages/OperatorEvidenceTwinPage.tsx';
const ROUTE = 'apps/server/src/routes/v1/operator_evidence_twin.ts';
const SEED = 'scripts/demo_seed/SEED_C8_SENSING_ONLY_V1.cjs';

function fail(error, detail) {
  console.error(JSON.stringify({ ok: false, error, detail }, null, 2));
  process.exit(1);
}

function assertOk(condition, error, detail) {
  if (!condition) fail(error, detail);
}

function read(file) {
  const fullPath = path.resolve(process.cwd(), file);
  assertOk(fs.existsSync(fullPath), 'FILE_MISSING', { file });
  return fs.readFileSync(fullPath, 'utf8');
}

function main() {
  const page = read(PAGE);
  const route = read(ROUTE);
  const seed = read(SEED);

  assertOk(page.includes('data-card="h53-sensing-readback"'), 'SENSING_READBACK_CARD_REQUIRED', null);
  assertOk(page.includes('soil_moisture_percent'), 'SOIL_MOISTURE_COPY_REQUIRED', null);
  assertOk(page.includes('coverage_ratio'), 'COVERAGE_RATIO_COPY_REQUIRED', null);
  assertOk(page.includes('rainfall_forecast_mm_72h'), 'WEATHER_FORECAST_COPY_REQUIRED', null);
  assertOk(page.includes('fetch(evidenceTwinReadUrl(fieldId)'), 'READ_ONLY_FETCH_REQUIRED', null);
  assertOk(page.includes('method') === false || page.includes('method: "GET"'), 'ONLY_GET_FETCH_ALLOWED', null);

  for (const token of ['method: "POST"', "method: 'POST'", 'method: "PUT"', "method: 'PUT'", 'method: "PATCH"', "method: 'PATCH'", 'method: "DELETE"', "method: 'DELETE'"]) {
    assertOk(!page.includes(token), 'FORBIDDEN_HTTP_METHOD_IN_PAGE', { token });
  }

  for (const token of ['SubmitScenarioToRecommendationPanel', 'submitOperatorScenarioRecommendation', 'createApproval', 'createOperationPlan', 'createAoActTask', 'sendReceipt']) {
    assertOk(!page.includes(token), 'FORBIDDEN_WRITE_IMPORT_OR_CALL_IN_PAGE', { token });
  }

  for (const token of ['WATER_STRESS_STATE_DERIVED_PENDING', 'SCENARIO_DERIVED_PENDING', 'AO_ACT_NOT_CREATED_IN_SENSING_ONLY', 'ACCEPTANCE_NOT_CREATED_IN_SENSING_ONLY']) {
    assertOk(route.includes(token), 'DERIVED_GAP_REQUIRED_IN_READ_MODEL', { token });
  }

  assertOk(route.includes('writeReady: false'), 'READ_MODEL_WRITE_READY_FALSE_REQUIRED', null);
  assertOk(route.includes('dispatchReady: false'), 'READ_MODEL_DISPATCH_READY_FALSE_REQUIRED', null);
  assertOk(route.includes('approvalReady: false'), 'READ_MODEL_APPROVAL_READY_FALSE_REQUIRED', null);
  assertOk(route.includes('taskCreationReady: false'), 'READ_MODEL_TASK_CREATION_READY_FALSE_REQUIRED', null);
  assertOk(route.includes('memoryWriteReady: false'), 'READ_MODEL_MEMORY_WRITE_READY_FALSE_REQUIRED', null);
  assertOk(route.includes('roiWriteReady: false'), 'READ_MODEL_ROI_WRITE_READY_FALSE_REQUIRED', null);

  assertOk(seed.includes('buildC8FormalIrrigationFullChainDataset'), 'SEED_MUST_REUSE_EXISTING_C8_BUILDER', null);
  assertOk(seed.includes('FORBIDDEN_FACT_TYPES'), 'SEED_FORBIDDEN_FACT_TYPES_REQUIRED', null);
  assertOk(seed.includes('stage1_sensing_summary_v1'), 'STAGE1_SENSING_SUMMARY_MUST_BE_FORBIDDEN', null);
  assertOk(seed.includes('skill_run_v1'), 'SKILL_RUN_MUST_BE_FORBIDDEN', null);

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H53_EVIDENCE_TWIN_SENSING_READBACK_V1', page: PAGE, route: ROUTE, seed: SEED }, null, 2));
}

main();
