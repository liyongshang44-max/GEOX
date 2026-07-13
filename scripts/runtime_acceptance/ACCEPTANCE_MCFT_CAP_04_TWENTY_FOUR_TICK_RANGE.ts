// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE.ts
// Purpose: prove the S7 standard fixture executes exactly 24 contiguous A1+B ticks, produces frozen cardinalities and sequence 49..72, and returns zero-write ALREADY_COMPLETE on replay.
// Boundary: in-memory range acceptance only; no production database, restart/backfill mode, route, scheduler, recommendation, decision, action, calibration, model activation, or live-field claim.

import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP04_S7_FINAL_NEXT_LOGICAL_TIME_V1,
  CAP04_S7_STANDARD_TICK_COUNT_V1,
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

function memberV1(members: CanonicalObjectEnvelopeV1[], objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP04_S7_ACCEPTANCE_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

async function main(): Promise<void> {
  const fixture = await buildCap04S7RangeFixtureV1();
  const result = await fixture.range_service.runContiguousRange(fixture.range_input);

  check(result.status === "COMPLETED", "standard S7 range completes");
  check(result.persisted_start_logical_time === "2026-06-03T02:00:00.000Z", "range starts from persisted CAP-03 handoff");
  check(result.requested_target_logical_time === CAP04_S7_TARGET_LOGICAL_TIME_V1, "range target is the 24th logical tick");
  check(result.executed_tick_count === CAP04_S7_STANDARD_TICK_COUNT_V1, "exactly 24 ticks execute");
  check(result.successful_a1_tick_count === 24 && result.blocked_a2_tick_count === 0, "all 24 ticks are A1 and no A2 occurs");
  check(result.posterior_state_count === 24, "24 posterior States are produced");
  check(result.successful_forecast_run_count === 24, "24 successful Forecast Runs are produced");
  check(result.scenario_set_count === 24, "24 Scenario Sets are produced");
  check(result.forecast_point_count === 1728, "1728 Forecast points are produced");
  check(result.scenario_point_count === 5184, "5184 Scenario points are produced");
  check(result.final_handoff.previous_tick_sequence === 72, "checkpoint sequence advances through 49..72");
  check(result.final_handoff.next_logical_tick_time === CAP04_S7_FINAL_NEXT_LOGICAL_TIME_V1, "final next tick is 2026-06-04T02:00Z");
  check(result.tick_results.length === 24, "range returns all 24 canonical tick results");

  const forecastRefs = new Set<string>();
  const scenarioRefs = new Set<string>();
  let graphValid = true;
  for (let index = 0; index < result.tick_results.length; index += 1) {
    const tick = result.tick_results[index];
    const state = memberV1(tick.a_record_set.members, "twin_state_estimate_v1");
    const forecast = memberV1(tick.a_record_set.members, "twin_forecast_run_v1");
    const checkpoint = memberV1(tick.a_record_set.members, "twin_runtime_checkpoint_v1");
    const expectedLogicalTime = new Date(Date.parse("2026-06-03T02:00:00.000Z") + index * 3_600_000).toISOString();
    const expectedNextTime = new Date(Date.parse(expectedLogicalTime) + 3_600_000).toISOString();
    graphValid = graphValid
      && tick.status === "INSERTED"
      && tick.a_record_set.members.length === 8
      && tick.b_record !== null
      && state.logical_time === expectedLogicalTime
      && forecast.logical_time === expectedLogicalTime
      && forecast.payload.status === "COMPLETED"
      && forecast.payload.points.length === 72
      && checkpoint.payload.tick_sequence === 49 + index
      && tick.next_handoff.next_logical_tick_time === expectedNextTime
      && tick.next_handoff.previous_forecast_result_ref === forecast.object_id
      && tick.b_record.scenario_set.payload.source_forecast_ref === forecast.object_id
      && tick.b_record.scenario_set.payload.options.length === 3
      && tick.b_record.scenario_set.payload.options.every((option) => option.trajectory_points.length === 72);
    forecastRefs.add(forecast.object_id);
    scenarioRefs.add(tick.b_record?.scenario_set_id ?? "");
  }
  check(graphValid, "every tick carries one contiguous canonical A1+B graph");
  check(forecastRefs.size === 24 && scenarioRefs.size === 24, "all Forecast and Scenario identities are unique across the range");
  check(fixture.evidence_load_count() === 24, "current Evidence and forcing authority are loaded exactly once per new tick");
  check(fixture.runtime.aCommitCount === 24 && fixture.runtime.bCommitCount === 24, "exactly 24 A1 and 24 B commits occur");
  check(fixture.runtime.leaseAcquireCount === 24, "one fenced lease is acquired per new A1+B tick");

  const countersBeforeReplay = {
    evidence: fixture.evidence_load_count(),
    a: fixture.runtime.aCommitCount,
    b: fixture.runtime.bCommitCount,
    lease: fixture.runtime.leaseAcquireCount,
  };
  const replay = await fixture.range_service.runContiguousRange(fixture.range_input);
  check(replay.status === "ALREADY_COMPLETE" && replay.executed_tick_count === 0, "completed target replay returns ALREADY_COMPLETE");
  check(
    fixture.evidence_load_count() === countersBeforeReplay.evidence
      && fixture.runtime.aCommitCount === countersBeforeReplay.a
      && fixture.runtime.bCommitCount === countersBeforeReplay.b
      && fixture.runtime.leaseAcquireCount === countersBeforeReplay.lease,
    "ALREADY_COMPLETE replay performs zero Evidence loads, leases or writes",
  );
  check(replay.final_handoff.previous_tick_sequence === 72 && replay.final_handoff.next_logical_tick_time === CAP04_S7_FINAL_NEXT_LOGICAL_TIME_V1, "ALREADY_COMPLETE returns persisted final handoff");

  console.log(`MCFT-CAP-04 24-tick range: ${pass} PASS, ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
