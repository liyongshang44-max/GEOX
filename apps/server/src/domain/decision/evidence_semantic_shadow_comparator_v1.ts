import type {
  EvidenceJudgeCanonicalSufficiencyShadowV1,
} from "../judge/evidence_judge_v2.js";
import type {
  Stage1FormalTriggerGateV1,
} from "./stage1_action_boundary_v1.js";
import {
  semanticShadowComparisonV1Schema,
  type SemanticShadowComparisonV1,
} from "../../contracts/semantic_migration_v1.js";

/**
 * B-09b pure Evidence-family shadow comparator.
 *
 * It compares legacy coarse sufficiency semantics with the already-existing
 * B-04 canonical EvidenceQualification sufficiency shadow.
 *
 * It never changes either source result and every output is SHADOW_ONLY with
 * authority_removal_permitted=false.
 */

export type EvidenceSemanticShadowComparisonContextV1 = {
  comparison_id: string;
  legacy_producer_id: "evidence-judge-v2" | "stage1-formal-gate";
  canonical_owner_ref: string;
  legacy_ref?: string | null;
  canonical_ref?: string | null;
  scope_ref?: string | null;
  decision_time?: string | null;
  comparison_basis_refs?: string[];
};

type CoarseEvidenceSufficiencyV1 = "SUFFICIENT" | "NEEDS_EVIDENCE" | "UNKNOWN";

const LEGACY_EVIDENCE_JUDGE_NEEDS_EVIDENCE = new Set([
  "DEVICE_OFFLINE",
  "SENSOR_DRIFT",
  "STALE_DATA",
  "INSUFFICIENT_EVIDENCE",
]);

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function uniqueText(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function evidenceJudgeCoarseState(verdictValue: unknown): CoarseEvidenceSufficiencyV1 {
  const verdict = text(verdictValue).toUpperCase();
  if (verdict === "PASS") return "SUFFICIENT";
  if (LEGACY_EVIDENCE_JUDGE_NEEDS_EVIDENCE.has(verdict)) return "NEEDS_EVIDENCE";
  return "UNKNOWN";
}

function stage1CoarseState(
  gate: Stage1FormalTriggerGateV1 | Record<string, unknown>,
): CoarseEvidenceSufficiencyV1 | "NO_FORMAL_SIGNAL" {
  const status = text((gate as Record<string, unknown>)?.status).toUpperCase();
  const reasonCodes = uniqueText((gate as Record<string, unknown>)?.reason_codes);

  if (status === "ELIGIBLE") return "SUFFICIENT";
  if (status === "NEEDS_EVIDENCE") return "NEEDS_EVIDENCE";
  if (status === "NOT_ELIGIBLE" && reasonCodes.includes("NO_FORMAL_STAGE1_SIGNAL")) {
    return "NO_FORMAL_SIGNAL";
  }
  return "UNKNOWN";
}

function canonicalCoarseState(
  canonical: EvidenceJudgeCanonicalSufficiencyShadowV1 | Record<string, unknown>,
): CoarseEvidenceSufficiencyV1 {
  const status = text((canonical as Record<string, unknown>)?.status).toUpperCase();
  if (status === "SUFFICIENT") return "SUFFICIENT";
  if (status === "NEEDS_EVIDENCE") return "NEEDS_EVIDENCE";
  return "UNKNOWN";
}

function compareCoarseStates(input: {
  context: EvidenceSemanticShadowComparisonContextV1;
  legacy_state: CoarseEvidenceSufficiencyV1;
  canonical_state: CoarseEvidenceSufficiencyV1;
  legacy_ref?: string | null;
  canonical_ref?: string | null;
  limitations: string[];
}): SemanticShadowComparisonV1 {
  const { context, legacy_state: legacyState, canonical_state: canonicalState } = input;

  if (legacyState === "UNKNOWN" || canonicalState === "UNKNOWN") {
    return semanticShadowComparisonV1Schema.parse({
      schema_version: "semantic_shadow_comparison_v1",
      comparison_id: context.comparison_id,
      semantic_id: "evidence.qualification",
      legacy_producer_id: context.legacy_producer_id,
      canonical_owner_ref: context.canonical_owner_ref,
      scope_ref: context.scope_ref ?? null,
      decision_time: context.decision_time ?? null,
      comparable_dimensions: ["VERDICT", "EVIDENCE_BASIS", "AUTHORITY_CLASS"],
      comparison_state: "INCOMPARABLE",
      divergences: [{
        dimension: "VERDICT",
        code:
          legacyState === "UNKNOWN"
            ? "LEGACY_COARSE_EVIDENCE_STATE_UNKNOWN"
            : "CANONICAL_EVIDENCE_SUFFICIENCY_UNKNOWN",
        legacy_ref: input.legacy_ref ?? null,
        canonical_ref: input.canonical_ref ?? null,
      }],
      comparison_basis_refs: uniqueText(context.comparison_basis_refs),
      limitations: uniqueText([
        "B09B_EVIDENCE_SHADOW_COARSE_SUFFICIENCY_ONLY",
        "INCOMPARABLE_STATE_CANNOT_SUPPORT_AUTHORITY_REMOVAL",
        ...input.limitations,
      ]),
      authority_removal_permitted: false,
      authority_state: "SHADOW_ONLY",
    });
  }

  const match = legacyState === canonicalState;
  return semanticShadowComparisonV1Schema.parse({
    schema_version: "semantic_shadow_comparison_v1",
    comparison_id: context.comparison_id,
    semantic_id: "evidence.qualification",
    legacy_producer_id: context.legacy_producer_id,
    canonical_owner_ref: context.canonical_owner_ref,
    scope_ref: context.scope_ref ?? null,
    decision_time: context.decision_time ?? null,
    comparable_dimensions: ["VERDICT", "EVIDENCE_BASIS", "AUTHORITY_CLASS"],
    comparison_state: match ? "MATCH" : "DIVERGENT",
    divergences: match
      ? []
      : [{
          dimension: "VERDICT",
          code:
            legacyState === "NEEDS_EVIDENCE" && canonicalState === "SUFFICIENT"
              ? "LEGACY_REJECTS_WHILE_INDEPENDENT_CANONICAL_EVIDENCE_REMAINS_SUFFICIENT"
              : "LEGACY_CANONICAL_EVIDENCE_SUFFICIENCY_DISAGREE",
          legacy_ref: input.legacy_ref ?? null,
          canonical_ref: input.canonical_ref ?? null,
        }],
    comparison_basis_refs: uniqueText(context.comparison_basis_refs),
    limitations: uniqueText([
      "B09B_EVIDENCE_SHADOW_COARSE_SUFFICIENCY_ONLY",
      "MATCH_DOES_NOT_PROVE_FIELD_LEVEL_SEMANTIC_EQUIVALENCE",
      ...input.limitations,
    ]),
    authority_removal_permitted: false,
    authority_state: "SHADOW_ONLY",
  });
}

export function compareEvidenceJudgeToCanonicalEvidenceShadowV1(
  legacy: Record<string, unknown>,
  canonical: EvidenceJudgeCanonicalSufficiencyShadowV1 | Record<string, unknown>,
  context: EvidenceSemanticShadowComparisonContextV1,
): SemanticShadowComparisonV1 {
  if (context.legacy_producer_id !== "evidence-judge-v2") {
    throw new Error("B09B_EVIDENCE_JUDGE_PRODUCER_ID_REQUIRED");
  }
  if (text(legacy.judge_kind).toUpperCase() !== "EVIDENCE") {
    throw new Error("B09B_EVIDENCE_JUDGE_RESULT_REQUIRED");
  }

  const legacyState = evidenceJudgeCoarseState(legacy.verdict);
  const canonicalState = canonicalCoarseState(canonical);

  return compareCoarseStates({
    context,
    legacy_state: legacyState,
    canonical_state: canonicalState,
    legacy_ref: context.legacy_ref ?? null,
    canonical_ref: context.canonical_ref ?? null,
    limitations: [
      "LEGACY_EVIDENCE_JUDGE_SKILL_VERDICT_NOT_CANONICAL_EVIDENCE_AUTHORITY",
      "CANONICAL_SIDE_DERIVED_FROM_B04_EVIDENCE_QUALIFICATION_SHADOW",
    ],
  });
}

export function compareStage1GateToCanonicalEvidenceShadowV1(
  gate: Stage1FormalTriggerGateV1 | Record<string, unknown>,
  canonical: EvidenceJudgeCanonicalSufficiencyShadowV1 | Record<string, unknown>,
  context: EvidenceSemanticShadowComparisonContextV1,
): SemanticShadowComparisonV1 {
  if (context.legacy_producer_id !== "stage1-formal-gate") {
    throw new Error("B09B_STAGE1_PRODUCER_ID_REQUIRED");
  }

  const legacyState = stage1CoarseState(gate);
  const canonicalState = canonicalCoarseState(canonical);

  if (legacyState === "NO_FORMAL_SIGNAL") {
    return semanticShadowComparisonV1Schema.parse({
      schema_version: "semantic_shadow_comparison_v1",
      comparison_id: context.comparison_id,
      semantic_id: "evidence.qualification",
      legacy_producer_id: context.legacy_producer_id,
      canonical_owner_ref: context.canonical_owner_ref,
      scope_ref: context.scope_ref ?? null,
      decision_time: context.decision_time ?? null,
      comparable_dimensions: ["VERDICT", "EVIDENCE_BASIS", "AUTHORITY_CLASS"],
      comparison_state: "INCOMPARABLE",
      divergences: [{
        dimension: "AUTHORITY_CLASS",
        code: "STAGE1_NOT_ELIGIBLE_IS_TRIGGER_ABSENCE_NOT_EVIDENCE_CONCLUSION",
        legacy_ref: context.legacy_ref ?? null,
        canonical_ref: context.canonical_ref ?? null,
      }],
      comparison_basis_refs: uniqueText(context.comparison_basis_refs),
      limitations: [
        "B09B_STAGE1_TRIGGER_ABSENCE_NOT_EVIDENCE_VERDICT",
        "INCOMPARABLE_STATE_CANNOT_SUPPORT_AUTHORITY_REMOVAL",
      ],
      authority_removal_permitted: false,
      authority_state: "SHADOW_ONLY",
    });
  }

  return compareCoarseStates({
    context,
    legacy_state: legacyState,
    canonical_state: canonicalState,
    legacy_ref: context.legacy_ref ?? null,
    canonical_ref: context.canonical_ref ?? null,
    limitations: [
      "STAGE1_GATE_MIXES_TRIGGER_AND_EVIDENCE_PRECURSOR_SEMANTICS",
      "CANONICAL_SIDE_DERIVED_FROM_B04_EVIDENCE_QUALIFICATION_SHADOW",
    ],
  });
}
