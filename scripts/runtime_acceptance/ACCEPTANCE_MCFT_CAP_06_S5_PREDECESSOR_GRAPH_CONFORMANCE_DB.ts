// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE_DB.ts
// Purpose: prove the graph-conformant V2 controlled residual roots resolve through the sole production PostgreSQL exact-ref assembler under one repeatable-read read-only snapshot.
// Boundary: destructive isolated-database acceptance only; no production database, S5 Candidate, Evaluation, Model Activation, active-config switch, State/checkpoint mutation, route, Web, scheduler, or CAP-07 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { CAP04_RUNTIME_CONFIG_PURPOSE_V1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import { PostgresResolvedForecastObservationCaseAssemblerV1 } from "../../apps/server/src/persistence/calibration/postgres_resolved_forecast_observation_case_assembler_v1.js";
import { Cap04OrCap05ExecutionConfigResolverV1 } from "../../apps/server/src/runtime/twin_runtime/cap04_or_cap05_execution_config_resolver_v1.js";
import {
  buildCap06S5GraphConformantDatasetV2,
  type Cap06S5GraphConformantCaseV2,
  type Cap06S5GraphObservationRecordV2,
} from "./mcft_cap_06_s5_graph_conformant_fixture_v2.js";

if (process.env.MCFT_CAP_06_S5_GRAPH_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_06_S5_GRAPH_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap06|s5|graph|acceptance|test)/.test(databaseName)) {
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
     VALUES ($1,$2::timestamptz,'mcft_cap06_s5_graph_conformance_v2',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [`fact_${object.object_id}`, object.logical_time, recordJsonV1(object.object_type, object)],
  );
}

async function insertObservationV1(record: Cap06S5GraphObservationRecordV2): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s5_graph_observation_v2',$3::jsonb)
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

async function countFactsV1(): Promise<number> {
  return Number((await pool.query("SELECT count(*)::int AS count FROM facts")).rows[0].count);
}

async function main(): Promise<void> {
  await initializeSchemaV1();
  const dataset = await buildCap06S5GraphConformantDatasetV2();
  await seedV2(dataset.cases);
  const before = await countFactsV1();
  assert.ok(before > 0);
  ok("isolated database seeded with exact V2 residual, forecast, dual config, source posterior, both evidence windows, assimilation and observation posterior authorities");

  const assembler = new PostgresResolvedForecastObservationCaseAssemblerV1(
    pool,
    new Cap04OrCap05ExecutionConfigResolverV1(),
  );
  const resolved = await assembler.resolveExactResidualRefs(dataset.ordered_residual_refs);
  assert.equal(resolved.length, 24);
  assert.deepEqual(resolved.map((item) => item.residual.object_id), dataset.ordered_residual_refs);
  assert.deepEqual(resolved.map((item) => item.residual.determinism_hash), dataset.ordered_residual_hashes);
  assert.deepEqual(resolved.map((item) => item.case_source.case_index), [...Array(24).keys()]);
  for (let index = 0; index < resolved.length; index += 1) {
    const graph = resolved[index];
    const expected = dataset.cases[index];
    assert.equal(graph.case_source.residual_ref, expected.residual.object_id);
    assert.equal(graph.source_forecast.object_id, expected.source_forecast.object_id);
    assert.equal(graph.source_runtime_config.object_id, expected.source_runtime_config.object_id);
    assert.equal(graph.actual_observation.source_record_id, expected.observation_record.source_record_id);
    assert.equal(graph.assimilation_update.object_id, expected.assimilation_update.object_id);
    assert.equal(graph.observation_posterior.object_id, expected.observation_posterior.object_id);
    assert.equal(graph.observation_evidence_window.object_id, expected.observation_evidence_window.object_id);
    assert.equal(graph.observation_evidence_window.as_of, expected.observation_record.available_to_runtime_at);
    assert.equal(graph.assimilation_update.logical_time, expected.observation_record.available_to_runtime_at);
    assert.equal(graph.observation_posterior.logical_time, expected.observation_record.available_to_runtime_at);
    assert.equal(graph.resolved_execution_config.source_config_purpose, CAP04_RUNTIME_CONFIG_PURPOSE_V1);
    assert.equal(graph.resolved_residual_execution_config.source_config_purpose, CAP04_RUNTIME_CONFIG_PURPOSE_V1);
  }
  assert.equal(await countFactsV1(), before);
  ok("sole production assembler resolves all 24 exact refs in caller order with complete graph output and zero writes");

  const sourceOnly = await assembler.resolveExactResidualGraphs(dataset.cases.map((item) => item.residual));
  assert.deepEqual(sourceOnly.map((item) => item.residual_ref), dataset.ordered_residual_refs);
  const fullFromRoots = await assembler.resolveExactResidualCases(dataset.cases.map((item) => item.residual));
  assert.deepEqual(fullFromRoots.map((item) => item.case_source.residual_ref), dataset.ordered_residual_refs);
  assert.equal(await countFactsV1(), before);
  ok("legacy case-source methods and new full-case methods share the same graph authority without changing persistence state");

  await assert.rejects(
    assembler.resolveExactResidualRefs([dataset.ordered_residual_refs[0], dataset.ordered_residual_refs[0]]),
    /CAP06_GRAPH_EXACT_RESIDUAL_REFS_DUPLICATE/,
  );
  await assert.rejects(
    assembler.resolveExactResidualRefs(["twin_forecast_residual_missing_s5_graph_v2"]),
    /CAP06_GRAPH_RESIDUAL_ROOT_MISSING/,
  );
  assert.equal(await countFactsV1(), before);
  ok("duplicate and missing exact roots fail closed with zero writes and no range/latest fallback");

  const result = {
    schema_version: "geox_mcft_cap_06_s5_predecessor_graph_conformance_db_result_v1",
    status: "PASS",
    profile_id: dataset.profile_id,
    residual_set_hash: dataset.residual_set_hash,
    case_input_set_hash: dataset.case_input_set_hash,
    graph_assembly_set_hash: dataset.graph_assembly_set_hash,
    calibration_window_hash: dataset.calibration_window_hash,
    holdout_window_hash: dataset.holdout_window_hash,
    exact_graph_case_count: resolved.length,
    delayed_availability_case_count: dataset.cases.filter((item) => item.observation_record.observed_at !== item.observation_record.available_to_runtime_at).length,
    fact_count_before_read: before,
    fact_count_after_read: await countFactsV1(),
    canonical_write_count: 0,
    candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    s5_implementation_started: false,
  };
  console.log(`S5_GRAPH_CONFORMANCE_DB_RESULT_JSON:${JSON.stringify(result)}`);
  console.log(`MCFT-CAP-06 S5 predecessor graph conformance PostgreSQL acceptance: ${pass} PASS, 0 FAIL`);
}

main()
  .finally(async () => pool.end())
  .catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
