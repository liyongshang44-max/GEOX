// Purpose: execute the bounded MCFT-CAP-06 runner; S5 authorizes only CALIBRATION_CANDIDATE_COMPUTE_COMMIT_V1.
// Boundary: exact input file + supplied PostgreSQL only; no fixture seeding, holdout access, Shadow Evaluation in S5, Model Activation, active-config switch, Runtime parameter mutation, State/checkpoint mutation, route, scheduler or external network retrieval.

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
import { Cap06CalibrationCandidateServiceV1 } from "../../src/runtime/calibration/calibration_candidate_service_v1.js";
import { Cap04OrCap05ExecutionConfigResolverV1 } from "../../src/runtime/twin_runtime/cap04_or_cap05_execution_config_resolver_v1.js";

export const CAP06_RUNNER_SCHEMA_V1 = "geox_mcft_cap_06_runner_input_v1" as const;
export const CAP06_S5_RUNNER_OPERATION_V1 =
  "CALIBRATION_CANDIDATE_COMPUTE_COMMIT_V1" as const;

type Cap06RunnerInputV1 = {
  schema_version: typeof CAP06_RUNNER_SCHEMA_V1;
  operation: typeof CAP06_S5_RUNNER_OPERATION_V1;
  ordered_residual_refs: string[];
  source_dataset_identity: Cap06SourceDatasetIdentityV1;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function parseInputV1(value: unknown): Cap06RunnerInputV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CAP06_RUNNER_INPUT_OBJECT_REQUIRED");
  }
  const input = value as Record<string, unknown>;
  if (input.schema_version !== CAP06_RUNNER_SCHEMA_V1) {
    throw new Error("CAP06_RUNNER_SCHEMA_VERSION_MISMATCH");
  }
  if (input.operation !== CAP06_S5_RUNNER_OPERATION_V1) {
    throw new Error("CAP06_RUNNER_OPERATION_NOT_AUTHORIZED_BY_S5");
  }
  if (!Array.isArray(input.ordered_residual_refs)) {
    throw new Error("CAP06_RUNNER_ORDERED_RESIDUAL_REFS_REQUIRED");
  }
  const identity = input.source_dataset_identity;
  if (!identity || typeof identity !== "object" || Array.isArray(identity)) {
    throw new Error("CAP06_RUNNER_SOURCE_DATASET_IDENTITY_REQUIRED");
  }
  const source = identity as Record<string, unknown>;
  const sourceDatasetIdentity: Cap06SourceDatasetIdentityV1 = {
    residual_set_hash: requiredStringV1(source.residual_set_hash, "CAP06_RUNNER_RESIDUAL_SET_HASH_REQUIRED"),
    case_input_set_hash: requiredStringV1(source.case_input_set_hash, "CAP06_RUNNER_CASE_INPUT_SET_HASH_REQUIRED"),
    calibration_window_hash: requiredStringV1(source.calibration_window_hash, "CAP06_RUNNER_CALIBRATION_WINDOW_HASH_REQUIRED"),
    holdout_window_hash: requiredStringV1(source.holdout_window_hash, "CAP06_RUNNER_HOLDOUT_WINDOW_HASH_REQUIRED"),
    window_hash_semantics: source.window_hash_semantics as typeof CAP06_WINDOW_HASH_SEMANTICS_V1,
    holdout_purpose: source.holdout_purpose as typeof CAP06_HOLDOUT_PURPOSE_V1,
    holdout_generalization_claim: source.holdout_generalization_claim as typeof CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  };
  if (sourceDatasetIdentity.window_hash_semantics !== CAP06_WINDOW_HASH_SEMANTICS_V1
    || sourceDatasetIdentity.holdout_purpose !== CAP06_HOLDOUT_PURPOSE_V1
    || sourceDatasetIdentity.holdout_generalization_claim !== CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1) {
    throw new Error("CAP06_RUNNER_SOURCE_DATASET_POLICY_MISMATCH");
  }
  return {
    schema_version: CAP06_RUNNER_SCHEMA_V1,
    operation: CAP06_S5_RUNNER_OPERATION_V1,
    ordered_residual_refs: input.ordered_residual_refs.map((ref) => requiredStringV1(
      ref,
      "CAP06_RUNNER_RESIDUAL_REF_REQUIRED",
    )),
    source_dataset_identity: sourceDatasetIdentity,
  };
}

async function main(): Promise<void> {
  const databaseUrl = requiredStringV1(process.env.DATABASE_URL, "DATABASE_URL_REQUIRED");
  const inputPath = path.resolve(requiredStringV1(
    process.env.MCFT_CAP_06_RUNNER_INPUT,
    "MCFT_CAP_06_RUNNER_INPUT_REQUIRED",
  ));
  const outputPath = process.env.MCFT_CAP_06_RUNNER_OUTPUT
    ? path.resolve(process.env.MCFT_CAP_06_RUNNER_OUTPUT)
    : null;
  const input = parseInputV1(JSON.parse(fs.readFileSync(inputPath, "utf8")));
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const service = new Cap06CalibrationCandidateServiceV1(
      new PostgresResolvedForecastObservationCaseAssemblerV1(
        pool,
        new Cap04OrCap05ExecutionConfigResolverV1(),
      ),
      new PostgresCalibrationGovernanceRepositoryV1(pool),
    );
    const result = await service.computeAndCommit({
      orderedResidualRefs: input.ordered_residual_refs,
      sourceDatasetIdentity: input.source_dataset_identity,
    });
    const output = {
      schema_version: "geox_mcft_cap_06_s5_candidate_runner_result_v1",
      status: "PASS",
      operation: input.operation,
      calibration_disposition: result.status,
      selected_parameter_value: result.attempt.selected_parameter_value,
      calibration_case_count: result.resolved_case_count,
      candidate_ref: result.candidate?.object_id ?? null,
      candidate_hash: result.candidate?.determinism_hash ?? null,
      persistence_status: result.persistence_status,
      canonical_readback_verified: result.canonical_readback_verified,
      candidate_append_count: result.candidate_append_count,
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
    schema_version: "geox_mcft_cap_06_s5_candidate_runner_result_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
  };
  console.error(JSON.stringify(output));
  process.exitCode = 1;
});
