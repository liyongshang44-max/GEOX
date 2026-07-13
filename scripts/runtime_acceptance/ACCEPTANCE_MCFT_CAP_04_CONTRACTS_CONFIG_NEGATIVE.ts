// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_CONTRACTS_CONFIG_NEGATIVE.ts
// Purpose: prove fail-closed rejection for malformed Forecast/Scenario DTOs, broken config chains, dangling authorities and unknown dispatch contracts.
// Boundary: in-memory negative acceptance only; no persistence, Forecast/Scenario execution, route, scheduler or field claim.

import assert from "node:assert/strict";
import {
  validateCap04ForecastRunPayloadV1,
  validateCap04ScenarioSetPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import { validateCap04RuntimeConfigChainV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_chain_v1.js";
import { validateCap04RuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  buildCap04CompletedForecastFixtureV1,
  buildCap04ConfigChainFixtureV1,
  buildCap04ScenarioSetEnvelopeFixtureV1,
} from "./mcft_cap_04_contracts_config_fixture_v1.js";

let pass = 0;
const rejected = async (fn: () => unknown, pattern: RegExp, message: string): Promise<void> => {
  await assert.rejects(async () => fn(), pattern);
  pass += 1;
  console.log(`PASS ${message}`);
};

async function main(): Promise<void> {
  const fixture = buildCap04ConfigChainFixtureV1();
const config = fixture.configs[0];
const completed = buildCap04CompletedForecastFixtureV1(config.object_id, config.determinism_hash);

const horizonZero = structuredClone(completed);
horizonZero.points[0].horizon_hour = 0;
await rejected(() => validateCap04ForecastRunPayloadV1(horizonZero), /HORIZON_SEQUENCE/, "horizon zero is rejected");

const missingPoint = structuredClone(completed);
missingPoint.points.pop();
await rejected(() => validateCap04ForecastRunPayloadV1(missingPoint), /REQUIRES_72_POINTS/, "71-point completed Forecast is rejected");

const duplicateTarget = structuredClone(completed);
duplicateTarget.points[1].target_time = duplicateTarget.points[0].target_time;
await rejected(() => validateCap04ForecastRunPayloadV1(duplicateTarget), /TARGET_TIME_MISMATCH/, "duplicate/out-of-order target time is rejected");

const blockedWithPoints = structuredClone(completed);
blockedWithPoints.status = "BLOCKED";
blockedWithPoints.reason_codes = ["FORGED_BLOCK"];
blockedWithPoints.scenario_eligible = false;
await rejected(() => validateCap04ForecastRunPayloadV1(blockedWithPoints), /ZERO_POINTS/, "blocked Forecast with points is rejected");

const completedWithReasons = structuredClone(completed);
completedWithReasons.reason_codes = ["FORGED_REASON"];
await rejected(() => validateCap04ForecastRunPayloadV1(completedWithReasons), /REASON_CODES_FORBIDDEN/, "completed Forecast with reason codes is rejected");

const scenarioSet = buildCap04ScenarioSetEnvelopeFixtureV1("twin_forecast_run_fixture_cap04", `sha256:${"b".repeat(64)}`, completed);
const reordered = structuredClone(scenarioSet.payload);
[reordered.options[0], reordered.options[1]] = [reordered.options[1], reordered.options[0]];
await rejected(() => validateCap04ScenarioSetPayloadV1(reordered, completed), /OPTION_ORDER/, "Scenario option reordering is rejected");

const danglingAssumption = structuredClone(scenarioSet.payload) as typeof scenarioSet.payload & { options: Array<Record<string, unknown>> };
danglingAssumption.options[1].assumption_ref = "dangling_assumption";
await rejected(() => validateCap04ScenarioSetPayloadV1(danglingAssumption as typeof scenarioSet.payload, completed), /DANGLING_ASSUMPTION_REF/, "dangling assumption_ref is rejected");

const fakeExecution = structuredClone(scenarioSet.payload);
fakeExecution.options[1].execution_status = "EXECUTED" as "NOT_EXECUTED";
await rejected(() => validateCap04ScenarioSetPayloadV1(fakeExecution, completed), /ASSUMPTION_STATUS/, "fake Scenario execution status is rejected");

const brokenParent = structuredClone(fixture.configs);
brokenParent[3].payload.parent_runtime_config_ref = fixture.predecessor.object_id;
await rejected(() => validateCap04RuntimeConfigChainV1(brokenParent, {
  predecessor_runtime_config_ref: fixture.predecessor.object_id,
  predecessor_runtime_config_hash: fixture.predecessor.determinism_hash,
  first_effective_logical_time: "2026-06-03T02:00:00.000Z",
}), /PARENT_MISMATCH/, "broken config parent chain is rejected");

const selfParent = structuredClone(fixture.configs);
selfParent[0].payload.parent_runtime_config_ref = selfParent[0].object_id;
await rejected(() => validateCap04RuntimeConfigChainV1(selfParent, {
  predecessor_runtime_config_ref: fixture.predecessor.object_id,
  predecessor_runtime_config_hash: fixture.predecessor.determinism_hash,
  first_effective_logical_time: "2026-06-03T02:00:00.000Z",
}), /PARENT_MISMATCH|SELF_PARENT/, "self-parent Runtime Config is rejected");

const shortChain = fixture.configs.slice(0, 23);
await rejected(() => validateCap04RuntimeConfigChainV1(shortChain, {
  predecessor_runtime_config_ref: fixture.predecessor.object_id,
  predecessor_runtime_config_hash: fixture.predecessor.determinism_hash,
  first_effective_logical_time: "2026-06-03T02:00:00.000Z",
}), /REQUIRES_24_CONFIGS/, "23-config chain is rejected");

const danglingPolicy = structuredClone(config.payload) as Record<string, unknown>;
danglingPolicy.scenario_application_efficiency_ref = "dangling_policy_ref";
await rejected(() => validateCap04RuntimeConfigPayloadV1(danglingPolicy), /DANGLING_POLICY_AUTHORITY/, "dangling external Scenario policy authority is rejected");

const pointerMode = structuredClone(config.payload) as Record<string, unknown>;
pointerMode.config_selection_mode = "LATEST_ACTIVE_POINTER";
await rejected(() => validateCap04RuntimeConfigPayloadV1(pointerMode), /SELECTION_MODE_MISMATCH/, "active-config pointer selection is rejected");

const wrongOptions = structuredClone(config.payload) as Record<string, unknown>;
wrongOptions.scenario_option_ids = ["NO_ACTION", "IRRIGATE_NOW_25MM", "IRRIGATE_NOW_15MM"];
await rejected(() => validateCap04RuntimeConfigPayloadV1(wrongOptions), /SCENARIO_OPTIONS_MISMATCH/, "Scenario option order drift is rejected");

  console.log(`MCFT-CAP-04 contracts-config negative: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
