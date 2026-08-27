import {
  canonicalObservationV1Schema,
  evidenceQualificationV1Schema,
  type CanonicalObservationV1,
  type EvidenceQualificationV1,
  type EvidenceScopeV1,
} from "../contracts/canonical_evidence_v1.js";
import type { RawSampleObservationQualityDecisionV1 } from "./raw_sample_measurement_quality_v1.js";
import type { RawSampleStage1PhysicalQcDecisionV1 } from "./raw_sample_stage1_physical_qc_v1.js";

export const STAGE1_FORMAL_EVIDENCE_ROLE_V1 = "STAGE1_FORMAL_EVIDENCE" as const;

export type RawSampleProjectionSourceV1 =
  | "device"
  | "gateway"
  | "system"
  | "human"
  | "import"
  | "sim"
  | "unknown";

export type RawSampleCanonicalProjectionInputV1 = {
  sample: {
    sample_id: string;
    sensor_id: string;
    ts_ms: number;
    metric: string;
    value: number;
    source: RawSampleProjectionSourceV1;
    payload_json: Record<string, any>;
    created_at?: string | Date | null;
  };
  decision_time_ms: number;
  requested_scope: {
    tenant_id: string;
    project_id?: string | null;
    group_id?: string | null;
    field_id: string;
  };
  source_formal_eligible: boolean;
  quality_decision: RawSampleObservationQualityDecisionV1;
  physical_qc_decision: RawSampleStage1PhysicalQcDecisionV1;
  conflict_state: "NONE" | "UNRESOLVED" | "UNKNOWN";
  device_transport_health: "GOOD" | "DEGRADED" | "FAILED" | "UNKNOWN";
};

export type RawSampleCanonicalProjectionV1 =
  | {
      status: "PROJECTED";
      observation: CanonicalObservationV1;
      qualification: EvidenceQualificationV1;
    }
  | {
      status: "OMITTED";
      sample_id: string;
      reason_code:
        | "CANONICAL_PROJECTION_MISSING_CREATED_AT"
        | "CANONICAL_PROJECTION_INVALID_CREATED_AT"
        | "CANONICAL_PROJECTION_INVALID_OBSERVED_AT";
    };

export type RawSampleCanonicalEvidenceProjectionBatchV1 = {
  schema_version: "raw_sample_canonical_evidence_projection_v1";
  projection_mode: "SHADOW";
  observations: CanonicalObservationV1[];
  qualifications: EvidenceQualificationV1[];
  omissions: Array<{
    sample_id: string;
    reason_code:
      | "CANONICAL_PROJECTION_MISSING_CREATED_AT"
      | "CANONICAL_PROJECTION_INVALID_CREATED_AT"
      | "CANONICAL_PROJECTION_INVALID_OBSERVED_AT";
  }>;
};

function toIso(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const date = new Date(ms);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function createdAtMs(value: unknown): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "string" && value.trim()) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function payloadString(payload: Record<string, any>, key: string): string | null {
  const value = String(payload?.[key] ?? "").trim();
  return value ? value : null;
}

function sampleScope(input: RawSampleCanonicalProjectionInputV1): EvidenceScopeV1 {
  const payload = input.sample.payload_json ?? {};
  return {
    tenant_id: payloadString(payload, "tenant_id"),
    project_id: payloadString(payload, "project_id"),
    group_id: payloadString(payload, "group_id"),
    field_id: payloadString(payload, "field_id"),
    season_id: payloadString(payload, "season_id"),
    zone_id: payloadString(payload, "zone_id"),
  };
}

function spatialAuthority(
  scope: EvidenceScopeV1,
  requested: RawSampleCanonicalProjectionInputV1["requested_scope"],
): "EXACT_SCOPE" | "LIMITED" | "OUT_OF_SCOPE" | "UNKNOWN" {
  if (scope.tenant_id == null || scope.field_id == null) return "UNKNOWN";
  if (scope.tenant_id !== requested.tenant_id || scope.field_id !== requested.field_id) return "OUT_OF_SCOPE";

  if (requested.project_id != null) {
    if (scope.project_id == null) return "UNKNOWN";
    if (scope.project_id !== requested.project_id) return "OUT_OF_SCOPE";
  }
  if (requested.group_id != null) {
    if (scope.group_id == null) return "UNKNOWN";
    if (scope.group_id !== requested.group_id) return "OUT_OF_SCOPE";
  }

  if (requested.project_id == null || requested.group_id == null) return "LIMITED";
  return "EXACT_SCOPE";
}

function temporalEligibility(
  observedAtMs: number,
  availableAtMs: number,
  decisionTimeMs: number,
): "ELIGIBLE" | "FUTURE_RELATIVE_TO_DECISION" | "NOT_AVAILABLE_AT_DECISION" | "UNKNOWN" {
  if (!Number.isFinite(decisionTimeMs) || decisionTimeMs <= 0) return "UNKNOWN";
  if (observedAtMs > decisionTimeMs) return "FUTURE_RELATIVE_TO_DECISION";
  if (availableAtMs > decisionTimeMs) return "NOT_AVAILABLE_AT_DECISION";
  return "ELIGIBLE";
}

function physicalValidity(
  decision: RawSampleStage1PhysicalQcDecisionV1,
): "PASS" | "FAIL" | "UNKNOWN" {
  if (decision.mode === "QUALIFIED") return "PASS";
  if (decision.mode === "INELIGIBLE_INVALID") return "FAIL";
  return "UNKNOWN";
}

function measurementHealth(
  quality: RawSampleObservationQualityDecisionV1,
  physical: RawSampleStage1PhysicalQcDecisionV1,
): "VALID" | "SUSPECT" | "INVALID" | "UNKNOWN" {
  if (quality.reason_code === "RAW_SAMPLE_QC_BAD" || physical.mode === "INELIGIBLE_INVALID") return "INVALID";
  if (quality.reason_code === "RAW_SAMPLE_QC_SUSPECT") return "SUSPECT";
  if (quality.reason_code === "RAW_SAMPLE_QC_OK" && physical.mode === "QUALIFIED") return "VALID";
  return "UNKNOWN";
}

function roleDecision(input: {
  source_formal_eligible: boolean;
  quality: RawSampleObservationQualityDecisionV1;
  physical: "PASS" | "FAIL" | "UNKNOWN";
  temporal: "ELIGIBLE" | "FUTURE_RELATIVE_TO_DECISION" | "NOT_AVAILABLE_AT_DECISION" | "UNKNOWN";
  spatial: "EXACT_SCOPE" | "LIMITED" | "OUT_OF_SCOPE" | "UNKNOWN";
  conflict: "NONE" | "UNRESOLVED" | "UNKNOWN";
  device_transport_health: "GOOD" | "DEGRADED" | "FAILED" | "UNKNOWN";
}): {
  eligibility: "ELIGIBLE" | "LIMITED" | "INELIGIBLE" | "UNKNOWN";
  evidence_authority: "QUALIFIED" | "LIMITED" | "INELIGIBLE" | "UNKNOWN";
  reason_codes: string[];
} {
  const reasons: string[] = [];

  if (!input.source_formal_eligible) reasons.push("SOURCE_NOT_FORMAL_ELIGIBLE");
  if (!input.quality.observation_pipeline_eligible) reasons.push(input.quality.reason_code);
  if (input.physical === "FAIL") reasons.push("PHYSICAL_VALIDITY_FAIL");
  if (input.temporal !== "ELIGIBLE") reasons.push(`TEMPORAL_${input.temporal}`);
  if (input.spatial === "OUT_OF_SCOPE") reasons.push("SPATIAL_OUT_OF_SCOPE");
  if (input.conflict === "UNRESOLVED") reasons.push("CONFLICT_UNRESOLVED");
  if (input.device_transport_health === "FAILED") reasons.push("DEVICE_TRANSPORT_FAILED");

  const hardIneligible =
    !input.source_formal_eligible ||
    !input.quality.observation_pipeline_eligible ||
    input.physical === "FAIL" ||
    input.temporal === "FUTURE_RELATIVE_TO_DECISION" ||
    input.temporal === "NOT_AVAILABLE_AT_DECISION" ||
    input.spatial === "OUT_OF_SCOPE" ||
    input.conflict === "UNRESOLVED" ||
    input.device_transport_health === "FAILED";

  if (hardIneligible) {
    return {
      eligibility: "INELIGIBLE",
      evidence_authority: "INELIGIBLE",
      reason_codes: reasons,
    };
  }

  const limited =
    input.quality.reason_code === "RAW_SAMPLE_QC_SUSPECT" ||
    input.physical === "UNKNOWN" ||
    input.temporal === "UNKNOWN" ||
    input.spatial === "LIMITED" ||
    input.spatial === "UNKNOWN" ||
    input.conflict === "UNKNOWN" ||
    input.device_transport_health === "DEGRADED";

  if (limited) {
    if (input.quality.reason_code === "RAW_SAMPLE_QC_SUSPECT") reasons.push("MEASUREMENT_QUALITY_SUSPECT");
    if (input.physical === "UNKNOWN") reasons.push("PHYSICAL_VALIDITY_UNKNOWN");
    if (input.temporal === "UNKNOWN") reasons.push("TEMPORAL_AUTHORITY_UNKNOWN");
    if (input.spatial === "LIMITED") reasons.push("SPATIAL_AUTHORITY_LIMITED");
    if (input.spatial === "UNKNOWN") reasons.push("SPATIAL_AUTHORITY_UNKNOWN");
    if (input.conflict === "UNKNOWN") reasons.push("CONFLICT_STATE_UNKNOWN");
    if (input.device_transport_health === "DEGRADED") reasons.push("DEVICE_TRANSPORT_DEGRADED");
    return {
      eligibility: "LIMITED",
      evidence_authority: "LIMITED",
      reason_codes: reasons,
    };
  }

  if (input.device_transport_health === "UNKNOWN") {
    reasons.push("DEVICE_TRANSPORT_UNKNOWN");
    return {
      eligibility: "UNKNOWN",
      evidence_authority: "UNKNOWN",
      reason_codes: reasons,
    };
  }

  return {
    eligibility: "ELIGIBLE",
    evidence_authority: "QUALIFIED",
    reason_codes: reasons,
  };
}

/**
 * B-04d3 shadow projection only.
 *
 * This function does not reclassify source, physical QC, caller quality, conflict
 * or device health. It maps decisions already made by the existing B-04 seams
 * into the B-03 CanonicalObservationV1 + EvidenceQualificationV1 contracts.
 */
export function projectRawSampleCanonicalEvidenceV1(
  input: RawSampleCanonicalProjectionInputV1,
): RawSampleCanonicalProjectionV1 {
  const observedAt = toIso(Number(input.sample.ts_ms));
  if (!observedAt) {
    return {
      status: "OMITTED",
      sample_id: input.sample.sample_id,
      reason_code: "CANONICAL_PROJECTION_INVALID_OBSERVED_AT",
    };
  }

  if (input.sample.created_at == null) {
    return {
      status: "OMITTED",
      sample_id: input.sample.sample_id,
      reason_code: "CANONICAL_PROJECTION_MISSING_CREATED_AT",
    };
  }
  const availableMs = createdAtMs(input.sample.created_at);
  if (availableMs == null) {
    return {
      status: "OMITTED",
      sample_id: input.sample.sample_id,
      reason_code: "CANONICAL_PROJECTION_INVALID_CREATED_AT",
    };
  }
  const availableAt = toIso(availableMs)!;
  const evaluatedAt = toIso(input.decision_time_ms)!;

  const scope = sampleScope(input);
  const spatial = spatialAuthority(scope, input.requested_scope);
  const temporal = temporalEligibility(Number(input.sample.ts_ms), availableMs, input.decision_time_ms);
  const physical = physicalValidity(input.physical_qc_decision);
  const sourceAuthority = input.source_formal_eligible ? "QUALIFIED" : "UNQUALIFIED";
  const role = roleDecision({
    source_formal_eligible: input.source_formal_eligible,
    quality: input.quality_decision,
    physical,
    temporal,
    spatial,
    conflict: input.conflict_state,
    device_transport_health: input.device_transport_health,
  });
  const measurement = measurementHealth(input.quality_decision, input.physical_qc_decision);

  const sourceRef = `raw_sample:${input.sample.sample_id}`;
  const observationId = `canonical_observation_v1:${sourceRef}`;
  const qualificationId = `evidence_qualification_v1:${sourceRef}:${input.decision_time_ms}`;
  const unit = payloadString(input.sample.payload_json, "unit");
  const limitations = [
    "B04D3_SHADOW_PROJECTION_NOT_YET_STAGE1_AUTHORITY",
    "TEMPORAL_FRESHNESS_REMAINS_APPLEII_WINDOW_LEVEL",
  ];
  if (input.physical_qc_decision.mode === "LEGACY_UNCLASSIFIED") {
    limitations.push("LEGACY_RAW_SAMPLE_WITHOUT_INGRESS_PHYSICAL_QC");
  }

  const reasonCodes = Array.from(new Set([
    input.quality_decision.reason_code,
    input.physical_qc_decision.reason_code,
    ...role.reason_codes,
  ]));

  const observation = canonicalObservationV1Schema.parse({
    schema_version: "canonical_observation_v1",
    observation_id: observationId,
    source_fact_id: sourceRef,
    source_ref: sourceRef,
    scope,
    metric: String(input.sample.metric ?? "").trim(),
    unit,
    raw_value: input.sample.value,
    canonical_value: input.sample.value,
    observed_at: observedAt,
    ingested_at: availableAt,
    available_to_runtime_at: availableAt,
    device_transport_health: input.device_transport_health,
    measurement_health: measurement,
    physical_validity: physical,
    temporal_eligibility: temporal,
    source_authority: sourceAuthority,
    spatial_authority: spatial,
    conflict_state: input.conflict_state,
    role_eligibility: [{
      role: STAGE1_FORMAL_EVIDENCE_ROLE_V1,
      eligibility: role.eligibility,
      reason_codes: role.reason_codes,
    }],
    limitations,
    reason_codes: reasonCodes,
    epistemic_class: "OBSERVED",
  });

  const qualification = evidenceQualificationV1Schema.parse({
    schema_version: "evidence_qualification_v1",
    qualification_id: qualificationId,
    observation_id: observationId,
    source_ref: sourceRef,
    metric: observation.metric,
    scope,
    evaluated_at: evaluatedAt,
    decision_time: evaluatedAt,
    presence: "PRESENT",
    epistemic_class: "OBSERVED",
    physical_validity: physical,
    temporal_eligibility: temporal,
    source_authority: sourceAuthority,
    spatial_authority: spatial,
    conflict_state: input.conflict_state,
    evidence_authority: role.evidence_authority,
    role_eligibility: [{
      role: STAGE1_FORMAL_EVIDENCE_ROLE_V1,
      eligibility: role.eligibility,
      reason_codes: role.reason_codes,
    }],
    limitations,
    reason_codes: reasonCodes,
  });

  return {
    status: "PROJECTED",
    observation,
    qualification,
  };
}
