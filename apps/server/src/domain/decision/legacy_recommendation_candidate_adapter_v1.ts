import {
  candidateDecisionV1Schema,
  type CandidateDecisionV1,
} from "../../contracts/canonical_decision_v1.js";
import type { EvidenceScopeV1 } from "../../contracts/canonical_evidence_v1.js";

/**
 * B-06c compatibility adapter only.
 *
 * This module projects legacy recommendation_v1 / decision_recommendation_v1
 * payloads into CandidateDecisionV1 without changing the legacy producer.
 *
 * It does not qualify Evidence, establish Context/Stage authority, create
 * Decision Eligibility, submit Approval, create an OperationPlan/Task, or
 * connect any runtime consumer.
 */

export type LegacyRecommendationCandidateSourceTypeV1 =
  | "recommendation_v1"
  | "decision_recommendation_v1";

export type LegacyRecommendationCandidateProjectionContextV1 = {
  candidate_id: string;
  source_ref: string;
  source_type: LegacyRecommendationCandidateSourceTypeV1;
  scope: EvidenceScopeV1;
  evidence_qualification_refs: string[];
  context_snapshot_ref?: string | null;
  crop_stage_state_ref?: string | null;
  calculation_result_refs?: string[];
  interpretation_refs?: string[];
  legacy_source_refs?: string[];
  created_at: string;
  decision_time?: string | null;
};

const DOWNSTREAM_SOURCE_KEYS = [
  "approval_request_id",
  "approval_decision_id",
  "operation_plan_id",
  "act_task_id",
  "task_id",
  "dispatch_id",
  "receipt_fact_id",
  "approval_created",
  "operation_plan_created",
  "task_created",
  "dispatch_created",
  "execution_created",
] as const;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function uniqueText(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function optionalRef(value: string | null | undefined): string | null {
  const normalized = text(value);
  return normalized || null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hasDownstreamAuthority(value: unknown): boolean {
  if (value == null || value === false || value === "") return false;
  return true;
}

function assertNoDownstreamAuthority(source: Record<string, unknown>): void {
  for (const key of DOWNSTREAM_SOURCE_KEYS) {
    if (hasDownstreamAuthority(source[key])) {
      throw new Error("B06C_SOURCE_ALREADY_CARRIES_DOWNSTREAM_AUTHORITY:" + key);
    }
  }
}

function assertCandidateLikeStatus(
  sourceType: LegacyRecommendationCandidateSourceTypeV1,
  source: Record<string, unknown>,
): void {
  const status = text(source.status).toLowerCase();
  const candidateLike = status === "proposed" || status === "candidate";

  if (sourceType === "decision_recommendation_v1" && !candidateLike) {
    throw new Error("B06C_DECISION_RECOMMENDATION_STATUS_NOT_CANDIDATE:" + (status || "MISSING"));
  }

  if (sourceType === "recommendation_v1" && status && !candidateLike) {
    throw new Error("B06C_RECOMMENDATION_STATUS_NOT_CANDIDATE:" + status);
  }
}

function assertScopeCompatibility(
  source: Record<string, unknown>,
  scope: EvidenceScopeV1,
): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    const sourceValue = text(source[key]);
    if (!sourceValue) continue;
    const canonicalValue = text(scope[key]);
    if (sourceValue !== canonicalValue) {
      throw new Error("B06C_SOURCE_SCOPE_MISMATCH:" + key);
    }
  }
}

function scalarParameters(value: unknown): {
  parameters: Record<string, string | number | boolean | null>;
  nestedOmitted: boolean;
} {
  const source = record(value);
  const parameters: Record<string, string | number | boolean | null> = {};
  let nestedOmitted = false;

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = text(rawKey);
    if (!key) continue;
    if (rawValue === null || typeof rawValue === "string" || typeof rawValue === "boolean") {
      parameters[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      parameters[key] = rawValue;
      continue;
    }
    nestedOmitted = true;
  }

  return { parameters, nestedOmitted };
}

function normalizedConfidence(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}

export function projectLegacyRecommendationCandidateV1(
  sourceValue: Record<string, unknown>,
  context: LegacyRecommendationCandidateProjectionContextV1,
): CandidateDecisionV1 {
  const source = record(sourceValue);
  assertNoDownstreamAuthority(source);
  assertCandidateLikeStatus(context.source_type, source);
  assertScopeCompatibility(source, context.scope);

  const fieldRef = text(context.scope.field_id);
  if (!fieldRef) {
    throw new Error("B06C_CANONICAL_FIELD_SCOPE_REQUIRED");
  }

  const actionType = text(source.action_type);
  if (!actionType) {
    throw new Error("B06C_TOP_LEVEL_ACTION_TYPE_REQUIRED");
  }

  const suggestedAction = record(source.suggested_action);
  const suggestedActionType = text(suggestedAction.action_type);
  const { parameters, nestedOmitted } = scalarParameters(suggestedAction.parameters);
  const reasons = uniqueText(source.reason_codes);
  const legacyEvidenceRefs = uniqueText(source.evidence_refs);
  const limitations = ["B06C_LEGACY_RECOMMENDATION_COMPATIBILITY_PROJECTION"];

  if (legacyEvidenceRefs.length > 0) {
    limitations.push("LEGACY_EVIDENCE_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION");
  }
  if (suggestedActionType && suggestedActionType !== actionType) {
    limitations.push("LEGACY_SUGGESTED_ACTION_TYPE_NOT_USED_AS_CANONICAL_ACTION_TYPE");
  }
  if (nestedOmitted) {
    limitations.push("LEGACY_NESTED_PARAMETERS_NOT_PROMOTED_TO_PARAMETERS_HINT");
  }
  if (source.created_ts != null) {
    limitations.push("LEGACY_CREATED_TS_NOT_USED_AS_CANONICAL_CREATED_AT");
  }
  if (context.source_type === "recommendation_v1" && !text(source.status)) {
    limitations.push("LEGACY_RECOMMENDATION_STATUS_ABSENT");
  }
  if (source.confidence != null && normalizedConfidence(source.confidence) === null) {
    limitations.push("LEGACY_CONFIDENCE_INVALID_NOT_PROMOTED");
  }

  return candidateDecisionV1Schema.parse({
    schema_version: "candidate_decision_v1",
    candidate_id: context.candidate_id,
    scope: context.scope,
    source_ref: context.source_ref,
    source_class: "LEGACY_RECOMMENDATION",
    proposed_action: {
      action_type: actionType,
      target: { kind: "field", ref: fieldRef },
      parameters_hint: parameters,
      action_spec_ref: null,
    },
    basis: {
      evidence_qualification_refs: uniqueText(context.evidence_qualification_refs),
      context_snapshot_ref: optionalRef(context.context_snapshot_ref),
      crop_stage_state_ref: optionalRef(context.crop_stage_state_ref),
      calculation_result_refs: uniqueText(context.calculation_result_refs),
      interpretation_refs: uniqueText(context.interpretation_refs),
      legacy_source_refs: uniqueText([
        context.source_ref,
        ...(context.legacy_source_refs ?? []),
      ]),
    },
    confidence: normalizedConfidence(source.confidence),
    reasons,
    limitations: uniqueText(limitations),
    decision_time: context.decision_time ?? null,
    created_at: context.created_at,
    authority_state: "CANDIDATE_ONLY",
  });
}
