import type { Pool } from "pg";
import type { JudgeResultV2 } from "@geox/contracts";

import {
  evidenceSemanticShadowInventoryV1Schema,
  semanticShadowComparisonV1Schema,
  type EvidenceSemanticShadowInventoryV1,
  type SemanticShadowComparisonV1,
} from "../../contracts/semantic_migration_v1.js";
import { listJudgeResultsV2 } from "../judge/judge_result_v2.js";

export type EvidenceSemanticShadowInventoryScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function observedAtIso(result: JudgeResultV2): string {
  const createdTs = Number(result.created_ts_ms);
  if (Number.isFinite(createdTs) && createdTs > 0) {
    return new Date(createdTs).toISOString();
  }
  const parsed = Date.parse(String(result.created_at ?? ""));
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  throw new Error("B09D_JUDGE_RESULT_OBSERVED_TIME_REQUIRED");
}

function validEvidenceComparison(
  value: unknown,
): SemanticShadowComparisonV1 | null {
  const parsed = semanticShadowComparisonV1Schema.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.semantic_id !== "evidence.qualification") return null;
  if (parsed.data.legacy_producer_id !== "evidence-judge-v2") return null;
  return parsed.data;
}

/**
 * B-09d read-only inventory over persisted B-09c comparison outputs.
 *
 * Historical Judge rows that do not contain a valid B-09c comparison are
 * counted as UNOBSERVED. They are never reinterpreted as MATCH, DIVERGENT,
 * CANONICAL_MISSING, or LEGACY_MISSING.
 *
 * Missing states are counted only when a valid persisted
 * SemanticShadowComparisonV1 explicitly records them.
 */
export function buildEvidenceSemanticShadowInventoryV1(
  scope: EvidenceSemanticShadowInventoryScopeV1,
  results: JudgeResultV2[],
): EvidenceSemanticShadowInventoryV1 {
  const items: EvidenceSemanticShadowInventoryV1["items"] = [];
  const stateCounts: EvidenceSemanticShadowInventoryV1["state_counts"] = {
    MATCH: 0,
    DIVERGENT: 0,
    INCOMPARABLE: 0,
    CANONICAL_MISSING: 0,
    LEGACY_MISSING: 0,
  };
  let unobservedLegacyResultCount = 0;
  let malformedComparisonCount = 0;

  for (const result of results) {
    if (String(result.judge_kind ?? "").toUpperCase() !== "EVIDENCE") continue;

    const outputs = asRecord(result.outputs);
    const rawComparison = outputs.semantic_shadow_comparison_v1;
    if (rawComparison == null) {
      unobservedLegacyResultCount += 1;
      continue;
    }

    const comparison = validEvidenceComparison(rawComparison);
    if (!comparison) {
      malformedComparisonCount += 1;
      unobservedLegacyResultCount += 1;
      continue;
    }

    stateCounts[comparison.comparison_state] += 1;
    items.push({
      judge_id: String(result.judge_id),
      comparison_id: comparison.comparison_id,
      comparison_state: comparison.comparison_state,
      decision_time: comparison.decision_time,
      scope_ref: comparison.scope_ref,
      divergence_codes: Array.from(
        new Set(comparison.divergences.map((entry) => entry.code)),
      ).sort(),
      comparison_basis_refs: Array.from(
        new Set(comparison.comparison_basis_refs),
      ),
      observed_at: observedAtIso(result),
      authority_state: "SHADOW_ONLY",
      authority_removal_permitted: false,
    });
  }

  return evidenceSemanticShadowInventoryV1Schema.parse({
    schema_version: "evidence_semantic_shadow_inventory_v1",
    semantic_id: "evidence.qualification",
    source: "JUDGE_RESULT_V2_PERSISTED_OUTPUTS",
    scope: {
      tenant_id: scope.tenant_id,
      project_id: scope.project_id,
      group_id: scope.group_id,
      field_id: scope.field_id ?? null,
    },
    observed_comparison_count: items.length,
    unobserved_legacy_result_count: unobservedLegacyResultCount,
    malformed_comparison_count: malformedComparisonCount,
    state_counts: stateCounts,
    items,
    limitations: [
      "B09D_READ_ONLY_PERSISTED_SHADOW_INVENTORY",
      "UNOBSERVED_LEGACY_ROWS_ARE_NOT_INTERPRETED_AS_SEMANTIC_COMPARISON_STATES",
      "MATCH_DOES_NOT_AUTHORIZE_AUTHORITY_REMOVAL",
      "DIVERGENCE_DOES_NOT_REWRITE_LEGACY_AUTHORITY",
      "INVENTORY_DOES_NOT_PERFORM_CONSUMER_MIGRATION",
    ],
    authority_state: "SHADOW_ONLY",
    authority_removal_permitted: false,
    consumer_migration_permitted: false,
    removal_readiness: "NOT_AUTHORIZED_BY_INVENTORY",
  });
}

export async function readEvidenceSemanticShadowInventoryV1(
  pool: Pool,
  input: EvidenceSemanticShadowInventoryScopeV1 & { limit?: number },
): Promise<EvidenceSemanticShadowInventoryV1> {
  const results = await listJudgeResultsV2(pool, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id ?? undefined,
    judge_kind: "EVIDENCE",
    limit: Math.max(1, Math.min(200, Number(input.limit ?? 200) || 200)),
  });

  return buildEvidenceSemanticShadowInventoryV1(input, results);
}
