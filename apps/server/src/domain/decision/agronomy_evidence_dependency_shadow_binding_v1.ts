import type { Pool } from "pg";
import type { JudgeResultV2 } from "@geox/contracts";
import { z } from "zod";

import { semanticShadowComparisonV1Schema } from "../../contracts/semantic_migration_v1.js";
import { loadJudgeResultV2 } from "../judge/judge_result_v2.js";

const canonicalSufficiencyShadowSchema = z
  .object({
    schema_version: z.literal("evidence_judge_canonical_sufficiency_shadow_v1"),
    authority_mode: z.literal("SHADOW_NON_AUTHORITATIVE"),
    status: z.enum(["SUFFICIENT", "NEEDS_EVIDENCE", "UNKNOWN"]),
  })
  .passthrough();

export const agronomyEvidenceDependencyShadowBindingV1Schema = z
  .object({
    schema_version: z.literal("agronomy_evidence_dependency_shadow_binding_v1"),
    authority_mode: z.literal("SHADOW_NON_AUTHORITATIVE"),
    binding_state: z.enum([
      "NOT_REQUESTED",
      "EVIDENCE_JUDGE_NOT_FOUND",
      "EVIDENCE_JUDGE_KIND_INVALID",
      "FIELD_SCOPE_NOT_ESTABLISHED",
      "FIELD_SCOPE_MISMATCH",
      "LEGACY_VERDICT_MISSING",
      "LEGACY_VERDICT_MISMATCH",
      "CANONICAL_SHADOW_MISSING",
      "CANONICAL_SHADOW_UNKNOWN",
      "SEMANTIC_COMPARISON_MISSING",
      "BOUND",
      "BINDING_READ_ERROR",
    ]),
    evidence_judge_id: z.string().min(1).nullable(),
    evidence_judge_ref: z.string().min(1).nullable(),
    requested_field_id: z.string().min(1).nullable(),
    persisted_field_id: z.string().min(1).nullable(),
    request_legacy_verdict: z.string().min(1).nullable(),
    persisted_legacy_verdict: z.string().min(1).nullable(),
    legacy_verdict_match: z.boolean().nullable(),
    canonical_sufficiency_status: z
      .enum(["SUFFICIENT", "NEEDS_EVIDENCE", "UNKNOWN"])
      .nullable(),
    semantic_comparison_state: z
      .enum(["MATCH", "DIVERGENT", "INCOMPARABLE", "CANONICAL_MISSING", "LEGACY_MISSING"])
      .nullable(),
    canonical_evidence_qualification_refs_state: z.enum([
      "UNAVAILABLE",
      "NOT_PERSISTED_IN_EVIDENCE_JUDGE_OUTPUT",
    ]),
    target_boundary: z.literal(
      "B07_QUALIFIED_EVIDENCE_CRITERION_THEN_DECISION_ELIGIBILITY",
    ),
    migration_readiness: z.literal("NOT_READY_FOR_CRITERION_CUTOVER"),
    reason_codes: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    legacy_consumer_unchanged: z.literal(true),
    consumer_migration_performed: z.literal(false),
    authority_removal_permitted: z.literal(false),
  })
  .strict();

export type AgronomyEvidenceDependencyShadowBindingV1 = z.infer<
  typeof agronomyEvidenceDependencyShadowBindingV1Schema
>;

export type AgronomyEvidenceDependencyShadowBindingInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id?: string | null;
  evidence_judge_id?: string | null;
  evidence_judge_verdict?: string | null;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function upper(value: unknown): string {
  return text(value).toUpperCase();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildBinding(
  input: AgronomyEvidenceDependencyShadowBindingInputV1,
  state: AgronomyEvidenceDependencyShadowBindingV1["binding_state"],
  detail: {
    result?: JudgeResultV2 | null;
    canonicalStatus?: AgronomyEvidenceDependencyShadowBindingV1["canonical_sufficiency_status"];
    comparisonState?: AgronomyEvidenceDependencyShadowBindingV1["semantic_comparison_state"];
    legacyVerdictMatch?: boolean | null;
    reasonCodes?: string[];
  } = {},
): AgronomyEvidenceDependencyShadowBindingV1 {
  const evidenceJudgeId = text(input.evidence_judge_id) || null;
  const result = detail.result ?? null;
  const canonicalStatus = detail.canonicalStatus ?? null;
  const comparisonState = detail.comparisonState ?? null;

  return agronomyEvidenceDependencyShadowBindingV1Schema.parse({
    schema_version: "agronomy_evidence_dependency_shadow_binding_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    binding_state: state,
    evidence_judge_id: evidenceJudgeId,
    evidence_judge_ref:
      evidenceJudgeId && result
        ? "judge_result_v2:" + evidenceJudgeId
        : null,
    requested_field_id: text(input.field_id) || null,
    persisted_field_id: text(result?.field_id) || null,
    request_legacy_verdict: upper(input.evidence_judge_verdict) || null,
    persisted_legacy_verdict: upper(result?.verdict) || null,
    legacy_verdict_match: detail.legacyVerdictMatch ?? null,
    canonical_sufficiency_status: canonicalStatus,
    semantic_comparison_state: comparisonState,
    canonical_evidence_qualification_refs_state:
      canonicalStatus && canonicalStatus !== "UNKNOWN"
        ? "NOT_PERSISTED_IN_EVIDENCE_JUDGE_OUTPUT"
        : "UNAVAILABLE",
    target_boundary:
      "B07_QUALIFIED_EVIDENCE_CRITERION_THEN_DECISION_ELIGIBILITY",
    migration_readiness: "NOT_READY_FOR_CRITERION_CUTOVER",
    reason_codes: Array.from(new Set(detail.reasonCodes ?? [state])),
    limitations: [
      "B09F_SHADOW_BINDING_NON_AUTHORITATIVE",
      "AGRONOMY_LEGACY_VERDICT_REMAINS_UNCHANGED",
      "CANONICAL_EVIDENCE_SUFFICIENCY_SHADOW_IS_NOT_DECISION_ELIGIBILITY",
      "EVIDENCE_QUALIFICATION_REFS_NOT_PERSISTED_IN_EVIDENCE_JUDGE_OUTPUT",
      "NO_CANONICAL_CRITERION_CUTOVER_IN_B09F",
      "NO_AUTHORITY_REMOVAL_IN_B09F",
    ],
    legacy_consumer_unchanged: true,
    consumer_migration_performed: false,
    authority_removal_permitted: false,
  });
}

export function projectAgronomyEvidenceDependencyShadowBindingV1(
  input: AgronomyEvidenceDependencyShadowBindingInputV1,
  result: JudgeResultV2 | null,
): AgronomyEvidenceDependencyShadowBindingV1 {
  const evidenceJudgeId = text(input.evidence_judge_id);
  if (!evidenceJudgeId) {
    return buildBinding(input, "NOT_REQUESTED", {
      reasonCodes: ["EVIDENCE_JUDGE_ID_NOT_SUPPLIED"],
    });
  }

  if (!result) {
    return buildBinding(input, "EVIDENCE_JUDGE_NOT_FOUND", {
      reasonCodes: ["SCOPED_EVIDENCE_JUDGE_RESULT_NOT_FOUND"],
    });
  }

  if (upper(result.judge_kind) !== "EVIDENCE") {
    return buildBinding(input, "EVIDENCE_JUDGE_KIND_INVALID", {
      result,
      reasonCodes: ["REFERENCED_JUDGE_RESULT_NOT_EVIDENCE_KIND"],
    });
  }

  const requestedField = text(input.field_id);
  const persistedField = text(result.field_id);
  if (!requestedField || !persistedField) {
    return buildBinding(input, "FIELD_SCOPE_NOT_ESTABLISHED", {
      result,
      reasonCodes: ["BOTH_AGRONOMY_AND_EVIDENCE_FIELD_SCOPE_REQUIRED_FOR_BINDING"],
    });
  }
  if (requestedField !== persistedField) {
    return buildBinding(input, "FIELD_SCOPE_MISMATCH", {
      result,
      reasonCodes: ["AGRONOMY_EVIDENCE_FIELD_SCOPE_MISMATCH"],
    });
  }

  const requestedVerdict = upper(input.evidence_judge_verdict);
  const persistedVerdict = upper(result.verdict);
  if (!requestedVerdict) {
    return buildBinding(input, "LEGACY_VERDICT_MISSING", {
      result,
      legacyVerdictMatch: null,
      reasonCodes: ["CALLER_INJECTED_LEGACY_VERDICT_MISSING"],
    });
  }
  if (requestedVerdict !== persistedVerdict) {
    return buildBinding(input, "LEGACY_VERDICT_MISMATCH", {
      result,
      legacyVerdictMatch: false,
      reasonCodes: ["CALLER_INJECTED_VERDICT_DOES_NOT_MATCH_PERSISTED_EVIDENCE_JUDGE"],
    });
  }

  const outputs = record(result.outputs);
  const canonicalParsed = canonicalSufficiencyShadowSchema.safeParse(
    outputs.canonical_evidence_sufficiency_shadow_v1,
  );
  if (!canonicalParsed.success) {
    return buildBinding(input, "CANONICAL_SHADOW_MISSING", {
      result,
      legacyVerdictMatch: true,
      reasonCodes: ["PERSISTED_CANONICAL_EVIDENCE_SUFFICIENCY_SHADOW_MISSING"],
    });
  }

  const comparisonParsed = semanticShadowComparisonV1Schema.safeParse(
    outputs.semantic_shadow_comparison_v1,
  );
  const comparison =
    comparisonParsed.success &&
    comparisonParsed.data.semantic_id === "evidence.qualification" &&
    comparisonParsed.data.legacy_producer_id === "evidence-judge-v2"
      ? comparisonParsed.data
      : null;

  const canonicalStatus = canonicalParsed.data.status;
  if (canonicalStatus === "UNKNOWN") {
    return buildBinding(input, "CANONICAL_SHADOW_UNKNOWN", {
      result,
      canonicalStatus,
      comparisonState: comparison?.comparison_state ?? null,
      legacyVerdictMatch: true,
      reasonCodes: ["CANONICAL_EVIDENCE_SUFFICIENCY_UNKNOWN_AT_REFERENCED_JUDGE"],
    });
  }

  if (!comparison) {
    return buildBinding(input, "SEMANTIC_COMPARISON_MISSING", {
      result,
      canonicalStatus,
      legacyVerdictMatch: true,
      reasonCodes: ["B09C_SEMANTIC_COMPARISON_MISSING_AT_REFERENCED_JUDGE"],
    });
  }

  return buildBinding(input, "BOUND", {
    result,
    canonicalStatus,
    comparisonState: comparison.comparison_state,
    legacyVerdictMatch: true,
    reasonCodes: [
      "PERSISTED_EVIDENCE_JUDGE_REFERENCE_BOUND",
      "CALLER_LEGACY_VERDICT_MATCHES_PERSISTED_EVIDENCE_JUDGE",
      "CANONICAL_SUFFICIENCY_SHADOW_OBSERVED",
      "B09C_SEMANTIC_COMPARISON_OBSERVED",
      "CANONICAL_QUALIFICATION_REFS_STILL_REQUIRED_BEFORE_B07_CRITERION_CUTOVER",
    ],
  });
}

export async function buildAgronomyEvidenceDependencyShadowBindingV1(
  pool: Pool,
  input: AgronomyEvidenceDependencyShadowBindingInputV1,
): Promise<AgronomyEvidenceDependencyShadowBindingV1> {
  const evidenceJudgeId = text(input.evidence_judge_id);
  if (!evidenceJudgeId) {
    return projectAgronomyEvidenceDependencyShadowBindingV1(input, null);
  }

  try {
    const result = await loadJudgeResultV2(pool, {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      judge_id: evidenceJudgeId,
    });
    return projectAgronomyEvidenceDependencyShadowBindingV1(input, result);
  } catch {
    return buildBinding(input, "BINDING_READ_ERROR", {
      reasonCodes: ["SCOPED_EVIDENCE_JUDGE_BINDING_READ_FAILED"],
    });
  }
}
