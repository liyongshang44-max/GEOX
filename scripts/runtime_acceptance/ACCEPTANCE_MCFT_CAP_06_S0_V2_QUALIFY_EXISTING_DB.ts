// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_QUALIFY_EXISTING_DB.ts
// Purpose: read one already-reconstructed formal CAP-05 terminal database plus the exact Replay source used by that runner, resolve canonical Residual graphs, and prove the repository-history MCFT-CAP-06 S0 qualification result.
// Boundary: read-only public-database acceptance; only session-local PostgreSQL temporary relations are created, with no public fact append, projection mutation, Runtime execution, parameter replay, Candidate, Evaluation, Model Activation, active-config switch, route, Web, scheduler, or CAP-07 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
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
  // The caller must explicitly bind this acceptance to a dedicated isolated database.
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  const databaseName = decodeURIComponent(new URL(value).pathname.replace(/^\//, ""));
  if (!/(mcft|cap.*06|cap05.*acceptance|acceptance|test)/i.test(databaseName)) {
    throw new Error(`ISOLATED_ACCEPTANCE_DATABASE_REQUIRED:${databaseName}`);
  }
  return value;
}

function requiredReplayRoot(): string {
  // Source Evidence must be the exact retained Replay view used by the formal CAP-05 runner.
  const value = process.env.CAP06_REPLAY_ROOT;
  if (!value) throw new Error("CAP06_REPLAY_ROOT_REQUIRED");
  const resolved = path.resolve(value);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`CAP06_REPLAY_ROOT_NOT_FOUND:${resolved}`);
  }
  return resolved;
}

function walkJsonlFiles(root: string): string[] {
  // Traverse deterministically so duplicate and conflict diagnostics are stable.
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkJsonlFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(absolute);
  }
  return files;
}

function readReplayRecords(root: string): Record<string, unknown>[] {
  // Parse the same normalized Replay source files consumed by the formal runner.
  const records: Record<string, unknown>[] = [];
  for (const file of walkJsonlFiles(root)) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
    for (const [index, line] of lines.entries()) {
      const parsed = JSON.parse(line) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`CAP06_REPLAY_RECORD_INVALID:${file}:${index + 1}`);
      }
      records.push(parsed as Record<string, unknown>);
    }
  }
  return records;
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
       FROM public.facts
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
       FROM public.facts
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
       FROM public.facts
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

async function projectRequiredReplayEvidenceSessionLocally(
  pool: Pool,
  replayRoot: string,
): Promise<{ projected_record_count: number; public_fact_count: number }> {
  // Identify only forcing Evidence refs frozen by completed Forecasts in the exact scope.
  const values = Object.values(EXPECTED_SCOPE);
  const required = await pool.query(
    `SELECT DISTINCT ref,hash,record_type
       FROM (
         SELECT record_json->'payload'->'payload'->>'weather_snapshot_ref' AS ref,
                record_json->'payload'->'payload'->>'weather_snapshot_hash' AS hash,
                'future_weather_assumption_v1'::text AS record_type
           FROM public.facts
          WHERE record_json->>'type'='twin_forecast_run_v1'
            AND record_json->'payload'->'payload'->>'status'='COMPLETED'
            AND record_json->'payload'->>'tenant_id'=$1
            AND record_json->'payload'->>'project_id'=$2
            AND record_json->'payload'->>'group_id'=$3
            AND record_json->'payload'->>'field_id'=$4
            AND record_json->'payload'->>'season_id'=$5
            AND record_json->'payload'->>'zone_id'=$6
         UNION ALL
         SELECT record_json->'payload'->'payload'->>'et0_snapshot_ref' AS ref,
                record_json->'payload'->'payload'->>'et0_snapshot_hash' AS hash,
                'future_et0_assumption_v1'::text AS record_type
           FROM public.facts
          WHERE record_json->>'type'='twin_forecast_run_v1'
            AND record_json->'payload'->'payload'->>'status'='COMPLETED'
            AND record_json->'payload'->>'tenant_id'=$1
            AND record_json->'payload'->>'project_id'=$2
            AND record_json->'payload'->>'group_id'=$3
            AND record_json->'payload'->>'field_id'=$4
            AND record_json->'payload'->>'season_id'=$5
            AND record_json->'payload'->>'zone_id'=$6
       ) identities
      WHERE ref IS NOT NULL AND hash IS NOT NULL
      ORDER BY record_type,ref,hash`,
    values,
  );
  assert.ok(required.rows.length >= 2, "CAP06_REQUIRED_FORCING_EVIDENCE_IDENTITIES_MISSING");

  const replayRecords = readReplayRecords(replayRoot);
  const recordsByRef = new Map<string, Record<string, unknown>[]>();
  for (const record of replayRecords) {
    const ref = typeof record.source_record_id === "string" ? record.source_record_id : "";
    if (!ref) continue;
    recordsByRef.set(ref, [...(recordsByRef.get(ref) ?? []), record]);
  }

  const selected: Record<string, unknown>[] = [];
  for (const identity of required.rows as Array<{ ref: string; hash: string; record_type: string }>) {
    const matches = (recordsByRef.get(identity.ref) ?? []).filter((record) =>
      record.source_record_hash === identity.hash && record.record_type === identity.record_type);
    assert.equal(matches.length, 1, `CAP06_REPLAY_EVIDENCE_IDENTITY_CARDINALITY:${identity.record_type}:${identity.ref}`);
    selected.push(matches[0]);
  }

  const publicFactCount = await scalarCount(pool, "SELECT count(*)::int AS count FROM public.facts");
  await pool.query("CREATE TEMP TABLE cap06_source_evidence_fact_projection (LIKE public.facts INCLUDING DEFAULTS)");
  for (const record of selected) {
    const ref = String(record.source_record_id);
    const hash = String(record.source_record_hash);
    const availableAt = String(record.available_to_runtime_at);
    const factId = `fact_cap06_s0_source_projection_${semanticHashV1({ ref, hash }).slice(7, 39)}`;
    await pool.query(
      `INSERT INTO cap06_source_evidence_fact_projection (fact_id,occurred_at,source,record_json)
       VALUES ($1,$2::timestamptz,'mcft_cap06_s0_v2_session_source_projection',$3::jsonb)`,
      [factId, availableAt, JSON.stringify({ type: record.record_type, payload: record })],
    );
  }
  await pool.query(
    `CREATE TEMP VIEW facts AS
       SELECT * FROM public.facts
       UNION ALL
       SELECT * FROM cap06_source_evidence_fact_projection`,
  );

  const projectedCount = await scalarCount(pool, "SELECT count(*)::int AS count FROM cap06_source_evidence_fact_projection");
  assert.equal(projectedCount, selected.length, "CAP06_SESSION_SOURCE_PROJECTION_COUNT_MISMATCH");
  assert.equal(await scalarCount(pool, "SELECT count(*)::int AS count FROM public.facts"), publicFactCount, "CAP06_PUBLIC_FACTS_MUTATED");
  return { projected_record_count: projectedCount, public_fact_count: publicFactCount };
}

async function main(): Promise<void> {
  // max=1 guarantees the session-local temporary view is reused by the graph reader connection.
  const pool = new Pool({ connectionString: requiredDatabaseUrl(), max: 1 });
  try {
    const predecessor = await validateTerminalPredecessor(pool);
    const context = await readResidualContext(pool);
    ok("canonical Residual history resolves exactly one lineage/revision context");

    const sourceProjection = await projectRequiredReplayEvidenceSessionLocally(pool, requiredReplayRoot());
    assert.ok(sourceProjection.projected_record_count >= 2);
    ok("exact Replay forcing Evidence is projected session-locally with zero public-facts mutation");

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

    assert.equal(pass, 6);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      predecessor,
      context,
      source_evidence_projection: sourceProjection,
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
