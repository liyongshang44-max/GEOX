// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_CONFORMANCE.ts
// Purpose: prove the corrected pre-S8 Forecast-point member reference, exact target matching, effective observation variance, fail-closed normalization and deterministic projection trace.
// Boundary: deterministic in-process contract acceptance only; no database, canonical append, State Tick, Forecast execution, route, scheduler, Recommendation, AO-ACT, calibration, activation or CAP-06 authority.

import assert from "node:assert/strict";
import { computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  buildCap05ForecastPointMemberRefV1,
  buildCap05ForecastResidualV1,
  projectCap05ForecastPointToObservationV1,
  resolveCap05ForecastPointMemberV1,
  validateCap05ForecastResidualV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.js";
import type { Cap04ForecastPointV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";

let pass = 0;
function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "field_c8_demo",
  season_id: "season_2026_c8_corn",
  zone_id: "zone_mcft_c8_water_001",
};

const forecastRunRef = "twin_forecast_run_cap05_s8_contract_fixture";
const forecastRunHash = "sha256:cap05-s8-contract-forecast";
const forecastIssuedAt = "2026-06-04T02:00:00.000Z";
const forecastTargetTime = "2026-06-04T03:00:00.000Z";
const observationRef = "mcft05_src_bfb7a65b43a3646987958bfc";
const observationHash = "sha256:b3946e895adb47b8e7cdd83956efaf804343fff85db641afea04240f52ed3126";

function pointV1(overrides: Partial<Cap04ForecastPointV1> = {}): Cap04ForecastPointV1 {
  return {
    horizon_hour: 1,
    interval_start: "2026-06-04T02:00:00.000Z",
    interval_end: forecastTargetTime,
    target_time: forecastTargetTime,
    previous_storage_mm: "66.000000",
    gross_precipitation_assumption_mm: "0.000000",
    surface_runoff_mm: "0.000000",
    effective_precipitation_mm: "0.000000",
    assumed_irrigation_mm: "0.000000",
    reference_et0_mm: "0.110000",
    crop_stage_code: "CONTROLLED_STAGE",
    kc: "1.000000",
    requested_crop_et_mm: "0.110000",
    actual_crop_et_mm: "0.000000",
    unmet_crop_et_mm: "0.110000",
    drainage_mm: "0.000000",
    saturation_overflow_mm: "0.000000",
    storage_mean_mm: "66.000000",
    storage_variance_mm2: "0.090000",
    storage_interval_unclipped_lower_mm: "65.412000",
    storage_interval_unclipped_upper_mm: "66.588000",
    storage_interval_emitted_lower_mm: "65.412000",
    storage_interval_emitted_upper_mm: "66.588000",
    available_water_fraction: "0.500000",
    depletion_from_field_capacity_mm: "0.000000",
    mass_balance_error_mm: "0.000000",
    determinism_hash: "sha256:cap05-s8-contract-point-h1",
    ...overrides,
  };
}

function projectionInputV1(point: Cap04ForecastPointV1 = pointV1()) {
  return {
    forecast_run_ref: forecastRunRef,
    forecast_run_hash: forecastRunHash,
    forecast_issued_at: forecastIssuedAt,
    forecast_point_ref: buildCap05ForecastPointMemberRefV1(forecastRunRef, point.horizon_hour),
    forecast_point: point,
    root_zone_geometry_ref: "root_zone_geometry_cap05_s8_fixture",
    root_zone_geometry_hash: "sha256:root-zone-geometry-cap05-s8-fixture",
    root_zone_depth_mm: "300.000000",
    actual_observation_ref: observationRef,
    actual_observation_hash: observationHash,
    actual_observation_observed_at: forecastTargetTime,
    actual_observation_quality: "PASS" as const,
    actual_observation_value: "0.224000",
    actual_observation_variance: "0.000008000000",
    representativeness_variance: "0.000004000000",
  };
}

function main(): void {
  const point = pointV1();
  const pointRef = buildCap05ForecastPointMemberRefV1(forecastRunRef, 1);
  assert.equal(pointRef, `${forecastRunRef}#/points/1`);
  const resolved = resolveCap05ForecastPointMemberV1({
    forecast_run_ref: forecastRunRef,
    forecast_issued_at: forecastIssuedAt,
    forecast_points: [point],
    forecast_point_ref: pointRef,
  });
  assert.deepEqual(resolved, point);
  ok("GEOX Forecast-point semantic member ref resolves exact horizon 1");

  const projectionA = projectCap05ForecastPointToObservationV1(projectionInputV1(point));
  const projectionB = projectCap05ForecastPointToObservationV1(projectionInputV1(point));
  assert.deepEqual(projectionA, projectionB);
  assert.equal(projectionA.forecast_issued_at, forecastIssuedAt);
  assert.equal(projectionA.forecast_target_time, forecastTargetTime);
  assert.equal(projectionA.actual_observation_observed_at, forecastTargetTime);
  ok("issued_at plus horizon and observation observed_at resolve to the exact 03:00 target");

  assert.equal(projectionA.predicted_observation_value, "0.220000");
  assert.equal(projectionA.predicted_observation_variance, "0.000001000000");
  assert.equal(projectionA.actual_observation_variance, "0.000008000000");
  assert.equal(projectionA.representativeness_variance, "0.000004000000");
  assert.equal(projectionA.total_residual_variance, "0.000009000000");
  assert.equal(projectionA.residual_value, "0.004000");
  assert.equal(projectionA.normalized_residual, "1.333333");
  ok("normalization adds Forecast variance to CAP-03 effective observation variance exactly once");

  assert.match(projectionA.projection_input_hash, /^sha256:/);
  assert.match(projectionA.projection_trace_hash, /^sha256:/);
  assert.notEqual(projectionA.projection_input_hash, projectionA.projection_trace_hash);
  ok("projection input and trace hashes are deterministic and distinct");

  const residual = buildCap05ForecastResidualV1({
    ...projectionInputV1(point),
    scope,
    runtime_config_ref: "twin_runtime_config_cap05_s8_fixture",
    runtime_config_hash: "sha256:runtime-config-cap05-s8-fixture",
    context_lineage_ref: "twin_runtime_lineage_cap05_s8_fixture",
    context_revision_ref: "revision_active",
    observation_available_to_runtime_at: forecastTargetTime,
    assimilation_update_ref: "twin_assimilation_update_cap05_s8_fixture",
    assimilation_update_hash: "sha256:assimilation-update-cap05-s8-fixture",
    created_at: forecastTargetTime,
  });
  validateCap05ForecastResidualV1(residual);
  assert.equal(residual.logical_time, forecastTargetTime);
  assert.equal(residual.as_of, forecastTargetTime);
  assert.equal(residual.payload.equivalence_claimed, false);
  assert.ok(residual.limitations.includes("FORECAST_ERROR_NOT_ASSIMILATION_INNOVATION"));
  assert.ok(residual.limitations.includes("FORECAST_ERROR_NOT_CAUSAL_EFFECT"));
  ok("Residual preserves NON_LINEAGE_CONTEXT time mapping and no equivalence or causal claim");

  assert.throws(() => projectCap05ForecastPointToObservationV1({
    ...projectionInputV1(pointV1({ storage_variance_mm2: "0.000000" })),
    actual_observation_variance: "0.000000000000",
    representativeness_variance: "0.000000000000",
  }), /CAP05_TOTAL_RESIDUAL_VARIANCE_NON_POSITIVE/);
  ok("zero total Forecast-error variance fails closed");

  assert.throws(() => projectCap05ForecastPointToObservationV1({
    ...projectionInputV1(point),
    forecast_point_ref: `${forecastRunRef}#/points/by-horizon/1`,
  }), /CAP05_FORECAST_POINT_MEMBER_REF_MISMATCH/);
  assert.throws(() => resolveCap05ForecastPointMemberV1({
    forecast_run_ref: forecastRunRef,
    forecast_issued_at: forecastIssuedAt,
    forecast_points: [point],
    forecast_point_ref: `${forecastRunRef}#/points/2`,
  }), /CAP05_FORECAST_POINT_MEMBER_CARDINALITY/);
  ok("legacy or non-resolving Forecast-point refs fail closed");

  assert.throws(() => projectCap05ForecastPointToObservationV1({
    ...projectionInputV1(point),
    actual_observation_observed_at: "2026-06-04T02:50:00.000Z",
  }), /CAP05_ACTUAL_OBSERVATION_OBSERVED_AT_INVALID|CAP05_RESIDUAL_OBSERVATION_TARGET_TIME_MISMATCH/);
  ok("withdrawn 02:50 observation cannot match the 03:00 Forecast point");

  assert.throws(() => projectCap05ForecastPointToObservationV1({
    ...projectionInputV1(point),
    actual_observation_variance: "0.000003000000",
    representativeness_variance: "0.000004000000",
  }), /CAP05_REPRESENTATIVENESS_VARIANCE_EXCEEDS_EFFECTIVE_OBSERVATION_VARIANCE/);
  ok("representativeness variance cannot exceed effective CAP-03 observation variance");

  const forged = structuredClone(residual);
  forged.payload.projection_trace_hash = "sha256:forged-projection-trace";
  forged.determinism_hash = computeMemberDeterminismHashV1(forged as unknown as Record<string, unknown>);
  assert.throws(() => validateCap05ForecastResidualV1(forged), /CAP05_RESIDUAL_PROJECTION_TRACE_HASH_MISMATCH/);
  ok("forged projection trace hash fails closed even with a recomputed envelope hash");

  assert.equal(pass, 9);
  console.log(`MCFT-CAP-05 S8 residual contract conformance: ${pass} PASS / 0 FAIL`);
}

main();
