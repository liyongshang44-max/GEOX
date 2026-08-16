import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  materializeExternalFormalA18CropContextV2,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v2.js";
import {
  ExternalFormalV3Amendment11PersistentTickServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment11_persistent_tick_service_v1.js";
import {
  ExternalFormalV3Amendment11RunnerV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment11_runner_v1.js";
import type { Cap04ForecastScenarioPersistencePortV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { PostgresExternalFormalEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.js";
import { PostgresPersistentSequentialSchedulerAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import {
  buildExactA18CLiveManifestV1,
  MCFT_CAP09_A18C_FORMAL_DATABASE_V1,
  MCFT_CAP09_A18C_FORMAL_EPOCH_V1,
  MCFT_CAP09_A18C_MANIFEST_HASH_V1,
  MCFT_CAP09_A18C_O00_V1,
  MCFT_CAP09_A18C_O23_V1,
} from "./mcft_cap09_a18c_formal_live_manifest_v1.js";

const HARDENING_AUTHORITY_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRE-RUNTIME-HARDENING-AUTHORITY-V1.json");
const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "MCFT_CAP_09_A18C_FORMAL_V3_PRODUCTION_RUNNER_RESULT.json");
const HISTORICAL_DATABASE = "geox_mcft_cap09_s6_formal_t3r1_24h";
const RETENTION_HORIZON_END_EXCLUSIVE = "2026-08-20T07:00:00.000Z";
const LEASE_DURATION_SECONDS = 900;

type HardeningAuthority = {
  schema_version: string;
  selected_epoch: { epoch_id: string; o00: string; o23: string };
  formal_store: { database_name: string; historical_database_forbidden: string };
  production_runner: {
    runner_id: string;
    manifest_ref: string;
    manifest_hash: string;
    schedule_start_logical_time: string;
    slot_count: number;
    slot_interval_seconds: number;
    evidence_snapshot_time_source: string;
    provider_requests: number;
    r2_requests: number;
    preclaim_missing_evidence_scheduler_write_count: number;
    oldest_due_slot_first: boolean;
  };
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`FORMAL_V3_RUNNER_ENV_REQUIRED:${name}`);
  return value;
}

function canonicalIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function loadHardeningAuthority(): HardeningAuthority {
  const authority = JSON.parse(fs.readFileSync(HARDENING_AUTHORITY_PATH, "utf8")) as HardeningAuthority;
  if (authority.schema_version !== "geox_mcft_cap09_pre_runtime_hardening_authority_v1") throw new Error("FORMAL_V3_RUNNER_HARDENING_AUTHORITY_REQUIRED");
  if (authority.selected_epoch?.epoch_id !== MCFT_CAP09_A18C_FORMAL_EPOCH_V1 || authority.selected_epoch?.o00 !== MCFT_CAP09_A18C_O00_V1 || authority.selected_epoch?.o23 !== MCFT_CAP09_A18C_O23_V1) throw new Error("FORMAL_V3_RUNNER_EPOCH_DRIFT");
  if (authority.formal_store?.database_name !== MCFT_CAP09_A18C_FORMAL_DATABASE_V1 || authority.formal_store?.historical_database_forbidden !== HISTORICAL_DATABASE) throw new Error("FORMAL_V3_RUNNER_DATABASE_AUTHORITY_DRIFT");
  const runner = authority.production_runner;
  if (runner?.runner_id !== "MCFT_CAP09_EXTERNAL_FORMAL_V3_A18_RUNNER_V1" || runner?.manifest_hash !== MCFT_CAP09_A18C_MANIFEST_HASH_V1 || runner?.schedule_start_logical_time !== MCFT_CAP09_A18C_O00_V1 || runner?.slot_count !== 24 || runner?.slot_interval_seconds !== 3600 || runner?.evidence_snapshot_time_source !== "ACTUAL_RUNTIME_WALL_CLOCK" || runner?.provider_requests !== 0 || runner?.r2_requests !== 0 || runner?.preclaim_missing_evidence_scheduler_write_count !== 0 || runner?.oldest_due_slot_first !== true) throw new Error("FORMAL_V3_RUNNER_BINDING_AUTHORITY_DRIFT");
  return authority;
}

function assertExactProtectedMain(subject: string): void {
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("FORMAL_V3_RUNNER_SUBJECT_SHA_INVALID");
  if (!["schedule", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "")) throw new Error("FORMAL_V3_RUNNER_LIVE_EVENT_REQUIRED");
  if (process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== subject) throw new Error("FORMAL_V3_RUNNER_EXACT_PROTECTED_MAIN_REQUIRED");
}

async function assertFormalDatabase(pool: Pool, databaseUrl: string): Promise<void> {
  const parsed = new URL(databaseUrl);
  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) throw new Error("FORMAL_V3_RUNNER_REMOTE_DATABASE_REQUIRED");
  const database = parsed.pathname.replace(/^\//, "");
  if (database === HISTORICAL_DATABASE) throw new Error("FORMAL_V3_RUNNER_HISTORICAL_DATABASE_FORBIDDEN");
  if (database !== MCFT_CAP09_A18C_FORMAL_DATABASE_V1) throw new Error("FORMAL_V3_RUNNER_REPLACEMENT_DATABASE_REQUIRED");
  const identity = (await pool.query("SELECT current_database() AS database_name")).rows[0];
  if (String(identity?.database_name ?? "") !== MCFT_CAP09_A18C_FORMAL_DATABASE_V1) throw new Error("FORMAL_V3_RUNNER_DATABASE_SESSION_IDENTITY_REQUIRED");
}

function persistencePort(repository: PostgresForecastScenarioRecoveryRepositoryV1): Cap04ForecastScenarioPersistencePortV1 {
  return {
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

function writeResult(value: unknown): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
}

function selftest(): void {
  loadHardeningAuthority();
  const built = buildExactA18CLiveManifestV1();
  if (built.exact_slot_count !== 24 || built.exact_manifest_hash !== MCFT_CAP09_A18C_MANIFEST_HASH_V1 || built.manifest.slots.length !== 24) throw new Error("FORMAL_V3_RUNNER_SELFTEST_EXACT_MANIFEST_REQUIRED");
  if (built.manifest.slots[0]?.slot_id !== "O00" || built.manifest.slots[0]?.logical_time !== MCFT_CAP09_A18C_O00_V1 || built.manifest.slots[23]?.slot_id !== "O23" || built.manifest.slots[23]?.logical_time !== MCFT_CAP09_A18C_O23_V1) throw new Error("FORMAL_V3_RUNNER_SELFTEST_SLOT_RANGE_REQUIRED");
  console.log(JSON.stringify({
    status: "PASS",
    epoch_id: MCFT_CAP09_A18C_FORMAL_EPOCH_V1,
    manifest_hash: MCFT_CAP09_A18C_MANIFEST_HASH_V1,
    exact_slot_count: 24,
    o00: MCFT_CAP09_A18C_O00_V1,
    o23: MCFT_CAP09_A18C_O23_V1,
    retention_horizon_end_exclusive: RETENTION_HORIZON_END_EXCLUSIVE,
    temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
    evidence_snapshot_time_source: "ACTUAL_RUNTIME_WALL_CLOCK",
    provider_request_count: 0,
    r2_request_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
  }));
}

async function runCycle(): Promise<void> {
  loadHardeningAuthority();
  const subject = requiredEnv("MCFT_CAP09_SUBJECT_SHA");
  assertExactProtectedMain(subject);
  const cycleStartedAt = canonicalIso(new Date().toISOString(), "FORMAL_V3_RUNNER_CYCLE_START_INVALID");
  if (Date.parse(cycleStartedAt) < Date.parse(MCFT_CAP09_A18C_O00_V1)) throw new Error("FORMAL_V3_RUNNER_BEFORE_O00_FORBIDDEN");
  if (Date.parse(cycleStartedAt) >= Date.parse(RETENTION_HORIZON_END_EXCLUSIVE)) throw new Error("FORMAL_V3_RUNNER_AFTER_RETENTION_HORIZON_FORBIDDEN");

  const databaseUrl = requiredEnv("DATABASE_URL");
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-a18c-formal-v3-production-runner" });
  try {
    await assertFormalDatabase(pool, databaseUrl);
    const built = buildExactA18CLiveManifestV1();
    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
    const recoveryRepository = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
    const evidenceSource = new PostgresExternalFormalEvidenceSourceV1(pool);
    const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(pool, {
      scope: built.manifest.scope,
      schedule_start_logical_time: MCFT_CAP09_A18C_O00_V1,
    });
    const tickService = new ExternalFormalV3Amendment11PersistentTickServiceV1(
      new PrepareNextTickInputServiceV1(nextTickRepository),
      evidenceSource,
      runtimeRepository,
      persistencePort(recoveryRepository),
    );
    const materializer = {
      materialize(input: { logical_time: string; expected_identity_hash: string }) {
        return materializeExternalFormalA18CropContextV2({
          logical_time: input.logical_time,
          expected_identity_hash: input.expected_identity_hash,
          crop_authority: built.crop_authority,
          configuration_matrix: built.configuration_matrix,
        });
      },
    };
    const runner = new ExternalFormalV3Amendment11RunnerV1(
      built.manifest,
      scheduler,
      runtimeRepository,
      materializer,
      evidenceSource,
      tickService,
    );

    const snapshotTime = canonicalIso(new Date().toISOString(), "FORMAL_V3_RUNNER_SNAPSHOT_INVALID");
    const observerStartedAt = canonicalIso(new Date().toISOString(), "FORMAL_V3_RUNNER_OBSERVER_INVALID");
    if (Date.parse(snapshotTime) > Date.parse(observerStartedAt)) throw new Error("FORMAL_V3_RUNNER_OBSERVER_BEFORE_SNAPSHOT");
    const result = await runner.executeOneDueSlot({
      through_logical_time: cycleStartedAt,
      evidence_snapshot_time: snapshotTime,
      observer_started_at: observerStartedAt,
      lease_owner: `mcft-cap09-formal-v3-${process.env.GITHUB_RUN_ID ?? "manual"}`,
      lease_duration_seconds: LEASE_DURATION_SECONDS,
    });

    const envelope = {
      schema_version: "geox_mcft_cap09_a18c_formal_v3_production_runner_result_v1",
      status: result.status === "FAILED_TERMINAL_RECORDED" ? "FAIL" : "PASS",
      subject_sha: subject,
      epoch_id: built.manifest.epoch_id,
      manifest_hash: built.manifest.manifest_hash,
      formal_database_name: MCFT_CAP09_A18C_FORMAL_DATABASE_V1,
      cycle_started_at: cycleStartedAt,
      evidence_snapshot_time: snapshotTime,
      observer_started_at: observerStartedAt,
      temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
      actual_snapshot_semantics: true,
      result,
      provider_request_count: 0,
      r2_request_count: 0,
      cron_is_normative_temporal_authority: false,
    };
    writeResult(envelope);
    if (result.status === "FAILED_TERMINAL_RECORDED") throw new Error(`FORMAL_V3_RUNNER_TERMINAL_FAILURE:${result.slot_id}:${result.detail}`);
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === "selftest") return selftest();
  if (mode !== "cycle") throw new Error("FORMAL_V3_RUNNER_MODE_REQUIRED");
  await runCycle();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
