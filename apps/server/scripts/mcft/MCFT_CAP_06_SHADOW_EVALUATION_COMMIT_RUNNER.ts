// Purpose: commit one deterministic MCFT-CAP-06 S7 Shadow Evaluation from a complete supplied S6 paired-shadow artifact.
// Boundary: exact Candidate read and existing Evaluation D transaction only; no shadow recompute, fixture seeding, Candidate append, Model Activation, active Config, Runtime parameter, State, checkpoint, route, scheduler, or network retrieval.

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { PostgresCalibrationGovernanceRepositoryV1 } from "../../src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import {
  Cap06ShadowEvaluationCommitServiceV1,
} from "../../src/runtime/calibration/shadow_evaluation_commit_service_v1.js";
import type {
  Cap06PairedHistoricalShadowServiceResultV1,
} from "../../src/runtime/calibration/paired_historical_shadow_service_v1.js";

export const CAP06_S7_RUNNER_SCHEMA_V1 =
  "geox_mcft_cap_06_s7_shadow_evaluation_runner_input_v1" as const;
export const CAP06_S7_RUNNER_OPERATION_V1 =
  "SHADOW_EVALUATION_COMMIT_V1" as const;

type Cap06S7RunnerInputV1 = {
  schema_version: typeof CAP06_S7_RUNNER_SCHEMA_V1;
  operation: typeof CAP06_S7_RUNNER_OPERATION_V1;
  s6_artifact: Cap06PairedHistoricalShadowServiceResultV1;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function parseInputV1(value: unknown): Cap06S7RunnerInputV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CAP06_S7_RUNNER_INPUT_OBJECT_REQUIRED");
  }
  const input = value as Record<string, unknown>;
  if (input.schema_version !== CAP06_S7_RUNNER_SCHEMA_V1) {
    throw new Error("CAP06_S7_RUNNER_SCHEMA_VERSION_MISMATCH");
  }
  if (input.operation !== CAP06_S7_RUNNER_OPERATION_V1) {
    throw new Error("CAP06_S7_RUNNER_OPERATION_NOT_AUTHORIZED");
  }
  if (!input.s6_artifact || typeof input.s6_artifact !== "object" || Array.isArray(input.s6_artifact)) {
    throw new Error("CAP06_S7_RUNNER_COMPLETE_S6_ARTIFACT_REQUIRED");
  }
  return {
    schema_version: CAP06_S7_RUNNER_SCHEMA_V1,
    operation: CAP06_S7_RUNNER_OPERATION_V1,
    s6_artifact: input.s6_artifact as Cap06PairedHistoricalShadowServiceResultV1,
  };
}

async function main(): Promise<void> {
  const databaseUrl = requiredStringV1(process.env.DATABASE_URL, "DATABASE_URL_REQUIRED");
  const inputPath = path.resolve(requiredStringV1(
    process.env.MCFT_CAP_06_S7_RUNNER_INPUT,
    "MCFT_CAP_06_S7_RUNNER_INPUT_REQUIRED",
  ));
  const outputPath = process.env.MCFT_CAP_06_S7_RUNNER_OUTPUT
    ? path.resolve(process.env.MCFT_CAP_06_S7_RUNNER_OUTPUT)
    : null;
  const input = parseInputV1(JSON.parse(fs.readFileSync(inputPath, "utf8")));
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const service = new Cap06ShadowEvaluationCommitServiceV1(
      new PostgresCalibrationGovernanceRepositoryV1(pool),
    );
    const result = await service.commit({ s6Artifact: input.s6_artifact });
    const output = {
      schema_version: "geox_mcft_cap_06_s7_shadow_evaluation_runner_result_v1",
      status: "PASS",
      operation: input.operation,
      source_s6_artifact_hash: result.source_s6_artifact_hash,
      source_s6_compute_determinism_hash: result.source_s6_compute_determinism_hash,
      source_s6_case_results_hash: result.source_s6_case_results_hash,
      candidate_ref: result.candidate_ref,
      candidate_hash: result.candidate_hash,
      evaluation_ref: result.evaluation_ref,
      evaluation_hash: result.evaluation_hash,
      evaluation_disposition: result.evaluation_disposition,
      reason_codes: result.reason_codes,
      holdout_case_count: result.holdout_case_count,
      persistence_status: result.persistence_status,
      canonical_readback_verified: result.canonical_readback_verified,
      evaluation_append_count: result.evaluation_append_count,
      aggregate_projection_row_count: result.aggregate_projection_row_count,
      candidate_evaluation_index_row_count: result.candidate_evaluation_index_row_count,
      case_projection_row_count: result.case_projection_row_count,
      projection_row_count: result.projection_row_count,
      candidate_append_count: 0,
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
    schema_version: "geox_mcft_cap_06_s7_shadow_evaluation_runner_result_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    evaluation_append_count: 0,
    projection_row_count: 0,
    candidate_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
  };
  console.error(JSON.stringify(output));
  process.exitCode = 1;
});
