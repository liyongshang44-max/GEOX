// MCFT-CAP-09 Production Hosting Phase 5: shared process lifecycle for
// production-equivalent Evidence Runtime and Twin Runtime containers.
//
// This module owns only process lifecycle concerns: stop signals, wait/backoff,
// structured health logging, and transient PostgreSQL failure classification.
// It does not own provider acquisition, canonical Evidence/Twin logic, cursors,
// leases, persistence, target selection, or production activation.

import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

import type {
  EvidenceRuntimeHostFailureClassifierV1,
  EvidenceRuntimeHostHealthEventV1,
  EvidenceRuntimeHostHealthPortV1,
  EvidenceRuntimeHostStopPortV1,
  EvidenceRuntimeHostWaitPortV1,
} from "../external_evidence/mcft_cap09_evidence_runtime_host_v1.js";
import type {
  TwinRuntimeHostFailureClassifierV1,
  TwinRuntimeHostHealthEventV1,
  TwinRuntimeHostHealthPortV1,
  TwinRuntimeHostStopPortV1,
  TwinRuntimeHostWaitPortV1,
} from "../runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.js";

export const MCFT_CAP09_PHASE5_SERVICE_LIFECYCLE_ID_V1 =
  "MCFT_CAP09_PHASE5_SERVICE_LIFECYCLE_V1" as const;

const PHASE5_SAFE_CONTENTION_ERRORS = new Set([
  "LEASE_HELD_BY_OTHER_OWNER",
  "SLOT_ALREADY_CLAIMED_BY_OTHER_OWNER",
]);

const POSTGRES_RETRYABLE_CODES = new Set([
  "08000", // connection exception
  "08001", // client unable to establish connection
  "08003", // connection does not exist
  "08004", // rejected connection
  "08006", // connection failure
  "08007", // transaction resolution unknown
  "08P01", // protocol violation
  "40001", // serialization failure
  "40P01", // deadlock detected
  "53300", // too many connections
  "57P01", // admin shutdown
  "57P02", // crash shutdown
  "57P03", // cannot connect now
]);

export type Phase5ServiceWaitProfileV1 = {
  success_wait_ms: number;
  standby_wait_ms: number;
  retry_wait_ms: number;
  terminal_wait_ms: number;
  no_due_wait_ms: number;
  backpressure_wait_ms: number;
};

function boundedMsV1(value: unknown, code: string): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 3_600_000) {
    throw new Error(code);
  }
  return Number(value);
}

function normalizeWaitProfileV1(
  profile: Phase5ServiceWaitProfileV1,
): Phase5ServiceWaitProfileV1 {
  return {
    success_wait_ms: boundedMsV1(profile.success_wait_ms, "PHASE5_SUCCESS_WAIT_INVALID"),
    standby_wait_ms: boundedMsV1(profile.standby_wait_ms, "PHASE5_STANDBY_WAIT_INVALID"),
    retry_wait_ms: boundedMsV1(profile.retry_wait_ms, "PHASE5_RETRY_WAIT_INVALID"),
    terminal_wait_ms: boundedMsV1(profile.terminal_wait_ms, "PHASE5_TERMINAL_WAIT_INVALID"),
    no_due_wait_ms: boundedMsV1(profile.no_due_wait_ms, "PHASE5_NO_DUE_WAIT_INVALID"),
    backpressure_wait_ms: boundedMsV1(
      profile.backpressure_wait_ms,
      "PHASE5_BACKPRESSURE_WAIT_INVALID",
    ),
  };
}

export class ProcessSignalStopPortV1
implements EvidenceRuntimeHostStopPortV1, TwinRuntimeHostStopPortV1 {
  private stop = false;
  private installed = false;

  install(): void {
    if (this.installed) return;
    this.installed = true;
    const requestStop = () => { this.stop = true; };
    process.once("SIGTERM", requestStop);
    process.once("SIGINT", requestStop);
  }

  stopRequested(): boolean {
    return this.stop;
  }

  requestStopForQualification(): void {
    this.stop = true;
  }
}

export class Phase5ServiceWaitPortV1
implements EvidenceRuntimeHostWaitPortV1, TwinRuntimeHostWaitPortV1 {
  private readonly profile: Phase5ServiceWaitProfileV1;

  constructor(profile: Phase5ServiceWaitProfileV1) {
    this.profile = normalizeWaitProfileV1(profile);
  }

  async waitAfterAttempt(input: {
    reason:
      | "SUCCESS_CADENCE"
      | "LEASE_STANDBY"
      | "RETRY_BACKOFF"
      | "NO_DUE_SLOT"
      | "EVIDENCE_OR_CONFIG_NOT_READY"
      | "TERMINAL_SLOT";
    cycle_attempt: number;
    consecutive_failure_count: number;
  }): Promise<void> {
    const waitMs = (() => {
      switch (input.reason) {
        case "SUCCESS_CADENCE": return this.profile.success_wait_ms;
        case "LEASE_STANDBY": return this.profile.standby_wait_ms;
        case "RETRY_BACKOFF": return this.profile.retry_wait_ms;
        case "NO_DUE_SLOT": return this.profile.no_due_wait_ms;
        case "EVIDENCE_OR_CONFIG_NOT_READY": return this.profile.backpressure_wait_ms;
        case "TERMINAL_SLOT": return this.profile.terminal_wait_ms;
      }
    })();
    if (waitMs > 0) await sleep(waitMs);
  }
}

export type Phase5HealthSinkV1 = (record: Record<string, unknown>) => void;

export class JsonLineServiceHealthPortV1
implements EvidenceRuntimeHostHealthPortV1, TwinRuntimeHostHealthPortV1 {
  constructor(
    private readonly serviceRole: "EVIDENCE_RUNTIME" | "TWIN_RUNTIME",
    private readonly sink: Phase5HealthSinkV1 = (record) => {
      process.stdout.write(JSON.stringify(record) + "\n");
    },
  ) {}

  async recordHealth(
    event: EvidenceRuntimeHostHealthEventV1 | TwinRuntimeHostHealthEventV1,
  ): Promise<void> {
    this.sink({
      schema_version: "geox_mcft_cap09_phase5_service_health_v1",
      service_role: this.serviceRole,
      ...event,
    });
  }
}

function postgresCodeV1(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" && value ? value : null;
}

export class PostgresTransientFailureClassifierV1
implements EvidenceRuntimeHostFailureClassifierV1, TwinRuntimeHostFailureClassifierV1 {
  classify(error: unknown): "RETRYABLE" | "FATAL" {
    if (
      error instanceof Error
      && PHASE5_SAFE_CONTENTION_ERRORS.has(error.message)
    ) {
      return "RETRYABLE";
    }
    const code = postgresCodeV1(error);
    return code !== null && POSTGRES_RETRYABLE_CODES.has(code)
      ? "RETRYABLE"
      : "FATAL";
  }
}
