// apps/server/src/runtime/twin_runtime/restart_resume_service_v1.ts
// Purpose: validate explicit restart/resume and bounded forward-backfill operator intent against the persisted checkpoint, then delegate execution to the verified contiguous range service.
// Boundary: no second tick loop, no direct persistence, no projection repair, no late-Evidence revision, no scheduler, no wall clock, no route, and no new lineage.

import type {
  RunContiguousContinuationRangeInputV1,
  RunContiguousContinuationRangeResultV1,
} from "./contiguous_continuation_range_service_v1.js";
import type { PreparedRestartInputV1, TwinScopeKeyV1 } from "./ports.js";

export type ResumeFromCheckpointPortV1 = {
  resumeFromCheckpointV1(scope: TwinScopeKeyV1): Promise<PreparedRestartInputV1>;
};

export type ContiguousContinuationRangePortV1 = {
  runContiguousContinuationRangeV1(
    input: RunContiguousContinuationRangeInputV1,
  ): Promise<RunContiguousContinuationRangeResultV1>;
};

export type RunRestartResumeInputV1 = RunContiguousContinuationRangeInputV1;

export type RunBoundedBackfillInputV1 = RunContiguousContinuationRangeInputV1 & {
  evidence_intent: "MISSED_SCHEDULE_CATCH_UP" | "LATE_EVIDENCE_REVISION";
  requested_start_logical_time?: string;
};

export type RestartResumeResultV1 = {
  operator_intent: "RESUME" | "BACKFILL";
  persisted_checkpoint_ref: string;
  persisted_terminal_tick_ref: string;
  persisted_start_logical_time: string;
  range_result: RunContiguousContinuationRangeResultV1;
};

const CHECKPOINT_PROJECTION_DIVERGENCE_SOURCE_CODES_V1 = new Set([
  "PERSISTED_NEXT_TICK_POINTER_SET_INCOMPLETE",
  "ACTIVE_LINEAGE_REF_REQUIRED",
  "ACTIVE_LINEAGE_ID_REQUIRED",
  "CHECKPOINT_SCOPE_MISMATCH",
  "PREVIOUS_POSTERIOR_SCOPE_MISMATCH",
  "LATEST_CHECKPOINT_OBJECT_TYPE_MISMATCH",
  "LATEST_STATE_OBJECT_TYPE_MISMATCH",
  "CHECKPOINT_LINEAGE_REQUIRED",
  "CHECKPOINT_REVISION_REQUIRED",
  "ACTIVE_LINEAGE_CHECKPOINT_MISMATCH",
  "ACTIVE_LINEAGE_STATE_MISMATCH",
  "CHECKPOINT_STATE_REVISION_MISMATCH",
  "CHECKPOINT_PREVIOUS_POSTERIOR_REF_MISMATCH",
  "LAST_COMPLETED_TICK_REF_REQUIRED",
  "NEXT_LOGICAL_TICK_TIME_REQUIRED",
  "NEXT_LOGICAL_TICK_TIME_INVALID",
  "CHECKPOINT_PROJECTION_DIVERGENCE",
]);

function errorCodeV1(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function rethrowRestartReadErrorV1(error: unknown): never {
  const code = errorCodeV1(error);
  if (
    CHECKPOINT_PROJECTION_DIVERGENCE_SOURCE_CODES_V1.has(code)
    || code.startsWith("PERSISTED_OBJECT_NOT_FOUND:")
    || code.startsWith("PERSISTED_OBJECT_TYPE_MISMATCH:")
  ) {
    throw new Error("CHECKPOINT_PROJECTION_DIVERGENCE");
  }
  throw error;
}

function validateRequestedStartV1(
  requestedStartLogicalTime: string | undefined,
  persistedStartLogicalTime: string,
): void {
  if (requestedStartLogicalTime === undefined) return;
  const parsed = Date.parse(requestedStartLogicalTime);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== requestedStartLogicalTime) {
    throw new Error("BACKFILL_START_NOT_CANONICAL_HOUR");
  }
  const date = new Date(parsed);
  if (date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
    throw new Error("BACKFILL_START_NOT_CANONICAL_HOUR");
  }
  if (requestedStartLogicalTime !== persistedStartLogicalTime) {
    throw new Error("BACKFILL_START_NOT_PERSISTED_NEXT_TICK");
  }
}

export class RestartResumeServiceV1 {
  constructor(
    private readonly checkpointService: ResumeFromCheckpointPortV1,
    private readonly rangeService: ContiguousContinuationRangePortV1,
  ) {}

  async resumeFromCheckpointV1(input: RunRestartResumeInputV1): Promise<RestartResumeResultV1> {
    let persisted: PreparedRestartInputV1;
    try {
      persisted = await this.checkpointService.resumeFromCheckpointV1(input.scope);
    } catch (error) {
      rethrowRestartReadErrorV1(error);
    }
    const rangeResult = await this.rangeService.runContiguousContinuationRangeV1(input);
    if (rangeResult.persisted_start_logical_time !== persisted.next_logical_tick_time) {
      throw new Error("CHECKPOINT_PROJECTION_DIVERGENCE");
    }
    return {
      operator_intent: "RESUME",
      persisted_checkpoint_ref: persisted.previous_checkpoint_ref,
      persisted_terminal_tick_ref: persisted.previous_terminal_tick_ref,
      persisted_start_logical_time: persisted.next_logical_tick_time,
      range_result: rangeResult,
    };
  }

  async runBoundedBackfillV1(input: RunBoundedBackfillInputV1): Promise<RestartResumeResultV1> {
    if (input.evidence_intent === "LATE_EVIDENCE_REVISION") {
      throw new Error("LATE_EVIDENCE_FORWARD_BACKFILL_FORBIDDEN");
    }

    let persisted: PreparedRestartInputV1;
    try {
      persisted = await this.checkpointService.resumeFromCheckpointV1(input.scope);
    } catch (error) {
      if (errorCodeV1(error) === "PERSISTED_NEXT_TICK_STATE_NOT_FOUND") {
        throw new Error("BACKFILL_BEFORE_BOOTSTRAP");
      }
      rethrowRestartReadErrorV1(error);
    }

    validateRequestedStartV1(input.requested_start_logical_time, persisted.next_logical_tick_time);
    const rangeResult = await this.rangeService.runContiguousContinuationRangeV1(input);
    if (rangeResult.persisted_start_logical_time !== persisted.next_logical_tick_time) {
      throw new Error("CHECKPOINT_PROJECTION_DIVERGENCE");
    }
    return {
      operator_intent: "BACKFILL",
      persisted_checkpoint_ref: persisted.previous_checkpoint_ref,
      persisted_terminal_tick_ref: persisted.previous_terminal_tick_ref,
      persisted_start_logical_time: persisted.next_logical_tick_time,
      range_result: rangeResult,
    };
  }
}
