// Purpose: production MCFT-CAP-08.S4 full posterior-to-posterior late-evidence transport.
// Boundary: pure deterministic math only; no persistence, clock, environment, or Runtime authority.

export type Cap08S4LateObservationV1 = {
  value: number;
  variance: number;
  quality: number;
};

export type Cap08S4LateTransitionV1 = {
  dynamics_delta: number;
  process_variance: number;
  ordinary_observation?: Cap08S4LateObservationV1;
};

export type Cap08S4LateCorrectionInputV1 = {
  source_mean: number | string;
  source_variance: number;
  observation_value: number;
  observation_variance: number;
  quality: number;
  current_mean: number | string;
  current_variance: number;
  lag_hours: number;
  max_lag_hours: number;
  lambda_per_hour: number;
  epsilon: number;
  a_max: number;
  lower_bound: number;
  upper_bound: number;
  minimum_variance: number;
  transitions: Cap08S4LateTransitionV1[];
};

export type Cap08S4LateCorrectionAppliedV1 = {
  disposition: "APPLIED";
  innovation: number;
  gain: number;
  historical_delta: number;
  transport_sensitivity: number;
  decay: number;
  current_delta: number;
  mean: number;
  variance: number;
  step_sensitivities: number[];
};

export type Cap08S4LateCorrectionRejectedV1 = {
  disposition:
    | "REJECTED_NON_FINITE"
    | "REJECTED_LAG_EXCEEDED"
    | "REJECTED_INVALID_VARIANCE";
};

export type Cap08S4LateCorrectionResultV1 =
  | Cap08S4LateCorrectionAppliedV1
  | Cap08S4LateCorrectionRejectedV1;

function finiteV1(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clipV1(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value));
}

function transitionV1(
  mean: number,
  variance: number,
  step: Cap08S4LateTransitionV1,
  input: Cap08S4LateCorrectionInputV1,
): { mean: number; variance: number } {
  const predictedMean = clipV1(mean + step.dynamics_delta, input.lower_bound, input.upper_bound);
  const predictedVariance = Math.max(variance + step.process_variance, input.minimum_variance);
  if (!step.ordinary_observation) return { mean: predictedMean, variance: predictedVariance };
  const observation = step.ordinary_observation;
  const gain = observation.quality * predictedVariance / (predictedVariance + observation.variance);
  return {
    mean: clipV1(
      predictedMean + gain * (observation.value - predictedMean),
      input.lower_bound,
      input.upper_bound,
    ),
    variance: Math.max((1 - gain) * predictedVariance, input.minimum_variance),
  };
}

function inputFiniteV1(input: Cap08S4LateCorrectionInputV1): boolean {
  const scalars = [
    input.source_mean,
    input.source_variance,
    input.observation_value,
    input.observation_variance,
    input.quality,
    input.current_mean,
    input.current_variance,
    input.lag_hours,
    input.max_lag_hours,
    input.lambda_per_hour,
    input.epsilon,
    input.a_max,
    input.lower_bound,
    input.upper_bound,
    input.minimum_variance,
  ];
  if (!scalars.every(finiteV1)) return false;
  return input.transitions.every((step) => {
    if (!finiteV1(step.dynamics_delta) || !finiteV1(step.process_variance)) return false;
    if (!step.ordinary_observation) return true;
    return finiteV1(step.ordinary_observation.value)
      && finiteV1(step.ordinary_observation.variance)
      && finiteV1(step.ordinary_observation.quality);
  });
}

export function calculateCap08S4LateCorrectionV1(
  input: Cap08S4LateCorrectionInputV1,
): Cap08S4LateCorrectionResultV1 {
  if (!inputFiniteV1(input)) return { disposition: "REJECTED_NON_FINITE" };
  if (input.lag_hours > input.max_lag_hours) return { disposition: "REJECTED_LAG_EXCEEDED" };
  if (
    input.observation_variance <= 0
    || input.source_variance < 0
    || input.current_variance < 0
    || input.minimum_variance < 0
    || input.epsilon <= 0
    || input.a_max < 0
    || input.lower_bound > input.upper_bound
    || input.transitions.some((step) => step.process_variance < 0
      || (step.ordinary_observation?.variance ?? 1) <= 0)
  ) {
    return { disposition: "REJECTED_INVALID_VARIANCE" };
  }

  const sourceMean = input.source_mean as number;
  const currentMean = input.current_mean as number;
  const gain = input.quality * input.source_variance
    / (input.source_variance + input.observation_variance);
  const innovation = input.observation_value - sourceMean;
  const historicalDelta = gain * innovation;
  let mean = sourceMean;
  let variance = input.source_variance;
  let transportSensitivity = 1;
  const stepSensitivities: number[] = [];

  for (const step of input.transitions) {
    const plus = transitionV1(mean + input.epsilon, variance, step, input).mean;
    const minus = transitionV1(mean - input.epsilon, variance, step, input).mean;
    const rawSensitivity = (plus - minus) / (2 * input.epsilon);
    const sensitivity = clipV1(rawSensitivity, -input.a_max, input.a_max);
    stepSensitivities.push(sensitivity);
    transportSensitivity *= sensitivity;
    const next = transitionV1(mean, variance, step, input);
    mean = next.mean;
    variance = next.variance;
  }

  const decay = Math.exp(-input.lambda_per_hour * input.lag_hours);
  const currentDelta = decay * transportSensitivity * historicalDelta;
  return {
    disposition: "APPLIED",
    innovation,
    gain,
    historical_delta: historicalDelta,
    transport_sensitivity: transportSensitivity,
    decay,
    current_delta: currentDelta,
    mean: clipV1(currentMean + currentDelta, input.lower_bound, input.upper_bound),
    variance: Math.max(input.current_variance, input.minimum_variance),
    step_sensitivities: stepSensitivities,
  };
}
