// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL.ts
// Purpose: prove restart/resume and bounded forward-backfill reuse the verified range path and produce byte-equivalent 24-tick canonical identities after a 12+12 split.
// Boundary: deterministic in-memory application acceptance only; no PostgreSQL, filesystem Replay source, scheduler, route, Forecast success, Recommendation, Decision, or action.

import assert from "node:assert/strict";
import type { ContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_record_set_identity_v1.js";
import {
  RestartBackfillInMemoryRuntimeV1,
  buildMcftCap02RestartBackfillFixtureV1,
  createRestartBackfillServicesV1,
  memberV1,
  recordSetSignatureV1,
} from "./mcft_cap_02_restart_backfill_fixture_v1.js";

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function signaturesV1(recordSets: ContinuationRecordSetV1[]) {
  return recordSets.map(recordSetSignatureV1);
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap02RestartBackfillFixtureV1();
  const expected = fixture.expectedFixture.expected;

  const uninterruptedRuntime = new RestartBackfillInMemoryRuntimeV1(fixture.initialImage);
  const uninterruptedServices = createRestartBackfillServicesV1(uninterruptedRuntime);
  const uninterrupted = await uninterruptedServices.rangeService.runContiguousContinuationRangeV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
    lease_owner: "mcft-cap-02-uninterrupted-reference",
  });
  assert.equal(uninterrupted.status, "COMPLETED");
  assert.equal(uninterrupted.executed_tick_count, 24);
  assert.equal(uninterruptedRuntime.commitCount, 24);
  const uninterruptedSignatures = signaturesV1(uninterruptedRuntime.orderedRecordSetsV1());
  assert.equal(uninterruptedSignatures.length, 24);
  ok("uninterrupted reference executes exactly 24 ticks through the verified range and single-tick paths");

  const processOneRuntime = new RestartBackfillInMemoryRuntimeV1(fixture.initialImage);
  const processOneServices = createRestartBackfillServicesV1(processOneRuntime);
  const processOne = await processOneServices.rangeService.runContiguousContinuationRangeV1({
    ...fixture.request,
    to_logical_time: fixture.splitTargetLogicalTime,
    lease_owner: "mcft-cap-02-restart-process-1",
  });
  assert.equal(processOne.status, "COMPLETED");
  assert.equal(processOne.executed_tick_count, 12);
  assert.equal(processOneRuntime.commitCount, 12);
  assert.equal(processOne.final_handoff.previous_tick_sequence, 12);
  assert.equal(processOne.final_handoff.next_logical_tick_time, fixture.persistedResumeStartLogicalTime);
  ok("process 1 commits ticks 1 through 12 and persists sequence 12 plus the exact tick-13 handoff");

  const persistedImage = processOneRuntime.exportPersistenceImageV1();
  const processTwoRuntime = new RestartBackfillInMemoryRuntimeV1(persistedImage);
  const processTwoServices = createRestartBackfillServicesV1(processTwoRuntime);
  const resumed = await processTwoServices.restartService.resumeFromCheckpointV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
    lease_owner: "mcft-cap-02-restart-process-2",
  });
  assert.equal(resumed.operator_intent, "RESUME");
  assert.equal(resumed.persisted_start_logical_time, fixture.persistedResumeStartLogicalTime);
  assert.equal(resumed.range_result.executed_tick_count, 12);
  assert.equal(processTwoRuntime.commitCount, 12);
  assert.deepEqual(
    processTwoRuntime.executedLogicalTimes,
    Array.from({ length: 12 }, (_, index) => new Date(Date.parse(fixture.persistedResumeStartLogicalTime) + index * 3600000).toISOString()),
  );
  ok("a fresh service graph resumes only ticks 13 through 24 from the persisted checkpoint");

  const splitSignatures = signaturesV1(processTwoRuntime.orderedRecordSetsV1());
  assert.deepEqual(splitSignatures, uninterruptedSignatures);
  ok("12+12 restart preserves all operation keys, record-set identities, object IDs, and determinism hashes");

  const resumedFinalState = memberV1(
    resumed.range_result.tick_results[resumed.range_result.tick_results.length - 1].record_set,
    "twin_state_estimate_v1",
  );
  const resumedFinalCheckpoint = memberV1(
    resumed.range_result.tick_results[resumed.range_result.tick_results.length - 1].record_set,
    "twin_runtime_checkpoint_v1",
  );
  const resumedBasis = resumedFinalState.payload.computation_basis as Record<string, unknown>;
  assert.equal(resumedFinalState.logical_time, fixture.finalTargetLogicalTime);
  assert.equal(
    (resumedBasis.storage_mean_mm_decimal as Record<string, unknown>).value,
    expected.final_storage_mean_mm,
  );
  assert.equal(
    (resumedBasis.storage_variance_mm2_decimal as Record<string, unknown>).value,
    expected.final_storage_variance_mm2,
  );
  assert.equal(resumedFinalState.payload.available_water_fraction, Number(expected.final_available_water_fraction));
  assert.equal(
    resumedFinalState.payload.depletion_from_field_capacity_mm,
    Number(expected.final_depletion_from_field_capacity_mm),
  );
  assert.equal(resumedFinalCheckpoint.payload.tick_sequence, 24);
  assert.equal(resumed.range_result.final_handoff.next_logical_tick_time, fixture.expectedFixture.next_logical_time);
  ok("restart reaches the frozen final State, sequence-24 checkpoint, and T+1 handoff");

  const backfillProcessOneRuntime = new RestartBackfillInMemoryRuntimeV1(fixture.initialImage);
  const backfillProcessOneServices = createRestartBackfillServicesV1(backfillProcessOneRuntime);
  await backfillProcessOneServices.rangeService.runContiguousContinuationRangeV1({
    ...fixture.request,
    to_logical_time: fixture.splitTargetLogicalTime,
    lease_owner: "mcft-cap-02-backfill-process-1",
  });
  const backfillRuntime = new RestartBackfillInMemoryRuntimeV1(
    backfillProcessOneRuntime.exportPersistenceImageV1(),
  );
  const backfillServices = createRestartBackfillServicesV1(backfillRuntime);
  const backfilled = await backfillServices.restartService.runBoundedBackfillV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
    requested_start_logical_time: fixture.persistedResumeStartLogicalTime,
    evidence_intent: "MISSED_SCHEDULE_CATCH_UP",
    lease_owner: "mcft-cap-02-bounded-backfill",
  });
  assert.equal(backfilled.operator_intent, "BACKFILL");
  assert.equal(backfilled.range_result.executed_tick_count, 12);
  assert.deepEqual(signaturesV1(backfillRuntime.orderedRecordSetsV1()), uninterruptedSignatures);
  ok("bounded forward backfill fills exactly the contiguous missed schedule and matches uninterrupted hashes");

  const beforeRetryCommits = backfillRuntime.commitCount;
  const beforeRetryLeases = backfillRuntime.leaseAcquireCount;
  const completedRetry = await backfillServices.restartService.runBoundedBackfillV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
    evidence_intent: "MISSED_SCHEDULE_CATCH_UP",
    lease_owner: "mcft-cap-02-completed-backfill-retry",
  });
  assert.equal(completedRetry.range_result.status, "ALREADY_COMPLETE");
  assert.equal(completedRetry.range_result.executed_tick_count, 0);
  assert.equal(backfillRuntime.commitCount, beforeRetryCommits);
  assert.equal(backfillRuntime.leaseAcquireCount, beforeRetryLeases);
  assert.deepEqual(signaturesV1(backfillRuntime.orderedRecordSetsV1()), uninterruptedSignatures);
  ok("already-completed backfill target returns a zero-write and zero-lease idempotent result");

  assert.equal(
    processTwoRuntime.exportPersistenceImageV1().snapshot?.active_lineage_ref,
    fixture.initialImage.snapshot?.active_lineage_ref,
  );
  assert.equal(
    backfillRuntime.exportPersistenceImageV1().snapshot?.active_lineage_ref,
    fixture.initialImage.snapshot?.active_lineage_ref,
  );
  ok("restart and backfill retain the original active lineage and revision");

  assert.equal(processOne.tick_results.length + resumed.range_result.tick_results.length, 24);
  assert.equal(processTwoRuntime.orderedRecordSetsV1().length, 24);
  assert.equal(backfillRuntime.orderedRecordSetsV1().length, 24);
  ok("split resume and bounded backfill each contain exactly 24 immutable continuation record sets");

  console.log(`MCFT-CAP-02 restart backfill: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
