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
