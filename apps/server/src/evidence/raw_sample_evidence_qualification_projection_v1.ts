import {
  evidenceQualificationV1Schema,
  type EvidenceQualificationV1,
  type EvidenceScopeV1,
} from "../contracts/canonical_evidence_v1.js";
import type { RawSampleObservationQualityDecisionV1 } from "./raw_sample_measurement_quality_v1.js";
import type { RawSampleStage1PhysicalQcDecisionV1 } from "./raw_sample_stage1_physical_qc_v1.js";

export const STAGE1_FORMAL_EVIDENCE_ROLE_V1 = "STAGE1_FORMAL_EVIDENCE" as const;

export type RawSampleQualificationSourceV1 =
  | "device"
  | "gateway"
  | "system"
  | "human"
  | "import"
  | "sim"
  | "unknown";

export type RawSampleEvidenceQualificationProjectionInputV1 = {
  sample: {
    sample_id: string;
    sensor_id: string;
    ts_ms: number;
    metric: string;
    source: RawSampleQualificationSourceV1;
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
};

export type RawSampleEvidenceQualificationProjectionBatchV1 = {
  schema_version: "raw_sample_evidence_qualification_projection_v1";
  authority_mode: "SHADOW_NON_AUTHORITATIVE";
  role: typeof STAGE1_FORMAL_EVIDENCE_ROLE_V1;
  qualifications: EvidenceQualificationV1[];
  counts: {
    total: number;
    qualified: number;
    limited: number;
    ineligible: number;
    unknown: number;
  };
  limitations: string[];
};

function asScopeString(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function sampleScope(sample: RawSampleEvidenceQualificationProjectionInputV1["sample"]): EvidenceScopeV1 {
  const payload = sample.payload_json ?? {};
  return {
    tenant_id: asScopeString(payload.tenant_id),
    project_id: asScopeString(payload.project_id),
    group_id: asScopeString(payload.group_id),
    field_id: asScopeString(payload.field_id),
    season_id: asScopeString(payload.season_id),
    zone_id: asScopeString(payload.zone_id),
  };
}

function deriveSpatialAuthority(
  scope: EvidenceScopeV1,
  requested: RawSampleEvidenceQualificationProjectionInputV1["requested_scope"],
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

function createdAtMs(v: unknown): number | null {
  if (v instanceof Date) {
    const ms = v.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v === "string" && v.trim()) {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/**
 * raw_samples.created_at is the row creation timestamp inside the append
 * transaction. It is not an exact post-COMMIT visibility timestamp.
 *
 * B-04d3 therefore never promotes created_at<=decision_time to temporal
 * ELIGIBLE. It can only prove negative cases (future event/backfill); otherwise
 * temporal authority remains UNKNOWN until a durable availability marker exists.
 */
function deriveTemporalEligibility(input: {
  observed_at_ms: number;
  created_at: string | Date | null | undefined;
  decision_time_ms: number;
}): {
  temporal_eligibility:
    | "FUTURE_RELATIVE_TO_DECISION"
    | "NOT_AVAILABLE_AT_DECISION"
    | "UNKNOWN";
  reason_code: string;
} {
  if (!Number.isFinite(input.decision_time_ms) || input.decision_time_ms <= 0) {
    return {
      temporal_eligibility: "UNKNOWN",
      reason_code: "DECISION_TIME_INVALID_OR_MISSING",
    };
  }
  if (Number(input.observed_at_ms) > input.decision_time_ms) {
    return {
      temporal_eligibility: "FUTURE_RELATIVE_TO_DECISION",
      reason_code: "OBSERVATION_FUTURE_RELATIVE_TO_DECISION",
    };
  }

  const createdMs = createdAtMs(input.created_at);
  if (createdMs != null && createdMs > input.decision_time_ms) {
    return {
      temporal_eligibility: "NOT_AVAILABLE_AT_DECISION",
      reason_code: "RAW_SAMPLE_CREATED_AFTER_DECISION_TIME",
    };
  }

  if (createdMs == null) {
    return {
      temporal_eligibility: "UNKNOWN",
      reason_code: "RUNTIME_AVAILABILITY_METADATA_MISSING",
    };
  }

  return {
    temporal_eligibility: "UNKNOWN",
    reason_code: "POST_COMMIT_RUNTIME_AVAILABILITY_NOT_ESTABLISHED",
  };
}

function derivePhysicalValidity(
  decision: RawSampleStage1PhysicalQcDecisionV1,
): "PASS" | "FAIL" | "UNKNOWN" {
  if (decision.mode === "QUALIFIED") return "PASS";
  if (decision.mode === "INELIGIBLE_INVALID") return "FAIL";
  return "UNKNOWN";
}

function deriveRoleAndAuthority(input: {
  source_formal_eligible: boolean;
  quality_decision: RawSampleObservationQualityDecisionV1;
  physical_validity: "PASS" | "FAIL" | "UNKNOWN";
  temporal_eligibility:
    | "FUTURE_RELATIVE_TO_DECISION"
    | "NOT_AVAILABLE_AT_DECISION"
    | "UNKNOWN";
  spatial_authority: "EXACT_SCOPE" | "LIMITED" | "OUT_OF_SCOPE" | "UNKNOWN";
  conflict_state: "NONE" | "UNRESOLVED" | "UNKNOWN";
}): {
  eligibility: "LIMITED" | "INELIGIBLE" | "UNKNOWN";
  evidence_authority: "LIMITED" | "INELIGIBLE" | "UNKNOWN";
  reason_codes: string[];
} {
  const reasons: string[] = [];

  if (!input.source_formal_eligible) reasons.push("SOURCE_NOT_FORMAL_ELIGIBLE");
  if (!input.quality_decision.observation_pipeline_eligible) reasons.push(input.quality_decision.reason_code);
  if (input.physical_validity === "FAIL") reasons.push("PHYSICAL_VALIDITY_FAIL");
  if (input.temporal_eligibility === "FUTURE_RELATIVE_TO_DECISION") reasons.push("OBSERVATION_FUTURE_RELATIVE_TO_DECISION");
  if (input.temporal_eligibility === "NOT_AVAILABLE_AT_DECISION") reasons.push("NOT_AVAILABLE_AT_DECISION");
  if (input.spatial_authority === "OUT_OF_SCOPE") reasons.push("SPATIAL_OUT_OF_SCOPE");
  if (input.conflict_state === "UNRESOLVED") reasons.push("CONFLICT_UNRESOLVED");

  const hardIneligible =
    !input.source_formal_eligible ||
    !input.quality_decision.observation_pipeline_eligible ||
    input.physical_validity === "FAIL" ||
    input.temporal_eligibility === "FUTURE_RELATIVE_TO_DECISION" ||
    input.temporal_eligibility === "NOT_AVAILABLE_AT_DECISION" ||
    input.spatial_authority === "OUT_OF_SCOPE" ||
    input.conflict_state === "UNRESOLVED";

  if (hardIneligible) {
    return {
      eligibility: "INELIGIBLE",
      evidence_authority: "INELIGIBLE",
      reason_codes: reasons,
    };
  }

  if (input.temporal_eligibility === "UNKNOWN") reasons.push("TEMPORAL_AUTHORITY_UNKNOWN");
  if (input.quality_decision.reason_code === "RAW_SAMPLE_QC_SUSPECT") reasons.push("MEASUREMENT_QUALITY_SUSPECT");
  if (input.physical_validity === "UNKNOWN") reasons.push("PHYSICAL_VALIDITY_UNKNOWN");
  if (input.spatial_authority === "LIMITED") reasons.push("SPATIAL_AUTHORITY_LIMITED");
  if (input.spatial_authority === "UNKNOWN") reasons.push("SPATIAL_AUTHORITY_UNKNOWN");
  if (input.conflict_state === "UNKNOWN") reasons.push("CONFLICT_STATE_UNKNOWN");

  if (reasons.length > 0) {
    return {
      eligibility: "LIMITED",
      evidence_authority: "LIMITED",
      reason_codes: reasons,
    };
  }

  // B-04d3 intentionally cannot emit fully qualified/eligible authority because
  // exact post-COMMIT availability time is not yet represented by raw_samples.
  return {
    eligibility: "UNKNOWN",
    evidence_authority: "UNKNOWN",
    reason_codes: ["B04D3_FULL_AUTHORITY_NOT_ESTABLISHED"],
  };
}

/**
 * B-04d3 is a shadow projection, not a new evidence classifier.
 *
 * It consumes:
 * - existing source-formal policy result;
 * - existing caller-quality decision;
 * - existing B-04 physical-QC decision;
 * - existing Apple-II conflict result;
 * - already-bound request/sample scope.
 *
 * It maps those established dimensions into the B-03 EvidenceQualificationV1
 * vocabulary. Stage-1 does not consume this object for eligibility in B-04d3.
 */
export function projectRawSampleEvidenceQualificationV1(
  input: RawSampleEvidenceQualificationProjectionInputV1,
): EvidenceQualificationV1 {
  const scope = sampleScope(input.sample);
  const spatialAuthority = deriveSpatialAuthority(scope, input.requested_scope);
  const physicalValidity = derivePhysicalValidity(input.physical_qc_decision);
  const temporal = deriveTemporalEligibility({
    observed_at_ms: Number(input.sample.ts_ms),
    created_at: input.sample.created_at,
    decision_time_ms: input.decision_time_ms,
  });
  const sourceAuthority = input.source_formal_eligible ? "QUALIFIED" : "UNQUALIFIED";
  const role = deriveRoleAndAuthority({
    source_formal_eligible: input.source_formal_eligible,
    quality_decision: input.quality_decision,
    physical_validity: physicalValidity,
    temporal_eligibility: temporal.temporal_eligibility,
    spatial_authority: spatialAuthority,
    conflict_state: input.conflict_state,
  });

  const sourceRef = `raw_sample:${input.sample.sample_id}`;
  const evaluatedAt = new Date(input.decision_time_ms).toISOString();
  const limitations = [
    "B04D3_SHADOW_NON_AUTHORITATIVE",
    "RAW_SAMPLE_CREATED_AT_IS_NOT_POST_COMMIT_VISIBILITY_TIME",
    "STAGE1_GATE_STILL_USES_EXISTING_APPLEII_COMPATIBILITY_SEMANTICS",
  ];
  if (input.physical_qc_decision.mode === "LEGACY_UNCLASSIFIED") {
    limitations.push("LEGACY_RAW_SAMPLE_WITHOUT_INGRESS_PHYSICAL_QC");
  }

  return evidenceQualificationV1Schema.parse({
    schema_version: "evidence_qualification_v1",
    qualification_id: `evidence_qualification_v1:${sourceRef}:${input.decision_time_ms}`,
    observation_id: sourceRef,
    source_ref: sourceRef,
    metric: String(input.sample.metric ?? "").trim(),
    scope,
    evaluated_at: evaluatedAt,
    decision_time: evaluatedAt,
    presence: "PRESENT",
    epistemic_class: "OBSERVED",
    physical_validity: physicalValidity,
    temporal_eligibility: temporal.temporal_eligibility,
    source_authority: sourceAuthority,
    spatial_authority: spatialAuthority,
    conflict_state: input.conflict_state,
    evidence_authority: role.evidence_authority,
    role_eligibility: [{
      role: STAGE1_FORMAL_EVIDENCE_ROLE_V1,
      eligibility: role.eligibility,
      reason_codes: Array.from(new Set([...role.reason_codes, temporal.reason_code])),
    }],
    limitations,
    reason_codes: Array.from(new Set([
      input.quality_decision.reason_code,
      input.physical_qc_decision.reason_code,
      temporal.reason_code,
      ...role.reason_codes,
    ])),
  });
}

export function buildRawSampleEvidenceQualificationProjectionBatchV1(
  qualifications: EvidenceQualificationV1[],
): RawSampleEvidenceQualificationProjectionBatchV1 {
  const counts = {
    total: qualifications.length,
    qualified: 0,
    limited: 0,
    ineligible: 0,
    unknown: 0,
  };

  for (const qualification of qualifications) {
    if (qualification.evidence_authority === "QUALIFIED") counts.qualified += 1;
    else if (qualification.evidence_authority === "LIMITED") counts.limited += 1;
    else if (qualification.evidence_authority === "INELIGIBLE") counts.ineligible += 1;
    else counts.unknown += 1;
  }

  return {
    schema_version: "raw_sample_evidence_qualification_projection_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    role: STAGE1_FORMAL_EVIDENCE_ROLE_V1,
    qualifications,
    counts,
    limitations: [
      "B04D3_SHADOW_NON_AUTHORITATIVE",
      "DO_NOT_USE_FOR_STAGE1_TRIGGER_ELIGIBILITY_YET",
      "POST_COMMIT_RUNTIME_AVAILABILITY_AUTHORITY_NOT_ESTABLISHED",
    ],
  };
}
