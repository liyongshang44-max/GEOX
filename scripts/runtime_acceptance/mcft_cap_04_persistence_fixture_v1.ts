// scripts/runtime_acceptance/mcft_cap_04_persistence_fixture_v1.ts
// Purpose: build deterministic CAP-04 S5B A1/A2/B persistence candidates plus predecessor pointer and Runtime Config seed values.
// Boundary: acceptance fixture only; no database mutation, route, scheduler, live data, recommendation, decision, or action.

import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { executeCap04Pure72hForecastMathV1 } from "../../apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.js";
import { executeCap04PureThreeScenarioMathV1 } from "../../apps/server/src/domain/twin_runtime/pure_three_scenario_math_v1.js";
import {
  buildCap04BlockedForecastRecordSetV1,
  buildCap04CompletedForecastRecordSetV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.js";
import { buildCap04ScenarioSetRecordV1 } from "../../apps/server/src/runtime/twin_runtime/scenario_set_record_builder_v1.js";
import type { Cap04ExpectedPointersV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.js";
import {
  buildCap04A1A2BuilderInputsV1,
  CAP04_S5A_SCOPE_V1,
} from "./mcft_cap_04_a1_a2_record_set_fixture_v1.js";
import { buildCap04PureForecastMathInputV1 } from "./mcft_cap_04_forecast_math_fixture_v1.js";

function memberV1(recordSet: ReturnType<typeof buildCap04CompletedForecastRecordSetV1>, type: string): CanonicalObjectEnvelopeV1 {
  const member = recordSet.members.find((candidate) => candidate.object_type === type);
  if (!member) throw new Error(`CAP04_S5B_MEMBER_MISSING:${type}`);
  return member;
}

export function buildCap04S5BPersistenceFixtureV1(index = 0) {
  const inputs = buildCap04A1A2BuilderInputsV1(index);
  const a1 = buildCap04CompletedForecastRecordSetV1(inputs.completed);
  const a2 = buildCap04BlockedForecastRecordSetV1(inputs.blocked);
  const forecast = memberV1(a1, "twin_forecast_run_v1");
  const state = memberV1(a1, "twin_state_estimate_v1");

  const forecastMathInput = buildCap04PureForecastMathInputV1(index);
  forecastMathInput.source_posterior = {
    ref: state.object_id,
    hash: state.determinism_hash,
    logical_time: forecast.logical_time,
    computation_basis: {
      storage_mean_mm_decimal: "90.000000",
      storage_variance_mm2_decimal: "4.000000000000",
    },
  };
  const forecastMath = executeCap04Pure72hForecastMathV1(forecastMathInput);
  if (JSON.stringify(forecastMath.forecast_payload) !== JSON.stringify(forecast.payload)) {
    throw new Error("CAP04_S5B_FORECAST_FIXTURE_PAYLOAD_MISMATCH");
  }
  const scenarioMath = executeCap04PureThreeScenarioMathV1({
    source_forecast: {
      ref: forecast.object_id,
      hash: forecast.determinism_hash,
      math_result: forecastMath,
    },
    runtime_config: structuredClone(forecastMathInput.runtime_config),
    forcing_window: structuredClone(forecastMathInput.forcing_window),
  });
  const b = buildCap04ScenarioSetRecordV1({
    source_forecast: forecast,
    scenario_math_result: scenarioMath,
    created_at: inputs.completed.created_at,
  });

  const expected: Cap04ExpectedPointersV1 = {
    active_lineage_ref: inputs.completed.active_lineage_ref,
    lineage_id: inputs.completed.lineage_id,
    revision_id: inputs.completed.revision_id,
    previous_checkpoint_ref: inputs.completed.previous_checkpoint_ref,
    previous_state_ref: inputs.completed.previous_posterior_ref,
    previous_forecast_result_ref: inputs.completed.previous_forecast_result_ref,
    previous_successful_forecast_ref: inputs.completed.previous_successful_forecast_ref,
  };

  return {
    scope: structuredClone(CAP04_S5A_SCOPE_V1),
    runtime_config: structuredClone(inputs.completed.runtime_config),
    expected,
    a1,
    a2,
    b,
    predecessor: {
      active_lineage_ref: inputs.completed.active_lineage_ref,
      previous_state_ref: inputs.completed.previous_posterior_ref,
      previous_state_hash: inputs.completed.previous_posterior_hash,
      previous_checkpoint_ref: inputs.completed.previous_checkpoint_ref,
      previous_checkpoint_hash: inputs.completed.previous_checkpoint_hash,
      previous_forecast_ref: inputs.completed.previous_forecast_result_ref,
      previous_forecast_hash: inputs.completed.previous_forecast_result_hash,
      previous_successful_forecast_ref: inputs.completed.previous_successful_forecast_ref,
    },
  };
}
