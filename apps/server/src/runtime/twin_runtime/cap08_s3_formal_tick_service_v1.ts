// Purpose: execute one MCFT-CAP-08.S3 formal Replay Tick through the frozen resolve/E/H/A/B/G/C/barrier order while inserting the exact Decision/Approval/Plan/Receipt/Action Feedback episode at T05-T10.
// Boundary: one explicit bounded Replay Tick only; no range loop, B00, restart policy, late correction, Residual, Calibration, route, scheduler, live ingestion, or production Runtime authority.

import {
  CAP08_PHASE_ORDER_V1,
  buildCap08S1TickBarrierV1,
  buildCap08S1TickPhasePlanV1,
  type Cap08PhaseIdV1,
  type Cap08TickBarrierV1,
  type Cap08TickPhasePlanV1,
} from "../../domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import {
  CAP08_S3_OUTCOME_FVO_ID_V1,
  CAP08_S3_OUTCOME_VALUE_V1,
  buildCap08S3TickObligationV1,
  type Cap08S3TickObligationV1,
} from "../../domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.js";
import {
  buildCap08S3DueObligationSetV1,
  buildCap08S3TickBarrierV1,
  type Cap08S3DueObligationSetV1,
  type Cap08S3TickBarrierV1,
} from "../../domain/twin_runtime/cap08_s3_phase_contracts_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type {
  Cap04ARecordSetV1,
  Cap04ScenarioSetRecordV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import type { Cap05ActionFeedbackEnvelopeV1, Cap05DecisionEnvelopeV1 } from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import type { Cap05ApprovalAssertionEvidenceV1, Cap05ApprovedPlanEvidenceV1 } from "../../evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import type { Cap05ExecutionReceiptEvidenceV1 } from "../../evidence/twin_runtime/execution_receipt_evidence_contract_v1.js";
import {
  Cap04ForecastScenarioSingleTickServiceV1,
  type ExecuteCap04SingleTickInputV1,
  type ExecuteCap04SingleTickResultV1,
} from "./forecast_scenario_single_tick_service_v1.js";
import {
  Cap05ReceiptConsumingForecastScenarioTickServiceV1,
  type ExecuteCap05ReceiptConsumingTickResultV1,
} from "./receipt_consuming_forecast_scenario_tick_service_v1.js";
import { Cap08DeferredScenarioPersistenceV1, type Cap08ScenarioFlushResultV1 } from "./cap08_deferred_scenario_persistence_v1.js";
import { Cap08FrozenEvidenceSourceV1 } from "./cap08_frozen_evidence_source_v1.js";
import {
  Cap08S3DecisionActionProviderServiceV1,
  type Cap08S3ActionFeedbackCommitResultV1,
  type Cap08S3ApprovalPlanCommitResultV1,
  type Cap08S3DecisionCommitResultV1,
  type Cap08S3ReceiptMaterializationResultV1,
} from "./cap08_s3_decision_action_provider_service_v1.js";
import type { CanonicalReplayEvidenceRecordV1, PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";

export type Cap08S3PhaseTraceV1 = {
  phase: Cap08PhaseIdV1;
  status: "COMPLETE";
  canonical_write:
    | "NONE"
    | "E_APPROVAL_PLAN_EVIDENCE"
    | "E_RECEIPT_EVIDENCE"
    | "H_ACTION_FEEDBACK"
    | "A_STATE_FORECAST"
    | "B_SCENARIO"
    | "G_DECISION";
  result: string;
};

export type ExecuteCap08S3FormalTickInputV1 = ExecuteCap04SingleTickInputV1 & {
  formal_run_id: string;
};

export type ExecuteCap08S3FormalTickResultV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  phase_plan: Cap08TickPhasePlanV1;
  s3_obligation: Cap08S3TickObligationV1;
  due_obligations: Cap08S3DueObligationSetV1;
  phase_trace: readonly Cap08S3PhaseTraceV1[];
  a_record_set: Cap04ARecordSetV1;
  b_record: Cap04ScenarioSetRecordV1;
  a_provider_result: ExecuteCap04SingleTickResultV1 | ExecuteCap05ReceiptConsumingTickResultV1;
  b_flush_result: Cap08ScenarioFlushResultV1;
  decision: Cap05DecisionEnvelopeV1 | null;
  approval_assertion: Cap05ApprovalAssertionEvidenceV1 | null;
  approved_plan: Cap05ApprovedPlanEvidenceV1 | null;
  receipt: Cap05ExecutionReceiptEvidenceV1 | null;
  action_feedback: Cap05ActionFeedbackEnvelopeV1 | null;
  action_feedback_consumed_by_a: boolean;
  outcome_fvo10_record: CanonicalReplayEvidenceRecordV1 | null;
  core_barrier: Cap08TickBarrierV1;
  s3_barrier: Cap08S3TickBarrierV1;
  next_handoff: PreparedNextTickInputV1;
  evidence_source_load_count: number;
};

export type PrepareCap08S3NextTickInputPortV1 = {
  prepareNextTickInput(scope: TwinScopeKeyV1): Promise<PreparedNextTickInputV1>;
};

function memberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP08_S3_A_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function scenarioPointCountV1(record: Cap04ScenarioSetRecordV1): number {
  return record.scenario_set.payload.options.reduce((sum, option) => sum + option.trajectory_points.length, 0);
}

function outcomeFvo10V1(records: readonly CanonicalReplayEvidenceRecordV1[]): CanonicalReplayEvidenceRecordV1 | null {
  const matches = records.filter((record) => record.source_record_id === CAP08_S3_OUTCOME_FVO_ID_V1);
  if (matches.length > 1) throw new Error("CAP08_S3_OUTCOME_FVO10_DUPLICATE");
  if (matches.length === 0) return null;
  const record = matches[0];
  if (record.record_type !== "soil_moisture_observation_v1"
    || record.binding_id !== "soil_obs_c8_20cm_v1"
    || record.canonical_payload.value !== Number(CAP08_S3_OUTCOME_VALUE_V1)
    || record.canonical_payload.unit !== "fraction") {
    throw new Error("CAP08_S3_OUTCOME_FVO10_IDENTITY_MISMATCH");
  }
  return structuredClone(record);
}

function insertedV1(values: readonly (string | null | undefined)[]): boolean {
  return values.some((value) => value === "INSERTED");
}

export class Cap08S3FormalTickServiceV1 {
  constructor(
    private readonly handoffService: PrepareCap08S3NextTickInputPortV1,
    private readonly evidence: Cap08FrozenEvidenceSourceV1,
    private readonly deferredScenario: Cap08DeferredScenarioPersistenceV1,
    private readonly normalTick: Cap04ForecastScenarioSingleTickServiceV1,
    private readonly receiptTick: Cap05ReceiptConsumingForecastScenarioTickServiceV1,
    private readonly provider: Cap08S3DecisionActionProviderServiceV1,
  ) {}

  async executeOneTick(input: ExecuteCap08S3FormalTickInputV1): Promise<ExecuteCap08S3FormalTickResultV1> {
    const plan = buildCap08S1TickPhasePlanV1({
      formal_run_id: input.formal_run_id,
      scope: input.scope,
      logical_time: input.logical_time,
    });
    const obligation = buildCap08S3TickObligationV1(plan.logical_time);
    const due = buildCap08S3DueObligationSetV1(plan);
    const phases: Cap08S3PhaseTraceV1[] = [];

    const initialHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    if (initialHandoff.next_logical_tick_time !== plan.logical_time) throw new Error("CAP08_S3_RESOLVE_NEXT_TICK_MISMATCH");
    phases.push({ phase: "resolve", status: "COMPLETE", canonical_write: "NONE", result: "PERSISTED_HANDOFF_RESOLVED" });

    let approvalPlan: Cap08S3ApprovalPlanCommitResultV1 | null = null;
    let receipt: Cap08S3ReceiptMaterializationResultV1 | null = null;
    if (obligation.commit_approval_plan_binding_at_e) {
      approvalPlan = await this.provider.commitApprovalPlanAtEvidencePhase({
        formal_run_id: input.formal_run_id,
        scope: input.scope,
        available_to_runtime_at: plan.logical_time,
      });
    }
    if (obligation.materialize_receipt_at_e) {
      receipt = await this.provider.materializeReceiptAtEvidencePhase({
        formal_run_id: input.formal_run_id,
        scope: input.scope,
        available_to_runtime_at: plan.logical_time,
      });
    }
    const frozenRecords = await this.evidence.freeze({ scope: input.scope, logical_time: plan.logical_time });
    const outcome = outcomeFvo10V1(frozenRecords);
    if (obligation.require_outcome_absence && outcome) throw new Error("CAP08_S3_T09_OUTCOME_PREMATURELY_VISIBLE");
    if (obligation.require_outcome_fvo10_identity && !outcome) throw new Error("CAP08_S3_T10_OUTCOME_FVO10_REQUIRED");
    phases.push({
      phase: "E",
      status: "COMPLETE",
      canonical_write: receipt ? "E_RECEIPT_EVIDENCE" : approvalPlan ? "E_APPROVAL_PLAN_EVIDENCE" : "NONE",
      result: [
        "BASE_REPLAY_EVIDENCE_FROZEN",
        ...(approvalPlan ? ["APPROVAL_ASSERTION_AND_PLAN_COMMITTED"] : []),
        ...(receipt ? ["EXECUTION_RECEIPT_MATERIALIZED"] : []),
        ...(obligation.require_outcome_absence ? ["OUTCOME_ABSENCE_CONFIRMED"] : []),
        ...(outcome ? ["OUTCOME_FVO10_EXACT_IDENTITY"] : []),
      ].join("+"),
    });

    let actionFeedbackCommit: Cap08S3ActionFeedbackCommitResultV1 | null = null;
    let actionFeedbackReadback: Cap05ActionFeedbackEnvelopeV1 | null = null;
    if (obligation.commit_action_feedback_at_h) {
      if (!receipt) throw new Error("CAP08_S3_H_RECEIPT_REQUIRED");
      actionFeedbackCommit = await this.provider.commitActionFeedbackAtH({
        scope: input.scope,
        receipt_ref: receipt.receipt.source_record_id,
        receipt_hash: receipt.receipt.source_record_hash,
      });
      actionFeedbackReadback = actionFeedbackCommit.action_feedback;
    } else if (obligation.require_action_feedback_readback_at_h) {
      actionFeedbackReadback = await this.provider.readActionFeedbackExact({ scope: input.scope });
    }
    phases.push({
      phase: "H",
      status: "COMPLETE",
      canonical_write: actionFeedbackCommit ? "H_ACTION_FEEDBACK" : "NONE",
      result: actionFeedbackCommit
        ? "ACTION_FEEDBACK_COMMITTED_BEFORE_A_SNAPSHOT"
        : actionFeedbackReadback
          ? "ACTION_FEEDBACK_EXACT_READBACK"
          : "S3_EMPTY_PROVIDER",
    });

    const aProvider = obligation.require_action_feedback_consumption_at_a
      ? await this.receiptTick.executeOneTick(input)
      : await this.normalTick.executeOneTick(input);
    if (aProvider.status === "BLOCKED_INSERTED" || aProvider.status === "EXISTING_BLOCKED_IDEMPOTENT_SUCCESS") {
      throw new Error("CAP08_S3_SUCCESSFUL_FORECAST_REQUIRED");
    }
    if (!aProvider.b_record) throw new Error("CAP08_S3_DEFERRED_B_CANDIDATE_REQUIRED");
    const forecast = memberV1(aProvider.a_record_set, "twin_forecast_run_v1");
    const state = memberV1(aProvider.a_record_set, "twin_state_estimate_v1");
    if (forecast.payload.status !== "COMPLETED" || !Array.isArray(forecast.payload.points) || forecast.payload.points.length !== 72) {
      throw new Error("CAP08_S3_A_SUCCESSFUL_72_POINT_FORECAST_REQUIRED");
    }
    let feedbackConsumed = false;
    if (obligation.require_action_feedback_consumption_at_a) {
      const receiptResult = aProvider as ExecuteCap05ReceiptConsumingTickResultV1;
      const selected = receiptResult.action_feedback_selection?.selected_action_feedback_refs ?? [];
      if (!actionFeedbackReadback || selected.length !== 1 || selected[0] !== actionFeedbackReadback.object_id) {
        throw new Error("CAP08_S3_T08_H_NOT_CONSUMED_BY_A");
      }
      feedbackConsumed = true;
    }
    phases.push({ phase: "A", status: "COMPLETE", canonical_write: "A_STATE_FORECAST", result: aProvider.status });

    const bFlush = await this.deferredScenario.flushScenarioSet(aProvider.b_record);
    const options = bFlush.record.scenario_set.payload.options;
    if (options.length !== 3 || options.some((option) => option.trajectory_points.length !== 72)) {
      throw new Error("CAP08_S3_B_THREE_OPTION_72_POINT_SCENARIO_REQUIRED");
    }
    phases.push({ phase: "B", status: "COMPLETE", canonical_write: "B_SCENARIO", result: bFlush.status });

    let decisionCommit: Cap08S3DecisionCommitResultV1 | null = null;
    if (obligation.resolve_decision_source_and_commit_at_g) {
      decisionCommit = await this.provider.commitDecisionAfterScenario({
        formal_run_id: input.formal_run_id,
        scope: input.scope,
        scenario_record: bFlush.record,
        decided_at: plan.logical_time,
      });
    }
    phases.push({
      phase: "G",
      status: "COMPLETE",
      canonical_write: decisionCommit ? "G_DECISION" : "NONE",
      result: decisionCommit ? "HUMAN_DECISION_COMMITTED_AFTER_SCENARIO" : "S3_EMPTY_PROVIDER",
    });
    phases.push({ phase: "C", status: "COMPLETE", canonical_write: "NONE", result: "S3_EMPTY_PROVIDER" });
    phases.push({ phase: "barrier", status: "COMPLETE", canonical_write: "NONE", result: "S3_TICK_OBLIGATIONS_COMPLETE" });

    if (JSON.stringify(phases.map((phase) => phase.phase)) !== JSON.stringify(CAP08_PHASE_ORDER_V1)) {
      throw new Error("CAP08_S3_PHASE_TRACE_ORDER_MISMATCH");
    }
    const coreBarrier = buildCap08S1TickBarrierV1({
      plan,
      completed_phases: phases.map((phase) => phase.phase),
      a_record_set_count: 1,
      posterior_state_count: state.object_type === "twin_state_estimate_v1" ? 1 : 0,
      successful_forecast_count: 1,
      forecast_point_count: forecast.payload.points.length,
      scenario_set_count: 1,
      scenario_option_count: options.length,
      scenario_point_count: scenarioPointCountV1(bFlush.record),
      action_feedback_count: 0,
      decision_count: 0,
      residual_count: 0,
    });
    const s3Barrier = buildCap08S3TickBarrierV1({
      plan,
      obligation,
      completed_phases: phases.map((phase) => phase.phase),
      a_record_set_count: 1,
      posterior_state_count: 1,
      successful_forecast_count: 1,
      forecast_point_count: forecast.payload.points.length,
      scenario_set_count: 1,
      scenario_option_count: options.length,
      scenario_point_count: scenarioPointCountV1(bFlush.record),
      decision_count: decisionCommit ? 1 : 0,
      approval_assertion_count: approvalPlan ? 1 : 0,
      approved_plan_count: approvalPlan ? 1 : 0,
      execution_receipt_count: receipt ? 1 : 0,
      action_feedback_count: actionFeedbackCommit ? 1 : 0,
      action_feedback_consumed_by_a: feedbackConsumed,
      outcome_fvo10_identity_count: outcome ? 1 : 0,
      residual_count: 0,
      recommendation_count: 0,
      ao_act_count: 0,
      dispatch_count: 0,
      model_activation_count: 0,
    });

    const nextHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    if (nextHandoff.next_logical_tick_time !== new Date(Date.parse(plan.logical_time) + 3_600_000).toISOString()) {
      throw new Error("CAP08_S3_NEXT_HANDOFF_TIME_MISMATCH");
    }
    return {
      status: insertedV1([
        aProvider.status,
        bFlush.status,
        decisionCommit?.persistence_status,
        approvalPlan?.approval_assertion_status,
        approvalPlan?.approved_plan_status,
        receipt?.persistence_status,
        actionFeedbackCommit?.persistence_status,
      ]) ? "INSERTED" : "EXISTING_IDEMPOTENT_SUCCESS",
      phase_plan: plan,
      s3_obligation: obligation,
      due_obligations: due,
      phase_trace: phases,
      a_record_set: aProvider.a_record_set,
      b_record: bFlush.record,
      a_provider_result: aProvider,
      b_flush_result: bFlush,
      decision: decisionCommit?.decision ?? null,
      approval_assertion: approvalPlan?.approval_assertion ?? null,
      approved_plan: approvalPlan?.approved_plan ?? null,
      receipt: receipt?.receipt ?? null,
      action_feedback: actionFeedbackReadback,
      action_feedback_consumed_by_a: feedbackConsumed,
      outcome_fvo10_record: outcome,
      core_barrier: coreBarrier,
      s3_barrier: s3Barrier,
      next_handoff: nextHandoff,
      evidence_source_load_count: this.evidence.getSourceLoadCount(),
    };
  }
}
