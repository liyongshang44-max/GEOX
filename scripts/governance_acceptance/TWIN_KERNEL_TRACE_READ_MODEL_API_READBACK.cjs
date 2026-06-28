// scripts/governance_acceptance/TWIN_KERNEL_TRACE_READ_MODEL_API_READBACK.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE = 'TWIN_KERNEL_TRACE_READ_MODEL_API_READBACK';
const ROOT = process.cwd();

const FILES = {
  doc: 'docs/tasks/TWIN-KERNEL-Trace-Read-Model-API-Readback.md',
  route: 'apps/server/src/routes/v1/twin_kernel_trace.ts',
  module: 'apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts',
};

const DOC_TOKENS = [
  'TWIN_KERNEL_TRACE_READ_MODEL_OR_API_READBACK',
  'GET /api/v1/twin-kernel/traces/:decision_cycle_id',
  'twin_trace_v1_read_model',
  'entered_collected',
  'system_derived',
  'human_confirmed',
  'pointer_refs',
  'TWIN_TRACE_LINKED_OBJECTS_MISSING',
  'missing_formalization',
];

const ROUTE_TOKENS = [
  'registerTwinKernelTraceReadModelRoutes',
  'app.get("/api/v1/twin-kernel/traces/:decision_cycle_id"',
  'twin_trace_v1_read_model',
  'readSnapshotRow',
  'readForecastRunRow',
  'readScenarioSetRow',
  'readCalibrationReplayRow',
  'readForecastErrorRow',
  'readFieldLearningCandidateRow',
  'readDecisionCycleRow',
  'field_state_snapshot_v1',
  'forecast_run_v1',
  'scenario_set_v1',
  'calibration_replay_v1',
  'forecast_error_v1',
  'field_learning_candidate_v1',
  'decision_cycle_v1',
  'provenance_classes',
  'entered_collected',
  'system_derived',
  'human_confirmed',
  'pointer_refs',
  'answers',
  'missing_formalization',
  'forbidden_auto_writes_absent',
  'TWIN_TRACE_LINKED_OBJECTS_MISSING',
];

const MODULE_TOKENS = [
  'registerTwinKernelV1Routes(app, pool)',
  'registerTwinKernelTraceReadModelRoutes(app, pool)',
];

const FORBIDDEN_ROUTE_PATTERNS = [
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+[a-zA-Z_]/i,
  /\bDELETE\s+FROM\b/i,
  /buildFieldStateSnapshotV1/i,
  /buildForecastRunV1/i,
  /buildScenarioSetV1/i,
  /buildCalibrationReplayAndForecastErrorV1/i,
  /buildFieldLearningCandidateV1/i,
  /buildDecisionCycleV1/i,
  /automatic_recommendation_created\s*:\s*true/i,
  /automatic_approval_created\s*:\s*true/i,
  /automatic_task_created\s*:\s*true/i,
  /automatic_receipt_created\s*:\s*true/i,
  /automatic_acceptance_created\s*:\s*true/i,
  /automatic_roi_created\s*:\s*true/i,
  /automatic_field_memory_created\s*:\s*true/i,
  /model_updated\s*:\s*true/i,
];

function fail(error, details) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error, details: details || {} }, null, 2));
  process.exit(1);
}

function assertOk(condition, error, details) {
  if (!condition) fail(error, details);
}

function abs(file) {
  return path.resolve(ROOT, file);
}

function read(file) {
  assertOk(fs.existsSync(abs(file)), 'FILE_MISSING', { file });
  return fs.readFileSync(abs(file), 'utf8');
}

function requireTokens(file, tokens) {
  const text = read(file);
  const missing = tokens.filter((token) => !text.includes(token));
  assertOk(missing.length === 0, 'TOKEN_MISSING', { file, missing });
  return { file, token_count: tokens.length };
}

function assertNoForbiddenPatterns(file, patterns) {
  const text = read(file);
  const hits = patterns.filter((pattern) => pattern.test(text)).map(String);
  assertOk(hits.length === 0, 'FORBIDDEN_PATTERN_FOUND', { file, hits });
}

function assertSelectOnlyRoute(file) {
  const text = read(file);
  const selectCount = (text.match(/SELECT \* FROM/g) || []).length;
  assertOk(selectCount >= 7, 'FULL_TK_CHAIN_READS_NOT_DECLARED', { file, selectCount });
  assertOk(text.includes('read_only: true'), 'READ_ONLY_FLAG_MISSING', { file });
  assertOk(text.includes('write_ready: false'), 'WRITE_READY_FALSE_MISSING', { file });
  assertOk(text.includes('downstream_write_ready: false'), 'DOWNSTREAM_WRITE_READY_FALSE_MISSING', { file });
}

function main() {
  const doc = requireTokens(FILES.doc, DOC_TOKENS);
  const route = requireTokens(FILES.route, ROUTE_TOKENS);
  const module = requireTokens(FILES.module, MODULE_TOKENS);
  assertNoForbiddenPatterns(FILES.route, FORBIDDEN_ROUTE_PATTERNS);
  assertSelectOnlyRoute(FILES.route);
  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    trace_route_registered: true,
    trace_route_read_only: true,
    full_tk_chain_readback_declared: true,
    provenance_read_model_declared: true,
    missing_formalization_declared: true,
    forbidden_auto_write_boundary_preserved: true,
    doc,
    route,
    module,
    route_path: '/api/v1/twin-kernel/traces/:decision_cycle_id',
    next_step: 'LOCAL_SERVER_READBACK_SMOKE_TEST_WITH_REAL_DECISION_CYCLE_ID',
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(error && error.message ? error.message : String(error));
}
