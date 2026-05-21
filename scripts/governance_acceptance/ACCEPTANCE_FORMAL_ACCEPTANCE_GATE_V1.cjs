#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const files = {
  route: path.join(root, 'apps/server/src/routes/acceptance_v1.ts'),
  engine: path.join(root, 'apps/server/src/domain/acceptance/engine_v1.ts'),
  evidencePolicy: path.join(root, 'apps/server/src/domain/evidence/formal_evidence_policy_v1.ts'),
  schema: path.join(root, 'packages/contracts/src/schema/acceptance_result_v1.ts'),
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function fail(message) {
  console.error(`[formal-acceptance-gate] FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} must include ${needle}`);
}

function assertNotIncludes(source, needle, label) {
  assert(!source.includes(needle), `${label} must not include ${needle}`);
}

const route = read(files.route);
const engine = read(files.engine);
const policy = read(files.evidencePolicy);
const schema = read(files.schema);

// Acceptance route must build and apply a hard formal gate before writing acceptance_result_v1.
assertIncludes(route, 'evidencePolicyFromReceiptV1', 'acceptance route');
assertIncludes(route, 'buildFormalAcceptanceGateV1', 'acceptance route');
assertIncludes(route, 'applyFormalAcceptanceGateV1', 'acceptance route');
assertIncludes(route, 'const formalGate = buildFormalAcceptanceGateV1(receiptFact.record_json ?? {})', 'acceptance route');
assertIncludes(route, 'const gatedVerdict = applyFormalAcceptanceGateV1(initialVerdict, formalGate)', 'acceptance route');
assertIncludes(route, 'verdict: gatedVerdict', 'acceptance_result_v1 write payload');
assertNotIncludes(route, 'verdict: rollupVerdict', 'acceptance_result_v1 write payload');

// PASS must be impossible unless formal_acceptance is true.
assertIncludes(route, 'if (verdict !== "PASS") return verdict;', 'formal gate verdict mapper');
assertIncludes(route, 'if (gate.formal_acceptance) return "PASS";', 'formal gate verdict mapper');
assertIncludes(route, 'return "INSUFFICIENT_EVIDENCE"', 'formal gate verdict mapper');
assertIncludes(route, 'return "NEEDS_REVIEW"', 'formal gate verdict mapper');
assertIncludes(route, 'formal_acceptance: formalGate.formal_acceptance', 'acceptance payload');
assertIncludes(route, 'formal_evidence_passed: formalGate.formal_evidence_passed', 'acceptance payload');
assertIncludes(route, 'is_simulated: formalGate.is_simulated', 'acceptance payload');
assertIncludes(route, 'source_lane: formalGate.source_lane', 'acceptance payload');
assertIncludes(route, 'blocking_reasons: formalGate.blocking_reasons', 'acceptance payload');
assertIncludes(route, 'customer_visible_eligible: formalGate.customer_visible_eligible', 'acceptance payload');

// Receipt-only / debug / simulated lanes must be downgraded.
assertIncludes(route, 'FORMAL_EVIDENCE_REQUIRED', 'receipt-only gate');
assertIncludes(route, 'FORMAL_EXECUTION_WINDOW_REQUIRED', 'formal execution gate');
assertIncludes(route, 'SIMULATED_OR_DEBUG_EVIDENCE_NOT_FORMAL', 'simulated evidence gate');
assertIncludes(route, 'FORMAL_OPERATION_SOURCE_LANE_REQUIRED', 'source lane gate');
assertIncludes(route, 'policy.simulated_artifact_count > 0', 'simulated evidence gate');
assertIncludes(route, 'source_lane === "SIMULATED_DEV_ONLY" || source_lane === "DEBUG_ONLY"', 'debug/simulated source lane gate');
assertIncludes(route, 'source_lane === "FORMAL_OPERATION"', 'formal source lane gate');

// Field Memory writes must require formal acceptance and mark formal lane.
assertIncludes(route, 'acceptanceRecord.payload.verdict === "PASS" && acceptanceRecord.payload.formal_acceptance === true', 'field memory formal condition');
assertIncludes(route, 'formal_acceptance_id: acceptanceFactId', 'field memory formal acceptance id');
assertIncludes(route, 'memory_lane: "FORMAL_FIELD_MEMORY"', 'field memory formal lane');
assertIncludes(route, 'trust_level: "FORMAL_ACCEPTED"', 'field memory trust level');
assertIncludes(route, 'source_lane: "FORMAL_OPERATION"', 'field memory source lane');
assertIncludes(route, 'customer_visible_memory: true', 'field memory customer visibility');
assertIncludes(route, 'learning_eligible: true', 'field memory learning eligibility');

// Contract schema must carry hard-gate fields and non-PASS weak verdicts.
assertIncludes(schema, '"NEEDS_REVIEW"', 'acceptance_result_v1 schema');
assertIncludes(schema, '"INSUFFICIENT_EVIDENCE"', 'acceptance_result_v1 schema');
assertIncludes(schema, 'formal_acceptance: z.boolean()', 'acceptance_result_v1 schema');
assertIncludes(schema, 'formal_evidence_passed: z.boolean()', 'acceptance_result_v1 schema');
assertIncludes(schema, 'is_simulated: z.boolean()', 'acceptance_result_v1 schema');
assertIncludes(schema, 'blocking_reasons: z.array', 'acceptance_result_v1 schema');
assertIncludes(schema, 'customer_visible_eligible: z.boolean()', 'acceptance_result_v1 schema');
assertIncludes(schema, 'AcceptanceSourceLaneV1Schema', 'acceptance_result_v1 schema');

// Existing engine/policy should still expose formal evidence and simulated chain metrics.
assertIncludes(engine, 'formal_evidence_count', 'acceptance engine');
assertIncludes(engine, 'simulated_evidence_count', 'acceptance engine');
assertIncludes(engine, 'formal_execution_passed', 'acceptance engine');
assertIncludes(engine, 'non_simulated_chain', 'acceptance engine');
assertIncludes(policy, 'evaluateFormalEvidencePolicyV1', 'formal evidence policy');
assertIncludes(policy, 'formal_evidence_passed', 'formal evidence policy');
assertIncludes(policy, 'SIMULATED_DEV_ONLY', 'formal evidence policy');
assertIncludes(policy, 'DEBUG_ONLY', 'formal evidence policy');

console.log('[formal-acceptance-gate] PASS');
