#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function assert(cond, msg) {
  if (!cond) {
    console.error(`[ACCEPTANCE_STAGE1_TRIGGER_EVIDENCE_GATE_V1] FAIL: ${msg}`);
    process.exit(1);
  }
}
function includesAll(text, xs, label) {
  for (const x of xs) assert(text.includes(x), `${label} missing ${x}`);
}

const boundary = read('apps/server/src/domain/decision/stage1_action_boundary_v1.ts');
const gateRoute = read('apps/server/src/routes/appleii_stage1_evidence_gate_v1.ts');
const summary = read('apps/server/src/projections/field_sensing_summary_stage1_v1.ts');

includesAll(boundary, [
  'FORMAL_STAGE1_ACTION_FIELDS = ["irrigation_effectiveness", "leak_risk"]',
  'FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE',
  'evaluateFormalStage1TriggerGateV1',
  'rawFormalSignalMatches(signals)',
  'collectStage1EvidenceGateReasonCodes',
  'getStage1EvidenceSufficiencyStatus(summaryPayload) !== "PASS"',
  'EVIDENCE_SUFFICIENCY_NOT_PASS',
  'TIME_COVERAGE_MISSING',
  'INSUFFICIENT_SAMPLE_COUNT',
  'TIME_COVERAGE_NOT_PASS',
  'MAX_GAP_EXCEEDED',
  'FRESHNESS_NOT_FRESH',
  'DEVICE_HEALTH_BAD',
  'CONFLICT_STATUS_CONFLICTING',
], 'formal stage1 trigger boundary');

assert(boundary.includes('irrigationEffectiveness === "low" || leakRisk === "high"'), 'raw formal signal must remain irrigation_effectiveness=low OR leak_risk=high');
assert(boundary.includes('if (reasons.length > 0)'), 'formal signal must be gated by evidence reason codes');
assert(boundary.includes('return { status: "NEEDS_EVIDENCE", error: FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE'), 'failed evidence gate must return FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE');
assert(boundary.includes('return { status: "ELIGIBLE", reason_codes: [] }'), 'only fully satisfied evidence gate may become ELIGIBLE');
assert(boundary.includes('coverageRatio == null || coverageRatio < 0.5'), 'coverage不足必须阻断 formal trigger');
assert(boundary.includes('sampleCount == null || sampleCount < 3'), '单点/样本不足必须阻断 formal trigger');
assert(boundary.includes('maxGapMs == null || maxGapMs > allowedMaxGapMs'), 'gap超限必须阻断 formal trigger');
assert(boundary.includes('freshness !== "fresh"'), 'stale 数据只能 NEEDS_EVIDENCE');
assert(boundary.includes('deviceHealthStatus === "BAD"'), 'device_health BAD 必须阻断 formal trigger');
assert(boundary.includes('conflictStatus === "CONFLICTING" || conflictStatus === "UNRESOLVED"'), '多源冲突必须阻断 formal trigger');

includesAll(gateRoute, [
  'registerAppleIIStage1EvidenceGateV1',
  '/api/v1/recommendations/generate',
  'preHandler',
  'evaluateFormalStage1TriggerGateV1(stage1Summary)',
  'gate.status === "NEEDS_EVIDENCE"',
  'error: gate.error ?? FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE',
  'reason_codes: gate.reason_codes',
  'problem_state_v1',
  'uncertainty_envelope_v1',
  'evidence_sufficiency_v1',
  'time_coverage_v1',
  'device_health_snapshot_v1',
  'conflict_detection_v1',
], 'recommendation generate preHandler gate');

assert(!gateRoute.includes('createPrescription'), 'evidence gate must not create prescription');
assert(!gateRoute.includes('operation_plan'), 'evidence gate must not create operation plan');
assert(!gateRoute.includes('act_task'), 'evidence gate must not create AO-ACT task');

includesAll(summary, [
  'time_coverage_v1',
  'evidence_sufficiency_v1',
  'device_health_snapshot_v1',
  'conflict_detection_v1',
  'evidence_sufficiency',
], 'stage1 summary evidence inputs');

console.log('[ACCEPTANCE_STAGE1_TRIGGER_EVIDENCE_GATE_V1] PASSED');
