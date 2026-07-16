// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_QUALIFY_EXISTING_DB_V2.ts
// Purpose: qualify the exact canonical closure of repository-history Residuals against the formal CAP-05 terminal database and the normalized Replay Evidence actually referenced by those Residual-bound Forecasts.
// Boundary: read-only public-database acceptance; only session-local temporary relations are created, with no public fact append, projection mutation, Runtime execution, parameter replay, Candidate, Evaluation, Model Activation, active-config switch, route, Web, scheduler, or CAP-07 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { qualifyCap06DatasetV2, type Cap06ScopeV2 } from "../../apps/server/src/domain/twin_runtime/calibration_case_graph_qualification_v2.js";
import { PostgresCap06RepositoryHistoryCaseGraphReaderV2 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap06_repository_history_case_graph_reader_v2.js";

const SCOPE: Cap06ScopeV2 = Object.freeze({
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "field_c8_demo",
  season_id: "season_2026_c8_corn",
  zone_id: "zone_mcft_c8_water_001",
});
const EXPECTED_SEQUENCE = 80;
const EXPECTED_NEXT_TICK = "2026-06-04T10:00:00.000Z";
const EXPECTED_STATE_COUNT = 33;
let pass = 0;

function ok(message: string): void {
  // Count one independently auditable S0 qualification property.
  pass += 1;
  process.stdout.write(`PASS ${message}\n`);
}

function requiredEnvironmentPath(name: "CAP06_REPLAY_ROOT"): string {
  // Source Evidence must come from the retained normalized Replay view used by the formal runner.
  const raw = process.env[name];
  if (!raw) throw new Error(`${name}_REQUIRED`);
  const resolved = path.resolve(raw);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`${name}_NOT_FOUND:${resolved}`);
  }
  return resolved;
}

function requiredDatabaseUrl(): string {
  // Refuse non-test database names before opening a connection.
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL_REQUIRED");
  const databaseName = decodeURIComponent(new URL(raw).pathname.replace(/^\//, ""));
  if (!/(mcft|cap.*06|cap05.*acceptance|acceptance|test)/i.test(databaseName)) {
    throw new Error(`ISOLATED_ACCEPTANCE_DATABASE_REQUIRED:${databaseName}`);
  }
  return raw;
}

function scopeValues(): string[] {
  // Keep SQL scope binding in the frozen six-part order.
  return [SCOPE.tenant_id, SCOPE.project_id, SCOPE.group_id, SCOPE.field_id, SCOPE.season_id, SCOPE.zone_id];
}

function walkJsonl(root: string): string[] {
  // Deterministic traversal makes duplicate diagnostics stable.
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkJsonl(absolute));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(absolute);
  }
  return files;
}

function loadReplayRecords(root: string): Record<string, unknown>[] {
  // Parse the exact normalized JSONL source without inventing defaults.
  const records: Record<string, unknown>[] = [];
  for (const file of walkJsonl(root)) {
    for (const [index, line] of fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).entries()) {
      const parsed = JSON.parse(line) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`CAP06_REPLAY_RECORD_INVALID:${file}:${index + 1}`);
      }
      records.push(parsed as Record<string, unknown>);
    }
  }
  return records;
}

async function count(pool: Pool, sql: string, parameters: readonly unknown[] = []): Promise<number> {
  // Convert PostgreSQL count output into an exact non-negative integer.
  const result = await pool.query(sql, [...parameters]);
  assert.equal(result.rows.length, 1, "CAP06_SCALAR_COUNT_ROW_REQUIRED");
  const value = Number(result.rows[0].count);
  assert.ok(Number.isInteger(value) && value >= 0, "CAP06_SCALAR_COUNT_INVALID");
  return value;
}

async function validatePredecessor(pool: Pool): Promise<Record<string, unknown>> {
  // Lock qualification to the exact formal terminal handoff rather than a documentation artifact.
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
    scopeValues(),
  );
  assert.equal(checkpoint.rows.length, 1, "CAP06_TERMINAL_CHECKPOINT_REQUIRED");
  const object = checkpoint.rows[0].object as Record<string, any>;
  assert.equal(object.payload.tick_sequence, EXPECTED_SEQUENCE, "CAP06_CHECKPOINT_SEQUENCE_MISMATCH");
  assert.equal(object.payload.next_tick_logical_time, EXPECTED_NEXT_TICK, "CAP06_NEXT_TICK_MISMATCH");
  const stateCount = await count(
    pool,
    `SELECT count(*)::int AS count FROM public.facts
      WHERE record_json->>'type'='twin_state_estimate_v1'
        AND record_json->'payload'->>'tenant_id'=$1
        AND record_json->'payload'->>'project_id'=$2
        AND record_json->'payload'->>'group_id'=$3
        AND record_json->'payload'->>'field_id'=$4
        AND record_json->'payload'->>'season_id'=$5
        AND record_json->'payload'->>'zone_id'=$6`,
    scopeValues(),
  );
  assert.equal(stateCount, EXPECTED_STATE_COUNT, "CAP06_STATE_COUNT_MISMATCH");
  ok("formal CAP-05 predecessor is checkpoint 80 with 33 canonical State facts");
  return {
    checkpoint_ref: object.object_id,
    checkpoint_hash: object.determinism_hash,
    checkpoint_sequence: object.payload.tick_sequence,
    latest_logical_time: object.logical_time,
    next_tick_logical_time: object.payload.next_tick_logical_time,
    reproduced_state_fact_count: stateCount,
  };
}

async function residualContext(pool: Pool): Promise<{ lineage_id: string; revision_id: string }> {
  // One repository-history track must resolve exactly one semantic lineage/revision pair.
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
    scopeValues(),
  );
  assert.equal(result.rows.length, 1, "CAP06_RESIDUAL_CONTEXT_CARDINALITY");
  const lineageId = String(result.rows[0].lineage_id ?? "");
  const revisionId = String(result.rows[0].revision_id ?? "");
  assert.ok(lineageId && revisionId, "CAP06_RESIDUAL_CONTEXT_REQUIRED");
  ok("canonical Residual history resolves exactly one lineage/revision context");
  return { lineage_id: lineageId, revision_id: revisionId };
}

async function projectResidualClosureEvidence(pool: Pool, replayRoot: string): Promise<{ projected_record_count: number; public_fact_count: number }> {
  // Resolve forcing identities only from Forecasts actually referenced by canonical Residuals; unrelated historical Forecasts are outside this case graph.
  const required = await pool.query(
    `WITH residual_forecasts AS (
       SELECT DISTINCT record_json->'payload'->'payload'->>'forecast_run_ref' AS forecast_ref
         FROM public.facts
        WHERE record_json->>'type'='twin_forecast_residual_v1'
          AND record_json->'payload'->>'tenant_id'=$1
          AND record_json->'payload'->>'project_id'=$2
          AND record_json->'payload'->>'group_id'=$3
          AND record_json->'payload'->>'field_id'=$4
          AND record_json->'payload'->>'season_id'=$5
          AND record_json->'payload'->>'zone_id'=$6
     ), residual_bound_forecasts AS (
       SELECT record_json->'payload' AS object
         FROM public.facts
         JOIN residual_forecasts
           ON record_json->'payload'->>'object_id'=residual_forecasts.forecast_ref
        WHERE record_json->>'type'='twin_forecast_run_v1'
     )
     SELECT DISTINCT ref,hash,record_type
       FROM (
         SELECT object->'payload'->>'weather_snapshot_ref' AS ref,
                object->'payload'->>'weather_snapshot_hash' AS hash,
                'future_weather_assumption_v1'::text AS record_type
           FROM residual_bound_forecasts
         UNION ALL
         SELECT object->'payload'->>'et0_snapshot_ref' AS ref,
                object->'payload'->>'et0_snapshot_hash' AS hash,
                'future_et0_assumption_v1'::text AS record_type
           FROM residual_bound_forecasts
       ) identities
      WHERE ref IS NOT NULL AND hash IS NOT NULL
      ORDER BY record_type,ref,hash`,
    scopeValues(),
  );
  assert.equal(required.rows.length, 2, "CAP06_RESIDUAL_CLOSURE_FORCING_IDENTITY_COUNT");

  const recordsByRef = new Map<string, Record<string, unknown>[]>();
  for (const record of loadReplayRecords(replayRoot)) {
    const ref = typeof record.source_record_id === "string" ? record.source_record_id : "";
    if (ref) recordsByRef.set(ref, [...(recordsByRef.get(ref) ?? []), record]);
  }
  const selected: Record<string, unknown>[] = [];
  for (const identity of required.rows as Array<{ ref: string; hash: string; record_type: string }>) {
    const matches = (recordsByRef.get(identity.ref) ?? []).filter((record) =>
      record.source_record_hash === identity.hash && record.record_type === identity.record_type);
    assert.equal(matches.length, 1, `CAP06_REPLAY_EVIDENCE_IDENTITY_CARDINALITY:${identity.record_type}:${identity.ref}`);
    selected.push(matches[0]);
  }

  const publicFactCount = await count(pool, "SELECT count(*)::int AS count FROM public.facts");
  await pool.query("CREATE TEMP TABLE cap06_source_evidence_projection (LIKE public.facts INCLUDING DEFAULTS)");
  for (const record of selected) {
    const ref = String(record.source_record_id);
    const hash = String(record.source_record_hash);
    await pool.query(
      `INSERT INTO cap06_source_evidence_projection (fact_id,occurred_at,source,record_json)
       VALUES ($1,$2::timestamptz,'mcft_cap06_s0_v2_session_source_projection',$3::jsonb)`,
      [
        `fact_cap06_s0_source_${semanticHashV1({ ref, hash }).slice(7, 39)}`,
        String(record.available_to_runtime_at),
        JSON.stringify({ type: record.record_type, payload: record }),
      ],
    );
  }
  await pool.query(
    `CREATE TEMP VIEW facts AS
       SELECT * FROM public.facts
       UNION ALL
       SELECT * FROM cap06_source_evidence_projection`,
  );
  assert.equal(await count(pool, "SELECT count(*)::int AS count FROM cap06_source_evidence_projection"), 2);
  assert.equal(await count(pool, "SELECT count(*)::int AS count FROM public.facts"), publicFactCount, "CAP06_PUBLIC_FACTS_MUTATED");
  ok("the two Residual-closure forcing Evidence records are projected session-locally with zero public mutation");
  return { projected_record_count: 2, public_fact_count: publicFactCount };
}

async function main(): Promise<void> {
  // A single pool session guarantees the temporary projection view remains visible to the reader.
  const pool = new Pool({ connectionString: requiredDatabaseUrl(), max: 1 });
  try {
    const predecessor = await validatePredecessor(pool);
    const context = await residualContext(pool);
    const sourceProjection = await projectResidualClosureEvidence(pool, requiredEnvironmentPath("CAP06_REPLAY_ROOT"));
    const graphs = await new PostgresCap06RepositoryHistoryCaseGraphReaderV2(pool).loadResolvedCaseGraphsV2({
      scope: SCOPE,
      lineage_id: context.lineage_id,
      revision_id: context.revision_id,
    });
    assert.equal(graphs.length, 1, "CAP06_EXPECTED_ONE_RESIDUAL_GRAPH");
    ok("one canonical Residual expands into one complete canonical plus source-Evidence graph");

    const graph = graphs[0];
    assert.notEqual(graph.forecast_runtime_config.ref, graph.residual_runtime_config.ref);
    assert.equal(graph.forecast.forecast_runtime_config.ref, graph.forecast_runtime_config.ref);
    assert.equal(graph.source_posterior.forecast_runtime_config.ref, graph.forecast_runtime_config.ref);
    assert.equal(graph.residual.residual_runtime_config.ref, graph.residual_runtime_config.ref);
    ok("Forecast-time and Residual-time Config identities remain distinct and each graph edge closes");

    const qualification = qualifyCap06DatasetV2(SCOPE, graphs);
    assert.equal(qualification.case_graph_validation_status, "PASS");
    assert.equal(qualification.dataset_qualification_status, "INSUFFICIENT_MATCHED_PAIRS");
    assert.equal(qualification.eligible_residual_count, 1);
    assert.equal(qualification.eligible_matched_pair_count, 1);
    assert.equal(qualification.excluded_cases.length, 0);
    assert.equal(qualification.eligible_calibration_count, 0);
    assert.equal(qualification.eligible_holdout_count, 0);
    assert.deepEqual([
      qualification.model_component_hash_count,
      qualification.effective_parameter_bundle_hash_count,
      qualification.observation_operator_hash_count,
      qualification.geometry_hash_count,
      qualification.runtime_replay_numeric_policy_hash_count,
      qualification.residual_policy_hash_count,
    ], [1, 1, 1, 1, 1, 1]);
    ok("repository history has one eligible exact case, six homogeneous authorities and INSUFFICIENT_MATCHED_PAIRS");

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
