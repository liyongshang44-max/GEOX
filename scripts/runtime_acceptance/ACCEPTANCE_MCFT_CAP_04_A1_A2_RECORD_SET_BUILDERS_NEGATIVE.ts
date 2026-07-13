// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_A1_A2_RECORD_SET_BUILDERS_NEGATIVE.ts
// Purpose: prove S5A fails closed on variant/status confusion, malformed source graphs, config drift, source-State drift, Forecast cardinality errors, recovery-root corruption and aggregate hash forgery.
// Boundary: pure negative acceptance only; no database, migration, projection, route, scheduler, live data, recommendation, decision, or action.

import { computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { validateCap04ARecordSetV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import {
  buildCap04BlockedForecastRecordSetV1,
  buildCap04CompletedForecastRecordSetV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.js";
import { buildCap04A1A2BuilderInputsV1 } from "./mcft_cap_04_a1_a2_record_set_fixture_v1.js";

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

const inputs = buildCap04A1A2BuilderInputsV1();
expectThrow(
  () => buildCap04CompletedForecastRecordSetV1(inputs.blocked),
  "CAP04_BUILDER_FORECAST_STATUS_VARIANT_MISMATCH",
  "A1 builder rejects BLOCKED Forecast payload",
);
expectThrow(
  () => buildCap04BlockedForecastRecordSetV1(inputs.completed),
  "CAP04_BUILDER_FORECAST_STATUS_VARIANT_MISMATCH",
  "A2 builder rejects COMPLETED Forecast payload",
);

const brokenGraph = structuredClone(inputs.completed);
brokenGraph.source_members.twin_state_transition_v1.payload.posterior_state_ref = "twin_state_estimate_wrong";
brokenGraph.source_members.twin_state_transition_v1.determinism_hash = computeMemberDeterminismHashV1(
  brokenGraph.source_members.twin_state_transition_v1 as unknown as Record<string, unknown>,
);
expectThrow(
  () => buildCap04CompletedForecastRecordSetV1(brokenGraph),
  "CAP04_BUILDER_SOURCE_TRANSITION_STATE_MISMATCH",
  "source four-member cross-reference drift is rejected",
);

const forgedSourceHash = structuredClone(inputs.completed);
forgedSourceHash.source_members.twin_state_estimate_v1.determinism_hash = "sha256:forged";
expectThrow(
  () => buildCap04CompletedForecastRecordSetV1(forgedSourceHash),
  "CAP04_BUILDER_SOURCE_MEMBER_HASH_MISMATCH",
  "forged source member hash is rejected",
);

const configTimeDrift = structuredClone(inputs.completed);
configTimeDrift.runtime_config.logical_time = "2026-06-03T03:00:00.000Z";
expectThrow(
  () => buildCap04CompletedForecastRecordSetV1(configTimeDrift),
  "CAP04_BUILDER_RUNTIME_CONFIG_LOGICAL_TIME_MISMATCH",
  "Runtime Config logical-time drift is rejected",
);

const configIdentityDrift = structuredClone(inputs.completed);
configIdentityDrift.forecast_payload.runtime_config_hash = "sha256:other-config";
expectThrow(
  () => buildCap04CompletedForecastRecordSetV1(configIdentityDrift),
  "CAP04_BUILDER_FORECAST_RUNTIME_CONFIG_MISMATCH",
  "Forecast and pinned Runtime Config identity drift is rejected",
);

const sourceStateDrift = structuredClone(inputs.completed);
sourceStateDrift.forecast_payload.source_posterior_ref = "twin_state_estimate_other";
expectThrow(
  () => buildCap04CompletedForecastRecordSetV1(sourceStateDrift),
  "CAP04_BUILDER_FORECAST_SOURCE_STATE_MISMATCH",
  "Forecast source posterior drift is rejected",
);

const completed71 = structuredClone(inputs.completed);
completed71.forecast_payload.points = completed71.forecast_payload.points.slice(0, 71);
expectThrow(
  () => buildCap04CompletedForecastRecordSetV1(completed71),
  "CAP04_COMPLETED_FORECAST_REQUIRES_72_POINTS",
  "A1 builder rejects 71-point completed Forecast",
);

const blockedWithoutReason = structuredClone(inputs.blocked);
blockedWithoutReason.forecast_payload.reason_codes = [];
expectThrow(
  () => buildCap04BlockedForecastRecordSetV1(blockedWithoutReason),
  "CAP04_BLOCKED_FORECAST_REASONS_REQUIRED",
  "A2 builder rejects blocked Forecast without reason codes",
);

const created = buildCap04CompletedForecastRecordSetV1(inputs.completed);
const healthRefForgery = structuredClone(created);
const tick = healthRefForgery.members.find((member) => member.object_type === "twin_runtime_tick_v1");
if (!tick) throw new Error("CAP04_S5A_TICK_REQUIRED");
tick.payload.health_ref = "twin_runtime_health_fake";
expectThrow(
  () => validateCap04ARecordSetV1(healthRefForgery),
  "CAP04_MEMBER_SEMANTIC_HASH_MISMATCH",
  "recovery-root health_ref injection is rejected before graph acceptance",
);

const aggregateForgery = structuredClone(created);
aggregateForgery.aggregate_determinism_hash = "sha256:forged";
expectThrow(
  () => validateCap04ARecordSetV1(aggregateForgery),
  "CAP04_TICK_RECOVERY_ROOT_IDENTITY_MISMATCH",
  "forged aggregate hash is rejected against Tick recovery-root identity",
);

const memberIdForgery = structuredClone(created);
memberIdForgery.members[0].object_id = "twin_evidence_window_forged";
expectThrow(
  () => validateCap04ARecordSetV1(memberIdForgery),
  "CAP04_MEMBER_SEMANTIC_HASH_MISMATCH",
  "member object-id forgery is rejected",
);

const a2 = buildCap04BlockedForecastRecordSetV1(inputs.blocked);
const a2Checkpoint = a2.members.find((member) => member.object_type === "twin_runtime_checkpoint_v1");
if (!a2Checkpoint) throw new Error("CAP04_S5A_A2_CHECKPOINT_REQUIRED");
check(
  a2Checkpoint.payload.successful_forecast_ref === inputs.blocked.previous_successful_forecast_ref,
  "A2 never promotes the blocked Forecast to successful Forecast authority",
);

console.log(`MCFT-CAP-04 A1/A2 record-set builders negative: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
