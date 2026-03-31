import { computeCostBreakdown } from "../agronomy/cost_model";

export type BillingResultV1 = {
  billable: boolean;
  charge: number;
};

type BillingInput = {
  final_status?: string | null;
  water_l?: number | null;
  electric_kwh?: number | null;
  chemical_ml?: number | null;
};

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function computeBillingV1(input: BillingInput): BillingResultV1 {
  const status = String(input.final_status ?? "").toUpperCase();
  if (status === "INVALID_EXECUTION") return { billable: false, charge: 0 };
  if (status === "SUCCEEDED" || status === "SUCCESS") {
    const cost = computeCostBreakdown({
      water_l: input.water_l,
      electric_kwh: input.electric_kwh,
      chemical_ml: input.chemical_ml,
    });
    return { billable: true, charge: round2(cost.total_cost * 1.5) };
  }
  return { billable: false, charge: 0 };
}
