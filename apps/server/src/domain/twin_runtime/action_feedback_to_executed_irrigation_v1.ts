// apps/server/src/domain/twin_runtime/action_feedback_to_executed_irrigation_v1.ts
// Purpose: adapt one eligible canonical Action Feedback object into the existing ExecutedIrrigationCandidateV1 contract without changing irrigation aggregation semantics.
// Boundary: pure adapter and one-event guard only; no Evidence query, persistence, State tick, dispatch, spatial-overlap inference, clock, filesystem, or network.

import type { ExecutedIrrigationCandidateV1 } from "../soil_water/executed_irrigation_input_v1.js";
import {
  CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
  type Cap05ActionFeedbackEnvelopeV1,
  type Cap05SourceQualityV1,
  validateCap05ActionFeedbackV1,
} from "./feedback_canonical_contracts_v1.js";

export const CAP05_ACTION_FEEDBACK_ADAPTER_ID_V1 = "ACTION_FEEDBACK_TO_EXECUTED_IRRIGATION_CANDIDATE_V1" as const;
export const CAP05_SINGLE_EVENT_GUARD_POLICY_ID_V1 = "EXACTLY_ONE_ELIGIBLE_EXECUTION_EVENT_PER_TICK_V1" as const;

export type Cap05ActionFeedbackAdapterTraceV1 = {
  adapter_id: typeof CAP05_ACTION_FEEDBACK_ADAPTER_ID_V1;
  quality_mapping_policy_id: typeof CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1;
  source_action_feedback_ref: string;
  source_action_feedback_hash: string;
  source_execution_status: Cap05ActionFeedbackEnvelopeV1["payload"]["execution_status"];
  normalized_execution_status: "EXECUTED";
  source_validation_status: Cap05ActionFeedbackEnvelopeV1["payload"]["validation_status"];
  source_quality: Cap05ActionFeedbackEnvelopeV1["payload"]["source_quality"];
  normalized_source_quality: "USABLE" | "UNUSABLE";
  target_scope_equivalent_irrigation_mm: string;
};

export type Cap05ActionFeedbackAdapterResultV1 = {
  candidate: ExecutedIrrigationCandidateV1;
  trace: Cap05ActionFeedbackAdapterTraceV1;
};

export function mapCap05ActionFeedbackQualityV1(
  sourceQuality: Cap05SourceQualityV1,
): "USABLE" | "UNUSABLE" {
  return sourceQuality === "FAIL" ? "UNUSABLE" : "USABLE";
}

export function adaptCap05ActionFeedbackToExecutedIrrigationV1(
  feedback: Cap05ActionFeedbackEnvelopeV1,
): Cap05ActionFeedbackAdapterResultV1 {
  validateCap05ActionFeedbackV1(feedback);
  const payload = feedback.payload;
  if (payload.execution_status !== "EXECUTED" && payload.execution_status !== "PARTIALLY_EXECUTED") {
    throw new Error("CAP05_ACTION_FEEDBACK_EXECUTED_OR_PARTIAL_REQUIRED");
  }
  if (!payload.eligible_for_state_input) throw new Error("CAP05_ACTION_FEEDBACK_STATE_INPUT_INELIGIBLE");
  if (payload.validation_status !== "VALIDATED" && payload.validation_status !== "VALIDATED_WITH_LIMITATIONS") {
    throw new Error("CAP05_ACTION_FEEDBACK_VALIDATION_REQUIRED");
  }

  const normalizedQuality = mapCap05ActionFeedbackQualityV1(payload.source_quality);
  if (normalizedQuality === "UNUSABLE") throw new Error("CAP05_ACTION_FEEDBACK_QUALITY_UNUSABLE");
  const candidate: ExecutedIrrigationCandidateV1 = {
    binding_id: payload.binding_id,
    origin_source_id: payload.origin_source_id,
    scope: structuredClone(payload.target_scope),
    event_id: payload.event_id,
    source_record_id: payload.source_record_id,
    executed_at: payload.execution_end,
    ingested_at: payload.ingested_at,
    executed_amount_mm: payload.actual_amount_mm,
    coverage_fraction: payload.spatial_coverage_fraction,
    eligible_for_state_input: payload.eligible_for_state_input,
    source_quality: normalizedQuality,
    execution_status: "EXECUTED",
  };
  return {
    candidate,
    trace: {
      adapter_id: CAP05_ACTION_FEEDBACK_ADAPTER_ID_V1,
      quality_mapping_policy_id: CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
      source_action_feedback_ref: feedback.object_id,
      source_action_feedback_hash: feedback.determinism_hash,
      source_execution_status: payload.execution_status,
      normalized_execution_status: "EXECUTED",
      source_validation_status: payload.validation_status,
      source_quality: payload.source_quality,
      normalized_source_quality: normalizedQuality,
      target_scope_equivalent_irrigation_mm: payload.target_scope_equivalent_irrigation_mm,
    },
  };
}

export function requireSingleEligibleCap05ExecutionEventV1(
  results: readonly Cap05ActionFeedbackAdapterResultV1[],
): Cap05ActionFeedbackAdapterResultV1 {
  if (!Array.isArray(results)) throw new Error("CAP05_ACTION_FEEDBACK_ADAPTER_RESULTS_REQUIRED");
  if (results.length === 0) throw new Error("CAP05_ACTION_FEEDBACK_EVENT_REQUIRED");
  if (results.length > 1) throw new Error("CAP05_MULTIPLE_EXECUTION_EVENTS_FORBIDDEN_V1");
  return results[0];
}
