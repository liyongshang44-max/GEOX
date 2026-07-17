// Purpose: prove S5 executes the exact 16-case PostgreSQL graph, fixed-point Candidate compute, D commit, idempotent rerun and canonical readback in an isolated database.
// Boundary: destructive isolated-database acceptance only; no production database, Shadow Evaluation, Model Activation, active-config switch, Runtime parameter mutation, State/checkpoint mutation, route, Web, scheduler or CAP-07 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import childProcess from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { PostgresCalibrationGovernanceRepositoryV1 } from "../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { PostgresResolvedForecastObservationCaseAssemblerV1 } from "../../apps/server/src/persistence/calibration/postgres_resolved_forecast_observation_case_assembler_v1.js";
import { Cap04OrCap05ExecutionConfigResolverV1 } from "../../apps/server/src/runtime/twin_runtime/cap04_or_cap05_execution_config_resolver_v1.js";
import { Cap06CalibrationCandidateServiceV1 } from "../../apps/server/src/runtime/calibration/calibration_candidate_service_v1.js";
import {
  buildCap06S5GraphConformantDatasetV2,
  type Cap06S5GraphConformantCaseV2,
  type Cap06S5GraphObservationRecordV2,
} from "./mcft_cap_06_s5_graph_conformant_fixture_v2.js";
import {
  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  CAP06_HOLDOUT_PURPOSE_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";

if (process.env.MCFT_CAP_06_S5_CANDIDATE_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_06_S5_CANDIDATE_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap06|s5|candidate|acceptance|test)/.test(databaseName)) {
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
     VALUES ($1,$2::timestamptz,'mcft_cap06_s5_candidate_acceptance',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [`fact_${object.object_id}`, object.logical_time, recordJsonV1(object.object_type, object)],
  );
}

async function insertObservationV1(record: Cap06S5GraphObservationRecordV2): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s5_candidate_observation',$3::jsonb)
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

  const factsBefore = await countWhereV1("facts");
  const stateBefore = await countWhereV1("facts WHERE record_json->>'type'='twin_state_estimate_v1'");
  const checkpointBefore = await countWhereV1("facts WHERE record_json->>'type'='twin_runtime_checkpoint_v1'");
  const activationBefore = await countWhereV1("facts WHERE record_json->>'type'='twin_model_activation_v1'");
  const activeConfigBefore = await relationV1("public.twin_active_config_index_v1");
  assert.equal(await countWhereV1("facts WHERE record_json->>'type'='twin_calibration_candidate_v1'"), 0);
  assert.equal(await countWhereV1("facts WHERE record_json->>'type'='twin_shadow_evaluation_v1'"), 0);
  ok("isolated graph-conformant V2 profile seeded with zero Candidate/Evaluation history");

  const assembler = new PostgresResolvedForecastObservationCaseAssemblerV1(
    pool,
    new Cap04OrCap05ExecutionConfigResolverV1(),
  );
  const repository = new PostgresCalibrationGovernanceRepositoryV1(pool);
  const service = new Cap06CalibrationCandidateServiceV1(assembler, repository);

  const first = await service.computeAndCommit({
    orderedResidualRefs: dataset.calibration_window_refs,
    sourceDatasetIdentity: sourceIdentity,
  });
  assert.equal(first.status, "BOUNDED_PARAMETER_DELTA_CANDIDATE");
  assert.equal(first.attempt.selected_parameter_value, "0.034000");
  assert.equal(first.persistence_status, "INSERTED");
  assert.equal(first.candidate_append_count, 1);
  assert.equal(first.canonical_readback_verified, true);
  assert.ok(first.candidate);
  assert.equal(await countWhereV1("facts WHERE record_json->>'type'='twin_calibration_candidate_v1'"), 1);
  assert.equal(await countWhereV1("twin_calibration_candidate_projection_v1"), 1);
  assert.equal(await countWhereV1("facts"), factsBefore + 1);
  ok("exact 16-ref graph computes 0.034000 and atomically appends one canonical Candidate plus projection");

  const canonical = await repository.readCanonicalObject(String(first.candidate?.object_id));
  assert.ok(canonical);
  assert.equal(canonical?.object_type, "twin_calibration_candidate_v1");
  assert.equal(canonical?.determinism_hash, first.candidate?.determinism_hash);
  assert.equal(canonical?.payload.candidate_parameter_value, "0.034000");
  assert.equal(canonical?.payload.activation_status, "NOT_ACTIVE");
  assert.equal(canonical?.payload.eligible_for_runtime_config_use, false);
  ok("Candidate canonical readback preserves NON_LINEAGE_CONTEXT, parameter, non-activation and non-consumption semantics");

  const second = await service.computeAndCommit({
    orderedResidualRefs: dataset.calibration_window_refs,
    sourceDatasetIdentity: sourceIdentity,
  });
  assert.equal(second.persistence_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(second.candidate_append_count, 0);
  assert.equal(second.candidate?.object_id, first.candidate?.object_id);
  assert.equal(await countWhereV1("facts"), factsBefore + 1);
  assert.equal(await countWhereV1("twin_calibration_candidate_projection_v1"), 1);
  ok("completed S5 chain rerun is idempotent and adds zero canonical facts or projection divergence");

  const runnerInputPath = path.join(ROOT, "acceptance-output/MCFT_CAP_06_S5_CANDIDATE_RUNNER_INPUT.json");
  const runnerOutputPath = path.join(ROOT, "acceptance-output/MCFT_CAP_06_S5_CANDIDATE_RUNNER_RESULT.json");
  fs.mkdirSync(path.dirname(runnerInputPath), { recursive: true });
  fs.writeFileSync(runnerInputPath, `${JSON.stringify({
    schema_version: "geox_mcft_cap_06_runner_input_v1",
    operation: "CALIBRATION_CANDIDATE_COMPUTE_COMMIT_V1",
    ordered_residual_refs: dataset.calibration_window_refs,
    source_dataset_identity: sourceIdentity,
  }, null, 2)}\n`, "utf8");
  childProcess.execFileSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["-w", "exec", "tsx", "apps/server/scripts/mcft/MCFT_CAP_06_CALIBRATION_SHADOW_RUNNER.ts"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        MCFT_CAP_06_RUNNER_INPUT: runnerInputPath,
        MCFT_CAP_06_RUNNER_OUTPUT: runnerOutputPath,
      },
      stdio: "inherit",
    },
  );
  const runnerResult = JSON.parse(fs.readFileSync(runnerOutputPath, "utf8"));
  assert.equal(runnerResult.status, "PASS");
  assert.equal(runnerResult.calibration_disposition, "BOUNDED_PARAMETER_DELTA_CANDIDATE");
  assert.equal(runnerResult.selected_parameter_value, "0.034000");
  assert.equal(runnerResult.persistence_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(runnerResult.candidate_append_count, 0);
  assert.equal(await countWhereV1("facts"), factsBefore + 1);
  ok("controlled capability runner consumes exact input and reuses the canonical Candidate without additional writes");

  await assert.rejects(
    service.computeAndCommit({
      orderedResidualRefs: [
        ...dataset.calibration_window_refs.slice(0, 15),
        dataset.holdout_window_refs[0],
      ],
      sourceDatasetIdentity: sourceIdentity,
    }),
    /CAP06_CALIBRATION_WINDOW_REF_MEMBERSHIP_HASH_MISMATCH/,
  );
  await assert.rejects(
    service.computeAndCommit({
      orderedResidualRefs: dataset.calibration_window_refs.slice(0, 15),
      sourceDatasetIdentity: sourceIdentity,
    }),
    /CAP06_S5_EXACT_CALIBRATION_REF_COUNT_REQUIRED/,
  );
  assert.equal(await countWhereV1("facts"), factsBefore + 1);
  assert.equal(await countWhereV1("facts WHERE record_json->>'type'='twin_calibration_candidate_v1'"), 1);
  ok("holdout substitution and wrong cardinality fail closed before any additional Candidate append");

  assert.equal(await countWhereV1("facts WHERE record_json->>'type'='twin_shadow_evaluation_v1'"), 0);
  assert.equal(await countWhereV1("facts WHERE record_json->>'type'='twin_model_activation_v1'"), activationBefore);
  assert.equal(await countWhereV1("facts WHERE record_json->>'type'='twin_state_estimate_v1'"), stateBefore);
  assert.equal(await countWhereV1("facts WHERE record_json->>'type'='twin_runtime_checkpoint_v1'"), checkpointBefore);
  assert.equal(await relationV1("public.twin_active_config_index_v1"), activeConfigBefore);
  ok("S5 Candidate compute/commit creates no Evaluation, Activation, active Config, State or checkpoint mutation");

  const result = {
    schema_version: "geox_mcft_cap_06_s5_candidate_db_result_v1",
    status: "PASS",
    profile_id: dataset.profile_id,
    exact_calibration_case_count: first.resolved_case_count,
    selected_parameter_value: first.attempt.selected_parameter_value,
    candidate_ref: first.candidate?.object_id,
    candidate_hash: first.candidate?.determinism_hash,
    first_candidate_append_count: first.candidate_append_count,
    completed_chain_rerun_candidate_append_count: second.candidate_append_count,
    candidate_projection_count: await countWhereV1("twin_calibration_candidate_projection_v1"),
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    fact_count_before_candidate: factsBefore,
    fact_count_after_completed_chain_rerun: await countWhereV1("facts"),
  };
  fs.mkdirSync(path.join(ROOT, "acceptance-output"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "acceptance-output/MCFT_CAP_06_S5_CANDIDATE_DB_RESULT.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  console.log(`S5_CANDIDATE_DB_RESULT_JSON:${JSON.stringify(result)}`);
  console.log(`MCFT-CAP-06 S5 Candidate PostgreSQL acceptance: ${pass} PASS, 0 FAIL`);
}

main()
  .finally(async () => pool.end())
  .catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
