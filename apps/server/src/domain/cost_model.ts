export type OperationCostActionType = "IRRIGATE" | "FERTILIZE";
export type OperationCostActionResolution = "DIRECT" | "ALIAS" | "UNKNOWN_FALLBACK";

export type OperationUsageInput = {
  water_l?: number | null;
  chemical_ml?: number | null;
};

export type OperationCostV1 = {
  action_type: OperationCostActionType;
  action_resolution: OperationCostActionResolution;
  requested_action_type: string | null;
  normalization_note: string | null;
  estimated_total: number;
  estimated_water_cost: number;
  estimated_chemical_cost: number;
  estimated_electric_cost: number;
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

function normalizeActionType(actionType: unknown): {
  action_type: OperationCostActionType;
  action_resolution: OperationCostActionResolution;
  requested_action_type: string | null;
  normalization_note: string | null;
} {
  const normalized = String(actionType ?? "").trim().toUpperCase();
  const requestedActionType = normalized || null;
  if (!normalized) {
    return {
      action_type: "IRRIGATE",
      action_resolution: "UNKNOWN_FALLBACK",
      requested_action_type: null,
      normalization_note: "missing_action_type_fallback_to_irrigate",
    };
  }
  if (normalized === "IRRIGATE" || normalized === "FERTILIZE") {
    return {
      action_type: normalized,
      action_resolution: "DIRECT",
      requested_action_type: requestedActionType,
      normalization_note: null,
    };
  }

  const alias: Record<string, OperationCostActionType> = {
    IRRIGATION: "IRRIGATE",
    WATER: "IRRIGATE",
    WATERING: "IRRIGATE",
    FERTILIZATION: "FERTILIZE",
    FERTILISATION: "FERTILIZE",
    FERT: "FERTILIZE",
  };
  const resolvedAlias = alias[normalized];
  if (resolvedAlias) {
    return {
      action_type: resolvedAlias,
      action_resolution: "ALIAS",
      requested_action_type: requestedActionType,
      normalization_note: `action_type_alias:${normalized}->${resolvedAlias}`,
    };
  }
  return {
    action_type: "IRRIGATE",
    action_resolution: "UNKNOWN_FALLBACK",
    requested_action_type: requestedActionType,
    normalization_note: `unknown_action_type_fallback_to_irrigate:${normalized}`,
  };
}

export function computeOperationCostV1(actionType: unknown, usage: OperationUsageInput): OperationCostV1 {
  const normalized = normalizeActionType(actionType);
  if (normalized.action_type === "FERTILIZE") {
    const chemical = toNum(usage.chemical_ml) * COST_UNIT_V1.fertilize.chemical_per_ml;
    const labor = COST_UNIT_V1.fertilize.labor_fixed;
    return {
      action_type: "FERTILIZE",
      action_resolution: normalized.action_resolution,
      requested_action_type: normalized.requested_action_type,
      normalization_note: normalized.normalization_note,
      estimated_total: round2(chemical + labor),
      estimated_water_cost: 0,
      estimated_chemical_cost: round2(chemical),
      estimated_electric_cost: round2(labor),
      currency: "CNY",
    };
  }

  const water = toNum(usage.water_l) * COST_UNIT_V1.irrigate.water_per_l;
  const device = COST_UNIT_V1.irrigate.device_fixed;
  return {
    action_type: "IRRIGATE",
    action_resolution: normalized.action_resolution,
    requested_action_type: normalized.requested_action_type,
    normalization_note: normalized.normalization_note,
    estimated_total: round2(water + device),
    estimated_water_cost: round2(water),
    estimated_chemical_cost: 0,
    estimated_electric_cost: round2(device),
    currency: "CNY",
  };
}
