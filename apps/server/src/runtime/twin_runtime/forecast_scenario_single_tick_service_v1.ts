// apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts
// Purpose: execute exactly one explicit CAP-04 Replay tick from persisted handoff through observation-aware State estimation, matching Future Forcing, successful 72h Forecast, A1 persistence, three Scenario options, B persistence, canonical readback, and T+1 handoff.
// Boundary: one requested next tick only; no range loop, restart/backfill mode, route, scheduler, wall-clock logical time, recommendation, decision, action, calibration, model activation, or live-field claim.

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
import {
  normalizeFixedDecimalV1,
  WATER_AMOUNT_SCALE_V1,
} from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  type Cap04ForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  deriveCap04ARecordSetIdentityV1,
  type Cap04ARecordSetV1,
  type Cap04ScenarioSetRecordV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import {
  validateCap04ARecordSetV1,
  validateCap04ScenarioSetRecordV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import {
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  executeCap04Pure72hForecastMathV1,
  type Cap04Pure72hForecastMathInputV1,
} from "../../domain/twin_runtime/pure_72h_forecast_math_v1.js";
import { executeCap04PureThreeScenarioMathV1 } from "../../domain/twin_runtime/pure_three_scenario_math_v1.js";
import type { Cap04Pure72hForecastMathResultV1 } from "../../domain/twin_runtime/forecast_math_contracts_v1.js";
import type { Cap04PureThreeScenarioMathResultV1 } from "../../domain/twin_runtime/scenario_math_contracts_v1.js";
import type { Cap04ForecastForcingWindowV1 } from "../../domain/twin_runtime/future_forcing_contracts_v1.js";
import {
  buildAssimilatedContinuationEvidenceWindowV2,
  finalizeAssimilatedContinuationEvidenceWindowV2,
  type AssimilatedContinuationEvidenceWindowV2,
} from "./assimilated_continuation_evidence_window_v2.js";
import { buildCap04StateSourceMembersV1 } from "./forecast_scenario_state_source_builder_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";
import { buildCap04CompletedForecastRecordSetV1 } from "./forecast_continuation_record_set_builder_v1.js";
import type { Cap04ForecastScenarioPersistencePortV1 } from "./forecast_scenario_persistence_ports_v1.js";
import { selectCap04FutureForcingWindowV1 } from "./future_forcing_selector_v1.js";
import { PrepareNextTickInputServiceV1 } from "./next_tick_input_service_v1.js";
import type {
  BootstrapPersistencePortV1,
  CanonicalReplayEvidenceRecordV1,
  FaultInjectionStageV1,
  PreparedNextTickInputV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "./ports.js";
import { buildCap04ScenarioSetRecordV1 } from "./scenario_set_record_builder_v1.js";

export type Cap04SingleTickPersistencePortV1 = Cap04ForecastScenarioPersistencePortV1
  & Pick<BootstrapPersistencePortV1, "acquireLease">;

export type ExecuteCap04SingleTickInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  authorized_future_forcing_binding_ids: readonly string[];
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  lease_owner: string;
  lease_duration_seconds: number;
  fault_injection_a?: (stage: FaultInjectionStageV1) => void;
  fault_injection_b?: (stage: FaultInjectionStageV1) => void;
};

export type ExecuteCap04SingleTickResultV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS" | "RECOVERED_PENDING_SCENARIO";
  a_record_set: Cap04ARecordSetV1;
  b_record: Cap04ScenarioSetRecordV1;
  evidence_window: AssimilatedContinuationEvidenceWindowV2 | null;
  dynamics: HourlyWaterBalanceResultV1 | null;
  assimilation: AssimilatedContinuationPosteriorV1 | null;
  forcing_window: Cap04ForecastForcingWindowV1 | null;
  forecast_math: Cap04Pure72hForecastMathResultV1 | null;
  scenario_math: Cap04PureThreeScenarioMathResultV1 | null;
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

function canonicalIsoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = canonicalIsoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function finiteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function exactScopeV1(actual: ScopeLikeV1, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function addOneHourV1(value: string): string {
  return new Date(Date.parse(value) + 3_600_000).toISOString();
}

function memberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP04_SINGLE_TICK_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function executionCandidatesV1(window: AssimilatedContinuationEvidenceWindowV2): ExecutedIrrigationCandidateV1[] {
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
    event_id: requiredStringV1(record.canonical_payload.event_id, "CAP04_SINGLE_TICK_EXECUTION_EVENT_ID_REQUIRED"),
    source_record_id: record.source_record_id,
    executed_at: requiredStringV1(record.role_time.executed_at, "CAP04_SINGLE_TICK_EXECUTION_TIME_REQUIRED"),
    ingested_at: requiredStringV1(record.role_time.ingested_at, "CAP04_SINGLE_TICK_EXECUTION_INGESTED_AT_REQUIRED"),
    executed_amount_mm: normalizeFixedDecimalV1(String(finiteNumberV1(record.canonical_payload.executed_amount_mm, "CAP04_SINGLE_TICK_EXECUTION_AMOUNT_REQUIRED")), WATER_AMOUNT_SCALE_V1),
    coverage_fraction: normalizeFixedDecimalV1(String(finiteNumberV1(record.canonical_payload.coverage_fraction, "CAP04_SINGLE_TICK_EXECUTION_COVERAGE_REQUIRED")), WATER_AMOUNT_SCALE_V1),
    eligible_for_state_input: true,
    source_quality: "USABLE",
    execution_status: "EXECUTED",
  }));
}

function dynamicsConfigV1(config: Cap04RuntimeConfigPayloadV1): HourlyWaterBalanceConfigV1 {
  return {
    root_zone_depth_mm: config.soil_hydraulic_snapshot.root_zone_depth_mm.toFixed(6),
    wilting_point_storage_mm: config.soil_hydraulic_snapshot.wilting_point_storage_mm.toFixed(6),
    field_capacity_storage_mm: config.soil_hydraulic_snapshot.field_capacity_storage_mm.toFixed(6),
    saturation_storage_mm: config.soil_hydraulic_snapshot.saturation_storage_mm.toFixed(6),
    saturation_fraction: config.soil_hydraulic_snapshot.saturation_fraction.toFixed(6),
    runoff_fraction: config.dynamics_parameters.runoff_fraction.toFixed(6),
    drainage_coefficient_per_hour: config.dynamics_parameters.drainage_coefficient_per_hour.toFixed(6),
    structural_process_stddev_mm_per_hour: config.process_uncertainty.structural_process_stddev_mm_per_hour.toFixed(6),
    rainfall_relative_stddev: config.process_uncertainty.rainfall_relative_stddev.toFixed(6),
    crop_et_relative_stddev: config.process_uncertainty.crop_et_relative_stddev.toFixed(6),
    executed_irrigation_relative_stddev: config.process_uncertainty.executed_irrigation_relative_stddev.toFixed(6),
  };
}

function computationBasisV1(state: CanonicalObjectEnvelopeV1): {
  storage_mean_mm_decimal: string;
  storage_variance_mm2_decimal: string;
} {
  const basis = state.payload.computation_basis;
  if (!basis || typeof basis !== "object" || Array.isArray(basis)) throw new Error("CAP04_SINGLE_TICK_STATE_COMPUTATION_BASIS_REQUIRED");
  const record = basis as Record<string, unknown>;
  const read = (value: unknown, code: string): string => {
    if (typeof value === "string") return requiredStringV1(value, code);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
    return requiredStringV1((value as Record<string, unknown>).value, code);
  };
  return {
    storage_mean_mm_decimal: read(record.storage_mean_mm_decimal, "CAP04_SINGLE_TICK_STORAGE_MEAN_BASIS_REQUIRED"),
    storage_variance_mm2_decimal: read(record.storage_variance_mm2_decimal, "CAP04_SINGLE_TICK_STORAGE_VARIANCE_BASIS_REQUIRED"),
  };
}

function assertConfigV1(input: {
  config: CanonicalObjectEnvelopeV1;
  expected_ref: string;
  expected_hash: string;
  scope: TwinScopeKeyV1;
  logical_time: string;
  handoff: PreparedNextTickInputV1;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  require_parent_match: boolean;
}): Cap04RuntimeConfigPayloadV1 {
  if (input.config.object_id !== input.expected_ref) throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_REF_PIN_MISMATCH");
  if (input.config.determinism_hash !== input.expected_hash) throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_HASH_PIN_MISMATCH");
  if (input.config.object_type !== "twin_runtime_config_v1") throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(input.config, input.scope, "CAP04_SINGLE_TICK_RUNTIME_CONFIG_SCOPE_MISMATCH");
  validateCap04RuntimeConfigPayloadV1(input.config.payload);
  const payload = input.config.payload as unknown as Cap04RuntimeConfigPayloadV1;
  if (payload.effective_logical_time !== input.logical_time) throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_EFFECTIVE_TIME_MISMATCH");
  if (input.require_parent_match
    && (payload.parent_runtime_config_ref !== input.handoff.previous_state_runtime_config_ref
      || payload.parent_runtime_config_hash !== input.handoff.previous_state_runtime_config_hash)) {
    throw new Error("CAP04_SINGLE_TICK_PARENT_RUNTIME_CONFIG_MISMATCH");
  }
  if (payload.reality_binding_ref !== input.handoff.reality_binding_ref
    || payload.reality_binding_hash !== input.handoff.reality_binding_hash) {
    throw new Error("CAP04_SINGLE_TICK_REALITY_BINDING_MISMATCH");
  }
  if (input.crop_stage_context.configuration_matrix_hash !== payload.configuration_matrix_hash) {
    throw new Error("CAP04_SINGLE_TICK_CROP_STAGE_CONFIGURATION_MATRIX_MISMATCH");
  }
  return payload;
}

function resolveCropStageV1(
  context: ContinuationCropStageConfigurationContextV1,
  logicalTime: string,
): { stage_code: string; kc: number } {
  const match = context.crop_stage_schedule.filter((entry) =>
    entry.effective_from <= logicalTime && logicalTime < entry.effective_to
  );
  if (match.length !== 1) throw new Error("CAP04_SINGLE_TICK_CROP_STAGE_CARDINALITY");
  return { stage_code: match[0].stage_code, kc: match[0].kc };
}

function assertNextHandoffV1(input: {
  record_set: Cap04ARecordSetV1;
  handoff: PreparedNextTickInputV1;
  expected_next_time: string;
}): void {
  const state = memberV1(input.record_set, "twin_state_estimate_v1");
  const checkpoint = memberV1(input.record_set, "twin_runtime_checkpoint_v1");
  const forecast = memberV1(input.record_set, "twin_forecast_run_v1");
  if (input.handoff.previous_posterior_ref !== state.object_id || input.handoff.previous_posterior_hash !== state.determinism_hash) {
    throw new Error("CAP04_SINGLE_TICK_NEXT_HANDOFF_STATE_MISMATCH");
  }
  if (input.handoff.previous_checkpoint_ref !== checkpoint.object_id || input.handoff.previous_checkpoint_hash !== checkpoint.determinism_hash) {
    throw new Error("CAP04_SINGLE_TICK_NEXT_HANDOFF_CHECKPOINT_MISMATCH");
  }
  if (input.handoff.previous_forecast_result_ref !== forecast.object_id || input.handoff.previous_forecast_result_hash !== forecast.determinism_hash) {
    throw new Error("CAP04_SINGLE_TICK_NEXT_HANDOFF_FORECAST_MISMATCH");
  }
  if (input.handoff.latest_successful_forecast_ref !== forecast.object_id) {
    throw new Error("CAP04_SINGLE_TICK_NEXT_HANDOFF_SUCCESS_FORECAST_MISMATCH");
  }
  if (input.handoff.next_logical_tick_time !== input.expected_next_time) throw new Error("CAP04_SINGLE_TICK_NEXT_HANDOFF_TIME_MISMATCH");
  const sequence = checkpoint.payload.tick_sequence;
  if (!Number.isInteger(sequence) || input.handoff.previous_tick_sequence !== sequence) {
    throw new Error("CAP04_SINGLE_TICK_NEXT_HANDOFF_SEQUENCE_MISMATCH");
  }
}

export class Cap04ForecastScenarioSingleTickServiceV1 {
  constructor(
    private readonly handoffService: PrepareNextTickInputServiceV1,
    private readonly evidenceSource: ReplayEvidenceSourcePortV1,
    private readonly runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    private readonly persistence: Cap04SingleTickPersistencePortV1,
  ) {}

  async executeOneTick(input: ExecuteCap04SingleTickInputV1): Promise<ExecuteCap04SingleTickResultV1> {
    const logicalTime = canonicalHourV1(input.logical_time, "CAP04_SINGLE_TICK_LOGICAL_TIME_INVALID");
    canonicalIsoV1(input.created_at, "CAP04_SINGLE_TICK_CREATED_AT_INVALID");
    const runtimeConfigRef = requiredStringV1(input.runtime_config_ref, "CAP04_SINGLE_TICK_RUNTIME_CONFIG_REF_REQUIRED");
    const runtimeConfigHash = requiredStringV1(input.runtime_config_hash, "CAP04_SINGLE_TICK_RUNTIME_CONFIG_HASH_REQUIRED");
    if (!input.lease_owner.trim()) throw new Error("CAP04_SINGLE_TICK_LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0) throw new Error("CAP04_SINGLE_TICK_LEASE_DURATION_INVALID");
    if (!Array.isArray(input.authorized_future_forcing_binding_ids) || input.authorized_future_forcing_binding_ids.length === 0) {
      throw new Error("CAP04_SINGLE_TICK_FORCING_BINDING_AUTHORITY_REQUIRED");
    }

    const initialHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    const requestedIdentity = deriveCap04ARecordSetIdentityV1({
      scope: structuredClone(input.scope),
      lineage_id: initialHandoff.lineage_id,
      revision_id: initialHandoff.revision_id,
      logical_time: logicalTime,
      operation_variant: CAP04_A1_OPERATION_VARIANT_V1,
    });
    let aRecordSet = await this.persistence.lookupARecordSet(requestedIdentity.idempotency_key);
    const aExistedInitially = aRecordSet !== null;
    if (aRecordSet) {
      validateCap04ARecordSetV1(aRecordSet);
      if (aRecordSet.aggregate_identity_input.runtime_config_ref !== runtimeConfigRef) {
        throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_REF_PIN_MISMATCH");
      }
      if (aRecordSet.aggregate_identity_input.runtime_config_hash !== runtimeConfigHash) {
        throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_HASH_PIN_MISMATCH");
      }
      const existingForecast = memberV1(aRecordSet, "twin_forecast_run_v1");
      const existingB = await this.persistence.readScenarioSetBySourceForecast(existingForecast.object_id, existingForecast.determinism_hash);
      if (existingB) {
        validateCap04ScenarioSetRecordV1(existingB, existingForecast);
        const nextHandoff = await this.handoffService.prepareNextTickInput(input.scope);
        assertNextHandoffV1({ record_set: aRecordSet, handoff: nextHandoff, expected_next_time: addOneHourV1(logicalTime) });
        return {
          status: "EXISTING_IDEMPOTENT_SUCCESS",
          a_record_set: aRecordSet,
          b_record: existingB,
          evidence_window: null,
          dynamics: null,
          assimilation: null,
          forcing_window: null,
          forecast_math: null,
          scenario_math: null,
          next_handoff: nextHandoff,
        };
      }
    } else if (initialHandoff.next_logical_tick_time !== logicalTime) {
      throw new Error("CAP04_SINGLE_TICK_REQUESTED_TICK_NOT_NEXT_PERSISTED_TICK");
    }

    const runtimeConfig = await this.runtimeConfigRepository.readRuntimeConfig(runtimeConfigRef);
    if (!runtimeConfig) throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_NOT_FOUND");
    const config = assertConfigV1({
      config: runtimeConfig,
      expected_ref: runtimeConfigRef,
      expected_hash: runtimeConfigHash,
      scope: input.scope,
      logical_time: logicalTime,
      handoff: aRecordSet ? await this.handoffService.prepareNextTickInput(input.scope) : initialHandoff,
      crop_stage_context: input.crop_stage_context,
      require_parent_match: !aRecordSet,
    });

    const candidateRecords = await this.evidenceSource.loadCandidateRecords({ scope: input.scope, logical_time: logicalTime });
    let evidenceWindow: AssimilatedContinuationEvidenceWindowV2 | null = null;
    let dynamics: HourlyWaterBalanceResultV1 | null = null;
    let assimilation: AssimilatedContinuationPosteriorV1 | null = null;
    let forecastMath: Cap04Pure72hForecastMathResultV1;
    let forcingWindow: Cap04ForecastForcingWindowV1;
    let lease: RuntimeLeaseClaimV1 | null = null;

    if (!aRecordSet) {
      const preliminary = buildAssimilatedContinuationEvidenceWindowV2({
        scope: input.scope,
        logical_time: logicalTime,
        candidate_records: candidateRecords,
        saturation_fraction: config.soil_hydraulic_snapshot.saturation_fraction,
        crop_stage_context_ref: config.crop_stage_context.context_ref,
        crop_stage_context_hash: config.crop_stage_context.context_hash,
        crop_stage_context: input.crop_stage_context,
      });
      const base = preliminary.base_continuation_window;
      dynamics = executeHourlyWaterBalanceV1({
        interval_start_exclusive: base.window_start_exclusive,
        interval_end_inclusive: base.window_end_inclusive,
        previous_storage_mm_decimal: initialHandoff.previous_storage_mm_decimal,
        previous_variance_basis: initialHandoff.previous_variance_basis,
        gross_rainfall_mm_decimal: normalizeFixedDecimalV1(String(finiteNumberV1(base.rainfall_record.canonical_payload.value, "CAP04_SINGLE_TICK_RAINFALL_VALUE_REQUIRED")), WATER_AMOUNT_SCALE_V1),
        historical_et0_mm_decimal: normalizeFixedDecimalV1(String(finiteNumberV1(base.historical_et0_record.canonical_payload.value, "CAP04_SINGLE_TICK_ET0_VALUE_REQUIRED")), WATER_AMOUNT_SCALE_V1),
        crop_stage_code: base.crop_stage_context.stage_code,
        kc_decimal: normalizeFixedDecimalV1(String(base.crop_stage_context.kc), WATER_AMOUNT_SCALE_V1),
        executed_irrigation_candidates: executionCandidatesV1(preliminary),
        config: dynamicsConfigV1(config),
      });
      assimilation = composeAssimilatedContinuationPosteriorV1({
        prior_mean: Number(dynamics.published_state.root_zone_vwc_fraction.mean),
        prior_variance: Number(dynamics.published_state.root_zone_vwc_fraction.variance),
        selected_observation: preliminary.observation_selection.selected_observation as never,
        saturation_fraction: config.soil_hydraulic_snapshot.saturation_fraction,
        root_zone_depth_mm: config.soil_hydraulic_snapshot.root_zone_depth_mm,
        sensor_measurement_stddev_fraction: config.observation_assimilation.sensor_measurement_stddev_fraction,
        point_to_zone_representativeness_stddev_fraction: config.observation_assimilation.point_to_zone_representativeness_stddev_fraction,
        quality_weights: config.observation_assimilation.quality_weights,
      });
      evidenceWindow = finalizeAssimilatedContinuationEvidenceWindowV2({ window: preliminary, assimilation });
      const sources = buildCap04StateSourceMembersV1({
        scope: input.scope,
        logical_time: logicalTime,
        created_at: input.created_at,
        handoff: initialHandoff,
        runtime_config: runtimeConfig,
        evidence_window: evidenceWindow,
        dynamics,
        assimilation,
      });
      const sourceState = sources.twin_state_estimate_v1;
      const forcing = selectCap04FutureForcingWindowV1({
        scope: input.scope,
        logical_time: logicalTime,
        candidate_records: candidateRecords,
        authorized_binding_ids: input.authorized_future_forcing_binding_ids,
        crop_stage_context: {
          ref: config.crop_stage_context.context_ref,
          hash: config.crop_stage_context.context_hash,
          crop_stage_code: base.crop_stage_context.stage_code,
          kc: base.crop_stage_context.kc,
        },
        runtime_config: { ref: runtimeConfig.object_id, hash: runtimeConfig.determinism_hash },
      });
      if (forcing.status !== "SELECTED") throw new Error(`CAP04_SINGLE_TICK_FORCING_WINDOW_BLOCKED:${forcing.reason_codes.join(",")}`);
      forcingWindow = forcing.window;
      const provisionalMathInput: Cap04Pure72hForecastMathInputV1 = {
        source_posterior: {
          ref: sourceState.object_id,
          hash: sourceState.determinism_hash,
          logical_time: logicalTime,
          computation_basis: computationBasisV1(sourceState),
        },
        runtime_config: { ref: runtimeConfig.object_id, hash: runtimeConfig.determinism_hash, payload: config },
        forcing_window: forcingWindow,
      };
      const provisionalMath = executeCap04Pure72hForecastMathV1(provisionalMathInput);
      const provisionalA = buildCap04CompletedForecastRecordSetV1({
        scope: input.scope,
        lineage_id: initialHandoff.lineage_id,
        revision_id: initialHandoff.revision_id,
        logical_time: logicalTime,
        created_at: input.created_at,
        active_lineage_ref: initialHandoff.active_lineage_ref,
        previous_posterior_ref: initialHandoff.previous_posterior_ref,
        previous_posterior_hash: initialHandoff.previous_posterior_hash,
        previous_checkpoint_ref: initialHandoff.previous_checkpoint_ref,
        previous_checkpoint_hash: initialHandoff.previous_checkpoint_hash,
        previous_forecast_result_ref: initialHandoff.previous_forecast_result_ref,
        previous_forecast_result_hash: requiredStringV1(initialHandoff.previous_forecast_result_hash, "CAP04_SINGLE_TICK_PREDECESSOR_FORECAST_HASH_REQUIRED"),
        previous_successful_forecast_ref: initialHandoff.latest_successful_forecast_ref,
        previous_tick_sequence: initialHandoff.previous_tick_sequence,
        runtime_config: runtimeConfig,
        source_members: sources,
        forecast_payload: provisionalMath.forecast_payload,
      });
      const canonicalState = memberV1(provisionalA, "twin_state_estimate_v1");
      forecastMath = executeCap04Pure72hForecastMathV1({
        ...provisionalMathInput,
        source_posterior: {
          ref: canonicalState.object_id,
          hash: canonicalState.determinism_hash,
          logical_time: logicalTime,
          computation_basis: computationBasisV1(canonicalState),
        },
      });
      aRecordSet = buildCap04CompletedForecastRecordSetV1({
        scope: input.scope,
        lineage_id: initialHandoff.lineage_id,
        revision_id: initialHandoff.revision_id,
        logical_time: logicalTime,
        created_at: input.created_at,
        active_lineage_ref: initialHandoff.active_lineage_ref,
        previous_posterior_ref: initialHandoff.previous_posterior_ref,
        previous_posterior_hash: initialHandoff.previous_posterior_hash,
        previous_checkpoint_ref: initialHandoff.previous_checkpoint_ref,
        previous_checkpoint_hash: initialHandoff.previous_checkpoint_hash,
        previous_forecast_result_ref: initialHandoff.previous_forecast_result_ref,
        previous_forecast_result_hash: requiredStringV1(initialHandoff.previous_forecast_result_hash, "CAP04_SINGLE_TICK_PREDECESSOR_FORECAST_HASH_REQUIRED"),
        previous_successful_forecast_ref: initialHandoff.latest_successful_forecast_ref,
        previous_tick_sequence: initialHandoff.previous_tick_sequence,
        runtime_config: runtimeConfig,
        source_members: sources,
        forecast_payload: forecastMath.forecast_payload,
      });
      const existingAfterBuild = await this.persistence.lookupARecordSet(aRecordSet.idempotency_key);
      if (existingAfterBuild) {
        if (existingAfterBuild.aggregate_determinism_hash !== aRecordSet.aggregate_determinism_hash) throw new Error("IDEMPOTENCY_CONFLICT");
        aRecordSet = existingAfterBuild;
      } else {
        lease = await this.persistence.acquireLease({
          ...input.scope,
          lease_owner: input.lease_owner,
          lease_duration_seconds: input.lease_duration_seconds,
        });
        const committedA = await this.persistence.commitARecordSet({
          scope: input.scope,
          lease,
          expected: {
            active_lineage_ref: initialHandoff.active_lineage_ref,
            lineage_id: initialHandoff.lineage_id,
            revision_id: initialHandoff.revision_id,
            previous_checkpoint_ref: initialHandoff.previous_checkpoint_ref,
            previous_state_ref: initialHandoff.previous_posterior_ref,
            previous_forecast_result_ref: initialHandoff.previous_forecast_result_ref,
            previous_successful_forecast_ref: initialHandoff.latest_successful_forecast_ref,
          },
          record_set: aRecordSet,
          fault_injection: input.fault_injection_a,
        });
        aRecordSet = committedA.record_set;
      }
      const readA = await this.persistence.readARecordSet(aRecordSet.record_set_id);
      if (!readA) throw new Error("CAP04_SINGLE_TICK_A_READBACK_NOT_FOUND");
      if (readA.aggregate_determinism_hash !== aRecordSet.aggregate_determinism_hash) throw new Error("CAP04_SINGLE_TICK_A_READBACK_HASH_MISMATCH");
      aRecordSet = readA;
    } else {
      const canonicalState = memberV1(aRecordSet, "twin_state_estimate_v1");
      const existingForecast = memberV1(aRecordSet, "twin_forecast_run_v1");
      const recoveredCropStage = resolveCropStageV1(input.crop_stage_context, logicalTime);
      const forcing = selectCap04FutureForcingWindowV1({
        scope: input.scope,
        logical_time: logicalTime,
        candidate_records: candidateRecords,
        authorized_binding_ids: input.authorized_future_forcing_binding_ids,
        crop_stage_context: {
          ref: config.crop_stage_context.context_ref,
          hash: config.crop_stage_context.context_hash,
          crop_stage_code: recoveredCropStage.stage_code,
          kc: recoveredCropStage.kc,
        },
        runtime_config: { ref: runtimeConfig.object_id, hash: runtimeConfig.determinism_hash },
      });
      if (forcing.status !== "SELECTED") throw new Error(`CAP04_SINGLE_TICK_FORCING_WINDOW_BLOCKED:${forcing.reason_codes.join(",")}`);
      forcingWindow = forcing.window;
      forecastMath = executeCap04Pure72hForecastMathV1({
        source_posterior: {
          ref: canonicalState.object_id,
          hash: canonicalState.determinism_hash,
          logical_time: logicalTime,
          computation_basis: computationBasisV1(canonicalState),
        },
        runtime_config: { ref: runtimeConfig.object_id, hash: runtimeConfig.determinism_hash, payload: config },
        forcing_window: forcingWindow,
      });
      if (canonicalJsonV1(forecastMath.forecast_payload) !== canonicalJsonV1(existingForecast.payload)) {
        throw new Error("CAP04_SINGLE_TICK_RECOVERY_FORECAST_RECOMPUTE_MISMATCH");
      }
    }

    const forecast = memberV1(aRecordSet, "twin_forecast_run_v1");
    const scenarioMath = executeCap04PureThreeScenarioMathV1({
      source_forecast: { ref: forecast.object_id, hash: forecast.determinism_hash, math_result: forecastMath },
      runtime_config: { ref: runtimeConfig.object_id, hash: runtimeConfig.determinism_hash, payload: config },
      forcing_window: forcingWindow,
    });
    const scenarioCandidate = buildCap04ScenarioSetRecordV1({
      source_forecast: forecast,
      scenario_math_result: scenarioMath,
      created_at: input.created_at,
    });
    let bRecord = await this.persistence.lookupScenarioSet(scenarioCandidate.idempotency_key);
    const recoveredPendingScenario = aExistedInitially && bRecord === null;
    if (bRecord) {
      if (bRecord.aggregate_determinism_hash !== scenarioCandidate.aggregate_determinism_hash) throw new Error("IDEMPOTENCY_CONFLICT");
    } else {
      lease ??= await this.persistence.acquireLease({
        ...input.scope,
        lease_owner: input.lease_owner,
        lease_duration_seconds: input.lease_duration_seconds,
      });
      const committedB = await this.persistence.commitScenarioSet({
        scope: input.scope,
        lease,
        record: scenarioCandidate,
        fault_injection: input.fault_injection_b,
      });
      bRecord = committedB.record;
    }
    const readB = await this.persistence.readScenarioSet(bRecord.scenario_set_id);
    if (!readB) throw new Error("CAP04_SINGLE_TICK_B_READBACK_NOT_FOUND");
    validateCap04ScenarioSetRecordV1(readB, forecast);
    if (readB.aggregate_determinism_hash !== bRecord.aggregate_determinism_hash) throw new Error("CAP04_SINGLE_TICK_B_READBACK_HASH_MISMATCH");
    bRecord = readB;

    const nextHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    assertNextHandoffV1({ record_set: aRecordSet, handoff: nextHandoff, expected_next_time: addOneHourV1(logicalTime) });
    return {
      status: recoveredPendingScenario ? "RECOVERED_PENDING_SCENARIO" : "INSERTED",
      a_record_set: aRecordSet,
      b_record: bRecord,
      evidence_window: evidenceWindow,
      dynamics,
      assimilation,
      forcing_window: forcingWindow,
      forecast_math: forecastMath,
      scenario_math: scenarioMath,
      next_handoff: nextHandoff,
    };
  }
}
