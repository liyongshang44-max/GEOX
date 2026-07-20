// apps/server/src/domain/field_twin_read_model/hash_contracts_v1.ts
// Purpose: freeze deterministic MCFT-CAP-07 S1 content-hash and response-instance-hash builders.
// Boundary: pure canonical hashing only; no persistence, clock, environment, filesystem, network, or random input generation.

import { semanticHashV1 } from "../twin_runtime/canonical_json_v1.js";
import {
  FIELD_TWIN_COLLECTION_CONTRACT_VERSION_V1,
  FIELD_TWIN_EVENT_TAXONOMY_VERSION_V1,
  FIELD_TWIN_READ_MODEL_VERSION_V1,
  type CanonicalUtcInstantV1,
  type FieldTwinCanonicalObjectRefV1,
  type FieldTwinCollectionItemV1,
  type FieldTwinCollectionKindV1,
  type FieldTwinLimitationV1,
  type FieldTwinRecordSetValidationV1,
  type FieldTwinRuntimeHealthRoleResolutionV1,
  type FieldTwinScopeV1,
  type FieldTwinSourceValidationResultV1,
  type FieldTwinTimelineEventV1,
  type FieldTwinTraceEdgeV1,
  type FieldTwinTraceNodeV1,
  type SemanticHashTextV1,
} from "./contracts_v1.js";
import {
  FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1,
  FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1,
  sortCollectionItemsV1,
  sortEvidenceRefsV1,
  sortLimitationsV1,
  sortTimelineEventsAscendingV1,
  sortTraceEdgesV1,
  sortTraceNodesV1,
} from "./ordering_v1.js";

export const FIELD_TWIN_GLOBAL_CONTENT_HASH_EXCLUSIONS_V1 = Object.freeze([
  "fact_id",
  "generated_at",
  "rebuilt_at",
  "persisted_at",
  "db_physical_row_order",
  "request_id",
  "server_instance_id",
  "transaction_id",
  "latency",
  "response_started_at",
  "root_graph_content_hash",
  "attachment_content_hash",
  "health_content_hash",
  "timeline_items_content_hash",
  "timeline_page_content_hash",
  "collection_items_content_hash",
  "collection_page_content_hash",
  "trace_graph_content_hash",
  "response_instance_hash",
  "cursor_auth_tag",
  "next_cursor",
] as const);

export const FIELD_TWIN_HASH_CONTRACT_REGISTRY_V1 = Object.freeze({
  root_graph_content_hash: {
    included_semantic_paths: ["read_model_version", "scope", "root_graph_status", "mandatory_objects", "record_set_validation", "terminal_record_set_health", "current_tick_forecast_result", "active_lineage_authority_validation", "source_profile_version"],
    excluded_semantic_paths: ["latest_successful_forecast", "scenario_source_forecast", "latest_scenario_in_scope", "optional_collection_item_payloads", "latest_operational_runtime_health", ...FIELD_TWIN_GLOBAL_CONTENT_HASH_EXCLUSIONS_V1],
    stable_sort_contract: "OBJECT_TYPE_OBJECT_REF_ASC_V1",
    null_contract: "EXPLICIT_NULL",
    self_hash_exclusion: true,
    derived_hash_exclusion: true,
  },
  attachment_content_hash: {
    included_semantic_paths: ["latest_successful_forecast", "scenario_source_forecast", "current_scenario_attachment", "latest_scenario_in_scope", "optional_domain_summaries", "limitations"],
    excluded_semantic_paths: ["latest_operational_runtime_health", ...FIELD_TWIN_GLOBAL_CONTENT_HASH_EXCLUSIONS_V1],
    stable_sort_contract: "COLLECTION_KIND_ASC_V1",
    null_contract: "EXPLICIT_NULL",
    self_hash_exclusion: true,
    derived_hash_exclusion: true,
  },
  health_content_hash: {
    included_semantic_paths: ["terminal_record_set_health", "latest_operational_runtime_health", "health_relationship", "health_role_resolutions", "health_pointer_validation_summary"],
    excluded_semantic_paths: FIELD_TWIN_GLOBAL_CONTENT_HASH_EXCLUSIONS_V1,
    stable_sort_contract: "HEALTH_OBJECT_REF_ASC_V1",
    null_contract: "EXPLICIT_NULL",
    self_hash_exclusion: true,
    derived_hash_exclusion: true,
  },
  timeline_items_content_hash: {
    included_semantic_paths: ["event_semantic_payloads", "event_taxonomy_version"],
    excluded_semantic_paths: ["canonical_visibility_snapshot", "fixed_root", "scope", "filter", "limit", "cursor_boundary", ...FIELD_TWIN_GLOBAL_CONTENT_HASH_EXCLUSIONS_V1],
    stable_sort_contract: FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1,
    null_contract: "EXPLICIT_NULL",
    self_hash_exclusion: true,
    derived_hash_exclusion: true,
  },
  timeline_page_content_hash: {
    included_semantic_paths: ["read_model_version", "scope", "filter_hash", "canonical_visibility_snapshot_hash", "fixed_root_ref", "fixed_root_graph_content_hash", "sort_direction", "page_limit", "request_cursor_boundary", "timeline_items_content_hash", "first_sort_tuple", "last_sort_tuple", "has_more", "ordering_version"],
    excluded_semantic_paths: FIELD_TWIN_GLOBAL_CONTENT_HASH_EXCLUSIONS_V1,
    stable_sort_contract: FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1,
    null_contract: "EXPLICIT_NULL",
    self_hash_exclusion: true,
    derived_hash_exclusion: true,
  },
  collection_items_content_hash: {
    included_semantic_paths: ["collection_kind", "item_semantic_identities", "collection_contract_version"],
    excluded_semantic_paths: FIELD_TWIN_GLOBAL_CONTENT_HASH_EXCLUSIONS_V1,
    stable_sort_contract: FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1,
    null_contract: "EXPLICIT_NULL",
    self_hash_exclusion: true,
    derived_hash_exclusion: true,
  },
  collection_page_content_hash: {
    included_semantic_paths: ["collection_items_content_hash", "collection_kind", "scope", "filter_hash", "canonical_visibility_snapshot_hash", "fixed_root_ref", "fixed_root_graph_content_hash", "page_limit", "request_cursor_boundary", "first_sort_tuple", "last_sort_tuple", "has_more", "sort_contract_id"],
    excluded_semantic_paths: FIELD_TWIN_GLOBAL_CONTENT_HASH_EXCLUSIONS_V1,
    stable_sort_contract: FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1,
    null_contract: "EXPLICIT_NULL",
    self_hash_exclusion: true,
    derived_hash_exclusion: true,
  },
  trace_graph_content_hash: {
    included_semantic_paths: ["scope", "nodes", "edges", "unattached_objects", "missing_diagnostics", "record_set_validation", "health_role_resolutions", "active_lineage_authority_validation"],
    excluded_semantic_paths: FIELD_TWIN_GLOBAL_CONTENT_HASH_EXCLUSIONS_V1,
    stable_sort_contract: "TRACE_NODE_AND_EDGE_CONTRACTS_V1",
    null_contract: "EXPLICIT_NULL",
    self_hash_exclusion: true,
    derived_hash_exclusion: true,
  },
});

function hash(value: unknown): SemanticHashTextV1 {
  return semanticHashV1(value) as SemanticHashTextV1;
}

function sortCanonicalRefs(refs: readonly FieldTwinCanonicalObjectRefV1[]): FieldTwinCanonicalObjectRefV1[] {
  return [...refs].sort((left, right) => left.object_type < right.object_type ? -1 : left.object_type > right.object_type ? 1 : left.object_ref < right.object_ref ? -1 : left.object_ref > right.object_ref ? 1 : 0);
}

function normalizeValidationResults(results: readonly FieldTwinSourceValidationResultV1[]): FieldTwinSourceValidationResultV1[] {
  return [...results].sort((left, right) => left.source_name < right.source_name ? -1 : left.source_name > right.source_name ? 1 : left.profile_family < right.profile_family ? -1 : 1).map((result) => ({ ...result, evidence_refs: sortEvidenceRefsV1(result.evidence_refs) }));
}

export function buildRootGraphContentHashV1(input: {
  read_model_version: string;
  scope: FieldTwinScopeV1;
  root_graph_status: string;
  mandatory_objects: readonly FieldTwinCanonicalObjectRefV1[];
  record_set_validation: FieldTwinRecordSetValidationV1 | null;
  terminal_record_set_health: FieldTwinCanonicalObjectRefV1 | null;
  current_tick_forecast_result: FieldTwinCanonicalObjectRefV1 | null;
  active_lineage_authority_validation: FieldTwinSourceValidationResultV1 | null;
  source_profile_version: string;
}): SemanticHashTextV1 {
  return hash({
    read_model_version: input.read_model_version,
    scope: input.scope,
    root_graph_status: input.root_graph_status,
    mandatory_objects: sortCanonicalRefs(input.mandatory_objects),
    record_set_validation: input.record_set_validation,
    terminal_record_set_health: input.terminal_record_set_health,
    current_tick_forecast_result: input.current_tick_forecast_result,
    active_lineage_authority_validation: input.active_lineage_authority_validation && {
      ...input.active_lineage_authority_validation,
      evidence_refs: sortEvidenceRefsV1(input.active_lineage_authority_validation.evidence_refs),
    },
    source_profile_version: input.source_profile_version,
  });
}

export function buildAttachmentContentHashV1(input: {
  latest_successful_forecast: unknown;
  scenario_source_forecast: unknown;
  current_scenario_attachment: unknown;
  latest_scenario_in_scope: unknown;
  optional_domain_summaries: readonly unknown[];
  limitations: readonly FieldTwinLimitationV1[];
}): SemanticHashTextV1 {
  return hash({
    latest_successful_forecast: input.latest_successful_forecast,
    scenario_source_forecast: input.scenario_source_forecast,
    current_scenario_attachment: input.current_scenario_attachment,
    latest_scenario_in_scope: input.latest_scenario_in_scope,
    optional_domain_summaries: [...input.optional_domain_summaries],
    limitations: sortLimitationsV1(input.limitations),
  });
}

export function buildHealthContentHashV1(input: {
  terminal_record_set_health: FieldTwinCanonicalObjectRefV1 | null;
  latest_operational_runtime_health: FieldTwinCanonicalObjectRefV1 | null;
  health_relationship: string;
  health_role_resolutions: readonly FieldTwinRuntimeHealthRoleResolutionV1[];
  health_pointer_validation_summary: readonly FieldTwinSourceValidationResultV1[];
}): SemanticHashTextV1 {
  return hash({
    terminal_record_set_health: input.terminal_record_set_health,
    latest_operational_runtime_health: input.latest_operational_runtime_health,
    health_relationship: input.health_relationship,
    health_role_resolutions: [...input.health_role_resolutions].sort((left, right) => left.health_object_ref < right.health_object_ref ? -1 : 1).map((item) => ({ ...item, health_resolution_evidence_refs: sortEvidenceRefsV1(item.health_resolution_evidence_refs) })),
    health_pointer_validation_summary: normalizeValidationResults(input.health_pointer_validation_summary),
  });
}

export function buildTimelineItemsContentHashV1(events: readonly FieldTwinTimelineEventV1[]): SemanticHashTextV1 {
  return hash({
    event_taxonomy_version: FIELD_TWIN_EVENT_TAXONOMY_VERSION_V1,
    events: sortTimelineEventsAscendingV1(events).map((event) => ({
      ...event,
      source_refs: sortEvidenceRefsV1(event.source_refs),
      evidence_refs: sortEvidenceRefsV1(event.evidence_refs),
      health_resolution_evidence_refs: event.health_resolution_evidence_refs ? sortEvidenceRefsV1(event.health_resolution_evidence_refs) : null,
      limitations: sortLimitationsV1(event.limitations),
    })),
  });
}

export function buildTimelinePageContentHashV1(input: {
  scope: FieldTwinScopeV1;
  filter_hash: SemanticHashTextV1;
  canonical_visibility_snapshot_hash: SemanticHashTextV1;
  fixed_root_ref: string;
  fixed_root_graph_content_hash: SemanticHashTextV1;
  sort_direction: "ASC";
  page_limit: number;
  request_cursor_boundary: unknown | null;
  timeline_items_content_hash: SemanticHashTextV1;
  first_sort_tuple: unknown | null;
  last_sort_tuple: unknown | null;
  has_more: boolean;
}): SemanticHashTextV1 {
  return hash({
    read_model_version: FIELD_TWIN_READ_MODEL_VERSION_V1,
    scope: input.scope,
    filter_hash: input.filter_hash,
    canonical_visibility_snapshot_hash: input.canonical_visibility_snapshot_hash,
    fixed_root_ref: input.fixed_root_ref,
    fixed_root_graph_content_hash: input.fixed_root_graph_content_hash,
    sort_direction: input.sort_direction,
    page_limit: input.page_limit,
    request_cursor_boundary: input.request_cursor_boundary,
    timeline_items_content_hash: input.timeline_items_content_hash,
    first_sort_tuple: input.first_sort_tuple,
    last_sort_tuple: input.last_sort_tuple,
    has_more: input.has_more,
    ordering_version: FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1,
  });
}

export function buildCollectionItemsContentHashV1(collectionKind: FieldTwinCollectionKindV1, items: readonly FieldTwinCollectionItemV1[]): SemanticHashTextV1 {
  return hash({
    collection_kind: collectionKind,
    collection_contract_version: FIELD_TWIN_COLLECTION_CONTRACT_VERSION_V1,
    items: sortCollectionItemsV1(items).map((item) => ({
      object_ref: item.object_ref,
      object_type: item.object_type,
      object_hash: item.object_hash,
      logical_time: item.logical_time,
      attachment_status: item.attachment_status,
    })),
  });
}

export function buildCollectionPageContentHashV1(input: {
  collection_items_content_hash: SemanticHashTextV1;
  collection_kind: FieldTwinCollectionKindV1;
  scope: FieldTwinScopeV1;
  filter_hash: SemanticHashTextV1;
  canonical_visibility_snapshot_hash: SemanticHashTextV1;
  fixed_root_ref: string;
  fixed_root_graph_content_hash: SemanticHashTextV1;
  page_limit: number;
  request_cursor_boundary: unknown | null;
  first_sort_tuple: unknown | null;
  last_sort_tuple: unknown | null;
  has_more: boolean;
}): SemanticHashTextV1 {
  return hash({
    collection_items_content_hash: input.collection_items_content_hash,
    collection_kind: input.collection_kind,
    scope: input.scope,
    filter_hash: input.filter_hash,
    canonical_visibility_snapshot_hash: input.canonical_visibility_snapshot_hash,
    fixed_root_ref: input.fixed_root_ref,
    fixed_root_graph_content_hash: input.fixed_root_graph_content_hash,
    page_limit: input.page_limit,
    request_cursor_boundary: input.request_cursor_boundary,
    first_sort_tuple: input.first_sort_tuple,
    last_sort_tuple: input.last_sort_tuple,
    has_more: input.has_more,
    sort_contract_id: FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1,
  });
}

export function buildTraceGraphContentHashV1(input: {
  scope: FieldTwinScopeV1;
  nodes: readonly FieldTwinTraceNodeV1[];
  edges: readonly FieldTwinTraceEdgeV1[];
  unattached_objects: readonly FieldTwinCanonicalObjectRefV1[];
  missing_diagnostics: readonly FieldTwinLimitationV1[];
  record_set_validation: FieldTwinRecordSetValidationV1 | null;
  health_role_resolutions: readonly FieldTwinRuntimeHealthRoleResolutionV1[];
  active_lineage_authority_validation: FieldTwinSourceValidationResultV1 | null;
}): SemanticHashTextV1 {
  return hash({
    scope: input.scope,
    nodes: sortTraceNodesV1(input.nodes),
    edges: sortTraceEdgesV1(input.edges).map((edge) => ({ ...edge, evidence_refs: sortEvidenceRefsV1(edge.evidence_refs) })),
    unattached_objects: sortCanonicalRefs(input.unattached_objects),
    missing_diagnostics: sortLimitationsV1(input.missing_diagnostics),
    record_set_validation: input.record_set_validation,
    health_role_resolutions: [...input.health_role_resolutions].sort((left, right) => left.health_object_ref < right.health_object_ref ? -1 : 1),
    active_lineage_authority_validation: input.active_lineage_authority_validation,
  });
}

export function buildResponseInstanceHashV1(input: {
  endpoint_id: string;
  endpoint_version: string;
  scope: FieldTwinScopeV1;
  response_started_at: CanonicalUtcInstantV1;
  request_filter_hash: SemanticHashTextV1 | null;
  request_cursor_boundary: unknown | null;
  canonical_visibility_snapshot_hash: SemanticHashTextV1 | null;
  endpoint_content_hashes: Readonly<Record<string, SemanticHashTextV1>>;
  next_cursor_envelope_digest: SemanticHashTextV1 | null;
}): SemanticHashTextV1 {
  return hash({
    endpoint_id: input.endpoint_id,
    endpoint_version: input.endpoint_version,
    scope: input.scope,
    response_started_at: input.response_started_at,
    request_filter_hash: input.request_filter_hash,
    request_cursor_boundary: input.request_cursor_boundary,
    canonical_visibility_snapshot_hash: input.canonical_visibility_snapshot_hash,
    endpoint_content_hashes: input.endpoint_content_hashes,
    next_cursor_envelope_digest: input.next_cursor_envelope_digest,
  });
}
