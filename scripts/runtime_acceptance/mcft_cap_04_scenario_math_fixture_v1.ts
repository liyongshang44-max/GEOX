// scripts/runtime_acceptance/mcft_cap_04_scenario_math_fixture_v1.ts
// Purpose: construct deterministic S4 three-option Scenario math inputs from the governed S3 Forecast math fixtures.
// Boundary: acceptance fixture only; no persistence, migration, route, scheduler, live data, recommendation, decision, or action.

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { executeCap04Pure72hForecastMathV1 } from "../../apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.js";
import type { Cap04PureThreeScenarioMathInputV1 } from "../../apps/server/src/domain/twin_runtime/pure_three_scenario_math_v1.js";
import {
  buildCap04PureForecastMath24TickInputsV1,
  buildCap04PureForecastMathInputV1,
} from "./mcft_cap_04_forecast_math_fixture_v1.js";

export function buildCap04PureScenarioMathInputV1(index = 0): Cap04PureThreeScenarioMathInputV1 {
  const forecastInput = buildCap04PureForecastMathInputV1(index);
  const forecastResult = executeCap04Pure72hForecastMathV1(forecastInput);
  return {
    source_forecast: {
      ref: `twin_forecast_run_s4_fixture_${index + 1}`,
      hash: semanticHashV1({ forecast_payload: forecastResult.forecast_payload, forecast_math_hash: forecastResult.forecast_math_hash }),
      math_result: forecastResult,
    },
    runtime_config: structuredClone(forecastInput.runtime_config),
    forcing_window: structuredClone(forecastInput.forcing_window),
  };
}

export function buildCap04PureScenarioMath24TickInputsV1(): Cap04PureThreeScenarioMathInputV1[] {
  return buildCap04PureForecastMath24TickInputsV1().map((forecastInput, index) => {
    const forecastResult = executeCap04Pure72hForecastMathV1(forecastInput);
    return {
      source_forecast: {
        ref: `twin_forecast_run_s4_range_${index + 1}`,
        hash: semanticHashV1({ forecast_payload: forecastResult.forecast_payload, forecast_math_hash: forecastResult.forecast_math_hash }),
        math_result: forecastResult,
      },
      runtime_config: structuredClone(forecastInput.runtime_config),
      forcing_window: structuredClone(forecastInput.forcing_window),
    };
  });
}
