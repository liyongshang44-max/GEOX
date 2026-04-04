import type { Pool } from "pg";

export type EffectVerdict = "SUCCESS" | "PARTIAL" | "FAILED" | "NO_DATA";
export type RulePerformanceItem = {
  rule_id: string;
  crop_code: string;
  crop_stage: string;
  total_count: number;
  success_count: number;
  partial_count: number;
  failed_count: number;
  no_data_count: number;
  last_updated_at: string;
};

export type AttributionBasisV1 = {
  source_metrics: string[];
  method: string;
};

export function computeEffect(before: any, after: any) {
  const beforeMoisture = Number(before?.soil_moisture ?? NaN);
  const afterMoisture = Number(after?.soil_moisture ?? NaN);
  if (!Number.isFinite(beforeMoisture) || !Number.isFinite(afterMoisture)) {
    return null;
  }

  const delta = afterMoisture - beforeMoisture;

  return {
    metric: "soil_moisture",
    delta,
    type: "moisture_increase",
    value: delta
  };
}

export function evaluateEffectVerdict(input: {
  expectedEffect?: { type: string; value: number } | null;
  actualEffect?: { metric?: string; delta?: number; type?: string; value?: number } | null;
}): EffectVerdict {
  const expectedRaw = Number(input.expectedEffect?.value ?? NaN);
  const expectedLowerBound = Number.isFinite(expectedRaw) ? expectedRaw : 0;
  const actual = Number.isFinite(Number(input.actualEffect?.delta))
    ? Number(input.actualEffect?.delta)
    : input.actualEffect?.value;

  if (typeof actual !== "number" || !Number.isFinite(actual)) {
    return "NO_DATA";
  }

  if (actual >= expectedLowerBound) return "SUCCESS";
  if (actual > 0 && actual < expectedLowerBound) return "PARTIAL";
  return "FAILED";
}

export function buildAttributionBasis(input: {
  expectedEffect?: { type?: string | null; value?: number | null } | null;
  actualEffect?: { metric?: string | null; delta?: number | null; type?: string | null; value?: number | null } | null;
  beforeMetrics?: { soil_moisture?: number | null; temperature?: number | null; humidity?: number | null } | null;
  afterMetrics?: { soil_moisture?: number | null; temperature?: number | null; humidity?: number | null } | null;
}): AttributionBasisV1 {
  const source_metrics: string[] = [];
  if (Number.isFinite(Number(input.beforeMetrics?.soil_moisture ?? NaN)) || Number.isFinite(Number(input.afterMetrics?.soil_moisture ?? NaN))) {
    source_metrics.push("soil_moisture");
  }
  if (Number.isFinite(Number(input.beforeMetrics?.temperature ?? NaN)) || Number.isFinite(Number(input.afterMetrics?.temperature ?? NaN))) {
    source_metrics.push("temperature");
  }
  if (Number.isFinite(Number(input.beforeMetrics?.humidity ?? NaN)) || Number.isFinite(Number(input.afterMetrics?.humidity ?? NaN))) {
    source_metrics.push("humidity");
  }
  const expectedValue = Number(input.expectedEffect?.value ?? NaN);
  const actualValue = Number(
    Number.isFinite(Number(input.actualEffect?.delta ?? NaN))
      ? input.actualEffect?.delta
      : input.actualEffect?.value
  );
  const method = Number.isFinite(expectedValue) && Number.isFinite(actualValue)
    ? "rule_based_delta_compare: actual_delta_vs_expected_threshold"
    : "rule_based_observation: missing_expected_or_actual";
  return {
    source_metrics: source_metrics.length > 0 ? source_metrics : ["soil_moisture"],
    method,
  };
}

export async function recordRulePerformance(input: {
  pool: Pool;
  ruleId: string;
  cropCode: string;
  cropStage: string;
  verdict: EffectVerdict;
}): Promise<void> {
  const ruleId = String(input.ruleId ?? "").trim();
  const cropCode = String(input.cropCode ?? "").trim();
  const cropStage = String(input.cropStage ?? "").trim();
  if (!ruleId || !cropCode || !cropStage) return;

  await ensureRulePerformanceTable(input.pool);

  const upsert = await input.pool.query(
    `INSERT INTO agronomy_rule_performance (
       rule_id, crop_code, crop_stage,
       total_count, success_count, partial_count, failed_count, no_data_count, score, last_updated_at
     )
     VALUES (
       $1, $2, $3,
       1,
       CASE WHEN $4 = 'SUCCESS' THEN 1 ELSE 0 END,
       CASE WHEN $4 = 'PARTIAL' THEN 1 ELSE 0 END,
       CASE WHEN $4 = 'FAILED' THEN 1 ELSE 0 END,
       CASE WHEN $4 = 'NO_DATA' THEN 1 ELSE 0 END,
       0,
       NOW()
     )
     ON CONFLICT (rule_id, crop_code, crop_stage) DO UPDATE SET
       total_count = agronomy_rule_performance.total_count + 1,
       success_count = agronomy_rule_performance.success_count + CASE WHEN $4 = 'SUCCESS' THEN 1 ELSE 0 END,
       partial_count = agronomy_rule_performance.partial_count + CASE WHEN $4 = 'PARTIAL' THEN 1 ELSE 0 END,
       failed_count = agronomy_rule_performance.failed_count + CASE WHEN $4 = 'FAILED' THEN 1 ELSE 0 END,
       no_data_count = agronomy_rule_performance.no_data_count + CASE WHEN $4 = 'NO_DATA' THEN 1 ELSE 0 END,
       last_updated_at = NOW()
     RETURNING total_count, success_count, partial_count`,
    [ruleId, cropCode, cropStage, input.verdict]
  );
  const row = upsert.rows?.[0];
  const total = Number(row?.total_count ?? 0);
  const success = Number(row?.success_count ?? 0);
  const partial = Number(row?.partial_count ?? 0);
  const score = total > 0 ? Number(((success + partial * 0.5) / total).toFixed(6)) : 0;
  await input.pool.query(
    `UPDATE agronomy_rule_performance
        SET score = $4, last_updated_at = NOW()
      WHERE rule_id = $1 AND crop_code = $2 AND crop_stage = $3`,
    [ruleId, cropCode, cropStage, score]
  );
}

export async function ensureRulePerformanceTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agronomy_rule_performance (
      rule_id TEXT NOT NULL,
      crop_code TEXT NOT NULL,
      crop_stage TEXT NOT NULL,
      total_count INT NOT NULL DEFAULT 0,
      success_count INT NOT NULL DEFAULT 0,
      partial_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      no_data_count INT NOT NULL DEFAULT 0,
      score NUMERIC NOT NULL DEFAULT 0,
      last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (rule_id, crop_code, crop_stage)
    )
  `);
}

function toRulePerformanceItem(row: any): RulePerformanceItem {
  return {
    rule_id: String(row?.rule_id ?? ""),
    crop_code: String(row?.crop_code ?? ""),
    crop_stage: String(row?.crop_stage ?? ""),
    total_count: Number(row?.total_count ?? 0),
    success_count: Number(row?.success_count ?? 0),
    partial_count: Number(row?.partial_count ?? 0),
    failed_count: Number(row?.failed_count ?? 0),
    no_data_count: Number(row?.no_data_count ?? 0),
    last_updated_at: String(row?.last_updated_at ?? ""),
  };
}

export async function listRulePerformance(input: {
  pool: Pool;
  ruleId?: string | null;
  limit?: number;
}): Promise<RulePerformanceItem[]> {
  const ruleId = String(input.ruleId ?? "").trim();
  const limit = Math.max(1, Math.min(Number(input.limit ?? 200) || 200, 500));
  await ensureRulePerformanceTable(input.pool);
  const params: any[] = [];
  const where: string[] = [];
  if (ruleId) {
    params.push(ruleId);
    where.push(`rule_id = $${params.length}`);
  }
  params.push(limit);
  const sql = `SELECT rule_id, crop_code, crop_stage, total_count, success_count, partial_count, failed_count, no_data_count, last_updated_at
               FROM agronomy_rule_performance
               ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
               ORDER BY last_updated_at DESC, rule_id ASC, crop_code ASC, crop_stage ASC
               LIMIT $${params.length}`;
  const q = await input.pool.query(sql, params);
  return (q.rows ?? []).map(toRulePerformanceItem);
}
