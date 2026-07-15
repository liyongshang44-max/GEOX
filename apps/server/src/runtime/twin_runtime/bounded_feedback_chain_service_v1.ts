// apps/server/src/runtime/twin_runtime/bounded_feedback_chain_service_v1.ts
// Purpose: execute or resume the fixed MCFT-CAP-05 eight-tick controlled Replay chain: receipt consumption at 02:00, outcome Assimilation plus C Residual at 03:00, then contiguous A1/B continuation through 09:00.
// Boundary: explicit bounded orchestration only; no route, scheduler, wall clock, duplicated State/Forecast/Scenario mathematics, automatic history rewrite, Recommendation, AO-ACT, calibration, model activation, continuous Runtime, live-field claim or CAP-06 authority.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type { Cap04RuntimeConfigPayloadV1 } from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";
import { compileCap05EffectiveRuntimeConfigChainV1 } from "./effective_feedback_runtime_config_v1.js";
import type {
  ExecuteCap04SingleTickInputV1,
  ExecuteCap04SingleTickResultV1,
} from "./forecast_scenario_single_tick_service_v1.js";
import type { ExecuteCap05ForecastResidualOutcomeTickResultV1 } from "./forecast_residual_outcome_tick_service_v1.js";
import type { ExecuteCap05ReceiptConsumingTickResultV1 } from "./receipt_consuming_forecast_scenario_tick_service_v1.js";
import type {
  PreparedNextTickInputV1,
  RuntimeConfigRepositoryPortV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const CAP05_S10_BOUNDED_CHAIN_SERVICE_ID_V1 =
  "MCFT_CAP_05_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN_SERVICE_V1" as const;
export const CAP05_S10_FIRST_LOGICAL_TIME_V1 = "2026-06-04T02:00:00.000Z" as const;
export const CAP05_S10_OUTCOME_LOGICAL_TIME_V1 = "2026-06-04T03:00:00.000Z" as const;
export const CAP05_S10_FINAL_LOGICAL_TIME_V1 = "2026-06-04T09:00:00.000Z" as const;
export const CAP05_S10_FINAL_NEXT_LOGICAL_TIME_V1 = "2026-06-04T10:00:00.000Z" as const;
export const CAP05_S10_PREDECESSOR_SEQUENCE_V1 = 72 as const;
export const CAP05_S10_FINAL_SEQUENCE_V1 = 80 as const;
export const CAP05_S10_TICK_COUNT_V1 = 8 as const;
export const CAP05_S10_FORECAST_POINT_COUNT_V1 = 576 as const;
export const CAP05_S10_SCENARIO_POINT_COUNT_V1 = 1728 as const;
export const CAP05_S10_ORCHESTRATOR_CANONICAL_FACT_DELTA_V1 = 81 as const;
export const CAP05_S10_FULL_PATH_CANONICAL_FACT_DELTA_V1 = 83 as const;

export type Cap05S10PrepareNextTickPortV1 = {
  prepareNextTickInput(scope: TwinScopeKeyV1): Promise<PreparedNextTickInputV1>;
};

export type Cap05S10ReceiptTickPortV1 = {
  executeOneTick(input: ExecuteCap04SingleTickInputV1): Promise<ExecuteCap05ReceiptConsumingTickResultV1>;
};

export type Cap05S10OutcomeTickPortV1 = {
  executeOneTickAndCommitResidual(
    input: ExecuteCap04SingleTickInputV1,
  ): Promise<ExecuteCap05ForecastResidualOutcomeTickResultV1>;
};

export type Cap05S10ContinuationTickPortV1 = {
  executeOneTick(input: ExecuteCap04SingleTickInputV1): Promise<ExecuteCap04SingleTickResultV1>;
};

export type RunCap05BoundedFeedbackChainInputV1 = {
  scope: TwinScopeKeyV1;
  authorized_future_forcing_binding_ids: readonly string[];
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  lease_owner: string;
  lease_duration_seconds: number;
};

export type Cap05S10TickSummaryV1 = {
  logical_time: string;
  committed_sequence: number;
  status: ExecuteCap04SingleTickResultV1["status"];
  record_set_id: string;
  state_ref: string;
  forecast_ref: string;
  scenario_set_ref: string;
  forecast_point_count: 72;
  scenario_point_count: 216;
  runtime_config_ref: string;
  runtime_config_hash: string;
};

export type RunCap05BoundedFeedbackChainResultV1 = {
  service_id: typeof CAP05_S10_BOUNDED_CHAIN_SERVICE_ID_V1;
  status: "COMPLETED" | "ALREADY_COMPLETE";
  initial_completed_tick_count: number;
  executed_tick_count_this_call: number;
  established_tick_count: 8;
  posterior_state_count: 8;
  successful_forecast_run_count: 8;
  scenario_set_count: 8;
  forecast_point_count: 576;
  scenario_point_count: 1728;
  first_committed_sequence: 73;
  final_committed_sequence: 80;
  final_next_logical_tick_time: typeof CAP05_S10_FINAL_NEXT_LOGICAL_TIME_V1;
  runtime_config_count: 8;
  runtime_config_insert_count: number;
  runtime_config_existing_count: number;
  receipt_tick_status: ExecuteCap04SingleTickResultV1["status"] | null;
  outcome_tick_status: ExecuteCap04SingleTickResultV1["status"] | null;
  residual_status: ExecuteCap05ForecastResidualOutcomeTickResultV1["residual_status"] | null;
  residual_ref: string | null;
  residual_hash: string | null;
  tick_summaries: Cap05S10TickSummaryV1[];
  orchestrator_canonical_twin_object_fact_delta: 81;
  full_capability_path_canonical_twin_object_fact_delta: 83;
  replay_evidence_fact_delta_accounted_separately: true;
  projection_row_delta_accounted_separately: true;
  causal_effect_claimed: false;
  forecast_assimilation_equivalence_claimed: false;
  automatic_history_rewrite: false;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredPositiveIntegerV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function exactScopeV1(actual: {
  tenant_id: string;
  project_id: string;
  group_id: string | null;
  field_id: string;
  season_id: string | null;
  zone_id: string | null;
}, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function exactMemberV1(
  result: ExecuteCap04SingleTickResultV1,
  objectType: string,
): CanonicalObjectEnvelopeV1 {
  const matches = result.a_record_set.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP05_S10_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function forecastPointCountV1(forecast: CanonicalObjectEnvelopeV1): number {
  if (forecast.payload.status !== "COMPLETED" || !Array.isArray(forecast.payload.points)) {
    throw new Error("CAP05_S10_COMPLETED_FORECAST_REQUIRED");
  }
  return forecast.payload.points.length;
}

function scenarioPointCountV1(result: ExecuteCap04SingleTickResultV1): number {
  if (!result.b_record) throw new Error("CAP05_S10_SCENARIO_SET_REQUIRED");
  const options = result.b_record.scenario_set.payload.options;
  if (!Array.isArray(options) || options.length !== 3) {
    throw new Error("CAP05_S10_THREE_SCENARIO_OPTIONS_REQUIRED");
  }
  return options.reduce((sum, option) => {
    if (!Array.isArray(option.trajectory_points)) {
      throw new Error("CAP05_S10_SCENARIO_TRAJECTORY_REQUIRED");
    }
    return sum + option.trajectory_points.length;
  }, 0);
}

function validateTickV1(input: {
  result: ExecuteCap04SingleTickResultV1;
  scope: TwinScopeKeyV1;
  logical_time: string;
  expected_sequence: number;
  config: CanonicalObjectEnvelopeV1;
}): Cap05S10TickSummaryV1 {
  const result = input.result;
  if (result.status === "BLOCKED_INSERTED" || result.status === "EXISTING_BLOCKED_IDEMPOTENT_SUCCESS") {
    throw new Error(`CAP05_S10_BLOCKED_TICK_FORBIDDEN:${input.logical_time}`);
  }
  if (result.a_record_set.members.length !== 8) {
    throw new Error(`CAP05_S10_A1_MEMBER_COUNT_MISMATCH:${input.logical_time}`);
  }
  const state = exactMemberV1(result, "twin_state_estimate_v1");
  const forecast = exactMemberV1(result, "twin_forecast_run_v1");
  const checkpoint = exactMemberV1(result, "twin_runtime_checkpoint_v1");
  for (const member of [state, forecast, checkpoint]) {
    exactScopeV1(member, input.scope, "CAP05_S10_TICK_SCOPE_MISMATCH");
    if (member.logical_time !== input.logical_time) {
      throw new Error(`CAP05_S10_TICK_LOGICAL_TIME_MISMATCH:${member.object_type}`);
    }
  }
  if (state.runtime_config_ref !== input.config.object_id
    || state.runtime_config_hash !== input.config.determinism_hash
    || forecast.runtime_config_ref !== input.config.object_id
    || forecast.runtime_config_hash !== input.config.determinism_hash) {
    throw new Error(`CAP05_S10_TICK_RUNTIME_CONFIG_MISMATCH:${input.logical_time}`);
  }
  if (checkpoint.payload.tick_sequence !== input.expected_sequence) {
    throw new Error(`CAP05_S10_CHECKPOINT_SEQUENCE_MISMATCH:${input.logical_time}`);
  }
  if (result.next_handoff.previous_tick_sequence !== input.expected_sequence
    || result.next_handoff.next_logical_tick_time !== addHoursV1(input.logical_time, 1)) {
    throw new Error(`CAP05_S10_NONCONTIGUOUS_HANDOFF:${input.logical_time}`);
  }
  if (forecastPointCountV1(forecast) !== 72) {
    throw new Error(`CAP05_S10_FORECAST_POINT_COUNT_MISMATCH:${input.logical_time}`);
  }
  if (scenarioPointCountV1(result) !== 216) {
    throw new Error(`CAP05_S10_SCENARIO_POINT_COUNT_MISMATCH:${input.logical_time}`);
  }
  if (!result.b_record) throw new Error("CAP05_S10_SCENARIO_SET_REQUIRED");
  if (result.b_record.scenario_set.logical_time !== input.logical_time) {
    throw new Error(`CAP05_S10_SCENARIO_TIME_MISMATCH:${input.logical_time}`);
  }
  return {
    logical_time: input.logical_time,
    committed_sequence: input.expected_sequence,
    status: result.status,
    record_set_id: result.a_record_set.record_set_id,
    state_ref: state.object_id,
    forecast_ref: forecast.object_id,
    scenario_set_ref: result.b_record.scenario_set.object_id,
    forecast_point_count: 72,
    scenario_point_count: 216,
    runtime_config_ref: input.config.object_id,
    runtime_config_hash: input.config.determinism_hash,
  };
}

function completedTickCountV1(handoff: PreparedNextTickInputV1): number {
  const completed = handoff.previous_tick_sequence - CAP05_S10_PREDECESSOR_SEQUENCE_V1;
  if (!Number.isInteger(completed) || completed < 0 || completed > CAP05_S10_TICK_COUNT_V1) {
    throw new Error("CAP05_S10_PREDECESSOR_SEQUENCE_OUTSIDE_BOUNDED_CHAIN");
  }
  const expectedNext = addHoursV1(CAP05_S10_FIRST_LOGICAL_TIME_V1, completed);
  if (handoff.next_logical_tick_time !== expectedNext) {
    throw new Error("CAP05_S10_PREDECESSOR_TIME_SEQUENCE_MISMATCH");
  }
  return completed;
}

async function exactConfigReadbackV1(
  repository: RuntimeConfigRepositoryPortV1,
  ref: string,
  hash: string,
  code: string,
): Promise<CanonicalObjectEnvelopeV1> {
  const config = await repository.readRuntimeConfig(ref);
  if (!config || config.object_type !== "twin_runtime_config_v1" || config.determinism_hash !== hash) {
    throw new Error(code);
  }
  return config;
}

async function resolvePredecessorConfigV1(input: {
  repository: RuntimeConfigRepositoryPortV1;
  handoff: PreparedNextTickInputV1;
  completed_tick_count: number;
}): Promise<CanonicalObjectEnvelopeV1> {
  let current = await exactConfigReadbackV1(
    input.repository,
    input.handoff.previous_state_runtime_config_ref,
    input.handoff.previous_state_runtime_config_hash,
    "CAP05_S10_CURRENT_RUNTIME_CONFIG_READBACK_MISMATCH",
  );
  for (let index = 0; index < input.completed_tick_count; index += 1) {
    const payload = requiredRecordV1(current.payload, "CAP05_S10_RUNTIME_CONFIG_PAYLOAD_REQUIRED");
    current = await exactConfigReadbackV1(
      input.repository,
      requiredStringV1(payload.parent_runtime_config_ref, "CAP05_S10_PARENT_RUNTIME_CONFIG_REF_REQUIRED"),
      requiredStringV1(payload.parent_runtime_config_hash, "CAP05_S10_PARENT_RUNTIME_CONFIG_HASH_REQUIRED"),
      "CAP05_S10_PARENT_RUNTIME_CONFIG_READBACK_MISMATCH",
    );
  }
  return current;
}

function chainFromPredecessorV1(input: {
  scope: TwinScopeKeyV1;
  predecessor: CanonicalObjectEnvelopeV1;
  handoff: PreparedNextTickInputV1;
}): CanonicalObjectEnvelopeV1[] {
  exactScopeV1(input.predecessor, input.scope, "CAP05_S10_PREDECESSOR_CONFIG_SCOPE_MISMATCH");
  const payload = requiredRecordV1(input.predecessor.payload, "CAP05_S10_PREDECESSOR_CONFIG_PAYLOAD_REQUIRED") as unknown as Cap04RuntimeConfigPayloadV1;
  if (payload.reality_binding_ref !== input.handoff.reality_binding_ref
    || payload.reality_binding_hash !== input.handoff.reality_binding_hash) {
    throw new Error("CAP05_S10_PREDECESSOR_REALITY_BINDING_MISMATCH");
  }
  return compileCap05EffectiveRuntimeConfigChainV1({
    scope: input.scope,
    first_effective_logical_time: CAP05_S10_FIRST_LOGICAL_TIME_V1,
    count: CAP05_S10_TICK_COUNT_V1,
    parent_runtime_config_ref: input.predecessor.object_id,
    parent_runtime_config_hash: input.predecessor.determinism_hash,
    reality_binding_ref: input.handoff.reality_binding_ref,
    reality_binding_hash: input.handoff.reality_binding_hash,
    source_matrix_hash: requiredStringV1(payload.source_matrix_hash, "CAP05_S10_SOURCE_MATRIX_HASH_REQUIRED"),
    configuration_matrix_hash: requiredStringV1(
      payload.configuration_matrix_hash,
      "CAP05_S10_CONFIGURATION_MATRIX_HASH_REQUIRED",
    ),
    geometry_semantic_hash: requiredStringV1(
      payload.geometry_semantic_hash,
      "CAP05_S10_GEOMETRY_SEMANTIC_HASH_REQUIRED",
    ),
  });
}

async function establishConfigChainV1(input: {
  repository: RuntimeConfigRepositoryPortV1;
  chain: readonly CanonicalObjectEnvelopeV1[];
  allow_writes: boolean;
}): Promise<{ inserted: number; existing: number }> {
  let inserted = 0;
  let existing = 0;
  for (const config of input.chain) {
    if (input.allow_writes) {
      const committed = await input.repository.commitRuntimeConfig(config);
      if (committed.object_id !== config.object_id) {
        throw new Error("CAP05_S10_RUNTIME_CONFIG_COMMIT_ID_MISMATCH");
      }
      if (committed.status === "INSERTED") inserted += 1;
      else existing += 1;
    }
    const readback = await exactConfigReadbackV1(
      input.repository,
      config.object_id,
      config.determinism_hash,
      "CAP05_S10_RUNTIME_CONFIG_READBACK_MISMATCH",
    );
    if (readback.logical_time !== config.logical_time) {
      throw new Error("CAP05_S10_RUNTIME_CONFIG_LOGICAL_TIME_MISMATCH");
    }
  }
  return { inserted, existing };
}

function tickInputV1(input: {
  request: RunCap05BoundedFeedbackChainInputV1;
  logical_time: string;
  config: CanonicalObjectEnvelopeV1;
}): ExecuteCap04SingleTickInputV1 {
  return {
    scope: input.request.scope,
    logical_time: input.logical_time,
    created_at: input.logical_time,
    runtime_config_ref: input.config.object_id,
    runtime_config_hash: input.config.determinism_hash,
    authorized_future_forcing_binding_ids: input.request.authorized_future_forcing_binding_ids,
    crop_stage_context: input.request.crop_stage_context,
    lease_owner: input.request.lease_owner,
    lease_duration_seconds: input.request.lease_duration_seconds,
  };
}

function baseResultV1(input: {
  status: "COMPLETED" | "ALREADY_COMPLETE";
  initial_completed_tick_count: number;
  executed_tick_count_this_call: number;
  config_counts: { inserted: number; existing: number };
  receipt_tick_status: ExecuteCap04SingleTickResultV1["status"] | null;
  outcome: ExecuteCap05ForecastResidualOutcomeTickResultV1 | null;
  tick_summaries: Cap05S10TickSummaryV1[];
}): RunCap05BoundedFeedbackChainResultV1 {
  return {
    service_id: CAP05_S10_BOUNDED_CHAIN_SERVICE_ID_V1,
    status: input.status,
    initial_completed_tick_count: input.initial_completed_tick_count,
    executed_tick_count_this_call: input.executed_tick_count_this_call,
    established_tick_count: 8,
    posterior_state_count: 8,
    successful_forecast_run_count: 8,
    scenario_set_count: 8,
    forecast_point_count: CAP05_S10_FORECAST_POINT_COUNT_V1,
    scenario_point_count: CAP05_S10_SCENARIO_POINT_COUNT_V1,
    first_committed_sequence: 73,
    final_committed_sequence: CAP05_S10_FINAL_SEQUENCE_V1,
    final_next_logical_tick_time: CAP05_S10_FINAL_NEXT_LOGICAL_TIME_V1,
    runtime_config_count: 8,
    runtime_config_insert_count: input.config_counts.inserted,
    runtime_config_existing_count: input.config_counts.existing,
    receipt_tick_status: input.receipt_tick_status,
    outcome_tick_status: input.outcome?.tick.status ?? null,
    residual_status: input.outcome?.residual_status ?? null,
    residual_ref: input.outcome?.residual.object_id ?? null,
    residual_hash: input.outcome?.residual.determinism_hash ?? null,
    tick_summaries: input.tick_summaries,
    orchestrator_canonical_twin_object_fact_delta: CAP05_S10_ORCHESTRATOR_CANONICAL_FACT_DELTA_V1,
    full_capability_path_canonical_twin_object_fact_delta: CAP05_S10_FULL_PATH_CANONICAL_FACT_DELTA_V1,
    replay_evidence_fact_delta_accounted_separately: true,
    projection_row_delta_accounted_separately: true,
    causal_effect_claimed: false,
    forecast_assimilation_equivalence_claimed: false,
    automatic_history_rewrite: false,
  };
}

export class Cap05BoundedEightTickFeedbackChainServiceV1 {
  constructor(
    private readonly handoffService: Cap05S10PrepareNextTickPortV1,
    private readonly runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    private readonly receiptTickService: Cap05S10ReceiptTickPortV1,
    private readonly outcomeTickService: Cap05S10OutcomeTickPortV1,
    private readonly continuationTickService: Cap05S10ContinuationTickPortV1,
  ) {}

  async run(
    input: RunCap05BoundedFeedbackChainInputV1,
  ): Promise<RunCap05BoundedFeedbackChainResultV1> {
    requiredStringV1(input.lease_owner, "CAP05_S10_LEASE_OWNER_REQUIRED");
    requiredPositiveIntegerV1(input.lease_duration_seconds, "CAP05_S10_LEASE_DURATION_INVALID");
    if (!Array.isArray(input.authorized_future_forcing_binding_ids)
      || input.authorized_future_forcing_binding_ids.length === 0
      || input.authorized_future_forcing_binding_ids.some((value) => typeof value !== "string" || !value.trim())) {
      throw new Error("CAP05_S10_FUTURE_FORCING_BINDING_AUTHORITY_REQUIRED");
    }

    const initialHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    exactScopeV1(initialHandoff, input.scope, "CAP05_S10_PREDECESSOR_SCOPE_MISMATCH");
    const initialCompleted = completedTickCountV1(initialHandoff);
    const predecessor = await resolvePredecessorConfigV1({
      repository: this.runtimeConfigRepository,
      handoff: initialHandoff,
      completed_tick_count: initialCompleted,
    });
    const configs = chainFromPredecessorV1({
      scope: input.scope,
      predecessor,
      handoff: initialHandoff,
    });
    const configCounts = await establishConfigChainV1({
      repository: this.runtimeConfigRepository,
      chain: configs,
      allow_writes: initialCompleted < CAP05_S10_TICK_COUNT_V1,
    });

    if (initialCompleted === CAP05_S10_TICK_COUNT_V1) {
      if (initialHandoff.next_logical_tick_time !== CAP05_S10_FINAL_NEXT_LOGICAL_TIME_V1
        || initialHandoff.previous_tick_sequence !== CAP05_S10_FINAL_SEQUENCE_V1) {
        throw new Error("CAP05_S10_COMPLETED_HANDOFF_MISMATCH");
      }
      return baseResultV1({
        status: "ALREADY_COMPLETE",
        initial_completed_tick_count: initialCompleted,
        executed_tick_count_this_call: 0,
        config_counts: configCounts,
        receipt_tick_status: null,
        outcome: null,
        tick_summaries: [],
      });
    }

    const summaries: Cap05S10TickSummaryV1[] = [];
    let executedCount = 0;
    let receiptStatus: ExecuteCap04SingleTickResultV1["status"] | null = null;

    if (initialCompleted === 0) {
      const receiptResult = await this.receiptTickService.executeOneTick(tickInputV1({
        request: input,
        logical_time: CAP05_S10_FIRST_LOGICAL_TIME_V1,
        config: configs[0],
      }));
      receiptStatus = receiptResult.status;
      summaries.push(validateTickV1({
        result: receiptResult,
        scope: input.scope,
        logical_time: CAP05_S10_FIRST_LOGICAL_TIME_V1,
        expected_sequence: 73,
        config: configs[0],
      }));
      executedCount += 1;
    }

    let outcome: ExecuteCap05ForecastResidualOutcomeTickResultV1 | null = null;
    if (initialCompleted <= 1) {
      outcome = await this.outcomeTickService.executeOneTickAndCommitResidual(tickInputV1({
        request: input,
        logical_time: CAP05_S10_OUTCOME_LOGICAL_TIME_V1,
        config: configs[1],
      }));
      summaries.push(validateTickV1({
        result: outcome.tick,
        scope: input.scope,
        logical_time: CAP05_S10_OUTCOME_LOGICAL_TIME_V1,
        expected_sequence: 74,
        config: configs[1],
      }));
      executedCount += outcome.tick.status === "INSERTED" ? 1 : 0;
    } else {
      outcome = await this.outcomeTickService.executeOneTickAndCommitResidual(tickInputV1({
        request: input,
        logical_time: CAP05_S10_OUTCOME_LOGICAL_TIME_V1,
        config: configs[1],
      }));
      validateTickV1({
        result: outcome.tick,
        scope: input.scope,
        logical_time: CAP05_S10_OUTCOME_LOGICAL_TIME_V1,
        expected_sequence: 74,
        config: configs[1],
      });
    }
    if (outcome.residual.logical_time !== CAP05_S10_OUTCOME_LOGICAL_TIME_V1
      || outcome.residual.runtime_config_ref !== configs[1].object_id
      || outcome.residual.runtime_config_hash !== configs[1].determinism_hash) {
      throw new Error("CAP05_S10_RESIDUAL_CONTEXT_MISMATCH");
    }
    if (outcome.relation_trace.causal_effect_claimed !== false
      || outcome.relation_trace.equivalence_claimed !== false) {
      throw new Error("CAP05_S10_RESIDUAL_NONCLAIM_VIOLATION");
    }

    let current = await this.handoffService.prepareNextTickInput(input.scope);
    const continuationStartMs = Math.max(
      Date.parse(current.next_logical_tick_time),
      Date.parse(addHoursV1(CAP05_S10_OUTCOME_LOGICAL_TIME_V1, 1)),
    );
    for (
      let logicalTimeMs = continuationStartMs;
      logicalTimeMs <= Date.parse(CAP05_S10_FINAL_LOGICAL_TIME_V1);
      logicalTimeMs += 3_600_000
    ) {
      const logicalTime = new Date(logicalTimeMs).toISOString();
      const configIndex = (logicalTimeMs - Date.parse(CAP05_S10_FIRST_LOGICAL_TIME_V1)) / 3_600_000;
      if (!Number.isInteger(configIndex) || configIndex < 2 || configIndex >= configs.length) {
        throw new Error("CAP05_S10_CONTINUATION_CONFIG_INDEX_INVALID");
      }
      const result = await this.continuationTickService.executeOneTick(tickInputV1({
        request: input,
        logical_time: logicalTime,
        config: configs[configIndex],
      }));
      summaries.push(validateTickV1({
        result,
        scope: input.scope,
        logical_time: logicalTime,
        expected_sequence: CAP05_S10_PREDECESSOR_SEQUENCE_V1 + configIndex + 1,
        config: configs[configIndex],
      }));
      executedCount += result.status === "INSERTED" ? 1 : 0;
      current = result.next_handoff;
    }

    const finalHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    if (finalHandoff.next_logical_tick_time !== CAP05_S10_FINAL_NEXT_LOGICAL_TIME_V1
      || finalHandoff.previous_tick_sequence !== CAP05_S10_FINAL_SEQUENCE_V1) {
      throw new Error("CAP05_S10_FINAL_HANDOFF_MISMATCH");
    }
    return baseResultV1({
      status: "COMPLETED",
      initial_completed_tick_count: initialCompleted,
      executed_tick_count_this_call: executedCount,
      config_counts: configCounts,
      receipt_tick_status: receiptStatus,
      outcome,
      tick_summaries: summaries,
    });
  }
}
