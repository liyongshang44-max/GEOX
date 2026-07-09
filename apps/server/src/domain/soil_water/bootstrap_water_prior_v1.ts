// apps/server/src/domain/soil_water/bootstrap_water_prior_v1.ts
// Purpose: derive the frozen weak bootstrap prior from governed wilting-point and field-capacity fractions.
// Boundary: pure domain mathematics only; no Evidence selection, Runtime orchestration, persistence, I/O, clock, or random values.

import { validateSoilHydraulicBoundsV1, type SoilHydraulicBoundsV1 } from "../twin_runtime/physical_bounds_v1.js";

export const BOOTSTRAP_WATER_PRIOR_RULE_ID_V1 = "MIDPOINT_WILTING_FIELD_CAPACITY_WEAK_PRIOR_V1" as const;

export type BootstrapWaterPriorV1 = {
  prior_rule_id: typeof BOOTSTRAP_WATER_PRIOR_RULE_ID_V1;
  prior_kind: "CONFIGURED_WEAK_BOOTSTRAP_PRIOR";
  mean: number;
  stddev: number;
  variance: number;
};

export function buildBootstrapWaterPriorV1(input: SoilHydraulicBoundsV1): BootstrapWaterPriorV1 {
  const hydraulic = validateSoilHydraulicBoundsV1(input);
  const mean = (hydraulic.wilting_point_fraction + hydraulic.field_capacity_fraction) / 2;
  const stddev = (hydraulic.field_capacity_fraction - hydraulic.wilting_point_fraction) / 2;
  const variance = stddev ** 2;
  return {
    prior_rule_id: BOOTSTRAP_WATER_PRIOR_RULE_ID_V1,
    prior_kind: "CONFIGURED_WEAK_BOOTSTRAP_PRIOR",
    mean,
    stddev,
    variance,
  };
}
