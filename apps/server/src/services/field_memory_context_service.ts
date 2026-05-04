import type { Pool, PoolClient, QueryResult } from "pg";

type DbConn = Pool | PoolClient;

type LoadFieldMemoryContextInput = {
  tenant_id: string;
  project_id?: string;
  group_id?: string;
  field_id: string;
  season_id?: string;
  recommendation_id?: string;
  lookback_limit?: number;
};

export type FieldMemoryContextForRecommendation = {
  memory_refs: string[];

  weak_response_detected: boolean;
  weak_response_count: number;

  device_reliability_risk: boolean;
  skill_performance_risk: boolean;

  recommended_confidence_adjustment: "NONE" | "LOWER_ONE_LEVEL";
  requires_manual_review: boolean;

  risk_reasons: string[];
  explain_notes: string[];
};

function asNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asIso(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  return new Date(0).toISOString();
}

export async function loadFieldMemoryContextForRecommendation(
  pool: DbConn,
  input: LoadFieldMemoryContextInput,
): Promise<FieldMemoryContextForRecommendation> {
  const limit = Math.max(10, Math.min(200, Math.floor(input.lookback_limit ?? 50)));

  const rows = (await pool.query(
    `SELECT memory_id, memory_type, delta_value, metric_value, confidence, summary_text, occurred_at
       FROM field_memory_v1
      WHERE tenant_id = $1
        AND field_id = $2
        AND ($3::text IS NULL OR project_id = $3)
        AND ($4::text IS NULL OR group_id = $4)
        AND ($5::text IS NULL OR season_id = $5)
      ORDER BY occurred_at DESC
      LIMIT $6`,
    [
      input.tenant_id,
      input.field_id,
      input.project_id ?? null,
      input.group_id ?? null,
      input.season_id ?? null,
      limit,
    ],
  )) as QueryResult<any>;

  const recent = [...rows.rows].sort((a, b) => asIso(b.occurred_at).localeCompare(asIso(a.occurred_at)));
  const memory_refs = recent.map((row) => String(row.memory_id ?? "")).filter(Boolean);

  let weak_response_count = 0;
  let deviceFailureCount = 0;
  let skillLowConfidenceCount = 0;

  for (const row of recent) {
    const type = String(row.memory_type ?? "");
    const delta = asNum(row.delta_value);
    const metric = asNum(row.metric_value);
    const confidence = asNum(row.confidence);

    if (type === "FIELD_RESPONSE_MEMORY") {
      if (delta == null || delta <= 0) weak_response_count += 1;
    }

    if (type === "DEVICE_RELIABILITY_MEMORY") {
      if (metric != null && metric <= 0) deviceFailureCount += 1;
    }

    if (type === "SKILL_PERFORMANCE_MEMORY") {
      if (confidence != null && confidence < 0.6) skillLowConfidenceCount += 1;
    }
  }

  const weak_response_detected = weak_response_count > 0;
  const device_reliability_risk = deviceFailureCount > 0;
  const skill_performance_risk = skillLowConfidenceCount > 0;

  const risk_reasons: string[] = [];
  const explain_notes: string[] = [];

  if (weak_response_detected) {
    risk_reasons.push("WEAK_FIELD_RESPONSE_HISTORY");
    explain_notes.push(`Detected ${weak_response_count} weak or non-positive field response memories in recent history.`);
  }
  if (device_reliability_risk) {
    risk_reasons.push("DEVICE_RELIABILITY_RISK");
    explain_notes.push(`Detected ${deviceFailureCount} recent device reliability failure memories.`);
  }
  if (skill_performance_risk) {
    risk_reasons.push("SKILL_PERFORMANCE_RISK");
    explain_notes.push(`Detected ${skillLowConfidenceCount} recent low-confidence skill performance memories.`);
  }

  const recommended_confidence_adjustment = (weak_response_detected || device_reliability_risk || skill_performance_risk)
    ? "LOWER_ONE_LEVEL"
    : "NONE";

  const requires_manual_review = deviceFailureCount >= 2 || (weak_response_count >= 3 && skillLowConfidenceCount >= 1);

  if (requires_manual_review) {
    risk_reasons.push("MANUAL_REVIEW_REQUIRED");
    explain_notes.push("Escalated to manual review due to repeated reliability/response risk patterns.");
  }

  return {
    memory_refs,

    weak_response_detected,
    weak_response_count,

    device_reliability_risk,
    skill_performance_risk,

    recommended_confidence_adjustment,
    requires_manual_review,

    risk_reasons,
    explain_notes,
  };
}
