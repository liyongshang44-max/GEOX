'use strict';

// scripts/governance_acceptance/H57_ROI_GOVERNANCE_BOUNDARY.cjs
// Purpose: verify the existing ROI capability is governed by two distinct trust lanes.

const fs = require('node:fs');

const acceptance = 'H57_ROI_GOVERNANCE_BOUNDARY';

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

const doc = read('docs/tasks/H57-ROI-Governance-Boundary.md');
const preflightDoc = read('docs/tasks/H57-Preflight-Evaluation-Roi-FieldMemory-Audit.md');
const roiRoute = read('apps/server/src/routes/roi_ledger_v1.ts');
const roiDomain = read('apps/server/src/domain/roi/roi_ledger_v1.ts');
const roiAcceptance = read('scripts/agronomy_acceptance/ACCEPTANCE_ROI_LEDGER_V1.cjs');
const fieldMemoryRoute = read('apps/server/src/routes/field_memory_v1.ts');

requireIncludes('h57_roi_doc', doc, [
  'AS_EXECUTED_SIGNAL',
  'FORMAL_ACCEPTANCE',
  'customer_visible_value = false',
  'customer_visible_value = true',
  'H58',
]);

requireIncludes('h57_preflight_doc', preflightDoc, [
  'roi_capability_present',
  'field_memory_capability_present',
  'next_step_requires_plan',
]);

requireIncludes('roi_route', roiRoute, [
  '/api/v1/roi-ledger/from-as-executed',
  '/api/v1/roi-ledger/formalize-from-acceptance',
  'roi_ledger.write',
  'requireTenantScopeV1',
  'requireTenantMatchOr404V1',
  'AS_EXECUTED_SIGNAL',
  'FORMAL_ACCEPTANCE',
  'FORMAL_ACCEPTED',
  'customer_visible_value: false',
  'customer_visible_value: true',
]);

requireIncludes('roi_domain', roiDomain, [
  'createRoiLedgersFromAsExecuted',
  'formalizeRoiLedgersFromAcceptance',
  'getAcceptanceResultById',
  'validateFormalAcceptancePayload',
  'ACCEPTANCE_VERDICT_NOT_PASS',
  'ACCEPTANCE_NOT_FORMAL',
  'FORMAL_EVIDENCE_NOT_PASSED',
  'CHAIN_VALIDATION_NOT_PASSED',
  'AS_EXECUTED_SIGNAL',
  'INTERIM_SUPPORTED',
  'customer_visible_value === false',
  'FORMAL_ACCEPTANCE',
  'FORMAL_ACCEPTED',
  'customer_visible_value = true',
  'FORMALIZABLE_INTERIM_ROI_NOT_FOUND',
]);

requireIncludes('roi_acceptance', roiAcceptance, [
  '/api/v1/roi-ledger/from-as-executed',
  'roi_not_used_as_billing_source',
  'no_forbidden_types',
  'default_assumption_not_measured',
]);

requireIncludes('field_memory_route', fieldMemoryRoute, [
  '/api/v1/field-memory/from-acceptance',
  'FORMAL_FIELD_MEMORY',
  'customer_visible_memory: true',
]);

requireExcludes('roi_route', roiRoute, [
  'recordMemoryV1',
  'createFormalFieldMemoryFromAcceptanceV1',
  'INSERT INTO field_memory_v1',
]);

console.log(JSON.stringify({
  ok: true,
  acceptance,
  h57_roi_governance_boundary: 'PASS',
  roi_lane_split_present: true,
  as_executed_signal_not_customer_visible: true,
  formal_acceptance_customer_visible: true,
  formal_acceptance_gate_protected: true,
  interim_roi_required_before_formal_roi: true,
  roi_acceptance_from_as_executed_present: true,
  formal_roi_runtime_acceptance_not_claimed: true,
  roi_field_memory_separated: true,
  next_step: 'H58_FIELD_MEMORY_GOVERNANCE_BOUNDARY',
}, null, 2));
