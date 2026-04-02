import type { Pool } from "pg";

export function computeEffect(before: any, after: any) {
  const beforeMoisture = Number(before?.soil_moisture ?? NaN);
  const afterMoisture = Number(after?.soil_moisture ?? NaN);
  if (!Number.isFinite(beforeMoisture) || !Number.isFinite(afterMoisture)) {
    return null;
  }

  const delta = afterMoisture - beforeMoisture;

  return {
    type: "moisture_increase",
    value: delta
  };
}

export function evaluateEffectVerdict(input: {
  expectedEffect?: { type: string; value: number } | null;
  actualEffect?: { type: string; value: number } | null;
}): "EFFECTIVE" | "PARTIAL" | "INEFFECTIVE" | "NO_DATA" {
  const expected = input.expectedEffect?.value;
  const actual = input.actualEffect?.value;

  if (typeof expected !== "number" || typeof actual !== "number") {
    return "NO_DATA";
  }

  if (actual >= expected) return "EFFECTIVE";
  if (actual > 0 && actual < expected) return "PARTIAL";
  return "INEFFECTIVE";
}

export async function recordRulePerformance(input: {
  pool: Pool;
  ruleId: string;
  cropCode: string;
  verdict: "EFFECTIVE" | "PARTIAL" | "INEFFECTIVE" | "NO_DATA";
}): Promise<void> {
  const ruleId = String(input.ruleId ?? "").trim();
  const cropCode = String(input.cropCode ?? "").trim();
  if (!ruleId || !cropCode) return;

  await input.pool.query(`
    CREATE TABLE IF NOT EXISTS agronomy_rule_performance (
      rule_id TEXT PRIMARY KEY,
      crop_code TEXT NOT NULL,
      total_count INT NOT NULL DEFAULT 0,
      effective_count INT NOT NULL DEFAULT 0,
      partial_count INT NOT NULL DEFAULT 0,
      ineffective_count INT NOT NULL DEFAULT 0,
      no_data_count INT NOT NULL DEFAULT 0,
      score NUMERIC NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const upsert = await input.pool.query(
    `INSERT INTO agronomy_rule_performance (
       rule_id, crop_code,
       total_count, effective_count, partial_count, ineffective_count, no_data_count, score, updated_at
     )
     VALUES (
       $1, $2,
       1,
       CASE WHEN $3 = 'EFFECTIVE' THEN 1 ELSE 0 END,
       CASE WHEN $3 = 'PARTIAL' THEN 1 ELSE 0 END,
       CASE WHEN $3 = 'INEFFECTIVE' THEN 1 ELSE 0 END,
       CASE WHEN $3 = 'NO_DATA' THEN 1 ELSE 0 END,
       0,
       NOW()
     )
     ON CONFLICT (rule_id) DO UPDATE SET
       crop_code = EXCLUDED.crop_code,
       total_count = agronomy_rule_performance.total_count + 1,
       effective_count = agronomy_rule_performance.effective_count + CASE WHEN $3 = 'EFFECTIVE' THEN 1 ELSE 0 END,
       partial_count = agronomy_rule_performance.partial_count + CASE WHEN $3 = 'PARTIAL' THEN 1 ELSE 0 END,
       ineffective_count = agronomy_rule_performance.ineffective_count + CASE WHEN $3 = 'INEFFECTIVE' THEN 1 ELSE 0 END,
       no_data_count = agronomy_rule_performance.no_data_count + CASE WHEN $3 = 'NO_DATA' THEN 1 ELSE 0 END,
       updated_at = NOW()
     RETURNING total_count, effective_count, partial_count`,
    [ruleId, cropCode, input.verdict]
  );
  const row = upsert.rows?.[0];
  const total = Number(row?.total_count ?? 0);
  const effective = Number(row?.effective_count ?? 0);
  const partial = Number(row?.partial_count ?? 0);
  const score = total > 0 ? Number(((effective + partial * 0.5) / total).toFixed(6)) : 0;
  await input.pool.query(
    `UPDATE agronomy_rule_performance
        SET score = $2, updated_at = NOW()
      WHERE rule_id = $1`,
    [ruleId, score]
  );
}
