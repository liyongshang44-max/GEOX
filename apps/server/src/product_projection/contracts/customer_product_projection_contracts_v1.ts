// GEOX Customer Product Projection successor contracts V1.
// Purpose: freeze the first canonical Customer Product read contracts before Sites real-data binding.
// Boundary: pure types/validators only. No database, network, wall-clock, domain adjudication, command authorization, or authority mutation.

import {
  ProductProjectionContractError,
  assertProductProjectionEnvelopeV1,
  type ProductProjectionEnvelopeV1,
} from "./product_projection_contracts_v1.js";

export const CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1 =
  "geox.customer-product-projection.derivation.v1" as const;

export const CUSTOMER_REPORTING_STATES_V1 = ["CURRENT", "LIMITED", "UNAVAILABLE"] as const;
export type CustomerReportingStateV1 = (typeof CUSTOMER_REPORTING_STATES_V1)[number];

export const CUSTOMER_AVAILABILITY_STATES_V1 = ["AVAILABLE", "LIMITED", "UNAVAILABLE"] as const;
export type CustomerAvailabilityStateV1 = (typeof CUSTOMER_AVAILABILITY_STATES_V1)[number];

export const CUSTOMER_COLLECTION_STATES_V1 = ["AVAILABLE", "LIMITED", "UNAVAILABLE"] as const;
export type CustomerCollectionStateV1 = (typeof CUSTOMER_COLLECTION_STATES_V1)[number];

export const CUSTOMER_GEOMETRY_AVAILABILITY_V1 = ["AVAILABLE", "PARTIAL", "UNAVAILABLE"] as const;
export type CustomerGeometryAvailabilityV1 = (typeof CUSTOMER_GEOMETRY_AVAILABILITY_V1)[number];

export const CUSTOMER_ATTRIBUTION_STATES_V1 = ["ESTABLISHED", "NOT_ESTABLISHED", "UNAVAILABLE"] as const;
export type CustomerAttributionStateV1 = (typeof CUSTOMER_ATTRIBUTION_STATES_V1)[number];

export const CUSTOMER_ATTENTION_TRIAGE_BUCKETS_V1 = ["NEEDS_REVIEW", "WAITING", "INFORMATION_LIMITED"] as const;
export type CustomerAttentionTriageBucketV1 = (typeof CUSTOMER_ATTENTION_TRIAGE_BUCKETS_V1)[number];

export type FieldIdentityProjectionV1 = {
  display_name: string | null;
  farm_display_name: string | null;
  crop_display_name: string | null;
  crop_stage_display: string | null;
  season_display: string | null;
  area: number | null;
  area_unit: "ha" | "m2" | null;
};

export type FieldConditionMetricsV1 = {
  root_zone_storage_mm_mean: number | null;
  root_zone_vwc_fraction_mean: number | null;
  available_water_fraction: number | null;
  depletion_from_field_capacity_mm: number | null;
  confidence_status: string | null;
};

export type FieldCurrentConditionProjectionV1 = {
  status: CustomerAvailabilityStateV1;
  summary: string | null;
  logical_time: string | null;
  support_state: "SUPPORTED" | "LIMITED" | "UNAVAILABLE";
  source_ref_key: string | null;
  metrics: FieldConditionMetricsV1;
};

export type FieldReportingStateProjectionV1 = {
  state: CustomerReportingStateV1;
  reason_codes: readonly string[];
  source_logical_time: string | null;
};

export type FieldAttentionSummaryV1 = {
  status: CustomerCollectionStateV1;
  has_attention: boolean | null;
  attention_item_refs: readonly string[];
};

export type FieldRecentOperationSummaryV1 = {
  status: CustomerCollectionStateV1;
  operation: {
    operation_ref: string;
    display_title: string | null;
    lifecycle_state: string;
    event_at: string | null;
  } | null;
};

export type FieldSummaryProjectionV1 = {
  envelope: ProductProjectionEnvelopeV1 & { projection_type: "FIELD_SUMMARY" };
  field_ref: string;
  identity: FieldIdentityProjectionV1;
  current_condition: FieldCurrentConditionProjectionV1 | null;
  reporting_state: FieldReportingStateProjectionV1;
  attention: FieldAttentionSummaryV1;
  recent_operation: FieldRecentOperationSummaryV1;
  geometry_availability: CustomerGeometryAvailabilityV1;
  capability_refs: readonly string[];
};

export type FieldWorkspaceRecentChangeV1 = {
  change_ref: string;
  display_title: string | null;
  display_summary: string | null;
  event_at: string | null;
  source_ref_keys: readonly string[];
};

export type FieldWorkspaceActionCaseV1 = {
  action_case_projection_id: string;
  display_title: string | null;
  display_phase: string;
  composition_status: "EXACT_REF_LINKED" | "PARTIAL_REF_LINKED" | "UNRESOLVED";
  source_ref_keys: readonly string[];
};

export type FieldWorkspaceOperationV1 = {
  operation_ref: string;
  display_title: string | null;
  lifecycle_state: string;
  event_at: string | null;
  evidence_state: string | null;
};

export type FieldWorkspaceOutcomeV1 = {
  outcome_ref: string;
  display_summary: string | null;
  observed_at: string | null;
  attribution_state: CustomerAttributionStateV1;
};

export type FieldWorkspaceProjectionV1 = {
  envelope: ProductProjectionEnvelopeV1 & { projection_type: "FIELD_WORKSPACE" };
  field_ref: string;
  identity: FieldIdentityProjectionV1;
  current_condition: FieldCurrentConditionProjectionV1 | null;
  reporting_state: FieldReportingStateProjectionV1;
  recent_changes: {
    status: CustomerCollectionStateV1;
    items: readonly FieldWorkspaceRecentChangeV1[];
  };
  open_action_cases: {
    status: CustomerCollectionStateV1;
    items: readonly FieldWorkspaceActionCaseV1[];
  };
  recent_operations: {
    status: CustomerCollectionStateV1;
    items: readonly FieldWorkspaceOperationV1[];
  };
  evidence_summary: {
    field_condition: {
      status: CustomerAvailabilityStateV1;
      artifact_count: number | null;
      reason_codes: readonly string[];
    };
    execution_evidence: {
      status: CustomerAvailabilityStateV1;
      artifact_count: number | null;
      reason_codes: readonly string[];
    };
  };
  observed_outcomes: {
    status: CustomerCollectionStateV1;
    items: readonly FieldWorkspaceOutcomeV1[];
  };
  capability_availability: readonly {
    capability_id: string;
    customer_state: "AVAILABLE" | "LIMITED" | "PREVIEW" | "NOT_YET_AVAILABLE";
  }[];
  history_summary: {
    status: CustomerAvailabilityStateV1;
    latest_event_at: string | null;
    reason_codes: readonly string[];
  };
  provenance_summary: {
    source_authority_count: number;
    source_non_authority_count: number;
  };
};

export type CustomerOverviewAttentionItemV1 = {
  attention_id: string;
  display_title: string | null;
  display_summary: string | null;
  triage_bucket: CustomerAttentionTriageBucketV1;
  blocking_state: string | null;
  event_at: string | null;
  navigation_target: string;
  source_ref_keys: readonly string[];
};

export type CustomerOverviewProjectionV1 = {
  envelope: ProductProjectionEnvelopeV1 & { projection_type: "CUSTOMER_OVERVIEW" };
  reporting_summary: {
    total_fields: number;
    current_fields: number;
    limited_fields: number;
    unavailable_fields: number;
  };
  attention: {
    status: CustomerCollectionStateV1;
    items: readonly CustomerOverviewAttentionItemV1[];
  };
  field_previews: readonly FieldSummaryProjectionV1[];
  recent_operations: {
    status: CustomerCollectionStateV1;
    items: readonly {
      operation_ref: string;
      display_title: string | null;
      field_display_name: string | null;
      lifecycle_state: string;
      event_at: string | null;
    }[];
  };
  latest_reports: {
    status: CustomerCollectionStateV1;
    items: readonly {
      report_ref: string;
      display_title: string | null;
      availability: "AVAILABLE" | "LIMITED" | "NOT_YET_AVAILABLE";
    }[];
  };
};

export type ProductApiSuccessEnvelopeV1<T> = {
  ok: true;
  request_id: string;
  generated_at: string;
  schema_version: "geox.product-api.v1";
  derivation_version: typeof CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1;
  data: T;
};

export type ProductApiErrorEnvelopeV1 = {
  ok: false;
  request_id: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
};

function rec(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProductProjectionContractError(code, code);
  return value as Record<string, unknown>;
}
function txt(value: unknown, code: string): string {
  const v = String(value ?? "").trim();
  if (!v) throw new ProductProjectionContractError(code, code);
  return v;
}
function nullableTxt(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  return v || null;
}
function arr(value: unknown, code: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new ProductProjectionContractError(code, code);
  return value;
}
function enumVal<T extends readonly string[]>(value: unknown, allowed: T, code: string): T[number] {
  const v = txt(value, code);
  if (!(allowed as readonly string[]).includes(v)) throw new ProductProjectionContractError(code, code);
  return v as T[number];
}
function isoOrNull(value: unknown, code: string): string | null {
  if (value === null || value === undefined) return null;
  const v = txt(value, code);
  const epoch = Date.parse(v);
  if (!Number.isFinite(epoch) || !/(Z|[+-]\d{2}:\d{2})$/.test(v)) throw new ProductProjectionContractError(code, code);
  return new Date(epoch).toISOString();
}
function numOrNull(value: unknown, code: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ProductProjectionContractError(code, code);
  return value;
}
function uniqueStrings(value: unknown, code: string): readonly string[] {
  const values = arr(value, code).map((item, i) => txt(item, `${code}:${i}`));
  if (new Set(values).size !== values.length) throw new ProductProjectionContractError(`${code}:DUPLICATE`, `${code}:DUPLICATE`);
  return values;
}
function assertNoInventedProductAuthorityFields(value: unknown, path = "projection"): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoInventedProductAuthorityFields(item, `${path}[${index}]`));
    return;
  }
  const object = value as Record<string, unknown>;
  for (const key of Object.keys(object)) {
    if (["risk_score", "severity", "priority", "recommendation", "approval", "authorization", "attribution_score"].includes(key)) {
      throw new ProductProjectionContractError("CUSTOMER_PRODUCT_OWNED_AUTHORITY_FIELD_FORBIDDEN", `CUSTOMER_PRODUCT_OWNED_AUTHORITY_FIELD_FORBIDDEN:${path}.${key}`);
    }
    assertNoInventedProductAuthorityFields(object[key], `${path}.${key}`);
  }
}

function assertIdentity(value: unknown): asserts value is FieldIdentityProjectionV1 {
  const object = rec(value, "FIELD_IDENTITY_REQUIRED");
  nullableTxt(object.display_name);
  nullableTxt(object.farm_display_name);
  nullableTxt(object.crop_display_name);
  nullableTxt(object.crop_stage_display);
  nullableTxt(object.season_display);
  const area = numOrNull(object.area, "FIELD_IDENTITY_AREA_INVALID");
  const unit = object.area_unit === null || object.area_unit === undefined ? null : enumVal(object.area_unit, ["ha", "m2"] as const, "FIELD_IDENTITY_AREA_UNIT_INVALID");
  if ((area === null) !== (unit === null)) throw new ProductProjectionContractError("FIELD_IDENTITY_AREA_UNIT_PAIR_INVALID", "FIELD_IDENTITY_AREA_UNIT_PAIR_INVALID");
}

function assertReporting(value: unknown): asserts value is FieldReportingStateProjectionV1 {
  const object = rec(value, "FIELD_REPORTING_REQUIRED");
  enumVal(object.state, CUSTOMER_REPORTING_STATES_V1, "FIELD_REPORTING_STATE_INVALID");
  uniqueStrings(object.reason_codes, "FIELD_REPORTING_REASON_CODES_INVALID");
  isoOrNull(object.source_logical_time, "FIELD_REPORTING_SOURCE_LOGICAL_TIME_INVALID");
}

function assertCurrentCondition(value: unknown): asserts value is FieldCurrentConditionProjectionV1 {
  const object = rec(value, "FIELD_CURRENT_CONDITION_REQUIRED");
  enumVal(object.status, CUSTOMER_AVAILABILITY_STATES_V1, "FIELD_CURRENT_CONDITION_STATUS_INVALID");
  nullableTxt(object.summary);
  isoOrNull(object.logical_time, "FIELD_CURRENT_CONDITION_LOGICAL_TIME_INVALID");
  enumVal(object.support_state, ["SUPPORTED", "LIMITED", "UNAVAILABLE"] as const, "FIELD_CURRENT_CONDITION_SUPPORT_INVALID");
  nullableTxt(object.source_ref_key);
  const metrics = rec(object.metrics, "FIELD_CURRENT_CONDITION_METRICS_REQUIRED");
  numOrNull(metrics.root_zone_storage_mm_mean, "FIELD_CURRENT_METRIC_STORAGE_INVALID");
  numOrNull(metrics.root_zone_vwc_fraction_mean, "FIELD_CURRENT_METRIC_VWC_INVALID");
  numOrNull(metrics.available_water_fraction, "FIELD_CURRENT_METRIC_AWF_INVALID");
  numOrNull(metrics.depletion_from_field_capacity_mm, "FIELD_CURRENT_METRIC_DEPLETION_INVALID");
  nullableTxt(metrics.confidence_status);
}

export function assertFieldSummaryProjectionV1(input: unknown): asserts input is FieldSummaryProjectionV1 {
  const object = rec(input, "FIELD_SUMMARY_REQUIRED");
  assertProductProjectionEnvelopeV1(object.envelope);
  const envelope = object.envelope as ProductProjectionEnvelopeV1;
  if (envelope.projection_type !== "FIELD_SUMMARY") throw new ProductProjectionContractError("FIELD_SUMMARY_PROJECTION_TYPE_INVALID", "FIELD_SUMMARY_PROJECTION_TYPE_INVALID");
  const fieldRef = txt(object.field_ref, "FIELD_SUMMARY_FIELD_REF_REQUIRED");
  if (envelope.subject_scope.field_id !== fieldRef) throw new ProductProjectionContractError("FIELD_SUMMARY_SCOPE_FIELD_MISMATCH", "FIELD_SUMMARY_SCOPE_FIELD_MISMATCH");
  assertIdentity(object.identity);
  if (object.current_condition !== null) assertCurrentCondition(object.current_condition);
  assertReporting(object.reporting_state);
  const reporting = object.reporting_state as FieldReportingStateProjectionV1;
  if (reporting.state === "CURRENT" && object.current_condition === null) {
    throw new ProductProjectionContractError("FIELD_SUMMARY_CURRENT_REQUIRES_CONDITION", "FIELD_SUMMARY_CURRENT_REQUIRES_CONDITION");
  }

  const attention = rec(object.attention, "FIELD_SUMMARY_ATTENTION_REQUIRED");
  const attentionStatus = enumVal(attention.status, CUSTOMER_COLLECTION_STATES_V1, "FIELD_SUMMARY_ATTENTION_STATUS_INVALID");
  const attentionRefs = uniqueStrings(attention.attention_item_refs, "FIELD_SUMMARY_ATTENTION_REFS_INVALID");
  if (attentionStatus === "UNAVAILABLE") {
    if (attention.has_attention !== null || attentionRefs.length !== 0) throw new ProductProjectionContractError("FIELD_SUMMARY_ATTENTION_UNAVAILABLE_MUST_BE_UNKNOWN", "FIELD_SUMMARY_ATTENTION_UNAVAILABLE_MUST_BE_UNKNOWN");
  } else if (typeof attention.has_attention !== "boolean") {
    throw new ProductProjectionContractError("FIELD_SUMMARY_ATTENTION_BOOLEAN_REQUIRED", "FIELD_SUMMARY_ATTENTION_BOOLEAN_REQUIRED");
  }

  const recent = rec(object.recent_operation, "FIELD_SUMMARY_RECENT_OPERATION_REQUIRED");
  const recentStatus = enumVal(recent.status, CUSTOMER_COLLECTION_STATES_V1, "FIELD_SUMMARY_RECENT_OPERATION_STATUS_INVALID");
  if (recentStatus === "UNAVAILABLE" && recent.operation !== null) throw new ProductProjectionContractError("FIELD_SUMMARY_RECENT_OPERATION_UNAVAILABLE_MUST_BE_NULL", "FIELD_SUMMARY_RECENT_OPERATION_UNAVAILABLE_MUST_BE_NULL");
  if (recent.operation !== null) {
    const operation = rec(recent.operation, "FIELD_SUMMARY_RECENT_OPERATION_INVALID");
    txt(operation.operation_ref, "FIELD_SUMMARY_OPERATION_REF_REQUIRED");
    nullableTxt(operation.display_title);
    txt(operation.lifecycle_state, "FIELD_SUMMARY_OPERATION_STATE_REQUIRED");
    isoOrNull(operation.event_at, "FIELD_SUMMARY_OPERATION_EVENT_AT_INVALID");
  }

  enumVal(object.geometry_availability, CUSTOMER_GEOMETRY_AVAILABILITY_V1, "FIELD_SUMMARY_GEOMETRY_STATUS_INVALID");
  uniqueStrings(object.capability_refs, "FIELD_SUMMARY_CAPABILITY_REFS_INVALID");

  if (object.current_condition !== null) {
    const condition = object.current_condition as FieldCurrentConditionProjectionV1;
    const refKeys = new Set(envelope.source_authority_refs.map((ref) => ref.ref_key));
    if (condition.source_ref_key !== null && !refKeys.has(condition.source_ref_key)) {
      throw new ProductProjectionContractError("FIELD_SUMMARY_CONDITION_SOURCE_REF_UNKNOWN", "FIELD_SUMMARY_CONDITION_SOURCE_REF_UNKNOWN");
    }
  }
  assertNoInventedProductAuthorityFields(object);
}

export function assertFieldWorkspaceProjectionV1(input: unknown): asserts input is FieldWorkspaceProjectionV1 {
  const object = rec(input, "FIELD_WORKSPACE_REQUIRED");
  assertProductProjectionEnvelopeV1(object.envelope);
  const envelope = object.envelope as ProductProjectionEnvelopeV1;
  if (envelope.projection_type !== "FIELD_WORKSPACE") throw new ProductProjectionContractError("FIELD_WORKSPACE_PROJECTION_TYPE_INVALID", "FIELD_WORKSPACE_PROJECTION_TYPE_INVALID");
  const fieldRef = txt(object.field_ref, "FIELD_WORKSPACE_FIELD_REF_REQUIRED");
  if (envelope.subject_scope.field_id !== fieldRef) throw new ProductProjectionContractError("FIELD_WORKSPACE_SCOPE_FIELD_MISMATCH", "FIELD_WORKSPACE_SCOPE_FIELD_MISMATCH");
  assertIdentity(object.identity);
  if (object.current_condition !== null) assertCurrentCondition(object.current_condition);
  assertReporting(object.reporting_state);

  for (const key of ["recent_changes", "open_action_cases", "recent_operations", "observed_outcomes"] as const) {
    const collection = rec(object[key], `FIELD_WORKSPACE_${key.toUpperCase()}_REQUIRED`);
    const status = enumVal(collection.status, CUSTOMER_COLLECTION_STATES_V1, `FIELD_WORKSPACE_${key.toUpperCase()}_STATUS_INVALID`);
    const items = arr(collection.items, `FIELD_WORKSPACE_${key.toUpperCase()}_ITEMS_REQUIRED`);
    if (status === "UNAVAILABLE" && items.length !== 0) {
      throw new ProductProjectionContractError(`FIELD_WORKSPACE_${key.toUpperCase()}_UNAVAILABLE_MUST_BE_EMPTY`, `FIELD_WORKSPACE_${key.toUpperCase()}_UNAVAILABLE_MUST_BE_EMPTY`);
    }
  }

  const evidence = rec(object.evidence_summary, "FIELD_WORKSPACE_EVIDENCE_REQUIRED");
  for (const key of ["field_condition", "execution_evidence"] as const) {
    const row = rec(evidence[key], `FIELD_WORKSPACE_EVIDENCE_${key.toUpperCase()}_REQUIRED`);
    enumVal(row.status, CUSTOMER_AVAILABILITY_STATES_V1, `FIELD_WORKSPACE_EVIDENCE_${key.toUpperCase()}_STATUS_INVALID`);
    const count = numOrNull(row.artifact_count, `FIELD_WORKSPACE_EVIDENCE_${key.toUpperCase()}_COUNT_INVALID`);
    if (count !== null && (!Number.isInteger(count) || count < 0)) throw new ProductProjectionContractError("FIELD_WORKSPACE_EVIDENCE_COUNT_INVALID", "FIELD_WORKSPACE_EVIDENCE_COUNT_INVALID");
    uniqueStrings(row.reason_codes, `FIELD_WORKSPACE_EVIDENCE_${key.toUpperCase()}_REASONS_INVALID`);
  }

  for (const [index, item] of arr(object.capability_availability, "FIELD_WORKSPACE_CAPABILITIES_REQUIRED").entries()) {
    const row = rec(item, `FIELD_WORKSPACE_CAPABILITY_INVALID:${index}`);
    txt(row.capability_id, `FIELD_WORKSPACE_CAPABILITY_ID_REQUIRED:${index}`);
    enumVal(row.customer_state, ["AVAILABLE", "LIMITED", "PREVIEW", "NOT_YET_AVAILABLE"] as const, `FIELD_WORKSPACE_CAPABILITY_STATE_INVALID:${index}`);
  }

  const history = rec(object.history_summary, "FIELD_WORKSPACE_HISTORY_REQUIRED");
  enumVal(history.status, CUSTOMER_AVAILABILITY_STATES_V1, "FIELD_WORKSPACE_HISTORY_STATUS_INVALID");
  isoOrNull(history.latest_event_at, "FIELD_WORKSPACE_HISTORY_LATEST_EVENT_INVALID");
  uniqueStrings(history.reason_codes, "FIELD_WORKSPACE_HISTORY_REASONS_INVALID");

  const provenance = rec(object.provenance_summary, "FIELD_WORKSPACE_PROVENANCE_REQUIRED");
  if (provenance.source_authority_count !== envelope.source_authority_refs.length || provenance.source_non_authority_count !== envelope.source_non_authority_refs.length) {
    throw new ProductProjectionContractError("FIELD_WORKSPACE_PROVENANCE_COUNT_MISMATCH", "FIELD_WORKSPACE_PROVENANCE_COUNT_MISMATCH");
  }

  assertNoInventedProductAuthorityFields(object);
}

export function assertCustomerOverviewProjectionV1(input: unknown): asserts input is CustomerOverviewProjectionV1 {
  const object = rec(input, "CUSTOMER_OVERVIEW_REQUIRED");
  assertProductProjectionEnvelopeV1(object.envelope);
  const envelope = object.envelope as ProductProjectionEnvelopeV1;
  if (envelope.projection_type !== "CUSTOMER_OVERVIEW") throw new ProductProjectionContractError("CUSTOMER_OVERVIEW_PROJECTION_TYPE_INVALID", "CUSTOMER_OVERVIEW_PROJECTION_TYPE_INVALID");

  const fields = arr(object.field_previews, "CUSTOMER_OVERVIEW_FIELDS_REQUIRED");
  for (const field of fields) assertFieldSummaryProjectionV1(field);

  const summary = rec(object.reporting_summary, "CUSTOMER_OVERVIEW_REPORTING_SUMMARY_REQUIRED");
  const counts = ["total_fields", "current_fields", "limited_fields", "unavailable_fields"].map((key) => {
    const value = summary[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new ProductProjectionContractError(`CUSTOMER_OVERVIEW_${key.toUpperCase()}_INVALID`, `CUSTOMER_OVERVIEW_${key.toUpperCase()}_INVALID`);
    return value;
  });
  const expected = {
    total: fields.length,
    current: fields.filter((item) => (item as FieldSummaryProjectionV1).reporting_state.state === "CURRENT").length,
    limited: fields.filter((item) => (item as FieldSummaryProjectionV1).reporting_state.state === "LIMITED").length,
    unavailable: fields.filter((item) => (item as FieldSummaryProjectionV1).reporting_state.state === "UNAVAILABLE").length,
  };
  if (counts[0] !== expected.total || counts[1] !== expected.current || counts[2] !== expected.limited || counts[3] !== expected.unavailable) {
    throw new ProductProjectionContractError("CUSTOMER_OVERVIEW_REPORTING_SUMMARY_MISMATCH", "CUSTOMER_OVERVIEW_REPORTING_SUMMARY_MISMATCH");
  }

  for (const key of ["attention", "recent_operations", "latest_reports"] as const) {
    const collection = rec(object[key], `CUSTOMER_OVERVIEW_${key.toUpperCase()}_REQUIRED`);
    const status = enumVal(collection.status, CUSTOMER_COLLECTION_STATES_V1, `CUSTOMER_OVERVIEW_${key.toUpperCase()}_STATUS_INVALID`);
    const items = arr(collection.items, `CUSTOMER_OVERVIEW_${key.toUpperCase()}_ITEMS_REQUIRED`);
    if (status === "UNAVAILABLE" && items.length !== 0) {
      throw new ProductProjectionContractError(`CUSTOMER_OVERVIEW_${key.toUpperCase()}_UNAVAILABLE_MUST_BE_EMPTY`, `CUSTOMER_OVERVIEW_${key.toUpperCase()}_UNAVAILABLE_MUST_BE_EMPTY`);
    }
  }

  assertNoInventedProductAuthorityFields(object);
}
