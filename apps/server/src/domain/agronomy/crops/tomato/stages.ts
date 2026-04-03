export function resolveTomatoStage(daysAfterPlanting: number): string {
  if (daysAfterPlanting <= 14) return "seedling";
  if (daysAfterPlanting <= 35) return "vegetative";
  if (daysAfterPlanting <= 55) return "flowering";
  return "fruiting";
}
