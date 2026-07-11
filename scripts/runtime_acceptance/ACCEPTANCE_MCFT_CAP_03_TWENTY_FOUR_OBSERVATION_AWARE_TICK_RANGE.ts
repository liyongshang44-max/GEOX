// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.ts
// Purpose: prove the standard S5 Replay path executes 24 contiguous observation-aware ticks, commits 192 canonical A2 facts, preserves blocked Forecast, produces checkpoint sequence 25..48, and supports deterministic and idempotent completed-range replay.
// Boundary: in-memory positive acceptance only; independent negative and alternate-observation fixtures remain separate; no database, restart/backfill, route, scheduler, successful Forecast, Recommendation, Decision, action, calibration, or model activation.

import assert from "node:assert/strict";
import {
  validateAssimilatedContinuationCrossReferencesV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v1.js";
import type {
  CanonicalObjectEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  memberV1,
} from "./mcft_cap_03_single_tick_integration_fixture_v1.js";
import {
  buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1,
  S5_FIRST_LOGICAL_TIME_V1,
  S5_LAST_LOGICAL_TIME_V1,
  S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
  S5_STANDARD_TICK_COUNT_V1,
} from "./mcft_cap_03_twenty_four_observation_aware_tick_range_fixture_v1.js";

const HOUR_MS_V1 = 60 * 60 * 1000;

let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function addHoursV1(
  value: string,
  hours: number,
): string {
  return new Date(
    Date.parse(value) + hours * HOUR_MS_V1,
  ).toISOString();
}

function requiredRecordV1(
  value: unknown,
  code: string,
): Record<string, unknown> {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    throw new Error(code);
  }

  return value as Record<string, unknown>;
}

function memberPayloadV1(
  member: CanonicalObjectEnvelopeV1,
): Record<string, unknown> {
  return requiredRecordV1(
    member.payload,
    `S5_ACCEPTANCE_MEMBER_PAYLOAD_REQUIRED:${member.object_type}`,
  );
}

async function main(): Promise<void> {
  const fixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

  assert.equal(
    fixture.scenario,
    "STANDARD_PASS_RANGE",
  );
  assert.equal(
    fixture.runtimeConfigChain.length,
    S5_STANDARD_TICK_COUNT_V1,
  );
  assert.equal(
    Object.keys(
      fixture.runtimeConfigRefsByLogicalTime,
    ).length,
    S5_STANDARD_TICK_COUNT_V1,
  );
  ok("standard fixture contains one immutable Runtime Config for each of 24 logical ticks");

  for (
    let index = 0;
    index < fixture.runtimeConfigChain.length;
    index += 1
  ) {
    const config =
      fixture.runtimeConfigChain[index];

    const payload = memberPayloadV1(config);

    const expectedLogicalTime = addHoursV1(
      S5_FIRST_LOGICAL_TIME_V1,
      index,
    );

    const expectedParent =
      index === 0
        ? fixture.continuationRuntimeConfig.object_id
        : fixture.runtimeConfigChain[index - 1].object_id;

    const expectedParentHash =
      index === 0
        ? fixture.continuationRuntimeConfig.determinism_hash
        : fixture.runtimeConfigChain[index - 1]
          .determinism_hash;

    assert.equal(
      config.logical_time,
      expectedLogicalTime,
    );
    assert.equal(
      payload.parent_runtime_config_ref,
      expectedParent,
    );
    assert.equal(
      payload.parent_runtime_config_hash,
      expectedParentHash,
    );
    assert.equal(
      payload.active_model_parameter_change,
      "FORBIDDEN",
    );
  }
  ok("Runtime Config chain follows prior-State authority without active parameter change");

  const result =
    await fixture.rangeService
      .runAssimilatedContiguousRangeV1(
        fixture.rangeInput,
      );

  assert.equal(result.status, "COMPLETED");
  assert.equal(
    result.executed_tick_count,
    S5_STANDARD_TICK_COUNT_V1,
  );
  assert.equal(
    result.tick_results.length,
    S5_STANDARD_TICK_COUNT_V1,
  );
  assert.equal(
    result.persisted_start_logical_time,
    S5_FIRST_LOGICAL_TIME_V1,
  );
  assert.equal(
    result.requested_target_logical_time,
    S5_LAST_LOGICAL_TIME_V1,
  );
  ok("range executes exactly 24 UTC-hour-aligned ticks from persisted handoff");

  const stateIds = new Set<string>();
  const updateIds = new Set<string>();
  const recordSetHashes: string[] = [];

  let expectedPreviousStateRef =
    fixture.predecessorState.object_id;

  for (
    let index = 0;
    index < result.tick_results.length;
    index += 1
  ) {
    const tickResult = result.tick_results[index];
    const expectedLogicalTime = addHoursV1(
      S5_FIRST_LOGICAL_TIME_V1,
      index,
    );
    const expectedNextLogicalTime = addHoursV1(
      expectedLogicalTime,
      1,
    );
    const expectedSequence = 25 + index;
    const expectedObservationRef =
      `soil_cap03_s5_${String(index + 1).padStart(2, "0")}_pass`;

    assert.equal(tickResult.status, "INSERTED");
    assert.ok(tickResult.dynamics);
    assert.ok(tickResult.evidence_window);
    assert.ok(tickResult.assimilation);

    validateAssimilatedContinuationCrossReferencesV1(
      tickResult.record_set,
    );

    assert.equal(
      tickResult.record_set.members.length,
      8,
    );

    const evidence = memberV1(
      tickResult.record_set,
      "twin_evidence_window_v1",
    );
    const update = memberV1(
      tickResult.record_set,
      "twin_assimilation_update_v1",
    );
    const state = memberV1(
      tickResult.record_set,
      "twin_state_estimate_v1",
    );
    const forecast = memberV1(
      tickResult.record_set,
      "twin_forecast_run_v1",
    );
    const tick = memberV1(
      tickResult.record_set,
      "twin_runtime_tick_v1",
    );
    const checkpoint = memberV1(
      tickResult.record_set,
      "twin_runtime_checkpoint_v1",
    );

    const evidencePayload =
      memberPayloadV1(evidence);
    const updatePayload =
      memberPayloadV1(update);
    const statePayload =
      memberPayloadV1(state);
    const forecastPayload =
      memberPayloadV1(forecast);
    const tickPayload =
      memberPayloadV1(tick);
    const checkpointPayload =
      memberPayloadV1(checkpoint);

    assert.equal(
      tickResult.assimilation.status,
      "APPLIED",
    );
    assert.equal(
      tickResult.assimilation.disposition,
      "ACCEPTED",
    );
    assert.equal(
      tickResult.assimilation.selected_observation_ref,
      expectedObservationRef,
    );
    assert.deepEqual(
      tickResult.assimilation.applied_observation_refs,
      [expectedObservationRef],
    );
    assert.deepEqual(
      tickResult.assimilation.consumed_observation_refs,
      [expectedObservationRef],
    );

    assert.equal(
      updatePayload.status,
      "APPLIED",
    );
    assert.equal(
      updatePayload.disposition,
      "ACCEPTED",
    );
    assert.equal(
      updatePayload.selected_observation_ref,
      expectedObservationRef,
    );

    const consumedEvidenceRefs =
      evidencePayload.consumed_evidence_refs;

    assert.ok(
      Array.isArray(consumedEvidenceRefs),
    );
    assert.ok(
      consumedEvidenceRefs.includes(
        expectedObservationRef,
      ),
    );

    assert.equal(
      state.logical_time,
      expectedLogicalTime,
    );
    assert.equal(
      statePayload.previous_posterior_ref,
      expectedPreviousStateRef,
    );
    assert.equal(
      state.runtime_config_ref,
      fixture.runtimeConfigChain[index].object_id,
    );
    assert.equal(
      state.runtime_config_hash,
      fixture.runtimeConfigChain[index]
        .determinism_hash,
    );

    assert.equal(
      forecastPayload.status,
      "BLOCKED",
    );
    assert.deepEqual(
      forecastPayload.points,
      [],
    );
    assert.equal(
      forecastPayload.successful_forecast_ref,
      null,
    );

    assert.equal(
      tickPayload.record_set_contract_id,
      "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1",
    );
    assert.equal(
      checkpointPayload.tick_sequence,
      expectedSequence,
    );
    assert.equal(
      checkpointPayload.next_tick_logical_time,
      expectedNextLogicalTime,
    );

    assert.equal(
      tickResult.next_handoff.previous_tick_sequence,
      expectedSequence,
    );
    assert.equal(
      tickResult.next_handoff.next_logical_tick_time,
      expectedNextLogicalTime,
    );
    assert.equal(
      tickResult.next_handoff.previous_posterior_ref,
      state.object_id,
    );
    assert.equal(
      tickResult.next_handoff.previous_checkpoint_ref,
      checkpoint.object_id,
    );
    assert.equal(
      tickResult.next_handoff.previous_forecast_result_ref,
      forecast.object_id,
    );

    stateIds.add(state.object_id);
    updateIds.add(update.object_id);
    recordSetHashes.push(
      tickResult.record_set
        .continuation_record_set_determinism_hash,
    );

    expectedPreviousStateRef = state.object_id;
  }

  ok("all 24 ticks commit valid eight-member CAP-03 A2 record sets");
  ok("all 24 PASS observations are selected, applied, accepted, and consumed");
  ok("posterior State chain preserves exact predecessor linkage across 24 ticks");
  ok("all 24 Forecast members remain BLOCKED with no successful Forecast pointer");
  ok("checkpoint and handoff sequence is contiguous from 25 through 48");

  assert.equal(stateIds.size, 24);
  assert.equal(updateIds.size, 24);
  assert.equal(
    result.tick_results.reduce(
      (count, tickResult) =>
        count + tickResult.record_set.members.length,
      0,
    ),
    192,
  );
  assert.equal(
    stateIds.size + 1,
    25,
  );
  ok("range produces 192 new A2 facts, 24 posterior States, 24 updates, and a local predecessor-inclusive 25-State chain");

  assert.equal(
    result.final_handoff.previous_tick_sequence,
    48,
  );
  assert.equal(
    result.final_handoff.next_logical_tick_time,
    S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
  );
  assert.equal(fixture.runtime.leaseAcquireCount, 24);
  assert.equal(fixture.runtime.commitCount, 24);
  assert.equal(fixture.runtime.readbackCount, 24);
  ok("final canonical readback exposes checkpoint 48 and the frozen T+1 handoff");

  const beforeReplay = {
    lease: fixture.runtime.leaseAcquireCount,
    commit: fixture.runtime.commitCount,
    readback: fixture.runtime.readbackCount,
  };

  const completedReplay =
    await fixture.rangeService
      .runAssimilatedContiguousRangeV1(
        fixture.rangeInput,
      );

  const afterReplay = {
    lease: fixture.runtime.leaseAcquireCount,
    commit: fixture.runtime.commitCount,
    readback: fixture.runtime.readbackCount,
  };

  assert.equal(
    completedReplay.status,
    "ALREADY_COMPLETE",
  );
  assert.equal(
    completedReplay.executed_tick_count,
    0,
  );
  assert.deepEqual(
    completedReplay.tick_results,
    [],
  );
  assert.deepEqual(
    afterReplay,
    beforeReplay,
  );
  assert.equal(
    completedReplay.final_handoff
      .previous_tick_sequence,
    48,
  );
  assert.equal(
    completedReplay.final_handoff
      .next_logical_tick_time,
    S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
  );
  ok("completed-range replay returns zero new ticks without Evidence, lease, write, or readback");

  const deterministicFixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

  const deterministicResult =
    await deterministicFixture.rangeService
      .runAssimilatedContiguousRangeV1(
        deterministicFixture.rangeInput,
      );

  assert.equal(
    deterministicResult.status,
    "COMPLETED",
  );

  const deterministicHashes =
    deterministicResult.tick_results.map(
      (tickResult) =>
        tickResult.record_set
          .continuation_record_set_determinism_hash,
    );

  assert.deepEqual(
    deterministicHashes,
    recordSetHashes,
  );
  ok("independent same-input execution reproduces all 24 canonical record-set hashes");

  console.log(
    `MCFT-CAP-03 twenty-four observation-aware tick range: ${pass} PASS, 0 FAIL`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
