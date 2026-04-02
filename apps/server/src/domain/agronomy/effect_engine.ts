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
  const expected = Number(input.expectedEffect?.value ?? NaN);
  const actual = Number(input.actualEffect?.value ?? NaN);
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return "NO_DATA";

  if (actual >= expected) return "EFFECTIVE";
  if (actual > 0 && actual < expected) return "PARTIAL";
  if (actual <= 0) return "INEFFECTIVE";
  return "NO_DATA";
}
