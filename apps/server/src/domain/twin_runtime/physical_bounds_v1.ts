// apps/server/src/domain/twin_runtime/physical_bounds_v1.ts
// Purpose: validate MCFT-CAP-01 soil-water physical bounds and emit clipped Gaussian intervals with preserved unclipped metadata.
// Boundary: pure deterministic domain logic; no persistence, filesystem, environment, clock, network, scheduler, or mutable global state.

import { roundDecimalHalfAwayFromZeroV1 } from "./canonical_json_v1.js";

export const ROOT_ZONE_WATER_PHYSICAL_BOUND_VERSION_V1 = "ROOT_ZONE_WATER_PHYSICAL_BOUNDS_V1" as const;
export const NORMAL_95_GAUSSIAN_INTERVAL_RULE_V1 = "NORMAL_95_Z_1_96_V1" as const;
export const WATER_UNCERTAINTY_INTERVAL_CLIP_RULE_V1 = "CLIP_TO_ZERO_AND_SATURATION_WITH_UNCLIPPED_METADATA_V1" as const;
export const NORMAL_95_Z_V1 = 1.96;

export type SoilHydraulicConfigurationV1 = Readonly<{
  root_zone_depth_mm: number;
  wilting_point_fraction: number;
  field_capacity_fraction: number;
  saturation_fraction: number;
}>;

export type WaterPhysicalBoundPolicyV1 = Readonly<{
  physical_bound_version: typeof ROOT_ZONE_WATER_PHYSICAL_BOUND_VERSION_V1;
  gaussian_interval_rule: typeof NORMAL_95_GAUSSIAN_INTERVAL_RULE_V1;
  uncertainty_interval_clip_rule: typeof WATER_UNCERTAINTY_INTERVAL_CLIP_RULE_V1;
  interval_clip_bounds: readonly [number, number];
}>;

export type ClippedGaussianIntervalV1 = Readonly<{
  interval_level: 0.95;
  interval_low: number;
  interval_high: number;
  unclipped_interval: Readonly<{ low: number; high: number }>;
  interval_clipped: boolean;
  clipping_metadata: Readonly<{
    rule_id: typeof WATER_UNCERTAINTY_INTERVAL_CLIP_RULE_V1;
    lower_bound: number;
    upper_bound: number;
    lower_clipped: boolean;
    upper_clipped: boolean;
  }>;
}>;

function requireFinite(value: number, code: string): void {
  if (!Number.isFinite(value)) throw new Error(code);
}

export function validateSoilHydraulicConfigurationV1(configuration: SoilHydraulicConfigurationV1): void {
  requireFinite(configuration.root_zone_depth_mm, "INVALID_ROOT_ZONE_DEPTH");
  requireFinite(configuration.wilting_point_fraction, "INVALID_WILTING_POINT");
  requireFinite(configuration.field_capacity_fraction, "INVALID_FIELD_CAPACITY");
  requireFinite(configuration.saturation_fraction, "INVALID_SATURATION");
  if (configuration.root_zone_depth_mm <= 0) throw new Error("INVALID_ROOT_ZONE_DEPTH");
  if (
    configuration.wilting_point_fraction < 0
    || configuration.wilting_point_fraction >= configuration.field_capacity_fraction
    || configuration.field_capacity_fraction >= configuration.saturation_fraction
    || configuration.saturation_fraction > 1
  ) throw new Error("INVALID_HYDRAULIC_ORDERING");
}

export function validateWaterPhysicalBoundPolicyV1(policy: WaterPhysicalBoundPolicyV1, saturationFraction: number): void {
  if (policy.physical_bound_version !== ROOT_ZONE_WATER_PHYSICAL_BOUND_VERSION_V1) throw new Error("PHYSICAL_BOUND_VERSION_MISMATCH");
  if (policy.gaussian_interval_rule !== NORMAL_95_GAUSSIAN_INTERVAL_RULE_V1) throw new Error("GAUSSIAN_INTERVAL_RULE_MISMATCH");
  if (policy.uncertainty_interval_clip_rule !== WATER_UNCERTAINTY_INTERVAL_CLIP_RULE_V1) throw new Error("UNCERTAINTY_INTERVAL_CLIP_RULE_MISMATCH");
  const [lower, upper] = policy.interval_clip_bounds;
  requireFinite(lower, "INVALID_INTERVAL_CLIP_BOUNDS");
  requireFinite(upper, "INVALID_INTERVAL_CLIP_BOUNDS");
  if (lower !== 0 || upper !== saturationFraction || lower >= upper) throw new Error("INVALID_INTERVAL_CLIP_BOUNDS");
}

export function validateObservationFractionV1(observation: number): void {
  requireFinite(observation, "NON_FINITE_OBSERVATION");
  if (observation < 0) throw new Error("OBSERVATION_BELOW_ZERO");
  if (observation > 1) throw new Error("OBSERVATION_ABOVE_ONE");
}

export function validateVarianceV1(variance: number, code = "INVALID_VARIANCE"): void {
  requireFinite(variance, code);
  if (variance < 0) throw new Error(code);
}

export function validatePosteriorPhysicalStateV1(input: Readonly<{
  posterior_mean: number;
  posterior_variance: number;
  posterior_stddev: number;
  saturation_fraction: number;
}>): void {
  requireFinite(input.posterior_mean, "INVALID_POSTERIOR_MEAN");
  validateVarianceV1(input.posterior_variance, "INVALID_POSTERIOR_VARIANCE");
  requireFinite(input.posterior_stddev, "INVALID_POSTERIOR_STANDARD_DEVIATION");
  if (input.posterior_stddev < 0) throw new Error("INVALID_POSTERIOR_STANDARD_DEVIATION");
  if (input.posterior_mean < 0 || input.posterior_mean > input.saturation_fraction) throw new Error("POSTERIOR_PHYSICAL_BOUND_VIOLATION");
  const squared = input.posterior_stddev * input.posterior_stddev;
  const tolerance = Math.max(1e-12, Math.abs(input.posterior_variance) * 1e-10);
  if (Math.abs(squared - input.posterior_variance) > tolerance) throw new Error("POSTERIOR_VARIANCE_STDDEV_MISMATCH");
}

export function buildClippedGaussianIntervalV1(input: Readonly<{
  mean: number;
  stddev: number;
  saturation_fraction: number;
  decimals: number;
  policy: WaterPhysicalBoundPolicyV1;
}>): ClippedGaussianIntervalV1 {
  requireFinite(input.mean, "INVALID_INTERVAL_MEAN");
  requireFinite(input.stddev, "INVALID_INTERVAL_STANDARD_DEVIATION");
  if (input.stddev < 0) throw new Error("INVALID_INTERVAL_STANDARD_DEVIATION");
  validateWaterPhysicalBoundPolicyV1(input.policy, input.saturation_fraction);
  const unclippedLow = input.mean - NORMAL_95_Z_V1 * input.stddev;
  const unclippedHigh = input.mean + NORMAL_95_Z_V1 * input.stddev;
  const [lowerBound, upperBound] = input.policy.interval_clip_bounds;
  const clippedLow = Math.max(lowerBound, unclippedLow);
  const clippedHigh = Math.min(upperBound, unclippedHigh);
  const lowerClipped = clippedLow !== unclippedLow;
  const upperClipped = clippedHigh !== unclippedHigh;
  return {
    interval_level: 0.95,
    interval_low: roundDecimalHalfAwayFromZeroV1(clippedLow, input.decimals),
    interval_high: roundDecimalHalfAwayFromZeroV1(clippedHigh, input.decimals),
    unclipped_interval: {
      low: roundDecimalHalfAwayFromZeroV1(unclippedLow, input.decimals),
      high: roundDecimalHalfAwayFromZeroV1(unclippedHigh, input.decimals),
    },
    interval_clipped: lowerClipped || upperClipped,
    clipping_metadata: {
      rule_id: WATER_UNCERTAINTY_INTERVAL_CLIP_RULE_V1,
      lower_bound: lowerBound,
      upper_bound: upperBound,
      lower_clipped: lowerClipped,
      upper_clipped: upperClipped,
    },
  };
}

export function clampUnitIntervalV1(value: number): number {
  requireFinite(value, "INVALID_UNIT_INTERVAL_VALUE");
  return Math.min(1, Math.max(0, value));
}
