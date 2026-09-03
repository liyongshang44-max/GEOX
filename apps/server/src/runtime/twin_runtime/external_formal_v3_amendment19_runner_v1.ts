// Purpose: Amendment-19 production runner for one manifest-pinned V3 slot.
// Boundary: same persistent scheduler/repositories/lease-fencing/tick graph as Formal; no provider/R2 fetch, no timer loop, no implicit-latest config selection.
// Evidence is always frozen at the selected slot's logical UTC boundary T, including oldest-first backfill.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import type { MaterializedExternalFormalA18CropContextV2 } from "./external_formal_a18_crop_context_v2.js";
import type { MaterializedExternalFormalA18CropContextV3 } from "./external_formal_a18_crop_context_v3.js";
import type {
  ExecuteExternalFormalV3Amendment19PersistentTickResultV1,
  ExternalFormalV3Amendment19DatabaseEvidenceSourcePortV1,
  ExternalFormalV3Amendment19ManifestSlotPinV1,
  ExternalFormalV3Amendment19PersistentTickServiceV1,
} from "./external_formal_v3_amendment19_persistent_tick_service_v1.js";
import type {
  RuntimeConfigRepositoryPortV1,
  SchedulerPortV1,
  ShadowOnlineBoundaryV1,
  ShadowOnlineSlotIdV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1 = "MCFT_CAP09_EXTERNAL_FORMAL_V3_AM19_RUNNER_V1" as const;
export const EXTERNAL_FORMAL_V3_AM19_RUNNER_WATERMARK_ID_V1 = "PROVIDER_AVAILABILITY_WATERMARK_V1" as const;

type MaterializedExternalFormalA18CropContextSuccessorV1 =
  | MaterializedExternalFormalA18CropContextV2
  | MaterializedExternalFormalA18CropContextV3;

export type ExternalFormalV3Am19ManifestSlotPinV1 = ExternalFormalV3Amendment19ManifestSlotPinV1 & {
  parent_runtime_config_ref: string;
  parent_runtime_config_hash: string;
  crop_stage_context_materialization_hash: string;
};

export type ExternalFormalV3Am19WindowManifestV1 = {
  manifest_ref: string;
  manifest_hash: string;
  epoch_id: string;
  database_name: string;
  scope: TwinScopeKeyV1;
  o00_logical_time: string;
  o23_logical_time: string;
  slots: readonly ExternalFormalV3Am19ManifestSlotPinV1[];
};

export interface ExternalFormalV3Am19CropContextMaterializerPortV1 {
  materialize(input: {
    logical_time: string;
    expected_identity_hash: string;
  }): Promise<MaterializedExternalFormalA18CropContextSuccessorV1> | MaterializedExternalFormalA18CropContextSuccessorV1;
}

type SchedulerPortSubsetV1 = Pick<SchedulerPortV1, "listMissedSlots" | "claimDueSlot" | "recordTerminalResult">;
type RuntimeConfigReadPortV1 = Pick<RuntimeConfigRepositoryPortV1, "readRuntimeConfig">;
type TickServicePortV1 = Pick<ExternalFormalV3Amendment19PersistentTickServiceV1, "executeClaimedTick">;

export type ExecuteExternalFormalV3Am19RunnerInputV1 = {
  through_logical_time: string;
  observer_started_at: string;
  lease_owner: string;
  lease_duration_seconds: number;
};

export type ExecuteExternalFormalV3Am19RunnerResultV1 =
  | {
      runner_id: typeof EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1;
      status: "NO_DUE_SLOT";
      claim_attempted: false;
      provider_request_count: 0;
      r2_request_count: 0;
    }
  | {
      runner_id: typeof EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1;
      status: "NOT_READY_PRECLAIM";
      slot_id: ShadowOnlineSlotIdV1;
      logical_time: string;
      reason: "RUNTIME_CONFIG_MISSING" | "RUNTIME_CONFIG_PIN_MISMATCH" | "CROP_CONTEXT_BINDING_FAILED" | "EVIDENCE_PRECHECK_FAILED";
      detail: string;
      claim_attempted: false;
      provider_request_count: 0;
      r2_request_count: 0;
    }
  | {
      runner_id: typeof EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1;
      status: "COMPLETED" | "DEGRADED";
      slot_id: ShadowOnlineSlotIdV1;
      logical_time: string;
      claim_attempted: true;
      terminal_result_recorded: true;
      tick_result: ExecuteExternalFormalV3Amendment19PersistentTickResultV1;
      provider_request_count: 0;
      r2_request_count: 0;
    }
  | {
      runner_id: typeof EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1;
      status: "BLOCKED_TERMINAL_RECORDED" | "FAILED_TERMINAL_RECORDED";
      slot_id: ShadowOnlineSlotIdV1;
      logical_time: string;
      detail: string;
      claim_attempted: true;
      terminal_result_recorded: true;
      provider_request_count: 0;
      r2_request_count: 0;
    };

function canonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function requiredTextV1(value: string, code: string): string {
  if (!String(value || "").trim()) throw new Error(code);
  return value;
}

function sameScopeV1(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return (["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const)
    .every((key) => left[key] === right[key]);
}

function errorDetailV1(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "UNKNOWN_ERROR";
}

function blockedByMissingCurrentForcingV1(error: unknown): boolean {
  return error instanceof Error && error.message === "AMENDMENT19_NO_CAUSAL_CURRENT_INTERVAL_FORCING_PAIR";
}

function computeMaterializationHashV1(materialized: MaterializedExternalFormalA18CropContextSuccessorV1): string {
  return semanticHashV1({
    materialization_profile: materialized.materialization_profile,
    context_ref: materialized.context_ref,
    context_identity_hash: materialized.context_identity_hash,
    materialized_context: materialized.context,
  });
}

function manifestSlotForBoundaryV1(
  manifest: ExternalFormalV3Am19WindowManifestV1,
  boundary: ShadowOnlineBoundaryV1,
): ExternalFormalV3Am19ManifestSlotPinV1 {
  if (!sameScopeV1(boundary.scope, manifest.scope)) throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_BOUNDARY_SCOPE_MISMATCH");
  const matches = manifest.slots.filter((slot) => slot.slot_id === boundary.slot_id && slot.logical_time === boundary.logical_time);
  if (matches.length !== 1) throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_EXACT_MANIFEST_SLOT_REQUIRED");
  const slot = matches[0]!;
  if (slot.manifest_ref !== manifest.manifest_ref || slot.manifest_hash !== manifest.manifest_hash || slot.epoch_id !== manifest.epoch_id) {
    throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_MANIFEST_IDENTITY_MISMATCH");
  }
  return slot;
}

function exactRuntimeConfigPreclaimV1(config: CanonicalObjectEnvelopeV1, slot: ExternalFormalV3Am19ManifestSlotPinV1): void {
  if (config.object_id !== slot.runtime_config_ref || config.determinism_hash !== slot.runtime_config_hash) {
    throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_RUNTIME_CONFIG_PIN_MISMATCH");
  }
  const payload = config.payload as Record<string, unknown>;
  if (payload.effective_logical_time !== slot.logical_time) throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_RUNTIME_CONFIG_TIME_MISMATCH");
  if (payload.parent_runtime_config_ref !== slot.parent_runtime_config_ref || payload.parent_runtime_config_hash !== slot.parent_runtime_config_hash) {
    throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_RUNTIME_CONFIG_PARENT_MISMATCH");
  }
  const crop = payload.crop_stage_context_authority as Record<string, unknown> | undefined;
  if (!crop || crop.context_ref !== slot.crop_stage_context_ref || crop.context_hash !== slot.crop_stage_context_hash) {
    throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_RUNTIME_CONFIG_CROP_BINDING_MISMATCH");
  }
  if (payload.config_selection_mode !== "EXPLICIT_REF_HASH_PIN_ONLY") throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_EXPLICIT_CONFIG_PIN_REQUIRED");
}

export class ExternalFormalV3Amendment19RunnerV1 {
  constructor(
    private readonly manifest: ExternalFormalV3Am19WindowManifestV1,
    private readonly scheduler: SchedulerPortSubsetV1,
    private readonly runtimeConfigRepository: RuntimeConfigReadPortV1,
    private readonly cropContextMaterializer: ExternalFormalV3Am19CropContextMaterializerPortV1,
    private readonly evidenceSource: ExternalFormalV3Amendment19DatabaseEvidenceSourcePortV1,
    private readonly tickService: TickServicePortV1,
  ) {
    if (!sameScopeV1(manifest.scope, { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 })) throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_EXACT_SCOPE_REQUIRED");
    if (manifest.slots.length !== 24) throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_EXACT_24_MANIFEST_SLOTS_REQUIRED");
  }

  async executeOneDueSlot(input: ExecuteExternalFormalV3Am19RunnerInputV1): Promise<ExecuteExternalFormalV3Am19RunnerResultV1> {
    const throughLogicalTime = canonicalIsoV1(input.through_logical_time, "EXTERNAL_FORMAL_AM19_RUNNER_THROUGH_TIME_INVALID");
    const observerStartedAt = canonicalIsoV1(input.observer_started_at, "EXTERNAL_FORMAL_AM19_RUNNER_OBSERVER_TIME_INVALID");
    requiredTextV1(input.lease_owner, "EXTERNAL_FORMAL_AM19_RUNNER_LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0 || input.lease_duration_seconds > 3600) {
      throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_LEASE_DURATION_INVALID");
    }

    const due = await this.scheduler.listMissedSlots({ scope: this.manifest.scope, through_logical_time: throughLogicalTime });
    if (due.length === 0) {
      return { runner_id: EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1, status: "NO_DUE_SLOT", claim_attempted: false, provider_request_count: 0, r2_request_count: 0 };
    }

    const boundary = due[0]!;
    const slot = manifestSlotForBoundaryV1(this.manifest, boundary);
    const snapshotTime = slot.logical_time;
    if (Date.parse(observerStartedAt) < Date.parse(boundary.scheduler_wall_clock_observed_at)) {
      throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_OBSERVER_BEFORE_SCHEDULER_OBSERVATION");
    }

    const runtimeConfig = await this.runtimeConfigRepository.readRuntimeConfig(slot.runtime_config_ref);
    if (!runtimeConfig) {
      return { runner_id: EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1, status: "NOT_READY_PRECLAIM", slot_id: slot.slot_id, logical_time: slot.logical_time, reason: "RUNTIME_CONFIG_MISSING", detail: slot.runtime_config_ref, claim_attempted: false, provider_request_count: 0, r2_request_count: 0 };
    }
    try {
      exactRuntimeConfigPreclaimV1(runtimeConfig, slot);
    } catch (error) {
      return { runner_id: EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1, status: "NOT_READY_PRECLAIM", slot_id: slot.slot_id, logical_time: slot.logical_time, reason: "RUNTIME_CONFIG_PIN_MISMATCH", detail: errorDetailV1(error), claim_attempted: false, provider_request_count: 0, r2_request_count: 0 };
    }

    let materialized: MaterializedExternalFormalA18CropContextSuccessorV1;
    try {
      materialized = await this.cropContextMaterializer.materialize({ logical_time: slot.logical_time, expected_identity_hash: slot.crop_stage_context_hash });
      if (materialized.context_ref !== slot.crop_stage_context_ref || materialized.context_identity_hash !== slot.crop_stage_context_hash || materialized.logical_time !== slot.logical_time) {
        throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_CROP_CONTEXT_IDENTITY_MISMATCH");
      }
      const independentMaterializationHash = computeMaterializationHashV1(materialized);
      if (materialized.context_materialization_hash !== independentMaterializationHash || independentMaterializationHash !== slot.crop_stage_context_materialization_hash) {
        throw new Error("EXTERNAL_FORMAL_AM19_RUNNER_CROP_CONTEXT_MATERIALIZATION_HASH_MISMATCH");
      }
    } catch (error) {
      return { runner_id: EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1, status: "NOT_READY_PRECLAIM", slot_id: slot.slot_id, logical_time: slot.logical_time, reason: "CROP_CONTEXT_BINDING_FAILED", detail: errorDetailV1(error), claim_attempted: false, provider_request_count: 0, r2_request_count: 0 };
    }

    try {
      await this.evidenceSource.loadCandidateRecords({ scope: this.manifest.scope, logical_time: slot.logical_time, evidence_snapshot_time: snapshotTime });
    } catch (error) {
      return { runner_id: EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1, status: "NOT_READY_PRECLAIM", slot_id: slot.slot_id, logical_time: slot.logical_time, reason: "EVIDENCE_PRECHECK_FAILED", detail: errorDetailV1(error), claim_attempted: false, provider_request_count: 0, r2_request_count: 0 };
    }

    const claim = await this.scheduler.claimDueSlot({ boundary, lease_owner: input.lease_owner, lease_duration_seconds: input.lease_duration_seconds });
    try {
      const tickResult = await this.tickService.executeClaimedTick({
        claim,
        manifest_slot: slot,
        crop_stage_context: materialized.context,
        evidence_snapshot_time: snapshotTime,
        observer_started_at: observerStartedAt,
        lease_duration_seconds: input.lease_duration_seconds,
      });
      const terminalState = tickResult.runtime_health === "DEGRADED" ? "DEGRADED" as const : "COMPLETED" as const;
      await this.scheduler.recordTerminalResult({
        claim,
        result: {
          boundary: claim.boundary,
          state: terminalState,
          tick_ref: tickResult.a_record_set.record_set_id,
          health_ref: `${EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1}:${slot.slot_id}:${tickResult.runtime_health}`,
          terminal_at: observerStartedAt,
        },
      });
      return {
        runner_id: EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1,
        status: terminalState,
        slot_id: slot.slot_id,
        logical_time: slot.logical_time,
        claim_attempted: true,
        terminal_result_recorded: true,
        tick_result: tickResult,
        provider_request_count: 0,
        r2_request_count: 0,
      };
    } catch (error) {
      const blocked = blockedByMissingCurrentForcingV1(error);
      await this.scheduler.recordTerminalResult({
        claim,
        result: {
          boundary: claim.boundary,
          state: "FAILED",
          tick_ref: null,
          health_ref: `${EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1}:${slot.slot_id}:${blocked ? "BLOCKED_NO_CAUSAL_FORCING" : "FAILED"}`,
          terminal_at: observerStartedAt,
        },
      });
      return {
        runner_id: EXTERNAL_FORMAL_V3_AM19_RUNNER_ID_V1,
        status: blocked ? "BLOCKED_TERMINAL_RECORDED" : "FAILED_TERMINAL_RECORDED",
        slot_id: slot.slot_id,
        logical_time: slot.logical_time,
        detail: errorDetailV1(error),
        claim_attempted: true,
        terminal_result_recorded: true,
        provider_request_count: 0,
        r2_request_count: 0,
      };
    }
  }
}
