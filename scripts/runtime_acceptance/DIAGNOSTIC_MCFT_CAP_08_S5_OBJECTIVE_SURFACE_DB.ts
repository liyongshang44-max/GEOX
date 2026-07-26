// Disposable development diagnostic for the exact MCFT-CAP-08.S5 21-point objective surface.
// No Candidate, Shadow, Model Activation, active Config switch, effectiveness, or final formal run authority.

import fs from "node:fs";
import path from "node:path";

import {
  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  CAP06_HOLDOUT_PURPOSE_V1,
  CAP06_SEARCH_MAXIMUM_V1,
  CAP06_SEARCH_MINIMUM_V1,
  CAP06_SENSITIVITY_EPSILON_VWC_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
  type Cap06SourceDatasetIdentityV1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";
import {
  asCap06ComputeWindowV1,
  buildCap08S5CaseWindowV1,
  buildCap08S5CaseWindowsV1,
} from "../../apps/server/src/domain/calibration/cap08_s5_case_builder_v1.js";
import { runCap06CalibrationGridSearchV1 } from "../../apps/server/src/domain/calibration/grid_search_v1.js";
import { parseCap06VwcMetricV1 } from "../../apps/server/src/domain/calibration/fixed_point_metric_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresCap08S5ExactSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s5_exact_source_v1.js";
import { Cap08S5ReplayPredictionAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s5_replay_prediction_adapter_v1.js";
import { runner, admin } from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { establishCap08S5SlicePredecessorV1 } from "./mcft_cap08_s5_acceptance_support_v1.js";

if (process.env.MCFT_CAP08_S5_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP08_S5_DESTRUCTIVE_ACCEPTANCE_1");
}

const OUT = "acceptance-output/MCFT_CAP_08_S5_OBJECTIVE_SURFACE_DIAGNOSTIC.json";

function absoluteV1(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function sourceDatasetIdentityV1(resolved: readonly Awaited<ReturnType<PostgresCap08S5ExactSourceV1["resolveExactObligation"]>>[]): Cap06SourceDatasetIdentityV1 {
  const refs = resolved.map((item) => item.residual.object_id);
  return {
    residual_set_hash: semanticHashV1(resolved.map((item) => ({ ref: item.residual.object_id, hash: item.residual.determinism_hash }))),
    case_input_set_hash: semanticHashV1(resolved.map((item) => ({
      residual_ref: item.case_source.residual_ref,
      residual_hash: item.case_source.residual_hash,
      forecast_point_ref: item.case_source.source_forecast_point_ref,
      forecast_point_hash: item.case_source.source_forecast_point_hash,
      observation_ref: item.case_source.actual_observation_ref,
      observation_hash: item.case_source.actual_observation_hash,
    }))),
    calibration_window_hash: semanticHashV1(refs.slice(0, 16)),
    holdout_window_hash: semanticHashV1(refs.slice(16)),
    window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,
    holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,
    holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  };
}

async function main(): Promise<void> {
  try {
    const established = await establishCap08S5SlicePredecessorV1(path.resolve("."));
    const source = new PostgresCap08S5ExactSourceV1(
      runner,
      new PostgresFeedbackPersistenceRepositoryV1(runner),
    );
    const resolved = [];
    for (const obligation of established.obligations) {
      resolved.push(await source.resolveExactObligation({
        scope: established.predecessor.fixture.scope,
        formal_run_id: established.predecessor.fixture.formal_run_id,
        obligation,
        created_at: "2026-07-26T00:00:00.000Z",
      }));
    }
    const identity = sourceDatasetIdentityV1(resolved);
    const calibrationResolved = resolved.slice(0, 16);
    const holdoutResolved = resolved.slice(16);
    const calibrationWindow = buildCap08S5CaseWindowV1({
      role: "CALIBRATION",
      orderedResidualRefs: calibrationResolved.map((item) => item.residual.object_id),
      loadedCases: calibrationResolved.map((item) => item.case_source),
      sourceDatasetIdentity: identity,
    });
    const holdoutWindow = buildCap08S5CaseWindowV1({
      role: "HOLDOUT",
      orderedResidualRefs: holdoutResolved.map((item) => item.residual.object_id),
      loadedCases: holdoutResolved.map((item) => item.case_source),
      sourceDatasetIdentity: identity,
    });
    const windows = buildCap08S5CaseWindowsV1({ calibration: calibrationWindow, holdout: holdoutWindow });
    const prediction = new Cap08S5ReplayPredictionAdapterV1(resolved);
    const epsilon = parseCap06VwcMetricV1(CAP06_SENSITIVITY_EPSILON_VWC_V1);
    const caseSensitivity = [];
    for (const caseItem of calibrationWindow.cases) {
      const computeCase = caseItem as never;
      const minimum = await prediction.predictCase(computeCase, CAP06_SEARCH_MINIMUM_V1);
      const maximum = await prediction.predictCase(computeCase, CAP06_SEARCH_MAXIMUM_V1);
      const delta = parseCap06VwcMetricV1(maximum.prediction_vwc)
        - parseCap06VwcMetricV1(minimum.prediction_vwc);
      caseSensitivity.push({
        case_index: caseItem.case_index,
        residual_ref: caseItem.residual_ref,
        wetness_regime: caseItem.wetness_regime,
        drainage_excitation_eligible: caseItem.drainage_excitation_eligible,
        excess_above_field_capacity_mm: caseItem.excess_above_field_capacity_mm,
        minimum_prediction_vwc: minimum.prediction_vwc,
        maximum_prediction_vwc: maximum.prediction_vwc,
        endpoint_delta_vwc_scale_9: delta.toString(),
        endpoint_absolute_delta_vwc_scale_9: absoluteV1(delta).toString(),
        sensitive: absoluteV1(delta) >= epsilon,
      });
    }
    const attempt = await runCap06CalibrationGridSearchV1({
      calibrationWindow: asCap06ComputeWindowV1(calibrationWindow),
      predictionPort: prediction,
    });
    const result = {
      schema_version: "geox_mcft_cap08_s5_objective_surface_diagnostic_v1",
      status: "DIAGNOSTIC_ONLY",
      formal_run_id: established.predecessor.fixture.formal_run_id,
      source_dataset_identity: identity,
      windows,
      calibration_case_sensitivity: caseSensitivity,
      sensitive_case_count_from_endpoint_probe: caseSensitivity.filter((item) => item.sensitive).length,
      represented_sensitive_regimes_from_endpoint_probe: [...new Set(
        caseSensitivity.filter((item) => item.sensitive).map((item) => item.wetness_regime),
      )].sort(),
      attempt,
      expected_candidate_value: "0.034000",
      oracle_matches: attempt.selected_parameter_value === "0.034000",
      candidate_created: false,
      shadow_created: false,
      s5_effective: false,
      final_formal_run_id: null,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await Promise.allSettled([runner.end(), admin.end()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
