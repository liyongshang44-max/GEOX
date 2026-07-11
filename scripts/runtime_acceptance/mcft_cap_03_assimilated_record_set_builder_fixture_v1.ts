// scripts/runtime_acceptance/mcft_cap_03_assimilated_record_set_builder_fixture_v1.ts
// Purpose: assemble a deterministic first CAP-03 tick candidate for pure S3A builder and cross-reference validation acceptance.
// Boundary: acceptance fixture support only; no database, lease, persistence, route, scheduler, range execution, or live-field claim.

import { executeHourlyWaterBalanceV1 } from "../../apps/server/src/domain/soil_water/hourly_water_balance_v1.js";
import { composeAssimilatedContinuationPosteriorV1 } from "../../apps/server/src/domain/soil_water/assimilated_continuation_posterior_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { AssimilatedContinuationRuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import { buildAssimilatedContinuationRecordSetV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_record_set_builder_v1.js";
import type { AssimilatedContinuationEvidenceWindowV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v1.js";
import { selectAssimilatedContinuationObservationV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  PreparedNextTickInputV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildMcftCap03ContractsConfigFixtureV1 } from "./mcft_cap_03_contracts_config_fixture_v1.js";

const LOGICAL_TIME = "2026-06-02T02:00:00.000Z";
const CREATED_AT = "2026-07-11T03:00:00.000Z";
const OBSERVATION_REF = "obs_cap03_s3a_standard_001";

function makeObservationV1(scope: TwinScopeKeyV1): CanonicalReplayEvidenceRecordV1 {
  return {
    ...scope,
    dataset_id: "mcft_c8_water_replay_2026_06_v1",
    source_record_id: OBSERVATION_REF,
    source_record_hash: "sha256:obs_cap03_s3a_standard_001",
    record_type: "soil_moisture_observation_v1",
    binding_id: "soil_obs_c8_20cm_v1",
    origin_source_kind: "DEVICE",
    origin_source_id: "dev_soil_c8_001",
    epistemic_class: "OBSERVED",
    available_to_runtime_at: "2026-06-02T01:55:00.000Z",
    role_time: {
      observed_at: "2026-06-02T01:50:00.000Z",
      ingested_at: "2026-06-02T01:55:00.000Z",
    },
    quality: { status: "PASS" },
    source_payload: {
      unit: "percent_vwc",
      value: 18.45,
      source_version: "1",
    },
    canonical_payload: {
      unit: "fraction",
      value: 0.1845,
      quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    },
    source_unit: "percent_vwc",
    canonical_unit: "fraction",
    conversion_rule: { id: "PERCENT_TO_FRACTION_V1", version: "1" },
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
  };
}

function finalizedEvidenceWindowV1(input: {
  scope: TwinScopeKeyV1;
  config: AssimilatedContinuationRuntimeConfigPayloadV1;
  selection: ReturnType<typeof selectAssimilatedContinuationObservationV1>;
  applied_observation_refs: string[];
}): AssimilatedContinuationEvidenceWindowV1 {
  const baseWindow = {
    logical_time: LOGICAL_TIME,
    window_rule_id: "EXACT_HOUR_REPLAY_WINDOW_V1",
    exact_hour_interval_policy_id: "OPEN_START_CLOSED_END_V1",
    identical_duplicate_winner_policy_id: "INGESTED_DESC_SOURCE_RECORD_ID_ASC_V1",
    window_start_exclusive: "2026-06-02T01:00:00.000Z",
    window_end_inclusive: LOGICAL_TIME,
    selected_records: [],
    excluded_records: [],
    deduplicated_records: [],
    selected_evidence_refs: ["rain_cap03_s3a_001", "et0_cap03_s3a_001"],
    consumed_evidence_refs: ["et0_cap03_s3a_001", "rain_cap03_s3a_001"],
    context_only_evidence_refs: [],
    soil_moisture_records: [],
    crop_stage_context: {
      context_ref: input.config.crop_stage_context.context_ref,
      context_hash: input.config.crop_stage_context.context_hash,
      context_kind: input.config.crop_stage_context.context_kind,
      crop_stage_code: "INITIAL",
      kc_decimal: "0.300000",
    },
    coverage: {},
    exclusion_counts: {},
    semantic_digest: "sha256:cap02_base_window_s3a_fixture",
  };
  const dynamicsRefs = ["et0_cap03_s3a_001", "rain_cap03_s3a_001"];
  const evaluatedRefs = [...input.selection.evaluated_observation_refs];
  const appliedRefs = [...input.applied_observation_refs];
  const rejectedRefs = [...input.selection.rejected_observation_refs].sort();
  const consumedRefs = [...new Set([...dynamicsRefs, ...appliedRefs])].sort();
  const value = {
    evidence_window_contract_id:
      "MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V1" as const,
    logical_time: LOGICAL_TIME,
    frozen: true as const,
    base_continuation_window: baseWindow,
    observation_selection: input.selection,
    dynamics_consumed_evidence_refs: dynamicsRefs,
    assimilation_evaluated_evidence_refs: evaluatedRefs,
    assimilation_applied_evidence_refs: appliedRefs,
    context_only_evidence_refs: [],
    rejected_evidence_refs: rejectedRefs,
    consumed_evidence_refs: consumedRefs,
  };
  return {
    ...value,
    semantic_digest: semanticHashV1(value),
  } as unknown as AssimilatedContinuationEvidenceWindowV1;
}

export async function buildMcftCap03AssimilatedRecordSetBuilderFixtureV1() {
  const source = await buildMcftCap03ContractsConfigFixtureV1();
  const config = source.assimilatedRuntimeConfig.payload
    as unknown as AssimilatedContinuationRuntimeConfigPayloadV1;
  const observation = makeObservationV1(source.scope);
  const selection = selectAssimilatedContinuationObservationV1({
    scope: source.scope,
    logical_time: LOGICAL_TIME,
    saturation_fraction: config.soil_hydraulic_snapshot.saturation_fraction,
    observation_records: [observation],
  });
  const dynamics = executeHourlyWaterBalanceV1({
    interval_start_exclusive: "2026-06-02T01:00:00.000Z",
    interval_end_inclusive: LOGICAL_TIME,
    previous_storage_mm_decimal: "56.788512",
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: source.predecessorState.object_id,
      previous_storage_variance_mm2_decimal: "247.020977062500",
    },
    gross_rainfall_mm_decimal: "0.000000",
    historical_et0_mm_decimal: "0.085000",
    crop_stage_code: "INITIAL",
    kc_decimal: "0.300000",
    executed_irrigation_candidates: [],
    config: {
      root_zone_depth_mm: config.soil_hydraulic_snapshot.root_zone_depth_mm.toFixed(6),
      wilting_point_storage_mm:
        config.soil_hydraulic_snapshot.wilting_point_storage_mm.toFixed(6),
      field_capacity_storage_mm:
        config.soil_hydraulic_snapshot.field_capacity_storage_mm.toFixed(6),
      saturation_storage_mm:
        config.soil_hydraulic_snapshot.saturation_storage_mm.toFixed(6),
      saturation_fraction:
        config.soil_hydraulic_snapshot.saturation_fraction.toFixed(6),
      runoff_fraction: config.dynamics_parameters.runoff_fraction.toFixed(6),
      drainage_coefficient_per_hour:
        config.dynamics_parameters.drainage_coefficient_per_hour.toFixed(6),
      structural_process_stddev_mm_per_hour:
        config.process_uncertainty.structural_process_stddev_mm_per_hour.toFixed(6),
      rainfall_relative_stddev:
        config.process_uncertainty.rainfall_relative_stddev.toFixed(6),
      crop_et_relative_stddev:
        config.process_uncertainty.crop_et_relative_stddev.toFixed(6),
      executed_irrigation_relative_stddev:
        config.process_uncertainty.executed_irrigation_relative_stddev.toFixed(6),
    },
  });
  const assimilation = composeAssimilatedContinuationPosteriorV1({
    prior_mean: Number(dynamics.published_state.root_zone_vwc_fraction.mean),
    prior_variance: Number(dynamics.published_state.root_zone_vwc_fraction.variance),
    selected_observation: selection.selected_observation,
    saturation_fraction: config.soil_hydraulic_snapshot.saturation_fraction,
    root_zone_depth_mm: config.soil_hydraulic_snapshot.root_zone_depth_mm,
    sensor_measurement_stddev_fraction:
      config.observation_assimilation.sensor_measurement_stddev_fraction,
    point_to_zone_representativeness_stddev_fraction:
      config.observation_assimilation.point_to_zone_representativeness_stddev_fraction,
    quality_weights: config.observation_assimilation.quality_weights,
  });
  const evidenceWindow = finalizedEvidenceWindowV1({
    scope: source.scope,
    config,
    selection,
    applied_observation_refs: assimilation.applied_observation_refs,
  });
  const handoff: PreparedNextTickInputV1 = {
    ...source.scope,
    active_lineage_ref: source.cap03Lock.canonical_identity.active_lineage_ref,
    previous_posterior_ref: source.predecessorState.object_id,
    previous_posterior_hash: source.predecessorState.determinism_hash,
    previous_checkpoint_ref: source.cap03Lock.canonical_identity.latest_checkpoint_ref,
    previous_checkpoint_hash: source.cap03Lock.canonical_identity.latest_checkpoint_hash,
    previous_forecast_result_ref:
      source.cap03Lock.canonical_identity.latest_forecast_result_ref,
    latest_successful_forecast_ref: null,
    lineage_id: source.cap03Lock.canonical_identity.lineage_id,
    revision_id: source.cap03Lock.canonical_identity.revision_id,
    prior_mean: Number(dynamics.published_state.root_zone_vwc_fraction.mean),
    prior_variance: Number(dynamics.published_state.root_zone_vwc_fraction.variance),
    previous_storage_mm_decimal: "56.788512",
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: source.predecessorState.object_id,
      previous_storage_variance_mm2_decimal: "247.020977062500",
    },
    previous_tick_sequence: 24,
    next_logical_tick_time: LOGICAL_TIME,
    previous_state_runtime_config_ref: source.predecessorState.runtime_config_ref ?? "",
    previous_state_runtime_config_hash: source.predecessorState.runtime_config_hash ?? "",
    reality_binding_ref: String(source.assimilatedRuntimeConfig.payload.reality_binding_ref),
    reality_binding_hash: String(source.assimilatedRuntimeConfig.payload.reality_binding_hash),
  };
  const recordSet = buildAssimilatedContinuationRecordSetV1({
    scope: source.scope,
    logical_time: LOGICAL_TIME,
    created_at: CREATED_AT,
    handoff,
    previous_forecast_result_hash:
      source.cap03Lock.canonical_identity.latest_forecast_result_hash,
    runtime_config: source.assimilatedRuntimeConfig,
    evidence_window: evidenceWindow,
    dynamics,
    assimilation,
  });
  return {
    ...source,
    logicalTime: LOGICAL_TIME,
    createdAt: CREATED_AT,
    observation,
    selection,
    dynamics,
    assimilation,
    evidenceWindow,
    handoff,
    recordSet,
  };
}
