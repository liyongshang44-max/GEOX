// apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v1.ts
// Purpose: execute exactly one explicit MCFT-CAP-03 Replay tick from persisted predecessor authority through Dynamics, observation assimilation, A2 persistence, canonical readback, and T+1 handoff.
// Boundary: one requested next tick only; no range loop, restart/backfill mode, route, scheduler, wall-clock logical time, successful Forecast, Scenario, Recommendation, Decision, action, calibration, or model activation.

import type { ExecutedIrrigationCandidateV1 } from "../../domain/soil_water/executed_irrigation_input_v1.js";
import {
  executeHourlyWaterBalanceV1,
  type HourlyWaterBalanceConfigV1,
  type HourlyWaterBalanceResultV1,
} from "../../domain/soil_water/hourly_water_balance_v1.js";
import {
  composeAssimilatedContinuationPosteriorV1,
  type AssimilatedContinuationPosteriorV1,
} from "../../domain/soil_water/assimilated_continuation_posterior_v1.js";
import { normalizeFixedDecimalV1, WATER_AMOUNT_SCALE_V1 } from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import { validateAssimilatedContinuationCrossReferencesV1 } from "../../domain/twin_runtime/assimilated_continuation_cross_ref_validator_v1.js";
import type { AssimilatedContinuationRecordSetV1 } from "../../domain/twin_runtime/assimilated_continuation_record_set_identity_v1.js";
import {
  validateAssimilatedContinuationRuntimeConfigPayloadV1,
  type AssimilatedContinuationRuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import {
  CONTINUATION_OPERATION_VARIANT_V1,
  deriveContinuationOperationIdentityV1,
} from "../../domain/twin_runtime/continuation_operation_identity_v1.js";
import {
  buildAssimilatedContinuationEvidenceWindowV1,
  finalizeAssimilatedContinuationEvidenceWindowV1,
  type AssimilatedContinuationEvidenceWindowV1,
} from "./assimilated_continuation_evidence_window_v1.js";
import { buildAssimilatedContinuationRecordSetV1 } from "./assimilated_continuation_record_set_builder_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "./next_tick_input_service_v1.js";
import type {
  AssimilatedContinuationPersistencePortV1,
  BootstrapPersistencePortV1,
  FaultInjectionStageV1,
  PreparedNextTickInputV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  TwinScopeKeyV1,
} from "./ports.js";

export type AssimilatedSingleTickPersistencePortV1 = AssimilatedContinuationPersistencePortV1
  & Pick<BootstrapPersistencePortV1, "acquireLease">;

export type ExecuteAssimilatedContinuationTickInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  assimilated_runtime_config_ref: string;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  lease_owner: string;
  lease_duration_seconds: number;
  fault_injection?: (stage: FaultInjectionStageV1) => void;
};

export type ExecuteAssimilatedContinuationTickResultV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  record_set: AssimilatedContinuationRecordSetV1;
  evidence_window: AssimilatedContinuationEvidenceWindowV1 | null;
  dynamics: HourlyWaterBalanceResultV1 | null;
  assimilation: AssimilatedContinuationPosteriorV1 | null;
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

function executionCandidatesV1(window: AssimilatedContinuationEvidenceWindowV1): ExecutedIrrigationCandidateV1[] {
  return window.base_continuation_window.irrigation_execution_records.map((record) => ({
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
    event_id: requiredStringV1(record.canonical_payload.event_id, "ASSIMILATED_TICK_EXECUTION_EVENT_ID_REQUIRED"),
    source_record_id: record.source_record_id,
    executed_at: requiredStringV1(record.role_time.executed_at, "ASSIMILATED_TICK_EXECUTION_EXECUTED_AT_REQUIRED"),
    ingested_at: requiredStringV1(record.role_time.ingested_at, "ASSIMILATED_TICK_EXECUTION_INGESTED_AT_REQUIRED"),
    executed_amount_mm: normalizeFixedDecimalV1(
      String(requiredFiniteNumberV1(record.canonical_payload.executed_amount_mm, "ASSIMILATED_TICK_EXECUTION_AMOUNT_REQUIRED")),
      WATER_AMOUNT_SCALE_V1,
    ),
    coverage_fraction: normalizeFixedDecimalV1(
      String(requiredFiniteNumberV1(record.canonical_payload.coverage_fraction, "ASSIMILATED_TICK_EXECUTION_COVERAGE_REQUIRED")),
      WATER_AMOUNT_SCALE_V1,
    ),
    eligible_for_state_input: true,
    source_quality: "USABLE",
    execution_status: "EXECUTED",
  }));
}

function dynamicsConfigV1(config: AssimilatedContinuationRuntimeConfigPayloadV1): HourlyWaterBalanceConfigV1 {
  return {
    root_zone_depth_mm: config.soil_hydraulic_snapshot.root_zone_depth_mm.toFixed(6),
    wilting_point_storage_mm: config.soil_hydraulic_snapshot.wilting_point_storage_mm.toFixed(6),
    field_capacity_storage_mm: config.soil_hydraulic_snapshot.field_capacity_storage_mm.toFixed(6),
    saturation_storage_mm: config.soil_hydraulic_snapshot.saturation_storage_mm.toFixed(6),
    saturation_fraction: config.soil_hydraulic_snapshot.saturation_fraction.toFixed(6),
    runoff_fraction: config.dynamics_parameters.runoff_fraction.toFixed(6),
    drainage_coefficient_per_hour: config.dynamics_parameters.drainage_coefficient_per_hour.toFixed(6),
    structural_process_stddev_mm_per_hour:
      config.process_uncertainty.structural_process_stddev_mm_per_hour.toFixed(6),
    rainfall_relative_stddev: config.process_uncertainty.rainfall_relative_stddev.toFixed(6),
    crop_et_relative_stddev: config.process_uncertainty.crop_et_relative_stddev.toFixed(6),
    executed_irrigation_relative_stddev:
      config.process_uncertainty.executed_irrigation_relative_stddev.toFixed(6),
  };
}

function memberV1(recordSet: AssimilatedContinuationRecordSetV1, objectType: string) {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`ASSIMILATED_TICK_MEMBER_TYPE_CARDINALITY:${objectType}`);
  return matches[0];
}

function memberRefV1(recordSet: AssimilatedContinuationRecordSetV1, objectType: string): string {
  return memberV1(recordSet, objectType).object_id;
}

function memberHashV1(recordSet: AssimilatedContinuationRecordSetV1, objectType: string): string {
  return memberV1(recordSet, objectType).determinism_hash;
}

function committedSequenceV1(recordSet: AssimilatedContinuationRecordSetV1): number {
  const value = memberV1(recordSet, "twin_runtime_checkpoint_v1").payload.tick_sequence;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("ASSIMILATED_TICK_COMMITTED_SEQUENCE_INVALID");
  }
  return value;
}

function assertNextHandoffV1(input: {
  record_set: AssimilatedContinuationRecordSetV1;
  handoff: PreparedNextTickInputV1;
  expected_next_time: string;
}): void {
  if (input.handoff.previous_posterior_ref !== memberRefV1(input.record_set, "twin_state_estimate_v1")) {
    throw new Error("ASSIMILATED_TICK_NEXT_HANDOFF_STATE_REF_MISMATCH");
  }
  if (input.handoff.previous_checkpoint_ref !== memberRefV1(input.record_set, "twin_runtime_checkpoint_v1")) {
    throw new Error("ASSIMILATED_TICK_NEXT_HANDOFF_CHECKPOINT_REF_MISMATCH");
  }
  if (input.handoff.previous_forecast_result_ref !== memberRefV1(input.record_set, "twin_forecast_run_v1")) {
    throw new Error("ASSIMILATED_TICK_NEXT_HANDOFF_FORECAST_REF_MISMATCH");
  }
  if (
    input.handoff.previous_forecast_result_hash
    !== memberHashV1(input.record_set, "twin_forecast_run_v1")
  ) {
    throw new Error("ASSIMILATED_TICK_NEXT_HANDOFF_FORECAST_HASH_MISMATCH");
  }
  if (input.handoff.next_logical_tick_time !== input.expected_next_time) {
    throw new Error("ASSIMILATED_TICK_NEXT_HANDOFF_LOGICAL_TIME_MISMATCH");
  }
  if (input.handoff.previous_tick_sequence !== committedSequenceV1(input.record_set)) {
    throw new Error("ASSIMILATED_TICK_NEXT_HANDOFF_SEQUENCE_MISMATCH");
  }
}

export class AssimilatedContinuationTickServiceV1 {
  constructor(
    private readonly handoffService: PrepareNextTickInputServiceV1,
    private readonly evidenceSource: ReplayEvidenceSourcePortV1,
    private readonly runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    private readonly persistence: AssimilatedSingleTickPersistencePortV1,
  ) {}

  async executeOneTick(
    input: ExecuteAssimilatedContinuationTickInputV1,
  ): Promise<ExecuteAssimilatedContinuationTickResultV1> {
    const logicalTime = requiredCanonicalIsoV1(
      input.logical_time,
      "ASSIMILATED_SINGLE_TICK_LOGICAL_TIME_INVALID",
    );
    requiredCanonicalIsoV1(input.created_at, "ASSIMILATED_SINGLE_TICK_CREATED_AT_INVALID");
    if (!input.lease_owner.trim()) throw new Error("ASSIMILATED_SINGLE_TICK_LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0) {
      throw new Error("ASSIMILATED_SINGLE_TICK_LEASE_DURATION_INVALID");
    }

    const handoff = await this.handoffService.prepareNextTickInput(input.scope);
    const requestedIdentity = deriveContinuationOperationIdentityV1({
      scope: structuredClone(input.scope),
      lineage_id: handoff.lineage_id,
      revision_id: handoff.revision_id,
      logical_time: logicalTime,
      operation_variant: CONTINUATION_OPERATION_VARIANT_V1,
    });
    const previouslyCommitted = await this.persistence.lookupAssimilatedContinuationRecordSet(
      requestedIdentity.continuation_idempotency_key,
    );
    if (previouslyCommitted) {
      validateAssimilatedContinuationCrossReferencesV1(previouslyCommitted);
      const nextHandoff = await this.handoffService.prepareNextTickInput(input.scope);
      assertNextHandoffV1({
        record_set: previouslyCommitted,
        handoff: nextHandoff,
        expected_next_time: new Date(Date.parse(logicalTime) + 60 * 60 * 1000).toISOString(),
      });
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        record_set: previouslyCommitted,
        evidence_window: null,
        dynamics: null,
        assimilation: null,
        next_handoff: nextHandoff,
      };
    }

    if (handoff.next_logical_tick_time !== logicalTime) {
      throw new Error("ASSIMILATED_REQUESTED_TICK_NOT_NEXT_PERSISTED_TICK");
    }
    const previousForecastResultHash = requiredStringV1(
      handoff.previous_forecast_result_hash,
      "ASSIMILATED_PREDECESSOR_FORECAST_HASH_REQUIRED",
    );

    const runtimeConfig = await this.runtimeConfigRepository.readRuntimeConfig(
      input.assimilated_runtime_config_ref,
    );
    if (!runtimeConfig) throw new Error("ASSIMILATED_RUNTIME_CONFIG_NOT_FOUND");
    if (runtimeConfig.object_type !== "twin_runtime_config_v1") {
      throw new Error("ASSIMILATED_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
    }
    exactScopeV1(runtimeConfig, input.scope, "ASSIMILATED_RUNTIME_CONFIG_SCOPE_MISMATCH");
    validateAssimilatedContinuationRuntimeConfigPayloadV1(runtimeConfig.payload);
    const config = runtimeConfig.payload as unknown as AssimilatedContinuationRuntimeConfigPayloadV1;
    if (
      config.parent_runtime_config_ref !== handoff.previous_state_runtime_config_ref
      || config.parent_runtime_config_hash !== handoff.previous_state_runtime_config_hash
    ) throw new Error("ASSIMILATED_PARENT_RUNTIME_CONFIG_MISMATCH");
    if (
      config.reality_binding_ref !== handoff.reality_binding_ref
      || config.reality_binding_hash !== handoff.reality_binding_hash
    ) throw new Error("ASSIMILATED_REALITY_BINDING_MISMATCH");
    if (input.crop_stage_context.configuration_matrix_hash !== config.configuration_matrix_hash) {
      throw new Error("ASSIMILATED_CROP_STAGE_CONFIGURATION_MATRIX_MISMATCH");
    }

    const candidateRecords = await this.evidenceSource.loadCandidateRecords({
      scope: input.scope,
      logical_time: logicalTime,
    });
    const preliminaryEvidenceWindow = buildAssimilatedContinuationEvidenceWindowV1({
      scope: input.scope,
      logical_time: logicalTime,
      candidate_records: candidateRecords,
      saturation_fraction: config.soil_hydraulic_snapshot.saturation_fraction,
      crop_stage_context_ref: config.crop_stage_context.context_ref,
      crop_stage_context_hash: config.crop_stage_context.context_hash,
      crop_stage_context: input.crop_stage_context,
    });
    const baseWindow = preliminaryEvidenceWindow.base_continuation_window;
    const rainfallValue = requiredFiniteNumberV1(
      baseWindow.rainfall_record.canonical_payload.value,
      "ASSIMILATED_SINGLE_TICK_RAINFALL_VALUE_REQUIRED",
    );
    const et0Value = requiredFiniteNumberV1(
      baseWindow.historical_et0_record.canonical_payload.value,
      "ASSIMILATED_SINGLE_TICK_ET0_VALUE_REQUIRED",
    );
    const dynamics = executeHourlyWaterBalanceV1({
      interval_start_exclusive: baseWindow.window_start_exclusive,
      interval_end_inclusive: baseWindow.window_end_inclusive,
      previous_storage_mm_decimal: handoff.previous_storage_mm_decimal,
      previous_variance_basis: handoff.previous_variance_basis,
      gross_rainfall_mm_decimal: normalizeFixedDecimalV1(String(rainfallValue), WATER_AMOUNT_SCALE_V1),
      historical_et0_mm_decimal: normalizeFixedDecimalV1(String(et0Value), WATER_AMOUNT_SCALE_V1),
      crop_stage_code: baseWindow.crop_stage_context.stage_code,
      kc_decimal: normalizeFixedDecimalV1(String(baseWindow.crop_stage_context.kc), WATER_AMOUNT_SCALE_V1),
      executed_irrigation_candidates: executionCandidatesV1(preliminaryEvidenceWindow),
      config: dynamicsConfigV1(config),
    });
    const assimilation = composeAssimilatedContinuationPosteriorV1({
      prior_mean: Number(dynamics.published_state.root_zone_vwc_fraction.mean),
      prior_variance: Number(dynamics.published_state.root_zone_vwc_fraction.variance),
      selected_observation: preliminaryEvidenceWindow.observation_selection.selected_observation,
      saturation_fraction: config.soil_hydraulic_snapshot.saturation_fraction,
      root_zone_depth_mm: config.soil_hydraulic_snapshot.root_zone_depth_mm,
      sensor_measurement_stddev_fraction:
        config.observation_assimilation.sensor_measurement_stddev_fraction,
      point_to_zone_representativeness_stddev_fraction:
        config.observation_assimilation.point_to_zone_representativeness_stddev_fraction,
      quality_weights: config.observation_assimilation.quality_weights,
    });
    const evidenceWindow = finalizeAssimilatedContinuationEvidenceWindowV1({
      window: preliminaryEvidenceWindow,
      assimilation,
    });
    const candidate = buildAssimilatedContinuationRecordSetV1({
      scope: input.scope,
      logical_time: logicalTime,
      created_at: input.created_at,
      handoff,
      previous_forecast_result_hash: previousForecastResultHash,
      runtime_config: runtimeConfig,
      evidence_window: evidenceWindow,
      dynamics,
      assimilation,
    });

    const existingAfterBuild = await this.persistence.lookupAssimilatedContinuationRecordSet(
      candidate.continuation_idempotency_key,
    );
    if (existingAfterBuild) {
      validateAssimilatedContinuationCrossReferencesV1(existingAfterBuild);
      if (
        existingAfterBuild.continuation_record_set_determinism_hash
        !== candidate.continuation_record_set_determinism_hash
      ) throw new Error("IDEMPOTENCY_CONFLICT");
      const nextHandoff = await this.handoffService.prepareNextTickInput(input.scope);
      assertNextHandoffV1({
        record_set: existingAfterBuild,
        handoff: nextHandoff,
        expected_next_time: new Date(Date.parse(logicalTime) + 60 * 60 * 1000).toISOString(),
      });
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        record_set: existingAfterBuild,
        evidence_window: evidenceWindow,
        dynamics,
        assimilation,
        next_handoff: nextHandoff,
      };
    }

    const lease = await this.persistence.acquireLease({
      ...input.scope,
      lease_owner: input.lease_owner,
      lease_duration_seconds: input.lease_duration_seconds,
    });
    const committed = await this.persistence.commitAssimilatedContinuationState({
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
    const readback = await this.persistence.readAssimilatedContinuationRecordSet(
      candidate.continuation_record_set_id,
    );
    if (!readback) throw new Error("ASSIMILATED_CANONICAL_READBACK_NOT_FOUND");
    validateAssimilatedContinuationCrossReferencesV1(readback);
    if (
      readback.continuation_record_set_determinism_hash
      !== candidate.continuation_record_set_determinism_hash
    ) throw new Error("ASSIMILATED_CANONICAL_READBACK_HASH_MISMATCH");

    const nextHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    assertNextHandoffV1({
      record_set: readback,
      handoff: nextHandoff,
      expected_next_time: new Date(Date.parse(logicalTime) + 60 * 60 * 1000).toISOString(),
    });
    return {
      status: committed.status,
      record_set: readback,
      evidence_window: evidenceWindow,
      dynamics,
      assimilation,
      next_handoff: nextHandoff,
    };
  }
}
