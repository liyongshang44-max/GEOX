// apps/server/scripts/mcft/MCFT_CAP_02_HOURLY_DYNAMICS_RUNNER.ts
// Purpose: provide one explicit manual Replay entry for MCFT-CAP-02 single-tick, contiguous range, restart/resume, and bounded forward-backfill operation.
// Boundary: operator-invoked one-shot process only; no HTTP write route, browser write path, scheduler, daemon, implicit wall clock, successful Forecast, Scenario, Recommendation, Decision, or action.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { CanonicalReplayFileSourceV1 } from "../../src/adapters/twin_runtime/canonical_replay_file_source_v1.js";
import { parseReplayRangeIntentV1 } from "../../src/adapters/twin_runtime/replay_range_intent_adapter_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { ContiguousContinuationRangeServiceV1, type RunContiguousContinuationRangeResultV1 } from "../../src/runtime/twin_runtime/contiguous_continuation_range_service_v1.js";
import { ContinuationTickServiceV1 } from "../../src/runtime/twin_runtime/continuation_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { RestartResumeServiceV1, type RestartResumeResultV1 } from "../../src/runtime/twin_runtime/restart_resume_service_v1.js";
import type { TwinScopeKeyV1 } from "../../src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function readJsonFileV1<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function resolveInputPathV1(value: string): string {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function scopeFromConfigV1(config: CanonicalObjectEnvelopeV1): TwinScopeKeyV1 {
  return {
    tenant_id: config.tenant_id,
    project_id: config.project_id,
    group_id: requiredStringV1(config.group_id, "RUNTIME_CONFIG_GROUP_ID_REQUIRED"),
    field_id: config.field_id,
    season_id: requiredStringV1(config.season_id, "RUNTIME_CONFIG_SEASON_ID_REQUIRED"),
    zone_id: requiredStringV1(config.zone_id, "RUNTIME_CONFIG_ZONE_ID_REQUIRED"),
  };
}

function rangeSummaryV1(result: RunContiguousContinuationRangeResultV1): Record<string, unknown> {
  return {
    status: result.status,
    persisted_start_logical_time: result.persisted_start_logical_time,
    requested_target_logical_time: result.requested_target_logical_time,
    executed_tick_count: result.executed_tick_count,
    record_set_ids: result.tick_results.map((item) => item.record_set.continuation_record_set_id),
    final_state_ref: result.final_handoff.previous_posterior_ref,
    final_checkpoint_ref: result.final_handoff.previous_checkpoint_ref,
    next_logical_tick_time: result.final_handoff.next_logical_tick_time,
  };
}

function restartSummaryV1(result: RestartResumeResultV1): Record<string, unknown> {
  return {
    operator_intent: result.operator_intent,
    persisted_checkpoint_ref: result.persisted_checkpoint_ref,
    persisted_terminal_tick_ref: result.persisted_terminal_tick_ref,
    persisted_start_logical_time: result.persisted_start_logical_time,
    range: rangeSummaryV1(result.range_result),
  };
}

async function main(): Promise<void> {
  const intent = parseReplayRangeIntentV1({
    argv: process.argv.slice(2),
    environment_database_url: process.env.DATABASE_URL,
  });
  const pool = new Pool({ connectionString: intent.database_url });

  try {
    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
    const runtimeConfig = await runtimeRepository.readRuntimeConfig(intent.continuation_runtime_config_ref);
    if (!runtimeConfig) throw new Error("CONTINUATION_RUNTIME_CONFIG_NOT_FOUND");
    if (runtimeConfig.object_type !== "twin_runtime_config_v1") throw new Error("CONTINUATION_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");

    const cropStageDescriptor = requiredRecordV1(
      runtimeConfig.payload.crop_stage_context,
      "CONTINUATION_CROP_STAGE_CONTEXT_REQUIRED",
    );
    const cropStageContextRef = requiredStringV1(
      cropStageDescriptor.context_ref,
      "CONTINUATION_CROP_STAGE_CONTEXT_REF_REQUIRED",
    );
    const cropStageContextHash = requiredStringV1(
      cropStageDescriptor.context_hash,
      "CONTINUATION_CROP_STAGE_CONTEXT_HASH_REQUIRED",
    );
    const cropStageContext = readJsonFileV1<ContinuationCropStageConfigurationContextV1>(
      resolveInputPathV1(cropStageContextRef),
    );
    const replayRoot = intent.replay_root
      ? resolveInputPathV1(intent.replay_root)
      : path.join(ROOT, "fixtures/mcft/water_state/replay_v1");
    const sourceMatrixPath = intent.source_matrix_path
      ? resolveInputPathV1(intent.source_matrix_path)
      : path.join(ROOT, "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json");
    const evidenceSource = new CanonicalReplayFileSourceV1(replayRoot, sourceMatrixPath);
    const handoffService = new PrepareNextTickInputServiceV1(nextTickRepository);
    const tickService = new ContinuationTickServiceV1(
      handoffService,
      evidenceSource,
      runtimeRepository,
      runtimeRepository,
    );
    const rangeService = new ContiguousContinuationRangeServiceV1(handoffService, tickService);
    const restartService = new RestartResumeServiceV1(handoffService, rangeService);
    const scope = scopeFromConfigV1(runtimeConfig);
    const common = {
      scope,
      created_at: intent.created_at,
      continuation_runtime_config_ref: intent.continuation_runtime_config_ref,
      crop_stage_context_ref: cropStageContextRef,
      crop_stage_context_hash: cropStageContextHash,
      crop_stage_context: cropStageContext,
      lease_owner: intent.lease_owner,
      lease_duration_seconds: intent.lease_duration_seconds,
    };

    let result: Record<string, unknown>;
    if (intent.mode === "single-tick") {
      const tick = await tickService.executeOneTick({
        ...common,
        logical_time: intent.target_logical_time,
      });
      result = {
        status: tick.status,
        record_set_id: tick.record_set.continuation_record_set_id,
        record_set_hash: tick.record_set.continuation_record_set_determinism_hash,
        final_state_ref: tick.next_handoff.previous_posterior_ref,
        final_checkpoint_ref: tick.next_handoff.previous_checkpoint_ref,
        next_logical_tick_time: tick.next_handoff.next_logical_tick_time,
      };
    } else if (intent.mode === "range") {
      result = rangeSummaryV1(await rangeService.runContiguousContinuationRangeV1({
        ...common,
        to_logical_time: intent.target_logical_time,
      }));
    } else if (intent.mode === "resume") {
      result = restartSummaryV1(await restartService.resumeFromCheckpointV1({
        ...common,
        to_logical_time: intent.target_logical_time,
      }));
    } else {
      result = restartSummaryV1(await restartService.runBoundedBackfillV1({
        ...common,
        to_logical_time: intent.target_logical_time,
        requested_start_logical_time: intent.requested_start_logical_time,
        evidence_intent: intent.evidence_intent,
      }));
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      operator_intent: intent.operator_intent,
      mode: intent.mode,
      result,
    })}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  })}\n`);
  process.exitCode = 1;
});
