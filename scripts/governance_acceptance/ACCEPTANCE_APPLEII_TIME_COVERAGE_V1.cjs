#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function assert(cond, msg) {
  if (!cond) {
    console.error(`[ACCEPTANCE_APPLEII_TIME_COVERAGE_V1] FAIL: ${msg}`);
    process.exit(1);
  }
}
function includesAll(text, xs, label) {
  for (const x of xs) assert(text.includes(x), `${label} missing ${x}`);
}

const builder = read('apps/server/src/domain/sensing/appleii_evidence_sufficiency_v1.ts');
const summary = read('apps/server/src/projections/field_sensing_summary_stage1_v1.ts');
const boundary = read('apps/server/src/domain/decision/stage1_action_boundary_v1.ts');
const gateRoute = read('apps/server/src/routes/appleii_stage1_evidence_gate_v1.ts');
const decisionModule = read('apps/server/src/modules/decision/registerDecisionModule.ts');
const refresh = read('apps/server/src/services/field_read_model_refresh_v1.ts');
const migration = read('apps/server/db/migrations/2026_05_15_appleii_time_coverage_v1.sql');

includesAll(builder, [
  'AppleIITimeCoverageV1',
  'AppleIIEvidenceSufficiencyV1',
  'AppleIIDeviceHealthSnapshotV1',
  'AppleIIConflictDetectionV1',
  'observation_window',
  'start_ts_ms',
  'end_ts_ms',
  'coverage_ratio',
  'sample_count',
  'gap_count',
  'max_gap_ms',
  'expected_sample_interval_ms',
  'freshness',
  'device_health_status',
  'sensor_drift_status',
  'conflict_status',
  'evidence_sufficiency',
  'NEEDS_EVIDENCE',
  'PASS',
], 'builder core object contract');

includesAll(builder, [
  'if (sorted.length === 1)',
  'coveredMs = 0',
  'INSUFFICIENT_SAMPLE_COUNT',
  'INSUFFICIENT_COVERAGE_RATIO',
  'MAX_GAP_EXCEEDED',
  'STALE_OR_UNKNOWN_FRESHNESS',
  'DEVICE_HEALTH_NOT_GOOD',
  'UNRESOLVED_SENSOR_CONFLICT',
  'SENSOR_DRIFTING',
  'device_health_status === "OFFLINE"',
  'device_health_status === "BAD"',
  'conflict_status: conflictingMetricCount > 0 ? "UNRESOLVED" : "NONE"',
], 'builder negative conditions');

assert(builder.includes('timeCoverage.sample_count < minSampleCount'), 'single point or insufficient sample count must fail sufficiency');
assert(builder.includes('timeCoverage.coverage_ratio < minCoverageRatio'), 'coverage ratio must gate sufficiency');
assert(builder.includes('timeCoverage.max_gap_ms > maxAllowedGapMs'), 'max gap must gate sufficiency');
assert(builder.includes('return {\n    evidence_sufficiency: reasonCodes.length ? "NEEDS_EVIDENCE" : "PASS"'), 'evidence sufficiency must collapse failures to NEEDS_EVIDENCE');

includesAll(summary, [
  'time_coverage_v1: AppleIITimeCoverageV1',
  'evidence_sufficiency_v1: AppleIIEvidenceSufficiencyV1',
  'device_health_snapshot_v1: AppleIIDeviceHealthSnapshotV1',
  'conflict_detection_v1: AppleIIConflictDetectionV1',
  'evidence_sufficiency: AppleIIEvidenceSufficiencyStatusV1',
  'buildAppleIIEvidenceSufficiencyV1',
  'time_coverage_v1 jsonb NOT NULL DEFAULT',
  'evidence_sufficiency_v1 jsonb NOT NULL DEFAULT',
  'device_health_snapshot_v1 jsonb NOT NULL DEFAULT',
  'conflict_detection_v1 jsonb NOT NULL DEFAULT',
  "evidence_sufficiency text NOT NULL DEFAULT 'NEEDS_EVIDENCE'",
], 'stage1 summary projection');

includesAll(boundary, [
  'Stage1FormalTriggerGateStatusV1 = "ELIGIBLE" | "NOT_ELIGIBLE" | "NEEDS_EVIDENCE"',
  'getStage1EvidenceSufficiencyStatus',
  'evaluateFormalStage1TriggerGateV1',
  'EVIDENCE_SUFFICIENCY_NOT_PASS',
  'if (getStage1EvidenceSufficiencyStatus(summaryPayload) !== "PASS")',
  'return { status: "NEEDS_EVIDENCE"',
], 'formal trigger evidence gate');

includesAll(gateRoute, [
  'registerAppleIIStage1EvidenceGateV1',
  'preHandler',
  '/api/v1/recommendations/generate',
  'refreshFieldReadModelsWithObservabilityV1',
  'evaluateFormalStage1TriggerGateV1',
  'gate.status === "NEEDS_EVIDENCE"',
  'FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE',
  'error: gate.error ?? FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE',
  'evidence_sufficiency_v1',
  'time_coverage_v1',
  'device_health_snapshot_v1',
  'conflict_detection_v1',
], 'recommendation generate evidence gate route');

includesAll(decisionModule, [
  'registerAppleIIStage1EvidenceGateV1',
  'registerAppleIIStage1EvidenceGateV1(app, pool)',
  'registerDecisionEngineV1Routes(app, pool)',
], 'decision module registration');
assert(decisionModule.indexOf('registerAppleIIStage1EvidenceGateV1(app, pool)') < decisionModule.indexOf('registerDecisionEngineV1Routes(app, pool)'), 'Apple II gate must register before decision engine routes');

includesAll(refresh, [
  'device_id?: string | null',
  'summaryBase',
  'device_id: params.device_id ?? null',
  'refreshFieldSensingSummaryStage1V1(db, summaryBase)',
], 'field read model refresh device context');

includesAll(migration, [
  'CREATE TABLE IF NOT EXISTS field_sensing_summary_stage1_v1',
  'time_coverage_v1 jsonb',
  'evidence_sufficiency_v1 jsonb',
  'device_health_snapshot_v1 jsonb',
  'conflict_detection_v1 jsonb',
  'evidence_sufficiency text',
  "CHECK (evidence_sufficiency IN ('PASS','NEEDS_EVIDENCE'))",
], 'migration');

console.log('[ACCEPTANCE_APPLEII_TIME_COVERAGE_V1] PASSED');
