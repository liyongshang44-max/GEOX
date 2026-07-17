// Purpose: prove the S6 exact Candidate/eight-holdout orchestration, paired replay metrics, deterministic rerun, no-op policy and fail-closed boundaries without persistence.
// Boundary: pure domain and in-memory ports only; no PostgreSQL, canonical append, projection write, Evaluation draft/commit, active Config, State, checkpoint, route, Web, scheduler, or Model Activation.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCap06CaseWindowV1 } from "../../apps/server/src/domain/calibration/case_builder_v1.js";
import {
  CAP06_BASE_PARAMETER_VALUE_V1,
  type Cap06CalibrationPredictionPortV1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";
import { buildCap06CalibrationCandidateDraftV1 } from "../../apps/server/src/domain/calibration/envelope_profiles_v1.js";
import { runCap06CalibrationGridSearchV1 } from "../../apps/server/src/domain/calibration/grid_search_v1.js";
import { runCap06PairedHistoricalShadowV1 } from "../../apps/server/src/domain/calibration/shadow_evaluation_v1.js";
import { Cap06PairedHistoricalShadowServiceV1 } from "../../apps/server/src/runtime/calibration/paired_historical_shadow_service_v1.js";
import { Cap06ResolvedForecastReplayPredictionAdapterV1 } from "../../apps/server/src/runtime/calibration/resolved_forecast_replay_prediction_adapter_v1.js";
import { buildCap06S5CandidateFixtureV1 } from "./mcft_cap_06_s5_candidate_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

async function main(): Promise<void> {
  const fixture = await buildCap06S5CandidateFixtureV1();
  const calibrationRefs = fixture.dataset.calibration_window_refs;
  const holdoutRefs = fixture.dataset.holdout_window_refs;
  const byRef = new Map(fixture.resolved.map((item) => [item.residual.object_id, item]));
  const calibrationResolved = calibrationRefs.map((ref) => {
    const item = byRef.get(ref);
    if (!item) throw new Error(`S6_DOMAIN_CALIBRATION_CASE_MISSING:${ref}`);
    return item;
  });
  const holdoutResolved = holdoutRefs.map((ref) => {
    const item = byRef.get(ref);
    if (!item) throw new Error(`S6_DOMAIN_HOLDOUT_CASE_MISSING:${ref}`);
    return item;
  });
  const calibrationWindow = buildCap06CaseWindowV1({
    role: "CALIBRATION",
    orderedResidualRefs: calibrationRefs,
    loadedCases: calibrationResolved.map((item) => item.case_source),
    sourceDatasetIdentity: fixture.source_dataset_identity,
  });
  const attempt = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort: new Cap06ResolvedForecastReplayPredictionAdapterV1(calibrationResolved),
  });
  assert.equal(attempt.status, "BOUNDED_PARAMETER_DELTA_CANDIDATE");
  assert.equal(attempt.selected_parameter_value, "0.034000");
  const candidate = buildCap06CalibrationCandidateDraftV1({ calibrationWindow, attempt });
  assert.equal(candidate.object_id, "twin_calibration_candidate_5649b9ab80b5545cf6007387");
  assert.equal(candidate.determinism_hash, "sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65");
  ok("exact S5 Candidate is reconstructed from the frozen graph without holdout access");

  let holdoutReadCount = 0;
  const service = new Cap06PairedHistoricalShadowServiceV1(
    {
      async readCanonicalObject(objectId) {
        return objectId === candidate.object_id ? structuredClone(candidate) : null;
      },
    },
    {
      async resolveExactResidualRefs(refs) {
        holdoutReadCount += 1;
        return refs.map((ref) => {
          const item = byRef.get(ref);
          if (!item) throw new Error(`S6_DOMAIN_EXACT_CASE_MISSING:${ref}`);
          return structuredClone(item);
        });
      },
    },
  );
  const positive = await service.compute({
    candidateRef: candidate.object_id,
    candidateHash: candidate.determinism_hash,
    orderedHoldoutResidualRefs: holdoutRefs,
    sourceDatasetIdentity: fixture.source_dataset_identity,
  });
  const shadow = positive.paired_shadow_compute_result;
  assert.equal(holdoutReadCount, 1);
  assert.equal(positive.artifact_authority, "NON_CANONICAL_IN_MEMORY_OR_ACCEPTANCE_ARTIFACT");
  assert.equal(positive.candidate_parameter_value, "0.034000");
  assert.equal(positive.resolved_holdout_case_count, 8);
  assert.equal(positive.deterministic_rerun_verified, true);
  assert.equal(shadow.schema_version, "geox_mcft_cap_06_paired_shadow_compute_result_v1");
  assert.equal(shadow.evaluation_kind, "PAIRED_HISTORICAL_REPLAY_SHADOW_EVALUATION");
  assert.equal(shadow.evaluation_disposition, "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW");
  assert.deepEqual(shadow.reason_codes, ["ALL_THRESHOLDS_PASS"]);
  assert.equal(shadow.case_results.length, 8);
  assert.equal(shadow.eligible_for_human_activation_review, true);
  assert.equal(shadow.model_activation_created, false);
  assert.equal(shadow.active_config_switch_performed, false);
  assert.equal(shadow.approval_created, false);
  assert.equal(shadow.activation_authorized, false);
  assert.equal(shadow.uncertainty_model_changed, false);
  assert.equal(shadow.state_confidence_changed, false);
  for (const key of [
    "canonical_fact_write_count",
    "projection_write_count",
    "candidate_append_count",
    "evaluation_append_count",
    "model_activation_count",
    "active_config_switch_count",
    "runtime_parameter_change_count",
    "state_mutation_count",
    "checkpoint_mutation_count",
  ] as const) assert.equal(positive[key], 0, `S6_DOMAIN_${key.toUpperCase()}_NONZERO`);
  ok("exact eight-case paired historical replay is eligible, deterministic and zero-write");

  const noOp = await runCap06PairedHistoricalShadowV1({
    holdoutWindow: positive.holdout_window,
    candidateParameterValue: CAP06_BASE_PARAMETER_VALUE_V1,
    predictionPort: new Cap06ResolvedForecastReplayPredictionAdapterV1(holdoutResolved),
  });
  assert.equal(noOp.evaluation_disposition, "BASE_PARAMETER_RETAINED");
  assert.deepEqual(noOp.reason_codes, ["NO_OP_CONFIRMED"]);
  assert.equal(noOp.eligible_for_human_activation_review, false);
  assert.ok(noOp.case_results.every((item) => item.base_prediction_vwc === item.candidate_prediction_vwc));
  ok("base-value no-op replay returns BASE_PARAMETER_RETAINED with identical paired predictions");

  const leakingWindow = structuredClone(positive.holdout_window);
  leakingWindow.cases[0].observation_available_to_runtime_at = leakingWindow.cases[0].forecast_as_of;
  const leakage = await runCap06PairedHistoricalShadowV1({
    holdoutWindow: leakingWindow,
    candidateParameterValue: "0.034000",
    predictionPort: new Cap06ResolvedForecastReplayPredictionAdapterV1(holdoutResolved),
  });
  assert.equal(leakage.evaluation_disposition, "INCONCLUSIVE");
  assert.ok(leakage.reason_codes.includes("FUTURE_LEAKAGE_DETECTED"));
  ok("future leakage is explicit and cannot produce activation-review eligibility");

  let predictionSequence = 0;
  const unstablePort: Cap06CalibrationPredictionPortV1 = {
    predictCase(caseItem, parameterValue) {
      predictionSequence += 1;
      const base = new Cap06ResolvedForecastReplayPredictionAdapterV1(holdoutResolved)
        .predictCase(caseItem, parameterValue);
      return {
        ...base,
        prediction_vwc: predictionSequence % 2 === 0
          ? base.prediction_vwc
          : `${base.prediction_vwc.slice(0, -1)}${base.prediction_vwc.endsWith("0") ? "1" : "0"}`,
      };
    },
  };
  const unstable = await runCap06PairedHistoricalShadowV1({
    holdoutWindow: positive.holdout_window,
    candidateParameterValue: "0.034000",
    predictionPort: unstablePort,
  });
  assert.equal(unstable.evaluation_disposition, "INCONCLUSIVE");
  assert.ok(unstable.reason_codes.includes("DETERMINISM_FAILURE"));
  ok("prediction nondeterminism is explicit and cannot produce an eligible artifact");

  const readsBeforeNegative = holdoutReadCount;
  await assert.rejects(
    service.compute({
      candidateRef: candidate.object_id,
      candidateHash: "sha256:wrong",
      orderedHoldoutResidualRefs: holdoutRefs,
      sourceDatasetIdentity: fixture.source_dataset_identity,
    }),
    /CAP06_S6_CANDIDATE_HASH_MISMATCH/,
  );
  assert.equal(holdoutReadCount, readsBeforeNegative);
  await assert.rejects(
    service.compute({
      candidateRef: candidate.object_id,
      candidateHash: candidate.determinism_hash,
      orderedHoldoutResidualRefs: holdoutRefs.slice(0, 7),
      sourceDatasetIdentity: fixture.source_dataset_identity,
    }),
    /CAP06_S6_EXACT_HOLDOUT_REF_COUNT_REQUIRED/,
  );
  await assert.rejects(
    service.compute({
      candidateRef: candidate.object_id,
      candidateHash: candidate.determinism_hash,
      orderedHoldoutResidualRefs: [...holdoutRefs.slice(0, 7), calibrationRefs[0]],
      sourceDatasetIdentity: fixture.source_dataset_identity,
    }),
    /CAP06_S6_CANDIDATE_CONTAINS_HOLDOUT_REF/,
  );
  await assert.rejects(
    service.compute({
      candidateRef: candidate.object_id,
      candidateHash: candidate.determinism_hash,
      orderedHoldoutResidualRefs: holdoutRefs,
      sourceDatasetIdentity: {
        ...fixture.source_dataset_identity,
        holdout_window_hash: "sha256:wrong",
      },
    }),
    /CAP06_S6_CANDIDATE_SOURCE_IDENTITY_MISMATCH:HOLDOUT_WINDOW_HASH/,
  );
  ok("candidate hash, holdout cardinality, calibration substitution and source identity fail closed before artifact authority");

  const result = {
    schema_version: "geox_mcft_cap_06_s6_paired_shadow_domain_result_v1",
    status: "PASS",
    profile_id: fixture.dataset.profile_id,
    candidate_ref: candidate.object_id,
    candidate_hash: candidate.determinism_hash,
    candidate_parameter_value: positive.candidate_parameter_value,
    holdout_case_count: positive.resolved_holdout_case_count,
    evaluation_disposition: shadow.evaluation_disposition,
    reason_codes: shadow.reason_codes,
    baseline_metrics: shadow.baseline_metrics,
    candidate_metrics: shadow.candidate_metrics,
    case_results_hash: shadow.case_results_hash,
    compute_determinism_hash: shadow.determinism_hash,
    deterministic_rerun_verified: true,
    future_leakage_count: 0,
    canonical_fact_write_count: 0,
    projection_write_count: 0,
    candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    pass_count: pass,
  };
  fs.mkdirSync(path.join(ROOT, "acceptance-output"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_DOMAIN_RESULT.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  console.log(`MCFT-CAP-06 S6 paired shadow domain acceptance: ${pass} PASS, 0 FAIL`);
  console.log(`S6_PAIRED_SHADOW_DOMAIN_RESULT_JSON:${JSON.stringify(result)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
