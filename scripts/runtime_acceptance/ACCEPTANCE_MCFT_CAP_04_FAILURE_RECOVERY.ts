// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FAILURE_RECOVERY.ts
// Purpose: prove CAP-04 A1/B postcommit response-loss idempotency, pending-B recovery barrier, A2 range stop, bounded-backfill intent validation and projection-divergence fail-closed behavior.
// Boundary: deterministic in-memory failure acceptance only; stale fencing, SQL CAS and canonical projection rebuild are proven separately in PostgreSQL acceptance.

import assert from "node:assert/strict";
import type { Cap04SingleTickPersistencePortV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { Cap04ForecastScenarioSingleTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { Cap04ForecastScenarioRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_range_service_v1.js";
import { Cap04ForecastScenarioRestartResumeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_restart_resume_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { Cap04PendingScenarioBarrierSingleTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.js";
import type { ReplayEvidenceSourcePortV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  InMemoryCap04SingleTickRuntimeV1,
  buildCap04S6SingleTickFixtureV1,
} from "./mcft_cap_04_single_tick_fixture_v1.js";
import {
  buildCap04S7RangeFixtureV1,
} from "./mcft_cap_04_twenty_four_tick_range_fixture_v1.js";
import {
  composeCap04S8FreshServicesV1,
} from "./mcft_cap_04_restart_backfill_recovery_fixture_v1.js";

let pass = 0;
function check(value: unknown, message: string): void {
  assert.ok(value, message);
  pass += 1;
  console.log(`PASS ${message}`);
}

async function rejectsCodeV1(action: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => error instanceof Error && error.message === code);
  check(true, `rejects with ${code}`);
}

function basePersistenceV1(runtime: InMemoryCap04SingleTickRuntimeV1): Cap04SingleTickPersistencePortV1 {
  return {
    acquireLease: runtime.acquireLease.bind(runtime),
    lookupARecordSet: runtime.lookupARecordSet.bind(runtime),
    commitARecordSet: runtime.commitARecordSet.bind(runtime),
    readARecordSet: runtime.readARecordSet.bind(runtime),
    lookupScenarioSet: runtime.lookupScenarioSet.bind(runtime),
    commitScenarioSet: runtime.commitScenarioSet.bind(runtime),
    readScenarioSet: runtime.readScenarioSet.bind(runtime),
    readScenarioSetBySourceForecast: runtime.readScenarioSetBySourceForecast.bind(runtime),
    detectPendingScenario: runtime.detectPendingScenario.bind(runtime),
    rebuildForecastProjections: runtime.rebuildForecastProjections.bind(runtime),
    rebuildScenarioProjections: runtime.rebuildScenarioProjections.bind(runtime),
  };
}

function composeV1(
  runtime: InMemoryCap04SingleTickRuntimeV1,
  evidenceSource: ReplayEvidenceSourcePortV1,
  persistence: Cap04SingleTickPersistencePortV1 = basePersistenceV1(runtime),
) {
  const handoff = new PrepareNextTickInputServiceV1(runtime);
  const inner = new Cap04ForecastScenarioSingleTickServiceV1(handoff, evidenceSource, runtime, persistence);
  const barrier = new Cap04PendingScenarioBarrierSingleTickServiceV1(handoff, runtime, persistence, inner);
  const range = new Cap04ForecastScenarioRangeServiceV1(handoff, barrier);
  return { handoff, inner, barrier, range };
}

async function main(): Promise<void> {
  const aLoss = buildCap04S6SingleTickFixtureV1();
  let loseAResponse = true;
  const aLossBase = basePersistenceV1(aLoss.runtime);
  const aLossPersistence: Cap04SingleTickPersistencePortV1 = {
    ...aLossBase,
    async commitARecordSet(input) {
      const result = await aLoss.runtime.commitARecordSet(input);
      if (loseAResponse) {
        loseAResponse = false;
        throw new Error("SIMULATED_A_POSTCOMMIT_RESPONSE_LOSS");
      }
      return result;
    },
  };
  const aLossServices = composeV1(aLoss.runtime, aLoss.runtime, aLossPersistence);
  await rejectsCodeV1(
    () => aLossServices.inner.executeOneTick(aLoss.input),
    "SIMULATED_A_POSTCOMMIT_RESPONSE_LOSS",
  );
  check(aLoss.runtime.aCommitCount === 1 && aLoss.runtime.bCommitCount === 0, "A response loss leaves one canonical A and no B");
  const aRetryServices = composeV1(aLoss.runtime, aLoss.runtime);
  const recoveredA = await aRetryServices.inner.executeOneTick(aLoss.input);
  check(recoveredA.status === "RECOVERED_PENDING_SCENARIO", "A response-loss retry recovers pending B from canonical Forecast");
  check(aLoss.runtime.aCommitCount === 1 && aLoss.runtime.bCommitCount === 1, "A response-loss retry creates no duplicate A fact");

  const bLoss = buildCap04S6SingleTickFixtureV1();
  let loseBResponse = true;
  const bLossBase = basePersistenceV1(bLoss.runtime);
  const bLossPersistence: Cap04SingleTickPersistencePortV1 = {
    ...bLossBase,
    async commitScenarioSet(input) {
      const result = await bLoss.runtime.commitScenarioSet(input);
      if (loseBResponse) {
        loseBResponse = false;
        throw new Error("SIMULATED_B_POSTCOMMIT_RESPONSE_LOSS");
      }
      return result;
    },
  };
  const bLossServices = composeV1(bLoss.runtime, bLoss.runtime, bLossPersistence);
  await rejectsCodeV1(
    () => bLossServices.inner.executeOneTick(bLoss.input),
    "SIMULATED_B_POSTCOMMIT_RESPONSE_LOSS",
  );
  check(bLoss.runtime.aCommitCount === 1 && bLoss.runtime.bCommitCount === 1, "B response loss leaves one canonical A and one canonical B");
  const bRetryServices = composeV1(bLoss.runtime, bLoss.runtime);
  const recoveredB = await bRetryServices.inner.executeOneTick(bLoss.input);
  check(recoveredB.status === "EXISTING_IDEMPOTENT_SUCCESS", "B response-loss retry returns existing canonical A+B");
  check(bLoss.runtime.aCommitCount === 1 && bLoss.runtime.bCommitCount === 1, "B response-loss retry creates no duplicate facts");

  const pending = await buildCap04S7RangeFixtureV1();
  let failBeforeB = true;
  const pendingBase = basePersistenceV1(pending.runtime);
  const pendingPersistence: Cap04SingleTickPersistencePortV1 = {
    ...pendingBase,
    async commitScenarioSet(input) {
      if (failBeforeB) {
        failBeforeB = false;
        throw new Error("SIMULATED_B_PRECOMMIT_FAILURE");
      }
      return pending.runtime.commitScenarioSet(input);
    },
  };
  const pendingServices = composeV1(pending.runtime, pending.evidence_source, pendingPersistence);
  await rejectsCodeV1(
    () => pendingServices.range.runContiguousRange({
      ...pending.range_input,
      to_logical_time: "2026-06-03T02:00:00.000Z",
    }),
    "SIMULATED_B_PRECOMMIT_FAILURE",
  );
  check(pending.runtime.aCommitCount === 1 && pending.runtime.bCommitCount === 0, "A1 success and B failure leaves exactly one pending canonical Forecast");
  const pendingRetry = composeCap04S8FreshServicesV1(pending.runtime, pending.evidence_source);
  const recoveredRange = await pendingRetry.range_service.runContiguousRange({
    ...pending.range_input,
    to_logical_time: "2026-06-03T03:00:00.000Z",
    lease_owner: "cap04_s8_pending_b_retry",
  });
  check(recoveredRange.executed_tick_count === 1, "pending-B barrier clears B before exactly one genuinely new tick");
  check(pending.runtime.aCommitCount === 2 && pending.runtime.bCommitCount === 2, "pending-B recovery creates one prior B and one new A+B without duplicates");

  const blocked = await buildCap04S7RangeFixtureV1({ blocked_tick_index: 5 });
  const blockedResult = await blocked.range_service.runContiguousRange(blocked.range_input);
  check(blockedResult.status === "BLOCKED" && blockedResult.executed_tick_count === 6, "legal A2 stops range explicitly at the sixth tick");
  check(blocked.runtime.aCommitCount === 6 && blocked.runtime.bCommitCount === 5, "A2 stop writes one blocked terminal A and no B for blocked hour");
  const blockedSnapshot = blocked.runtime.currentSnapshotV1();
  check(blockedSnapshot.checkpoint.payload.forecast_result_ref !== blockedSnapshot.checkpoint.payload.successful_forecast_ref, "A2 keeps latest result and latest successful Forecast pointers independent");

  const backfill = await buildCap04S7RangeFixtureV1();
  await backfill.range_service.runContiguousRange({
    ...backfill.range_input,
    to_logical_time: "2026-06-03T02:00:00.000Z",
  });
  const backfillServices = composeCap04S8FreshServicesV1(backfill.runtime, backfill.evidence_source);
  await rejectsCodeV1(
    () => backfillServices.restart_service.runBoundedBackfill({
      ...backfill.range_input,
      evidence_intent: "LATE_EVIDENCE_REVISION",
      requested_start_logical_time: "2026-06-03T03:00:00.000Z",
    }),
    "LATE_EVIDENCE_FORWARD_BACKFILL_FORBIDDEN",
  );
  await rejectsCodeV1(
    () => backfillServices.restart_service.runBoundedBackfill({
      ...backfill.range_input,
      evidence_intent: "MISSED_SCHEDULE_CATCH_UP",
      requested_start_logical_time: "2026-06-03T04:00:00.000Z",
    }),
    "CAP04_BACKFILL_START_NOT_PERSISTED_NEXT_TICK",
  );

  let delegated = false;
  const divergent = new Cap04ForecastScenarioRestartResumeServiceV1(
    {
      async resumeFromCheckpointV1() {
        throw new Error("CHECKPOINT_SCOPE_MISMATCH");
      },
    },
    {
      async runContiguousRange() {
        delegated = true;
        throw new Error("UNREACHABLE_RANGE_DELEGATION");
      },
    },
  );
  await rejectsCodeV1(
    () => divergent.resumeFromCheckpoint(backfill.range_input),
    "CHECKPOINT_PROJECTION_DIVERGENCE",
  );
  check(delegated === false, "projection divergence fails closed before range delegation");

  const beforeBootstrap = new Cap04ForecastScenarioRestartResumeServiceV1(
    {
      async resumeFromCheckpointV1() {
        throw new Error("PERSISTED_NEXT_TICK_STATE_NOT_FOUND");
      },
    },
    {
      async runContiguousRange() {
        throw new Error("UNREACHABLE_RANGE_DELEGATION");
      },
    },
  );
  await rejectsCodeV1(
    () => beforeBootstrap.runBoundedBackfill({
      ...backfill.range_input,
      evidence_intent: "MISSED_SCHEDULE_CATCH_UP",
    }),
    "CAP04_BACKFILL_BEFORE_BOOTSTRAP",
  );

  console.log(`MCFT-CAP-04 S8 failure recovery acceptance: ${pass} PASS`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
