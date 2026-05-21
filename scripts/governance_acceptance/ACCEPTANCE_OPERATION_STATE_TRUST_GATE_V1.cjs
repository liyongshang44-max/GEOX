#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const files = {
  projection: path.join(root, 'apps/server/src/projections/operation_state_v1.ts'),
  acceptanceEngine: path.join(root, 'apps/server/src/domain/acceptance/acceptance_engine_v1.ts'),
  acceptanceRules: path.join(root, 'apps/server/src/domain/acceptance/acceptance_rules_v1.ts'),
  acceptanceTypes: path.join(root, 'apps/server/src/domain/acceptance/types.ts'),
  route: path.join(root, 'apps/server/src/routes/operation_state_v1.ts'),
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[operation-state-trust-gate] FAIL: ${message}`);
    process.exit(1);
  }
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), `${label} must include ${needle}`);
}

function assertNotIncludes(text, needle, label) {
  assert(!text.includes(needle), `${label} must not include ${needle}`);
}

const projection = read(files.projection);
const acceptanceEngine = read(files.acceptanceEngine);
const acceptanceRules = read(files.acceptanceRules);
const acceptanceTypes = read(files.acceptanceTypes);
const route = read(files.route);

// Contract: OperationState is a technical projection unless backed by formal acceptance.
assertIncludes(projection, 'state_source', 'OperationStateV1 trust fields');
assertIncludes(projection, 'formal_status', 'OperationStateV1 trust fields');
assertIncludes(projection, 'source_facts', 'OperationStateV1 trust fields');
assertIncludes(projection, 'projection_rule', 'OperationStateV1 trust fields');
assertIncludes(projection, 'freshness', 'OperationStateV1 trust fields');
assertIncludes(projection, 'blocking_reasons', 'OperationStateV1 trust fields');
assertIncludes(projection, 'fallback_limited', 'OperationStateV1 trust fields');
assertIncludes(projection, 'customer_visible_eligible', 'OperationStateV1 trust fields');

// receipt SUCCESS must not directly derive formal final_status SUCCESS/FAILED.
assertNotIncludes(projection, 'function finalStatusFromReceipt', 'operation_state projection');
assertNotIncludes(projection, 'finalStatusFromReceipt(', 'operation_state projection');
assertIncludes(projection, 'formalStatus === "FORMAL_PASS"', 'formal-only SUCCESS rule');
assertIncludes(projection, 'formalStatus === "FORMAL_FAIL"', 'formal-only FAILED rule');
assertIncludes(projection, '? "PENDING_ACCEPTANCE"', 'receipt-only pending acceptance rule');

// Fallback acceptance helpers must not generate PASS.
assertNotIncludes(acceptanceEngine, 'verdict: "PASS"', 'buildAcceptanceResult fallback engine');
assertNotIncludes(acceptanceRules, 'verdict: "PASS"', 'evaluateAcceptance fallback rules');
assertIncludes(acceptanceTypes, '"NEEDS_FORMAL_ACCEPTANCE"', 'AcceptanceVerdict');
assertIncludes(acceptanceTypes, '"INSUFFICIENT_EVIDENCE"', 'AcceptanceVerdict');
assertIncludes(acceptanceEngine, '"NEEDS_FORMAL_ACCEPTANCE"', 'buildAcceptanceResult fallback engine');
assertIncludes(acceptanceEngine, '"INSUFFICIENT_EVIDENCE"', 'buildAcceptanceResult fallback engine');
assertIncludes(acceptanceRules, '"NEEDS_FORMAL_ACCEPTANCE"', 'evaluateAcceptance fallback rules');
assertIncludes(acceptanceRules, '"INSUFFICIENT_EVIDENCE"', 'evaluateAcceptance fallback rules');

// Evidence artifact without formal evidence must remain pending/insufficient and blocked.
assertIncludes(projection, 'hasFormalEvidence: evidenceEvaluation.has_formal_evidence', 'fallback acceptance evidence policy input');
assertIncludes(projection, 'formal_evidence_missing', 'blocking reasons for non-formal evidence');
assertIncludes(acceptanceEngine, 'input.hasFormalEvidence === false', 'buildAcceptanceResult non-formal evidence branch');
assertIncludes(acceptanceRules, 'input.hasFormalEvidence === false', 'evaluateAcceptance non-formal evidence branch');

// No formal acceptance means fallback_limited and no customer-visible eligibility.
assertIncludes(projection, 'const fallbackLimited = !hasFormalAcceptance', 'fallback limited assignment');
assertIncludes(projection, 'fallback_limited: fallbackLimited', 'fallback limited output');
assertIncludes(projection, 'customer_visible_eligible: formalStatus === "FORMAL_PASS" && !fallbackLimited', 'customer visibility formal pass rule');
assertIncludes(projection, 'formal_acceptance_required', 'formal acceptance blocking reason');

// Route must expose projection output without deriving customer_visible_eligible locally.
assertIncludes(route, 'projectOperationStateV1(pool, tenant)', 'operation state route projection usage');
assertNotIncludes(route, 'customer_visible_eligible:', 'operation_state route must not derive customer_visible_eligible');
assertNotIncludes(route, 'fallback_limited:', 'operation_state route must not derive fallback_limited');

console.log('[operation-state-trust-gate] PASS');
