// apps/server/scripts/mcft/MCFT_CAP_04_FORECAST_SCENARIO_RUNNER.ts
// Purpose: provide one explicit operator-invoked Replay entrypoint for CAP-04 single-tick, bounded range, restart/resume, and missed-schedule forward-backfill execution.
// Boundary: no HTTP route, browser write path, scheduler, daemon, implicit wall clock, duplicated tick loop, late-Evidence revision, recommendation, decision, approval, AO-ACT, calibration, model activation, or live-field claim.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { CanonicalReplayFileSourceV1 } from "../../src/adapters/twin_runtime/canonical_replay_file_source_v1.js";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { Cap04ForecastScenarioRangeServiceV1, type RunCap04ForecastScenarioRangeResultV1 } from "../../src/runtime/twin_runtime/forecast_scenario_range_service_v1.js";
import { Cap04ForecastScenarioRestartResumeServiceV1, type Cap04ForecastScenarioRestartResumeResultV1 } from "../../src/runtime/twin_runtime/forecast_scenario_restart_resume_service_v1.js";
import { Cap04ForecastScenarioSingleTickServiceV1, type Cap04SingleTickPersistencePortV1, type ExecuteCap04SingleTickResultV1 } from "../../src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { Cap04PendingScenarioBarrierSingleTickServiceV1 } from "../../src/runtime/twin_runtime/pending_scenario_barrier_service_v1.js";
import type { TwinScopeKeyV1 } from "../../src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

type RunnerModeV1 = "single-tick" | "range" | "resume" | "backfill";

type RunnerInputV1 = {
  mode: RunnerModeV1;
  database_url?: string;
  replay_root?: string;
  source_matrix_path?: string;
  scope: TwinScopeKeyV1;
  target_logical_time: string;
  created_at: string;
  runtime_config_refs_by_logical_time: Record<string, string>;
  runtime_config_hashes_by_logical_time: Record<string, string>;
  authorized_future_forcing_binding_ids: string[];
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  lease_owner: string;
  lease_duration_seconds: number;
  requested_start_logical_time?: string;
  evidence_intent?: "MISSED_SCHEDULE_CATCH_UP" | "LATE_EVIDENCE_REVISION";
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function resolvePathV1(value: string): string {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function inputPathV1(argv: string[]): string {
  const index = argv.indexOf("--input");
  if (index < 0 || !argv[index + 1]) throw new Error("MCFT_CAP_04_RUNNER_INPUT_PATH_REQUIRED");
  return resolvePathV1(argv[index + 1]);
}

function parseInputV1(raw: unknown): RunnerInputV1 {
  const record = requiredRecordV1(raw, "MCFT_CAP_04_RUNNER_INPUT_OBJECT_REQUIRED");
  const mode = requiredStringV1(record.mode, "MCFT_CAP_04_RUNNER_MODE_REQUIRED") as RunnerModeV1;
  if (!(["single-tick", "range", "resume", "backfill"] as string[]).includes(mode)) {
    throw new Error("MCFT_CAP_04_RUNNER_MODE_INVALID");
  }
  const scope = requiredRecordV1(record.scope, "MCFT_CAP_04_RUNNER_SCOPE_REQUIRED") as TwinScopeKeyV1;
  for (const field of ["tenant_id", "project_id", "field_id"] as const) requiredStringV1(scope[field], `MCFT_CAP_04_RUNNER_SCOPE_${field.toUpperCase()}_REQUIRED`);
  const refs = requiredRecordV1(record.runtime_config_refs_by_logical_time, "MCFT_CAP_04_RUNNER_CONFIG_REFS_REQUIRED") as Record<string, string>;
  const hashes = requiredRecordV1(record.runtime_config_hashes_by_logical_time, "MCFT_CAP_04_RUNNER_CONFIG_HASHES_REQUIRED") as Record<string, string>;
  if (!Array.isArray(record.authorized_future_forcing_binding_ids) || record.authorized_future_forcing_binding_ids.length === 0) {
    throw new Error("MCFT_CAP_04_RUNNER_FORCING_BINDINGS_REQUIRED");
  }
  const leaseDuration = record.lease_duration_seconds;
  if (typeof leaseDuration !== "number" || !Number.isInteger(leaseDuration) || leaseDuration <= 0) {
    throw new Error("MCFT_CAP_04_RUNNER_LEASE_DURATION_INVALID");
  }
  return {
    mode,
    database_url: typeof record.database_url === "string" ? record.database_url : undefined,
    replay_root: typeof record.replay_root === "string" ? record.replay_root : undefined,
    source_matrix_path: typeof record.source_matrix_path === "string" ? record.source_matrix_path : undefined,
    scope,
    target_logical_time: canonicalIsoV1(record.target_logical_time, "MCFT_CAP_04_RUNNER_TARGET_TIME_INVALID"),
    created_at: canonicalIsoV1(record.created_at, "MCFT_CAP_04_RUNNER_CREATED_AT_INVALID"),
    runtime_config_refs_by_logical_time: refs,
    runtime_config_hashes_by_logical_time: hashes,
    authorized_future_forcing_binding_ids: record.authorized_future_forcing_binding_ids.map((value) => requiredStringV1(value, "MCFT_CAP_04_RUNNER_FORCING_BINDING_INVALID")),
    crop_stage_context: requiredRecordV1(record.crop_stage_context, "MCFT_CAP_04_RUNNER_CROP_STAGE_CONTEXT_REQUIRED") as ContinuationCropStageConfigurationContextV1,
    lease_owner: requiredStringV1(record.lease_owner, "MCFT_CAP_04_RUNNER_LEASE_OWNER_REQUIRED"),
    lease_duration_seconds: leaseDuration,
    requested_start_logical_time: typeof record.requested_start_logical_time === "string" ? canonicalIsoV1(record.requested_start_logical_time, "MCFT_CAP_04_RUNNER_REQUESTED_START_INVALID") : undefined,
    evidence_intent: record.evidence_intent === "LATE_EVIDENCE_REVISION" ? "LATE_EVIDENCE_REVISION" : "MISSED_SCHEDULE_CATCH_UP",
  };
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

function tickSummaryV1(result: ExecuteCap04SingleTickResultV1): Record<string, unknown> {
  const forecast = result.a_record_set.members.find((member) => member.object_type === "twin_forecast_run_v1");
  return {
    status: result.status,
    record_set_id: result.a_record_set.record_set_id,
    aggregate_determinism_hash: result.a_record_set.aggregate_determinism_hash,
    forecast_ref: forecast?.object_id ?? null,
    forecast_hash: forecast?.determinism_hash ?? null,
    scenario_set_ref: result.b_record?.scenario_set.object_id ?? null,
    scenario_set_hash: result.b_record?.scenario_set.determinism_hash ?? null,
    next_logical_tick_time: result.next_handoff.next_logical_tick_time,
    previous_tick_sequence: result.next_handoff.previous_tick_sequence,
  };
}

function rangeSummaryV1(result: RunCap04ForecastScenarioRangeResultV1): Record<string, unknown> {
  return {
    status: result.status,
    persisted_start_logical_time: result.persisted_start_logical_time,
    requested_target_logical_time: result.requested_target_logical_time,
    executed_tick_count: result.executed_tick_count,
    successful_a1_tick_count: result.successful_a1_tick_count,
    blocked_a2_tick_count: result.blocked_a2_tick_count,
    posterior_state_count: result.posterior_state_count,
    successful_forecast_run_count: result.successful_forecast_run_count,
    scenario_set_count: result.scenario_set_count,
    forecast_point_count: result.forecast_point_count,
    scenario_point_count: result.scenario_point_count,
    blocked_logical_time: result.blocked_logical_time,
    final_next_logical_tick_time: result.final_handoff.next_logical_tick_time,
    final_tick_sequence: result.final_handoff.previous_tick_sequence,
  };
}

function restartSummaryV1(result: Cap04ForecastScenarioRestartResumeResultV1): Record<string, unknown> {
  return {
    operator_intent: result.operator_intent,
    persisted_checkpoint_ref: result.persisted_checkpoint_ref,
    persisted_terminal_tick_ref: result.persisted_terminal_tick_ref,
    persisted_start_logical_time: result.persisted_start_logical_time,
    range: rangeSummaryV1(result.range_result),
  };
}

async function main(): Promise<void> {
  const input = parseInputV1(JSON.parse(fs.readFileSync(inputPathV1(process.argv.slice(2)), "utf8")));
  const databaseUrl = input.database_url ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("MCFT_CAP_04_RUNNER_DATABASE_URL_REQUIRED");
  const replayRoot = resolvePathV1(input.replay_root ?? "fixtures/mcft/water_state/replay_v1");
  const sourceMatrixPath = resolvePathV1(input.source_matrix_path ?? "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json");
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
    const recoveryRepository = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
    const persistence = persistenceAdapterV1(runtimeRepository, recoveryRepository);
    const evidenceSource = new CanonicalReplayFileSourceV1(replayRoot, sourceMatrixPath);
    const handoffService = new PrepareNextTickInputServiceV1(nextTickRepository);
    const innerTickService = new Cap04ForecastScenarioSingleTickServiceV1(handoffService, evidenceSource, runtimeRepository, persistence);
    const barrierTickService = new Cap04PendingScenarioBarrierSingleTickServiceV1(handoffService, runtimeRepository, persistence, innerTickService);
    const rangeService = new Cap04ForecastScenarioRangeServiceV1(handoffService, barrierTickService);
    const restartService = new Cap04ForecastScenarioRestartResumeServiceV1(handoffService, rangeService);
    const common = {
      scope: input.scope,
      to_logical_time: input.target_logical_time,
      created_at: input.created_at,
      runtime_config_refs_by_logical_time: input.runtime_config_refs_by_logical_time,
      runtime_config_hashes_by_logical_time: input.runtime_config_hashes_by_logical_time,
      authorized_future_forcing_binding_ids: input.authorized_future_forcing_binding_ids,
      crop_stage_context: input.crop_stage_context,
      lease_owner: input.lease_owner,
      lease_duration_seconds: input.lease_duration_seconds,
    };

    let result: Record<string, unknown>;
    if (input.mode === "single-tick") {
      const runtimeConfigRef = requiredStringV1(input.runtime_config_refs_by_logical_time[input.target_logical_time], "MCFT_CAP_04_RUNNER_TARGET_CONFIG_REF_REQUIRED");
      const runtimeConfigHash = requiredStringV1(input.runtime_config_hashes_by_logical_time[input.target_logical_time], "MCFT_CAP_04_RUNNER_TARGET_CONFIG_HASH_REQUIRED");
      result = tickSummaryV1(await barrierTickService.executeOneTick({
        scope: input.scope,
        logical_time: input.target_logical_time,
        created_at: input.created_at,
        runtime_config_ref: runtimeConfigRef,
        runtime_config_hash: runtimeConfigHash,
        authorized_future_forcing_binding_ids: input.authorized_future_forcing_binding_ids,
        crop_stage_context: input.crop_stage_context,
        lease_owner: input.lease_owner,
        lease_duration_seconds: input.lease_duration_seconds,
      }));
    } else if (input.mode === "range") {
      result = rangeSummaryV1(await rangeService.runContiguousRange(common));
    } else if (input.mode === "resume") {
      result = restartSummaryV1(await restartService.resumeFromCheckpoint(common));
    } else {
      result = restartSummaryV1(await restartService.runBoundedBackfill({
        ...common,
        requested_start_logical_time: input.requested_start_logical_time,
        evidence_intent: input.evidence_intent ?? "MISSED_SCHEDULE_CATCH_UP",
      }));
    }

    process.stdout.write(`${JSON.stringify({ ok: true, mode: input.mode, result })}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
