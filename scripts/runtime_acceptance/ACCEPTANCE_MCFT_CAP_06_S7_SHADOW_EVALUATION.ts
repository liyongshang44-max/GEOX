// Purpose: prove exact S6 artifact validation, deterministic Evaluation draft construction, one controlled append, canonical readback, completed-chain idempotency and fail-closed S7 boundaries without PostgreSQL.
// Boundary: in-memory exact ports only; no alternative shadow compute, Candidate append, Model Activation, active Config, Runtime parameter, State, checkpoint, route, Web or scheduler.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCap06CaseWindowV1 } from "../../apps/server/src/domain/calibration/case_builder_v1.js";
import { buildCap06CalibrationCandidateDraftV1 } from "../../apps/server/src/domain/calibration/envelope_profiles_v1.js";
import { runCap06CalibrationGridSearchV1 } from "../../apps/server/src/domain/calibration/grid_search_v1.js";
import type {
  Cap06GovernanceObjectV1,
  Cap06GovernancePersistenceResultV1,
} from "../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { Cap06PairedHistoricalShadowServiceV1 } from "../../apps/server/src/runtime/calibration/paired_historical_shadow_service_v1.js";
import { Cap06ResolvedForecastReplayPredictionAdapterV1 } from "../../apps/server/src/runtime/calibration/resolved_forecast_replay_prediction_adapter_v1.js";
import { Cap06ShadowEvaluationCommitServiceV1 } from "../../apps/server/src/runtime/calibration/shadow_evaluation_commit_service_v1.js";
import { buildCap06S5CandidateFixtureV1 } from "./mcft_cap_06_s5_candidate_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

async function buildControlledChainV1() {
  const fixture = await buildCap06S5CandidateFixtureV1();
  const byRef = new Map(fixture.resolved.map((item) => [item.residual.object_id, item]));
  const calibrationResolved = fixture.dataset.calibration_window_refs.map((ref) => {
    const item = byRef.get(ref);
    if (!item) throw new Error(`S7_DOMAIN_CALIBRATION_CASE_MISSING:${ref}`);
    return item;
  });
  const calibrationWindow = buildCap06CaseWindowV1({
    role: "CALIBRATION",
    orderedResidualRefs: fixture.dataset.calibration_window_refs,
    loadedCases: calibrationResolved.map((item) => item.case_source),
    sourceDatasetIdentity: fixture.source_dataset_identity,
  });
  const attempt = await runCap06CalibrationGridSearchV1({
    calibrationWindow,
    predictionPort: new Cap06ResolvedForecastReplayPredictionAdapterV1(calibrationResolved),
  });
  const candidate = buildCap06CalibrationCandidateDraftV1({ calibrationWindow, attempt });
  const s6 = new Cap06PairedHistoricalShadowServiceV1(
    {
      async readCanonicalObject(objectId) {
        return objectId === candidate.object_id ? structuredClone(candidate) : null;
      },
    },
    {
      async resolveExactResidualRefs(refs) {
        return refs.map((ref) => {
          const item = byRef.get(ref);
          if (!item) throw new Error(`S7_DOMAIN_HOLDOUT_CASE_MISSING:${ref}`);
          return structuredClone(item);
        });
      },
    },
  );
  const artifact = await s6.compute({
    candidateRef: candidate.object_id,
    candidateHash: candidate.determinism_hash,
    orderedHoldoutResidualRefs: fixture.dataset.holdout_window_refs,
    sourceDatasetIdentity: fixture.source_dataset_identity,
  });
  return { fixture, candidate, artifact };
}

async function main(): Promise<void> {
  const { fixture, candidate, artifact } = await buildControlledChainV1();
  assert.equal(candidate.object_id, "twin_calibration_candidate_5649b9ab80b5545cf6007387");
  assert.equal(candidate.determinism_hash, "sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65");
  assert.equal(artifact.candidate_parameter_value, "0.034000");
  assert.equal(artifact.resolved_holdout_case_count, 8);
  assert.equal(artifact.paired_shadow_compute_result.evaluation_disposition, "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW");
  assert.deepEqual(artifact.paired_shadow_compute_result.reason_codes, ["ALL_THRESHOLDS_PASS"]);
  ok("exact S5 Candidate and complete deterministic S6 artifact are reconstructed through frozen authorities");

  const objects = new Map<string, Cap06GovernanceObjectV1>([[candidate.object_id, structuredClone(candidate)]]);
  let commitCallCount = 0;
  const service = new Cap06ShadowEvaluationCommitServiceV1({
    async readCanonicalObject(objectId) {
      return structuredClone(objects.get(objectId) ?? null);
    },
    async commitCanonicalObject({ object }): Promise<Cap06GovernancePersistenceResultV1> {
      commitCallCount += 1;
      const existing = objects.get(object.object_id);
      if (existing) {
        assert.equal(existing.determinism_hash, object.determinism_hash);
        return {
          status: "EXISTING_IDEMPOTENT_SUCCESS",
          object: structuredClone(existing),
          fact_id: `fact_${existing.object_id}`,
        };
      }
      objects.set(object.object_id, structuredClone(object));
      return {
        status: "INSERTED",
        object: structuredClone(object),
        fact_id: `fact_${object.object_id}`,
      };
    },
  });

  const first = await service.commit({ s6Artifact: artifact });
  assert.equal(first.persistence_status, "INSERTED");
  assert.equal(first.evaluation_append_count, 1);
  assert.equal(first.aggregate_projection_row_count, 1);
  assert.equal(first.candidate_evaluation_index_row_count, 1);
  assert.equal(first.case_projection_row_count, 8);
  assert.equal(first.projection_row_count, 10);
  assert.equal(first.canonical_readback_verified, true);
  assert.equal(first.candidate_ref, candidate.object_id);
  assert.equal(first.candidate_hash, candidate.determinism_hash);
  assert.equal(first.evaluation_disposition, "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW");
  assert.deepEqual(first.reason_codes, ["ALL_THRESHOLDS_PASS"]);
  assert.equal(first.holdout_case_count, 8);
  assert.equal(first.source_s6_case_results_hash, artifact.paired_shadow_compute_result.case_results_hash);
  assert.equal(first.source_s6_compute_determinism_hash, artifact.paired_shadow_compute_result.determinism_hash);
  assert.equal(first.candidate_append_count, 0);
  assert.equal(first.model_activation_count, 0);
  assert.equal(first.active_config_switch_count, 0);
  assert.equal(first.runtime_parameter_change_count, 0);
  assert.equal(first.state_mutation_count, 0);
  assert.equal(first.checkpoint_mutation_count, 0);
  ok("complete S6 artifact produces exactly one deterministic Evaluation append and expected 1+1+8 projection rows");

  const second = await service.commit({ s6Artifact: structuredClone(artifact) });
  assert.equal(second.persistence_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(second.evaluation_ref, first.evaluation_ref);
  assert.equal(second.evaluation_hash, first.evaluation_hash);
  assert.equal(second.source_s6_artifact_hash, first.source_s6_artifact_hash);
  assert.equal(second.evaluation_append_count, 0);
  assert.equal(second.projection_row_count, 0);
  assert.equal(commitCallCount, 2);
  ok("completed-chain rerun returns the same Evaluation identity with zero new append or projection rows");

  const commitCountBeforeNegative = commitCallCount;
  const badCaseHash = structuredClone(artifact);
  badCaseHash.paired_shadow_compute_result.case_results_hash = "sha256:wrong";
  await assert.rejects(
    service.commit({ s6Artifact: badCaseHash }),
    /CAP06_S7_S6_CASE_RESULTS_HASH_INVALID/,
  );
  const badComputeHash = structuredClone(artifact);
  badComputeHash.paired_shadow_compute_result.determinism_hash = "sha256:wrong";
  await assert.rejects(
    service.commit({ s6Artifact: badComputeHash }),
    /CAP06_S7_S6_COMPUTE_DETERMINISM_HASH_INVALID/,
  );
  const badCandidateHash = structuredClone(artifact);
  badCandidateHash.candidate_hash = "sha256:wrong";
  await assert.rejects(
    service.commit({ s6Artifact: badCandidateHash }),
    /CAP06_S7_CANDIDATE_HASH_MISMATCH/,
  );
  const missingCase = structuredClone(artifact);
  missingCase.paired_shadow_compute_result.case_results.pop();
  await assert.rejects(
    service.commit({ s6Artifact: missingCase }),
    /CAP06_S7_S6_CASE_RESULTS_COUNT_MISMATCH/,
  );
  const reordered = structuredClone(artifact);
  [reordered.ordered_holdout_residual_refs[0], reordered.ordered_holdout_residual_refs[1]] = [
    reordered.ordered_holdout_residual_refs[1],
    reordered.ordered_holdout_residual_refs[0],
  ];
  await assert.rejects(
    service.commit({ s6Artifact: reordered }),
    /CAP06_S7_S6_HOLDOUT_REF_ORDER_MISMATCH/,
  );
  assert.equal(commitCallCount, commitCountBeforeNegative);
  ok("case hash, compute hash, Candidate hash, case cardinality and holdout ordering fail before the commit port is called");

  const evaluation = objects.get(first.evaluation_ref);
  assert.ok(evaluation && evaluation.object_type === "twin_shadow_evaluation_v1");
  const payload = evaluation.payload;
  assert.equal(payload.candidate_ref, candidate.object_id);
  assert.equal(payload.candidate_hash, candidate.determinism_hash);
  assert.equal(payload.case_results_hash, artifact.paired_shadow_compute_result.case_results_hash);
  assert.equal(payload.compute_determinism_hash, artifact.paired_shadow_compute_result.determinism_hash);
  assert.equal(payload.evaluation_disposition, "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW");
  assert.deepEqual(payload.reason_codes, ["ALL_THRESHOLDS_PASS"]);
  assert.equal((payload.case_results as unknown[]).length, 8);
  assert.equal(payload.eligible_for_human_activation_review, true);
  assert.equal(payload.model_activation_created, false);
  assert.equal(payload.active_config_switch_performed, false);
  assert.equal(payload.approval_created, false);
  assert.equal(payload.activation_authorized, false);
  ok("canonical Evaluation embeds the exact eight-case S6 evidence and remains review-only, not activation authority");

  const result = {
    schema_version: "geox_mcft_cap_06_s7_shadow_evaluation_domain_result_v1",
    status: "PASS",
    profile_id: fixture.dataset.profile_id,
    source_s6_artifact_hash: first.source_s6_artifact_hash,
    source_s6_case_results_hash: first.source_s6_case_results_hash,
    source_s6_compute_determinism_hash: first.source_s6_compute_determinism_hash,
    candidate_ref: first.candidate_ref,
    candidate_hash: first.candidate_hash,
    candidate_parameter_value: artifact.candidate_parameter_value,
    holdout_case_count: first.holdout_case_count,
    evaluation_ref: first.evaluation_ref,
    evaluation_hash: first.evaluation_hash,
    evaluation_disposition: first.evaluation_disposition,
    reason_codes: first.reason_codes,
    first_evaluation_append_count: first.evaluation_append_count,
    completed_chain_rerun_evaluation_append_count: second.evaluation_append_count,
    aggregate_projection_count: first.aggregate_projection_row_count,
    candidate_evaluation_index_count: first.candidate_evaluation_index_row_count,
    case_projection_count: first.case_projection_row_count,
    canonical_readback_verified: true,
    candidate_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    migration_count: 0,
    pass_count: pass,
  };
  fs.mkdirSync(path.join(ROOT, "acceptance-output"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "acceptance-output/MCFT_CAP_06_S7_SHADOW_EVALUATION_DOMAIN_RESULT.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  console.log(`MCFT-CAP-06 S7 Shadow Evaluation domain acceptance: ${pass} PASS, 0 FAIL`);
  console.log(`S7_SHADOW_EVALUATION_DOMAIN_RESULT_JSON:${JSON.stringify(result)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
