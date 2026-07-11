// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_DB.ts
// Purpose: prove the S5 service executes 24 observation-aware ticks through isolated PostgreSQL A2 transactions, persists 192 canonical facts and 24 idempotency guards, advances checkpoint sequence 25..48, preserves blocked Forecast, and performs completed-range replay without a new lease or write.
// Boundary: destructive isolated-database acceptance only; no production database, restart/backfill proof, route, scheduler, successful Forecast, Recommendation, Decision, action, calibration, model activation, or live-field claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type {
  CanonicalObjectEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  PostgresAssimilatedRuntimeRepositoryV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.js";
import {
  PostgresNextTickRepositoryV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import {
  AssimilatedContinuationTickServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v1.js";
import {
  AssimilatedContiguousRangeServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v1.js";
import {
  PrepareNextTickInputServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type {
  ContinuationExpectedPointersV1,
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  memberV1,
} from "./mcft_cap_03_single_tick_integration_fixture_v1.js";
import {
  buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1,
  S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
  S5_STANDARD_TICK_COUNT_V1,
} from "./mcft_cap_03_twenty_four_observation_aware_tick_range_fixture_v1.js";

if (
  process.env
    .MCFT_CAP_03_S5_DESTRUCTIVE_ACCEPTANCE
  !== "1"
) {
  throw new Error(
    "SET_MCFT_CAP_03_S5_DESTRUCTIVE_ACCEPTANCE_1",
  );
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_REQUIRED");
}

const databaseName = new URL(databaseUrl)
  .pathname
  .replace(/^\//, "")
  .toLowerCase();

if (
  !/(mcft|cap03|s5|range|acceptance|test)/
    .test(databaseName)
) {
  throw new Error(
    "ISOLATED_ACCEPTANCE_DATABASE_REQUIRED",
  );
}

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const pool = new Pool({
  connectionString: databaseUrl,
});

const repository =
  new PostgresAssimilatedRuntimeRepositoryV1(pool);

const nextTickRepository =
  new PostgresNextTickRepositoryV1(pool);

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

function readSqlV1(
  relativePath: string,
): string {
  return fs.readFileSync(
    path.join(ROOT, relativePath),
    "utf8",
  );
}

function scopeParamsV1(
  scope: TwinScopeKeyV1,
): unknown[] {
  return [
    scope.tenant_id,
    scope.project_id,
    scope.group_id,
    scope.field_id,
    scope.season_id,
    scope.zone_id,
  ];
}

function factIdV1(
  objectId: string,
): string {
  return `fact_${objectId}`;
}

function recordJsonV1(
  object: CanonicalObjectEnvelopeV1,
): string {
  return JSON.stringify({
    type: object.object_type,
    payload: object,
  });
}

async function initializeSchemaV1(): Promise<void> {
  await pool.query(
    readSqlV1(
      "docker/postgres/init/001_schema.sql",
    ),
  );

  await pool.query(
    readSqlV1(
      "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql",
    ),
  );

  await pool.query(
    readSqlV1(
      "apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql",
    ),
  );

  await pool.query(
    readSqlV1(
      "apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql",
    ),
  );

  const migrations = fs.readdirSync(
    path.join(
      ROOT,
      "apps/server/db/migrations",
    ),
  );

  assert.equal(
    migrations.some(
      (name) =>
        /cap_03.*twenty|twenty.*tick|s5.*range/i
          .test(name),
    ),
    false,
  );

  ok("existing A0 and A2 schema is sufficient for the S5 24-tick range");
}

async function cleanupScopeV1(input: {
  scope: TwinScopeKeyV1;
  object_ids: string[];
  runtime_config_ids: string[];
  runtime_config_keys: string[];
  record_set_ids: string[];
  reality_binding_ref: string;
}): Promise<void> {
  const params = scopeParamsV1(input.scope);

  for (const table of projectionTables) {
    await pool.query(
      `DELETE FROM ${table}
       WHERE tenant_id=$1
         AND project_id=$2
         AND group_id=$3
         AND field_id=$4
         AND season_id=$5
         AND zone_id=$6`,
      params,
    );
  }

  await pool.query(
    `DELETE FROM twin_forecast_success_latest_index_v1
     WHERE tenant_id=$1
       AND project_id=$2
       AND group_id=$3
       AND field_id=$4
       AND season_id=$5
       AND zone_id=$6`,
    params,
  );

  await pool.query(
    `DELETE FROM twin_object_idempotency_index_v1
     WHERE record_set_id=ANY($1::text[])`,
    [input.record_set_ids],
  );

  await pool.query(
    `DELETE FROM twin_object_idempotency_index_v1
     WHERE idempotency_key=ANY($1::text[])`,
    [input.runtime_config_keys],
  );

  await pool.query(
    `DELETE FROM facts
     WHERE record_json->'payload'->>'object_id'
       =ANY($1::text[])`,
    [[
      ...input.object_ids,
      ...input.runtime_config_ids,
    ]],
  );

  await pool.query(
    `DELETE FROM twin_runtime_authority_snapshot_v1
     WHERE authority_ref=$1`,
    [input.reality_binding_ref],
  );

  await pool.query(
    `DELETE FROM twin_runtime_lease_v1
     WHERE tenant_id=$1
       AND project_id=$2
       AND group_id=$3
       AND field_id=$4
       AND season_id=$5
       AND zone_id=$6`,
    params,
  );
}

async function acquireLeaseV1(
  scope: TwinScopeKeyV1,
  owner: string,
): Promise<RuntimeLeaseClaimV1> {
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
  for (
    const object of [
      input.state,
      input.forecast,
      input.checkpoint,
    ]
  ) {
    await pool.query(
      `INSERT INTO facts
         (fact_id,occurred_at,source,record_json)
       VALUES
         ($1,$2::timestamptz,'system',$3::jsonb)
       ON CONFLICT (fact_id)
       DO UPDATE SET
         record_json=EXCLUDED.record_json`,
      [
        factIdV1(object.object_id),
        object.logical_time,
        recordJsonV1(object),
      ],
    );
  }

  const params = scopeParamsV1(input.scope);

  await pool.query(
    `INSERT INTO twin_state_history_projection_v1
       (
         state_object_id,
         tenant_id,
         project_id,
         group_id,
         field_id,
         season_id,
         zone_id,
         lineage_id,
         revision_id,
         logical_time,
         determinism_hash,
         canonical_payload,
         source_fact_id
       )
     VALUES
       (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,
         $10::timestamptz,$11,$12::jsonb,$13
       )
     ON CONFLICT (state_object_id)
     DO UPDATE SET
       determinism_hash=EXCLUDED.determinism_hash,
       canonical_payload=EXCLUDED.canonical_payload,
       source_fact_id=EXCLUDED.source_fact_id`,
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
    `UPDATE twin_state_latest_index_v1
     SET
       state_object_id=$7,
       lineage_id=$8,
       revision_id=$9,
       logical_time=$10::timestamptz,
       determinism_hash=$11,
       source_fact_id=$12
     WHERE tenant_id=$1
       AND project_id=$2
       AND group_id=$3
       AND field_id=$4
       AND season_id=$5
       AND zone_id=$6`,
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
    `UPDATE twin_forecast_result_latest_index_v1
     SET
       forecast_object_id=$7,
       forecast_status=$8,
       logical_time=$9::timestamptz,
       determinism_hash=$10,
       source_fact_id=$11
     WHERE tenant_id=$1
       AND project_id=$2
       AND group_id=$3
       AND field_id=$4
       AND season_id=$5
       AND zone_id=$6`,
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
    `UPDATE twin_runtime_checkpoint_latest_index_v1
     SET
       checkpoint_object_id=$7,
       lineage_id=$8,
       revision_id=$9,
       logical_time=$10::timestamptz,
       determinism_hash=$11,
       source_fact_id=$12
     WHERE tenant_id=$1
       AND project_id=$2
       AND group_id=$3
       AND field_id=$4
       AND season_id=$5
       AND zone_id=$6`,
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

async function factCountV1(
  objectIds: string[],
): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS count
     FROM facts
     WHERE record_json->'payload'->>'object_id'
       =ANY($1::text[])`,
    [objectIds],
  );

  return result.rows[0].count as number;
}

async function guardCountV1(
  recordSetIds: string[],
): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS count
     FROM twin_object_idempotency_index_v1
     WHERE identity_kind='A2_RECORD_SET'
       AND record_set_id=ANY($1::text[])`,
    [recordSetIds],
  );

  return result.rows[0].count as number;
}

async function stateHistoryCountV1(
  stateIds: string[],
): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS count
     FROM twin_state_history_projection_v1
     WHERE state_object_id=ANY($1::text[])`,
    [stateIds],
  );

  return result.rows[0].count as number;
}

async function fencingTokenV1(
  scope: TwinScopeKeyV1,
): Promise<bigint> {
  const result = await pool.query(
    `SELECT fencing_token
     FROM twin_runtime_lease_v1
     WHERE tenant_id=$1
       AND project_id=$2
       AND group_id=$3
       AND field_id=$4
       AND season_id=$5
       AND zone_id=$6`,
    scopeParamsV1(scope),
  );

  assert.equal(result.rows.length, 1);

  return BigInt(
    result.rows[0].fencing_token,
  );
}

async function main(): Promise<void> {
  const planningFixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

  const planned =
    await planningFixture.rangeService
      .runAssimilatedContiguousRangeV1(
        planningFixture.rangeInput,
      );

  assert.equal(planned.status, "COMPLETED");
  assert.equal(
    planned.tick_results.length,
    S5_STANDARD_TICK_COUNT_V1,
  );

  const expectedRangeObjectIds =
    planned.tick_results.flatMap(
      (tickResult) =>
        tickResult.record_set.members.map(
          (member) => member.object_id,
        ),
    );

  const expectedRangeRecordSetIds =
    planned.tick_results.map(
      (tickResult) =>
        tickResult.record_set
          .continuation_record_set_id,
    );

  const expectedRangeHashes =
    planned.tick_results.map(
      (tickResult) =>
        tickResult.record_set
          .continuation_record_set_determinism_hash,
    );

  const expectedRangeStateIds =
    planned.tick_results.map(
      (tickResult) =>
        memberV1(
          tickResult.record_set,
          "twin_state_estimate_v1",
        ).object_id,
    );

  const expectedRangeUpdateIds =
    planned.tick_results.map(
      (tickResult) =>
        memberV1(
          tickResult.record_set,
          "twin_assimilation_update_v1",
        ).object_id,
    );

  const fixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

  const scope = fixture.scope;

  const a0Ids =
    fixture.a0RecordSet.members.map(
      (member) => member.object_id,
    );

  const cap02Ids =
    fixture.continuationRecordSet.members.map(
      (member) => member.object_id,
    );

  const predecessorIds = [
    fixture.predecessorState.object_id,
    fixture.predecessorCheckpoint.object_id,
    fixture.predecessorForecast.object_id,
  ];

  const a0Lineage = memberV1(
    fixture.a0RecordSet,
    "twin_runtime_lineage_v1",
  );

  const a0State = memberV1(
    fixture.a0RecordSet,
    "twin_state_estimate_v1",
  );

  const a0Checkpoint = memberV1(
    fixture.a0RecordSet,
    "twin_runtime_checkpoint_v1",
  );

  const a0Forecast = memberV1(
    fixture.a0RecordSet,
    "twin_forecast_run_v1",
  );

  const cap02Expected:
    ContinuationExpectedPointersV1 = {
      active_lineage_ref:
        a0Lineage.object_id,
      lineage_id:
        fixture.lock.lineage_id,
      revision_id:
        fixture.lock.revision_id,
      previous_checkpoint_ref:
        a0Checkpoint.object_id,
      previous_state_ref:
        a0State.object_id,
      previous_forecast_result_ref:
        a0Forecast.object_id,
      latest_successful_forecast_ref:
        null,
    };

  const runtimeConfigs = [
    fixture.parentRuntimeConfig,
    fixture.continuationRuntimeConfig,
    ...fixture.runtimeConfigChain,
  ];

  try {
    await initializeSchemaV1();

    await cleanupScopeV1({
      scope,
      object_ids: [
        ...a0Ids,
        ...cap02Ids,
        ...predecessorIds,
        ...expectedRangeObjectIds,
      ],
      runtime_config_ids:
        runtimeConfigs.map(
          (config) => config.object_id,
        ),
      runtime_config_keys:
        runtimeConfigs.map(
          (config) => config.idempotency_key,
        ),
      record_set_ids: [
        fixture.a0RecordSet.a0_record_set_id,
        fixture.continuationRecordSet
          .continuation_record_set_id,
        ...expectedRangeRecordSetIds,
      ],
      reality_binding_ref:
        fixture.realityBindingSnapshot
          .binding_id,
    });

    await repository.commitRuntimeConfig(
      fixture.parentRuntimeConfig,
    );

    const a0Lease = await acquireLeaseV1(
      scope,
      fixture.rangeInput.lease_owner,
    );

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

    await repository.commitRuntimeConfig(
      fixture.continuationRuntimeConfig,
    );

    const cap02Lease = await acquireLeaseV1(
      scope,
      fixture.rangeInput.lease_owner,
    );

    await repository.commitContinuationState({
      scope,
      lease: cap02Lease,
      expected: cap02Expected,
      record_set:
        fixture.continuationRecordSet,
    });

    await seedCap02FinalHandoffV1({
      scope,
      state: fixture.predecessorState,
      checkpoint:
        fixture.predecessorCheckpoint,
      forecast:
        fixture.predecessorForecast,
    });

    await nextTickRepository
      .commitRealityBindingSnapshot(
        fixture.realityBindingSnapshot,
      );

    ok("isolated PostgreSQL reproduces the frozen CAP-02 sequence-24 predecessor authority");

    for (
      const config of
        fixture.runtimeConfigChain
    ) {
      await repository.commitRuntimeConfig(
        config,
      );
    }

    assert.equal(
      await factCountV1(
        fixture.runtimeConfigChain.map(
          (config) => config.object_id,
        ),
      ),
      24,
    );

    ok("PostgreSQL persists the immutable 24-member Runtime Config parent chain");

    const handoffService =
      new PrepareNextTickInputServiceV1(
        nextTickRepository,
      );

    const handoffBefore =
      await handoffService
        .prepareNextTickInput(scope);

    assert.equal(
      handoffBefore.previous_tick_sequence,
      24,
    );

    assert.equal(
      handoffBefore.next_logical_tick_time,
      "2026-06-02T02:00:00.000Z",
    );

    const tickService =
      new AssimilatedContinuationTickServiceV1(
        handoffService,
        fixture.evidenceSource,
        repository,
        repository,
      );

    const rangeService =
      new AssimilatedContiguousRangeServiceV1(
        handoffService,
        tickService,
      );

    const inserted =
      await rangeService
        .runAssimilatedContiguousRangeV1(
          fixture.rangeInput,
        );

    assert.equal(
      inserted.status,
      "COMPLETED",
    );

    assert.equal(
      inserted.executed_tick_count,
      24,
    );

    assert.equal(
      inserted.tick_results.length,
      24,
    );

    assert.deepEqual(
      inserted.tick_results.map(
        (tickResult) =>
          tickResult.record_set
            .continuation_record_set_determinism_hash,
      ),
      expectedRangeHashes,
    );

    ok("PostgreSQL executes all 24 ticks and reproduces the canonical in-memory record-set hashes");

    assert.equal(
      await factCountV1(
        expectedRangeObjectIds,
      ),
      192,
    );

    assert.equal(
      await guardCountV1(
        expectedRangeRecordSetIds,
      ),
      24,
    );

    ok("24 A2 transactions persist exactly 192 canonical facts and 24 record-set guards");

    assert.equal(
      await stateHistoryCountV1(
        expectedRangeStateIds,
      ),
      24,
    );

    assert.equal(
      await factCountV1(
        expectedRangeUpdateIds,
      ),
      24,
    );

    ok("PostgreSQL persists 24 posterior States and 24 assimilation updates");

    const finalHandoff =
      await handoffService
        .prepareNextTickInput(scope);

    assert.equal(
      finalHandoff.previous_tick_sequence,
      48,
    );

    assert.equal(
      finalHandoff.next_logical_tick_time,
      S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
    );

    assert.equal(
      inserted.final_handoff
        .previous_tick_sequence,
      48,
    );

    assert.equal(
      inserted.final_handoff
        .next_logical_tick_time,
      S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
    );

    ok("canonical PostgreSQL readback advances checkpoint sequence to 48 and exposes the frozen T+1 handoff");

    for (
      const tickResult of
        inserted.tick_results
    ) {
      const forecast = memberV1(
        tickResult.record_set,
        "twin_forecast_run_v1",
      );

      assert.equal(
        forecast.payload.status,
        "BLOCKED",
      );

      assert.equal(
        forecast.payload
          .successful_forecast_ref,
        null,
      );
    }

    const successPointer =
      await pool.query(
        `SELECT count(*)::int AS count
         FROM twin_forecast_success_latest_index_v1
         WHERE tenant_id=$1
           AND project_id=$2
           AND group_id=$3
           AND field_id=$4
           AND season_id=$5
           AND zone_id=$6`,
        scopeParamsV1(scope),
      );

    assert.equal(
      successPointer.rows[0].count,
      0,
    );

    ok("all 24 persisted Forecast objects remain BLOCKED with no successful-Forecast pointer");

    const tokenBeforeReplay =
      await fencingTokenV1(scope);

    const factsBeforeReplay =
      await factCountV1(
        expectedRangeObjectIds,
      );

    const guardsBeforeReplay =
      await guardCountV1(
        expectedRangeRecordSetIds,
      );

    const replay =
      await rangeService
        .runAssimilatedContiguousRangeV1(
          fixture.rangeInput,
        );

    const tokenAfterReplay =
      await fencingTokenV1(scope);

    assert.equal(
      replay.status,
      "ALREADY_COMPLETE",
    );

    assert.equal(
      replay.executed_tick_count,
      0,
    );

    assert.deepEqual(
      replay.tick_results,
      [],
    );

    assert.equal(
      tokenAfterReplay,
      tokenBeforeReplay,
    );

    assert.equal(
      await factCountV1(
        expectedRangeObjectIds,
      ),
      factsBeforeReplay,
    );

    assert.equal(
      await guardCountV1(
        expectedRangeRecordSetIds,
      ),
      guardsBeforeReplay,
    );

    assert.equal(
      replay.final_handoff
        .previous_tick_sequence,
      48,
    );

    assert.equal(
      replay.final_handoff
        .next_logical_tick_time,
      S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
    );

    ok("completed-range PostgreSQL replay performs no new lease, A2 fact write, or idempotency-guard write");

    console.log(
      `MCFT-CAP-03 twenty-four observation-aware tick range DB: ${pass} PASS, 0 FAIL`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
