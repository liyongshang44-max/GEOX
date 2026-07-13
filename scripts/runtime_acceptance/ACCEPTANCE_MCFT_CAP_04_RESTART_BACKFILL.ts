// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL.ts
// Purpose: prove CAP-04 uninterrupted 24-tick execution, 12+fresh-process+12 restart, bounded forward backfill and completed-target retry produce identical canonical A1/B hashes.
// Boundary: deterministic in-memory acceptance only; no production database, route, scheduler, late-Evidence revision, recommendation, decision, action, or field claim.

import assert from "node:assert/strict";
import {
  CAP04_S6_LOGICAL_TIME_V1,
} from "./mcft_cap_04_single_tick_fixture_v1.js";
import {
  CAP04_S7_FINAL_NEXT_LOGICAL_TIME_V1,
} from "./mcft_cap_04_twenty_four_tick_range_fixture_v1.js";
import {
  CAP04_S8_FINAL_TARGET_LOGICAL_TIME_V1,
  CAP04_S8_PROCESS_1_TARGET_LOGICAL_TIME_V1,
  buildCap04S8RestartFixtureV1,
  cap04AHashesV1,
  cap04BHashesV1,
} from "./mcft_cap_04_restart_backfill_recovery_fixture_v1.js";

let pass = 0;
function check(value: unknown, message: string): void {
  assert.ok(value, message);
  pass += 1;
  console.log(`PASS ${message}`);
}

const uninterrupted = await buildCap04S8RestartFixtureV1();
const uninterruptedResult = await uninterrupted.range_service.runContiguousRange({
  ...uninterrupted.range_input,
  to_logical_time: CAP04_S8_FINAL_TARGET_LOGICAL_TIME_V1,
});
check(uninterruptedResult.status === "COMPLETED", "uninterrupted 24-tick range completes");
check(uninterruptedResult.executed_tick_count === 24, "uninterrupted range executes exactly 24 ticks");

const restarted = await buildCap04S8RestartFixtureV1();
const process1 = await restarted.range_service.runContiguousRange({
  ...restarted.range_input,
  to_logical_time: CAP04_S8_PROCESS_1_TARGET_LOGICAL_TIME_V1,
  lease_owner: "cap04_s8_process_1",
});
check(process1.status === "COMPLETED" && process1.executed_tick_count === 12, "process 1 executes ticks 1 through 12");

const freshProcess = restarted.compose_fresh_services();
const process2 = await freshProcess.restart_service.resumeFromCheckpoint({
  ...restarted.range_input,
  to_logical_time: CAP04_S8_FINAL_TARGET_LOGICAL_TIME_V1,
  lease_owner: "cap04_s8_fresh_process_2",
});
check(process2.operator_intent === "RESUME", "fresh service composition uses explicit RESUME intent");
check(process2.persisted_start_logical_time === "2026-06-03T14:00:00.000Z", "fresh process starts from persisted tick 13 authority");
check(process2.range_result.status === "COMPLETED" && process2.range_result.executed_tick_count === 12, "fresh process executes ticks 13 through 24");

const restartedTicks = [...process1.tick_results, ...process2.range_result.tick_results];
assert.deepEqual(cap04AHashesV1(restartedTicks), cap04AHashesV1(uninterruptedResult.tick_results));
check(true, "12+fresh-process+12 A1 aggregate hashes equal uninterrupted hashes");
assert.deepEqual(cap04BHashesV1(restartedTicks), cap04BHashesV1(uninterruptedResult.tick_results));
check(true, "12+fresh-process+12 Scenario Set aggregate hashes equal uninterrupted hashes");
check(process2.range_result.final_handoff.previous_tick_sequence === 72, "restart final checkpoint sequence is 72");
check(process2.range_result.final_handoff.next_logical_tick_time === CAP04_S7_FINAL_NEXT_LOGICAL_TIME_V1, "restart final next logical time is exact");

const backfill = await buildCap04S8RestartFixtureV1();
const confirmedFirstTick = await backfill.range_service.runContiguousRange({
  ...backfill.range_input,
  to_logical_time: CAP04_S6_LOGICAL_TIME_V1,
  lease_owner: "cap04_s8_backfill_seed",
});
check(confirmedFirstTick.executed_tick_count === 1, "bounded backfill begins after one confirmed persisted tick");

const backfillProcess = backfill.compose_fresh_services();
const backfillResult = await backfillProcess.restart_service.runBoundedBackfill({
  ...backfill.range_input,
  to_logical_time: CAP04_S8_FINAL_TARGET_LOGICAL_TIME_V1,
  requested_start_logical_time: "2026-06-03T03:00:00.000Z",
  evidence_intent: "MISSED_SCHEDULE_CATCH_UP",
  lease_owner: "cap04_s8_bounded_backfill",
});
check(backfillResult.operator_intent === "BACKFILL", "bounded catch-up uses explicit BACKFILL intent");
check(backfillResult.range_result.executed_tick_count === 23, "bounded backfill executes remaining 23 ticks");
const backfillTicks = [...confirmedFirstTick.tick_results, ...backfillResult.range_result.tick_results];
assert.deepEqual(cap04AHashesV1(backfillTicks), cap04AHashesV1(uninterruptedResult.tick_results));
check(true, "bounded forward backfill A1 hashes equal uninterrupted hashes");
assert.deepEqual(cap04BHashesV1(backfillTicks), cap04BHashesV1(uninterruptedResult.tick_results));
check(true, "bounded forward backfill Scenario Set hashes equal uninterrupted hashes");

const beforeRetry = {
  evidence: backfill.evidence_load_count(),
  a: backfill.runtime.aCommitCount,
  b: backfill.runtime.bCommitCount,
};
const completedRetry = await backfillProcess.restart_service.resumeFromCheckpoint({
  ...backfill.range_input,
  to_logical_time: CAP04_S8_FINAL_TARGET_LOGICAL_TIME_V1,
  lease_owner: "cap04_s8_completed_retry",
});
check(completedRetry.range_result.status === "ALREADY_COMPLETE", "completed target retry returns ALREADY_COMPLETE");
assert.deepEqual({
  evidence: backfill.evidence_load_count(),
  a: backfill.runtime.aCommitCount,
  b: backfill.runtime.bCommitCount,
}, beforeRetry);
check(true, "completed target retry performs zero Evidence loads and zero canonical writes");

console.log(`MCFT-CAP-04 S8 restart/backfill acceptance: ${pass} PASS`);
