// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH_NEGATIVE.ts
// Purpose: prove the S3 pure Forecast math fails closed on missing posterior computation authority, identity drift, malformed config/forcing, physical violations, and forged determinism or trace values.
// Boundary: pure negative acceptance only; no persistence, migration, route, scheduler, Scenario math, recommendation, decision, or action.

import { validateCap04Pure72hForecastMathResultV1 } from "../../apps/server/src/domain/twin_runtime/forecast_math_contracts_v1.js";
import { executeCap04Pure72hForecastMathV1 } from "../../apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.js";
import { buildCap04PureForecastMathInputV1 } from "./mcft_cap_04_forecast_math_fixture_v1.js";

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

function expectThrow(action: () => void, code: string, message: string): void {
  try {
    action();
    check(false, message);
  } catch (error) {
    check(error instanceof Error && error.message.startsWith(code), message);
  }
}

const base = buildCap04PureForecastMathInputV1();

const missingVariance = structuredClone(base);
(missingVariance.source_posterior.computation_basis as Record<string, unknown>).storage_variance_mm2_decimal = undefined;
expectThrow(
  () => executeCap04Pure72hForecastMathV1(missingVariance),
  "CAP04_FORECAST_SOURCE_VARIANCE_REQUIRED",
  "missing posterior computation-basis variance fails closed",
);

const posteriorTimeDrift = structuredClone(base);
posteriorTimeDrift.source_posterior.logical_time = "2026-06-03T03:00:00.000Z";
expectThrow(
  () => executeCap04Pure72hForecastMathV1(posteriorTimeDrift),
  "CAP04_FORECAST_POSTERIOR_FORCING_TIME_MISMATCH",
  "posterior and forcing logical-time drift is rejected",
);

const configTimeDrift = structuredClone(base);
configTimeDrift.runtime_config.payload.effective_logical_time = "2026-06-03T03:00:00.000Z";
expectThrow(
  () => executeCap04Pure72hForecastMathV1(configTimeDrift),
  "CAP04_FORECAST_CONFIG_EFFECTIVE_TIME_MISMATCH",
  "Runtime Config effective-time drift is rejected",
);

const forcingConfigDrift = structuredClone(base);
forcingConfigDrift.forcing_window.runtime_config_hash = "sha256:forged";
expectThrow(
  () => executeCap04Pure72hForecastMathV1(forcingConfigDrift),
  "CAP04_FORCING_POINT_CONFIG_MISMATCH",
  "forcing and pinned Runtime Config identity drift is rejected",
);

const cropStageDrift = structuredClone(base);
cropStageDrift.forcing_window.crop_stage_context_ref = "crop_stage_context_forged";
expectThrow(
  () => executeCap04Pure72hForecastMathV1(cropStageDrift),
  "CAP04_FORCING_POINT_CROP_STAGE_MISMATCH",
  "forcing and Runtime Config crop-stage authority drift is rejected",
);

const sourceAboveSaturation = structuredClone(base);
sourceAboveSaturation.source_posterior.computation_basis.storage_mean_mm_decimal = "999.000000";
expectThrow(
  () => executeCap04Pure72hForecastMathV1(sourceAboveSaturation),
  "CAP04_FORECAST_SOURCE_STORAGE_ABOVE_SATURATION",
  "source posterior storage above saturation is rejected",
);

const forecastMethodDrift = structuredClone(base);
(forecastMethodDrift.runtime_config.payload as unknown as Record<string, unknown>).forecast_method_id = "UNAUTHORIZED_FORECAST_METHOD";
expectThrow(
  () => executeCap04Pure72hForecastMathV1(forecastMethodDrift),
  "CAP04_CONFIG_FORECAST_METHOD_ID_MISMATCH",
  "Runtime Config Forecast method drift is rejected",
);

const zeroStructuralUncertainty = structuredClone(base);
zeroStructuralUncertainty.runtime_config.payload.process_uncertainty.structural_process_stddev_mm_per_hour = 0;
expectThrow(
  () => executeCap04Pure72hForecastMathV1(zeroStructuralUncertainty),
  "ASSIMILATED_STRUCTURAL_STDDEV_MISMATCH",
  "zero structural process uncertainty is rejected",
);

const forgedForcingHash = structuredClone(base);
forgedForcingHash.forcing_window.forcing_window_hash = "sha256:forged";
expectThrow(
  () => executeCap04Pure72hForecastMathV1(forgedForcingHash),
  "CAP04_FORCING_WINDOW_HASH_MISMATCH",
  "forged Future Forcing window hash is rejected",
);

const malformedForcingCount = structuredClone(base);
malformedForcingCount.forcing_window.points.pop();
expectThrow(
  () => executeCap04Pure72hForecastMathV1(malformedForcingCount),
  "CAP04_FORCING_POINT_COUNT_MISMATCH",
  "71-point forcing window is rejected before Forecast math",
);

const result = executeCap04Pure72hForecastMathV1(base);
const forgedMathHash = structuredClone(result);
forgedMathHash.forecast_math_hash = "sha256:forged";
expectThrow(
  () => validateCap04Pure72hForecastMathResultV1(forgedMathHash),
  "CAP04_FORECAST_MATH_HASH_MISMATCH",
  "forged Forecast math hash is rejected",
);

const brokenVarianceChain = structuredClone(result);
brokenVarianceChain.point_traces[1].previous_storage_variance_mm2_decimal = "0.000000000000";
expectThrow(
  () => validateCap04Pure72hForecastMathResultV1(brokenVarianceChain),
  "CAP04_FORECAST_VARIANCE_CHAIN_MISMATCH",
  "broken internal 10^-12 variance chain is rejected",
);

const clippingReducesVariance = structuredClone(result);
(clippingReducesVariance.point_traces[0] as unknown as Record<string, unknown>).latent_variance_reduced_by_clipping = true;
expectThrow(
  () => validateCap04Pure72hForecastMathResultV1(clippingReducesVariance),
  "CAP04_FORECAST_LATENT_VARIANCE_CLIPPING_FORBIDDEN",
  "physical clipping cannot reduce latent variance",
);

const nonzeroIrrigation = structuredClone(result);
nonzeroIrrigation.forecast_payload.points[0].assumed_irrigation_mm = "1.000000";
expectThrow(
  () => validateCap04Pure72hForecastMathResultV1(nonzeroIrrigation),
  "CAP04_FORECAST_MATH_HASH_MISMATCH",
  "post hoc baseline irrigation mutation invalidates Forecast determinism",
);

const forgedPointHash = structuredClone(result);
forgedPointHash.forecast_payload.points[0].determinism_hash = "sha256:forged";
expectThrow(
  () => validateCap04Pure72hForecastMathResultV1(forgedPointHash),
  "CAP04_FORECAST_POINT_TRACE_HASH_MISMATCH",
  "point hash and computation trace cannot diverge",
);

const nonzeroAggregateIrrigation = structuredClone(result);
(nonzeroAggregateIrrigation.aggregates as unknown as Record<string, unknown>).total_irrigation_mm = "1.000000";
expectThrow(
  () => validateCap04Pure72hForecastMathResultV1(nonzeroAggregateIrrigation),
  "CAP04_FORECAST_TOTAL_IRRIGATION_NONZERO",
  "Forecast baseline aggregate irrigation must remain zero",
);

console.log(`MCFT-CAP-04 pure Forecast math negative: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
