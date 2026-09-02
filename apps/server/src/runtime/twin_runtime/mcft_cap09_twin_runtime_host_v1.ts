// MCFT-CAP-09 Production Hosting Phase 4: long-running Twin Runtime host.
//
// This host does not implement a second Twin algorithm. One due slot is always delegated
// to the existing canonical ExternalFormalV3Amendment19RunnerV1 structural port.
// Scheduling/slot cursor/lease/fencing/canonical persistence remain owned by the existing
// PostgreSQL-backed Runtime graph. The host only owns process lifecycle: DB-clock observation,
// repeated one-slot invocation, health, wait/backoff, and graceful stop.
//
// Forbidden here: public-provider access, raw R2/S3 fallback, EvidenceSupplyCursor mutation,
// Evidence producer lease mutation, recommendation/approval/action/dispatch, or model activation.

import type { Pool } from "pg";

import type {
  ExecuteExternalFormalV3Am19RunnerInputV1,
  ExecuteExternalFormalV3Am19RunnerResultV1,
  ExternalFormalV3Amendment19RunnerV1,
} from "./external_formal_v3_amendment19_runner_v1.js";
import type {
  TwinRuntimeSuccessorViabilityPortV1,
} from "./postgres_twin_runtime_successor_viability_v1.js";
import type {
  TwinRuntimeSchedulerOwnershipLeaseClaimV1,
  TwinRuntimeSchedulerOwnershipPortV1,
} from "./postgres_persistent_sequential_scheduler_adapter_v1.js";

export const MCFT_CAP09_TWIN_RUNTIME_HOST_ID_V1 =
  "MCFT_CAP09_TWIN_RUNTIME_HOST_V1" as const;

export const MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1 =
  "MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_V1" as const;

export const MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1 = {
  host_id: MCFT_CAP09_TWIN_RUNTIME_HOST_ID_V1,
  execution_model: "LONG_RUNNING_ONE_DUE_CANONICAL_SLOT_PER_ATTEMPT",
  one_slot_runtime:
    "ExternalFormalV3Amendment19RunnerV1.executeOneDueSlot",
  canonical_tick_path:
    "ExternalFormalV3Amendment19PersistentTickServiceV1",
  scheduler:
    "PostgresPersistentSequentialSchedulerAdapterV1",
  durable_runtime_tick_cursor:
    "twin_shadow_online_scheduler_cursor_v1",
  scheduler_slot_ledger:
    "twin_shadow_online_scheduler_slot_v1",
  scheduler_lease:
    "twin_runtime_lease_v1",
  scheduler_owner_presence:
    "PROCESS_MUST_HOLD_CURRENT_TWIN_RUNTIME_SCHEDULER_LEASE_BEFORE_DUE_SLOT_ATTEMPT",
  duplicate_process_policy:
    "NON_OWNER_INSTANCE_STANDBY_NO_CANONICAL_RUNNER_CALL",
  clock_authority: "POSTGRES_TRANSACTION_TIMESTAMP",
  missed_slot_order: "OLDEST_ELIGIBLE_FIRST",
  successor_viability:
    "PostgresTwinRuntimeSuccessorViabilityV1.verifyAfterTerminal",
  provider_request_allowed: false,
  raw_r2_fallback_allowed: false,
  evidence_supply_cursor_mutation_allowed: false,
  evidence_producer_lease_mutation_allowed: false,
  recommendation_creation_allowed: false,
  approval_creation_allowed: false,
  action_dispatch_allowed: false,
  model_activation_allowed: false,
  production_container_activation: false,
  formal_v5_arm: false,
} as const;

export type TwinRuntimeHostFailureClassV1 = "RETRYABLE" | "FATAL";

export type TwinRuntimeDatabaseClockSnapshotV1 = {
  clock_id: typeof MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1;
  observed_at: string;
};

export interface TwinRuntimeDatabaseClockPortV1 {
  readDatabaseNow(): Promise<TwinRuntimeDatabaseClockSnapshotV1>;
}

export interface TwinRuntimeOneDueSlotPortV1 {
  executeOneDueSlot(
    input: ExecuteExternalFormalV3Am19RunnerInputV1,
  ): Promise<ExecuteExternalFormalV3Am19RunnerResultV1>;
}

export interface TwinRuntimeHostWaitPortV1 {
  waitAfterAttempt(input: {
    reason:
      | "NO_DUE_SLOT"
      | "EVIDENCE_OR_CONFIG_NOT_READY"
      | "TERMINAL_SLOT"
      | "SCHEDULER_LEASE_STANDBY"
      | "RETRY_BACKOFF";
    cycle_attempt: number;
    consecutive_failure_count: number;
  }): Promise<void>;
}

export interface TwinRuntimeHostStopPortV1 {
  stopRequested(): boolean;
}

export interface TwinRuntimeHostFailureClassifierV1 {
  classify(error: unknown): TwinRuntimeHostFailureClassV1;
}

export type TwinRuntimeHostHealthEventV1 = {
  host_id: typeof MCFT_CAP09_TWIN_RUNTIME_HOST_ID_V1;
  status: "STARTING" | "HEALTHY" | "BACKPRESSURE" | "DEGRADED" | "STOPPING";
  cycle_attempt: number;
  terminal_slot_count: number;
  no_due_slot_count: number;
  preclaim_backpressure_count: number;
  retryable_failure_count: number;
  consecutive_failure_count: number;
  detail:
    | "HOST_START"
    | "NO_DUE_SLOT"
    | "NOT_READY_PRECLAIM"
    | "TERMINAL_SLOT_RECORDED"
    | "SCHEDULER_LEASE_STANDBY"
    | "RETRYABLE_CYCLE_FAILURE"
    | "FATAL_CYCLE_FAILURE"
    | "STOP_REQUESTED";
};

export interface TwinRuntimeHostHealthPortV1 {
  recordHealth(event: TwinRuntimeHostHealthEventV1): Promise<void>;
}

export type RunTwinRuntimeHostInputV1 = {
  lease_owner: string;
  lease_duration_seconds: number;
};

export type RunTwinRuntimeHostResultV1 = {
  host_id: typeof MCFT_CAP09_TWIN_RUNTIME_HOST_ID_V1;
  status: "STOPPED";
  stop_reason: "STOP_REQUESTED";
  cycle_attempt_count: number;
  terminal_slot_count: number;
  no_due_slot_count: number;
  preclaim_backpressure_count: number;
  retryable_failure_count: number;
  scheduler_lease_standby_count: number;
  last_cycle_result: ExecuteExternalFormalV3Am19RunnerResultV1 | null;
  durable_restart_authority: "RUNTIME_TICK_CURSOR_AND_CANONICAL_CHECKPOINT";
  provider_request_count: 0;
  r2_request_count: 0;
  evidence_supply_cursor_mutation: false;
};

type DbClockPoolV1 = Pick<Pool, "query">;

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function positiveLeaseSecondsV1(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) <= 0 || Number(value) > 3600) {
    throw new Error("PHASE4_TWIN_RUNTIME_HOST_LEASE_DURATION_INVALID");
  }
  return Number(value);
}

function canonicalIsoV1(value: unknown, code: string): string {
  const raw = value instanceof Date ? value.toISOString() : String(value ?? "");
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new Error(code);
  const canonical = new Date(parsed).toISOString();
  if (value instanceof Date) return canonical;
  if (canonical !== raw) throw new Error(code);
  return raw;
}

function terminalResultV1(
  result: ExecuteExternalFormalV3Am19RunnerResultV1,
): boolean {
  return result.status === "COMPLETED"
    || result.status === "DEGRADED"
    || result.status === "BLOCKED_TERMINAL_RECORDED"
    || result.status === "FAILED_TERMINAL_RECORDED";
}

export class PostgresTwinRuntimeDatabaseClockV1
implements TwinRuntimeDatabaseClockPortV1 {
  readonly clock_id = MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1;

  constructor(private readonly pool: DbClockPoolV1) {}

  async readDatabaseNow(): Promise<TwinRuntimeDatabaseClockSnapshotV1> {
    const result = await this.pool.query<{ database_now: string | Date }>(
      "SELECT transaction_timestamp() AS database_now",
    );
    if (result.rows.length !== 1) {
      throw new Error("PHASE4_TWIN_RUNTIME_DATABASE_CLOCK_CARDINALITY");
    }
    return {
      clock_id: this.clock_id,
      observed_at: canonicalIsoV1(
        result.rows[0].database_now,
        "PHASE4_TWIN_RUNTIME_DATABASE_CLOCK_INVALID",
      ),
    };
  }
}

export class TwinRuntimeHostV1 {
  readonly host_id = MCFT_CAP09_TWIN_RUNTIME_HOST_ID_V1;

  constructor(private readonly deps: {
    database_clock: TwinRuntimeDatabaseClockPortV1;
    scheduler_ownership: TwinRuntimeSchedulerOwnershipPortV1;
    one_due_slot: Pick<ExternalFormalV3Amendment19RunnerV1, "executeOneDueSlot">
      | TwinRuntimeOneDueSlotPortV1;
    successor_viability: TwinRuntimeSuccessorViabilityPortV1;
    wait: TwinRuntimeHostWaitPortV1;
    health: TwinRuntimeHostHealthPortV1;
    stop: TwinRuntimeHostStopPortV1;
    failure_classifier: TwinRuntimeHostFailureClassifierV1;
  }) {}

  private async healthV1(
    input: Omit<TwinRuntimeHostHealthEventV1, "host_id">,
  ): Promise<void> {
    await this.deps.health.recordHealth({ host_id: this.host_id, ...input });
  }

  async run(
    input: RunTwinRuntimeHostInputV1,
  ): Promise<RunTwinRuntimeHostResultV1> {
    const leaseOwner = requiredTextV1(
      input.lease_owner,
      "PHASE4_TWIN_RUNTIME_HOST_LEASE_OWNER_REQUIRED",
    );
    const leaseDurationSeconds = positiveLeaseSecondsV1(
      input.lease_duration_seconds,
    );

    let cycleAttempt = 0;
    let terminalSlotCount = 0;
    let noDueSlotCount = 0;
    let preclaimBackpressureCount = 0;
    let retryableFailureCount = 0;
    let schedulerLeaseStandbyCount = 0;
    let consecutiveFailures = 0;
    let lastCycleResult: ExecuteExternalFormalV3Am19RunnerResultV1 | null = null;
    let currentOwnershipClaim: TwinRuntimeSchedulerOwnershipLeaseClaimV1 | null = null;

    await this.healthV1({
      status: "STARTING",
      cycle_attempt: cycleAttempt,
      terminal_slot_count: terminalSlotCount,
      no_due_slot_count: noDueSlotCount,
      preclaim_backpressure_count: preclaimBackpressureCount,
      retryable_failure_count: retryableFailureCount,
      consecutive_failure_count: consecutiveFailures,
      detail: "HOST_START",
    });

    try {
    while (true) {
      if (this.deps.stop.stopRequested()) {
        await this.healthV1({
          status: "STOPPING",
          cycle_attempt: cycleAttempt,
          terminal_slot_count: terminalSlotCount,
          no_due_slot_count: noDueSlotCount,
          preclaim_backpressure_count: preclaimBackpressureCount,
          retryable_failure_count: retryableFailureCount,
          consecutive_failure_count: consecutiveFailures,
          detail: "STOP_REQUESTED",
        });
        return {
          host_id: this.host_id,
          status: "STOPPED",
          stop_reason: "STOP_REQUESTED",
          cycle_attempt_count: cycleAttempt,
          terminal_slot_count: terminalSlotCount,
          no_due_slot_count: noDueSlotCount,
          preclaim_backpressure_count: preclaimBackpressureCount,
          retryable_failure_count: retryableFailureCount,
          scheduler_lease_standby_count: schedulerLeaseStandbyCount,
          last_cycle_result: lastCycleResult,
          durable_restart_authority:
            "RUNTIME_TICK_CURSOR_AND_CANONICAL_CHECKPOINT",
          provider_request_count: 0,
          r2_request_count: 0,
          evidence_supply_cursor_mutation: false,
        };
      }

      cycleAttempt += 1;
      try {
        const ownershipClaim =
          await this.deps.scheduler_ownership.acquireOrRenewOwnershipLease({
            lease_owner: leaseOwner,
            lease_duration_seconds: leaseDurationSeconds,
          });
        if (!ownershipClaim) {
          schedulerLeaseStandbyCount += 1;
          consecutiveFailures = 0;
          await this.healthV1({
            status: "BACKPRESSURE",
            cycle_attempt: cycleAttempt,
            terminal_slot_count: terminalSlotCount,
            no_due_slot_count: noDueSlotCount,
            preclaim_backpressure_count: preclaimBackpressureCount,
            retryable_failure_count: retryableFailureCount,
            consecutive_failure_count: consecutiveFailures,
            detail: "SCHEDULER_LEASE_STANDBY",
          });
          await this.deps.wait.waitAfterAttempt({
            reason: "SCHEDULER_LEASE_STANDBY",
            cycle_attempt: cycleAttempt,
            consecutive_failure_count: consecutiveFailures,
          });
          continue;
        }
        currentOwnershipClaim = ownershipClaim;

        const clock = await this.deps.database_clock.readDatabaseNow();
        const result = await this.deps.one_due_slot.executeOneDueSlot({
          through_logical_time: clock.observed_at,
          observer_started_at: clock.observed_at,
          lease_owner: leaseOwner,
          lease_duration_seconds: leaseDurationSeconds,
        });
        lastCycleResult = result;
        consecutiveFailures = 0;

        if (result.provider_request_count !== 0 || result.r2_request_count !== 0) {
          throw new Error("PHASE4_TWIN_RUNTIME_PROVIDER_OR_R2_FALLBACK_FORBIDDEN");
        }

        if (result.status === "NO_DUE_SLOT") {
          noDueSlotCount += 1;
          await this.healthV1({
            status: "HEALTHY",
            cycle_attempt: cycleAttempt,
            terminal_slot_count: terminalSlotCount,
            no_due_slot_count: noDueSlotCount,
            preclaim_backpressure_count: preclaimBackpressureCount,
            retryable_failure_count: retryableFailureCount,
            consecutive_failure_count: consecutiveFailures,
            detail: "NO_DUE_SLOT",
          });
          await this.deps.wait.waitAfterAttempt({
            reason: "NO_DUE_SLOT",
            cycle_attempt: cycleAttempt,
            consecutive_failure_count: consecutiveFailures,
          });
          continue;
        }

        if (result.status === "NOT_READY_PRECLAIM") {
          preclaimBackpressureCount += 1;
          await this.healthV1({
            status: "BACKPRESSURE",
            cycle_attempt: cycleAttempt,
            terminal_slot_count: terminalSlotCount,
            no_due_slot_count: noDueSlotCount,
            preclaim_backpressure_count: preclaimBackpressureCount,
            retryable_failure_count: retryableFailureCount,
            consecutive_failure_count: consecutiveFailures,
            detail: "NOT_READY_PRECLAIM",
          });
          await this.deps.wait.waitAfterAttempt({
            reason: "EVIDENCE_OR_CONFIG_NOT_READY",
            cycle_attempt: cycleAttempt,
            consecutive_failure_count: consecutiveFailures,
          });
          continue;
        }

        if (!terminalResultV1(result)) {
          throw new Error("PHASE4_TWIN_RUNTIME_CYCLE_RESULT_INVALID");
        }
        try {
          await this.deps.successor_viability.verifyAfterTerminal({
            terminal_slot_id: result.slot_id,
            terminal_logical_time: result.logical_time,
          });
        } catch (successorError) {
          if (
            result.status === "FAILED_TERMINAL_RECORDED"
            || result.status === "BLOCKED_TERMINAL_RECORDED"
          ) {
            const successorDetail = successorError instanceof Error
              ? successorError.message
              : String(successorError);
            throw new Error(
              `${successorDetail}:TERMINAL_RESULT=${result.status}:RUNNER_DETAIL=${result.detail}`,
            );
          }
          throw successorError;
        }
        terminalSlotCount += 1;
        await this.healthV1({
          status: result.status === "FAILED_TERMINAL_RECORDED"
            || result.status === "BLOCKED_TERMINAL_RECORDED"
            ? "DEGRADED"
            : "HEALTHY",
          cycle_attempt: cycleAttempt,
          terminal_slot_count: terminalSlotCount,
          no_due_slot_count: noDueSlotCount,
          preclaim_backpressure_count: preclaimBackpressureCount,
          retryable_failure_count: retryableFailureCount,
          consecutive_failure_count: consecutiveFailures,
          detail: "TERMINAL_SLOT_RECORDED",
        });
        await this.deps.wait.waitAfterAttempt({
          reason: "TERMINAL_SLOT",
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
            terminal_slot_count: terminalSlotCount,
            no_due_slot_count: noDueSlotCount,
            preclaim_backpressure_count: preclaimBackpressureCount,
            retryable_failure_count: retryableFailureCount,
            consecutive_failure_count: consecutiveFailures,
            detail: "FATAL_CYCLE_FAILURE",
          });
          throw error;
        }
        if (classification !== "RETRYABLE") {
          throw new Error("PHASE4_TWIN_RUNTIME_FAILURE_CLASS_INVALID");
        }
        retryableFailureCount += 1;
        consecutiveFailures += 1;
        await this.healthV1({
          status: "DEGRADED",
          cycle_attempt: cycleAttempt,
          terminal_slot_count: terminalSlotCount,
          no_due_slot_count: noDueSlotCount,
          preclaim_backpressure_count: preclaimBackpressureCount,
          retryable_failure_count: retryableFailureCount,
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
    } finally {
      if (currentOwnershipClaim) {
        await this.deps.scheduler_ownership.releaseOwnershipLease({
          claim: currentOwnershipClaim,
        });
      }
    }
  }
}
