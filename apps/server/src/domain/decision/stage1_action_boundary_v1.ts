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

export type Stage1ActionBoundaryDebugV1 = {
  stage1_summary_id: string | null;
  evidence_sufficiency: unknown;
  time_coverage: unknown;
  formal_sample_count: number | null;
  formal_coverage_ratio: number | null;
  max_gap_ms: number | null;
  freshness: string | null;
  device_health_status: string | null;
  conflict_status: string | null;
  trigger_metric_evidence: unknown;
  reason_codes: string[];
};

export type Stage1FormalActionField = (typeof FORMAL_STAGE1_ACTION_FIELDS)[number];
export type Stage1SupportOnlyField = (typeof SUPPORT_ONLY_STAGE1_FIELDS)[number];
export type Stage1ForbiddenTriggerField = (typeof FORBIDDEN_STAGE1_TRIGGER_FIELDS)[number];

export type Stage1ActionBoundaryNormalizedInputV1 = Partial<Record<Stage1FormalActionField | Stage1SupportOnlyField, unknown>>;
export type Stage1FormalTriggerSignalsV1 = Record<Stage1FormalActionField, unknown>;

const RECOMMENDATION_FORMAL_INPUT_LAYER = "stage1_sensing_summary_v1" as const;
const STAGE1_SUMMARY_ATTACHMENT = Symbol.for("geox.stage1_summary_payload_v1");

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

function upper(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function containsDevMarker(value: unknown): boolean {
  const raw = JSON.stringify(value ?? "").toLowerCase();
  return raw.includes("simulated_dev_only")
    || raw.includes("device_simulator_v1")
    || raw.includes("flight_table")
    || raw.includes("flight-table")
    || raw.includes("irrigation_simulator")
    || raw.includes("sim_trace")
    || raw.includes("debug_only");
}

function attachStage1SummaryToSignals(signals: Stage1FormalTriggerSignalsV1, summaryPayload: unknown): Stage1FormalTriggerSignalsV1 {
  Object.defineProperty(signals, STAGE1_SUMMARY_ATTACHMENT, {
    value: summaryPayload,
    enumerable: false,
    configurable: false,
  });
  return signals;
}

function getAttachedStage1Summary(signals: Stage1FormalTriggerSignalsV1): unknown | null {
  return (signals as any)?.[STAGE1_SUMMARY_ATTACHMENT] ?? null;
}

export function isSimulatedStage1SummaryV1(summaryPayload: unknown): boolean {
  const summary = asRecord(summaryPayload);
  const coverage = asRecord(summary.time_coverage_v1);
  const evidence = asRecord(summary.evidence_sufficiency_v1);
  const device = asRecord(summary.device_health_snapshot_v1);
  const sourceLane = upper(summary.source_lane ?? summary.lane ?? summary.trust_lane ?? coverage.source_lane ?? evidence.source_lane);
  const evidenceLevel = upper(summary.evidence_level ?? coverage.evidence_level ?? evidence.evidence_level);
  const devSource = upper(summary.dev_source ?? coverage.dev_source ?? evidence.dev_source ?? device.dev_source);
  return summary.is_simulated === true
    || coverage.is_simulated === true
    || evidence.is_simulated === true
    || device.is_simulated === true
    || summary.formal_eligible === false
    || coverage.formal_eligible === false
    || evidence.formal_eligible === false
    || sourceLane === "SIMULATED_DEV_ONLY"
    || sourceLane === "DEBUG_ONLY"
    || evidenceLevel === "DEBUG"
    || devSource.includes("SIMULATOR")
    || devSource.includes("FLIGHT_TABLE")
    || containsDevMarker(summaryPayload);
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
  return attachStage1SummaryToSignals({
    irrigation_effectiveness: normalized.irrigation_effectiveness,
    leak_risk: normalized.leak_risk,
  }, summaryPayload);
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
  const triggerMetricEvidence = asRecord(coverage.trigger_metric_evidence);
  const reasons: string[] = Array.isArray(evidence.reason_codes)
    ? evidence.reason_codes.map((x: unknown) => String(x)).filter(Boolean)
    : [];

  if (isSimulatedStage1SummaryV1(summaryPayload)) addReason(reasons, "SIMULATED_STAGE1_SUMMARY_NOT_FORMAL_TRIGGER");
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

  const signals = deriveFormalTriggerSignalsFromStage1Summary(summaryPayload);
  if (String(signals.irrigation_effectiveness ?? "").trim().toLowerCase() === "low" && triggerMetricEvidence.irrigation_effectiveness !== true) {
    addReason(reasons, "MISSING_IRRIGATION_EFFECTIVENESS_METRIC_EVIDENCE");
  }
  if (String(signals.leak_risk ?? "").trim().toLowerCase() === "high" && triggerMetricEvidence.leak_risk !== true) {
    addReason(reasons, "MISSING_LEAK_RISK_METRIC_EVIDENCE");
  }

  const freshness = String(coverage.freshness ?? summary.freshness ?? "").trim().toLowerCase();
  if (freshness !== "fresh") addReason(reasons, "FRESHNESS_NOT_FRESH");

  const deviceHealthStatus = String(device.device_health_status ?? "").trim().toUpperCase();
  if (deviceHealthStatus === "UNKNOWN") addReason(reasons, "DEVICE_HEALTH_UNKNOWN");
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

export function buildStage1ActionBoundaryDebugV1(summaryPayload: unknown): Stage1ActionBoundaryDebugV1 {
  const summary = asRecord(summaryPayload);
  const coverage = asRecord(summary.time_coverage_v1);
  const device = asRecord(summary.device_health_snapshot_v1);
  const conflict = asRecord(summary.conflict_detection_v1);
  const gate = evaluateFormalStage1TriggerGateV1(summaryPayload);
  const stage1SummaryId = String(summary.stage1_summary_id ?? summary.summary_id ?? summary.fact_id ?? "").trim();
  return {
    stage1_summary_id: stage1SummaryId || null,
    evidence_sufficiency: summary.evidence_sufficiency ?? asRecord(summary.evidence_sufficiency_v1).evidence_sufficiency ?? null,
    time_coverage: coverage,
    formal_sample_count: asNumber(coverage.formal_sample_count),
    formal_coverage_ratio: asNumber(coverage.formal_coverage_ratio),
    max_gap_ms: asNumber(coverage.max_gap_ms),
    freshness: String(coverage.freshness ?? summary.freshness ?? "").trim() || null,
    device_health_status: String(device.device_health_status ?? "").trim() || null,
    conflict_status: String(conflict.conflict_status ?? "").trim() || null,
    trigger_metric_evidence: coverage.trigger_metric_evidence ?? null,
    reason_codes: gate.reason_codes,
  };
}

export function isFormalStage1TriggerEligible(signals: Stage1FormalTriggerSignalsV1): boolean {
  const attachedSummary = getAttachedStage1Summary(signals);
  if (attachedSummary != null) {
    return evaluateFormalStage1TriggerGateV1(attachedSummary).status === "ELIGIBLE";
  }
  return rawFormalSignalMatches(signals);
}