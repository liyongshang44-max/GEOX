// Purpose: execute the bounded MCFT-CAP-06 S6 exact Candidate plus eight-holdout paired historical shadow compute and emit a non-canonical artifact.
// Boundary: supplied PostgreSQL exact reads and local artifact output only; no fixture seeding, canonical append, projection write, Evaluation commit, active Config, Runtime parameter, State, checkpoint, route, scheduler, or external network retrieval.

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import {
  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  CAP06_HOLDOUT_PURPOSE_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
  type Cap06SourceDatasetIdentityV1,
} from "../../src/domain/calibration/contracts_v1.js";
import { PostgresCalibrationGovernanceRepositoryV1 } from "../../src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { PostgresResolvedForecastObservationCaseAssemblerV1 } from "../../src/persistence/calibration/postgres_resolved_forecast_observation_case_assembler_v1.js";
import { Cap06PairedHistoricalShadowServiceV1 } from "../../src/runtime/calibration/paired_historical_shadow_service_v1.js";
import { Cap04OrCap05ExecutionConfigResolverV1 } from "../../src/runtime/twin_runtime/cap04_or_cap05_execution_config_resolver_v1.js";

export const CAP06_S6_RUNNER_SCHEMA_V1 =
  "geox_mcft_cap_06_s6_paired_shadow_runner_input_v1" as const;
export const CAP06_S6_RUNNER_OPERATION_V1 =
  "PAIRED_HISTORICAL_SHADOW_COMPUTE_V1" as const;

type Cap06S6RunnerInputV1 = {
  schema_version: typeof CAP06_S6_RUNNER_SCHEMA_V1;
  operation: typeof CAP06_S6_RUNNER_OPERATION_V1;
  candidate_ref: string;
  candidate_hash: string;
  ordered_holdout_residual_refs: string[];
  source_dataset_identity: Cap06SourceDatasetIdentityV1;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function parseInputV1(value: unknown): Cap06S6RunnerInputV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CAP06_S6_RUNNER_INPUT_OBJECT_REQUIRED");
  }
  const input = value as Record<string, unknown>;
  if (input.schema_version !== CAP06_S6_RUNNER_SCHEMA_V1) {
    throw new Error("CAP06_S6_RUNNER_SCHEMA_VERSION_MISMATCH");
  }
  if (input.operation !== CAP06_S6_RUNNER_OPERATION_V1) {
    throw new Error("CAP06_S6_RUNNER_OPERATION_NOT_AUTHORIZED");
  }
  if (!Array.isArray(input.ordered_holdout_residual_refs)) {
    throw new Error("CAP06_S6_RUNNER_ORDERED_HOLDOUT_REFS_REQUIRED");
  }
  const identity = input.source_dataset_identity;
  if (!identity || typeof identity !== "object" || Array.isArray(identity)) {
    throw new Error("CAP06_S6_RUNNER_SOURCE_DATASET_IDENTITY_REQUIRED");
  }
  const source = identity as Record<string, unknown>;
  const sourceDatasetIdentity: Cap06SourceDatasetIdentityV1 = {
    residual_set_hash: requiredStringV1(
      source.residual_set_hash,
      "CAP06_S6_RUNNER_RESIDUAL_SET_HASH_REQUIRED",
    ),
    case_input_set_hash: requiredStringV1(
      source.case_input_set_hash,
      "CAP06_S6_RUNNER_CASE_INPUT_SET_HASH_REQUIRED",
    ),
    calibration_window_hash: requiredStringV1(
      source.calibration_window_hash,
      "CAP06_S6_RUNNER_CALIBRATION_WINDOW_HASH_REQUIRED",
    ),
    holdout_window_hash: requiredStringV1(
      source.holdout_window_hash,
      "CAP06_S6_RUNNER_HOLDOUT_WINDOW_HASH_REQUIRED",
    ),
    window_hash_semantics: source.window_hash_semantics as typeof CAP06_WINDOW_HASH_SEMANTICS_V1,
    holdout_purpose: source.holdout_purpose as typeof CAP06_HOLDOUT_PURPOSE_V1,
    holdout_generalization_claim: source.holdout_generalization_claim as typeof CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  };
  if (sourceDatasetIdentity.window_hash_semantics !== CAP06_WINDOW_HASH_SEMANTICS_V1
    || sourceDatasetIdentity.holdout_purpose !== CAP06_HOLDOUT_PURPOSE_V1
    || sourceDatasetIdentity.holdout_generalization_claim !== CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1) {
    throw new Error("CAP06_S6_RUNNER_SOURCE_DATASET_POLICY_MISMATCH");
  }
  return {
    schema_version: CAP06_S6_RUNNER_SCHEMA_V1,
    operation: CAP06_S6_RUNNER_OPERATION_V1,
    candidate_ref: requiredStringV1(input.candidate_ref, "CAP06_S6_RUNNER_CANDIDATE_REF_REQUIRED"),
    candidate_hash: requiredStringV1(input.candidate_hash, "CAP06_S6_RUNNER_CANDIDATE_HASH_REQUIRED"),
    ordered_holdout_residual_refs: input.ordered_holdout_residual_refs.map((ref) => requiredStringV1(
      ref,
      "CAP06_S6_RUNNER_HOLDOUT_RESIDUAL_REF_REQUIRED",
    )),
    source_dataset_identity: sourceDatasetIdentity,
  };
}

async function main(): Promise<void> {
  const databaseUrl = requiredStringV1(process.env.DATABASE_URL, "DATABASE_URL_REQUIRED");
  const inputPath = path.resolve(requiredStringV1(
    process.env.MCFT_CAP_06_S6_RUNNER_INPUT,
    "MCFT_CAP_06_S6_RUNNER_INPUT_REQUIRED",
  ));
  const outputPath = process.env.MCFT_CAP_06_S6_RUNNER_OUTPUT
    ? path.resolve(process.env.MCFT_CAP_06_S6_RUNNER_OUTPUT)
    : null;
  const input = parseInputV1(JSON.parse(fs.readFileSync(inputPath, "utf8")));
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const repository = new PostgresCalibrationGovernanceRepositoryV1(pool);
    const service = new Cap06PairedHistoricalShadowServiceV1(
      repository,
      new PostgresResolvedForecastObservationCaseAssemblerV1(
        pool,
        new Cap04OrCap05ExecutionConfigResolverV1(),
      ),
    );
    const result = await service.compute({
      candidateRef: input.candidate_ref,
      candidateHash: input.candidate_hash,
      orderedHoldoutResidualRefs: input.ordered_holdout_residual_refs,
      sourceDatasetIdentity: input.source_dataset_identity,
    });
    const shadow = result.paired_shadow_compute_result;
    const output = {
      schema_version: "geox_mcft_cap_06_s6_paired_shadow_runner_result_v1",
      status: "PASS",
      operation: input.operation,
      artifact_authority: result.artifact_authority,
      candidate_ref: result.candidate_ref,
      candidate_hash: result.candidate_hash,
      candidate_parameter_value: result.candidate_parameter_value,
      holdout_case_count: result.resolved_holdout_case_count,
      evaluation_disposition: shadow.evaluation_disposition,
      reason_codes: shadow.reason_codes,
      baseline_metrics: shadow.baseline_metrics,
      candidate_metrics: shadow.candidate_metrics,
      case_results: shadow.case_results,
      case_results_hash: shadow.case_results_hash,
      compute_determinism_hash: shadow.determinism_hash,
      deterministic_rerun_verified: result.deterministic_rerun_verified,
      eligible_for_human_activation_review: shadow.eligible_for_human_activation_review,
      canonical_fact_write_count: 0,
      projection_write_count: 0,
      candidate_append_count: 0,
      evaluation_append_count: 0,
      model_activation_count: 0,
      active_config_switch_count: 0,
      runtime_parameter_change_count: 0,
      state_mutation_count: 0,
      checkpoint_mutation_count: 0,
    };
    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    }
    console.log(JSON.stringify(output));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const output = {
    schema_version: "geox_mcft_cap_06_s6_paired_shadow_runner_result_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    canonical_fact_write_count: 0,
    projection_write_count: 0,
    candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
  };
  console.error(JSON.stringify(output));
  process.exitCode = 1;
});
