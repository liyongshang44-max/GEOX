// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_SINGLE_TICK_INTEGRATION_DB.ts
// Purpose: prove the CAP-03 S4 service executes one persisted predecessor handoff through observation-aware A2 commit, canonical readback, T+1 handoff, and idempotent PostgreSQL replay.
// Boundary: destructive isolated-database acceptance only; no production database, range, restart/backfill, route, scheduler, successful Forecast, Recommendation, Decision, or action.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { PostgresAssimilatedRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { AssimilatedContinuationTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type {
  ContinuationExpectedPointersV1,
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildMcftCap03SingleTickIntegrationFixtureV1,
  memberV1,
} from "./mcft_cap_03_single_tick_integration_fixture_v1.js";

if (process.env.MCFT_CAP_03_S4_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_03_S4_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap03|s4|single.?tick|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresAssimilatedRuntimeRepositoryV1(pool);
const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
const projectionTables = [
  "twin_active_lineage_index_v1",
  "twin_state_history_projection_v1",
  "twin_state_latest_index_v1",
  "twin_forecast_result_latest_index_v1",
  "twin_runtime_checkpoint_latest_index_v1",
  "twin_runtime_health_latest_index_v1",
] as const;
let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}
function readSqlV1(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}
function scopeParamsV1(scope: TwinScopeKeyV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}
function factIdV1(objectId: string): string {
  return `fact_${objectId}`;
}
function recordJsonV1(object: CanonicalObjectEnvelopeV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}
async function initializeSchemaV1(): Promise<void> {
  await pool.query(readSqlV1("docker/postgres/init/001_schema.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql"));
  const migrations = fs.readdirSync(path.join(ROOT, "apps/server/db/migrations"));
  assert.equal(migrations.some((name) => /cap_03.*single|single.*tick.*migration/i.test(name)), false);
  ok("existing A0 and A2 schema is sufficient for S4 single-tick integration");
}
async function cleanupScopeV1(input: {
  scope: TwinScopeKeyV1;
  objectIds: string[];
  runtimeConfigIds: string[];
  runtimeConfigKeys: string[];
  recordSetIds: string[];
  realityBindingRef: string;
}): Promise<void> {
  const params = scopeParamsV1(input.scope);
  for (const table of projectionTables) {
    await pool.query(
      `DELETE FROM ${table} WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      params,
    );
  }
  await pool.query(
    "DELETE FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    params,
  );
  await pool.query(
    "DELETE FROM twin_object_idempotency_index_v1 WHERE record_set_id=ANY($1::text[])",
    [input.recordSetIds],
  );
  await pool.query(
    "DELETE FROM twin_object_idempotency_index_v1 WHERE idempotency_key=ANY($1::text[])",
    [input.runtimeConfigKeys],
  );
  await pool.query(
    "DELETE FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])",
    [[...input.objectIds, ...input.runtimeConfigIds]],
  );
  await pool.query(
    "DELETE FROM twin_runtime_authority_snapshot_v1 WHERE authority_ref=$1",
    [input.realityBindingRef],
  );
  await pool.query(
    "DELETE FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    params,
  );
}
async function acquireLeaseV1(scope: TwinScopeKeyV1, owner: string): Promise<RuntimeLeaseClaimV1> {
  return repository.acquireLease({
    ...scope,
    lease_owner: owner,
    lease_duration_seconds: 300,
  });
}
async function seedCap02FinalHandoffV1(input: {
  scope: TwinScopeKeyV1;
  state: CanonicalObjectEnvelopeV1;
  checkpoint: CanonicalObjectEnvelopeV1;
  forecast: CanonicalObjectEnvelopeV1;
}): Promise<void> {
  for (const object of [input.state, input.forecast, input.checkpoint]) {
    await pool.query(
      "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,'system',$3::jsonb) ON CONFLICT (fact_id) DO UPDATE SET record_json=EXCLUDED.record_json",
      [factIdV1(object.object_id), object.logical_time, recordJsonV1(object)],
    );
  }
  const params = scopeParamsV1(input.scope);
  await pool.query(
    `INSERT INTO twin_state_history_projection_v1
       (state_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,determinism_hash,canonical_payload,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12::jsonb,$13)
     ON CONFLICT (state_object_id) DO UPDATE SET determinism_hash=EXCLUDED.determinism_hash,canonical_payload=EXCLUDED.canonical_payload,source_fact_id=EXCLUDED.source_fact_id`,
    [
      input.state.object_id,
      ...params,
      input.state.lineage_id,
      input.state.revision_id,
      input.state.logical_time,
      input.state.determinism_hash,
      JSON.stringify(input.state),
      factIdV1(input.state.object_id),
    ],
  );
  await pool.query(
    `UPDATE twin_state_latest_index_v1 SET state_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,determinism_hash=$11,source_fact_id=$12
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...params, input.state.object_id, input.state.lineage_id, input.state.revision_id, input.state.logical_time, input.state.determinism_hash, factIdV1(input.state.object_id)],
  );
  await pool.query(
    `UPDATE twin_forecast_result_latest_index_v1 SET forecast_object_id=$7,forecast_status=$8,logical_time=$9::timestamptz,determinism_hash=$10,source_fact_id=$11
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...params, input.forecast.object_id, input.forecast.payload.status, input.forecast.logical_time, input.forecast.determinism_hash, factIdV1(input.forecast.object_id)],
  );
  await pool.query(
    `UPDATE twin_runtime_checkpoint_latest_index_v1 SET checkpoint_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,determinism_hash=$11,source_fact_id=$12
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...params, input.checkpoint.object_id, input.checkpoint.lineage_id, input.checkpoint.revision_id, input.checkpoint.logical_time, input.checkpoint.determinism_hash, factIdV1(input.checkpoint.object_id)],
  );
}
async function factCountV1(objectIds: string[]): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])",
    [objectIds],
  );
  return result.rows[0].count as number;
}
async function guardCountV1(recordSetId: string): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM twin_object_idempotency_index_v1 WHERE identity_kind='A2_RECORD_SET' AND record_set_id=$1",
    [recordSetId],
  );
  return result.rows[0].count as number;
}
async function fencingTokenV1(scope: TwinScopeKeyV1): Promise<bigint> {
  const result = await pool.query(
    "SELECT fencing_token FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    scopeParamsV1(scope),
  );
  return BigInt(result.rows[0].fencing_token);
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap03SingleTickIntegrationFixtureV1();
  const scope = fixture.scope;
  const a0Ids = fixture.a0RecordSet.members.map((member) => member.object_id);
  const cap02Ids = fixture.continuationRecordSet.members.map((member) => member.object_id);
  const predecessorIds = [
    fixture.predecessorState.object_id,
    fixture.predecessorCheckpoint.object_id,
    fixture.predecessorForecast.object_id,
  ];
  const expectedS4Ids = fixture.recordSet.members.map((member) => member.object_id);
  const a0Lineage = memberV1(fixture.a0RecordSet, "twin_runtime_lineage_v1");
  const a0State = memberV1(fixture.a0RecordSet, "twin_state_estimate_v1");
  const a0Checkpoint = memberV1(fixture.a0RecordSet, "twin_runtime_checkpoint_v1");
  const a0Forecast = memberV1(fixture.a0RecordSet, "twin_forecast_run_v1");
  const cap02Expected: ContinuationExpectedPointersV1 = {
    active_lineage_ref: a0Lineage.object_id,
    lineage_id: fixture.lock.lineage_id,
    revision_id: fixture.lock.revision_id,
    previous_checkpoint_ref: a0Checkpoint.object_id,
    previous_state_ref: a0State.object_id,
    previous_forecast_result_ref: a0Forecast.object_id,
    latest_successful_forecast_ref: null,
  };

  try {
    await initializeSchemaV1();
    await cleanupScopeV1({
      scope,
      objectIds: [...a0Ids, ...cap02Ids, ...predecessorIds, ...expectedS4Ids],
      runtimeConfigIds: [
        fixture.parentRuntimeConfig.object_id,
        fixture.continuationRuntimeConfig.object_id,
        fixture.assimilatedRuntimeConfig.object_id,
      ],
      runtimeConfigKeys: [
        fixture.parentRuntimeConfig.idempotency_key,
        fixture.continuationRuntimeConfig.idempotency_key,
        fixture.assimilatedRuntimeConfig.idempotency_key,
      ],
      recordSetIds: [
        fixture.a0RecordSet.a0_record_set_id,
        fixture.continuationRecordSet.continuation_record_set_id,
        fixture.recordSet.continuation_record_set_id,
      ],
      realityBindingRef: fixture.realityBindingSnapshot.binding_id,
    });

    await repository.commitRuntimeConfig(fixture.parentRuntimeConfig);
    const a0Lease = await acquireLeaseV1(scope, "mcft-cap-03-s4-a0");
    await repository.commitBootstrapState({
      scope,
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
    await repository.commitRuntimeConfig(fixture.continuationRuntimeConfig);
    const cap02Lease = await acquireLeaseV1(scope, "mcft-cap-03-s4-cap02");
    await repository.commitContinuationState({
      scope,
      lease: cap02Lease,
      expected: cap02Expected,
      record_set: fixture.continuationRecordSet,
    });
    await seedCap02FinalHandoffV1({
      scope,
      state: fixture.predecessorState,
      checkpoint: fixture.predecessorCheckpoint,
      forecast: fixture.predecessorForecast,
    });
    await repository.commitRuntimeConfig(fixture.assimilatedRuntimeConfig);
    await nextTickRepository.commitRealityBindingSnapshot(fixture.realityBindingSnapshot);
    ok("isolated PostgreSQL reproduces the frozen CAP-02 sequence-24 predecessor authority");

    const handoffBefore = await new PrepareNextTickInputServiceV1(nextTickRepository)
      .prepareNextTickInput(scope);
    assert.equal(handoffBefore.previous_tick_sequence, 24);
    assert.equal(handoffBefore.next_logical_tick_time, fixture.logicalTime);
    assert.equal(
      handoffBefore.previous_forecast_result_hash,
      fixture.predecessorForecast.determinism_hash,
    );
    ok("PostgreSQL next-tick readback carries canonical predecessor Forecast ref and hash");

    const evidenceSource = {
      async loadCandidateRecords() {
        return structuredClone(fixture.candidateRecords);
      },
    };
    const service = new AssimilatedContinuationTickServiceV1(
      new PrepareNextTickInputServiceV1(nextTickRepository),
      evidenceSource,
      repository,
      repository,
    );
    const input = {
      scope,
      logical_time: fixture.logicalTime,
      created_at: fixture.createdAt,
      assimilated_runtime_config_ref: fixture.assimilatedRuntimeConfig.object_id,
      crop_stage_context: fixture.cropStageContext,
      lease_owner: "mcft-cap-03-s4-service",
      lease_duration_seconds: 300,
    };
    const inserted = await service.executeOneTick(input);
    assert.equal(inserted.status, "INSERTED");
    assert.equal(inserted.record_set.members.length, 8);
    assert.equal(await factCountV1(inserted.record_set.members.map((member) => member.object_id)), 8);
    assert.equal(await guardCountV1(inserted.record_set.continuation_record_set_id), 1);
    ok("service atomically commits exactly eight CAP-03 facts and one A2 idempotency guard");

    const checkpoint = memberV1(inserted.record_set, "twin_runtime_checkpoint_v1");
    const forecast = memberV1(inserted.record_set, "twin_forecast_run_v1");
    assert.equal(checkpoint.payload.tick_sequence, 25);
    assert.equal(checkpoint.payload.next_tick_logical_time, fixture.nextLogicalTime);
    assert.equal(forecast.payload.status, "BLOCKED");
    assert.equal(forecast.payload.successful_forecast_ref, null);
    assert.equal(inserted.next_handoff.previous_tick_sequence, 25);
    assert.equal(inserted.next_handoff.next_logical_tick_time, fixture.nextLogicalTime);
    assert.equal(inserted.next_handoff.previous_forecast_result_hash, forecast.determinism_hash);
    ok("canonical readback advances checkpoint 25 and prepares the exact 03:00 handoff");

    const tokenBeforeReplay = await fencingTokenV1(scope);
    const replay = await service.executeOneTick(input);
    const tokenAfterReplay = await fencingTokenV1(scope);
    assert.equal(replay.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(
      replay.record_set.continuation_record_set_determinism_hash,
      inserted.record_set.continuation_record_set_determinism_hash,
    );
    assert.equal(tokenAfterReplay, tokenBeforeReplay);
    assert.equal(await factCountV1(inserted.record_set.members.map((member) => member.object_id)), 8);
    assert.equal(await guardCountV1(inserted.record_set.continuation_record_set_id), 1);
    ok("same tick replay returns existing success before a new lease or canonical write");

    const successPointer = await pool.query(
      "SELECT count(*)::int AS count FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeParamsV1(scope),
    );
    assert.equal(successPointer.rows[0].count, 0);
    ok("single-tick integration preserves the no-successful-Forecast boundary");

    console.log(`MCFT-CAP-03 single-tick integration DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
