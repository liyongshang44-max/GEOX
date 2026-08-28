// MCFT-CAP-09 Production Hosting Phase 3: long-running Evidence Runtime host lifecycle.
// Boundary: lifecycle/retry/standby orchestration only. All Evidence processing is delegated
// to EvidenceRuntimeCycleServiceV1. No provider/decoder/DB implementation, environment,
// wall-clock read, Twin state, RuntimeTickCursor, or deployment activation is defined here.

import type {
  EvidenceRuntimeCycleServiceV1,
  EvidenceRuntimeCycleWorkItemV1,
  ExecuteEvidenceRuntimeCycleResultV1,
} from "./mcft_cap09_evidence_runtime_cycle_service_v1.js";
import type {
  EvidenceRuntimeScopeV1,
} from "./mcft_cap09_evidence_runtime_persistence_v1.js";

export const MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ID_V1 =
  "MCFT_CAP09_EVIDENCE_RUNTIME_HOST_V1" as const;

export type EvidenceRuntimeHostFailureClassV1 = "RETRYABLE" | "FATAL";

export type EvidenceRuntimeHostHealthEventV1 = {
  host_id: typeof MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ID_V1;
  status: "STARTING" | "HEALTHY" | "STANDBY" | "DEGRADED" | "STOPPING";
  cycle_attempt: number;
  successful_cycle_count: number;
  consecutive_failure_count: number;
  detail:
    | "HOST_START"
    | "CYCLE_COMPLETED"
    | "LEASE_HELD_BY_OTHER_OWNER"
    | "RETRYABLE_CYCLE_FAILURE"
    | "FATAL_CYCLE_FAILURE"
    | "STOP_REQUESTED"
    | "PLANNER_EXHAUSTED";
};

export interface EvidenceRuntimeHostPlannerV1 {
  nextWorkItems(input: {
    cycle_attempt: number;
    successful_cycle_count: number;
    consecutive_failure_count: number;
    previous_result: ExecuteEvidenceRuntimeCycleResultV1 | null;
  }): Promise<readonly EvidenceRuntimeCycleWorkItemV1[] | null>;
}

export interface EvidenceRuntimeHostWaitPortV1 {
  waitAfterAttempt(input: {
    reason: "SUCCESS_CADENCE" | "LEASE_STANDBY" | "RETRY_BACKOFF";
    cycle_attempt: number;
    consecutive_failure_count: number;
  }): Promise<void>;
}

export interface EvidenceRuntimeHostHealthPortV1 {
  recordHealth(event: EvidenceRuntimeHostHealthEventV1): Promise<void>;
}

export interface EvidenceRuntimeHostStopPortV1 {
  stopRequested(): boolean;
}

export interface EvidenceRuntimeHostFailureClassifierV1 {
  classify(error: unknown): EvidenceRuntimeHostFailureClassV1;
}

export type RunEvidenceRuntimeHostInputV1 = {
  scope: EvidenceRuntimeScopeV1;
  lease_owner: string;
  lease_duration_seconds: number;
};

export type RunEvidenceRuntimeHostResultV1 = {
  host_id: typeof MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ID_V1;
  status: "STOPPED";
  stop_reason: "STOP_REQUESTED" | "PLANNER_EXHAUSTED";
  cycle_attempt_count: number;
  successful_cycle_count: number;
  standby_cycle_count: number;
  retryable_failure_count: number;
  last_cycle_result: ExecuteEvidenceRuntimeCycleResultV1 | null;
  durable_restart_checkpoint: "EVIDENCE_SUPPLY_CURSOR";
  runtime_tick_cursor_mutation: false;
  twin_state_mutation: false;
};

export class EvidenceRuntimeHostV1 {
  readonly host_id = MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ID_V1;

  constructor(private readonly deps: {
    cycle_service: Pick<EvidenceRuntimeCycleServiceV1, "executeCycle">;
    planner: EvidenceRuntimeHostPlannerV1;
    wait: EvidenceRuntimeHostWaitPortV1;
    health: EvidenceRuntimeHostHealthPortV1;
    stop: EvidenceRuntimeHostStopPortV1;
    failure_classifier: EvidenceRuntimeHostFailureClassifierV1;
  }) {}

  private async healthV1(input: Omit<EvidenceRuntimeHostHealthEventV1, "host_id">): Promise<void> {
    await this.deps.health.recordHealth({ host_id: this.host_id, ...input });
  }

  async run(input: RunEvidenceRuntimeHostInputV1): Promise<RunEvidenceRuntimeHostResultV1> {
    let cycleAttempt = 0;
    let successfulCycles = 0;
    let standbyCycles = 0;
    let retryableFailures = 0;
    let consecutiveFailures = 0;
    let previousResult: ExecuteEvidenceRuntimeCycleResultV1 | null = null;

    await this.healthV1({
      status: "STARTING",
      cycle_attempt: cycleAttempt,
      successful_cycle_count: successfulCycles,
      consecutive_failure_count: consecutiveFailures,
      detail: "HOST_START",
    });

    while (true) {
      if (this.deps.stop.stopRequested()) {
        await this.healthV1({
          status: "STOPPING",
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          consecutive_failure_count: consecutiveFailures,
          detail: "STOP_REQUESTED",
        });
        return {
          host_id: this.host_id,
          status: "STOPPED",
          stop_reason: "STOP_REQUESTED",
          cycle_attempt_count: cycleAttempt,
          successful_cycle_count: successfulCycles,
          standby_cycle_count: standbyCycles,
          retryable_failure_count: retryableFailures,
          last_cycle_result: previousResult,
          durable_restart_checkpoint: "EVIDENCE_SUPPLY_CURSOR",
          runtime_tick_cursor_mutation: false,
          twin_state_mutation: false,
        };
      }

      const workItems = await this.deps.planner.nextWorkItems({
        cycle_attempt: cycleAttempt,
        successful_cycle_count: successfulCycles,
        consecutive_failure_count: consecutiveFailures,
        previous_result: previousResult,
      });
      if (workItems === null) {
        await this.healthV1({
          status: "STOPPING",
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          consecutive_failure_count: consecutiveFailures,
          detail: "PLANNER_EXHAUSTED",
        });
        return {
          host_id: this.host_id,
          status: "STOPPED",
          stop_reason: "PLANNER_EXHAUSTED",
          cycle_attempt_count: cycleAttempt,
          successful_cycle_count: successfulCycles,
          standby_cycle_count: standbyCycles,
          retryable_failure_count: retryableFailures,
          last_cycle_result: previousResult,
          durable_restart_checkpoint: "EVIDENCE_SUPPLY_CURSOR",
          runtime_tick_cursor_mutation: false,
          twin_state_mutation: false,
        };
      }
      if (!Array.isArray(workItems) || workItems.length === 0) {
        throw new Error("PHASE3_EVIDENCE_HOST_PLANNER_EMPTY_WORK_ITEMS_FORBIDDEN");
      }

      cycleAttempt += 1;
      try {
        const result = await this.deps.cycle_service.executeCycle({
          scope: input.scope,
          lease_owner: input.lease_owner,
          lease_duration_seconds: input.lease_duration_seconds,
          work_items: workItems,
        });
        previousResult = result;
        if (result.status === "LEASE_HELD_BY_OTHER_OWNER") {
          standbyCycles += 1;
          consecutiveFailures = 0;
          await this.healthV1({
            status: "STANDBY",
            cycle_attempt: cycleAttempt,
            successful_cycle_count: successfulCycles,
            consecutive_failure_count: consecutiveFailures,
            detail: "LEASE_HELD_BY_OTHER_OWNER",
          });
          await this.deps.wait.waitAfterAttempt({
            reason: "LEASE_STANDBY",
            cycle_attempt: cycleAttempt,
            consecutive_failure_count: consecutiveFailures,
          });
          continue;
        }

        successfulCycles += 1;
        consecutiveFailures = 0;
        await this.healthV1({
          status: "HEALTHY",
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          consecutive_failure_count: consecutiveFailures,
          detail: "CYCLE_COMPLETED",
        });
        await this.deps.wait.waitAfterAttempt({
          reason: "SUCCESS_CADENCE",
          cycle_attempt: cycleAttempt,
          consecutive_failure_count: consecutiveFailures,
        });
      } catch (error) {
        const classification = this.deps.failure_classifier.classify(error);
        if (classification === "FATAL") {
          consecutiveFailures += 1;
          await this.healthV1({
            status: "DEGRADED",
            cycle_attempt: cycleAttempt,
            successful_cycle_count: successfulCycles,
            consecutive_failure_count: consecutiveFailures,
            detail: "FATAL_CYCLE_FAILURE",
          });
          throw error;
        }
        if (classification !== "RETRYABLE") {
          throw new Error("PHASE3_EVIDENCE_HOST_FAILURE_CLASS_INVALID");
        }
        retryableFailures += 1;
        consecutiveFailures += 1;
        await this.healthV1({
          status: "DEGRADED",
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          consecutive_failure_count: consecutiveFailures,
          detail: "RETRYABLE_CYCLE_FAILURE",
        });
        await this.deps.wait.waitAfterAttempt({
          reason: "RETRY_BACKOFF",
          cycle_attempt: cycleAttempt,
          consecutive_failure_count: consecutiveFailures,
        });
      }
    }
  }
}
