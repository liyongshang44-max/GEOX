// apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts
// Purpose: provide one explicit operator-invoked PostgreSQL entrypoint for the authorized MCFT-CAP-05 bounded eight-tick feedback chain.
// Boundary: no HTTP route, browser write path, scheduler, daemon, implicit wall clock, late-Evidence revision, Recommendation, Policy Evaluation, GEOX approval authority, dispatch, AO-ACT, calibration, model activation, continuous Runtime, live-field claim or CAP-06 authority.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { CanonicalReplayFileSourceV1 } from "../../src/adapters/twin_runtime/canonical_replay_file_source_v1.js";
import { PostgresActionFeedbackTickSourceV1 } from "../../src/persistence/twin_runtime/postgres_action_feedback_tick_source_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresForecastResidualSourceV1 } from "../../src/persistence/twin_runtime/postgres_forecast_residual_source_v1.js";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  Cap05BoundedEightTickFeedbackChainServiceV1,
  type RunCap05BoundedFeedbackChainInputV1,
} from "../../src/runtime/twin_runtime/bounded_feedback_chain_service_v1.js";
import { Cap05FeedbackExecutionRuntimeConfigRepositoryV1 } from "../../src/runtime/twin_runtime/cap05_feedback_config_execution_view_v1.js";
import { Cap04ForecastScenarioSingleTickServiceV1, type Cap04SingleTickPersistencePortV1 } from "../../src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { Cap05ForecastResidualOutcomeTickServiceV1 } from "../../src/runtime/twin_runtime/forecast_residual_outcome_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { Cap04PendingScenarioBarrierSingleTickServiceV1 } from "../../src/runtime/twin_runtime/pending_scenario_barrier_service_v1.js";
import { Cap05ReceiptConsumingForecastScenarioTickServiceV1 } from "../../src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import type { TwinScopeKeyV1 } from "../../src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

type RunnerInputV1 = {
  database_url?: string;
  replay_root?: string;
  source_matrix_path?: string;
  scope: TwinScopeKeyV1;
  authorized_future_forcing_binding_ids: string[];
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  lease_owner: string;
  lease_duration_seconds: number;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function resolvePathV1(value: string): string {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function inputPathV1(argv: string[]): string {
  const index = argv.indexOf("--input");
  if (index < 0 || !argv[index + 1]) throw new Error("MCFT_CAP_05_RUNNER_INPUT_PATH_REQUIRED");
  return resolvePathV1(argv[index + 1]);
}

function parseInputV1(raw: unknown): RunnerInputV1 {
  const record = requiredRecordV1(raw, "MCFT_CAP_05_RUNNER_INPUT_OBJECT_REQUIRED");
  const scope = requiredRecordV1(record.scope, "MCFT_CAP_05_RUNNER_SCOPE_REQUIRED") as TwinScopeKeyV1;
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    requiredStringV1(scope[field], `MCFT_CAP_05_RUNNER_SCOPE_${field.toUpperCase()}_REQUIRED`);
  }
  if (!Array.isArray(record.authorized_future_forcing_binding_ids)
    || record.authorized_future_forcing_binding_ids.length === 0) {
    throw new Error("MCFT_CAP_05_RUNNER_FORCING_BINDINGS_REQUIRED");
  }
  const leaseDuration = record.lease_duration_seconds;
  if (typeof leaseDuration !== "number" || !Number.isInteger(leaseDuration) || leaseDuration <= 0) {
    throw new Error("MCFT_CAP_05_RUNNER_LEASE_DURATION_INVALID");
  }
  return {
    database_url: typeof record.database_url === "string" ? record.database_url : undefined,
    replay_root: typeof record.replay_root === "string" ? record.replay_root : undefined,
    source_matrix_path: typeof record.source_matrix_path === "string" ? record.source_matrix_path : undefined,
    scope,
    authorized_future_forcing_binding_ids: record.authorized_future_forcing_binding_ids.map(
      (value) => requiredStringV1(value, "MCFT_CAP_05_RUNNER_FORCING_BINDING_INVALID"),
    ),
    crop_stage_context: requiredRecordV1(
      record.crop_stage_context,
      "MCFT_CAP_05_RUNNER_CROP_STAGE_CONTEXT_REQUIRED",
    ) as ContinuationCropStageConfigurationContextV1,
    lease_owner: requiredStringV1(record.lease_owner, "MCFT_CAP_05_RUNNER_LEASE_OWNER_REQUIRED"),
    lease_duration_seconds: leaseDuration,
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

function compactResultV1(result: Awaited<ReturnType<Cap05BoundedEightTickFeedbackChainServiceV1["run"]>>): Record<string, unknown> {
  return {
    service_id: result.service_id,
    status: result.status,
    initial_completed_tick_count: result.initial_completed_tick_count,
    executed_tick_count_this_call: result.executed_tick_count_this_call,
    established_tick_count: result.established_tick_count,
    posterior_state_count: result.posterior_state_count,
    successful_forecast_run_count: result.successful_forecast_run_count,
    scenario_set_count: result.scenario_set_count,
    forecast_point_count: result.forecast_point_count,
    scenario_point_count: result.scenario_point_count,
    first_committed_sequence: result.first_committed_sequence,
    final_committed_sequence: result.final_committed_sequence,
    final_next_logical_tick_time: result.final_next_logical_tick_time,
    runtime_config_count: result.runtime_config_count,
    runtime_config_insert_count: result.runtime_config_insert_count,
    runtime_config_existing_count: result.runtime_config_existing_count,
    residual_status: result.residual_status,
    residual_ref: result.residual_ref,
    residual_hash: result.residual_hash,
    orchestrator_canonical_twin_object_fact_delta: result.orchestrator_canonical_twin_object_fact_delta,
    full_capability_path_canonical_twin_object_fact_delta: result.full_capability_path_canonical_twin_object_fact_delta,
    replay_evidence_fact_delta_accounted_separately: result.replay_evidence_fact_delta_accounted_separately,
    projection_row_delta_accounted_separately: result.projection_row_delta_accounted_separately,
    causal_effect_claimed: result.causal_effect_claimed,
    forecast_assimilation_equivalence_claimed: result.forecast_assimilation_equivalence_claimed,
    automatic_history_rewrite: result.automatic_history_rewrite,
  };
}

async function main(): Promise<void> {
  const input = parseInputV1(JSON.parse(fs.readFileSync(inputPathV1(process.argv.slice(2)), "utf8")));
  const databaseUrl = input.database_url ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("MCFT_CAP_05_RUNNER_DATABASE_URL_REQUIRED");
  const replayRoot = resolvePathV1(input.replay_root ?? "fixtures/mcft/water_state/replay_v1");
  const sourceMatrixPath = resolvePathV1(
    input.source_matrix_path ?? "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json",
  );
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const executionConfigRepository = new Cap05FeedbackExecutionRuntimeConfigRepositoryV1(runtimeRepository);
    const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
    const recoveryRepository = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
    const feedbackRepository = new PostgresFeedbackPersistenceRepositoryV1(pool);
    const persistence = persistenceAdapterV1(runtimeRepository, recoveryRepository);
    const replayEvidenceSource = new CanonicalReplayFileSourceV1(replayRoot, sourceMatrixPath);
    const handoffService = new PrepareNextTickInputServiceV1(nextTickRepository);
    const baseTickService = new Cap04ForecastScenarioSingleTickServiceV1(
      handoffService,
      replayEvidenceSource,
      executionConfigRepository,
      persistence,
    );
    const continuationTickService = new Cap04PendingScenarioBarrierSingleTickServiceV1(
      handoffService,
      executionConfigRepository,
      persistence,
      baseTickService,
    );
    const receiptTickService = new Cap05ReceiptConsumingForecastScenarioTickServiceV1(
      handoffService,
      replayEvidenceSource,
      new PostgresActionFeedbackTickSourceV1(pool),
      executionConfigRepository,
      persistence,
    );
    const outcomeTickService = new Cap05ForecastResidualOutcomeTickServiceV1(
      baseTickService,
      runtimeRepository,
      new PostgresForecastResidualSourceV1(pool),
      feedbackRepository,
    );
    const service = new Cap05BoundedEightTickFeedbackChainServiceV1(
      handoffService,
      runtimeRepository,
      receiptTickService,
      outcomeTickService,
      continuationTickService,
    );
    const request: RunCap05BoundedFeedbackChainInputV1 = {
      scope: input.scope,
      authorized_future_forcing_binding_ids: input.authorized_future_forcing_binding_ids,
      crop_stage_context: input.crop_stage_context,
      lease_owner: input.lease_owner,
      lease_duration_seconds: input.lease_duration_seconds,
    };
    const result = await service.run(request);
    process.stdout.write(`${JSON.stringify({ ok: true, result: compactResultV1(result) })}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
