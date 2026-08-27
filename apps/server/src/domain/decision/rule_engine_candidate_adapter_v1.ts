import type { AgronomyRecommendationV2 } from "@geox/contracts";

import {
  candidateDecisionV1Schema,
  type CandidateDecisionV1,
} from "../../contracts/canonical_decision_v1.js";
import type { EvidenceScopeV1 } from "../../contracts/canonical_evidence_v1.js";

/**
 * B-06d compatibility adapter only.
 *
 * This module projects the legacy Rule Engine AgronomyRecommendationV2 shape
 * into CandidateDecisionV1 without changing or invoking the Rule Engine.
 *
 * It does not qualify Evidence, establish Context/Stage authority, create
 * CalculationResult, Decision Eligibility, Approval, OperationPlan, Task, or
 * connect any runtime consumer.
 */

export type RuleEngineCandidateProjectionContextV1 = {
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

const RULE_ENGINE_ACTIONS = new Set([
  "IRRIGATE",
  "FERTILIZE",
  "INSPECT",
  "WAIT",
]);

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

function assertRuleRecommendationShape(value: AgronomyRecommendationV2): void {
  if (!text(value.recommendation_id)) {
    throw new Error("B06D_RULE_RECOMMENDATION_ID_REQUIRED");
  }
  if (!text(value.crop_code)) {
    throw new Error("B06D_RULE_CROP_CODE_REQUIRED");
  }
  if (!text(value.crop_stage)) {
    throw new Error("B06D_RULE_CROP_STAGE_REQUIRED");
  }
  if (!text(value.rule_id)) {
    throw new Error("B06D_RULE_ID_REQUIRED");
  }

  const actionType = text(value.action_type);
  if (!RULE_ENGINE_ACTIONS.has(actionType)) {
    throw new Error("B06D_RULE_ACTION_TYPE_INVALID:" + (actionType || "MISSING"));
  }

  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("B06D_RULE_CONFIDENCE_INVALID");
  }
}

export function projectRuleEngineRecommendationCandidateV1(
  recommendation: AgronomyRecommendationV2,
  context: RuleEngineCandidateProjectionContextV1,
): CandidateDecisionV1 {
  assertRuleRecommendationShape(recommendation);

  const fieldRef = text(context.scope.field_id);
  if (!fieldRef) {
    throw new Error("B06D_CANONICAL_FIELD_SCOPE_REQUIRED");
  }

  const telemetryRefs = uniqueText(recommendation.evidence_basis?.telemetry_refs);
  const limitations = [
    "B06D_RULE_ENGINE_COMPATIBILITY_PROJECTION",
    "LEGACY_CROP_CODE_NOT_PROMOTED_TO_CANONICAL_CONTEXT_AUTHORITY",
    "LEGACY_CROP_STAGE_NOT_PROMOTED_TO_CANONICAL_STAGE_AUTHORITY",
  ];

  if (telemetryRefs.length > 0) {
    limitations.push("LEGACY_TELEMETRY_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION");
  }
  if (Array.isArray(recommendation.expected_effect) && recommendation.expected_effect.length > 0) {
    limitations.push("LEGACY_EXPECTED_EFFECT_NOT_PROMOTED_TO_ACTION_PARAMETERS");
  }
  if (recommendation.skill_trace) {
    limitations.push("LEGACY_SKILL_TRACE_NOT_PROMOTED_TO_CANONICAL_BASIS");
  }

  return candidateDecisionV1Schema.parse({
    schema_version: "candidate_decision_v1",
    candidate_id: context.candidate_id,
    scope: context.scope,
    source_ref: context.source_ref,
    source_class: "LEGACY_RECOMMENDATION",
    proposed_action: {
      action_type: text(recommendation.action_type),
      target: { kind: "field", ref: fieldRef },
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
        ...(context.legacy_source_refs ?? []),
      ]),
    },
    confidence: Number(recommendation.confidence),
    reasons: uniqueText(recommendation.reasons),
    limitations: uniqueText(limitations),
    decision_time: context.decision_time ?? null,
    created_at: context.created_at,
    authority_state: "CANDIDATE_ONLY",
  });
}
