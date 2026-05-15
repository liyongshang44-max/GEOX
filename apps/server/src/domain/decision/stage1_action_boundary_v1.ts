export const FORMAL_STAGE1_ACTION_FIELDS = ["irrigation_effectiveness", "leak_risk"] as const;

export const SUPPORT_ONLY_STAGE1_FIELDS = ["canopy_temp_status", "evapotranspiration_risk", "sensor_quality_level"] as const;

export const FORBIDDEN_STAGE1_TRIGGER_FIELDS = [
  "fertility_state",
  "salinity_risk_state",
  "canopy_state",
  "water_flow_state",
  "irrigation_need_state",
  "irrigation_need_level",
  "sensor_quality"
] as const;

export const FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE = "FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE" as const;

export type Stage1FormalTriggerGateStatusV1 = "ELIGIBLE" | "NOT_ELIGIBLE" | "NEEDS_EVIDENCE";
export type Stage1FormalTriggerGateV1 = {
  status: Stage1FormalTriggerGateStatusV1;
  error?: typeof FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE;
  reason_codes: string[];
};

export type Stage1FormalActionField = (typeof FORMAL_STAGE1_ACTION_FIELDS)[number];
export type Stage1SupportOnlyField = (typeof SUPPORT_ONLY_STAGE1_FIELDS)[number];
export type Stage1ForbiddenTriggerField = (typeof FORBIDDEN_STAGE1_TRIGGER_FIELDS)[number];

export type Stage1ActionBoundaryNormalizedInputV1 = Partial<Record<Stage1FormalActionField | Stage1SupportOnlyField, unknown>>;
export type Stage1FormalTriggerSignalsV1 = Record<Stage1FormalActionField, unknown>;

const RECOMMENDATION_FORMAL_INPUT_LAYER = "stage1_sensing_summary_v1" as const;

function asRecord(v: unknown): Record<string, any> {
  return v && typeof v === "object" ? v as Record<string, any> : {};
}

function asNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function addReason(out: string[], reason: string): void {
  if (!out.includes(reason)) out.push(reason);
}

export function normalizeStage1RecommendationInput(summaryPayload: unknown): Stage1ActionBoundaryNormalizedInputV1 {
  const summary = asRecord(summaryPayload);
  const output: Stage1ActionBoundaryNormalizedInputV1 = {};
  for (const key of [...FORMAL_STAGE1_ACTION_FIELDS, ...SUPPORT_ONLY_STAGE1_FIELDS]) {
    if (Object.prototype.hasOwnProperty.call(summary, key)) {
      output[key] = summary[key];
    }
  }
  return output;
}

export function assertFormalTriggerInputLayer(sourceKind: unknown): asserts sourceKind is typeof RECOMMENDATION_FORMAL_INPUT_LAYER {
  const normalized = String(sourceKind ?? "").trim();
  if (normalized !== RECOMMENDATION_FORMAL_INPUT_LAYER) {
    throw new Error(`STAGE1_FORMAL_TRIGGER_LAYER_REQUIRED:${RECOMMENDATION_FORMAL_INPUT_LAYER}`);
  }
}

export function assertNoForbiddenTriggerFields(input: unknown): void {
  if (!input || typeof input !== "object") return;
  const data = input as Record<string, unknown>;
  for (const forbidden of FORBIDDEN_STAGE1_TRIGGER_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, forbidden) && data[forbidden] !== undefined) {
      throw new Error(`STAGE1_FORBIDDEN_TRIGGER_FIELD:${forbidden}`);
    }
  }
}

export function deriveFormalTriggerSignalsFromStage1Summary(summaryPayload: unknown): Stage1FormalTriggerSignalsV1 {
  const normalized = normalizeStage1RecommendationInput(summaryPayload);
  assertNoForbiddenTriggerFields(summaryPayload);
  return {
    irrigation_effectiveness: normalized.irrigation_effectiveness,
    leak_risk: normalized.leak_risk,
  };
}

function rawFormalSignalMatches(signals: Stage1FormalTriggerSignalsV1): boolean {
  const irrigationEffectiveness = String(signals.irrigation_effectiveness ?? "").trim().toLowerCase();
  const leakRisk = String(signals.leak_risk ?? "").trim().toLowerCase();
  return irrigationEffectiveness === "low" || leakRisk === "high";
}

export function getStage1EvidenceSufficiencyStatus(summaryPayload: unknown): "PASS" | "NEEDS_EVIDENCE" {
  const summary = asRecord(summaryPayload);
  const direct = String(summary.evidence_sufficiency ?? "").trim().toUpperCase();
  const nested = String(asRecord(summary.evidence_sufficiency_v1).evidence_sufficiency ?? "").trim().toUpperCase();
  return direct === "PASS" || nested === "PASS" ? "PASS" : "NEEDS_EVIDENCE";
}

function collectStage1EvidenceGateReasonCodes(summaryPayload: unknown): string[] {
  const summary = asRecord(summaryPayload);
  const evidence = asRecord(summary.evidence_sufficiency_v1);
  const coverage = asRecord(summary.time_coverage_v1);
  const device = asRecord(summary.device_health_snapshot_v1);
  const conflict = asRecord(summary.conflict_detection_v1);
  const reasons: string[] = Array.isArray(evidence.reason_codes)
    ? evidence.reason_codes.map((x: unknown) => String(x)).filter(Boolean)
    : [];

  if (getStage1EvidenceSufficiencyStatus(summaryPayload) !== "PASS") addReason(reasons, "EVIDENCE_SUFFICIENCY_NOT_PASS");

  const observationWindow = asRecord(coverage.observation_window);
  if (!coverage || Object.keys(coverage).length === 0 || !observationWindow.start_ts_ms || !observationWindow.end_ts_ms) {
    addReason(reasons, "TIME_COVERAGE_MISSING");
  }

  const formalSampleCount = asNumber(coverage.formal_sample_count);
  const formalCoverageRatio = asNumber(coverage.formal_coverage_ratio);
  const formalSourceEligible = coverage.formal_source_eligible === true;
  const maxGapMs = asNumber(coverage.max_gap_ms);
  const expectedIntervalMs = asNumber(coverage.expected_sample_interval_ms);
  const allowedMaxGapMs = Math.max((expectedIntervalMs ?? 30 * 60 * 1000) * 2, 60 * 60 * 1000);
  if (formalSampleCount == null || formalSampleCount < 3) addReason(reasons, "INSUFFICIENT_FORMAL_SAMPLE_COUNT");
  if (formalCoverageRatio == null || formalCoverageRatio < 0.5) addReason(reasons, "INSUFFICIENT_FORMAL_COVERAGE_RATIO");
  if (!formalSourceEligible) addReason(reasons, "FORMAL_SOURCE_NOT_ELIGIBLE");
  if (maxGapMs == null || maxGapMs > allowedMaxGapMs) addReason(reasons, "MAX_GAP_EXCEEDED");

  const freshness = String(coverage.freshness ?? summary.freshness ?? "").trim().toLowerCase();
  if (freshness !== "fresh") addReason(reasons, "FRESHNESS_NOT_FRESH");

  const deviceHealthStatus = String(device.device_health_status ?? "").trim().toUpperCase();
  if (deviceHealthStatus === "BAD") addReason(reasons, "DEVICE_HEALTH_BAD");
  if (deviceHealthStatus === "OFFLINE") addReason(reasons, "DEVICE_HEALTH_OFFLINE");

  const conflictStatus = String(conflict.conflict_status ?? "").trim().toUpperCase();
  if (conflictStatus === "CONFLICTING" || conflictStatus === "UNRESOLVED") addReason(reasons, "CONFLICT_STATUS_CONFLICTING");

  return reasons;
}

export function evaluateFormalStage1TriggerGateV1(summaryPayload: unknown): Stage1FormalTriggerGateV1 {
  const signals = deriveFormalTriggerSignalsFromStage1Summary(summaryPayload);
  if (!rawFormalSignalMatches(signals)) {
    return { status: "NOT_ELIGIBLE", reason_codes: ["NO_FORMAL_STAGE1_SIGNAL"] };
  }
  const reasons = collectStage1EvidenceGateReasonCodes(summaryPayload);
  if (reasons.length > 0) {
    return { status: "NEEDS_EVIDENCE", error: FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE, reason_codes: reasons };
  }
  return { status: "ELIGIBLE", reason_codes: [] };
}

export function isFormalStage1TriggerEligible(signals: Stage1FormalTriggerSignalsV1): boolean {
  return rawFormalSignalMatches(signals);
}
