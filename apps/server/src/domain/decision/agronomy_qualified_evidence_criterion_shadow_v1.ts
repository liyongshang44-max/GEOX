import { z } from "zod";

import {
  decisionEligibilityCriterionAssessmentV1Schema,
} from "../../contracts/decision_eligibility_v1.js";
import type {
  AgronomyEvidenceDependencyShadowBindingV1,
} from "./agronomy_evidence_dependency_shadow_binding_v1.js";

/**
 * B-09h shadow-only QUALIFIED_EVIDENCE criterion projection.
 *
 * This is deliberately not CandidateDecision-bound and is not connected to
 * Decision Eligibility Runtime. It turns the already-observed B-09f/B-09g
 * canonical evidence dependency shadow into a criterion-shaped observation
 * only when canonical EvidenceQualification provenance is auditable.
 */

export const agronomyQualifiedEvidenceCriterionShadowV1Schema = z
  .object({
    schema_version: z.literal("agronomy_qualified_evidence_criterion_shadow_v1"),
    authority_mode: z.literal("SHADOW_NON_AUTHORITATIVE"),
    projection_state: z.enum(["CRITERION_PROJECTED", "NOT_READY"]),
    source_binding_state: z.string().min(1),
    source_evidence_judge_ref: z.string().min(1).nullable(),
    semantic_comparison_state: z
      .enum(["MATCH", "DIVERGENT", "INCOMPARABLE", "CANONICAL_MISSING", "LEGACY_MISSING"])
      .nullable(),
    canonical_sufficiency_status: z
      .enum(["SUFFICIENT", "NEEDS_EVIDENCE", "UNKNOWN"])
      .nullable(),
    canonical_evidence_qualification_refs: z.array(z.string().min(1)),
    canonical_evidence_qualification_refs_state: z.string().min(1),
    criterion_assessment: decisionEligibilityCriterionAssessmentV1Schema.nullable(),
    candidate_binding_state: z.literal("NOT_BOUND"),
    candidate_ref: z.null(),
    direct_verdict_authority: z.literal("NONE"),
    decision_eligibility_runtime_connected: z.literal(false),
    consumer_migration_performed: z.literal(false),
    authority_removal_permitted: z.literal(false),
    reason_codes: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export type AgronomyQualifiedEvidenceCriterionShadowV1 = z.infer<
  typeof agronomyQualifiedEvidenceCriterionShadowV1Schema
>;

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function notReady(
  binding: AgronomyEvidenceDependencyShadowBindingV1,
  reasonCode: string,
): AgronomyQualifiedEvidenceCriterionShadowV1 {
  return agronomyQualifiedEvidenceCriterionShadowV1Schema.parse({
    schema_version: "agronomy_qualified_evidence_criterion_shadow_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    projection_state: "NOT_READY",
    source_binding_state: binding.binding_state,
    source_evidence_judge_ref: binding.evidence_judge_ref,
    semantic_comparison_state: binding.semantic_comparison_state,
    canonical_sufficiency_status: binding.canonical_sufficiency_status,
    canonical_evidence_qualification_refs: [],
    canonical_evidence_qualification_refs_state:
      binding.canonical_evidence_qualification_refs_state,
    criterion_assessment: null,
    candidate_binding_state: "NOT_BOUND",
    candidate_ref: null,
    direct_verdict_authority: "NONE",
    decision_eligibility_runtime_connected: false,
    consumer_migration_performed: false,
    authority_removal_permitted: false,
    reason_codes: [reasonCode],
    limitations: [
      "B09H_SHADOW_CRITERION_NON_AUTHORITATIVE",
      "CANONICAL_CANDIDATE_DECISION_NOT_BOUND",
      "DECISION_ELIGIBILITY_RUNTIME_NOT_CONNECTED",
      "NO_CONSUMER_MIGRATION_IN_B09H",
      "NO_AUTHORITY_REMOVAL_IN_B09H",
    ],
  });
}

export function projectAgronomyQualifiedEvidenceCriterionShadowV1(
  binding: AgronomyEvidenceDependencyShadowBindingV1,
): AgronomyQualifiedEvidenceCriterionShadowV1 {
  if (binding.binding_state !== "BOUND") {
    return notReady(binding, "B09H_EVIDENCE_DEPENDENCY_NOT_BOUND");
  }
  if (binding.criterion_shadow_provenance_readiness !== "READY_FOR_CRITERION_SHADOW") {
    return notReady(binding, "B09H_CANONICAL_EVIDENCE_PROVENANCE_NOT_READY");
  }

  const refs = unique(binding.canonical_evidence_qualification_refs);
  const refState = binding.canonical_evidence_qualification_refs_state;
  const canonicalStatus = binding.canonical_sufficiency_status;

  let status: "SATISFIED" | "MISSING";
  let reasonCodes: string[];

  if (canonicalStatus === "SUFFICIENT") {
    if (refState !== "AVAILABLE_FROM_PERSISTED_CANONICAL_SHADOW" || refs.length === 0) {
      return notReady(binding, "B09H_SUFFICIENT_REQUIRES_AUDITABLE_QUALIFICATION_REFS");
    }
    status = "SATISFIED";
    reasonCodes = ["CANONICAL_QUALIFIED_EVIDENCE_SUFFICIENT"];
  } else if (canonicalStatus === "NEEDS_EVIDENCE") {
    if (
      refState !== "AVAILABLE_FROM_PERSISTED_CANONICAL_SHADOW"
      && refState !== "EMPTY_NO_CANONICAL_QUALIFICATIONS"
    ) {
      return notReady(binding, "B09H_NEEDS_EVIDENCE_REQUIRES_AUDITABLE_PROVENANCE_STATE");
    }
    if (refState === "EMPTY_NO_CANONICAL_QUALIFICATIONS" && refs.length !== 0) {
      return notReady(binding, "B09H_EMPTY_QUALIFICATION_SET_MUST_HAVE_ZERO_REFS");
    }
    status = "MISSING";
    reasonCodes = refState === "EMPTY_NO_CANONICAL_QUALIFICATIONS"
      ? ["NO_CANONICAL_EVIDENCE_QUALIFICATIONS"]
      : ["NO_ROLE_ELIGIBLE_CANONICAL_EVIDENCE"];
  } else {
    return notReady(binding, "B09H_CANONICAL_EVIDENCE_SUFFICIENCY_UNKNOWN");
  }

  const criterionAssessment = decisionEligibilityCriterionAssessmentV1Schema.parse({
    criterion: "QUALIFIED_EVIDENCE",
    status,
    reason_codes: reasonCodes,
    support_refs: refs,
  });

  return agronomyQualifiedEvidenceCriterionShadowV1Schema.parse({
    schema_version: "agronomy_qualified_evidence_criterion_shadow_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    projection_state: "CRITERION_PROJECTED",
    source_binding_state: binding.binding_state,
    source_evidence_judge_ref: binding.evidence_judge_ref,
    semantic_comparison_state: binding.semantic_comparison_state,
    canonical_sufficiency_status: canonicalStatus,
    canonical_evidence_qualification_refs: refs,
    canonical_evidence_qualification_refs_state: refState,
    criterion_assessment: criterionAssessment,
    candidate_binding_state: "NOT_BOUND",
    candidate_ref: null,
    direct_verdict_authority: "NONE",
    decision_eligibility_runtime_connected: false,
    consumer_migration_performed: false,
    authority_removal_permitted: false,
    reason_codes: [
      "B09H_CANONICAL_QUALIFIED_EVIDENCE_CRITERION_SHADOW_PROJECTED",
      ...(binding.semantic_comparison_state === "DIVERGENT"
        ? ["LEGACY_CANONICAL_DIVERGENCE_PRESERVED"]
        : []),
    ],
    limitations: [
      "B09H_SHADOW_CRITERION_NON_AUTHORITATIVE",
      "CANONICAL_CANDIDATE_DECISION_NOT_BOUND",
      "CRITERION_NOT_SUPPLIED_TO_DECISION_ELIGIBILITY_RUNTIME",
      "LEGACY_AGRONOMY_VERDICT_REMAINS_UNCHANGED",
      "NO_CONSUMER_MIGRATION_IN_B09H",
      "NO_AUTHORITY_REMOVAL_IN_B09H",
    ],
  });
}
