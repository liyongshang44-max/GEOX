// Purpose: prove the exact S5 Candidate -> zero-write S6 artifact -> one S7 Evaluation D transaction chain, canonical readback, 1+1+8 projections, completed-chain idempotency, runner compatibility and fail-closed rollback.
// Boundary: destructive isolated-database acceptance only; no production database, alternative shadow compute, Candidate append by S7, Model Activation, active Config, Runtime parameter, State/checkpoint mutation, route, Web, scheduler or CAP-07 authority.

import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  CAP06_HOLDOUT_PURPOSE_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";
import { PostgresCalibrationGovernanceRepositoryV1 } from "../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { PostgresResolvedForecastObservationCaseAssemblerV1 } from "../../apps/server/src/persistence/calibration/postgres_resolved_forecast_observation_case_assembler_v1.js";
import { Cap06CalibrationCandidateServiceV1 } from "../../apps/server/src/runtime/calibration/calibration_candidate_service_v1.js";
import { Cap06PairedHistoricalShadowServiceV1 } from "../../apps/server/src/runtime/calibration/paired_historical_shadow_service_v1.js";
import { Cap06ShadowEvaluationCommitServiceV1 } from "../../apps/server/src/runtime/calibration/shadow_evaluation_commit_service_v1.js";
import { Cap04OrCap05ExecutionConfigResolverV1 } from "../../apps/server/src/runtime/twin_runtime/cap04_or_cap05_execution_config_resolver_v1.js";
import {
  buildCap06S5GraphConformantDatasetV2,
  type Cap06S5GraphConformantCaseV2,
  type Cap06S5GraphObservationRecordV2,
} from "./mcft_cap_06_s5_graph_conformant_fixture_v2.js";

if (process.env.MCFT_CAP_06_S7_SHADOW_EVALUATION_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_06_S7_SHADOW_EVALUATION_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap06|s7|evaluation|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pool = new Pool({ connectionString: databaseUrl });
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}
function readSqlV1(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}
function recordJsonV1(type: string, payload: unknown): string {
  return JSON.stringify({ type, payload });
}

async function initializeSchemaV1(): Promise<void> {
  await pool.query(readSqlV1("docker/postgres/init/001_schema.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_17_mcft_cap_06_calibration_governance_persistence.sql"));
}

async function insertCanonicalFactV1(object: CanonicalObjectEnvelopeV1): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s7_evaluation_acceptance',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [`fact_${object.object_id}`, object.logical_time, recordJsonV1(object.object_type, object)],
  );
}
async function insertObservationV1(record: Cap06S5GraphObservationRecordV2): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s7_evaluation_observation',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [`fact_${record.source_record_id}`, record.available_to_runtime_at, recordJsonV1(record.record_type, record)],
  );
}
async function seedV2(input: readonly Cap06S5GraphConformantCaseV2[]): Promise<void> {
  const inserted = new Set<string>();
  const once = async (object: CanonicalObjectEnvelopeV1): Promise<void> => {
    if (inserted.has(object.object_id)) return;
    inserted.add(object.object_id);
    await insertCanonicalFactV1(object);
  };
  for (const item of input) {
    await once(item.source_runtime_config);
    await once(item.source_evidence_window);
    await once(item.source_state);
    await once(item.source_forecast);
    await insertObservationV1(item.observation_record);
    await once(item.observation_evidence_window);
    await once(item.assimilation_update);
    await once(item.observation_posterior);
    await once(item.residual as unknown as CanonicalObjectEnvelopeV1);
  }
}

async function countWhereV1(where: string): Promise<number> {
  return Number((await pool.query(`SELECT count(*)::int AS count FROM ${where}`)).rows[0].count);
}
async function relationV1(name: string): Promise<string | null> {
  return (await pool.query("SELECT to_regclass($1)::text AS relation", [name])).rows[0].relation ?? null;
}
type SnapshotV1 = {
  facts: number;
  candidates: number;
  evaluations: number;
  activations: number;
  states: number;
  checkpoints: number;
  candidate_projection: number;
  evaluation_projection: number;
  candidate_evaluation_index: number;
  evaluation_case_projection: number;
  active_config_relation: string | null;
};
async function snapshotV1(): Promise<SnapshotV1> {
  return {
    facts: await countWhereV1("facts"),
    candidates: await countWhereV1("facts WHERE record_json->>'type'='twin_calibration_candidate_v1'"),
    evaluations: await countWhereV1("facts WHERE record_json->>'type'='twin_shadow_evaluation_v1'"),
    activations: await countWhereV1("facts WHERE record_json->>'type'='twin_model_activation_v1'"),
    states: await countWhereV1("facts WHERE record_json->>'type'='twin_state_estimate_v1'"),
    checkpoints: await countWhereV1("facts WHERE record_json->>'type'='twin_runtime_checkpoint_v1'"),
    candidate_projection: await countWhereV1("twin_calibration_candidate_projection_v1"),
    evaluation_projection: await countWhereV1("twin_shadow_evaluation_projection_v1"),
    candidate_evaluation_index: await countWhereV1("twin_candidate_evaluation_index_v1"),
    evaluation_case_projection: await countWhereV1("twin_shadow_evaluation_case_projection_v1"),
    active_config_relation: await relationV1("public.twin_active_config_index_v1"),
  };
}

async function main(): Promise<void> {
  await initializeSchemaV1();
  const dataset = await buildCap06S5GraphConformantDatasetV2();
  await seedV2(dataset.cases);
  const sourceIdentity = {
    residual_set_hash: dataset.residual_set_hash,
    case_input_set_hash: dataset.case_input_set_hash,
    calibration_window_hash: dataset.calibration_window_hash,
    holdout_window_hash: dataset.holdout_window_hash,
    window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,
    holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,
    holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  };
  const assembler = new PostgresResolvedForecastObservationCaseAssemblerV1(
    pool,
    new Cap04OrCap05ExecutionConfigResolverV1(),
  );
  const repository = new PostgresCalibrationGovernanceRepositoryV1(pool);

  const candidateResult = await new Cap06CalibrationCandidateServiceV1(
    assembler,
    repository,
  ).computeAndCommit({
    orderedResidualRefs: dataset.calibration_window_refs,
    sourceDatasetIdentity: sourceIdentity,
  });
  assert.equal(candidateResult.status, "BOUNDED_PARAMETER_DELTA_CANDIDATE");
  assert.equal(candidateResult.persistence_status, "INSERTED");
  assert.ok(candidateResult.candidate);
  const candidate = candidateResult.candidate;
  assert.equal(candidate.object_id, "twin_calibration_candidate_5649b9ab80b5545cf6007387");
  assert.equal(candidate.determinism_hash, "sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65");
  ok("formal S5 D transaction establishes the exact canonical Candidate");

  const beforeS6 = await snapshotV1();
  assert.equal(beforeS6.candidates, 1);
  assert.equal(beforeS6.evaluations, 0);
  assert.equal(beforeS6.candidate_projection, 1);
  const artifact = await new Cap06PairedHistoricalShadowServiceV1(
    repository,
    assembler,
  ).compute({
    candidateRef: candidate.object_id,
    candidateHash: candidate.determinism_hash,
    orderedHoldoutResidualRefs: dataset.holdout_window_refs,
    sourceDatasetIdentity: sourceIdentity,
  });
  assert.equal(artifact.candidate_parameter_value, "0.034000");
  assert.equal(artifact.resolved_holdout_case_count, 8);
  assert.equal(artifact.paired_shadow_compute_result.evaluation_disposition, "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW");
  assert.deepEqual(artifact.paired_shadow_compute_result.reason_codes, ["ALL_THRESHOLDS_PASS"]);
  assert.deepEqual(await snapshotV1(), beforeS6);
  ok("formal S6 service yields the exact deterministic artifact with zero PostgreSQL delta");

  const beforeS7 = await snapshotV1();
  const service = new Cap06ShadowEvaluationCommitServiceV1(repository);
  const first = await service.commit({ s6Artifact: artifact });
  assert.equal(first.persistence_status, "INSERTED");
  assert.equal(first.evaluation_append_count, 1);
  assert.equal(first.aggregate_projection_row_count, 1);
  assert.equal(first.candidate_evaluation_index_row_count, 1);
  assert.equal(first.case_projection_row_count, 8);
  assert.equal(first.projection_row_count, 10);
  assert.equal(first.canonical_readback_verified, true);
  assert.equal(first.evaluation_disposition, "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW");
  assert.deepEqual(first.reason_codes, ["ALL_THRESHOLDS_PASS"]);

  const afterFirst = await snapshotV1();
  assert.equal(afterFirst.facts, beforeS7.facts + 1);
  assert.equal(afterFirst.candidates, beforeS7.candidates);
  assert.equal(afterFirst.evaluations, beforeS7.evaluations + 1);
  assert.equal(afterFirst.activations, beforeS7.activations);
  assert.equal(afterFirst.states, beforeS7.states);
  assert.equal(afterFirst.checkpoints, beforeS7.checkpoints);
  assert.equal(afterFirst.candidate_projection, beforeS7.candidate_projection);
  assert.equal(afterFirst.evaluation_projection, beforeS7.evaluation_projection + 1);
  assert.equal(afterFirst.candidate_evaluation_index, beforeS7.candidate_evaluation_index + 1);
  assert.equal(afterFirst.evaluation_case_projection, beforeS7.evaluation_case_projection + 8);
  assert.equal(afterFirst.active_config_relation, beforeS7.active_config_relation);
  const readback = await repository.readCanonicalObject(first.evaluation_ref);
  assert.ok(readback && readback.object_type === "twin_shadow_evaluation_v1");
  assert.equal(readback.determinism_hash, first.evaluation_hash);
  assert.equal(readback.payload.case_results_hash, artifact.paired_shadow_compute_result.case_results_hash);
  assert.equal(readback.payload.compute_determinism_hash, artifact.paired_shadow_compute_result.determinism_hash);
  assert.equal((readback.payload.case_results as unknown[]).length, 8);
  assert.equal(readback.payload.model_activation_created, false);
  assert.equal(readback.payload.active_config_switch_performed, false);
  assert.equal(readback.payload.approval_created, false);
  assert.equal(readback.payload.activation_authorized, false);
  ok("S7 commits one canonical Evaluation, 1 aggregate projection, 1 Candidate index and 8 case rows with exact readback");

  const second = await service.commit({ s6Artifact: structuredClone(artifact) });
  assert.equal(second.persistence_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(second.evaluation_ref, first.evaluation_ref);
  assert.equal(second.evaluation_hash, first.evaluation_hash);
  assert.equal(second.evaluation_append_count, 0);
  assert.equal(second.projection_row_count, 0);
  assert.deepEqual(await snapshotV1(), afterFirst);
  ok("completed-chain rerun performs zero new Evaluation append and zero projection divergence");

  const runnerInputPath = path.join(ROOT, "acceptance-output/MCFT_CAP_06_S7_SHADOW_EVALUATION_RUNNER_INPUT.json");
  const runnerOutputPath = path.join(ROOT, "acceptance-output/MCFT_CAP_06_S7_SHADOW_EVALUATION_RUNNER_RESULT.json");
  fs.mkdirSync(path.dirname(runnerInputPath), { recursive: true });
  fs.writeFileSync(runnerInputPath, `${JSON.stringify({
    schema_version: "geox_mcft_cap_06_s7_shadow_evaluation_runner_input_v1",
    operation: "SHADOW_EVALUATION_COMMIT_V1",
    s6_artifact: artifact,
  }, null, 2)}\n`, "utf8");
  childProcess.execFileSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["-w", "exec", "tsx", "apps/server/scripts/mcft/MCFT_CAP_06_SHADOW_EVALUATION_COMMIT_RUNNER.ts"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        MCFT_CAP_06_S7_RUNNER_INPUT: runnerInputPath,
        MCFT_CAP_06_S7_RUNNER_OUTPUT: runnerOutputPath,
      },
      stdio: "inherit",
    },
  );
  const runner = JSON.parse(fs.readFileSync(runnerOutputPath, "utf8"));
  assert.equal(runner.status, "PASS");
  assert.equal(runner.persistence_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(runner.evaluation_ref, first.evaluation_ref);
  assert.equal(runner.evaluation_hash, first.evaluation_hash);
  assert.equal(runner.evaluation_append_count, 0);
  assert.equal(runner.projection_row_count, 0);
  assert.equal(runner.canonical_readback_verified, true);
  assert.deepEqual(await snapshotV1(), afterFirst);
  ok("standalone S7 runner consumes the exact serialized S6 artifact and returns idempotent canonical readback");

  const beforeNegative = await snapshotV1();
  const badCaseHash = structuredClone(artifact);
  badCaseHash.paired_shadow_compute_result.case_results_hash = "sha256:wrong";
  await assert.rejects(service.commit({ s6Artifact: badCaseHash }), /CAP06_S7_S6_CASE_RESULTS_HASH_INVALID/);
  const badComputeHash = structuredClone(artifact);
  badComputeHash.paired_shadow_compute_result.determinism_hash = "sha256:wrong";
  await assert.rejects(service.commit({ s6Artifact: badComputeHash }), /CAP06_S7_S6_COMPUTE_DETERMINISM_HASH_INVALID/);
  const badCandidateHash = structuredClone(artifact);
  badCandidateHash.candidate_hash = "sha256:wrong";
  await assert.rejects(service.commit({ s6Artifact: badCandidateHash }), /CAP06_S7_CANDIDATE_HASH_MISMATCH/);
  const missingCase = structuredClone(artifact);
  missingCase.paired_shadow_compute_result.case_results.pop();
  await assert.rejects(service.commit({ s6Artifact: missingCase }), /CAP06_S7_S6_CASE_RESULTS_COUNT_MISMATCH/);
  assert.deepEqual(await snapshotV1(), beforeNegative);
  ok("tampered S6 hashes, Candidate binding and incomplete cases fail before any canonical or projection write");

  const finalSnapshot = await snapshotV1();
  const result = {
    schema_version: "geox_mcft_cap_06_s7_shadow_evaluation_db_result_v1",
    status: "PASS",
    profile_id: dataset.profile_id,
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
    aggregate_projection_count: finalSnapshot.evaluation_projection - beforeS7.evaluation_projection,
    candidate_evaluation_index_count: finalSnapshot.candidate_evaluation_index - beforeS7.candidate_evaluation_index,
    case_projection_count: finalSnapshot.evaluation_case_projection - beforeS7.evaluation_case_projection,
    canonical_readback_verified: true,
    fact_count_before_evaluation: beforeS7.facts,
    fact_count_after_evaluation: finalSnapshot.facts,
    candidate_append_count: finalSnapshot.candidates - beforeS7.candidates,
    model_activation_count: finalSnapshot.activations - beforeS7.activations,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: finalSnapshot.states - beforeS7.states,
    checkpoint_mutation_count: finalSnapshot.checkpoints - beforeS7.checkpoints,
    migration_count: 0,
    pass_count: pass,
  };
  fs.mkdirSync(path.join(ROOT, "acceptance-output"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "acceptance-output/MCFT_CAP_06_S7_SHADOW_EVALUATION_DB_RESULT.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  console.log(`MCFT-CAP-06 S7 Shadow Evaluation PostgreSQL acceptance: ${pass} PASS, 0 FAIL`);
  console.log(`S7_SHADOW_EVALUATION_DB_RESULT_JSON:${JSON.stringify(result)}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
