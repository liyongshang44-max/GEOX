// apps/server/src/runtime/twin_runtime/contiguous_continuation_range_service_v1.ts
// Purpose: execute an explicit bounded forward continuation range by repeatedly invoking the verified single-tick application path from the persisted checkpoint.
// Boundary: contiguous forward range only; no restart mode, backfill intent, scheduler, wall clock, route, Forecast success, Scenario, Recommendation, Decision, or action.

import type { PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";
import type {
  ExecuteContinuationTickInputV1,
  ExecuteContinuationTickResultV1,
} from "./continuation_tick_service_v1.js";

export const MAX_CONTIGUOUS_CONTINUATION_TICKS_V1 = 24;
export const CONTINUATION_TICK_INTERVAL_MS_V1 = 60 * 60 * 1000;

export type PrepareNextTickInputPortV1 = {
  prepareNextTickInput(scope: TwinScopeKeyV1): Promise<PreparedNextTickInputV1>;
};

export type ExecuteOneContinuationTickPortV1 = {
  executeOneTick(input: ExecuteContinuationTickInputV1): Promise<ExecuteContinuationTickResultV1>;
};

export type RunContiguousContinuationRangeInputV1 = {
  scope: TwinScopeKeyV1;
  to_logical_time: string;
  created_at: string;
  continuation_runtime_config_ref: string;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  crop_stage_context: ExecuteContinuationTickInputV1["crop_stage_context"];
  lease_owner: string;
  lease_duration_seconds: number;
};

export type RunContiguousContinuationRangeResultV1 = {
  status: "COMPLETED" | "ALREADY_COMPLETE";
  persisted_start_logical_time: string;
  requested_target_logical_time: string;
  executed_tick_count: number;
  tick_results: ExecuteContinuationTickResultV1[];
  final_handoff: PreparedNextTickInputV1;
};

function requiredCanonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function requiredHourAlignedIsoV1(value: string, code: string): string {
  const canonical = requiredCanonicalIsoV1(value, code);
  const date = new Date(canonical);
  if (date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
    throw new Error(code);
  }
  return canonical;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * CONTINUATION_TICK_INTERVAL_MS_V1).toISOString();
}

export class ContiguousContinuationRangeServiceV1 {
  constructor(
    private readonly handoffService: PrepareNextTickInputPortV1,
    private readonly tickService: ExecuteOneContinuationTickPortV1,
  ) {}

  async runContiguousContinuationRangeV1(
    input: RunContiguousContinuationRangeInputV1,
  ): Promise<RunContiguousContinuationRangeResultV1> {
    const targetLogicalTime = requiredHourAlignedIsoV1(
      input.to_logical_time,
      "CONTINUATION_RANGE_TARGET_NOT_CANONICAL_HOUR",
    );
    requiredCanonicalIsoV1(input.created_at, "CONTINUATION_RANGE_CREATED_AT_INVALID");
    if (!input.lease_owner.trim()) throw new Error("CONTINUATION_RANGE_LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0) {
      throw new Error("CONTINUATION_RANGE_LEASE_DURATION_INVALID");
    }

    const initialHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    const persistedStartLogicalTime = requiredHourAlignedIsoV1(
      initialHandoff.next_logical_tick_time,
      "PERSISTED_NEXT_TICK_NOT_CANONICAL_HOUR",
    );
    const startMs = Date.parse(persistedStartLogicalTime);
    const targetMs = Date.parse(targetLogicalTime);

    if (targetMs < startMs) {
      return {
        status: "ALREADY_COMPLETE",
        persisted_start_logical_time: persistedStartLogicalTime,
        requested_target_logical_time: targetLogicalTime,
        executed_tick_count: 0,
        tick_results: [],
        final_handoff: initialHandoff,
      };
    }

    const intervalCount = (targetMs - startMs) / CONTINUATION_TICK_INTERVAL_MS_V1;
    if (!Number.isInteger(intervalCount)) throw new Error("CONTINUATION_RANGE_TARGET_NOT_CONTIGUOUS_HOUR");
    const requestedTickCount = intervalCount + 1;
    if (requestedTickCount > MAX_CONTIGUOUS_CONTINUATION_TICKS_V1) {
      throw new Error("CONTINUATION_RANGE_MAX_TICKS_EXCEEDED");
    }

    const tickResults: ExecuteContinuationTickResultV1[] = [];
    let expectedLogicalTime = persistedStartLogicalTime;
    let finalHandoff = initialHandoff;

    for (let index = 0; index < requestedTickCount; index += 1) {
      const result = await this.tickService.executeOneTick({
        scope: input.scope,
        logical_time: expectedLogicalTime,
        created_at: input.created_at,
        continuation_runtime_config_ref: input.continuation_runtime_config_ref,
        crop_stage_context_ref: input.crop_stage_context_ref,
        crop_stage_context_hash: input.crop_stage_context_hash,
        crop_stage_context: input.crop_stage_context,
        lease_owner: input.lease_owner,
        lease_duration_seconds: input.lease_duration_seconds,
      });
      const expectedNextLogicalTime = addHoursV1(expectedLogicalTime, 1);
      if (result.next_handoff.next_logical_tick_time !== expectedNextLogicalTime) {
        throw new Error("CONTINUATION_RANGE_NONCONTIGUOUS_COMMITTED_HANDOFF");
      }
      tickResults.push(result);
      finalHandoff = result.next_handoff;
      expectedLogicalTime = expectedNextLogicalTime;
    }

    if (tickResults.length !== requestedTickCount) throw new Error("CONTINUATION_RANGE_EXECUTED_COUNT_MISMATCH");
    if (finalHandoff.next_logical_tick_time !== addHoursV1(targetLogicalTime, 1)) {
      throw new Error("CONTINUATION_RANGE_FINAL_HANDOFF_MISMATCH");
    }

    return {
      status: "COMPLETED",
      persisted_start_logical_time: persistedStartLogicalTime,
      requested_target_logical_time: targetLogicalTime,
      executed_tick_count: tickResults.length,
      tick_results: tickResults,
      final_handoff: finalHandoff,
    };
  }
}
