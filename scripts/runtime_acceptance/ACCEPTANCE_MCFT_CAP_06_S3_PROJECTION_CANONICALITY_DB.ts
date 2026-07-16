// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_PROJECTION_CANONICALITY_DB.ts
// Purpose: prove the MCFT-CAP-06 S3 PostgreSQL projection/index tables reject direct semantic divergence from their canonical public.facts source records.
// Boundary: destructive isolated-database acceptance over the database already seeded by the S3 persistence acceptance; no production database, canonical append, calibration math, Runtime authority, State, checkpoint, Model Activation, route, Web, scheduler, or CAP-07 authority.

import assert from "node:assert/strict";
import { Pool } from "pg";

if (process.env.MCFT_CAP_06_S3_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_06_S3_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap06|s3|calibration|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

const pool = new Pool({ connectionString: databaseUrl });
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

async function expectCanonicalDivergenceV1(
  sql: string,
  values: unknown[],
  expected: RegExp,
): Promise<void> {
  await assert.rejects(pool.query(sql, values), expected);
}

async function main(): Promise<void> {
  const triggers = await pool.query(
    `SELECT relation.relname AS event_object_table,trigger.tgname AS trigger_name
       FROM pg_trigger AS trigger
       JOIN pg_class AS relation
         ON relation.oid=trigger.tgrelid
       JOIN pg_namespace AS namespace
         ON namespace.oid=relation.relnamespace
      WHERE namespace.nspname='public'
        AND trigger.tgisinternal=false
        AND trigger.tgname IN (
          'trg_twin_calibration_candidate_projection_canonicality_v1',
          'trg_twin_shadow_evaluation_projection_canonicality_v1',
          'trg_twin_candidate_evaluation_index_canonicality_v1',
          'trg_twin_shadow_evaluation_case_projection_canonicality_v1'
        )
      ORDER BY trigger.tgname ASC`,
  );
  assert.equal(triggers.rows.length, 4);
  assert.deepEqual(
    triggers.rows.map((row) => row.event_object_table).sort(),
    [
      "twin_calibration_candidate_projection_v1",
      "twin_candidate_evaluation_index_v1",
      "twin_shadow_evaluation_case_projection_v1",
      "twin_shadow_evaluation_projection_v1",
    ],
  );
  ok("all four CAP-06 canonicality triggers are installed");

  const candidate = await pool.query(
    `SELECT candidate_object_id,candidate_parameter_value
       FROM twin_calibration_candidate_projection_v1
      ORDER BY candidate_object_id ASC
      LIMIT 1`,
  );
  assert.equal(candidate.rows.length, 1);
  const candidateObjectId = String(candidate.rows[0].candidate_object_id);
  const originalCandidateValue = String(candidate.rows[0].candidate_parameter_value);
  const divergentCandidateValue = originalCandidateValue === "0.035000" ? "0.036000" : "0.035000";
  await expectCanonicalDivergenceV1(
    `UPDATE twin_calibration_candidate_projection_v1
        SET candidate_parameter_value=$2
      WHERE candidate_object_id=$1`,
    [candidateObjectId, divergentCandidateValue],
    /CAP06_CANDIDATE_PROJECTION_CANONICAL_DIVERGENCE/,
  );
  assert.equal(
    (await pool.query(
      `SELECT candidate_parameter_value
         FROM twin_calibration_candidate_projection_v1
        WHERE candidate_object_id=$1`,
      [candidateObjectId],
    )).rows[0].candidate_parameter_value,
    originalCandidateValue,
  );
  ok("direct Candidate semantic projection mutation is rejected and rolled back");

  const evaluation = await pool.query(
    `SELECT evaluation_object_id,evaluation_disposition
       FROM twin_shadow_evaluation_projection_v1
      ORDER BY evaluation_object_id ASC
      LIMIT 1`,
  );
  assert.equal(evaluation.rows.length, 1);
  const evaluationObjectId = String(evaluation.rows[0].evaluation_object_id);
  const originalDisposition = String(evaluation.rows[0].evaluation_disposition);
  const divergentDisposition = originalDisposition === "INCONCLUSIVE"
    ? "NOT_ELIGIBLE_FOR_ACTIVATION_REVIEW"
    : "INCONCLUSIVE";
  await expectCanonicalDivergenceV1(
    `UPDATE twin_shadow_evaluation_projection_v1
        SET evaluation_disposition=$2
      WHERE evaluation_object_id=$1`,
    [evaluationObjectId, divergentDisposition],
    /CAP06_EVALUATION_PROJECTION_CANONICAL_DIVERGENCE/,
  );
  assert.equal(
    (await pool.query(
      `SELECT evaluation_disposition
         FROM twin_shadow_evaluation_projection_v1
        WHERE evaluation_object_id=$1`,
      [evaluationObjectId],
    )).rows[0].evaluation_disposition,
    originalDisposition,
  );
  ok("direct Evaluation semantic projection mutation is rejected and rolled back");

  const index = await pool.query(
    `SELECT candidate_ref,evaluation_object_id,evaluation_policy_hash
       FROM twin_candidate_evaluation_index_v1
      ORDER BY candidate_ref ASC,evaluation_object_id ASC
      LIMIT 1`,
  );
  assert.equal(index.rows.length, 1);
  await expectCanonicalDivergenceV1(
    `UPDATE twin_candidate_evaluation_index_v1
        SET evaluation_policy_hash='sha256:direct-index-corruption'
      WHERE candidate_ref=$1
        AND evaluation_object_id=$2`,
    [index.rows[0].candidate_ref, index.rows[0].evaluation_object_id],
    /CAP06_CANDIDATE_EVALUATION_INDEX_CANONICAL_DIVERGENCE/,
  );
  assert.equal(
    (await pool.query(
      `SELECT evaluation_policy_hash
         FROM twin_candidate_evaluation_index_v1
        WHERE candidate_ref=$1
          AND evaluation_object_id=$2`,
      [index.rows[0].candidate_ref, index.rows[0].evaluation_object_id],
    )).rows[0].evaluation_policy_hash,
    index.rows[0].evaluation_policy_hash,
  );
  ok("direct Candidate-to-Evaluation index mutation is rejected and rolled back");

  const caseRow = await pool.query(
    `SELECT evaluation_object_id,case_index,residual_hash
       FROM twin_shadow_evaluation_case_projection_v1
      ORDER BY evaluation_object_id ASC,case_index ASC
      LIMIT 1`,
  );
  assert.equal(caseRow.rows.length, 1);
  await expectCanonicalDivergenceV1(
    `UPDATE twin_shadow_evaluation_case_projection_v1
        SET residual_hash='sha256:direct-case-corruption'
      WHERE evaluation_object_id=$1
        AND case_index=$2`,
    [caseRow.rows[0].evaluation_object_id, caseRow.rows[0].case_index],
    /CAP06_EVALUATION_CASE_PROJECTION_CANONICAL_DIVERGENCE/,
  );
  assert.equal(
    (await pool.query(
      `SELECT residual_hash
         FROM twin_shadow_evaluation_case_projection_v1
        WHERE evaluation_object_id=$1
          AND case_index=$2`,
      [caseRow.rows[0].evaluation_object_id, caseRow.rows[0].case_index],
    )).rows[0].residual_hash,
    caseRow.rows[0].residual_hash,
  );
  ok("direct embedded-case projection mutation is rejected and rolled back");

  console.log(`PASS_COUNT=${pass}`);
  console.log("MCFT_CAP_06_S3_PROJECTION_CANONICALITY_DB:PASS");
}

main()
  .catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
