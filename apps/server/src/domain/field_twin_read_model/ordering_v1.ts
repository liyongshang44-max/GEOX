// apps/server/src/domain/field_twin_read_model/ordering_v1.ts
// Purpose: freeze deterministic MCFT-CAP-07 S1 ordering and endpoint/collection mapping.
// Boundary: pure comparison and validation logic only.

import {
  FIELD_TWIN_COLLECTION_KINDS_V1,
  FIELD_TWIN_TIMELINE_EVENT_KINDS_V1,
  type FieldTwinCollectionItemV1,
  type FieldTwinCollectionKindV1,
  type FieldTwinEvidenceRefV1,
  type FieldTwinLimitationV1,
  type FieldTwinTimelineEventKindV1,
  type FieldTwinTimelineEventV1,
  type FieldTwinTraceEdgeV1,
  type FieldTwinTraceNodeV1,
  type Xid8TextV1,
} from "./contracts_v1.js";

export const FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1 = "LOGICAL_TIME_EVENT_RANK_OBJECT_REF_ASC_V1" as const;
export const FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1 = "LOGICAL_TIME_DESC_OBJECT_REF_ASC_V1" as const;
export const FIELD_TWIN_TRACE_NODE_SORT_CONTRACT_ID_V1 = "OBJECT_TYPE_OBJECT_REF_ASC_V1" as const;
export const FIELD_TWIN_TRACE_EDGE_SORT_CONTRACT_ID_V1 = "EDGE_KIND_FROM_REF_TO_REF_ASC_V1" as const;

export const FIELD_TWIN_TIMELINE_EVENT_RANKS_V1: Readonly<Record<FieldTwinTimelineEventKindV1, number>> = Object.freeze({
  EVIDENCE_WINDOW: 10,
  STATE_TRANSITION: 20,
  ASSIMILATION_UPDATE: 30,
  POSTERIOR_STATE: 40,
  FORECAST_RESULT: 50,
  FORECAST_FAILURE: 60,
  RUNTIME_TICK: 70,
  CHECKPOINT: 80,
  RUNTIME_HEALTH: 90,
  SCENARIO_SET: 100,
  HUMAN_DECISION: 110,
  APPROVED_PLAN_EVIDENCE: 120,
  ACTION_FEEDBACK: 130,
  FORECAST_RESIDUAL: 140,
  CALIBRATION_CANDIDATE: 150,
  SHADOW_EVALUATION: 160,
  MODEL_ACTIVATION: 170,
});

export const FIELD_TWIN_COLLECTION_ENDPOINT_MAPPING_V1: Readonly<Record<string, readonly FieldTwinCollectionKindV1[]>> = Object.freeze({
  "/states": ["STATE"],
  "/forecasts": ["FORECAST"],
  "/scenarios": ["SCENARIO"],
  "/action-lifecycle": ["ACTION_FEEDBACK"],
  "/residuals": ["FORECAST_RESIDUAL"],
  "/model-governance": ["CALIBRATION_CANDIDATE", "SHADOW_EVALUATION", "MODEL_ACTIVATION"],
});

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function assertTimelineEventRankV1(event: Pick<FieldTwinTimelineEventV1, "event_kind" | "event_rank">): void {
  if (!FIELD_TWIN_TIMELINE_EVENT_KINDS_V1.includes(event.event_kind)) throw new Error("MCFT_TIMELINE_EVENT_KIND_INVALID");
  if (event.event_rank !== FIELD_TWIN_TIMELINE_EVENT_RANKS_V1[event.event_kind]) throw new Error("MCFT_TIMELINE_EVENT_RANK_INVALID");
}

export function compareTimelineEventsAscendingV1(left: FieldTwinTimelineEventV1, right: FieldTwinTimelineEventV1): number {
  assertTimelineEventRankV1(left);
  assertTimelineEventRankV1(right);
  return compareText(left.logical_time, right.logical_time)
    || left.event_rank - right.event_rank
    || compareText(left.object_ref, right.object_ref);
}

export function sortTimelineEventsAscendingV1(events: readonly FieldTwinTimelineEventV1[]): FieldTwinTimelineEventV1[] {
  return [...events].sort(compareTimelineEventsAscendingV1);
}

export function compareCollectionItemsV1(left: FieldTwinCollectionItemV1, right: FieldTwinCollectionItemV1): number {
  return compareText(right.logical_time, left.logical_time) || compareText(left.object_ref, right.object_ref);
}

export function sortCollectionItemsV1<T extends FieldTwinCollectionItemV1>(items: readonly T[]): T[] {
  return [...items].sort(compareCollectionItemsV1);
}

export function sortTraceNodesV1(nodes: readonly FieldTwinTraceNodeV1[]): FieldTwinTraceNodeV1[] {
  return [...nodes].sort((left, right) => compareText(left.object_type, right.object_type) || compareText(left.object_ref, right.object_ref));
}

export function sortTraceEdgesV1(edges: readonly FieldTwinTraceEdgeV1[]): FieldTwinTraceEdgeV1[] {
  return [...edges].sort((left, right) => compareText(left.edge_kind, right.edge_kind) || compareText(left.from_ref, right.from_ref) || compareText(left.to_ref, right.to_ref));
}

export function sortEvidenceRefsV1(refs: readonly FieldTwinEvidenceRefV1[]): FieldTwinEvidenceRefV1[] {
  return [...refs].sort((left, right) => compareText(left.ref_type, right.ref_type) || compareText(left.ref_value, right.ref_value));
}

export function sortLimitationsV1(limitations: readonly FieldTwinLimitationV1[]): FieldTwinLimitationV1[] {
  return [...limitations].sort((left, right) => compareText(left.reason_code, right.reason_code) || compareText(left.object_ref ?? "", right.object_ref ?? ""));
}

export function sortXid8TextNumericAscendingV1(values: readonly Xid8TextV1[]): Xid8TextV1[] {
  return [...values].sort((left, right) => {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);
    return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
  });
}

export function assertCollectionKindForEndpointV1(endpointSuffix: string, collectionKind: FieldTwinCollectionKindV1): void {
  if (!FIELD_TWIN_COLLECTION_KINDS_V1.includes(collectionKind)) throw new Error("MCFT_COLLECTION_KIND_INVALID");
  const allowed = FIELD_TWIN_COLLECTION_ENDPOINT_MAPPING_V1[endpointSuffix];
  if (!allowed || !allowed.includes(collectionKind)) throw new Error("MCFT_COLLECTION_KIND_INVALID");
}

export function normalizeCollectionLimitV1(value: number | null | undefined): number {
  const resolved = value ?? 50;
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > 200) throw new Error("MCFT_COLLECTION_LIMIT_INVALID");
  return resolved;
}
