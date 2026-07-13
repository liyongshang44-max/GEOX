// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_CONTRACTS_CONFIG.ts
// Purpose: prove deterministic CAP-04 S1 Forecast/Scenario DTOs, operation identities, canonical uniqueness and exact 24-config chain.
// Boundary: in-memory contract acceptance only; no Future Forcing selection, Forecast/Scenario math, persistence, route, scheduler or field claim.

import assert from "node:assert/strict";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  CAP04_A2_OPERATION_VARIANT_V1,
  CAP04_SCENARIO_POLICY_ID_V1,
  validateCap04ForecastRunPayloadV1,
  validateCap04ScenarioSetPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  deriveCap04ARecordSetIdentityV1,
  deriveCap04ScenarioSetIdentityV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import { validateCap04RuntimeConfigChainV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_chain_v1.js";
import { validateCap04RuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  CAP04_FIXTURE_SCOPE_V1,
  buildCap04BlockedForecastFixtureV1,
  buildCap04CompletedForecastFixtureV1,
  buildCap04ConfigChainFixtureV1,
  buildCap04ScenarioSetEnvelopeFixtureV1,
} from "./mcft_cap_04_contracts_config_fixture_v1.js";

let pass = 0;
const ok = (message: string): void => { pass += 1; console.log(`PASS ${message}`); };

const fixture = buildCap04ConfigChainFixtureV1();
assert.equal(fixture.configs.length, 24);
validateCap04RuntimeConfigChainV1(fixture.configs, {
  predecessor_runtime_config_ref: fixture.predecessor.object_id,
  predecessor_runtime_config_hash: fixture.predecessor.determinism_hash,
  first_effective_logical_time: "2026-06-03T02:00:00.000Z",
});
ok("exact 24-config immutable parent chain validates");

for (let index = 0; index < fixture.configs.length; index += 1) {
  const config = fixture.configs[index];
  validateCap04RuntimeConfigPayloadV1(config.payload);
  const expectedParent = index === 0 ? fixture.predecessor : fixture.configs[index - 1];
  assert.equal(config.payload.parent_runtime_config_ref, expectedParent.object_id);
  assert.equal(config.payload.parent_runtime_config_hash, expectedParent.determinism_hash);
  assert.equal(config.payload.effective_logical_time, new Date(Date.parse("2026-06-03T02:00:00.000Z") + index * 3_600_000).toISOString());
}
ok("every config pins the exact previous ref/hash and hourly effective time");

const repeated = buildCap04ConfigChainFixtureV1();
assert.deepEqual(repeated.configs.map((config) => [config.object_id, config.determinism_hash]), fixture.configs.map((config) => [config.object_id, config.determinism_hash]));
ok("same semantic input deterministically reproduces all config identities and hashes");

const firstPayload = fixture.configs[0].payload;
assert.equal(firstPayload.config_purpose, "FORECAST_AND_THREE_SCENARIO_CONTINUATION_RUNTIME_V1");
assert.equal(firstPayload.forecast_horizon_hours, 72);
assert.equal(firstPayload.forecast_step_hours, 1);
assert.equal(firstPayload.future_forcing_pair_policy_id, "JOINT_MATCHING_FORCING_CYCLE_V1");
assert.equal(firstPayload.future_forcing_fallback_policy_id, "NO_CROSS_SNAPSHOT_STITCHING_V1");
assert.deepEqual(firstPayload.scenario_option_ids, ["NO_ACTION", "IRRIGATE_NOW_15MM", "IRRIGATE_NOW_25MM"]);
assert.equal((firstPayload.scenario_application_efficiency_policy as Record<string, unknown>).value, "1.000000");
assert.equal((firstPayload.stress_threshold_policy as Record<string, unknown>).value, "0.350000");
ok("Runtime Config freezes Forecast, forcing-pair, Scenario and embedded policy authority");

const terminalKey = {
  scope: CAP04_FIXTURE_SCOPE_V1,
  lineage_id: "lineage_fixture_cap04",
  revision_id: "revision_fixture_cap04",
  logical_time: "2026-06-03T02:00:00.000Z",
};
const a1 = deriveCap04ARecordSetIdentityV1({ ...terminalKey, operation_variant: CAP04_A1_OPERATION_VARIANT_V1 });
const a2 = deriveCap04ARecordSetIdentityV1({ ...terminalKey, operation_variant: CAP04_A2_OPERATION_VARIANT_V1 });
assert.equal(a1.terminal_tick_uniqueness_key_hash, a2.terminal_tick_uniqueness_key_hash);
assert.notEqual(a1.operation_key_hash, a2.operation_key_hash);
assert.notEqual(a1.record_set_id, a2.record_set_id);
ok("A1/A2 share terminal uniqueness but retain distinct operation idempotency");

const completed = buildCap04CompletedForecastFixtureV1(fixture.configs[0].object_id, fixture.configs[0].determinism_hash);
validateCap04ForecastRunPayloadV1(completed);
assert.equal(completed.points.length, 72);
assert.equal(completed.points[0].horizon_hour, 1);
assert.equal(completed.points[71].horizon_hour, 72);
ok("completed Forecast contract contains exact ordered horizons 1 through 72");

const blocked = buildCap04BlockedForecastFixtureV1(fixture.configs[0].object_id, fixture.configs[0].determinism_hash);
validateCap04ForecastRunPayloadV1(blocked);
assert.equal(blocked.points.length, 0);
assert.equal(blocked.scenario_eligible, false);
ok("blocked Forecast contract is zero-point and Scenario-ineligible");

const forecastRef = "twin_forecast_run_fixture_cap04";
const forecastHash = `sha256:${"b".repeat(64)}`;
const scenarioSet = buildCap04ScenarioSetEnvelopeFixtureV1(forecastRef, forecastHash, completed);
validateCap04ScenarioSetPayloadV1(scenarioSet.payload, completed);
assert.deepEqual(scenarioSet.payload.options.map((option) => option.option_id), ["NO_ACTION", "IRRIGATE_NOW_15MM", "IRRIGATE_NOW_25MM"]);
assert.deepEqual(scenarioSet.payload.options[0].trajectory_points, completed.points);
ok("Scenario Set contract freezes exactly three ordered options and exact NO_ACTION copy");

const uniqueness = {
  source_forecast_ref: forecastRef,
  source_forecast_hash: forecastHash,
  lineage_id: "lineage_fixture_cap04",
  revision_id: "revision_fixture_cap04",
};
const b1 = deriveCap04ScenarioSetIdentityV1({
  uniqueness_key: uniqueness,
  scenario_policy_id: CAP04_SCENARIO_POLICY_ID_V1,
  runtime_config_ref: fixture.configs[0].object_id,
  runtime_config_hash: fixture.configs[0].determinism_hash,
  scenario_set_determinism_hash: scenarioSet.determinism_hash,
});
const b2 = deriveCap04ScenarioSetIdentityV1({
  uniqueness_key: uniqueness,
  scenario_policy_id: `${CAP04_SCENARIO_POLICY_ID_V1}_FORGED`,
  runtime_config_ref: fixture.configs[0].object_id,
  runtime_config_hash: fixture.configs[0].determinism_hash,
  scenario_set_determinism_hash: scenarioSet.determinism_hash,
});
assert.equal(b1.scenario_set_id, b2.scenario_set_id);
assert.notEqual(b1.idempotency_key, b2.idempotency_key);
ok("Scenario canonical uniqueness is source-Forecast bound while operation policy remains conflict-detectable");

console.log(`MCFT-CAP-04 contracts-config: ${pass} PASS, 0 FAIL`);
