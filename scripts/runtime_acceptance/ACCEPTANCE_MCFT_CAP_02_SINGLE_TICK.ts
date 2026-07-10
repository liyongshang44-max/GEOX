// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK.ts
// Purpose: prove one standard MCFT-CAP-02 Replay continuation tick composes the persisted handoff, exact-hour Evidence, pure Dynamics, eight-object graph, A2 persistence, canonical readback, and next handoff deterministically.
// Boundary: positive application acceptance only; no PostgreSQL, range, restart, backfill, scheduler, Forecast success, Recommendation, or action.

import assert from "node:assert/strict";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { validateContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_cross_ref_validator_v1.js";
import { ContinuationTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import {
  InMemorySingleTickRuntimeV1,
  buildMcftCap02SingleTickFixtureV1,
} from "./mcft_cap_02_single_tick_fixture_v1.js";

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

async function main(): Promise<void> {
  const fixture = await buildMcftCap02SingleTickFixtureV1();
  const runtime = new InMemorySingleTickRuntimeV1({
    snapshot: fixture.initialSnapshot,
    configs: [fixture.parentRuntimeConfig, fixture.continuationRuntimeConfig],
    candidate_records: fixture.evidenceFixture.candidate_records,
  });
  const handoffService = new PrepareNextTickInputServiceV1(runtime);
  const service = new ContinuationTickServiceV1(handoffService, runtime, runtime, runtime);
  const request = {
    scope: fixture.scope,
    logical_time: fixture.expectedFixture.logical_time,
    created_at: fixture.expectedFixture.created_at,
    continuation_runtime_config_ref: fixture.continuationRuntimeConfig.object_id,
    crop_stage_context_ref: fixture.evidenceFixture.crop_stage_context_ref,
    crop_stage_context_hash: fixture.evidenceFixture.crop_stage_context_hash,
    crop_stage_context: fixture.cropStageContext,
    lease_owner: "mcft-cap-02-single-tick-positive",
    lease_duration_seconds: 300,
  };

  const first = await service.executeOneTick(request);
  assert.equal(first.status, "INSERTED");
  assert.ok(first.evidence_window);
  assert.ok(first.dynamics);
  assert.equal(first.record_set.members.length, 8);
  validateContinuationRecordSetV1(first.record_set);
  ok("standard first continuation executes exactly one complete validated A2 eight-object record set");

  const expected = fixture.expectedFixture.expected;
  const state = memberV1(first.record_set.members, "twin_state_estimate_v1");
  const basis = state.payload.computation_basis as Record<string, unknown>;
  const storageBasis = basis.storage_mean_mm_decimal as Record<string, unknown>;
  const varianceBasis = basis.storage_variance_mm2_decimal as Record<string, unknown>;
  const storage = state.payload.root_zone_storage_mm as Record<string, unknown>;
  const vwc = state.payload.root_zone_vwc_fraction as Record<string, unknown>;
  assert.equal(storageBasis.value, expected.storage_mean_mm);
  assert.equal(varianceBasis.value, expected.storage_variance_mm2);
  assert.equal(storage.mean, Number(expected.storage_mean_mm));
  assert.equal(vwc.mean, Number(expected.vwc_mean));
  assert.equal(vwc.variance, Number(expected.vwc_variance));
  assert.equal(state.payload.available_water_fraction, Number(expected.available_water_fraction));
  assert.equal(state.payload.depletion_from_field_capacity_mm, Number(expected.depletion_from_field_capacity_mm));
  assert.equal(basis.basis_origin, expected.computation_basis_origin);
  assert.equal(basis.source_vwc_variance, expected.source_vwc_variance);
  assert.equal(basis.root_zone_depth_mm, expected.root_zone_depth_mm);
  ok("standard State, exact computation basis, AWF, depletion, and uncertainty values match the frozen first-tick fixture");

  const transition = memberV1(first.record_set.members, "twin_state_transition_v1");
  assert.equal((transition.payload.mass_balance_trace as Record<string, unknown>).mass_balance_error_mm, expected.mass_balance_error_mm);
  assert.equal(transition.payload.mass_balance_trace_hash, state.payload.mass_balance_trace_hash);
  const assimilation = memberV1(first.record_set.members, "twin_assimilation_update_v1");
  assert.equal(assimilation.payload.status, expected.assimilation_status);
  assert.equal(assimilation.payload.disposition, expected.assimilation_disposition);
  assert.deepEqual(assimilation.payload.consumed_observation_refs, []);
  assert.equal(assimilation.payload.innovation, null);
  assert.equal(assimilation.payload.assimilation_gain, null);
  ok("mass balance closes and explicit NOT_APPLIED assimilation preserves propagated mean and variance");

  const forecast = memberV1(first.record_set.members, "twin_forecast_run_v1");
  assert.equal(forecast.payload.status, expected.forecast_status);
  assert.deepEqual(forecast.payload.points, expected.forecast_points);
  assert.equal(forecast.payload.scenario_eligible, expected.forecast_scenario_eligible);
  assert.equal(forecast.payload.successful_forecast_ref, null);
  const checkpoint = memberV1(first.record_set.members, "twin_runtime_checkpoint_v1");
  assert.equal(checkpoint.payload.checkpoint_kind, expected.checkpoint_kind);
  assert.equal(checkpoint.payload.tick_sequence, expected.checkpoint_tick_sequence);
  assert.equal(checkpoint.payload.next_tick_logical_time, expected.next_tick_logical_time);
  assert.equal(checkpoint.payload.successful_forecast_ref, null);
  ok("BLOCKED Forecast and continuation checkpoint are exact and successful-Forecast remains absent");

  assert.equal(first.next_handoff.previous_posterior_ref, state.object_id);
  assert.equal(first.next_handoff.previous_checkpoint_ref, checkpoint.object_id);
  assert.equal(first.next_handoff.previous_forecast_result_ref, forecast.object_id);
  assert.equal(first.next_handoff.next_logical_tick_time, expected.next_tick_logical_time);
  assert.equal(first.next_handoff.previous_variance_basis.basis_origin, expected.next_handoff_basis_origin);
  assert.equal(first.next_handoff.previous_storage_mm_decimal, expected.storage_mean_mm);
  assert.equal(runtime.leaseAcquireCount, 1);
  assert.equal(runtime.commitCount, 1);
  ok("canonical readback prepares the exact persisted T+1 handoff with carried computation basis");

  const replay = await service.executeOneTick(request);
  assert.equal(replay.status, expected.idempotent_replay_status);
  assert.equal(replay.record_set.continuation_record_set_determinism_hash, first.record_set.continuation_record_set_determinism_hash);
  assert.equal(runtime.leaseAcquireCount, 1);
  assert.equal(runtime.commitCount, 1);
  assert.equal(replay.evidence_window, null);
  assert.equal(replay.dynamics, null);
  ok("same requested operation returns complete existing success before Evidence, lease, facts, or projections");

  const secondRuntime = new InMemorySingleTickRuntimeV1({
    snapshot: fixture.initialSnapshot,
    configs: [fixture.parentRuntimeConfig, fixture.continuationRuntimeConfig],
    candidate_records: fixture.evidenceFixture.candidate_records,
  });
  const secondService = new ContinuationTickServiceV1(
    new PrepareNextTickInputServiceV1(secondRuntime),
    secondRuntime,
    secondRuntime,
    secondRuntime,
  );
  const rerun = await secondService.executeOneTick(request);
  assert.equal(rerun.record_set.continuation_record_set_determinism_hash, first.record_set.continuation_record_set_determinism_hash);
  assert.deepEqual(rerun.record_set, first.record_set);
  ok("independent standard single-tick rerun is byte-equivalent at the canonical record-set boundary");

  console.log(`MCFT-CAP-02 single-tick: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
