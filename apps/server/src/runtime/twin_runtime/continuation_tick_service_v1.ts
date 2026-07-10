// apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.ts
// Purpose: execute exactly one explicit MCFT-CAP-02 Replay continuation tick through persisted handoff, pinned config, exact-hour Evidence, pure Dynamics, canonical candidate construction, A2 persistence, readback, and next handoff.
// Boundary: one requested tick only; no range loop, restart mode, backfill, public route, wall-clock logical time, scheduler, successful Forecast, Scenario, Recommendation, or action.

import type { ExecutedIrrigationCandidateV1 } from "../../domain/soil_water/executed_irrigation_input_v1.js";
import {
  buildHourlyWaterBalanceConfigFromContinuationRuntimeConfigV1,
  executeHourlyWaterBalanceV1,
  type HourlyWaterBalanceResultV1,
} from "../../domain/soil_water/hourly_water_balance_v1.js";
import { normalizeFixedDecimalV1, WATER_AMOUNT_SCALE_V1 } from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import { validateContinuationRecordSetV1 } from "../../domain/twin_runtime/continuation_cross_ref_validator_v1.js";
import {
  CONTINUATION_OPERATION_VARIANT_V1,
  deriveContinuationOperationIdentityV1,
} from "../../domain/twin_runtime/continuation_operation_identity_v1.js";
import type { ContinuationRecordSetV1 } from "../../domain/twin_runtime/continuation_record_set_identity_v1.js";
import { validateContinuationRuntimeConfigPayloadV1 } from "../../domain/twin_runtime/continuation_runtime_config_v1.js";
import {
  buildContinuationEvidenceWindowV1,
  type ContinuationCropStageConfigurationContextV1,
  type ContinuationEvidenceWindowV1,
} from "./continuation_evidence_window_service_v1.js";
import { buildContinuationRecordSetV1 } from "./continuation_record_set_builder_v1.js";
import { PrepareNextTickInputServiceV1 } from "./next_tick_input_service_v1.js";
import type {
  BootstrapPersistencePortV1,
  ContinuationPersistencePortV1,
  FaultInjectionStageV1,
  PreparedNextTickInputV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  TwinScopeKeyV1,
} from "./ports.js";

export type SingleTickPersistencePortV1 = ContinuationPersistencePortV1
  & Pick<BootstrapPersistencePortV1, "acquireLease">;

export type ExecuteContinuationTickInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  continuation_runtime_config_ref: string;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  lease_owner: string;
  lease_duration_seconds: number;
  fault_injection?: (stage: FaultInjectionStageV1) => void;
};

export type ExecuteContinuationTickResultV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  record_set: ContinuationRecordSetV1;
  evidence_window: ContinuationEvidenceWindowV1 | null;
  dynamics: HourlyWaterBalanceResultV1 | null;
  next_handoff: PreparedNextTickInputV1;
};

type ScopeLikeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string | null;
  field_id: string;
  season_id: string | null;
  zone_id: string | null;
};

function requiredCanonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredFiniteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function exactScopeV1(actual: ScopeLikeV1, expected: TwinScopeKeyV1, code: string): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[key] !== expected[key]) throw new Error(`${code}:${key}`);
  }
}

function executionCandidatesV1(window: ContinuationEvidenceWindowV1): ExecutedIrrigationCandidateV1[] {
  return window.irrigation_execution_records.map((record) => ({
    binding_id: record.binding_id,
    origin_source_id: record.origin_source_id,
    scope: {
      tenant_id: record.tenant_id,
      project_id: record.project_id,
      group_id: record.group_id,
      field_id: record.field_id,
      season_id: record.season_id,
      zone_id: record.zone_id,
    },
    event_id: requiredStringV1(record.canonical_payload.event_id, "EXECUTION_EVENT_ID_REQUIRED"),
    source_record_id: record.source_record_id,
    executed_at: requiredStringV1(record.role_time.executed_at, "EXECUTION_EXECUTED_AT_REQUIRED"),
    ingested_at: requiredStringV1(record.role_time.ingested_at, "EXECUTION_INGESTED_AT_REQUIRED"),
    executed_amount_mm: normalizeFixedDecimalV1(
      String(requiredFiniteNumberV1(record.canonical_payload.executed_amount_mm, "EXECUTION_AMOUNT_REQUIRED")),
      WATER_AMOUNT_SCALE_V1,
    ),
    coverage_fraction: normalizeFixedDecimalV1(
      String(requiredFiniteNumberV1(record.canonical_payload.coverage_fraction, "EXECUTION_COVERAGE_REQUIRED")),
      WATER_AMOUNT_SCALE_V1,
    ),
    eligible_for_state_input: true,
    source_quality: "USABLE",
    execution_status: "EXECUTED",
  }));
}

function memberRefV1(recordSet: ContinuationRecordSetV1, objectType: string): string {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CONTINUATION_MEMBER_TYPE_CARDINALITY:${objectType}`);
  return matches[0].object_id;
}

export class ContinuationTickServiceV1 {
  constructor(
    private readonly handoffService: PrepareNextTickInputServiceV1,
    private readonly evidenceSource: ReplayEvidenceSourcePortV1,
    private readonly runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    private readonly persistence: SingleTickPersistencePortV1,
  ) {}

  async executeOneTick(input: ExecuteContinuationTickInputV1): Promise<ExecuteContinuationTickResultV1> {
    const logicalTime = requiredCanonicalIsoV1(input.logical_time, "SINGLE_TICK_LOGICAL_TIME_INVALID");
    requiredCanonicalIsoV1(input.created_at, "SINGLE_TICK_CREATED_AT_INVALID");
    if (!input.lease_owner.trim()) throw new Error("SINGLE_TICK_LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0) {
      throw new Error("SINGLE_TICK_LEASE_DURATION_INVALID");
    }

    const handoff = await this.handoffService.prepareNextTickInput(input.scope);
    const requestedIdentity = deriveContinuationOperationIdentityV1({
      scope: structuredClone(input.scope),
      lineage_id: handoff.lineage_id,
      revision_id: handoff.revision_id,
      logical_time: logicalTime,
      operation_variant: CONTINUATION_OPERATION_VARIANT_V1,
    });
    const previouslyCommitted = await this.persistence.lookupContinuationRecordSet(
      requestedIdentity.continuation_idempotency_key,
    );
    if (previouslyCommitted) {
      validateContinuationRecordSetV1(previouslyCommitted);
      const nextHandoff = await this.handoffService.prepareNextTickInput(input.scope);
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        record_set: previouslyCommitted,
        evidence_window: null,
        dynamics: null,
        next_handoff: nextHandoff,
      };
    }

    if (handoff.next_logical_tick_time !== logicalTime) {
      throw new Error("REQUESTED_TICK_NOT_NEXT_PERSISTED_TICK");
    }

    const runtimeConfig = await this.runtimeConfigRepository.readRuntimeConfig(
      input.continuation_runtime_config_ref,
    );
    if (!runtimeConfig) throw new Error("CONTINUATION_RUNTIME_CONFIG_NOT_FOUND");
    if (runtimeConfig.object_type !== "twin_runtime_config_v1") {
      throw new Error("CONTINUATION_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
    }
    exactScopeV1(runtimeConfig, input.scope, "CONTINUATION_RUNTIME_CONFIG_SCOPE_MISMATCH");
    validateContinuationRuntimeConfigPayloadV1(runtimeConfig.payload);
    if (runtimeConfig.logical_time > logicalTime) throw new Error("CONTINUATION_RUNTIME_CONFIG_FROM_FUTURE_FORBIDDEN");
    if (handoff.previous_variance_basis.basis_origin === "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1") {
      if (runtimeConfig.payload.parent_runtime_config_ref !== handoff.previous_state_runtime_config_ref) {
        throw new Error("CONTINUATION_PARENT_RUNTIME_CONFIG_REF_MISMATCH");
      }
      if (runtimeConfig.payload.parent_runtime_config_hash !== handoff.previous_state_runtime_config_hash) {
        throw new Error("CONTINUATION_PARENT_RUNTIME_CONFIG_HASH_MISMATCH");
      }
    } else {
      if (runtimeConfig.object_id !== handoff.previous_state_runtime_config_ref) {
        throw new Error("CONTINUATION_RUNTIME_CONFIG_REF_MISMATCH");
      }
      if (runtimeConfig.determinism_hash !== handoff.previous_state_runtime_config_hash) {
        throw new Error("CONTINUATION_RUNTIME_CONFIG_HASH_MISMATCH");
      }
    }
    if (
      runtimeConfig.payload.reality_binding_ref !== handoff.reality_binding_ref
      || runtimeConfig.payload.reality_binding_hash !== handoff.reality_binding_hash
    ) throw new Error("CONTINUATION_REALITY_BINDING_MISMATCH");

    const candidateRecords = await this.evidenceSource.loadCandidateRecords({
      scope: input.scope,
      logical_time: logicalTime,
    });
    const evidenceWindow = buildContinuationEvidenceWindowV1({
      scope: input.scope,
      logical_time: logicalTime,
      candidate_records: candidateRecords,
      crop_stage_context_ref: input.crop_stage_context_ref,
      crop_stage_context_hash: input.crop_stage_context_hash,
      crop_stage_context: input.crop_stage_context,
    });

    const rainfallValue = requiredFiniteNumberV1(
      evidenceWindow.rainfall_record.canonical_payload.value,
      "SINGLE_TICK_RAINFALL_VALUE_REQUIRED",
    );
    const et0Value = requiredFiniteNumberV1(
      evidenceWindow.historical_et0_record.canonical_payload.value,
      "SINGLE_TICK_ET0_VALUE_REQUIRED",
    );
    const dynamics = executeHourlyWaterBalanceV1({
      interval_start_exclusive: evidenceWindow.window_start_exclusive,
      interval_end_inclusive: evidenceWindow.window_end_inclusive,
      previous_storage_mm_decimal: handoff.previous_storage_mm_decimal,
      previous_variance_basis: handoff.previous_variance_basis,
      gross_rainfall_mm_decimal: normalizeFixedDecimalV1(String(rainfallValue), WATER_AMOUNT_SCALE_V1),
      historical_et0_mm_decimal: normalizeFixedDecimalV1(String(et0Value), WATER_AMOUNT_SCALE_V1),
      crop_stage_code: evidenceWindow.crop_stage_context.stage_code,
      kc_decimal: normalizeFixedDecimalV1(String(evidenceWindow.crop_stage_context.kc), WATER_AMOUNT_SCALE_V1),
      executed_irrigation_candidates: executionCandidatesV1(evidenceWindow),
      config: buildHourlyWaterBalanceConfigFromContinuationRuntimeConfigV1(runtimeConfig.payload),
    });

    const candidate = buildContinuationRecordSetV1({
      scope: input.scope,
      logical_time: logicalTime,
      created_at: input.created_at,
      handoff,
      runtime_config: runtimeConfig,
      evidence_window: evidenceWindow,
      dynamics,
    });

    const existingAfterBuild = await this.persistence.lookupContinuationRecordSet(
      candidate.continuation_idempotency_key,
    );
    if (existingAfterBuild) {
      validateContinuationRecordSetV1(existingAfterBuild);
      if (
        existingAfterBuild.continuation_record_set_determinism_hash
        !== candidate.continuation_record_set_determinism_hash
      ) throw new Error("IDEMPOTENCY_CONFLICT");
      const nextHandoff = await this.handoffService.prepareNextTickInput(input.scope);
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        record_set: existingAfterBuild,
        evidence_window: evidenceWindow,
        dynamics,
        next_handoff: nextHandoff,
      };
    }

    const lease = await this.persistence.acquireLease({
      ...input.scope,
      lease_owner: input.lease_owner,
      lease_duration_seconds: input.lease_duration_seconds,
    });
    const committed = await this.persistence.commitContinuationState({
      scope: input.scope,
      lease,
      expected: {
        active_lineage_ref: handoff.active_lineage_ref,
        lineage_id: handoff.lineage_id,
        revision_id: handoff.revision_id,
        previous_checkpoint_ref: handoff.previous_checkpoint_ref,
        previous_state_ref: handoff.previous_posterior_ref,
        previous_forecast_result_ref: handoff.previous_forecast_result_ref,
        latest_successful_forecast_ref: null,
      },
      record_set: candidate,
      fault_injection: input.fault_injection,
    });

    const readback = await this.persistence.readContinuationRecordSet(
      candidate.continuation_record_set_id,
    );
    if (!readback) throw new Error("CONTINUATION_CANONICAL_READBACK_NOT_FOUND");
    validateContinuationRecordSetV1(readback);
    if (
      readback.continuation_record_set_determinism_hash
      !== candidate.continuation_record_set_determinism_hash
    ) throw new Error("CONTINUATION_CANONICAL_READBACK_HASH_MISMATCH");

    const nextHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    if (nextHandoff.previous_posterior_ref !== memberRefV1(readback, "twin_state_estimate_v1")) {
      throw new Error("NEXT_HANDOFF_STATE_REF_MISMATCH");
    }
    if (nextHandoff.previous_checkpoint_ref !== memberRefV1(readback, "twin_runtime_checkpoint_v1")) {
      throw new Error("NEXT_HANDOFF_CHECKPOINT_REF_MISMATCH");
    }
    if (nextHandoff.next_logical_tick_time !== new Date(Date.parse(logicalTime) + 60 * 60 * 1000).toISOString()) {
      throw new Error("NEXT_HANDOFF_LOGICAL_TIME_MISMATCH");
    }

    return {
      status: committed.status,
      record_set: readback,
      evidence_window: evidenceWindow,
      dynamics,
      next_handoff: nextHandoff,
    };
  }
}
