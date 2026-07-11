// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY.ts
// Purpose: prove CAP-03 process restart, bounded forward backfill, hash equivalence, completed-target idempotency, and explicit five-projection rebuild over the verified observation-aware range.
// Boundary: in-memory positive acceptance only; no production database, route, scheduler, successful Forecast, late-Evidence revision, Recommendation, Decision, action, calibration, or model activation.

import assert from "node:assert/strict";
import {
  memberV1,
} from "./mcft_cap_03_single_tick_integration_fixture_v1.js";
import {
  buildMcftCap03RestartBackfillRecoveryFixtureV1,
  recordSetHashesV1,
  S6_FRESH_PROCESS_FIRST_LOGICAL_TIME_V1,
  S6_FRESH_PROCESS_TICK_COUNT_V1,
  S6_PROCESS_1_TICK_COUNT_V1,
} from "./mcft_cap_03_restart_backfill_recovery_fixture_v1.js";

let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function main(): Promise<void> {
  const fixture =
    await buildMcftCap03RestartBackfillRecoveryFixtureV1();

  assert.equal(
    fixture.uninterruptedResult.status,
    "COMPLETED",
  );
  assert.equal(
    fixture.uninterruptedResult.executed_tick_count,
    fixture.totalTickCount,
  );
  assert.equal(
    fixture.uninterruptedResult.tick_results.length,
    24,
  );
  ok("uninterrupted authority executes the frozen 24 CAP-03 ticks");

  assert.equal(
    fixture.restartedProcess1Result.status,
    "COMPLETED",
  );
  assert.equal(
    fixture.restartedProcess1Result.executed_tick_count,
    S6_PROCESS_1_TICK_COUNT_V1,
  );
  assert.equal(
    fixture.restartedProcess1Result.final_handoff
      .previous_tick_sequence,
    36,
  );
  assert.equal(
    fixture.restartedProcess1Result.final_handoff
      .next_logical_tick_time,
    S6_FRESH_PROCESS_FIRST_LOGICAL_TIME_V1,
  );
  ok("process 1 commits ticks 1 through 12 and checkpoint sequence 25 through 36");

  const process1LastRecordSet =
    fixture.restartedProcess1Result.tick_results[
      fixture.restartedProcess1Result.tick_results.length - 1
    ].record_set;

  const process1Checkpoint = memberV1(
    process1LastRecordSet,
    "twin_runtime_checkpoint_v1",
  );

  const process1TerminalTick = memberV1(
    process1LastRecordSet,
    "twin_runtime_tick_v1",
  );

  assert.equal(
    fixture.restartedResumeResult.operator_intent,
    "RESUME",
  );
  assert.equal(
    fixture.restartedResumeResult
      .persisted_start_logical_time,
    S6_FRESH_PROCESS_FIRST_LOGICAL_TIME_V1,
  );
  assert.equal(
    fixture.restartedResumeResult
      .persisted_checkpoint_ref,
    process1Checkpoint.object_id,
  );
  assert.equal(
    fixture.restartedResumeResult
      .persisted_terminal_tick_ref,
    process1TerminalTick.object_id,
  );
  assert.equal(
    fixture.restartedResumeResult.range_result.status,
    "COMPLETED",
  );
  assert.equal(
    fixture.restartedResumeResult.range_result
      .executed_tick_count,
    S6_FRESH_PROCESS_TICK_COUNT_V1,
  );
  ok("fresh service composition resumes only ticks 13 through 24 from persisted checkpoint authority");

  const uninterruptedHashes = recordSetHashesV1(
    fixture.uninterruptedResult,
  );

  const restartedHashes = [
    ...recordSetHashesV1(
      fixture.restartedProcess1Result,
    ),
    ...recordSetHashesV1(
      fixture.restartedResumeResult.range_result,
    ),
  ];

  assert.equal(uninterruptedHashes.length, 24);
  assert.equal(restartedHashes.length, 24);
  assert.deepEqual(
    restartedHashes,
    uninterruptedHashes,
  );
  ok("restarted and uninterrupted executions reproduce all 24 canonical A2 record-set hashes");

  assert.equal(
    fixture.restartedResumeResult.range_result
      .final_handoff.previous_tick_sequence,
    48,
  );
  assert.equal(
    fixture.restartedResumeResult.range_result
      .final_handoff.next_logical_tick_time,
    fixture.nextHandoffLogicalTime,
  );
  assert.equal(
    fixture.restartedFixture.runtime.commitCount,
    24,
  );
  assert.equal(
    fixture.restartedFixture.runtime.leaseAcquireCount,
    24,
  );
  assert.equal(
    fixture.restartedFixture.runtime.readbackCount,
    24,
  );
  ok("restart path advances checkpoint sequence 25 through 48 with exactly 24 commits, leases, and canonical readbacks");

  assert.equal(
    fixture.backfillResult.operator_intent,
    "BACKFILL",
  );
  assert.equal(
    fixture.backfillResult.persisted_start_logical_time,
    S6_FRESH_PROCESS_FIRST_LOGICAL_TIME_V1,
  );
  assert.equal(
    fixture.backfillResult.range_result.status,
    "COMPLETED",
  );
  assert.equal(
    fixture.backfillResult.range_result
      .executed_tick_count,
    12,
  );

  const backfillHashes = [
    ...recordSetHashesV1(
      fixture.backfillPrefixResult,
    ),
    ...recordSetHashesV1(
      fixture.backfillResult.range_result,
    ),
  ];

  assert.deepEqual(
    backfillHashes,
    uninterruptedHashes,
  );
  ok("bounded forward catch-up from persisted next-tick authority reproduces the uninterrupted canonical hashes");

  const countersBeforeCompletedRetry = {
    lease:
      fixture.restartedFixture.runtime
        .leaseAcquireCount,
    commit:
      fixture.restartedFixture.runtime.commitCount,
    readback:
      fixture.restartedFixture.runtime.readbackCount,
  };

  const completedRetry =
    await fixture.restartedFreshProcess
      .restartService
      .resumeAssimilatedFromCheckpointV1(
        fixture.restartedProcess2Input,
      );

  const countersAfterCompletedRetry = {
    lease:
      fixture.restartedFixture.runtime
        .leaseAcquireCount,
    commit:
      fixture.restartedFixture.runtime.commitCount,
    readback:
      fixture.restartedFixture.runtime.readbackCount,
  };

  assert.equal(
    completedRetry.range_result.status,
    "ALREADY_COMPLETE",
  );
  assert.equal(
    completedRetry.range_result.executed_tick_count,
    0,
  );
  assert.deepEqual(
    completedRetry.range_result.tick_results,
    [],
  );
  assert.deepEqual(
    countersAfterCompletedRetry,
    countersBeforeCompletedRetry,
  );
  ok("completed-target retry performs zero Evidence evaluation, lease acquisition, commit, or canonical readback");

  const finalRecordSet =
    fixture.restartedResumeResult.range_result
      .tick_results[
        fixture.restartedResumeResult.range_result
          .tick_results.length - 1
      ].record_set;

  const rebuild =
    await fixture.restartedFixture.runtime
      .rebuildAssimilatedContinuationProjections(
        finalRecordSet.continuation_record_set_id,
      );

  assert.deepEqual(
    rebuild,
    { rebuilt_projection_count: 5 },
  );
  ok("canonical recovery remains an explicit five-projection rebuild operation");

  console.log(
    `MCFT-CAP-03 restart backfill recovery: ${pass} PASS, 0 FAIL`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
