// apps/server/src/domain/soil_water/scalar_gaussian_assimilation_v1.ts
// Purpose: execute the frozen scalar Gaussian bootstrap assimilation without rounding intermediate calculations.
// Boundary: pure domain mathematics only; no confidence scoring, persistence, I/O, clock, Evidence selection, or Runtime orchestration.

import { requireFiniteNumberV1, validateNonNegativeVarianceV1, validateObservationFractionV1 } from "../twin_runtime/physical_bounds_v1.js";

export const SCALAR_GAUSSIAN_ASSIMILATION_METHOD_ID_V1 = "SCALAR_GAUSSIAN_ASSIMILATION_V1" as const;

export type ScalarGaussianAssimilationInputV1 = {
  prior_mean: unknown;
  prior_variance: unknown;
  observation: unknown;
  observation_variance: unknown;
  observation_operator_h: unknown;
};

export type ScalarGaussianAssimilationResultV1 = {
  assimilation_method_id: typeof SCALAR_GAUSSIAN_ASSIMILATION_METHOD_ID_V1;
  predicted_observation: number;
  innovation: number;
  assimilation_gain: number;
  posterior_mean: number;
  posterior_variance: number;
};

export function assimilateScalarGaussianV1(input: ScalarGaussianAssimilationInputV1): ScalarGaussianAssimilationResultV1 {
  const priorMean = requireFiniteNumberV1(input.prior_mean, "PRIOR_MEAN_REQUIRED", "PRIOR_MEAN_NON_FINITE");
  if (priorMean < 0 || priorMean > 1) throw new Error("INVALID_PRIOR_MEAN");
  const priorVariance = validateNonNegativeVarianceV1(input.prior_variance, "NEGATIVE_PRIOR_VARIANCE");
  const observation = validateObservationFractionV1(input.observation);
  const observationVariance = validateNonNegativeVarianceV1(input.observation_variance, "NEGATIVE_OBSERVATION_VARIANCE");
  const h = requireFiniteNumberV1(input.observation_operator_h, "OBSERVATION_OPERATOR_REQUIRED", "OBSERVATION_OPERATOR_NON_FINITE");
  if (h !== 1) throw new Error("UNSUPPORTED_OBSERVATION_OPERATOR");
  const denominator = h ** 2 * priorVariance + observationVariance;
  if (!(denominator > 0)) throw new Error("NON_POSITIVE_ASSIMILATION_DENOMINATOR");
  const predictedObservation = h * priorMean;
  const innovation = observation - predictedObservation;
  const assimilationGain = priorVariance / denominator;
  const posteriorMean = priorMean + assimilationGain * innovation;
  const posteriorVariance = (1 - assimilationGain * h) * priorVariance;
  if (posteriorVariance < 0) throw new Error("NEGATIVE_POSTERIOR_VARIANCE");
  return {
    assimilation_method_id: SCALAR_GAUSSIAN_ASSIMILATION_METHOD_ID_V1,
    predicted_observation: predictedObservation,
    innovation,
    assimilation_gain: assimilationGain,
    posterior_mean: posteriorMean,
    posterior_variance: posteriorVariance,
  };
}
