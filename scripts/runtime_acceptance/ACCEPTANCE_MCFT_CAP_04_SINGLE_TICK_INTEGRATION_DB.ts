// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_DB.ts
// Purpose: prove one CAP-04 S6 A1/B or legal A2 tick, canonical Forecast authority, facts-based A/B guard recovery, terminal uniqueness after guard loss, and Forecast-authoritative pending-Scenario recovery in real PostgreSQL.
// Boundary: destructive isolated-database acceptance only; no route, web, scheduler, 24-tick CAP-04 range, restart/backfill mode, recommendation, decision, AO-ACT, live data, or field claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1 } from "../../apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.js";
import { compileCap04RuntimeConfigV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  Cap04ForecastScenarioSingleTickServiceV1,
  type Cap04SingleTickPersistencePortV1,
  type ExecuteCap04SingleTickInputV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { Cap04PendingScenarioBarrierSingleTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildCap04FutureForcingSnapshotV1 } from "./mcft_cap_04_future_forcing_fixture_v1.js";
import {
  buildMcftCap03R2V2FixtureV1,
  memberR2V2,
} from "./mcft_cap_03_r2_v2_revalidation_fixture_v1.js";

if (process.env.MCFT_CAP_04_SINGLE_TICK_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_04_SINGLE_TICK_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap04|s6|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CREATED_AT = "2026-07-13T08:20:00.000Z";
const pool = new Pool({ connectionString: databaseUrl });

function readSqlV1(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function factIdV1(objectId: string): string {
  return `fact_${objectId}`;
}

function recordJsonV1(object: CanonicalObjectEnvelopeV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}

function memberV1(recordSet: { members: CanonicalObjectEnvelopeV1[] }, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP04_S6_DB_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

async function initializeSchemaV1(): Promise<void> {
  await pool.query(readSqlV1("docker/postgres/init/001_schema.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql"));
}

async function resetSchemaV1(): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await initializeSchemaV1();
}

async function insertFactV1(object: CanonicalObjectEnvelopeV1): Promise<void> {
  await pool.query(
    "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,'system',$3::jsonb)",
    [factIdV1(object.object_id), object.logical_time, recordJsonV1(object)],
  );
}

async function countV1(fromClause: string, values: unknown[] = []): Promise<number> {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${fromClause}`, values);
  return result.rows[0].count as number;
}

function persistenceAdapterV1(
  runtimeRepository: PostgresRuntimeRepositoryV1,
  repository: PostgresForecastScenarioRecoveryRepositoryV1,
): Cap04SingleTickPersistencePortV1 {
  return {
    acquireLease: runtimeRepository.acquireLease.bind(runtimeRepository),
    lookupARecordSet: repository.lookupARecordSet.bind(repository),
    commitARecordSet: repository.commitARecordSet.bind(repository),
    readARecordSet: repository.readARecordSet.bind(repository),
    lookupScenarioSet: repository.lookupScenarioSet.bind(repository),
    commitScenarioSet: repository.commitScenarioSet.bind(repository),
    readScenarioSet: repository.readScenarioSet.bind(repository),
    readScenarioSetBySourceForecast: repository.readScenarioSetBySourceForecast.bind(repository),
    detectPendingScenario: repository.detectPendingScenario.bind(repository),
    rebuildForecastProjections: repository.rebuildForecastProjections.bind(repository),
    rebuildScenarioProjections: repository.rebuildScenarioProjections.bind(repository),
  };
}

async function buildControlledAuthorityV1() {
  const cap03 = await buildMcftCap03R2V2FixtureV1(24);
  const range = await cap03.rangeService.runAssimilatedContiguousRangeV2(
    cap03.rangeInput(cap03.lastLogicalTime),
  );
  assert.equal(range.executed_tick_count, 24);
  const snapshot = cap03.runtime.currentSnapshotR2V2();
  assert.ok(snapshot.last_terminal_tick);
  assert.equal(snapshot.checkpoint.payload.tick_sequence, 48);
  assert.equal(snapshot.checkpoint.payload.next_tick_logical_time, "2026-06-03T02:00:00.000Z");
  const scope = snapshot.reality_binding.scope;
  const parentPayload = snapshot.runtime_config.payload;
  const logicalTime = String(snapshot.checkpoint.payload.next_tick_logical_time);
  const cap04Config = compileCap04RuntimeConfigV1({
    scope,
    effective_logical_time: logicalTime,
    created_at: CREATED_AT,
    parent_runtime_config_ref: snapshot.runtime_config.object_id,
    parent_runtime_config_hash: snapshot.runtime_config.determinism_hash,
    reality_binding_ref: String(parentPayload.reality_binding_ref),
    reality_binding_hash: String(parentPayload.reality_binding_hash),
    source_matrix_hash: String(parentPayload.source_matrix_hash),
    configuration_matrix_hash: String(parentPayload.configuration_matrix_hash),
    geometry_semantic_hash: String(parentPayload.geometry_semantic_hash),
  });
  const currentEvidence = await cap03.runtime.loadCandidateRecords({ scope, logical_time: logicalTime });
  const issuedAt = new Date(Date.parse(logicalTime) - 45 * 60_000).toISOString();
  const availableAt = new Date(Date.parse(logicalTime) - 30 * 60_000).toISOString();
  const candidates: CanonicalReplayEvidenceRecordV1[] = [
    ...structuredClone(currentEvidence),
    buildCap04FutureForcingSnapshotV1({
      kind: "weather",
      logical_time: logicalTime,
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      source_record_id: "weather_cap04_s6_db_selected",
      seed: 11,
      scope_override: scope,
    }),
    buildCap04FutureForcingSnapshotV1({
      kind: "et0",
      logical_time: logicalTime,
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      source_record_id: "future_et0_cap04_s6_db_selected",
      seed: 11,
      scope_override: scope,
    }),
  ];
  const lineage = memberR2V2(cap03.source.a0RecordSet, "twin_runtime_lineage_v1");
  return {
    cap03,
    snapshot,
    scope,
    logicalTime,
    cap04Config,
    candidates,
    lineage,
    cropStageContext: cap03.source.cropStageContext,
  };
}

async function seedControlledAuthorityV1(
  authority: Awaited<ReturnType<typeof buildControlledAuthorityV1>>,
  initialCandidates: CanonicalReplayEvidenceRecordV1[] = authority.candidates,
): Promise<{
  runtimeRepository: PostgresRuntimeRepositoryV1;
  nextTickRepository: PostgresNextTickRepositoryV1;
  repository: PostgresForecastScenarioRecoveryRepositoryV1;
  service: Cap04PendingScenarioBarrierSingleTickServiceV1;
  input: ExecuteCap04SingleTickInputV1;
  replaceCandidates: (records: CanonicalReplayEvidenceRecordV1[]) => void;
  evidenceLoadCount: () => number;
}> {
  const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
  const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
  const repository = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
  await runtimeRepository.commitRuntimeConfig(authority.snapshot.runtime_config);
  await runtimeRepository.commitRuntimeConfig(authority.cap04Config);
  await nextTickRepository.commitRealityBindingSnapshot(authority.snapshot.reality_binding);
  for (const object of [
    authority.lineage,
    authority.snapshot.previous_posterior,
    authority.snapshot.previous_forecast_result,
    authority.snapshot.checkpoint,
    authority.snapshot.last_terminal_tick!,
  ]) {
    await insertFactV1(object);
  }
  const values = scopeValuesV1(authority.scope);
  await pool.query(
    `INSERT INTO twin_active_lineage_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,active_lineage_ref,activation_authority_kind,activation_authority_ref,expected_previous_active_lineage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'CONTROLLED_REPLAY','mcft_cap04_s6_db_fixture',NULL)`,
    [...values, authority.lineage.object_id],
  );
  await pool.query(
    `INSERT INTO twin_state_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,state_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)`,
    [...values, authority.snapshot.previous_posterior.object_id, authority.snapshot.previous_posterior.lineage_id, authority.snapshot.previous_posterior.revision_id, authority.snapshot.previous_posterior.logical_time, authority.snapshot.previous_posterior.determinism_hash, factIdV1(authority.snapshot.previous_posterior.object_id)],
  );
  await pool.query(
    `INSERT INTO twin_forecast_result_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,forecast_status,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11)`,
    [...values, authority.snapshot.previous_forecast_result.object_id, String(authority.snapshot.previous_forecast_result.payload.status), authority.snapshot.previous_forecast_result.logical_time, authority.snapshot.previous_forecast_result.determinism_hash, factIdV1(authority.snapshot.previous_forecast_result.object_id)],
  );
  await pool.query(
    `INSERT INTO twin_runtime_checkpoint_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,checkpoint_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)`,
    [...values, authority.snapshot.checkpoint.object_id, authority.snapshot.checkpoint.lineage_id, authority.snapshot.checkpoint.revision_id, authority.snapshot.checkpoint.logical_time, authority.snapshot.checkpoint.determinism_hash, factIdV1(authority.snapshot.checkpoint.object_id)],
  );
  await pool.query(
    `INSERT INTO twin_runtime_health_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,health_object_id,operation_status,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,'seed_cap04_s6_health','READY',$7::timestamptz,'sha256:seed_cap04_s6_health','seed_cap04_s6_health_fact')`,
    [...values, authority.snapshot.checkpoint.logical_time],
  );
  let candidates = structuredClone(initialCandidates);
  let loads = 0;
  const source: ReplayEvidenceSourcePortV1 = {
    async loadCandidateRecords(input) {
      loads += 1;
      assert.deepEqual(input.scope, authority.scope);
      assert.equal(input.logical_time, authority.logicalTime);
      return structuredClone(candidates);
    },
  };
  const handoffService = new PrepareNextTickInputServiceV1(nextTickRepository);
  const persistence = persistenceAdapterV1(runtimeRepository, repository);
  const innerService = new Cap04ForecastScenarioSingleTickServiceV1(
    handoffService,
    source,
    runtimeRepository,
    persistence,
  );
  const service = new Cap04PendingScenarioBarrierSingleTickServiceV1(
    handoffService,
    runtimeRepository,
    persistence,
    innerService,
  );
  const input: ExecuteCap04SingleTickInputV1 = {
    scope: structuredClone(authority.scope),
    logical_time: authority.logicalTime,
    created_at: CREATED_AT,
    runtime_config_ref: authority.cap04Config.object_id,
    runtime_config_hash: authority.cap04Config.determinism_hash,
    authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: structuredClone(authority.cropStageContext),
    lease_owner: "mcft-cap04-s6-db-acceptance",
    lease_duration_seconds: 300,
  };
  return {
    runtimeRepository,
    nextTickRepository,
    repository,
    service,
    input,
    replaceCandidates(records) { candidates = structuredClone(records); },
    evidenceLoadCount() { return loads; },
  };
}

async function deleteCap04GuardsV1(): Promise<void> {
  await pool.query("DELETE FROM twin_scenario_set_uniqueness_v1");
  await pool.query("DELETE FROM twin_terminal_tick_uniqueness_v1");
  await pool.query("DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind IN ('A1_RECORD_SET','A2_RECORD_SET','B_SCENARIO_SET')");
}

async function main(): Promise<void> {
  let pass = 0;
  const ok = (message: string): void => { pass += 1; console.log(`PASS ${message}`); };
  try {
    const authority = await buildControlledAuthorityV1();

    await resetSchemaV1();
    let seeded = await seedControlledAuthorityV1(authority);
    const inserted = await seeded.service.executeOneTick(seeded.input);
    assert.equal(inserted.status, "INSERTED");
    assert.ok(inserted.b_record);
    const canonicalForecast = memberV1(inserted.a_record_set, "twin_forecast_run_v1");
    assert.equal(canonicalForecast.payload.canonical_authority_contract_id, CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1);
    assert.equal(canonicalForecast.payload.point_traces.length, 72);
    assert.equal(canonicalForecast.payload.forcing_window_authority.points.length, 72);
    assert.equal(await countV1("twin_terminal_tick_uniqueness_v1"), 1);
    assert.equal(await countV1("facts WHERE record_json->>'type'='twin_forecast_run_v1' AND record_json->'payload'->'payload'->>'status'='COMPLETED'"), 1);
    assert.equal(await countV1("twin_forecast_point_projection_v1"), 72);
    assert.equal(await countV1("facts WHERE record_json->>'type'='twin_scenario_set_v1'"), 1);
    assert.equal(await countV1("twin_scenario_point_projection_v1"), 216);
    assert.equal(inserted.next_handoff.next_logical_tick_time, "2026-06-03T03:00:00.000Z");
    assert.equal(inserted.next_handoff.latest_successful_forecast_ref, inserted.b_record.scenario_set.payload.source_forecast_ref);
    ok("real PostgreSQL handoff commits canonical full-authority A1 plus B and returns exact T+1 authority");

    const factCount = await countV1("facts");
    await deleteCap04GuardsV1();
    assert.equal(await countV1("twin_terminal_tick_uniqueness_v1"), 0);
    assert.equal(await countV1("twin_scenario_set_uniqueness_v1"), 0);
    const replay = await seeded.service.executeOneTick(seeded.input);
    assert.equal(replay.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.ok(replay.b_record);
    assert.equal(await countV1("facts"), factCount);
    assert.equal(await countV1("twin_terminal_tick_uniqueness_v1"), 1);
    assert.equal(await countV1("twin_scenario_set_uniqueness_v1"), 1);
    assert.equal(await countV1("twin_object_idempotency_index_v1 WHERE identity_kind IN ('A1_RECORD_SET','B_SCENARIO_SET')"), 2);
    assert.equal(replay.a_record_set.aggregate_determinism_hash, inserted.a_record_set.aggregate_determinism_hash);
    assert.equal(replay.b_record.aggregate_determinism_hash, inserted.b_record.aggregate_determinism_hash);
    ok("deleted A/B guards are reconstructed from canonical Tick and Scenario facts with zero duplicate facts");

    await resetSchemaV1();
    const historicalOnly = authority.candidates.filter((record) => !["future_weather_assumption_v1", "future_et0_assumption_v1"].includes(record.record_type));
    const blockedSeed = await seedControlledAuthorityV1(authority, historicalOnly);
    const blocked = await blockedSeed.service.executeOneTick(blockedSeed.input);
    assert.equal(blocked.status, "BLOCKED_INSERTED");
    assert.equal(blocked.b_record, null);
    assert.equal(memberV1(blocked.a_record_set, "twin_forecast_run_v1").payload.status, "BLOCKED");
    const blockedRecordSet = blocked.a_record_set;
    ok("complete-pair unavailability commits one legal A2 and does not create B");

    await resetSchemaV1();
    seeded = await seedControlledAuthorityV1(authority);
    const successful = await seeded.service.executeOneTick(seeded.input);
    assert.equal(successful.status, "INSERTED");
    await deleteCap04GuardsV1();
    const lease = await seeded.runtimeRepository.acquireLease({
      ...authority.scope,
      lease_owner: "mcft-cap04-s6-db-acceptance",
      lease_duration_seconds: 300,
    });
    await assert.rejects(
      seeded.repository.commitARecordSet({
        scope: authority.scope,
        lease,
        expected: {
          active_lineage_ref: authority.lineage.object_id,
          lineage_id: String(authority.snapshot.previous_posterior.lineage_id),
          revision_id: String(authority.snapshot.previous_posterior.revision_id),
          previous_checkpoint_ref: authority.snapshot.checkpoint.object_id,
          previous_state_ref: authority.snapshot.previous_posterior.object_id,
          previous_forecast_result_ref: authority.snapshot.previous_forecast_result.object_id,
          previous_successful_forecast_ref: authority.snapshot.checkpoint.payload.successful_forecast_ref as string | null,
        },
        record_set: blockedRecordSet,
      }),
      /TERMINAL_TICK_VARIANT_CONFLICT/,
    );
    assert.equal(await countV1("facts WHERE record_json->>'type'='twin_runtime_tick_v1' AND record_json->'payload'->>'logical_time'=$1", [authority.logicalTime]), 1);
    ok("canonical Tick facts reject a second terminal variant after all A guards are deleted");

    assert.ok(successful.b_record);
    await pool.query("DELETE FROM twin_scenario_set_uniqueness_v1");
    await pool.query("DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind='B_SCENARIO_SET'");
    const conflictingB = structuredClone(successful.b_record);
    conflictingB.aggregate_determinism_hash = "sha256:forged-conflict";
    await assert.rejects(
      seeded.repository.commitScenarioSet({ scope: authority.scope, lease, record: conflictingB }),
      /SCENARIO_SET_CANONICAL_UNIQUENESS_CONFLICT/,
    );
    assert.equal(await countV1("facts WHERE record_json->>'type'='twin_scenario_set_v1'"), 1);
    ok("canonical Scenario fact rejects a second Scenario Set after B guards are deleted");

    await resetSchemaV1();
    seeded = await seedControlledAuthorityV1(authority);
    await assert.rejects(
      seeded.service.executeOneTick({
        ...seeded.input,
        fault_injection_b: (stage) => { if (stage === "before_commit") throw new Error("INJECTED_S6_B_FAILURE"); },
      }),
      /INJECTED_S6_B_FAILURE/,
    );
    assert.equal(await countV1("twin_terminal_tick_uniqueness_v1"), 1);
    assert.equal(await countV1("facts WHERE record_json->>'type'='twin_scenario_set_v1'"), 0);
    assert.ok(await seeded.repository.detectPendingScenario(authority.scope));
    const loadsBeforeRecovery = seeded.evidenceLoadCount();
    seeded.replaceCandidates(historicalOnly);
    const recovered = await seeded.service.executeOneTick(seeded.input);
    assert.equal(recovered.status, "RECOVERED_PENDING_SCENARIO");
    assert.ok(recovered.b_record);
    assert.equal(seeded.evidenceLoadCount(), loadsBeforeRecovery);
    assert.equal(await countV1("twin_terminal_tick_uniqueness_v1"), 1);
    assert.equal(await countV1("facts WHERE record_json->>'type'='twin_scenario_set_v1'"), 1);
    assert.equal(await seeded.repository.detectPendingScenario(authority.scope), null);
    assert.equal(recovered.next_handoff.next_logical_tick_time, "2026-06-03T03:00:00.000Z");
    ok("pending B recovery consumes canonical Forecast authority with zero forcing reselection");

    console.log(`MCFT-CAP-04 single-tick integration DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
