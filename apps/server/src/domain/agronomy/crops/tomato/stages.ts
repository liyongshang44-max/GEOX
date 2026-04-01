export function resolveTomatoStage(daysFromStart: number): string {
  if (daysFromStart <= 14) return "seedling";
  if (daysFromStart <= 35) return "vegetative";
  if (daysFromStart <= 55) return "flowering";
  if (daysFromStart <= 95) return "fruiting";
  return "harvest";
}
