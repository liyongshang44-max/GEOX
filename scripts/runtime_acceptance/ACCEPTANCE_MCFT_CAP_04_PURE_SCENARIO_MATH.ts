// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH.ts
// Purpose: prove S4 exact three-option order, NO_ACTION canonical copy, immediate 15/25 mm assumptions, deterministic stress/deltas, zero irrigation variance, and 24-tick coverage.
// Boundary: pure acceptance only; no persistence, migration, route, scheduler, live data, recommendation, decision, or action.

import { CAP04_SCENARIO_OPTION_IDS_V1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import { executeCap04PureThreeScenarioMathV1 } from "../../apps/server/src/domain/twin_runtime/pure_three_scenario_math_v1.js";
import { validateCap04PureThreeScenarioMathResultV1 } from "../../apps/server/src/domain/twin_runtime/scenario_math_contracts_v1.js";
import {
  buildCap04PureScenarioMath24TickInputsV1,
  buildCap04PureScenarioMathInputV1,
} from "./mcft_cap_04_scenario_math_fixture_v1.js";

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

const input = buildCap04PureScenarioMathInputV1();
const result = executeCap04PureThreeScenarioMathV1(input);
validateCap04PureThreeScenarioMathResultV1(result);
const [noAction, irrigation15, irrigation25] = result.scenario_set_payload.options;

check(
  JSON.stringify(result.scenario_set_payload.options.map((option) => option.option_id)) === JSON.stringify(CAP04_SCENARIO_OPTION_IDS_V1),
  "Scenario Set contains exactly the frozen three-option order",
);
check(
  JSON.stringify(noAction.trajectory_points) === JSON.stringify(result.source_forecast_payload.points)
    && result.option_trajectory_hashes.NO_ACTION === input.source_forecast.math_result.trajectory_hash,
  "NO_ACTION trajectory is the exact canonical deep copy of source Forecast points",
);
check(
  noAction.requested_irrigation_mm === "0.000000"
    && noAction.effective_irrigation_mm === "0.000000"
    && noAction.application_horizon === null
    && noAction.application_interval === null,
  "NO_ACTION metadata remains zero and horizonless",
);
check(
  irrigation15.requested_irrigation_mm === "15.000000"
    && irrigation15.effective_irrigation_mm === "15.000000"
    && irrigation15.application_horizon === 1
    && irrigation15.trajectory_points[0].assumed_irrigation_mm === "15.000000"
    && irrigation15.trajectory_points.slice(1).every((point) => point.assumed_irrigation_mm === "0.000000"),
  "15 mm option injects controlled assumed irrigation only at horizon 1",
);
check(
  irrigation25.requested_irrigation_mm === "25.000000"
    && irrigation25.effective_irrigation_mm === "25.000000"
    && irrigation25.application_horizon === 1
    && irrigation25.trajectory_points[0].assumed_irrigation_mm === "25.000000"
    && irrigation25.trajectory_points.slice(1).every((point) => point.assumed_irrigation_mm === "0.000000"),
  "25 mm option injects controlled assumed irrigation only at horizon 1",
);
check(
  result.application_efficiency_basis.value === "1.000000"
    && result.application_efficiency_basis.parameter_class === "CONTROLLED_SYNTHETIC"
    && result.application_efficiency_basis.field_calibration_status === "NOT_FIELD_CALIBRATED"
    && result.stress_threshold_basis.value === "0.350000"
    && result.stress_threshold_basis.comparator === "STRICT_LESS_THAN",
  "application efficiency and stress threshold remain pinned to Runtime Config authority",
);
check(
  result.scenario_set_payload.options.every((option) => option.trajectory_points.every((point) => point.mass_balance_error_mm === "0.000000")),
  "all three Scenario trajectories close fixed-point water balance exactly",
);
check(
  irrigation15.trajectory_points.every((point, index) => point.storage_variance_mm2 === noAction.trajectory_points[index].storage_variance_mm2)
    && irrigation25.trajectory_points.every((point, index) => point.storage_variance_mm2 === noAction.trajectory_points[index].storage_variance_mm2)
    && irrigation15.uncertainty_basis.scenario_assumed_irrigation_variance_mm2 === "0.000000"
    && irrigation25.uncertainty_basis.scenario_assumed_irrigation_variance_mm2 === "0.000000",
  "Scenario assumed irrigation adds zero variance and preserves the frozen variance chain",
);
check(
  Number(irrigation25.final_storage_mm) >= Number(irrigation15.final_storage_mm)
    && Number(irrigation15.final_storage_mm) >= Number(noAction.final_storage_mm)
    && irrigation25.stress_hour_count <= irrigation15.stress_hour_count
    && irrigation15.stress_hour_count <= noAction.stress_hour_count,
  "controlled irrigation options weakly increase storage and weakly reduce stress hours",
);
check(
  irrigation15.difference_from_no_action.total_irrigation_delta_mm === "15.000000"
    && irrigation25.difference_from_no_action.total_irrigation_delta_mm === "25.000000"
    && noAction.difference_from_no_action.stress_hour_count_delta === 0,
  "difference_from_no_action is computed from exact option metrics",
);
const repeated = executeCap04PureThreeScenarioMathV1(structuredClone(input));
check(JSON.stringify(repeated) === JSON.stringify(result), "same semantic input reproduces all Scenario hashes deterministically");

const range = buildCap04PureScenarioMath24TickInputsV1().map((item) => executeCap04PureThreeScenarioMathV1(item));
check(range.length === 24 && range.every((item) => item.scenario_set_payload.options.length === 3), "all 24 Replay ticks produce exactly three Scenario options");
const targetTimes = new Set<string>();
for (const item of range) for (const option of item.scenario_set_payload.options) for (const point of option.trajectory_points) targetTimes.add(point.target_time);
const orderedTargets = [...targetTimes].sort();
check(
  orderedTargets.length === 95
    && orderedTargets[0] === "2026-06-03T03:00:00.000Z"
    && orderedTargets[94] === "2026-06-07T01:00:00.000Z",
  "24 three-option Scenario Sets preserve the exact 95-hour target union",
);

console.log(`MCFT-CAP-04 pure scenario math: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
