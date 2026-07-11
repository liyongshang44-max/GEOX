// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_SINGLE_TICK_INTEGRATION.ts
// Purpose: prove one explicit CAP-03 Replay tick composes persisted handoff, exact-hour Dynamics, observation assimilation, posterior A2 commit, canonical readback, T+1 handoff, and idempotent replay.
// Boundary: in-memory single-tick acceptance only; no database, range, restart/backfill, route, scheduler, successful Forecast, Recommendation, Decision, or action.

import assert from "node:assert/strict";
import { validateAssimilatedContinuationCrossReferencesV1 } from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v1.js";
import { AssimilatedContinuationTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import {
  buildMcftCap03SingleTickIntegrationFixtureV1,
  memberV1,
} from "./mcft_cap_03_single_tick_integration_fixture_v1.js";

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap03SingleTickIntegrationFixtureV1();
  const handoff = new PrepareNextTickInputServiceV1(fixture.runtime);
  const service = new AssimilatedContinuationTickServiceV1(
    handoff,
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
    lease_owner: "mcft-cap-03-s4-in-memory",
    lease_duration_seconds: 300,
  };

  const result = await service.executeOneTick(input);
  assert.equal(result.status, "INSERTED");
  validateAssimilatedContinuationCrossReferencesV1(result.record_set);
  assert.equal(result.record_set.members.length, 8);
  ok("one service call commits one valid eight-object CAP-03 A2 record set");

  assert.ok(result.dynamics);
  assert.equal(result.dynamics.computation_basis.storage_mean_mm_decimal.value, "57.727512");
  assert.equal(
    result.dynamics.computation_basis.storage_variance_mm2_decimal.value,
    "241.520029261250",
  );
  ok("exact-hour Dynamics runs before assimilation with frozen propagated prior values");

  assert.ok(result.assimilation);
  assert.equal(result.assimilation.status, "APPLIED");
  assert.equal(result.assimilation.disposition, "ACCEPTED");
  assert.equal(result.assimilation.selected_observation_ref, fixture.observation.source_record_id);
  assert.equal(result.assimilation.innovation, result.assimilation.residual);
  ok("PASS observation is selected and innovation equals State-observation residual");

  assert.equal(
    result.assimilation.canonical_decimal_basis.posterior_vwc_decimal.value,
    "0.189242984208",
  );
  assert.equal(
    result.assimilation.canonical_decimal_basis.posterior_vwc_variance_decimal.value,
    "0.001606064753",
  );
  assert.equal(
    result.assimilation.canonical_decimal_basis.storage_mean_mm_decimal.value,
    "56.772895",
  );
  assert.equal(
    result.assimilation.canonical_decimal_basis.storage_variance_mm2_decimal.value,
    "144.545827754111",
  );
  ok("standard tick publishes repository-owned canonical posterior exact values");

  const evidence = memberV1(result.record_set, "twin_evidence_window_v1");
  const state = memberV1(result.record_set, "twin_state_estimate_v1");
  const forecast = memberV1(result.record_set, "twin_forecast_run_v1");
  const checkpoint = memberV1(result.record_set, "twin_runtime_checkpoint_v1");
  const tick = memberV1(result.record_set, "twin_runtime_tick_v1");
  assert.ok((evidence.payload.consumed_evidence_refs as string[]).includes(fixture.observation.source_record_id));
  ok("accepted observation enters the canonical consumed Evidence union");

  const stateVwc = state.payload.root_zone_vwc_fraction as Record<string, unknown>;
  assert.equal(stateVwc.mean, 0.189242984208);
  assert.equal(stateVwc.variance, 0.001606064753);
  assert.equal(state.payload.previous_posterior_ref, fixture.predecessorState.object_id);
  ok("posterior State preserves predecessor authority and publishes corrected moments");

  assert.equal(forecast.payload.status, "BLOCKED");
  assert.deepEqual(forecast.payload.points, []);
  assert.equal(forecast.payload.successful_forecast_ref, null);
  assert.equal(tick.payload.record_set_contract_id, "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1");
  ok("Forecast remains blocked and Tick carries the CAP-03 record-set discriminator");

  assert.equal(checkpoint.payload.tick_sequence, 25);
  assert.equal(checkpoint.payload.next_tick_logical_time, fixture.nextLogicalTime);
  assert.equal(result.next_handoff.previous_tick_sequence, 25);
  assert.equal(result.next_handoff.next_logical_tick_time, fixture.nextLogicalTime);
  assert.equal(result.next_handoff.previous_posterior_ref, state.object_id);
  assert.equal(result.next_handoff.previous_checkpoint_ref, checkpoint.object_id);
  assert.equal(result.next_handoff.previous_forecast_result_ref, forecast.object_id);
  assert.equal(result.next_handoff.previous_forecast_result_hash, forecast.determinism_hash);
  ok("canonical readback produces the exact checkpoint-25 T+1 handoff including Forecast hash");

  assert.equal(fixture.runtime.leaseAcquireCount, 1);
  assert.equal(fixture.runtime.commitCount, 1);
  assert.equal(fixture.runtime.readbackCount, 1);
  ok("new-key path acquires one lease, commits once, and performs canonical readback");

  const replay = await service.executeOneTick(input);
  assert.equal(replay.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(
    replay.record_set.continuation_record_set_determinism_hash,
    result.record_set.continuation_record_set_determinism_hash,
  );
  assert.equal(fixture.runtime.leaseAcquireCount, 1);
  assert.equal(fixture.runtime.commitCount, 1);
  assert.equal(fixture.runtime.readbackCount, 1);
  assert.equal(replay.evidence_window, null);
  assert.equal(replay.dynamics, null);
  assert.equal(replay.assimilation, null);
  ok("same tick replay returns existing success before Evidence, lease, write, or readback");

  console.log(`MCFT-CAP-03 single-tick integration: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
