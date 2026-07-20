// Purpose: compose bounded canonical-visibility timeline and optional collection pages with fixed-root keyset continuation.
// Boundary: pure in-memory pagination over S2 snapshot-scoped validated items; no database access, offset pagination, unbounded output, or cursor key persistence.

import type {
  FieldTwinCollectionItemV1,
  FieldTwinCollectionKindV1,
  FieldTwinCollectionPageV1,
  FieldTwinScopeV1,
  FieldTwinTimelineEventV1,
} from "./contracts_v1.js";
import {
  buildEmptyCollectionFilterHashV1,
  buildScopeHashV1,
  buildTimelineFilterHashV1,
  createCursorPayloadV1,
  signFieldTwinCursorV1,
  validateCanonicalVisibilitySnapshotV1,
  type FieldTwinCursorPayloadV1,
  type FieldTwinTimelineCursorSortTupleV1,
} from "./cursor_contracts_v1.js";
import {
  buildCollectionItemsContentHashV1,
  buildCollectionPageContentHashV1,
  buildResponseInstanceHashV1,
  buildTimelineItemsContentHashV1,
  buildTimelinePageContentHashV1,
} from "./hash_contracts_v1.js";
import {
  FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1,
  FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1,
  assertCollectionKindForEndpointV1,
  assertTimelineEventRankV1,
  compareCollectionItemsV1,
  normalizeCollectionLimitV1,
  sortCollectionItemsV1,
  sortTimelineEventsAscendingV1,
} from "./ordering_v1.js";
import {
  assertScopeExactForComposerV1,
  canonicalInstantPlusSecondsV1,
  composerFailV1,
  type FieldTwinCursorSigningContextV1,
  type FieldTwinTimelinePageV1,
} from "./composer_contracts_v1.js";

export type TimelineComposerInputV1 = {
  request_scope: FieldTwinScopeV1;
  response_started_at: import("./contracts_v1.js").CanonicalUtcInstantV1;
  canonical_visibility_snapshot: import("./contracts_v1.js").FieldTwinCanonicalVisibilitySnapshotV1;
  fixed_root_ref: string;
  fixed_root_graph_content_hash: import("./contracts_v1.js").SemanticHashTextV1;
  filter: import("./contracts_v1.js").FieldTwinTimelineFilterV1;
  visible_events: readonly FieldTwinTimelineEventV1[];
  limit?: number;
  verified_cursor_payload?: FieldTwinCursorPayloadV1 | null;
  cursor_signing: FieldTwinCursorSigningContextV1;
};

export type CollectionPageComposerInputV1<T extends FieldTwinCollectionItemV1> = {
  endpoint_suffix: string;
  collection_kind: FieldTwinCollectionKindV1;
  request_scope: FieldTwinScopeV1;
  response_started_at: import("./contracts_v1.js").CanonicalUtcInstantV1;
  canonical_visibility_snapshot: import("./contracts_v1.js").FieldTwinCanonicalVisibilitySnapshotV1;
  fixed_root_ref: string;
  fixed_root_graph_content_hash: import("./contracts_v1.js").SemanticHashTextV1;
  visible_items: readonly T[];
  limit?: number;
  verified_cursor_payload?: FieldTwinCursorPayloadV1 | null;
  cursor_signing: FieldTwinCursorSigningContextV1;
};

function compareTextV1(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertFixedContextV1(input: {
  request_scope: FieldTwinScopeV1;
  canonical_visibility_snapshot: import("./contracts_v1.js").FieldTwinCanonicalVisibilitySnapshotV1;
  fixed_root_ref: string;
  fixed_root_graph_content_hash: import("./contracts_v1.js").SemanticHashTextV1;
}): void {
  for (const value of Object.values(input.request_scope)) if (!String(value || "")) composerFailV1("MCFT_SCOPE_INVALID");
  validateCanonicalVisibilitySnapshotV1(input.canonical_visibility_snapshot);
  if (!input.fixed_root_ref || !input.fixed_root_graph_content_hash.startsWith("sha256:")) composerFailV1("MCFT_FIXED_ROOT_INVALID");
}

function assertCursorCommonV1(input: {
  cursor: FieldTwinCursorPayloadV1;
  request_scope: FieldTwinScopeV1;
  filter_hash: import("./contracts_v1.js").SemanticHashTextV1;
  snapshot: import("./contracts_v1.js").FieldTwinCanonicalVisibilitySnapshotV1;
  fixed_root_ref: string;
  fixed_root_graph_content_hash: import("./contracts_v1.js").SemanticHashTextV1;
  page_limit: number;
}): void {
  const cursor = input.cursor;
  if (cursor.scope_hash !== buildScopeHashV1(input.request_scope)) composerFailV1("MCFT_CURSOR_SCOPE_MISMATCH");
  if (cursor.filter_hash !== input.filter_hash) composerFailV1("MCFT_CURSOR_FILTER_MISMATCH");
  if (cursor.canonical_visibility_snapshot.visibility_snapshot_hash !== input.snapshot.visibility_snapshot_hash) composerFailV1("MCFT_CURSOR_VISIBILITY_SNAPSHOT_INVALID");
  if (cursor.fixed_root_ref !== input.fixed_root_ref || cursor.fixed_root_graph_content_hash !== input.fixed_root_graph_content_hash) composerFailV1("MCFT_CURSOR_FIXED_ROOT_MISMATCH");
  if (cursor.page_limit !== input.page_limit) composerFailV1("MCFT_CURSOR_LIMIT_MISMATCH");
}

function timelineAfterBoundaryV1(event: FieldTwinTimelineEventV1, tuple: FieldTwinTimelineCursorSortTupleV1): boolean {
  return compareTextV1(event.logical_time, tuple.logical_time)
    || event.event_rank - tuple.event_rank
    || compareTextV1(event.object_ref, tuple.object_ref)
    ? (compareTextV1(event.logical_time, tuple.logical_time)
      || event.event_rank - tuple.event_rank
      || compareTextV1(event.object_ref, tuple.object_ref)) > 0
    : false;
}

function collectionAfterBoundaryV1(item: FieldTwinCollectionItemV1, cursor: FieldTwinCursorPayloadV1): boolean {
  if (cursor.last_sort_tuple.cursor_kind !== "OPTIONAL_COLLECTION") composerFailV1("MCFT_CURSOR_INVALID", "COLLECTION_BOUNDARY");
  const boundary: FieldTwinCollectionItemV1 = {
    object_ref: cursor.last_sort_tuple.object_ref,
    object_type: "cursor-boundary",
    object_hash: "sha256:cursor-boundary",
    logical_time: cursor.last_sort_tuple.logical_time,
    attachment_status: "ATTACHED_EXACT",
  };
  return compareCollectionItemsV1(item, boundary) > 0;
}

export class FieldTwinTimelineComposerV1 {
  compose(input: TimelineComposerInputV1): FieldTwinTimelinePageV1 {
    assertFixedContextV1(input);
    const pageLimit = normalizeCollectionLimitV1(input.limit);
    const filterHash = buildTimelineFilterHashV1(input.filter);
    const cursor = input.verified_cursor_payload ?? null;
    let cursorTuple: FieldTwinTimelineCursorSortTupleV1 | null = null;
    if (cursor) {
      assertCursorCommonV1({ cursor, request_scope: input.request_scope, filter_hash: filterHash, snapshot: input.canonical_visibility_snapshot, fixed_root_ref: input.fixed_root_ref, fixed_root_graph_content_hash: input.fixed_root_graph_content_hash, page_limit: pageLimit });
      if (cursor.cursor_kind !== "TIMELINE" || cursor.collection_kind !== null || cursor.sort_contract_id !== FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1 || cursor.last_sort_tuple.cursor_kind !== "TIMELINE") {
        composerFailV1("MCFT_CURSOR_INVALID", "TIMELINE_VARIANT");
      }
      cursorTuple = cursor.last_sort_tuple;
    }

    const eligible = input.visible_events.filter((event) => {
      assertScopeExactForComposerV1(event.scope, input.request_scope, "MCFT_TIMELINE_SCOPE_MISMATCH");
      assertTimelineEventRankV1(event);
      if (input.filter.from_logical_time && event.logical_time < input.filter.from_logical_time) return false;
      if (input.filter.until_logical_time && event.logical_time >= input.filter.until_logical_time) return false;
      return cursorTuple ? timelineAfterBoundaryV1(event, cursorTuple) : true;
    });
    const sorted = sortTimelineEventsAscendingV1(eligible);
    const hasMore = sorted.length > pageLimit;
    const items = Object.freeze(sorted.slice(0, pageLimit));
    const first = items[0] ?? null;
    const last = items[items.length - 1] ?? null;
    const itemsHash = buildTimelineItemsContentHashV1(items);
    const requestBoundary = cursor?.last_sort_tuple ?? null;
    const pageHash = buildTimelinePageContentHashV1({
      scope: input.request_scope,
      filter_hash: filterHash,
      canonical_visibility_snapshot_hash: input.canonical_visibility_snapshot.visibility_snapshot_hash,
      fixed_root_ref: input.fixed_root_ref,
      fixed_root_graph_content_hash: input.fixed_root_graph_content_hash,
      sort_direction: "ASC",
      page_limit: pageLimit,
      request_cursor_boundary: requestBoundary,
      timeline_items_content_hash: itemsHash,
      first_sort_tuple: first ? { logical_time: first.logical_time, event_rank: first.event_rank, object_ref: first.object_ref } : null,
      last_sort_tuple: last ? { logical_time: last.logical_time, event_rank: last.event_rank, object_ref: last.object_ref } : null,
      has_more: hasMore,
    });

    let nextCursor: import("./contracts_v1.js").CursorWireTextV1 | null = null;
    let nextDigest: import("./contracts_v1.js").SemanticHashTextV1 | null = null;
    if (hasMore) {
      if (!last) composerFailV1("MCFT_TIMELINE_CURSOR_BOUNDARY_MISSING");
      const payload = createCursorPayloadV1({
        cursor_kind: "TIMELINE",
        collection_kind: null,
        sort_contract_id: FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1,
        scope_hash: buildScopeHashV1(input.request_scope),
        filter_hash: filterHash,
        canonical_visibility_snapshot: input.canonical_visibility_snapshot,
        fixed_root_ref: input.fixed_root_ref,
        fixed_root_graph_content_hash: input.fixed_root_graph_content_hash,
        sort_direction: "ASC",
        last_sort_tuple: { cursor_kind: "TIMELINE", logical_time: last.logical_time, event_rank: last.event_rank, object_ref: last.object_ref },
        page_limit: pageLimit,
        issued_at: input.response_started_at,
        expires_at: canonicalInstantPlusSecondsV1(input.response_started_at, input.cursor_signing.ttl_seconds ?? 900),
      });
      const signed = signFieldTwinCursorV1(payload, input.cursor_signing.key_id, input.cursor_signing.key);
      nextCursor = signed.wire;
      nextDigest = signed.envelope_digest;
    }
    const responseHash = buildResponseInstanceHashV1({
      endpoint_id: "timeline",
      endpoint_version: "v1",
      scope: input.request_scope,
      response_started_at: input.response_started_at,
      request_filter_hash: filterHash,
      request_cursor_boundary: requestBoundary,
      canonical_visibility_snapshot_hash: input.canonical_visibility_snapshot.visibility_snapshot_hash,
      endpoint_content_hashes: { timeline_items_content_hash: itemsHash, timeline_page_content_hash: pageHash },
      next_cursor_envelope_digest: nextDigest,
    });
    return Object.freeze({
      schema_version: "field_twin_timeline_page_v1",
      canonical_visibility_snapshot: input.canonical_visibility_snapshot,
      fixed_root_ref: input.fixed_root_ref,
      fixed_root_graph_content_hash: input.fixed_root_graph_content_hash,
      items,
      page_limit: pageLimit,
      has_more: hasMore,
      next_cursor: nextCursor,
      timeline_items_content_hash: itemsHash,
      timeline_page_content_hash: pageHash,
      response_started_at: input.response_started_at,
      response_instance_hash: responseHash,
    });
  }
}

export class BoundedCollectionPageComposerV1 {
  compose<T extends FieldTwinCollectionItemV1>(input: CollectionPageComposerInputV1<T>): FieldTwinCollectionPageV1<T> {
    assertFixedContextV1(input);
    assertCollectionKindForEndpointV1(input.endpoint_suffix, input.collection_kind);
    const pageLimit = normalizeCollectionLimitV1(input.limit);
    const filterHash = buildEmptyCollectionFilterHashV1();
    const cursor = input.verified_cursor_payload ?? null;
    if (cursor) {
      assertCursorCommonV1({ cursor, request_scope: input.request_scope, filter_hash: filterHash, snapshot: input.canonical_visibility_snapshot, fixed_root_ref: input.fixed_root_ref, fixed_root_graph_content_hash: input.fixed_root_graph_content_hash, page_limit: pageLimit });
      if (cursor.cursor_kind !== "OPTIONAL_COLLECTION" || cursor.collection_kind !== input.collection_kind || cursor.sort_contract_id !== FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1) composerFailV1("MCFT_CURSOR_COLLECTION_KIND_MISMATCH");
    }
    const unique = new Set<string>();
    const eligible = input.visible_items.filter((item) => {
      if (unique.has(item.object_ref)) composerFailV1("MCFT_COLLECTION_DUPLICATE_OBJECT_REF", item.object_ref);
      unique.add(item.object_ref);
      if (item.attachment_status !== "ATTACHED_EXACT") composerFailV1("MCFT_COLLECTION_ITEM_NOT_EXACT", item.object_ref);
      return cursor ? collectionAfterBoundaryV1(item, cursor) : true;
    });
    const sorted = sortCollectionItemsV1(eligible);
    const hasMore = sorted.length > pageLimit;
    const items = Object.freeze(sorted.slice(0, pageLimit));
    const first = items[0] ?? null;
    const last = items[items.length - 1] ?? null;
    const itemsHash = buildCollectionItemsContentHashV1(input.collection_kind, items);
    const requestBoundary = cursor?.last_sort_tuple ?? null;
    const pageHash = buildCollectionPageContentHashV1({
      collection_items_content_hash: itemsHash,
      collection_kind: input.collection_kind,
      scope: input.request_scope,
      filter_hash: filterHash,
      canonical_visibility_snapshot_hash: input.canonical_visibility_snapshot.visibility_snapshot_hash,
      fixed_root_ref: input.fixed_root_ref,
      fixed_root_graph_content_hash: input.fixed_root_graph_content_hash,
      page_limit: pageLimit,
      request_cursor_boundary: requestBoundary,
      first_sort_tuple: first ? { logical_time: first.logical_time, object_ref: first.object_ref } : null,
      last_sort_tuple: last ? { logical_time: last.logical_time, object_ref: last.object_ref } : null,
      has_more: hasMore,
    });
    let nextCursor: import("./contracts_v1.js").CursorWireTextV1 | null = null;
    let nextDigest: import("./contracts_v1.js").SemanticHashTextV1 | null = null;
    if (hasMore) {
      if (!last) composerFailV1("MCFT_COLLECTION_CURSOR_BOUNDARY_MISSING");
      const payload = createCursorPayloadV1({
        cursor_kind: "OPTIONAL_COLLECTION",
        collection_kind: input.collection_kind,
        sort_contract_id: FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1,
        scope_hash: buildScopeHashV1(input.request_scope),
        filter_hash: filterHash,
        canonical_visibility_snapshot: input.canonical_visibility_snapshot,
        fixed_root_ref: input.fixed_root_ref,
        fixed_root_graph_content_hash: input.fixed_root_graph_content_hash,
        sort_direction: "DESC",
        last_sort_tuple: { cursor_kind: "OPTIONAL_COLLECTION", logical_time: last.logical_time, object_ref: last.object_ref },
        page_limit: pageLimit,
        issued_at: input.response_started_at,
        expires_at: canonicalInstantPlusSecondsV1(input.response_started_at, input.cursor_signing.ttl_seconds ?? 900),
      });
      const signed = signFieldTwinCursorV1(payload, input.cursor_signing.key_id, input.cursor_signing.key);
      nextCursor = signed.wire;
      nextDigest = signed.envelope_digest;
    }
    const responseHash = buildResponseInstanceHashV1({
      endpoint_id: input.endpoint_suffix,
      endpoint_version: "v1",
      scope: input.request_scope,
      response_started_at: input.response_started_at,
      request_filter_hash: filterHash,
      request_cursor_boundary: requestBoundary,
      canonical_visibility_snapshot_hash: input.canonical_visibility_snapshot.visibility_snapshot_hash,
      endpoint_content_hashes: { collection_items_content_hash: itemsHash, collection_page_content_hash: pageHash },
      next_cursor_envelope_digest: nextDigest,
    });
    return Object.freeze({
      schema_version: "field_twin_collection_page_v1",
      collection_kind: input.collection_kind,
      canonical_visibility_snapshot: input.canonical_visibility_snapshot,
      fixed_root_ref: input.fixed_root_ref,
      fixed_root_graph_content_hash: input.fixed_root_graph_content_hash,
      items,
      page_limit: pageLimit,
      has_more: hasMore,
      next_cursor: nextCursor,
      collection_items_content_hash: itemsHash,
      collection_page_content_hash: pageHash,
      response_started_at: input.response_started_at,
      response_instance_hash: responseHash,
    });
  }
}
