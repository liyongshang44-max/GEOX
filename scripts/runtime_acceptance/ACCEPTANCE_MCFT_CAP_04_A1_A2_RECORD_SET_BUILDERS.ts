// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_A1_A2_RECORD_SET_BUILDERS.ts
// Purpose: prove S5A constructs deterministic, graph-complete, strictly separated A1 completed-Forecast and A2 blocked-Forecast eight-member record-set candidates.
// Boundary: pure acceptance only; no database, migration, projection, route, scheduler, live data, recommendation, decision, or action.

import {
  CAP04_A1_OPERATION_VARIANT_V1,
  CAP04_A2_OPERATION_VARIANT_V1,
  CAP04_A_MEMBER_OBJECT_TYPES_V1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import { validateCap04ARecordSetV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import type { Cap04ARecordSetV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import {
  buildCap04BlockedForecastRecordSetV1,
  buildCap04CompletedForecastRecordSetV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.js";
import {
  buildCap04A1A2Builder24TickInputsV1,
  buildCap04A1A2BuilderInputsV1,
} from "./mcft_cap_04_a1_a2_record_set_fixture_v1.js";

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

function memberV1(recordSet: Cap04ARecordSetV1, type: string) {
  const matches = recordSet.members.filter((member) => member.object_type === type);
  if (matches.length !== 1) throw new Error(`CAP04_S5A_MEMBER_CARDINALITY:${type}`);
  return matches[0];
}

const inputs = buildCap04A1A2BuilderInputsV1();
const a1 = buildCap04CompletedForecastRecordSetV1(inputs.completed);
const a2 = buildCap04BlockedForecastRecordSetV1(inputs.blocked);
validateCap04ARecordSetV1(a1);
validateCap04ARecordSetV1(a2);
check(true, "A1 and A2 candidates pass the complete CAP-04 record-set validator");

check(
  a1.members.length === 8
    && a2.members.length === 8
    && JSON.stringify(a1.members.map((member) => member.object_type).sort()) === JSON.stringify([...CAP04_A_MEMBER_OBJECT_TYPES_V1].sort())
    && JSON.stringify(a2.members.map((member) => member.object_type).sort()) === JSON.stringify([...CAP04_A_MEMBER_OBJECT_TYPES_V1].sort()),
  "both variants contain exactly the frozen eight canonical object types",
);

check(
  a1.operation_key.operation_variant === CAP04_A1_OPERATION_VARIANT_V1
    && a2.operation_key.operation_variant === CAP04_A2_OPERATION_VARIANT_V1
    && a1.record_set_contract_id !== a2.record_set_contract_id,
  "A1 and A2 retain strict operation-variant and contract separation",
);

check(
  a1.terminal_tick_uniqueness_key_hash === a2.terminal_tick_uniqueness_key_hash
    && JSON.stringify(a1.terminal_tick_uniqueness_key) === JSON.stringify(a2.terminal_tick_uniqueness_key),
  "A1 and A2 share the exact cross-variant terminal tick uniqueness identity",
);

check(
  a1.operation_key_hash !== a2.operation_key_hash
    && a1.record_set_id !== a2.record_set_id
    && a1.idempotency_key !== a2.idempotency_key,
  "operation variant produces distinct operation, record-set and idempotency identities",
);

const a1Forecast = memberV1(a1, "twin_forecast_run_v1");
const a1Tick = memberV1(a1, "twin_runtime_tick_v1");
const a1Checkpoint = memberV1(a1, "twin_runtime_checkpoint_v1");
check(
  a1Forecast.payload.status === "COMPLETED"
    && Array.isArray(a1Forecast.payload.points)
    && a1Forecast.payload.points.length === 72
    && a1Forecast.payload.scenario_eligible === true
    && a1Tick.payload.status === "COMPLETED"
    && a1Checkpoint.payload.successful_forecast_ref === a1Forecast.object_id,
  "A1 publishes a successful 72-point Forecast and advances successful Forecast authority",
);

const a2Forecast = memberV1(a2, "twin_forecast_run_v1");
const a2Tick = memberV1(a2, "twin_runtime_tick_v1");
const a2Checkpoint = memberV1(a2, "twin_runtime_checkpoint_v1");
check(
  a2Forecast.payload.status === "BLOCKED"
    && Array.isArray(a2Forecast.payload.points)
    && a2Forecast.payload.points.length === 0
    && a2Forecast.payload.scenario_eligible === false
    && a2Tick.payload.status === "COMPLETED_WITH_LIMITATIONS"
    && a2Tick.payload.stop_after_blocked_forecast === true
    && a2Checkpoint.payload.successful_forecast_ref === inputs.blocked.previous_successful_forecast_ref,
  "A2 advances State/checkpoint with blocked Forecast while preserving previous successful Forecast",
);

check(
  a1Tick.payload.record_set_id === a1.record_set_id
    && a1Tick.payload.aggregate_determinism_hash === a1.aggregate_determinism_hash
    && a1Tick.payload.evidence_window_ref === memberV1(a1, "twin_evidence_window_v1").object_id
    && a1Tick.payload.state_transition_ref === memberV1(a1, "twin_state_transition_v1").object_id
    && a1Tick.payload.assimilation_update_ref === memberV1(a1, "twin_assimilation_update_v1").object_id
    && a1Tick.payload.posterior_state_ref === memberV1(a1, "twin_state_estimate_v1").object_id
    && a1Tick.payload.forecast_result_ref === a1Forecast.object_id
    && a1Tick.payload.checkpoint_ref === a1Checkpoint.object_id
    && !("health_ref" in a1Tick.payload),
  "Tick is the complete six-direct-reference recovery root with no health_ref",
);

const repeatedA1 = buildCap04CompletedForecastRecordSetV1(structuredClone(inputs.completed));
const repeatedA2 = buildCap04BlockedForecastRecordSetV1(structuredClone(inputs.blocked));
check(
  JSON.stringify(repeatedA1) === JSON.stringify(a1)
    && JSON.stringify(repeatedA2) === JSON.stringify(a2),
  "same semantic input deterministically reproduces every member and aggregate hash",
);

const range = buildCap04A1A2Builder24TickInputsV1().map((item) =>
  buildCap04CompletedForecastRecordSetV1(item.completed));
const terminalHashes = new Set(range.map((recordSet) => recordSet.terminal_tick_uniqueness_key_hash));
const recordSetIds = new Set(range.map((recordSet) => recordSet.record_set_id));
check(
  range.length === 24
    && terminalHashes.size === 24
    && recordSetIds.size === 24
    && range.every((recordSet) => memberV1(recordSet, "twin_forecast_run_v1").payload.points.length === 72),
  "24 standard ticks produce 24 distinct valid A1 record-set candidates",
);

console.log(`MCFT-CAP-04 A1/A2 record-set builders: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
