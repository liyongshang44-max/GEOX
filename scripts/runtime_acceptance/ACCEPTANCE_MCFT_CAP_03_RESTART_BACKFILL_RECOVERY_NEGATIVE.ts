// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY_NEGATIVE.ts
// Purpose: prove S6 rejects late-Evidence revision, invalid backfill starts, missing bootstrap authority, and projection divergence while preserving precommit rollback and postcommit-response-loss idempotency.
// Boundary: in-memory negative acceptance only; no production database, route, scheduler, automatic projection repair, successful Forecast, Recommendation, Decision, action, calibration, or model activation.

import assert from "node:assert/strict";
import type {
  RunAssimilatedContiguousRangeResultV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v1.js";
import {
  AssimilatedRestartResumeServiceV1,
  type AssimilatedContiguousRangePortV1,
  type ResumeAssimilatedFromCheckpointPortV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_restart_resume_service_v1.js";
import {
  buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1,
  S5_FIRST_LOGICAL_TIME_V1,
} from "./mcft_cap_03_twenty_four_observation_aware_tick_range_fixture_v1.js";
import {
  S6_PROCESS_1_LAST_LOGICAL_TIME_V1,
} from "./mcft_cap_03_restart_backfill_recovery_fixture_v1.js";

let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function expectedErrorV1(
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof Error
      && error.message === code,
  );
}

async function main(): Promise<void> {
  const fixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

  await fixture.rangeService
    .runAssimilatedContiguousRangeV1({
      ...fixture.rangeInput,
      to_logical_time:
        S6_PROCESS_1_LAST_LOGICAL_TIME_V1,
      lease_owner:
        "mcft-cap-03-s6-negative-prefix",
    });

  const prepared =
    await fixture.handoffService
      .resumeFromCheckpointV1(fixture.scope);

  let checkpointReadCount = 0;
  let rangeRunCount = 0;

  const checkpointPort:
    ResumeAssimilatedFromCheckpointPortV1 = {
      async resumeFromCheckpointV1() {
        checkpointReadCount += 1;
        return structuredClone(prepared);
      },
    };

  const successfulRangeResult:
    RunAssimilatedContiguousRangeResultV1 = {
      status: "ALREADY_COMPLETE",
      persisted_start_logical_time:
        prepared.next_logical_tick_time,
      requested_target_logical_time:
        S6_PROCESS_1_LAST_LOGICAL_TIME_V1,
      executed_tick_count: 0,
      tick_results: [],
      final_handoff: structuredClone(prepared),
    };

  const rangePort:
    AssimilatedContiguousRangePortV1 = {
      async runAssimilatedContiguousRangeV1() {
        rangeRunCount += 1;
        return structuredClone(successfulRangeResult);
      },
    };

  const service =
    new AssimilatedRestartResumeServiceV1(
      checkpointPort,
      rangePort,
    );

  await expectedErrorV1(
    () => service.runAssimilatedBoundedBackfillV1({
      ...fixture.rangeInput,
      evidence_intent: "LATE_EVIDENCE_REVISION",
      requested_start_logical_time:
        prepared.next_logical_tick_time,
    }),
    "LATE_EVIDENCE_FORWARD_BACKFILL_FORBIDDEN",
  );

  assert.equal(checkpointReadCount, 0);
  assert.equal(rangeRunCount, 0);
  ok("late Evidence is rejected before checkpoint read, Evidence evaluation, or range execution");

  const missingBootstrapService =
    new AssimilatedRestartResumeServiceV1(
      {
        async resumeFromCheckpointV1() {
          throw new Error(
            "PERSISTED_NEXT_TICK_STATE_NOT_FOUND",
          );
        },
      },
      rangePort,
    );

  await expectedErrorV1(
    () => missingBootstrapService
      .runAssimilatedBoundedBackfillV1({
        ...fixture.rangeInput,
        evidence_intent:
          "MISSED_SCHEDULE_CATCH_UP",
      }),
    "ASSIMILATED_BACKFILL_BEFORE_BOOTSTRAP",
  );
  ok("bounded backfill before persisted bootstrap authority fails closed");

  await expectedErrorV1(
    () => service.runAssimilatedBoundedBackfillV1({
      ...fixture.rangeInput,
      evidence_intent:
        "MISSED_SCHEDULE_CATCH_UP",
      requested_start_logical_time:
        "2026-06-02T14:30:00.000Z",
    }),
    "ASSIMILATED_BACKFILL_START_NOT_CANONICAL_HOUR",
  );
  ok("non-hour-aligned backfill start is rejected");

  await expectedErrorV1(
    () => service.runAssimilatedBoundedBackfillV1({
      ...fixture.rangeInput,
      evidence_intent:
        "MISSED_SCHEDULE_CATCH_UP",
      requested_start_logical_time:
        S5_FIRST_LOGICAL_TIME_V1,
    }),
    "ASSIMILATED_BACKFILL_START_NOT_PERSISTED_NEXT_TICK",
  );
  ok("operator-selected backfill start cannot override persisted next-tick authority");

  const divergentReadService =
    new AssimilatedRestartResumeServiceV1(
      {
        async resumeFromCheckpointV1() {
          throw new Error(
            "CHECKPOINT_PREVIOUS_POSTERIOR_REF_MISMATCH",
          );
        },
      },
      rangePort,
    );

  await expectedErrorV1(
    () => divergentReadService
      .resumeAssimilatedFromCheckpointV1(
        fixture.rangeInput,
      ),
    "CHECKPOINT_PROJECTION_DIVERGENCE",
  );
  ok("checkpoint projection read divergence is normalized to one fail-closed error");

  const divergentRangeService =
    new AssimilatedRestartResumeServiceV1(
      checkpointPort,
      {
        async runAssimilatedContiguousRangeV1() {
          return {
            ...structuredClone(successfulRangeResult),
            persisted_start_logical_time:
              S5_FIRST_LOGICAL_TIME_V1,
          };
        },
      },
    );

  await expectedErrorV1(
    () => divergentRangeService
      .resumeAssimilatedFromCheckpointV1(
        fixture.rangeInput,
      ),
    "CHECKPOINT_PROJECTION_DIVERGENCE",
  );
  ok("range start that disagrees with persisted restart authority fails closed");

  const missingTerminalFixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

  await missingTerminalFixture.rangeService
    .runAssimilatedContiguousRangeV1({
      ...missingTerminalFixture.rangeInput,
      to_logical_time:
        S6_PROCESS_1_LAST_LOGICAL_TIME_V1,
      lease_owner:
        "mcft-cap-03-s6-missing-terminal",
    });

  const divergentSnapshot =
    missingTerminalFixture.runtime
      .currentSnapshotV1();

  delete divergentSnapshot.last_terminal_tick;

  missingTerminalFixture.runtime
    .replaceSnapshotV1(divergentSnapshot);

  await expectedErrorV1(
    () => missingTerminalFixture.handoffService
      .resumeFromCheckpointV1(
        missingTerminalFixture.scope,
      ),
    "CHECKPOINT_PROJECTION_DIVERGENCE",
  );
  ok("missing terminal-tick projection prevents restart until explicit rebuild");

  const precommitFixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

  const snapshotBeforeFault =
    precommitFixture.runtime.currentSnapshotV1();

  await expectedErrorV1(
    () => precommitFixture.tickService.executeOneTick({
      scope: precommitFixture.scope,
      logical_time: S5_FIRST_LOGICAL_TIME_V1,
      created_at: precommitFixture.rangeInput.created_at,
      assimilated_runtime_config_ref:
        precommitFixture
          .runtimeConfigRefsByLogicalTime[
            S5_FIRST_LOGICAL_TIME_V1
          ],
      crop_stage_context:
        precommitFixture.cropStageContext,
      lease_owner:
        "mcft-cap-03-s6-precommit-fault",
      lease_duration_seconds: 300,
      fault_injection(stage) {
        if (stage === "before_commit") {
          throw new Error(
            "SIMULATED_PRECOMMIT_PROCESS_CRASH",
          );
        }
      },
    }),
    "SIMULATED_PRECOMMIT_PROCESS_CRASH",
  );

  assert.equal(precommitFixture.runtime.commitCount, 0);
  assert.equal(precommitFixture.runtime.readbackCount, 0);
  assert.deepEqual(
    precommitFixture.runtime.currentSnapshotV1(),
    snapshotBeforeFault,
  );
  ok("precommit process crash leaves zero canonical commit and zero projection advance");

  const responseLossFixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

  const originalCommit =
    responseLossFixture.runtime
      .commitAssimilatedContinuationState
      .bind(responseLossFixture.runtime);

  let loseFirstResponse = true;

  responseLossFixture.runtime
    .commitAssimilatedContinuationState =
      async (input) => {
        const result = await originalCommit(input);

        if (loseFirstResponse) {
          loseFirstResponse = false;
          throw new Error(
            "SIMULATED_POSTCOMMIT_RESPONSE_LOSS",
          );
        }

        return result;
      };

  const firstTickInput = {
    scope: responseLossFixture.scope,
    logical_time: S5_FIRST_LOGICAL_TIME_V1,
    created_at: responseLossFixture.rangeInput.created_at,
    assimilated_runtime_config_ref:
      responseLossFixture
        .runtimeConfigRefsByLogicalTime[
          S5_FIRST_LOGICAL_TIME_V1
        ],
    crop_stage_context:
      responseLossFixture.cropStageContext,
    lease_owner:
      "mcft-cap-03-s6-response-loss",
    lease_duration_seconds: 300,
  };

  await expectedErrorV1(
    () => responseLossFixture.tickService
      .executeOneTick(firstTickInput),
    "SIMULATED_POSTCOMMIT_RESPONSE_LOSS",
  );

  assert.equal(responseLossFixture.runtime.commitCount, 1);
  assert.equal(responseLossFixture.runtime.leaseAcquireCount, 1);

  const recovered =
    await responseLossFixture.tickService
      .executeOneTick(firstTickInput);

  assert.equal(
    recovered.status,
    "EXISTING_IDEMPOTENT_SUCCESS",
  );
  assert.equal(responseLossFixture.runtime.commitCount, 1);
  assert.equal(responseLossFixture.runtime.leaseAcquireCount, 1);
  assert.equal(
    recovered.next_handoff.previous_tick_sequence,
    25,
  );
  ok("postcommit response loss retry resolves as canonical idempotent success without duplicate lease or facts");

  console.log(
    `MCFT-CAP-03 restart backfill recovery negative: ${pass} PASS, 0 FAIL`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
