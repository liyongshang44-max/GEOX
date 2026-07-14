// apps/server/src/domain/twin_runtime/feedback_cycle_projection_v1.ts
// Purpose: define the rebuildable MCFT-CAP-05 feedback-cycle read model with explicit Decision, Approval, Dispatch, Execution, Observation, Residual, Assimilation and Updated State phases.
// Boundary: pure projection construction only; not canonical truth, no persistence, no authority exercise, no causal attribution, no clock, filesystem, environment, or network.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import type { Cap05ActionFeedbackEnvelopeV1, Cap05DecisionEnvelopeV1, Cap05DispatchDispositionV1 } from "./feedback_canonical_contracts_v1.js";
import type { Cap05ForecastResidualEnvelopeV1 } from "./forecast_observation_residual_v1.js";

export const CAP05_FEEDBACK_CYCLE_PROJECTION_SCHEMA_V1 = "geox_mcft_cap_05_feedback_cycle_projection_v1" as const;

export type Cap05FeedbackCycleProjectionInputV1 = {
  decision: Cap05DecisionEnvelopeV1;
  approval_assertion_ref: string;
  approval_assertion_hash: string;
  approved_plan_ref: string;
  approved_plan_hash: string;
  dispatch_disposition: Cap05DispatchDispositionV1;
  dispatch_evidence_ref: string | null;
  dispatch_evidence_hash: string | null;
  action_feedback: Cap05ActionFeedbackEnvelopeV1;
  outcome_observation_ref: string;
  outcome_observation_hash: string;
  forecast_residual: Cap05ForecastResidualEnvelopeV1;
  assimilation_update_ref: string;
  assimilation_update_hash: string;
  updated_state_ref: string;
  updated_state_hash: string;
};

export type Cap05FeedbackCycleProjectionV1 = {
  schema_version: typeof CAP05_FEEDBACK_CYCLE_PROJECTION_SCHEMA_V1;
  projection_id: string;
  projection_hash: string;
  decision: { ref: string; hash: string; selected_option_ref: string; selected_option_hash: string };
  approval: { assertion_ref: string; assertion_hash: string; plan_ref: string; plan_hash: string };
  dispatch: { disposition: Cap05DispatchDispositionV1; evidence_ref: string | null; evidence_hash: string | null };
  execution: { action_feedback_ref: string; action_feedback_hash: string; status: string; actual_amount_mm: string; coverage_fraction: string; target_scope_equivalent_irrigation_mm: string };
  outcome_observation: { ref: string; hash: string };
  forecast_residual: { ref: string; hash: string; residual_value: string; normalized_residual: string | null };
  assimilation: { ref: string; hash: string };
  updated_state: { ref: string; hash: string };
  limitations: string[];
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

export function buildCap05FeedbackCycleProjectionV1(
  input: Cap05FeedbackCycleProjectionInputV1,
): Cap05FeedbackCycleProjectionV1 {
  if (input.dispatch_disposition === "EXTERNALLY_RECORDED") {
    requiredStringV1(input.dispatch_evidence_ref, "CAP05_CYCLE_DISPATCH_REF_REQUIRED");
    requiredStringV1(input.dispatch_evidence_hash, "CAP05_CYCLE_DISPATCH_HASH_REQUIRED");
  } else if (input.dispatch_evidence_ref !== null || input.dispatch_evidence_hash !== null) {
    throw new Error("CAP05_CYCLE_DISPATCH_EVIDENCE_FORBIDDEN_WITHOUT_EXTERNAL_RECORD");
  }
  if (input.action_feedback.payload.decision_ref !== input.decision.object_id || input.action_feedback.payload.decision_hash !== input.decision.determinism_hash) {
    throw new Error("CAP05_CYCLE_DECISION_ACTION_FEEDBACK_LINK_MISMATCH");
  }
  if (input.action_feedback.payload.approved_plan_evidence_ref !== input.approved_plan_ref || input.action_feedback.payload.approved_plan_evidence_hash !== input.approved_plan_hash) {
    throw new Error("CAP05_CYCLE_PLAN_ACTION_FEEDBACK_LINK_MISMATCH");
  }
  if (input.forecast_residual.payload.actual_observation_ref !== input.outcome_observation_ref || input.forecast_residual.payload.actual_observation_hash !== input.outcome_observation_hash) {
    throw new Error("CAP05_CYCLE_OBSERVATION_RESIDUAL_LINK_MISMATCH");
  }
  if (input.forecast_residual.payload.assimilation_update_ref !== input.assimilation_update_ref || input.forecast_residual.payload.assimilation_update_hash !== input.assimilation_update_hash) {
    throw new Error("CAP05_CYCLE_RESIDUAL_ASSIMILATION_LINK_MISMATCH");
  }
  const semantic = {
    schema_version: CAP05_FEEDBACK_CYCLE_PROJECTION_SCHEMA_V1,
    decision: {
      ref: input.decision.object_id,
      hash: input.decision.determinism_hash,
      selected_option_ref: input.decision.payload.selected_option_ref,
      selected_option_hash: input.decision.payload.selected_option_hash,
    },
    approval: {
      assertion_ref: requiredStringV1(input.approval_assertion_ref, "CAP05_CYCLE_APPROVAL_ASSERTION_REF_REQUIRED"),
      assertion_hash: requiredStringV1(input.approval_assertion_hash, "CAP05_CYCLE_APPROVAL_ASSERTION_HASH_REQUIRED"),
      plan_ref: requiredStringV1(input.approved_plan_ref, "CAP05_CYCLE_PLAN_REF_REQUIRED"),
      plan_hash: requiredStringV1(input.approved_plan_hash, "CAP05_CYCLE_PLAN_HASH_REQUIRED"),
    },
    dispatch: {
      disposition: input.dispatch_disposition,
      evidence_ref: input.dispatch_evidence_ref,
      evidence_hash: input.dispatch_evidence_hash,
    },
    execution: {
      action_feedback_ref: input.action_feedback.object_id,
      action_feedback_hash: input.action_feedback.determinism_hash,
      status: input.action_feedback.payload.execution_status,
      actual_amount_mm: input.action_feedback.payload.actual_amount_mm,
      coverage_fraction: input.action_feedback.payload.spatial_coverage_fraction,
      target_scope_equivalent_irrigation_mm: input.action_feedback.payload.target_scope_equivalent_irrigation_mm,
    },
    outcome_observation: {
      ref: input.outcome_observation_ref,
      hash: input.outcome_observation_hash,
    },
    forecast_residual: {
      ref: input.forecast_residual.object_id,
      hash: input.forecast_residual.determinism_hash,
      residual_value: input.forecast_residual.payload.residual_value,
      normalized_residual: input.forecast_residual.payload.normalized_residual,
    },
    assimilation: {
      ref: requiredStringV1(input.assimilation_update_ref, "CAP05_CYCLE_ASSIMILATION_REF_REQUIRED"),
      hash: requiredStringV1(input.assimilation_update_hash, "CAP05_CYCLE_ASSIMILATION_HASH_REQUIRED"),
    },
    updated_state: {
      ref: requiredStringV1(input.updated_state_ref, "CAP05_CYCLE_UPDATED_STATE_REF_REQUIRED"),
      hash: requiredStringV1(input.updated_state_hash, "CAP05_CYCLE_UPDATED_STATE_HASH_REQUIRED"),
    },
    limitations: ["REBUILDABLE_PROJECTION_ONLY", "NOT_CANONICAL_TRUTH", "NO_CAUSAL_EFFECT_ATTRIBUTION", "NO_ACTION_EFFECTIVENESS_CLAIM"],
  };
  const projectionHash = semanticHashV1(semantic);
  return {
    ...semantic,
    projection_id: `feedback_cycle_${projectionHash.slice(0, 24)}`,
    projection_hash: projectionHash,
  };
}
