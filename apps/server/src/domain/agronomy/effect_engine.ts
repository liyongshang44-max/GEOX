export type EffectMetrics = {
  soil_moisture?: number;
  temperature?: number;
  humidity?: number;
} | null | undefined;

export function computeEffect(before: EffectMetrics, after: EffectMetrics): { moisture_delta: number } | null {
  if (!before || !after) return null;
  const beforeMoisture = Number(before.soil_moisture ?? NaN);
  const afterMoisture = Number(after.soil_moisture ?? NaN);
  if (!Number.isFinite(beforeMoisture) || !Number.isFinite(afterMoisture)) return null;
  return {
    moisture_delta: Number((afterMoisture - beforeMoisture).toFixed(3))
  };
}
