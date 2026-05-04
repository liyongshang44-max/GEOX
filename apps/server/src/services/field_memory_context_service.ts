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

function includesAny(text: string, needles: string[]): boolean {
  const haystack = text.toLowerCase();
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

export async function loadFieldMemoryContextForRecommendation(
  pool: DbConn,
  input: LoadFieldMemoryContextInput,
): Promise<FieldMemoryContextForRecommendation> {
  const limit = Math.max(10, Math.min(200, Math.floor(input.lookback_limit ?? 50)));

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
      input.project_id ?? null,
      input.group_id ?? null,
      input.season_id ?? null,
      limit,
    ],
  )) as QueryResult<any>;

  const recent = rows.rows;
  const memory_refs = recent.map((row) => String(row.memory_id ?? "")).filter(Boolean);

  let weak_response_count = 0;
  let device_risk_count = 0;
  let skill_risk_count = 0;

  for (const row of recent) {
    const delta = asNum(row.delta_value);
    const beforeValue = asNum(row.before_value);
    const afterValue = asNum(row.after_value);
    const confidence = asNum(row.confidence);
    const summary = String(row.summary_text ?? "");

    const weakResponseHit =
      (delta != null && delta < 0.03)
      || (afterValue != null && beforeValue != null && afterValue <= beforeValue)
      || includesAny(summary, ["未回升"]);
    if (weakResponseHit) weak_response_count += 1;

    const deviceRiskHit = includesAny(summary, ["失败", "超时", "offline"]);
    if (deviceRiskHit) device_risk_count += 1;

    const skillRiskHit = (confidence != null && confidence < 0.6) || includesAny(summary, ["失败"]);
    if (skillRiskHit) skill_risk_count += 1;
  }

  const weak_response_detected = weak_response_count >= 2;
  const device_reliability_risk = device_risk_count >= 2;
  const skill_performance_risk = skill_risk_count > 0;

  const anyRisk = weak_response_detected || device_reliability_risk || skill_performance_risk;
  const recommended_confidence_adjustment: "NONE" | "LOWER_ONE_LEVEL" = anyRisk ? "LOWER_ONE_LEVEL" : "NONE";
  const requires_manual_review = anyRisk;

  const risk_reasons: string[] = [];
  const explain_notes: string[] = [];

  if (weak_response_detected) {
    risk_reasons.push("WEAK_FIELD_RESPONSE_HISTORY");
    explain_notes.push(`Weak irrigation response detected in ${weak_response_count} memory records (threshold: >=2).`);
  }
  if (device_reliability_risk) {
    risk_reasons.push("DEVICE_RELIABILITY_RISK");
    explain_notes.push(`Device risk keywords found in ${device_risk_count} memory records (threshold: >=2).`);
  }
  if (skill_performance_risk) {
    risk_reasons.push("SKILL_PERFORMANCE_RISK");
    explain_notes.push(`Skill risk detected in ${skill_risk_count} memory records (confidence < 0.6 or summary includes 失败).`);
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
