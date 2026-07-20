// apps/server/src/domain/field_twin_read_model/contracts_v1.ts
// Purpose: freeze the MCFT-CAP-07 S1 pure read-model contracts.
// Boundary: type-level and immutable domain constants only; no database, route, persistence, wall clock, environment, filesystem, or network access.

export const FIELD_TWIN_READ_MODEL_VERSION_V1 = "minimal_field_twin_runtime_read_model_v1" as const;
export const FIELD_TWIN_SOURCE_PROFILE_VERSION_V1 = "mcft_cap_07_source_profiles_v1" as const;
export const FIELD_TWIN_VISIBILITY_SNAPSHOT_VERSION_V1 = "field_twin_canonical_visibility_snapshot_v1" as const;
export const FIELD_TWIN_CURSOR_SCHEMA_VERSION_V1 = "field_twin_cursor_v1" as const;
export const FIELD_TWIN_TIMELINE_FILTER_SCHEMA_VERSION_V1 = "field_twin_timeline_filter_v1" as const;
export const FIELD_TWIN_EMPTY_COLLECTION_FILTER_SCHEMA_VERSION_V1 = "field_twin_empty_collection_filter_v1" as const;
export const FIELD_TWIN_EVENT_TAXONOMY_VERSION_V1 = "field_twin_timeline_event_taxonomy_v1" as const;
export const FIELD_TWIN_COLLECTION_CONTRACT_VERSION_V1 = "field_twin_collection_contract_v1" as const;

export type SemanticHashTextV1 = `sha256:${string}`;
export type CanonicalUtcInstantV1 = string & { readonly __canonicalUtcInstantV1: unique symbol };
export type Xid8TextV1 = string & { readonly __xid8TextV1: unique symbol };
export type CursorWireTextV1 = string & { readonly __cursorWireTextV1: unique symbol };

export type FieldTwinScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export const SOURCE_VALIDATION_PROFILE_FAMILIES_V1 = [
  "CANONICAL_AGGREGATE_PROJECTION",
  "EMBEDDED_CHILD_PROJECTION",
  "OPERATIONAL_POINTER_INDEX",
  "RECORD_SET_IDENTITY_INDEX",
  "EVIDENCE_BINDING_PROJECTION",
  "DERIVED_COMPOSITE_PROJECTION",
  "CANONICAL_TWIN_FACT_DIRECT",
  "REPLAY_EVIDENCE_FACT_DIRECT",
] as const;
export type SourceValidationProfileFamilyV1 = (typeof SOURCE_VALIDATION_PROFILE_FAMILIES_V1)[number];

export const FIELD_TWIN_ROOT_GRAPH_STATUSES_V1 = [
  "COMPLETE_EXACT_GRAPH",
  "NOT_AVAILABLE",
  "INCONSISTENT",
] as const;
export type FieldTwinRootGraphStatusV1 = (typeof FIELD_TWIN_ROOT_GRAPH_STATUSES_V1)[number];

export const FIELD_TWIN_OPTIONAL_ATTACHMENT_STATUSES_V1 = [
  "ATTACHED_EXACT",
  "ABSENT_OPTIONAL_DOMAIN",
  "NOT_ATTACHED_TO_CURRENT_RUNTIME_GRAPH",
  "INCONSISTENT_EXACT_REFERENCE",
] as const;
export type FieldTwinOptionalAttachmentStatusV1 = (typeof FIELD_TWIN_OPTIONAL_ATTACHMENT_STATUSES_V1)[number];

export const FIELD_TWIN_COLLECTION_KINDS_V1 = [
  "STATE",
  "FORECAST",
  "SCENARIO",
  "ACTION_FEEDBACK",
  "FORECAST_RESIDUAL",
  "CALIBRATION_CANDIDATE",
  "SHADOW_EVALUATION",
  "MODEL_ACTIVATION",
] as const;
export type FieldTwinCollectionKindV1 = (typeof FIELD_TWIN_COLLECTION_KINDS_V1)[number];

export type FieldTwinCountStatusV1 = "NOT_COMPUTED" | "EXACT_VALIDATED_PROJECTION";

export type FieldTwinEvidenceRefV1 = {
  ref_type: string;
  ref_value: string;
};

export type FieldTwinLimitationV1 = {
  reason_code: string;
  object_ref: string | null;
  detail: string | null;
};

export type FieldTwinCanonicalObjectRefV1 = {
  object_ref: string;
  object_type: string;
  object_hash: SemanticHashTextV1;
  source_fact_ref: string | null;
};

export type FieldTwinSourceValidationResultV1 = {
  source_name: string;
  profile_family: SourceValidationProfileFamilyV1;
  validation_status: "PASS" | "FAIL";
  failure_code: string | null;
  validated_object_ref: string | null;
  validated_object_hash: SemanticHashTextV1 | null;
  evidence_refs: readonly FieldTwinEvidenceRefV1[];
};

export type FieldTwinSourceValidationObligationRowV1 = {
  source_name: string;
  profile_family: SourceValidationProfileFamilyV1;
  envelope_family: string | null;
  identity_field: string | null;
  scope_path: Record<string, string> | null;
  payload_path: string | null;
  logical_time_path: string | null;
  as_of_path: string | null;
  available_to_runtime_at_path: string | null;
  available_projection_columns: readonly string[];
  required_column_comparisons: readonly unknown[];
  source_fact_envelope_profile: string | null;
  parent_lookup_path: string | null;
  child_lookup_path: string | null;
  cardinality: string | null;
  canonical_hash_function: string | null;
  fact_visibility_metadata_source: string | null;
  visibility_anchor_xid8_path: string | null;
  visibility_anchor_kind_path: string | null;
  visibility_epoch_source: string | null;
  snapshot_visibility_predicate: string | null;
  visibility_snapshot_eligible: boolean;
  health_attempt_ref_path: string | null;
  health_operation_discriminator_path: string | null;
  forecast_failure_ref_path: string | null;
  health_transaction_family_resolution_rule: string | null;
  health_role_resolution_rule: string | null;
  failure_code: string;
};

export type SourceValidationObligationMatrixV1 = {
  schema_version: string;
  matrix_id: string;
  taskbook_version: string;
  source_profile_version: typeof FIELD_TWIN_SOURCE_PROFILE_VERSION_V1;
  profile_families: readonly SourceValidationProfileFamilyV1[];
  row_schema_fields: readonly string[];
  rows: readonly FieldTwinSourceValidationObligationRowV1[];
};

export type SourceValidationProfileRegistryEntryV1 = {
  source_name: string;
  profile_family: SourceValidationProfileFamilyV1;
  failure_code: string;
  visibility_snapshot_eligible: boolean;
  obligation_row: FieldTwinSourceValidationObligationRowV1;
};

export type SourceValidationProfileRegistryV1 = {
  registry_schema_version: "source_validation_profile_registry_v1";
  source_profile_version: typeof FIELD_TWIN_SOURCE_PROFILE_VERSION_V1;
  entries: readonly SourceValidationProfileRegistryEntryV1[];
};

export type FieldTwinRecordSetValidationV1 = {
  validation_status: "PASS" | "FAIL";
  record_set_id: string;
  identity_kind: string;
  aggregate_determinism_hash: SemanticHashTextV1;
  recomputed_aggregate_determinism_hash: SemanticHashTextV1;
  exact_member_count: number;
  exact_member_refs: readonly FieldTwinCanonicalObjectRefV1[];
  failure_code: "MCFT_RECORD_SET_IDENTITY_INVALID" | null;
};

export type FieldTwinRuntimeHealthRoleV1 = "TERMINAL_RECORD_SET_MEMBER" | "OPERATIONAL_ATTEMPT_AUDIT";
export type FieldTwinRuntimeTransactionFamilyV1 = "A_STATE_TICK_COMMIT" | "F_OPERATIONAL_ATTEMPT_HEALTH";
export type FieldTwinRuntimeHealthResolutionBasisV1 = "EXACT_RECORD_SET_MEMBERSHIP" | "EXACT_OPERATIONAL_ATTEMPT_RELATION";

export type FieldTwinRuntimeHealthRoleResolutionV1 = {
  health_object_ref: string;
  transaction_family: FieldTwinRuntimeTransactionFamilyV1;
  health_role: FieldTwinRuntimeHealthRoleV1;
  health_resolution_basis: FieldTwinRuntimeHealthResolutionBasisV1;
  health_resolution_evidence_refs: readonly FieldTwinEvidenceRefV1[];
  atomic_group_ref: string | null;
};

export type CanonicalFactVisibilityMetadataContractV1 = {
  contract_id: "CANONICAL_FACT_VISIBILITY_METADATA_CONTRACT_V1";
  epoch_table: "public.twin_fact_visibility_epoch_v1";
  index_table: "public.twin_fact_visibility_index_v1";
  visibility_anchor_type: "xid8";
  canonical_anchor_serialization: "Xid8TextV1";
  visibility_anchor_kinds: readonly [
    "FACT_INSERT_TRANSACTION",
    "INITIAL_BASELINE_TRANSACTION",
    "EPOCH_ROTATION_TRANSACTION",
  ];
  first_page_snapshot_source: "pg_current_snapshot()::text";
  visibility_predicate: "pg_visible_in_snapshot(visibility_anchor_xid8, pg_snapshot_token)";
  active_epoch_cardinality: "EXACTLY_ONE";
  application_runtime_direct_dml: "FORBIDDEN";
};

export const CANONICAL_FACT_VISIBILITY_METADATA_CONTRACT_V1: CanonicalFactVisibilityMetadataContractV1 = Object.freeze({
  contract_id: "CANONICAL_FACT_VISIBILITY_METADATA_CONTRACT_V1",
  epoch_table: "public.twin_fact_visibility_epoch_v1",
  index_table: "public.twin_fact_visibility_index_v1",
  visibility_anchor_type: "xid8",
  canonical_anchor_serialization: "Xid8TextV1",
  visibility_anchor_kinds: [
    "FACT_INSERT_TRANSACTION",
    "INITIAL_BASELINE_TRANSACTION",
    "EPOCH_ROTATION_TRANSACTION",
  ] as const,
  first_page_snapshot_source: "pg_current_snapshot()::text",
  visibility_predicate: "pg_visible_in_snapshot(visibility_anchor_xid8, pg_snapshot_token)",
  active_epoch_cardinality: "EXACTLY_ONE",
  application_runtime_direct_dml: "FORBIDDEN",
});

export type FieldTwinCanonicalVisibilitySnapshotV1 = {
  snapshot_schema_version: typeof FIELD_TWIN_VISIBILITY_SNAPSHOT_VERSION_V1;
  database_visibility_epoch_id: string;
  pg_snapshot_token: string;
  snapshot_xmin: Xid8TextV1;
  snapshot_xmax: Xid8TextV1;
  snapshot_xip_hash: SemanticHashTextV1;
  visibility_snapshot_hash: SemanticHashTextV1;
};

export type FieldTwinTimelineFilterV1 = {
  filter_schema_version: typeof FIELD_TWIN_TIMELINE_FILTER_SCHEMA_VERSION_V1;
  from_logical_time: CanonicalUtcInstantV1 | null;
  until_logical_time: CanonicalUtcInstantV1 | null;
};

export type FieldTwinEmptyCollectionFilterV1 = {
  filter_schema_version: typeof FIELD_TWIN_EMPTY_COLLECTION_FILTER_SCHEMA_VERSION_V1;
  filter_kind: "NONE";
};

export type FieldTwinOptionalCollectionSummaryV1 = {
  collection_kind: FieldTwinCollectionKindV1;
  attachment_status: FieldTwinOptionalAttachmentStatusV1;
  reason_code: string | null;
  has_items: boolean;
  count_status: FieldTwinCountStatusV1;
  total_count: number | null;
  latest_item_ref: string | null;
  latest_item_hash: SemanticHashTextV1 | null;
  collection_endpoint: string;
};

export type FieldTwinCollectionAttachmentV1<T> = {
  attachment_status: FieldTwinOptionalAttachmentStatusV1;
  reason_code: string | null;
  item: T | null;
};

export type FieldTwinCollectionItemV1 = {
  object_ref: string;
  object_type: string;
  object_hash: SemanticHashTextV1;
  logical_time: CanonicalUtcInstantV1;
  attachment_status: FieldTwinOptionalAttachmentStatusV1;
};

export type FieldTwinCollectionPageV1<T> = {
  schema_version: "field_twin_collection_page_v1";
  collection_kind: FieldTwinCollectionKindV1;
  canonical_visibility_snapshot: FieldTwinCanonicalVisibilitySnapshotV1;
  fixed_root_ref: string;
  fixed_root_graph_content_hash: SemanticHashTextV1;
  items: readonly T[];
  page_limit: number;
  has_more: boolean;
  next_cursor: CursorWireTextV1 | null;
  collection_items_content_hash: SemanticHashTextV1;
  collection_page_content_hash: SemanticHashTextV1;
  response_started_at: CanonicalUtcInstantV1;
  response_instance_hash: SemanticHashTextV1;
};

export const FIELD_TWIN_TIMELINE_EVENT_KINDS_V1 = [
  "EVIDENCE_WINDOW",
  "STATE_TRANSITION",
  "ASSIMILATION_UPDATE",
  "POSTERIOR_STATE",
  "FORECAST_RESULT",
  "FORECAST_FAILURE",
  "RUNTIME_TICK",
  "CHECKPOINT",
  "RUNTIME_HEALTH",
  "SCENARIO_SET",
  "HUMAN_DECISION",
  "APPROVED_PLAN_EVIDENCE",
  "ACTION_FEEDBACK",
  "FORECAST_RESIDUAL",
  "CALIBRATION_CANDIDATE",
  "SHADOW_EVALUATION",
  "MODEL_ACTIVATION",
] as const;
export type FieldTwinTimelineEventKindV1 = (typeof FIELD_TWIN_TIMELINE_EVENT_KINDS_V1)[number];

export type FieldTwinTimelineEventV1 = {
  event_id: string;
  event_kind: FieldTwinTimelineEventKindV1;
  event_rank: number;
  object_ref: string;
  object_type: string;
  object_hash: SemanticHashTextV1;
  scope: FieldTwinScopeV1;
  lineage_id: string | null;
  revision_id: string | null;
  logical_time: CanonicalUtcInstantV1;
  as_of: CanonicalUtcInstantV1 | null;
  observed_at: CanonicalUtcInstantV1 | null;
  available_to_runtime_at: CanonicalUtcInstantV1 | null;
  created_at: CanonicalUtcInstantV1 | null;
  transaction_family: FieldTwinRuntimeTransactionFamilyV1 | null;
  health_role: FieldTwinRuntimeHealthRoleV1 | null;
  health_resolution_basis: FieldTwinRuntimeHealthResolutionBasisV1 | null;
  health_resolution_evidence_refs: readonly FieldTwinEvidenceRefV1[] | null;
  atomic_group_ref: string | null;
  source_fact_ref: string | null;
  source_refs: readonly FieldTwinEvidenceRefV1[];
  evidence_refs: readonly FieldTwinEvidenceRefV1[];
  attachment_status: FieldTwinOptionalAttachmentStatusV1 | null;
  limitations: readonly FieldTwinLimitationV1[];
};

export type FieldTwinTraceNodeV1 = {
  node_id: string;
  object_ref: string;
  object_type: string;
  object_hash: SemanticHashTextV1;
  scope: FieldTwinScopeV1;
  lineage_id: string | null;
  revision_id: string | null;
  logical_time: CanonicalUtcInstantV1 | null;
  source_fact_ref: string | null;
  validation_profile: SourceValidationProfileFamilyV1;
  validation_status: "PASS" | "FAIL";
};

export const FIELD_TWIN_TRACE_EDGE_KINDS_V1 = [
  "ACTIVE_LINEAGE_TARGET",
  "CHECKPOINT_TARGET",
  "TERMINAL_TICK_MEMBER",
  "EVIDENCE_FOR_TICK",
  "TRANSITION_FOR_TICK",
  "ASSIMILATION_FOR_TICK",
  "POSTERIOR_FOR_TICK",
  "FORECAST_FOR_TICK",
  "HEALTH_FOR_TICK",
  "CONFIG_USED_BY",
  "FORECAST_SOURCE_FOR_SCENARIO",
  "SCENARIO_SELECTED_BY_DECISION",
  "DECISION_BOUND_TO_PLAN",
  "PLAN_EXECUTED_BY_FEEDBACK",
  "FORECAST_MATCHED_BY_RESIDUAL",
  "RESIDUAL_USED_BY_CALIBRATION",
  "CANDIDATE_EVALUATED_BY",
  "CANDIDATE_ACTIVATED_BY",
  "SUPERSEDES",
] as const;
export type FieldTwinTraceEdgeKindV1 = (typeof FIELD_TWIN_TRACE_EDGE_KINDS_V1)[number];

export type FieldTwinTraceEdgeV1 = {
  edge_kind: FieldTwinTraceEdgeKindV1;
  from_ref: string;
  to_ref: string;
  evidence_refs: readonly FieldTwinEvidenceRefV1[];
};

export type FieldTwinTraceGraphV1 = {
  schema_version: "field_twin_trace_graph_v1";
  request_scope: FieldTwinScopeV1;
  nodes: readonly FieldTwinTraceNodeV1[];
  edges: readonly FieldTwinTraceEdgeV1[];
  unattached_objects: readonly FieldTwinCanonicalObjectRefV1[];
  missing_diagnostics: readonly FieldTwinLimitationV1[];
  record_set_validation: FieldTwinRecordSetValidationV1 | null;
  health_role_resolutions: readonly FieldTwinRuntimeHealthRoleResolutionV1[];
  active_lineage_authority_validation: FieldTwinSourceValidationResultV1 | null;
  trace_graph_content_hash: SemanticHashTextV1;
  response_started_at: CanonicalUtcInstantV1;
  response_instance_hash: SemanticHashTextV1;
};

export type MinimalFieldTwinRuntimeReadModelV1 = {
  schema_version: typeof FIELD_TWIN_READ_MODEL_VERSION_V1;
  root_graph_content_hash: SemanticHashTextV1;
  attachment_content_hash: SemanticHashTextV1;
  response_instance_hash: SemanticHashTextV1;
  request_scope: FieldTwinScopeV1;
  source_profile_id: typeof FIELD_TWIN_SOURCE_PROFILE_VERSION_V1;
  response_started_at: CanonicalUtcInstantV1;
  root_graph_status: FieldTwinRootGraphStatusV1;
  active_lineage: FieldTwinCanonicalObjectRefV1 | null;
  active_lineage_authority_validation: FieldTwinSourceValidationResultV1 | null;
  checkpoint: FieldTwinCanonicalObjectRefV1 | null;
  runtime_tick: FieldTwinCanonicalObjectRefV1 | null;
  evidence_window: FieldTwinCanonicalObjectRefV1 | null;
  state_transition: FieldTwinCanonicalObjectRefV1 | null;
  assimilation_update: FieldTwinCanonicalObjectRefV1 | null;
  posterior_state: FieldTwinCanonicalObjectRefV1 | null;
  terminal_record_set_health: FieldTwinCanonicalObjectRefV1 | null;
  runtime_config: FieldTwinCanonicalObjectRefV1 | null;
  record_set_validation: FieldTwinRecordSetValidationV1 | null;
  current_tick_forecast_result: FieldTwinCanonicalObjectRefV1 | null;
  latest_successful_forecast: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  scenario_source_forecast: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  current_scenario_attachment: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  latest_scenario_in_scope: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  current_human_decision: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  current_approved_plan: FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  action_feedback_summary: FieldTwinOptionalCollectionSummaryV1;
  forecast_residual_summary: FieldTwinOptionalCollectionSummaryV1;
  calibration_candidate_summary: FieldTwinOptionalCollectionSummaryV1;
  shadow_evaluation_summary: FieldTwinOptionalCollectionSummaryV1;
  model_activation_summary: FieldTwinOptionalCollectionSummaryV1;
  limitations: readonly FieldTwinLimitationV1[];
  validation_summary: readonly FieldTwinSourceValidationResultV1[];
};
