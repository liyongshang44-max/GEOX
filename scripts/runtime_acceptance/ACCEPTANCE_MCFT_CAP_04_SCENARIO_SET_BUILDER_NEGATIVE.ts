// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SCENARIO_SET_BUILDER_NEGATIVE.ts
// Purpose: prove CAP-04 B Scenario Set validation rejects source-authority drift, option-order drift, identity forgery, aggregate forgery, and a blocked source Forecast.
// Boundary: pure negative acceptance only; no database, migration, projection mutation, route, scheduler, live data, recommendation, decision, or action.

import { computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { validateCap04ScenarioSetRecordV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { buildCap04S5BPersistenceFixtureV1 } from "./mcft_cap_04_persistence_fixture_v1.js";

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

function expectThrow(action: () => void, pattern: RegExp, message: string): void {
  try {
    action();
    check(false, message);
  } catch (error) {
    check(error instanceof Error && pattern.test(error.message), message);
  }
}

const fixture = buildCap04S5BPersistenceFixtureV1();
const sourceForecast = fixture.a1.members.find((member) => member.object_type === "twin_forecast_run_v1");
const blockedForecast = fixture.a2.members.find((member) => member.object_type === "twin_forecast_run_v1");
if (!sourceForecast || !blockedForecast) throw new Error("CAP04_S5B_FORECAST_MEMBERS_MISSING");

const sourceHashDrift = structuredClone(fixture.b);
sourceHashDrift.scenario_set.payload.source_forecast_hash = "sha256:forged";
sourceHashDrift.scenario_set.determinism_hash = computeMemberDeterminismHashV1(
  sourceHashDrift.scenario_set as unknown as Record<string, unknown>,
);
sourceHashDrift.aggregate_determinism_hash = sourceHashDrift.scenario_set.determinism_hash;
expectThrow(
  () => validateCap04ScenarioSetRecordV1(sourceHashDrift, sourceForecast),
  /CAP04_B_SOURCE_FORECAST_MISMATCH|CAP04_SCENARIO_SOURCE_FORECAST_MISMATCH/,
  "B validation rejects source Forecast hash drift after internal hash recomputation",
);

const optionOrderDrift = structuredClone(fixture.b);
[optionOrderDrift.scenario_set.payload.options[0], optionOrderDrift.scenario_set.payload.options[1]] = [
  optionOrderDrift.scenario_set.payload.options[1],
  optionOrderDrift.scenario_set.payload.options[0],
];
expectThrow(
  () => validateCap04ScenarioSetRecordV1(optionOrderDrift, sourceForecast),
  /CAP04_SCENARIO_OPTION_ORDER_MISMATCH/,
  "B validation rejects Scenario option order drift",
);

const objectIdForgery = structuredClone(fixture.b);
objectIdForgery.scenario_set_id = "twin_scenario_set_forged";
expectThrow(
  () => validateCap04ScenarioSetRecordV1(objectIdForgery, sourceForecast),
  /CAP04_B_IDENTITY_MISMATCH/,
  "B validation rejects Scenario Set identity forgery",
);

const aggregateForgery = structuredClone(fixture.b);
aggregateForgery.aggregate_determinism_hash = "sha256:forged";
expectThrow(
  () => validateCap04ScenarioSetRecordV1(aggregateForgery, sourceForecast),
  /CAP04_B_AGGREGATE_MISMATCH/,
  "B validation rejects aggregate determinism hash forgery",
);

const lineageDrift = structuredClone(fixture.b);
lineageDrift.scenario_set_uniqueness_key.lineage_id = "lineage_forged";
expectThrow(
  () => validateCap04ScenarioSetRecordV1(lineageDrift, sourceForecast),
  /CAP04_B_IDENTITY_MISMATCH|CAP04_B_LINEAGE_REVISION_MISMATCH/,
  "B validation rejects lineage authority drift",
);

expectThrow(
  () => validateCap04ScenarioSetRecordV1(fixture.b, blockedForecast as CanonicalObjectEnvelopeV1),
  /CAP04_SCENARIO_REQUIRES_COMPLETED_FORECAST|CAP04_B_SOURCE_FORECAST_MISMATCH/,
  "B validation rejects a blocked source Forecast",
);

console.log(`MCFT-CAP-04 Scenario Set builder negative: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
