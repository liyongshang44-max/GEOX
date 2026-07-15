// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.ts
// Purpose: prove the S10 orchestration compiles one exact eight-config chain, executes 02:00 receipt consumption, 03:00 outcome plus C Residual, contiguous 04:00–09:00 A1/B ticks, deterministic resume and zero-write completed replay.
// Boundary: in-memory orchestration acceptance only; component mathematics and PostgreSQL persistence remain covered by permanent S6–S9 acceptance. No route, scheduler, live field, Recommendation, AO-ACT, calibration, model activation or CAP-06 authority.

import assert from "node:assert/strict";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { compileCap04RuntimeConfigV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  CAP05_S10_FINAL_NEXT_LOGICAL_TIME_V1,
  CAP05_S10_FINAL_SEQUENCE_V1,
  CAP05_S10_FIRST_LOGICAL_TIME_V1,
  Cap05BoundedEightTickFeedbackChainServiceV1,
  type Cap05S10ContinuationTickPortV1,
  type Cap05S10OutcomeTickPortV1,
  type Cap05S10PrepareNextTickPortV1,
  type Cap05S10ReceiptTickPortV1,
  type RunCap05BoundedFeedbackChainInputV1,
} from "../../apps/server/src/runtime/twin_runtime/bounded_feedback_chain_service_v1.js";
import type {
  ExecuteCap04SingleTickInputV1,
  ExecuteCap04SingleTickResultV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import type { ExecuteCap05ForecastResidualOutcomeTickResultV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_residual_outcome_tick_service_v1.js";
import type { ExecuteCap05ReceiptConsumingTickResultV1 } from "../../apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.js";
import type {
  PreparedNextTickInputV1,
  RuntimeConfigRepositoryPortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const scope: TwinScopeKeyV1 = {
  tenant_id: "tenant_cap05_s10",
  project_id: "project_cap05_s10",
  group_id: "group_cap05_s10",
  field_id: "field_cap05_s10",
  season_id: "season_cap05_s10",
  zone_id: "zone_cap05_s10",
};

let pass = 0;
function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function baseConfigV1(): CanonicalObjectEnvelopeV1 {
  return compileCap04RuntimeConfigV1({
    scope,
    effective_logical_time: "2026-06-04T01:00:00.000Z",
    created_at: "2026-06-04T01:00:00.000Z",
    parent_runtime_config_ref: "runtime_config_cap04_parent",
    parent_runtime_config_hash: "sha256:runtime-config-cap04-parent",
    reality_binding_ref: "reality_binding_cap05_s10",
    reality_binding_hash: "sha256:reality-binding-cap05-s10",
    source_matrix_hash: "sha256:source-matrix-cap05-s10",
    configuration_matrix_hash: "sha256:configuration-matrix-cap05-s10",
    geometry_semantic_hash: "sha256:geometry-cap05-s10",
  });
}

function handoffV1(input: {
  sequence: number;
  next_time: string;
  config: CanonicalObjectEnvelopeV1;
}): PreparedNextTickInputV1 {
  return {
    ...scope,
    active_lineage_ref: "twin_runtime_lineage_cap05_s10",
    previous_posterior_ref: `state_sequence_${input.sequence}`,
    previous_posterior_hash: `sha256:state-sequence-${input.sequence}`,
    previous_checkpoint_ref: `checkpoint_sequence_${input.sequence}`,
    previous_checkpoint_hash: `sha256:checkpoint-sequence-${input.sequence}`,
    previous_forecast_result_ref: `forecast_sequence_${input.sequence}`,
    previous_forecast_result_hash: `sha256:forecast-sequence-${input.sequence}`,
    latest_successful_forecast_ref: `forecast_sequence_${input.sequence}`,
    lineage_id: "twin_runtime_lineage_cap05_s10",
    revision_id: "revision_active",
    prior_mean: 100,
    prior_variance: 4,
    previous_storage_mm_decimal: "100.000000",
    previous_variance_basis: {
      prior_variance_mm2: "4.000000000000",
      process_variance_mm2: "0.000000000000",
      posterior_variance_mm2: "4.000000000000",
    },
    previous_tick_sequence: input.sequence,
    next_logical_tick_time: input.next_time,
    previous_state_runtime_config_ref: input.config.object_id,
    previous_state_runtime_config_hash: input.config.determinism_hash,
    reality_binding_ref: "reality_binding_cap05_s10",
    reality_binding_hash: "sha256:reality-binding-cap05-s10",
  } as unknown as PreparedNextTickInputV1;
}

class MemoryConfigRepositoryV1 implements RuntimeConfigRepositoryPortV1 {
  readonly byId = new Map<string, CanonicalObjectEnvelopeV1>();
  commit_calls = 0;
  insert_count = 0;

  constructor(base: CanonicalObjectEnvelopeV1) {
    this.byId.set(base.object_id, structuredClone(base));
  }

  async commitRuntimeConfig(config: CanonicalObjectEnvelopeV1): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    object_id: string;
    fact_id: string;
  }> {
    this.commit_calls += 1;
    const existing = this.byId.get(config.object_id);
    if (existing) {
      assert.equal(existing.determinism_hash, config.determinism_hash);
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        object_id: config.object_id,
        fact_id: `fact_${config.object_id}`,
      };
    }
    this.insert_count += 1;
    this.byId.set(config.object_id, structuredClone(config));
    return {
      status: "INSERTED",
      object_id: config.object_id,
      fact_id: `fact_${config.object_id}`,
    };
  }

  async readRuntimeConfig(objectId: string): Promise<CanonicalObjectEnvelopeV1 | null> {
    const value = this.byId.get(objectId);
    return value ? structuredClone(value) : null;
  }

  configAt(logicalTime: string): CanonicalObjectEnvelopeV1 {
    const values = [...this.byId.values()].filter((value) => value.logical_time === logicalTime);
    assert.equal(values.length, 1);
    return structuredClone(values[0]);
  }
}

class MutableHandoffV1 implements Cap05S10PrepareNextTickPortV1 {
  constructor(public value: PreparedNextTickInputV1) {}

  async prepareNextTickInput(): Promise<PreparedNextTickInputV1> {
    return structuredClone(this.value);
  }

  advance(input: ExecuteCap04SingleTickInputV1, sequence: number): void {
    const config = {
      object_id: input.runtime_config_ref,
      determinism_hash: input.runtime_config_hash,
    } as CanonicalObjectEnvelopeV1;
    this.value = handoffV1({
      sequence,
      next_time: addHoursV1(input.logical_time, 1),
      config,
    });
  }
}

function memberV1(input: {
  type: string;
  logical_time: string;
  config: CanonicalObjectEnvelopeV1;
  payload: Record<string, unknown>;
}): CanonicalObjectEnvelopeV1 {
  return {
    object_id: `${input.type}_${input.logical_time}`,
    object_type: input.type as CanonicalObjectEnvelopeV1["object_type"],
    schema_version: "v1",
    ...scope,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    source_refs: [],
    evidence_refs: [],
    runtime_config_ref: input.config.object_id,
    runtime_config_hash: input.config.determinism_hash,
    idempotency_key: `${input.type}_key_${input.logical_time}`,
    determinism_hash: `sha256:${input.type}-${input.logical_time}`,
    limitations: ["CONTROLLED_REPLAY_ONLY"],
    created_at: input.logical_time,
    payload: input.payload,
  };
}

function tickResultV1(input: {
  logical_time: string;
  sequence: number;
  config: CanonicalObjectEnvelopeV1;
  status?: ExecuteCap04SingleTickResultV1["status"];
}): ExecuteCap04SingleTickResultV1 {
  const forecast = memberV1({
    type: "twin_forecast_run_v1",
    logical_time: input.logical_time,
    config: input.config,
    payload: {
      status: "COMPLETED",
      points: Array.from({ length: 72 }, (_, index) => ({
        horizon_hour: index + 1,
        target_time: addHoursV1(input.logical_time, index + 1),
      })),
    },
  });
  const members = [
    memberV1({ type: "twin_evidence_window_v1", logical_time: input.logical_time, config: input.config, payload: {} }),
    memberV1({ type: "twin_state_transition_v1", logical_time: input.logical_time, config: input.config, payload: {} }),
    memberV1({ type: "twin_dynamics_result_v1", logical_time: input.logical_time, config: input.config, payload: {} }),
    memberV1({ type: "twin_assimilation_update_v1", logical_time: input.logical_time, config: input.config, payload: {} }),
    memberV1({ type: "twin_state_estimate_v1", logical_time: input.logical_time, config: input.config, payload: {} }),
    forecast,
    memberV1({ type: "twin_runtime_tick_v1", logical_time: input.logical_time, config: input.config, payload: {} }),
    memberV1({
      type: "twin_runtime_checkpoint_v1",
      logical_time: input.logical_time,
      config: input.config,
      payload: { tick_sequence: input.sequence },
    }),
  ];
  const next = handoffV1({
    sequence: input.sequence,
    next_time: addHoursV1(input.logical_time, 1),
    config: input.config,
  });
  return {
    status: input.status ?? "INSERTED",
    a_record_set: {
      record_set_id: `a1_${input.logical_time}`,
      idempotency_key: `a1_key_${input.logical_time}`,
      aggregate_determinism_hash: `sha256:a1-${input.logical_time}`,
      operation_variant: "A_STATE_TICK_COMMIT",
      members,
    },
    b_record: {
      record_set_id: `b_${input.logical_time}`,
      idempotency_key: `b_key_${input.logical_time}`,
      aggregate_determinism_hash: `sha256:b-${input.logical_time}`,
      operation_variant: "B_SCENARIO_COMMIT",
      scenario_set: memberV1({
        type: "twin_scenario_set_v1",
        logical_time: input.logical_time,
        config: input.config,
        payload: {
          options: Array.from({ length: 3 }, (_, optionIndex) => ({
            option_index: optionIndex,
            trajectory_points: Array.from({ length: 72 }, (_, pointIndex) => ({
              horizon_hour: pointIndex + 1,
            })),
          })),
        },
      }),
    },
    evidence_window: null,
    dynamics: null,
    assimilation: null,
    forcing_window: null,
    forecast_math: null,
    scenario_math: null,
    next_handoff: next,
  } as unknown as ExecuteCap04SingleTickResultV1;
}

class ReceiptPortV1 implements Cap05S10ReceiptTickPortV1 {
  calls = 0;
  constructor(
    private readonly handoff: MutableHandoffV1,
    private readonly repository: MemoryConfigRepositoryV1,
  ) {}

  async executeOneTick(input: ExecuteCap04SingleTickInputV1): Promise<ExecuteCap05ReceiptConsumingTickResultV1> {
    this.calls += 1;
    assert.equal(input.logical_time, "2026-06-04T02:00:00.000Z");
    const config = this.repository.configAt(input.logical_time);
    const result = tickResultV1({ logical_time: input.logical_time, sequence: 73, config });
    this.handoff.advance(input, 73);
    return {
      ...result,
      action_feedback_selection: {
        selector_id: "CANONICAL_H_ACTION_FEEDBACK_HOURLY_SELECTOR_V1",
        evidence_cutoff_policy_id: "AVAILABLE_TO_RUNTIME_AT_LE_TARGET_LOGICAL_TIME_V1",
        late_policy_id: "NO_SHIFT_NO_AUTOMATIC_HISTORY_REWRITE_V1",
        interval_policy_id: "OPEN_START_CLOSED_END_PT1H_V1",
        multiple_event_policy_id: "EXACTLY_ONE_ELIGIBLE_EXECUTION_EVENT_PER_TICK_V1",
        spatial_overlap_policy_id: "NOT_ESTABLISHED",
        evidence_cutoff_time: input.logical_time,
        window_start_exclusive: addHoursV1(input.logical_time, -1),
        window_end_inclusive: input.logical_time,
        candidate_count: 1,
        selected_action_feedback_refs: ["twin_action_feedback_cap05_s10"],
        excluded_action_feedback_refs: [],
        deduplicated_action_feedback_refs: [],
        entries: [],
        semantic_digest: "sha256:selection-cap05-s10",
      },
    } as ExecuteCap05ReceiptConsumingTickResultV1;
  }
}

class OutcomePortV1 implements Cap05S10OutcomeTickPortV1 {
  calls = 0;
  inserted_calls = 0;
  constructor(
    private readonly handoff: MutableHandoffV1,
    private readonly repository: MemoryConfigRepositoryV1,
  ) {}

  async executeOneTickAndCommitResidual(
    input: ExecuteCap04SingleTickInputV1,
  ): Promise<ExecuteCap05ForecastResidualOutcomeTickResultV1> {
    this.calls += 1;
    assert.equal(input.logical_time, "2026-06-04T03:00:00.000Z");
    const config = this.repository.configAt(input.logical_time);
    const fresh = this.handoff.value.next_logical_tick_time === input.logical_time;
    const tick = tickResultV1({
      logical_time: input.logical_time,
      sequence: 74,
      config,
      status: fresh ? "INSERTED" : "EXISTING_IDEMPOTENT_SUCCESS",
    });
    if (fresh) {
      this.inserted_calls += 1;
      this.handoff.advance(input, 74);
    }
    const residual = memberV1({
      type: "twin_forecast_residual_v1",
      logical_time: input.logical_time,
      config,
      payload: {
        transaction_variant: "C_FORECAST_RESIDUAL_COMMIT",
        match_status: "MATCHED",
      },
    });
    return {
      service_id: "CAP05_FORECAST_RESIDUAL_OUTCOME_TICK_SERVICE_V1",
      tick,
      residual_status: fresh ? "INSERTED" : "EXISTING_IDEMPOTENT_SUCCESS",
      residual,
      residual_fact_id: `fact_${residual.object_id}`,
      forecast_selection_trace: {
        selector_id: "CAP05_HISTORICAL_FORECAST_RESIDUAL_SELECTOR_V1",
        observation_target_time: input.logical_time,
        observation_available_to_runtime_at: input.logical_time,
        selected_forecast_run_ref: "forecast_2026-06-04T02:00:00.000Z",
        selected_forecast_point_ref: "forecast_2026-06-04T02:00:00.000Z#/points/1",
        entries: [],
      },
      relation_trace: {
        trace_id: "FORECAST_RESIDUAL_VS_ASSIMILATION_INNOVATION_TRACE_V1",
        observation_ref: "observation_cap05_s10",
        observation_hash: "sha256:observation-cap05-s10",
        observation_value: "0.250000",
        observation_operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
        historical_forecast_prediction: "0.249000",
        historical_forecast_residual: "0.001000",
        current_tick_propagated_prior_prediction: "0.248000",
        current_tick_assimilation_innovation: "0.002000",
        shared_observation: true,
        predictions_equal: false,
        residual_and_innovation_equal: false,
        equivalence_claimed: false,
        causal_effect_claimed: false,
      },
    } as unknown as ExecuteCap05ForecastResidualOutcomeTickResultV1;
  }
}

class ContinuationPortV1 implements Cap05S10ContinuationTickPortV1 {
  calls: string[] = [];
  block_at: string | null = null;
  wrong_sequence_at: string | null = null;

  constructor(
    private readonly handoff: MutableHandoffV1,
    private readonly repository: MemoryConfigRepositoryV1,
  ) {}

  async executeOneTick(input: ExecuteCap04SingleTickInputV1): Promise<ExecuteCap04SingleTickResultV1> {
    this.calls.push(input.logical_time);
    assert.equal(this.handoff.value.next_logical_tick_time, input.logical_time);
    const config = this.repository.configAt(input.logical_time);
    const index = (Date.parse(input.logical_time) - Date.parse(CAP05_S10_FIRST_LOGICAL_TIME_V1)) / 3_600_000;
    const sequence = 73 + index;
    const effectiveSequence = this.wrong_sequence_at === input.logical_time ? sequence + 1 : sequence;
    const result = tickResultV1({
      logical_time: input.logical_time,
      sequence: effectiveSequence,
      config,
      status: this.block_at === input.logical_time ? "BLOCKED_INSERTED" : "INSERTED",
    });
    if (this.block_at !== input.logical_time && this.wrong_sequence_at !== input.logical_time) {
      this.handoff.advance(input, sequence);
    }
    return result;
  }
}

function requestV1(): RunCap05BoundedFeedbackChainInputV1 {
  return {
    scope,
    authorized_future_forcing_binding_ids: [
      "weather_forecast_c8_hourly_v1",
      "future_et0_c8_hourly_v1",
    ],
    crop_stage_context: {
      crop_stage_code: "MID_SEASON",
      crop_stage_source_ref: "crop_stage_cap05_s10",
      crop_stage_source_hash: "sha256:crop-stage-cap05-s10",
      crop_stage_available_to_runtime_at: "2026-06-04T01:00:00.000Z",
    } as unknown as RunCap05BoundedFeedbackChainInputV1["crop_stage_context"],
    lease_owner: "mcft_cap05_s10_acceptance",
    lease_duration_seconds: 120,
  };
}

function serviceFixtureV1(input?: {
  handoff?: PreparedNextTickInputV1;
  repository?: MemoryConfigRepositoryV1;
}): {
  repository: MemoryConfigRepositoryV1;
  handoff: MutableHandoffV1;
  receipt: ReceiptPortV1;
  outcome: OutcomePortV1;
  continuation: ContinuationPortV1;
  service: Cap05BoundedEightTickFeedbackChainServiceV1;
} {
  const base = baseConfigV1();
  const repository = input?.repository ?? new MemoryConfigRepositoryV1(base);
  const handoff = new MutableHandoffV1(input?.handoff ?? handoffV1({
    sequence: 72,
    next_time: CAP05_S10_FIRST_LOGICAL_TIME_V1,
    config: base,
  }));
  const receipt = new ReceiptPortV1(handoff, repository);
  const outcome = new OutcomePortV1(handoff, repository);
  const continuation = new ContinuationPortV1(handoff, repository);
  return {
    repository,
    handoff,
    receipt,
    outcome,
    continuation,
    service: new Cap05BoundedEightTickFeedbackChainServiceV1(
      handoff,
      repository,
      receipt,
      outcome,
      continuation,
    ),
  };
}

async function main(): Promise<void> {
  const fresh = serviceFixtureV1();
  const inserted = await fresh.service.run(requestV1());
  assert.equal(inserted.status, "COMPLETED");
  assert.equal(inserted.initial_completed_tick_count, 0);
  assert.equal(inserted.executed_tick_count_this_call, 8);
  assert.equal(inserted.runtime_config_insert_count, 8);
  assert.equal(inserted.runtime_config_existing_count, 0);
  ok("fresh chain inserts exactly eight immutable Runtime Config objects and eight ticks");

  assert.equal(inserted.posterior_state_count, 8);
  assert.equal(inserted.successful_forecast_run_count, 8);
  assert.equal(inserted.scenario_set_count, 8);
  assert.equal(inserted.forecast_point_count, 576);
  assert.equal(inserted.scenario_point_count, 1728);
  ok("bounded result freezes 8 States, 8 Forecasts, 8 Scenario Sets and 576/1728 points");

  assert.deepEqual(
    inserted.tick_summaries.map((tick) => tick.committed_sequence),
    [73, 74, 75, 76, 77, 78, 79, 80],
  );
  assert.equal(inserted.final_next_logical_tick_time, CAP05_S10_FINAL_NEXT_LOGICAL_TIME_V1);
  assert.equal(fresh.handoff.value.previous_tick_sequence, CAP05_S10_FINAL_SEQUENCE_V1);
  ok("checkpoint sequence is exactly 73 through 80 and next logical tick is 10:00");

  assert.equal(fresh.receipt.calls, 1);
  assert.equal(fresh.outcome.calls, 1);
  assert.deepEqual(fresh.continuation.calls, [
    "2026-06-04T04:00:00.000Z",
    "2026-06-04T05:00:00.000Z",
    "2026-06-04T06:00:00.000Z",
    "2026-06-04T07:00:00.000Z",
    "2026-06-04T08:00:00.000Z",
    "2026-06-04T09:00:00.000Z",
  ]);
  ok("execution order is receipt, outcome plus C, then six contiguous continuation ticks");

  const configs = Array.from({ length: 8 }, (_, index) =>
    fresh.repository.configAt(addHoursV1(CAP05_S10_FIRST_LOGICAL_TIME_V1, index)));
  assert.equal(configs[0].payload.parent_runtime_config_ref, baseConfigV1().object_id);
  for (let index = 1; index < configs.length; index += 1) {
    assert.equal(configs[index].payload.parent_runtime_config_ref, configs[index - 1].object_id);
    assert.equal(configs[index].payload.parent_runtime_config_hash, configs[index - 1].determinism_hash);
  }
  ok("effective Runtime Config chain is hash-pinned F1 parent through F8");

  assert.equal(configs[0].payload.action_feedback_state_input_policy_id, "EXECUTED_OR_PARTIAL_VALIDATED_USABLE_EXACT_SCOPE_V1");
  assert.equal(configs[1].payload.forecast_residual_matching_policy_id, "LATEST_COMPLETED_FORECAST_POINT_TARGETING_OBSERVATION_V1");
  assert.equal(configs[1].payload.forecast_observation_projection_method_id, "FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1");
  ok("executable config profile carries the exact S7 and S8 policy aliases");

  assert.equal(inserted.residual_status, "INSERTED");
  assert.equal(inserted.causal_effect_claimed, false);
  assert.equal(inserted.forecast_assimilation_equivalence_claimed, false);
  assert.equal(inserted.automatic_history_rewrite, false);
  ok("03:00 C Residual is committed without causal, equivalence or history-rewrite claims");

  assert.equal(inserted.orchestrator_canonical_twin_object_fact_delta, 81);
  assert.equal(inserted.full_capability_path_canonical_twin_object_fact_delta, 83);
  assert.equal(inserted.replay_evidence_fact_delta_accounted_separately, true);
  assert.equal(inserted.projection_row_delta_accounted_separately, true);
  ok("fact accounting separates S10 orchestration, full path, Replay Evidence and projections");

  const beforeReplayCommits = fresh.repository.commit_calls;
  const beforeReplayTickCalls = {
    receipt: fresh.receipt.calls,
    outcome: fresh.outcome.calls,
    continuation: fresh.continuation.calls.length,
  };
  const replay = await fresh.service.run(requestV1());
  assert.equal(replay.status, "ALREADY_COMPLETE");
  assert.equal(replay.executed_tick_count_this_call, 0);
  assert.equal(replay.runtime_config_insert_count, 0);
  assert.equal(fresh.repository.commit_calls, beforeReplayCommits);
  assert.deepEqual({
    receipt: fresh.receipt.calls,
    outcome: fresh.outcome.calls,
    continuation: fresh.continuation.calls.length,
  }, beforeReplayTickCalls);
  ok("completed-chain rerun performs read-only verification with zero config or tick writes");

  const f3 = fresh.repository.configAt("2026-06-04T04:00:00.000Z");
  const resume = serviceFixtureV1({
    repository: fresh.repository,
    handoff: handoffV1({
      sequence: 75,
      next_time: "2026-06-04T05:00:00.000Z",
      config: f3,
    }),
  });
  const resumed = await resume.service.run(requestV1());
  assert.equal(resumed.status, "COMPLETED");
  assert.equal(resumed.initial_completed_tick_count, 3);
  assert.equal(resumed.executed_tick_count_this_call, 5);
  assert.equal(resume.receipt.calls, 0);
  assert.equal(resume.outcome.calls, 1);
  assert.equal(resume.outcome.inserted_calls, 0);
  assert.deepEqual(resume.continuation.calls, [
    "2026-06-04T05:00:00.000Z",
    "2026-06-04T06:00:00.000Z",
    "2026-06-04T07:00:00.000Z",
    "2026-06-04T08:00:00.000Z",
    "2026-06-04T09:00:00.000Z",
  ]);
  ok("partial restart reconstructs F0→F8, verifies C idempotently and resumes only missing ticks");

  const wrongTime = serviceFixtureV1();
  wrongTime.handoff.value.next_logical_tick_time = "2026-06-04T03:00:00.000Z";
  await assert.rejects(wrongTime.service.run(requestV1()), /CAP05_S10_PREDECESSOR_TIME_SEQUENCE_MISMATCH/);
  ok("time and checkpoint disagreement fails closed");

  const blocked = serviceFixtureV1();
  blocked.continuation.block_at = "2026-06-04T04:00:00.000Z";
  await assert.rejects(blocked.service.run(requestV1()), /CAP05_S10_BLOCKED_TICK_FORBIDDEN/);
  ok("A2 blocked Forecast cannot be counted as bounded-chain completion");

  const noncontiguous = serviceFixtureV1();
  noncontiguous.continuation.wrong_sequence_at = "2026-06-04T04:00:00.000Z";
  await assert.rejects(noncontiguous.service.run(requestV1()), /CAP05_S10_CHECKPOINT_SEQUENCE_MISMATCH/);
  ok("noncontiguous checkpoint advancement fails closed");

  const corrupt = serviceFixtureV1();
  const originalRead = corrupt.repository.readRuntimeConfig.bind(corrupt.repository);
  let corruptOnce = true;
  corrupt.repository.readRuntimeConfig = async (objectId: string) => {
    const value = await originalRead(objectId);
    if (value && corruptOnce && value.logical_time === "2026-06-04T02:00:00.000Z") {
      corruptOnce = false;
      return { ...value, determinism_hash: "sha256:corrupt" };
    }
    return value;
  };
  await assert.rejects(corrupt.service.run(requestV1()), /CAP05_S10_RUNTIME_CONFIG_READBACK_MISMATCH/);
  ok("Runtime Config commit/readback divergence fails closed before State execution");

  assert.equal(pass, 14);
  console.log(`MCFT-CAP-05 S10 bounded eight-tick feedback chain: ${pass} PASS / 0 FAIL`);
}

main();
