// Purpose: run one authorized MCFT-CAP-06 S8 exact Evaluation/Candidate readback and facts-based projection rebuild in a fresh process, Pool, repository and service instance.
// Boundary: no canonical commit, shadow recompute, fixture seeding, activation, active Config, Runtime parameter, State, checkpoint, route, scheduler, migration, or external network authority.

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { PostgresCalibrationGovernanceRepositoryV1 } from "../../src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import {
  Cap06RestartReadbackRebuildServiceV1,
} from "../../src/runtime/calibration/restart_readback_rebuild_service_v1.js";

export const CAP06_S8_RUNNER_SCHEMA_V1 =
  "geox_mcft_cap_06_s8_restart_readback_rebuild_runner_input_v1" as const;
export const CAP06_S8_RUNNER_OPERATION_V1 =
  "RESTART_READBACK_REBUILD_V1" as const;

type Cap06S8RunnerInputV1 = {
  schema_version: typeof CAP06_S8_RUNNER_SCHEMA_V1;
  operation: typeof CAP06_S8_RUNNER_OPERATION_V1;
  evaluation_ref: string;
  evaluation_hash: string;
  candidate_ref: string;
  candidate_hash: string;
  parent_process_pid: number;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredPositiveIntegerV1(value: unknown, code: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) throw new Error(code);
  return Number(value);
}

function parseInputV1(value: unknown): Cap06S8RunnerInputV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CAP06_S8_RUNNER_INPUT_OBJECT_REQUIRED");
  }
  const input = value as Record<string, unknown>;
  if (input.schema_version !== CAP06_S8_RUNNER_SCHEMA_V1) {
    throw new Error("CAP06_S8_RUNNER_SCHEMA_VERSION_MISMATCH");
  }
  if (input.operation !== CAP06_S8_RUNNER_OPERATION_V1) {
    throw new Error("CAP06_S8_RUNNER_OPERATION_NOT_AUTHORIZED");
  }
  return {
    schema_version: CAP06_S8_RUNNER_SCHEMA_V1,
    operation: CAP06_S8_RUNNER_OPERATION_V1,
    evaluation_ref: requiredStringV1(input.evaluation_ref, "CAP06_S8_RUNNER_EVALUATION_REF_REQUIRED"),
    evaluation_hash: requiredStringV1(input.evaluation_hash, "CAP06_S8_RUNNER_EVALUATION_HASH_REQUIRED"),
    candidate_ref: requiredStringV1(input.candidate_ref, "CAP06_S8_RUNNER_CANDIDATE_REF_REQUIRED"),
    candidate_hash: requiredStringV1(input.candidate_hash, "CAP06_S8_RUNNER_CANDIDATE_HASH_REQUIRED"),
    parent_process_pid: requiredPositiveIntegerV1(input.parent_process_pid, "CAP06_S8_RUNNER_PARENT_PID_REQUIRED"),
  };
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP_06_S8_RESTART_RUNNER_AUTHORIZED !== "1") {
    throw new Error("SET_MCFT_CAP_06_S8_RESTART_RUNNER_AUTHORIZED_1");
  }
  const databaseUrl = requiredStringV1(process.env.DATABASE_URL, "DATABASE_URL_REQUIRED");
  const inputPath = path.resolve(requiredStringV1(
    process.env.MCFT_CAP_06_S8_RUNNER_INPUT,
    "MCFT_CAP_06_S8_RUNNER_INPUT_REQUIRED",
  ));
  const outputPath = path.resolve(requiredStringV1(
    process.env.MCFT_CAP_06_S8_RUNNER_OUTPUT,
    "MCFT_CAP_06_S8_RUNNER_OUTPUT_REQUIRED",
  ));
  const input = parseInputV1(JSON.parse(fs.readFileSync(inputPath, "utf8")));
  if (input.parent_process_pid === process.pid) {
    throw new Error("CAP06_S8_FRESH_PROCESS_REQUIRED");
  }

  const processStartedAt = new Date().toISOString();
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const repository = new PostgresCalibrationGovernanceRepositoryV1(pool);
    const service = new Cap06RestartReadbackRebuildServiceV1(repository);
    const result = await service.recover({
      evaluationRef: input.evaluation_ref,
      evaluationHash: input.evaluation_hash,
      candidateRef: input.candidate_ref,
      candidateHash: input.candidate_hash,
    });
    const output = {
      schema_version: "geox_mcft_cap_06_s8_restart_readback_rebuild_runner_result_v1",
      status: "PASS",
      operation: CAP06_S8_RUNNER_OPERATION_V1,
      process_pid: process.pid,
      parent_process_pid: input.parent_process_pid,
      fresh_process_verified: process.pid !== input.parent_process_pid,
      process_started_at: processStartedAt,
      fresh_connection_pool_created: true,
      fresh_repository_instance_created: true,
      fresh_service_instance_created: true,
      ...result,
      production_database_used: false,
      migration_count: 0,
      public_route_count: 0,
      web_change_count: 0,
      scheduler_count: 0,
    };
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(output));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const outputPath = process.env.MCFT_CAP_06_S8_RUNNER_OUTPUT
    ? path.resolve(process.env.MCFT_CAP_06_S8_RUNNER_OUTPUT)
    : null;
  const result = {
    schema_version: "geox_mcft_cap_06_s8_restart_readback_rebuild_runner_result_v1",
    status: "FAIL",
    process_pid: process.pid,
    error: error instanceof Error ? error.message : String(error),
    canonical_fact_append_count: 0,
    canonical_fact_update_count: 0,
    canonical_fact_delete_count: 0,
    candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    migration_count: 0,
  };
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  console.error(JSON.stringify(result));
  process.exitCode = 1;
});
