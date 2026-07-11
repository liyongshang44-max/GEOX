// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_NEGATIVE.ts
// Purpose: prove the S5 range orchestrator rejects invalid range inputs, stops on first failure, and independently preserves LIMITED, no-observation, outlier-rejection, and candidate-exclusion semantics.
// Boundary: in-memory negative and independent semantic acceptance only; no database, restart/backfill, route, scheduler, successful Forecast, Recommendation, Decision, action, calibration, or model activation.

import assert from "node:assert/strict";
import {
  CONTINUATION_OPERATION_VARIANT_V1,
  deriveContinuationOperationIdentityV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_operation_identity_v1.js";
import type {
  CanonicalObjectEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type {
  AssimilatedContinuationRecordSetV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v1.js";
import {
  buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1,
  S5_FIRST_LOGICAL_TIME_V1,
  S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
  type S5ObservationScenarioV1,
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

async function rejectedErrorV1(
  operation: () => Promise<unknown>,
): Promise<Error> {
  let caught: unknown = null;

  try {
    await operation();
  } catch (error) {
    caught = error;
  }

  assert.ok(
    caught instanceof Error,
    "S5_NEGATIVE_EXPECTED_REJECTION",
  );

  assert.ok(
    caught.message.length > 0,
    "S5_NEGATIVE_ERROR_MESSAGE_REQUIRED",
  );

  return caught;
}

function assertNoA2ExecutionV1(
  fixture: Awaited<
    ReturnType<
      typeof buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1
    >
  >,
): void {
  assert.equal(
    fixture.runtime.leaseAcquireCount,
    0,
  );

  assert.equal(
    fixture.runtime.commitCount,
    0,
  );

  assert.equal(
    fixture.runtime.readbackCount,
    0,
  );
}

function memberV1(
  recordSet: AssimilatedContinuationRecordSetV1,
  objectType: CanonicalObjectEnvelopeV1["object_type"],
): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter(
    (member) => member.object_type === objectType,
  );

  assert.equal(
    matches.length,
    1,
    `S5_NEGATIVE_MEMBER_CARDINALITY:${objectType}`,
  );

  return matches[0];
}

async function executeIndependentScenarioV1(
  scenario: Exclude<
    S5ObservationScenarioV1,
    "STANDARD_PASS_RANGE"
  >,
): Promise<{
  fixture: Awaited<
    ReturnType<
      typeof buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1
    >
  >;
  recordSet: AssimilatedContinuationRecordSetV1;
  assimilation: CanonicalObjectEnvelopeV1;
}> {
  const fixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1(
      scenario,
    );

  const result =
    await fixture.rangeService
      .runAssimilatedContiguousRangeV1(
        fixture.rangeInput,
      );

  assert.equal(
    result.executed_tick_count,
    1,
  );

  assert.equal(
    fixture.runtime.leaseAcquireCount,
    1,
  );

  assert.equal(
    fixture.runtime.commitCount,
    1,
  );

  assert.equal(
    fixture.runtime.readbackCount,
    1,
  );

  const operationIdentity =
    deriveContinuationOperationIdentityV1({
      scope: fixture.scope,
      lineage_id:
        fixture.cap03Lock.canonical_identity.lineage_id,
      revision_id:
        fixture.cap03Lock.canonical_identity.revision_id,
      logical_time: S5_FIRST_LOGICAL_TIME_V1,
      operation_variant:
        CONTINUATION_OPERATION_VARIANT_V1,
    });

  const recordSet =
    await fixture.runtime
      .readAssimilatedContinuationRecordSet(
        operationIdentity
          .continuation_record_set_id,
      );

  assert.ok(
    recordSet,
    `S5_NEGATIVE_RECORD_SET_REQUIRED:${scenario}`,
  );

  const assimilation = memberV1(
    recordSet,
    "twin_assimilation_update_v1",
  );

  return {
    fixture,
    recordSet,
    assimilation,
  };
}

async function main(): Promise<void> {
  {
    const fixture =
      await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

    const error = await rejectedErrorV1(
      () =>
        fixture.rangeService
          .runAssimilatedContiguousRangeV1({
            ...fixture.rangeInput,
            to_logical_time:
              "2026-06-03T01:30:00.000Z",
          }),
    );

    assert.match(
      error.message,
      /ASSIMILATED_RANGE_/,
    );

    assertNoA2ExecutionV1(fixture);

    ok("non-hour-aligned target is rejected before any A2 execution");
  }

  {
    const fixture =
      await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

    const twentyFifthLogicalTime =
      S5_NEXT_HANDOFF_LOGICAL_TIME_V1;

    const overMaximumConfigRefs = {
      ...fixture
        .rangeInput
        .assimilated_runtime_config_refs_by_logical_time,
      [twentyFifthLogicalTime]:
        fixture.runtimeConfigChain[
          fixture.runtimeConfigChain.length - 1
        ].object_id,
    };

    const error = await rejectedErrorV1(
      () =>
        fixture.rangeService
          .runAssimilatedContiguousRangeV1({
            ...fixture.rangeInput,
            to_logical_time:
              twentyFifthLogicalTime,
            assimilated_runtime_config_refs_by_logical_time:
              overMaximumConfigRefs,
          }),
    );

    assert.match(
      error.message,
      /ASSIMILATED_RANGE_/,
    );

    assertNoA2ExecutionV1(fixture);

    ok("a 25-tick invocation is rejected before any A2 execution");
  }

  {
    const fixture =
      await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

    const error = await rejectedErrorV1(
      () =>
        fixture.rangeService
          .runAssimilatedContiguousRangeV1({
            ...fixture.rangeInput,
            created_at: "not-an-iso-time",
          }),
    );

    assert.match(
      error.message,
      /ASSIMILATED_RANGE_/,
    );

    assertNoA2ExecutionV1(fixture);

    ok("invalid created_at authority is rejected before any A2 execution");
  }

  {
    const fixture =
      await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

    const error = await rejectedErrorV1(
      () =>
        fixture.rangeService
          .runAssimilatedContiguousRangeV1({
            ...fixture.rangeInput,
            lease_owner: " ",
          }),
    );

    assert.match(
      error.message,
      /ASSIMILATED_RANGE_/,
    );

    assertNoA2ExecutionV1(fixture);

    ok("blank lease owner is rejected before any A2 execution");
  }

  {
    const fixture =
      await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

    const error = await rejectedErrorV1(
      () =>
        fixture.rangeService
          .runAssimilatedContiguousRangeV1({
            ...fixture.rangeInput,
            lease_duration_seconds: 0,
          }),
    );

    assert.match(
      error.message,
      /ASSIMILATED_RANGE_/,
    );

    assertNoA2ExecutionV1(fixture);

    ok("non-positive lease duration is rejected before any A2 execution");
  }

  {
    const fixture =
      await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

    const incompleteConfigRefs =
      Object.fromEntries(
        Object.entries(
          fixture
            .rangeInput
            .assimilated_runtime_config_refs_by_logical_time,
        ).filter(
          ([logicalTime]) =>
            logicalTime !== S5_FIRST_LOGICAL_TIME_V1,
        ),
      );

    const error = await rejectedErrorV1(
      () =>
        fixture.rangeService
          .runAssimilatedContiguousRangeV1({
            ...fixture.rangeInput,
            assimilated_runtime_config_refs_by_logical_time:
              incompleteConfigRefs,
          }),
    );

    assert.match(
      error.message,
      /ASSIMILATED_RANGE_/,
    );

    assertNoA2ExecutionV1(fixture);

    ok("incomplete per-tick Runtime Config authority is rejected without partial execution");
  }

  {
    const fixture =
      await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

    const snapshot =
      fixture.runtime.currentSnapshotV1();

    fixture.runtime.replaceSnapshotV1({
      ...snapshot,
      checkpoint: {
        ...snapshot.checkpoint,
        payload: {
          ...snapshot.checkpoint.payload,
          next_tick_logical_time:
            snapshot.checkpoint.logical_time,
        },
      },
    });

    const error = await rejectedErrorV1(
      () =>
        fixture.rangeService
          .runAssimilatedContiguousRangeV1(
            fixture.rangeInput,
          ),
    );

    assert.match(
      error.message,
      /NEXT_LOGICAL_TICK_TIME_INVALID/,
    );

    assertNoA2ExecutionV1(fixture);

    ok("malformed persisted non-T+1 handoff is rejected before any A2 execution");
  }

  {
    const fixture =
      await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

    const secondLogicalTime =
      addHoursV1(
        S5_FIRST_LOGICAL_TIME_V1,
        1,
      );

    const configRefsWithMissingSecondObject = {
      ...fixture
        .rangeInput
        .assimilated_runtime_config_refs_by_logical_time,
      [secondLogicalTime]:
        "missing_runtime_config_cap03_s5_negative",
    };

    const error = await rejectedErrorV1(
      () =>
        fixture.rangeService
          .runAssimilatedContiguousRangeV1({
            ...fixture.rangeInput,
            to_logical_time:
              secondLogicalTime,
            assimilated_runtime_config_refs_by_logical_time:
              configRefsWithMissingSecondObject,
          }),
    );

    assert.match(
      error.message,
      /ASSIMILATED_RUNTIME_CONFIG_NOT_FOUND/,
    );

    assert.equal(
      fixture.runtime.leaseAcquireCount,
      1,
    );

    assert.equal(
      fixture.runtime.commitCount,
      1,
    );

    assert.equal(
      fixture.runtime.readbackCount,
      1,
    );

    const terminalSnapshot =
      fixture.runtime.currentSnapshotV1();

    assert.equal(
      terminalSnapshot
        .checkpoint
        .payload
        .tick_sequence,
      25,
    );

    assert.equal(
      terminalSnapshot
        .checkpoint
        .payload
        .next_tick_logical_time,
      secondLogicalTime,
    );

    ok("range stops on the first failed tick and does not execute any later tick");
  }

  {
    const {
      assimilation,
    } = await executeIndependentScenarioV1(
      "LIMITED",
    );

    assert.equal(
      assimilation.payload.status,
      "APPLIED",
    );

    assert.equal(
      assimilation.payload.disposition,
      "DOWNWEIGHTED",
    );

    const candidates =
      assimilation.payload.candidate_observations;

    assert.ok(
      Array.isArray(candidates),
    );

    const selectedCandidates =
      candidates.filter(
        (candidate) =>
          candidate
          && typeof candidate === "object"
          && !Array.isArray(candidate)
          && Reflect.get(
            candidate,
            "candidate_assessment",
          ) === "SELECTED",
      );

    assert.equal(
      selectedCandidates.length,
      1,
    );

    assert.equal(
      Reflect.get(
        selectedCandidates[0],
        "quality_status",
      ),
      "LIMITED",
    );

    ok("LIMITED observation is applied with DOWNWEIGHTED disposition");
  }

  {
    const {
      assimilation,
    } = await executeIndependentScenarioV1(
      "NO_USABLE_OBSERVATION",
    );

    assert.equal(
      assimilation.payload.status,
      "NOT_APPLIED",
    );

    assert.equal(
      assimilation.payload.disposition,
      "NO_USABLE_OBSERVATION",
    );

    assert.equal(
      assimilation.payload.selected_observation_ref,
      null,
    );

    assert.deepEqual(
      assimilation.payload.applied_observation_refs,
      [],
    );

    assert.deepEqual(
      assimilation.payload.consumed_observation_refs,
      [],
    );

    ok("absence of usable observation produces NOT_APPLIED and NO_USABLE_OBSERVATION");
  }

  {
    const {
      assimilation,
    } = await executeIndependentScenarioV1(
      "OUTLIER_REJECTION",
    );

    assert.equal(
      assimilation.payload.status,
      "NOT_APPLIED",
    );

    assert.equal(
      assimilation.payload.disposition,
      "REJECTED_OUTLIER",
    );

    assert.equal(
      typeof assimilation
        .payload
        .selected_observation_ref,
      "string",
    );

    assert.deepEqual(
      assimilation.payload.applied_observation_refs,
      [],
    );

    assert.deepEqual(
      assimilation.payload.consumed_observation_refs,
      [],
    );

    assert.ok(
      typeof assimilation
        .payload
        .squared_normalized_innovation
        === "number",
    );

    assert.ok(
      Number(
        assimilation
          .payload
          .squared_normalized_innovation,
      ) > 16,
    );

    ok("innovation outlier is selected for evaluation but rejected without application or consumption");
  }

  {
    const {
      assimilation,
    } = await executeIndependentScenarioV1(
      "CANDIDATE_EXCLUSION",
    );

    assert.equal(
      assimilation.payload.status,
      "APPLIED",
    );

    assert.equal(
      assimilation.payload.disposition,
      "ACCEPTED",
    );

    const candidates =
      assimilation.payload.candidate_observations;

    assert.ok(
      Array.isArray(candidates),
    );

    const selectedCandidates =
      candidates.filter(
        (candidate) =>
          candidate
          && typeof candidate === "object"
          && !Array.isArray(candidate)
          && Reflect.get(
            candidate,
            "candidate_assessment",
          ) === "SELECTED",
      );

    const excludedCandidates =
      candidates.filter(
        (candidate) =>
          candidate
          && typeof candidate === "object"
          && !Array.isArray(candidate)
          && Reflect.get(
            candidate,
            "candidate_assessment",
          ) === "REJECTED_UNAUTHORIZED_BINDING",
      );

    assert.equal(
      selectedCandidates.length,
      1,
    );

    assert.equal(
      excludedCandidates.length,
      1,
    );

    const selectedRef = String(
      Reflect.get(
        selectedCandidates[0],
        "observation_ref",
      ),
    );

    const excludedRef = String(
      Reflect.get(
        excludedCandidates[0],
        "observation_ref",
      ),
    );

    assert.equal(
      assimilation.payload.selected_observation_ref,
      selectedRef,
    );

    assert.deepEqual(
      assimilation.payload.applied_observation_refs,
      [selectedRef],
    );

    assert.deepEqual(
      assimilation.payload.consumed_observation_refs,
      [selectedRef],
    );

    assert.equal(
      assimilation
        .payload
        .applied_observation_refs
        .includes(excludedRef),
      false,
    );

    assert.equal(
      assimilation
        .payload
        .consumed_observation_refs
        .includes(excludedRef),
      false,
    );

    ok("unauthorized candidate is excluded while the valid PASS candidate is selected and applied");
  }

  console.log(
    `MCFT-CAP-03 twenty-four observation-aware tick range negative: ${pass} PASS, 0 FAIL`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
