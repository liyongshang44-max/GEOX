// scripts/runtime_acceptance/mcft_cap_04_forecast_math_fixture_v1.ts
// Purpose: construct deterministic S3 pure Forecast math inputs from the already-governed S1 Runtime Config chain and S2 Future Forcing selector fixtures.
// Boundary: acceptance fixture only; no persistence, migration, route, scheduler, live data, recommendation, decision, or action.

import type { Cap04RuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { Cap04Pure72hForecastMathInputV1 } from "../../apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.js";
import { selectCap04FutureForcingWindowV1 } from "../../apps/server/src/runtime/twin_runtime/future_forcing_selector_v1.js";
import { buildCap04ConfigChainFixtureV1 } from "./mcft_cap_04_contracts_config_fixture_v1.js";
import {
  buildCap04FutureForcingSelectorInputV1,
  buildCap04FutureForcing24TickInputsV1,
} from "./mcft_cap_04_future_forcing_fixture_v1.js";

export function buildCap04PureForecastMathInputV1(index = 0): Cap04Pure72hForecastMathInputV1 {
  const { configs } = buildCap04ConfigChainFixtureV1();
  const configEnvelope = configs[index];
  if (!configEnvelope) throw new Error("CAP04_S3_CONFIG_INDEX_OUT_OF_RANGE");
  const config = configEnvelope.payload as Cap04RuntimeConfigPayloadV1;
  const selectorInput = buildCap04FutureForcingSelectorInputV1({ logical_time: config.effective_logical_time });
  selectorInput.runtime_config = {
    ref: configEnvelope.object_id,
    hash: configEnvelope.determinism_hash,
  };
  selectorInput.crop_stage_context = {
    ref: config.crop_stage_context_ref,
    hash: config.crop_stage_context_hash,
    crop_stage_code: "CONTROLLED_STAGE_V1",
    kc: 1.05,
  };
  const selection = selectCap04FutureForcingWindowV1(selectorInput);
  if (selection.status !== "SELECTED") throw new Error("CAP04_S3_FORCING_SELECTION_REQUIRED");
  return {
    source_posterior: {
      ref: `twin_state_estimate_s3_fixture_${index + 1}`,
      hash: `sha256:${String(index + 1).padStart(64, "0")}`,
      logical_time: config.effective_logical_time,
      computation_basis: {
        storage_mean_mm_decimal: "90.000000",
        storage_variance_mm2_decimal: "4.000000000000",
      },
    },
    runtime_config: {
      ref: configEnvelope.object_id,
      hash: configEnvelope.determinism_hash,
      payload: config,
    },
    forcing_window: selection.window,
  };
}

export function buildCap04PureForecastMath24TickInputsV1(): Cap04Pure72hForecastMathInputV1[] {
  const { configs } = buildCap04ConfigChainFixtureV1();
  const selectorInputs = buildCap04FutureForcing24TickInputsV1();
  return configs.map((configEnvelope, index) => {
    const config = configEnvelope.payload as Cap04RuntimeConfigPayloadV1;
    const selectorInput = selectorInputs[index];
    selectorInput.runtime_config = { ref: configEnvelope.object_id, hash: configEnvelope.determinism_hash };
    selectorInput.crop_stage_context = {
      ref: config.crop_stage_context_ref,
      hash: config.crop_stage_context_hash,
      crop_stage_code: "CONTROLLED_STAGE_V1",
      kc: 1.05,
    };
    const selection = selectCap04FutureForcingWindowV1(selectorInput);
    if (selection.status !== "SELECTED") throw new Error(`CAP04_S3_FORCING_SELECTION_REQUIRED:${index}`);
    return {
      source_posterior: {
        ref: `twin_state_estimate_s3_range_${index + 1}`,
        hash: `sha256:${String(index + 101).padStart(64, "0")}`,
        logical_time: config.effective_logical_time,
        computation_basis: {
          storage_mean_mm_decimal: "90.000000",
          storage_variance_mm2_decimal: "4.000000000000",
        },
      },
      runtime_config: {
        ref: configEnvelope.object_id,
        hash: configEnvelope.determinism_hash,
        payload: config,
      },
      forcing_window: selection.window,
    };
  });
}
