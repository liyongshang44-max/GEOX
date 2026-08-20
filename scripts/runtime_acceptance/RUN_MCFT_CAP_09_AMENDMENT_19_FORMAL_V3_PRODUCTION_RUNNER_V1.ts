import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { ExternalFormalV3Amendment19PersistentTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.js";
import { ExternalFormalV3Amendment19RunnerV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.js";
import type { Cap04ForecastScenarioPersistencePortV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { PostgresExternalFormalAmendment19EvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.js";
import { PostgresPersistentSequentialSchedulerAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import { materializeExternalFormalA18CropContextV2 } from "../../apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v2.js";
import {
  buildMcftCap09Am19FormalManifestFromArmV1,
  MCFT_CAP09_AM19_FORMAL_DATABASE_V3,
  type McftCap09Am19FormalArmV1,
} from "./mcft_cap09_amendment19_formal_manifest_from_arm_v1.js";

const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_AMENDMENT_19_FORMAL_V3_PRODUCTION_RUNNER_RESULT_V1.json");
const CROP_AUTHORITY_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json");
const MATRIX_PATH = path.resolve("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");
const LEASE_DURATION_SECONDS = 900;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`AM19_FORMAL_RUNNER_ENV_REQUIRED:${name}`);
  return value;
}

function canonicalIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function loadJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeResult(value: unknown): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
}

function assertExactProtectedMain(subject: string): void {
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("AM19_FORMAL_RUNNER_SUBJECT_SHA_INVALID");
  if (!["schedule", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "")) {
    throw new Error("AM19_FORMAL_RUNNER_LIVE_SCHEDULE_OR_DISPATCH_REQUIRED");
  }
  if (process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== subject) {
    throw new Error("AM19_FORMAL_RUNNER_EXACT_PROTECTED_MAIN_REQUIRED");
  }
}

async function assertFormalDatabase(pool: Pool, databaseUrl: string): Promise<void> {
  const parsed = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("AM19_FORMAL_RUNNER_POSTGRES_URL_REQUIRED");
  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) throw new Error("AM19_FORMAL_RUNNER_REMOTE_DATABASE_REQUIRED");
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (database !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) throw new Error(`AM19_FORMAL_RUNNER_EXACT_V3_DATABASE_REQUIRED:${database}`);
  const identity = String((await pool.query("SELECT current_database() AS database_name")).rows[0]?.database_name ?? "");
  if (identity !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) throw new Error("AM19_FORMAL_RUNNER_DATABASE_SESSION_IDENTITY_REQUIRED");
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

function loadBuilt(armPath: string, expectedSubject: string) {
  const arm = loadJson(armPath) as McftCap09Am19FormalArmV1;
  const cropAuthority = loadJson(CROP_AUTHORITY_PATH) as Record<string, unknown>;
  const matrix = loadJson(MATRIX_PATH) as Record<string, unknown>;
  return buildMcftCap09Am19FormalManifestFromArmV1({
    arm,
    crop_authority: cropAuthority,
    configuration_matrix: matrix,
    expected_subject_sha: expectedSubject,
  });
}

function classifyPreclaim(result: any): { failure_class: string; reason: string } {
  if (result?.reason === "EVIDENCE_PRECHECK_FAILED" && String(result?.detail || "").startsWith("AM19_EXTERNAL_DB_REQUIRED_CAUSAL_FAMILY_MISSING:")) {
    return { failure_class: "EXPIRED_PREBOUNDARY_CAUSAL_GAP", reason: String(result.detail) };
  }
  if (result?.reason === "EVIDENCE_PRECHECK_FAILED") {
    return { failure_class: "FORMAL_EVIDENCE_PRECLAIM_FAILURE", reason: String(result?.detail || "UNKNOWN") };
  }
  return { failure_class: "FORMAL_PRECLAIM_INVARIANT_FAILURE", reason: `${String(result?.reason || "UNKNOWN")}:${String(result?.detail || "")}` };
}

function selftest(): void {
  const subject = "1".repeat(40);
  const arm: McftCap09Am19FormalArmV1 = {
    schema_version: "geox_mcft_cap09_amendment19_formal_arm_v1",
    status: "PASS",
    subject_sha: subject,
    arm_identity_hash: `sha256:${"a".repeat(64)}`,
    epoch_id: "mcft_cap09_am19_formal_20260821050000000_111111111111",
    formal_database_name: MCFT_CAP09_AM19_FORMAL_DATABASE_V3,
    a0: "2026-08-21T05:00:00.000Z",
    o00: "2026-08-21T06:00:00.000Z",
    o23: "2026-08-22T05:00:00.000Z",
    manifest_ref: "formal-arm://mcft-cap09/amendment19/selftest/geox_mcft_cap09_s6_formal_t3r1_24h_v3",
    rolling: { captured_at: "2026-08-21T04:30:00.000Z", target_t: "2026-08-21T05:00:00.000Z" },
    temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
    bootstrap_lease_clock_required: "REAL_DATABASE_TRANSACTION_TIMESTAMP",
    formal_clock_mode_required: "SYSTEM_DATABASE_UTC",
    accelerated_clock_authorized_for_formal: false,
    formal_database_write_count: 0,
    formal_o00_started: false,
    final_actual_24h_still_required: true,
    human_override_used: false,
    mcft_cap09_completed: false,
  };
  const cropAuthority = loadJson(CROP_AUTHORITY_PATH) as Record<string, unknown>;
  const matrix = loadJson(MATRIX_PATH) as Record<string, unknown>;
  const built = buildMcftCap09Am19FormalManifestFromArmV1({ arm, crop_authority: cropAuthority, configuration_matrix: matrix, expected_subject_sha: subject });
  if (built.manifest.subject_sha !== subject || built.manifest.database_name !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3 || built.manifest.slots.length !== 24 || built.manifest.slots[0]?.slot_id !== "O00" || built.manifest.slots[23]?.slot_id !== "O23") {
    throw new Error("AM19_FORMAL_RUNNER_SELFTEST_MANIFEST_REQUIRED");
  }
  const gap = classifyPreclaim({ reason: "EVIDENCE_PRECHECK_FAILED", detail: "AM19_EXTERNAL_DB_REQUIRED_CAUSAL_FAMILY_MISSING:future_weather" });
  if (gap.failure_class !== "EXPIRED_PREBOUNDARY_CAUSAL_GAP") throw new Error("AM19_FORMAL_RUNNER_SELFTEST_EXPIRED_GAP_REQUIRED");
  console.log(JSON.stringify({
    schema_version: "geox_mcft_cap09_amendment19_formal_v3_production_runner_selftest_v1",
    status: "PASS",
    runner: "ExternalFormalV3Amendment19RunnerV1",
    persistent_tick_service: "ExternalFormalV3Amendment19PersistentTickServiceV1",
    scheduler_clock_mode: "SYSTEM_DATABASE_UTC",
    shared_manifest_builder: true,
    exact_slot_count: 24,
    expired_preboundary_gap_terminal_epoch_failure: true,
    provider_request_count: 0,
    r2_request_count: 0,
    formal_effect: false,
  }));
}

async function runCycle(): Promise<void> {
  const subject = requiredEnv("MCFT_CAP09_SUBJECT_SHA");
  assertExactProtectedMain(subject);
  const armPath = path.resolve(requiredEnv("MCFT_CAP09_AM19_FORMAL_ARM_PATH"));
  const built = loadBuilt(armPath, subject);
  const now = canonicalIso(new Date().toISOString(), "AM19_FORMAL_RUNNER_CYCLE_TIME_INVALID");
  if (Date.parse(now) < Date.parse(built.arm.o00)) throw new Error("AM19_FORMAL_RUNNER_BEFORE_O00_FORBIDDEN");
  if (Date.parse(now) >= Date.parse(built.arm.o23) + 2 * 3_600_000) throw new Error("AM19_FORMAL_RUNNER_AFTER_GRADUATION_WINDOW_FORBIDDEN");

  const databaseUrl = requiredEnv("DATABASE_URL");
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-am19-formal-v3-production-runner" });
  try {
    await assertFormalDatabase(pool, databaseUrl);
    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
    const recoveryRepository = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
    const evidenceSource = new PostgresExternalFormalAmendment19EvidenceSourceV1(pool);
    const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(pool, {
      scope: built.manifest.scope,
      schedule_start_logical_time: built.manifest.o00_logical_time,
    });
    const tickService = new ExternalFormalV3Amendment19PersistentTickServiceV1(
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
    const runner = new ExternalFormalV3Amendment19RunnerV1(
      built.manifest,
      scheduler,
      runtimeRepository,
      materializer,
      evidenceSource,
      tickService,
    );

    const result = await runner.executeOneDueSlot({
      through_logical_time: now,
      observer_started_at: now,
      lease_owner: `mcft-cap09-am19-formal-${process.env.GITHUB_RUN_ID ?? "manual"}`,
      lease_duration_seconds: LEASE_DURATION_SECONDS,
    });

    if (result.status === "NOT_READY_PRECLAIM") {
      const failure = classifyPreclaim(result);
      writeResult({
        schema_version: "geox_mcft_cap09_amendment19_formal_v3_production_runner_result_v1",
        status: "FAIL",
        subject_sha: subject,
        arm_identity_hash: built.arm.arm_identity_hash,
        epoch_id: built.manifest.epoch_id,
        manifest_hash: built.manifest.manifest_hash,
        formal_database_name: MCFT_CAP09_AM19_FORMAL_DATABASE_V3,
        cycle_started_at: now,
        logical_time: result.logical_time,
        slot_id: result.slot_id,
        failure_class: failure.failure_class,
        reason: failure.reason,
        provider_request_count: 0,
        r2_request_count: 0,
        scheduler_claim_attempted: false,
        late_evidence_can_repair_tick: false,
        formal_epoch_no_go: true,
        mcft_cap09_completed: false,
      });
      throw new Error(`AM19_FORMAL_RUNNER_EPOCH_NO_GO:${failure.failure_class}:${failure.reason}`);
    }

    const terminalFailure = result.status === "FAILED_TERMINAL_RECORDED" || result.status === "BLOCKED_TERMINAL_RECORDED";
    writeResult({
      schema_version: "geox_mcft_cap09_amendment19_formal_v3_production_runner_result_v1",
      status: terminalFailure ? "FAIL" : "PASS",
      subject_sha: subject,
      arm_identity_hash: built.arm.arm_identity_hash,
      epoch_id: built.manifest.epoch_id,
      manifest_hash: built.manifest.manifest_hash,
      formal_database_name: MCFT_CAP09_AM19_FORMAL_DATABASE_V3,
      cycle_started_at: now,
      temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
      scheduler_clock_mode: "SYSTEM_DATABASE_UTC",
      result,
      provider_request_count: 0,
      r2_request_count: 0,
      final_actual_24h_still_required: true,
      formal_epoch_no_go: terminalFailure,
      mcft_cap09_completed: false,
    });
    if (terminalFailure) throw new Error(`AM19_FORMAL_RUNNER_TERMINAL_FAILURE:${result.slot_id}:${result.detail}`);
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === "selftest") return selftest();
  if (mode !== "cycle") throw new Error("AM19_FORMAL_RUNNER_MODE_REQUIRED:selftest|cycle");
  await runCycle();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
