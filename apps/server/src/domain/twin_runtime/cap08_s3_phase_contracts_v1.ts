// Purpose: overlay the MCFT-CAP-08.S3 E/H/G obligations and exact per-Tick barrier proof on the frozen S1 phase order without changing the phase-engine contract digest.
// Boundary: pure deterministic phase contracts only; no persistence, database, clock, Evidence loading, State math, route, scheduler, or production authority.

import {
  CAP08_PHASE_ORDER_V1,
  validateCap08S1TickPhasePlanV1,
  type Cap08PhaseIdV1,
  type Cap08TickPhasePlanV1,
} from "./cap08_phase_engine_contracts_v1.js";
import {
  buildCap08S3TickObligationV1,
  type Cap08S3TickObligationV1,
} from "./cap08_s3_formal_provider_contracts_v1.js";

export type Cap08S3DueObligationSetV1 = {
  schema_version: "geox_mcft_cap08_s3_due_obligation_set_v1";
  tick_id: string;
  logical_time: string;
  E: string[];
  H: string[];
  A: readonly ["STATE_FORECAST_A1"];
  B: readonly ["THREE_OPTION_SCENARIO_SET"];
  G: string[];
  C: readonly [];
};

export type Cap08S3TickBarrierV1 = {
  schema_version: "geox_mcft_cap08_s3_tick_barrier_v1";
  tick_id: string;
  logical_time: string;
  status: "COMPLETE";
  completed_phases: readonly Cap08PhaseIdV1[];
  a_record_set_count: 1;
  posterior_state_count: 1;
  successful_forecast_count: 1;
  forecast_point_count: 72;
  scenario_set_count: 1;
  scenario_option_count: 3;
  scenario_point_count: 216;
  decision_count: 0 | 1;
  approval_assertion_count: 0 | 1;
  approved_plan_count: 0 | 1;
  execution_receipt_count: 0 | 1;
  action_feedback_count: 0 | 1;
  action_feedback_consumed_by_a: boolean;
  outcome_fvo10_identity_count: 0 | 1;
  residual_count: 0;
  recommendation_count: 0;
  ao_act_count: 0;
  dispatch_count: 0;
  model_activation_count: 0;
  next_tick_legal: true;
};

export function buildCap08S3DueObligationSetV1(
  plan: Cap08TickPhasePlanV1,
): Cap08S3DueObligationSetV1 {
  validateCap08S1TickPhasePlanV1(plan);
  const obligation = buildCap08S3TickObligationV1(plan.logical_time);
  const e = ["BASE_REPLAY_EVIDENCE"];
  const h: string[] = [];
  const g: string[] = [];
  if (obligation.commit_approval_plan_binding_at_e) e.push("APPROVAL_ASSERTION", "APPROVED_PLAN_SNAPSHOT");
  if (obligation.materialize_receipt_at_e) e.push("EXECUTION_RECEIPT_EVIDENCE");
  if (obligation.commit_action_feedback_at_h) h.push("ACTION_FEEDBACK_COMMIT_BEFORE_A");
  if (obligation.require_action_feedback_readback_at_h) h.push("ACTION_FEEDBACK_EXACT_READBACK");
  if (obligation.resolve_decision_source_and_commit_at_g) g.push("HUMAN_DECISION_AFTER_SCENARIO");
  return {
    schema_version: "geox_mcft_cap08_s3_due_obligation_set_v1",
    tick_id: plan.tick_id,
    logical_time: plan.logical_time,
    E: e,
    H: h,
    A: ["STATE_FORECAST_A1"],
    B: ["THREE_OPTION_SCENARIO_SET"],
    G: g,
    C: [],
  };
}

function exactCountV1(value: number, expected: number, code: string): void {
  if (value !== expected) throw new Error(code);
}

export function buildCap08S3TickBarrierV1(input: {
  plan: Cap08TickPhasePlanV1;
  obligation: Cap08S3TickObligationV1;
  completed_phases: readonly Cap08PhaseIdV1[];
  a_record_set_count: number;
  posterior_state_count: number;
  successful_forecast_count: number;
  forecast_point_count: number;
  scenario_set_count: number;
  scenario_option_count: number;
  scenario_point_count: number;
  decision_count: number;
  approval_assertion_count: number;
  approved_plan_count: number;
  execution_receipt_count: number;
  action_feedback_count: number;
  action_feedback_consumed_by_a: boolean;
  outcome_fvo10_identity_count: number;
  residual_count: number;
  recommendation_count: number;
  ao_act_count: number;
  dispatch_count: number;
  model_activation_count: number;
}): Cap08S3TickBarrierV1 {
  validateCap08S1TickPhasePlanV1(input.plan);
  const expected = buildCap08S3TickObligationV1(input.plan.logical_time);
  if (JSON.stringify(input.obligation) !== JSON.stringify(expected)) throw new Error("CAP08_S3_BARRIER_OBLIGATION_MISMATCH");
  if (JSON.stringify(input.completed_phases) !== JSON.stringify(CAP08_PHASE_ORDER_V1)) throw new Error("CAP08_S3_BARRIER_PHASE_ORDER_INCOMPLETE");
  exactCountV1(input.a_record_set_count, 1, "CAP08_S3_BARRIER_A_COUNT");
  exactCountV1(input.posterior_state_count, 1, "CAP08_S3_BARRIER_STATE_COUNT");
  exactCountV1(input.successful_forecast_count, 1, "CAP08_S3_BARRIER_FORECAST_COUNT");
  exactCountV1(input.forecast_point_count, 72, "CAP08_S3_BARRIER_FORECAST_POINT_COUNT");
  exactCountV1(input.scenario_set_count, 1, "CAP08_S3_BARRIER_SCENARIO_COUNT");
  exactCountV1(input.scenario_option_count, 3, "CAP08_S3_BARRIER_SCENARIO_OPTION_COUNT");
  exactCountV1(input.scenario_point_count, 216, "CAP08_S3_BARRIER_SCENARIO_POINT_COUNT");
  exactCountV1(input.decision_count, expected.resolve_decision_source_and_commit_at_g ? 1 : 0, "CAP08_S3_BARRIER_DECISION_COUNT");
  exactCountV1(input.approval_assertion_count, expected.commit_approval_plan_binding_at_e ? 1 : 0, "CAP08_S3_BARRIER_APPROVAL_COUNT");
  exactCountV1(input.approved_plan_count, expected.commit_approval_plan_binding_at_e ? 1 : 0, "CAP08_S3_BARRIER_PLAN_COUNT");
  exactCountV1(input.execution_receipt_count, expected.materialize_receipt_at_e ? 1 : 0, "CAP08_S3_BARRIER_RECEIPT_COUNT");
  exactCountV1(input.action_feedback_count, expected.commit_action_feedback_at_h ? 1 : 0, "CAP08_S3_BARRIER_ACTION_FEEDBACK_COUNT");
  if (input.action_feedback_consumed_by_a !== expected.require_action_feedback_consumption_at_a) {
    throw new Error("CAP08_S3_BARRIER_ACTION_FEEDBACK_CONSUMPTION_MISMATCH");
  }
  exactCountV1(input.outcome_fvo10_identity_count, expected.require_outcome_fvo10_identity ? 1 : 0, "CAP08_S3_BARRIER_OUTCOME_COUNT");
  for (const [value, code] of [
    [input.residual_count, "CAP08_S3_BARRIER_RESIDUAL_COUNT"],
    [input.recommendation_count, "CAP08_S3_BARRIER_RECOMMENDATION_COUNT"],
    [input.ao_act_count, "CAP08_S3_BARRIER_AO_ACT_COUNT"],
    [input.dispatch_count, "CAP08_S3_BARRIER_DISPATCH_COUNT"],
    [input.model_activation_count, "CAP08_S3_BARRIER_MODEL_ACTIVATION_COUNT"],
  ] as const) exactCountV1(value, 0, code);
  return {
    schema_version: "geox_mcft_cap08_s3_tick_barrier_v1",
    tick_id: input.plan.tick_id,
    logical_time: input.plan.logical_time,
    status: "COMPLETE",
    completed_phases: [...CAP08_PHASE_ORDER_V1],
    a_record_set_count: 1,
    posterior_state_count: 1,
    successful_forecast_count: 1,
    forecast_point_count: 72,
    scenario_set_count: 1,
    scenario_option_count: 3,
    scenario_point_count: 216,
    decision_count: expected.resolve_decision_source_and_commit_at_g ? 1 : 0,
    approval_assertion_count: expected.commit_approval_plan_binding_at_e ? 1 : 0,
    approved_plan_count: expected.commit_approval_plan_binding_at_e ? 1 : 0,
    execution_receipt_count: expected.materialize_receipt_at_e ? 1 : 0,
    action_feedback_count: expected.commit_action_feedback_at_h ? 1 : 0,
    action_feedback_consumed_by_a: expected.require_action_feedback_consumption_at_a,
    outcome_fvo10_identity_count: expected.require_outcome_fvo10_identity ? 1 : 0,
    residual_count: 0,
    recommendation_count: 0,
    ao_act_count: 0,
    dispatch_count: 0,
    model_activation_count: 0,
    next_tick_legal: true,
  };
}
