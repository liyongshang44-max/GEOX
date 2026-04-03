export function resolveCornStage(daysAfterPlanting: number): string {
  if (daysAfterPlanting <= 10) return "seed";
  if (daysAfterPlanting <= 40) return "vegetative";
  if (daysAfterPlanting <= 80) return "reproductive";
  return "maturity";
}
