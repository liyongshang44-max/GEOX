// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_QUALIFY_EXISTING_DB.ts
// Purpose: read one already-reconstructed formal CAP-05 terminal database, resolve exact canonical Residual graphs, and prove the repository-history MCFT-CAP-06 S0 qualification result.
// Boundary: read-only acceptance only; no database creation/drop, fact append, projection mutation, Runtime execution, parameter replay, Candidate, Evaluation, Model Activation, active-config switch, route, Web, scheduler, or CAP-07 authority.

import assert from "node:assert/strict";
import { Pool } from "pg";
import { qualifyCap06DatasetV2, type Cap06ScopeV2 } from "../../apps/server/src/domain/twin_runtime/calibration_case_graph_qualification_v2.js";
import { PostgresCap06RepositoryHistoryCaseGraphReaderV2 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap06_repository_history_case_graph_reader_v2.js";

const EXPECTED_SCOPE: Cap06ScopeV2 = Object.freeze({
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "field_c8_demo",
  season_id: "season_2026_c8_corn",
  zone_id: "zone_mcft_c8_water_001",
});

const EXPECTED_CHECKPOINT_SEQUENCE = 80;
const EXPECTED_NEXT_LOGICAL_TIME = "2026-06-04T10:00:00.000Z";
const EXPECTED_REPRODUCED_STATE_FACT_COUNT = 33;

let pass = 0;

function ok(message: string): void {
  // Count one independently auditable database qualification assertion.
  pass += 1;
  process.stdout.write(`PASS ${message}\n`);
}

function requiredDatabaseUrl(): string {
  // The caller must explicitly bind this read-only acceptance to an isolated database.
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  const databaseName = decodeURIComponent(new URL(value).pathname.replace(/^\//, ""));
  if (!/(mcft|cap.*06|cap05.*acceptance|acceptance|test)/i.test(databaseName)) {
    throw new Error(`ISOLATED_ACCEPTANCE_DATABASE_REQUIRED:${databaseName}`);
  }
  return value;
}

async function scalarCount(pool: Pool, sql: string, parameters: readonly unknown[] = []): Promise<number> {
  // Normalize PostgreSQL count text into an exact integer for acceptance assertions.
  const result = await pool.query(sql, [...parameters]);
  assert.equal(result.rows.length, 1, "SCALAR_COUNT_ROW_REQUIRED");
  const count = Number(result.rows[0].count);
  assert.ok(Number.isInteger(count) && count >= 0, "SCALAR_COUNT_INVALID");
  return count;
}

async function readResidualContext(pool: Pool): Promise<{ lineage_id: string; revision_id: string }> {
  // All Residuals in one S0 repository-history qualification must share one frozen lineage/revision context.
  const values = Object.values(EXPECTED_SCOPE);
  const result = await pool.query(
    `SELECT DISTINCT
            record_json->'payload'->>'context_lineage_ref' AS lineage_id,
            record_json->'payload'->>'context_revision_ref' AS revision_id
       FROM facts
      WHERE record_json->>'type'='twin_forecast_residual_v1'
        AND record_json->'payload'->>'tenant_id'=$1
        AND record_json->'payload'->>'project_id'=$2
        AND record_json->'payload'->>'group_id'=$3
        AND record_json->'payload'->>'field_id'=$4
        AND record_json->'payload'->>'season_id'=$5
        AND record_json->'payload'->>'zone_id'=$6`,
    values,
  );
  assert.equal(result.rows.length, 1, "CAP06_RESIDUAL_CONTEXT_CARDINALITY");
  const lineageId = String(result.rows[0].lineage_id ?? "");
  const revisionId = String(result.rows[0].revision_id ?? "");
  assert.ok(lineageId.length > 0, "CAP06_RESIDUAL_LINEAGE_REQUIRED");
  assert.ok(revisionId.length > 0, "CAP06_RESIDUAL_REVISION_REQUIRED");
  return { lineage_id: lineageId, revision_id: revisionId };
}

async function validateTerminalPredecessor(pool: Pool): Promise<Record<string, unknown>> {
  // S0 qualification is legal only against the exact CAP-05 terminal checkpoint and reproduced State count.
  const values = Object.values(EXPECTED_SCOPE);
  const checkpoint = await pool.query(
    `SELECT record_json->'payload' AS object
       FROM facts
      WHERE record_json->>'type'='twin_runtime_checkpoint_v1'
        AND record_json->'payload'->>'tenant_id'=$1
        AND record_json->'payload'->>'project_id'=$2
        AND record_json->'payload'->>'group_id'=$3
        AND record_json->'payload'->>'field_id'=$4
        AND record_json->'payload'->>'season_id'=$5
        AND record_json->'payload'->>'zone_id'=$6
      ORDER BY (record_json->'payload'->>'logical_time')::timestamptz DESC
      LIMIT 1`,
    values,
  );
  assert.equal(checkpoint.rows.length, 1, "CAP06_TERMINAL_CHECKPOINT_REQUIRED");
  const object = checkpoint.rows[0].object as Record<string, any>;
  assert.equal(object.payload.tick_sequence, EXPECTED_CHECKPOINT_SEQUENCE, "CAP06_CHECKPOINT_SEQUENCE_MISMATCH");
  assert.equal(object.payload.next_tick_logical_time, EXPECTED_NEXT_LOGICAL_TIME, "CAP06_NEXT_LOGICAL_TIME_MISMATCH");

  const stateCount = await scalarCount(
    pool,
    `SELECT count(*)::int AS count
       FROM facts
      WHERE record_json->>'type'='twin_state_estimate_v1'
        AND record_json->'payload'->>'tenant_id'=$1
        AND record_json->'payload'->>'project_id'=$2
        AND record_json->'payload'->>'group_id'=$3
        AND record_json->'payload'->>'field_id'=$4
        AND record_json->'payload'->>'season_id'=$5
        AND record_json->'payload'->>'zone_id'=$6`,
    values,
  );
  assert.equal(stateCount, EXPECTED_REPRODUCED_STATE_FACT_COUNT, "CAP06_REPRODUCED_STATE_COUNT_MISMATCH");
  ok("formal CAP-05 predecessor is exactly checkpoint 80 with 33 canonical State facts");
  return {
    checkpoint_ref: object.object_id,
    checkpoint_hash: object.determinism_hash,
    checkpoint_sequence: object.payload.tick_sequence,
    latest_logical_time: object.logical_time,
    next_tick_logical_time: object.payload.next_tick_logical_time,
    reproduced_state_fact_count: stateCount,
  };
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: requiredDatabaseUrl() });
  try {
    const predecessor = await validateTerminalPredecessor(pool);
    const context = await readResidualContext(pool);
    ok("canonical Residual history resolves exactly one lineage/revision context");

    const reader = new PostgresCap06RepositoryHistoryCaseGraphReaderV2(pool);
    const graphs = await reader.loadResolvedCaseGraphsV2({
      scope: EXPECTED_SCOPE,
      lineage_id: context.lineage_id,
      revision_id: context.revision_id,
    });
    assert.equal(graphs.length, 1, "CAP06_REPOSITORY_HISTORY_EXPECTS_ONE_RESIDUAL_GRAPH");
    ok("one canonical Residual expands into one complete read-only case graph");

    const graph = graphs[0];
    assert.notEqual(
      graph.forecast_runtime_config.ref,
      graph.residual_runtime_config.ref,
      "CAP06_FORECAST_AND_RESIDUAL_CONFIG_IDENTITIES_MUST_REMAIN_DISTINCT_IN_TERMINAL_HISTORY",
    );
    assert.equal(graph.forecast.forecast_runtime_config.ref, graph.forecast_runtime_config.ref);
    assert.equal(graph.source_posterior.forecast_runtime_config.ref, graph.forecast_runtime_config.ref);
    assert.equal(graph.residual.residual_runtime_config.ref, graph.residual_runtime_config.ref);
    ok("Forecast-time and Residual-time Config refs remain distinct and close their own canonical graph edges");

    const qualification = qualifyCap06DatasetV2(EXPECTED_SCOPE, graphs);
    assert.equal(qualification.case_graph_validation_status, "PASS");
    assert.equal(qualification.dataset_qualification_status, "INSUFFICIENT_MATCHED_PAIRS");
    assert.equal(qualification.eligible_residual_count, 1);
    assert.equal(qualification.eligible_matched_pair_count, 1);
    assert.equal(qualification.excluded_cases.length, 0);
    assert.equal(qualification.eligible_calibration_count, 0);
    assert.equal(qualification.eligible_holdout_count, 0);
    ok("repository history reports one eligible exact case and INSUFFICIENT_MATCHED_PAIRS");

    assert.deepEqual([
      qualification.model_component_hash_count,
      qualification.effective_parameter_bundle_hash_count,
      qualification.observation_operator_hash_count,
      qualification.geometry_hash_count,
      qualification.runtime_replay_numeric_policy_hash_count,
      qualification.residual_policy_hash_count,
    ], [1, 1, 1, 1, 1, 1]);
    ok("all six frozen homogeneity dimensions have exact cardinality one");

    assert.equal(pass, 5);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      predecessor,
      context,
      graph_identity: {
        residual_ref: graph.residual.residual_ref,
        residual_hash: graph.residual.residual_hash,
        forecast_ref: graph.forecast.ref,
        forecast_hash: graph.forecast.hash,
        forecast_point_ref: graph.residual.forecast_point.ref,
        forecast_point_hash: graph.residual.forecast_point.hash,
        observation_ref: graph.observation.ref,
        observation_hash: graph.observation.hash,
        forecast_runtime_config_ref: graph.forecast_runtime_config.ref,
        forecast_runtime_config_hash: graph.forecast_runtime_config.hash,
        residual_runtime_config_ref: graph.residual_runtime_config.ref,
        residual_runtime_config_hash: graph.residual_runtime_config.hash,
        evidence_window_ref: graph.evidence_window.ref,
        evidence_window_hash: graph.evidence_window.hash,
        source_posterior_ref: graph.source_posterior.ref,
        source_posterior_hash: graph.source_posterior.hash,
      },
      qualification,
    })}\n`);
    process.stdout.write(`SUMMARY ${pass} PASS / 0 FAIL\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
