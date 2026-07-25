// Purpose: execute, resume, or exactly read back the bounded MCFT-CAP-08.S3 T00-T23 Replay range using one atomic generic/semantic completion-authority pair.
// Boundary: fixed 24-Tick forward range only; no B00 construction, authority self-heal, late correction, Residual, Calibration, Shadow, route, scheduler, live ingestion, or production Runtime authority.

import type { InspectCap08CompletionAuthorityInputV1 } from "../../domain/twin_runtime/cap08_completion_authority_contracts_v1.js";
import type {
  Cap08S3CompletionAuthorityPairPortV1,
  EstablishCap08S3CompletionAuthorityPairResultV1,
} from "../../domain/twin_runtime/cap08_s3_completion_authority_pair_contracts_v1.js";
import type { Cap08S3CompletionTupleV1 } from "../../domain/twin_runtime/cap08_s3_completion_tuple_v1.js";
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
  CAP08_S3_OUTCOME_FVO_ID_V1,
  buildCap08S3ProviderTickTraceV1,
  type Cap08S3FormalProviderQualificationV1,
  type Cap08S3ProviderTickTraceV1,
} from "../../domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";
import {
  Cap08S3EpisodeInspectorV1,
  type Cap08S3EpisodeInspectionV1,
} from "./cap08_s3_episode_inspector_v1.js";
import type {
  ExecuteCap08S3FormalTickInputV1,
  ExecuteCap08S3FormalTickResultV1,
  PrepareCap08S3NextTickInputPortV1,
} from "./cap08_s3_formal_tick_service_v1.js";
import type { PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";

export type ExecuteCap08S3FormalTickPortV1 = {
  executeOneTick(input: ExecuteCap08S3FormalTickInputV1): Promise<ExecuteCap08S3FormalTickResultV1>;
};

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
  completion_tuple: Cap08S3CompletionTupleV1;
  completion_tuple_ref: string;
  completion_tuple_hash: string;
  persisted_tick_binding_count: 24;
  phase_engine_contract_digest: typeof CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1;
  phase_engine_source_digest: string;
  completion_authority_disposition: "ALREADY_COMPLETE_EXACT";
  completion_authority_pair_write_status:
    | "INSERTED_ATOMIC_PAIR"
    | "EXISTING_IDEMPOTENT_PAIR"
    | null;
  completion_authority_pair_write_delta: 0 | 2;
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

function tracesFromTupleV1(tuple: Cap08S3CompletionTupleV1): Cap08S3ProviderTickTraceV1[] {
  const traces = tuple.tick_bindings.map((binding, index) => buildCap08S3ProviderTickTraceV1({
    formal_run_id: tuple.formal_run_id,
    scope: structuredClone(tuple.scope),
    tick_id: binding.tick_id,
    logical_time: binding.logical_time,
    decision_ref: index === 5 ? tuple.decision.ref : null,
    decision_hash: index === 5 ? tuple.decision.hash : null,
    approval_assertion_ref: index === 6 ? tuple.approval_assertion.ref : null,
    approval_assertion_hash: index === 6 ? tuple.approval_assertion.hash : null,
    approved_plan_ref: index === 6 ? tuple.approved_plan.ref : null,
    approved_plan_hash: index === 6 ? tuple.approved_plan.hash : null,
    receipt_ref: index === 8 ? tuple.execution_receipt.ref : null,
    receipt_hash: index === 8 ? tuple.execution_receipt.hash : null,
    action_feedback_ref: index >= 8 && index <= 10 ? tuple.action_feedback.ref : null,
    action_feedback_hash: index >= 8 && index <= 10 ? tuple.action_feedback.hash : null,
    action_feedback_consumed_by_a: index === 8
      && tuple.t08.dynamics_consumed_evidence_refs.includes(tuple.action_feedback.ref),
    outcome_fvo10_ref: index === 10 ? CAP08_S3_OUTCOME_FVO_ID_V1 : null,
    outcome_fvo10_value: index === 10 ? "0.3045" : null,
    recommendation_count: 0,
    ao_act_count: 0,
    dispatch_count: 0,
    residual_count: 0,
    model_activation_count: 0,
  }));
  if (traces.length !== 24
    || traces.some((trace, index) => trace.trace_digest !== tuple.tick_trace_digests[index])) {
    throw new Error("CAP08_S3_COMPLETION_TRACE_REBUILD_MISMATCH");
  }
  return traces;
}

function qualificationV1(input: {
  request: RunCap08S3FormalRangeInputV1;
  phase_engine_source_digest: string;
  status: RunCap08S3FormalRangeResultV1["status"];
  persisted_start_logical_time: string;
  executed_tick_count: number;
  tick_results: ExecuteCap08S3FormalTickResultV1[];
  final_handoff: PreparedNextTickInputV1;
  episode: Cap08S3EpisodeInspectionV1;
  tuple: Cap08S3CompletionTupleV1;
  pair_write_status: RunCap08S3FormalRangeResultV1["completion_authority_pair_write_status"];
  pair_write_delta: 0 | 2;
}): RunCap08S3FormalRangeResultV1 {
  exactEpisodeV1(input.episode);
  const tuple = input.tuple;
  if (tuple.formal_run_id !== input.request.formal_run_id
    || tuple.phase_engine_source_digest !== input.phase_engine_source_digest) {
    throw new Error("CAP08_S3_COMPLETION_TUPLE_REQUEST_MISMATCH");
  }
  for (const field of [
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "zone_id",
  ] as const) {
    if (tuple.scope[field] !== input.request.scope[field]) {
      throw new Error(`CAP08_S3_COMPLETION_TUPLE_SCOPE_MISMATCH:${field}`);
    }
  }
  const t08HBeforeA = tuple.t08.action_feedback_ref === tuple.action_feedback.ref
    && tuple.t08.action_feedback_hash === tuple.action_feedback.hash
    && tuple.t08.dynamics_consumed_evidence_refs.includes(tuple.action_feedback.ref);
  const t09OutcomeAbsence = tuple.t09.selected_observation_ref === null
    && tuple.t09.assimilation_applied_evidence_refs.length === 0
    && Boolean(tuple.t09.absence_witness_ref)
    && Boolean(tuple.t09.absence_witness_hash);
  const t10OrdinaryAssimilation = tuple.t10.outcome_fvo10_ref === CAP08_S3_OUTCOME_FVO_ID_V1
    && tuple.t10.selected_observation_ref === CAP08_S3_OUTCOME_FVO_ID_V1
    && JSON.stringify(tuple.t10.assimilation_applied_evidence_refs)
      === JSON.stringify([CAP08_S3_OUTCOME_FVO_ID_V1]);
  if (!t08HBeforeA || !t09OutcomeAbsence || !t10OrdinaryAssimilation) {
    throw new Error("CAP08_S3_COMPLETION_TUPLE_QUALIFICATION_FAILED");
  }
  const tickTraces = tracesFromTupleV1(tuple);
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
    t08_h_before_a: t08HBeforeA,
    t09_outcome_absence: t09OutcomeAbsence,
    t10_ordinary_assimilation: t10OrdinaryAssimilation,
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
    tick_traces: tickTraces,
    status: input.status,
    persisted_start_logical_time: input.persisted_start_logical_time,
    executed_tick_count: input.executed_tick_count,
    completed_tick_count: 24,
    posterior_state_count: 25,
    successful_forecast_count: 24,
    scenario_set_count: 24,
    forecast_point_count: 24 * 72,
    scenario_point_count: 24 * 3 * 72,
    tick_results: input.tick_results,
    final_handoff: input.final_handoff,
    episode_inspection: input.episode,
    completion_tuple: structuredClone(tuple),
    completion_tuple_ref: tuple.tuple_ref,
    completion_tuple_hash: tuple.determinism_hash,
    persisted_tick_binding_count: 24,
    phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
    phase_engine_source_digest: tuple.phase_engine_source_digest,
    completion_authority_disposition: "ALREADY_COMPLETE_EXACT",
    completion_authority_pair_write_status: input.pair_write_status,
    completion_authority_pair_write_delta: input.pair_write_delta,
    slice_acceptance_only: true,
    final_formal_run_id: null,
  };
}

export class Cap08S3FormalRangeServiceV1 {
  constructor(
    private readonly handoffService: PrepareCap08S3NextTickInputPortV1,
    private readonly tickService: ExecuteCap08S3FormalTickPortV1,
    private readonly episodeInspector: Cap08S3EpisodeInspectorV1,
    private readonly phaseEngineSourceDigest: string,
    private readonly completionAuthorityPair: Cap08S3CompletionAuthorityPairPortV1,
  ) {
    if (!/^sha256:[0-9a-f]{64}$/.test(phaseEngineSourceDigest)) {
      throw new Error("CAP08_S3_PHASE_ENGINE_SOURCE_DIGEST_INVALID");
    }
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
    return this.completionAuthorityPair.inspect(this.inspectionInputV1(input));
  }

  private async exactEpisodeAndHandoffV1(input: RunCap08S3FormalRangeInputV1): Promise<{
    episode: Cap08S3EpisodeInspectionV1;
    final_handoff: PreparedNextTickInputV1;
  }> {
    const [episode, finalHandoff] = await Promise.all([
      this.episodeInspector.inspect({ formal_run_id: input.formal_run_id, scope: input.scope }),
      this.handoffService.prepareNextTickInput(input.scope),
    ]);
    exactEpisodeV1(episode);
    return { episode, final_handoff: finalHandoff };
  }

  private completeResultV1(input: {
    request: RunCap08S3FormalRangeInputV1;
    status: RunCap08S3FormalRangeResultV1["status"];
    persisted_start_logical_time: string;
    executed_tick_count: number;
    tick_results: ExecuteCap08S3FormalTickResultV1[];
    exact: { episode: Cap08S3EpisodeInspectionV1; final_handoff: PreparedNextTickInputV1 };
    pair: EstablishCap08S3CompletionAuthorityPairResultV1 | {
      write_status: null;
      authority_pair_write_delta: 0;
      semantic_authority: Cap08S3CompletionTupleV1;
    };
  }): RunCap08S3FormalRangeResultV1 {
    return qualificationV1({
      request: input.request,
      phase_engine_source_digest: this.phaseEngineSourceDigest,
      status: input.status,
      persisted_start_logical_time: input.persisted_start_logical_time,
      executed_tick_count: input.executed_tick_count,
      tick_results: input.tick_results,
      final_handoff: input.exact.final_handoff,
      episode: input.exact.episode,
      tuple: input.pair.semantic_authority,
      pair_write_status: input.pair.write_status,
      pair_write_delta: input.pair.authority_pair_write_delta,
    });
  }

  async runRange(input: RunCap08S3FormalRangeInputV1): Promise<RunCap08S3FormalRangeResultV1> {
    requiredStringV1(input.formal_run_id, "CAP08_S3_FORMAL_RUN_ID_REQUIRED");
    canonicalIsoV1(input.created_at, "CAP08_S3_RANGE_CREATED_AT_INVALID");
    requiredStringV1(input.lease_owner, "CAP08_S3_RANGE_LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0) {
      throw new Error("CAP08_S3_RANGE_LEASE_DURATION_INVALID");
    }
    if (!Array.isArray(input.authorized_future_forcing_binding_ids)
      || input.authorized_future_forcing_binding_ids.length === 0
      || input.authorized_future_forcing_binding_ids.some(
        (value) => typeof value !== "string" || !value.trim(),
      )) {
      throw new Error("CAP08_S3_RANGE_FORCING_BINDING_AUTHORITY_REQUIRED");
    }

    const completion = await this.inspectCompletion(input);
    if (completion.disposition === "ALREADY_COMPLETE_EXACT") {
      if (!completion.semantic_authority) {
        throw new Error("CAP08_S3_SEMANTIC_COMPLETION_AUTHORITY_REQUIRED");
      }
      const exact = await this.exactEpisodeAndHandoffV1(input);
      return this.completeResultV1({
        request: input,
        status: "ALREADY_COMPLETE",
        persisted_start_logical_time: exact.final_handoff.next_logical_tick_time,
        executed_tick_count: 0,
        tick_results: [],
        exact,
        pair: {
          write_status: null,
          authority_pair_write_delta: 0,
          semantic_authority: completion.semantic_authority,
        },
      });
    }
    if (completion.semantic_authority || completion.generic_authority) {
      throw new Error("CAP08_S3_COMPLETION_AUTHORITY_PARTIAL_PAIR");
    }

    const initialHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    const persistedStart = initialHandoff.next_logical_tick_time;
    const completedNext = this.inspectionInputV1(input).expected_next_logical_time;
    if (persistedStart === completedNext) {
      throw new Error("CAP08_S3_COMPLETION_TERMINAL_GRAPH_WITHOUT_AUTHORITY_PAIR");
    }
    const startIndex = cap08TickIndexFromLogicalTimeV1(persistedStart);
    const tickResults: ExecuteCap08S3FormalTickResultV1[] = [];
    for (let index = startIndex; index < CAP08_S1_TICK_COUNT_V1; index += 1) {
      const logicalTime = cap08TickLogicalTimeV1(index);
      const runtimeConfigRef = requiredStringV1(
        input.runtime_config_refs_by_logical_time[logicalTime],
        `CAP08_S3_RUNTIME_CONFIG_REF_REQUIRED:${logicalTime}`,
      );
      const runtimeConfigHash = requiredStringV1(
        input.runtime_config_hashes_by_logical_time[logicalTime],
        `CAP08_S3_RUNTIME_CONFIG_HASH_REQUIRED:${logicalTime}`,
      );
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
    const exact = await this.exactEpisodeAndHandoffV1(input);
    if (exact.final_handoff.next_logical_tick_time !== completedNext) {
      throw new Error("CAP08_S3_RANGE_FINAL_HANDOFF_MISMATCH");
    }
    const pair = await this.completionAuthorityPair.establish(this.inspectionInputV1(input));
    if (pair.disposition !== "ALREADY_COMPLETE_EXACT"
      || pair.semantic_authority.determinism_hash
        !== pair.rebuilt_semantic_authority.determinism_hash) {
      throw new Error("CAP08_S3_COMPLETION_AUTHORITY_PAIR_FINAL_READBACK_FAILED");
    }
    return this.completeResultV1({
      request: input,
      status: "COMPLETED",
      persisted_start_logical_time: persistedStart,
      executed_tick_count: tickResults.length,
      tick_results: tickResults,
      exact,
      pair,
    });
  }
}
