// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE_DB.ts
// Purpose: prove the production MCFT-CAP-02 range path commits 24 contiguous A2 ticks through real PostgreSQL and yields the exact scoped 25-State chain and final handoff.
// Boundary: destructive isolated-database acceptance only; no restart, resume, backfill, scheduler, public route, Forecast success, Recommendation, or action.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { ContiguousContinuationRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/contiguous_continuation_range_service_v1.js";
import { ContinuationTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type { ReplayEvidenceSourcePortV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildMcftCap02TwentyFourTickFixtureV1 } from "./mcft_cap_02_twenty_four_tick_fixture_v1.js";

if (process.env.MCFT_CAP_02_TWENTY_FOUR_TICK_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_02_TWENTY_FOUR_TICK_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap02|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pool = new Pool({ connectionString: databaseUrl });
const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
const LEASE_OWNER = "mcft-cap-02-24-tick-db-acceptance";
const CONTINUATION_TYPES = [
  "twin_evidence_window_v1",
  "twin_state_transition_v1",
  "twin_assimilation_update_v1",
  "twin_state_estimate_v1",
  "twin_forecast_run_v1",
  "twin_runtime_tick_v1",
  "twin_runtime_checkpoint_v1",
  "twin_runtime_health_v1",
];

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function readSqlV1(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function memberV1(members: CanonicalObjectEnvelopeV1[], objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = members.filter((member) => member.object_type === objectType);
  assert.equal(matches.length, 1);
  return matches[0];
}

async function initializeAndResetV1(): Promise<void> {
  await pool.query(readSqlV1("docker/postgres/init/001_schema.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql"));
  await pool.query(`TRUNCATE TABLE
    twin_runtime_health_latest_index_v1,
    twin_runtime_checkpoint_latest_index_v1,
    twin_forecast_success_latest_index_v1,
    twin_forecast_result_latest_index_v1,
    twin_state_latest_index_v1,
    twin_state_history_projection_v1,
    twin_active_lineage_index_v1,
    twin_runtime_lease_v1,
    twin_object_idempotency_index_v1,
    twin_runtime_authority_snapshot_v1,
    facts
    RESTART IDENTITY CASCADE`);
}

async function leaseTokenV1(scope: TwinScopeKeyV1): Promise<bigint> {
  const result = await pool.query(
    "SELECT fencing_token FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    scopeValuesV1(scope),
  );
  assert.equal(result.rows.length, 1);
  return BigInt(result.rows[0].fencing_token);
}

async function scopedContinuationFactCountV1(lineageId: string, revisionId: string): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS count
       FROM facts
      WHERE record_json->>'type'=ANY($1::text[])
        AND record_json->'payload'->>'lineage_id'=$2
        AND record_json->'payload'->>'revision_id'=$3
        AND record_json->'payload'->>'logical_time' >= '2026-06-01T02:00:00.000Z'
        AND record_json->'payload'->>'logical_time' <= '2026-06-02T01:00:00.000Z'`,
    [CONTINUATION_TYPES, lineageId, revisionId],
  );
  return result.rows[0].count as number;
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap02TwentyFourTickFixtureV1();
  const expected = fixture.expectedFixture.expected;
  try {
    await initializeAndResetV1();
    ok("isolated PostgreSQL schema is initialized with A0, authority snapshot, and A2 persistence families");

    assert.equal((await nextTickRepository.commitRealityBindingSnapshot(fixture.realityBindingSnapshot)).status, "INSERTED");
    assert.equal((await runtimeRepository.commitRuntimeConfig(fixture.parentRuntimeConfig)).status, "INSERTED");
    const a0Lease = await runtimeRepository.acquireLease({
      ...fixture.scope,
      lease_owner: LEASE_OWNER,
      lease_duration_seconds: 3600,
    });
    assert.equal((await runtimeRepository.commitBootstrapState({
      scope: fixture.scope,
      lease: a0Lease,
      expected: {
        active_lineage_ref: null,
        checkpoint_ref: null,
        state_ref: null,
        forecast_result_ref: null,
        successful_forecast_ref: null,
      },
      record_set: fixture.a0RecordSet,
    })).status, "INSERTED");
    assert.equal((await runtimeRepository.commitRuntimeConfig(fixture.continuationRuntimeConfig)).status, "INSERTED");
    ok("real A0 predecessor, immutable authority snapshot, and pinned continuation Runtime Config are persisted once");

    const evidenceSource: ReplayEvidenceSourcePortV1 = {
      async loadCandidateRecords() { return structuredClone(fixture.candidateRecords); },
    };
    const handoffService = new PrepareNextTickInputServiceV1(nextTickRepository);
    const tickService = new ContinuationTickServiceV1(
      handoffService,
      evidenceSource,
      runtimeRepository,
      runtimeRepository,
    );
    const rangeService = new ContiguousContinuationRangeServiceV1(handoffService, tickService);
    const request = {
      scope: fixture.scope,
      to_logical_time: fixture.expectedFixture.last_logical_time,
      created_at: fixture.expectedFixture.created_at,
      continuation_runtime_config_ref: fixture.continuationRuntimeConfig.object_id,
      crop_stage_context_ref: fixture.evidenceFixture.crop_stage_context_ref,
      crop_stage_context_hash: fixture.evidenceFixture.crop_stage_context_hash,
      crop_stage_context: fixture.cropStageContext,
      lease_owner: LEASE_OWNER,
      lease_duration_seconds: 3600,
    };

    const inserted = await rangeService.runContiguousContinuationRange(request);
    assert.equal(inserted.status, "COMPLETED");
    assert.equal(inserted.executed_tick_count, expected.continuation_tick_count);
    assert.equal(inserted.tick_results.length, expected.continuation_tick_count);
    ok("production range path completes exactly 24 contiguous single-tick executions through independent A2 transactions");

    const firstState = memberV1(inserted.tick_results[0].record_set.members, "twin_state_estimate_v1");
    const lineageId = firstState.lineage_id;
    const revisionId = firstState.revision_id;
    assert.equal(await scopedContinuationFactCountV1(lineageId, revisionId), expected.a2_fact_count);
    const guards = await pool.query(
      "SELECT count(*)::int AS count FROM twin_object_idempotency_index_v1 WHERE identity_kind='A2_RECORD_SET'",
    );
    assert.equal(guards.rows[0].count, expected.continuation_tick_count);
    const typeCounts = await pool.query(
      `SELECT record_json->>'type' AS object_type, count(*)::int AS count
         FROM facts
        WHERE record_json->>'type'=ANY($1::text[])
          AND record_json->'payload'->>'lineage_id'=$2
          AND record_json->'payload'->>'revision_id'=$3
          AND record_json->'payload'->>'logical_time' >= '2026-06-01T02:00:00.000Z'
          AND record_json->'payload'->>'logical_time' <= '2026-06-02T01:00:00.000Z'
        GROUP BY record_json->>'type'`,
      [CONTINUATION_TYPES, lineageId, revisionId],
    );
    assert.equal(typeCounts.rows.length, 8);
    for (const row of typeCounts.rows) assert.equal(row.count, 24, row.object_type);
    ok("the scoped lineage contains exactly 192 A2 facts, 24 guards, and 24 canonical objects of each continuation member type");

    const stateHistory = await pool.query(
      "SELECT count(*)::int AS count FROM twin_state_history_projection_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND lineage_id=$7 AND revision_id=$8",
      [...scopeValuesV1(fixture.scope), lineageId, revisionId],
    );
    assert.equal(stateHistory.rows[0].count, expected.state_history_count);
    const continuationStates = await pool.query(
      `SELECT record_json->'payload' AS object
         FROM facts
        WHERE record_json->>'type'='twin_state_estimate_v1'
          AND record_json->'payload'->>'lineage_id'=$1
          AND record_json->'payload'->>'revision_id'=$2
          AND record_json->'payload'->>'logical_time' >= '2026-06-01T02:00:00.000Z'
          AND record_json->'payload'->>'logical_time' <= '2026-06-02T01:00:00.000Z'
        ORDER BY record_json->'payload'->>'logical_time'`,
      [lineageId, revisionId],
    );
    assert.equal(continuationStates.rows.length, 24);
    let previousVariance = -1n;
    for (let index = 0; index < continuationStates.rows.length; index += 1) {
      const object = continuationStates.rows[index].object as CanonicalObjectEnvelopeV1;
      assert.equal(object.logical_time, new Date(Date.parse(fixture.expectedFixture.first_logical_time) + index * 3600000).toISOString());
      const basis = object.payload.computation_basis as Record<string, unknown>;
      const value = ((basis.storage_variance_mm2_decimal as Record<string, unknown>).value as string).replace(".", "");
      const variance = BigInt(value);
      assert.ok(variance > previousVariance);
      previousVariance = variance;
    }
    ok("PostgreSQL readback proves one bootstrap plus 24 continuation State history rows with strictly hourly time and strictly increasing uncertainty");

    const finalResult = inserted.tick_results[23];
    const finalState = memberV1(finalResult.record_set.members, "twin_state_estimate_v1");
    const finalCheckpoint = memberV1(finalResult.record_set.members, "twin_runtime_checkpoint_v1");
    const finalForecast = memberV1(finalResult.record_set.members, "twin_forecast_run_v1");
    const finalBasis = finalState.payload.computation_basis as Record<string, unknown>;
    const finalVwc = finalState.payload.root_zone_vwc_fraction as Record<string, unknown>;
    assert.equal(finalState.logical_time, fixture.expectedFixture.last_logical_time);
    assert.equal((finalBasis.storage_mean_mm_decimal as Record<string, unknown>).value, expected.final_storage_mean_mm);
    assert.equal((finalBasis.storage_variance_mm2_decimal as Record<string, unknown>).value, expected.final_storage_variance_mm2);
    assert.equal(finalVwc.mean, Number(expected.final_vwc_mean));
    assert.equal(finalVwc.variance, Number(expected.final_vwc_variance));
    assert.equal(finalState.payload.available_water_fraction, Number(expected.final_available_water_fraction));
    assert.equal(finalState.payload.depletion_from_field_capacity_mm, Number(expected.final_depletion_from_field_capacity_mm));
    assert.equal(finalCheckpoint.payload.tick_sequence, expected.checkpoint_tick_sequence);
    assert.equal(finalCheckpoint.payload.next_tick_logical_time, fixture.expectedFixture.next_logical_time);
    assert.equal(finalForecast.payload.status, "BLOCKED");
    assert.equal(inserted.final_handoff.previous_posterior_ref, finalState.object_id);
    assert.equal(inserted.final_handoff.previous_checkpoint_ref, finalCheckpoint.object_id);
    assert.equal(inserted.final_handoff.next_logical_tick_time, fixture.expectedFixture.next_logical_time);
    ok("tick 24 canonical readback and latest projections match the frozen final State, BLOCKED Forecast, sequence 24 checkpoint, and T+1 handoff");

    const successful = await pool.query(
      "SELECT count(*)::int AS count FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeValuesV1(fixture.scope),
    );
    assert.equal(successful.rows[0].count, 0);
    const stateLatest = await pool.query(
      "SELECT state_object_id FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeValuesV1(fixture.scope),
    );
    const checkpointLatest = await pool.query(
      "SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeValuesV1(fixture.scope),
    );
    assert.equal(stateLatest.rows[0].state_object_id, finalState.object_id);
    assert.equal(checkpointLatest.rows[0].checkpoint_object_id, finalCheckpoint.object_id);
    ok("latest State and checkpoint projections point to tick 24 while successful-Forecast latest remains absent");

    const tokenBeforeReplay = await leaseTokenV1(fixture.scope);
    const factCountBeforeReplay = await scopedContinuationFactCountV1(lineageId, revisionId);
    const replay = await rangeService.runContiguousContinuationRange(request);
    assert.equal(replay.status, "ALREADY_COMPLETE");
    assert.equal(replay.executed_tick_count, 0);
    assert.equal(await leaseTokenV1(fixture.scope), tokenBeforeReplay);
    assert.equal(await scopedContinuationFactCountV1(lineageId, revisionId), factCountBeforeReplay);
    const guardsAfterReplay = await pool.query(
      "SELECT count(*)::int AS count FROM twin_object_idempotency_index_v1 WHERE identity_kind='A2_RECORD_SET'",
    );
    assert.equal(guardsAfterReplay.rows[0].count, expected.continuation_tick_count);
    ok("repeating the completed target range performs zero new ticks and does not renew the lease or duplicate facts, guards, or projections");

    console.log(`MCFT-CAP-02 twenty-four-tick range DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
