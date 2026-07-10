// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK_DB.ts
// Purpose: prove the production MCFT-CAP-02 single-tick application path executes one standard continuation through real PostgreSQL A0 seed, consistent read, A2 transaction, canonical readback, idempotent replay, and next handoff.
// Boundary: destructive isolated-database acceptance only; no range, restart, backfill, scheduler, public route, Forecast success, Recommendation, or action.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { ContinuationTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type { ReplayEvidenceSourcePortV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildMcftCap02SingleTickFixtureV1 } from "./mcft_cap_02_single_tick_fixture_v1.js";

if (process.env.MCFT_CAP_02_SINGLE_TICK_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_02_SINGLE_TICK_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap02|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pool = new Pool({ connectionString: databaseUrl });
const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
const LEASE_OWNER = "mcft-cap-02-single-tick-db-acceptance";

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

async function countFactsV1(objectIds: string[]): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])",
    [objectIds],
  );
  return result.rows[0].count as number;
}

async function leaseTokenV1(scope: TwinScopeKeyV1): Promise<bigint> {
  const result = await pool.query(
    "SELECT fencing_token FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    scopeValuesV1(scope),
  );
  assert.equal(result.rows.length, 1);
  return BigInt(result.rows[0].fencing_token);
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap02SingleTickFixtureV1();
  try {
    await initializeAndResetV1();
    ok("isolated PostgreSQL schema is initialized with A0, authority snapshot, and A2 persistence families");

    const bindingCommit = await nextTickRepository.commitRealityBindingSnapshot(fixture.realityBindingSnapshot);
    assert.equal(bindingCommit.status, "INSERTED");
    const parentConfigCommit = await runtimeRepository.commitRuntimeConfig(fixture.parentRuntimeConfig);
    assert.equal(parentConfigCommit.status, "INSERTED");
    const a0Lease = await runtimeRepository.acquireLease({
      ...fixture.scope,
      lease_owner: LEASE_OWNER,
      lease_duration_seconds: 300,
    });
    const a0Commit = await runtimeRepository.commitBootstrapState({
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
    });
    assert.equal(a0Commit.status, "INSERTED");
    const continuationConfigCommit = await runtimeRepository.commitRuntimeConfig(fixture.continuationRuntimeConfig);
    assert.equal(continuationConfigCommit.status, "INSERTED");
    ok("real A0 predecessor, immutable authority snapshot, and pinned continuation Runtime Config are persisted");

    const evidenceSource: ReplayEvidenceSourcePortV1 = {
      async loadCandidateRecords() {
        return structuredClone(fixture.evidenceFixture.candidate_records);
      },
    };
    const handoffService = new PrepareNextTickInputServiceV1(nextTickRepository);
    const service = new ContinuationTickServiceV1(
      handoffService,
      evidenceSource,
      runtimeRepository,
      runtimeRepository,
    );
    const request = {
      scope: fixture.scope,
      logical_time: fixture.expectedFixture.logical_time,
      created_at: fixture.expectedFixture.created_at,
      continuation_runtime_config_ref: fixture.continuationRuntimeConfig.object_id,
      crop_stage_context_ref: fixture.evidenceFixture.crop_stage_context_ref,
      crop_stage_context_hash: fixture.evidenceFixture.crop_stage_context_hash,
      crop_stage_context: fixture.cropStageContext,
      lease_owner: LEASE_OWNER,
      lease_duration_seconds: 300,
    };

    const inserted = await service.executeOneTick(request);
    assert.equal(inserted.status, "INSERTED");
    assert.equal(inserted.record_set.members.length, 8);
    const a2Ids = inserted.record_set.members.map((member) => member.object_id);
    assert.equal(await countFactsV1(a2Ids), 8);
    const guard = await pool.query(
      "SELECT count(*)::int AS count FROM twin_object_idempotency_index_v1 WHERE identity_kind='A2_RECORD_SET' AND record_set_id=$1",
      [inserted.record_set.continuation_record_set_id],
    );
    assert.equal(guard.rows[0].count, 1);
    ok("production single-tick path atomically commits eight canonical A2 facts and one idempotency guard");

    const state = memberV1(inserted.record_set.members, "twin_state_estimate_v1");
    const checkpoint = memberV1(inserted.record_set.members, "twin_runtime_checkpoint_v1");
    const forecast = memberV1(inserted.record_set.members, "twin_forecast_run_v1");
    const stateLatest = await pool.query(
      "SELECT state_object_id FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeValuesV1(fixture.scope),
    );
    const checkpointLatest = await pool.query(
      "SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeValuesV1(fixture.scope),
    );
    const forecastLatest = await pool.query(
      "SELECT forecast_object_id,forecast_status FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeValuesV1(fixture.scope),
    );
    assert.equal(stateLatest.rows[0].state_object_id, state.object_id);
    assert.equal(checkpointLatest.rows[0].checkpoint_object_id, checkpoint.object_id);
    assert.equal(forecastLatest.rows[0].forecast_object_id, forecast.object_id);
    assert.equal(forecastLatest.rows[0].forecast_status, "BLOCKED");
    const successful = await pool.query(
      "SELECT count(*)::int AS count FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeValuesV1(fixture.scope),
    );
    assert.equal(successful.rows[0].count, 0);
    ok("State, checkpoint, and BLOCKED Forecast projections advance while successful-Forecast remains absent");

    assert.equal(inserted.next_handoff.previous_posterior_ref, state.object_id);
    assert.equal(inserted.next_handoff.previous_checkpoint_ref, checkpoint.object_id);
    assert.equal(inserted.next_handoff.previous_forecast_result_ref, forecast.object_id);
    assert.equal(inserted.next_handoff.next_logical_tick_time, "2026-06-01T03:00:00.000Z");
    assert.equal(inserted.next_handoff.previous_variance_basis.basis_origin, "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE");
    ok("canonical PostgreSQL readback reconstructs the exact next persisted handoff");

    const tokenBeforeReplay = await leaseTokenV1(fixture.scope);
    const factsBeforeReplay = await countFactsV1(a2Ids);
    const replay = await service.executeOneTick(request);
    assert.equal(replay.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(replay.record_set.continuation_record_set_determinism_hash, inserted.record_set.continuation_record_set_determinism_hash);
    assert.equal(await leaseTokenV1(fixture.scope), tokenBeforeReplay);
    assert.equal(await countFactsV1(a2Ids), factsBeforeReplay);
    const stateHistory = await pool.query(
      "SELECT count(*)::int AS count FROM twin_state_history_projection_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeValuesV1(fixture.scope),
    );
    assert.equal(stateHistory.rows[0].count, 2);
    ok("same requested single tick returns existing success before lease renewal and without duplicate facts or projections");

    console.log(`MCFT-CAP-02 single-tick DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
