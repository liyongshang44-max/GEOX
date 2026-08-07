// MCFT-CAP-09 S6 production-equivalent shadow simulator.
// The physical source is simulated; canonical ingress, A0, scheduler, checkpoint,
// State, Forecast and Scenario execution use the production Runtime implementations.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient, type QueryResult } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { A0BootstrapRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.js";
import type { Cap04SingleTickPersistencePortV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { PostgresCap04ShadowOnlineCanonicalTickAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_cap04_shadow_online_canonical_tick_adapter_v1.js";
import {
  PRODUCTION_EQUIVALENT_SIMULATION_EVIDENCE_INGRESS_CONFIG_V1,
  PostgresEvidenceIngressAdapterV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import { PostgresExpiredSlotRecoveryAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_expired_slot_recovery_adapter_v1.js";
import { PostgresFrozenShadowOnlineEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_frozen_shadow_online_evidence_source_v1.js";
import { PostgresPersistentSequentialSchedulerAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import { RestartBackfillStaleDetectionServiceV1 } from "../../apps/server/src/runtime/twin_runtime/restart_backfill_stale_detection_service_v1.js";
import { ShadowOnlineCanonicalIntegrationServiceV1 } from "../../apps/server/src/runtime/twin_runtime/shadow_online_canonical_integration_service_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import type { SchedulerPortV1, ShadowOnlineSlotIdV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildSimulationSourceSubstitutionAuthoritySeedV1, sameScopeV1 } from "./mcft_cap09_s6_formal_authority_v1.js";
import {
  SIMULATION_SOURCE_LANE_V1,
  buildSimulationWindowV1,
  simulationLeaseOwnerV1,
  type SimulationEvidenceRecordV1,
  type SimulationHourV1,
  type SimulationOperationV1,
} from "./mcft_cap09_s6_production_equivalent_simulator_v1.js";

const HOUR_MS = 3_600_000;
const OUT = path.resolve("acceptance-output/MCFT_CAP_09_S6_PRODUCTION_EQUIVALENT_SIMULATION_RESULT.json");
const SOURCE = "mcft_cap09_production_equivalent_simulation_v1";
const FORBIDDEN = ["twin_decision_record_v1", "twin_recommendation_v1", "decision_recommendation_v1", "approval_request_v1", "ao_act_task_v1", "ao_act_receipt_v1", "dispatch_request_v1", "model_activation_v1"];
const CROP_STAGE_CONTEXT = JSON.parse(fs.readFileSync(
  path.resolve("fixtures/mcft/water_state/replay_v1/configuration_context.json"),
  "utf8",
)) as ContinuationCropStageConfigurationContextV1;
const AUTHORIZED_FUTURE_FORCING_BINDINGS = [
  "weather_assumption_c8_replay_v1",
  "et0_future_assumption_c8_v1",
] as const;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function json<T>(name: string): T {
  try { return JSON.parse(required(name)) as T; } catch { throw new Error(`${name}_JSON_INVALID`); }
}

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value, null, 2));
}

function eventTime(record: SimulationEvidenceRecordV1): string {
  for (const field of ["observed_at", "interval_end", "issued_at"] as const) {
    const value = record.role_time[field];
    if (typeof value === "string") return value;
  }
  throw new Error(`SIMULATION_EVENT_TIME_MISSING:${record.source_record_id}`);
}

function factId(record: SimulationEvidenceRecordV1): string {
  return `mcft_cap09_sim_${semanticHashV1({ source_record_id: record.source_record_id, source_record_hash: record.source_record_hash }).replace("sha256:", "").slice(0, 32)}`;
}

function transactionBoundPool(client: PoolClient): Pool {
  let savepoint = 0;
  return {
    query: client.query.bind(client),
    connect: async () => {
      const name = `mcft_cap09_sim_nested_${++savepoint}`;
      let active = false;
      return {
        async query(text: string, values?: unknown[]): Promise<QueryResult> {
          const command = text.trim().toUpperCase();
          if (command.startsWith("BEGIN")) {
            assert(!active, "SIMULATION_NESTED_TRANSACTION_REENTRY");
            active = true;
            return client.query(`SAVEPOINT ${name}`);
          }
          if (command === "COMMIT") {
            assert(active, "SIMULATION_NESTED_COMMIT_WITHOUT_BEGIN");
            active = false;
            return client.query(`RELEASE SAVEPOINT ${name}`);
          }
          if (command === "ROLLBACK") {
            if (active) {
              await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
              active = false;
              return client.query(`RELEASE SAVEPOINT ${name}`);
            }
            return { rows: [], rowCount: 0 } as unknown as QueryResult;
          }
          return client.query(text, values);
        },
        release(): void { assert(!active, "SIMULATION_NESTED_TRANSACTION_NOT_TERMINAL"); },
      };
    },
  } as unknown as Pool;
}

function persistence(runtime: PostgresRuntimeRepositoryV1, repository: PostgresForecastScenarioRecoveryRepositoryV1): Cap04SingleTickPersistencePortV1 {
  return {
    acquireLease: runtime.acquireLease.bind(runtime),
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

function schedulerObservedAtV1(inner: SchedulerPortV1, observedAt: string): SchedulerPortV1 {
  return {
    claimDueSlot: inner.claimDueSlot.bind(inner),
    async listMissedSlots(input) {
      return (await inner.listMissedSlots(input)).map((boundary) => ({
        ...boundary,
        scheduler_wall_clock_observed_at: observedAt,
      }));
    },
    recordTerminalResult: inner.recordTerminalResult.bind(inner),
  };
}

function assertSimulationLogicalWindowCoveredV1(start: string): void {
  const first = Date.parse(start);
  const last = first + 23 * HOUR_MS;
  assert(first >= Date.parse(CROP_STAGE_CONTEXT.coverage_start), "SIMULATION_LOGICAL_WINDOW_BEFORE_CONTEXT_COVERAGE");
  assert(last < Date.parse(CROP_STAGE_CONTEXT.coverage_end_exclusive), "SIMULATION_LOGICAL_WINDOW_AFTER_CONTEXT_COVERAGE");
  for (let index = 0; index < 24; index += 1) {
    const logical = first + index * HOUR_MS;
    const matches = CROP_STAGE_CONTEXT.crop_stage_schedule.filter(
      (stage) => logical >= Date.parse(stage.effective_from) && logical < Date.parse(stage.effective_to),
    );
    assert.equal(matches.length, 1, "SIMULATION_LOGICAL_TIME_EXACT_CROP_STAGE_REQUIRED");
  }
}

async function assertIsolatedSimulationDatabase(pool: Pool): Promise<{
  database: string;
  user: string;
  environment_id: string;
  neon_project_id: string;
  neon_branch_id: string;
}> {
  assert.equal(required("MCFT_CAP09_S6_SIMULATION_ONLY"), "1", "SIMULATION_ONLY_ACKNOWLEDGEMENT_REQUIRED");
  const environmentId = required("MCFT_CAP09_S6_SIMULATION_ENVIRONMENT_ID");
  assert(/(?:simulat|shadow)/i.test(environmentId), "SIMULATION_ENVIRONMENT_ID_MARKER_REQUIRED");
  const expected = required("MCFT_CAP09_S6_SIMULATION_DATABASE_NAME");
  const expectedProjectId = required("MCFT_CAP09_S6_SIMULATION_NEON_PROJECT_ID");
  const expectedBranchId = required("MCFT_CAP09_S6_SIMULATION_NEON_BRANCH_ID");
  assert.match(expectedProjectId, /^[a-z0-9-]+$/, "SIMULATION_NEON_PROJECT_ID_INVALID");
  assert.match(expectedBranchId, /^br-[a-z0-9-]+$/, "SIMULATION_NEON_BRANCH_ID_INVALID");
  const identity = (await pool.query(
    "SELECT current_database() AS database,current_user AS user,current_setting('neon.project_id',true) AS neon_project_id,current_setting('neon.branch_id',true) AS neon_branch_id",
  )).rows[0];
  assert.equal(String(identity.database), expected, "SIMULATION_DATABASE_IDENTITY_MISMATCH");
  assert.equal(String(identity.neon_project_id), expectedProjectId, "SIMULATION_NEON_PROJECT_ID_MISMATCH");
  assert.equal(String(identity.neon_branch_id), expectedBranchId, "SIMULATION_NEON_BRANCH_ID_MISMATCH");
  const formalSources = await pool.query(
    "SELECT count(*)::int AS n FROM facts WHERE source='mcft_cap09_formal_external_evidence_v1'",
  );
  assert.equal(Number(formalSources.rows[0].n), 0, "SIMULATION_DATABASE_FORMAL_EVIDENCE_CONTAMINATION");
  return {
    database: String(identity.database), user: String(identity.user), environment_id: environmentId,
    neon_project_id: String(identity.neon_project_id), neon_branch_id: String(identity.neon_branch_id),
  };
}

async function insertHour(pool: Pool, hour: SimulationHourV1): Promise<{ inserted: number; idempotent: number }> {
  let inserted = 0;
  let idempotent = 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const record of hour.records) {
      assert.equal(record.formal_eligible, false);
      assert.equal(record.is_simulated, true);
      assert.equal(record.evidence_level, "SIMULATION");
      assert.equal(record.source_lane, SIMULATION_SOURCE_LANE_V1);
      const wrapper = { type: record.record_type, payload: record };
      const result = await client.query(
        `INSERT INTO facts(fact_id,occurred_at,source,record_json)
         VALUES($1,$2::timestamptz,$3,$4::jsonb)
         ON CONFLICT(fact_id) DO NOTHING RETURNING fact_id`,
        [factId(record), eventTime(record), SOURCE, JSON.stringify(wrapper)],
      );
      if (result.rows.length === 1) inserted += 1;
      else {
        const existing = await client.query(
          "SELECT source,record_json=$2::jsonb AS equal FROM facts WHERE fact_id=$1",
          [factId(record), JSON.stringify(wrapper)],
        );
        assert.equal(existing.rows.length, 1, `SIMULATION_IDEMPOTENCY_ROW_REQUIRED:${record.source_record_id}`);
        assert.equal(existing.rows[0].source, SOURCE, `SIMULATION_IDEMPOTENCY_SOURCE_MISMATCH:${record.source_record_id}`);
        assert.equal(existing.rows[0].equal, true, `SIMULATION_IDEMPOTENCY_CONFLICT:${record.source_record_id}`);
        idempotent += 1;
      }
    }
    await client.query("COMMIT");
    return { inserted, idempotent };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function bootstrap(pool: Pool, input: {
  leaseOwner: string;
  scope: TwinScopeKeyV1;
  start: string;
  bootstrapEvidence: SimulationHourV1;
}): Promise<Record<string, unknown>> {
  const bundle = buildSimulationSourceSubstitutionAuthoritySeedV1(input.start);
  assert(sameScopeV1(input.scope, bundle.scope), "SIMULATION_BOOTSTRAP_SCOPE_MISMATCH");
  await insertHour(pool, input.bootstrapEvidence);
  const evidence = new PostgresEvidenceIngressAdapterV1(pool, PRODUCTION_EQUIVALENT_SIMULATION_EVIDENCE_INGRESS_CONFIG_V1);
  const frozen = await evidence.freezeEligibleEvidence({
    boundary: {
      scope: input.scope,
      slot_id: "O00",
      logical_time: bundle.bootstrap_logical_time,
      interval_seconds: 3600,
      scheduler_wall_clock_observed_at: bundle.bootstrap_logical_time,
    },
  });
  assert(frozen.actual_observation_count > 0, "SIMULATION_BOOTSTRAP_OBSERVATION_REQUIRED");
  assert.equal(frozen.eligible_future_forcing_count, 2, "SIMULATION_BOOTSTRAP_FUTURE_FORCING_PAIR_REQUIRED");
  const existing = await new PostgresNextTickRepositoryV1(pool).readPersistedNextTickSnapshot(input.scope);
  if (existing) {
    assert.equal(existing.checkpoint.payload.next_tick_logical_time, input.start, "SIMULATION_EXISTING_ROOT_TIME_MISMATCH");
    return { status: "EXISTING_IDEMPOTENT_SUCCESS", checkpoint_ref: existing.checkpoint.object_id };
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`MCFT-CAP-09.S6-SIM|${Object.values(input.scope).join("|")}`]);
    const txPool = transactionBoundPool(client);
    const runtime = new PostgresRuntimeRepositoryV1(txPool);
    const nextTick = new PostgresNextTickRepositoryV1(txPool);
    await nextTick.commitRealityBindingSnapshot(bundle.reality_binding_snapshot);
    const source = new PostgresFrozenShadowOnlineEvidenceSourceV1(txPool, frozen);
    const result = await new A0BootstrapRuntimeServiceV1(runtime, runtime, source).execute({
      scope: input.scope,
      logical_time: bundle.bootstrap_logical_time,
      created_at: bundle.bootstrap_logical_time,
      runtime_config: bundle.bootstrap_runtime_config,
      hydraulic: bundle.hydraulic,
      soil_hydraulic_config_ref: bundle.soil_hydraulic_config_ref,
      lease_owner: input.leaseOwner,
      lease_duration_seconds: 900,
    });
    for (const config of bundle.runtime_configs) await runtime.commitRuntimeConfig(config);
    const readback = await nextTick.readPersistedNextTickSnapshot(input.scope);
    assert(readback, "SIMULATION_BOOTSTRAP_ROOT_READBACK_REQUIRED");
    assert.equal(readback.checkpoint.payload.next_tick_logical_time, input.start, "SIMULATION_BOOTSTRAP_NEXT_TICK_MISMATCH");
    await client.query("COMMIT");
    return { status: result.status, checkpoint_ref: readback.checkpoint.object_id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function executeOldestDue(pool: Pool, input: {
  leaseOwner: string;
  scope: TwinScopeKeyV1;
  start: string;
  throughLogicalTime: string;
  terminalAt: string;
  schedulerObservedAt: string;
}): Promise<Record<string, unknown>> {
  const authority = buildSimulationSourceSubstitutionAuthoritySeedV1(input.start);
  const persistentScheduler = new PostgresPersistentSequentialSchedulerAdapterV1(pool, { scope: input.scope, schedule_start_logical_time: input.start });
  const scheduler = schedulerObservedAtV1(persistentScheduler, input.schedulerObservedAt);
  const due = await scheduler.listMissedSlots({ scope: input.scope, through_logical_time: input.throughLogicalTime });
  if (!due.length) return { status: "NO_DUE_SLOT" };
  const target = due[0];
  const targetIndex = Number(target.slot_id.slice(1));
  const config = authority.runtime_configs[targetIndex];
  assert(config && config.logical_time === target.logical_time, "SIMULATION_EXACT_RUNTIME_CONFIG_REQUIRED");
  const runtime = new PostgresRuntimeRepositoryV1(pool);
  const nextTick = new PostgresNextTickRepositoryV1(pool);
  const repository = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
  const preparation = new RestartBackfillStaleDetectionServiceV1(
    scheduler,
    new PostgresExpiredSlotRecoveryAdapterV1(pool, input.scope),
    new PostgresEvidenceIngressAdapterV1(pool, PRODUCTION_EQUIVALENT_SIMULATION_EVIDENCE_INGRESS_CONFIG_V1),
    nextTick,
  );
  const canonical = new PostgresCap04ShadowOnlineCanonicalTickAdapterV1(
    pool,
    new PrepareNextTickInputServiceV1(nextTick),
    runtime,
    persistence(runtime, repository),
  );
  const owner = input.leaseOwner;
  const result = await new ShadowOnlineCanonicalIntegrationServiceV1(preparation, scheduler, canonical).executeOldestDueTick({
    scope: input.scope,
    through_logical_time: input.throughLogicalTime,
    lease_owner: owner,
    lease_duration_seconds: 300,
    terminal_at: input.terminalAt,
    canonical_input: {
      scope: input.scope,
      logical_time: target.logical_time,
      created_at: input.terminalAt,
      authorized_future_forcing_binding_ids: AUTHORIZED_FUTURE_FORCING_BINDINGS,
      crop_stage_context: CROP_STAGE_CONTEXT,
      lease_owner: owner,
      lease_duration_seconds: 300,
      runtime_config_ref: config.object_id,
      runtime_config_hash: config.determinism_hash,
    },
  });
  assert.equal(result.status, "CANONICAL_TICK_TERMINAL", "SIMULATION_CANONICAL_TICK_TERMINAL_REQUIRED");
  if (result.status !== "CANONICAL_TICK_TERMINAL") throw new Error("SIMULATION_CANONICAL_RESULT_REQUIRED");
  assert.equal(result.canonical.g_write_count, 0, "SIMULATION_G_WRITE_ZERO_REQUIRED");
  return {
    status: "PASS",
    slot_id: target.slot_id,
    logical_time: target.logical_time,
    terminal_state: result.terminal_state,
    runtime_health_status: result.preparation.runtime_health_status,
    evidence_freshness_status: result.preparation.evidence.freshness_status,
    out_of_order_evidence_refs: "out_of_order_evidence_refs" in result.preparation.evidence
      ? result.preparation.evidence.out_of_order_evidence_refs : [],
    state_ref: result.canonical.state_ref,
    forecast_ref: result.canonical.forecast_ref,
    forecast_status: result.canonical.forecast_status,
    forecast_point_count: result.canonical.forecast_point_count,
    scenario_ref: result.canonical.scenario_ref,
    checkpoint_ref: result.canonical.checkpoint_ref,
    health_ref: result.canonical.health_ref,
    frozen_evidence_refs: result.canonical.frozen_evidence_refs,
    g_write_count: 0,
  };
}

async function inspectDelayedObservationAvailability(pool: Pool, input: {
  scope: TwinScopeKeyV1;
  start: string;
  hour: SimulationHourV1;
  schedulerObservedAt: string;
}): Promise<Record<string, unknown>> {
  assert.match(input.hour.slot_id, /^O(?:0\d|1\d|2[0-3])$/, "SIMULATION_AVAILABILITY_SLOT_ID_INVALID");
  const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(pool, {
    scope: input.scope,
    schedule_start_logical_time: input.start,
  });
  const availability = await new RestartBackfillStaleDetectionServiceV1(
    scheduler,
    new PostgresExpiredSlotRecoveryAdapterV1(pool, input.scope),
    new PostgresEvidenceIngressAdapterV1(pool, PRODUCTION_EQUIVALENT_SIMULATION_EVIDENCE_INGRESS_CONFIG_V1),
    new PostgresNextTickRepositoryV1(pool),
  ).inspectAvailability({
    scope: input.scope,
    boundary: {
      scope: input.scope,
      slot_id: input.hour.slot_id as ShadowOnlineSlotIdV1,
      logical_time: input.hour.logical_time,
      scheduler_wall_clock_observed_at: input.schedulerObservedAt,
      interval_seconds: 3600,
    },
  });
  assert.equal(availability.evidence_freshness_status, "MISSING", "SIMULATION_DELAYED_OBSERVATION_MISSING_STATUS_REQUIRED");
  assert.equal(availability.runtime_health_status, "DEGRADED", "SIMULATION_DELAYED_OBSERVATION_DEGRADED_HEALTH_REQUIRED");
  return availability;
}

async function forbiddenCount(pool: Pool): Promise<number> {
  return Number((await pool.query("SELECT count(*)::int AS n FROM facts WHERE record_json->>'type'=ANY($1::text[])", [FORBIDDEN])).rows[0].n);
}

async function main(): Promise<void> {
  const operation = required("MCFT_CAP09_S6_SIMULATION_OPERATION") as SimulationOperationV1;
  assert(["accelerated", "bootstrap", "hourly", "preflight"].includes(operation), "SIMULATION_OPERATION_INVALID");
  const subjectSha = required("MCFT_CAP09_S6_SUBJECT_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/, "SIMULATION_EXACT_SUBJECT_SHA_REQUIRED");
  const leaseOwner = simulationLeaseOwnerV1({ operation, subject_sha: subjectSha });
  const start = required("MCFT_CAP09_S6_WINDOW_START_UTC");
  assert.equal(new Date(Date.parse(start)).toISOString(), start, "SIMULATION_WINDOW_START_CANONICAL_REQUIRED");
  assert.equal(Date.parse(start) % HOUR_MS, 0, "SIMULATION_WINDOW_START_HOUR_REQUIRED");
  const scope = json<TwinScopeKeyV1>("MCFT_CAP09_S6_SCOPE_JSON");
  buildSimulationSourceSubstitutionAuthoritySeedV1(start);
  assertSimulationLogicalWindowCoveredV1(start);
  const wallClockStart = operation === "hourly"
    ? required("MCFT_CAP09_S6_SIMULATION_WALL_CLOCK_START_UTC")
    : start;
  assert.equal(new Date(Date.parse(wallClockStart)).toISOString(), wallClockStart, "SIMULATION_WALL_CLOCK_START_CANONICAL_REQUIRED");
  assert.equal(Date.parse(wallClockStart) % HOUR_MS, 0, "SIMULATION_WALL_CLOCK_START_HOUR_REQUIRED");
  const runId = required("MCFT_CAP09_S6_SIMULATION_RUN_ID");
  assert.match(runId, /^[a-z0-9][a-z0-9_-]{2,63}$/i, "SIMULATION_RUN_ID_INVALID");
  const seed = Number(required("MCFT_CAP09_S6_SIMULATION_SEED"));
  assert(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffff_ffff, "SIMULATION_SEED_INVALID");
  const pool = new Pool({ connectionString: required("DATABASE_URL"), application_name: `mcft-cap09-s6-sim-${runId}` });
  try {
    const identity = await assertIsolatedSimulationDatabase(pool);
    const window = buildSimulationWindowV1({ scope, run_id: runId, seed, window_start_utc: start });
    const bootstrapWindow = buildSimulationWindowV1({
      scope, run_id: `${runId}_bootstrap`, seed, window_start_utc: new Date(Date.parse(start) - HOUR_MS).toISOString(),
    });
    const root = await bootstrap(pool, { leaseOwner, scope, start, bootstrapEvidence: bootstrapWindow[0] });
    if (operation === "bootstrap" || operation === "preflight") {
      write({
        schema_version: "geox_mcft_cap09_s6_production_equivalent_simulation_result_v1",
        status: "PASS", operation, identity, root, simulation_run_id: runId, seed,
        window_digest: semanticHashV1(window.map((hour) => hour.determinism_hash)),
        formal_eligible: false, formal_window_started: false, field_validity_proven: false,
      });
      return;
    }
    const beforeForbidden = await forbiddenCount(pool);
    const outputs: Record<string, unknown>[] = [];
    const availabilityProbes: Record<string, unknown>[] = [];
    let inserted = 0;
    let idempotent = 0;
    if (operation === "accelerated") {
      for (const hour of window) {
        if (hour.slot_id === "O09") {
          const futureOnly = { ...hour, records: hour.records.filter((record) => record.record_type.startsWith("future_")) };
          const delayedActual = { ...hour, records: hour.records.filter((record) => !record.record_type.startsWith("future_")) };
          const firstWrite = await insertHour(pool, futureOnly);
          inserted += firstWrite.inserted;
          idempotent += firstWrite.idempotent;
          availabilityProbes.push(await inspectDelayedObservationAvailability(pool, {
            scope, start, hour, schedulerObservedAt: new Date(Date.parse(hour.logical_time) + 5 * 60_000).toISOString(),
          }));
          const recoveryWrite = await insertHour(pool, delayedActual);
          inserted += recoveryWrite.inserted;
          idempotent += recoveryWrite.idempotent;
        } else {
          const writeResult = await insertHour(pool, hour);
          inserted += writeResult.inserted;
          idempotent += writeResult.idempotent;
        }
        if (hour.slot_id === "O11") continue;
        do {
          const result = await executeOldestDue(pool, {
            leaseOwner, scope, start, throughLogicalTime: hour.logical_time,
            terminalAt: new Date(Date.parse(hour.logical_time) + 5 * 60_000).toISOString(),
            schedulerObservedAt: new Date(Date.parse(hour.logical_time) + 5 * 60_000).toISOString(),
          });
          if (result.status === "NO_DUE_SLOT") break;
          outputs.push(result);
        } while (outputs.length < 24);
      }
      while (outputs.length < 24) {
        const result = await executeOldestDue(pool, {
          leaseOwner, scope, start,
          throughLogicalTime: new Date(Date.parse(start) + 23 * HOUR_MS).toISOString(),
          terminalAt: new Date(Date.parse(start) + 24 * HOUR_MS).toISOString(),
          schedulerObservedAt: new Date(Date.parse(start) + 24 * HOUR_MS).toISOString(),
        });
        if (result.status === "NO_DUE_SLOT") break;
        outputs.push(result);
      }
      assert.equal(outputs.length, 24, "SIMULATION_EXACT_24_TERMINAL_SLOTS_REQUIRED");
    } else {
      const observedIndex = Math.floor((Date.now() - Date.parse(wallClockStart)) / HOUR_MS);
      assert(observedIndex >= 0 && observedIndex <= 24, "SIMULATION_WALL_CLOCK_OUTSIDE_WINDOW");
      if (observedIndex < 24) {
        const hour = window[observedIndex];
        if (hour.slot_id === "O09") {
          const futureOnly = { ...hour, records: hour.records.filter((record) => record.record_type.startsWith("future_")) };
          const delayedActual = { ...hour, records: hour.records.filter((record) => !record.record_type.startsWith("future_")) };
          const firstWrite = await insertHour(pool, futureOnly);
          inserted += firstWrite.inserted;
          idempotent += firstWrite.idempotent;
          availabilityProbes.push(await inspectDelayedObservationAvailability(pool, {
            scope, start, hour, schedulerObservedAt: new Date().toISOString(),
          }));
          const recoveryWrite = await insertHour(pool, delayedActual);
          inserted += recoveryWrite.inserted;
          idempotent += recoveryWrite.idempotent;
        } else {
          const writeResult = await insertHour(pool, hour);
          inserted += writeResult.inserted;
          idempotent += writeResult.idempotent;
        }
      }
      if (observedIndex === 11) {
        write({ schema_version: "geox_mcft_cap09_s6_production_equivalent_simulation_result_v1", status: "INTENTIONAL_MISSED_SLOT", operation, identity, slot_id: "O11", formal_eligible: false });
        return;
      }
      outputs.push(await executeOldestDue(pool, {
        leaseOwner, scope, start,
        throughLogicalTime: new Date(Date.parse(start) + Math.min(observedIndex, 23) * HOUR_MS).toISOString(),
        terminalAt: new Date().toISOString(), schedulerObservedAt: new Date().toISOString(),
      }));
    }
    assert.equal(await forbiddenCount(pool), beforeForbidden, "SIMULATION_FORBIDDEN_ACTION_FACT_DELTA");
    const result = {
      schema_version: "geox_mcft_cap09_s6_production_equivalent_simulation_result_v1",
      status: "PASS",
      operation,
      identity,
      subject_sha: subjectSha,
      simulation_run_id: runId,
      simulation_model_version: "ROOT_ZONE_BUCKET_5_LAYER_V1",
      seed,
      logical_window_start_utc: start,
      wall_clock_window_start_utc: operation === "hourly" ? wallClockStart : null,
      time_mapping: operation === "hourly" ? "ONE_TO_ONE_WALL_PACING_WITH_SEPARATE_LOGICAL_CLOCK" : "ACCELERATED_LOGICAL_CLOCK",
      window_digest: semanticHashV1(window.map((hour) => hour.determinism_hash)),
      evidence_inserted_count: inserted,
      evidence_idempotent_count: idempotent,
      terminal_slot_count: outputs.filter((item) => item.status === "PASS").length,
      slot_outputs: outputs,
      availability_probes: availabilityProbes,
      stale_detection_probe_slot: "O09",
      missing_forcing_degradation_slot: "O10",
      intentional_missed_slot: "O11",
      restart_backfill_observation_slot: "O12",
      late_out_of_order_slot: "O15",
      sensor_drift_start_slot: "O16",
      shared_canonical_runtime: true,
      formal_eligible: false,
      formal_window_started: false,
      field_validity_proven: false,
      forbidden_action_fact_delta: 0,
    };
    write(result);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  write({
    schema_version: "geox_mcft_cap09_s6_production_equivalent_simulation_result_v1",
    status: "FAIL",
    error: String(error instanceof Error ? error.message : error),
    formal_eligible: false,
    formal_window_started: false,
    field_validity_proven: false,
  });
  process.exitCode = 1;
});
