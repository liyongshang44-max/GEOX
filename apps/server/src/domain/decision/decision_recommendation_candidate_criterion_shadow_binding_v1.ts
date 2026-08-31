import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";

import { candidateDecisionV1Schema } from "../../contracts/canonical_decision_v1.js";
import { decisionEligibilityCriterionAssessmentV1Schema } from "../../contracts/decision_eligibility_v1.js";
import { projectLegacyRecommendationCandidateV1 } from "./legacy_recommendation_candidate_adapter_v1.js";
import type { AgronomyEvidenceDependencyShadowBindingV1 } from "./agronomy_evidence_dependency_shadow_binding_v1.js";
import type { AgronomyQualifiedEvidenceCriterionShadowV1 } from "./agronomy_qualified_evidence_criterion_shadow_v1.js";

export const B09J_CANDIDATE_IDENTITY_POLICY_V1 = "SOURCE_FACT_SCOPE_SHA256_V1" as const;
export const B09J_DECISION_RECOMMENDATION_SOURCE = "api/v1/recommendations/generate" as const;

export type DecisionRecommendationCandidateCriterionShadowInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id?: string | null;
  season_id?: string | null;
  device_id?: string | null;
  recommendation_id?: string | null;
  expected_source_fact_id?: string | null;
  context_snapshot_ref?: string | null;
  decision_time?: string | null;
};

export type DecisionRecommendationCandidateSourceFactV1 = {
  fact_id: string;
  occurred_at: string | Date;
  source: string;
  record_json: unknown;
};

export const decisionRecommendationCandidateCriterionShadowBindingV1Schema = z
  .object({
    schema_version: z.literal("decision_recommendation_candidate_criterion_shadow_binding_v1"),
    authority_mode: z.literal("SHADOW_NON_AUTHORITATIVE"),
    binding_state: z.enum([
      "NOT_REQUESTED",
      "SOURCE_NOT_FOUND",
      "SOURCE_AMBIGUOUS",
      "SOURCE_TYPE_INVALID",
      "SOURCE_PRODUCER_INVALID",
      "SOURCE_SCOPE_NOT_ESTABLISHED",
      "SOURCE_SCOPE_MISMATCH",
      "CRITERION_NOT_READY",
      "EVIDENCE_PROVENANCE_MISMATCH",
      "CANDIDATE_PROJECTION_FAILED",
      "BOUND",
      "BINDING_READ_ERROR",
    ]),
    recommendation_id: z.string().min(1).nullable(),
    source_fact_count: z.number().int().min(0).max(2),
    source_fact_id: z.string().min(1).nullable(),
    source_fact_ref: z.string().min(1).nullable(),
    source_fact_source: z.string().min(1).nullable(),
    source_fact_occurred_at: z.string().datetime({ offset: true }).nullable(),
    candidate_identity_policy: z.literal(B09J_CANDIDATE_IDENTITY_POLICY_V1),
    candidate_identity_digest_sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    candidate_id: z.string().min(1).nullable(),
    candidate_ref: z.string().min(1).nullable(),
    candidate_projection_state: z.enum(["NOT_PROJECTED", "PROJECTED"]),
    candidate_decision: candidateDecisionV1Schema.nullable(),
    criterion_candidate_binding_state: z.enum(["NOT_BOUND", "BOUND_TO_SAME_CANDIDATE"]),
    criterion_assessment: decisionEligibilityCriterionAssessmentV1Schema.nullable(),
    candidate_evidence_qualification_refs: z.array(z.string().min(1)),
    criterion_support_refs: z.array(z.string().min(1)),
    canonical_evidence_continuity_state: z.enum(["NOT_ESTABLISHED", "EXACT_REF_SET_MATCH"]),
    decision_eligibility_input_materialization_state: z.enum([
      "NOT_READY",
      "NOT_READY_CANONICAL_EVIDENCE_OBJECTS_NOT_BOUND",
    ]),
    decision_eligibility_runtime_connected: z.literal(false),
    legacy_agronomy_result_unchanged: z.literal(true),
    consumer_migration_performed: z.literal(false),
    authority_removal_permitted: z.literal(false),
    reason_codes: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export type DecisionRecommendationCandidateCriterionShadowBindingV1 = z.infer<
  typeof decisionRecommendationCandidateCriterionShadowBindingV1Schema
>;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, any>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function unique(values: unknown): string[] {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => text(value))
        .filter(Boolean),
    ),
  ).sort();
}

function sameRefs(a: unknown, b: unknown): boolean {
  return JSON.stringify(unique(a)) === JSON.stringify(unique(b));
}

function iso(value: string | Date): string | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function deriveDecisionRecommendationCandidateIdentityV1(input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  source_fact_id: string;
}): { candidate_id: string; digest_sha256: string } {
  const material = [
    B09J_CANDIDATE_IDENTITY_POLICY_V1,
    "decision_recommendation_v1",
    text(input.tenant_id),
    text(input.project_id),
    text(input.group_id),
    text(input.source_fact_id),
  ];
  if (material.slice(2).some((value) => !value)) {
    throw new Error("B09J_CANDIDATE_IDENTITY_MATERIAL_INCOMPLETE");
  }
  const digest = createHash("sha256").update(material.join("\u001f")).digest("hex");
  return {
    candidate_id: "candidate_sfsha256_" + digest,
    digest_sha256: digest,
  };
}

function result(
  input: DecisionRecommendationCandidateCriterionShadowInputV1,
  state: DecisionRecommendationCandidateCriterionShadowBindingV1["binding_state"],
  detail: Partial<DecisionRecommendationCandidateCriterionShadowBindingV1> = {},
): DecisionRecommendationCandidateCriterionShadowBindingV1 {
  return decisionRecommendationCandidateCriterionShadowBindingV1Schema.parse({
    schema_version: "decision_recommendation_candidate_criterion_shadow_binding_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    binding_state: state,
    recommendation_id: text(input.recommendation_id) || null,
    source_fact_count: detail.source_fact_count ?? 0,
    source_fact_id: detail.source_fact_id ?? null,
    source_fact_ref: detail.source_fact_ref ?? null,
    source_fact_source: detail.source_fact_source ?? null,
    source_fact_occurred_at: detail.source_fact_occurred_at ?? null,
    candidate_identity_policy: B09J_CANDIDATE_IDENTITY_POLICY_V1,
    candidate_identity_digest_sha256: detail.candidate_identity_digest_sha256 ?? null,
    candidate_id: detail.candidate_id ?? null,
    candidate_ref: detail.candidate_ref ?? null,
    candidate_projection_state: detail.candidate_projection_state ?? "NOT_PROJECTED",
    candidate_decision: detail.candidate_decision ?? null,
    criterion_candidate_binding_state: detail.criterion_candidate_binding_state ?? "NOT_BOUND",
    criterion_assessment: detail.criterion_assessment ?? null,
    candidate_evidence_qualification_refs: detail.candidate_evidence_qualification_refs ?? [],
    criterion_support_refs: detail.criterion_support_refs ?? [],
    canonical_evidence_continuity_state: detail.canonical_evidence_continuity_state ?? "NOT_ESTABLISHED",
    decision_eligibility_input_materialization_state:
      detail.decision_eligibility_input_materialization_state ?? "NOT_READY",
    decision_eligibility_runtime_connected: false,
    legacy_agronomy_result_unchanged: true,
    consumer_migration_performed: false,
    authority_removal_permitted: false,
    reason_codes: detail.reason_codes ?? [state],
    limitations: [
      "B09J_SHADOW_NON_AUTHORITATIVE",
      "CANDIDATE_ID_DERIVED_ONLY_BY_EXPLICIT_SOURCE_FACT_SCOPE_SHA256_POLICY",
      "LEGACY_RECOMMENDATION_ID_IS_NOT_CANONICAL_CANDIDATE_ID",
      "B09H_ORIGINAL_CRITERION_SHADOW_REMAINS_CANDIDATE_UNBOUND",
      "FULL_CANONICAL_EVIDENCE_QUALIFICATION_OBJECTS_NOT_BOUND_FOR_B07E",
      "DECISION_ELIGIBILITY_RUNTIME_NOT_CONNECTED",
      "LEGACY_AGRONOMY_RESULT_REMAINS_UNCHANGED",
      "NO_CONSUMER_MIGRATION_IN_B09J",
      "NO_AUTHORITY_REMOVAL_IN_B09J",
      ...(detail.limitations ?? []),
    ],
  });
}

export function projectDecisionRecommendationCandidateCriterionShadowBindingV1(
  input: DecisionRecommendationCandidateCriterionShadowInputV1,
  sourceFacts: DecisionRecommendationCandidateSourceFactV1[],
  evidenceBinding: AgronomyEvidenceDependencyShadowBindingV1,
  criterionShadow: AgronomyQualifiedEvidenceCriterionShadowV1,
): DecisionRecommendationCandidateCriterionShadowBindingV1 {
  const recommendationId = text(input.recommendation_id);
  if (!recommendationId) {
    return result(input, "NOT_REQUESTED", {
      reason_codes: ["B09J_RECOMMENDATION_ID_NOT_SUPPLIED"],
    });
  }

  if (sourceFacts.length === 0) {
    return result(input, "SOURCE_NOT_FOUND", {
      source_fact_count: 0,
      reason_codes: ["B09J_SCOPED_DECISION_RECOMMENDATION_NOT_FOUND"],
    });
  }
  if (sourceFacts.length !== 1) {
    return result(input, "SOURCE_AMBIGUOUS", {
      source_fact_count: Math.min(sourceFacts.length, 2),
      reason_codes: ["B09J_RECOMMENDATION_ID_RESOLVES_TO_MULTIPLE_SOURCE_FACTS"],
    });
  }

  const sourceFact = sourceFacts[0];
  const sourceRecord = record(sourceFact.record_json);
  const sourcePayload = record(sourceRecord.payload);
  const sourceType = text(sourceRecord.type);
  const sourceFactId = text(sourceFact.fact_id);
  const sourceOccurredAt = iso(sourceFact.occurred_at);
  const expectedSourceFactId = text(input.expected_source_fact_id);
  const common = {
    source_fact_count: 1,
    source_fact_id: sourceFactId || null,
    source_fact_ref: sourceFactId || null,
    source_fact_source: text(sourceFact.source) || null,
    source_fact_occurred_at: sourceOccurredAt,
  };

  if (expectedSourceFactId && sourceFactId !== expectedSourceFactId) {
    return result(input, "SOURCE_SCOPE_MISMATCH", {
      ...common,
      reason_codes: ["B09J_BOUNDARY_EXPECTED_SOURCE_FACT_ID_MISMATCH"],
    });
  }

  if (sourceType !== "decision_recommendation_v1") {
    return result(input, "SOURCE_TYPE_INVALID", {
      ...common,
      reason_codes: ["B09J_SOURCE_FACT_TYPE_NOT_DECISION_RECOMMENDATION_V1"],
    });
  }
  if (text(sourceFact.source) !== B09J_DECISION_RECOMMENDATION_SOURCE) {
    return result(input, "SOURCE_PRODUCER_INVALID", {
      ...common,
      reason_codes: ["B09J_SOURCE_PRODUCER_NOT_FORMAL_DECISION_ENGINE_RECOMMENDATION"],
    });
  }

  const sourceScope = {
    tenant_id: text(sourcePayload.tenant_id),
    project_id: text(sourcePayload.project_id),
    group_id: text(sourcePayload.group_id),
    field_id: text(sourcePayload.field_id),
    season_id: text(sourcePayload.season_id),
    device_id: text(sourcePayload.device_id),
    zone_id: text(sourcePayload.zone_id),
  };
  if (
    !sourceScope.tenant_id
    || !sourceScope.project_id
    || !sourceScope.group_id
    || !sourceScope.field_id
    || text(sourcePayload.recommendation_id) !== recommendationId
  ) {
    return result(input, "SOURCE_SCOPE_NOT_ESTABLISHED", {
      ...common,
      reason_codes: ["B09J_SOURCE_SCOPE_OR_RECOMMENDATION_ID_NOT_ESTABLISHED"],
    });
  }

  const requestedField = text(input.field_id);
  const requestedSeason = text(input.season_id);
  const requestedDevice = text(input.device_id);
  const scopeMismatch =
    sourceScope.tenant_id !== text(input.tenant_id)
    || sourceScope.project_id !== text(input.project_id)
    || sourceScope.group_id !== text(input.group_id)
    || !requestedField
    || sourceScope.field_id !== requestedField
    || (requestedSeason && sourceScope.season_id !== requestedSeason)
    || (requestedDevice && sourceScope.device_id !== requestedDevice);
  if (scopeMismatch) {
    return result(input, "SOURCE_SCOPE_MISMATCH", {
      ...common,
      reason_codes: ["B09J_AGRONOMY_RECOMMENDATION_SOURCE_SCOPE_MISMATCH"],
    });
  }

  if (
    evidenceBinding.binding_state !== "BOUND"
    || evidenceBinding.criterion_shadow_provenance_readiness !== "READY_FOR_CRITERION_SHADOW"
    || criterionShadow.projection_state !== "CRITERION_PROJECTED"
    || criterionShadow.criterion_assessment == null
  ) {
    return result(input, "CRITERION_NOT_READY", {
      ...common,
      criterion_assessment: criterionShadow.criterion_assessment,
      reason_codes: ["B09J_B09H_QUALIFIED_EVIDENCE_CRITERION_NOT_READY"],
    });
  }

  const criterionRefs = unique(criterionShadow.criterion_assessment.support_refs);
  const criterionProjectionRefs = unique(criterionShadow.canonical_evidence_qualification_refs);
  const bindingRefs = unique(evidenceBinding.canonical_evidence_qualification_refs);
  if (
    !sameRefs(criterionRefs, criterionProjectionRefs)
    || !sameRefs(criterionRefs, bindingRefs)
  ) {
    return result(input, "EVIDENCE_PROVENANCE_MISMATCH", {
      ...common,
      criterion_assessment: criterionShadow.criterion_assessment,
      criterion_support_refs: criterionRefs,
      reason_codes: ["B09J_CANDIDATE_CRITERION_CANONICAL_EVIDENCE_REF_SET_MISMATCH"],
    });
  }

  if (!sourceFactId || !sourceOccurredAt) {
    return result(input, "SOURCE_SCOPE_NOT_ESTABLISHED", {
      ...common,
      reason_codes: ["B09J_IMMUTABLE_SOURCE_FACT_ID_OR_OCCURRED_AT_MISSING"],
    });
  }

  const identity = deriveDecisionRecommendationCandidateIdentityV1({
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    source_fact_id: sourceFactId,
  });
  const candidateRef = "candidate_decision_v1:" + identity.candidate_id;

  try {
    const candidate = projectLegacyRecommendationCandidateV1(sourcePayload, {
      candidate_id: identity.candidate_id,
      source_ref: sourceFactId,
      source_type: "decision_recommendation_v1",
      scope: {
        tenant_id: text(input.tenant_id),
        project_id: text(input.project_id),
        group_id: text(input.group_id),
        field_id: sourceScope.field_id,
        season_id: sourceScope.season_id || null,
        zone_id: sourceScope.zone_id || null,
      },
      evidence_qualification_refs: criterionRefs,
      context_snapshot_ref: text(input.context_snapshot_ref) || null,
      crop_stage_state_ref: null,
      calculation_result_refs: [],
      interpretation_refs: [],
      legacy_source_refs: ["legacy_recommendation_id:" + recommendationId],
      created_at: sourceOccurredAt,
      decision_time: text(input.decision_time) || null,
    });

    const candidateRefs = unique(candidate.basis.evidence_qualification_refs);
    if (!sameRefs(candidateRefs, criterionRefs)) {
      return result(input, "EVIDENCE_PROVENANCE_MISMATCH", {
        ...common,
        candidate_identity_digest_sha256: identity.digest_sha256,
        candidate_id: identity.candidate_id,
        candidate_ref: candidateRef,
        candidate_projection_state: "PROJECTED",
        candidate_decision: candidate,
        criterion_assessment: criterionShadow.criterion_assessment,
        candidate_evidence_qualification_refs: candidateRefs,
        criterion_support_refs: criterionRefs,
        reason_codes: ["B09J_PROJECTED_CANDIDATE_EVIDENCE_REFS_DIVERGE_FROM_CRITERION_SUPPORT_REFS"],
      });
    }

    return result(input, "BOUND", {
      ...common,
      candidate_identity_digest_sha256: identity.digest_sha256,
      candidate_id: identity.candidate_id,
      candidate_ref: candidateRef,
      candidate_projection_state: "PROJECTED",
      candidate_decision: candidate,
      criterion_candidate_binding_state: "BOUND_TO_SAME_CANDIDATE",
      criterion_assessment: criterionShadow.criterion_assessment,
      candidate_evidence_qualification_refs: candidateRefs,
      criterion_support_refs: criterionRefs,
      canonical_evidence_continuity_state: "EXACT_REF_SET_MATCH",
      decision_eligibility_input_materialization_state:
        "NOT_READY_CANONICAL_EVIDENCE_OBJECTS_NOT_BOUND",
      reason_codes: [
        "B09J_SCOPED_RECOMMENDATION_SOURCE_FACT_BOUND",
        "B09J_DETERMINISTIC_CANONICAL_CANDIDATE_ID_ESTABLISHED",
        "B09J_CANDIDATE_AND_QUALIFIED_EVIDENCE_CRITERION_SHARE_EXACT_CANONICAL_REF_SET",
        "B09J_DECISION_ELIGIBILITY_REMAINS_DISCONNECTED_PENDING_FULL_EVIDENCE_OBJECT_MATERIALIZATION",
      ],
    });
  } catch {
    return result(input, "CANDIDATE_PROJECTION_FAILED", {
      ...common,
      candidate_identity_digest_sha256: identity.digest_sha256,
      candidate_id: identity.candidate_id,
      candidate_ref: candidateRef,
      criterion_assessment: criterionShadow.criterion_assessment,
      criterion_support_refs: criterionRefs,
      reason_codes: ["B09J_B06C_CANDIDATE_PROJECTION_FAILED_CLOSED"],
    });
  }
}

export async function buildDecisionRecommendationCandidateCriterionShadowBindingV1(
  pool: Pool,
  input: DecisionRecommendationCandidateCriterionShadowInputV1,
  evidenceBinding: AgronomyEvidenceDependencyShadowBindingV1,
  criterionShadow: AgronomyQualifiedEvidenceCriterionShadowV1,
): Promise<DecisionRecommendationCandidateCriterionShadowBindingV1> {
  const recommendationId = text(input.recommendation_id);
  if (!recommendationId) {
    return projectDecisionRecommendationCandidateCriterionShadowBindingV1(
      input,
      [],
      evidenceBinding,
      criterionShadow,
    );
  }

  try {
    const expectedSourceFactId = text(input.expected_source_fact_id);
    const query = expectedSourceFactId
      ? await pool.query(
          `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
             FROM facts
            WHERE fact_id = $1
              AND (record_json::jsonb->>'type') = 'decision_recommendation_v1'
              AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
              AND (record_json::jsonb#>>'{payload,project_id}') = $3
              AND (record_json::jsonb#>>'{payload,group_id}') = $4
              AND (record_json::jsonb#>>'{payload,recommendation_id}') = $5
            LIMIT 2`,
          [
            expectedSourceFactId,
            input.tenant_id,
            input.project_id,
            input.group_id,
            recommendationId,
          ],
        )
      : await pool.query(
          `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
             FROM facts
            WHERE (record_json::jsonb->>'type') = 'decision_recommendation_v1'
              AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
              AND (record_json::jsonb#>>'{payload,project_id}') = $2
              AND (record_json::jsonb#>>'{payload,group_id}') = $3
              AND (record_json::jsonb#>>'{payload,recommendation_id}') = $4
            ORDER BY occurred_at DESC, fact_id DESC
            LIMIT 2`,
          [input.tenant_id, input.project_id, input.group_id, recommendationId],
        );
    return projectDecisionRecommendationCandidateCriterionShadowBindingV1(
      input,
      (query.rows ?? []) as DecisionRecommendationCandidateSourceFactV1[],
      evidenceBinding,
      criterionShadow,
    );
  } catch {
    return result(input, "BINDING_READ_ERROR", {
      reason_codes: ["B09J_SCOPED_RECOMMENDATION_SOURCE_READ_FAILED"],
    });
  }
}
