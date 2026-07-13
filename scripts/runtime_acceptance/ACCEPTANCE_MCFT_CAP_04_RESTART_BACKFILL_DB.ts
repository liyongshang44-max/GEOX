// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL_DB.ts
// Purpose: prove real PostgreSQL resumes CAP-04 after 12 ticks through a fresh service composition, executes the remaining 12 ticks, preserves canonical cardinalities, and makes completed-target retry zero-write.
// Boundary: destructive isolated-database acceptance only; fencing/CAS, cross-variant uniqueness and projection rebuild are exercised by the companion persistence regression suites.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { compileCap04RuntimeConfigChainV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_chain_v1.js";
import type { Cap04RuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { Cap04ForecastScenarioRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_range_service_v1.js";
import { Cap04ForecastScenarioRestartResumeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_restart_resume_service_v1.js";
import {
  Cap04ForecastScenarioSingleTickServiceV1,
  type Cap04SingleTickPersistencePortV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
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

if (process.env.MCFT_CAP_04_S8_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_04_S8_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap04|s8|restart|backfill|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CREATED_AT = "2026-07-13T11:00:00.000Z";
const START_LOGICAL_TIME = "2026-06-03T02:00:00.000Z";
const PROCESS_1_TARGET_LOGICAL_TIME = "2026-06-03T13:00:00.000Z";
const TARGET_LOGICAL_TIME = "2026-06-04T01:00:00.000Z";
const FINAL_NEXT_LOGICAL_TIME = "2026-06-04T02:00:00.000Z";
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
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

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * MINUTE_MS).toISOString();
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

function evidenceV1(input: {
  scope: TwinScopeKeyV1;
  record_type: string;
  source_record_id: string;
  binding_id: string;
  origin_source_id: string;
  role_time: Record<string, unknown>;
  canonical_payload: Record<string, unknown>;
  source_unit: string;
  canonical_unit: string;
}): CanonicalReplayEvidenceRecordV1 {
  const semantic = {
    record_type: input.record_type,
    source_record_id: input.source_record_id,
    binding_id: input.binding_id,
    origin_source_id: input.origin_source_id,
    role_time: input.role_time,
    canonical_payload: input.canonical_payload,
  };
  return {
    ...input.scope,
    dataset_id: "mcft_cap04_s8_postgresql_range_fixture_v1",
    source_record_id: input.source_record_id,
    source_record_hash: semanticHashV1(semantic),
    record_type: input.record_type,
    binding_id: input.binding_id,
    origin_source_kind: "CONTROLLED_REPLAY_FIXTURE",
    origin_source_id: input.origin_source_id,
    epistemic_class: "OBSERVED",
    available_to_runtime_at: String(input.role_time.ingested_at),
    role_time: structuredClone(input.role_time),
    quality: { status: "PASS" },
    source_payload: { ...structuredClone(input.canonical_payload), source_version: "1" },
    canonical_payload: structuredClone(input.canonical_payload),
    source_unit: input.source_unit,
    canonical_unit: input.canonical_unit,
    conversion_rule: { id: "IDENTITY_V1", version: "1" },
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
  };
}

function evidenceForTickV1(scope: TwinScopeKeyV1, logicalTime: string, index: number): CanonicalReplayEvidenceRecordV1[] {
  const suffix = logicalTime.replaceAll("-", "").replaceAll(":", "").replace(".000Z", "Z");
  const ingestedAt = addMinutesV1(logicalTime, -5);
  const rainfall = evidenceV1({
    scope,
    record_type: "observed_rainfall_v1",
    source_record_id: `rain_cap04_s8_db_${suffix}`,
    binding_id: "rainfall_c8_hourly_v1",
    origin_source_id: "weather_replay_cap04_s8_db",
    role_time: { interval_start: addHoursV1(logicalTime, -1), interval_end: logicalTime, ingested_at: ingestedAt },
    canonical_payload: { value: Number((0.2 + (index % 4) * 0.1).toFixed(6)), unit: "mm" },
    source_unit: "mm",
    canonical_unit: "mm",
  });
  const et0 = evidenceV1({
    scope,
    record_type: "historical_et0_estimate_v1",
    source_record_id: `et0_cap04_s8_db_${suffix}`,
    binding_id: "historical_et0_c8_hourly_v1",
    origin_source_id: "et0_replay_cap04_s8_db",
    role_time: { interval_start: addHoursV1(logicalTime, -1), interval_end: logicalTime, ingested_at: ingestedAt },
    canonical_payload: {
      value: Number((0.1 + (index % 3) * 0.01).toFixed(6)),
      unit: "mm",
      calculation_method: "FAO56_PM_REPLAY_V1",
      method_version: "1",
    },
    source_unit: "mm",
    canonical_unit: "mm",
  });
  const soil = evidenceV1({
    scope,
    record_type: "soil_moisture_observation_v1",
    source_record_id: `soil_cap04_s8_db_${suffix}`,
    binding_id: "soil_obs_c8_20cm_v1",
    origin_source_id: "soil_sensor_cap04_s8_db",
    role_time: { observed_at: addMinutesV1(logicalTime, -10), ingested_at: ingestedAt },
    canonical_payload: {
      value: Number((0.31 - index * 0.0005).toFixed(6)),
      unit: "fraction",
      quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    },
    source_unit: "fraction",
    canonical_unit: "fraction",
  });
  const issuedAt = addMinutesV1(logicalTime, -45);
  const availableAt = addMinutesV1(logicalTime, -30);
  return [
    rainfall,
    et0,
    soil,
    buildCap04FutureForcingSnapshotV1({
      kind: "weather",
      logical_time: logicalTime,
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      source_record_id: `weather_cap04_s8_db_${suffix}`,
      seed: 200 + index,
      scope_override: scope,
    }),
    buildCap04FutureForcingSnapshotV1({
      kind: "et0",
      logical_time: logicalTime,
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      source_record_id: `future_et0_cap04_s8_db_${suffix}`,
      seed: 200 + index,
      scope_override: scope,
    }),
  ];
}

async function main(): Promise<void> {
  let pass = 0;
  const ok = (message: string): void => { pass += 1; console.log(`PASS ${message}`); };
  try {
    await resetSchemaV1();
    const cap03 = await buildMcftCap03R2V2FixtureV1(24);
    const predecessorRange = await cap03.rangeService.runAssimilatedContiguousRangeV2(cap03.rangeInput(cap03.lastLogicalTime));
    assert.equal(predecessorRange.executed_tick_count, 24);
    const snapshot = cap03.runtime.currentSnapshotR2V2();
    assert.ok(snapshot.last_terminal_tick);
    assert.equal(snapshot.checkpoint.payload.tick_sequence, 48);
    assert.equal(snapshot.checkpoint.payload.next_tick_logical_time, START_LOGICAL_TIME);
    const scope = snapshot.reality_binding.scope;
    const predecessorPayload = snapshot.runtime_config.payload;
    const configs = compileCap04RuntimeConfigChainV1({
      scope,
      first_effective_logical_time: START_LOGICAL_TIME,
      created_at: CREATED_AT,
      predecessor_runtime_config_ref: snapshot.runtime_config.object_id,
      predecessor_runtime_config_hash: snapshot.runtime_config.determinism_hash,
      reality_binding_ref: String(predecessorPayload.reality_binding_ref),
      reality_binding_hash: String(predecessorPayload.reality_binding_hash),
      source_matrix_hash: String(predecessorPayload.source_matrix_hash),
      configuration_matrix_hash: String(predecessorPayload.configuration_matrix_hash),
      geometry_semantic_hash: String(predecessorPayload.geometry_semantic_hash),
    });
    assert.equal(configs.length, 24);

    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
    const repository = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
    await runtimeRepository.commitRuntimeConfig(snapshot.runtime_config);
    for (const config of configs) await runtimeRepository.commitRuntimeConfig(config);
    await nextTickRepository.commitRealityBindingSnapshot(snapshot.reality_binding);
    const lineage = memberR2V2(cap03.source.a0RecordSet, "twin_runtime_lineage_v1");
    for (const object of [
      lineage,
      snapshot.previous_posterior,
      snapshot.previous_forecast_result,
      snapshot.checkpoint,
      snapshot.last_terminal_tick,
    ]) await insertFactV1(object);

    const values = scopeValuesV1(scope);
    await pool.query(
      `INSERT INTO twin_active_lineage_index_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,active_lineage_ref,activation_authority_kind,activation_authority_ref,expected_previous_active_lineage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'CONTROLLED_REPLAY','mcft_cap04_s8_db_fixture',NULL)`,
      [...values, lineage.object_id],
    );
    await pool.query(
      `INSERT INTO twin_state_latest_index_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,state_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)`,
      [...values, snapshot.previous_posterior.object_id, snapshot.previous_posterior.lineage_id, snapshot.previous_posterior.revision_id, snapshot.previous_posterior.logical_time, snapshot.previous_posterior.determinism_hash, factIdV1(snapshot.previous_posterior.object_id)],
    );
    await pool.query(
      `INSERT INTO twin_forecast_result_latest_index_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,forecast_status,logical_time,determinism_hash,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11)`,
      [...values, snapshot.previous_forecast_result.object_id, String(snapshot.previous_forecast_result.payload.status), snapshot.previous_forecast_result.logical_time, snapshot.previous_forecast_result.determinism_hash, factIdV1(snapshot.previous_forecast_result.object_id)],
    );
    await pool.query(
      `INSERT INTO twin_runtime_checkpoint_latest_index_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,checkpoint_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)`,
      [...values, snapshot.checkpoint.object_id, snapshot.checkpoint.lineage_id, snapshot.checkpoint.revision_id, snapshot.checkpoint.logical_time, snapshot.checkpoint.determinism_hash, factIdV1(snapshot.checkpoint.object_id)],
    );
    await pool.query(
      `INSERT INTO twin_runtime_health_latest_index_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,health_object_id,operation_status,logical_time,determinism_hash,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,'seed_cap04_s8_health','READY',$7::timestamptz,'sha256:seed_cap04_s8_health','seed_cap04_s8_health_fact')`,
      [...values, snapshot.checkpoint.logical_time],
    );

    let evidenceLoads = 0;
    const source: ReplayEvidenceSourcePortV1 = {
      async loadCandidateRecords(input) {
        assert.deepEqual(input.scope, scope);
        const index = (Date.parse(input.logical_time) - Date.parse(START_LOGICAL_TIME)) / HOUR_MS;
        assert.ok(Number.isInteger(index) && index >= 0 && index < 24);
        evidenceLoads += 1;
        return structuredClone(evidenceForTickV1(scope, input.logical_time, index));
      },
    };
    const firstPayload = configs[0].payload as unknown as Cap04RuntimeConfigPayloadV1;
    const cropStageContext: ContinuationCropStageConfigurationContextV1 = {
      schema_version: "v1",
      dataset_id: "mcft_cap04_s8_postgresql_crop_stage_v1",
      context_class: "CONFIGURATION_DERIVED_CONTEXT",
      evidence_record: false,
      configuration_matrix_ref: "mcft_configuration_matrix_cap04_s8_db",
      configuration_matrix_hash: firstPayload.configuration_matrix_hash,
      crop_water_use_binding_ref: "crop_water_use_cap04_s8_db",
      crop_water_use_configuration_source_id: "crop_water_use_source_cap04_s8_db",
      crop_stage_mapping_source: "CONTROLLED_REPLAY_CONFIGURATION",
      timezone: "UTC",
      coverage_start: addHoursV1(START_LOGICAL_TIME, -24),
      coverage_end_exclusive: addHoursV1(START_LOGICAL_TIME, 120),
      crop_stage_schedule: [{
        stage_code: "CONTROLLED_STAGE_V1",
        effective_from: addHoursV1(START_LOGICAL_TIME, -24),
        effective_to: addHoursV1(START_LOGICAL_TIME, 120),
        kc: 1,
      }],
      limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
      determinism_hash: firstPayload.crop_stage_context.context_hash,
    };
    const persistence = persistenceAdapterV1(runtimeRepository, repository);
    const configRefs: Record<string, string> = {};
    const configHashes: Record<string, string> = {};
    for (const config of configs) {
      const payload = config.payload as unknown as Cap04RuntimeConfigPayloadV1;
      configRefs[payload.effective_logical_time] = config.object_id;
      configHashes[payload.effective_logical_time] = config.determinism_hash;
    }
    const commonInput = {
      scope,
      created_at: CREATED_AT,
      runtime_config_refs_by_logical_time: configRefs,
      runtime_config_hashes_by_logical_time: configHashes,
      authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
      crop_stage_context: cropStageContext,
      lease_duration_seconds: 300,
    };

    const handoff1 = new PrepareNextTickInputServiceV1(nextTickRepository);
    const inner1 = new Cap04ForecastScenarioSingleTickServiceV1(handoff1, source, runtimeRepository, persistence);
    const barrier1 = new Cap04PendingScenarioBarrierSingleTickServiceV1(handoff1, runtimeRepository, persistence, inner1);
    const rangeService1 = new Cap04ForecastScenarioRangeServiceV1(handoff1, barrier1);
    const process1 = await rangeService1.runContiguousRange({
      ...commonInput,
      to_logical_time: PROCESS_1_TARGET_LOGICAL_TIME,
      lease_owner: "mcft-cap04-s8-db-process-1",
    });
    assert.equal(process1.status, "COMPLETED");
    assert.equal(process1.executed_tick_count, 12);
    assert.equal(process1.final_handoff.previous_tick_sequence, 60);
    assert.equal(process1.final_handoff.next_logical_tick_time, "2026-06-03T14:00:00.000Z");
    ok("real PostgreSQL process 1 executes ticks 1 through 12 and persists sequence 60");
    await pool.query(
      `UPDATE twin_runtime_lease_v1
       SET acquired_at=transaction_timestamp()-interval '10 minutes',
           heartbeat_at=transaction_timestamp()-interval '5 minutes',
           expires_at=transaction_timestamp()-interval '1 second'
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      values,
    );
    ok("process 1 crash fixture explicitly expires its lease before fresh-process takeover");

    const handoff = new PrepareNextTickInputServiceV1(nextTickRepository);
    const inner2 = new Cap04ForecastScenarioSingleTickServiceV1(handoff, source, runtimeRepository, persistence);
    const barrier2 = new Cap04PendingScenarioBarrierSingleTickServiceV1(handoff, runtimeRepository, persistence, inner2);
    const rangeService = new Cap04ForecastScenarioRangeServiceV1(handoff, barrier2);
    const restartService = new Cap04ForecastScenarioRestartResumeServiceV1(handoff, rangeService);
    const process2 = await restartService.resumeFromCheckpoint({
      ...commonInput,
      to_logical_time: TARGET_LOGICAL_TIME,
      lease_owner: "mcft-cap04-s8-db-fresh-process-2",
    });
    assert.equal(process2.operator_intent, "RESUME");
    assert.equal(process2.persisted_start_logical_time, "2026-06-03T14:00:00.000Z");
    const result = process2.range_result;
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.executed_tick_count, 12);
    assert.equal(result.successful_a1_tick_count, 12);
    assert.equal(result.blocked_a2_tick_count, 0);
    assert.equal(result.posterior_state_count, 12);
    assert.equal(result.successful_forecast_run_count, 12);
    assert.equal(result.scenario_set_count, 12);
    assert.equal(result.forecast_point_count, 864);
    assert.equal(result.scenario_point_count, 2592);
    assert.equal(result.final_handoff.previous_tick_sequence, 72);
    assert.equal(result.final_handoff.next_logical_tick_time, FINAL_NEXT_LOGICAL_TIME);
    assert.equal(evidenceLoads, 24);
    ok("fresh PostgreSQL service composition resumes at tick 13 and executes ticks 13 through 24");

    const aTypes = [
      "twin_evidence_window_v1",
      "twin_state_transition_v1",
      "twin_assimilation_update_v1",
      "twin_state_estimate_v1",
      "twin_forecast_run_v1",
      "twin_runtime_tick_v1",
      "twin_runtime_checkpoint_v1",
      "twin_runtime_health_v1",
    ];
    const aFactCount = await countV1(
      `facts WHERE record_json->>'type'=ANY($1::text[])
       AND (record_json->'payload'->>'logical_time')::timestamptz >= $2::timestamptz
       AND (record_json->'payload'->>'logical_time')::timestamptz <= $3::timestamptz`,
      [aTypes, START_LOGICAL_TIME, TARGET_LOGICAL_TIME],
    );
    const bFactCount = await countV1(
      `facts WHERE record_json->>'type'='twin_scenario_set_v1'
       AND (record_json->'payload'->>'logical_time')::timestamptz >= $1::timestamptz
       AND (record_json->'payload'->>'logical_time')::timestamptz <= $2::timestamptz`,
      [START_LOGICAL_TIME, TARGET_LOGICAL_TIME],
    );
    const configFactCount = await countV1(
      `facts WHERE record_json->>'type'='twin_runtime_config_v1'
       AND (record_json->'payload'->>'logical_time')::timestamptz >= $1::timestamptz
       AND (record_json->'payload'->>'logical_time')::timestamptz <= $2::timestamptz`,
      [START_LOGICAL_TIME, TARGET_LOGICAL_TIME],
    );
    assert.equal(aFactCount, 192);
    assert.equal(bFactCount, 24);
    assert.equal(aFactCount + bFactCount, 216);
    assert.equal(configFactCount, 24);
    assert.equal(configFactCount + aFactCount + bFactCount, 240);
    ok("canonical facts equal 192 A members + 24 B sets + 24 Configs");

    assert.equal(await countV1("twin_terminal_tick_uniqueness_v1"), 24);
    assert.equal(await countV1("twin_scenario_set_uniqueness_v1"), 24);
    assert.equal(await countV1("twin_forecast_point_projection_v1"), 1728);
    assert.equal(await countV1("twin_scenario_point_projection_v1"), 5184);
    assert.equal(await countV1("twin_object_idempotency_index_v1 WHERE identity_kind='A1_RECORD_SET'"), 24);
    assert.equal(await countV1("twin_object_idempotency_index_v1 WHERE identity_kind='B_SCENARIO_SET'"), 24);
    ok("PostgreSQL uniqueness guards and point projections match frozen S7 cardinalities");

    const persisted = await handoff.prepareNextTickInput(scope);
    assert.equal(persisted.previous_tick_sequence, 72);
    assert.equal(persisted.next_logical_tick_time, FINAL_NEXT_LOGICAL_TIME);
    assert.equal(persisted.previous_forecast_result_ref, result.final_handoff.previous_forecast_result_ref);
    assert.equal(persisted.latest_successful_forecast_ref, result.final_handoff.latest_successful_forecast_ref);
    ok("canonical PostgreSQL handoff reads sequence 72 and the final successful Forecast pointer");

    const factCountBeforeReplay = await countV1("facts");
    const replayEnvelope = await restartService.resumeFromCheckpoint({
      ...commonInput,
      to_logical_time: TARGET_LOGICAL_TIME,
      lease_owner: "mcft-cap04-s8-db-completed-retry",
    });
    const replay = replayEnvelope.range_result;
    assert.equal(replay.status, "ALREADY_COMPLETE");
    assert.equal(replay.executed_tick_count, 0);
    assert.equal(await countV1("facts"), factCountBeforeReplay);
    assert.equal(evidenceLoads, 24);
    ok("completed PostgreSQL restart retry returns ALREADY_COMPLETE with zero new facts or Evidence loads");

    console.log(`MCFT-CAP-04 S8 restart/backfill DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
