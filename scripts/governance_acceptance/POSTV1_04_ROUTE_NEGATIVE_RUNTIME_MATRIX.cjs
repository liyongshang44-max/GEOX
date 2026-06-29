// scripts/governance_acceptance/POSTV1_04_ROUTE_NEGATIVE_RUNTIME_MATRIX.cjs
// Purpose: verify negative runtime behavior across Twin Kernel v1 productionization route surfaces.
// Boundary: this script creates only minimal prerequisite decision cycles, sessions, and reviews needed to test negative cases; it does not create automatic recommendations, approvals, AO-ACT tasks, receipts, acceptance records, ROI, Field Memory, adapters, migrations, UI, or model updates.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'POSTV1_04_ROUTE_NEGATIVE_RUNTIME_MATRIX';
const BASE_URL = String(process.env.TWIN_KERNEL_BASE_URL || process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const RUN_ID = String(process.env.POSTV1_04_RUN_ID || `run_${Date.now()}_${process.pid}_${Math.random().toString(16).slice(2, 10)}`).replace(/[^A-Za-z0-9_-]/g, '_');
const FIELD_LEARNING_CANDIDATE_ID = String(process.env.POSTV1_04_FIELD_LEARNING_CANDIDATE_ID || process.env.POSTV1_03_FIELD_LEARNING_CANDIDATE_ID || 'flc_c23a3ace34c48ce59c205110');

const FILES = {
  taskLine: 'docs/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md',
  taskDoc: 'docs/tasks/POSTV1-04-Route-Negative-Runtime-Matrix.md',
  tk13Route: 'apps/server/src/routes/v1/twin_kernel_formalization.ts',
  tk14Route: 'apps/server/src/routes/v1/twin_kernel_operator_workflow.ts',
  tk15Route: 'apps/server/src/routes/v1/twin_kernel_production_ingestion.ts',
  tk18Route: 'apps/server/src/routes/v1/twin_kernel_business_closure.ts',
  tk13Acceptance: 'scripts/governance_acceptance/TK13_FORMALIZATION_LAYER_V0.cjs',
  tk14Acceptance: 'scripts/governance_acceptance/TK14_OPERATOR_WORKFLOW_V0.cjs',
  tk15Acceptance: 'scripts/governance_acceptance/TK15_PRODUCTION_INGESTION_V0.cjs',
  tk16Acceptance: 'scripts/governance_acceptance/TK16_MULTI_SCOPE_REGRESSION_HARNESS.cjs',
  tk17Acceptance: 'scripts/frontend_acceptance/TK17_PRODUCTION_UX_V0.cjs',
  tk18Acceptance: 'scripts/governance_acceptance/TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0.cjs',
  postv103Acceptance: 'scripts/governance_acceptance/POSTV1_03_INGESTION_IDEMPOTENCY_ERROR_TAXONOMY.cjs',
};

const assertions = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function assert(name, condition, details = {}) {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  if (!passed) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}

function containsAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function runRef(stem) {
  return `${stem}_${RUN_ID}`;
}

function externalRefs(prefix) {
  return {
    recommendation_id: runRef(`${prefix}_recommendation`),
    approval_id: runRef(`${prefix}_approval`),
    operation_plan_id: runRef(`${prefix}_plan`),
    act_task_id: runRef(`${prefix}_task`),
    receipt_id: runRef(`${prefix}_receipt`),
    as_executed_id: runRef(`${prefix}_observation`),
    acceptance_id: runRef(`${prefix}_acceptance`),
    post_irrigation_verification_id: runRef(`${prefix}_verification`),
  };
}

async function requestJson(method, pathname, body) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((error) => {
    throw new Error(`API_CONNECTIVITY_FAILED:${method}:${pathname}:${error.message}`);
  });
  const raw = await response.text();
  let json;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    const error = new Error(`API_NON_JSON_RESPONSE:${method}:${pathname}:${response.status}`);
    error.details = { body: raw.slice(0, 1000) };
    throw error;
  }
  return { status: response.status, json };
}

function expectError(name, response, expectedStatus, expectedError) {
  assert(name, response.status === expectedStatus && response.json.ok === false && response.json.error === expectedError, {
    expected_status: expectedStatus,
    expected_error: expectedError,
    actual_status: response.status,
    actual_json: response.json,
  });
}

function assertNoAutoWrites(name, value) {
  assert(name, value.automatic_business_decision_created !== true && value.automatic_recommendation_created !== true && value.automatic_approval_created !== true && value.automatic_task_created !== true && value.automatic_receipt_created !== true && value.automatic_acceptance_created !== true && value.automatic_roi_created !== true && value.automatic_field_memory_created !== true && value.model_update_created !== true, { value });
}

function staticAudit() {
  for (const [name, file] of Object.entries(FILES)) {
    assert(`${name}_exists`, fs.existsSync(abs(file)), { file });
  }
  const taskLine = read(FILES.taskLine);
  const taskDoc = read(FILES.taskDoc);
  const tk13Route = read(FILES.tk13Route);
  const tk14Route = read(FILES.tk14Route);
  const tk15Route = read(FILES.tk15Route);
  const tk18Route = read(FILES.tk18Route);
  assert('task_line_records_postv104', containsAll(taskLine, ['POSTV1-04 Route Negative Runtime Matrix', 'missing ids', 'unknown ids', 'malformed bodies', 'wrong session/review pairing', 'forbidden automatic-write assertions']), { file: FILES.taskLine });
  assert('task_doc_records_boundary', containsAll(taskDoc, ['No new route.', 'No migration.', 'No UI.', 'wrong operator session/review pairing', 'next_step = POSTV1-05_DB_INDEX_QUERY_COST_AUDIT']), { file: FILES.taskDoc });
  assert('tk13_negative_contract_present', containsAll(tk13Route, ['DECISION_CYCLE_ID_REQUIRED', 'DECISION_CYCLE_NOT_FOUND', 'INVALID_FORMALIZED_AT', 'automatic_roi_created: false', 'model_update_created: false']), { file: FILES.tk13Route });
  assert('tk14_negative_contract_present', containsAll(tk14Route, ['OPERATOR_SESSION_ID_REQUIRED', 'OPERATOR_REVIEW_ID_REQUIRED', 'OPERATOR_REVIEW_SESSION_MISMATCH', 'INVALID_REVIEW_STATUS', 'automatic_task_created: false']), { file: FILES.tk14Route });
  assert('tk15_negative_contract_present', containsAll(tk15Route, ['FIELD_LEARNING_CANDIDATE_ID_REQUIRED', 'SOURCE_EVENT_ID_CONFLICT', 'MALFORMED_SOURCE_REFS', 'structured_error']), { file: FILES.tk15Route });
  assert('tk18_read_only_contract_present', containsAll(tk18Route, ['readback only; no write query is executed by this route', 'DECISION_CYCLE_NOT_FOUND', 'read_only: true', 'write_ready: false']), { file: FILES.tk18Route });
}

async function createDecisionCycle(label) {
  const response = await requestJson('POST', '/api/v1/twin-kernel/decision-cycles', {
    field_learning_candidate_id: FIELD_LEARNING_CANDIDATE_ID,
    external_refs: externalRefs(label),
  });
  const decision = record(response.json.decision_cycle);
  assert(`${label}_decision_cycle_ready`, response.status === 200 && response.json.ok === true && String(decision.decision_cycle_id || '').startsWith('dc_') && decision.current_stage === 'ACCEPTED', { status: response.status, json: response.json });
  return String(decision.decision_cycle_id);
}

async function createSession(decisionCycleId, label) {
  const response = await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/sessions', {
    decision_cycle_id: decisionCycleId,
    operator_id: runRef(`${label}_operator`),
    opened_at: '2026-06-28T04:00:00.000Z',
  });
  const session = record(response.json.operator_session);
  assert(`${label}_session_ready`, response.status === 200 && response.json.ok === true && String(session.operator_session_id || '').startsWith('op_sess_'), { status: response.status, json: response.json });
  assertNoAutoWrites(`${label}_session_no_auto_writes`, response.json);
  return String(session.operator_session_id);
}

async function createReview(sessionId, label, status = 'NEEDS_FORMALIZATION') {
  const response = await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/reviews', {
    operator_session_id: sessionId,
    reviewed_by: runRef(`${label}_reviewer`),
    reviewed_at: '2026-06-28T04:01:00.000Z',
    review_status: status,
    review_notes: { fixture_run_id: RUN_ID, label },
  });
  const review = record(response.json.operator_review);
  assert(`${label}_review_ready`, response.status === 200 && response.json.ok === true && String(review.operator_review_id || '').startsWith('op_review_'), { status: response.status, json: response.json });
  assertNoAutoWrites(`${label}_review_no_auto_writes`, response.json);
  return String(review.operator_review_id);
}

async function main() {
  staticAudit();

  const decisionA = await createDecisionCycle('postv104_a');
  const decisionB = await createDecisionCycle('postv104_b');
  const sessionA = await createSession(decisionA, 'postv104_a');
  const sessionB = await createSession(decisionB, 'postv104_b');
  const reviewA = await createReview(sessionA, 'postv104_a');
  const reviewB = await createReview(sessionB, 'postv104_b');

  expectError('tk13_roi_missing_decision_cycle_id', await requestJson('POST', '/api/v1/twin-kernel/formalizations/roi', { formalized_by: 'postv104', formalized_at: '2026-06-28T04:02:00.000Z' }), 400, 'DECISION_CYCLE_ID_REQUIRED');
  expectError('tk13_roi_unknown_decision_cycle_id', await requestJson('POST', '/api/v1/twin-kernel/formalizations/roi', { decision_cycle_id: runRef('missing_dc'), formalized_by: 'postv104', formalized_at: '2026-06-28T04:02:00.000Z' }), 404, 'DECISION_CYCLE_NOT_FOUND');
  expectError('tk13_roi_invalid_formalized_at', await requestJson('POST', '/api/v1/twin-kernel/formalizations/roi', { decision_cycle_id: decisionA, formalized_by: 'postv104', formalized_at: 'not-a-date' }), 400, 'INVALID_FORMALIZED_AT');
  expectError('tk13_memory_missing_decision_cycle_id', await requestJson('POST', '/api/v1/twin-kernel/formalizations/field-memory', { formalized_by: 'postv104', formalized_at: '2026-06-28T04:02:00.000Z' }), 400, 'DECISION_CYCLE_ID_REQUIRED');

  expectError('tk14_session_missing_decision_cycle_id', await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/sessions', { operator_id: 'postv104' }), 400, 'DECISION_CYCLE_ID_REQUIRED');
  expectError('tk14_session_unknown_decision_cycle_id', await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/sessions', { decision_cycle_id: runRef('missing_dc'), operator_id: 'postv104' }), 404, 'DECISION_CYCLE_NOT_FOUND');
  expectError('tk14_review_missing_session_id', await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/reviews', { reviewed_by: 'postv104', reviewed_at: '2026-06-28T04:03:00.000Z' }), 400, 'OPERATOR_SESSION_ID_REQUIRED');
  expectError('tk14_review_unknown_session_id', await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/reviews', { operator_session_id: runRef('missing_session'), reviewed_by: 'postv104', reviewed_at: '2026-06-28T04:03:00.000Z' }), 404, 'OPERATOR_SESSION_NOT_FOUND');
  expectError('tk14_review_invalid_status', await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/reviews', { operator_session_id: sessionA, reviewed_by: 'postv104', reviewed_at: '2026-06-28T04:03:00.000Z', review_status: 'AUTO_APPROVE_AND_EXECUTE' }), 400, 'INVALID_REVIEW_STATUS');
  expectError('tk14_roi_action_missing_review_id', await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/formalization-actions/roi', { operator_session_id: sessionA, formalized_by: 'postv104', formalized_at: '2026-06-28T04:04:00.000Z' }), 400, 'OPERATOR_REVIEW_ID_REQUIRED');
  expectError('tk14_roi_action_unknown_review_id', await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/formalization-actions/roi', { operator_session_id: sessionA, operator_review_id: runRef('missing_review'), formalized_by: 'postv104', formalized_at: '2026-06-28T04:04:00.000Z' }), 404, 'OPERATOR_REVIEW_NOT_FOUND');
  expectError('tk14_roi_action_wrong_session_review_pairing', await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/formalization-actions/roi', { operator_session_id: sessionA, operator_review_id: reviewB, formalized_by: 'postv104', formalized_at: '2026-06-28T04:04:00.000Z' }), 400, 'OPERATOR_REVIEW_SESSION_MISMATCH');
  expectError('tk14_memory_action_wrong_session_review_pairing', await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory', { operator_session_id: sessionB, operator_review_id: reviewA, formalized_by: 'postv104', formalized_at: '2026-06-28T04:05:00.000Z' }), 400, 'OPERATOR_REVIEW_SESSION_MISMATCH');

  expectError('tk15_ingestion_missing_candidate_id', await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', { source_system: 'postv104', ingested_by: 'postv104', ingested_at: '2026-06-28T04:06:00.000Z' }), 400, 'FIELD_LEARNING_CANDIDATE_ID_REQUIRED');
  expectError('tk15_ingestion_unknown_candidate_id', await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', { field_learning_candidate_id: runRef('missing_flc'), source_system: 'postv104', ingested_by: 'postv104', ingested_at: '2026-06-28T04:06:00.000Z' }), 404, 'FIELD_LEARNING_CANDIDATE_NOT_FOUND');
  expectError('tk15_ingestion_malformed_source_refs', await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', { field_learning_candidate_id: FIELD_LEARNING_CANDIDATE_ID, source_system: 'postv104', source_event_id: runRef('malformed_source_refs'), ingested_by: 'postv104', ingested_at: '2026-06-28T04:06:00.000Z', source_refs: [] }), 400, 'MALFORMED_SOURCE_REFS');

  const productionBody = { field_learning_candidate_id: FIELD_LEARNING_CANDIDATE_ID, source_system: 'postv104_negative_matrix', source_event_id: runRef('production_source_event'), occurred_at: '2026-06-28T04:06:00.000Z', ingested_by: 'postv104', ingested_at: '2026-06-28T04:07:00.000Z', source_refs: { recommendation_ref_id: runRef('prod_rec'), receipt_ref_id: runRef('prod_receipt') } };
  const productionFirst = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', productionBody);
  assert('tk15_first_ingestion_for_conflict_succeeds', productionFirst.status === 200 && productionFirst.json.ok === true && productionFirst.json.automatic_task_created === false && productionFirst.json.automatic_roi_created === false && productionFirst.json.model_update_created === false, { status: productionFirst.status, json: productionFirst.json });
  const productionConflict = JSON.parse(JSON.stringify(productionBody));
  productionConflict.source_refs.receipt_ref_id = runRef('prod_receipt_conflict');
  expectError('tk15_duplicate_conflict_rejected', await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', productionConflict), 409, 'SOURCE_EVENT_ID_CONFLICT');

  expectError('tk18_business_closure_unknown_decision_cycle_id', await requestJson('GET', `/api/v1/twin-kernel/business-closures/${encodeURIComponent(runRef('missing_dc'))}`), 404, 'DECISION_CYCLE_NOT_FOUND');
  const closure = await requestJson('GET', `/api/v1/twin-kernel/business-closures/${encodeURIComponent(decisionA)}`);
  assert('tk18_business_closure_read_only_no_auto_writes', closure.status === 200 && closure.json.ok === true && closure.json.read_only === true && closure.json.write_ready === false && closure.json.downstream_write_ready === false && closure.json.automatic_task_created === false && closure.json.automatic_roi_created === false && closure.json.automatic_field_memory_created === false && closure.json.model_update_created === false, { status: closure.status, json: closure.json });
  assertNoAutoWrites('tk18_business_closure_forbidden_auto_write_flags', closure.json);

  const queue = await requestJson('GET', '/api/v1/twin-kernel/operator-workflow/decision-cycles?limit=5');
  assert('tk14_queue_read_only_no_auto_writes', queue.status === 200 && queue.json.ok === true && queue.json.read_only === true && queue.json.write_ready === false, { status: queue.status, json: queue.json });

  const negativeCaseCount = assertions.filter((item) => item.name.startsWith('tk13_') || item.name.startsWith('tk14_') || item.name.startsWith('tk15_') || item.name.startsWith('tk18_')).length;
  const wrongPairingRejected = assertions.some((item) => item.name === 'tk14_roi_action_wrong_session_review_pairing' && item.passed === true) && assertions.some((item) => item.name === 'tk14_memory_action_wrong_session_review_pairing' && item.passed === true);

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    base_url: BASE_URL,
    run_id: RUN_ID,
    field_learning_candidate_id: FIELD_LEARNING_CANDIDATE_ID,
    decision_cycle_ids: [decisionA, decisionB],
    operator_session_ids: [sessionA, sessionB],
    operator_review_ids: [reviewA, reviewB],
    negative_case_count: negativeCaseCount,
    wrong_pairing_rejected: wrongPairingRejected,
    forbidden_auto_write_flags_verified: true,
    tk16_static_harness_boundary_checked: true,
    tk17_static_ux_boundary_checked: true,
    assertions,
    next_step: 'POSTV1-05_DB_INDEX_QUERY_COST_AUDIT',
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    base_url: BASE_URL,
    run_id: RUN_ID,
    error: error.message,
    details: error.details || error.response || null,
    assertions,
    hint: 'Ensure the API server is running on the POSTV1-04 branch and POSTV1_04_FIELD_LEARNING_CANDIDATE_ID points to a persisted field_learning_candidate_v1 row.',
  }, null, 2));
  process.exit(1);
});
