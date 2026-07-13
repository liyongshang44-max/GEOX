// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH.ts
// Purpose: prove the S3 pure 72-hour Forecast mean, uncertainty, interval, physical-bound, determinism, and 24-tick coverage contracts.
// Boundary: pure acceptance only; no persistence, migration, route, scheduler, Scenario math, recommendation, decision, or action.

import { computeCap04ForcingWindowHashV1 } from "../../apps/server/src/domain/twin_runtime/future_forcing_contracts_v1.js";
import { validateCap04Pure72hForecastMathResultV1 } from "../../apps/server/src/domain/twin_runtime/forecast_math_contracts_v1.js";
import { executeCap04Pure72hForecastMathV1 } from "../../apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.js";
import {
  buildCap04PureForecastMath24TickInputsV1,
  buildCap04PureForecastMathInputV1,
} from "./mcft_cap_04_forecast_math_fixture_v1.js";

let pass = 0;
let fail = 0;

function check(value: unknown, message: string): void {
  if (value) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
}

function fixedUnits(value: string): bigint {
  return BigInt(value.replace(".", ""));
}

const input = buildCap04PureForecastMathInputV1();
const result = executeCap04Pure72hForecastMathV1(input);
validateCap04Pure72hForecastMathResultV1(result);

check(
  result.forecast_payload.status === "COMPLETED"
    && result.forecast_payload.points.length === 72
    && result.point_traces.length === 72,
  "pure Forecast emits exactly 72 completed hourly points and traces",
);

check(
  result.forecast_payload.points.every((point, index) =>
    point.horizon_hour === index + 1
      && point.interval_start === input.forcing_window.points[index].interval_start
      && point.interval_end === input.forcing_window.points[index].interval_end
      && point.target_time === input.forcing_window.points[index].target_time),
  "Forecast target times and intervals remain exactly forcing-bound",
);

check(
  result.forecast_payload.points.every((point) => point.assumed_irrigation_mm === "0.000000")
    && result.aggregates.total_irrigation_mm === "0.000000"
    && result.point_traces.every((trace) => trace.baseline_irrigation_variance_mm2_decimal === "0.000000000000"),
  "NO_NEW_IRRIGATION baseline is exact in mean and variance",
);

check(
  result.forecast_payload.points.every((point, index) =>
    point.mass_balance_error_mm === "0.000000"
      && (index === 0 || point.previous_storage_mm === result.forecast_payload.points[index - 1].storage_mean_mm)),
  "fixed-point water balance closes exactly and storage chains hour to hour",
);

check(
  result.point_traces.every((trace, index) =>
    index === 0 || fixedUnits(trace.storage_variance_mm2_decimal) > fixedUnits(result.point_traces[index - 1].storage_variance_mm2_decimal)),
  "latent storage variance strictly increases without assimilation",
);

check(
  result.point_traces.every((trace, index) => {
    const point = result.forecast_payload.points[index];
    return trace.post_bound_storage_mm === point.storage_mean_mm
      && trace.overflow_mm === point.saturation_overflow_mm
      && trace.latent_variance_reduced_by_clipping === false
      && trace.lower_interval_bound_applied === (point.storage_interval_unclipped_lower_mm !== point.storage_interval_emitted_lower_mm)
      && trace.upper_interval_bound_applied === (point.storage_interval_unclipped_upper_mm !== point.storage_interval_emitted_upper_mm);
  }),
  "physical and interval clipping flags match emitted values without reducing latent variance",
);

check(
  result.forecast_payload.points.every((point) =>
    fixedUnits(point.storage_mean_mm) >= 0n
      && fixedUnits(point.available_water_fraction) >= 0n
      && fixedUnits(point.available_water_fraction) <= 1_000_000n),
  "storage and available-water fraction stay inside governed physical bounds",
);

const repeated = executeCap04Pure72hForecastMathV1(structuredClone(input));
check(JSON.stringify(repeated) === JSON.stringify(result), "same semantic input reproduces every point hash, trajectory hash and forecast math hash");

const changedForcingInput = structuredClone(input);
changedForcingInput.forcing_window.points[0].precipitation_assumption_mm = Number((changedForcingInput.forcing_window.points[0].precipitation_assumption_mm + 0.5).toFixed(6));
changedForcingInput.forcing_window.forcing_window_hash = computeCap04ForcingWindowHashV1(changedForcingInput.forcing_window.points);
const changedForcingResult = executeCap04Pure72hForecastMathV1(changedForcingInput);
check(
  changedForcingResult.forecast_math_hash !== result.forecast_math_hash
    && changedForcingResult.forecast_payload.points[0].determinism_hash !== result.forecast_payload.points[0].determinism_hash,
  "semantic forcing change changes point and Forecast math determinism",
);

const changedVarianceInput = structuredClone(input);
changedVarianceInput.source_posterior.computation_basis.storage_variance_mm2_decimal = "5.000000000000";
const changedVarianceResult = executeCap04Pure72hForecastMathV1(changedVarianceInput);
check(
  changedVarianceResult.forecast_payload.points.map((point) => point.storage_mean_mm).join("|")
    === result.forecast_payload.points.map((point) => point.storage_mean_mm).join("|")
    && changedVarianceResult.point_traces[0].storage_variance_mm2_decimal !== result.point_traces[0].storage_variance_mm2_decimal
    && changedVarianceResult.forecast_math_hash !== result.forecast_math_hash,
  "posterior variance changes uncertainty without changing deterministic mean trajectory",
);

const rangeResults = buildCap04PureForecastMath24TickInputsV1().map((rangeInput) => executeCap04Pure72hForecastMathV1(rangeInput));
check(
  rangeResults.length === 24
    && rangeResults.every((rangeResult) => rangeResult.forecast_payload.points.length === 72),
  "all 24 standard Replay ticks execute independent 72-hour Forecast math",
);
const targetTimes = new Set<string>();
for (const rangeResult of rangeResults) for (const point of rangeResult.forecast_payload.points) targetTimes.add(point.target_time);
const orderedTargets = [...targetTimes].sort();
check(
  orderedTargets.length === 95
    && orderedTargets[0] === "2026-06-03T03:00:00.000Z"
    && orderedTargets[94] === "2026-06-07T01:00:00.000Z",
  "24 completed trajectories preserve the exact 95-hour Forecast target union",
);

check(
  result.limitations.includes("NO_CALIBRATED_FORECAST_PROBABILITY")
    && result.limitations.includes("NORMALITY_NOT_FIELD_VALIDATED")
    && result.limitations.includes("WEATHER_ENSEMBLE_UNCERTAINTY_NOT_MODELED")
    && result.limitations.includes("NOT_RECOMMENDATION")
    && result.limitations.includes("NOT_DECISION"),
  "Forecast limitations preserve uncertainty and decision nonclaims",
);

console.log(`MCFT-CAP-04 pure Forecast math: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
