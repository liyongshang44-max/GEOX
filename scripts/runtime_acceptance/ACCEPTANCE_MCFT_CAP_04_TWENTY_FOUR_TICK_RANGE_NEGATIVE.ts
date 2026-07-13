// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE_NEGATIVE.ts
// Purpose: prove S7 prevalidates all Config pins before writes, enforces the 24-tick bound, stops explicitly after legal A2, and leaves no terminal tick for malformed forcing FAILED.
// Boundary: in-memory negative range acceptance only; no production database, restart/backfill mode, route, scheduler, recommendation, decision, action, calibration, model activation, or live-field claim.

import {
  CAP04_S7_TARGET_LOGICAL_TIME_V1,
  buildCap04S7RangeFixtureV1,
} from "./mcft_cap_04_twenty_four_tick_range_fixture_v1.js";

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

async function expectReject(action: () => Promise<unknown>, pattern: RegExp, message: string): Promise<void> {
  try {
    await action();
    check(false, message);
  } catch (error) {
    check(error instanceof Error && pattern.test(error.message), message);
  }
}

async function main(): Promise<void> {
  const missingConfig = await buildCap04S7RangeFixtureV1();
  const missingRefs = { ...missingConfig.range_input.runtime_config_refs_by_logical_time };
  delete missingRefs["2026-06-03T14:00:00.000Z"];
  await expectReject(
    () => missingConfig.range_service.runContiguousRange({
      ...missingConfig.range_input,
      runtime_config_refs_by_logical_time: missingRefs,
    }),
    /CAP04_RANGE_RUNTIME_CONFIG_REF_REQUIRED:2026-06-03T14:00:00.000Z/,
    "missing future Runtime Config ref fails before the first tick",
  );
  check(
    missingConfig.evidence_load_count() === 0
      && missingConfig.runtime.aCommitCount === 0
      && missingConfig.runtime.bCommitCount === 0
      && missingConfig.runtime.leaseAcquireCount === 0,
    "Config prevalidation failure performs zero Evidence loads, leases or canonical writes",
  );

  const tooLong = await buildCap04S7RangeFixtureV1();
  await expectReject(
    () => tooLong.range_service.runContiguousRange({
      ...tooLong.range_input,
      to_logical_time: "2026-06-04T02:00:00.000Z",
    }),
    /CAP04_RANGE_MAX_TICKS_EXCEEDED/,
    "25 requested ticks exceed the frozen range maximum",
  );
  check(tooLong.runtime.aCommitCount === 0 && tooLong.evidence_load_count() === 0, "maximum bound fails before execution");

  const nonHour = await buildCap04S7RangeFixtureV1();
  await expectReject(
    () => nonHour.range_service.runContiguousRange({
      ...nonHour.range_input,
      to_logical_time: "2026-06-04T01:30:00.000Z",
    }),
    /CAP04_RANGE_TARGET_NOT_CANONICAL_HOUR/,
    "non-hour-aligned target is rejected",
  );
  check(nonHour.runtime.aCommitCount === 0, "invalid target performs zero writes");

  const blocked = await buildCap04S7RangeFixtureV1({ blocked_tick_index: 5 });
  const blockedResult = await blocked.range_service.runContiguousRange(blocked.range_input);
  check(blockedResult.status === "BLOCKED", "legal unavailable forcing returns explicit BLOCKED range status");
  check(blockedResult.executed_tick_count === 6, "range stops immediately after the sixth terminal tick");
  check(blockedResult.successful_a1_tick_count === 5 && blockedResult.blocked_a2_tick_count === 1, "five A1 ticks precede exactly one A2");
  check(blockedResult.posterior_state_count === 6, "A2 still persists the sixth posterior State");
  check(blockedResult.successful_forecast_run_count === 5 && blockedResult.scenario_set_count === 5, "A2 does not create a successful Forecast or Scenario Set");
  check(blockedResult.forecast_point_count === 360 && blockedResult.scenario_point_count === 1080, "blocked range counts only five successful trajectories");
  check(blockedResult.blocked_logical_time === "2026-06-03T07:00:00.000Z", "blocked logical time is exact");
  check(blockedResult.final_handoff.previous_tick_sequence === 54 && blockedResult.final_handoff.next_logical_tick_time === "2026-06-03T08:00:00.000Z", "A2 advances checkpoint once and stops");
  check(blocked.runtime.aCommitCount === 6 && blocked.runtime.bCommitCount === 5, "blocked range commits six A sets and only five B sets");
  check(blocked.evidence_load_count() === 6 && blocked.runtime.leaseAcquireCount === 6, "blocked range reads and leases only through the stop tick");
  const blockedTick = blockedResult.tick_results[5];
  check(blockedTick.status === "BLOCKED_INSERTED" && blockedTick.b_record === null, "stop tick is canonical A2 with no B");

  const malformed = await buildCap04S7RangeFixtureV1({ malformed_tick_index: 5 });
  await expectReject(
    () => malformed.range_service.runContiguousRange(malformed.range_input),
    /CAP04_SINGLE_TICK_FORCING_FAILED:MALFORMED_FORCING_RECORD:FORCING_POINTS_NOT_EXACT_72_HOURLY/,
    "malformed sixth forcing window is FAILED, not A2",
  );
  const malformedSnapshot = malformed.runtime.currentSnapshotV1();
  check(malformed.runtime.aCommitCount === 5 && malformed.runtime.bCommitCount === 5, "FAILED sixth tick leaves only five A1+B commits");
  check(malformed.runtime.leaseAcquireCount === 5, "malformed forcing fails before the sixth lease");
  check(malformed.evidence_load_count() === 6, "malformed forcing is detected from the sixth Evidence load");
  check(malformedSnapshot.checkpoint.payload.tick_sequence === 53, "FAILED sixth tick does not advance checkpoint sequence");
  check(malformedSnapshot.checkpoint.payload.next_tick_logical_time === "2026-06-03T07:00:00.000Z", "FAILED sixth tick remains the persisted next tick");

  const alreadyCompleteTarget = await buildCap04S7RangeFixtureV1();
  const completed = await alreadyCompleteTarget.range_service.runContiguousRange(alreadyCompleteTarget.range_input);
  check(completed.requested_target_logical_time === CAP04_S7_TARGET_LOGICAL_TIME_V1, "standard target remains frozen in negative suite");

  console.log(`MCFT-CAP-04 24-tick range negative: ${pass} PASS, ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
