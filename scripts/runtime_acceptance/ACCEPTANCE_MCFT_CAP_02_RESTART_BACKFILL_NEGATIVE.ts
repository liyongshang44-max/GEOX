// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL_NEGATIVE.ts
// Purpose: prove restart/resume and bounded backfill reject missing or divergent persisted authority, skipped hours, excessive ranges, late-Evidence revision intent, and invalid manual-runner intent before A2 writes.
// Boundary: deterministic negative acceptance only; no PostgreSQL mutation, projection repair, scheduler, route, Forecast success, Recommendation, Decision, or action.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseReplayRangeIntentV1 } from "../../apps/server/src/adapters/twin_runtime/replay_range_intent_adapter_v1.js";
import type { PersistedNextTickSnapshotV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  RestartBackfillInMemoryRuntimeV1,
  addHoursV1,
  buildMcftCap02RestartBackfillFixtureV1,
  createRestartBackfillServicesV1,
} from "./mcft_cap_02_restart_backfill_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function expectErrorV1(
  expected: string,
  operation: () => Promise<unknown> | unknown,
): Promise<void> {
  let actual = "NO_ERROR";
  try {
    await operation();
  } catch (error) {
    actual = error instanceof Error ? error.message : String(error);
  }
  assert.equal(actual, expected);
  ok(expected);
}

function cloneSnapshotV1(snapshot: PersistedNextTickSnapshotV1 | null): PersistedNextTickSnapshotV1 {
  if (!snapshot) throw new Error("NEGATIVE_FIXTURE_SNAPSHOT_REQUIRED");
  return structuredClone(snapshot);
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap02RestartBackfillFixtureV1();
  const negative = JSON.parse(fs.readFileSync(
    path.join(ROOT, "fixtures/mcft/water_state/negative/MCFT_CAP_02_RESTART_BACKFILL_NEGATIVE_FIXTURES.json"),
    "utf8",
  )) as {
    cases: Array<Record<string, unknown>>;
  };
  assert.ok(negative.cases.length >= 14);
  for (const item of negative.cases) {
    assert.equal(item.expected_no_current_tick_a2_append, true);
    assert.equal(item.expected_no_current_tick_projection_write, true);
    assert.equal(item.expected_checkpoint_unchanged, true);
    assert.equal(item.expected_state_latest_unchanged, true);
    assert.equal(item.expected_forecast_result_latest_unchanged, true);
    assert.equal(item.expected_active_lineage_unchanged, true);
  }
  ok("negative fixture freezes at least fourteen zero-write cases with complete preservation metadata");

  const noBootstrapRuntime = new RestartBackfillInMemoryRuntimeV1({
    ...fixture.initialImage,
    snapshot: null,
  });
  const noBootstrapServices = createRestartBackfillServicesV1(noBootstrapRuntime);
  await expectErrorV1("BACKFILL_BEFORE_BOOTSTRAP", () => noBootstrapServices.restartService.runBoundedBackfillV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
    evidence_intent: "MISSED_SCHEDULE_CATCH_UP",
  }));
  assert.equal(noBootstrapRuntime.commitCount, 0);
  assert.equal(noBootstrapRuntime.leaseAcquireCount, 0);

  const missingTickSnapshot = cloneSnapshotV1(fixture.initialImage.snapshot);
  delete missingTickSnapshot.last_terminal_tick;
  const missingTickRuntime = new RestartBackfillInMemoryRuntimeV1({
    ...fixture.initialImage,
    snapshot: missingTickSnapshot,
  });
  const missingTickServices = createRestartBackfillServicesV1(missingTickRuntime);
  await expectErrorV1("CHECKPOINT_PROJECTION_DIVERGENCE", () => missingTickServices.restartService.resumeFromCheckpointV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
  }));
  assert.equal(missingTickRuntime.commitCount, 0);

  const stateDivergenceSnapshot = cloneSnapshotV1(fixture.initialImage.snapshot);
  stateDivergenceSnapshot.checkpoint.payload.last_posterior_state_ref = "state_projection_divergence";
  const stateDivergenceRuntime = new RestartBackfillInMemoryRuntimeV1({
    ...fixture.initialImage,
    snapshot: stateDivergenceSnapshot,
  });
  const stateDivergenceServices = createRestartBackfillServicesV1(stateDivergenceRuntime);
  await expectErrorV1("CHECKPOINT_PROJECTION_DIVERGENCE", () => stateDivergenceServices.restartService.resumeFromCheckpointV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
  }));
  assert.equal(stateDivergenceRuntime.commitCount, 0);

  const tickDivergenceSnapshot = cloneSnapshotV1(fixture.initialImage.snapshot);
  tickDivergenceSnapshot.checkpoint.payload.last_completed_tick_ref = "tick_projection_divergence";
  const tickDivergenceRuntime = new RestartBackfillInMemoryRuntimeV1({
    ...fixture.initialImage,
    snapshot: tickDivergenceSnapshot,
  });
  const tickDivergenceServices = createRestartBackfillServicesV1(tickDivergenceRuntime);
  await expectErrorV1("CHECKPOINT_PROJECTION_DIVERGENCE", () => tickDivergenceServices.restartService.resumeFromCheckpointV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
  }));
  assert.equal(tickDivergenceRuntime.commitCount, 0);

  const lineageDivergenceSnapshot = cloneSnapshotV1(fixture.initialImage.snapshot);
  lineageDivergenceSnapshot.active_lineage_id = "lineage_projection_divergence";
  const lineageDivergenceRuntime = new RestartBackfillInMemoryRuntimeV1({
    ...fixture.initialImage,
    snapshot: lineageDivergenceSnapshot,
  });
  const lineageDivergenceServices = createRestartBackfillServicesV1(lineageDivergenceRuntime);
  await expectErrorV1("CHECKPOINT_PROJECTION_DIVERGENCE", () => lineageDivergenceServices.restartService.resumeFromCheckpointV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
  }));
  assert.equal(lineageDivergenceRuntime.commitCount, 0);

  const revisionDivergenceSnapshot = cloneSnapshotV1(fixture.initialImage.snapshot);
  revisionDivergenceSnapshot.previous_posterior.revision_id = "revision_projection_divergence";
  const revisionDivergenceRuntime = new RestartBackfillInMemoryRuntimeV1({
    ...fixture.initialImage,
    snapshot: revisionDivergenceSnapshot,
  });
  const revisionDivergenceServices = createRestartBackfillServicesV1(revisionDivergenceRuntime);
  await expectErrorV1("CHECKPOINT_PROJECTION_DIVERGENCE", () => revisionDivergenceServices.restartService.resumeFromCheckpointV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
  }));
  assert.equal(revisionDivergenceRuntime.commitCount, 0);

  const basisSourceRuntime = new RestartBackfillInMemoryRuntimeV1(fixture.initialImage);
  const basisSourceServices = createRestartBackfillServicesV1(basisSourceRuntime);
  await basisSourceServices.rangeService.runContiguousContinuationRangeV1({
    ...fixture.request,
    to_logical_time: fixture.firstLogicalTime,
  });
  const invalidBasisImage = basisSourceRuntime.exportPersistenceImageV1();
  const invalidBasisSnapshot = cloneSnapshotV1(invalidBasisImage.snapshot);
  const basis = invalidBasisSnapshot.previous_posterior.payload.computation_basis as Record<string, unknown>;
  delete basis.storage_mean_mm_decimal;
  const invalidBasisRuntime = new RestartBackfillInMemoryRuntimeV1({
    ...invalidBasisImage,
    snapshot: invalidBasisSnapshot,
  });
  const invalidBasisServices = createRestartBackfillServicesV1(invalidBasisRuntime);
  await expectErrorV1("PREVIOUS_STORAGE_MEAN_DECIMAL_REQUIRED", () => invalidBasisServices.restartService.resumeFromCheckpointV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
  }));
  assert.equal(invalidBasisRuntime.commitCount, 0);

  const nonHourRuntime = new RestartBackfillInMemoryRuntimeV1(fixture.initialImage);
  const nonHourServices = createRestartBackfillServicesV1(nonHourRuntime);
  await expectErrorV1("CONTINUATION_RANGE_TARGET_NOT_CANONICAL_HOUR", () => nonHourServices.restartService.runBoundedBackfillV1({
    ...fixture.request,
    to_logical_time: "2026-06-01T02:30:00.000Z",
    evidence_intent: "MISSED_SCHEDULE_CATCH_UP",
  }));
  assert.equal(nonHourRuntime.commitCount, 0);
  assert.equal(nonHourRuntime.leaseAcquireCount, 0);

  const skipRuntime = new RestartBackfillInMemoryRuntimeV1(fixture.initialImage);
  const skipServices = createRestartBackfillServicesV1(skipRuntime);
  await expectErrorV1("BACKFILL_START_NOT_PERSISTED_NEXT_TICK", () => skipServices.restartService.runBoundedBackfillV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
    requested_start_logical_time: addHoursV1(fixture.firstLogicalTime, 1),
    evidence_intent: "MISSED_SCHEDULE_CATCH_UP",
  }));
  assert.equal(skipRuntime.commitCount, 0);
  assert.equal(skipRuntime.leaseAcquireCount, 0);

  const excessiveRuntime = new RestartBackfillInMemoryRuntimeV1(fixture.initialImage);
  const excessiveServices = createRestartBackfillServicesV1(excessiveRuntime);
  await expectErrorV1("CONTINUATION_RANGE_MAX_TICKS_EXCEEDED", () => excessiveServices.restartService.runBoundedBackfillV1({
    ...fixture.request,
    to_logical_time: addHoursV1(fixture.firstLogicalTime, 24),
    evidence_intent: "MISSED_SCHEDULE_CATCH_UP",
  }));
  assert.equal(excessiveRuntime.commitCount, 0);
  assert.equal(excessiveRuntime.leaseAcquireCount, 0);

  const lateRuntime = new RestartBackfillInMemoryRuntimeV1(fixture.initialImage);
  const lateServices = createRestartBackfillServicesV1(lateRuntime);
  await expectErrorV1("LATE_EVIDENCE_FORWARD_BACKFILL_FORBIDDEN", () => lateServices.restartService.runBoundedBackfillV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
    evidence_intent: "LATE_EVIDENCE_REVISION",
  }));
  assert.equal(lateRuntime.commitCount, 0);
  assert.equal(lateRuntime.leaseAcquireCount, 0);

  const commonArgs = [
    "--operator-intent", "REPLAY",
    "--mode", "resume",
    "--to", fixture.finalTargetLogicalTime,
    "--created-at", fixture.expectedFixture.created_at,
    "--runtime-config-ref", fixture.continuationRuntimeConfig.object_id,
  ];
  await expectErrorV1("DATABASE_URL_REQUIRED", () => parseReplayRangeIntentV1({ argv: commonArgs }));

  await expectErrorV1("REPLAY_OPERATOR_INTENT_REQUIRED", () => parseReplayRangeIntentV1({
    argv: [
      "--operator-intent", "LIVE",
      "--mode", "resume",
      "--to", fixture.finalTargetLogicalTime,
      "--created-at", fixture.expectedFixture.created_at,
      "--runtime-config-ref", fixture.continuationRuntimeConfig.object_id,
      "--database-url", "postgres://acceptance",
    ],
  }));

  await expectErrorV1("BACKFILL_ARGUMENT_USED_OUTSIDE_BACKFILL_MODE", () => parseReplayRangeIntentV1({
    argv: [
      ...commonArgs,
      "--database-url", "postgres://acceptance",
      "--from", fixture.firstLogicalTime,
    ],
  }));

  console.log(`MCFT-CAP-02 restart backfill negative: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
