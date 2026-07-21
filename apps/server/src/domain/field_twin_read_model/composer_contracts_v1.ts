// Purpose: define pure MCFT-CAP-07 S3 composer inputs, outputs, and fail-closed invariants.
// Boundary: deterministic in-memory composition only; no database, route, persistence, environment, clock, filesystem, network, or mutation access.

import { semanticHashV1 } from "../twin_runtime/canonical_json_v1.js";
import type {
  CanonicalUtcInstantV1,
  CursorWireTextV1,
  FieldTwinCanonicalObjectRefV1,
  FieldTwinCanonicalVisibilitySnapshotV1,
  FieldTwinCollectionItemV1,
  FieldTwinCollectionKindV1,
  FieldTwinEvidenceRefV1,
  FieldTwinLimitationV1,
  FieldTwinOptionalAttachmentStatusV1,
  FieldTwinOptionalCollectionSummaryV1,
  FieldTwinScopeV1,
  FieldTwinSourceValidationResultV1,
  SemanticHashTextV1,
  SourceValidationProfileFamilyV1,
} from "./contracts_v1.js";
import { canonicalUtcInstantV1 } from "./cursor_contracts_v1.js";
import { sortCollectionItemsV1, sortEvidenceRefsV1, sortLimitationsV1 } from "./ordering_v1.js";

export class FieldTwinComposerErrorV1 extends Error {
  constructor(readonly code: string, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "FieldTwinComposerErrorV1";
  }
}

export type FieldTwinComposerObjectV1 = FieldTwinCanonicalObjectRefV1 & {
  scope: FieldTwinScopeV1;
  lineage_id: string | null;
  revision_id: string | null;
  logical_time: CanonicalUtcInstantV1 | null;
  source_refs: readonly FieldTwinEvidenceRefV1[];
  evidence_refs: readonly FieldTwinEvidenceRefV1[];
  validation_profile: SourceValidationProfileFamilyV1;
  validation_status: "PASS" | "FAIL";
  attachment_status: FieldTwinOptionalAttachmentStatusV1;
};

export type FieldTwinCursorSigningContextV1 = {
  key_id: string;
  key: string | Buffer;
  ttl_seconds?: number;
};

export type FieldTwinTimelinePageV1 = {
  schema_version: "field_twin_timeline_page_v1";
  canonical_visibility_snapshot: FieldTwinCanonicalVisibilitySnapshotV1;
  fixed_root_ref: string;
  fixed_root_graph_content_hash: SemanticHashTextV1;
  items: readonly import("./contracts_v1.js").FieldTwinTimelineEventV1[];
  page_limit: number;
  has_more: boolean;
  next_cursor: CursorWireTextV1 | null;
  timeline_items_content_hash: SemanticHashTextV1;
  timeline_page_content_hash: SemanticHashTextV1;
  response_started_at: CanonicalUtcInstantV1;
  response_instance_hash: SemanticHashTextV1;
};

export type FieldTwinRuntimeHealthReadModelV1 = {
  schema_version: "field_twin_runtime_health_read_model_v1";
  request_scope: FieldTwinScopeV1;
  terminal_record_set_health: FieldTwinCanonicalObjectRefV1 | null;
  latest_operational_runtime_health: FieldTwinCanonicalObjectRefV1 | null;
  health_relationship: "SAME_OBJECT" | "LATEST_OPERATIONAL_IS_LATER" | "TERMINAL_ONLY" | "OPERATIONAL_ONLY" | "BOTH_ABSENT";
  health_role_resolutions: readonly import("./contracts_v1.js").FieldTwinRuntimeHealthRoleResolutionV1[];
  health_pointer_validation_summary: readonly FieldTwinSourceValidationResultV1[];
  health_content_hash: SemanticHashTextV1;
  response_started_at: CanonicalUtcInstantV1;
  response_instance_hash: SemanticHashTextV1;
};

export type FieldTwinActionLifecycleReadModelV1 = {
  schema_version: "field_twin_action_lifecycle_read_model_v1";
  request_scope: FieldTwinScopeV1;
  current_human_decision: import("./contracts_v1.js").FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  current_approved_plan: import("./contracts_v1.js").FieldTwinCollectionAttachmentV1<FieldTwinCanonicalObjectRefV1>;
  action_feedback_summary: FieldTwinOptionalCollectionSummaryV1;
  exact_edges: readonly import("./contracts_v1.js").FieldTwinTraceEdgeV1[];
  limitations: readonly FieldTwinLimitationV1[];
  action_lifecycle_content_hash: SemanticHashTextV1;
  response_started_at: CanonicalUtcInstantV1;
  response_instance_hash: SemanticHashTextV1;
};

export type FieldTwinModelGovernanceCandidateV1 = FieldTwinCollectionItemV1 & {
  activation_status: "NOT_ACTIVE";
  eligible_for_state_input: false;
  eligible_for_runtime_config_use: false;
};

export type FieldTwinModelGovernanceActivationRelationV1 = {
  activation: FieldTwinCollectionItemV1;
  candidate_ref: string;
  evaluation_ref: string;
  activated_runtime_config_ref: string;
  active_lineage_ref: string;
  active_revision_ref: string | null;
  relation_evidence_refs: readonly FieldTwinEvidenceRefV1[];
};

export type FieldTwinModelGovernanceReadModelV1 = {
  schema_version: "field_twin_model_governance_read_model_v1";
  request_scope: FieldTwinScopeV1;
  calibration_candidate_summary: FieldTwinOptionalCollectionSummaryV1;
  shadow_evaluation_summary: FieldTwinOptionalCollectionSummaryV1;
  model_activation_summary: FieldTwinOptionalCollectionSummaryV1;
  attached_activation_relation: FieldTwinModelGovernanceActivationRelationV1 | null;
  limitations: readonly FieldTwinLimitationV1[];
  model_governance_content_hash: SemanticHashTextV1;
  response_started_at: CanonicalUtcInstantV1;
  response_instance_hash: SemanticHashTextV1;
};

export function composerFailV1(code: string, detail?: string): never {
  throw new FieldTwinComposerErrorV1(code, detail);
}

export function assertScopeExactForComposerV1(actual: FieldTwinScopeV1, expected: FieldTwinScopeV1, code = "MCFT_COMPOSER_SCOPE_MISMATCH"): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (!String(actual[key] || "") || actual[key] !== expected[key]) composerFailV1(code, key);
  }
}

export function assertComposerObjectV1(object: FieldTwinComposerObjectV1, scope: FieldTwinScopeV1, code = "MCFT_COMPOSER_OBJECT_INVALID"): void {
  if (!object.object_ref || !object.object_type || !object.object_hash.startsWith("sha256:")) composerFailV1(code, "IDENTITY");
  if (object.validation_status !== "PASS") composerFailV1(code, `VALIDATION:${object.object_ref}`);
  if (object.attachment_status !== "ATTACHED_EXACT") composerFailV1(code, `ATTACHMENT:${object.object_ref}`);
  assertScopeExactForComposerV1(object.scope, scope, code);
  if (object.logical_time !== null) canonicalUtcInstantV1(object.logical_time);
}

export function canonicalInstantPlusSecondsV1(value: CanonicalUtcInstantV1, seconds: number): CanonicalUtcInstantV1 {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600) composerFailV1("MCFT_CURSOR_TTL_INVALID");
  return canonicalUtcInstantV1(new Date(Date.parse(value) + seconds * 1000).toISOString());
}

export function semanticComposerHashV1(value: unknown): SemanticHashTextV1 {
  return semanticHashV1(value) as SemanticHashTextV1;
}

export function canonicalObjectRefV1(object: Pick<FieldTwinComposerObjectV1, "object_ref" | "object_type" | "object_hash" | "source_fact_ref">): FieldTwinCanonicalObjectRefV1 {
  return {
    object_ref: object.object_ref,
    object_type: object.object_type,
    object_hash: object.object_hash,
    source_fact_ref: object.source_fact_ref,
  };
}

export function buildExactCollectionSummaryV1(input: {
  collection_kind: FieldTwinCollectionKindV1;
  collection_endpoint: string;
  items: readonly FieldTwinCollectionItemV1[];
  absence_reason_code?: string;
}): FieldTwinOptionalCollectionSummaryV1 {
  const sorted = sortCollectionItemsV1(input.items);
  const latest = sorted[0] ?? null;
  return {
    collection_kind: input.collection_kind,
    attachment_status: latest ? "ATTACHED_EXACT" : "ABSENT_OPTIONAL_DOMAIN",
    reason_code: latest ? null : input.absence_reason_code ?? "NO_VISIBLE_ITEMS_IN_SCOPE",
    has_items: latest !== null,
    count_status: "EXACT_VALIDATED_PROJECTION",
    total_count: sorted.length,
    latest_item_ref: latest?.object_ref ?? null,
    latest_item_hash: latest?.object_hash ?? null,
    collection_endpoint: input.collection_endpoint,
  };
}

export function normalizeComposerLimitationsV1(limitations: readonly FieldTwinLimitationV1[]): readonly FieldTwinLimitationV1[] {
  return Object.freeze(sortLimitationsV1(limitations));
}

export function normalizeComposerEvidenceRefsV1(refs: readonly FieldTwinEvidenceRefV1[]): readonly FieldTwinEvidenceRefV1[] {
  return Object.freeze(sortEvidenceRefsV1(refs));
}

export function assertUniqueObjectRefsV1(objects: readonly { object_ref: string }[], code = "MCFT_COMPOSER_DUPLICATE_OBJECT_REF"): void {
  const refs = new Set<string>();
  for (const object of objects) {
    if (refs.has(object.object_ref)) composerFailV1(code, object.object_ref);
    refs.add(object.object_ref);
  }
}
