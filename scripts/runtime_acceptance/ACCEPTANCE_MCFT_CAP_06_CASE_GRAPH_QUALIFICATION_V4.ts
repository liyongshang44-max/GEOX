// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_CASE_GRAPH_QUALIFICATION_V4.ts
// Purpose: prove recursive hashing, exact dual-Config graph closure, explicit exclusions, homogeneity and dual-time 16/8 separation for MCFT-CAP-06 S0 v2.
// Boundary: pure in-memory acceptance only; no PostgreSQL, filesystem mutation, canonical write, parameter replay, Candidate, Evaluation, Model Activation, or Runtime authority change.

import assert from "node:assert/strict";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  qualifyCap06DatasetV2,
  type Cap06ResolvedCaseGraphV2,
  type Cap06ScopeV2,
} from "../../apps/server/src/domain/twin_runtime/calibration_case_graph_qualification_v2.js";

const SCOPE: Cap06ScopeV2 = Object.freeze({
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "field_c8_demo",
  season_id: "season_2026_c8_corn",
  zone_id: "zone_mcft_c8_water_001",
});

let pass = 0;

function ok(message: string): void {
  // Count one independent qualification property per successful check.
  pass += 1;
  process.stdout.write(`PASS ${message}\n`);
}

function hour(index: number): string {
  // Canonical whole-hour instants make event-time and availability ordering deterministic.
  return new Date(Date.UTC(2026, 0, 1, index)).toISOString();
}

function identity(prefix: string, index: number): { ref: string; hash: string } {
  // Every synthetic authority has an independent ref/hash pair so edge substitutions are observable.
  return { ref: `${prefix}_${index}`, hash: semanticHashV1({ prefix, index }) };
}

function graph(index: number): Cap06ResolvedCaseGraphV2 {
  // Forecast and Residual Configs intentionally differ in identity while retaining homogeneous semantic bases.
  const forecast = identity("forecast", index);
  const point = { ...identity("point", index), horizon_hour: 1, target_time: hour(index + 2) };
  const posterior = identity("posterior", index);
  const forecastConfig = identity("forecast_config", index);
  const residualConfig = identity("residual_config", index);
  const evidence = identity("evidence_window", index);
  const observation = identity("observation", index);
  const weather = identity("weather", index);
  const et0 = identity("et0", index);
  const crop = identity("crop", 1);
  const geometry = identity("geometry", 1);
  const residual = identity("residual", index);
  const lineage = "lineage_da76d015085f0d37bf2ed478";
  const revision = "revision_e0c62f99ac3db66f60a87e2b";

  return {
    residual: {
      residual_ref: residual.ref,
      residual_hash: residual.hash,
      scope: { ...SCOPE },
      context_lineage_ref: lineage,
      context_revision_ref: revision,
      forecast_run: forecast,
      forecast_point: point,
      forecast_issued_at: hour(index + 1),
      forecast_target_time: point.target_time,
      observation: {
        ...observation,
        observed_at: point.target_time,
        available_to_runtime_at: hour(index + 3),
        quality: "PASS",
        unit: "fraction",
      },
      residual_runtime_config: residualConfig,
      root_zone_geometry: geometry,
      observation_operator_basis: {
        operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
        operator_version: "1",
        operator_h: "1.000000",
        direct_state_equivalence: false,
        projection_method_id: "ROOT_ZONE_STORAGE_TO_VWC_H1_V1",
        projection_method_version: "1",
        variance_projection_method_id: "ROOT_ZONE_STORAGE_VARIANCE_TO_VWC_VARIANCE_H1_V1",
        representativeness_variance: "0.003600000000",
      },
    },
    forecast: {
      ...forecast,
      scope: { ...SCOPE },
      context_lineage_ref: lineage,
      context_revision_ref: revision,
      status: "COMPLETED",
      issued_at: hour(index + 1),
      as_of: hour(index + 1),
      source_posterior: posterior,
      forecast_runtime_config: forecastConfig,
      evidence_window: evidence,
      forcing_cycle_key: `forcing_cycle_${index}`,
      forcing_window_hash: semanticHashV1({ forcing_window: index }),
      weather_snapshot: weather,
      et0_snapshot: et0,
      crop_stage_context: crop,
      points: [point],
    },
    source_posterior: {
      ...posterior,
      scope: { ...SCOPE },
      context_lineage_ref: lineage,
      context_revision_ref: revision,
      forecast_runtime_config: forecastConfig,
    },
    forecast_runtime_config: {
      ...forecastConfig,
      model_component_basis: {
        dynamics: { component_id: "water_balance_v1", version: "1" },
        projection: { component_id: "root_zone_projection_v1", version: "1" },
      },
      effective_parameter_bundle_basis: {
        soil: { field_capacity: "0.300000", saturation: "0.450000", wilting_point: "0.120000" },
        dynamics: { drainage_coefficient_per_hour: "0.030000", runoff_fraction: "0.000000" },
        observation: { sensor_stddev: "0.020000", representativeness_stddev: "0.060000" },
      },
      runtime_replay_numeric_policy_basis: {
        scales: { water_amount: 6, water_variance: 12 },
        rounding: { rule_id: "DECIMAL_HALF_AWAY_FROM_ZERO_V1", rule_version: "1" },
      },
    },
    residual_runtime_config: {
      ...residualConfig,
      residual_policy_basis: {
        matching_policy_id: "FORECAST_H1_TO_EXACT_OBSERVATION_TARGET_V1",
        projection_method_id: "ROOT_ZONE_STORAGE_TO_VWC_H1_V1",
        normalization_policy_id: "TOTAL_RESIDUAL_VARIANCE_NORMALIZATION_V1",
      },
    },
    evidence_window: { ...evidence, evidence_cutoff_at: hour(index + 1) },
    observation: {
      ...observation,
      observed_at: point.target_time,
      available_to_runtime_at: hour(index + 3),
      quality: "PASS",
      unit: "fraction",
    },
    weather_snapshot: weather,
    et0_snapshot: et0,
    crop_stage_context: crop,
    root_zone_geometry: geometry,
  };
}

function clone(value: Cap06ResolvedCaseGraphV2): Cap06ResolvedCaseGraphV2 {
  // Negative cases must not leak mutations into later checks.
  return structuredClone(value);
}

function run(): void {
  assert.notEqual(
    semanticHashV1({ soil: { saturation: "0.450000" } }),
    semanticHashV1({ soil: { saturation: "0.450001" } }),
  );
  assert.equal(
    semanticHashV1({ soil: { saturation: "0.450000", field_capacity: "0.300000" } }),
    semanticHashV1({ soil: { field_capacity: "0.300000", saturation: "0.450000" } }),
  );
  ok("recursive canonical hash is nested-value sensitive and key-order invariant");

  const distinct = qualifyCap06DatasetV2(SCOPE, [graph(0)]);
  assert.equal(distinct.case_graph_validation_status, "PASS");
  assert.equal(distinct.dataset_qualification_status, "INSUFFICIENT_MATCHED_PAIRS");
  assert.notEqual(distinct.eligible_cases[0]?.forecast_runtime_config_ref, distinct.eligible_cases[0]?.residual_runtime_config_ref);
  ok("distinct Forecast-time and Residual-time Config identities are legal when both graphs close");

  const residualSwap = graph(0);
  residualSwap.residual.residual_runtime_config = { ...residualSwap.forecast_runtime_config };
  const residualSwapResult = qualifyCap06DatasetV2(SCOPE, [residualSwap]);
  assert.equal(residualSwapResult.dataset_qualification_status, "INVALID_CASE_GRAPH");
  assert.ok(residualSwapResult.excluded_cases[0]?.reasons.includes("RESIDUAL_RUNTIME_CONFIG_REF_HASH_MISMATCH"));
  ok("Forecast Config substitution at the Residual edge fails closed");

  const posteriorSwap = graph(0);
  posteriorSwap.source_posterior.forecast_runtime_config = { ...posteriorSwap.residual_runtime_config };
  const posteriorSwapResult = qualifyCap06DatasetV2(SCOPE, [posteriorSwap]);
  assert.equal(posteriorSwapResult.dataset_qualification_status, "INVALID_CASE_GRAPH");
  assert.ok(posteriorSwapResult.excluded_cases[0]?.reasons.includes("POSTERIOR_RUNTIME_CONFIG_REF_HASH_MISMATCH"));
  ok("Residual Config substitution at the source-posterior edge fails closed");

  const limited = graph(0);
  limited.residual.observation.quality = "LIMITED";
  limited.observation.quality = "LIMITED";
  const limitedResult = qualifyCap06DatasetV2(SCOPE, [limited]);
  assert.equal(limitedResult.case_graph_validation_status, "PASS");
  assert.equal(limitedResult.excluded_cases[0]?.exclusion_class, "POLICY_EXCLUSION");
  ok("a legitimate LIMITED case is explicitly excluded without invalidating the graph");

  const brokenHash = graph(0);
  brokenHash.residual.forecast_run.hash = semanticHashV1({ wrong: true });
  const brokenHashResult = qualifyCap06DatasetV2(SCOPE, [brokenHash]);
  assert.equal(brokenHashResult.case_graph_validation_status, "FAIL");
  assert.ok(brokenHashResult.excluded_cases[0]?.reasons.includes("RESIDUAL_FORECAST_RUN_REF_HASH_MISMATCH"));
  ok("a Forecast ref/hash mismatch fails as INVALID_CASE_GRAPH");

  const leakage = graph(0);
  leakage.forecast.as_of = leakage.observation.available_to_runtime_at;
  const leakageResult = qualifyCap06DatasetV2(SCOPE, [leakage]);
  assert.equal(leakageResult.dataset_qualification_status, "AVAILABILITY_ORDER_INVALID");
  assert.equal(leakageResult.excluded_cases[0]?.exclusion_class, "AVAILABILITY_ORDER_INVALID");
  ok("Forecast as_of at Observation availability fails the anti-leakage gate");

  const readyGraphs = Array.from({ length: 24 }, (_, index) => graph(index));
  const ready = qualifyCap06DatasetV2(SCOPE, readyGraphs);
  assert.equal(ready.dataset_qualification_status, "READY_FOR_CALIBRATION_ASSESSMENT");
  assert.deepEqual([ready.eligible_calibration_count, ready.eligible_holdout_count], [16, 8]);
  assert.deepEqual([
    ready.model_component_hash_count,
    ready.effective_parameter_bundle_hash_count,
    ready.observation_operator_hash_count,
    ready.geometry_hash_count,
    ready.runtime_replay_numeric_policy_hash_count,
    ready.residual_policy_hash_count,
  ], [1, 1, 1, 1, 1, 1]);
  ok("24 homogeneous cases produce a deterministic dual-time 16/8 split");

  const parameterDrift = readyGraphs.map(clone);
  parameterDrift[23].forecast_runtime_config.effective_parameter_bundle_basis = {
    soil: { field_capacity: "0.300000", saturation: "0.450001" },
  };
  const parameterDriftResult = qualifyCap06DatasetV2(SCOPE, parameterDrift);
  assert.equal(parameterDriftResult.dataset_qualification_status, "CONFIG_OR_MODEL_HETEROGENEITY");
  assert.equal(parameterDriftResult.effective_parameter_bundle_hash_count, 2);
  ok("nested Forecast parameter heterogeneity is detected");

  const residualPolicyDrift = readyGraphs.map(clone);
  residualPolicyDrift[23].residual_runtime_config.residual_policy_basis = { matching_policy_id: "ALTERNATE_FORBIDDEN_POLICY" };
  const residualPolicyResult = qualifyCap06DatasetV2(SCOPE, residualPolicyDrift);
  assert.equal(residualPolicyResult.dataset_qualification_status, "CONFIG_OR_MODEL_HETEROGENEITY");
  assert.equal(residualPolicyResult.residual_policy_hash_count, 2);
  ok("Residual matching/projection policy heterogeneity is detected independently");

  const duplicates = [graph(0), graph(1)];
  duplicates[1].residual.forecast_target_time = duplicates[0].residual.forecast_target_time;
  duplicates[1].residual.forecast_point.target_time = duplicates[0].residual.forecast_target_time;
  duplicates[1].residual.observation.observed_at = duplicates[0].residual.forecast_target_time;
  duplicates[1].forecast.points = [{ ...duplicates[1].residual.forecast_point }];
  duplicates[1].observation.observed_at = duplicates[0].residual.forecast_target_time;
  const duplicateResult = qualifyCap06DatasetV2(SCOPE, duplicates);
  assert.equal(duplicateResult.dataset_qualification_status, "INVALID_CASE_GRAPH");
  assert.equal(duplicateResult.eligible_residual_count, 0);
  assert.ok(duplicateResult.excluded_cases.every((item) => item.reasons.includes("DUPLICATE_FORECAST_TARGET_TIME")));
  ok("duplicate target times are removed from eligibility and fail closed");

  assert.equal(pass, 11);
  process.stdout.write(`ALL CHECKS PASSED (${pass})\n`);
}

run();
