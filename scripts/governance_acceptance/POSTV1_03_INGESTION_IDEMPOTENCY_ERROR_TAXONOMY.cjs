// scripts/governance_acceptance/POSTV1_03_INGESTION_IDEMPOTENCY_ERROR_TAXONOMY.cjs
// Purpose: verify production ingestion idempotency, conflict handling, and structured error taxonomy.
// Boundary: this script uses the existing production ingestion route; it does not create adapters, migrations, UI, ROI, Field Memory, AO-ACT tasks, or model updates.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'POSTV1_03_INGESTION_IDEMPOTENCY_ERROR_TAXONOMY';
const BASE_URL = String(process.env.TWIN_KERNEL_BASE_URL || process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const RUN_ID = String(process.env.POSTV1_03_RUN_ID || `run_${Date.now()}_${process.pid}_${Math.random().toString(16).slice(2, 10)}`).replace(/[^A-Za-z0-9_-]/g, '_');
const FIELD_LEARNING_CANDIDATE_ID = String(process.env.POSTV1_03_FIELD_LEARNING_CANDIDATE_ID || 'flc_c23a3ace34c48ce59c205110');

const FILES = {
  taskLine: 'docs/legacy/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md',
  taskDoc: 'docs/legacy/tasks/POSTV1-03-Ingestion-Idempotency-Error-Taxonomy.md',
  route: 'apps/server/src/routes/v1/twin_kernel_production_ingestion.ts',
  tk15Acceptance: 'scripts/governance_acceptance/TK15_PRODUCTION_INGESTION_V0.cjs',
  postv102Acceptance: 'scripts/governance_acceptance/POSTV1_02_STRONG_MULTI_SCOPE_FIXTURE_PACK.cjs',
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

function hasOwn(value, key) {
  return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
}

function runRef(stem) {
  return `${stem}_${RUN_ID}`;
}

function validBody() {
  return {
    field_learning_candidate_id: FIELD_LEARNING_CANDIDATE_ID,
    source_system: 'postv1_03_idempotency_acceptance',
    source_event_id: runRef('source_event'),
    occurred_at: '2026-06-28T03:00:00.000Z',
    ingested_by: 'postv1_03_acceptance',
    ingested_at: '2026-06-28T03:01:00.000Z',
    source_refs: {
      recommendation_ref_id: runRef('rec'),
      approval_ref_id: runRef('approval'),
      operation_plan_ref_id: runRef('plan'),
      task_ref_id: runRef('task'),
      receipt_ref_id: runRef('receipt'),
      observation_ref_id: runRef('observation'),
      acceptance_ref_id: runRef('acceptance'),
      verification_ref_id: runRef('verification'),
    },
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

function assertError(name, response, expectedStatus, expectedCode) {
  const structured = record(response.json.structured_error);
  assert(name, response.status === expectedStatus && response.json.ok === false && response.json.error === expectedCode && response.json.error_code === expectedCode && structured.code === expectedCode && structured.status === expectedStatus && structured.category === 'production_ingestion', {
    status: response.status,
    json: response.json,
  });
}

function staticAudit() {
  for (const [name, file] of Object.entries(FILES)) {
    assert(`${name}_exists`, fs.existsSync(abs(file)), { file });
  }
  const taskLine = read(FILES.taskLine);
  const taskDoc = read(FILES.taskDoc);
  const route = read(FILES.route);
  assert('task_line_records_postv103', containsAll(taskLine, ['POSTV1-03 Ingestion Idempotency & Error Taxonomy', 'source_system + source_event_id idempotency readback', 'stable duplicate response semantics', 'structured error code ledger']), { file: FILES.taskLine });
  assert('task_doc_records_scope', containsAll(taskDoc, ['SOURCE_EVENT_ID_CONFLICT', 'MALFORMED_SOURCE_REFS', 'idempotent_replay = true', 'structured_error', 'No automatic business decision.']), { file: FILES.taskDoc });
  assert('route_records_idempotency_and_errors', containsAll(route, ['SOURCE_EVENT_ID_CONFLICT', 'MALFORMED_SOURCE_REFS', 'idempotent_replay', 'duplicate_source_event', 'stable_duplicate_response', 'structured_error', 'error_code']), { file: FILES.route });
  assert('route_preserves_boundaries', containsAll(route, ['automatic_business_decision_created: false', 'automatic_recommendation_created: false', 'automatic_approval_created: false', 'automatic_task_created: false', 'automatic_receipt_created: false', 'automatic_acceptance_created: false', 'automatic_roi_created: false', 'automatic_field_memory_created: false', 'model_update_created: false']), { file: FILES.route });
}

function assertRuntimeExposesPostv103Fields(first) {
  const required = ['idempotent_replay', 'duplicate_source_event', 'stable_duplicate_response', 'write_ready'];
  const missing = required.filter((key) => !hasOwn(first.json, key));
  assert('runtime_response_exposes_postv103_flags', first.status !== 200 || missing.length === 0, {
    status: first.status,
    missing_response_fields: missing,
    response_keys: Object.keys(record(first.json)).sort(),
    first_response: first.json,
    hint: 'The checked-out files contain POSTV1-03, but the running API appears to be serving an older production ingestion route. Restart/rebuild the server process and rerun this acceptance.',
  });
}

async function main() {
  staticAudit();
  const body = validBody();

  const first = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', body);
  assertRuntimeExposesPostv103Fields(first);
  const firstEvent = record(first.json.production_ingestion_event);
  const firstDecision = record(first.json.decision_cycle);
  assert('first_write_succeeds', first.status === 200 && first.json.ok === true && first.json.idempotent_replay === false && first.json.duplicate_source_event === false && first.json.write_ready === true && String(firstEvent.production_ingestion_event_id || '').startsWith('ping_') && String(firstDecision.decision_cycle_id || '').startsWith('dc_'), {
    status: first.status,
    first_response: first.json,
    production_ingestion_event: firstEvent,
    decision_cycle: firstDecision,
  });

  const duplicate = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', body);
  const duplicateEvent = record(duplicate.json.production_ingestion_event);
  const duplicateDecision = record(duplicate.json.decision_cycle);
  assert('duplicate_is_stable_idempotent_replay', duplicate.status === 200 && duplicate.json.ok === true && duplicate.json.idempotent_replay === true && duplicate.json.duplicate_source_event === true && duplicate.json.stable_duplicate_response === true && duplicate.json.write_ready === false && duplicateEvent.production_ingestion_event_id === firstEvent.production_ingestion_event_id && duplicateDecision.decision_cycle_id === firstDecision.decision_cycle_id, {
    status: duplicate.status,
    duplicate_response: duplicate.json,
    production_ingestion_event: duplicateEvent,
    decision_cycle: duplicateDecision,
  });

  const conflictBody = JSON.parse(JSON.stringify(body));
  conflictBody.source_refs.receipt_ref_id = runRef('receipt_conflict');
  const conflict = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', conflictBody);
  assertError('conflicting_duplicate_rejected', conflict, 409, 'SOURCE_EVENT_ID_CONFLICT');

  const missingCandidate = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', { ...body, field_learning_candidate_id: '' });
  assertError('missing_candidate_id_error', missingCandidate, 400, 'FIELD_LEARNING_CANDIDATE_ID_REQUIRED');

  const missingSourceSystem = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', { ...body, source_system: '' });
  assertError('missing_source_system_error', missingSourceSystem, 400, 'SOURCE_SYSTEM_REQUIRED');

  const missingIngestedBy = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', { ...body, ingested_by: '' });
  assertError('missing_ingested_by_error', missingIngestedBy, 400, 'INGESTED_BY_REQUIRED');

  const missingIngestedAt = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', { ...body, ingested_at: '' });
  assertError('missing_ingested_at_error', missingIngestedAt, 400, 'INGESTED_AT_REQUIRED');

  const invalidIngestedAt = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', { ...body, source_event_id: runRef('invalid_ingested_at'), ingested_at: 'not-a-date' });
  assertError('invalid_ingested_at_error', invalidIngestedAt, 400, 'INVALID_INGESTED_AT');

  const invalidOccurredAt = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', { ...body, source_event_id: runRef('invalid_occurred_at'), occurred_at: 'not-a-date' });
  assertError('invalid_occurred_at_error', invalidOccurredAt, 400, 'INVALID_OCCURRED_AT');

  const malformedSourceRefsArray = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', { ...body, source_event_id: runRef('malformed_array'), source_refs: [] });
  assertError('malformed_source_refs_array_error', malformedSourceRefsArray, 400, 'MALFORMED_SOURCE_REFS');

  const malformedSourceRefsNested = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', { ...body, source_event_id: runRef('malformed_nested'), source_refs: { recommendation_ref_id: { nested: true } } });
  assertError('malformed_source_refs_nested_error', malformedSourceRefsNested, 400, 'MALFORMED_SOURCE_REFS');

  const unknownCandidate = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', { ...body, source_event_id: runRef('unknown_candidate'), field_learning_candidate_id: runRef('missing_flc') });
  assertError('unknown_candidate_error', unknownCandidate, 404, 'FIELD_LEARNING_CANDIDATE_NOT_FOUND');

  const boundaryFlags = record(first.json);
  assert('first_write_boundaries_preserved', boundaryFlags.automatic_business_decision_created === false && boundaryFlags.automatic_recommendation_created === false && boundaryFlags.automatic_approval_created === false && boundaryFlags.automatic_task_created === false && boundaryFlags.automatic_receipt_created === false && boundaryFlags.automatic_acceptance_created === false && boundaryFlags.automatic_roi_created === false && boundaryFlags.automatic_field_memory_created === false && boundaryFlags.model_update_created === false, { first_response: first.json });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    base_url: BASE_URL,
    run_id: RUN_ID,
    field_learning_candidate_id: FIELD_LEARNING_CANDIDATE_ID,
    production_ingestion_event_id: firstEvent.production_ingestion_event_id,
    decision_cycle_id: firstDecision.decision_cycle_id,
    idempotent_duplicate_verified: true,
    conflict_duplicate_rejected: true,
    structured_error_count: assertions.filter((item) => String(item.name).includes('_error') || item.name === 'conflicting_duplicate_rejected').length,
    assertions,
    next_step: 'POSTV1-04_ROUTE_NEGATIVE_RUNTIME_MATRIX',
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
    hint: 'Ensure the API server is running, the POSTV1-03 branch is checked out, and the server process has been restarted/rebuilt after pulling route changes.',
  }, null, 2));
  process.exit(1);
});
