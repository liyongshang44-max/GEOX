// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE_NEGATIVE.ts
// Purpose: prove the contiguous range service rejects invalid bounds, enforces the 24-tick cap, preserves strict hourly handoffs, stops on first failure, and treats an already-complete target idempotently.
// Boundary: negative application acceptance only; no PostgreSQL, restart, resume, backfill, scheduler, public route, Forecast success, Recommendation, or action.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ContiguousContinuationRangeServiceV1,
  type ExecuteOneContinuationTickPortV1,
  type PrepareNextTickInputPortV1,
} from "../../apps/server/src/runtime/twin_runtime/contiguous_continuation_range_service_v1.js";
import type { ExecuteContinuationTickResultV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.js";
import type { PreparedNextTickInputV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildMcftCap02TwentyFourTickFixtureV1 } from "./mcft_cap_02_twenty_four_tick_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HOUR_MS = 60 * 60 * 1000;
const negative = JSON.parse(fs.readFileSync(
  path.join(ROOT, "fixtures/mcft/water_state/negative/MCFT_CAP_02_24_TICK_NEGATIVE_FIXTURES.json"),
  "utf8",
)) as { cases: Array<{ case_id: string; expected_error?: string; expected_status?: string; expected_tick_count?: number }> };

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}

async function expectErrorV1(expected: string, action: () => Promise<unknown>): Promise<void> {
  await assert.rejects(action, (error: unknown) => error instanceof Error && error.message === expected);
  ok(expected);
}

function readerV1(handoff: PreparedNextTickInputV1): PrepareNextTickInputPortV1 {
  return { async prepareNextTickInput() { return structuredClone(handoff); } };
}

function fakeResultV1(handoff: PreparedNextTickInputV1, nextLogicalTime: string): ExecuteContinuationTickResultV1 {
  return {
    status: "INSERTED",
    record_set: {} as ExecuteContinuationTickResultV1["record_set"],
    evidence_window: null,
    dynamics: null,
    next_handoff: { ...structuredClone(handoff), next_logical_tick_time: nextLogicalTime },
  };
}

async function main(): Promise<void> {
  assert.ok(negative.cases.length >= 10);
  const fixture = await buildMcftCap02TwentyFourTickFixtureV1();
  const baseHandoff = await fixture.handoffService.prepareNextTickInput(fixture.scope);
  const neverTick: ExecuteOneContinuationTickPortV1 = {
    async executeOneTick() { throw new Error("UNEXPECTED_TICK_EXECUTION"); },
  };
  const baseInput = {
    scope: fixture.scope,
    to_logical_time: fixture.expectedFixture.last_logical_time,
    created_at: fixture.expectedFixture.created_at,
    continuation_runtime_config_ref: fixture.continuationRuntimeConfig.object_id,
    crop_stage_context_ref: fixture.evidenceFixture.crop_stage_context_ref,
    crop_stage_context_hash: fixture.evidenceFixture.crop_stage_context_hash,
    crop_stage_context: fixture.cropStageContext,
    lease_owner: "mcft-cap-02-range-negative",
    lease_duration_seconds: 3600,
  };

  await expectErrorV1("CONTINUATION_RANGE_TARGET_NOT_CANONICAL_HOUR", async () => {
    await new ContiguousContinuationRangeServiceV1(readerV1(baseHandoff), neverTick)
      .runContiguousContinuationRange({ ...baseInput, to_logical_time: "not-a-time" });
  });
  await expectErrorV1("CONTINUATION_RANGE_TARGET_NOT_CANONICAL_HOUR", async () => {
    await new ContiguousContinuationRangeServiceV1(readerV1(baseHandoff), neverTick)
      .runContiguousContinuationRange({ ...baseInput, to_logical_time: "2026-06-01T02:30:00.000Z" });
  });
  await expectErrorV1("CONTINUATION_RANGE_CREATED_AT_INVALID", async () => {
    await new ContiguousContinuationRangeServiceV1(readerV1(baseHandoff), neverTick)
      .runContiguousContinuationRange({ ...baseInput, created_at: "invalid" });
  });
  await expectErrorV1("CONTINUATION_RANGE_LEASE_OWNER_REQUIRED", async () => {
    await new ContiguousContinuationRangeServiceV1(readerV1(baseHandoff), neverTick)
      .runContiguousContinuationRange({ ...baseInput, lease_owner: " " });
  });
  await expectErrorV1("CONTINUATION_RANGE_LEASE_DURATION_INVALID", async () => {
    await new ContiguousContinuationRangeServiceV1(readerV1(baseHandoff), neverTick)
      .runContiguousContinuationRange({ ...baseInput, lease_duration_seconds: 0 });
  });
  await expectErrorV1("PERSISTED_NEXT_TICK_NOT_CANONICAL_HOUR", async () => {
    const invalidHandoff = { ...baseHandoff, next_logical_tick_time: "2026-06-01T02:30:00.000Z" };
    await new ContiguousContinuationRangeServiceV1(readerV1(invalidHandoff), neverTick)
      .runContiguousContinuationRange(baseInput);
  });
  await expectErrorV1("CONTINUATION_RANGE_MAX_TICKS_EXCEEDED", async () => {
    await new ContiguousContinuationRangeServiceV1(readerV1(baseHandoff), neverTick)
      .runContiguousContinuationRange({ ...baseInput, to_logical_time: addHoursV1(baseHandoff.next_logical_tick_time, 24) });
  });

  let noncontiguousCalls = 0;
  const noncontiguousTick: ExecuteOneContinuationTickPortV1 = {
    async executeOneTick(input) {
      noncontiguousCalls += 1;
      return fakeResultV1(baseHandoff, addHoursV1(input.logical_time, 2));
    },
  };
  await expectErrorV1("CONTINUATION_RANGE_NONCONTIGUOUS_COMMITTED_HANDOFF", async () => {
    await new ContiguousContinuationRangeServiceV1(readerV1(baseHandoff), noncontiguousTick)
      .runContiguousContinuationRange({ ...baseInput, to_logical_time: baseHandoff.next_logical_tick_time });
  });
  assert.equal(noncontiguousCalls, 1);

  let failureCalls = 0;
  const failingTick: ExecuteOneContinuationTickPortV1 = {
    async executeOneTick(input) {
      failureCalls += 1;
      if (failureCalls === 13) throw new Error("SYNTHETIC_TICK_13_FAILURE");
      return fakeResultV1(baseHandoff, addHoursV1(input.logical_time, 1));
    },
  };
  await expectErrorV1("SYNTHETIC_TICK_13_FAILURE", async () => {
    await new ContiguousContinuationRangeServiceV1(readerV1(baseHandoff), failingTick)
      .runContiguousContinuationRange(baseInput);
  });
  assert.equal(failureCalls, 13);
  ok("range stops on the first failed tick and does not invoke ticks 14 through 24");

  for (const propagatedCode of ["CONTINUATION_RUNTIME_CONFIG_REF_MISMATCH", "CONTINUATION_RUNTIME_CONFIG_HASH_MISMATCH"]) {
    const propagatingTick: ExecuteOneContinuationTickPortV1 = {
      async executeOneTick() { throw new Error(propagatedCode); },
    };
    await expectErrorV1(propagatedCode, async () => {
      await new ContiguousContinuationRangeServiceV1(readerV1(baseHandoff), propagatingTick)
        .runContiguousContinuationRange({ ...baseInput, to_logical_time: baseHandoff.next_logical_tick_time });
    });
  }

  let alreadyCompleteCalls = 0;
  const alreadyCompleteHandoff = {
    ...baseHandoff,
    next_logical_tick_time: addHoursV1(fixture.expectedFixture.last_logical_time, 1),
  };
  const alreadyCompleteTick: ExecuteOneContinuationTickPortV1 = {
    async executeOneTick() {
      alreadyCompleteCalls += 1;
      throw new Error("UNEXPECTED_TICK_EXECUTION");
    },
  };
  const alreadyComplete = await new ContiguousContinuationRangeServiceV1(
    readerV1(alreadyCompleteHandoff),
    alreadyCompleteTick,
  ).runContiguousContinuationRange(baseInput);
  assert.equal(alreadyComplete.status, "ALREADY_COMPLETE");
  assert.equal(alreadyComplete.executed_tick_count, 0);
  assert.equal(alreadyCompleteCalls, 0);
  ok("a target older than the persisted next tick is idempotently reported as already complete without invoking single-tick execution");

  console.log(`MCFT-CAP-02 twenty-four-tick range negative: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
