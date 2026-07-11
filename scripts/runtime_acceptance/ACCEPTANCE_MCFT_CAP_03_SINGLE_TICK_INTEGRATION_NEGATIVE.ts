// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_SINGLE_TICK_INTEGRATION_NEGATIVE.ts
// Purpose: prove CAP-03 single-tick orchestration fails closed on missing predecessor authority, wrong logical time, invalid config/context, conflicting Evidence, and precommit failure.
// Boundary: in-memory negative acceptance only; no database, range, restart/backfill, route, scheduler, successful Forecast, Recommendation, Decision, or action.

import assert from "node:assert/strict";
import { AssimilatedContinuationTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import {
  buildMcftCap03SingleTickIntegrationFixtureV1,
} from "./mcft_cap_03_single_tick_integration_fixture_v1.js";

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function expectErrorV1(
  action: () => Promise<unknown>,
  expected: string | RegExp,
): Promise<void> {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error, "expected Error");
  if (typeof expected === "string") assert.equal(caught.message, expected);
  else assert.match(caught.message, expected);
}

async function harnessV1() {
  const fixture = await buildMcftCap03SingleTickIntegrationFixtureV1();
  const service = new AssimilatedContinuationTickServiceV1(
    new PrepareNextTickInputServiceV1(fixture.runtime),
    fixture.runtime,
    fixture.runtime,
    fixture.runtime,
  );
  const input = {
    scope: fixture.scope,
    logical_time: fixture.logicalTime,
    created_at: fixture.createdAt,
    assimilated_runtime_config_ref: fixture.assimilatedRuntimeConfig.object_id,
    crop_stage_context: fixture.cropStageContext,
    lease_owner: "mcft-cap-03-s4-negative",
    lease_duration_seconds: 300,
  };
  return { fixture, service, input };
}

async function main(): Promise<void> {
  {
    const { fixture, service, input } = await harnessV1();
    const snapshot = fixture.runtime.currentSnapshotV1();
    delete snapshot.previous_forecast_result;
    fixture.runtime.replaceSnapshotV1(snapshot);
    await expectErrorV1(
      () => service.executeOneTick(input),
      "ASSIMILATED_PREDECESSOR_FORECAST_HASH_REQUIRED",
    );
    assert.equal(fixture.runtime.leaseAcquireCount, 0);
    assert.equal(fixture.runtime.commitCount, 0);
    ok("missing canonical predecessor Forecast hash fails before lease and write");
  }

  {
    const { fixture, service, input } = await harnessV1();
    await expectErrorV1(
      () => service.executeOneTick({ ...input, logical_time: fixture.nextLogicalTime }),
      "ASSIMILATED_REQUESTED_TICK_NOT_NEXT_PERSISTED_TICK",
    );
    assert.equal(fixture.runtime.leaseAcquireCount, 0);
    assert.equal(fixture.runtime.commitCount, 0);
    ok("requested logical time must equal the persisted canonical next tick");
  }

  {
    const { fixture, service, input } = await harnessV1();
    await expectErrorV1(
      () => service.executeOneTick({
        ...input,
        assimilated_runtime_config_ref: "twin_runtime_config_missing_s4",
      }),
      "ASSIMILATED_RUNTIME_CONFIG_NOT_FOUND",
    );
    assert.equal(fixture.runtime.leaseAcquireCount, 0);
    assert.equal(fixture.runtime.commitCount, 0);
    ok("missing pinned CAP-03 Runtime Config fails before Evidence and lease");
  }

  {
    const { fixture, service, input } = await harnessV1();
    const driftedContext: ContinuationCropStageConfigurationContextV1 = {
      ...structuredClone(input.crop_stage_context),
      configuration_matrix_hash: "sha256:drifted_configuration_matrix",
    };
    await expectErrorV1(
      () => service.executeOneTick({ ...input, crop_stage_context: driftedContext }),
      "ASSIMILATED_CROP_STAGE_CONFIGURATION_MATRIX_MISMATCH",
    );
    assert.equal(fixture.runtime.leaseAcquireCount, 0);
    assert.equal(fixture.runtime.commitCount, 0);
    ok("crop-stage context must remain bound to the pinned configuration matrix hash");
  }

  {
    const { fixture, service, input } = await harnessV1();
    const conflicting = structuredClone(fixture.observation);
    conflicting.source_record_hash = "sha256:conflicting_observation_payload";
    conflicting.canonical_payload = {
      ...conflicting.canonical_payload,
      value: 0.2,
    };
    fixture.runtime.replaceCandidateRecordsV1([
      ...fixture.candidateRecords,
      conflicting,
    ]);
    await expectErrorV1(
      () => service.executeOneTick(input),
      /CONFLICTING_SEMANTIC_DUPLICATE/,
    );
    assert.equal(fixture.runtime.leaseAcquireCount, 0);
    assert.equal(fixture.runtime.commitCount, 0);
    ok("conflicting semantic duplicate observation fails the whole tick before lease");
  }

  {
    const { fixture, service, input } = await harnessV1();
    await expectErrorV1(
      () => service.executeOneTick({
        ...input,
        fault_injection: (stage) => {
          if (stage === "before_commit") throw new Error("S4_PRECOMMIT_FAULT");
        },
      }),
      "S4_PRECOMMIT_FAULT",
    );
    assert.equal(fixture.runtime.leaseAcquireCount, 1);
    assert.equal(fixture.runtime.commitCount, 0);
    assert.equal(fixture.runtime.currentSnapshotV1().checkpoint.object_id, fixture.predecessorCheckpoint.object_id);
    ok("precommit failure leaves predecessor State, checkpoint, and Forecast authority unchanged");
  }

  console.log(`MCFT-CAP-03 single-tick integration negative: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
