// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_CASE_GRAPH_QUALIFICATION_V3.ts
// Purpose: prove recursive hashing, exact dual-Config graph closure, explicit exclusions, homogeneity gates and dual-time 16/8 separation for MCFT-CAP-06 S0 v2.
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
  // Count only assertions that establish one independent S0 qualification property.
  pass += 1;
  process.stdout.write(`PASS ${message}\n`);
}

function hourIso(index: number): string {
  // Produce canonical whole-hour instants for deterministic event-time and availability ordering.
  return new Date(Date.UTC(2026, 0, 1, index, 0, 0, 0)).toISOString();
}

function refHash(prefix: string, index: number): { ref: string; hash: string } {
  // Synthetic references retain independent semantic hashes so wrong-edge substitutions are observable.
  return { ref: `${prefix}_${index}`, hash: semanticHashV1({ prefix, index }) };
}

function buildGraph(index: number): Cap06ResolvedCaseGraphV2 {
  // Forecast and Residual Configs intentionally have distinct identities while sharing the frozen effective parameter authorities.
  const forecast = refHash("forecast", index);
  const point = { ...refHash("forecast_point", index), horizon_hour: 1, target_time: hourIso(index + 2) };
  const posterior = refHash("posterior", index);
  const forecastConfig = refHash("forecast_runtime_config", index);
  const residualConfig = refHash("residual_runtime_config", index);
  const evidenceWindow = refHash("evidence_window", index);
  const observation = refHash("observation", index);
  const weather = refHash("weather", index);
  const et0 = refHash("et0", index);
  const cropStage = refHash("crop_stage", 1);
  const geometry = refHash("geometry", 1);
  const residual = refHash("residual", index);

  return {
    residual: {
      residual_ref: residual.ref,
      residual_hash: residual.hash,
      scope: { ...SCOPE },
      context_lineage_ref: "lineage_da76d015085f0d37bf2ed478",
      context_revision_ref: "revision_e0c62f99ac3db66f60a87e2b",
      forecast_run: forecast,
      forecast_point: point,
      forecast_issued_at: hourIso(index + 1),
      forecast_target_time: point.target_time,
      observation: {
        ...observation,
        observed_at: point.target_time,
        available_to_runtime_at: hourIso(index + 3),
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
      context_lineage_ref: "lineage_da76d015085f0d37bf2ed478",
      context_revision_ref: "revision_e0c62f99ac3db66f60a87e2b",
      status: "COMPLETED",
      issued_at: hourIso(index + 1),
      as_of: hourIso(index + 1),
      source_posterior: posterior,
      forecast_runtime_config: forecastConfig,
      evidence_window: evidenceWindow,
      forcing_cycle_key: `forcing_cycle_${index}`,
      forcing_window_hash: semanticHashV1({ forcing_window: index }),
      weather_snapshot: weather,
      et0_snapshot: et0,
      crop_stage_context: cropStage,
      points: [point],
    },
    source_posterior: {
      ...posterior,
      scope: { ...SCOPE },
      context_lineage_ref: "lineage_da76d015085f0d37bf2ed478",
      context_revision_ref: "revision_e0c62f99ac3db66f60a87e2b",
      forecast_runtime_config: forecastConfig,
    },
    forecast_runtime_config: {
      ...forecastConfig,
      model_component_basis: {
        water_dynamics: { component_id: "water_balance_v1", version: "1" },
        observation_projection: { component_id: "root_zone_projection_v1", version: "1" },
      },
      effective_parameter_bundle_basis: {
        soil: {
          field_capacity: "0.300000",
          saturation: "0.450000",
          wilting_point: "0.120000",
        },
        dynamics: {
          drainage_coefficient_per_hour: "0.030000",
          runoff_fraction: "0.000000",
        },
        observation: {
          sensor_measurement_stddev_fraction: "0.020000",
          point_to_zone_representativeness_stddev_fraction: "0.060000",
        },
      },
      runtime_replay_numeric_policy_basis: {
        fixed_point_scales: {
          water_amount: 6,
          water_variance: 12,
        },
        rounding: {
          rule_id: "DECIMAL_HALF_AWAY_FROM_ZERO_V1",
          rule_version: "1",
        },
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
    evidence_window: {
      ...evidenceWindow,
      evidence_cutoff_at: hourIso(index + 1),
    },
    observation: {
      ...observation,
      observed_at: point.target_time,
      available_to_runtime_at: hourIso(index + 3),
      quality: "PASS",
      unit: "fraction",
    },
    weather_snapshot: weather,
    et0_snapshot: et0,
    crop_stage_context: cropStage,
    root_zone_geometry: geometry,
  };
}

function cloneGraph(graph: Cap06ResolvedCaseGraphV2): Cap06ResolvedCaseGraphV2 {
  // Preserve isolation between negative test mutations.
  return structuredClone(graph);
}

function run(): void {
  const nestedA = {
    soil: { field_capacity: "0.300000", saturation: "0.450000" },
    dynamics: { drainage_coefficient_per_hour: "0.030000" },
  };
  const nestedB = {
    soil: { field_capacity: "0.300000", saturation: "0.450001" },
    dynamics: { drainage_coefficient_per_hour: "0.030000" },
  };
  assert.notEqual(semanticHashV1(nestedA), semanticHashV1(nestedB));
  ok("recursive canonical hash changes when a nested parameter changes");

  const orderedA = {
    soil: { saturation: "0.450000", field_capacity: "0.300000" },
    dynamics: { drainage_coefficient_per_hour: "0.030000" },
  };
  const orderedB = {
    dynamics: { drainage_coefficient_per_hour: "0.030000" },
    soil: { field_capacity: "0.300000", saturation: "0.450000" },
  };
  assert.equal(semanticHashV1(orderedA), semanticHashV1(orderedB));
  ok("recursive canonical hash is invariant to object-key order at every depth");

  const distinctConfigs = qualifyCap06DatasetV2(SCOPE, [buildGraph(0)]);
  assert.equal(distinctConfigs.case_graph_validation_status, "PASS");
  assert.equal(distinctConfigs.dataset_qualification_status, "INSUFFICIENT_MATCHED_PAIRS");
  assert.equal(distinctConfigs.eligible_residual_count, 1);
  assert.notEqual(
    distinctConfigs.eligible_cases[0]?.forecast_runtime_config_ref,
    distinctConfigs.eligible_cases[0]?.residual_runtime_config_ref,
  );
  ok("distinct Forecast-time and Residual-time Config identities are legal when both graphs close exactly");

  const wrongResidualConfigEdge = buildGraph(0);
  wrongResidualConfigEdge.residual.residual_runtime_config = {
    ref: wrongResidualConfigEdge.forecast_runtime_config.ref,
    hash: wrongResidualConfigEdge.forecast_runtime_config.hash,
  };
  const wrongResidualConfig = qualifyCap06DatasetV2(SCOPE, [wrongResidualConfigEdge]);
  assert.equal(wrongResidualConfig.case_graph_validation_status, "FAIL");
  assert.equal(wrongResidualConfig.dataset_qualification_status, "INVALID_CASE_GRAPH");
  assert.ok(wrongResidualConfig.excluded_cases[0]?.reasons.includes("RESIDUAL_RUNTIME_CONFIG_REF_HASH_MISMATCH"));
  ok("substituting the Forecast Config for the Residual Config fails closed");

  const wrongForecastConfigEdge = buildGraph(0);
  wrongForecastConfigEdge.source_posterior.forecast_runtime_config = {
    ref: wrongForecastConfigEdge.residual_runtime_config.ref,
    hash: wrongForecastConfigEdge.residual_runtime_config.hash,
  };
  const wrongForecastConfig = qualifyCap06DatasetV2(SCOPE, [wrongForecastConfigEdge]);
  assert.equal(wrongForecastConfig.case_graph_validation_status, "FAIL");
  assert.ok(wrongForecastConfig.excluded_cases[0]?.reasons.includes("POSTERIOR_RUNTIME_CONFIG_REF_HASH_MISMATCH"));
  ok("substituting the Residual Config for the source posterior Forecast Config fails closed");

  const limitedGraph = buildGraph(0);
  limitedGraph.residual.observation.quality = "LIMITED";
  limitedGraph.observation.quality = "LIMITED";
  const limited = qualifyCap06DatasetV2(SCOPE, [limitedGraph]);
  assert.equal(limited.case_graph_validation_status, "PASS");
  assert.equal(limited.dataset_qualification_status, "INSUFFICIENT_MATCHED_PAIRS");
  assert.equal(limited.eligible_residual_count, 0);
  assert.equal(limited.excluded_cases[0]?.exclusion_class, "POLICY_EXCLUSION");
  assert.deepEqual(limited.excluded_cases[0]?.reasons, ["OBSERVATION_QUALITY_NOT_PASS"]);
  ok("a legitimate LIMITED case is excluded without converting the complete graph to FAIL");

  const brokenForecastHash = buildGraph(0);
  brokenForecastHash.residual.forecast_run.hash = semanticHashV1({ wrong: true });
  const invalidGraph = qualifyCap06DatasetV2(SCOPE, [brokenForecastHash]);
  assert.equal(invalidGraph.case_graph_validation_status, "FAIL");
  assert.equal(invalidGraph.dataset_qualification_status, "INVALID_CASE_GRAPH");
  assert.ok(invalidGraph.excluded_cases[0]?.reasons.includes("RESIDUAL_FORECAST_RUN_REF_HASH_MISMATCH"));
  ok("a Forecast ref/hash mismatch fails closed as INVALID_CASE_GRAPH");

  const futureLeak = buildGraph(0);
  futureLeak.forecast.as_of = futureLeak.observation.available_to_runtime_at;
  const availability = qualifyCap06DatasetV2(SCOPE, [futureLeak]);
  assert.equal(availability.case_graph_validation_status, "PASS");
  assert.equal(availability.dataset_qualification_status, "AVAILABILITY_ORDER_INVALID");
  assert.equal(availability.excluded_cases[0]?.exclusion_class, "AVAILABILITY_ORDER_INVALID");
  ok("Forecast as_of at Observation availability fails the anti-leakage gate");

  const readyGraphs = Array.from({ length: 24 }, (_, index) => buildGraph(index));
  const ready = qualifyCap06DatasetV2(SCOPE, readyGraphs);
  assert.equal(ready.case_graph_validation_status, "PASS");
  assert.equal(ready.dataset_qualification_status, "READY_FOR_CALIBRATION_ASSESSMENT");
  assert.equal(ready.eligible_calibration_count, 16);
  assert.equal(ready.eligible_holdout_count, 8);
  assert.equal(ready.calibration_window_refs.length, 16);
  assert.equal(ready.holdout_window_refs.length, 8);
  assert.deepEqual([
    ready.model_component_hash_count,
    ready.effective_parameter_bundle_hash_count,
    ready.observation_operator_hash_count,
    ready.geometry_hash_count,
    ready.runtime_replay_numeric_policy_hash_count,
    ready.residual_policy_hash_count,
  ], [1, 1, 1, 1, 1, 1]);
  ok("24 homogeneous exact cases produce a deterministic 16 calibration / 8 holdout split");

  const heterogeneousGraphs = readyGraphs.map(cloneGraph);
  heterogeneousGraphs[23].forecast_runtime_config.effective_parameter_bundle_basis = {
    soil: {
      field_capacity: "0.300000",
      saturation: "0.450001",
      wilting_point: "0.120000",
    },
    dynamics: {
      drainage_coefficient_per_hour: "0.030000",
      runoff_fraction: "0.000000",
    },
  };
  const heterogeneous = qualifyCap06DatasetV2(SCOPE, heterogeneousGraphs);
  assert.equal(heterogeneous.case_graph_validation_status, "PASS");
  assert.equal(heterogeneous.dataset_qualification_status, "CONFIG_OR_MODEL_HETEROGENEITY");
  assert.equal(heterogeneous.effective_parameter_bundle_hash_count, 2);
  ok("nested Forecast parameter heterogeneity is detected by the authoritative recursive hash");

  const residualPolicyGraphs = readyGraphs.map(cloneGraph);
  residualPolicyGraphs[23].residual_runtime_config.residual_policy_basis = {
    matching_policy_id: "ALTERNATE_FORBIDDEN_POLICY",
  };
  const residualPolicyHeterogeneity = qualifyCap06DatasetV2(SCOPE, residualPolicyGraphs);
  assert.equal(residualPolicyHeterogeneity.dataset_qualification_status, "CONFIG_OR_MODEL_HETEROGENEITY");
  assert.equal(residualPolicyHeterogeneity.residual_policy_hash_count, 2);
  ok("Residual matching/projection policy heterogeneity is detected independently of Forecast parameters");

  const duplicateGraphs = [buildGraph(0), buildGraph(1)];
  duplicateGraphs[1].residual.forecast_target_time = duplicateGraphs[0].residual.forecast_target_time;
  duplicateGraphs[1].residual.forecast_point.target_time = duplicateGraphs[0].residual.forecast_target_time;
  duplicateGraphs[1].residual.observation.observed_at = duplicateGraphs[0].residual.forecast_target_time;
  duplicateGraphs[1].forecast.points = [{ ...duplicateGraphs[1].residual.forecast_point }];
  duplicateGraphs[1].observation.observed_at = duplicateGraphs[0].residual.forecast_target_time;
  const duplicate = qualifyCap06DatasetV2(SCOPE, duplicateGraphs);
  assert.equal(duplicate.case_graph_validation_status, "FAIL");
  assert.equal(duplicate.dataset_qualification_status, "INVALID_CASE_GRAPH");
  assert.equal(duplicate.eligible_residual_count, 0);
  assert.ok(duplicate.excluded_cases.every((item) => item.reasons.includes("DUPLICATE_FORECAST_TARGET_TIME")));
  ok("duplicate target times are removed from eligibility and fail closed");

  assert.equal(pass, 11);
  process.stdout.write(`ALL CHECKS PASSED (${pass})\n`);
}

run();
