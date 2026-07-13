// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts
// Purpose: prove one complete CAP-04 S6 Replay tick, completed-idempotent zero-recompute replay, and A1-persisted/B-missing recovery.
// Boundary: in-memory acceptance only; no production database, route, scheduler, range, restart/backfill, recommendation, decision, or action.

import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { Cap04ARecordSetV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import {
  CAP04_S6_NEXT_TIME_V1,
  buildCap04S6SingleTickFixtureV1,
} from "./mcft_cap_04_single_tick_fixture_v1.js";

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

function memberV1(recordSet: Cap04ARecordSetV1, type: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === type);
  if (matches.length !== 1) throw new Error(`CAP04_S6_ACCEPTANCE_MEMBER_CARDINALITY:${type}`);
  return matches[0];
}

async function main(): Promise<void> {
  const complete = buildCap04S6SingleTickFixtureV1();
  const inserted = await complete.service.executeOneTick(complete.input);
  const forecast = memberV1(inserted.a_record_set, "twin_forecast_run_v1");
  const checkpoint = memberV1(inserted.a_record_set, "twin_runtime_checkpoint_v1");

  check(inserted.status === "INSERTED", "one explicit S6 tick inserts A1 and B");
  check(inserted.a_record_set.members.length === 8, "A1 contains exactly eight canonical members");
  check(
    forecast.payload.status === "COMPLETED"
      && Array.isArray(forecast.payload.points)
      && forecast.payload.points.length === 72
      && forecast.payload.scenario_eligible === true,
    "A1 contains one successful 72-hour Forecast",
  );
  check(
    inserted.b_record.scenario_set.payload.options.length === 3
      && inserted.b_record.scenario_set.payload.options.every((option) => option.trajectory_points.length === 72),
    "B contains exactly three ordered 72-point Scenario trajectories",
  );
  check(
    inserted.b_record.scenario_set.payload.source_forecast_ref === forecast.object_id
      && inserted.b_record.scenario_set.payload.source_forecast_hash === forecast.determinism_hash,
    "B is canonically bound to the exact successful Forecast",
  );
  check(
    inserted.next_handoff.next_logical_tick_time === CAP04_S6_NEXT_TIME_V1
      && inserted.next_handoff.previous_tick_sequence === checkpoint.payload.tick_sequence
      && inserted.next_handoff.previous_forecast_result_ref === forecast.object_id
      && inserted.next_handoff.previous_forecast_result_hash === forecast.determinism_hash
      && inserted.next_handoff.latest_successful_forecast_ref === forecast.object_id,
    "T+1 handoff carries State, checkpoint, Forecast hash and successful-Forecast authority",
  );
  check(
    complete.runtime.evidenceLoadCount === 1
      && complete.runtime.configReadCount === 1
      && complete.runtime.leaseAcquireCount === 1
      && complete.runtime.aCommitCount === 1
      && complete.runtime.bCommitCount === 1,
    "new tick performs one Evidence load, one Config read, one lease and one A/B commit each",
  );

  const countersBeforeReplay = {
    evidence: complete.runtime.evidenceLoadCount,
    config: complete.runtime.configReadCount,
    lease: complete.runtime.leaseAcquireCount,
    aCommit: complete.runtime.aCommitCount,
    bCommit: complete.runtime.bCommitCount,
    aRead: complete.runtime.aReadCount,
    bRead: complete.runtime.bReadCount,
  };
  const replay = await complete.service.executeOneTick(complete.input);
  check(replay.status === "EXISTING_IDEMPOTENT_SUCCESS", "completed A1+B replay returns existing idempotent success");
  check(
    complete.runtime.evidenceLoadCount === countersBeforeReplay.evidence
      && complete.runtime.configReadCount === countersBeforeReplay.config
      && complete.runtime.leaseAcquireCount === countersBeforeReplay.lease
      && complete.runtime.aCommitCount === countersBeforeReplay.aCommit
      && complete.runtime.bCommitCount === countersBeforeReplay.bCommit
      && complete.runtime.aReadCount === countersBeforeReplay.aRead
      && complete.runtime.bReadCount === countersBeforeReplay.bRead,
    "completed replay performs no Evidence, Config, lease, commit or canonical readback work",
  );
  check(
    replay.a_record_set.aggregate_determinism_hash === inserted.a_record_set.aggregate_determinism_hash
      && replay.b_record.aggregate_determinism_hash === inserted.b_record.aggregate_determinism_hash,
    "completed replay returns the same canonical A1 and B hashes",
  );

  const recovery = buildCap04S6SingleTickFixtureV1();
  let injected = false;
  try {
    await recovery.service.executeOneTick({
      ...recovery.input,
      fault_injection_b: (stage) => {
        if (stage === "before_commit") throw new Error("INJECTED_B_FAILURE");
      },
    });
  } catch (error) {
    injected = error instanceof Error && error.message === "INJECTED_B_FAILURE";
  }
  check(injected, "injected B failure is surfaced after successful A1 commit");
  check(
    recovery.runtime.aCommitCount === 1
      && recovery.runtime.bCommitCount === 0
      && (await recovery.runtime.detectPendingScenario(recovery.input.scope))?.object_id !== undefined,
    "B failure leaves one canonical A1 and an explicit pending Scenario condition",
  );

  const recovered = await recovery.service.executeOneTick(recovery.input);
  check(recovered.status === "RECOVERED_PENDING_SCENARIO", "rerun recovers B without recommitting A1");
  check(
    recovery.runtime.aCommitCount === 1
      && recovery.runtime.bCommitCount === 1
      && recovery.runtime.leaseAcquireCount === 2,
    "pending recovery preserves A1 and uses a new fenced lease only for B",
  );
  check(
    recovered.b_record.scenario_set.payload.source_forecast_ref
      === memberV1(recovered.a_record_set, "twin_forecast_run_v1").object_id,
    "recovered B remains bound to the persisted A1 Forecast",
  );

  console.log(`MCFT-CAP-04 single-tick integration: ${pass} PASS, ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
