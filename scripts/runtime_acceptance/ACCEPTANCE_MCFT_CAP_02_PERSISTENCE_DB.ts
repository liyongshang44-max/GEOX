// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE_DB.ts
// Purpose: prove the existing PostgreSQL Runtime persistence family atomically commits, idempotently replays, rebuilds, and uniqueness-guards one MCFT-CAP-02 A2 continuation record set after a real A0 predecessor.
// Boundary: destructive isolated-database acceptance only; no candidate construction in production, tick orchestration, range, restart, successful Forecast, route, scheduler, or production claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { PostgresProjectionRebuilderV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_projection_rebuilder_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import type {
  ContinuationExpectedPointersV1,
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildMcftCap02PersistenceFixtureV1 } from "./mcft_cap_02_persistence_fixture_v1.js";

if (process.env.MCFT_CAP_02_PERSISTENCE_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_02_PERSISTENCE_DESTRUCTIVE_ACCEPTANCE_1");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap02|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ACCEPTANCE_LEASE_OWNER = "mcft-cap-02-persistence-db-acceptance";
const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresRuntimeRepositoryV1(pool);
const a0Rebuilder = new PostgresProjectionRebuilderV1(pool);
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
  return [
    scope.tenant_id,
    scope.project_id,
    scope.group_id,
    scope.field_id,
    scope.season_id,
    scope.zone_id,
  ];
}

function memberV1(
  recordSet: {
    members: Array<{
      object_type: string;
      object_id: string;
      determinism_hash: string;
      lineage_id?: string;
      revision_id?: string;
      payload: Record<string, unknown>;
    }>;
  },
  objectType: string,
) {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  assert.equal(matches.length, 1);
  return matches[0];
}

async function initializeSchemaV1(): Promise<void> {
  await pool.query(readSqlV1("docker/postgres/init/001_schema.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql"));

  const constraint = await pool.query(
    "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.twin_object_idempotency_index_v1'::regclass AND conname='twin_object_idempotency_index_v1_identity_kind_check'",
  );
  assert.equal(constraint.rows.length, 1);
  assert.match(constraint.rows[0].definition, /A2_RECORD_SET/);
  ok("isolated PostgreSQL schema reuses the A0 family and admits A2_RECORD_SET identity");
}

async function cleanupScopeV1(input: {
  scope: TwinScopeKeyV1;
  memberObjectIds: string[];
  runtimeConfigObjectIds: string[];
  runtimeConfigKeys: string[];
  recordSetIds: string[];
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
    [[...input.memberObjectIds, ...input.runtimeConfigObjectIds]],
  );
  await pool.query(
    "DELETE FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    params,
  );
}

async function countFactsV1(objectIds: string[]): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])",
    [objectIds],
  );
  return result.rows[0].count as number;
}

async function countA2GuardsV1(recordSetId: string): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM twin_object_idempotency_index_v1 WHERE identity_kind='A2_RECORD_SET' AND record_set_id=$1",
    [recordSetId],
  );
  return result.rows[0].count as number;
}

async function stateHistoryCountV1(scope: TwinScopeKeyV1): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM twin_state_history_projection_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    scopeParamsV1(scope),
  );
  return result.rows[0].count as number;
}

async function successfulForecastCountV1(scope: TwinScopeKeyV1): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    scopeParamsV1(scope),
  );
  return result.rows[0].count as number;
}

async function leaseTokenV1(scope: TwinScopeKeyV1): Promise<bigint | null> {
  const result = await pool.query(
    "SELECT fencing_token FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    scopeParamsV1(scope),
  );
  return result.rows.length ? BigInt(result.rows[0].fencing_token) : null;
}

async function acquireAcceptanceLeaseV1(scope: TwinScopeKeyV1): Promise<RuntimeLeaseClaimV1> {
  return repository.acquireLease({
    ...scope,
    lease_owner: ACCEPTANCE_LEASE_OWNER,
    lease_duration_seconds: 300,
  });
}

async function assertZeroA2WritesV1(
  scope: TwinScopeKeyV1,
  a2Ids: string[],
  a2RecordSetId: string,
): Promise<void> {
  assert.equal(await countFactsV1(a2Ids), 0);
  assert.equal(await countA2GuardsV1(a2RecordSetId), 0);
  assert.equal(await stateHistoryCountV1(scope), 1);
  assert.equal(await successfulForecastCountV1(scope), 0);
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap02PersistenceFixtureV1();
  const scope = fixture.scope;
  const a0Ids = fixture.a0RecordSet.members.map((member) => member.object_id);
  const a2Ids = fixture.continuationRecordSet.members.map((member) => member.object_id);
  const allIds = [...a0Ids, ...a2Ids];
  const a0State = memberV1(fixture.a0RecordSet, "twin_state_estimate_v1");
  const a0Checkpoint = memberV1(fixture.a0RecordSet, "twin_runtime_checkpoint_v1");
  const a0Forecast = memberV1(fixture.a0RecordSet, "twin_forecast_run_v1");
  const a0Lineage = memberV1(fixture.a0RecordSet, "twin_runtime_lineage_v1");
  const a2State = memberV1(fixture.continuationRecordSet, "twin_state_estimate_v1");
  const a2Checkpoint = memberV1(fixture.continuationRecordSet, "twin_runtime_checkpoint_v1");
  const a2Forecast = memberV1(fixture.continuationRecordSet, "twin_forecast_run_v1");
  const expected: ContinuationExpectedPointersV1 = {
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
      memberObjectIds: allIds,
      runtimeConfigObjectIds: [
        fixture.parentRuntimeConfig.object_id,
        fixture.continuationRuntimeConfig.object_id,
      ],
      runtimeConfigKeys: [
        fixture.parentRuntimeConfig.idempotency_key,
        fixture.continuationRuntimeConfig.idempotency_key,
      ],
      recordSetIds: [
        fixture.a0RecordSet.a0_record_set_id,
        fixture.continuationRecordSet.continuation_record_set_id,
      ],
    });

    const parentConfigCommit = await repository.commitRuntimeConfig(fixture.parentRuntimeConfig);
    assert.equal(parentConfigCommit.status, "INSERTED");
    const a0Lease = await acquireAcceptanceLeaseV1(scope);
    const a0Commit = await repository.commitBootstrapState({
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
    assert.equal(a0Commit.status, "INSERTED");
    assert.equal(await countFactsV1(a0Ids), 9);
    assert.equal(await stateHistoryCountV1(scope), 1);
    assert.equal(a0Lineage.object_id, fixture.lock.active_lineage_object_ref);
    assert.equal(a0State.object_id, fixture.lock.bootstrap_state_ref);
    assert.equal(a0Checkpoint.object_id, fixture.lock.bootstrap_checkpoint_ref);
    ok("real A0 predecessor is committed through the existing fenced A0 transaction and matches the predecessor lock");

    const continuationConfigCommit = await repository.commitRuntimeConfig(
      fixture.continuationRuntimeConfig,
    );
    assert.equal(continuationConfigCommit.status, "INSERTED");
    const continuationConfigReadback = await repository.readRuntimeConfig(
      fixture.continuationRuntimeConfig.object_id,
    );
    assert.ok(continuationConfigReadback);
    assert.equal(
      continuationConfigReadback.determinism_hash,
      fixture.continuationRuntimeConfig.determinism_hash,
    );
    ok("continuation Runtime Config is canonically persisted before A2 acceptance");

    const faultStages = fixture.continuationRecordSet.members
      .map((member, index) => `before_fact_${index + 1}_${member.object_type}`)
      .concat([
        "before_state_history_projection",
        "before_state_latest_projection",
        "before_forecast_result_projection",
        "before_checkpoint_projection",
        "before_health_projection",
        "before_idempotency_index",
        "before_commit",
      ]);
    assert.equal(faultStages.length, 15);
    for (const stage of faultStages) {
      const lease = await acquireAcceptanceLeaseV1(scope);
      await assert.rejects(
        repository.commitContinuationState({
          scope,
          lease,
          expected,
          record_set: fixture.continuationRecordSet,
          fault_injection: (current) => {
            if (current === stage) throw new Error(`FAULT:${stage}`);
          },
        }),
        new RegExp(`FAULT:${stage}`),
      );
      await assertZeroA2WritesV1(
        scope,
        a2Ids,
        fixture.continuationRecordSet.continuation_record_set_id,
      );
    }
    ok("all fifteen A2 fault-injection stages roll back facts, projections, and idempotency guard");

    const staleLease = await acquireAcceptanceLeaseV1(scope);
    await acquireAcceptanceLeaseV1(scope);
    await assert.rejects(
      repository.commitContinuationState({
        scope,
        lease: staleLease,
        expected,
        record_set: fixture.continuationRecordSet,
      }),
      /STALE_FENCING_TOKEN/,
    );
    await assertZeroA2WritesV1(
      scope,
      a2Ids,
      fixture.continuationRecordSet.continuation_record_set_id,
    );
    ok("stale fencing token rejects A2 before any continuation write");

    const ownerLease = await acquireAcceptanceLeaseV1(scope);
    const foreignOwnerLease: RuntimeLeaseClaimV1 = {
      ...ownerLease,
      lease_owner: "mcft-cap-02-persistence-foreign-owner",
    };
    await assert.rejects(
      repository.commitContinuationState({
        scope,
        lease: foreignOwnerLease,
        expected,
        record_set: fixture.continuationRecordSet,
      }),
      /LEASE_OWNER_MISMATCH/,
    );
    await assertZeroA2WritesV1(
      scope,
      a2Ids,
      fixture.continuationRecordSet.continuation_record_set_id,
    );
    ok("foreign lease-owner claim rejects A2 without attempting lease takeover");

    const expiredLease = await acquireAcceptanceLeaseV1(scope);
    await pool.query(
      "UPDATE twin_runtime_lease_v1 SET expires_at=transaction_timestamp()-interval '1 second' WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeParamsV1(scope),
    );
    await assert.rejects(
      repository.commitContinuationState({
        scope,
        lease: expiredLease,
        expected,
        record_set: fixture.continuationRecordSet,
      }),
      /LEASE_EXPIRED/,
    );
    await assertZeroA2WritesV1(
      scope,
      a2Ids,
      fixture.continuationRecordSet.continuation_record_set_id,
    );
    ok("expired lease rejects A2 before any continuation write");

    const authorityCases: Array<{
      name: string;
      expectedPointers: ContinuationExpectedPointersV1;
      error: RegExp;
    }> = [
      {
        name: "active lineage object ref",
        expectedPointers: { ...expected, active_lineage_ref: "lineage_wrong" },
        error: /ACTIVE_LINEAGE_OBJECT_REF_MISMATCH/,
      },
      {
        name: "lineage id",
        expectedPointers: { ...expected, lineage_id: "lineage_id_wrong" },
        error: /ACTIVE_LINEAGE_ID_MISMATCH/,
      },
      {
        name: "revision id",
        expectedPointers: { ...expected, revision_id: "revision_wrong" },
        error: /LINEAGE_REVISION_MISMATCH/,
      },
      {
        name: "checkpoint pointer",
        expectedPointers: { ...expected, previous_checkpoint_ref: "checkpoint_wrong" },
        error: /CHECKPOINT_CAS_CONFLICT/,
      },
      {
        name: "state pointer",
        expectedPointers: { ...expected, previous_state_ref: "state_wrong" },
        error: /STATE_LATEST_CAS_CONFLICT/,
      },
      {
        name: "forecast pointer",
        expectedPointers: { ...expected, previous_forecast_result_ref: "forecast_wrong" },
        error: /FORECAST_RESULT_CAS_CONFLICT/,
      },
      {
        name: "successful Forecast pointer",
        expectedPointers: {
          ...expected,
          latest_successful_forecast_ref: "forecast_success_wrong",
        } as unknown as ContinuationExpectedPointersV1,
        error: /SUCCESSFUL_FORECAST_POINTER_UNEXPECTED/,
      },
    ];

    for (const authorityCase of authorityCases) {
      const lease = await acquireAcceptanceLeaseV1(scope);
      await assert.rejects(
        repository.commitContinuationState({
          scope,
          lease,
          expected: authorityCase.expectedPointers,
          record_set: fixture.continuationRecordSet,
        }),
        authorityCase.error,
      );
      await assertZeroA2WritesV1(
        scope,
        a2Ids,
        fixture.continuationRecordSet.continuation_record_set_id,
      );
    }
    ok("lineage, revision, checkpoint, State, Forecast, and successful-Forecast authority mismatches all fail with zero A2 writes");

    const commitLease = await acquireAcceptanceLeaseV1(scope);
    const inserted = await repository.commitContinuationState({
      scope,
      lease: commitLease,
      expected,
      record_set: fixture.continuationRecordSet,
    });
    assert.equal(inserted.status, "INSERTED");
    assert.equal(
      inserted.record_set.continuation_record_set_determinism_hash,
      fixture.continuationRecordSet.continuation_record_set_determinism_hash,
    );
    assert.equal(await countFactsV1(a2Ids), 8);
    assert.equal(
      await countA2GuardsV1(fixture.continuationRecordSet.continuation_record_set_id),
      1,
    );
    assert.equal(await stateHistoryCountV1(scope), 2);
    assert.equal(await successfulForecastCountV1(scope), 0);
    ok("A2 atomically appends eight canonical facts, five projections, and one idempotency guard");

    const activeLineage = await pool.query(
      "SELECT active_lineage_ref FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeParamsV1(scope),
    );
    const stateLatest = await pool.query(
      "SELECT state_object_id FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeParamsV1(scope),
    );
    const forecastLatest = await pool.query(
      "SELECT forecast_object_id,forecast_status FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeParamsV1(scope),
    );
    const checkpointLatest = await pool.query(
      "SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeParamsV1(scope),
    );
    assert.equal(activeLineage.rows[0].active_lineage_ref, a0Lineage.object_id);
    assert.equal(stateLatest.rows[0].state_object_id, a2State.object_id);
    assert.equal(forecastLatest.rows[0].forecast_object_id, a2Forecast.object_id);
    assert.equal(forecastLatest.rows[0].forecast_status, "BLOCKED");
    assert.equal(checkpointLatest.rows[0].checkpoint_object_id, a2Checkpoint.object_id);
    ok("A2 advances State, Forecast-result, and checkpoint pointers while active lineage and successful Forecast remain unchanged");

    const tokenBeforeReplay = await leaseTokenV1(scope);
    const replay = await repository.commitContinuationState({
      scope,
      lease: staleLease,
      expected,
      record_set: fixture.continuationRecordSet,
    });
    assert.equal(replay.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(await leaseTokenV1(scope), tokenBeforeReplay);
    assert.equal(await countFactsV1(a2Ids), 8);
    assert.equal(await stateHistoryCountV1(scope), 2);
    ok("same key and hash returns existing A2 success before lease validation and without duplicate writes");

    await assert.rejects(
      repository.commitContinuationState({
        scope,
        lease: staleLease,
        expected,
        record_set: fixture.conflictingContinuationRecordSet,
      }),
      /IDEMPOTENCY_CONFLICT/,
    );
    assert.equal(await countFactsV1(a2Ids), 8);
    assert.equal(
      await countA2GuardsV1(fixture.continuationRecordSet.continuation_record_set_id),
      1,
    );
    ok("same A2 key with different aggregate hash fails idempotency before lease validation");

    await pool.query(
      "DELETE FROM twin_state_history_projection_v1 WHERE state_object_id=$1",
      [a2State.object_id],
    );
    for (const table of [
      "twin_state_latest_index_v1",
      "twin_forecast_result_latest_index_v1",
      "twin_runtime_checkpoint_latest_index_v1",
      "twin_runtime_health_latest_index_v1",
    ]) {
      await pool.query(
        `DELETE FROM ${table} WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
        scopeParamsV1(scope),
      );
    }
    const rebuilt = await repository.rebuildContinuationProjections(
      fixture.continuationRecordSet.continuation_record_set_id,
    );
    assert.equal(rebuilt.rebuilt_projection_count, 5);
    assert.equal(await stateHistoryCountV1(scope), 2);
    assert.equal(await successfulForecastCountV1(scope), 0);
    const activeAfterRebuild = await pool.query(
      "SELECT active_lineage_ref FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scopeParamsV1(scope),
    );
    assert.equal(activeAfterRebuild.rows[0].active_lineage_ref, a0Lineage.object_id);
    ok("canonical A2 readback rebuilds exactly five continuation projections without lineage or successful-Forecast mutation");

    await pool.query(
      "DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind='A2_RECORD_SET' AND record_set_id=$1",
      [fixture.continuationRecordSet.continuation_record_set_id],
    );
    const a0Rebuild = await a0Rebuilder.rebuildA0Projections(
      fixture.a0RecordSet.a0_record_set_id,
    );
    assert.equal(a0Rebuild.rebuilt_projection_count, 6);
    const uniquenessLease = await acquireAcceptanceLeaseV1(scope);
    await assert.rejects(
      repository.commitContinuationState({
        scope,
        lease: uniquenessLease,
        expected,
        record_set: fixture.continuationRecordSet,
      }),
      /CANONICAL_CONTINUATION_UNIQUENESS_CONFLICT/,
    );
    assert.equal(await countFactsV1(a2Ids), 8);
    assert.equal(
      await countA2GuardsV1(fixture.continuationRecordSet.continuation_record_set_id),
      0,
    );
    ok("canonical uniqueness rejects a duplicate terminal tick after A2 idempotency guard loss");

    const readbackAfterGuardLoss = await pool.query(
      "SELECT count(*)::int AS count FROM facts WHERE record_json->>'type'='twin_runtime_tick_v1' AND record_json->'payload'->>'logical_time'=$1 AND record_json->'payload'->'payload'->>'operation_variant'='A2_BLOCKED_FORECAST'",
      [fixture.continuationRecordSet.continuation_operation_key.logical_time],
    );
    assert.equal(readbackAfterGuardLoss.rows[0].count, 1);
    ok("guard-loss recovery leaves exactly one canonical A2 terminal tick");

    console.log(`MCFT-CAP-02 persistence DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
