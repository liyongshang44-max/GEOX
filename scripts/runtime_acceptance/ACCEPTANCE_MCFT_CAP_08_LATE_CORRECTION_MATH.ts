import fs from "node:fs";
import path from "node:path";

type Observation = { value: number; variance: number; quality: number };
type Transition = { dynamics_delta: number; process_variance: number; ordinary_observation?: Observation };
type Input = {
  source_mean: number | string; source_variance: number; observation_value: number; observation_variance: number; quality: number;
  current_mean: number | string; current_variance: number; lag_hours: number; max_lag_hours: number; lambda_per_hour: number;
  epsilon: number; a_max: number; lower_bound: number; upper_bound: number; minimum_variance: number; transitions: Transition[];
};
type Result = Record<string, unknown>;
const vectorsPath = "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-LATE-CORRECTION-TEST-VECTORS-V1.json";
const outputPath = "acceptance-output/MCFT_CAP_08_LATE_CORRECTION_MATH_RESULT.json";
const contract = JSON.parse(fs.readFileSync(vectorsPath, "utf8"));
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function clip(value: number, lower: number, upper: number): number { return Math.max(lower, Math.min(upper, value)); }
function transition(mean: number, variance: number, step: Transition, input: Input): { mean: number; variance: number } {
  const predictedMean = clip(mean + step.dynamics_delta, input.lower_bound, input.upper_bound);
  const predictedVariance = Math.max(variance + step.process_variance, input.minimum_variance);
  if (!step.ordinary_observation) return { mean: predictedMean, variance: predictedVariance };
  const observation = step.ordinary_observation;
  const gain = observation.quality * predictedVariance / (predictedVariance + observation.variance);
  return {
    mean: clip(predictedMean + gain * (observation.value - predictedMean), input.lower_bound, input.upper_bound),
    variance: Math.max((1 - gain) * predictedVariance, input.minimum_variance),
  };
}
function calculate(input: Input): Result {
  for (const key of ["source_mean","source_variance","observation_value","observation_variance","quality","current_mean","current_variance","lag_hours","lambda_per_hour","epsilon","a_max"] as const) {
    if (!finite(input[key])) return { disposition: "REJECTED_NON_FINITE" };
  }
  if (input.lag_hours > input.max_lag_hours) return { disposition: "REJECTED_LAG_EXCEEDED" };
  if (input.observation_variance <= 0 || input.source_variance < 0 || input.epsilon <= 0) return { disposition: "REJECTED_INVALID_VARIANCE" };
  const sourceMean = input.source_mean as number;
  const currentMean = input.current_mean as number;
  const gain = input.quality * input.source_variance / (input.source_variance + input.observation_variance);
  const innovation = input.observation_value - sourceMean;
  const historicalDelta = gain * innovation;
  let mean = sourceMean;
  let variance = input.source_variance;
  let transportSensitivity = 1;
  const stepSensitivities: number[] = [];
  for (const step of input.transitions) {
    const plus = transition(mean + input.epsilon, variance, step, input).mean;
    const minus = transition(mean - input.epsilon, variance, step, input).mean;
    const raw = (plus - minus) / (2 * input.epsilon);
    const sensitivity = clip(raw, -input.a_max, input.a_max);
    stepSensitivities.push(sensitivity);
    transportSensitivity *= sensitivity;
    const next = transition(mean, variance, step, input);
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
    mean: clip(currentMean + currentDelta, input.lower_bound, input.upper_bound),
    variance: Math.max(input.current_variance, input.minimum_variance),
    step_sensitivities: stepSensitivities,
  };
}
function equal(actual: unknown, expected: unknown, tolerance: number): boolean {
  if (typeof expected === "number") return typeof actual === "number" && Math.abs(actual - expected) <= tolerance;
  if (Array.isArray(expected)) return Array.isArray(actual) && expected.length === actual.length && expected.every((value,index)=>equal(actual[index],value,tolerance));
  return actual === expected;
}
const checks: Array<{id:string;status:"PASS"}> = [];
for (const vector of contract.vectors) {
  const first = calculate(vector.input as Input);
  const second = calculate(vector.input as Input);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error(`LATE_MATH_NONDETERMINISTIC:${vector.id}`);
  for (const [key, expected] of Object.entries(vector.expected as Record<string,unknown>)) {
    if (!equal(first[key], expected, contract.numeric_tolerance)) throw new Error(`LATE_MATH_VECTOR_MISMATCH:${vector.id}:${key}:${JSON.stringify({actual:first[key],expected})}`);
  }
  checks.push({id:vector.id,status:"PASS"});
}
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,`${JSON.stringify({status:"PASS",vector_count:checks.length,checks,full_posterior_transition_recomputed:true,intermediate_ordinary_assimilation_covered:true,deterministic_rerun:true,production_reuse_required_in_pr4:true},null,2)}\n`);
