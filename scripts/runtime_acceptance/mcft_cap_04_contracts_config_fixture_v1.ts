// scripts/runtime_acceptance/mcft_cap_04_contracts_config_fixture_v1.ts
// Purpose: build deterministic CAP-04 S1 config-chain, Forecast DTO and Scenario DTO fixtures without claiming Forecast or Scenario execution.
// Boundary: acceptance fixture only; values are contract examples, not field calibration, prediction, recommendation or action.

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { compileAssimilatedContinuationRuntimeConfigV2 } from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v2.js";
import {
  CAP04_SCENARIO_POLICY_ID_V1,
  type Cap04ForecastPointV1,
  type Cap04ForecastRunPayloadV1,
  type Cap04ScenarioOptionV1,
  type Cap04ScenarioSetEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import { compileCap04RuntimeConfigChainV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_chain_v1.js";
import type { ContinuationScopeV1 } from "../../apps/server/src/domain/twin_runtime/continuation_operation_identity_v1.js";

export const CAP04_FIXTURE_SCOPE_V1: ContinuationScopeV1 = {
  tenant_id: "tenant_mcft_cap04_acceptance",
  project_id: "project_mcft_cap04_acceptance",
  group_id: "group_mcft_cap04_acceptance",
  field_id: "field_mcft_cap04_acceptance",
  season_id: "season_mcft_cap04_acceptance",
  zone_id: "zone_mcft_cap04_acceptance",
};

const ISSUED_AT = "2026-06-03T02:00:00.000Z";
const decimal = (value: number): string => value.toFixed(6);
const addHours = (value: string, hours: number): string => new Date(Date.parse(value) + hours * 3_600_000).toISOString();

export function buildCap04ForecastPointsFixtureV1(): Cap04ForecastPointV1[] {
  return Array.from({ length: 72 }, (_, index) => {
    const horizon = index + 1;
    const target = addHours(ISSUED_AT, horizon);
    const point: Cap04ForecastPointV1 = {
      horizon_hour: horizon,
      interval_start: addHours(target, -1),
      interval_end: target,
      target_time: target,
      previous_storage_mm: decimal(90 - index * 0.1),
      gross_precipitation_assumption_mm: "0.000000",
      surface_runoff_mm: "0.000000",
      effective_precipitation_mm: "0.000000",
      assumed_irrigation_mm: "0.000000",
      reference_et0_mm: "0.100000",
      crop_stage_code: "CONTROLLED_STAGE_V1",
      kc: "1.000000",
      requested_crop_et_mm: "0.100000",
      actual_crop_et_mm: "0.100000",
      unmet_crop_et_mm: "0.000000",
      drainage_mm: "0.000000",
      saturation_overflow_mm: "0.000000",
      storage_mean_mm: decimal(89.9 - index * 0.1),
      storage_variance_mm2: decimal(4 + index * 0.01),
      storage_interval_unclipped_lower_mm: decimal(85 - index * 0.1),
      storage_interval_unclipped_upper_mm: decimal(95 - index * 0.1),
      storage_interval_emitted_lower_mm: decimal(85 - index * 0.1),
      storage_interval_emitted_upper_mm: decimal(95 - index * 0.1),
      available_water_fraction: decimal(0.6 - index * 0.001),
      depletion_from_field_capacity_mm: decimal(10 + index * 0.1),
      mass_balance_error_mm: "0.000000",
      determinism_hash: "",
    };
    const pointHashBasis = { ...point } as Partial<Cap04ForecastPointV1>;
    delete pointHashBasis.determinism_hash;
    point.determinism_hash = semanticHashV1(pointHashBasis);
    return point;
  });
}

export function buildCap04CompletedForecastFixtureV1(runtimeConfigRef: string, runtimeConfigHash: string): Cap04ForecastRunPayloadV1 {
  return {
    status: "COMPLETED",
    issued_at: ISSUED_AT,
    source_posterior_ref: "twin_state_estimate_fixture_cap04",
    source_posterior_hash: `sha256:${"1".repeat(64)}`,
    runtime_config_ref: runtimeConfigRef,
    runtime_config_hash: runtimeConfigHash,
    baseline_assumption: "NO_NEW_IRRIGATION",
    points: buildCap04ForecastPointsFixtureV1(),
    reason_codes: [],
    scenario_eligible: true,
    forcing_window_hash: `sha256:${"2".repeat(64)}`,
    forcing_cycle_key: "forcing_cycle_fixture_cap04",
    weather_snapshot_ref: "weather_snapshot_fixture_cap04",
    weather_snapshot_hash: `sha256:${"3".repeat(64)}`,
    et0_snapshot_ref: "et0_snapshot_fixture_cap04",
    et0_snapshot_hash: `sha256:${"4".repeat(64)}`,
    crop_stage_context_ref: "crop_stage_context_fixture_cap04",
    crop_stage_context_hash: `sha256:${"5".repeat(64)}`,
    future_forcing_pair_policy_id: "JOINT_MATCHING_FORCING_CYCLE_V1",
    future_forcing_policy_id: "EXACT_72_HOUR_ASSUMPTION_WINDOW_V1",
    future_forcing_fallback_policy_id: "NO_CROSS_SNAPSHOT_STITCHING_V1",
    forecast_method_id: "ROOT_ZONE_WATER_BALANCE_72H_FIXED_POINT_V1",
    forecast_method_version: "1",
    uncertainty_propagation_method_id: "ADDITIVE_STORAGE_VARIANCE_ZERO_COVARIANCE_V1",
    forecast_interval_method_id: "NORMAL_95_PERCENT_Z_1_96_V1",
    limitations: ["CONTROLLED_ACCEPTANCE_FIXTURE", "NOT_FIELD_CALIBRATED"],
  };
}

export function buildCap04BlockedForecastFixtureV1(runtimeConfigRef: string, runtimeConfigHash: string): Cap04ForecastRunPayloadV1 {
  const completed = buildCap04CompletedForecastFixtureV1(runtimeConfigRef, runtimeConfigHash);
  return {
    ...completed,
    status: "BLOCKED",
    points: [],
    reason_codes: ["FUTURE_FORCING_WINDOW_UNAVAILABLE"],
    scenario_eligible: false,
    forcing_window_hash: null,
    forcing_cycle_key: null,
    weather_snapshot_ref: null,
    weather_snapshot_hash: null,
    et0_snapshot_ref: null,
    et0_snapshot_hash: null,
  };
}

function zeroDifference() {
  return {
    final_storage_delta_mm: "0.000000",
    minimum_awf_delta: "0.000000",
    stress_hour_count_delta: 0,
    total_irrigation_delta_mm: "0.000000",
    total_drainage_delta_mm: "0.000000",
    total_overflow_delta_mm: "0.000000",
  } as const;
}

export function buildCap04ScenarioOptionsFixtureV1(forecastRef: string, forecastHash: string, forecast: Cap04ForecastRunPayloadV1): Cap04ScenarioOptionV1[] {
  return ([
    ["NO_ACTION", "0.000000", null],
    ["IRRIGATE_NOW_15MM", "15.000000", 1],
    ["IRRIGATE_NOW_25MM", "25.000000", 1],
  ] as const).map(([optionId, requested, horizon]) => ({
    option_id: optionId,
    option_kind: optionId === "NO_ACTION" ? "NO_ACTION" : "IMMEDIATE_IRRIGATION",
    source_forecast_ref: forecastRef,
    source_forecast_hash: forecastHash,
    source_posterior_ref: forecast.source_posterior_ref,
    source_posterior_hash: forecast.source_posterior_hash,
    runtime_config_ref: forecast.runtime_config_ref,
    runtime_config_hash: forecast.runtime_config_hash,
    requested_irrigation_mm: requested,
    application_efficiency_fraction: "1.000000",
    effective_irrigation_mm: requested,
    application_horizon: horizon,
    application_interval: horizon === null ? null : { interval_start: forecast.points[0].interval_start, interval_end: forecast.points[0].interval_end },
    epistemic_status: "ASSUMED",
    execution_status: "NOT_EXECUTED",
    trajectory_points: structuredClone(forecast.points),
    minimum_available_water_fraction: "0.529000",
    first_stress_target_time: null,
    stress_hour_count: 0,
    final_storage_mm: forecast.points[71].storage_mean_mm,
    total_precipitation_mm: "0.000000",
    total_crop_et_mm: "7.200000",
    total_irrigation_mm: requested,
    total_runoff_mm: "0.000000",
    total_drainage_mm: "0.000000",
    total_overflow_mm: "0.000000",
    difference_from_no_action: zeroDifference(),
    uncertainty_basis: { source: "SOURCE_FORECAST_INTERVALS", probability_claim: false },
    assumption_basis: {
      source_forecast_ref: forecastRef,
      source_forecast_hash: forecastHash,
      runtime_config_ref: forecast.runtime_config_ref,
      runtime_config_hash: forecast.runtime_config_hash,
      scenario_policy_id: CAP04_SCENARIO_POLICY_ID_V1,
      option_id: optionId,
    },
    limitations: ["ASSUMED_NOT_EXECUTED", "NOT_RECOMMENDATION", "NOT_DECISION"],
  }));
}

export function buildCap04ScenarioSetEnvelopeFixtureV1(forecastRef: string, forecastHash: string, forecast: Cap04ForecastRunPayloadV1): Cap04ScenarioSetEnvelopeV1 {
  const envelope: Cap04ScenarioSetEnvelopeV1 = {
    object_id: "twin_scenario_set_fixture_cap04",
    object_type: "twin_scenario_set_v1",
    schema_version: "v1",
    ...CAP04_FIXTURE_SCOPE_V1,
    logical_time: forecast.issued_at,
    as_of: forecast.issued_at,
    source_refs: [forecastRef, forecast.source_posterior_ref, forecast.runtime_config_ref].sort(),
    evidence_refs: [],
    runtime_config_ref: forecast.runtime_config_ref,
    runtime_config_hash: forecast.runtime_config_hash,
    idempotency_key: "cap04_b_fixture_key",
    determinism_hash: "",
    limitations: ["ASSUMED_NOT_EXECUTED", "NOT_RECOMMENDATION", "NOT_DECISION"],
    created_at: forecast.issued_at,
    lineage_id: "lineage_fixture_cap04",
    revision_id: "revision_fixture_cap04",
    payload: {
      record_set_contract_id: "MCFT_CAP_04_THREE_SCENARIO_SET_V1",
      transaction_variant: "B_SCENARIO_COMMIT",
      source_forecast_ref: forecastRef,
      source_forecast_hash: forecastHash,
      source_posterior_ref: forecast.source_posterior_ref,
      source_posterior_hash: forecast.source_posterior_hash,
      scenario_policy_id: CAP04_SCENARIO_POLICY_ID_V1,
      runtime_config_ref: forecast.runtime_config_ref,
      runtime_config_hash: forecast.runtime_config_hash,
      options: buildCap04ScenarioOptionsFixtureV1(forecastRef, forecastHash, forecast),
      limitations: ["ASSUMED_NOT_EXECUTED", "NOT_RECOMMENDATION", "NOT_DECISION"],
    },
  };
  const envelopeHashBasis = { ...envelope } as Partial<Cap04ScenarioSetEnvelopeV1>;
  delete envelopeHashBasis.determinism_hash;
  delete envelopeHashBasis.created_at;
  envelope.determinism_hash = semanticHashV1(envelopeHashBasis);
  return envelope;
}

export function buildCap04ConfigChainFixtureV1() {
  const predecessor = compileAssimilatedContinuationRuntimeConfigV2({
    scope: CAP04_FIXTURE_SCOPE_V1,
    logical_time: "2026-06-03T01:00:00.000Z",
    created_at: "2026-06-03T01:00:00.000Z",
    parent_runtime_config_ref: "twin_runtime_config_fixture_cap02_parent",
    parent_runtime_config_hash: `sha256:${"6".repeat(64)}`,
    reality_binding_ref: "reality_binding_fixture_cap04",
    reality_binding_hash: `sha256:${"7".repeat(64)}`,
    source_matrix_hash: `sha256:${"8".repeat(64)}`,
    configuration_matrix_hash: `sha256:${"9".repeat(64)}`,
    geometry_semantic_hash: `sha256:${"a".repeat(64)}`,
  });
  const configs = compileCap04RuntimeConfigChainV1({
    scope: CAP04_FIXTURE_SCOPE_V1,
    first_effective_logical_time: ISSUED_AT,
    created_at: ISSUED_AT,
    predecessor_runtime_config_ref: predecessor.object_id,
    predecessor_runtime_config_hash: predecessor.determinism_hash,
    reality_binding_ref: "reality_binding_fixture_cap04",
    reality_binding_hash: `sha256:${"7".repeat(64)}`,
    source_matrix_hash: `sha256:${"8".repeat(64)}`,
    configuration_matrix_hash: `sha256:${"9".repeat(64)}`,
    geometry_semantic_hash: `sha256:${"a".repeat(64)}`,
  });
  return { predecessor, configs };
}
