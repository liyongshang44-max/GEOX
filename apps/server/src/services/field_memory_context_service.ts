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

export type FieldMemoryContextV1 = {
  weak_response_count: number;
  execution_deviation_count: number;
  low_reliability_count: number;
  skill_failure_count: number;
  memory_refs: string[];
  reasons: string[];
};

function asNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function hasAny(text: string, tokens: string[]): boolean {
  return tokens.some((x) => text.includes(x.toLowerCase()));
}

export async function loadFieldMemoryContextForRecommendation(
  pool: DbConn,
  input: LoadFieldMemoryContextInput,
): Promise<FieldMemoryContextV1> {
  const limit = Math.max(10, Math.min(200, Math.floor(input.lookback_limit ?? 50)));
  const projectId = String(input.project_id ?? "").trim() || null;
  const groupId = String(input.group_id ?? "").trim() || null;
  const seasonId = String(input.season_id ?? "").trim() || null;

  const rows = (await pool.query(
    `SELECT memory_id, memory_type, before_value, after_value, delta_value, confidence, summary_text, occurred_at
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
      projectId,
      groupId,
      seasonId,
      limit,
    ],
  )) as QueryResult<any>;

  const recent = rows.rows;
  const memory_refs = recent.map((row) => String(row.memory_id ?? "")).filter(Boolean);

  let weak_response_count = 0;
  let execution_deviation_count = 0;
  let low_reliability_count = 0;
  let skill_failure_count = 0;

  for (const row of recent) {
    const summary = asText(row.summary_text);
    const delta = asNum(row.delta_value);
    const before = asNum(row.before_value);
    const after = asNum(row.after_value);
    const confidence = asNum(row.confidence);

    if (delta != null && delta < 0.03) weak_response_count += 1;

    const deviationRatio =
      before != null && before !== 0 && after != null
        ? Math.abs(after - before) / Math.abs(before)
        : null;
    if (deviationRatio != null && deviationRatio > 0.15) execution_deviation_count += 1;

    if ((confidence != null && confidence < 0.6) || hasAny(summary, ["success=false", "执行失败", "offline", "timeout"])) {
      low_reliability_count += 1;
    }

    if (hasAny(summary, ["skill fail", "skill_failed", "技能失败"])) {
      skill_failure_count += 1;
    }
  }

  const reasons: string[] = [];
  if (weak_response_count > 0) reasons.push("FIELD_MEMORY_WEAK_RESPONSE");
  if (execution_deviation_count > 0) reasons.push("FIELD_MEMORY_EXECUTION_DEVIATION");
  if (low_reliability_count > 0) reasons.push("FIELD_MEMORY_LOW_RELIABILITY");
  if (skill_failure_count > 0) reasons.push("FIELD_MEMORY_SKILL_FAILURE");

  return {
    weak_response_count,
    execution_deviation_count,
    low_reliability_count,
    skill_failure_count,
    memory_refs,
    reasons,
  };
}
