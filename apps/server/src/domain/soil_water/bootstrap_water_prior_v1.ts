// apps/server/src/domain/soil_water/bootstrap_water_prior_v1.ts
// Purpose: compute the configured weak Gaussian prior for the first root-zone water State without creating a separate canonical prior object.
// Boundary: pure deterministic mathematics; no persistence, I/O, Runtime orchestration, clock, random values, or mutable global state.

import { validateSoilHydraulicConfigurationV1, type SoilHydraulicConfigurationV1 } from "../twin_runtime/physical_bounds_v1.js";

export type WeakBootstrapWaterPriorV1 = Readonly<{
  rule_id: "MIDPOINT_WILTING_FIELD_CAPACITY_WEAK_PRIOR_V1";
  latent_variable: "ROOT_ZONE_VOLUMETRIC_WATER_CONTENT_FRACTION";
  distribution_family: "GAUSSIAN_APPROXIMATION";
  mean: number;
  variance: number;
  stddev: number;
}>;

export function computeWeakBootstrapWaterPriorV1(configuration: SoilHydraulicConfigurationV1): WeakBootstrapWaterPriorV1 {
  validateSoilHydraulicConfigurationV1(configuration);
  const mean = (configuration.wilting_point_fraction + configuration.field_capacity_fraction) / 2;
  const stddev = (configuration.field_capacity_fraction - configuration.wilting_point_fraction) / 2;
  const variance = stddev * stddev;
  if (!Number.isFinite(mean) || !Number.isFinite(stddev) || !Number.isFinite(variance) || variance <= 0) throw new Error("INVALID_BOOTSTRAP_PRIOR");
  return {
    rule_id: "MIDPOINT_WILTING_FIELD_CAPACITY_WEAK_PRIOR_V1",
    latent_variable: "ROOT_ZONE_VOLUMETRIC_WATER_CONTENT_FRACTION",
    distribution_family: "GAUSSIAN_APPROXIMATION",
    mean,
    variance,
    stddev,
  };
}
