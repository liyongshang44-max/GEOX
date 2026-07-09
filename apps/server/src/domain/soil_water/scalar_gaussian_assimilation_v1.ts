// apps/server/src/domain/soil_water/scalar_gaussian_assimilation_v1.ts
// Purpose: perform one scalar Gaussian observation update with explicit measurement, representativeness, and quality-weighted variance.
// Boundary: pure deterministic mathematics; the assimilation gain is not confidence, accuracy, or truth probability.

import { validateObservationFractionV1, validateVarianceV1 } from "../twin_runtime/physical_bounds_v1.js";

export type ObservationQualityStatusV1 = "PASS" | "LIMITED" | "FAIL";

export type ScalarGaussianAssimilationInputV1 = Readonly<{
  prior_mean: number;
  prior_variance: number;
  observation: number;
  h: number;
  sensor_measurement_stddev_fraction: number;
  point_to_zone_representativeness_stddev_fraction: number;
  quality_status: ObservationQualityStatusV1;
  quality_weights: Readonly<Record<ObservationQualityStatusV1, number>>;
}>;

export type ScalarGaussianAssimilationResultV1 = Readonly<{
  method_id: "SCALAR_GAUSSIAN_ASSIMILATION_V1";
  predicted_observation: number;
  actual_observation: number;
  innovation: number;
  sensor_variance: number;
  representativeness_variance: number;
  base_observation_variance: number;
  quality_status: ObservationQualityStatusV1;
  quality_weight: number;
  effective_observation_variance: number;
  assimilation_gain: number;
  posterior_mean: number;
  posterior_variance: number;
  disposition: "ASSIMILATED";
}>;

function finiteNonNegative(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
}

export function assimilateScalarGaussianObservationV1(input: ScalarGaussianAssimilationInputV1): ScalarGaussianAssimilationResultV1 {
  if (!Number.isFinite(input.prior_mean)) throw new Error("INVALID_PRIOR_MEAN");
  validateVarianceV1(input.prior_variance, "INVALID_PRIOR_VARIANCE");
  if (input.prior_variance <= 0) throw new Error("INVALID_PRIOR_VARIANCE");
  validateObservationFractionV1(input.observation);
  if (!Number.isFinite(input.h) || input.h !== 1) throw new Error("INVALID_OBSERVATION_OPERATOR");
  finiteNonNegative(input.sensor_measurement_stddev_fraction, "INVALID_SENSOR_STANDARD_DEVIATION");
  finiteNonNegative(input.point_to_zone_representativeness_stddev_fraction, "INVALID_REPRESENTATIVENESS_STANDARD_DEVIATION");
  const qualityWeight = input.quality_weights[input.quality_status];
  if (!Number.isFinite(qualityWeight) || qualityWeight < 0 || qualityWeight > 1) throw new Error("INVALID_QUALITY_WEIGHT");
  if (input.quality_status === "FAIL" || qualityWeight === 0) throw new Error("QUALITY_FAIL_OBSERVATION_REJECTED");
  const sensorVariance = input.sensor_measurement_stddev_fraction ** 2;
  const representativenessVariance = input.point_to_zone_representativeness_stddev_fraction ** 2;
  const baseObservationVariance = sensorVariance + representativenessVariance;
  if (!Number.isFinite(baseObservationVariance) || baseObservationVariance <= 0) throw new Error("INVALID_OBSERVATION_VARIANCE");
  const effectiveObservationVariance = baseObservationVariance / qualityWeight;
  const predictedObservation = input.h * input.prior_mean;
  const innovation = input.observation - predictedObservation;
  const denominator = input.h ** 2 * input.prior_variance + effectiveObservationVariance;
  if (!Number.isFinite(denominator) || denominator <= 0) throw new Error("INVALID_ASSIMILATION_DENOMINATOR");
  const assimilationGain = input.prior_variance / denominator;
  const posteriorMean = input.prior_mean + assimilationGain * innovation;
  const posteriorVariance = (1 - assimilationGain * input.h) * input.prior_variance;
  validateVarianceV1(posteriorVariance, "INVALID_POSTERIOR_VARIANCE");
  return {
    method_id: "SCALAR_GAUSSIAN_ASSIMILATION_V1",
    predicted_observation: predictedObservation,
    actual_observation: input.observation,
    innovation,
    sensor_variance: sensorVariance,
    representativeness_variance: representativenessVariance,
    base_observation_variance: baseObservationVariance,
    quality_status: input.quality_status,
    quality_weight: qualityWeight,
    effective_observation_variance: effectiveObservationVariance,
    assimilation_gain: assimilationGain,
    posterior_mean: posteriorMean,
    posterior_variance: posteriorVariance,
    disposition: "ASSIMILATED",
  };
}
