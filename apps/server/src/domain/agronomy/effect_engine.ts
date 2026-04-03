import type { Pool } from "pg";

export type EffectVerdict = "SUCCESS" | "PARTIAL" | "FAILED" | "NO_DATA";

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
  const expected = input.expectedEffect?.value;
  const actual = Number.isFinite(Number(input.actualEffect?.delta))
    ? Number(input.actualEffect?.delta)
    : input.actualEffect?.value;

  if (typeof expected !== "number" || typeof actual !== "number") {
    return "NO_DATA";
  }

  if (actual >= expected) return "SUCCESS";
  if (actual > 0 && actual < expected) return "PARTIAL";
  return "FAILED";
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

  await input.pool.query(`
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
