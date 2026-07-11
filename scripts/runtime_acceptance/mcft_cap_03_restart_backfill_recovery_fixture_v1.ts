// scripts/runtime_acceptance/mcft_cap_03_restart_backfill_recovery_fixture_v1.ts
// Purpose: assemble deterministic uninterrupted, restarted, and bounded-forward-backfill CAP-03 executions over the verified S5 observation-aware range.
// Boundary: acceptance support only; no production database, route, scheduler, successful Forecast, late-Evidence revision, Recommendation, Decision, action, calibration, or model activation.

import {
  AssimilatedContiguousRangeServiceV1,
  type RunAssimilatedContiguousRangeInputV1,
  type RunAssimilatedContiguousRangeResultV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v1.js";
import {
  AssimilatedContinuationTickServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v1.js";
import {
  AssimilatedRestartResumeServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_restart_resume_service_v1.js";
import {
  PrepareNextTickInputServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import {
  buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1,
  S5_FIRST_LOGICAL_TIME_V1,
  S5_LAST_LOGICAL_TIME_V1,
  S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
  S5_STANDARD_TICK_COUNT_V1,
} from "./mcft_cap_03_twenty_four_observation_aware_tick_range_fixture_v1.js";

export const S6_PROCESS_1_LAST_LOGICAL_TIME_V1 =
  "2026-06-02T13:00:00.000Z";

export const S6_FRESH_PROCESS_FIRST_LOGICAL_TIME_V1 =
  "2026-06-02T14:00:00.000Z";

export const S6_PROCESS_1_TICK_COUNT_V1 = 12;
export const S6_FRESH_PROCESS_TICK_COUNT_V1 = 12;

export function recordSetHashesV1(
  result: RunAssimilatedContiguousRangeResultV1,
): string[] {
  return result.tick_results.map(
    (tickResult) =>
      tickResult.record_set
        .continuation_record_set_determinism_hash,
  );
}

function buildFreshProcessServicesV1(
  fixture: Awaited<
    ReturnType<
      typeof buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1
    >
  >,
) {
  const handoffService =
    new PrepareNextTickInputServiceV1(
      fixture.runtime,
    );

  const tickService =
    new AssimilatedContinuationTickServiceV1(
      handoffService,
      fixture.evidenceSource,
      fixture.runtime,
      fixture.runtime,
    );

  const rangeService =
    new AssimilatedContiguousRangeServiceV1(
      handoffService,
      tickService,
    );

  const restartService =
    new AssimilatedRestartResumeServiceV1(
      handoffService,
      rangeService,
    );

  return {
    handoffService,
    tickService,
    rangeService,
    restartService,
  };
}

function process1InputV1(
  input: RunAssimilatedContiguousRangeInputV1,
  leaseOwner: string,
): RunAssimilatedContiguousRangeInputV1 {
  return {
    ...input,
    to_logical_time:
      S6_PROCESS_1_LAST_LOGICAL_TIME_V1,
    lease_owner: leaseOwner,
  };
}

function process2InputV1(
  input: RunAssimilatedContiguousRangeInputV1,
  leaseOwner: string,
): RunAssimilatedContiguousRangeInputV1 {
  return {
    ...input,
    to_logical_time: S5_LAST_LOGICAL_TIME_V1,
    lease_owner: leaseOwner,
  };
}

export async function
buildMcftCap03RestartBackfillRecoveryFixtureV1() {
  const uninterruptedFixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

  const uninterruptedResult =
    await uninterruptedFixture.rangeService
      .runAssimilatedContiguousRangeV1(
        uninterruptedFixture.rangeInput,
      );

  const restartedFixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

  const restartedProcess1Input = process1InputV1(
    restartedFixture.rangeInput,
    "mcft-cap-03-s6-restart-process-1",
  );

  const restartedProcess1Result =
    await restartedFixture.rangeService
      .runAssimilatedContiguousRangeV1(
        restartedProcess1Input,
      );

  const restartedFreshProcess =
    buildFreshProcessServicesV1(
      restartedFixture,
    );

  const restartedProcess2Input = process2InputV1(
    restartedFixture.rangeInput,
    "mcft-cap-03-s6-restart-process-2",
  );

  const restartedResumeResult =
    await restartedFreshProcess.restartService
      .resumeAssimilatedFromCheckpointV1(
        restartedProcess2Input,
      );

  const backfillFixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

  const backfillPrefixInput = process1InputV1(
    backfillFixture.rangeInput,
    "mcft-cap-03-s6-backfill-prefix",
  );

  const backfillPrefixResult =
    await backfillFixture.rangeService
      .runAssimilatedContiguousRangeV1(
        backfillPrefixInput,
      );

  const backfillFreshProcess =
    buildFreshProcessServicesV1(
      backfillFixture,
    );

  const backfillResult =
    await backfillFreshProcess.restartService
      .runAssimilatedBoundedBackfillV1({
        ...process2InputV1(
          backfillFixture.rangeInput,
          "mcft-cap-03-s6-bounded-backfill",
        ),
        evidence_intent:
          "MISSED_SCHEDULE_CATCH_UP",
        requested_start_logical_time:
          S6_FRESH_PROCESS_FIRST_LOGICAL_TIME_V1,
      });

  return {
    uninterruptedFixture,
    uninterruptedResult,
    restartedFixture,
    restartedProcess1Input,
    restartedProcess1Result,
    restartedFreshProcess,
    restartedProcess2Input,
    restartedResumeResult,
    backfillFixture,
    backfillPrefixInput,
    backfillPrefixResult,
    backfillFreshProcess,
    backfillResult,
    firstLogicalTime:
      S5_FIRST_LOGICAL_TIME_V1,
    process1LastLogicalTime:
      S6_PROCESS_1_LAST_LOGICAL_TIME_V1,
    freshProcessFirstLogicalTime:
      S6_FRESH_PROCESS_FIRST_LOGICAL_TIME_V1,
    lastLogicalTime:
      S5_LAST_LOGICAL_TIME_V1,
    nextHandoffLogicalTime:
      S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
    totalTickCount:
      S5_STANDARD_TICK_COUNT_V1,
    process1TickCount:
      S6_PROCESS_1_TICK_COUNT_V1,
    freshProcessTickCount:
      S6_FRESH_PROCESS_TICK_COUNT_V1,
  };
}
