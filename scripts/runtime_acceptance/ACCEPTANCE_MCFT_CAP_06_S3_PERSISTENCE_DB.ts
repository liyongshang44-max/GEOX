// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_PERSISTENCE_DB.ts
// Purpose: prove MCFT-CAP-06 S3 exact-ref PostgreSQL loading, D Candidate/Evaluation atomic persistence, idempotency, concurrency, response-loss recovery, projection rebuild, one-to-many indexing, and corruption fail-closed in an isolated database.
// Boundary: destructive isolated-database acceptance only; no production database, alternative calibration math, Model Activation, active-config switch, State/checkpoint mutation, route, Web, scheduler, or MCFT-CAP-07 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type {
  Cap06CalibrationCandidateDraftV1,
  Cap06ShadowEvaluationDraftV1,
} from "../../apps/server/src/domain/calibration/envelope_profiles_v1.js";
import { createCap06ExactCalibrationLoaderV1 } from "../../apps/server/src/domain/calibration/exact_ref_port_v1.js";
import { PostgresExactCalibrationResidualRepositoryV1 } from "../../apps/server/src/persistence/calibration/postgres_exact_calibration_residual_repository_v1.js";
import { PostgresCalibrationGovernanceRepositoryV1 } from "../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import {
  buildCap06ControlledComputeFixtureV1,
} from "./mcft_cap_06_controlled_compute_fixture_v1.js";
import type {
  Cap06S1ControlledCaseV1,
  Cap06S1ControlledObservationRecordV1,
} from "./mcft_cap_06_s1_residual_windows_fixture_v1.js";

if (process.env.MCFT_CAP_06_S3_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_06_S3_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap06|s3|calibration|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresCalibrationGovernanceRepositoryV1(pool);
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

function readSqlV1(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function factIdV1(identity: string): string {
  return `fact_${identity}`;
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
     VALUES ($1,$2::timestamptz,'mcft_cap06_s3_controlled_graph_v1',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [factIdV1(object.object_id), object.logical_time, recordJsonV1(object.object_type, object)],
  );
}

async function insertObservationEvidenceV1(
  record: Cap06S1ControlledObservationRecordV1,
): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s3_controlled_observation_v1',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [
      factIdV1(record.source_record_id),
      record.available_to_runtime_at,
      recordJsonV1(record.record_type, record),
    ],
  );
}

async function seedControlledGraphV1(
  cases: readonly Cap06S1ControlledCaseV1[],
): Promise<void> {
  const inserted = new Set<string>();
  const insertOnce = async (object: CanonicalObjectEnvelopeV1): Promise<void> => {
    if (inserted.has(object.object_id)) return;
    inserted.add(object.object_id);
    await insertCanonicalFactV1(object);
  };
  for (const caseItem of cases) {
    await insertOnce(caseItem.source_runtime_config);
    await insertOnce(caseItem.source_evidence_window);
    await insertOnce(caseItem.source_state);
    await insertOnce(caseItem.source_forecast);
    await insertObservationEvidenceV1(caseItem.observation_record);
    await insertOnce(caseItem.observation_evidence_window);
    await insertOnce(caseItem.assimilation_update);
    await insertOnce(caseItem.residual);
  }
}

async function countV1(fromClause: string, values: unknown[] = []): Promise<number> {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${fromClause}`, values);
  return result.rows[0].count as number;
}

async function relationV1(name: string): Promise<string | null> {
  const result = await pool.query("SELECT to_regclass($1) AS relation", [name]);
  return result.rows[0].relation as string | null;
}

function rehashV1<T extends { determinism_hash: string }>(value: T): T {
  const result = structuredClone(value);
  result.determinism_hash = "";
  result.determinism_hash = semanticHashV1(result);
  return result;
}

function concurrentCandidateV1(
  source: Cap06CalibrationCandidateDraftV1,
): Cap06CalibrationCandidateDraftV1 {
  const result = structuredClone(source);
  result.object_id = `${source.object_id}_concurrent`;
  result.idempotency_key = `${source.idempotency_key}:CONCURRENT`;
  result.payload.calibration_run_id = `${String(source.payload.calibration_run_id)}_concurrent`;
  return rehashV1(result);
}

function secondEvaluationV1(
  source: Cap06ShadowEvaluationDraftV1,
): Cap06ShadowEvaluationDraftV1 {
  const result = structuredClone(source);
  result.object_id = `${source.object_id}_second_policy`;
  result.idempotency_key = `${source.idempotency_key}:SECOND_POLICY`;
  result.payload.shadow_evaluation_id = `${String(source.payload.shadow_evaluation_id)}_second_policy`;
  result.payload.evaluation_policy_hash = semanticHashV1({
    base_policy_hash: source.payload.evaluation_policy_hash,
    acceptance_variant: "SECOND_POLICY",
  });
  return rehashV1(result);
}

function candidateVariantV1(
  source: Cap06CalibrationCandidateDraftV1,
  suffix: string,
  parameterValue: string,
): Cap06CalibrationCandidateDraftV1 {
  const result = structuredClone(source);
  result.object_id = `${source.object_id}_${suffix}`;
  result.idempotency_key = `${source.idempotency_key}:${suffix.toUpperCase()}`;
  result.payload.calibration_run_id = `${String(source.payload.calibration_run_id)}_${suffix}`;
  result.payload.candidate_parameter_value = parameterValue;
  result.payload.parameter_delta = parameterValue === "0.034000" ? "0.004000" : "0.005000";
  return rehashV1(result);
}

function evaluationCandidateVariantV1(
  source: Cap06ShadowEvaluationDraftV1,
  suffix: string,
  candidateRef: string,
  candidateHash: string,
): Cap06ShadowEvaluationDraftV1 {
  const result = structuredClone(source);
  result.object_id = `${source.object_id}_${suffix}`;
  result.idempotency_key = `${source.idempotency_key}:${suffix.toUpperCase()}`;
  result.payload.shadow_evaluation_id = `${String(source.payload.shadow_evaluation_id)}_${suffix}`;
  result.payload.candidate_ref = candidateRef;
  result.payload.candidate_hash = candidateHash;
  result.source_refs[0] = candidateRef;
  return rehashV1(result);
}

async function main(): Promise<void> {
  await initializeSchemaV1();
  const fixture = await buildCap06ControlledComputeFixtureV1();
  await seedControlledGraphV1(fixture.controlled.cases);
  const sourceByResidual = new Map(
    fixture.sources.map((source) => [source.residual_ref, structuredClone(source)]),
  );

  const exactRepository = new PostgresExactCalibrationResidualRepositoryV1(pool, {
    resolveExactResidualGraph(residual) {
      const source = sourceByResidual.get(residual.object_id);
      if (!source) throw new Error(`CAP06_S3_GRAPH_SOURCE_MISSING:${residual.object_id}`);
      if (source.residual_hash !== residual.determinism_hash) {
        throw new Error(`CAP06_S3_GRAPH_RESIDUAL_HASH_MISMATCH:${residual.object_id}`);
      }
      return structuredClone(source);
    },
  });
  const exactLoader = createCap06ExactCalibrationLoaderV1(exactRepository);
  assert.deepEqual(Object.keys(exactLoader), ["loadExactCalibrationResiduals"]);
  assert.deepEqual(
    Object.getOwnPropertyNames(Object.getPrototypeOf(exactRepository)).sort(),
    ["constructor", "loadExactCalibrationResiduals"],
  );
  const exactLoaded = await exactLoader.loadExactCalibrationResiduals(
    fixture.controlled.calibration_window_refs,
  );
  assert.deepEqual(
    exactLoaded.map((item) => item.residual_ref),
    fixture.controlled.calibration_window_refs,
  );
  await assert.rejects(
    exactLoader.loadExactCalibrationResiduals([
      ...fixture.controlled.calibration_window_refs.slice(0, 15),
      "missing_cap06_residual_ref",
    ]),
    /CAP06_POSTGRES_EXACT_RESIDUAL_MISSING/,
  );
  ok("exact-ref PostgreSQL port preserves requested order and exposes no list/search/range surface");

  const stateCountBefore = await countV1("facts WHERE record_json->>'type'='twin_state_estimate_v1'");
  const checkpointCountBefore = await countV1("facts WHERE record_json->>'type'='twin_runtime_checkpoint_v1'");
  const activationCountBefore = await countV1("facts WHERE record_json->>'type'='twin_model_activation_v1'");
  const activeConfigRelationBefore = await relationV1("public.twin_active_config_index_v1");
  const canonicalGovernanceBefore = await countV1(
    "facts WHERE record_json->>'type' IN ('twin_calibration_candidate_v1','twin_shadow_evaluation_v1')",
  );

  const orphanEvaluation = evaluationCandidateVariantV1(
    fixture.evaluation,
    "orphan_candidate",
    "twin_calibration_candidate_missing",
    semanticHashV1({ missing: "candidate" }),
  );
  await assert.rejects(
    repository.commitCanonicalObject({ object: orphanEvaluation }),
    /CAP06_EVALUATION_CANDIDATE_NOT_CANONICAL/,
  );
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_shadow_evaluation_v1'"), 0);
  ok("Evaluation D commit rejects an orphan candidate reference before canonical append");

  const candidateFirst = await repository.commitCanonicalObject({ object: fixture.candidate });
  assert.equal(candidateFirst.status, "INSERTED");
  assert.equal(
    (await repository.commitCanonicalObject({ object: fixture.candidate })).status,
    "EXISTING_IDEMPOTENT_SUCCESS",
  );
  assert.equal(
    (await repository.readCanonicalObject(fixture.candidate.object_id))?.determinism_hash,
    fixture.candidate.determinism_hash,
  );
  assert.equal(await countV1("twin_calibration_candidate_projection_v1"), 1);
  ok("Candidate D commit, canonical readback and idempotent retry succeed atomically");

  const conflictingCandidate = structuredClone(fixture.candidate);
  conflictingCandidate.payload.candidate_parameter_value = "0.035000";
  conflictingCandidate.determinism_hash = "";
  conflictingCandidate.determinism_hash = semanticHashV1(conflictingCandidate);
  await assert.rejects(
    repository.commitCanonicalObject({ object: conflictingCandidate }),
    /CAP06_IDEMPOTENCY_CONFLICT/,
  );
  assert.equal(await countV1("twin_calibration_candidate_projection_v1"), 1);
  ok("same Candidate key with a different semantic hash is rejected without partial writes");

  const wrongHashEvaluation = evaluationCandidateVariantV1(
    fixture.evaluation,
    "wrong_candidate_hash",
    fixture.candidate.object_id,
    semanticHashV1({ wrong: "candidate-hash" }),
  );
  await assert.rejects(
    repository.commitCanonicalObject({ object: wrongHashEvaluation }),
    /CAP06_EVALUATION_CANDIDATE_HASH_MISMATCH/,
  );
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_shadow_evaluation_v1'"), 0);
  ok("Evaluation D commit rejects a wrong canonical Candidate hash before append");

  const concurrentCandidate = concurrentCandidateV1(fixture.candidate);
  const concurrentConflictVariant = structuredClone(concurrentCandidate);
  concurrentConflictVariant.payload.candidate_parameter_value = "0.035000";
  concurrentConflictVariant.payload.parameter_delta = "0.005000";
  concurrentConflictVariant.determinism_hash = "";
  concurrentConflictVariant.determinism_hash = semanticHashV1(concurrentConflictVariant);
  const concurrentConflictResults = await Promise.allSettled([
    repository.commitCanonicalObject({ object: concurrentCandidate }),
    repository.commitCanonicalObject({ object: concurrentConflictVariant }),
  ]);
  const concurrentConflictFulfilled = concurrentConflictResults.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof repository.commitCanonicalObject>>> =>
      result.status === "fulfilled",
  );
  const concurrentConflictRejected = concurrentConflictResults.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  assert.equal(concurrentConflictFulfilled.length, 1);
  assert.equal(concurrentConflictRejected.length, 1);
  assert.match(String(concurrentConflictRejected[0].reason), /CAP06_IDEMPOTENCY_CONFLICT/);
  const concurrentWinner = concurrentConflictFulfilled[0].value.object;
  assert.equal(
    await countV1(
      "facts WHERE record_json->'payload'->>'object_id'=$1",
      [concurrentWinner.object_id],
    ),
    1,
  );
  ok("concurrent same-key different-hash Candidate calls produce one winner and one deterministic conflict");

  const concurrentResults = await Promise.all(
    Array.from({ length: 8 }, () => repository.commitCanonicalObject({ object: concurrentWinner })),
  );
  assert.equal(
    concurrentResults.every((result) => result.status === "EXISTING_IDEMPOTENT_SUCCESS"),
    true,
  );
  assert.equal(
    concurrentResults.every((result) => result.object.determinism_hash === concurrentWinner.determinism_hash),
    true,
  );
  assert.equal(
    await countV1(
      "facts WHERE record_json->'payload'->>'object_id'=$1",
      [concurrentWinner.object_id],
    ),
    1,
  );
  ok("concurrent same-key same-hash Candidate retries converge on one canonical append");

  const evaluationFirst = await repository.commitCanonicalObject({ object: fixture.evaluation });
  assert.equal(evaluationFirst.status, "INSERTED");
  assert.equal(
    (await repository.commitCanonicalObject({ object: fixture.evaluation })).status,
    "EXISTING_IDEMPOTENT_SUCCESS",
  );
  assert.equal(await countV1("twin_shadow_evaluation_projection_v1"), 1);
  assert.equal(await countV1("twin_candidate_evaluation_index_v1"), 1);
  assert.equal(await countV1("twin_shadow_evaluation_case_projection_v1"), 8);
  ok("Evaluation D commit persists one canonical aggregate and eight embedded-case projections");

  const secondEvaluation = secondEvaluationV1(fixture.evaluation);
  assert.equal(
    (await repository.commitCanonicalObject({ object: secondEvaluation })).status,
    "INSERTED",
  );
  assert.equal(
    await countV1(
      "twin_candidate_evaluation_index_v1 WHERE candidate_ref=$1",
      [fixture.candidate.object_id],
    ),
    2,
  );
  ok("one Candidate indexes zero-to-many Evaluations without candidate_ref-only uniqueness");

  await pool.query(
    `DELETE FROM twin_object_idempotency_index_v1
     WHERE idempotency_key=$1`,
    [fixture.candidate.idempotency_key],
  );
  assert.equal(
    (await repository.commitCanonicalObject({ object: fixture.candidate })).status,
    "EXISTING_RECOVERED",
  );
  assert.equal(
    await countV1(
      "twin_object_idempotency_index_v1 WHERE idempotency_key=$1",
      [fixture.candidate.idempotency_key],
    ),
    1,
  );
  ok("guard loss recovers from canonical Candidate fact without a second append");

  await pool.query(
    "DELETE FROM twin_shadow_evaluation_case_projection_v1 WHERE evaluation_object_id=$1",
    [fixture.evaluation.object_id],
  );
  await pool.query(
    "DELETE FROM twin_candidate_evaluation_index_v1 WHERE evaluation_object_id=$1",
    [fixture.evaluation.object_id],
  );
  await pool.query(
    "DELETE FROM twin_shadow_evaluation_projection_v1 WHERE evaluation_object_id=$1",
    [fixture.evaluation.object_id],
  );
  assert.equal(
    (await repository.commitCanonicalObject({ object: fixture.evaluation })).status,
    "EXISTING_IDEMPOTENT_SUCCESS",
  );
  assert.equal(
    await countV1(
      "twin_shadow_evaluation_case_projection_v1 WHERE evaluation_object_id=$1",
      [fixture.evaluation.object_id],
    ),
    8,
  );
  ok("projection loss is repaired during idempotent Evaluation retry");

  await pool.query(
    `UPDATE twin_calibration_candidate_projection_v1
     SET determinism_hash='sha256:corrupt'
     WHERE candidate_object_id=$1`,
    [fixture.candidate.object_id],
  );
  await assert.rejects(
    repository.commitCanonicalObject({ object: fixture.candidate }),
    /CAP06_CANDIDATE_PROJECTION_DIVERGENCE/,
  );
  assert.equal(
    (await pool.query(
      "SELECT determinism_hash FROM twin_calibration_candidate_projection_v1 WHERE candidate_object_id=$1",
      [fixture.candidate.object_id],
    )).rows[0].determinism_hash,
    "sha256:corrupt",
  );
  ok("surviving corrupt Candidate projection fails closed and is not silently overwritten");

  const recovery = await repository.rebuildFromFacts();
  assert.equal(recovery.candidate_projections_rebuilt, 2);
  assert.equal(recovery.evaluation_projections_rebuilt, 2);
  assert.equal(recovery.candidate_evaluation_rows_rebuilt, 2);
  assert.equal(recovery.evaluation_case_rows_rebuilt, 16);
  assert.equal(
    (await pool.query(
      "SELECT determinism_hash FROM twin_calibration_candidate_projection_v1 WHERE candidate_object_id=$1",
      [fixture.candidate.object_id],
    )).rows[0].determinism_hash,
    fixture.candidate.determinism_hash,
  );
  ok("facts-based rebuild restores all D guards and rebuildable projections exactly");

  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s3_divergence_fixture',$3::jsonb)`,
    [
      `${factIdV1(fixture.candidate.object_id)}_duplicate`,
      fixture.candidate.logical_time,
      recordJsonV1(fixture.candidate.object_type, fixture.candidate),
    ],
  );
  await assert.rejects(
    repository.readCanonicalObject(fixture.candidate.object_id),
    /CAP06_CANONICAL_OBJECT_ID_NOT_UNIQUE/,
  );
  await pool.query("DELETE FROM facts WHERE fact_id=$1", [
    `${factIdV1(fixture.candidate.object_id)}_duplicate`,
  ]);
  ok("canonical object-id divergence fails closed");

  const canonicalGovernanceAfter = await countV1(
    "facts WHERE record_json->>'type' IN ('twin_calibration_candidate_v1','twin_shadow_evaluation_v1')",
  );
  assert.equal(canonicalGovernanceAfter - canonicalGovernanceBefore, 4);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_calibration_candidate_v1'"), 2);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_shadow_evaluation_v1'"), 2);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_model_activation_v1'"), activationCountBefore);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_state_estimate_v1'"), stateCountBefore);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_runtime_checkpoint_v1'"), checkpointCountBefore);
  assert.equal(await relationV1("public.twin_active_config_index_v1"), activeConfigRelationBefore);
  ok("D persistence changes model-governance history only and preserves Runtime, State and activation authority");

  console.log(`PASS_COUNT=${pass}`);
  console.log("MCFT_CAP_06_S3_PERSISTENCE_DB:PASS");
}

main()
  .catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
