// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_D_PERSISTENCE_DB.ts
// Purpose: prove MCFT-CAP-06 S3 Candidate/Evaluation D persistence, concurrency, strict projection readback, facts-based recovery and active-config nonmutation in isolated PostgreSQL.
// Boundary: destructive isolated-database acceptance only; no production database, S5 Candidate compute, S6 Shadow compute, active Config, State, checkpoint, approval, route, Web, scheduler, Model Activation or CAP-07 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  PostgresCalibrationGovernancePersistenceRepositoryV1,
  type Cap06CalibrationGovernanceObjectV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_calibration_governance_persistence_repository_v1.js";
import { buildCap06S3PersistenceFixtureV1 } from "./mcft_cap_06_s3_persistence_fixture_v1.js";

if (process.env.MCFT_CAP_06_S3_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_06_S3_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap06|s3|persistence|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresCalibrationGovernancePersistenceRepositoryV1(pool);
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

function readSqlV1(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function factIdV1(objectId: string): string {
  return `fact_${objectId}`;
}

function recordJsonV1(object: Cap06CalibrationGovernanceObjectV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}

async function countV1(fromClause: string, values: unknown[] = []): Promise<number> {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${fromClause}`, values);
  return result.rows[0].count as number;
}

async function activeConfigRelationsV1(): Promise<string[]> {
  const result = await pool.query(
    `SELECT c.relname
     FROM pg_class c
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public'
       AND c.relkind IN ('r','p','v','m','i')
       AND lower(c.relname) LIKE '%active%config%'
     ORDER BY c.relname`,
  );
  return result.rows.map((row) => String(row.relname));
}

async function initializeSchemaV1(): Promise<{ active_config_relations_before: string[]; active_config_relations_after: string[] }> {
  await pool.query(readSqlV1("docker/postgres/init/001_schema.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql"));
  const before = await activeConfigRelationsV1();
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_16_mcft_cap_06_calibration_governance_persistence.sql"));
  const after = await activeConfigRelationsV1();
  return { active_config_relations_before: before, active_config_relations_after: after };
}

async function assertSupportCountsV1(input: {
  candidates: number;
  evaluations: number;
  links: number;
  cases: number;
  guards: number;
  facts: number;
}): Promise<void> {
  assert.equal(await countV1("twin_calibration_candidate_projection_v1"), input.candidates);
  assert.equal(await countV1("twin_shadow_evaluation_projection_v1"), input.evaluations);
  assert.equal(await countV1("twin_candidate_evaluation_index_v1"), input.links);
  assert.equal(await countV1("twin_shadow_evaluation_case_projection_v1"), input.cases);
  assert.equal(
    await countV1(
      "twin_object_idempotency_index_v1 WHERE identity_kind IN ('D_CALIBRATION_CANDIDATE','D_SHADOW_EVALUATION')",
    ),
    input.guards,
  );
  assert.equal(
    await countV1(
      "facts WHERE record_json->>'type' IN ('twin_calibration_candidate_v1','twin_shadow_evaluation_v1')",
    ),
    input.facts,
  );
}

async function main(): Promise<void> {
  const migrationBoundary = await initializeSchemaV1();
  assert.deepEqual(migrationBoundary.active_config_relations_after, migrationBoundary.active_config_relations_before);
  for (const table of [
    "twin_calibration_candidate_projection_v1",
    "twin_shadow_evaluation_projection_v1",
    "twin_candidate_evaluation_index_v1",
    "twin_shadow_evaluation_case_projection_v1",
  ]) {
    assert.equal(await countV1(`pg_class WHERE oid='public.${table}'::regclass`), 1);
  }
  ok("single additive migration created only rebuildable D support tables and no active-config relation");

  const fixture = buildCap06S3PersistenceFixtureV1();
  await assertSupportCountsV1({ candidates: 0, evaluations: 0, links: 0, cases: 0, guards: 0, facts: 0 });

  const candidateInsert = await repository.commitCanonicalObject({ object: fixture.candidate });
  assert.equal(candidateInsert.status, "INSERTED");
  assert.equal(candidateInsert.fact_id, factIdV1(fixture.candidate.object_id));
  await assertSupportCountsV1({ candidates: 1, evaluations: 0, links: 0, cases: 0, guards: 1, facts: 1 });
  assert.deepEqual(await repository.readCanonicalObject(fixture.candidate.object_id), fixture.candidate);
  assert.deepEqual(await repository.lookupByIdempotencyKey(fixture.candidate.idempotency_key), fixture.candidate);
  ok("Candidate D transaction appended exactly one canonical fact, projection and guard");

  const candidateRetry = await repository.commitCanonicalObject({ object: fixture.candidate });
  assert.equal(candidateRetry.status, "EXISTING_IDEMPOTENT_SUCCESS");
  await assertSupportCountsV1({ candidates: 1, evaluations: 0, links: 0, cases: 0, guards: 1, facts: 1 });
  ok("same-key same-hash Candidate retry returned canonical success without duplicate append");

  const evaluationInsert = await repository.commitCanonicalObject({ object: fixture.evaluation });
  assert.equal(evaluationInsert.status, "INSERTED");
  await assertSupportCountsV1({ candidates: 1, evaluations: 1, links: 1, cases: 8, guards: 2, facts: 2 });
  assert.deepEqual(await repository.readCanonicalObject(fixture.evaluation.object_id), fixture.evaluation);
  ok("Evaluation D transaction required the canonical Candidate and materialized eight embedded cases");

  await assert.rejects(
    () => repository.commitCanonicalObject({ object: fixture.wrong_candidate_hash_evaluation }),
    /CAP06_D_EVALUATION_CANDIDATE_HASH_MISMATCH/,
  );
  await assertSupportCountsV1({ candidates: 1, evaluations: 1, links: 1, cases: 8, guards: 2, facts: 2 });
  ok("wrong Candidate hash failed before Evaluation canonical append");

  await assert.rejects(
    () => repository.commitCanonicalObject({
      object: fixture.second_evaluation,
      fault_injection(stage) {
        if (stage === "before_commit") throw new Error("S3_INJECTED_BEFORE_COMMIT");
      },
    }),
    /S3_INJECTED_BEFORE_COMMIT/,
  );
  await assertSupportCountsV1({ candidates: 1, evaluations: 1, links: 1, cases: 8, guards: 2, facts: 2 });
  const secondEvaluationInsert = await repository.commitCanonicalObject({ object: fixture.second_evaluation });
  assert.equal(secondEvaluationInsert.status, "INSERTED");
  await assertSupportCountsV1({ candidates: 1, evaluations: 2, links: 2, cases: 16, guards: 3, facts: 3 });
  assert.equal(
    await countV1("twin_candidate_evaluation_index_v1 WHERE candidate_ref=$1", [fixture.candidate.object_id]),
    2,
  );
  ok("failed D transition rolled back completely and Candidate-to-Evaluation remained one-to-many");

  const conflictResults = await Promise.allSettled([
    repository.commitCanonicalObject({ object: fixture.concurrent_candidate }),
    repository.commitCanonicalObject({ object: fixture.concurrent_candidate_conflict }),
  ]);
  const fulfilled = conflictResults.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof repository.commitCanonicalObject>>> =>
    result.status === "fulfilled");
  const rejected = conflictResults.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.match(String(rejected[0].reason), /CAP06_D_IDEMPOTENCY_CONFLICT/);
  const concurrentWinner = fulfilled[0].value.object;
  const concurrentSameHash = await Promise.all(
    Array.from({ length: 6 }, () => repository.commitCanonicalObject({ object: concurrentWinner })),
  );
  assert.equal(concurrentSameHash.every((result) => result.object.object_id === concurrentWinner.object_id), true);
  assert.equal(concurrentSameHash.every((result) => result.status === "EXISTING_IDEMPOTENT_SUCCESS"), true);
  await assertSupportCountsV1({ candidates: 2, evaluations: 2, links: 2, cases: 16, guards: 4, facts: 4 });
  ok("advisory-lock concurrency produced one winner for different hashes and one canonical object for same hash");

  const responseLossRetry = await repository.commitCanonicalObject({ object: fixture.candidate });
  assert.equal(responseLossRetry.status, "EXISTING_IDEMPOTENT_SUCCESS");
  await assertSupportCountsV1({ candidates: 2, evaluations: 2, links: 2, cases: 16, guards: 4, facts: 4 });
  ok("response-loss-style retry recovered the committed canonical result");

  await pool.query("DELETE FROM twin_shadow_evaluation_case_projection_v1");
  await pool.query("DELETE FROM twin_candidate_evaluation_index_v1");
  await pool.query("DELETE FROM twin_shadow_evaluation_projection_v1");
  await pool.query("DELETE FROM twin_calibration_candidate_projection_v1");
  await pool.query(
    "DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind IN ('D_CALIBRATION_CANDIDATE','D_SHADOW_EVALUATION')",
  );
  const recovery = await repository.rebuildAllSupportState();
  assert.deepEqual(recovery, {
    canonical_objects_scanned: 4,
    idempotency_guards_rebuilt: 4,
    candidate_projections_rebuilt: 2,
    evaluation_projections_rebuilt: 2,
    candidate_evaluation_links_rebuilt: 2,
    evaluation_case_rows_rebuilt: 16,
  });
  await assertSupportCountsV1({ candidates: 2, evaluations: 2, links: 2, cases: 16, guards: 4, facts: 4 });
  ok("facts-only recovery rebuilt every D guard, projection, link and case row");

  await pool.query(
    "UPDATE twin_calibration_candidate_projection_v1 SET determinism_hash='sha256:corrupt' WHERE candidate_object_id=$1",
    [fixture.candidate.object_id],
  );
  await assert.rejects(
    () => repository.commitCanonicalObject({ object: fixture.candidate }),
    /CAP06_D_PROJECTION_DIVERGENCE/,
  );
  await repository.rebuildAllSupportState();
  assert.equal(
    (await pool.query(
      "SELECT determinism_hash FROM twin_calibration_candidate_projection_v1 WHERE candidate_object_id=$1",
      [fixture.candidate.object_id],
    )).rows[0].determinism_hash,
    fixture.candidate.determinism_hash,
  );
  ok("corrupt projection failed closed and facts-based rebuild repaired support state");

  await pool.query(
    "DELETE FROM twin_object_idempotency_index_v1 WHERE idempotency_key=$1",
    [fixture.candidate.idempotency_key],
  );
  const guardRecovery = await repository.commitCanonicalObject({ object: fixture.candidate });
  assert.equal(guardRecovery.status, "EXISTING_RECOVERED");
  await assertSupportCountsV1({ candidates: 2, evaluations: 2, links: 2, cases: 16, guards: 4, facts: 4 });
  ok("guard deletion recovered from canonical facts without a second append");

  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s3_divergence_fixture',$3::jsonb)`,
    [
      factIdV1(fixture.rogue_same_key_candidate.object_id),
      fixture.rogue_same_key_candidate.logical_time,
      recordJsonV1(fixture.rogue_same_key_candidate),
    ],
  );
  await assert.rejects(
    () => repository.rebuildAllSupportState(),
    /CAP06_D_RECOVERY_CANONICAL_DIVERGENCE/,
  );
  await pool.query("DELETE FROM facts WHERE fact_id=$1", [factIdV1(fixture.rogue_same_key_candidate.object_id)]);
  await repository.rebuildAllSupportState();
  await assertSupportCountsV1({ candidates: 2, evaluations: 2, links: 2, cases: 16, guards: 4, facts: 4 });
  ok("canonical same-key divergence failed closed during recovery");

  assert.deepEqual(await activeConfigRelationsV1(), migrationBoundary.active_config_relations_before);
  assert.equal(
    await countV1("facts WHERE record_json->>'type'='twin_model_activation_v1'"),
    0,
  );
  assert.equal(
    await countV1("facts WHERE record_json->>'type' IN ('twin_state_estimate_v1','twin_runtime_checkpoint_v1')"),
    0,
  );
  ok("active-config relations, Model Activation, State and checkpoint remained unchanged or absent");

  const result = {
    schema_version: "geox_mcft_cap_06_s3_d_persistence_acceptance_v1",
    status: "PASS",
    transaction_id: "D_MODEL_GOVERNANCE_STEP_COMMIT",
    migration_count: 1,
    canonical_candidate_count: 2,
    canonical_evaluation_count: 2,
    canonical_object_count: 4,
    candidate_projection_count: 2,
    evaluation_projection_count: 2,
    candidate_evaluation_link_count: 2,
    evaluation_case_projection_count: 16,
    idempotency_guard_count: 4,
    candidate_to_evaluation_cardinality: "ONE_TO_ZERO_OR_MANY",
    concurrent_same_hash_status: "EXACTLY_ONE_CANONICAL_OBJECT_ALL_CALLERS_SAME_OBJECT",
    concurrent_different_hash_status: "EXACTLY_ONE_WINNER_ONE_DETERMINISTIC_CONFLICT",
    response_loss_recovery: "PASS",
    facts_based_rebuild: "PASS",
    corrupt_projection_guard: "PASS",
    canonical_divergence_guard: "PASS",
    active_config_relation_delta: 0,
    model_activation_count: 0,
    state_count: 0,
    checkpoint_count: 0,
    pass_count: pass,
  };
  console.log(`S3_RESULT_JSON:${JSON.stringify(result)}`);
}

main()
  .catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
