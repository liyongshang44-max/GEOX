// apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v2.ts
// Purpose: execute one explicit bounded CAP-03 observation-aware forward range by repeatedly invoking the verified assimilated single-tick service from persisted predecessor authority.
// Boundary: contiguous forward Replay range only; no CAP-02 range mutation, restart/backfill mode, scheduler, route, wall-clock logical time, successful Forecast, Scenario, Recommendation, Decision, action, calibration, or model activation.

import type {
  ExecuteAssimilatedContinuationTickInputV2,
  ExecuteAssimilatedContinuationTickResultV2,
} from "./assimilated_continuation_tick_service_v2.js";
import type {
  PreparedNextTickInputV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const MAX_ASSIMILATED_CONTIGUOUS_TICKS_V2 = 24;

export const ASSIMILATED_CONTINUATION_TICK_INTERVAL_MS_V2 =
  60 * 60 * 1000;

export type PrepareAssimilatedNextTickInputPortV2 = {
  prepareNextTickInput(
    scope: TwinScopeKeyV1,
  ): Promise<PreparedNextTickInputV1>;
};

export type ExecuteOneAssimilatedContinuationTickPortV2 = {
  executeOneTick(
    input: ExecuteAssimilatedContinuationTickInputV2,
  ): Promise<ExecuteAssimilatedContinuationTickResultV2>;
};

export type RunAssimilatedContiguousRangeInputV2 = {
  scope: TwinScopeKeyV1;
  to_logical_time: string;
  created_at: string;
  assimilated_runtime_config_refs_by_logical_time:
    Readonly<Record<string, string>>;
  crop_stage_context:
    ExecuteAssimilatedContinuationTickInputV2["crop_stage_context"];
  lease_owner: string;
  lease_duration_seconds: number;
};

export type RunAssimilatedContiguousRangeResultV2 = {
  status: "COMPLETED" | "ALREADY_COMPLETE";
  persisted_start_logical_time: string;
  requested_target_logical_time: string;
  executed_tick_count: number;
  tick_results: ExecuteAssimilatedContinuationTickResultV2[];
  final_handoff: PreparedNextTickInputV1;
};

function requiredCanonicalIsoV1(
  value: string,
  code: string,
): string {
  const parsed = Date.parse(value);

  if (
    !Number.isFinite(parsed)
    || new Date(parsed).toISOString() !== value
  ) {
    throw new Error(code);
  }

  return value;
}

function requiredHourAlignedIsoV1(
  value: string,
  code: string,
): string {
  const canonical = requiredCanonicalIsoV1(value, code);
  const date = new Date(canonical);

  if (
    date.getUTCMinutes() !== 0
    || date.getUTCSeconds() !== 0
    || date.getUTCMilliseconds() !== 0
  ) {
    throw new Error(code);
  }

  return canonical;
}

function requiredPositiveIntegerV1(
  value: number,
  code: string,
): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(code);
  }

  return value;
}

function requiredNonNegativeIntegerV1(
  value: number,
  code: string,
): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(code);
  }

  return value;
}

function addHoursV1(
  value: string,
  hours: number,
): string {
  return new Date(
    Date.parse(value)
      + hours * ASSIMILATED_CONTINUATION_TICK_INTERVAL_MS_V2,
  ).toISOString();
}

export class AssimilatedContiguousRangeServiceV2 {
  constructor(
    private readonly handoffService:
      PrepareAssimilatedNextTickInputPortV2,
    private readonly tickService:
      ExecuteOneAssimilatedContinuationTickPortV2,
  ) {}

  async runAssimilatedContiguousRangeV2(
    input: RunAssimilatedContiguousRangeInputV2,
  ): Promise<RunAssimilatedContiguousRangeResultV2> {
    const targetLogicalTime = requiredHourAlignedIsoV1(
      input.to_logical_time,
      "ASSIMILATED_RANGE_TARGET_NOT_CANONICAL_HOUR",
    );

    requiredCanonicalIsoV1(
      input.created_at,
      "ASSIMILATED_RANGE_CREATED_AT_INVALID",
    );

    if (!input.lease_owner.trim()) {
      throw new Error(
        "ASSIMILATED_RANGE_LEASE_OWNER_REQUIRED",
      );
    }

    requiredPositiveIntegerV1(
      input.lease_duration_seconds,
      "ASSIMILATED_RANGE_LEASE_DURATION_INVALID",
    );

    const initialHandoff =
      await this.handoffService.prepareNextTickInput(
        input.scope,
      );

    const persistedStartLogicalTime =
      requiredHourAlignedIsoV1(
        initialHandoff.next_logical_tick_time,
        "ASSIMILATED_PERSISTED_NEXT_TICK_NOT_CANONICAL_HOUR",
      );

    const initialSequence = requiredNonNegativeIntegerV1(
      initialHandoff.previous_tick_sequence,
      "ASSIMILATED_RANGE_INITIAL_SEQUENCE_INVALID",
    );

    const startMs = Date.parse(persistedStartLogicalTime);
    const targetMs = Date.parse(targetLogicalTime);

    if (targetMs < startMs) {
      return {
        status: "ALREADY_COMPLETE",
        persisted_start_logical_time:
          persistedStartLogicalTime,
        requested_target_logical_time:
          targetLogicalTime,
        executed_tick_count: 0,
        tick_results: [],
        final_handoff: initialHandoff,
      };
    }

    const intervalCount =
      (
        targetMs - startMs
      ) / ASSIMILATED_CONTINUATION_TICK_INTERVAL_MS_V2;

    if (!Number.isInteger(intervalCount)) {
      throw new Error(
        "ASSIMILATED_RANGE_TARGET_NOT_CONTIGUOUS_HOUR",
      );
    }

    const requestedTickCount = intervalCount + 1;

    if (
      requestedTickCount
      > MAX_ASSIMILATED_CONTIGUOUS_TICKS_V2
    ) {
      throw new Error(
        "ASSIMILATED_RANGE_MAX_TICKS_EXCEEDED",
      );
    }

    const runtimeConfigRefs: string[] = [];

    for (
      let index = 0;
      index < requestedTickCount;
      index += 1
    ) {
      const logicalTime = addHoursV1(
        persistedStartLogicalTime,
        index,
      );

      const runtimeConfigRef =
        input
          .assimilated_runtime_config_refs_by_logical_time[
            logicalTime
          ];

      if (
        typeof runtimeConfigRef !== "string"
        || !runtimeConfigRef.trim()
      ) {
        throw new Error(
          `ASSIMILATED_RANGE_RUNTIME_CONFIG_REF_REQUIRED:${logicalTime}`,
        );
      }

      runtimeConfigRefs.push(runtimeConfigRef);
    }

    const tickResults:
      ExecuteAssimilatedContinuationTickResultV2[] = [];

    let expectedLogicalTime = persistedStartLogicalTime;
    let finalHandoff = initialHandoff;

    for (
      let index = 0;
      index < requestedTickCount;
      index += 1
    ) {
      const result =
        await this.tickService.executeOneTick({
          scope: input.scope,
          logical_time: expectedLogicalTime,
          created_at: input.created_at,
          assimilated_runtime_config_ref:
            runtimeConfigRefs[index],
          crop_stage_context:
            input.crop_stage_context,
          lease_owner: input.lease_owner,
          lease_duration_seconds:
            input.lease_duration_seconds,
        });

      const expectedNextLogicalTime = addHoursV1(
        expectedLogicalTime,
        1,
      );

      const expectedCommittedSequence =
        initialSequence + index + 1;

      if (
        result.next_handoff.next_logical_tick_time
        !== expectedNextLogicalTime
      ) {
        throw new Error(
          "ASSIMILATED_RANGE_NONCONTIGUOUS_COMMITTED_HANDOFF",
        );
      }

      if (
        result.next_handoff.previous_tick_sequence
        !== expectedCommittedSequence
      ) {
        throw new Error(
          "ASSIMILATED_RANGE_NONCONTIGUOUS_COMMITTED_SEQUENCE",
        );
      }

      tickResults.push(result);
      finalHandoff = result.next_handoff;
      expectedLogicalTime = expectedNextLogicalTime;
    }

    if (tickResults.length !== requestedTickCount) {
      throw new Error(
        "ASSIMILATED_RANGE_EXECUTED_COUNT_MISMATCH",
      );
    }

    if (
      finalHandoff.next_logical_tick_time
      !== addHoursV1(targetLogicalTime, 1)
    ) {
      throw new Error(
        "ASSIMILATED_RANGE_FINAL_HANDOFF_MISMATCH",
      );
    }

    if (
      finalHandoff.previous_tick_sequence
      !== initialSequence + requestedTickCount
    ) {
      throw new Error(
        "ASSIMILATED_RANGE_FINAL_SEQUENCE_MISMATCH",
      );
    }

    return {
      status: "COMPLETED",
      persisted_start_logical_time:
        persistedStartLogicalTime,
      requested_target_logical_time:
        targetLogicalTime,
      executed_tick_count: tickResults.length,
      tick_results: tickResults,
      final_handoff: finalHandoff,
    };
  }
}
