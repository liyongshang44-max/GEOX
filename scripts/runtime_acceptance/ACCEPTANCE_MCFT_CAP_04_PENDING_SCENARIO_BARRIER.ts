// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PENDING_SCENARIO_BARRIER.ts
// Purpose: prove the canonical S6 entry barrier recovers the immediately previous checkpoint Forecast's missing B before a genuinely new tick reaches its inner executor, without current-tick Evidence or Future Forcing reselection.
// Boundary: in-memory barrier ordering acceptance only; no production database, route, scheduler, range, restart/backfill, recommendation, decision, or action.

import type { ExecuteCap04SingleTickResultV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { Cap04PendingScenarioBarrierSingleTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
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

async function main(): Promise<void> {
  const fixture = buildCap04S6SingleTickFixtureV1();
  let injected = false;
  try {
    await fixture.service.executeOneTick({
      ...fixture.input,
      fault_injection_b: (stage) => {
        if (stage === "before_commit") throw new Error("INJECTED_PENDING_B");
      },
    });
  } catch (error) {
    injected = error instanceof Error && error.message === "INJECTED_PENDING_B";
  }
  check(injected && fixture.runtime.aCommitCount === 1 && fixture.runtime.bCommitCount === 0, "fixture exposes one persisted A1 with missing B");
  const pending = await fixture.runtime.detectPendingScenario(fixture.input.scope);
  check(Boolean(pending), "immediately previous checkpoint Forecast is detected as pending");

  let innerCalled = false;
  const inner = {
    async executeOneTick(): Promise<ExecuteCap04SingleTickResultV1> {
      innerCalled = true;
      throw new Error("INNER_EXECUTOR_SENTINEL");
    },
  };
  const barrier = new Cap04PendingScenarioBarrierSingleTickServiceV1(
    new PrepareNextTickInputServiceV1(fixture.runtime),
    fixture.runtime,
    fixture.runtime,
    inner as never,
  );
  const evidenceBefore = fixture.runtime.evidenceLoadCount;
  let sentinel = false;
  try {
    await barrier.executeOneTick({
      ...fixture.input,
      logical_time: CAP04_S6_NEXT_TIME_V1,
      created_at: "2026-06-03T03:10:00.000Z",
      fault_injection_b: undefined,
    });
  } catch (error) {
    sentinel = error instanceof Error && error.message === "INNER_EXECUTOR_SENTINEL";
  }
  check(sentinel && innerCalled, "inner tick executor starts only after the barrier completes");
  check(fixture.runtime.bCommitCount === 1, "barrier commits exactly the missing previous B");
  check(fixture.runtime.evidenceLoadCount === evidenceBefore, "barrier performs zero current-tick Evidence or forcing selection reads");
  check(await fixture.runtime.detectPendingScenario(fixture.input.scope) === null, "barrier clears the exact previous checkpoint pending condition");

  const noPending = buildCap04S6SingleTickFixtureV1();
  await noPending.service.executeOneTick(noPending.input);
  let cleanInnerCalled = false;
  const cleanBarrier = new Cap04PendingScenarioBarrierSingleTickServiceV1(
    new PrepareNextTickInputServiceV1(noPending.runtime),
    noPending.runtime,
    noPending.runtime,
    {
      async executeOneTick(): Promise<ExecuteCap04SingleTickResultV1> {
        cleanInnerCalled = true;
        throw new Error("CLEAN_INNER_SENTINEL");
      },
    } as never,
  );
  try {
    await cleanBarrier.executeOneTick({
      ...noPending.input,
      logical_time: CAP04_S6_NEXT_TIME_V1,
      created_at: "2026-06-03T03:10:00.000Z",
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "CLEAN_INNER_SENTINEL") throw error;
  }
  check(cleanInnerCalled && noPending.runtime.bCommitCount === 1, "clear barrier delegates directly without duplicate B");

  console.log(`MCFT-CAP-04 pending Scenario barrier: ${pass} PASS, ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
