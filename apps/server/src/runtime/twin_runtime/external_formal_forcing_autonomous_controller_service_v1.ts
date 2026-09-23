import type {
  ExternalFormalForcingBaseClaimV1,
  ExternalFormalPhysicalFactIdentityV1,
  PostgresExternalFormalForcingBaseContinuityRepositoryV1,
} from "./postgres_external_formal_forcing_base_continuity_repository_v1.js";
import type {
  ExternalFormalForcingControllerLeaseV1,
  PostgresExternalFormalForcingControllerLifecycleV1,
} from "./postgres_external_formal_forcing_controller_lifecycle_v1.js";
import type { PostgresExternalFormalForcingSupplyAdmissionV1 } from "./postgres_external_formal_forcing_supply_admission_v1.js";

export const MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1 =
  "AUTONOMOUS_FORMAL_FORCING_CONTROLLER_SERVICE_V1" as const;

export type ExternalFormalExactBaseCaptureReceiptV1 = {
  base_target_t: string;
  producer_run_id: string;
  candidate_artifact_digest: string;
  capture_ref: string;
  raw_values_emitted: false;
  formal_database_write_count: 0;
};

export type ExternalFormalExactBasePromotionReceiptV1 = {
  base_target_t: string;
  promotion_run_id: string;
  facts: readonly ExternalFormalPhysicalFactIdentityV1[];
  formal_fact_present_count: 3;
  formal_database_write_count: 0 | 1 | 2 | 3;
  idempotent_existing_fact_count: 0 | 1 | 2 | 3;
  database_fence_commit_succeeded: true;
};

export type ExternalFormalExactBasePromotionMutationStateV1 =
  | "NO_FORMAL_MUTATION"
  | "PARTIAL_FORMAL_MUTATION"
  | "UNKNOWN_FORMAL_MUTATION";

export class ExternalFormalExactBasePromotionFailureV1 extends Error {
  readonly failure_class: string;
  readonly mutation_state: ExternalFormalExactBasePromotionMutationStateV1;
  readonly formal_database_write_count: number | null;

  constructor(input: {
    failure_class: string;
    mutation_state: ExternalFormalExactBasePromotionMutationStateV1;
    formal_database_write_count: number | null;
    cause?: unknown;
  }) {
    const failureClass = required(input.failure_class, "AUTONOMOUS_FORCING_PROMOTION_FAILURE_CLASS_REQUIRED");
    if (input.mutation_state === "NO_FORMAL_MUTATION" && input.formal_database_write_count !== 0) {
      throw new Error("AUTONOMOUS_FORCING_NO_MUTATION_FAILURE_COUNT_MUST_BE_ZERO");
    }
    if (input.mutation_state === "PARTIAL_FORMAL_MUTATION" && (!Number.isInteger(input.formal_database_write_count) || Number(input.formal_database_write_count) <= 0)) {
      throw new Error("AUTONOMOUS_FORCING_PARTIAL_MUTATION_FAILURE_COUNT_REQUIRED");
    }
    if (input.mutation_state === "UNKNOWN_FORMAL_MUTATION" && input.formal_database_write_count !== null) {
      throw new Error("AUTONOMOUS_FORCING_UNKNOWN_MUTATION_FAILURE_COUNT_MUST_BE_NULL");
    }
    super(failureClass, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "ExternalFormalExactBasePromotionFailureV1";
    this.failure_class = failureClass;
    this.mutation_state = input.mutation_state;
    this.formal_database_write_count = input.formal_database_write_count;
  }
}

export interface ExternalFormalExactBaseCapturePortV1 {
  captureExactBase(input: {
    base_target_t: string;
    subject_sha: string;
    idempotency_key: string;
  }): Promise<ExternalFormalExactBaseCaptureReceiptV1>;
}

export interface ExternalFormalExactBasePromotionPortV1 {
  promoteExactBase(input: {
    base_target_t: string;
    subject_sha: string;
    idempotency_key: string;
    capture: ExternalFormalExactBaseCaptureReceiptV1;
    controller_lease: ExternalFormalForcingControllerLeaseV1;
    producer_claim: ExternalFormalForcingBaseClaimV1;
  }): Promise<ExternalFormalExactBasePromotionReceiptV1>;
}

type LifecyclePortV1 = Pick<PostgresExternalFormalForcingControllerLifecycleV1, "acquireOrRenew" | "recordTerminal">;
type AdmissionPortV1 = Pick<PostgresExternalFormalForcingSupplyAdmissionV1, "claimNextRequiredBase">;
type ContinuityPortV1 = Pick<
  PostgresExternalFormalForcingBaseContinuityRepositoryV1,
  "heartbeatClaimUnderController" | "advanceClaimPhaseUnderController" | "markRetryableFailureUnderController" | "attestFormalPhysicalVisibilityUnderController"
>;

export type ExternalFormalAutonomousControllerServiceConfigV1 = {
  subject_sha: string;
  controller_owner: string;
  producer_owner: string;
  controller_lease_duration_seconds: number;
  producer_lease_duration_seconds: number;
  heartbeat_interval_ms: number;
};

export type ExternalFormalAutonomousControllerRunResultV1 =
  | {
      service_id: typeof MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1;
      status: "CONTROLLER_BUSY";
      current_owner: string;
      fencing_token: string;
    }
  | {
      service_id: typeof MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1;
      status: "CONTROLLER_TERMINAL";
      terminal_reason: string;
      fencing_token: string;
    }
  | {
      service_id: typeof MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1;
      status: "NO_WORK";
      reason: "FORCING_BASE_WINDOW_COMPLETE";
    }
  | {
      service_id: typeof MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1;
      status: "PRODUCER_BUSY";
      base_target_t: string;
      current_owner: string;
    }
  | {
      service_id: typeof MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1;
      status: "TERMINAL_LATE_WAKE";
      base_target_t: string;
      failure_class: string;
    }
  | {
      service_id: typeof MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1;
      status: "PROMOTION_COMMITTED_ATTESTATION_PENDING_RECOVERY";
      base_target_t: string;
      failure_class: string;
      promotion_run_id: string;
      facts: readonly ExternalFormalPhysicalFactIdentityV1[];
      controller_fencing_token: string;
      producer_fencing_token: string;
      formal_fact_present_count: 3;
      database_fence_commit_succeeded: true;
      cursor_advanced: false;
    }
  | {
      service_id: typeof MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1;
      status: "TERMINAL_PROMOTION_MUTATION_UNSAFE";
      base_target_t: string;
      failure_class: string;
      mutation_state: Exclude<ExternalFormalExactBasePromotionMutationStateV1, "NO_FORMAL_MUTATION">;
      formal_database_write_count: number | null;
      controller_fencing_token: string;
      forcing_controller_terminal_recorded: true;
    }
  | {
      service_id: typeof MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1;
      status: "COMPLETED_BASE";
      base_target_t: string;
      controller_fencing_token: string;
      producer_fencing_token: string;
      controller_heartbeat_count: number;
      producer_heartbeat_count: number;
      candidate_artifact_digest: string;
      producer_run_id: string;
      promotion_run_id: string;
      next_missing_required_base: string | null;
      wall_clock_target_planner_used: false;
    };

function required(value: string, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalHour(value: string, code: string): string {
  const text = required(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function validateConfig(input: ExternalFormalAutonomousControllerServiceConfigV1): ExternalFormalAutonomousControllerServiceConfigV1 {
  const subject = required(input.subject_sha, "AUTONOMOUS_FORCING_CONTROLLER_SUBJECT_REQUIRED");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("AUTONOMOUS_FORCING_CONTROLLER_SUBJECT_INVALID");
  const controllerOwner = required(input.controller_owner, "AUTONOMOUS_FORCING_CONTROLLER_OWNER_REQUIRED");
  const producerOwner = required(input.producer_owner, "AUTONOMOUS_FORCING_PRODUCER_OWNER_REQUIRED");
  for (const [name, value] of [
    ["CONTROLLER_LEASE", input.controller_lease_duration_seconds],
    ["PRODUCER_LEASE", input.producer_lease_duration_seconds],
  ] as const) {
    if (!Number.isInteger(value) || value <= 0 || value > 1800) throw new Error(`AUTONOMOUS_FORCING_${name}_DURATION_INVALID`);
  }
  if (!Number.isInteger(input.heartbeat_interval_ms) || input.heartbeat_interval_ms <= 0) throw new Error("AUTONOMOUS_FORCING_HEARTBEAT_INTERVAL_INVALID");
  if (input.heartbeat_interval_ms >= Math.min(input.controller_lease_duration_seconds, input.producer_lease_duration_seconds) * 1000) {
    throw new Error("AUTONOMOUS_FORCING_HEARTBEAT_INTERVAL_MUST_BE_INSIDE_BOTH_LEASES");
  }
  return {
    subject_sha: subject,
    controller_owner: controllerOwner,
    producer_owner: producerOwner,
    controller_lease_duration_seconds: input.controller_lease_duration_seconds,
    producer_lease_duration_seconds: input.producer_lease_duration_seconds,
    heartbeat_interval_ms: input.heartbeat_interval_ms,
  };
}

function authorityLoss(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return [
    "FORMAL_FORCING_CONTROLLER_STALE_FENCE",
    "FORMAL_FORCING_CONTROLLER_LEASE_EXPIRED",
    "FORMAL_FORCING_STALE_FENCING_TOKEN",
    "FORMAL_FORCING_CLAIM_LEASE_EXPIRED",
    "AUTONOMOUS_FORCING_CONTROLLER_HEARTBEAT_LOST",
    "AUTONOMOUS_FORCING_CONTROLLER_FENCE_CHANGED_DURING_OWNED_RUN",
  ].some((marker) => message.includes(marker));
}

export class ExternalFormalForcingAutonomousControllerServiceV1 {
  private readonly config: ExternalFormalAutonomousControllerServiceConfigV1;

  constructor(
    private readonly lifecycle: LifecyclePortV1,
    private readonly admission: AdmissionPortV1,
    private readonly continuity: ContinuityPortV1,
    private readonly capture: ExternalFormalExactBaseCapturePortV1,
    private readonly promotion: ExternalFormalExactBasePromotionPortV1,
    config: ExternalFormalAutonomousControllerServiceConfigV1,
  ) {
    this.config = validateConfig(config);
  }

  async runOnce(): Promise<ExternalFormalAutonomousControllerRunResultV1> {
    const controller = await this.lifecycle.acquireOrRenew({
      lease_owner: this.config.controller_owner,
      lease_duration_seconds: this.config.controller_lease_duration_seconds,
    });
    if (controller.status === "BUSY") {
      return {
        service_id: MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1,
        status: "CONTROLLER_BUSY",
        current_owner: controller.current_owner,
        fencing_token: controller.fencing_token.toString(),
      };
    }
    if (controller.status === "TERMINAL") {
      return {
        service_id: MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1,
        status: "CONTROLLER_TERMINAL",
        terminal_reason: controller.terminal_reason,
        fencing_token: controller.fencing_token.toString(),
      };
    }

    let controllerLease = controller.lease;
    const admitted = await this.admission.claimNextRequiredBase({
      controller_lease: controllerLease,
      lease_owner: this.config.producer_owner,
      lease_duration_seconds: this.config.producer_lease_duration_seconds,
    });
    if (admitted.status === "NO_WORK") {
      return { service_id: MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1, status: "NO_WORK", reason: admitted.reason };
    }
    if (admitted.status === "BUSY") {
      return {
        service_id: MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1,
        status: "PRODUCER_BUSY",
        base_target_t: admitted.base_target_t,
        current_owner: admitted.current_owner,
      };
    }
    if (admitted.status === "TERMINAL_LATE_WAKE") {
      return {
        service_id: MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1,
        status: "TERMINAL_LATE_WAKE",
        base_target_t: admitted.base_target_t,
        failure_class: admitted.failure_class,
      };
    }

    let producerClaim = admitted.claim;
    const base = canonicalHour(producerClaim.base_target_t, "AUTONOMOUS_FORCING_ADMITTED_BASE_INVALID");
    let controllerHeartbeatCount = 0;
    let producerHeartbeatCount = 0;

    const runWithHeartbeats = async <T>(operation: () => Promise<T>): Promise<{ value: T; heartbeat_error: unknown | null }> => {
      let stop = false;
      let heartbeatError: unknown = null;
      let cancelDelay: () => void = () => {};
      const heartbeatLoop = (async () => {
        while (!stop) {
          await new Promise<void>((resolve) => {
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              cancelDelay = () => {};
              resolve();
            };
            const timer = setTimeout(finish, this.config.heartbeat_interval_ms);
            cancelDelay = () => {
              clearTimeout(timer);
              finish();
            };
          });
          if (stop) break;
          try {
            const renewed = await this.lifecycle.acquireOrRenew({
              lease_owner: this.config.controller_owner,
              lease_duration_seconds: this.config.controller_lease_duration_seconds,
            });
            if (renewed.status !== "RENEWED" && renewed.status !== "ACQUIRED" && renewed.status !== "TAKEN_OVER") {
              throw new Error(`AUTONOMOUS_FORCING_CONTROLLER_HEARTBEAT_LOST:${renewed.status}`);
            }
            if (renewed.lease.fencing_token !== controllerLease.fencing_token) throw new Error("AUTONOMOUS_FORCING_CONTROLLER_FENCE_CHANGED_DURING_OWNED_RUN");
            controllerLease = renewed.lease;
            controllerHeartbeatCount += 1;
            producerClaim = await this.continuity.heartbeatClaimUnderController({
              controller_lease: controllerLease,
              claim: producerClaim,
              lease_duration_seconds: this.config.producer_lease_duration_seconds,
            });
            producerHeartbeatCount += 1;
          } catch (error) {
            heartbeatError = error;
            stop = true;
          }
        }
      })();
      let value!: T;
      let operationError: unknown = null;
      try {
        value = await operation();
      } catch (error) {
        operationError = error;
      } finally {
        stop = true;
        cancelDelay();
        await heartbeatLoop;
      }
      // The operation error takes precedence because it may carry authoritative mutation-state evidence.
      if (operationError) throw operationError;
      return { value, heartbeat_error: heartbeatError };
    };

    await this.continuity.advanceClaimPhaseUnderController({ controller_lease: controllerLease, claim: producerClaim, phase: "ACQUIRING" });

    let capture: ExternalFormalExactBaseCaptureReceiptV1;
    try {
      const captureOutcome = await runWithHeartbeats(() => this.capture.captureExactBase({
        base_target_t: base,
        subject_sha: this.config.subject_sha,
        idempotency_key: producerClaim.idempotency_key,
      }));
      if (captureOutcome.heartbeat_error) throw captureOutcome.heartbeat_error;
      capture = captureOutcome.value;
    } catch (error) {
      try {
        await this.continuity.markRetryableFailureUnderController({
          controller_lease: controllerLease,
          claim: producerClaim,
          failure_class: `CAPTURE_FAILED:${error instanceof Error ? error.message : String(error)}`,
        });
      } catch {}
      throw error;
    }
    if (canonicalHour(capture.base_target_t, "AUTONOMOUS_FORCING_CAPTURE_BASE_INVALID") !== base) throw new Error("AUTONOMOUS_FORCING_CAPTURE_BASE_MISMATCH");
    if (capture.raw_values_emitted !== false || capture.formal_database_write_count !== 0) throw new Error("AUTONOMOUS_FORCING_CAPTURE_BOUNDARY_VIOLATION");
    if (!/^sha256:[0-9a-f]{64}$/.test(capture.candidate_artifact_digest)) throw new Error("AUTONOMOUS_FORCING_CAPTURE_DIGEST_INVALID");

    await this.continuity.advanceClaimPhaseUnderController({ controller_lease: controllerLease, claim: producerClaim, phase: "READY_TO_FINALIZE" });
    await this.continuity.advanceClaimPhaseUnderController({ controller_lease: controllerLease, claim: producerClaim, phase: "PROMOTING" });

    let promoted: ExternalFormalExactBasePromotionReceiptV1;
    let promotionHeartbeatError: unknown | null = null;
    try {
      const promotionOutcome = await runWithHeartbeats(() => this.promotion.promoteExactBase({
        base_target_t: base,
        subject_sha: this.config.subject_sha,
        idempotency_key: producerClaim.idempotency_key,
        capture,
        controller_lease: controllerLease,
        producer_claim: producerClaim,
      }));
      promoted = promotionOutcome.value;
      promotionHeartbeatError = promotionOutcome.heartbeat_error;
      if (canonicalHour(promoted.base_target_t, "AUTONOMOUS_FORCING_PROMOTION_BASE_INVALID") !== base) {
        throw new ExternalFormalExactBasePromotionFailureV1({
          failure_class: "PROMOTION_RECEIPT_BASE_MISMATCH",
          mutation_state: "UNKNOWN_FORMAL_MUTATION",
          formal_database_write_count: null,
        });
      }
      if (
        promoted.database_fence_commit_succeeded !== true
        || promoted.formal_fact_present_count !== 3
        || promoted.facts.length !== 3
        || !Number.isInteger(promoted.formal_database_write_count)
        || promoted.formal_database_write_count < 0
        || promoted.formal_database_write_count > 3
        || !Number.isInteger(promoted.idempotent_existing_fact_count)
        || promoted.idempotent_existing_fact_count < 0
        || promoted.idempotent_existing_fact_count > 3
        || promoted.formal_database_write_count + promoted.idempotent_existing_fact_count !== 3
      ) {
        throw new ExternalFormalExactBasePromotionFailureV1({
          failure_class: "PROMOTION_RECEIPT_EXACT_THREE_FENCED_PRESENT_REQUIRED",
          mutation_state: "UNKNOWN_FORMAL_MUTATION",
          formal_database_write_count: null,
        });
      }
    } catch (error) {
      if (
        error instanceof ExternalFormalExactBasePromotionFailureV1
        && error.mutation_state === "NO_FORMAL_MUTATION"
        && error.formal_database_write_count === 0
      ) {
        await this.continuity.markRetryableFailureUnderController({
          controller_lease: controllerLease,
          claim: producerClaim,
          failure_class: `PROMOTION_FAILED_NO_FORMAL_MUTATION:${error.failure_class}`,
        });
        throw error;
      }

      const failure = error instanceof ExternalFormalExactBasePromotionFailureV1
        ? error
        : new ExternalFormalExactBasePromotionFailureV1({
            failure_class: `PROMOTION_FAILURE_MUTATION_STATE_UNKNOWN:${error instanceof Error ? error.message : String(error)}`,
            mutation_state: "UNKNOWN_FORMAL_MUTATION",
            formal_database_write_count: null,
            cause: error,
          });
      const unsafeMutationState: Exclude<ExternalFormalExactBasePromotionMutationStateV1, "NO_FORMAL_MUTATION"> =
        failure.mutation_state === "PARTIAL_FORMAL_MUTATION"
          ? "PARTIAL_FORMAL_MUTATION"
          : "UNKNOWN_FORMAL_MUTATION";
      const terminalReason = `FORMAL_PROMOTION_MUTATION_UNSAFE:${unsafeMutationState}:${failure.failure_class}`;
      await this.lifecycle.recordTerminal({ lease: controllerLease, reason: terminalReason });
      return {
        service_id: MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1,
        status: "TERMINAL_PROMOTION_MUTATION_UNSAFE",
        base_target_t: base,
        failure_class: failure.failure_class,
        mutation_state: unsafeMutationState,
        formal_database_write_count: failure.formal_database_write_count,
        controller_fencing_token: controllerLease.fencing_token.toString(),
        forcing_controller_terminal_recorded: true,
      };
    }

    if (promotionHeartbeatError) {
      return {
        service_id: MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1,
        status: "PROMOTION_COMMITTED_ATTESTATION_PENDING_RECOVERY",
        base_target_t: base,
        failure_class: `PROMOTION_COMMITTED_HEARTBEAT_AUTHORITY_LOST:${promotionHeartbeatError instanceof Error ? promotionHeartbeatError.message : String(promotionHeartbeatError)}`,
        promotion_run_id: promoted.promotion_run_id,
        facts: promoted.facts,
        controller_fencing_token: controllerLease.fencing_token.toString(),
        producer_fencing_token: producerClaim.fencing_token.toString(),
        formal_fact_present_count: 3,
        database_fence_commit_succeeded: true,
        cursor_advanced: false,
      };
    }

    try {
      const attested = await this.continuity.attestFormalPhysicalVisibilityUnderController({
        controller_lease: controllerLease,
        claim: producerClaim,
        facts: promoted.facts,
        producer_run_id: capture.producer_run_id,
        promotion_run_id: promoted.promotion_run_id,
        candidate_artifact_digest: capture.candidate_artifact_digest,
      });

      return {
        service_id: MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1,
        status: "COMPLETED_BASE",
        base_target_t: base,
        controller_fencing_token: controllerLease.fencing_token.toString(),
        producer_fencing_token: producerClaim.fencing_token.toString(),
        controller_heartbeat_count: controllerHeartbeatCount,
        producer_heartbeat_count: producerHeartbeatCount,
        candidate_artifact_digest: capture.candidate_artifact_digest,
        producer_run_id: capture.producer_run_id,
        promotion_run_id: promoted.promotion_run_id,
        next_missing_required_base: attested.next_missing_required_base,
        wall_clock_target_planner_used: false,
      };
    } catch (error) {
      if (authorityLoss(error)) {
        return {
          service_id: MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1,
          status: "PROMOTION_COMMITTED_ATTESTATION_PENDING_RECOVERY",
          base_target_t: base,
          failure_class: `ATTESTATION_AUTHORITY_LOST_AFTER_FENCED_COMMIT:${error instanceof Error ? error.message : String(error)}`,
          promotion_run_id: promoted.promotion_run_id,
          facts: promoted.facts,
          controller_fencing_token: controllerLease.fencing_token.toString(),
          producer_fencing_token: producerClaim.fencing_token.toString(),
          formal_fact_present_count: 3,
          database_fence_commit_succeeded: true,
          cursor_advanced: false,
        };
      }
      const failureClass = `PHYSICAL_ATTESTATION_AFTER_FORMAL_PROMOTION_FAILED:${error instanceof Error ? error.message : String(error)}`;
      await this.lifecycle.recordTerminal({
        lease: controllerLease,
        reason: `FORMAL_PROMOTION_MUTATION_UNSAFE:PARTIAL_FORMAL_MUTATION:${failureClass}`,
      });
      return {
        service_id: MCFT_CAP09_AUTONOMOUS_FORCING_CONTROLLER_SERVICE_ID_V1,
        status: "TERMINAL_PROMOTION_MUTATION_UNSAFE",
        base_target_t: base,
        failure_class: failureClass,
        mutation_state: "PARTIAL_FORMAL_MUTATION",
        formal_database_write_count: promoted.formal_database_write_count,
        controller_fencing_token: controllerLease.fencing_token.toString(),
        forcing_controller_terminal_recorded: true,
      };
    }
  }
}
