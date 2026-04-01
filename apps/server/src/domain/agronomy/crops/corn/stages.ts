export function resolveCornStage(daysFromStart: number): string {
  if (daysFromStart <= 10) return "seed";
  if (daysFromStart <= 40) return "vegetative";
  if (daysFromStart <= 65) return "flowering";
  if (daysFromStart <= 95) return "grain_filling";
  return "harvest";
}
