// scripts/runtime_acceptance/mcft_cap_06_s1_residual_windows_fixture_v1.ts
// Purpose: build the isolated MCFT-CAP-06 S1 controlled profile from 24 real CAP-04 H1 Forecast traces and hidden-coefficient observations.
// Boundary: deterministic acceptance fixture only; no production database, Runtime authority, calibration search, Candidate, Evaluation, Model Activation, route, Web, scheduler, or CAP-07 authority.

import assert from "node:assert/strict";
import { executeHourlyWaterBalanceV1 } from "../../apps/server/src/domain/soil_water/hourly_water_balance_v1.js";
import {
  buildCap05ForecastPointMemberRefV1,
  buildCap05ForecastResidualV1,
  validateCap05ForecastResidualV1,
  type Cap05ForecastResidualEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.js";
import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { Cap04ForecastPointV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  CAP04_S7_STANDARD_TICK_COUNT_V1,
  buildCap04S7RangeFixtureV1,
} from "./mcft_cap_04_twenty_four_tick_range_fixture_v1.js";

export const CAP06_S1_PROFILE_ID_V1 = "PRESEEDED_24_H1_FORECAST_OBSERVATION_PAIRS_NO_RESIDUALS_V1" as const;
export const CAP06_S1_CONTROLLED_TRACK_V1 = "CONTROLLED_POSITIVE_MECHANISM_TRACK" as const;
export const CAP06_S1_REPOSITORY_TRACK_V1 = "REPOSITORY_HISTORY_QUALIFICATION_TRACK" as const;
export const CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1 = "0.030000" as const;
export const CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1 = "0.034000" as const;
export const CAP06_S1_CALIBRATION_CASE_COUNT_V1 = 16 as const;
export const CAP06_S1_HOLDOUT_CASE_COUNT_V1 = 8 as const;
export const CAP06_S1_TOTAL_CASE_COUNT_V1 = 24 as const;
export const CAP06_S1_OBSERVATION_VARIANCE_V1 = "0.000004000000" as const;
export const CAP06_S1_REPRESENTATIVENESS_VARIANCE_V1 = "0.000001000000" as const;
export const CAP06_S1_REPOSITORY_HISTORY_RESIDUAL_REF_V1 = "twin_forecast_residual_b346b2d105a290463ef61935" as const;

export type Cap06S1ControlledObservationRecordV1 = {
  record_type: "mcft_cap06_s1_controlled_observation_v1";
  source_record_id: string;
  source_record_hash: string;
  evidence_identity_key: string;
  qualification_track: typeof CAP06_S1_CONTROLLED_TRACK_V1;
  profile_id: typeof CAP06_S1_PROFILE_ID_V1;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  observed_at: string;
  available_to_runtime_at: string;
  quality_status: "PASS";
  canonical_unit: "fraction";
  canonical_value: string;
  observation_variance: typeof CAP06_S1_OBSERVATION_VARIANCE_V1;
  representativeness_variance: typeof CAP06_S1_REPRESENTATIVENESS_VARIANCE_V1;
  hidden_parameter_key: "dynamics_parameters.drainage_coefficient_per_hour";
  hidden_parameter_value: typeof CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1;
  source_forecast_ref: string;
  source_forecast_hash: string;
  source_forecast_point_ref: string;
  source_forecast_point_hash: string;
};

export type Cap06S1ControlledCaseV1 = {
  case_index: number;
  source_profile_id: typeof CAP06_S1_PROFILE_ID_V1;
  qualification_track: typeof CAP06_S1_CONTROLLED_TRACK_V1;
  source_state: CanonicalObjectEnvelopeV1;
  source_evidence_window: CanonicalObjectEnvelopeV1;
  source_forecast: CanonicalObjectEnvelopeV1;
  source_runtime_config: CanonicalObjectEnvelopeV1;
  forecast_point: Cap04ForecastPointV1;
  observation_record: Cap06S1ControlledObservationRecordV1;
  observation_evidence_window: CanonicalObjectEnvelopeV1;
  assimilation_update: CanonicalObjectEnvelopeV1;
  residual: Cap05ForecastResidualEnvelopeV1;
  base_replay_storage_mm: string;
  hidden_replay_storage_mm: string;
  model_component_hash: string;
  effective_parameter_bundle_hash: string;
  observation_operator_hash: string;
  geometry_hash: string;
  runtime_replay_numeric_policy_hash: string;
};

export type Cap06S1ControlledDatasetV1 = {
  schema_version: "geox_mcft_cap_06_s1_controlled_dataset_v1";
  profile_id: typeof CAP06_S1_PROFILE_ID_V1;
  qualification_track: typeof CAP06_S1_CONTROLLED_TRACK_V1;
  repository_history_track: typeof CAP06_S1_REPOSITORY_TRACK_V1;
  base_drainage_coefficient: typeof CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1;
  hidden_drainage_coefficient: typeof CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1;
  cases: Cap06S1ControlledCaseV1[];
  ordered_residual_refs: string[];
  ordered_residual_hashes: string[];
  residual_set_hash: string;
  calibration_window_refs: string[];
  calibration_window_hash: string;
  holdout_window_refs: string[];
  holdout_window_hash: string;
  case_input_set_hash: string;
  model_component_hash: string;
  effective_parameter_bundle_hash: string;
  observation_operator_hash: string;
  geometry_hash: string;
  runtime_replay_numeric_policy_hash: string;
};

function exactMemberV1(
  members: readonly CanonicalObjectEnvelopeV1[],
  objectType: string,
): CanonicalObjectEnvelopeV1 {
  const matches = members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP06_S1_MEMBER_CARDINALITY:${objectType}:${matches.length}`);
  return structuredClone(matches[0]);
}

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function deterministicEnvelopeV1(input: {
  object_type: "twin_evidence_window_v1" | "twin_assimilation_update_v1";
  scope: Pick<CanonicalObjectEnvelopeV1, "tenant_id" | "project_id" | "group_id" | "field_id" | "season_id" | "zone_id">;
  logical_time: string;
  source_refs: string[];
  evidence_refs: string[];
  runtime_config_ref: string;
  runtime_config_hash: string;
  lineage_id: string;
  revision_id: string;
  payload: Record<string, unknown>;
  limitations: string[];
}): CanonicalObjectEnvelopeV1 {
  const identity = {
    object_type: input.object_type,
    scope: input.scope,
    logical_time: input.logical_time,
    source_refs: [...input.source_refs].sort(),
    evidence_refs: [...input.evidence_refs].sort(),
  };
  const object = {
    object_id: deriveSemanticObjectIdV1(input.object_type.replace(/_v1$/, ""), identity),
    object_type: input.object_type,
    schema_version: "v2",
    ...input.scope,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    source_refs: [...input.source_refs].sort(),
    evidence_refs: [...input.evidence_refs].sort(),
    runtime_config_ref: input.runtime_config_ref,
    runtime_config_hash: input.runtime_config_hash,
    idempotency_key: deriveSemanticObjectIdV1(`${input.object_type}_key`, identity),
    determinism_hash: "",
    limitations: [...input.limitations],
    created_at: input.logical_time,
    lineage_id: input.lineage_id,
    revision_id: input.revision_id,
    payload: structuredClone(input.payload),
  } as CanonicalObjectEnvelopeV1;
  object.determinism_hash = computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>);
  return object;
}

function buildObservationRecordV1(input: {
  case_index: number;
  scope: Pick<CanonicalObjectEnvelopeV1, "tenant_id" | "project_id" | "group_id" | "field_id" | "season_id" | "zone_id">;
  observed_at: string;
  available_to_runtime_at: string;
  canonical_value: string;
  forecast: CanonicalObjectEnvelopeV1;
  forecast_point: Cap04ForecastPointV1;
}): Cap06S1ControlledObservationRecordV1 {
  const observationRef = deriveSemanticObjectIdV1("mcft_cap06_s1_observation", {
    profile_id: CAP06_S1_PROFILE_ID_V1,
    scope: input.scope,
    observed_at: input.observed_at,
    case_index: input.case_index,
  });
  const semantic = {
    record_type: "mcft_cap06_s1_controlled_observation_v1",
    source_record_id: observationRef,
    evidence_identity_key: `CAP06_S1_OBSERVATION:${observationRef}`,
    qualification_track: CAP06_S1_CONTROLLED_TRACK_V1,
    profile_id: CAP06_S1_PROFILE_ID_V1,
    ...input.scope,
    observed_at: input.observed_at,
    available_to_runtime_at: input.available_to_runtime_at,
    quality_status: "PASS",
    canonical_unit: "fraction",
    canonical_value: input.canonical_value,
    observation_variance: CAP06_S1_OBSERVATION_VARIANCE_V1,
    representativeness_variance: CAP06_S1_REPRESENTATIVENESS_VARIANCE_V1,
    hidden_parameter_key: "dynamics_parameters.drainage_coefficient_per_hour",
    hidden_parameter_value: CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1,
    source_forecast_ref: input.forecast.object_id,
    source_forecast_hash: input.forecast.determinism_hash,
    source_forecast_point_ref: buildCap05ForecastPointMemberRefV1(input.forecast.object_id, 1),
    source_forecast_point_hash: input.forecast_point.determinism_hash,
  } as const;
  return {
    ...semantic,
    source_record_hash: semanticHashV1(semantic),
  };
}

function buildObservationWindowV1(input: {
  forecast: CanonicalObjectEnvelopeV1;
  observation: Cap06S1ControlledObservationRecordV1;
}): CanonicalObjectEnvelopeV1 {
  const scope = {
    tenant_id: input.forecast.tenant_id,
    project_id: input.forecast.project_id,
    group_id: input.forecast.group_id,
    field_id: input.forecast.field_id,
    season_id: input.forecast.season_id,
    zone_id: input.forecast.zone_id,
  };
  const candidate = {
    observation_ref: input.observation.source_record_id,
    source_record_id: input.observation.source_record_id,
    source_record_hash: input.observation.source_record_hash,
    observed_at: input.observation.observed_at,
    available_to_runtime_at: input.observation.available_to_runtime_at,
    quality_status: input.observation.quality_status,
    canonical_unit: input.observation.canonical_unit,
    canonical_value: input.observation.canonical_value,
    candidate_assessment: "SELECTED",
    rejection_reasons: [],
  };
  return deterministicEnvelopeV1({
    object_type: "twin_evidence_window_v1",
    scope,
    logical_time: input.observation.available_to_runtime_at,
    source_refs: [input.observation.source_record_id],
    evidence_refs: [input.observation.source_record_id],
    runtime_config_ref: String(input.forecast.runtime_config_ref),
    runtime_config_hash: String(input.forecast.runtime_config_hash),
    lineage_id: String(input.forecast.lineage_id),
    revision_id: String(input.forecast.revision_id),
    payload: {
      evidence_window_contract_id: "MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V2",
      frozen: true,
      observation_selection: {
        policy_id: "MCFT_CAP_06_S1_EXACT_CONTROLLED_OBSERVATION_V1",
        candidates: [candidate],
        selected_observation_ref: input.observation.source_record_id,
      },
      selected_evidence_refs: [input.observation.source_record_id],
      assimilation_applied_evidence_refs: [input.observation.source_record_id],
      qualification_track: CAP06_S1_CONTROLLED_TRACK_V1,
      profile_id: CAP06_S1_PROFILE_ID_V1,
    },
    limitations: [
      "CONTROLLED_POSITIVE_MECHANISM_TRACK_ONLY",
      "NOT_REPOSITORY_HISTORY",
      "NOT_FIELD_OBSERVATION",
      "NO_CALIBRATION_CANDIDATE",
    ],
  });
}

function buildAssimilationUpdateV1(input: {
  forecast: CanonicalObjectEnvelopeV1;
  observation: Cap06S1ControlledObservationRecordV1;
  observation_window: CanonicalObjectEnvelopeV1;
}): CanonicalObjectEnvelopeV1 {
  const scope = {
    tenant_id: input.forecast.tenant_id,
    project_id: input.forecast.project_id,
    group_id: input.forecast.group_id,
    field_id: input.forecast.field_id,
    season_id: input.forecast.season_id,
    zone_id: input.forecast.zone_id,
  };
  return deterministicEnvelopeV1({
    object_type: "twin_assimilation_update_v1",
    scope,
    logical_time: input.observation.available_to_runtime_at,
    source_refs: [input.observation_window.object_id, input.observation.source_record_id],
    evidence_refs: [input.observation.source_record_id],
    runtime_config_ref: String(input.forecast.runtime_config_ref),
    runtime_config_hash: String(input.forecast.runtime_config_hash),
    lineage_id: String(input.forecast.lineage_id),
    revision_id: String(input.forecast.revision_id),
    payload: {
      status: "APPLIED",
      disposition: "ACCEPTED",
      evidence_window_ref: input.observation_window.object_id,
      evidence_window_hash: input.observation_window.determinism_hash,
      selected_observation_ref: input.observation.source_record_id,
      selected_observation_hash: input.observation.source_record_hash,
      applied_observation_refs: [input.observation.source_record_id],
      actual_observation: Number(input.observation.canonical_value),
      observation_variance: Number(input.observation.observation_variance),
      representativeness_variance: Number(input.observation.representativeness_variance),
      observation_operator: {
        id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
        version: "1",
        h: 1,
      },
      model_parameter_change_applied: false,
      qualification_track: CAP06_S1_CONTROLLED_TRACK_V1,
      profile_id: CAP06_S1_PROFILE_ID_V1,
    },
    limitations: [
      "CONTROLLED_POSITIVE_MECHANISM_TRACK_ONLY",
      "NOT_RUNTIME_STATE_AUTHORITY",
      "NO_MODEL_PARAMETER_CHANGE",
      "NO_CALIBRATION_CANDIDATE",
    ],
  });
}

function contextHashesV1(config: CanonicalObjectEnvelopeV1): {
  model_component_hash: string;
  effective_parameter_bundle_hash: string;
  observation_operator_hash: string;
  geometry_hash: string;
  runtime_replay_numeric_policy_hash: string;
} {
  const payload = config.payload as Record<string, any>;
  return {
    model_component_hash: semanticHashV1({ model_component_refs: payload.model_component_refs }),
    effective_parameter_bundle_hash: semanticHashV1({
      soil_hydraulic_snapshot: payload.soil_hydraulic_snapshot,
      dynamics_parameters: payload.dynamics_parameters,
    }),
    observation_operator_hash: semanticHashV1(payload.observation_assimilation?.observation_operator),
    geometry_hash: String(payload.reality_binding_hash),
    runtime_replay_numeric_policy_hash: semanticHashV1({
      decimal_scale_policy_id: payload.decimal_scale_policy_id,
      rounding_policy_id: payload.rounding_policy_id,
      water_amount_scale: 6,
      water_variance_scale: 12,
    }),
  };
}

function sortCasesV1(cases: readonly Cap06S1ControlledCaseV1[]): Cap06S1ControlledCaseV1[] {
  return [...cases].sort((left, right) => {
    const target = Date.parse(left.residual.payload.forecast_target_time) - Date.parse(right.residual.payload.forecast_target_time);
    if (target !== 0) return target;
    const availability = Date.parse(left.residual.payload.observation_available_to_runtime_at)
      - Date.parse(right.residual.payload.observation_available_to_runtime_at);
    if (availability !== 0) return availability;
    return left.residual.object_id.localeCompare(right.residual.object_id);
  });
}

export function validateCap06S1ControlledCaseGraphV1(caseItem: Cap06S1ControlledCaseV1): void {
  const residual = caseItem.residual;
  const payload = residual.payload;
  validateCap05ForecastResidualV1(residual);
  assert.equal(payload.forecast_run_ref, caseItem.source_forecast.object_id, "CAP06_S1_FORECAST_REF_MISMATCH");
  assert.equal(payload.forecast_run_hash, caseItem.source_forecast.determinism_hash, "CAP06_S1_FORECAST_HASH_MISMATCH");
  assert.equal(payload.forecast_point_ref, buildCap05ForecastPointMemberRefV1(caseItem.source_forecast.object_id, 1), "CAP06_S1_POINT_REF_MISMATCH");
  assert.equal(payload.forecast_point_hash, caseItem.forecast_point.determinism_hash, "CAP06_S1_POINT_HASH_MISMATCH");
  assert.equal(payload.actual_observation_ref, caseItem.observation_record.source_record_id, "CAP06_S1_OBSERVATION_REF_MISMATCH");
  assert.equal(payload.actual_observation_hash, caseItem.observation_record.source_record_hash, "CAP06_S1_OBSERVATION_HASH_MISMATCH");
  assert.equal(payload.assimilation_update_ref, caseItem.assimilation_update.object_id, "CAP06_S1_ASSIMILATION_REF_MISMATCH");
  assert.equal(payload.assimilation_update_hash, caseItem.assimilation_update.determinism_hash, "CAP06_S1_ASSIMILATION_HASH_MISMATCH");
  assert.equal(payload.runtime_config_ref, caseItem.source_runtime_config.object_id, "CAP06_S1_RUNTIME_CONFIG_REF_MISMATCH");
  assert.equal(payload.runtime_config_hash, caseItem.source_runtime_config.determinism_hash, "CAP06_S1_RUNTIME_CONFIG_HASH_MISMATCH");
  assert.equal(caseItem.source_forecast.payload.status, "COMPLETED", "CAP06_S1_COMPLETED_FORECAST_REQUIRED");
  assert.equal(payload.forecast_horizon_hour, 1, "CAP06_S1_H1_REQUIRED");
  assert.equal(payload.forecast_target_time, caseItem.observation_record.observed_at, "CAP06_S1_TARGET_OBSERVED_TIME_MISMATCH");
  assert.ok(Date.parse(payload.forecast_issued_at) < Date.parse(caseItem.observation_record.available_to_runtime_at), "CAP06_S1_FORECAST_ISSUED_LEAKAGE");
  assert.ok(Date.parse(caseItem.source_forecast.as_of) < Date.parse(caseItem.observation_record.available_to_runtime_at), "CAP06_S1_FORECAST_AS_OF_LEAKAGE");
  assert.equal(caseItem.observation_record.quality_status, "PASS", "CAP06_S1_OBSERVATION_QUALITY_REQUIRED");
  assert.equal(caseItem.observation_record.canonical_unit, "fraction", "CAP06_S1_OBSERVATION_UNIT_REQUIRED");
  assert.equal(caseItem.observation_evidence_window.payload.observation_selection.selected_observation_ref, payload.actual_observation_ref, "CAP06_S1_WINDOW_SELECTED_OBSERVATION_MISMATCH");
  assert.equal(caseItem.assimilation_update.payload.selected_observation_ref, payload.actual_observation_ref, "CAP06_S1_ASSIMILATION_SELECTED_OBSERVATION_MISMATCH");
  assert.equal(caseItem.assimilation_update.payload.model_parameter_change_applied, false, "CAP06_S1_ASSIMILATION_PARAMETER_CHANGE_FORBIDDEN");
}

export function validateCap06S1DatasetUniquenessV1(cases: readonly Cap06S1ControlledCaseV1[]): void {
  const targetOwners = new Map<string, string>();
  const semanticOwners = new Map<string, string>();
  for (const caseItem of cases) {
    validateCap06S1ControlledCaseGraphV1(caseItem);
    const target = caseItem.residual.payload.forecast_target_time;
    const existingTarget = targetOwners.get(target);
    if (existingTarget && existingTarget !== caseItem.residual.object_id) {
      throw new Error(`CAP06_S1_DUPLICATE_TARGET_TIME:${target}:${existingTarget}:${caseItem.residual.object_id}`);
    }
    targetOwners.set(target, caseItem.residual.object_id);
    const semantic = semanticHashV1({
      forecast_run_ref: caseItem.residual.payload.forecast_run_ref,
      forecast_point_ref: caseItem.residual.payload.forecast_point_ref,
      actual_observation_ref: caseItem.residual.payload.actual_observation_ref,
      target_time: target,
    });
    const existingSemantic = semanticOwners.get(semantic);
    if (existingSemantic && existingSemantic !== caseItem.residual.object_id) {
      throw new Error(`CAP06_S1_SEMANTIC_DUPLICATE:${semantic}:${existingSemantic}:${caseItem.residual.object_id}`);
    }
    semanticOwners.set(semantic, caseItem.residual.object_id);
  }
}

export async function buildCap06S1ControlledDatasetV1(): Promise<Cap06S1ControlledDatasetV1> {
  const source = await buildCap04S7RangeFixtureV1();
  const range = await source.range_service.runContiguousRange(source.range_input);
  assert.equal(range.status, "COMPLETED");
  assert.equal(range.tick_results.length, CAP04_S7_STANDARD_TICK_COUNT_V1);
  assert.equal(range.successful_forecast_run_count, CAP06_S1_TOTAL_CASE_COUNT_V1);

  const cases: Cap06S1ControlledCaseV1[] = [];
  for (let index = 0; index < range.tick_results.length; index += 1) {
    const tick = range.tick_results[index];
    const sourceState = exactMemberV1(tick.a_record_set.members, "twin_state_estimate_v1");
    const sourceEvidenceWindow = exactMemberV1(tick.a_record_set.members, "twin_evidence_window_v1");
    const sourceForecast = exactMemberV1(tick.a_record_set.members, "twin_forecast_run_v1");
    const sourceRuntimeConfig = await source.runtime.readRuntimeConfig(String(sourceForecast.runtime_config_ref));
    if (!sourceRuntimeConfig) throw new Error(`CAP06_S1_RUNTIME_CONFIG_REQUIRED:${index}`);
    const points = sourceForecast.payload.points as Cap04ForecastPointV1[];
    const forecastPoint = structuredClone(points[0]);
    assert.equal(forecastPoint.horizon_hour, 1);

    const configPayload = sourceRuntimeConfig.payload as Record<string, any>;
    const fixed6 = (value: unknown, code: string): string => {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error(code);
      return number.toFixed(6);
    };
    const baseConfig = {
      root_zone_depth_mm: fixed6(configPayload.soil_hydraulic_snapshot?.root_zone_depth_mm, "CAP06_S1_ROOT_DEPTH_REQUIRED"),
      wilting_point_storage_mm: fixed6(configPayload.soil_hydraulic_snapshot?.wilting_point_storage_mm, "CAP06_S1_WILTING_STORAGE_REQUIRED"),
      field_capacity_storage_mm: fixed6(configPayload.soil_hydraulic_snapshot?.field_capacity_storage_mm, "CAP06_S1_FIELD_CAPACITY_REQUIRED"),
      saturation_storage_mm: fixed6(configPayload.soil_hydraulic_snapshot?.saturation_storage_mm, "CAP06_S1_SATURATION_STORAGE_REQUIRED"),
      saturation_fraction: fixed6(configPayload.soil_hydraulic_snapshot?.saturation_fraction, "CAP06_S1_SATURATION_FRACTION_REQUIRED"),
      runoff_fraction: fixed6(configPayload.dynamics_parameters?.runoff_fraction, "CAP06_S1_RUNOFF_REQUIRED"),
      drainage_coefficient_per_hour: fixed6(configPayload.dynamics_parameters?.drainage_coefficient_per_hour, "CAP06_S1_DRAINAGE_REQUIRED"),
      structural_process_stddev_mm_per_hour: fixed6(configPayload.process_uncertainty?.structural_process_stddev_mm_per_hour, "CAP06_S1_STRUCTURAL_STDDEV_REQUIRED"),
      rainfall_relative_stddev: fixed6(configPayload.process_uncertainty?.rainfall_relative_stddev, "CAP06_S1_RAINFALL_STDDEV_REQUIRED"),
      crop_et_relative_stddev: fixed6(configPayload.process_uncertainty?.crop_et_relative_stddev, "CAP06_S1_ET_STDDEV_REQUIRED"),
      executed_irrigation_relative_stddev: fixed6(configPayload.process_uncertainty?.executed_irrigation_relative_stddev, "CAP06_S1_IRRIGATION_STDDEV_REQUIRED"),
    };
    assert.equal(baseConfig.drainage_coefficient_per_hour, CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1);
    const replayInput = {
      interval_start_exclusive: forecastPoint.interval_start,
      interval_end_inclusive: forecastPoint.interval_end,
      previous_storage_mm_decimal: forecastPoint.previous_storage_mm,
      previous_variance_basis: {
        basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE" as const,
        previous_state_ref: String(sourceForecast.payload.source_posterior_ref),
        previous_storage_variance_mm2_decimal: "0.000000000000",
      },
      gross_rainfall_mm_decimal: forecastPoint.gross_precipitation_assumption_mm,
      historical_et0_mm_decimal: forecastPoint.reference_et0_mm,
      crop_stage_code: forecastPoint.crop_stage_code,
      kc_decimal: forecastPoint.kc,
      executed_irrigation_candidates: [],
      config: baseConfig,
    };
    const baseReplay = executeHourlyWaterBalanceV1(replayInput);
    assert.equal(baseReplay.mass_balance_trace.next_storage_mm, forecastPoint.storage_mean_mm, `CAP06_S1_BASE_REPLAY_MISMATCH:${index}`);
    const hiddenReplay = executeHourlyWaterBalanceV1({
      ...replayInput,
      config: {
        ...baseConfig,
        drainage_coefficient_per_hour: CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1,
      },
    });

    const availableAt = addMinutesV1(forecastPoint.target_time, 5);
    const scope = {
      tenant_id: sourceForecast.tenant_id,
      project_id: sourceForecast.project_id,
      group_id: sourceForecast.group_id,
      field_id: sourceForecast.field_id,
      season_id: sourceForecast.season_id,
      zone_id: sourceForecast.zone_id,
    };
    const observation = buildObservationRecordV1({
      case_index: index,
      scope,
      observed_at: forecastPoint.target_time,
      available_to_runtime_at: availableAt,
      canonical_value: hiddenReplay.published_state.root_zone_vwc_fraction.mean,
      forecast: sourceForecast,
      forecast_point: forecastPoint,
    });
    const observationWindow = buildObservationWindowV1({ forecast: sourceForecast, observation });
    const assimilation = buildAssimilationUpdateV1({
      forecast: sourceForecast,
      observation,
      observation_window: observationWindow,
    });
    const payload = sourceRuntimeConfig.payload as Record<string, any>;
    const residual = buildCap05ForecastResidualV1({
      scope,
      forecast_run_ref: sourceForecast.object_id,
      forecast_run_hash: sourceForecast.determinism_hash,
      forecast_issued_at: String(sourceForecast.payload.issued_at),
      forecast_point_ref: buildCap05ForecastPointMemberRefV1(sourceForecast.object_id, 1),
      forecast_point: forecastPoint,
      root_zone_geometry_ref: String(payload.reality_binding_ref),
      root_zone_geometry_hash: String(payload.reality_binding_hash),
      root_zone_depth_mm: Number(payload.soil_hydraulic_snapshot.root_zone_depth_mm).toFixed(6),
      actual_observation_ref: observation.source_record_id,
      actual_observation_hash: observation.source_record_hash,
      actual_observation_observed_at: observation.observed_at,
      actual_observation_quality: observation.quality_status,
      actual_observation_value: observation.canonical_value,
      actual_observation_variance: observation.observation_variance,
      representativeness_variance: observation.representativeness_variance,
      runtime_config_ref: sourceRuntimeConfig.object_id,
      runtime_config_hash: sourceRuntimeConfig.determinism_hash,
      context_lineage_ref: String(sourceForecast.lineage_id),
      context_revision_ref: String(sourceForecast.revision_id),
      observation_available_to_runtime_at: observation.available_to_runtime_at,
      assimilation_update_ref: assimilation.object_id,
      assimilation_update_hash: assimilation.determinism_hash,
      created_at: observation.available_to_runtime_at,
    });
    const hashes = contextHashesV1(sourceRuntimeConfig);
    const caseItem: Cap06S1ControlledCaseV1 = {
      case_index: index,
      source_profile_id: CAP06_S1_PROFILE_ID_V1,
      qualification_track: CAP06_S1_CONTROLLED_TRACK_V1,
      source_state: sourceState,
      source_evidence_window: sourceEvidenceWindow,
      source_forecast: sourceForecast,
      source_runtime_config: sourceRuntimeConfig,
      forecast_point: forecastPoint,
      observation_record: observation,
      observation_evidence_window: observationWindow,
      assimilation_update: assimilation,
      residual,
      base_replay_storage_mm: baseReplay.mass_balance_trace.next_storage_mm,
      hidden_replay_storage_mm: hiddenReplay.mass_balance_trace.next_storage_mm,
      ...hashes,
    };
    validateCap06S1ControlledCaseGraphV1(caseItem);
    cases.push(caseItem);
  }

  const orderedCases = sortCasesV1(cases);
  validateCap06S1DatasetUniquenessV1(orderedCases);
  const refs = orderedCases.map((item) => item.residual.object_id);
  const hashes = orderedCases.map((item) => item.residual.determinism_hash);
  const calibrationRefs = refs.slice(0, CAP06_S1_CALIBRATION_CASE_COUNT_V1);
  const holdoutRefs = refs.slice(CAP06_S1_CALIBRATION_CASE_COUNT_V1);
  assert.equal(calibrationRefs.length, CAP06_S1_CALIBRATION_CASE_COUNT_V1);
  assert.equal(holdoutRefs.length, CAP06_S1_HOLDOUT_CASE_COUNT_V1);
  assert.equal(calibrationRefs.some((ref) => holdoutRefs.includes(ref)), false);
  assert.equal(refs.includes(CAP06_S1_REPOSITORY_HISTORY_RESIDUAL_REF_V1), false);

  const unique = (values: readonly string[], code: string): string => {
    const set = [...new Set(values)];
    if (set.length !== 1) throw new Error(`${code}:${set.length}`);
    return set[0];
  };
  return {
    schema_version: "geox_mcft_cap_06_s1_controlled_dataset_v1",
    profile_id: CAP06_S1_PROFILE_ID_V1,
    qualification_track: CAP06_S1_CONTROLLED_TRACK_V1,
    repository_history_track: CAP06_S1_REPOSITORY_TRACK_V1,
    base_drainage_coefficient: CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1,
    hidden_drainage_coefficient: CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1,
    cases: orderedCases,
    ordered_residual_refs: refs,
    ordered_residual_hashes: hashes,
    residual_set_hash: semanticHashV1(refs.map((ref, index) => ({ ref, hash: hashes[index] }))),
    calibration_window_refs: calibrationRefs,
    calibration_window_hash: semanticHashV1(calibrationRefs),
    holdout_window_refs: holdoutRefs,
    holdout_window_hash: semanticHashV1(holdoutRefs),
    case_input_set_hash: semanticHashV1(orderedCases.map((item) => ({
      residual_ref: item.residual.object_id,
      residual_hash: item.residual.determinism_hash,
      forecast_point_ref: item.residual.payload.forecast_point_ref,
      forecast_point_hash: item.residual.payload.forecast_point_hash,
      observation_ref: item.residual.payload.actual_observation_ref,
      observation_hash: item.residual.payload.actual_observation_hash,
    }))),
    model_component_hash: unique(orderedCases.map((item) => item.model_component_hash), "CAP06_S1_MODEL_COMPONENT_HETEROGENEITY"),
    effective_parameter_bundle_hash: unique(orderedCases.map((item) => item.effective_parameter_bundle_hash), "CAP06_S1_PARAMETER_BUNDLE_HETEROGENEITY"),
    observation_operator_hash: unique(orderedCases.map((item) => item.observation_operator_hash), "CAP06_S1_OPERATOR_HETEROGENEITY"),
    geometry_hash: unique(orderedCases.map((item) => item.geometry_hash), "CAP06_S1_GEOMETRY_HETEROGENEITY"),
    runtime_replay_numeric_policy_hash: unique(orderedCases.map((item) => item.runtime_replay_numeric_policy_hash), "CAP06_S1_NUMERIC_POLICY_HETEROGENEITY"),
  };
}
