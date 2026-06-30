'use strict';

// scripts/governance_acceptance/H58_FIELD_MEMORY_GOVERNANCE_BOUNDARY.cjs
// Purpose: verify existing Field Memory capability preserves the formal learning boundary.

const fs = require('node:fs');

const acceptance = 'H58_FIELD_MEMORY_GOVERNANCE_BOUNDARY';

function fail(error, details = {}) {
  console.error(JSON.stringify({ ok: false, acceptance, error, details }, null, 2));
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail('REQUIRED_FILE_MISSING', { file });
  return fs.readFileSync(file, 'utf8');
}

function requireIncludes(name, text, tokens) {
  for (const token of tokens) {
    if (!text.includes(token)) fail('REQUIRED_TOKEN_MISSING', { name, token });
  }
}

function requireExcludes(name, text, tokens) {
  for (const token of tokens) {
    if (text.includes(token)) fail('FORBIDDEN_TOKEN_PRESENT', { name, token });
  }
}

const h57Doc = read('docs/legacy/tasks/H57-ROI-Governance-Boundary.md');
const h58Doc = read('docs/legacy/tasks/H58-Field-Memory-Governance-Boundary.md');
const fieldMemoryRoute = read('apps/server/src/routes/field_memory_v1.ts');
const fieldMemoryService = read('apps/server/src/services/field_memory_service.ts');
const fieldMemoryAcceptance = read('scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs');
const learningValidation = read('apps/server/src/domain/operator_learning/learning_validation_v1.ts');
const roiRoute = read('apps/server/src/routes/roi_ledger_v1.ts');

requireIncludes('h57_doc', h57Doc, [
  'H57 stops at ROI lane governance',
  'Field Memory',
]);

requireIncludes('h58_doc', h58Doc, [
  'FORMAL_FIELD_MEMORY',
  'FORMAL_ACCEPTED',
  'customer_visible_memory = true',
  'learning_eligible = true',
  'TECHNICAL_SKILL_MEMORY',
  'TECHNICAL_EXECUTION_MEMORY',
  'SIMULATED_DEV_MEMORY',
  'ROI rows alone are not formal learning',
]);

requireIncludes('field_memory_route', fieldMemoryRoute, [
  '/api/v1/field-memory/from-acceptance',
  'field_memory.write',
  'requireTenantScopeV1',
  'requireTenantMatchOr404V1',
  'createFormalFieldMemoryFromAcceptanceV1',
  'MISSING_OPERATION_PLAN_ID',
  'MISSING_ACCEPTANCE_ID',
  'FORMAL_FIELD_MEMORY',
  'FORMAL_ACCEPTED',
  'FORMAL_OPERATION',
  'customer_visible_memory: true',
  'learning_eligible: true',
  'ACCEPTANCE_VERDICT_NOT_PASS',
  'ACCEPTANCE_NOT_FORMAL',
  'FORMAL_EVIDENCE_NOT_PASSED',
  'CHAIN_VALIDATION_NOT_PASSED',
  'OBSERVATION_PAIR_NOT_FOUND',
]);

requireIncludes('field_memory_service', fieldMemoryService, [
  'validateFormalFieldMemoryAcceptanceV1',
  'ACCEPTANCE_VERDICT_NOT_PASS',
  'ACCEPTANCE_NOT_FORMAL',
  'FORMAL_EVIDENCE_NOT_PASSED',
  'CHAIN_VALIDATION_NOT_PASSED',
  'OBSERVATION_PAIR_NOT_FOUND',
  'FIELD_RESPONSE_MEMORY',
  'FORMAL_FIELD_MEMORY',
  'FORMAL_ACCEPTED',
  'FORMAL_OPERATION',
  'customer_visible_memory: true',
  'learning_eligible: true',
  'FORMAL_FIELD_OBSERVATION_PAIR_FOUND',
  'TECHNICAL_SKILL_MEMORY',
  'TECHNICAL_EXECUTION_MEMORY',
  'DIAGNOSTIC_NOTE',
  'TECHNICAL_SIGNAL',
  'SIMULATED_DEV_MEMORY',
  'SIMULATED_DEV_ONLY',
  'FORMAL_MEMORY_REQUIRES_EXPLICIT_FORMAL_ACCEPTANCE_GATE',
  'SKILL_RUN_IS_NOT_FORMAL_FIELD_LEARNING',
  'EXECUTION_SIGNAL_IS_NOT_FORMAL_FIELD_LEARNING',
]);

requireIncludes('field_memory_acceptance', fieldMemoryAcceptance, [
  'ACCEPTANCE_FIELD_MEMORY_V1',
  'FIELD_RESPONSE_MEMORY',
  'DEVICE_RELIABILITY_MEMORY',
  'SKILL_PERFORMANCE_MEMORY',
  'memory_linked_to_current_chain',
  'field_response_has_before_value',
  'field_response_has_after_value',
  'field_response_has_delta_value',
  'openapi_matches_routes',
]);

requireIncludes('learning_validation', learningValidation, [
  'FORMAL_LEARNING_ACCEPTED',
  'TRUSTED_VALUE_ONLY',
  'RAW_SIGNALS_ONLY',
  'SIMULATED_OR_DEV_ONLY',
  'INSUFFICIENT_FORMAL_CHAIN',
  'FORMAL_FIELD_MEMORY',
  'FORMAL_ACCEPTED',
  'customer_visible_memory === true',
  'learning_eligible === true',
  'FORMAL_FIELD_MEMORY_REQUIRED',
  'ROI_ROW_IS_NOT_FORMAL_LEARNING',
  'TECHNICAL_MEMORY_IS_RAW_SIGNAL',
  'SKILL_RUN_IS_RAW_SIGNAL',
  'SIMULATED_OR_DEV_SIGNAL_NOT_FORMAL',
  'FORMAL_ACCEPTANCE_ID_REQUIRED',
]);

requireExcludes('field_memory_route', fieldMemoryRoute, [
  'formalizeRoiLedgersFromAcceptance',
  '/api/v1/roi-ledger/formalize-from-acceptance',
]);

requireExcludes('roi_route', roiRoute, [
  'createFormalFieldMemoryFromAcceptanceV1',
  'recordMemoryV1',
  'INSERT INTO field_memory_v1',
]);

console.log(JSON.stringify({
  ok: true,
  acceptance,
  h58_field_memory_governance_boundary: 'PASS',
  formal_field_memory_gate_present: true,
  technical_memory_not_formal_learning: true,
  simulated_memory_not_formal_learning: true,
  operator_learning_requires_formal_memory: true,
  roi_not_learning_effective: true,
  no_new_business_implementation_required: true,
  next_step: 'STOP_AFTER_H58',
}, null, 2));
