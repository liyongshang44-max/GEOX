// MCFT-CAP-09 Production Hosting Phase 3: long-running Evidence Runtime host lifecycle.
// Boundary: lifecycle/retry/standby orchestration only. Evidence processing is delegated to
// an explicit EvidenceRuntimeHostAttemptPlanV1. The host owns no provider/decoder/DB implementation,
// environment, wall-clock, Twin state, RuntimeTickCursor, or production activation authority.

import type {
  EvidenceRuntimeHostAttemptPlanV1,
  EvidenceRuntimeHostAttemptResultV1,
} from "./mcft_cap09_evidence_runtime_host_attempt_v1.js";
import type {
  EvidenceProducerLeaseClaimV1,
  EvidenceProducerLeasePortV1,
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
  attempt_kind?: EvidenceRuntimeHostAttemptResultV1["attempt_kind"];
  failure_class?: EvidenceRuntimeHostFailureClassV1;
  failure_stage?: "MEMBER_FETCH" | "HOST_COORDINATION";
  failure_token?: string;
  error_name?: string;
  error_code?: string;
  member_kind?:
    | "GFS_DIRECTORY_LISTING"
    | "GFS_PGRB2_FILTER_RESPONSE"
    | "GFS_SFLUX_IDX"
    | "GFS_SFLUX_EXACT_GRIB_MESSAGE";
  lead?: number;
  local_retry_ordinal?: number;
  detail:
    | "HOST_START"
    | "ATTEMPT_IN_PROGRESS"
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
  waitForLeaseRenewal?(input: {
    lease_duration_seconds: number;
    signal: AbortSignal;
  }): Promise<"DUE" | "CANCELLED">;
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
function sanitizedFailureEvidenceV1(
  error: unknown,
  classification: EvidenceRuntimeHostFailureClassV1,
  attemptKind?: EvidenceRuntimeHostAttemptResultV1["attempt_kind"],
  stageOverride?: EvidenceRuntimeHostHealthEventV1["failure_stage"],
): Pick<
  EvidenceRuntimeHostHealthEventV1,
  | "attempt_kind"
  | "failure_class"
  | "failure_stage"
  | "failure_token"
  | "error_name"
  | "error_code"
  | "member_kind"
  | "lead"
  | "local_retry_ordinal"
> {
  const record = typeof error === "object" && error !== null
    ? error as {
        name?: unknown;
        code?: unknown;
        diagnostic_token?: unknown;
        failure_stage?: unknown;
        failure_token?: unknown;
        member_kind?: unknown;
        lead?: unknown;
        local_retry_ordinal?: unknown;
        message?: unknown;
      }
    : {};
  const name = typeof record.name === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(record.name)
    ? record.name
    : "Error";
  const codeRaw = typeof record.code === "string" ? record.code : "";
  const code = /^[A-Z0-9_.-]{1,96}$/.test(codeRaw) ? codeRaw : undefined;
  const failureTokenRaw =
    typeof record.failure_token === "string" ? record.failure_token : "";
  const diagnosticRaw =
    typeof record.diagnostic_token === "string" ? record.diagnostic_token : "";
  const message = typeof record.message === "string" ? record.message : "";
  const prefix = message.split(":", 1)[0] ?? "";
  const tokenCandidate = failureTokenRaw || diagnosticRaw || prefix;
  const token = /^[A-Z0-9_][A-Z0-9_.-]{0,127}$/.test(tokenCandidate)
    ? tokenCandidate
    : "UNCLASSIFIED_ERROR";
  const failureStage =
    stageOverride
    ?? (record.failure_stage === "MEMBER_FETCH" ? "MEMBER_FETCH" : undefined);
  const memberKinds = new Set([
    "GFS_DIRECTORY_LISTING",
    "GFS_PGRB2_FILTER_RESPONSE",
    "GFS_SFLUX_IDX",
    "GFS_SFLUX_EXACT_GRIB_MESSAGE",
  ]);
  const memberKind =
    typeof record.member_kind === "string" && memberKinds.has(record.member_kind)
      ? record.member_kind as EvidenceRuntimeHostHealthEventV1["member_kind"]
      : undefined;
  const lead =
    typeof record.lead === "number"
    && Number.isInteger(record.lead)
    && record.lead >= 0
    && record.lead <= 120
      ? record.lead
      : undefined;
  const localRetryOrdinal =
    typeof record.local_retry_ordinal === "number"
    && Number.isInteger(record.local_retry_ordinal)
    && record.local_retry_ordinal >= 0
    && record.local_retry_ordinal <= 1
      ? record.local_retry_ordinal
      : undefined;
  return {
    ...(attemptKind ? { attempt_kind: attemptKind } : {}),
    failure_class: classification,
    ...(failureStage ? { failure_stage: failureStage } : {}),
    failure_token: token,
    error_name: name,
    ...(code ? { error_code: code } : {}),
    ...(memberKind ? { member_kind: memberKind } : {}),
    ...(lead !== undefined ? { lead } : {}),
    ...(localRetryOrdinal !== undefined
      ? { local_retry_ordinal: localRetryOrdinal }
      : {}),
  };
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
    lease: EvidenceProducerLeasePortV1;
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
    let ownerClaim: EvidenceProducerLeaseClaimV1 | null = null;

    const releaseOwnerLeaseV1 = async (): Promise<void> => {
      if (!ownerClaim) return;
      const claim = ownerClaim;
      ownerClaim = null;
      await this.deps.lease.releaseLease({ claim });
      if (
        previousResult?.lease_claim
        && previousResult.lease_claim.lease_owner === claim.lease_owner
        && previousResult.lease_claim.fencing_token === claim.fencing_token
      ) {
        previousResult = { ...previousResult, lease_claim: null };
      }
    };

    await this.healthV1({
      status: "STARTING",
      cycle_attempt: cycleAttempt,
      successful_cycle_count: successfulCycles,
      consecutive_failure_count: consecutiveFailures,
      detail: "HOST_START",
    });

    try {
      while (true) {
      if (this.deps.stop.stopRequested()) {
        await this.healthV1({
          status: "STOPPING",
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          consecutive_failure_count: consecutiveFailures,
          detail: "STOP_REQUESTED",
        });
        await releaseOwnerLeaseV1();
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

      let plan: EvidenceRuntimeHostAttemptPlanV1 | EvidenceRuntimeHostNotDueV1 | null;
      try {
        if (ownerClaim) {
          ownerClaim = await this.deps.lease.renewLease({
            claim: ownerClaim,
            lease_duration_seconds: input.lease_duration_seconds,
          });
        } else {
          ownerClaim = await this.deps.lease.acquireLease({
            scope: input.scope,
            lease_owner: input.lease_owner,
            lease_duration_seconds: input.lease_duration_seconds,
          });
          if (!ownerClaim) {
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
        }

        plan = await this.deps.planner.nextAttemptPlan({
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          consecutive_failure_count: consecutiveFailures,
          previous_result: previousResult,
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
            ...sanitizedFailureEvidenceV1(
              error,
              classification,
              undefined,
              "HOST_COORDINATION",
            ),
          });
          throw error;
        }
        if (classification !== "RETRYABLE") {
          throw new Error("PHASE3_EVIDENCE_HOST_FAILURE_CLASS_INVALID");
        }

        // A failed DB coordination call makes the local claim uncertain. Never
        // continue using it. The next loop reacquires through the durable lease:
        // same-owner/live keeps the fence; expired ownership advances the fence.
        const uncertainClaim = ownerClaim;
        ownerClaim = null;
        if (
          uncertainClaim
          && previousResult?.lease_claim
          && previousResult.lease_claim.lease_owner === uncertainClaim.lease_owner
          && previousResult.lease_claim.fencing_token === uncertainClaim.fencing_token
        ) {
          previousResult = { ...previousResult, lease_claim: null };
        }

        retryableFailures += 1;
        consecutiveFailures += 1;
        await this.healthV1({
          status: "DEGRADED",
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          consecutive_failure_count: consecutiveFailures,
          detail: "RETRYABLE_ATTEMPT_FAILURE",
          ...sanitizedFailureEvidenceV1(
            error,
            classification,
            undefined,
            "HOST_COORDINATION",
          ),
        });
        await this.deps.wait.waitAfterAttempt({
          reason: "RETRY_BACKOFF",
          cycle_attempt: cycleAttempt,
          consecutive_failure_count: consecutiveFailures,
        });
        continue;
      }
      if (plan === null) {
        await this.healthV1({
          status: "STOPPING",
          cycle_attempt: cycleAttempt,
          successful_cycle_count: successfulCycles,
          consecutive_failure_count: consecutiveFailures,
          detail: "PLANNER_EXHAUSTED",
        });
        await releaseOwnerLeaseV1();
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
        const waitForLeaseRenewal = this.deps.wait.waitForLeaseRenewal;
        if (typeof waitForLeaseRenewal !== "function") {
          throw new Error("PHASE3_EVIDENCE_HOST_INFLIGHT_LEASE_KEEPALIVE_REQUIRED");
        }
        const keepaliveAbort = new AbortController();
        let keepaliveError: unknown = null;
        const keepalivePromise = (async (): Promise<void> => {
          try {
            while (true) {
              const waitResult = await waitForLeaseRenewal.call(this.deps.wait, {
                lease_duration_seconds: input.lease_duration_seconds,
                signal: keepaliveAbort.signal,
              });
              if (waitResult === "CANCELLED") return;
              if (waitResult !== "DUE") {
                throw new Error("PHASE3_EVIDENCE_HOST_INFLIGHT_LEASE_WAIT_RESULT_INVALID");
              }
              if (!ownerClaim) {
                throw new Error("PHASE3_EVIDENCE_HOST_INFLIGHT_OWNER_CLAIM_REQUIRED");
              }
              ownerClaim = await this.deps.lease.renewLease({
                claim: ownerClaim,
                lease_duration_seconds: input.lease_duration_seconds,
              });
              await this.healthV1({
                status: "HEALTHY",
                cycle_attempt: cycleAttempt,
                successful_cycle_count: successfulCycles,
                consecutive_failure_count: consecutiveFailures,
                detail: "ATTEMPT_IN_PROGRESS",
              });
            }
          } catch (error) {
            keepaliveError = error;
          }
        })();

        let result: EvidenceRuntimeHostAttemptResultV1;
        try {
          result = await plan.execute({
            scope: input.scope,
            lease_owner: input.lease_owner,
            lease_duration_seconds: input.lease_duration_seconds,
          });
        } finally {
          keepaliveAbort.abort();
          await keepalivePromise;
        }
        if (keepaliveError) throw keepaliveError;
        validateAttemptResultV1(plan, result);
        previousResult = result;
        if (result.lease_claim === null) {
          ownerClaim = null;
        } else if (ownerClaim) {
          if (
            ownerClaim.lease_owner !== result.lease_claim.lease_owner
            || ownerClaim.fencing_token !== result.lease_claim.fencing_token
          ) {
            throw new Error("PHASE3_EVIDENCE_HOST_INFLIGHT_LEASE_IDENTITY_MISMATCH");
          }
          const ownerHeartbeat = Date.parse(ownerClaim.heartbeat_at);
          const resultHeartbeat = Date.parse(result.lease_claim.heartbeat_at);
          if (!Number.isFinite(ownerHeartbeat) || !Number.isFinite(resultHeartbeat)) {
            throw new Error("PHASE3_EVIDENCE_HOST_INFLIGHT_LEASE_HEARTBEAT_INVALID");
          }
          if (resultHeartbeat > ownerHeartbeat) ownerClaim = result.lease_claim;
          previousResult = { ...result, lease_claim: ownerClaim };
        } else {
          ownerClaim = result.lease_claim;
        }
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
            ...sanitizedFailureEvidenceV1(error, classification, plan.attempt_kind),
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
          ...sanitizedFailureEvidenceV1(error, classification, plan.attempt_kind),
        });
        await this.deps.wait.waitAfterAttempt({
          reason: "RETRY_BACKOFF",
          cycle_attempt: cycleAttempt,
          consecutive_failure_count: consecutiveFailures,
        });
      }
      }
    } finally {
      await releaseOwnerLeaseV1();
    }
  }
}
