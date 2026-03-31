export type CostBreakdown = {
  water_cost: number;
  electric_cost: number;
  chemical_cost: number;
  total_cost: number;
};

type ReceiptUsageInput = {
  water_l?: number | null;
  electric_kwh?: number | null;
  chemical_ml?: number | null;
};

const UNIT_PRICE = {
  water_per_l: 0.002,
  electric_per_kwh: 0.8,
  chemical_per_ml: 0.01,
} as const;

function toNum(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function computeCostBreakdown(input: ReceiptUsageInput): CostBreakdown {
  const waterCost = toNum(input.water_l) * UNIT_PRICE.water_per_l;
  const electricCost = toNum(input.electric_kwh) * UNIT_PRICE.electric_per_kwh;
  const chemicalCost = toNum(input.chemical_ml) * UNIT_PRICE.chemical_per_ml;
  const totalCost = waterCost + electricCost + chemicalCost;
  return {
    water_cost: round2(waterCost),
    electric_cost: round2(electricCost),
    chemical_cost: round2(chemicalCost),
    total_cost: round2(totalCost),
  };
}
