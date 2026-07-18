// Purpose: preserve exact S8 Candidate/Evaluation authority, establish a same-scope CAP-04 PostgreSQL sequence-72 handoff through existing services, execute the next normal A1/B tick with a base-equivalent immutable Config, and prove non-consumption.
// Boundary: destructive isolated-database acceptance only; no production database, new Runtime math, governance append by S9, Model Activation, active-config write, new migration, route, Web, scheduler or CAP-07 authority.

import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  computeMemberDeterminismHashV1,
  semanticHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { materializeCap04TickRecoveryAuthorityV1 } from "../../apps/server/src/domain/twin_runtime/forecast_record_set_recovery_authority_v1.js";
import type { Cap04ARecordSetV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import {
  compileCap04RuntimeConfigV1,
  type Cap04RuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import {
  PostgresCalibrationGovernanceRepositoryV1,
  type Cap06GovernanceObjectV1,
} from "../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  Cap06PostEvaluationNonConsumptionTickServiceV1,
  type Cap06S9ReadPortV1,
} from "../../apps/server/src/runtime/calibration/post_evaluation_non_consumption_tick_service_v1.js";
import { Cap04ForecastScenarioRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_range_service_v1.js";
import {
  Cap04ForecastScenarioSingleTickServiceV1,
  type Cap04SingleTickPersistencePortV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { Cap04PendingScenarioBarrierSingleTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { CAP04_FIXTURE_SCOPE_V1 } from "./mcft_cap_04_contracts_config_fixture_v1.js";
import { buildCap04FutureForcingSnapshotV1 } from "./mcft_cap_04_future_forcing_fixture_v1.js";
import { buildCap04S6SingleTickFixtureV1 } from "./mcft_cap_04_single_tick_fixture_v1.js";

if (process.env.MCFT_CAP_06_S9_NON_CONSUMPTION_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_06_S9_NON_CONSUMPTION_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap06|s9|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CREATED_AT = "2026-07-18T08:10:00.000Z";
const RANGE_START_LOGICAL_TIME = "2026-06-03T03:00:00.000Z";
const RANGE_TARGET_LOGICAL_TIME = "2026-06-04T01:00:00.000Z";
const NEXT_LOGICAL_TIME = "2026-06-04T02:00:00.000Z";
const HOUR_MS = 3_600_000;
const CANDIDATE_REF = "twin_calibration_candidate_5649b9ab80b5545cf6007387";
const CANDIDATE_HASH = "sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65";
const EVALUATION_REF = "twin_shadow_evaluation_8cae1f6732420a4999deffc0";
const EVALUATION_HASH = "sha256:32c43020f45351994120515e5c633531bb594d85659456c65bd46305737d85e0";
const BASE_COEFFICIENT = "0.030000";
const LEASE_OWNER = "mcft-cap06-s9-db-acceptance";
const SCHEMA_FILES = [
  "docker/postgres/init/001_schema.sql",
  "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql",
  "apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql",
  "apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql",
  "apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql",
  "apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql",
  "apps/server/db/migrations/2026_07_17_mcft_cap_06_calibration_governance_persistence.sql",
] as const;
let pool: Pool | undefined;
let pass = 0;

function dbV1(): Pool {
  if (!pool) throw new Error("CAP06_S9_DB_POOL_NOT_OPEN");
  return pool;
}
function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}
function readSqlV1(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}
function recordJsonV1(object: { object_type: string }): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}
function factIdV1(objectId: string): string {
  return `fact_${objectId}`;
}
function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}
function fixed6V1(value: unknown, code: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(6);
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed.toFixed(6);
  }
  throw new Error(code);
}
function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}
function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}
async function countV1(fromClause: string, values: unknown[] = []): Promise<number> {
  const result = await dbV1().query(`SELECT count(*)::int AS count FROM ${fromClause}`, values);
  return Number(result.rows[0].count);
}
async function relationV1(name: string): Promise<string | null> {
  const result = await dbV1().query("SELECT to_regclass($1)::text AS relation", [name]);
  return result.rows[0].relation ?? null;
}
async function activeConfigSnapshotV1(): Promise<{ relation: string | null; hash: string | null }> {
  const relation = await relationV1("public.twin_active_config_index_v1");
  if (!relation) return { relation: null, hash: null };
  const result = await dbV1().query(
    `SELECT COALESCE(jsonb_agg(row_json ORDER BY row_json::text),'[]'::jsonb) AS rows
       FROM (SELECT to_jsonb(t) AS row_json FROM ${relation} t) s`,
  );
  return { relation, hash: semanticHashV1(result.rows[0].rows) };
}
function runChildV1(label: string, args: string[], env: Record<string, string>): void {
  const result = childProcess.spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl, ...env },
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 256 * 1024 * 1024,
    shell: false,
  });
  process.stdout.write(String(result.stdout || ""));
  process.stderr.write(String(result.stderr || ""));
  assert.equal(result.status, 0, `${label}_FAILED:${result.status}`);
}
async function openPoolV1(): Promise<void> {
  pool = new Pool({ connectionString: databaseUrl });
  await pool.query("SELECT 1");
}
async function closePoolV1(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
}
async function resetSchemaV1(): Promise<void> {
  await dbV1().query("DROP SCHEMA public CASCADE");
  await dbV1().query("CREATE SCHEMA public");
  for (const relativePath of SCHEMA_FILES) await dbV1().query(readSqlV1(relativePath));
}
async function insertGovernanceFactV1(object: Cap06GovernanceObjectV1): Promise<void> {
  await dbV1().query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s9_restore',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [factIdV1(object.object_id), object.logical_time, recordJsonV1(object)],
  );
  const exact = await dbV1().query(
    "SELECT record_json->'payload'->>'determinism_hash' AS hash FROM facts WHERE fact_id=$1",
    [factIdV1(object.object_id)],
  );
  assert.equal(exact.rows.length, 1);
  assert.equal(exact.rows[0].hash, object.determinism_hash, `CAP06_S9_RESTORED_FACT_HASH_MISMATCH:${object.object_id}`);
}
async function insertCanonicalFactV1(object: { object_id: string; object_type: string; logical_time: string }): Promise<void> {
  await dbV1().query(
    "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,'mcft_cap06_s9_same_scope_seed',$3::jsonb)",
    [factIdV1(object.object_id), object.logical_time, recordJsonV1(object)],
  );
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
    dataset_id: "mcft_cap06_s9_post_evaluation_tick_v1",
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
  const issuedAt = addMinutesV1(logicalTime, -45);
  const availableAt = addMinutesV1(logicalTime, -30);
  return [
    evidenceV1({
      scope,
      record_type: "observed_rainfall_v1",
      source_record_id: `rain_cap06_s9_${suffix}`,
      binding_id: "rainfall_c8_hourly_v1",
      origin_source_id: "weather_replay_cap06_s9",
      role_time: { interval_start: addHoursV1(logicalTime, -1), interval_end: logicalTime, ingested_at: ingestedAt },
      canonical_payload: { value: Number((0.2 + (index % 4) * 0.1).toFixed(6)), unit: "mm" },
      source_unit: "mm",
      canonical_unit: "mm",
    }),
    evidenceV1({
      scope,
      record_type: "historical_et0_estimate_v1",
      source_record_id: `et0_cap06_s9_${suffix}`,
      binding_id: "historical_et0_c8_hourly_v1",
      origin_source_id: "et0_replay_cap06_s9",
      role_time: { interval_start: addHoursV1(logicalTime, -1), interval_end: logicalTime, ingested_at: ingestedAt },
      canonical_payload: {
        value: Number((0.1 + (index % 3) * 0.01).toFixed(6)),
        unit: "mm",
        calculation_method: "FAO56_PM_REPLAY_V1",
        method_version: "1",
      },
      source_unit: "mm",
      canonical_unit: "mm",
    }),
    evidenceV1({
      scope,
      record_type: "soil_moisture_observation_v1",
      source_record_id: `soil_cap06_s9_${suffix}`,
      binding_id: "soil_obs_c8_20cm_v1",
      origin_source_id: "soil_sensor_cap06_s9",
      role_time: { observed_at: addMinutesV1(logicalTime, -10), ingested_at: ingestedAt },
      canonical_payload: {
        value: Number((0.31 - index * 0.0005).toFixed(6)),
        unit: "fraction",
        quantity_kind: "VOLUMETRIC_WATER_CONTENT",
      },
      source_unit: "fraction",
      canonical_unit: "fraction",
    }),
    buildCap04FutureForcingSnapshotV1({
      kind: "weather",
      logical_time: logicalTime,
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      source_record_id: `weather_cap06_s9_${suffix}`,
      seed: 300 + index,
      scope_override: scope,
    }),
    buildCap04FutureForcingSnapshotV1({
      kind: "et0",
      logical_time: logicalTime,
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      source_record_id: `future_et0_cap06_s9_${suffix}`,
      seed: 300 + index,
      scope_override: scope,
    }),
  ];
}
function exactScopeV1(object: Cap06GovernanceObjectV1): TwinScopeKeyV1 {
  return {
    tenant_id: object.scope.tenant_id,
    project_id: object.scope.project_id,
    group_id: object.scope.group_id,
    field_id: object.scope.field_id,
    season_id: object.scope.season_id,
    zone_id: object.scope.zone_id,
  };
}
function memberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP06_S9_SEED_MEMBER_CARDINALITY:${objectType}:${matches.length}`);
  return matches[0];
}
function buildSeedLineageV1(input: {
  scope: TwinScopeKeyV1;
  objectId: string;
  lineageId: string;
  revisionId: string;
  logicalTime: string;
}): CanonicalObjectEnvelopeV1 {
  const lineage: CanonicalObjectEnvelopeV1 = {
    object_id: input.objectId,
    object_type: "twin_runtime_lineage_v1",
    schema_version: "v1",
    ...input.scope,
    logical_time: input.logicalTime,
    as_of: input.logicalTime,
    source_refs: ["mcft_cap06_s9_same_scope_seed"],
    evidence_refs: [],
    runtime_config_ref: null,
    runtime_config_hash: null,
    idempotency_key: `mcft_cap06_s9_seed_${input.objectId}`,
    determinism_hash: "",
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
    created_at: CREATED_AT,
    lineage_id: input.lineageId,
    revision_id: input.revisionId,
    payload: {
      lineage_kind: "INITIAL",
      parent_lineage_ref: null,
      revision_run_ref: null,
      promotion_ref: null,
      activation_authority_ref: input.objectId,
      initial_revision_id: input.revisionId,
    },
  };
  lineage.determinism_hash = computeMemberDeterminismHashV1(lineage as unknown as Record<string, unknown>);
  return lineage;
}
function compileConfigRangeV1(input: {
  scope: TwinScopeKeyV1;
  parent: CanonicalObjectEnvelopeV1;
  firstLogicalTime: string;
  count: number;
}): CanonicalObjectEnvelopeV1[] {
  const authority = input.parent.payload as unknown as Cap04RuntimeConfigPayloadV1;
  const configs: CanonicalObjectEnvelopeV1[] = [];
  let parent = input.parent;
  for (let index = 0; index < input.count; index += 1) {
    const config = compileCap04RuntimeConfigV1({
      scope: input.scope,
      effective_logical_time: addHoursV1(input.firstLogicalTime, index),
      created_at: CREATED_AT,
      parent_runtime_config_ref: parent.object_id,
      parent_runtime_config_hash: parent.determinism_hash,
      reality_binding_ref: String(authority.reality_binding_ref),
      reality_binding_hash: String(authority.reality_binding_hash),
      source_matrix_hash: String(authority.source_matrix_hash),
      configuration_matrix_hash: String(authority.configuration_matrix_hash),
      geometry_semantic_hash: String(authority.geometry_semantic_hash),
    });
    configs.push(config);
    parent = config;
  }
  return configs;
}
async function seedSameScopeCap04HandoffV1(input: {
  scope: TwinScopeKeyV1;
  runtimeRepository: PostgresRuntimeRepositoryV1;
  nextTickRepository: PostgresNextTickRepositoryV1;
  recoveryRepository: PostgresForecastScenarioRecoveryRepositoryV1;
}): Promise<CanonicalObjectEnvelopeV1> {
  const fixture = buildCap04S6SingleTickFixtureV1();
  assert.deepEqual(fixture.input.scope, input.scope);
  const seedResult = await fixture.service.executeOneTick(fixture.input);
  assert.equal(seedResult.status, "INSERTED");
  assert.ok(seedResult.b_record);
  const seedA = materializeCap04TickRecoveryAuthorityV1(seedResult.a_record_set);
  const seedB = seedResult.b_record;
  const snapshot = fixture.runtime.currentSnapshotV1();
  assert.equal(seedA.operation_key.lineage_id, snapshot.active_lineage_id);
  assert.equal(memberV1(seedA, "twin_runtime_checkpoint_v1").payload.tick_sequence, 49);
  assert.equal(memberV1(seedA, "twin_runtime_checkpoint_v1").payload.next_tick_logical_time, RANGE_START_LOGICAL_TIME);

  await input.runtimeRepository.commitRuntimeConfig(fixture.runtime_config);
  await input.nextTickRepository.commitRealityBindingSnapshot(snapshot.reality_binding);
  const lineage = buildSeedLineageV1({
    scope: input.scope,
    objectId: snapshot.active_lineage_ref,
    lineageId: snapshot.active_lineage_id,
    revisionId: seedA.operation_key.revision_id,
    logicalTime: seedA.operation_key.logical_time,
  });
  await insertCanonicalFactV1(lineage);
  for (const member of seedA.members) await insertCanonicalFactV1(member);
  await insertCanonicalFactV1(seedB.scenario_set);

  const state = memberV1(seedA, "twin_state_estimate_v1");
  const forecast = memberV1(seedA, "twin_forecast_run_v1");
  const checkpoint = memberV1(seedA, "twin_runtime_checkpoint_v1");
  const health = memberV1(seedA, "twin_runtime_health_v1");
  const values = scopeValuesV1(input.scope);
  await dbV1().query(
    `INSERT INTO twin_active_lineage_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,active_lineage_ref,activation_authority_kind,activation_authority_ref,expected_previous_active_lineage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'CONTROLLED_REPLAY','mcft_cap06_s9_same_scope_seed',NULL)`,
    [...values, lineage.object_id],
  );
  await dbV1().query(
    `INSERT INTO twin_state_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,state_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)`,
    [...values, state.object_id, state.lineage_id, state.revision_id, state.logical_time, state.determinism_hash, factIdV1(state.object_id)],
  );
  await dbV1().query(
    `INSERT INTO twin_forecast_result_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,forecast_status,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11)`,
    [...values, forecast.object_id, String(forecast.payload.status), forecast.logical_time, forecast.determinism_hash, factIdV1(forecast.object_id)],
  );
  await dbV1().query(
    `INSERT INTO twin_forecast_success_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10)`,
    [...values, forecast.object_id, forecast.logical_time, forecast.determinism_hash, factIdV1(forecast.object_id)],
  );
  await dbV1().query(
    `INSERT INTO twin_runtime_checkpoint_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,checkpoint_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)`,
    [...values, checkpoint.object_id, checkpoint.lineage_id, checkpoint.revision_id, checkpoint.logical_time, checkpoint.determinism_hash, factIdV1(checkpoint.object_id)],
  );
  await dbV1().query(
    `INSERT INTO twin_runtime_health_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,health_object_id,operation_status,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11)`,
    [...values, health.object_id, String(health.payload.operation_status), health.logical_time, health.determinism_hash, factIdV1(health.object_id)],
  );

  assert.equal((await input.recoveryRepository.readARecordSet(seedA.record_set_id))?.aggregate_determinism_hash, seedA.aggregate_determinism_hash);
  assert.equal((await input.recoveryRepository.readScenarioSet(seedB.scenario_set_id))?.aggregate_determinism_hash, seedB.aggregate_determinism_hash);
  await input.recoveryRepository.rebuildForecastProjections(seedA.record_set_id);
  await input.recoveryRepository.rebuildScenarioProjections(seedB.scenario_set_id);
  const persisted = await input.nextTickRepository.readPersistedNextTickSnapshot(input.scope);
  assert.ok(persisted);
  assert.equal(persisted.checkpoint.payload.tick_sequence, 49);
  assert.equal(persisted.checkpoint.payload.next_tick_logical_time, RANGE_START_LOGICAL_TIME);
  return fixture.runtime_config;
}

async function main(): Promise<void> {
  runChildV1(
    "S8_GOVERNANCE_CAPTURE",
    ["-w", "exec", "tsx", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DB.ts"],
    { MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DESTRUCTIVE_ACCEPTANCE: "1" },
  );
  await openPoolV1();
  const capturedRepository = new PostgresCalibrationGovernanceRepositoryV1(dbV1());
  const capturedCandidate = await capturedRepository.readCanonicalObject(CANDIDATE_REF);
  const capturedEvaluation = await capturedRepository.readCanonicalObject(EVALUATION_REF);
  assert.ok(capturedCandidate && capturedEvaluation);
  assert.equal(capturedCandidate.determinism_hash, CANDIDATE_HASH);
  assert.equal(capturedEvaluation.determinism_hash, EVALUATION_HASH);
  const candidate = structuredClone(capturedCandidate);
  const evaluation = structuredClone(capturedEvaluation);
  await resetSchemaV1();
  await insertGovernanceFactV1(candidate);
  await insertGovernanceFactV1(evaluation);
  const calibrationRepository = new PostgresCalibrationGovernanceRepositoryV1(dbV1());
  const rebuild = await calibrationRepository.rebuildFromFacts();
  assert.deepEqual(rebuild, {
    canonical_objects_scanned: 2,
    idempotency_guards_rebuilt: 2,
    candidate_projections_rebuilt: 1,
    evaluation_projections_rebuilt: 1,
    candidate_evaluation_rows_rebuilt: 1,
    evaluation_case_rows_rebuilt: 8,
  });
  assert.equal((await calibrationRepository.readCanonicalObject(CANDIDATE_REF))?.determinism_hash, CANDIDATE_HASH);
  assert.equal((await calibrationRepository.readCanonicalObject(EVALUATION_REF))?.determinism_hash, EVALUATION_HASH);
  ok("exact S8 Candidate and Evaluation survive a fresh isolated PostgreSQL rebuild");

  const scope = exactScopeV1(candidate);
  assert.deepEqual(scope, CAP04_FIXTURE_SCOPE_V1);
  assert.deepEqual(exactScopeV1(evaluation), scope);
  const runtimeRepository = new PostgresRuntimeRepositoryV1(dbV1());
  const nextTickRepository = new PostgresNextTickRepositoryV1(dbV1());
  const recoveryRepository = new PostgresForecastScenarioRecoveryRepositoryV1(dbV1());
  const seedConfig = await seedSameScopeCap04HandoffV1({
    scope,
    runtimeRepository,
    nextTickRepository,
    recoveryRepository,
  });
  ok("same-scope CAP-04 canonical seed establishes sequence 49 with exact PostgreSQL recovery authority");

  const rangeConfigs = compileConfigRangeV1({
    scope,
    parent: seedConfig,
    firstLogicalTime: RANGE_START_LOGICAL_TIME,
    count: 23,
  });
  for (const config of rangeConfigs) await runtimeRepository.commitRuntimeConfig(config);
  const configRefs: Record<string, string> = {};
  const configHashes: Record<string, string> = {};
  for (const config of rangeConfigs) {
    configRefs[config.logical_time] = config.object_id;
    configHashes[config.logical_time] = config.determinism_hash;
  }
  const seedPayload = seedConfig.payload as unknown as Cap04RuntimeConfigPayloadV1;
  const cropStageContext: ContinuationCropStageConfigurationContextV1 = {
    schema_version: "v1",
    dataset_id: "mcft_cap06_s9_crop_stage_v1",
    context_class: "CONFIGURATION_DERIVED_CONTEXT",
    evidence_record: false,
    configuration_matrix_ref: "mcft_configuration_matrix_cap06_s9",
    configuration_matrix_hash: seedPayload.configuration_matrix_hash,
    crop_water_use_binding_ref: "crop_water_use_cap06_s9",
    crop_water_use_configuration_source_id: "crop_water_use_source_cap06_s9",
    crop_stage_mapping_source: "CONTROLLED_REPLAY_CONFIGURATION",
    timezone: "UTC",
    coverage_start: addHoursV1(RANGE_START_LOGICAL_TIME, -24),
    coverage_end_exclusive: addHoursV1(NEXT_LOGICAL_TIME, 120),
    crop_stage_schedule: [{
      stage_code: "CONTROLLED_STAGE_V1",
      effective_from: addHoursV1(RANGE_START_LOGICAL_TIME, -24),
      effective_to: addHoursV1(NEXT_LOGICAL_TIME, 120),
      kc: 1,
    }],
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
    determinism_hash: seedPayload.crop_stage_context.context_hash,
  };
  let evidenceLoads = 0;
  const source: ReplayEvidenceSourcePortV1 = {
    async loadCandidateRecords(input) {
      assert.deepEqual(input.scope, scope);
      const index = (Date.parse(input.logical_time) - Date.parse(RANGE_START_LOGICAL_TIME)) / HOUR_MS;
      assert.ok(Number.isInteger(index) && index >= 0 && index <= 23);
      evidenceLoads += 1;
      return structuredClone(evidenceForTickV1(scope, input.logical_time, index + 1));
    },
  };
  const handoff = new PrepareNextTickInputServiceV1(nextTickRepository);
  const persistence = persistenceAdapterV1(runtimeRepository, recoveryRepository);
  const inner = new Cap04ForecastScenarioSingleTickServiceV1(handoff, source, runtimeRepository, persistence);
  const barrier = new Cap04PendingScenarioBarrierSingleTickServiceV1(handoff, runtimeRepository, persistence, inner);
  const rangeService = new Cap04ForecastScenarioRangeServiceV1(handoff, barrier);
  const range = await rangeService.runContiguousRange({
    scope,
    to_logical_time: RANGE_TARGET_LOGICAL_TIME,
    created_at: CREATED_AT,
    runtime_config_refs_by_logical_time: configRefs,
    runtime_config_hashes_by_logical_time: configHashes,
    authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: cropStageContext,
    lease_owner: LEASE_OWNER,
    lease_duration_seconds: 300,
  });
  assert.equal(range.status, "COMPLETED");
  assert.equal(range.executed_tick_count, 23);
  assert.equal(range.final_handoff.previous_tick_sequence, 72);
  assert.equal(range.final_handoff.next_logical_tick_time, NEXT_LOGICAL_TIME);
  assert.equal(evidenceLoads, 23);
  const persisted = await nextTickRepository.readPersistedNextTickSnapshot(scope);
  assert.ok(persisted);
  assert.equal(persisted.checkpoint.payload.tick_sequence, 72);
  assert.equal(persisted.checkpoint.payload.next_tick_logical_time, NEXT_LOGICAL_TIME);
  ok("Candidate/Evaluation scope now owns a real 24-Tick CAP-04 PostgreSQL chain ending at sequence 72");

  const parentPayload = persisted.runtime_config.payload as unknown as Cap04RuntimeConfigPayloadV1;
  const nextConfig = compileCap04RuntimeConfigV1({
    scope,
    effective_logical_time: NEXT_LOGICAL_TIME,
    created_at: CREATED_AT,
    parent_runtime_config_ref: persisted.runtime_config.object_id,
    parent_runtime_config_hash: persisted.runtime_config.determinism_hash,
    reality_binding_ref: String(parentPayload.reality_binding_ref),
    reality_binding_hash: String(parentPayload.reality_binding_hash),
    source_matrix_hash: String(parentPayload.source_matrix_hash),
    configuration_matrix_hash: String(parentPayload.configuration_matrix_hash),
    geometry_semantic_hash: String(parentPayload.geometry_semantic_hash),
  });
  assert.equal(
    fixed6V1((nextConfig.payload as Record<string, any>).dynamics_parameters.drainage_coefficient_per_hour, "S9_CONFIG_DRAINAGE_INVALID"),
    BASE_COEFFICIENT,
  );
  const configCountBefore = await countV1("facts WHERE record_json->>'type'='twin_runtime_config_v1'");
  await runtimeRepository.commitRuntimeConfig(nextConfig);
  const configCountAfter = await countV1("facts WHERE record_json->>'type'='twin_runtime_config_v1'");
  assert.equal(configCountAfter - configCountBefore, 1);

  const tickInput = {
    scope,
    logical_time: NEXT_LOGICAL_TIME,
    created_at: CREATED_AT,
    runtime_config_ref: nextConfig.object_id,
    runtime_config_hash: nextConfig.determinism_hash,
    authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: cropStageContext,
    lease_owner: LEASE_OWNER,
    lease_duration_seconds: 300,
  };
  const readPort: Cap06S9ReadPortV1 = {
    readCanonicalObject: calibrationRepository.readCanonicalObject.bind(calibrationRepository),
    async readRuntimeAuthoritySnapshot(input) {
      const config = await runtimeRepository.readRuntimeConfig(input.runtime_config_ref);
      if (!config || config.determinism_hash !== input.runtime_config_hash) throw new Error("S9_CONFIG_EXACT_READBACK_FAILED");
      const payload = config.payload as Record<string, any>;
      const active = await activeConfigSnapshotV1();
      return {
        scope: structuredClone(input.scope),
        inspected_runtime_config_ref: config.object_id,
        inspected_runtime_config_hash: config.determinism_hash,
        effective_drainage_coefficient_per_hour: payload.dynamics_parameters.drainage_coefficient_per_hour,
        runtime_config_semantic_payload: structuredClone(payload),
        active_config_relation: active.relation,
        active_config_snapshot_hash: active.hash,
        model_activation_count: await countV1("facts WHERE record_json->>'type'='twin_model_activation_v1'"),
        candidate_fact_count: await countV1("facts WHERE record_json->>'type'='twin_calibration_candidate_v1'"),
        evaluation_fact_count: await countV1("facts WHERE record_json->>'type'='twin_shadow_evaluation_v1'"),
      };
    },
  };
  const service = new Cap06PostEvaluationNonConsumptionTickServiceV1(readPort, barrier);
  const request = {
    candidate_ref: CANDIDATE_REF,
    candidate_hash: CANDIDATE_HASH,
    evaluation_ref: EVALUATION_REF,
    evaluation_hash: EVALUATION_HASH,
    expected_candidate_parameter_value: "0.034000",
    tick_input: tickInput,
  };

  const factsBeforeTick = await countV1("facts");
  const candidateFactsBefore = await countV1("facts WHERE record_json->>'type'='twin_calibration_candidate_v1'");
  const evaluationFactsBefore = await countV1("facts WHERE record_json->>'type'='twin_shadow_evaluation_v1'");
  const activationBefore = await countV1("facts WHERE record_json->>'type'='twin_model_activation_v1'");
  const activeConfigBefore = await activeConfigSnapshotV1();
  const first = await service.execute(request);
  assert.equal(first.status, "INSERTED");
  assert.equal(first.effective_tick_parameter_value, BASE_COEFFICIENT);
  const factsAfterTick = await countV1("facts");
  assert.equal(factsAfterTick - factsBeforeTick, 9);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_calibration_candidate_v1'"), candidateFactsBefore);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_shadow_evaluation_v1'"), evaluationFactsBefore);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_model_activation_v1'"), activationBefore);
  assert.deepEqual(await activeConfigSnapshotV1(), activeConfigBefore);
  assert.equal(await countV1("twin_forecast_point_projection_v1 WHERE forecast_object_id=$1", [first.forecast_ref]), 72);
  assert.equal(await countV1("twin_scenario_point_projection_v1 WHERE scenario_set_id=$1", [first.scenario_set_ref]), 216);
  ok("the real same-scope sequence-73 PostgreSQL A1/B tick appends eight A1 facts and one Scenario fact without governance consumption");

  const evidenceLoadsAfterFirst = evidenceLoads;
  const factsBeforeReplay = await countV1("facts");
  const replay = await service.execute(request);
  assert.equal(replay.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(replay.forecast_hash, first.forecast_hash);
  assert.equal(replay.scenario_set_hash, first.scenario_set_hash);
  assert.equal(await countV1("facts"), factsBeforeReplay);
  assert.equal(evidenceLoads, evidenceLoadsAfterFirst);
  assert.deepEqual(await activeConfigSnapshotV1(), activeConfigBefore);
  ok("the completed S9 tick rerun performs zero canonical writes and zero Evidence selection");

  const beforeWrongHash = await countV1("facts");
  await assert.rejects(service.execute({ ...request, candidate_hash: "sha256:wrong" }), /CAP06_S9_CANDIDATE_HASH_MISMATCH/);
  assert.equal(await countV1("facts"), beforeWrongHash);
  ok("wrong Candidate hash fails before Runtime execution and leaves PostgreSQL unchanged");

  const output = {
    schema_version: "geox_mcft_cap_06_s9_non_consumption_db_result_v1",
    status: "PASS",
    candidate_ref: CANDIDATE_REF,
    candidate_hash: CANDIDATE_HASH,
    evaluation_ref: EVALUATION_REF,
    evaluation_hash: EVALUATION_HASH,
    candidate_parameter_value: "0.034000",
    effective_tick_parameter_value: BASE_COEFFICIENT,
    governance_runtime_scope_match: true,
    same_scope_precondition_tick_count: 24,
    same_scope_precondition_final_sequence: 72,
    immutable_runtime_config_append_count: 1,
    normal_tick_canonical_fact_append_count: factsAfterTick - factsBeforeTick,
    a1_canonical_fact_append_count: 8,
    scenario_set_canonical_fact_append_count: 1,
    forecast_ref: first.forecast_ref,
    forecast_hash: first.forecast_hash,
    forecast_point_count: first.forecast_point_count,
    scenario_set_ref: first.scenario_set_ref,
    scenario_set_hash: first.scenario_set_hash,
    scenario_option_count: first.scenario_option_count,
    scenario_points_per_option: first.scenario_points_per_option,
    candidate_fact_delta: 0,
    evaluation_fact_delta: 0,
    model_activation_count: 0,
    active_config_relation: activeConfigBefore.relation,
    active_config_snapshot_changed: false,
    candidate_consumed: false,
    evaluation_consumed: false,
    completed_rerun_additional_fact_count: 0,
    completed_rerun_evidence_load_count: 0,
    state_parameter_mutation_count: 0,
    checkpoint_parameter_mutation_count: 0,
    migration_count: 0,
    production_database_used: false,
    pass_count: pass,
  };
  fs.mkdirSync(path.join(ROOT, "acceptance-output"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "acceptance-output/MCFT_CAP_06_S9_NON_CONSUMPTION_DB_RESULT.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(output));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}).finally(async () => {
  try { await closePoolV1(); } catch {}
});
