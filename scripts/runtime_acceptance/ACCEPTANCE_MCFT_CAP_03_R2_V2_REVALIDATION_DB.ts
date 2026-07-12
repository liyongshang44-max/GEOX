// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION_DB.ts
// Purpose: prove the CAP-03 PostgreSQL A2 path atomically persists, reads back, idempotently replays, rebuilds, and uniqueness-guards one assimilated record set while preserving inherited historical CAP-02 behavior.
// Boundary: destructive isolated-database acceptance only; no production database, Runtime tick orchestration, range execution, route, scheduler, successful Forecast, Scenario, Recommendation, or action.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { PostgresAssimilatedRuntimeRepositoryV2 } from "../../apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.js";
import type {
  ContinuationExpectedPointersV1,
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildMcftCap03R2V2PersistenceFixtureV1 } from "./mcft_cap_03_r2_v2_revalidation_fixture_v1.js";

if (process.env.MCFT_CAP_03_R2_V2_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_03_R2_V2_DESTRUCTIVE_ACCEPTANCE_1");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap03|s3b|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LEASE_OWNER = "mcft-cap-03-r2-v2-db-acceptance";
const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresAssimilatedRuntimeRepositoryV2(pool);
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
  recordSet: { members: CanonicalObjectEnvelopeV1[] },
  objectType: CanonicalObjectEnvelopeV1["object_type"],
): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  assert.equal(matches.length, 1);
  return matches[0];
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
  assert.equal(
    migrations.some((name) => /cap_03.*persistence|assimilated.*persistence/i.test(name)),
    false,
  );
  ok("existing A0 and A2 schema is sufficient and CAP-03 requires zero migration");
}

async function cleanupScopeV1(input: {
  scope: TwinScopeKeyV1;
  objectIds: string[];
  runtimeConfigIds: string[];
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
    [[...input.objectIds, ...input.runtimeConfigIds]],
  );
  await pool.query(
    "DELETE FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    params,
  );
}

async function acquireLeaseV1(scope: TwinScopeKeyV1): Promise<RuntimeLeaseClaimV1> {
  return repository.acquireLease({
    ...scope,
    lease_owner: LEASE_OWNER,
    lease_duration_seconds: 300,
  });
}

async function countFactsV1(objectIds: string[]): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])",
    [objectIds],
  );
  return result.rows[0].count as number;
}

async function countGuardV1(recordSetId: string): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM twin_object_idempotency_index_v1 WHERE identity_kind='A2_RECORD_SET' AND record_set_id=$1",
    [recordSetId],
  );
  return result.rows[0].count as number;
}

async function latestPointersV1(scope: TwinScopeKeyV1): Promise<{
  state: string;
  checkpoint: string;
  forecast: string;
}> {
  const params = scopeParamsV1(scope);
  const [state, checkpoint, forecast] = await Promise.all([
    pool.query(
      "SELECT state_object_id FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      params,
    ),
    pool.query(
      "SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      params,
    ),
    pool.query(
      "SELECT forecast_object_id FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      params,
    ),
  ]);
  return {
    state: state.rows[0]?.state_object_id,
    checkpoint: checkpoint.rows[0]?.checkpoint_object_id,
    forecast: forecast.rows[0]?.forecast_object_id,
  };
}

async function seedCap02FinalHandoffV1(input: {
  scope: TwinScopeKeyV1;
  state: CanonicalObjectEnvelopeV1;
  checkpoint: CanonicalObjectEnvelopeV1;
  forecast: CanonicalObjectEnvelopeV1;
}): Promise<void> {
  for (const object of [input.state, input.forecast, input.checkpoint]) {
    await pool.query(
      "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,'system',$3::jsonb) ON CONFLICT (fact_id) DO NOTHING",
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
    [
      ...params,
      input.state.object_id,
      input.state.lineage_id,
      input.state.revision_id,
      input.state.logical_time,
      input.state.determinism_hash,
      factIdV1(input.state.object_id),
    ],
  );
  await pool.query(
    `UPDATE twin_forecast_result_latest_index_v1 SET forecast_object_id=$7,forecast_status=$8,logical_time=$9::timestamptz,determinism_hash=$10,source_fact_id=$11
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [
      ...params,
      input.forecast.object_id,
      input.forecast.payload.status,
      input.forecast.logical_time,
      input.forecast.determinism_hash,
      factIdV1(input.forecast.object_id),
    ],
  );
  await pool.query(
    `UPDATE twin_runtime_checkpoint_latest_index_v1 SET checkpoint_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,determinism_hash=$11,source_fact_id=$12
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [
      ...params,
      input.checkpoint.object_id,
      input.checkpoint.lineage_id,
      input.checkpoint.revision_id,
      input.checkpoint.logical_time,
      input.checkpoint.determinism_hash,
      factIdV1(input.checkpoint.object_id),
    ],
  );
}

async function assertZeroCap03WriteV1(input: {
  scope: TwinScopeKeyV1;
  objectIds: string[];
  recordSetId: string;
  expected: ContinuationExpectedPointersV1;
}): Promise<void> {
  assert.equal(await countFactsV1(input.objectIds), 0);
  assert.equal(await countGuardV1(input.recordSetId), 0);
  assert.deepEqual(await latestPointersV1(input.scope), {
    state: input.expected.previous_state_ref,
    checkpoint: input.expected.previous_checkpoint_ref,
    forecast: input.expected.previous_forecast_result_ref,
  });
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap03R2V2PersistenceFixtureV1();
  const scope = fixture.scope;
  const a0Ids = fixture.a0RecordSet.members.map((member) => member.object_id);
  const cap02Ids = fixture.continuationRecordSet.members.map((member) => member.object_id);
  const cap03Ids = fixture.recordSet.members.map((member) => member.object_id);
  const predecessorIds = [
    fixture.predecessorState.object_id,
    fixture.predecessorCheckpoint.object_id,
    fixture.predecessorForecast.object_id,
  ];
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
      objectIds: [...a0Ids, ...cap02Ids, ...cap03Ids, ...predecessorIds],
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
    });

    await repository.commitRuntimeConfig(fixture.parentRuntimeConfig);
    const a0Lease = await acquireLeaseV1(scope);
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
    ok("real A0 predecessor is committed through the existing fenced bootstrap transaction");

    await repository.commitRuntimeConfig(fixture.continuationRuntimeConfig);
    const cap02Lease = await acquireLeaseV1(scope);
    const cap02Commit = await repository.commitContinuationState({
      scope,
      lease: cap02Lease,
      expected: cap02Expected,
      record_set: fixture.continuationRecordSet,
    });
    assert.equal(cap02Commit.status, "INSERTED");
    const historicalReadback = await repository.readContinuationRecordSet(
      fixture.continuationRecordSet.continuation_record_set_id,
    );
    assert.ok(historicalReadback);
    assert.equal(
      historicalReadback.continuation_record_set_determinism_hash,
      fixture.continuationRecordSet.continuation_record_set_determinism_hash,
    );
    ok("historical CAP-02 A2 commit and canonical readback remain unchanged");

    await repository.commitRuntimeConfig(fixture.assimilatedRuntimeConfig);
    await seedCap02FinalHandoffV1({
      scope,
      state: fixture.predecessorState,
      checkpoint: fixture.predecessorCheckpoint,
      forecast: fixture.predecessorForecast,
    });
    assert.deepEqual(await latestPointersV1(scope), {
      state: fixture.expected.previous_state_ref,
      checkpoint: fixture.expected.previous_checkpoint_ref,
      forecast: fixture.expected.previous_forecast_result_ref,
    });
    ok("canonical pointers reproduce the frozen CAP-02 sequence-24 handoff");

    const faultStages = fixture.recordSet.members
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
      const lease = await acquireLeaseV1(scope);
      await assert.rejects(
        repository.commitAssimilatedContinuationState({
          scope,
          lease,
          expected: fixture.expected,
          record_set: fixture.recordSet,
          fault_injection: (current) => {
            if (current === stage) throw new Error(`FAULT:${stage}`);
          },
        }),
        new RegExp(`FAULT:${stage}`),
      );
      await assertZeroCap03WriteV1({
        scope,
        objectIds: cap03Ids,
        recordSetId: fixture.recordSet.continuation_record_set_id,
        expected: fixture.expected,
      });
    }
    ok("all fifteen CAP-03 A2 precommit fault stages roll back facts, projections, and guard");

    const staleLease = await acquireLeaseV1(scope);
    await acquireLeaseV1(scope);
    await assert.rejects(
      repository.commitAssimilatedContinuationState({
        scope,
        lease: staleLease,
        expected: fixture.expected,
        record_set: fixture.recordSet,
      }),
      /STALE_FENCING_TOKEN/,
    );
    await assertZeroCap03WriteV1({
      scope,
      objectIds: cap03Ids,
      recordSetId: fixture.recordSet.continuation_record_set_id,
      expected: fixture.expected,
    });
    ok("stale fencing rejects CAP-03 A2 with zero write");

    for (const [name, expected, error] of [
      [
        "state",
        { ...fixture.expected, previous_state_ref: "state_wrong" },
        /STATE_LATEST_CAS_CONFLICT/,
      ],
      [
        "checkpoint",
        { ...fixture.expected, previous_checkpoint_ref: "checkpoint_wrong" },
        /CHECKPOINT_CAS_CONFLICT/,
      ],
      [
        "forecast",
        { ...fixture.expected, previous_forecast_result_ref: "forecast_wrong" },
        /FORECAST_RESULT_CAS_CONFLICT/,
      ],
    ] as const) {
      const lease = await acquireLeaseV1(scope);
      await assert.rejects(
        repository.commitAssimilatedContinuationState({
          scope,
          lease,
          expected,
          record_set: fixture.recordSet,
        }),
        error,
      );
      await assertZeroCap03WriteV1({
        scope,
        objectIds: cap03Ids,
        recordSetId: fixture.recordSet.continuation_record_set_id,
        expected: fixture.expected,
      });
      assert.ok(name);
    }
    ok("State, checkpoint, and Forecast-result CAS conflicts all fail with zero write");

    const commitLease = await acquireLeaseV1(scope);
    const inserted = await repository.commitAssimilatedContinuationState({
      scope,
      lease: commitLease,
      expected: fixture.expected,
      record_set: fixture.recordSet,
    });
    assert.equal(inserted.status, "INSERTED");
    assert.equal(await countFactsV1(cap03Ids), 8);
    assert.equal(await countGuardV1(fixture.recordSet.continuation_record_set_id), 1);
    assert.equal(
      inserted.record_set.continuation_record_set_determinism_hash,
      fixture.recordSet.continuation_record_set_determinism_hash,
    );
    ok("existing A2 transaction family atomically appends eight CAP-03 facts, five projections, and one guard");

    const readback = await repository.readAssimilatedContinuationRecordSet(
      fixture.recordSet.continuation_record_set_id,
    );
    assert.ok(readback);
    assert.equal(readback.record_set_contract_id, "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2");
    assert.equal(
      readback.continuation_record_set_determinism_hash,
      fixture.recordSet.continuation_record_set_determinism_hash,
    );
    ok("CAP-03 canonical readback reconstructs the independent assimilated record-set type");

    const replay = await repository.commitAssimilatedContinuationState({
      scope,
      lease: staleLease,
      expected: fixture.expected,
      record_set: fixture.recordSet,
    });
    assert.equal(replay.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(await countFactsV1(cap03Ids), 8);
    ok("postcommit response-loss retry returns existing success before stale-lease validation");

    await assert.rejects(
      repository.commitAssimilatedContinuationState({
        scope,
        lease: staleLease,
        expected: fixture.expected,
        record_set: fixture.conflictingRecordSet,
      }),
      /IDEMPOTENCY_CONFLICT/,
    );
    assert.equal(await countFactsV1(cap03Ids), 8);
    ok("same key with different aggregate hash conflicts before lease validation");

    const cap03State = memberV1(fixture.recordSet, "twin_state_estimate_v1");
    await pool.query(
      "UPDATE twin_state_history_projection_v1 SET determinism_hash='sha256:projection_divergence' WHERE state_object_id=$1",
      [cap03State.object_id],
    );
    await assert.rejects(
      repository.rebuildAssimilatedContinuationProjections(
        fixture.recordSet.continuation_record_set_id,
      ),
      /PROJECTION_REBUILD_STATE_HISTORY_CONFLICT/,
    );
    ok("projection divergence fails closed against canonical fact authority");

    await pool.query(
      "DELETE FROM twin_state_history_projection_v1 WHERE state_object_id=$1",
      [cap03State.object_id],
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
    const rebuilt = await repository.rebuildAssimilatedContinuationProjections(
      fixture.recordSet.continuation_record_set_id,
    );
    assert.equal(rebuilt.rebuilt_projection_count, 5);
    const rebuiltPointers = await latestPointersV1(scope);
    assert.equal(
      rebuiltPointers.state,
      fixture.recordSet.member_object_ids.twin_state_estimate_v1,
    );
    assert.equal(
      rebuiltPointers.checkpoint,
      fixture.recordSet.member_object_ids.twin_runtime_checkpoint_v1,
    );
    assert.equal(
      rebuiltPointers.forecast,
      fixture.recordSet.member_object_ids.twin_forecast_run_v1,
    );
    ok("canonical CAP-03 facts rebuild exactly five continuation projections");

    await pool.query(
      "DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind='A2_RECORD_SET' AND record_set_id=$1",
      [fixture.recordSet.continuation_record_set_id],
    );
    await seedCap02FinalHandoffV1({
      scope,
      state: fixture.predecessorState,
      checkpoint: fixture.predecessorCheckpoint,
      forecast: fixture.predecessorForecast,
    });
    const uniquenessLease = await acquireLeaseV1(scope);
    await assert.rejects(
      repository.commitAssimilatedContinuationState({
        scope,
        lease: uniquenessLease,
        expected: fixture.expected,
        record_set: fixture.recordSet,
      }),
      /CANONICAL_CONTINUATION_UNIQUENESS_CONFLICT/,
    );
    assert.equal(await countFactsV1(cap03Ids), 8);
    ok("idempotency-guard loss cannot create a second canonical CAP-03 terminal tick");

    const historicalAfterCap03 = await repository.readContinuationRecordSet(
      fixture.continuationRecordSet.continuation_record_set_id,
    );
    assert.ok(historicalAfterCap03);
    assert.equal(
      historicalAfterCap03.continuation_record_set_determinism_hash,
      fixture.continuationRecordSet.continuation_record_set_determinism_hash,
    );
    ok("historical CAP-02 canonical readback remains valid after CAP-03 persistence support");

    console.log(`MCFT-CAP-03 assimilated persistence recovery DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
