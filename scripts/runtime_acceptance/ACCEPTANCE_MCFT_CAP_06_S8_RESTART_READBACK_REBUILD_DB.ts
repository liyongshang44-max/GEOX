// Purpose: prove a complete S5->S6->S7 chain survives projection loss and two fresh-process S8 facts-based rebuilds with exact canonical readback and zero canonical/runtime mutation.
// Boundary: destructive isolated-database acceptance only; no production database, alternative projection builder, shadow recompute, Candidate/Evaluation append by S8, Model Activation, active Config, Runtime parameter, State/checkpoint mutation, route, Web, scheduler or CAP-07 authority.

import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
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

if (process.env.MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap06|s8|restart|rebuild|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EVALUATION_REF = "twin_shadow_evaluation_8cae1f6732420a4999deffc0";
const EVALUATION_HASH = "sha256:32c43020f45351994120515e5c633531bb594d85659456c65bd46305737d85e0";
const CANDIDATE_REF = "twin_calibration_candidate_5649b9ab80b5545cf6007387";
const CANDIDATE_HASH = "sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65";
const EXPECTED_SUMMARY = {
  canonical_objects_scanned: 2,
  idempotency_guards_rebuilt: 2,
  candidate_projections_rebuilt: 1,
  evaluation_projections_rebuilt: 1,
  candidate_evaluation_rows_rebuilt: 1,
  evaluation_case_rows_rebuilt: 8,
};
let pool = new Pool({ connectionString: databaseUrl });
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
     VALUES ($1,$2::timestamptz,'mcft_cap06_s8_restart_acceptance',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [`fact_${object.object_id}`, object.logical_time, recordJsonV1(object.object_type, object)],
  );
}
async function insertObservationV1(record: Cap06S5GraphObservationRecordV2): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s8_restart_observation',$3::jsonb)
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
async function countWhereV1(fromClause: string, values: unknown[] = []): Promise<number> {
  return Number((await pool.query(`SELECT count(*)::int AS count FROM ${fromClause}`, values)).rows[0].count);
}
async function relationV1(name: string): Promise<string | null> {
  return (await pool.query("SELECT to_regclass($1)::text AS relation", [name])).rows[0].relation ?? null;
}
async function factsHashV1(): Promise<string> {
  const result = await pool.query(
    `SELECT fact_id,occurred_at,source,record_json
       FROM facts
      ORDER BY fact_id ASC`,
  );
  return semanticHashV1(result.rows);
}
async function tableSnapshotV1(table: string): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT COALESCE(jsonb_agg(row_json ORDER BY row_json::text),'[]'::jsonb) AS rows
       FROM (SELECT to_jsonb(t) AS row_json FROM ${table} t) s`,
  );
  return result.rows[0].rows as unknown[];
}
async function projectionSnapshotV1(): Promise<Record<string, unknown[]>> {
  return {
    idempotency: await tableSnapshotV1("twin_object_idempotency_index_v1"),
    candidate: await tableSnapshotV1("twin_calibration_candidate_projection_v1"),
    evaluation: await tableSnapshotV1("twin_shadow_evaluation_projection_v1"),
    candidate_evaluation: await tableSnapshotV1("twin_candidate_evaluation_index_v1"),
    cases: await tableSnapshotV1("twin_shadow_evaluation_case_projection_v1"),
  };
}
async function projectionCountsV1(): Promise<Record<string, number>> {
  return {
    idempotency: await countWhereV1("twin_object_idempotency_index_v1 WHERE identity_kind IN ('D_CALIBRATION_CANDIDATE','D_SHADOW_EVALUATION')"),
    candidate: await countWhereV1("twin_calibration_candidate_projection_v1"),
    evaluation: await countWhereV1("twin_shadow_evaluation_projection_v1"),
    candidate_evaluation: await countWhereV1("twin_candidate_evaluation_index_v1"),
    cases: await countWhereV1("twin_shadow_evaluation_case_projection_v1"),
  };
}
async function deleteRebuildableStateV1(): Promise<void> {
  await pool.query("BEGIN");
  try {
    await pool.query("DELETE FROM twin_shadow_evaluation_case_projection_v1");
    await pool.query("DELETE FROM twin_candidate_evaluation_index_v1");
    await pool.query("DELETE FROM twin_shadow_evaluation_projection_v1");
    await pool.query("DELETE FROM twin_calibration_candidate_projection_v1");
    await pool.query(
      `DELETE FROM twin_object_idempotency_index_v1
        WHERE identity_kind IN ('D_CALIBRATION_CANDIDATE','D_SHADOW_EVALUATION')`,
    );
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}
function runnerPathsV1(label: string): { input: string; output: string } {
  const dir = path.join(ROOT, "acceptance-output");
  fs.mkdirSync(dir, { recursive: true });
  return {
    input: path.join(dir, `MCFT_CAP_06_S8_RESTART_${label}_INPUT.json`),
    output: path.join(dir, `MCFT_CAP_06_S8_RESTART_${label}_RESULT.json`),
  };
}
function writeRunnerInputV1(target: string, overrides: Partial<Record<string, unknown>> = {}): void {
  fs.writeFileSync(target, `${JSON.stringify({
    schema_version: "geox_mcft_cap_06_s8_restart_readback_rebuild_runner_input_v1",
    operation: "RESTART_READBACK_REBUILD_V1",
    evaluation_ref: EVALUATION_REF,
    evaluation_hash: EVALUATION_HASH,
    candidate_ref: CANDIDATE_REF,
    candidate_hash: CANDIDATE_HASH,
    parent_process_pid: process.pid,
    ...overrides,
  }, null, 2)}\n`, "utf8");
}
function runFreshProcessV1(paths: { input: string; output: string }, expectSuccess = true): Record<string, unknown> {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = childProcess.spawnSync(
    command,
    ["-w", "exec", "tsx", "apps/server/scripts/mcft/MCFT_CAP_06_RESTART_READBACK_REBUILD_RUNNER.ts"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        MCFT_CAP_06_S8_RESTART_RUNNER_AUTHORIZED: "1",
        MCFT_CAP_06_S8_RUNNER_INPUT: paths.input,
        MCFT_CAP_06_S8_RUNNER_OUTPUT: paths.output,
      },
      encoding: "utf8",
      stdio: "pipe",
      maxBuffer: 256 * 1024 * 1024,
      shell: false,
    },
  );
  process.stdout.write(String(result.stdout || ""));
  process.stderr.write(String(result.stderr || ""));
  if (expectSuccess) assert.equal(result.status, 0, `S8_FRESH_PROCESS_FAILED:${result.status}`);
  else assert.notEqual(result.status, 0, "S8_NEGATIVE_FRESH_PROCESS_MUST_FAIL");
  return JSON.parse(fs.readFileSync(paths.output, "utf8")) as Record<string, unknown>;
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
  const candidateResult = await new Cap06CalibrationCandidateServiceV1(assembler, repository).computeAndCommit({
    orderedResidualRefs: dataset.calibration_window_refs,
    sourceDatasetIdentity: sourceIdentity,
  });
  assert.ok(candidateResult.candidate);
  const candidate = candidateResult.candidate;
  assert.equal(candidate.object_id, CANDIDATE_REF);
  assert.equal(candidate.determinism_hash, CANDIDATE_HASH);
  const artifact = await new Cap06PairedHistoricalShadowServiceV1(repository, assembler).compute({
    candidateRef: candidate.object_id,
    candidateHash: candidate.determinism_hash,
    orderedHoldoutResidualRefs: dataset.holdout_window_refs,
    sourceDatasetIdentity: sourceIdentity,
  });
  const evaluationResult = await new Cap06ShadowEvaluationCommitServiceV1(repository).commit({ s6Artifact: artifact });
  assert.equal(evaluationResult.evaluation_ref, EVALUATION_REF);
  assert.equal(evaluationResult.evaluation_hash, EVALUATION_HASH);
  assert.equal(evaluationResult.evaluation_append_count, 1);
  ok("formal S5-S6-S7 chain establishes the exact Candidate and Evaluation canonical facts");

  const canonicalFactCount = await countWhereV1("facts");
  const governanceFactCount = await countWhereV1(
    "facts WHERE record_json->>'type' IN ('twin_calibration_candidate_v1','twin_shadow_evaluation_v1')",
  );
  const canonicalFactsHash = await factsHashV1();
  const activationCount = await countWhereV1("facts WHERE record_json->>'type'='twin_model_activation_v1'");
  const stateCount = await countWhereV1("facts WHERE record_json->>'type'='twin_state_estimate_v1'");
  const checkpointCount = await countWhereV1("facts WHERE record_json->>'type'='twin_runtime_checkpoint_v1'");
  const activeConfigRelation = await relationV1("public.twin_active_config_index_v1");
  const originalProjectionSnapshot = await projectionSnapshotV1();
  assert.deepEqual(await projectionCountsV1(), {
    idempotency: 2,
    candidate: 1,
    evaluation: 1,
    candidate_evaluation: 1,
    cases: 8,
  });

  await deleteRebuildableStateV1();
  assert.deepEqual(await projectionCountsV1(), {
    idempotency: 0,
    candidate: 0,
    evaluation: 0,
    candidate_evaluation: 0,
    cases: 0,
  });
  assert.equal(await countWhereV1("facts"), canonicalFactCount);
  assert.equal(await factsHashV1(), canonicalFactsHash);
  ok("projection and idempotency loss is established without changing canonical facts");

  await pool.end();

  const firstPaths = runnerPathsV1("FIRST");
  writeRunnerInputV1(firstPaths.input);
  const first = runFreshProcessV1(firstPaths);
  assert.equal(first.status, "PASS");
  assert.equal(first.fresh_process_verified, true);
  assert.notEqual(first.process_pid, process.pid);
  assert.equal(first.fresh_connection_pool_created, true);
  assert.equal(first.fresh_repository_instance_created, true);
  assert.equal(first.fresh_service_instance_created, true);
  assert.equal(first.evaluation_ref, EVALUATION_REF);
  assert.equal(first.evaluation_hash, EVALUATION_HASH);
  assert.equal(first.candidate_ref, CANDIDATE_REF);
  assert.equal(first.candidate_hash, CANDIDATE_HASH);
  assert.deepEqual(first.first_rebuild_summary, EXPECTED_SUMMARY);
  assert.deepEqual(first.second_rebuild_summary, EXPECTED_SUMMARY);
  assert.equal(first.first_rebuild_summary_hash, first.second_rebuild_summary_hash);
  assert.equal(first.pre_rebuild_readback_hash, first.post_first_rebuild_readback_hash);
  assert.equal(first.post_first_rebuild_readback_hash, first.post_second_rebuild_readback_hash);
  assert.equal(first.canonical_fact_append_count, 0);
  assert.equal(first.evaluation_append_count, 0);
  ok("first fresh process restores all projections from canonical facts and verifies two deterministic rebuilds");

  pool = new Pool({ connectionString: databaseUrl });
  const firstProjectionSnapshot = await projectionSnapshotV1();
  assert.deepEqual(firstProjectionSnapshot, originalProjectionSnapshot);
  assert.equal(await countWhereV1("facts"), canonicalFactCount);
  assert.equal(await countWhereV1(
    "facts WHERE record_json->>'type' IN ('twin_calibration_candidate_v1','twin_shadow_evaluation_v1')",
  ), governanceFactCount);
  assert.equal(await factsHashV1(), canonicalFactsHash);
  assert.equal(await countWhereV1("facts WHERE record_json->>'type'='twin_model_activation_v1'"), activationCount);
  assert.equal(await countWhereV1("facts WHERE record_json->>'type'='twin_state_estimate_v1'"), stateCount);
  assert.equal(await countWhereV1("facts WHERE record_json->>'type'='twin_runtime_checkpoint_v1'"), checkpointCount);
  assert.equal(await relationV1("public.twin_active_config_index_v1"), activeConfigRelation);
  await pool.end();

  const secondPaths = runnerPathsV1("SECOND");
  writeRunnerInputV1(secondPaths.input);
  const second = runFreshProcessV1(secondPaths);
  assert.equal(second.status, "PASS");
  assert.equal(second.fresh_process_verified, true);
  assert.notEqual(second.process_pid, process.pid);
  assert.notEqual(second.process_pid, first.process_pid);
  assert.deepEqual(second.first_rebuild_summary, EXPECTED_SUMMARY);
  assert.deepEqual(second.second_rebuild_summary, EXPECTED_SUMMARY);
  assert.equal(second.pre_rebuild_readback_hash, first.pre_rebuild_readback_hash);
  assert.equal(second.post_second_rebuild_readback_hash, first.post_second_rebuild_readback_hash);
  ok("a second independent process reproduces the same readback and rebuild result");

  pool = new Pool({ connectionString: databaseUrl });
  const secondProjectionSnapshot = await projectionSnapshotV1();
  assert.deepEqual(secondProjectionSnapshot, firstProjectionSnapshot);
  assert.equal(await factsHashV1(), canonicalFactsHash);

  const wrongPaths = runnerPathsV1("WRONG_HASH");
  writeRunnerInputV1(wrongPaths.input, { evaluation_hash: "sha256:wrong" });
  const beforeNegativeProjectionHash = semanticHashV1(await projectionSnapshotV1());
  const negative = runFreshProcessV1(wrongPaths, false);
  assert.equal(negative.status, "FAIL");
  assert.match(String(negative.error), /CAP06_S8_EVALUATION_HASH_MISMATCH/);
  assert.equal(await factsHashV1(), canonicalFactsHash);
  assert.equal(semanticHashV1(await projectionSnapshotV1()), beforeNegativeProjectionHash);
  ok("wrong exact Evaluation hash fails in a fresh process before any rebuild or canonical mutation");

  const finalCounts = await projectionCountsV1();
  assert.deepEqual(finalCounts, {
    idempotency: 2,
    candidate: 1,
    evaluation: 1,
    candidate_evaluation: 1,
    cases: 8,
  });
  const output = {
    schema_version: "geox_mcft_cap_06_s8_restart_readback_rebuild_db_result_v1",
    status: "PASS",
    parent_process_pid: process.pid,
    first_restart_process_pid: first.process_pid,
    second_restart_process_pid: second.process_pid,
    fresh_process_count: 2,
    evaluation_ref: EVALUATION_REF,
    evaluation_hash: EVALUATION_HASH,
    candidate_ref: CANDIDATE_REF,
    candidate_hash: CANDIDATE_HASH,
    evaluation_case_count: 8,
    canonical_fact_count: canonicalFactCount,
    governance_fact_count: governanceFactCount,
    canonical_facts_hash_before: canonicalFactsHash,
    canonical_facts_hash_after: await factsHashV1(),
    first_rebuild_summary: first.first_rebuild_summary,
    second_rebuild_summary: second.first_rebuild_summary,
    first_projection_snapshot_hash: semanticHashV1(firstProjectionSnapshot),
    second_projection_snapshot_hash: semanticHashV1(secondProjectionSnapshot),
    deterministic_second_rebuild_verified: true,
    exact_readback_verified: true,
    projection_counts: finalCounts,
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
    production_database_used: false,
    pass_count: pass,
  };
  fs.mkdirSync(path.join(ROOT, "acceptance-output"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "acceptance-output/MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DB_RESULT.json"),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(output));
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  try { await pool.end(); } catch {}
  process.exitCode = 1;
}).finally(async () => {
  try { await pool.end(); } catch {}
});
