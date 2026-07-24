// Purpose: execute or resume the bounded MCFT-CAP-08.S3 T00-T23 Replay range and bind completion authority to one exact persisted Decision/Action episode.
// Boundary: fixed 24-Tick forward range only; no B00 construction, late correction, Residual, Calibration, Shadow, route, scheduler, live ingestion, or production Runtime authority.

import type { InspectCap08CompletionAuthorityInputV1 } from "../../domain/twin_runtime/cap08_completion_authority_contracts_v1.js";
import {
  CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  CAP08_S1_RUN_CONTRACT_ID_V1,
  CAP08_S1_RUNTIME_START_V1,
  CAP08_S1_TICK_COUNT_V1,
  cap08TickIndexFromLogicalTimeV1,
  cap08TickLogicalTimeV1,
} from "../../domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import {
  CAP08_S3_FORMAL_PROVIDER_CONTRACT_DIGEST_V1,
  CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1,
  type Cap08S3FormalProviderQualificationV1,
} from "../../domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";
import type { PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";
import { Cap08CompletionAuthorityServiceV1 } from "./cap08_completion_authority_service_v1.js";
import {
  Cap08S3EpisodeInspectorV1,
  type Cap08S3EpisodeInspectionV1,
} from "./cap08_s3_episode_inspector_v1.js";
import {
  Cap08S3FormalTickServiceV1,
  type ExecuteCap08S3FormalTickResultV1,
  type PrepareCap08S3NextTickInputPortV1,
} from "./cap08_s3_formal_tick_service_v1.js";

export type RunCap08S3FormalRangeInputV1 = {
  formal_run_id: string;
  scope: TwinScopeKeyV1;
  created_at: string;
  runtime_config_refs_by_logical_time: Readonly<Record<string, string>>;
  runtime_config_hashes_by_logical_time: Readonly<Record<string, string>>;
  authorized_future_forcing_binding_ids: readonly string[];
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  lease_owner: string;
  lease_duration_seconds: number;
};

export type RunCap08S3FormalRangeResultV1 = Cap08S3FormalProviderQualificationV1 & {
  status: "COMPLETED" | "ALREADY_COMPLETE";
  persisted_start_logical_time: string;
  executed_tick_count: number;
  completed_tick_count: 24;
  posterior_state_count: number;
  successful_forecast_count: number;
  scenario_set_count: number;
  forecast_point_count: number;
  scenario_point_count: number;
  tick_results: ExecuteCap08S3FormalTickResultV1[];
  final_handoff: PreparedNextTickInputV1;
  episode_inspection: Cap08S3EpisodeInspectionV1;
  phase_engine_contract_digest: typeof CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1;
  phase_engine_source_digest: string;
  completion_authority_disposition: "ALREADY_COMPLETE_EXACT";
  completion_authority_write_status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS" | null;
  slice_acceptance_only: true;
  final_formal_run_id: null;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function exactEpisodeV1(episode: Cap08S3EpisodeInspectionV1): void {
  if (episode.disposition !== "EXACT_COMPLETE"
    || episode.decision_count !== 1
    || episode.approval_assertion_count !== 1
    || episode.approved_plan_count !== 1
    || episode.execution_receipt_count !== 1
    || episode.action_feedback_count !== 1) {
    throw new Error("CAP08_S3_COMPLETION_WITHOUT_EXACT_EPISODE");
  }
}

function qualificationV1(input: {
  request: RunCap08S3FormalRangeInputV1;
  status: "COMPLETED" | "ALREADY_COMPLETE";
  persisted_start_logical_time: string;
  executed_tick_count: number;
  tick_results: ExecuteCap08S3FormalTickResultV1[];
  final_handoff: PreparedNextTickInputV1;
  episode: Cap08S3EpisodeInspectionV1;
  phase_engine_source_digest: string;
  completion_authority_write_status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS" | null;
}): RunCap08S3FormalRangeResultV1 {
  exactEpisodeV1(input.episode);
  const t08 = input.tick_results.find((tick) => tick.phase_plan.tick_id === "T08");
  const t09 = input.tick_results.find((tick) => tick.phase_plan.tick_id === "T09");
  const t10 = input.tick_results.find((tick) => tick.phase_plan.tick_id === "T10");
  if (input.status === "COMPLETED") {
    if (!t08?.action_feedback_consumed_by_a) throw new Error("CAP08_S3_T08_H_BEFORE_A_PROOF_REQUIRED");
    if (t09?.outcome_fvo10_record !== null) throw new Error("CAP08_S3_T09_OUTCOME_ABSENCE_PROOF_REQUIRED");
    if (!t10?.outcome_fvo10_record) throw new Error("CAP08_S3_T10_OUTCOME_IDENTITY_PROOF_REQUIRED");
  }
  return {
    schema_version: "geox_mcft_cap08_s3_formal_provider_qualification_v1",
    provider_profile_id: CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1,
    provider_contract_digest: CAP08_S3_FORMAL_PROVIDER_CONTRACT_DIGEST_V1,
    formal_run_id: input.request.formal_run_id,
    scope: structuredClone(input.request.scope),
    successful_tick_count: 24,
    decision_count: 1,
    approval_assertion_count: 1,
    approved_plan_count: 1,
    execution_receipt_count: 1,
    action_feedback_count: 1,
    outcome_fvo10_identity_count: 1,
    outcome_fvo_duplicate_count: 0,
    t08_h_before_a: true,
    t09_outcome_absence: true,
    t10_ordinary_assimilation: true,
    phase_engine_contract_preserved: true,
    completed_rerun_write_delta: 0,
    recommendation_count: 0,
    ao_act_count: 0,
    dispatch_count: 0,
    residual_count: 0,
    calibration_candidate_count: 0,
    shadow_evaluation_count: 0,
    model_activation_count: 0,
    production_runtime_source_authorized: false,
    tick_traces: input.tick_results.map((tick) => ({
      schema_version: "geox_mcft_cap08_s3_provider_tick_trace_v1",
      provider_profile_id: CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1,
      provider_contract_digest: CAP08_S3_FORMAL_PROVIDER_CONTRACT_DIGEST_V1,
      formal_run_id: input.request.formal_run_id,
      scope: structuredClone(input.request.scope),
      tick_id: tick.phase_plan.tick_id,
      logical_time: tick.phase_plan.logical_time,
      decision_ref: tick.decision?.object_id ?? null,
      decision_hash: tick.decision?.determinism_hash ?? null,
      approval_assertion_ref: tick.approval_assertion?.source_record_id ?? null,
      approval_assertion_hash: tick.approval_assertion?.source_record_hash ?? null,
      approved_plan_ref: tick.approved_plan?.source_record_id ?? null,
      approved_plan_hash: tick.approved_plan?.source_record_hash ?? null,
      receipt_ref: tick.receipt?.source_record_id ?? null,
      receipt_hash: tick.receipt?.source_record_hash ?? null,
      action_feedback_ref: tick.action_feedback?.object_id ?? null,
      action_feedback_hash: tick.action_feedback?.determinism_hash ?? null,
      action_feedback_consumed_by_a: tick.action_feedback_consumed_by_a,
      outcome_fvo10_ref: tick.outcome_fvo10_record?.source_record_id ?? null,
      outcome_fvo10_value: tick.outcome_fvo10_record ? String(tick.outcome_fvo10_record.canonical_payload.value) : null,
      recommendation_count: 0,
      ao_act_count: 0,
      dispatch_count: 0,
      residual_count: 0,
      model_activation_count: 0,
      trace_digest: tick.s3_barrier.tick_id + ":" + tick.s3_barrier.status,
    })),
    status: input.status,
    persisted_start_logical_time: input.persisted_start_logical_time,
    executed_tick_count: input.executed_tick_count,
    completed_tick_count: 24,
    posterior_state_count: input.status === "COMPLETED" ? input.executed_tick_count : 0,
    successful_forecast_count: input.status === "COMPLETED" ? input.executed_tick_count : 0,
    scenario_set_count: input.status === "COMPLETED" ? input.executed_tick_count : 0,
    forecast_point_count: input.status === "COMPLETED" ? input.executed_tick_count * 72 : 0,
    scenario_point_count: input.status === "COMPLETED" ? input.executed_tick_count * 216 : 0,
    tick_results: input.tick_results,
    final_handoff: input.final_handoff,
    episode_inspection: input.episode,
    phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
    phase_engine_source_digest: input.phase_engine_source_digest,
    completion_authority_disposition: "ALREADY_COMPLETE_EXACT",
    completion_authority_write_status: input.completion_authority_write_status,
    slice_acceptance_only: true,
    final_formal_run_id: null,
  };
}

export class Cap08S3FormalRangeServiceV1 {
  constructor(
    private readonly handoffService: PrepareCap08S3NextTickInputPortV1,
    private readonly tickService: Cap08S3FormalTickServiceV1,
    private readonly episodeInspector: Cap08S3EpisodeInspectorV1,
    private readonly phaseEngineSourceDigest: string,
    private readonly completionAuthorityService: Cap08CompletionAuthorityServiceV1,
  ) {
    if (!/^sha256:[0-9a-f]{64}$/.test(phaseEngineSourceDigest)) throw new Error("CAP08_S3_PHASE_ENGINE_SOURCE_DIGEST_INVALID");
  }

  private inspectionInputV1(input: RunCap08S3FormalRangeInputV1): InspectCap08CompletionAuthorityInputV1 {
    const terminalLogicalTime = cap08TickLogicalTimeV1(CAP08_S1_TICK_COUNT_V1 - 1);
    return {
      run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
      formal_run_id: requiredStringV1(input.formal_run_id, "CAP08_S3_FORMAL_RUN_ID_REQUIRED"),
      scope: structuredClone(input.scope),
      initial_logical_time: CAP08_S1_RUNTIME_START_V1,
      terminal_logical_time: terminalLogicalTime,
      expected_next_logical_time: new Date(Date.parse(terminalLogicalTime) + 3_600_000).toISOString(),
      phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
      phase_engine_source_digest: this.phaseEngineSourceDigest,
      expected_tick_count: CAP08_S1_TICK_COUNT_V1,
      expected_state_count: CAP08_S1_TICK_COUNT_V1 + 1,
      expected_forecast_count: CAP08_S1_TICK_COUNT_V1,
      expected_scenario_set_count: CAP08_S1_TICK_COUNT_V1,
    };
  }

  async inspectCompletion(input: RunCap08S3FormalRangeInputV1) {
    return this.completionAuthorityService.inspect(this.inspectionInputV1(input));
  }

  async runRange(input: RunCap08S3FormalRangeInputV1): Promise<RunCap08S3FormalRangeResultV1> {
    requiredStringV1(input.formal_run_id, "CAP08_S3_FORMAL_RUN_ID_REQUIRED");
    canonicalIsoV1(input.created_at, "CAP08_S3_RANGE_CREATED_AT_INVALID");
    requiredStringV1(input.lease_owner, "CAP08_S3_RANGE_LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0) throw new Error("CAP08_S3_RANGE_LEASE_DURATION_INVALID");
    if (!Array.isArray(input.authorized_future_forcing_binding_ids)
      || input.authorized_future_forcing_binding_ids.length === 0
      || input.authorized_future_forcing_binding_ids.some((value) => typeof value !== "string" || !value.trim())) {
      throw new Error("CAP08_S3_RANGE_FORCING_BINDING_AUTHORITY_REQUIRED");
    }

    const completion = await this.inspectCompletion(input);
    if (completion.disposition === "ALREADY_COMPLETE_EXACT") {
      const episode = await this.episodeInspector.inspect({ formal_run_id: input.formal_run_id, scope: input.scope });
      exactEpisodeV1(episode);
      const finalHandoff = await this.handoffService.prepareNextTickInput(input.scope);
      return qualificationV1({
        request: input,
        status: "ALREADY_COMPLETE",
        persisted_start_logical_time: finalHandoff.next_logical_tick_time,
        executed_tick_count: 0,
        tick_results: [],
        final_handoff: finalHandoff,
        episode,
        phase_engine_source_digest: this.phaseEngineSourceDigest,
        completion_authority_write_status: null,
      });
    }

    const initialHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    const persistedStart = initialHandoff.next_logical_tick_time;
    const completedNext = this.inspectionInputV1(input).expected_next_logical_time;
    if (persistedStart === completedNext) throw new Error("CAP08_S3_COMPLETION_TERMINAL_GRAPH_INCOMPLETE");
    const startIndex = cap08TickIndexFromLogicalTimeV1(persistedStart);
    const tickResults: ExecuteCap08S3FormalTickResultV1[] = [];
    for (let index = startIndex; index < CAP08_S1_TICK_COUNT_V1; index += 1) {
      const logicalTime = cap08TickLogicalTimeV1(index);
      const runtimeConfigRef = requiredStringV1(input.runtime_config_refs_by_logical_time[logicalTime], `CAP08_S3_RUNTIME_CONFIG_REF_REQUIRED:${logicalTime}`);
      const runtimeConfigHash = requiredStringV1(input.runtime_config_hashes_by_logical_time[logicalTime], `CAP08_S3_RUNTIME_CONFIG_HASH_REQUIRED:${logicalTime}`);
      tickResults.push(await this.tickService.executeOneTick({
        formal_run_id: input.formal_run_id,
        scope: input.scope,
        logical_time: logicalTime,
        created_at: input.created_at,
        runtime_config_ref: runtimeConfigRef,
        runtime_config_hash: runtimeConfigHash,
        authorized_future_forcing_binding_ids: input.authorized_future_forcing_binding_ids,
        crop_stage_context: input.crop_stage_context,
        lease_owner: input.lease_owner,
        lease_duration_seconds: input.lease_duration_seconds,
      }));
    }
    const finalHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    if (finalHandoff.next_logical_tick_time !== completedNext) throw new Error("CAP08_S3_RANGE_FINAL_HANDOFF_MISMATCH");
    const episode = await this.episodeInspector.inspect({ formal_run_id: input.formal_run_id, scope: input.scope });
    exactEpisodeV1(episode);
    const established = await this.completionAuthorityService.establish(this.inspectionInputV1(input));
    if (established.disposition !== "ALREADY_COMPLETE_EXACT") throw new Error("CAP08_S3_COMPLETION_AUTHORITY_ESTABLISHMENT_FAILED");
    return qualificationV1({
      request: input,
      status: "COMPLETED",
      persisted_start_logical_time: persistedStart,
      executed_tick_count: tickResults.length,
      tick_results: tickResults,
      final_handoff: finalHandoff,
      episode,
      phase_engine_source_digest: this.phaseEngineSourceDigest,
      completion_authority_write_status: established.write_status,
    });
  }
}
