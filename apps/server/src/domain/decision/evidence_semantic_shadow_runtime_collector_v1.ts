import type { JudgeResultV2 } from "@geox/contracts";

import type { SemanticShadowComparisonV1 } from "../../contracts/semantic_migration_v1.js";
import { compareEvidenceJudgeToCanonicalEvidenceShadowV1 } from "./evidence_semantic_shadow_comparator_v1.js";

/**
 * B-09c Evidence-family runtime shadow collection seam.
 *
 * This seam consumes only the already-built legacy Evidence Judge result and
 * the already-existing B-04 canonical sufficiency shadow carried in that same
 * JudgeResultV2. It does not recompute EvidenceQualification, mutate the
 * legacy verdict, create eligibility/approval/plan/task authority, or invoke
 * any MCFT / ADR / LLM integration.
 *
 * Collection failure is intentionally fail-open with respect to the historical
 * Judge route: a missing/malformed shadow returns null and must never change
 * the legacy result or make the authoritative compatibility path fail.
 */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function decisionTimeIso(result: JudgeResultV2): string | null {
  const inputNow = Number(asRecord(result.inputs).now_ts_ms);
  const created = Number(result.created_ts_ms);
  const chosen = Number.isFinite(inputNow) && inputNow > 0
    ? inputNow
    : Number.isFinite(created) && created > 0
      ? created
      : null;

  if (chosen == null) return null;
  const iso = new Date(chosen).toISOString();
  return Number.isFinite(Date.parse(iso)) ? iso : null;
}

function scopeRef(result: JudgeResultV2): string | null {
  const tenant = text(result.tenant_id);
  const project = text(result.project_id);
  const group = text(result.group_id);
  const field = text(result.field_id);
  if (!tenant || !project || !group || !field) return null;
  return [
    "tenant:" + tenant,
    "project:" + project,
    "group:" + group,
    "field:" + field,
  ].join("/");
}

export function collectEvidenceJudgeSemanticShadowComparisonV1(
  result: JudgeResultV2,
): SemanticShadowComparisonV1 | null {
  try {
    if (text(result.judge_kind).toUpperCase() !== "EVIDENCE") return null;

    const judgeId = text(result.judge_id);
    if (!judgeId) return null;

    const outputs = asRecord(result.outputs);
    const canonical = asRecord(outputs.canonical_evidence_sufficiency_shadow_v1);
    if (
      text(canonical.schema_version) !== "evidence_judge_canonical_sufficiency_shadow_v1" ||
      text(canonical.authority_mode) !== "SHADOW_NON_AUTHORITATIVE"
    ) {
      return null;
    }

    const legacyRef = "judge_result_v2:" + judgeId;
    const canonicalRef =
      legacyRef + "#outputs.canonical_evidence_sufficiency_shadow_v1";

    return compareEvidenceJudgeToCanonicalEvidenceShadowV1(
      {
        judge_kind: result.judge_kind,
        verdict: result.verdict,
      },
      canonical,
      {
        comparison_id: "b09c:evidence-judge:" + judgeId,
        legacy_producer_id: "evidence-judge-v2",
        canonical_owner_ref:
          "evidence.qualification:canonical-evidence-qualification-shadow",
        legacy_ref: legacyRef,
        canonical_ref: canonicalRef,
        scope_ref: scopeRef(result),
        decision_time: decisionTimeIso(result),
        comparison_basis_refs: [legacyRef, canonicalRef],
      },
    );
  } catch {
    return null;
  }
}
