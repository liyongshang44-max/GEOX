// apps/server/src/domain/twin_runtime/physical_bounds_v1.ts
// Purpose: define and enforce the frozen MCFT-CAP-01 root-zone water physical bounds and Gaussian interval clipping rule.
// Boundary: pure domain validation and arithmetic only; no persistence, I/O, environment, clock, network, or mutable global state.

export const ROOT_ZONE_WATER_PHYSICAL_BOUND_VERSION_V1 = "ROOT_ZONE_WATER_PHYSICAL_BOUNDS_V1" as const;
export const ROOT_ZONE_WATER_GAUSSIAN_INTERVAL_RULE_V1 = "NORMAL_95_Z_1_96_V1" as const;
export const ROOT_ZONE_WATER_INTERVAL_CLIP_RULE_V1 = "CLIP_TO_ZERO_AND_SATURATION_WITH_UNCLIPPED_METADATA_V1" as const;
export const ROOT_ZONE_WATER_GAUSSIAN_95_Z_V1 = 1.96 as const;

export type SoilHydraulicBoundsV1 = {
  wilting_point_fraction: number;
  field_capacity_fraction: number;
  saturation_fraction: number;
  root_zone_depth_mm: number;
};

export type GaussianIntervalV1 = {
  unclipped_low: number;
  unclipped_high: number;
  interval_low: number;
  interval_high: number;
  interval_clipped: boolean;
};

export function requireFiniteNumberV1(value: unknown, requiredCode: string, finiteCode: string): number {
  if (typeof value !== "number") throw new Error(requiredCode);
  if (!Number.isFinite(value)) throw new Error(finiteCode);
  return value;
}

export function validateSoilHydraulicBoundsV1(input: SoilHydraulicBoundsV1): SoilHydraulicBoundsV1 {
  const wilting = requireFiniteNumberV1(input?.wilting_point_fraction, "WILTING_POINT_REQUIRED", "WILTING_POINT_NON_FINITE");
  const fieldCapacity = requireFiniteNumberV1(input?.field_capacity_fraction, "FIELD_CAPACITY_REQUIRED", "FIELD_CAPACITY_NON_FINITE");
  const saturation = requireFiniteNumberV1(input?.saturation_fraction, "SATURATION_REQUIRED", "SATURATION_NON_FINITE");
  const depth = requireFiniteNumberV1(input?.root_zone_depth_mm, "ROOT_ZONE_DEPTH_REQUIRED", "ROOT_ZONE_DEPTH_NON_FINITE");
  if (!(0 <= wilting && wilting < fieldCapacity && fieldCapacity < saturation && saturation <= 1)) {
    throw new Error("INVALID_HYDRAULIC_ORDERING");
  }
  if (depth <= 0) throw new Error("INVALID_ROOT_ZONE_DEPTH");
  return {
    wilting_point_fraction: wilting,
    field_capacity_fraction: fieldCapacity,
    saturation_fraction: saturation,
    root_zone_depth_mm: depth,
  };
}

export function validateObservationFractionV1(value: unknown): number {
  const observation = requireFiniteNumberV1(value, "OBSERVATION_REQUIRED", "OBSERVATION_NON_FINITE");
  if (observation < 0) throw new Error("OBSERVATION_BELOW_ZERO");
  if (observation > 1) throw new Error("OBSERVATION_ABOVE_ONE");
  return observation;
}

export function validateNonNegativeVarianceV1(value: unknown, code: string): number {
  const variance = requireFiniteNumberV1(value, `${code}_REQUIRED`, `${code}_NON_FINITE`);
  if (variance < 0) throw new Error(code);
  return variance;
}

export function validatePosteriorMeanWithinBoundsV1(meanValue: unknown, saturationValue: unknown): number {
  const mean = requireFiniteNumberV1(meanValue, "POSTERIOR_MEAN_REQUIRED", "POSTERIOR_MEAN_NON_FINITE");
  const saturation = requireFiniteNumberV1(saturationValue, "SATURATION_REQUIRED", "SATURATION_NON_FINITE");
  if (mean < 0 || mean > saturation) throw new Error("POSTERIOR_PHYSICAL_BOUND_VIOLATION");
  return mean;
}

export function clampUnitIntervalV1(value: number): number {
  if (!Number.isFinite(value)) throw new Error("NON_FINITE_UNIT_INTERVAL_VALUE");
  return Math.min(1, Math.max(0, value));
}

export function deriveClippedGaussianIntervalV1(input: {
  mean: number;
  stddev: number;
  saturation_fraction: number;
}): GaussianIntervalV1 {
  const mean = requireFiniteNumberV1(input.mean, "INTERVAL_MEAN_REQUIRED", "INTERVAL_MEAN_NON_FINITE");
  const stddev = requireFiniteNumberV1(input.stddev, "INTERVAL_STDDEV_REQUIRED", "INTERVAL_STDDEV_NON_FINITE");
  const saturation = requireFiniteNumberV1(input.saturation_fraction, "SATURATION_REQUIRED", "SATURATION_NON_FINITE");
  if (stddev < 0) throw new Error("NEGATIVE_INTERVAL_STDDEV");
  if (saturation <= 0 || saturation > 1) throw new Error("INVALID_SATURATION_BOUND");
  const unclippedLow = mean - ROOT_ZONE_WATER_GAUSSIAN_95_Z_V1 * stddev;
  const unclippedHigh = mean + ROOT_ZONE_WATER_GAUSSIAN_95_Z_V1 * stddev;
  const intervalLow = Math.max(0, unclippedLow);
  const intervalHigh = Math.min(saturation, unclippedHigh);
  return {
    unclipped_low: unclippedLow,
    unclipped_high: unclippedHigh,
    interval_low: intervalLow,
    interval_high: intervalHigh,
    interval_clipped: intervalLow !== unclippedLow || intervalHigh !== unclippedHigh,
  };
}
