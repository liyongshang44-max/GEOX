// apps/server/src/runtime/twin_runtime/cap08_s1_base_range_service_v1.ts
// Purpose: execute the bounded MCFT-CAP-08 S1 T00-T23 Replay range and bind completion to one exact persisted formal-run authority.
// Boundary: fixed 24-Tick forward range only; no B00 construction, final closure run, restart fault proof, late correction, Decision, Action Feedback, Residual, Calibration, route, scheduler, or live ingestion.

import {
  CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  CAP08_S1_RUN_CONTRACT_ID_V1,
  CAP08_S1_RUNTIME_START_V1,
  CAP08_S1_TICK_COUNT_V1,
  cap08TickIndexFromLogicalTimeV1,
  cap08TickLogicalTimeV1,
} from "../../domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import type { InspectCap08CompletionAuthorityInputV1 } from "../../domain/twin_runtime/cap08_completion_authority_contracts_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";
import type { PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";
import {
  Cap08S1BaseTickServiceV1,
  type ExecuteCap08S1BaseTickResultV1,
  type PrepareCap08NextTickInputPortV1,
} from "./cap08_s1_base_tick_service_v1.js";
import { Cap08CompletionAuthorityServiceV1 } from "./cap08_completion_authority_service_v1.js";

export type RunCap08S1BaseRangeInputV1 = {
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

export type RunCap08S1BaseRangeResultV1 = {
  status: "COMPLETED" | "ALREADY_COMPLETE";
  formal_run_id: string;
  persisted_start_logical_time: string;
  executed_tick_count: number;
  completed_tick_count: number;
  posterior_state_count: number;
  successful_forecast_count: number;
  scenario_set_count: number;
  forecast_point_count: number;
  scenario_point_count: number;
  action_feedback_count: 0;
  decision_count: 0;
  residual_count: 0;
  tick_results: ExecuteCap08S1BaseTickResultV1[];
  final_handoff: PreparedNextTickInputV1;
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

export class Cap08S1BaseRangeServiceV1 {
  constructor(
    private readonly handoffService: PrepareCap08NextTickInputPortV1,
    private readonly tickService: Cap08S1BaseTickServiceV1,
    private readonly phaseEngineSourceDigest: string,
    private readonly completionAuthorityService?: Cap08CompletionAuthorityServiceV1,
  ) {
    if (!/^sha256:[0-9a-f]{64}$/.test(phaseEngineSourceDigest)) throw new Error("CAP08_PHASE_ENGINE_SOURCE_DIGEST_INVALID");
  }

  private serviceV1(): Cap08CompletionAuthorityServiceV1 {
    if (!this.completionAuthorityService) throw new Error("CAP08_COMPLETION_AUTHORITY_SERVICE_REQUIRED");
    return this.completionAuthorityService;
  }

  private inspectionInputV1(input: RunCap08S1BaseRangeInputV1): InspectCap08CompletionAuthorityInputV1 {
    const terminalLogicalTime = cap08TickLogicalTimeV1(CAP08_S1_TICK_COUNT_V1 - 1);
    return {
      run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
      formal_run_id: requiredStringV1(input.formal_run_id, "CAP08_FORMAL_RUN_ID_REQUIRED"),
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

  async inspectCompletion(input: RunCap08S1BaseRangeInputV1) {
    const completionAuthorityService = this.serviceV1();
    return completionAuthorityService.inspect(this.inspectionInputV1(input));
  }

  async runRange(input: RunCap08S1BaseRangeInputV1): Promise<RunCap08S1BaseRangeResultV1> {
    const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_FORMAL_RUN_ID_REQUIRED");
    canonicalIsoV1(input.created_at, "CAP08_RANGE_CREATED_AT_INVALID");
    requiredStringV1(input.lease_owner, "CAP08_RANGE_LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0) {
      throw new Error("CAP08_RANGE_LEASE_DURATION_INVALID");
    }
    if (!Array.isArray(input.authorized_future_forcing_binding_ids)
      || input.authorized_future_forcing_binding_ids.length === 0
      || input.authorized_future_forcing_binding_ids.some((value) => typeof value !== "string" || !value.trim())) {
      throw new Error("CAP08_RANGE_FORCING_BINDING_AUTHORITY_REQUIRED");
    }

    const completion = await this.inspectCompletion(input);
    if (completion.disposition === "ALREADY_COMPLETE_EXACT") {
      const finalHandoff = await this.handoffService.prepareNextTickInput(input.scope);
      return {
        status: "ALREADY_COMPLETE",
        formal_run_id: formalRunId,
        persisted_start_logical_time: finalHandoff.next_logical_tick_time,
        executed_tick_count: 0,
        completed_tick_count: CAP08_S1_TICK_COUNT_V1,
        posterior_state_count: 0,
        successful_forecast_count: 0,
        scenario_set_count: 0,
        forecast_point_count: 0,
        scenario_point_count: 0,
        action_feedback_count: 0,
        decision_count: 0,
        residual_count: 0,
        tick_results: [],
        final_handoff: finalHandoff,
        phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
        phase_engine_source_digest: this.phaseEngineSourceDigest,
        completion_authority_disposition: "ALREADY_COMPLETE_EXACT",
        completion_authority_write_status: null,
        slice_acceptance_only: true,
        final_formal_run_id: null,
      };
    }

    const initialHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    const persistedStart = initialHandoff.next_logical_tick_time;
    const completedNext = this.inspectionInputV1(input).expected_next_logical_time;
    if (persistedStart === completedNext) throw new Error("CAP08_COMPLETION_TERMINAL_GRAPH_INCOMPLETE");

    const startIndex = cap08TickIndexFromLogicalTimeV1(persistedStart);
    const tickResults: ExecuteCap08S1BaseTickResultV1[] = [];
    for (let index = startIndex; index < CAP08_S1_TICK_COUNT_V1; index += 1) {
      const logicalTime = cap08TickLogicalTimeV1(index);
      const runtimeConfigRef = requiredStringV1(
        input.runtime_config_refs_by_logical_time[logicalTime],
        `CAP08_RANGE_RUNTIME_CONFIG_REF_REQUIRED:${logicalTime}`,
      );
      const runtimeConfigHash = requiredStringV1(
        input.runtime_config_hashes_by_logical_time[logicalTime],
        `CAP08_RANGE_RUNTIME_CONFIG_HASH_REQUIRED:${logicalTime}`,
      );
      const result = await this.tickService.executeOneTick({
        formal_run_id: formalRunId,
        scope: input.scope,
        logical_time: logicalTime,
        created_at: input.created_at,
        runtime_config_ref: runtimeConfigRef,
        runtime_config_hash: runtimeConfigHash,
        authorized_future_forcing_binding_ids: input.authorized_future_forcing_binding_ids,
        crop_stage_context: input.crop_stage_context,
        lease_owner: input.lease_owner,
        lease_duration_seconds: input.lease_duration_seconds,
      });
      tickResults.push(result);
    }

    const finalHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    if (finalHandoff.next_logical_tick_time !== completedNext) throw new Error("CAP08_RANGE_FINAL_HANDOFF_MISMATCH");
    const executed = tickResults.length;
    if (executed !== CAP08_S1_TICK_COUNT_V1 - startIndex) throw new Error("CAP08_RANGE_EXECUTED_TICK_COUNT_MISMATCH");

    const completionAuthorityService = this.serviceV1();
    const established = await completionAuthorityService.establish(this.inspectionInputV1(input));
    if (established.disposition !== "ALREADY_COMPLETE_EXACT") throw new Error("CAP08_COMPLETION_AUTHORITY_ESTABLISHMENT_FAILED");
    return {
      status: "COMPLETED",
      formal_run_id: formalRunId,
      persisted_start_logical_time: persistedStart,
      executed_tick_count: executed,
      completed_tick_count: CAP08_S1_TICK_COUNT_V1,
      posterior_state_count: executed,
      successful_forecast_count: executed,
      scenario_set_count: executed,
      forecast_point_count: executed * 72,
      scenario_point_count: executed * 216,
      action_feedback_count: 0,
      decision_count: 0,
      residual_count: 0,
      tick_results: tickResults,
      final_handoff: finalHandoff,
      phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
      phase_engine_source_digest: this.phaseEngineSourceDigest,
      completion_authority_disposition: "ALREADY_COMPLETE_EXACT",
      completion_authority_write_status: established.write_status,
      slice_acceptance_only: true,
      final_formal_run_id: null,
    };
  }
}
