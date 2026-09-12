// MCFT-CAP-09 Production Hosting Phase 5: process lifecycle adapters shared by
// the Evidence Runtime and Twin Runtime container entrypoints.
//
// These adapters own OS/process mechanics only: signal-driven stop, bounded waits,
// structured health logging, and conservative transient-failure classification.
// They do not select Evidence targets, read providers, access databases, execute a
// Twin tick, or mutate either durable cursor.

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
} from "./twin_runtime/mcft_cap09_twin_runtime_host_v1.js";

export const MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_ID_V1 =
  "MCFT_CAP09_PRODUCTION_PROCESS_LIFECYCLE_V1" as const;

export type McftCap09ProcessSignalV1 = "SIGINT" | "SIGTERM";

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
    reason: "SUCCESS_CADENCE" | "PLANNER_NOT_DUE" | "PROVIDER_NOT_DUE" | "LEASE_STANDBY" | "RETRY_BACKOFF";
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
      case "RETRY_BACKOFF": {
        const exponent = Math.max(0, Math.min(10, input.consecutive_failure_count - 1));
        waitMs = Math.min(this.retryMaximumMs, this.retryBaseMs * 2 ** exponent);
        break;
      }
      default:
        throw new Error("PHASE5_EVIDENCE_WAIT_REASON_INVALID");
    }
    await sleep(waitMs);
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
    "08000",
    "08001",
    "08003",
    "08006",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EAI_AGAIN",
  ].includes(code)) return true;

  const message = error instanceof Error ? error.message : String(error ?? "");
  return /socket hang up|connection terminated|fetch failed|network|temporar|timeout/i.test(message);
}

export class McftCap09ProductionEvidenceFailureClassifierV1
implements EvidenceRuntimeHostFailureClassifierV1 {
  classify(error: unknown): "RETRYABLE" | "FATAL" {
    return transientInfrastructureFailureV1(error) ? "RETRYABLE" : "FATAL";
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
