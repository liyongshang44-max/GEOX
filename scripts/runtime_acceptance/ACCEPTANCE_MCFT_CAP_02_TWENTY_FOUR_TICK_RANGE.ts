// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE.ts
// Purpose: prove one uninterrupted bounded Replay range advances the persisted MCFT-CAP-02 continuation chain through exactly 24 contiguous ticks and the frozen final State.
// Boundary: positive in-memory application acceptance only; no PostgreSQL, restart, resume, backfill, scheduler, public route, Forecast success, Recommendation, or action.

import assert from "node:assert/strict";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { validateContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_cross_ref_validator_v1.js";
import { buildMcftCap02TwentyFourTickFixtureV1 } from "./mcft_cap_02_twenty_four_tick_fixture_v1.js";

const HOUR_MS = 60 * 60 * 1000;
let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function memberV1(members: CanonicalObjectEnvelopeV1[], objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = members.filter((member) => member.object_type === objectType);
  assert.equal(matches.length, 1);
  return matches[0];
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}

function decimalDigitsV1(value: unknown): bigint {
  assert.equal(typeof value, "string");
  return BigInt((value as string).replace(".", ""));
}

async function executeStandardRangeV1() {
  const fixture = await buildMcftCap02TwentyFourTickFixtureV1();
  const result = await fixture.rangeService.runContiguousContinuationRange({
    scope: fixture.scope,
    to_logical_time: fixture.expectedFixture.last_logical_time,
    created_at: fixture.expectedFixture.created_at,
    continuation_runtime_config_ref: fixture.continuationRuntimeConfig.object_id,
    crop_stage_context_ref: fixture.evidenceFixture.crop_stage_context_ref,
    crop_stage_context_hash: fixture.evidenceFixture.crop_stage_context_hash,
    crop_stage_context: fixture.cropStageContext,
    lease_owner: "mcft-cap-02-24-tick-positive",
    lease_duration_seconds: 3600,
  });
  return { fixture, result };
}

async function main(): Promise<void> {
  const { fixture, result } = await executeStandardRangeV1();
  const expected = fixture.expectedFixture.expected;
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.executed_tick_count, expected.continuation_tick_count);
  assert.equal(result.tick_results.length, expected.continuation_tick_count);
  assert.equal(fixture.runtime.commitCount, expected.continuation_tick_count);
  assert.equal(fixture.runtime.leaseAcquireCount, expected.continuation_tick_count);
  ok("standard range invokes the verified single-tick path exactly 24 times with one commit and lease acquisition per new tick");

  let previousStateRef = fixture.initialSnapshot.previous_posterior.object_id;
  let previousCheckpointRef = fixture.initialSnapshot.checkpoint.object_id;
  let previousVariance: bigint | null = null;
  const stateHashes: string[] = [];
  const logicalTimes: string[] = [];

  for (let index = 0; index < result.tick_results.length; index += 1) {
    const tickResult = result.tick_results[index];
    assert.equal(tickResult.status, "INSERTED");
    validateContinuationRecordSetV1(tickResult.record_set);
    assert.equal(tickResult.record_set.members.length, expected.member_count_per_tick);
    const state = memberV1(tickResult.record_set.members, "twin_state_estimate_v1");
    const checkpoint = memberV1(tickResult.record_set.members, "twin_runtime_checkpoint_v1");
    const forecast = memberV1(tickResult.record_set.members, "twin_forecast_run_v1");
    const assimilation = memberV1(tickResult.record_set.members, "twin_assimilation_update_v1");
    const expectedLogicalTime = addHoursV1(fixture.expectedFixture.first_logical_time, index);
    assert.equal(state.logical_time, expectedLogicalTime);
    assert.equal(checkpoint.logical_time, expectedLogicalTime);
    assert.equal(state.payload.previous_posterior_ref, previousStateRef);
    assert.equal(checkpoint.payload.previous_checkpoint_ref, previousCheckpointRef);
    assert.equal(checkpoint.payload.tick_sequence, index + 1);
    assert.equal(checkpoint.payload.next_tick_logical_time, addHoursV1(expectedLogicalTime, 1));
    assert.equal(forecast.payload.status, expected.forecast_status);
    assert.equal(forecast.payload.successful_forecast_ref, null);
    assert.equal(assimilation.payload.status, expected.assimilation_status);
    assert.equal(assimilation.payload.innovation, null);
    assert.equal(assimilation.payload.assimilation_gain, null);
    const basis = state.payload.computation_basis as Record<string, unknown>;
    const variance = decimalDigitsV1((basis.storage_variance_mm2_decimal as Record<string, unknown>).value);
    if (previousVariance !== null) assert.ok(variance > previousVariance);
    previousVariance = variance;
    previousStateRef = state.object_id;
    previousCheckpointRef = checkpoint.object_id;
    stateHashes.push(state.determinism_hash);
    logicalTimes.push(state.logical_time);
  }
  assert.equal(new Set(stateHashes).size, 24);
  assert.equal(new Set(logicalTimes).size, 24);
  ok("the continuation State and checkpoint chains are contiguous, uniquely identified, hour-monotonic, and sequence-monotonic");
  ok("every tick preserves explicit NOT_APPLIED assimilation and a BLOCKED Forecast without successful-Forecast mutation");
  ok("the persisted storage-variance computation basis increases strictly across all 24 no-observation continuation States");

  const finalResult = result.tick_results[result.tick_results.length - 1];
  const finalState = memberV1(finalResult.record_set.members, "twin_state_estimate_v1");
  const finalCheckpoint = memberV1(finalResult.record_set.members, "twin_runtime_checkpoint_v1");
  const finalBasis = finalState.payload.computation_basis as Record<string, unknown>;
  const finalStorage = finalState.payload.root_zone_storage_mm as Record<string, unknown>;
  const finalVwc = finalState.payload.root_zone_vwc_fraction as Record<string, unknown>;
  const finalInterval = (finalState.payload.uncertainty as Record<string, unknown>).interval as Record<string, unknown>;
  assert.equal(finalState.logical_time, fixture.expectedFixture.last_logical_time);
  assert.equal((finalBasis.storage_mean_mm_decimal as Record<string, unknown>).value, expected.final_storage_mean_mm);
  assert.equal((finalBasis.storage_variance_mm2_decimal as Record<string, unknown>).value, expected.final_storage_variance_mm2);
  assert.equal(finalStorage.mean, Number(expected.final_storage_mean_mm));
  assert.equal(finalVwc.mean, Number(expected.final_vwc_mean));
  assert.equal(finalVwc.variance, Number(expected.final_vwc_variance));
  assert.equal(finalVwc.stddev, Number(expected.final_vwc_stddev));
  assert.equal(finalInterval.published_lower, Number(expected.final_interval_lower));
  assert.equal(finalInterval.published_upper, Number(expected.final_interval_upper));
  assert.equal(finalState.payload.available_water_fraction, Number(expected.final_available_water_fraction));
  assert.equal(finalState.payload.depletion_from_field_capacity_mm, Number(expected.final_depletion_from_field_capacity_mm));
  assert.equal(finalCheckpoint.payload.tick_sequence, expected.checkpoint_tick_sequence);
  assert.equal(finalCheckpoint.payload.next_tick_logical_time, fixture.expectedFixture.next_logical_time);
  assert.equal(result.final_handoff.previous_posterior_ref, finalState.object_id);
  assert.equal(result.final_handoff.previous_checkpoint_ref, finalCheckpoint.object_id);
  assert.equal(result.final_handoff.next_logical_tick_time, fixture.expectedFixture.next_logical_time);
  ok("tick 24 matches the frozen storage, VWC, uncertainty, AWF, depletion, checkpoint sequence, and next persisted handoff");

  assert.equal(Number(expected.bootstrap_state_count) + result.executed_tick_count, expected.total_state_count);
  assert.equal(result.executed_tick_count * Number(expected.member_count_per_tick), expected.a2_fact_count);
  const totalEt0Micros = fixture.expectedFixture.et0_series_mm.reduce(
    (sum, value) => sum + BigInt(value.replace(".", "")),
    0n,
  );
  assert.equal(totalEt0Micros, 3_300_000n);
  ok("the scoped chain contains one bootstrap State plus 24 continuation States and exactly 192 A2 members");
  ok("the frozen hourly ET0 series totals 3.300000 mm and therefore propagates exactly 0.990000 mm crop ET");

  const commitsBeforeReplay = fixture.runtime.commitCount;
  const leasesBeforeReplay = fixture.runtime.leaseAcquireCount;
  const replay = await fixture.rangeService.runContiguousContinuationRange({
    scope: fixture.scope,
    to_logical_time: fixture.expectedFixture.last_logical_time,
    created_at: fixture.expectedFixture.created_at,
    continuation_runtime_config_ref: fixture.continuationRuntimeConfig.object_id,
    crop_stage_context_ref: fixture.evidenceFixture.crop_stage_context_ref,
    crop_stage_context_hash: fixture.evidenceFixture.crop_stage_context_hash,
    crop_stage_context: fixture.cropStageContext,
    lease_owner: "mcft-cap-02-24-tick-positive",
    lease_duration_seconds: 3600,
  });
  assert.equal(replay.status, expected.range_replay_status);
  assert.equal(replay.executed_tick_count, expected.range_replay_new_tick_count);
  assert.equal(fixture.runtime.commitCount, commitsBeforeReplay);
  assert.equal(fixture.runtime.leaseAcquireCount, leasesBeforeReplay);
  ok("repeating an already-complete target range returns ALREADY_COMPLETE without a new tick, lease, fact, or projection write");

  const independent = await executeStandardRangeV1();
  const independentFinal = independent.result.tick_results[independent.result.tick_results.length - 1].record_set;
  assert.deepEqual(
    independent.result.tick_results.map((tick) => tick.record_set.continuation_record_set_determinism_hash),
    result.tick_results.map((tick) => tick.record_set.continuation_record_set_determinism_hash),
  );
  assert.deepEqual(independentFinal, finalResult.record_set);
  ok("an independent uninterrupted rerun is byte-equivalent for all 24 canonical record-set hashes and the final record set");

  console.log(`MCFT-CAP-02 twenty-four-tick range: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
