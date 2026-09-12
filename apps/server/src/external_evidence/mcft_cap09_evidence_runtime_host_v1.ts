// MCFT-CAP-09 Production Hosting Phase 3: long-running Evidence Runtime host lifecycle.
// Boundary: lifecycle/retry/standby orchestration only. Evidence processing is delegated to
// an explicit EvidenceRuntimeHostAttemptPlanV1. The host owns no provider/decoder/DB implementation,
// environment, wall-clock, Twin state, RuntimeTickCursor, or production activation authority.

import type {
  EvidenceRuntimeHostAttemptPlanV1,
  EvidenceRuntimeHostAttemptResultV1,
} from "./mcft_cap09_evidence_runtime_host_attempt_v1.js";
import type {
  EvidenceRuntimeScopeV1,
} from "./mcft_cap09_evidence_runtime_persistence_v1.js";

export const MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ID_V1 =
  "MCFT_CAP09_EVIDENCE_RUNTIME_HOST_V1" as const;

export const MCFT_CAP09_EVIDENCE_RUNTIME_DURABLE_RESTART_AUTHORITY_V1 =
  "EVIDENCE_PLANE_DURABLE_PROGRESS_SET" as const;
export const MCFT_CAP09_EVIDENCE_RUNTIME_DURABLE_RESTART_COMPONENTS_V1 = [
  "EVIDENCE_SUPPLY_CURSOR",
  "KBS_PUBLICATION_BASELINE_POINTER",
  "SOURCE_POLL_SCHEDULE",
  "GFS_RETRY_SCHEDULE",
  "CANONICAL_GFS_HOURLY_TARGET_PAIR_HISTORY",
] as const;

export type EvidenceRuntimeHostFailureClassV1 = "RETRYABLE" | "FATAL";

export type EvidenceRuntimeHostHealthEventV1 = {
  host_id: typeof MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ID_V1;
  status: "STARTING" | "HEALTHY" | "STANDBY" | "DEGRADED" | "STOPPING";
  cycle_attempt: number;
  successful_cycle_count: number;
  consecutive_failure_count: number;
  detail:
    | "HOST_START"
    | "ATTEMPT_COMPLETED"
    | "LEASE_HELD_BY_OTHER_OWNER"
    | "PLANNER_NOT_DUE"
    | "PROVIDER_NOT_DUE"
    | "RETRYABLE_ATTEMPT_FAILURE"
    | "FATAL_ATTEMPT_FAILURE"
    | "STOP_REQUESTED"
    | "PLANNER_EXHAUSTED";
};

export interface EvidenceRuntimeHostPlannerV1 {
  nextAttemptPlan(input: {
    cycle_attempt: number;
    successful_cycle_count: number;
    consecutive_failure_count: number;
    previous_result: EvidenceRuntimeHostAttemptResultV1 | null;
  }): Promise<
    EvidenceRuntimeHostAttemptPlanV1 | EvidenceRuntimeHostNotDueV1 | null
  >;
}

export type EvidenceRuntimeHostNotDueV1 = { status: "NOT_DUE" };

export interface EvidenceRuntimeHostWaitPortV1 {
  waitAfterAttempt(input: {
    reason:
      | "SUCCESS_CADENCE"
      | "PLANNER_NOT_DUE"
      | "PROVIDER_NOT_DUE"
      | "LEASE_STANDBY"
      | "RETRY_BACKOFF";
    cycle_attempt: number;
    consecutive_failure_count: number;
  }): Promise<void>;
}
export interface EvidenceRuntimeHostHealthPortV1 {
  recordHealth(event: EvidenceRuntimeHostHealthEventV1): Promise<void>;
}
export interface EvidenceRuntimeHostStopPortV1 { stopRequested(): boolean }
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
  not_due_wait_count: number;
  retryable_failure_count: number;
  last_attempt_result: EvidenceRuntimeHostAttemptResultV1 | null;
  durable_restart_authority:
    typeof MCFT_CAP09_EVIDENCE_RUNTIME_DURABLE_RESTART_AUTHORITY_V1;
  durable_restart_components:
    typeof MCFT_CAP09_EVIDENCE_RUNTIME_DURABLE_RESTART_COMPONENTS_V1;
  runtime_tick_cursor_mutation: false;
  twin_state_mutation: false;
};

function isNotDuePlanV1(
  value: EvidenceRuntimeHostAttemptPlanV1 | EvidenceRuntimeHostNotDueV1,
): value is EvidenceRuntimeHostNotDueV1 {
  return "status" in value;
}
function validateAttemptResultV1(
  plan: EvidenceRuntimeHostAttemptPlanV1,
  result: EvidenceRuntimeHostAttemptResultV1,
): void {
  if (
    result.attempt_id !== plan.attempt_id
    || result.attempt_kind !== plan.attempt_kind
  ) throw new Error("PHASE3_EVIDENCE_HOST_ATTEMPT_RESULT_IDENTITY_MISMATCH");
  if (
    result.status !== "COMPLETED"
    && result.status !== "LEASE_HELD_BY_OTHER_OWNER"
    && result.status !== "PROVIDER_NOT_DUE"
  ) throw new Error("PHASE3_EVIDENCE_HOST_ATTEMPT_RESULT_STATUS_INVALID");
}

export class EvidenceRuntimeHostV1 {
  readonly host_id = MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ID_V1;
  constructor(private readonly deps: {
    planner: EvidenceRuntimeHostPlannerV1;
    wait: EvidenceRuntimeHostWaitPortV1;
    health: EvidenceRuntimeHostHealthPortV1;
    stop: EvidenceRuntimeHostStopPortV1;
    failure_classifier: EvidenceRuntimeHostFailureClassifierV1;
  }) {}

  private async healthV1(
    input: Omit<EvidenceRuntimeHostHealthEventV1, "host_id">,
  ): Promise<void> {
    await this.deps.health.recordHealth({ host_id: this.host_id, ...input });
  }

  private resultV1(input: {
    reason: "STOP_REQUESTED" | "PLANNER_EXHAUSTED";
    cycle_attempt: number;
    successful_cycle_count: number;
    standby_cycle_count: number;
    not_due_wait_count: number;
    retryable_failure_count: number;
    previous_result: EvidenceRuntimeHostAttemptResultV1 | null;
  }): RunEvidenceRuntimeHostResultV1 {
    return {
      host_id: this.host_id,
      status: "STOPPED",
      stop_reason: input.reason,
      cycle_attempt_count: input.cycle_attempt,
      successful_cycle_count: input.successful_cycle_count,
      standby_cycle_count: input.standby_cycle_count,
      not_due_wait_count: input.not_due_wait_count,
      retryable_failure_count: input.retryable_failure_count,
      last_attempt_result: input.previous_result,
      durable_restart_authority:
        MCFT_CAP09_EVIDENCE_RUNTIME_DURABLE_RESTART_AUTHORITY_V1,
      durable_restart_components:
        MCFT_CAP09_EVIDENCE_RUNTIME_DURABLE_RESTART_COMPONENTS_V1,
      runtime_tick_cursor_mutation: false,
      twin_state_mutation: false,
    };
  }

  async run(
    input: RunEvidenceRuntimeHostInputV1,
  ): Promise<RunEvidenceRuntimeHostResultV1> {
    let cycleAttempt = 0;
    let successfulCycles = 0;
    let standbyCycles = 0;
    let notDueWaits = 0;
    let retryableFailures = 0;
    let consecutiveFailures = 0;
    let previousResult: EvidenceRuntimeHostAttemptResultV1 | null = null;

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
        return this.resultV1({
          reason: "STOP_REQUESTED",
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          standby_cycle_count: standbyCycles,
          not_due_wait_count: notDueWaits,
          retryable_failure_count: retryableFailures,
          previous_result: previousResult,
        });
      }

      const plan = await this.deps.planner.nextAttemptPlan({
        cycle_attempt: cycleAttempt,
        successful_cycle_count: successfulCycles,
        consecutive_failure_count: consecutiveFailures,
        previous_result: previousResult,
      });
      if (plan === null) {
        await this.healthV1({
          status: "STOPPING",
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          consecutive_failure_count: consecutiveFailures,
          detail: "PLANNER_EXHAUSTED",
        });
        return this.resultV1({
          reason: "PLANNER_EXHAUSTED",
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          standby_cycle_count: standbyCycles,
          not_due_wait_count: notDueWaits,
          retryable_failure_count: retryableFailures,
          previous_result: previousResult,
        });
      }
      if (isNotDuePlanV1(plan)) {
        if (plan.status !== "NOT_DUE" || Object.keys(plan).length !== 1) {
          throw new Error("PHASE3_EVIDENCE_HOST_PLANNER_STATE_INVALID");
        }
        notDueWaits += 1;
        consecutiveFailures = 0;
        await this.healthV1({
          status: "STANDBY",
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          consecutive_failure_count: consecutiveFailures,
          detail: "PLANNER_NOT_DUE",
        });
        await this.deps.wait.waitAfterAttempt({
          reason: "PLANNER_NOT_DUE",
          cycle_attempt: cycleAttempt,
          consecutive_failure_count: consecutiveFailures,
        });
        continue;
      }
      if (
        typeof plan.attempt_id !== "string"
        || !plan.attempt_id.trim()
        || typeof plan.execute !== "function"
      ) throw new Error("PHASE3_EVIDENCE_HOST_ATTEMPT_PLAN_INVALID");

      cycleAttempt += 1;
      try {
        const result = await plan.execute({
          scope: input.scope,
          lease_owner: input.lease_owner,
          lease_duration_seconds: input.lease_duration_seconds,
        });
        validateAttemptResultV1(plan, result);
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
        if(result.status==="PROVIDER_NOT_DUE"){
          notDueWaits+=1; consecutiveFailures=0;
          await this.healthV1({status:"STANDBY",cycle_attempt:cycleAttempt,successful_cycle_count:successfulCycles,consecutive_failure_count:consecutiveFailures,detail:"PROVIDER_NOT_DUE"});
          await this.deps.wait.waitAfterAttempt({reason:"PROVIDER_NOT_DUE",cycle_attempt:cycleAttempt,consecutive_failure_count:consecutiveFailures});
          continue;
        }
        successfulCycles += 1;
        consecutiveFailures = 0;
        await this.healthV1({
          status: "HEALTHY",
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          consecutive_failure_count: consecutiveFailures,
          detail: "ATTEMPT_COMPLETED",
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
            detail: "FATAL_ATTEMPT_FAILURE",
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
          detail: "RETRYABLE_ATTEMPT_FAILURE",
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
