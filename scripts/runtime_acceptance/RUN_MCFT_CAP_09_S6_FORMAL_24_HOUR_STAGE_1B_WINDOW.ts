import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import type { Cap04SingleTickPersistencePortV1, ExecuteCap04SingleTickInputV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { PostgresCap04ShadowOnlineCanonicalTickAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_cap04_shadow_online_canonical_tick_adapter_v1.js";
import { PostgresEvidenceIngressAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import { PostgresExpiredSlotRecoveryAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_expired_slot_recovery_adapter_v1.js";
import { PostgresPersistentSequentialSchedulerAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { RestartBackfillStaleDetectionServiceV1 } from "../../apps/server/src/runtime/twin_runtime/restart_backfill_stale_detection_service_v1.js";
import { ShadowOnlineCanonicalIntegrationServiceV1 } from "../../apps/server/src/runtime/twin_runtime/shadow_online_canonical_integration_service_v1.js";

const HOUR_MS = 3_600_000;
const SLOT_IDS = Array.from({ length: 24 }, (_, index) => `O${String(index).padStart(2, "0")}`);
const OUT = path.resolve("acceptance-output/MCFT_CAP_09_S6_FORMAL_WINDOW_OBSERVATION.json");
const FORBIDDEN = ["twin_decision_record_v1", "twin_recommendation_v1", "decision_recommendation_v1", "approval_request_v1", "ao_act_task_v1", "ao_act_receipt_v1", "dispatch_request_v1", "model_activation_v1"];
const SCOPE_FIELDS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name}_REQUIRED`);
  return value;
}
function canonicalHour(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed % HOUR_MS !== 0 || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}
function json<T>(name: string): T {
  try { return JSON.parse(required(name)) as T; } catch { throw new Error(`${name}_JSON_INVALID`); }
}
function sameScope(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return SCOPE_FIELDS.every((field) => left[field] === right[field]);
}
function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value, null, 2));
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
async function forbiddenCount(pool: Pool): Promise<number> {
  return Number((await pool.query("SELECT count(*)::int AS n FROM facts WHERE record_json->>'type'=ANY($1::text[])", [FORBIDDEN])).rows[0].n);
}

async function main(): Promise<void> {
  const databaseUrl = required("DATABASE_URL");
  const subjectSha = required("MCFT_CAP09_S6_SUBJECT_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/, "EXACT_SUBJECT_SHA_REQUIRED");
  const start = canonicalHour(required("MCFT_CAP09_S6_WINDOW_START_UTC"), "EXACT_UTC_WINDOW_START_REQUIRED");
  const scope = json<TwinScopeKeyV1>("MCFT_CAP09_S6_SCOPE_JSON");
  const template = json<ExecuteCap04SingleTickInputV1>("MCFT_CAP09_S6_CANONICAL_INPUT_JSON");
  assert(sameScope(scope, template.scope), "FORMAL_INPUT_EXACT_SCOPE_REQUIRED");
  const now = new Date();
  const nowMs = now.getTime();
  const startMs = Date.parse(start);
  assert(nowMs >= startMs, "FORMAL_WINDOW_NOT_STARTED");
  const observedHourIndex = Math.floor((nowMs - startMs) / HOUR_MS);
  assert(observedHourIndex <= 24, "FORMAL_WINDOW_OBSERVATION_LATE");
  const throughIndex = Math.min(observedHourIndex, 23);
  const throughLogicalTime = new Date(startMs + throughIndex * HOUR_MS).toISOString();
  const pool = new Pool({ connectionString: databaseUrl, application_name: `mcft-cap09-s6-${subjectSha.slice(0, 12)}` });
  try {
    const dbNow = new Date((await pool.query("SELECT transaction_timestamp() AS now")).rows[0].now).getTime();
    assert(Math.abs(dbNow - nowMs) <= 300_000, "SYSTEM_AND_DATABASE_CLOCK_DRIFT_EXCEEDS_300_SECONDS");
    const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(pool, { scope, schedule_start_logical_time: start });
    const due = await scheduler.listMissedSlots({ scope, through_logical_time: throughLogicalTime });
    if (observedHourIndex === 11 && due.length === 1 && due[0].slot_id === "O11") {
      write({ schema_version: "geox_mcft_cap09_s6_formal_window_observation_v1", status: "INTENTIONAL_MISSED_SLOT", subject_sha: subjectSha, observed_at: now.toISOString(), slot_id: "O11", database_recreated: false, formal_effectiveness: false });
      return;
    }
    if (!due.length) {
      write({ schema_version: "geox_mcft_cap09_s6_formal_window_observation_v1", status: "NO_DUE_SLOT", subject_sha: subjectSha, observed_at: now.toISOString(), observed_hour_index: observedHourIndex, formal_effectiveness: false });
      return;
    }
    const target = due[0];
    const runtime = new PostgresRuntimeRepositoryV1(pool);
    const nextTick = new PostgresNextTickRepositoryV1(pool);
    const repository = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
    const preparation = new RestartBackfillStaleDetectionServiceV1(
      scheduler,
      new PostgresExpiredSlotRecoveryAdapterV1(pool, scope),
      new PostgresEvidenceIngressAdapterV1(pool),
      nextTick,
    );
    const canonical = new PostgresCap04ShadowOnlineCanonicalTickAdapterV1(
      pool,
      new PrepareNextTickInputServiceV1(nextTick),
      runtime,
      persistence(runtime, repository),
    );
    const owner = `mcft-cap09-s6-${subjectSha.slice(0, 12)}-${target.slot_id}`;
    const beforeForbidden = await forbiddenCount(pool);
    const checkpointBefore = await nextTick.readPersistedNextTickSnapshot(scope);
    const controlledRestartReadback = observedHourIndex >= 12 && target.slot_id === "O11" && checkpointBefore?.checkpoint.object_id;
    const result = await new ShadowOnlineCanonicalIntegrationServiceV1(preparation, scheduler, canonical).executeOldestDueTick({
      scope,
      through_logical_time: throughLogicalTime,
      lease_owner: owner,
      lease_duration_seconds: 300,
      terminal_at: now.toISOString(),
      canonical_input: { ...template, scope, logical_time: target.logical_time, created_at: now.toISOString(), lease_owner: owner, lease_duration_seconds: 300 },
    });
    assert.equal(result.status, "CANONICAL_TICK_TERMINAL", "FORMAL_CANONICAL_TICK_TERMINAL_REQUIRED");
    if (result.status !== "CANONICAL_TICK_TERMINAL") throw new Error("FORMAL_CANONICAL_RESULT_REQUIRED");
    assert.equal(await forbiddenCount(pool), beforeForbidden, "FORMAL_FORBIDDEN_ACTION_FACT_DELTA");
    assert.equal(result.canonical.g_write_count, 0, "FORMAL_G_WRITE_ZERO_REQUIRED");
    const output = {
      schema_version: "geox_mcft_cap09_s6_formal_window_observation_v1",
      status: "PASS",
      subject_sha: subjectSha,
      observed_at: now.toISOString(),
      database_clock_at: new Date(dbNow).toISOString(),
      slot_id: target.slot_id,
      logical_time: target.logical_time,
      observed_hour_index: observedHourIndex,
      intentional_backfill: target.slot_id === "O11" && observedHourIndex >= 12,
      controlled_restart_checkpoint_readback: Boolean(controlledRestartReadback),
      checkpoint_before_ref: checkpointBefore?.checkpoint.object_id ?? null,
      terminal_state: result.terminal_state,
      forecast_status: result.canonical.forecast_status,
      forecast_point_count: result.canonical.forecast_point_count,
      canonical_transaction_families: result.canonical.canonical_transaction_families,
      state_ref: result.canonical.state_ref,
      forecast_ref: result.canonical.forecast_ref,
      health_ref: result.canonical.health_ref,
      checkpoint_ref: result.canonical.checkpoint_ref,
      frozen_evidence_refs: result.canonical.frozen_evidence_refs,
      g_write_count: 0,
      recommendation_count: 0,
      approval_count: 0,
      ao_act_count: 0,
      dispatch_count: 0,
      model_activation_count: 0,
      database_recreated: false,
      formal_effectiveness: false,
    };
    assert(SLOT_IDS.includes(String(output.slot_id)), "FORMAL_SLOT_ID_REQUIRED");
    write(output);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  write({ schema_version: "geox_mcft_cap09_s6_formal_window_observation_v1", status: "FAIL", error: String(error instanceof Error ? error.message : error), formal_effectiveness: false });
  process.exitCode = 1;
});
