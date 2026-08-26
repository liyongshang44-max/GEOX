import { z } from "zod";

/**
 * B-03 contract vocabulary only.
 *
 * This module does not perform ingress QC, does not rewire Stage-1/Judge,
 * does not define MCFT State/Forecast/Scenario semantics, and does not
 * produce action-level Decision Eligibility.
 */

export const evidenceEpistemicClassV1Schema = z.enum([
  "OBSERVED",
  "ESTIMATED",
  "MODEL_DERIVED",
  "IMPUTED",
  "ASSUMED",
  "SIMULATED",
  "LIMITED",
  "UNKNOWN",
]);

export const deviceTransportHealthV1Schema = z.enum([
  "GOOD",
  "DEGRADED",
  "FAILED",
  "UNKNOWN",
  "NOT_APPLICABLE",
]);

export const measurementHealthV1Schema = z.enum([
  "VALID",
  "SUSPECT",
  "INVALID",
  "UNKNOWN",
  "NOT_APPLICABLE",
]);

export const physicalValidityV1Schema = z.enum([
  "PASS",
  "FAIL",
  "UNKNOWN",
  "NOT_APPLICABLE",
]);

export const temporalEligibilityV1Schema = z.enum([
  "ELIGIBLE",
  "STALE",
  "FUTURE_RELATIVE_TO_DECISION",
  "NOT_AVAILABLE_AT_DECISION",
  "UNKNOWN",
  "NOT_APPLICABLE",
]);

export const sourceAuthorityV1Schema = z.enum([
  "AUTHORITATIVE",
  "QUALIFIED",
  "LIMITED",
  "UNQUALIFIED",
  "UNKNOWN",
]);

export const spatialAuthorityV1Schema = z.enum([
  "EXACT_SCOPE",
  "PARENT_SCOPE_WITH_EXPLICIT_APPLICABILITY",
  "INTERSECTS_SCOPE",
  "LIMITED",
  "OUT_OF_SCOPE",
  "UNKNOWN",
  "NOT_APPLICABLE",
]);

export const evidenceConflictStateV1Schema = z.enum([
  "NONE",
  "CONFLICTING",
  "UNRESOLVED",
  "RESOLVED_WITH_PROVENANCE",
  "UNKNOWN",
]);

export const evidenceRoleEligibilityStateV1Schema = z.enum([
  "ELIGIBLE",
  "LIMITED",
  "INELIGIBLE",
  "UNKNOWN",
]);

export const evidenceAuthorityStateV1Schema = z.enum([
  "QUALIFIED",
  "LIMITED",
  "INELIGIBLE",
  "UNKNOWN",
]);

export const evidencePresenceV1Schema = z.enum(["PRESENT", "MISSING"]);

export const canonicalEvidenceValueV1Schema = z.union([
  z.number().finite(),
  z.string(),
  z.boolean(),
  z.null(),
]);

export const evidenceScopeV1Schema = z
  .object({
    tenant_id: z.string().min(1).nullable(),
    project_id: z.string().min(1).nullable(),
    group_id: z.string().min(1).nullable(),
    field_id: z.string().min(1).nullable(),
    season_id: z.string().min(1).nullable(),
    zone_id: z.string().min(1).nullable(),
  })
  .strict();

export const evidenceRoleEligibilityV1Schema = z
  .object({
    role: z.string().min(1),
    eligibility: evidenceRoleEligibilityStateV1Schema,
    reason_codes: z.array(z.string().min(1)),
  })
  .strict();

export const canonicalObservationV1Schema = z
  .object({
    schema_version: z.literal("canonical_observation_v1"),
    observation_id: z.string().min(1),
    source_fact_id: z.string().min(1).nullable(),
    source_ref: z.string().min(1),
    scope: evidenceScopeV1Schema,
    metric: z.string().min(1),
    unit: z.string().min(1).nullable(),
    raw_value: canonicalEvidenceValueV1Schema,
    canonical_value: canonicalEvidenceValueV1Schema,
    observed_at: z.string().datetime({ offset: true }),
    ingested_at: z.string().datetime({ offset: true }),
    available_to_runtime_at: z.string().datetime({ offset: true }),
    device_transport_health: deviceTransportHealthV1Schema,
    measurement_health: measurementHealthV1Schema,
    physical_validity: physicalValidityV1Schema,
    temporal_eligibility: temporalEligibilityV1Schema,
    source_authority: sourceAuthorityV1Schema,
    spatial_authority: spatialAuthorityV1Schema,
    conflict_state: evidenceConflictStateV1Schema,
    role_eligibility: z.array(evidenceRoleEligibilityV1Schema),
    limitations: z.array(z.string().min(1)),
    reason_codes: z.array(z.string().min(1)),
    epistemic_class: evidenceEpistemicClassV1Schema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const impossibleForEligibleRole =
      value.measurement_health === "INVALID" ||
      value.physical_validity === "FAIL" ||
      value.temporal_eligibility === "STALE" ||
      value.temporal_eligibility === "FUTURE_RELATIVE_TO_DECISION" ||
      value.temporal_eligibility === "NOT_AVAILABLE_AT_DECISION" ||
      value.source_authority === "UNQUALIFIED" ||
      value.spatial_authority === "OUT_OF_SCOPE" ||
      value.conflict_state === "CONFLICTING" ||
      value.conflict_state === "UNRESOLVED";

    if (impossibleForEligibleRole && value.role_eligibility.some((role) => role.eligibility === "ELIGIBLE")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["role_eligibility"],
        message: "B03_INVALID_EVIDENCE_CANNOT_RETAIN_ELIGIBLE_ROLE_AUTHORITY",
      });
    }

    if (value.epistemic_class === "OBSERVED" && value.source_fact_id === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source_fact_id"],
        message: "B03_OBSERVED_EVIDENCE_REQUIRES_SOURCE_FACT_ID",
      });
    }
  });

export const evidenceQualificationV1Schema = z
  .object({
    schema_version: z.literal("evidence_qualification_v1"),
    qualification_id: z.string().min(1),
    observation_id: z.string().min(1).nullable(),
    source_ref: z.string().min(1),
    metric: z.string().min(1),
    scope: evidenceScopeV1Schema,
    evaluated_at: z.string().datetime({ offset: true }),
    decision_time: z.string().datetime({ offset: true }).nullable(),
    presence: evidencePresenceV1Schema,
    epistemic_class: evidenceEpistemicClassV1Schema,
    physical_validity: physicalValidityV1Schema,
    temporal_eligibility: temporalEligibilityV1Schema,
    source_authority: sourceAuthorityV1Schema,
    spatial_authority: spatialAuthorityV1Schema,
    conflict_state: evidenceConflictStateV1Schema,
    evidence_authority: evidenceAuthorityStateV1Schema,
    role_eligibility: z.array(evidenceRoleEligibilityV1Schema),
    limitations: z.array(z.string().min(1)),
    reason_codes: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.presence === "MISSING") {
      if (value.observation_id !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["observation_id"],
          message: "B03_MISSING_EVIDENCE_MUST_NOT_REFERENCE_FABRICATED_OBSERVATION",
        });
      }
      if (value.evidence_authority === "QUALIFIED") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["evidence_authority"],
          message: "B03_MISSING_EVIDENCE_CANNOT_BE_QUALIFIED",
        });
      }
      if (value.role_eligibility.some((role) => role.eligibility === "ELIGIBLE")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["role_eligibility"],
          message: "B03_MISSING_EVIDENCE_CANNOT_RETAIN_ELIGIBLE_ROLE_AUTHORITY",
        });
      }
    } else if (value.observation_id === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["observation_id"],
        message: "B03_PRESENT_EVIDENCE_REQUIRES_OBSERVATION_ID",
      });
    }

    const authorityLoss =
      value.physical_validity === "FAIL" ||
      value.temporal_eligibility === "STALE" ||
      value.temporal_eligibility === "FUTURE_RELATIVE_TO_DECISION" ||
      value.temporal_eligibility === "NOT_AVAILABLE_AT_DECISION" ||
      value.source_authority === "UNQUALIFIED" ||
      value.spatial_authority === "OUT_OF_SCOPE" ||
      value.conflict_state === "CONFLICTING" ||
      value.conflict_state === "UNRESOLVED";

    if (authorityLoss && value.evidence_authority === "QUALIFIED") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence_authority"],
        message: "B03_FAILED_QUALIFICATION_DIMENSION_CANNOT_BE_FULLY_QUALIFIED",
      });
    }

    if (authorityLoss && value.role_eligibility.some((role) => role.eligibility === "ELIGIBLE")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["role_eligibility"],
        message: "B03_FAILED_QUALIFICATION_DIMENSION_CANNOT_RETAIN_ELIGIBLE_ROLE_AUTHORITY",
      });
    }
  });

export type EvidenceEpistemicClassV1 = z.infer<typeof evidenceEpistemicClassV1Schema>;
export type EvidenceScopeV1 = z.infer<typeof evidenceScopeV1Schema>;
export type EvidenceRoleEligibilityV1 = z.infer<typeof evidenceRoleEligibilityV1Schema>;
export type CanonicalObservationV1 = z.infer<typeof canonicalObservationV1Schema>;
export type EvidenceQualificationV1 = z.infer<typeof evidenceQualificationV1Schema>;
