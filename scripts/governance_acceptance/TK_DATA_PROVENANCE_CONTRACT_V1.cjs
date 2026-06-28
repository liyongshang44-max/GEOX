// scripts/governance_acceptance/TK_DATA_PROVENANCE_CONTRACT_V1.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE = 'TK_DATA_PROVENANCE_CONTRACT_V1';
const ROOT = process.cwd();

const FILES = {
  contract: 'docs/tasks/TK-DATA-Provenance-Contract-v1.md',
  route: 'apps/server/src/routes/v1/twin_kernel.ts',
  snapshotBuilder: 'apps/server/src/domain/twin_kernel/field_state_snapshot_v1.ts',
  forecastBuilder: 'apps/server/src/domain/twin_kernel/forecast_run_v1.ts',
  scenarioBuilder: 'apps/server/src/domain/twin_kernel/scenario_set_v1.ts',
  calibrationBuilder: 'apps/server/src/domain/twin_kernel/calibration_replay_v1.ts',
  learningBuilder: 'apps/server/src/domain/twin_kernel/field_learning_candidate_v1.ts',
  decisionBuilder: 'apps/server/src/domain/twin_kernel/decision_cycle_v1.ts',
};

const CONTRACT_TOKENS = [
  'Twin Kernel Data Provenance Contract v1',
  'Entered / collected data',
  'System-derived Twin Kernel data',
  'Human-confirmed data',
  'Pointer refs only',
  'field_state_snapshot_v1',
  'forecast_run_v1',
  'scenario_set_v1',
  'calibration_replay_v1',
  'forecast_error_v1',
  'field_learning_candidate_v1',
  'decision_cycle_v1',
  'Forbidden caller-supplied fields',
  'determinism_hash',
  'request body passthrough',
];

const FORBIDDEN_REQUEST_BODY_DERIVED_KEYS = [
  'state_vector_json',
  'confidence_json',
  'source_indexes_json',
  'forecast_points_json',
  'risk_timeline_json',
  'uncertainty_json',
  'baseline_scenario_json',
  'option_scenarios_json',
  'comparison_axes_json',
  'predicted_json',
  'observed_json',
  'error_summary_json',
  'reason_candidates_json',
  'error_metric',
  'error_value',
  'error_direction',
  'learning_statement_json',
  'supporting_evidence_refs_json',
  'counter_evidence_refs_json',
  'h58_gate_status_json',
  'cycle_status',
  'current_stage',
  'state_machine_json',
  'human_gate_json',
  'boundary_flags_json',
  'blocking_reasons_json',
  'determinism_hash',
  'learning_eligible',
  'customer_visible_memory',
  'automatic_task_created',
];

const ALLOWED_REQUEST_BODY_INPUT_KEYS = [
  'tenant_id',
  'tenantId',
  'project_id',
  'projectId',
  'group_id',
  'groupId',
  'field_id',
  'fieldId',
  'season_id',
  'seasonId',
  'as_of_ts',
  'asOfTs',
  'snapshot_id',
  'snapshotId',
  'forecast_run_id',
  'forecastRunId',
  'scenario_set_id',
  'scenarioSetId',
  'calibration_replay_id',
  'calibrationReplayId',
  'forecast_error_id',
  'forecastErrorId',
  'field_learning_candidate_id',
  'fieldLearningCandidateId',
  'decision_cycle_id',
  'decisionCycleId',
  'selected_option_id',
  'selectedOptionId',
  'model_version',
  'modelVersion',
  'scenario_model_version',
  'scenarioModelVersion',
  'observed',
  'observed_at',
  'observedAt',
  'post_soil_moisture_percent',
  'postSoilMoisturePercent',
  'observed_water_state',
  'observedWaterState',
  'verification_ref_id',
  'verificationRefId',
  'evidence_refs',
  'evidenceRefs',
  'formal_gate_refs',
  'formalGateRefs',
  'acceptance_id',
  'acceptanceId',
  'post_irrigation_verification_id',
  'postIrrigationVerificationId',
  'formal_evidence_ref_id',
  'formalEvidenceRefId',
  'external_refs',
  'externalRefs',
  'recommendation_id',
  'recommendationId',
  'approval_id',
  'approvalId',
  'operation_plan_id',
  'operationPlanId',
  'act_task_id',
  'actTaskId',
  'receipt_id',
  'receiptId',
  'as_executed_id',
  'asExecutedId',
  'roi_entry_id',
  'roiEntryId',
  'field_memory_id',
  'fieldMemoryId',
];

const BUILDER_REQUIREMENTS = [
  { file: FILES.snapshotBuilder, fn: 'buildFieldStateSnapshotV1', tokens: ['snapshot_id', 'state_vector_json', 'confidence_json', 'source_indexes_json', 'determinism_hash'] },
  { file: FILES.forecastBuilder, fn: 'buildForecastRunV1', tokens: ['forecast_run_id', 'forecast_points_json', 'risk_timeline_json', 'uncertainty_json', 'determinism_hash'] },
  { file: FILES.scenarioBuilder, fn: 'buildScenarioSetV1', tokens: ['scenario_set_id', 'baseline_scenario_json', 'option_scenarios_json', 'comparison_axes_json', 'determinism_hash'] },
  { file: FILES.calibrationBuilder, fn: 'buildCalibrationReplayAndForecastErrorV1', tokens: ['calibration_replay_id', 'forecast_error_id', 'predicted_json', 'error_summary_json', 'error_direction', 'determinism_hash'] },
  { file: FILES.learningBuilder, fn: 'buildFieldLearningCandidateV1', tokens: ['field_learning_candidate_id', 'learning_statement_json', 'supporting_evidence_refs_json', 'h58_gate_status_json', 'determinism_hash'] },
  { file: FILES.decisionBuilder, fn: 'buildDecisionCycleV1', tokens: ['decision_cycle_id', 'state_machine_json', 'human_gate_json', 'boundary_flags_json', 'determinism_hash'] },
];

const FORBIDDEN_TK_ROUTE_WRITE_PATTERNS = [
  /INSERT\s+INTO\s+(public\.)?field_memory\b/i,
  /INSERT\s+INTO\s+(public\.)?roi\b/i,
  /INSERT\s+INTO\s+(public\.)?decision_recommendation_index_v1\b/i,
  /INSERT\s+INTO\s+(public\.)?approval\b/i,
  /INSERT\s+INTO\s+(public\.)?operation_plan\b/i,
  /INSERT\s+INTO\s+(public\.)?ao_act\b/i,
  /INSERT\s+INTO\s+(public\.)?action\b/i,
  /INSERT\s+INTO\s+(public\.)?receipt\b/i,
  /INSERT\s+INTO\s+(public\.)?acceptance\b/i,
  /UPDATE\s+(public\.)?field_memory\b/i,
  /UPDATE\s+(public\.)?roi\b/i,
  /UPDATE\s+(public\.)?decision_recommendation_index_v1\b/i,
  /UPDATE\s+(public\.)?approval\b/i,
  /UPDATE\s+(public\.)?operation_plan\b/i,
  /UPDATE\s+(public\.)?ao_act\b/i,
  /UPDATE\s+(public\.)?action\b/i,
  /UPDATE\s+(public\.)?receipt\b/i,
  /UPDATE\s+(public\.)?acceptance\b/i,
];

function abs(file) {
  return path.resolve(ROOT, file);
}

function fail(error, details) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error, details: details || {} }, null, 2));
  process.exit(1);
}

function assertOk(condition, error, details) {
  if (!condition) fail(error, details);
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

function extractTypeBlock(source, typeName) {
  const marker = `type ${typeName}`;
  const start = source.indexOf(marker);
  assertOk(start >= 0, 'TYPE_BLOCK_MISSING', { typeName });
  const open = source.indexOf('{', start);
  assertOk(open >= 0, 'TYPE_BLOCK_OPEN_BRACE_MISSING', { typeName });
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  fail('TYPE_BLOCK_CLOSE_BRACE_MISSING', { typeName });
}

function extractRequestBodyKeys(block) {
  const keys = [];
  const re = /^\s*([A-Za-z0-9_]+)\??:/gm;
  let match;
  while ((match = re.exec(block)) !== null) keys.push(match[1]);
  return keys;
}

function assertNoForbiddenBodyKeys(routeText) {
  const block = extractTypeBlock(routeText, 'TwinKernelRequestBody');
  const keys = extractRequestBodyKeys(block);
  const forbidden = keys.filter((key) => FORBIDDEN_REQUEST_BODY_DERIVED_KEYS.includes(key));
  const unknown = keys.filter((key) => !ALLOWED_REQUEST_BODY_INPUT_KEYS.includes(key));
  assertOk(forbidden.length === 0, 'DERIVED_KEY_ACCEPTED_IN_REQUEST_BODY', { forbidden });
  assertOk(unknown.length === 0, 'UNKNOWN_REQUEST_BODY_KEY', { unknown });
  return { request_body_key_count: keys.length, forbidden_key_count: forbidden.length, unknown_key_count: unknown.length };
}

function assertNoBodyDeterminism(routeText) {
  const bodyExtractionPattern = /body\.[A-Za-z0-9_]*determinism[A-Za-z0-9_]*/i;
  assertOk(!bodyExtractionPattern.test(routeText), 'DETERMINISM_HASH_CAN_BE_READ_FROM_BODY', {});
}

function assertBuilderHashDerivation(requirement) {
  const text = read(requirement.file);
  assertOk(text.includes(requirement.fn), 'BUILDER_FUNCTION_MISSING', { file: requirement.file, fn: requirement.fn });
  assertOk(text.includes('createHash') || text.includes('hashPayload'), 'BUILDER_HASH_DERIVATION_MISSING', { file: requirement.file });
  assertOk(text.includes('determinism_hash') || text.includes('determinismHash'), 'BUILDER_DETERMINISM_FIELD_MISSING', { file: requirement.file });
  const missing = requirement.tokens.filter((token) => !text.includes(token));
  assertOk(missing.length === 0, 'BUILDER_PROVENANCE_TOKEN_MISSING', { file: requirement.file, missing });
  return { file: requirement.file, fn: requirement.fn, token_count: requirement.tokens.length };
}

function assertDownstreamWritesPreserved(routeText) {
  const hits = [];
  for (const pattern of FORBIDDEN_TK_ROUTE_WRITE_PATTERNS) {
    if (pattern.test(routeText)) hits.push(String(pattern));
  }
  assertOk(hits.length === 0, 'FORBIDDEN_DOWNSTREAM_WRITE_IN_TWIN_KERNEL_ROUTE', { hits });
}

function assertAllowedTwinKernelWrites(routeText) {
  const allowed = [
    'INSERT INTO field_state_snapshot_v1',
    'INSERT INTO forecast_run_v1',
    'INSERT INTO scenario_set_v1',
    'INSERT INTO calibration_replay_v1',
    'INSERT INTO forecast_error_v1',
    'INSERT INTO field_learning_candidate_v1',
    'INSERT INTO decision_cycle_v1',
  ];
  const missing = allowed.filter((token) => !routeText.includes(token));
  assertOk(missing.length === 0, 'TWIN_KERNEL_WRITE_PATH_MISSING', { missing });
  return { allowed_write_paths: allowed.length };
}

function main() {
  const contract = requireTokens(FILES.contract, CONTRACT_TOKENS);
  const routeText = read(FILES.route);
  const requestBody = assertNoForbiddenBodyKeys(routeText);
  assertNoBodyDeterminism(routeText);
  const routeWriteBoundary = assertAllowedTwinKernelWrites(routeText);
  assertDownstreamWritesPreserved(routeText);
  const builders = BUILDER_REQUIREMENTS.map(assertBuilderHashDerivation);
  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    purpose: 'Twin Kernel data provenance boundary: entered/collected vs system-derived vs human-confirmed vs pointer-ref data.',
    contract,
    request_body_derived_passthrough_blocked: true,
    determinism_hash_user_input_blocked: true,
    request_body: requestBody,
    builder_hash_derivation_present: true,
    builders,
    downstream_write_boundary_preserved: true,
    route_write_boundary: routeWriteBoundary,
    allowed_request_body_class: [
      'scope',
      'object ids',
      'model version labels',
      'external observations',
      'formal gate refs',
      'pointer refs',
    ],
    forbidden_request_body_class: [
      'kernel derived result payloads',
      'determinism_hash',
      'Field Memory formal flags',
      'automatic task flags',
    ],
    next_step: 'TWIN_KERNEL_RUNTIME_VALUE_TRACE_ACCEPTANCE',
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(error && error.message ? error.message : String(error));
}
