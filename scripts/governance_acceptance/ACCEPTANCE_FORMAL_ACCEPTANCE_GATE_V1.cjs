#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const files = {
  route: path.join(root, 'apps/server/src/routes/acceptance_v1.ts'),
  minimumChainTest: path.join(root, 'apps/server/src/routes/acceptance_v1_minimum_chain.test.ts'),
  engine: path.join(root, 'apps/server/src/domain/acceptance/engine_v1.ts'),
  evidencePolicy: path.join(root, 'apps/server/src/domain/evidence/formal_evidence_policy_v1.ts'),
  schema: path.join(root, 'packages/contracts/src/schema/acceptance_result_v1.ts'),
};

function read(file) { return fs.readFileSync(file, 'utf8'); }
function fail(message) { console.error(`[formal-acceptance-gate] FAIL: ${message}`); process.exit(1); }
function assert(condition, message) { if (!condition) fail(message); }
function assertIncludes(source, needle, label) { assert(source.includes(needle), `${label} must include ${needle}`); }
function assertNotIncludes(source, needle, label) { assert(!source.includes(needle), `${label} must not include ${needle}`); }

const route = read(files.route);
const minimumChainTest = read(files.minimumChainTest);
const engine = read(files.engine);
const policy = read(files.evidencePolicy);
const schema = read(files.schema);

// Acceptance route must build and apply a hard formal gate before writing acceptance_result_v1.
assertIncludes(route, 'evidencePolicyFromReceiptV1', 'acceptance route');
assertIncludes(route, 'buildFormalAcceptanceGateV1', 'acceptance route');
assertIncludes(route, 'applyFormalAcceptanceGateV1', 'acceptance route');
assertIncludes(route, 'const formalGate = buildFormalAcceptanceGateV1(receiptFact.record_json ?? {}, executionJudge, taskPayload.action_type)', 'acceptance route');
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
assertIncludes(route, 'receipt_structure_passed: formalGate.receipt_structure_passed', 'acceptance payload');
assertIncludes(route, 'execution_evidence_passed: formalGate.execution_evidence_passed', 'acceptance payload');
assertIncludes(route, 'execution_effect_passed: formalGate.execution_effect_passed', 'acceptance payload');
assertIncludes(route, 'formal_execution_passed: formalGate.formal_execution_passed', 'acceptance payload');
assertIncludes(route, 'is_simulated: formalGate.is_simulated', 'acceptance payload');
assertIncludes(route, 'source_lane: formalGate.source_lane', 'acceptance payload');
assertIncludes(route, 'blocking_reasons: formalGate.blocking_reasons', 'acceptance payload');
assertIncludes(route, 'customer_visible_eligible: formalGate.customer_visible_eligible', 'acceptance payload');

// Formal execution must be split into receipt structure, execution evidence, and execution effect evidence.
assertIncludes(route, 'receipt_structure_passed: boolean', 'formal gate type split');
assertIncludes(route, 'execution_evidence_passed: boolean', 'formal gate type split');
assertIncludes(route, 'execution_effect_passed: boolean', 'formal gate type split');
assertIncludes(route, 'const receipt_structure_passed = hasReceiptCompletenessSkillPass', 'receipt structure split');
assertIncludes(route, 'const execution_evidence_passed = executionJudgePassed || formalExecutionEvidencePassed', 'execution evidence split');
assertIncludes(route, 'const execution_effect_passed = hasFormalExecutionEffectEvidenceV1', 'execution effect split');
assertIncludes(route, 'const formal_execution_passed = execution_evidence_passed === true && (execution_effect_passed === true || effectRequired === false)', 'formal execution split rule');
assertNotIncludes(route, 'const formal_execution_passed = executionJudgePassed || receiptCompletenessSkillPassed || formalExecutionEvidencePassed', 'receipt completeness must not satisfy formal execution');
assertNotIncludes(route, 'formal_execution_passed = executionJudgePassed || receiptCompletenessSkillPassed', 'receipt completeness must not satisfy formal execution');
assertIncludes(route, 'RECEIPT_STRUCTURE_ONLY_NOT_FORMAL_EXECUTION', 'receipt structure only downgrade reason');
assertIncludes(route, 'FORMAL_EXECUTION_EVIDENCE_REQUIRED', 'formal execution evidence missing reason');
assertIncludes(route, 'FORMAL_EXECUTION_EFFECT_EVIDENCE_REQUIRED', 'formal execution effect missing reason');
assertIncludes(route, 'FORMAL_EXECUTION_REQUIRED', 'formal execution aggregate missing reason');
assertIncludes(route, 'actionRequiresExecutionEffectV1', 'action-specific effect requirement');

// Formal execution evidence/effect markers must be explicit execution or effect signals, not execution_time alone.
assertNotIncludes(route, 'function hasExecutionWindow', 'acceptance route');
assertNotIncludes(route, 'FORMAL_EXECUTION_WINDOW_REQUIRED', 'acceptance route');
assertIncludes(route, 'hasExecutionJudgePass', 'formal execution evidence gate');
assertIncludes(route, 'hasReceiptCompletenessSkillPass', 'receipt structure gate');
assertIncludes(route, 'hasFormalExecutionEvidenceV1', 'formal execution evidence gate');
assertIncludes(route, 'hasFormalExecutionEffectEvidenceV1', 'formal execution effect evidence gate');
assertIncludes(route, 'water_delivery_receipt', 'formal delivery evidence markers');
assertIncludes(route, 'in_field_trajectory', 'formal trajectory evidence markers');
assertIncludes(route, 'coverage_evidence', 'formal coverage evidence markers');
assertIncludes(route, 'as_applied', 'formal as-applied evidence markers');
assertIncludes(route, 'meter_reading', 'formal meter evidence markers');
assertIncludes(route, 'post_effect', 'formal post-effect evidence markers');
assertIncludes(route, 'soil_moisture_delta', 'formal post-effect evidence markers');

// Receipt-only / debug / simulated lanes must be downgraded.
assertIncludes(route, 'FORMAL_EVIDENCE_REQUIRED', 'receipt-only gate');
assertIncludes(route, 'SIMULATED_OR_DEBUG_EVIDENCE_NOT_FORMAL', 'simulated evidence gate');
assertIncludes(route, 'FORMAL_OPERATION_SOURCE_LANE_REQUIRED', 'source lane gate');
assertIncludes(route, 'policy.simulated_artifact_count > 0', 'simulated evidence gate');
assertIncludes(route, 'source_lane === "SIMULATED_DEV_ONLY" || source_lane === "DEBUG_ONLY"', 'debug/simulated source lane gate');
assertIncludes(route, 'source_lane === "FORMAL_OPERATION"', 'formal source lane gate');

// Minimum chain test must no longer claim dispatch_ack + execution_time can PASS.
assertIncludes(minimumChainTest, 'dispatch_ack and execution_time exist', 'minimum chain test');
assertIncludes(minimumChainTest, 'assert.notEqual(body.verdict, "PASS")', 'minimum chain test');
assertIncludes(minimumChainTest, 'formal_acceptance, false', 'minimum chain test');
assertIncludes(minimumChainTest, 'customer_visible_eligible, false', 'minimum chain test');
assertIncludes(minimumChainTest, 'formal_execution_passed, 0', 'minimum chain test');

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
assertIncludes(schema, 'receipt_structure_passed: z.boolean().optional()', 'acceptance_result_v1 schema');
assertIncludes(schema, 'execution_evidence_passed: z.boolean().optional()', 'acceptance_result_v1 schema');
assertIncludes(schema, 'execution_effect_passed: z.boolean().optional()', 'acceptance_result_v1 schema');
assertIncludes(schema, 'formal_execution_passed: z.boolean()', 'acceptance_result_v1 schema');
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

const fixture = String.raw`
(async () => {
const { buildFormalAcceptanceGateV1, applyFormalAcceptanceGateV1 } = await import('./src/routes/acceptance_v1.ts');
function assertRuntime(condition, message) { if (!condition) throw new Error(message); }
const receiptStructureOnly = {
  payload: {
    source: 'device',
    action_type: 'IRRIGATE',
    receipt_completeness: { kind: 'receipt_completeness', status: 'PASS' },
    artifact_refs: [{ kind: 'image', artifact_id: 'formal_img_1', source_lane: 'FORMAL_OPERATION', formal_eligible: true, evidence_level: 'FORMAL' }],
  }
};
const gateA = buildFormalAcceptanceGateV1(receiptStructureOnly, null, 'IRRIGATE');
assertRuntime(gateA.receipt_structure_passed === true, 'case A receipt_structure_passed must be true');
assertRuntime(gateA.execution_evidence_passed === false, 'case A execution_evidence_passed must be false');
assertRuntime(gateA.formal_execution_passed === false, 'case A formal_execution_passed must be false');
assertRuntime(gateA.formal_acceptance === false, 'case A formal_acceptance must be false');
assertRuntime(applyFormalAcceptanceGateV1('PASS', gateA) !== 'PASS', 'case A verdict must not PASS');
assertRuntime(gateA.blocking_reasons.includes('RECEIPT_STRUCTURE_ONLY_NOT_FORMAL_EXECUTION'), 'case A must include receipt-structure-only blocking reason');
const formalReceipt = {
  payload: {
    source: 'device',
    action_type: 'IRRIGATE',
    artifact_refs: [
      { kind: 'water_delivery_receipt', artifact_id: 'formal_delivery_1', source_lane: 'FORMAL_OPERATION', formal_eligible: true, evidence_level: 'FORMAL' },
      { kind: 'soil_moisture_delta', artifact_id: 'formal_effect_1', source_lane: 'FORMAL_OPERATION', formal_eligible: true, evidence_level: 'FORMAL' },
    ],
  }
};
const gateB = buildFormalAcceptanceGateV1(formalReceipt, null, 'IRRIGATE');
assertRuntime(gateB.formal_evidence_passed === true, 'case B formal evidence must pass');
assertRuntime(gateB.execution_evidence_passed === true, 'case B execution evidence must pass');
assertRuntime(gateB.execution_effect_passed === true, 'case B execution effect must pass');
assertRuntime(gateB.formal_execution_passed === true, 'case B formal execution must pass');
assertRuntime(gateB.formal_acceptance === true, 'case B formal acceptance must pass');
assertRuntime(applyFormalAcceptanceGateV1('PASS', gateB) === 'PASS', 'case B verdict may PASS');
const simulatedReceipt = {
  payload: {
    source: 'flight_table_dev',
    action_type: 'IRRIGATE',
    artifact_refs: [{ kind: 'water_delivery_receipt', artifact_id: 'flight-table-delivery', source_lane: 'SIMULATED_DEV_ONLY', formal_eligible: false, evidence_level: 'DEBUG', is_simulated: true }],
  }
};
const gateC = buildFormalAcceptanceGateV1(simulatedReceipt, { verdict: 'PASS' }, 'IRRIGATE');
assertRuntime(gateC.source_lane === 'SIMULATED_DEV_ONLY' || gateC.is_simulated === true, 'case C must be simulated/dev lane');
assertRuntime(gateC.formal_acceptance === false, 'case C formal acceptance must be false');
assertRuntime(applyFormalAcceptanceGateV1('PASS', gateC) !== 'PASS', 'case C verdict must not PASS');
})();
`;
const runtime = spawnSync('pnpm', ['--filter', '@geox/server', 'exec', 'tsx', '-e', fixture], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (runtime.status !== 0) { process.stderr.write(runtime.stdout || ''); process.stderr.write(runtime.stderr || ''); fail('runtime fixture failed'); }

console.log('[formal-acceptance-gate] PASS');
