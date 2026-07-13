// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH_NEGATIVE.ts
// Purpose: prove S4 rejects source/forcing/config drift, option/order/copy corruption, fake execution authority, irrigation-horizon drift, policy drift, and forged hashes.
// Boundary: pure negative acceptance only; no persistence, migration, route, scheduler, live data, recommendation, decision, or action.

import { executeCap04PureThreeScenarioMathV1 } from "../../apps/server/src/domain/twin_runtime/pure_three_scenario_math_v1.js";
import { validateCap04PureThreeScenarioMathResultV1 } from "../../apps/server/src/domain/twin_runtime/scenario_math_contracts_v1.js";
import { buildCap04PureScenarioMathInputV1 } from "./mcft_cap_04_scenario_math_fixture_v1.js";

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

function expectThrow(action: () => void, prefix: string, message: string): void {
  try {
    action();
    check(false, message);
  } catch (error) {
    check(error instanceof Error && error.message.startsWith(prefix), message);
  }
}

const sourceInput = buildCap04PureScenarioMathInputV1();
const sourceResult = executeCap04PureThreeScenarioMathV1(sourceInput);

const blockedForecast = structuredClone(sourceInput);
blockedForecast.source_forecast.math_result.forecast_payload.status = "BLOCKED";
blockedForecast.source_forecast.math_result.forecast_payload.points = [];
blockedForecast.source_forecast.math_result.forecast_payload.scenario_eligible = false;
blockedForecast.source_forecast.math_result.forecast_payload.reason_codes = ["BLOCKED_FIXTURE"];
expectThrow(() => executeCap04PureThreeScenarioMathV1(blockedForecast), "CAP04_", "blocked Forecast cannot enter Scenario math");

const forcingDrift = structuredClone(sourceInput);
forcingDrift.forcing_window.forcing_window_hash = "sha256:forged";
expectThrow(() => executeCap04PureThreeScenarioMathV1(forcingDrift), "CAP04_FORCING_WINDOW_HASH_MISMATCH", "forged forcing trace is rejected before Scenario math");

const configDrift = structuredClone(sourceInput);
configDrift.runtime_config.hash = "sha256:other-config";
expectThrow(() => executeCap04PureThreeScenarioMathV1(configDrift), "CAP04_SCENARIO_SOURCE_FORECAST_CONFIG_MISMATCH", "source Forecast and pinned Runtime Config drift is rejected");

const reordered = structuredClone(sourceResult);
[reordered.scenario_set_payload.options[0], reordered.scenario_set_payload.options[1]] = [reordered.scenario_set_payload.options[1], reordered.scenario_set_payload.options[0]];
expectThrow(() => validateCap04PureThreeScenarioMathResultV1(reordered), "CAP04_SCENARIO_OPTION_ORDER_MISMATCH", "Scenario option reordering is rejected");

const noActionMutation = structuredClone(sourceResult);
noActionMutation.scenario_set_payload.options[0].trajectory_points[0].storage_mean_mm = "999.000000";
expectThrow(() => validateCap04PureThreeScenarioMathResultV1(noActionMutation), "CAP04_NO_ACTION_TRAJECTORY_NOT_DEEP_COPY_EQUIVALENT", "NO_ACTION trajectory mutation is rejected");

const fakeExecution = structuredClone(sourceResult) as unknown as Record<string, unknown>;
((fakeExecution.scenario_set_payload as { options: Array<Record<string, unknown>> }).options[1]).receipt = { receipt_id: "fake" };
expectThrow(() => validateCap04PureThreeScenarioMathResultV1(fakeExecution as never), "CAP04_SCENARIO_FAKE_EXECUTION_AUTHORITY_FORBIDDEN", "fake execution receipt is rejected");

const executedStatus = structuredClone(sourceResult);
(executedStatus.scenario_set_payload.options[1] as unknown as { execution_status: string }).execution_status = "EXECUTED";
expectThrow(() => validateCap04PureThreeScenarioMathResultV1(executedStatus), "CAP04_SCENARIO_ASSUMPTION_STATUS_MISMATCH", "Scenario cannot claim executed status");

const horizonDrift = structuredClone(sourceResult);
horizonDrift.scenario_set_payload.options[1].trajectory_points[1].assumed_irrigation_mm = "1.000000";
expectThrow(() => validateCap04PureThreeScenarioMathResultV1(horizonDrift), "CAP04_SCENARIO_OPTION_HASH_MISMATCH", "assumed irrigation after horizon 1 is rejected by option hash authority");

const efficiencyDrift = structuredClone(sourceResult);
efficiencyDrift.application_efficiency_basis.value = "0.900000";
expectThrow(() => validateCap04PureThreeScenarioMathResultV1(efficiencyDrift), "CAP04_SCENARIO_OPTION_EFFICIENCY_MISMATCH", "Scenario efficiency cannot drift from option metadata");

const comparatorDrift = structuredClone(sourceResult);
(comparatorDrift.stress_threshold_basis as unknown as { comparator: string }).comparator = "LESS_THAN_OR_EQUAL";
expectThrow(() => validateCap04PureThreeScenarioMathResultV1(comparatorDrift), "CAP04_SCENARIO_STRESS_COMPARATOR_MISMATCH", "stress comparator must remain strict less-than");

const forgedTrajectoryHash = structuredClone(sourceResult);
forgedTrajectoryHash.option_trajectory_hashes.IRRIGATE_NOW_15MM = "sha256:forged";
expectThrow(() => validateCap04PureThreeScenarioMathResultV1(forgedTrajectoryHash), "CAP04_SCENARIO_TRAJECTORY_HASH_MISMATCH", "forged option trajectory hash is rejected");

const forgedOptionHash = structuredClone(sourceResult);
forgedOptionHash.option_semantic_hashes.IRRIGATE_NOW_25MM = "sha256:forged";
expectThrow(() => validateCap04PureThreeScenarioMathResultV1(forgedOptionHash), "CAP04_SCENARIO_OPTION_HASH_MISMATCH", "forged option semantic hash is rejected");

const forgedMathHash = structuredClone(sourceResult);
forgedMathHash.scenario_math_hash = "sha256:forged";
expectThrow(() => validateCap04PureThreeScenarioMathResultV1(forgedMathHash), "CAP04_SCENARIO_MATH_HASH_MISMATCH", "forged Scenario math hash is rejected");

const deltaDrift = structuredClone(sourceResult);
deltaDrift.scenario_set_payload.options[2].difference_from_no_action.stress_hour_count_delta += 1;
expectThrow(() => validateCap04PureThreeScenarioMathResultV1(deltaDrift), "CAP04_SCENARIO_OPTION_HASH_MISMATCH", "difference_from_no_action drift is rejected by option hash authority");

const aggregateDrift = structuredClone(sourceResult);
aggregateDrift.scenario_set_payload.options[1].stress_hour_count += 1;
expectThrow(() => validateCap04PureThreeScenarioMathResultV1(aggregateDrift), "CAP04_SCENARIO_OPTION_HASH_MISMATCH", "stress aggregate drift is rejected by option hash authority");

console.log(`MCFT-CAP-04 pure scenario math negative: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
