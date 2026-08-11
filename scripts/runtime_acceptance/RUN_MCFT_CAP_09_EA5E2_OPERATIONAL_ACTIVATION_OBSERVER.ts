// Purpose: execute the real T+07:17 operational-activation observer against five canonical records already ingressed into an isolated qualification PostgreSQL database.
// Authority boundary: reads the persisted External A0 handoff from Formal Neon in READ ONLY mode, derives one qualification-only crop/config context for this real T, executes DB-only External CAP04, and emits metadata-only proof. No Formal write, scheduler write, canonical Runtime persistence, provider fetch, or epoch selection.

import fs from "node:fs";
import { Pool } from "pg";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  compileExternalFormalRuntimeConfigV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { executeExternalFormalCap04CandidateV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.js";
import { PostgresExternalFormalEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.js";
import type {
  ContinuationCropStageConfigurationContextV1,
} from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import type { PreparedNextTickInputV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const OBSERVER_OFFSET_MINUTES = 437;
const MAX_OBSERVER_START_SKEW_MINUTES = 10;
const EXACT_INTERVAL_CUTOFF_OFFSET_MINUTES = 432;
const CONFIG_MATRIX_REF = "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json";
const CONFIG_MATRIX_HASH = "sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5";
const CROP_AUTHORITY_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json";
const CROP_AUTHORITY_BLOB = "b5de9d29189cb654444b3f57d00df290eefe16d3";
const A0_CONFIG_REF = "external_formal_runtime_config_7284202e3b0bdae6d32f4814";
const A0_CONFIG_HASH = "sha256:d6b5bf0fcd385aa3657b7c97c72cc82093a45088463466436671857116bb6fc8";

function env(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`EA5E2_OPERATIONAL_ACTIVATION_ENV_REQUIRED:${name}`);
  return value.trim();
}

function exactHour(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || !value.endsWith(":00:00.000Z")) {
    throw new Error("EA5E2_OPERATIONAL_ACTIVATION_EXACT_TARGET_T_REQUIRED");
  }
  return value;
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function str(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function num(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function six(value: number): string {
  return value.toFixed(6);
}

function stageAtV1(ageDays: number, lengths: readonly number[]): string | null {
  if (lengths.length !== 4) throw new Error("EA5E2_ACTIVATION_EXACT_FOUR_STAGE_LENGTHS_REQUIRED");
  const initial = lengths[0]!;
  const development = lengths[1]!;
  const mid = lengths[2]!;
  const late = lengths[3]!;
  const b1 = initial;
  const b2 = b1 + development;
  const b3 = b2 + mid;
  const b4 = b3 + late;
  if (ageDays < 0 || ageDays >= b4) return null;
  if (ageDays < b1) return "INITIAL";
  if (ageDays < b2) return "DEVELOPMENT";
  if (ageDays < b3) return "MID";
  return "LATE";
}

function deriveSingleTargetCropContextV1(targetT: string): {
  stage: string;
  contextRef: string;
  contextHash: string;
  context: ContinuationCropStageConfigurationContextV1;
} {
  const authority = JSON.parse(fs.readFileSync(CROP_AUTHORITY_PATH, "utf8")) as Record<string, unknown>;
  const planting = record(authority.planting_authority, "EA5E2_ACTIVATION_PLANTING_AUTHORITY_REQUIRED");
  const window = record(planting.possible_event_window_utc, "EA5E2_ACTIVATION_PLANTING_WINDOW_REQUIRED");
  const model = record(authority.model_stage_prior, "EA5E2_ACTIVATION_MODEL_STAGE_PRIOR_REQUIRED");
  const policy = record(authority.as_of_derivation_policy, "EA5E2_ACTIVATION_DERIVATION_POLICY_REQUIRED");
  const starts = [
    Date.parse(str(window.start_inclusive, "EA5E2_ACTIVATION_PLANTING_START_REQUIRED")),
    Date.parse(str(window.end_exclusive, "EA5E2_ACTIVATION_PLANTING_END_REQUIRED")) - 1,
  ];
  if (starts.some((value) => !Number.isFinite(value))) throw new Error("EA5E2_ACTIVATION_PLANTING_WINDOW_INVALID");
  const variants = model.variant_stage_lengths_days;
  if (!Array.isArray(variants) || variants.length !== 6) throw new Error("EA5E2_ACTIVATION_EXACT_SIX_FAO_VARIANTS_REQUIRED");
  const backwardHours = num(policy.backward_stability_hours, "EA5E2_ACTIVATION_BACKWARD_GUARD_REQUIRED");
  const forwardHours = num(policy.forward_transition_guard_hours, "EA5E2_ACTIVATION_FORWARD_GUARD_REQUIRED");
  if (backwardHours !== 6 || forwardHours !== 30) throw new Error("EA5E2_ACTIVATION_CROP_GUARD_DRIFT");

  const base = Date.parse(targetT);
  const guardTimes = [base - backwardHours * HOUR_MS, base, base + forwardHours * HOUR_MS];
  const stages = new Set<string>();
  for (const variantRaw of variants) {
    if (!Array.isArray(variantRaw) || variantRaw.length !== 4 || variantRaw.some((x) => typeof x !== "number" || !Number.isFinite(x))) {
      throw new Error("EA5E2_ACTIVATION_FAO_VARIANT_INVALID");
    }
    const lengths = variantRaw as number[];
    for (const plantingMs of starts) {
      for (const timeMs of guardTimes) {
        const stage = stageAtV1((timeMs - plantingMs) / (24 * HOUR_MS), lengths);
        if (!stage) throw new Error("EA5E2_ACTIVATION_CROP_STAGE_OUTSIDE_FROZEN_MODEL_WINDOW");
        stages.add(stage);
      }
    }
  }
  if (stages.size !== 1) {
    throw new Error(`EA5E2_ACTIVATION_CROP_STAGE_NO_CONSERVATIVE_CONSENSUS:${[...stages].sort().join(",")}`);
  }
  const stage = [...stages][0]!;
  const parameterByStage: Record<string, { kc: number; cropRootDepthMm: number; effectiveModelRootDepthMm: number }> = {
    INITIAL: { kc: 0.3, cropRootDepthMm: 150, effectiveModelRootDepthMm: 150 },
    DEVELOPMENT: { kc: 0.7, cropRootDepthMm: 300, effectiveModelRootDepthMm: 300 },
    MID: { kc: 1.15, cropRootDepthMm: 600, effectiveModelRootDepthMm: 300 },
    LATE: { kc: 0.6, cropRootDepthMm: 600, effectiveModelRootDepthMm: 300 },
  };
  const parameter = parameterByStage[stage];
  if (!parameter) throw new Error(`EA5E2_ACTIVATION_UNSUPPORTED_STAGE:${stage}`);
  const coverageStart = new Date(base - backwardHours * HOUR_MS).toISOString();
  const coverageEnd = new Date(base + forwardHours * HOUR_MS).toISOString();
  const contextRef = `ea5e2_operational_activation_crop_context_${targetT.replace(/[^0-9]/g, "").toLowerCase()}`;
  const contextHash = semanticHashV1({
    context_ref: contextRef,
    authority_ref: CROP_AUTHORITY_PATH,
    authority_blob_sha: CROP_AUTHORITY_BLOB,
    configuration_matrix_ref: CONFIG_MATRIX_REF,
    configuration_matrix_hash: CONFIG_MATRIX_HASH,
    derived_context_authority: authority.derived_context_authority,
    crop_stage_code: stage,
    kc: parameter.kc,
    crop_root_depth_mm: parameter.cropRootDepthMm,
    effective_model_root_depth_mm: parameter.effectiveModelRootDepthMm,
    coverage_start: coverageStart,
    coverage_end_exclusive: coverageEnd,
    derivation_authority_time: targetT,
    observed_biological_stage_claimed: false,
    field_calibration_status: "NOT_FIELD_CALIBRATED",
  });
  const context: ContinuationCropStageConfigurationContextV1 = {
    schema_version: "geox_mcft_cap09_ea5e2_operational_activation_crop_context_v1",
    dataset_id: "mcft_cap09_ea5e2_operational_activation_single_t_v1",
    context_class: "CONFIGURATION_DERIVED_CONTEXT",
    evidence_record: false,
    configuration_matrix_ref: CONFIG_MATRIX_REF,
    configuration_matrix_hash: CONFIG_MATRIX_HASH,
    crop_water_use_binding_ref: "external_public_research_crop_water_use_v1",
    crop_water_use_configuration_source_id: "mcft_crop_water_use_corn_v1",
    crop_stage_mapping_source: "mcft_corn_stage_mapping_v1",
    timezone: "UTC",
    coverage_start: coverageStart,
    coverage_end_exclusive: coverageEnd,
    crop_stage_schedule: [{
      stage_code: stage,
      effective_from: coverageStart,
      effective_to: coverageEnd,
      kc: parameter.kc,
      crop_root_depth_mm: parameter.cropRootDepthMm,
      effective_model_root_depth_mm: parameter.effectiveModelRootDepthMm,
    }],
    limitations: [
      "QUALIFICATION_ONLY_NOT_FORMAL_EPOCH_CONFIG",
      "FAO56_MAIZE_GRAIN_CONSENSUS_ENVELOPE_FROM_PLANTING_DATE_V1",
      "NO_OBSERVED_BIOLOGICAL_STAGE_CLAIM",
      "MODEL_PRIOR_FROM_CAP08",
      "NOT_FIELD_CALIBRATED",
      "NO_FUTURE_OBSERVATION_USE",
    ],
    determinism_hash: contextHash,
  };
  return { stage, contextRef, contextHash, context };
}

function buildHandoffV1(
  snapshot: Awaited<ReturnType<PostgresNextTickRepositoryV1["readPersistedNextTickSnapshot"]>>,
  targetT: string,
): PreparedNextTickInputV1 {
  if (!snapshot) throw new Error("EA5E2_ACTIVATION_FORMAL_A0_SNAPSHOT_REQUIRED");
  const state = snapshot.previous_posterior;
  const checkpoint = snapshot.checkpoint;
  const forecast = snapshot.previous_forecast_result;
  if (!forecast) throw new Error("EA5E2_ACTIVATION_A0_FORECAST_REQUIRED");
  const statePayload = record(state.payload, "EA5E2_ACTIVATION_A0_STATE_PAYLOAD_REQUIRED");
  const posterior = record(statePayload.posterior, "EA5E2_ACTIVATION_A0_POSTERIOR_REQUIRED");
  const derived = record(statePayload.derived_state, "EA5E2_ACTIVATION_A0_DERIVED_STATE_REQUIRED");
  const storage = record(derived.root_zone_water_storage_mm, "EA5E2_ACTIVATION_A0_STORAGE_REQUIRED");
  if (snapshot.runtime_config.object_id !== A0_CONFIG_REF || snapshot.runtime_config.determinism_hash !== A0_CONFIG_HASH) {
    throw new Error("EA5E2_ACTIVATION_EXACT_A0_RUNTIME_CONFIG_REQUIRED");
  }
  if (forecast.payload.status !== "BLOCKED") throw new Error("EA5E2_ACTIVATION_A0_FORECAST_MUST_BE_BLOCKED");
  const lineageId = str(snapshot.active_lineage_id ?? state.lineage_id, "EA5E2_ACTIVATION_LINEAGE_ID_REQUIRED");
  const revisionId = str(state.revision_id, "EA5E2_ACTIVATION_REVISION_ID_REQUIRED");
  const priorVariance = num(posterior.variance, "EA5E2_ACTIVATION_A0_POSTERIOR_VARIANCE_REQUIRED");
  return {
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    active_lineage_ref: snapshot.active_lineage_ref,
    previous_posterior_ref: state.object_id,
    previous_posterior_hash: state.determinism_hash,
    previous_checkpoint_ref: checkpoint.object_id,
    previous_checkpoint_hash: checkpoint.determinism_hash,
    previous_forecast_result_ref: forecast.object_id,
    previous_forecast_result_hash: forecast.determinism_hash,
    latest_successful_forecast_ref: null,
    lineage_id: lineageId,
    revision_id: revisionId,
    prior_mean: num(posterior.mean, "EA5E2_ACTIVATION_A0_POSTERIOR_MEAN_REQUIRED"),
    prior_variance: priorVariance,
    previous_storage_mm_decimal: six(num(storage.mean, "EA5E2_ACTIVATION_A0_STORAGE_MEAN_REQUIRED")),
    previous_variance_basis: {
      basis_origin: "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1",
      source_posterior_ref: state.object_id,
      source_vwc_variance: six(priorVariance),
    },
    previous_tick_sequence: 0,
    next_logical_tick_time: targetT,
    previous_state_runtime_config_ref: snapshot.runtime_config.object_id,
    previous_state_runtime_config_hash: snapshot.runtime_config.determinism_hash,
    reality_binding_ref: snapshot.reality_binding.binding_id,
    reality_binding_hash: snapshot.reality_binding.determinism_hash,
  };
}

async function assertFormalDatabaseReadOnlyPreconditionsV1(formalPool: Pool): Promise<void> {
  const identity = await formalPool.query("SELECT current_database() AS db, current_setting('server_version_num')::int AS version_num");
  if (identity.rows.length !== 1 || identity.rows[0].db !== "geox_mcft_cap09_s6_formal_24h" || Number(identity.rows[0].version_num) < 160000) {
    throw new Error("EA5E2_ACTIVATION_FORMAL_DATABASE_IDENTITY_MISMATCH");
  }
  const client = await formalPool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const schedulerState = await client.query(
      "SELECT (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1) AS slots, (SELECT count(*)::int FROM twin_shadow_online_scheduler_cursor_v1) AS cursors",
    );
    if (schedulerState.rows.length !== 1) throw new Error("EA5E2_ACTIVATION_FORMAL_SCHEDULER_CARDINALITY");
    const schedulerRow = schedulerState.rows[0];
    if (Number(schedulerRow.slots) !== 0 || Number(schedulerRow.cursors) !== 0) {
      throw new Error("EA5E2_ACTIVATION_FORMAL_SCHEDULER_MUST_REMAIN_UNSTARTED");
    }
    await client.query("COMMIT");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve original read failure */ }
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const targetT = exactHour(env("MCFT_EA5E2_TARGET_T"));
  const subjectSha = env("MCFT_EA5E2_SUBJECT_SHA");
  if (!/^[0-9a-f]{40}$/.test(subjectSha)) throw new Error("EA5E2_ACTIVATION_EXACT_SUBJECT_SHA_REQUIRED");
  const expectedObserverMs = Date.parse(targetT) + OBSERVER_OFFSET_MINUTES * MINUTE_MS;
  const observedAtMs = Date.now();
  if (observedAtMs < expectedObserverMs) throw new Error("EA5E2_ACTIVATION_OBSERVER_EARLY_FORBIDDEN");
  const observerSkewMinutes = (observedAtMs - expectedObserverMs) / MINUTE_MS;
  if (observerSkewMinutes > MAX_OBSERVER_START_SKEW_MINUTES) {
    throw new Error(`EA5E2_ACTIVATION_OBSERVER_START_TOO_LATE:${observerSkewMinutes}`);
  }
  const observerCreatedAt = new Date(observedAtMs).toISOString();
  const exactIntervalAvailabilityCutoffTime = new Date(
    Date.parse(targetT) + EXACT_INTERVAL_CUTOFF_OFFSET_MINUTES * MINUTE_MS,
  ).toISOString();

  const isolatedPool = new Pool({
    connectionString: env("DATABASE_URL"),
    max: 2,
    application_name: "mcft_cap09_ea5e2_operational_activation_observer",
  });
  const formalPool = new Pool({
    connectionString: env("FORMAL_DATABASE_URL"),
    max: 2,
    application_name: "mcft_cap09_ea5e2_operational_activation_formal_readonly",
  });
  try {
    await assertFormalDatabaseReadOnlyPreconditionsV1(formalPool);
    const formalSnapshot = await new PostgresNextTickRepositoryV1(formalPool).readPersistedNextTickSnapshot({
      ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    });
    if (!formalSnapshot) throw new Error("EA5E2_ACTIVATION_FORMAL_A0_SNAPSHOT_REQUIRED");
    const handoff = buildHandoffV1(formalSnapshot, targetT);
    const parent = formalSnapshot.runtime_config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
    const crop = deriveSingleTargetCropContextV1(targetT);
    const runtimeConfig = compileExternalFormalRuntimeConfigV1({
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      config_role: "HOURLY_CAP04",
      effective_logical_time: targetT,
      created_at: observerCreatedAt,
      parent_runtime_config_ref: formalSnapshot.runtime_config.object_id,
      parent_runtime_config_hash: formalSnapshot.runtime_config.determinism_hash,
      reality_binding_ref: parent.reality_binding_ref,
      reality_binding_hash: parent.reality_binding_hash,
      source_matrix_ref: parent.source_matrix_ref,
      source_matrix_hash: parent.source_matrix_hash,
      configuration_matrix_ref: parent.configuration_matrix_ref,
      configuration_matrix_hash: parent.configuration_matrix_hash,
      geometry_semantic_hash: parent.geometry_semantic_hash,
      formal_authorities: structuredClone(parent.formal_authorities),
      crop_stage_context_authority: {
        context_ref: crop.contextRef,
        context_hash: crop.contextHash,
        configuration_matrix_ref: parent.crop_stage_context_authority.configuration_matrix_ref,
        configuration_matrix_hash: parent.crop_stage_context_authority.configuration_matrix_hash,
      },
      model_prior: {
        source_ref: parent.model_prior.source_ref,
        source_hash: parent.model_prior.source_hash,
      },
    });

    const evidenceSource = new PostgresExternalFormalEvidenceSourceV1(isolatedPool);
    const loaded = await evidenceSource.loadCandidateRecords({
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      logical_time: targetT,
      exact_interval_availability_cutoff_time: exactIntervalAvailabilityCutoffTime,
    });
    if (loaded.selected_record_count !== 5 || loaded.provider_request_count !== 0 || loaded.database_write_count !== 0) {
      throw new Error(`EA5E2_ACTIVATION_EXACT_FIVE_DB_ONLY_RECORDS_REQUIRED:${loaded.selected_record_count}`);
    }

    const candidate = executeExternalFormalCap04CandidateV1({
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      logical_time: targetT,
      created_at: observerCreatedAt,
      runtime_config: runtimeConfig,
      handoff,
      candidate_records: loaded.records,
      crop_stage_context: crop.context,
    });
    const forecastCandidate = candidate.forecast_authority.forecast_candidate;
    if (candidate.operation_variant !== "A1" || forecastCandidate.status !== "COMPLETED" || forecastCandidate.points.length !== 72) {
      throw new Error(
        `EA5E2_ACTIVATION_EXTERNAL_CAP04_A1_COMPLETED_72_REQUIRED:${candidate.operation_variant}:${forecastCandidate.status}:${forecastCandidate.points.length}`,
      );
    }
    if (candidate.canonical_persistence_authorized !== false
      || candidate.database_write_count !== 0
      || candidate.scenario_write_count !== 0
      || candidate.recommendation_write_count !== 0
      || candidate.action_write_count !== 0
      || candidate.provider_request_count !== 0) {
      throw new Error("EA5E2_ACTIVATION_CAP04_SIDE_EFFECT_OR_PROVIDER_FETCH_FORBIDDEN");
    }

    fs.mkdirSync("acceptance-output", { recursive: true });
    const proof = {
      schema_version: "geox_mcft_cap09_ea5e2_operational_activation_observer_proof_v1",
      status: "PASS",
      subject_sha: subjectSha,
      target_t: targetT,
      expected_observer_at: new Date(expectedObserverMs).toISOString(),
      observed_at: observerCreatedAt,
      observer_start_skew_minutes: observerSkewMinutes,
      observer_start_skew_max_minutes: MAX_OBSERVER_START_SKEW_MINUTES,
      crop_stage_code: crop.stage,
      crop_context_ref: crop.contextRef,
      crop_context_hash: crop.contextHash,
      crop_context_class: "QUALIFICATION_ONLY_NOT_FORMAL_EPOCH_CONFIG",
      formal_a0_runtime_config_ref: formalSnapshot.runtime_config.object_id,
      formal_a0_runtime_config_hash: formalSnapshot.runtime_config.determinism_hash,
      qualification_runtime_config_ref: runtimeConfig.object_id,
      qualification_runtime_config_hash: runtimeConfig.determinism_hash,
      exact_interval_availability_cutoff_time: exactIntervalAvailabilityCutoffTime,
      db_only_runtime: true,
      provider_request_count: loaded.provider_request_count + candidate.provider_request_count,
      selected_record_count: loaded.selected_record_count,
      disposition: candidate.operation_variant,
      forecast_status: forecastCandidate.status,
      forecast_point_count: forecastCandidate.points.length,
      persistence_performed: false,
      scenario_authorized: false,
      formal_database_access_mode: "READ_ONLY_A0_HANDOFF_ONLY",
      formal_database_write_count: 0,
      scheduler_slot_count: 0,
      scheduler_cursor_count: 0,
      formal_window_started: false,
      ea5e3_authorized: false,
      raw_values_emitted: false,
    };
    fs.writeFileSync(
      "acceptance-output/MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER_PROOF.json",
      JSON.stringify(proof, null, 2) + "\n",
    );
    console.log(JSON.stringify(proof));
  } finally {
    await isolatedPool.end();
    await formalPool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
