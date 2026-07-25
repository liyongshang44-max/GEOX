// apps/server/src/runtime/twin_runtime/action_feedback_tick_selector_v1.ts
// Purpose: select at most one canonical H Action Feedback object for one explicit hourly State Tick, adapt it to the existing executed-irrigation candidate, and preserve complete cutoff/exclusion/deduplication trace.
// Boundary: pure deterministic selection only; no database, persistence, State mutation, Forecast, Scenario, route, scheduler, wall clock, approval, dispatch, filesystem, environment or network authority.

import type { ExecutedIrrigationCandidateV1 } from "../../domain/soil_water/executed_irrigation_input_v1.js";
import {
  adaptCap05ActionFeedbackToExecutedIrrigationV1,
  type Cap05ActionFeedbackAdapterTraceV1,
} from "../../domain/twin_runtime/action_feedback_to_executed_irrigation_v1.js";
import {
  CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1,
  CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
  CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1,
  validateCap05ActionFeedbackV1,
  type Cap05ActionFeedbackEnvelopeV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";

export const CAP05_ACTION_FEEDBACK_TICK_SELECTOR_ID_V1 = "CANONICAL_H_ACTION_FEEDBACK_HOURLY_SELECTOR_V1" as const;
export const CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1 = "AVAILABLE_TO_RUNTIME_AT_LE_TARGET_LOGICAL_TIME_V1" as const;
export const CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1 = "NO_SHIFT_NO_AUTOMATIC_HISTORY_REWRITE_V1" as const;
export const CAP08_S3_ACTION_FEEDBACK_LATE_POLICY_ID_V1 = "DEFER_TO_FIRST_LEGAL_TICK_AFTER_AVAILABILITY_V1" as const;
export const CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1 = "OPEN_START_CLOSED_END_PT1H_V1" as const;
export const CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1 = "EXACTLY_ONE_ELIGIBLE_EXECUTION_EVENT_PER_TICK_V1" as const;
export const CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1 = "NOT_ESTABLISHED" as const;
export const CAP05_ACTION_FEEDBACK_AMOUNT_SEMANTICS_POLICY_ID_V1 = "COVERED_FOOTPRINT_AVERAGE_DEPTH_MM_V1" as const;
export const CAP05_ACTION_FEEDBACK_VOLUME_TO_DEPTH_POLICY_ID_V1 = "NOT_ESTABLISHED" as const;
export const CAP05_ACTION_FEEDBACK_ADAPTER_POLICY_ID_V1 = "ACTION_FEEDBACK_TO_EXECUTED_IRRIGATION_CANDIDATE_V1" as const;

export type Cap05ActionFeedbackLatePolicyIdV1 =
  | typeof CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1
  | typeof CAP08_S3_ACTION_FEEDBACK_LATE_POLICY_ID_V1;

export type Cap05ReceiptConsumingRuntimePolicyPayloadV1 = {
  action_feedback_state_input_policy_id: typeof CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1;
  action_feedback_quality_mapping_policy_id: typeof CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1;
  evidence_cutoff_policy_id: typeof CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1;
  late_receipt_policy_id: typeof CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1;
  execution_interval_policy_id: typeof CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1;
  multiple_execution_event_policy_id: typeof CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1;
  spatial_overlap_policy_id: typeof CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1;
  actual_amount_semantics_policy_id: typeof CAP05_ACTION_FEEDBACK_AMOUNT_SEMANTICS_POLICY_ID_V1;
  effective_irrigation_policy_id: typeof CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1;
  volume_to_depth_policy_id: typeof CAP05_ACTION_FEEDBACK_VOLUME_TO_DEPTH_POLICY_ID_V1;
  action_feedback_adapter_policy_id: typeof CAP05_ACTION_FEEDBACK_ADAPTER_POLICY_ID_V1;
};

export type Cap05ActionFeedbackTickDispositionV1 =
  | "SELECTED"
  | "DEDUPLICATED_IDENTICAL"
  | "EXCLUDED_SCOPE"
  | "EXCLUDED_FUTURE"
  | "EXCLUDED_LATE"
  | "EXCLUDED_OUTSIDE_WINDOW"
  | "EXCLUDED_INELIGIBLE";

export type Cap05ActionFeedbackTickTraceEntryV1 = {
  action_feedback_ref: string;
  action_feedback_hash: string;
  event_id: string;
  source_record_id: string;
  binding_id: string;
  origin_source_id: string;
  execution_end: string;
  available_to_runtime_at: string;
  semantic_event_identity: string;
  semantic_payload_hash: string;
  disposition: Cap05ActionFeedbackTickDispositionV1;
  reason_code: string | null;
};

export type Cap05ActionFeedbackTickSelectionTraceV1 = {
  selector_id: typeof CAP05_ACTION_FEEDBACK_TICK_SELECTOR_ID_V1;
  evidence_cutoff_policy_id: typeof CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1;
  late_policy_id: Cap05ActionFeedbackLatePolicyIdV1;
  interval_policy_id: typeof CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1;
  multiple_event_policy_id: typeof CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1;
  spatial_overlap_policy_id: typeof CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1;
  evidence_cutoff_time: string;
  window_start_exclusive: string;
  window_end_inclusive: string;
  candidate_count: number;
  selected_action_feedback_refs: string[];
  excluded_action_feedback_refs: string[];
  deduplicated_action_feedback_refs: string[];
  entries: Cap05ActionFeedbackTickTraceEntryV1[];
  semantic_digest: string;
};

export type Cap05ActionFeedbackTickSelectionV1 = {
  candidate: ExecutedIrrigationCandidateV1 | null;
  adapter_trace: Cap05ActionFeedbackAdapterTraceV1 | null;
  selected_feedback: Cap05ActionFeedbackEnvelopeV1 | null;
  trace: Cap05ActionFeedbackTickSelectionTraceV1;
};

type ClassifiedFeedbackV1 = {
  feedback: Cap05ActionFeedbackEnvelopeV1;
  entry: Cap05ActionFeedbackTickTraceEntryV1;
  candidate: ExecutedIrrigationCandidateV1 | null;
  adapter_trace: Cap05ActionFeedbackAdapterTraceV1 | null;
};

function requiredCanonicalIsoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function previousHourV1(logicalTime: string): string {
  return new Date(Date.parse(logicalTime) - 3_600_000).toISOString();
}

function previousTwoHoursV1(logicalTime: string): string {
  return new Date(Date.parse(logicalTime) - 7_200_000).toISOString();
}

function firstHourlyCutoffAtOrAfterV1(value: string): string {
  const parsed = Date.parse(value);
  const hour = 3_600_000;
  return new Date(Math.ceil(parsed / hour) * hour).toISOString();
}

function sameScopeV1(feedback: Cap05ActionFeedbackEnvelopeV1, scope: TwinScopeKeyV1): boolean {
  return feedback.tenant_id === scope.tenant_id
    && feedback.project_id === scope.project_id
    && feedback.group_id === scope.group_id
    && feedback.field_id === scope.field_id
    && feedback.season_id === scope.season_id
    && feedback.zone_id === scope.zone_id;
}

function exactPolicyV1(payload: Record<string, unknown>, field: keyof Cap05ReceiptConsumingRuntimePolicyPayloadV1, expected: string): void {
  if (payload[field] !== expected) throw new Error(`CAP05_RECEIPT_TICK_CONFIG_POLICY_MISMATCH:${field}`);
}

export function validateCap05ReceiptConsumingRuntimePoliciesV1(value: unknown): asserts value is Cap05ReceiptConsumingRuntimePolicyPayloadV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("CAP05_RECEIPT_TICK_RUNTIME_CONFIG_PAYLOAD_REQUIRED");
  const payload = value as Record<string, unknown>;
  exactPolicyV1(payload, "action_feedback_state_input_policy_id", CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1);
  exactPolicyV1(payload, "action_feedback_quality_mapping_policy_id", CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1);
  exactPolicyV1(payload, "evidence_cutoff_policy_id", CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1);
  exactPolicyV1(payload, "late_receipt_policy_id", CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1);
  exactPolicyV1(payload, "execution_interval_policy_id", CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1);
  exactPolicyV1(payload, "multiple_execution_event_policy_id", CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1);
  exactPolicyV1(payload, "spatial_overlap_policy_id", CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1);
  exactPolicyV1(payload, "actual_amount_semantics_policy_id", CAP05_ACTION_FEEDBACK_AMOUNT_SEMANTICS_POLICY_ID_V1);
  exactPolicyV1(payload, "effective_irrigation_policy_id", CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1);
  exactPolicyV1(payload, "volume_to_depth_policy_id", CAP05_ACTION_FEEDBACK_VOLUME_TO_DEPTH_POLICY_ID_V1);
  exactPolicyV1(payload, "action_feedback_adapter_policy_id", CAP05_ACTION_FEEDBACK_ADAPTER_POLICY_ID_V1);
}

function eventIdentityV1(feedback: Cap05ActionFeedbackEnvelopeV1): string {
  const payload = feedback.payload;
  return semanticHashV1({
    binding_id: payload.binding_id,
    origin_source_id: payload.origin_source_id,
    target_scope: payload.target_scope,
    event_id: payload.event_id,
    execution_end: payload.execution_end,
  });
}

function payloadHashV1(feedback: Cap05ActionFeedbackEnvelopeV1): string {
  const payload = feedback.payload;
  return semanticHashV1({
    execution_status: payload.execution_status,
    validation_status: payload.validation_status,
    source_quality: payload.source_quality,
    eligible_for_state_input: payload.eligible_for_state_input,
    actual_amount_mm: payload.actual_amount_mm,
    spatial_coverage_fraction: payload.spatial_coverage_fraction,
    target_scope_equivalent_irrigation_mm: payload.target_scope_equivalent_irrigation_mm,
    execution_start: payload.execution_start,
    execution_end: payload.execution_end,
    ingested_at: payload.ingested_at,
    available_to_runtime_at: payload.available_to_runtime_at,
  });
}

function baseEntryV1(feedback: Cap05ActionFeedbackEnvelopeV1): Cap05ActionFeedbackTickTraceEntryV1 {
  return {
    action_feedback_ref: feedback.object_id,
    action_feedback_hash: feedback.determinism_hash,
    event_id: feedback.payload.event_id,
    source_record_id: feedback.payload.source_record_id,
    binding_id: feedback.payload.binding_id,
    origin_source_id: feedback.payload.origin_source_id,
    execution_end: feedback.payload.execution_end,
    available_to_runtime_at: feedback.payload.available_to_runtime_at,
    semantic_event_identity: eventIdentityV1(feedback),
    semantic_payload_hash: payloadHashV1(feedback),
    disposition: "EXCLUDED_INELIGIBLE",
    reason_code: null,
  };
}

function adaptSelectedV1(
  feedback: Cap05ActionFeedbackEnvelopeV1,
  entry: Cap05ActionFeedbackTickTraceEntryV1,
  reasonCode: string | null,
): ClassifiedFeedbackV1 {
  try {
    const adapted = adaptCap05ActionFeedbackToExecutedIrrigationV1(feedback);
    return {
      feedback,
      entry: { ...entry, disposition: "SELECTED", reason_code: reasonCode },
      candidate: adapted.candidate,
      adapter_trace: adapted.trace,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "ACTION_FEEDBACK_INELIGIBLE";
    return { feedback, entry: { ...entry, disposition: "EXCLUDED_INELIGIBLE", reason_code: reason }, candidate: null, adapter_trace: null };
  }
}

function classifyV1(input: {
  feedback: Cap05ActionFeedbackEnvelopeV1;
  scope: TwinScopeKeyV1;
  logical_time: string;
  window_start: string;
  late_policy_id: Cap05ActionFeedbackLatePolicyIdV1;
}): ClassifiedFeedbackV1 {
  validateCap05ActionFeedbackV1(input.feedback);
  const feedback = input.feedback;
  const entry = baseEntryV1(feedback);
  const executionEnd = requiredCanonicalIsoV1(feedback.payload.execution_end, "CAP05_RECEIPT_TICK_EXECUTION_END_INVALID");
  const availableAt = requiredCanonicalIsoV1(feedback.payload.available_to_runtime_at, "CAP05_RECEIPT_TICK_AVAILABLE_AT_INVALID");
  const ingestedAt = requiredCanonicalIsoV1(feedback.payload.ingested_at, "CAP05_RECEIPT_TICK_INGESTED_AT_INVALID");
  if (feedback.logical_time !== executionEnd) throw new Error("CAP05_RECEIPT_TICK_LOGICAL_TIME_EXECUTION_END_MISMATCH");
  if (feedback.as_of !== availableAt) throw new Error("CAP05_RECEIPT_TICK_AS_OF_AVAILABLE_AT_MISMATCH");

  if (!sameScopeV1(feedback, input.scope)) {
    return { feedback, entry: { ...entry, disposition: "EXCLUDED_SCOPE", reason_code: "ACTION_FEEDBACK_SCOPE_MISMATCH" }, candidate: null, adapter_trace: null };
  }
  if (executionEnd > input.logical_time) {
    return { feedback, entry: { ...entry, disposition: "EXCLUDED_FUTURE", reason_code: "FUTURE_ACTION_FEEDBACK_FORBIDDEN" }, candidate: null, adapter_trace: null };
  }
  if (executionEnd <= input.window_start) {
    const deferredFirstLegal = input.late_policy_id === CAP08_S3_ACTION_FEEDBACK_LATE_POLICY_ID_V1
      && availableAt <= input.logical_time
      && ingestedAt <= input.logical_time
      && firstHourlyCutoffAtOrAfterV1(availableAt) === input.logical_time
      && executionEnd > previousTwoHoursV1(input.logical_time);
    if (deferredFirstLegal) {
      return adaptSelectedV1(feedback, entry, "DEFERRED_TO_FIRST_LEGAL_TICK_AFTER_AVAILABILITY");
    }
    return { feedback, entry: { ...entry, disposition: "EXCLUDED_OUTSIDE_WINDOW", reason_code: "OUTSIDE_OPEN_START_CLOSED_END_WINDOW" }, candidate: null, adapter_trace: null };
  }
  if (availableAt > input.logical_time || ingestedAt > input.logical_time) {
    return { feedback, entry: { ...entry, disposition: "EXCLUDED_LATE", reason_code: "ACTION_FEEDBACK_NOT_AVAILABLE_AT_TICK_CUTOFF" }, candidate: null, adapter_trace: null };
  }
  return adaptSelectedV1(feedback, entry, null);
}

function traceDigestV1(value: Omit<Cap05ActionFeedbackTickSelectionTraceV1, "semantic_digest">): string {
  return semanticHashV1(value);
}

export function selectCap05ActionFeedbackForTickV1(input: {
  scope: TwinScopeKeyV1;
  logical_time: string;
  feedback_objects: readonly Cap05ActionFeedbackEnvelopeV1[];
  late_policy_id?: Cap05ActionFeedbackLatePolicyIdV1;
}): Cap05ActionFeedbackTickSelectionV1 {
  const logicalTime = requiredCanonicalIsoV1(input.logical_time, "CAP05_RECEIPT_TICK_LOGICAL_TIME_INVALID");
  if (!logicalTime.endsWith(":00:00.000Z")) throw new Error("CAP05_RECEIPT_TICK_LOGICAL_TIME_MUST_BE_HOURLY");
  if (!Array.isArray(input.feedback_objects)) throw new Error("CAP05_RECEIPT_TICK_FEEDBACK_ARRAY_REQUIRED");
  const latePolicyId = input.late_policy_id ?? CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1;
  const windowStart = previousHourV1(logicalTime);
  const classified = input.feedback_objects.map((feedback) => classifyV1({
    feedback,
    scope: input.scope,
    logical_time: logicalTime,
    window_start: windowStart,
    late_policy_id: latePolicyId,
  }));
  const eligible = classified.filter((item) => item.candidate !== null);
  const groups = new Map<string, ClassifiedFeedbackV1[]>();
  for (const item of eligible) {
    const group = groups.get(item.entry.semantic_event_identity) ?? [];
    group.push(item);
    groups.set(item.entry.semantic_event_identity, group);
  }

  const winners: ClassifiedFeedbackV1[] = [];
  const duplicateRefs: string[] = [];
  for (const [identity, group] of groups) {
    const payloadHashes = new Set(group.map((item) => item.entry.semantic_payload_hash));
    if (payloadHashes.size > 1) throw new Error(`CAP05_RECEIPT_TICK_CONFLICTING_DUPLICATE:${identity}`);
    const ordered = [...group].sort((left, right) => {
      const availability = right.feedback.as_of.localeCompare(left.feedback.as_of);
      if (availability !== 0) return availability;
      return left.feedback.object_id.localeCompare(right.feedback.object_id);
    });
    winners.push(ordered[0]);
    for (const duplicate of ordered.slice(1)) {
      duplicateRefs.push(duplicate.feedback.object_id);
      duplicate.entry = { ...duplicate.entry, disposition: "DEDUPLICATED_IDENTICAL", reason_code: "IDENTICAL_ACTION_FEEDBACK_DEDUPLICATED" };
    }
  }

  if (winners.length > 1) throw new Error("CAP05_MULTIPLE_ACTION_FEEDBACK_EVENTS_FOR_TICK");
  const selected = winners[0] ?? null;
  const entries = classified
    .map((item) => item.entry)
    .sort((left, right) => left.execution_end.localeCompare(right.execution_end)
      || left.available_to_runtime_at.localeCompare(right.available_to_runtime_at)
      || left.action_feedback_ref.localeCompare(right.action_feedback_ref));
  const selectedRefs = selected ? [selected.feedback.object_id] : [];
  const excludedRefs = entries
    .filter((entry) => entry.disposition.startsWith("EXCLUDED_"))
    .map((entry) => entry.action_feedback_ref)
    .sort();
  const deduplicatedRefs = [...new Set(duplicateRefs)].sort();
  const traceWithoutDigest: Omit<Cap05ActionFeedbackTickSelectionTraceV1, "semantic_digest"> = {
    selector_id: CAP05_ACTION_FEEDBACK_TICK_SELECTOR_ID_V1,
    evidence_cutoff_policy_id: CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1,
    late_policy_id: latePolicyId,
    interval_policy_id: CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1,
    multiple_event_policy_id: CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1,
    spatial_overlap_policy_id: CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1,
    evidence_cutoff_time: logicalTime,
    window_start_exclusive: windowStart,
    window_end_inclusive: logicalTime,
    candidate_count: input.feedback_objects.length,
    selected_action_feedback_refs: selectedRefs,
    excluded_action_feedback_refs: excludedRefs,
    deduplicated_action_feedback_refs: deduplicatedRefs,
    entries,
  };
  return {
    candidate: selected?.candidate ?? null,
    adapter_trace: selected?.adapter_trace ?? null,
    selected_feedback: selected?.feedback ? structuredClone(selected.feedback) : null,
    trace: { ...traceWithoutDigest, semantic_digest: traceDigestV1(traceWithoutDigest) },
  };
}
