// Purpose: prove S6 reads one exact canonical Candidate and eight exact PostgreSQL holdout graphs, computes paired shadow metrics, reruns deterministically, and leaves all canonical/projection/runtime state unchanged.
// Boundary: destructive isolated-database acceptance only; no production database, Evaluation draft/commit, active Config mutation, Runtime parameter mutation, State/checkpoint mutation, route, Web, scheduler, Model Activation, or CAP-07 authority.

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
import { Cap04OrCap05ExecutionConfigResolverV1 } from "../../apps/server/src/runtime/twin_runtime/cap04_or_cap05_execution_config_resolver_v1.js";
import {
  buildCap06S5GraphConformantDatasetV2,
  type Cap06S5GraphConformantCaseV2,
  type Cap06S5GraphObservationRecordV2,
} from "./mcft_cap_06_s5_graph_conformant_fixture_v2.js";

if (process.env.MCFT_CAP_06_S6_PAIRED_SHADOW_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_06_S6_PAIRED_SHADOW_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap06|s6|shadow|acceptance|test)/.test(databaseName)) {
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
     VALUES ($1,$2::timestamptz,'mcft_cap06_s6_shadow_acceptance',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [`fact_${object.object_id}`, object.logical_time, recordJsonV1(object.object_type, object)],
  );
}

async function insertObservationV1(record: Cap06S5GraphObservationRecordV2): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s6_shadow_observation',$3::jsonb)
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

async function snapshotV1(): Promise<Record<string, number | string | null>> {
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
  const candidateService = new Cap06CalibrationCandidateServiceV1(assembler, repository);
  const candidateResult = await candidateService.computeAndCommit({
    orderedResidualRefs: dataset.calibration_window_refs,
    sourceDatasetIdentity: sourceIdentity,
  });
  assert.equal(candidateResult.status, "BOUNDED_PARAMETER_DELTA_CANDIDATE");
  assert.equal(candidateResult.attempt.selected_parameter_value, "0.034000");
  assert.equal(candidateResult.persistence_status, "INSERTED");
  assert.ok(candidateResult.candidate);
  const candidate = candidateResult.candidate;
  assert.equal(candidate.object_id, "twin_calibration_candidate_5649b9ab80b5545cf6007387");
  assert.equal(candidate.determinism_hash, "sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65");
  ok("formal S5 service establishes the exact canonical Candidate before S6 zero-write accounting");

  const before = await snapshotV1();
  assert.equal(before.candidates, 1);
  assert.equal(before.evaluations, 0);
  assert.equal(before.candidate_projection, 1);
  assert.equal(before.evaluation_projection, 0);
  assert.equal(before.candidate_evaluation_index, 0);
  assert.equal(before.evaluation_case_projection, 0);

  const service = new Cap06PairedHistoricalShadowServiceV1(repository, assembler);
  const first = await service.compute({
    candidateRef: candidate.object_id,
    candidateHash: candidate.determinism_hash,
    orderedHoldoutResidualRefs: dataset.holdout_window_refs,
    sourceDatasetIdentity: sourceIdentity,
  });
  assert.equal(first.candidate_parameter_value, "0.034000");
  assert.equal(first.resolved_holdout_case_count, 8);
  assert.equal(first.deterministic_rerun_verified, true);
  assert.equal(first.paired_shadow_compute_result.evaluation_disposition, "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW");
  assert.deepEqual(first.paired_shadow_compute_result.reason_codes, ["ALL_THRESHOLDS_PASS"]);
  assert.equal(first.paired_shadow_compute_result.case_results.length, 8);
  assert.equal(first.paired_shadow_compute_result.eligible_for_human_activation_review, true);
  assert.deepEqual(await snapshotV1(), before);
  ok("exact Candidate plus eight exact holdout graphs produce one deterministic non-canonical paired-shadow artifact with zero database delta");

  const second = await service.compute({
    candidateRef: candidate.object_id,
    candidateHash: candidate.determinism_hash,
    orderedHoldoutResidualRefs: dataset.holdout_window_refs,
    sourceDatasetIdentity: sourceIdentity,
  });
  assert.equal(
    second.paired_shadow_compute_result.determinism_hash,
    first.paired_shadow_compute_result.determinism_hash,
  );
  assert.equal(
    second.paired_shadow_compute_result.case_results_hash,
    first.paired_shadow_compute_result.case_results_hash,
  );
  assert.deepEqual(await snapshotV1(), before);
  ok("completed S6 compute rerun is deterministic and adds zero canonical facts or projection divergence");

  const runnerInputPath = path.join(ROOT, "acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_RUNNER_INPUT.json");
  const runnerOutputPath = path.join(ROOT, "acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_RUNNER_RESULT.json");
  fs.mkdirSync(path.dirname(runnerInputPath), { recursive: true });
  fs.writeFileSync(runnerInputPath, `${JSON.stringify({
    schema_version: "geox_mcft_cap_06_s6_paired_shadow_runner_input_v1",
    operation: "PAIRED_HISTORICAL_SHADOW_COMPUTE_V1",
    candidate_ref: candidate.object_id,
    candidate_hash: candidate.determinism_hash,
    ordered_holdout_residual_refs: dataset.holdout_window_refs,
    source_dataset_identity: sourceIdentity,
  }, null, 2)}\n`, "utf8");
  childProcess.execFileSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["-w", "exec", "tsx", "apps/server/scripts/mcft/MCFT_CAP_06_PAIRED_HISTORICAL_SHADOW_RUNNER.ts"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        MCFT_CAP_06_S6_RUNNER_INPUT: runnerInputPath,
        MCFT_CAP_06_S6_RUNNER_OUTPUT: runnerOutputPath,
      },
      stdio: "inherit",
    },
  );
  const runner = JSON.parse(fs.readFileSync(runnerOutputPath, "utf8"));
  assert.equal(runner.status, "PASS");
  assert.equal(runner.candidate_parameter_value, "0.034000");
  assert.equal(runner.holdout_case_count, 8);
  assert.equal(runner.evaluation_disposition, "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW");
  assert.equal(runner.deterministic_rerun_verified, true);
  assert.equal(runner.compute_determinism_hash, first.paired_shadow_compute_result.determinism_hash);
  assert.deepEqual(await snapshotV1(), before);
  ok("standalone S6 runner reproduces the exact artifact and preserves the complete PostgreSQL snapshot");

  await assert.rejects(
    service.compute({
      candidateRef: candidate.object_id,
      candidateHash: "sha256:wrong",
      orderedHoldoutResidualRefs: dataset.holdout_window_refs,
      sourceDatasetIdentity: sourceIdentity,
    }),
    /CAP06_S6_CANDIDATE_HASH_MISMATCH/,
  );
  await assert.rejects(
    service.compute({
      candidateRef: candidate.object_id,
      candidateHash: candidate.determinism_hash,
      orderedHoldoutResidualRefs: dataset.holdout_window_refs.slice(0, 7),
      sourceDatasetIdentity: sourceIdentity,
    }),
    /CAP06_S6_EXACT_HOLDOUT_REF_COUNT_REQUIRED/,
  );
  await assert.rejects(
    service.compute({
      candidateRef: candidate.object_id,
      candidateHash: candidate.determinism_hash,
      orderedHoldoutResidualRefs: [
        ...dataset.holdout_window_refs.slice(0, 7),
        dataset.calibration_window_refs[0],
      ],
      sourceDatasetIdentity: sourceIdentity,
    }),
    /CAP06_S6_CANDIDATE_CONTAINS_HOLDOUT_REF/,
  );
  await assert.rejects(
    service.compute({
      candidateRef: candidate.object_id,
      candidateHash: candidate.determinism_hash,
      orderedHoldoutResidualRefs: dataset.holdout_window_refs,
      sourceDatasetIdentity: { ...sourceIdentity, residual_set_hash: "sha256:wrong" },
    }),
    /CAP06_S6_CANDIDATE_SOURCE_IDENTITY_MISMATCH:RESIDUAL_SET_HASH/,
  );
  assert.deepEqual(await snapshotV1(), before);
  ok("candidate hash, holdout cardinality, calibration substitution and dataset identity fail closed with zero writes");

  const after = await snapshotV1();
  assert.deepEqual(after, before);
  const result = {
    schema_version: "geox_mcft_cap_06_s6_paired_shadow_db_result_v1",
    status: "PASS",
    profile_id: dataset.profile_id,
    candidate_ref: candidate.object_id,
    candidate_hash: candidate.determinism_hash,
    candidate_parameter_value: first.candidate_parameter_value,
    exact_holdout_case_count: first.resolved_holdout_case_count,
    evaluation_disposition: first.paired_shadow_compute_result.evaluation_disposition,
    reason_codes: first.paired_shadow_compute_result.reason_codes,
    baseline_metrics: first.paired_shadow_compute_result.baseline_metrics,
    candidate_metrics: first.paired_shadow_compute_result.candidate_metrics,
    case_results_hash: first.paired_shadow_compute_result.case_results_hash,
    compute_determinism_hash: first.paired_shadow_compute_result.determinism_hash,
    deterministic_rerun_verified: true,
    fact_count_before_shadow: before.facts,
    fact_count_after_shadow: after.facts,
    canonical_fact_write_count: 0,
    projection_write_count: 0,
    candidate_append_count: 0,
    evaluation_append_count: 0,
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
    path.join(ROOT, "acceptance-output/MCFT_CAP_06_S6_PAIRED_SHADOW_DB_RESULT.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  console.log(`MCFT-CAP-06 S6 paired shadow PostgreSQL acceptance: ${pass} PASS, 0 FAIL`);
  console.log(`S6_PAIRED_SHADOW_DB_RESULT_JSON:${JSON.stringify(result)}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
