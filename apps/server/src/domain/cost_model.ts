export type OperationCostActionType = "IRRIGATE" | "FERTILIZE";

export type OperationUsageInput = {
  water_l?: number | null;
  chemical_ml?: number | null;
};

export type OperationCostV1 = {
  action_type: OperationCostActionType;
  estimated_total: number;
  estimated_water_cost: number;
  estimated_chemical_cost: number;
  estimated_device_cost: number;
  estimated_labor_cost: number;
  currency: "CNY";
};

const COST_UNIT_V1 = {
  irrigate: {
    water_per_l: 0.002,
    device_fixed: 2,
  },
  fertilize: {
    chemical_per_ml: 0.01,
    labor_fixed: 5,
  },
} as const;

function toNum(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function normalizeActionType(actionType: unknown): OperationCostActionType {
  const normalized = String(actionType ?? "").trim().toUpperCase();
  return normalized === "FERTILIZE" ? "FERTILIZE" : "IRRIGATE";
}

export function computeOperationCostV1(actionType: unknown, usage: OperationUsageInput): OperationCostV1 {
  const normalized = normalizeActionType(actionType);
  if (normalized === "FERTILIZE") {
    const chemical = toNum(usage.chemical_ml) * COST_UNIT_V1.fertilize.chemical_per_ml;
    const labor = COST_UNIT_V1.fertilize.labor_fixed;
    return {
      action_type: "FERTILIZE",
      estimated_total: round2(chemical + labor),
      estimated_water_cost: 0,
      estimated_chemical_cost: round2(chemical),
      estimated_device_cost: 0,
      estimated_labor_cost: round2(labor),
      currency: "CNY",
    };
  }

  const water = toNum(usage.water_l) * COST_UNIT_V1.irrigate.water_per_l;
  const device = COST_UNIT_V1.irrigate.device_fixed;
  return {
    action_type: "IRRIGATE",
    estimated_total: round2(water + device),
    estimated_water_cost: round2(water),
    estimated_chemical_cost: 0,
    estimated_device_cost: round2(device),
    estimated_labor_cost: 0,
    currency: "CNY",
  };
}
