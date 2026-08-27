import type { AgronomyRecommendationV2 } from "@geox/contracts";
import {
  candidateDecisionV1Schema,
  type CandidateDecisionV1,
} from "../../contracts/canonical_decision_v1.js";
import type { EvidenceScopeV1 } from "../../contracts/canonical_evidence_v1.js";

/**
 * B-06g compatibility adapter only.
 *
 * AgronomyRecommendationV2 is a legacy rule-engine recommendation object.
 * It may carry crop/stage labels, snapshot/telemetry provenance, expected
 * effects, and SkillTrace evidence. None of those fields become canonical
 * Context, Stage, EvidenceQualification, or CalculationResult authority here.
 *
 * This adapter creates a CandidateDecisionV1 compatibility view only.
 * No runtime consumer is connected.
 */

export type AgronomyRecommendationV2CandidateProjectionContextV1 = {
  candidate_id: string;
  source_ref: string;
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

const ALLOWED_RULE_ENGINE_ACTIONS = new Set([
  "IRRIGATE",
  "FERTILIZE",
  "INSPECT",
  "WAIT",
]);

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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function uniqueText(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function optionalRef(value: string | null | undefined): string | null {
  const normalized = text(value);
  return normalized || null;
}

function hasAuthorityValue(value: unknown): boolean {
  if (value == null || value === false || value === "") return false;
  return true;
}

function assertNoDownstreamAuthority(source: Record<string, unknown>): void {
  for (const key of DOWNSTREAM_SOURCE_KEYS) {
    if (hasAuthorityValue(source[key])) {
      throw new Error("B06G_SOURCE_ALREADY_CARRIES_DOWNSTREAM_AUTHORITY:" + key);
    }
  }
}

function normalizedConfidence(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}

function requiredText(source: Record<string, unknown>, key: string): string {
  const value = text(source[key]);
  if (!value) throw new Error("B06G_REQUIRED_SOURCE_FIELD_MISSING:" + key);
  return value;
}

export function projectAgronomyRecommendationV2CandidateV1(
  sourceValue: AgronomyRecommendationV2 | Record<string, unknown>,
  context: AgronomyRecommendationV2CandidateProjectionContextV1,
): CandidateDecisionV1 {
  const source = record(sourceValue);
  assertNoDownstreamAuthority(source);

  const recommendationId = requiredText(source, "recommendation_id");
  const cropCode = requiredText(source, "crop_code");
  const cropStage = requiredText(source, "crop_stage");
  const ruleId = requiredText(source, "rule_id");
  const actionType = requiredText(source, "action_type").toUpperCase();
  const reasons = uniqueText(source.reasons);

  if (!reasons.length) {
    throw new Error("B06G_RULE_ENGINE_REASONS_REQUIRED");
  }

  if (!ALLOWED_RULE_ENGINE_ACTIONS.has(actionType)) {
    throw new Error("B06G_RULE_ENGINE_ACTION_NOT_ALLOWED:" + actionType);
  }

  const canonicalFieldId = text(context.scope.field_id);
  if (!canonicalFieldId) {
    throw new Error("B06G_CANONICAL_FIELD_SCOPE_REQUIRED");
  }

  const evidenceBasis = record(source.evidence_basis);
  const legacySnapshotId = text(evidenceBasis.snapshot_id);
  const legacyTelemetryRefs = uniqueText(evidenceBasis.telemetry_refs);
  const skillTrace = record(source.skill_trace);
  const skillTraceEvidenceRefs = uniqueText(skillTrace.evidence_refs);
  const skillId = text(skillTrace.skill_id);
  const skillTraceId = text(skillTrace.trace_id);
  const expectedEffects = Array.isArray(source.expected_effect) ? source.expected_effect : [];
  const confidence = normalizedConfidence(source.confidence);
  const reasonCodesExtension = uniqueText(source.reason_codes);

  const limitations = [
    "B06G_AGRONOMY_RECOMMENDATION_V2_COMPATIBILITY_PROJECTION",
    "LEGACY_RULE_ENGINE_SCOPE_NOT_EMBEDDED_CANONICAL_SCOPE_EXPLICIT",
    "LEGACY_RULE_ENGINE_CROP_STAGE_NOT_CANONICAL_STAGE_AUTHORITY",
    "LEGACY_RULE_ENGINE_CROP_CODE_NOT_CANONICAL_CONTEXT_AUTHORITY",
  ];

  if (legacySnapshotId) {
    limitations.push("LEGACY_SNAPSHOT_NOT_PROMOTED_TO_CONTEXT_SNAPSHOT");
  }
  if (legacyTelemetryRefs.length > 0) {
    limitations.push("LEGACY_TELEMETRY_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION");
  }
  if (skillTraceEvidenceRefs.length > 0) {
    limitations.push("LEGACY_SKILL_TRACE_EVIDENCE_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION");
  }
  if (expectedEffects.length > 0) {
    limitations.push("LEGACY_EXPECTED_EFFECT_NOT_PROMOTED_TO_CALCULATION_RESULT");
  }
  if (skillTrace.confidence != null) {
    limitations.push("LEGACY_SKILL_TRACE_CONFIDENCE_NOT_USED_AS_CANDIDATE_CONFIDENCE");
  }
  if (source.confidence != null && confidence === null) {
    limitations.push("LEGACY_CONFIDENCE_INVALID_NOT_PROMOTED");
  }
  if (reasonCodesExtension.length > 0) {
    limitations.push("LEGACY_REASON_CODES_EXTENSION_NOT_USED_OVER_CONTRACT_REASONS");
  }

  return candidateDecisionV1Schema.parse({
    schema_version: "candidate_decision_v1",
    candidate_id: context.candidate_id,
    scope: context.scope,
    source_ref: context.source_ref,
    source_class: "LEGACY_RECOMMENDATION",
    proposed_action: {
      action_type: actionType,
      target: {
        kind: "field",
        ref: canonicalFieldId,
      },
      parameters_hint: {},
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
        "recommendation:" + recommendationId,
        "rule:" + ruleId,
        legacySnapshotId ? "legacy_snapshot:" + legacySnapshotId : "",
        ...legacyTelemetryRefs.map((ref) => "legacy_telemetry:" + ref),
        skillId ? "skill:" + skillId : "",
        skillTraceId ? "skill_trace:" + skillTraceId : "",
        ...skillTraceEvidenceRefs.map((ref) => "legacy_skill_evidence:" + ref),
        ...(context.legacy_source_refs ?? []),
      ]),
    },
    confidence,
    reasons,
    limitations: uniqueText(limitations),
    decision_time: context.decision_time ?? null,
    created_at: context.created_at,
    authority_state: "CANDIDATE_ONLY",
  });
}
