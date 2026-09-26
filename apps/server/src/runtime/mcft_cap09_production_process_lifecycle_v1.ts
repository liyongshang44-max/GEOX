// MCFT-CAP-09 Production Hosting Phase 5: process lifecycle adapters shared by
// the Evidence Runtime and Twin Runtime container entrypoints.
//
// These adapters own OS/process mechanics only: signal-driven stop, bounded waits,
// structured health logging, and conservative transient-failure classification.
// They do not select Evidence targets, read providers, access databases, execute a
// Twin tick, or mutate either durable cursor.

import { setTimeout as sleep } from "node:timers/promises";
import type { Pool } from "pg";

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
} from "./twin_runtime/mcft_cap09_twin_runtime_host_v1.js";

export const MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1 =
  "MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_V1" as const;

export type McftCap09ProcessSignalV1 = "SIGINT" | "SIGTERM";

export type McftCap09RuntimePoolRoleV1 = "EVIDENCE_RUNTIME" | "TWIN_RUNTIME";

export type McftCap09RuntimePoolIdleErrorEventV1 = {
  schema_version: "geox_mcft_cap09_runtime_pool_idle_error_v1";
  runtime_role: McftCap09RuntimePoolRoleV1;
  lifecycle_id: typeof MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1;
  status: "DEGRADED" | "FATAL";
  detail: "IDLE_POOL_CLIENT_ERROR";
  failure_class: "RETRYABLE" | "FATAL";
  failure_token: string;
  error_name: string;
  error_code: string | null;
};

type McftCap09RuntimePoolFailureClassifierV1 = {
  classify(error: unknown): "RETRYABLE" | "FATAL";
};

function runtimePoolErrorCodeV1(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "").trim()
    : "";
}

function runtimePoolFailureTokenV1(error: unknown, code: string): string {
  if (code) return code;
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/database system is in recovery mode|cannot connect now/i.test(message)) {
    return "POSTGRES_RECOVERY_MODE";
  }
  if (/connection terminated/i.test(message)) {
    return "POSTGRES_CONNECTION_TERMINATED";
  }
  if (/socket hang up/i.test(message)) return "SOCKET_HANG_UP";
  if (/timeout/i.test(message)) return "TIMEOUT";
  return "UNCLASSIFIED_POOL_ERROR";
}

export function installMcftCap09RuntimePoolIdleErrorGuardV1(input: {
  pool: Pick<Pool, "on" | "off">;
  runtime_role: McftCap09RuntimePoolRoleV1;
  failure_classifier: McftCap09RuntimePoolFailureClassifierV1;
  event_sink?: (event: McftCap09RuntimePoolIdleErrorEventV1) => void;
}): { dispose(): void } {
  const sink = input.event_sink ?? ((event: McftCap09RuntimePoolIdleErrorEventV1) => {
    process.stderr.write(`${JSON.stringify(event)}\n`);
  });
  const onError = (error: Error) => {
    const classification = input.failure_classifier.classify(error);
    const code = runtimePoolErrorCodeV1(error);
    sink({
      schema_version: "geox_mcft_cap09_runtime_pool_idle_error_v1",
      runtime_role: input.runtime_role,
      lifecycle_id: MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1,
      status: classification === "RETRYABLE" ? "DEGRADED" : "FATAL",
      detail: "IDLE_POOL_CLIENT_ERROR",
      failure_class: classification,
      failure_token: runtimePoolFailureTokenV1(error, code),
      error_name: error instanceof Error ? error.name : "Error",
      error_code: code || null,
    });
    if (classification === "FATAL") {
      throw error instanceof Error
        ? error
        : new Error("MCFT_CAP09_RUNTIME_POOL_IDLE_FATAL");
    }
  };
  input.pool.on("error", onError);
  return {
    dispose() {
      input.pool.off("error", onError);
    },
  };
}


export type McftCap09ProcessStopV1 =
  EvidenceRuntimeHostStopPortV1 & TwinRuntimeHostStopPortV1 & {
    readonly lifecycle_id: typeof MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1;
    readonly received_signal: McftCap09ProcessSignalV1 | null;
    dispose(): void;
  };

function boundedMillisecondsV1(
  value: unknown,
  code: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(code);
  }
  return Number(value);
}

export function createMcftCap09ProcessStopV1(input?: {
  process_ref?: Pick<NodeJS.Process, "on" | "off">;
}): McftCap09ProcessStopV1 {
  const processRef = input?.process_ref ?? process;
  let stopped = false;
  let receivedSignal: McftCap09ProcessSignalV1 | null = null;

  const onSigint = () => {
    stopped = true;
    receivedSignal = "SIGINT";
  };
  const onSigterm = () => {
    stopped = true;
    receivedSignal = "SIGTERM";
  };

  processRef.on("SIGINT", onSigint);
  processRef.on("SIGTERM", onSigterm);

  return {
    lifecycle_id: MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1,
    stopRequested() {
      return stopped;
    },
    get received_signal() {
      return receivedSignal;
    },
    dispose() {
      processRef.off("SIGINT", onSigint);
      processRef.off("SIGTERM", onSigterm);
    },
  };
}

export function mcftCap09EvidenceLeaseKeepaliveIntervalMsV1(
  leaseDurationSeconds: number,
): number {
  const leaseMs = boundedMillisecondsV1(
    Math.floor(leaseDurationSeconds * 1000),
    "PHASE5_EVIDENCE_LEASE_KEEPALIVE_DURATION_INVALID",
    1000,
    3_600_000,
  );
  return Math.max(100, Math.min(60_000, Math.floor(leaseMs / 3)));
}

export class McftCap09ProductionEvidenceWaitV1
implements EvidenceRuntimeHostWaitPortV1 {
  readonly lifecycle_id = MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1;
  private readonly successCadenceMs: number;
  private readonly standbyMs: number;
  private readonly retryBaseMs: number;
  private readonly retryMaximumMs: number;

  constructor(input: {
    success_cadence_ms: number;
    lease_standby_ms: number;
    retry_base_ms: number;
    retry_maximum_ms: number;
  }) {
    this.successCadenceMs = boundedMillisecondsV1(
      input.success_cadence_ms,
      "PHASE5_EVIDENCE_SUCCESS_CADENCE_MS_INVALID",
      100,
      86_400_000,
    );
    this.standbyMs = boundedMillisecondsV1(
      input.lease_standby_ms,
      "PHASE5_EVIDENCE_LEASE_STANDBY_MS_INVALID",
      100,
      3_600_000,
    );
    this.retryBaseMs = boundedMillisecondsV1(
      input.retry_base_ms,
      "PHASE5_EVIDENCE_RETRY_BASE_MS_INVALID",
      100,
      3_600_000,
    );
    this.retryMaximumMs = boundedMillisecondsV1(
      input.retry_maximum_ms,
      "PHASE5_EVIDENCE_RETRY_MAXIMUM_MS_INVALID",
      this.retryBaseMs,
      3_600_000,
    );
  }

  async waitAfterAttempt(input: {
    reason:
      | "SUCCESS_CADENCE"
      | "PLANNER_NOT_DUE"
      | "PROVIDER_NOT_DUE"
      | "LEASE_STANDBY"
      | "RETRY_BACKOFF"
      | "ATTEMPT_REJECTED_BACKOFF";
    cycle_attempt: number;
    consecutive_failure_count: number;
  }): Promise<void> {
    let waitMs: number;
    switch (input.reason) {
      case "SUCCESS_CADENCE":
      case "PLANNER_NOT_DUE":
      case "PROVIDER_NOT_DUE":
        waitMs = this.successCadenceMs;
        break;
      case "LEASE_STANDBY":
        waitMs = this.standbyMs;
        break;
      case "RETRY_BACKOFF":
      case "ATTEMPT_REJECTED_BACKOFF": {
        const exponent = Math.max(0, Math.min(10, input.consecutive_failure_count - 1));
        waitMs = Math.min(this.retryMaximumMs, this.retryBaseMs * 2 ** exponent);
        break;
      }
      default:
        throw new Error("PHASE5_EVIDENCE_WAIT_REASON_INVALID");
    }
    await sleep(waitMs);
  }

  async waitForLeaseRenewal(input: {
    lease_duration_seconds: number;
    signal: AbortSignal;
  }): Promise<"DUE" | "CANCELLED"> {
    const waitMs = mcftCap09EvidenceLeaseKeepaliveIntervalMsV1(
      input.lease_duration_seconds,
    );
    if (input.signal.aborted) return "CANCELLED";
    try {
      await sleep(waitMs, undefined, { signal: input.signal });
      return "DUE";
    } catch (error) {
      if (
        input.signal.aborted
        && error instanceof Error
        && error.name === "AbortError"
      ) return "CANCELLED";
      throw error;
    }
  }
}

export class McftCap09ProductionTwinWaitV1
implements TwinRuntimeHostWaitPortV1 {
  readonly lifecycle_id = MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1;
  private readonly idleMs: number;
  private readonly notReadyMs: number;
  private readonly terminalMs: number;
  private readonly retryBaseMs: number;
  private readonly retryMaximumMs: number;

  constructor(input: {
    idle_poll_ms: number;
    not_ready_poll_ms: number;
    terminal_poll_ms: number;
    retry_base_ms: number;
    retry_maximum_ms: number;
  }) {
    this.idleMs = boundedMillisecondsV1(
      input.idle_poll_ms,
      "PHASE5_TWIN_IDLE_POLL_MS_INVALID",
      100,
      3_600_000,
    );
    this.notReadyMs = boundedMillisecondsV1(
      input.not_ready_poll_ms,
      "PHASE5_TWIN_NOT_READY_POLL_MS_INVALID",
      100,
      3_600_000,
    );
    this.terminalMs = boundedMillisecondsV1(
      input.terminal_poll_ms,
      "PHASE5_TWIN_TERMINAL_POLL_MS_INVALID",
      0,
      3_600_000,
    );
    this.retryBaseMs = boundedMillisecondsV1(
      input.retry_base_ms,
      "PHASE5_TWIN_RETRY_BASE_MS_INVALID",
      100,
      3_600_000,
    );
    this.retryMaximumMs = boundedMillisecondsV1(
      input.retry_maximum_ms,
      "PHASE5_TWIN_RETRY_MAXIMUM_MS_INVALID",
      this.retryBaseMs,
      3_600_000,
    );
  }

  async waitAfterAttempt(input: {
    reason:
      | "NO_DUE_SLOT"
      | "SCHEDULER_LEASE_STANDBY"
      | "EVIDENCE_OR_CONFIG_NOT_READY"
      | "TERMINAL_SLOT"
      | "RETRY_BACKOFF";
    cycle_attempt: number;
    consecutive_failure_count: number;
  }): Promise<void> {
    let waitMs: number;
    switch (input.reason) {
      case "NO_DUE_SLOT":
      case "SCHEDULER_LEASE_STANDBY":
        waitMs = this.idleMs;
        break;
      case "EVIDENCE_OR_CONFIG_NOT_READY":
        waitMs = this.notReadyMs;
        break;
      case "TERMINAL_SLOT":
        waitMs = this.terminalMs;
        break;
      case "RETRY_BACKOFF": {
        const exponent = Math.max(0, Math.min(10, input.consecutive_failure_count - 1));
        waitMs = Math.min(this.retryMaximumMs, this.retryBaseMs * 2 ** exponent);
        break;
      }
      default:
        throw new Error("PHASE5_TWIN_WAIT_REASON_INVALID");
    }
    if (waitMs > 0) await sleep(waitMs);
  }
}

export class McftCap09ConsoleEvidenceHealthV1
implements EvidenceRuntimeHostHealthPortV1 {
  readonly lifecycle_id = MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1;
  async recordHealth(event: EvidenceRuntimeHostHealthEventV1): Promise<void> {
    process.stdout.write(`${JSON.stringify({
      runtime_role: "EVIDENCE_RUNTIME",
      lifecycle_id: this.lifecycle_id,
      ...event,
    })}\n`);
  }
}

export class McftCap09ConsoleTwinHealthV1
implements TwinRuntimeHostHealthPortV1 {
  readonly lifecycle_id = MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1;
  async recordHealth(event: TwinRuntimeHostHealthEventV1): Promise<void> {
    process.stdout.write(`${JSON.stringify({
      runtime_role: "TWIN_RUNTIME",
      lifecycle_id: this.lifecycle_id,
      ...event,
    })}\n`);
  }
}

function twinCoordinationContentionV1(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code = message.split(":", 1)[0];
  return [
    "LEASE_HELD_BY_OTHER_OWNER",
    "SLOT_ALREADY_CLAIMED_BY_OTHER_OWNER",
    "ACTIVE_SLOT_ALREADY_PRESENT",
    "TERMINAL_SLOT_ALREADY_RECORDED",
    "SLOT_PRECEDES_DURABLE_CURSOR",
  ].includes(code);
}

function transientInfrastructureFailureV1(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  if ([
    "40001", // PostgreSQL serialization failure
    "40P01", // PostgreSQL deadlock
    "57P01", // admin shutdown / reconnect
    "57P03", // cannot connect now / startup or recovery
    "08000",
    "08001",
    "08003",
    "08006",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "ENETDOWN",
    "ENETUNREACH",
    "EHOSTUNREACH",
    "MCFT_CAP09_GFS_MEMBER_RETRY_EXHAUSTED",
  ].includes(code)) return true;

  const message = error instanceof Error ? error.message : String(error ?? "");
  return /socket hang up|connection terminated|fetch failed|network|temporar|timeout|database system is in recovery mode|cannot connect now/i.test(message);
}

function evidenceFailureTokenV1(error: unknown): string {
  const record = error && typeof error === "object"
    ? error as { failure_token?: unknown; diagnostic_token?: unknown; code?: unknown }
    : {};
  if (typeof record.failure_token === "string" && record.failure_token.trim()) {
    return record.failure_token.trim().split(":", 1)[0] ?? "";
  }
  if (typeof record.diagnostic_token === "string" && record.diagnostic_token.trim()) {
    return record.diagnostic_token.trim().split(":", 1)[0] ?? "";
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.trim().split(":", 1)[0] ?? "";
}

function rejectedKbsProviderPayloadV1(error: unknown): boolean {
  const token = evidenceFailureTokenV1(error);
  if ([
    "MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE",
    "MCFT_CAP09_KBS_RAW_HOURLY_CSV_PARSE_ERROR",
    "KBS_RAW_HOURLY_CONTENT_TYPE",
    "KBS_RAW_HOURLY_RAW_BYTES",
    "MCFT_CAP09_KBS_RAW_HOURLY_HEADER_NOT_FOUND",
    "MCFT_CAP09_KBS_EXACT_TARGET_ROW_REQUIRED",
    "MCFT_CAP09_KBS_TARGET_ET0_INPUT_MISSING",
    "MCFT_CAP09_KBS_TARGET_ET0_INPUT_RANGE",
    "MCFT_CAP09_KBS_TARGET_RAIN_INVALID",
    "MCFT_CAP09_KBS_PUBLICATION_EVENT_INDEX_REQUIRED",
    "MCFT_CAP09_KBS_PUBLICATION_LATEST_CANONICAL_HOUR_REQUIRED",
  ].includes(token)) return true;

  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.startsWith(
    "PRODUCTION_SOURCE_PLAN_EXECUTOR_KBS_BLOCKED:BLOCKED_HISTORICAL_DRIFT:",
  );
}

function transientProviderHttpStatusV1(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /_HTTP_STATUS:(?:429|5\d\d)(?:$|:)/.test(message);
}

function transientPrivateRawStoreStatusV1(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /^EA5C1_S3_(?:HEAD|PUT)_STATUS_(?:429|5\d\d)(?:$|:)/.test(message);
}

function transientUndiciFetchTerminationV1(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name !== "TypeError" || error.message.trim().toLowerCase() !== "terminated") {
    return false;
  }
  const causeCode = typeof error.cause === "object"
    && error.cause !== null
    && "code" in error.cause
    ? String((error.cause as { code?: unknown }).code ?? "").trim()
    : "";
  return causeCode === "" || causeCode.startsWith("UND_ERR_");
}

export class McftCap09ProductionEvidenceFailureClassifierV1
implements EvidenceRuntimeHostFailureClassifierV1 {
  classify(error: unknown): "RETRYABLE" | "ATTEMPT_REJECTED" | "PROCESS_FATAL" {
    if (
      transientInfrastructureFailureV1(error)
      || transientUndiciFetchTerminationV1(error)
      || transientProviderHttpStatusV1(error)
      || transientPrivateRawStoreStatusV1(error)
    ) return "RETRYABLE";
    if (rejectedKbsProviderPayloadV1(error)) return "ATTEMPT_REJECTED";
    return "PROCESS_FATAL";
  }
}

export class McftCap09ProductionTwinFailureClassifierV1
implements TwinRuntimeHostFailureClassifierV1 {
  classify(error: unknown): "RETRYABLE" | "FATAL" {
    return twinCoordinationContentionV1(error) || transientInfrastructureFailureV1(error)
      ? "RETRYABLE"
      : "FATAL";
  }
}
