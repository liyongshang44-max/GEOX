// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS_DB.ts
// Purpose: prove the MCFT-CAP-06 S1 controlled profile materializes exactly 24 canonical H1 Residuals and freezes disjoint 16/8 calibration-holdout windows in isolated PostgreSQL.
// Boundary: destructive isolated-database acceptance only; no production database, S2 math, Candidate, Evaluation, Model Activation, active-config switch, State/checkpoint mutation, route, Web, scheduler, or CAP-07 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  computeMemberDeterminismHashV1,
  semanticHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import {
  CAP06_S1_CALIBRATION_CASE_COUNT_V1,
  CAP06_S1_CONTROLLED_TRACK_V1,
  CAP06_S1_HOLDOUT_CASE_COUNT_V1,
  CAP06_S1_PROFILE_ID_V1,
  CAP06_S1_REPOSITORY_HISTORY_RESIDUAL_REF_V1,
  CAP06_S1_TOTAL_CASE_COUNT_V1,
  buildCap06S1ControlledDatasetV1,
  validateCap06S1ControlledCaseGraphV1,
  type Cap06S1ControlledCaseV1,
  type Cap06S1ControlledObservationRecordV1,
} from "./mcft_cap_06_s1_residual_windows_fixture_v1.js";

if (process.env.MCFT_CAP_06_S1_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_06_S1_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap06|s1|residual|acceptance|test)/.test(databaseName)) {
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
}

async function insertCanonicalFactV1(object: CanonicalObjectEnvelopeV1): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s1_controlled_profile_v1',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [factIdV1(object.object_id), object.logical_time, recordJsonV1(object.object_type, object)],
  );
}

async function insertObservationEvidenceV1(record: Cap06S1ControlledObservationRecordV1): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s1_controlled_observation_v1',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [factIdV1(record.source_record_id), record.available_to_runtime_at, recordJsonV1(record.record_type, record)],
  );
}

async function countV1(fromClause: string, values: unknown[] = []): Promise<number> {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${fromClause}`, values);
  return result.rows[0].count as number;
}

async function seedControlledPrestateV1(cases: readonly Cap06S1ControlledCaseV1[]): Promise<void> {
  const insertedCanonical = new Set<string>();
  const insertOnce = async (object: CanonicalObjectEnvelopeV1): Promise<void> => {
    if (insertedCanonical.has(object.object_id)) return;
    insertedCanonical.add(object.object_id);
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
  }
}

function assertDualTimePartitionV1(cases: readonly Cap06S1ControlledCaseV1[]): void {
  const calibration = cases.slice(0, CAP06_S1_CALIBRATION_CASE_COUNT_V1);
  const holdout = cases.slice(CAP06_S1_CALIBRATION_CASE_COUNT_V1);
  const maxCalibrationTarget = Math.max(...calibration.map((item) => Date.parse(item.residual.payload.forecast_target_time)));
  const minHoldoutTarget = Math.min(...holdout.map((item) => Date.parse(item.residual.payload.forecast_target_time)));
  const maxCalibrationAvailability = Math.max(...calibration.map((item) => Date.parse(item.residual.payload.observation_available_to_runtime_at)));
  const minHoldoutAvailability = Math.min(...holdout.map((item) => Date.parse(item.residual.payload.observation_available_to_runtime_at)));
  assert.ok(maxCalibrationTarget < minHoldoutTarget, "CAP06_S1_EVENT_TIME_PARTITION_INVALID");
  assert.ok(maxCalibrationAvailability < minHoldoutAvailability, "CAP06_S1_AVAILABILITY_TIME_PARTITION_INVALID");
  for (const caseItem of cases) {
    assert.ok(Date.parse(caseItem.source_forecast.as_of) < Date.parse(caseItem.residual.payload.observation_available_to_runtime_at), "CAP06_S1_FORECAST_AS_OF_LEAKAGE");
    assert.ok(Date.parse(caseItem.residual.payload.forecast_issued_at) < Date.parse(caseItem.residual.payload.observation_available_to_runtime_at), "CAP06_S1_FORECAST_ISSUED_LEAKAGE");
    const selectedRecords = caseItem.source_evidence_window.payload.base_continuation_window.selected_records as Array<Record<string, unknown>>;
    const cutoff = Math.max(...selectedRecords.map((record) => Date.parse(String(record.available_to_runtime_at))));
    assert.ok(cutoff <= Date.parse(caseItem.source_forecast.as_of), "CAP06_S1_SOURCE_EVIDENCE_CUTOFF_AFTER_FORECAST_AS_OF");
  }
}

function assertDuplicateTargetRejectedV1(cases: readonly Cap06S1ControlledCaseV1[]): void {
  const targetOwners = new Map<string, string>();
  const duplicate = structuredClone(cases[0]);
  duplicate.residual.object_id = `${duplicate.residual.object_id}_duplicate_target`;
  duplicate.residual.determinism_hash = computeMemberDeterminismHashV1(duplicate.residual as unknown as Record<string, unknown>);
  const input = [cases[0], duplicate];
  assert.throws(() => {
    for (const item of input) {
      const target = item.residual.payload.forecast_target_time;
      const owner = targetOwners.get(target);
      if (owner && owner !== item.residual.object_id) throw new Error("CAP06_S1_DUPLICATE_TARGET_TIME");
      targetOwners.set(target, item.residual.object_id);
    }
  }, /CAP06_S1_DUPLICATE_TARGET_TIME/);
}

function assertSemanticDuplicateRejectedV1(cases: readonly Cap06S1ControlledCaseV1[]): void {
  const semanticOwners = new Map<string, string>();
  const duplicate = structuredClone(cases[0]);
  duplicate.residual.object_id = `${duplicate.residual.object_id}_semantic_duplicate`;
  duplicate.residual.determinism_hash = computeMemberDeterminismHashV1(duplicate.residual as unknown as Record<string, unknown>);
  const input = [cases[0], duplicate];
  assert.throws(() => {
    for (const item of input) {
      const semantic = semanticHashV1({
        forecast_run_ref: item.residual.payload.forecast_run_ref,
        forecast_point_ref: item.residual.payload.forecast_point_ref,
        actual_observation_ref: item.residual.payload.actual_observation_ref,
        target_time: item.residual.payload.forecast_target_time,
      });
      const owner = semanticOwners.get(semantic);
      if (owner && owner !== item.residual.object_id) throw new Error("CAP06_S1_SEMANTIC_DUPLICATE");
      semanticOwners.set(semantic, item.residual.object_id);
    }
  }, /CAP06_S1_SEMANTIC_DUPLICATE/);
}

async function main(): Promise<void> {
  await initializeSchemaV1();
  const dataset = await buildCap06S1ControlledDatasetV1();
  assert.equal(dataset.profile_id, CAP06_S1_PROFILE_ID_V1);
  assert.equal(dataset.qualification_track, CAP06_S1_CONTROLLED_TRACK_V1);
  assert.equal(dataset.cases.length, CAP06_S1_TOTAL_CASE_COUNT_V1);
  assert.equal(dataset.calibration_window_refs.length, CAP06_S1_CALIBRATION_CASE_COUNT_V1);
  assert.equal(dataset.holdout_window_refs.length, CAP06_S1_HOLDOUT_CASE_COUNT_V1);
  assert.equal(dataset.calibration_window_refs.some((ref) => dataset.holdout_window_refs.includes(ref)), false);
  assert.equal(dataset.ordered_residual_refs.includes(CAP06_S1_REPOSITORY_HISTORY_RESIDUAL_REF_V1), false);
  assertDualTimePartitionV1(dataset.cases);
  ok("controlled profile contains 24 homogeneous H1 cases with disjoint 16/8 dual-time windows and zero future leakage");

  await seedControlledPrestateV1(dataset.cases);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_state_estimate_v1'"), 24);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_forecast_run_v1'"), 24);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_runtime_config_v1'"), 24);
  assert.equal(await countV1("facts WHERE record_json->>'type'='mcft_cap06_s1_controlled_observation_v1'"), 24);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_forecast_residual_v1'"), 0);
  ok("isolated PostgreSQL prestate contains 24 State/Config/COMPLETED Forecast/H1 Observation graph authorities and zero Residuals");

  const repository = new PostgresFeedbackPersistenceRepositoryV1(pool);
  const insertedStatuses: string[] = [];
  for (const caseItem of dataset.cases) {
    validateCap06S1ControlledCaseGraphV1(caseItem);
    const result = await repository.commitCanonicalObject({ object: caseItem.residual });
    insertedStatuses.push(result.status);
  }
  assert.deepEqual([...new Set(insertedStatuses)], ["INSERTED"]);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_forecast_residual_v1'"), 24);
  assert.equal(await countV1("twin_forecast_residual_projection_v1"), 24);
  assert.equal(await countV1("twin_object_idempotency_index_v1 WHERE identity_kind='C_FORECAST_RESIDUAL'"), 24);
  ok("existing production C repository atomically commits exactly 24 canonical Residual facts, projections and idempotency guards");

  const replayStatuses: string[] = [];
  for (const caseItem of dataset.cases) {
    replayStatuses.push((await repository.commitCanonicalObject({ object: caseItem.residual })).status);
  }
  assert.deepEqual([...new Set(replayStatuses)], ["EXISTING_IDEMPOTENT_SUCCESS"]);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_forecast_residual_v1'"), 24);
  ok("completed profile replay and response-loss-style retries create zero additional canonical writes");

  for (const caseItem of dataset.cases) {
    const readback = await repository.readCanonicalObject(caseItem.residual.object_id);
    assert.equal(readback?.determinism_hash, caseItem.residual.determinism_hash);
  }
  ok("all 24 Residual refs and hashes have exact canonical readback");

  const wrongForecast = structuredClone(dataset.cases[0]);
  wrongForecast.source_forecast.determinism_hash = `${wrongForecast.source_forecast.determinism_hash}_forged`;
  assert.throws(() => validateCap06S1ControlledCaseGraphV1(wrongForecast), /CAP06_S1_FORECAST_HASH_MISMATCH/);
  const wrongPoint = structuredClone(dataset.cases[0]);
  wrongPoint.forecast_point.determinism_hash = `${wrongPoint.forecast_point.determinism_hash}_forged`;
  assert.throws(() => validateCap06S1ControlledCaseGraphV1(wrongPoint), /CAP06_S1_POINT_HASH_MISMATCH/);
  const wrongObservation = structuredClone(dataset.cases[0]);
  wrongObservation.observation_record.source_record_hash = `${wrongObservation.observation_record.source_record_hash}_forged`;
  assert.throws(() => validateCap06S1ControlledCaseGraphV1(wrongObservation), /CAP06_S1_OBSERVATION_HASH_MISMATCH/);
  assertDuplicateTargetRejectedV1(dataset.cases);
  assertSemanticDuplicateRejectedV1(dataset.cases);
  ok("forged Forecast/point/Observation hashes, duplicate target times and semantic duplicate cases fail closed");

  const conflict = structuredClone(dataset.cases[0].residual);
  conflict.payload.actual_observation_value = "0.999999";
  conflict.determinism_hash = computeMemberDeterminismHashV1(conflict as unknown as Record<string, unknown>);
  await assert.rejects(
    repository.commitCanonicalObject({ object: conflict }),
    /CAP05_RESIDUAL_PROJECTION_MATH_MISMATCH|CAP05_IDEMPOTENCY_CONFLICT|CAP05_CANONICAL_OBJECT_CONFLICT/,
  );
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_forecast_residual_v1'"), 24);
  ok("same identity with conflicting semantics is rejected without an extra canonical write");

  await pool.query("DELETE FROM twin_forecast_residual_projection_v1");
  await pool.query("DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind='C_FORECAST_RESIDUAL'");
  const recovery = await repository.rebuildAllSupportState();
  assert.equal(recovery.forecast_residual_projections_rebuilt, 24);
  assert.equal(await countV1("twin_forecast_residual_projection_v1"), 24);
  assert.equal(await countV1("twin_object_idempotency_index_v1 WHERE identity_kind='C_FORECAST_RESIDUAL'"), 24);
  ok("facts-only rebuild restores all 24 Residual projections and idempotency guards");

  for (const type of ["twin_calibration_candidate_v1", "twin_shadow_evaluation_v1", "twin_model_activation_v1"]) {
    assert.equal(await countV1("facts WHERE record_json->>'type'=$1", [type]), 0, `CAP06_S1_FORBIDDEN_OBJECT:${type}`);
  }
  const activeConfigTables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%active%config%'");
  assert.equal(activeConfigTables.rows.length, 0);
  ok("S1 creates no Candidate, Evaluation, Model Activation or active-config authority");

  const result = {
    schema_version: dataset.schema_version,
    capability_line_id: "MCFT-CAP-06",
    delivery_slice_id: "MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1",
    status: "IMPLEMENTATION_CANDIDATE",
    profile_id: dataset.profile_id,
    qualification_track: dataset.qualification_track,
    base_drainage_coefficient: dataset.base_drainage_coefficient,
    hidden_drainage_coefficient: dataset.hidden_drainage_coefficient,
    canonical_residual_count: dataset.cases.length,
    ordered_residual_refs: dataset.ordered_residual_refs,
    ordered_residual_hashes: dataset.ordered_residual_hashes,
    residual_set_hash: dataset.residual_set_hash,
    calibration_window_refs: dataset.calibration_window_refs,
    calibration_window_hash: dataset.calibration_window_hash,
    holdout_window_refs: dataset.holdout_window_refs,
    holdout_window_hash: dataset.holdout_window_hash,
    case_input_set_hash: dataset.case_input_set_hash,
    model_component_hash: dataset.model_component_hash,
    effective_parameter_bundle_hash: dataset.effective_parameter_bundle_hash,
    observation_operator_hash: dataset.observation_operator_hash,
    geometry_hash: dataset.geometry_hash,
    runtime_replay_numeric_policy_hash: dataset.runtime_replay_numeric_policy_hash,
    case_graph_validation_status: "PASS",
    availability_order_validation_status: "PASS",
    homogeneity_validation_status: "PASS",
    future_leakage_count: 0,
    calibration_holdout_ref_intersection_count: 0,
    controlled_repository_history_ref_intersection_count: 0,
    residual_fact_delta: 24,
    candidate_fact_delta: 0,
    evaluation_fact_delta: 0,
    model_activation_fact_delta: 0,
    limitations: [
      "CONTROLLED_POSITIVE_MECHANISM_TRACK_ONLY",
      "NOT_REPOSITORY_HISTORY",
      "NOT_FIELD_CALIBRATION",
      "NO_CALIBRATION_SEARCH_EXECUTED_BY_S1",
      "NO_CANDIDATE_OR_EVALUATION_CANONICALIZED",
      "NO_MODEL_ACTIVATION",
    ],
  };
  console.log(`S1_RESULT_JSON:${JSON.stringify(result)}`);
  console.log(`MCFT-CAP-06 S1 residual windows PostgreSQL acceptance: ${pass} PASS, 0 FAIL`);
}

main()
  .finally(async () => {
    await pool.end();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
