// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SCENARIO_SET_BUILDER.ts
// Purpose: prove the pure CAP-04 B Scenario Set builder produces one deterministic canonical candidate with exact source authority, three ordered options, 216 points, and re-derived identity.
// Boundary: pure acceptance only; no database, migration, projection mutation, route, scheduler, live data, recommendation, decision, or action.

import assert from "node:assert/strict";
import { deriveCap04ScenarioSetIdentityV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import { validateCap04ScenarioSetRecordV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { buildCap04S5BPersistenceFixtureV1 } from "./mcft_cap_04_persistence_fixture_v1.js";

let pass = 0;
const ok = (message: string): void => { pass += 1; console.log(`PASS ${message}`); };

function forecastMember(): CanonicalObjectEnvelopeV1 {
  const fixture = buildCap04S5BPersistenceFixtureV1();
  const forecast = fixture.a1.members.find((member) => member.object_type === "twin_forecast_run_v1");
  if (!forecast) throw new Error("CAP04_S5B_FORECAST_MEMBER_MISSING");
  return forecast;
}

const fixture = buildCap04S5BPersistenceFixtureV1();
const sourceForecast = forecastMember();
validateCap04ScenarioSetRecordV1(fixture.b, sourceForecast);
ok("B Scenario Set candidate validates against the completed source Forecast envelope");

assert.equal(fixture.b.scenario_set.payload.options.length, 3);
assert.deepEqual(
  fixture.b.scenario_set.payload.options.map((option) => option.option_id),
  ["NO_ACTION", "IRRIGATE_NOW_15MM", "IRRIGATE_NOW_25MM"],
);
assert.equal(
  fixture.b.scenario_set.payload.options.reduce((count, option) => count + option.trajectory_points.length, 0),
  216,
);
ok("B candidate contains exactly three ordered options and 216 Scenario points");

assert.equal(fixture.b.scenario_set.payload.source_forecast_ref, sourceForecast.object_id);
assert.equal(fixture.b.scenario_set.payload.source_forecast_hash, sourceForecast.determinism_hash);
assert.equal(fixture.b.scenario_set.payload.source_posterior_ref, sourceForecast.payload.source_posterior_ref);
assert.equal(fixture.b.scenario_set.payload.runtime_config_ref, sourceForecast.payload.runtime_config_ref);
ok("B source Forecast, posterior and Runtime Config authorities are exact");

const identity = deriveCap04ScenarioSetIdentityV1({
  uniqueness_key: fixture.b.scenario_set_uniqueness_key,
  scenario_policy_id: fixture.b.operation_key.scenario_policy_id,
  runtime_config_ref: fixture.b.operation_key.runtime_config_ref,
  runtime_config_hash: fixture.b.operation_key.runtime_config_hash,
  scenario_set_determinism_hash: fixture.b.scenario_set.determinism_hash,
});
assert.equal(identity.scenario_set_id, fixture.b.scenario_set_id);
assert.equal(identity.idempotency_key, fixture.b.idempotency_key);
assert.equal(identity.aggregate_determinism_hash, fixture.b.aggregate_determinism_hash);
ok("B object, operation, uniqueness, idempotency and aggregate identities re-derive exactly");

const repeated = buildCap04S5BPersistenceFixtureV1();
assert.equal(JSON.stringify(repeated.b), JSON.stringify(fixture.b));
ok("same semantic input deterministically reproduces the complete B candidate");

console.log(`MCFT-CAP-04 Scenario Set builder: ${pass} PASS, 0 FAIL`);
