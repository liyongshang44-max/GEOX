// GEOX FOUI Product API Wave-02 — Customer read projection contracts.
//
// Purpose: freeze the first post-P1/P2 Customer Product Projection contracts.
// Boundary: non-authoritative read models only. No database/network access, command authority,
// risk/severity/recommendation inference, approval, dispatch, execution, outcome, or attribution authority.

import {
  ProductProjectionContractError,
  assertProductProjectionEnvelopeV1,
  type ProductProjectionEnvelopeV1,
} from "../contracts/product_projection_contracts_v1.js";

export const CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1 =
  "geox.customer-product-projection.derivation.v1" as const;

export const CUSTOMER_PRODUCT_PROJECTION_TYPES_V1 = [
  "CUSTOMER_OVERVIEW",
  "FIELD_SUMMARY",
  "FIELD_WORKSPACE",
] as const;
export type CustomerProductProjectionTypeV1 =
  (typeof CUSTOMER_PRODUCT_PROJECTION_TYPES_V1)[number];

export type CustomerProductProjectionEnvelopeV1 =
  ProductProjectionEnvelopeV1 & { projection_type: CustomerProductProjectionTypeV1 };

export const FIELD_CONDITION_AVAILABILITY_V1 = ["AVAILABLE", "LIMITED", "UNAVAILABLE"] as const;
export type FieldConditionAvailabilityV1 = (typeof FIELD_CONDITION_AVAILABILITY_V1)[number];

export const FIELD_SUPPORT_STATES_V1 = ["SUPPORTED", "LIMITED", "UNAVAILABLE"] as const;
export type FieldSupportStateV1 = (typeof FIELD_SUPPORT_STATES_V1)[number];

export const FIELD_REPORTING_STATES_V1 = ["CURRENT", "LIMITED", "UNAVAILABLE"] as const;
export type FieldReportingStateV1 = (typeof FIELD_REPORTING_STATES_V1)[number];

export const PRODUCT_COLLECTION_STATUSES_V1 = ["AVAILABLE", "LIMITED", "UNAVAILABLE"] as const;
export type ProductCollectionStatusV1 = (typeof PRODUCT_COLLECTION_STATUSES_V1)[number];

export const FIELD_GEOMETRY_AVAILABILITY_V1 = ["AVAILABLE", "PARTIAL", "UNAVAILABLE"] as const;
export type FieldGeometryAvailabilityV1 = (typeof FIELD_GEOMETRY_AVAILABILITY_V1)[number];

export type FieldIdentityProjectionV1 = {
  display_name: string | null;
  display_name_status: "AVAILABLE" | "UNAVAILABLE";
  farm_display_name: string | null;
  crop_display_name: string | null;
  crop_stage_display: string | null;
  season_display: string | null;
  area: number | null;
  area_unit: "ha" | null;
};

export type RootZoneWaterConditionV1 = {
  available_water_fraction: number;
  depletion_from_field_capacity_mm: number;
  root_zone_water_storage_mm: {
    mean: number;
    stddev: number;
    interval_low: number;
    interval_high: number;
  };
  water_stress_state: {
    status: "NOT_ESTABLISHED";
    reason_code: string;
  };
  confidence: {
    status: "NOT_ESTABLISHED";
    reason_code: string;
  };
};

export type FieldCurrentConditionProjectionV1 = {
  status: FieldConditionAvailabilityV1;
  condition_kind: "ROOT_ZONE_WATER_STATE";
  effective_at: string | null;
  support_state: FieldSupportStateV1;
  source_ref_key: string | null;
  root_zone_water: RootZoneWaterConditionV1 | null;
  reason_codes: readonly string[];
};

export type FieldReportingProjectionV1 = {
  state: FieldReportingStateV1;
  reason_codes: readonly string[];
  last_qualified_at: string | null;
};

export type FieldAttentionProjectionV1 = {
  status: ProductCollectionStatusV1;
  has_attention: boolean | null;
  attention_item_refs: readonly string[];
  reason_codes: readonly string[];
};

export type FieldRecentOperationProjectionV1 = {
  operation_ref: string;
  display_title: string;
  lifecycle_state: string;
  event_at: string | null;
};

export type FieldSummaryProjectionV1 = {
  envelope: CustomerProductProjectionEnvelopeV1 & { projection_type: "FIELD_SUMMARY" };
  field_ref: string;
  identity: FieldIdentityProjectionV1;
  current_condition: FieldCurrentConditionProjectionV1;
  reporting_state: FieldReportingProjectionV1;
  attention: FieldAttentionProjectionV1;
  recent_operation: FieldRecentOperationProjectionV1 | null;
  geometry_availability: FieldGeometryAvailabilityV1;
  capability_refs: readonly string[];
  limitation_reason_codes: readonly string[];
};

export type ProductCollectionV1<T> = {
  status: ProductCollectionStatusV1;
  items: readonly T[];
  reason_codes: readonly string[];
};

export type FieldWorkspaceRecentChangeV1 = {
  change_ref: string;
  display_title: string;
  display_summary: string | null;
  event_at: string | null;
  source_ref_keys: readonly string[];
};

export type FieldWorkspaceActionCaseV1 = {
  action_case_projection_id: string;
  display_title: string;
  display_phase: string;
  composition_status: "EXACT_REF_LINKED" | "PARTIAL_REF_LINKED" | "UNRESOLVED";
  source_ref_keys: readonly string[];
};

export type FieldWorkspaceOperationV1 = {
  operation_ref: string;
  display_title: string;
  lifecycle_state: string;
  event_at: string | null;
  evidence_state: string | null;
};

export type FieldWorkspaceEvidenceSummaryV1 = {
  field_condition: {
    status: ProductCollectionStatusV1;
    artifact_count: number | null;
    reason_codes: readonly string[];
  };
  execution_evidence: {
    status: ProductCollectionStatusV1;
    artifact_count: number | null;
    reason_codes: readonly string[];
  };
};

export type FieldWorkspaceObservedOutcomeV1 = {
  outcome_ref: string;
  display_summary: string;
  observed_at: string | null;
  attribution_state: "ESTABLISHED" | "NOT_ESTABLISHED" | "UNAVAILABLE";
};

export type FieldWorkspaceCapabilityV1 = {
  capability_id: string;
  customer_state: "AVAILABLE" | "LIMITED" | "PREVIEW" | "NOT_YET_AVAILABLE";
};

export type FieldWorkspaceProjectionV1 = {
  envelope: CustomerProductProjectionEnvelopeV1 & { projection_type: "FIELD_WORKSPACE" };
  field_ref: string;
  identity: FieldIdentityProjectionV1;
  current_condition: FieldCurrentConditionProjectionV1;
  reporting_state: FieldReportingProjectionV1;
  recent_changes: ProductCollectionV1<FieldWorkspaceRecentChangeV1>;
  open_action_cases: ProductCollectionV1<FieldWorkspaceActionCaseV1>;
  recent_operations: ProductCollectionV1<FieldWorkspaceOperationV1>;
  evidence_summary: FieldWorkspaceEvidenceSummaryV1;
  observed_outcomes: ProductCollectionV1<FieldWorkspaceObservedOutcomeV1>;
  capability_availability: ProductCollectionV1<FieldWorkspaceCapabilityV1>;
  history_summary: {
    status: ProductCollectionStatusV1;
    latest_event_at: string | null;
    reason_codes: readonly string[];
  };
  limitation_reason_codes: readonly string[];
  provenance_summary: {
    source_authority_count: number;
    source_non_authority_count: number;
  };
};

export type CustomerOverviewAttentionItemV1 = {
  attention_id: string;
  display_title: string;
  display_summary: string | null;
  triage_bucket: "NEEDS_REVIEW" | "WAITING" | "INFORMATION_LIMITED";
  blocking_state: string | null;
  event_at: string | null;
  navigation_target: string;
  source_ref_keys: readonly string[];
};

export type CustomerOverviewOperationV1 = {
  operation_ref: string;
  display_title: string;
  field_display_name: string | null;
  lifecycle_state: string;
  event_at: string | null;
};

export type CustomerOverviewReportV1 = {
  report_ref: string;
  display_title: string;
  availability: "AVAILABLE" | "LIMITED" | "NOT_YET_AVAILABLE";
};

export type CustomerOverviewProjectionV1 = {
  envelope: CustomerProductProjectionEnvelopeV1 & { projection_type: "CUSTOMER_OVERVIEW" };
  reporting_summary: {
    total_fields: number;
    current_fields: number;
    limited_fields: number;
    unavailable_fields: number;
  };
  attention_items: ProductCollectionV1<CustomerOverviewAttentionItemV1>;
  field_previews: readonly FieldSummaryProjectionV1[];
  recent_operations: ProductCollectionV1<CustomerOverviewOperationV1>;
  latest_reports: ProductCollectionV1<CustomerOverviewReportV1>;
  limitation_reason_codes: readonly string[];
};

export const PRODUCT_API_RESPONSE_SCHEMA_V1 = "geox.product-api.response.v1" as const;

export type ProductApiSingleResponseV1<T> = {
  schema_version: typeof PRODUCT_API_RESPONSE_SCHEMA_V1;
  request_id: string;
  generated_at: string;
  derivation_version: typeof CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1;
  projection: T;
};

export type ProductApiCollectionResponseV1<T> = {
  schema_version: typeof PRODUCT_API_RESPONSE_SCHEMA_V1;
  request_id: string;
  generated_at: string;
  derivation_version: typeof CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1;
  items: readonly T[];
  count: number;
  limitation_reason_codes: readonly string[];
};

function fail(code: string, detail?: string): never {
  throw new ProductProjectionContractError(code, detail ? `${code}:${detail}` : code);
}

function objectV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
}

function nonEmptyTextV1(value: unknown, code: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) fail(code);
  return normalized;
}

function nullableTextV1(value: unknown, code: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") fail(code);
  return value.trim() || null;
}

function isoOrNullV1(value: unknown, code: string): string | null {
  const text = nullableTextV1(value, code);
  if (text === null) return null;
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || !/(Z|[+-]\d{2}:\d{2})$/.test(text)) fail(code);
  return new Date(parsed).toISOString();
}

function finiteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(code);
  return value;
}

function nonNegativeNumberV1(value: unknown, code: string): number {
  const number = finiteNumberV1(value, code);
  if (number < 0) fail(code);
  return number;
}

function stringArrayV1(value: unknown, code: string): readonly string[] {
  if (!Array.isArray(value)) fail(code);
  const out = value.map((item, index) => nonEmptyTextV1(item, `${code}:${index}`));
  if (new Set(out).size !== out.length) fail(`${code}:DUPLICATE`);
  return out;
}

function enumV1<T extends readonly string[]>(value: unknown, allowed: T, code: string): T[number] {
  const text = nonEmptyTextV1(value, code);
  if (!(allowed as readonly string[]).includes(text)) fail(code, text);
  return text as T[number];
}

function assertNoProductAuthorityInferenceV1(value: unknown, code: string): void {
  const forbidden = new Set([
    "risk",
    "risk_level",
    "risk_score",
    "severity",
    "recommendation",
    "approval",
    "authorization",
    "dispatch",
    "execution_truth",
    "outcome",
    "attribution",
    "priority",
  ]);
  const visit = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
      if (forbidden.has(key)) fail(code, `${path}.${key}`);
      visit(item, `${path}.${key}`);
    }
  };
  visit(value, "$");
}

function assertEnvelopeV1(
  value: unknown,
  expectedType: CustomerProductProjectionTypeV1,
): asserts value is CustomerProductProjectionEnvelopeV1 {
  assertProductProjectionEnvelopeV1(value);
  if (value.projection_type !== expectedType) fail("CUSTOMER_PRODUCT_PROJECTION_TYPE_MISMATCH");
  if (value.projection_semantics !== "CURRENT_PROJECTION") fail("CUSTOMER_PRODUCT_PROJECTION_CURRENT_SEMANTICS_REQUIRED");
  if (value.non_authoritative !== true) fail("CUSTOMER_PRODUCT_PROJECTION_NON_AUTHORITATIVE_REQUIRED");
}

function assertIdentityV1(value: unknown): asserts value is FieldIdentityProjectionV1 {
  const identity = objectV1(value, "FIELD_IDENTITY_REQUIRED");
  enumV1(identity.display_name_status, ["AVAILABLE", "UNAVAILABLE"] as const, "FIELD_DISPLAY_NAME_STATUS_INVALID");
  const displayName = nullableTextV1(identity.display_name, "FIELD_DISPLAY_NAME_INVALID");
  if (identity.display_name_status === "AVAILABLE" && !displayName) fail("FIELD_DISPLAY_NAME_REQUIRED_WHEN_AVAILABLE");
  if (identity.display_name_status === "UNAVAILABLE" && displayName !== null) fail("FIELD_DISPLAY_NAME_MUST_BE_NULL_WHEN_UNAVAILABLE");
  for (const key of ["farm_display_name", "crop_display_name", "crop_stage_display", "season_display"] as const) {
    nullableTextV1(identity[key], `FIELD_IDENTITY_${key.toUpperCase()}_INVALID`);
  }
  if (identity.area !== null) nonNegativeNumberV1(identity.area, "FIELD_AREA_INVALID");
  if (identity.area_unit !== null && identity.area_unit !== "ha") fail("FIELD_AREA_UNIT_INVALID");
}

function assertRootZoneWaterV1(value: unknown): asserts value is RootZoneWaterConditionV1 {
  const water = objectV1(value, "FIELD_ROOT_ZONE_WATER_REQUIRED");
  const available = finiteNumberV1(water.available_water_fraction, "FIELD_AVAILABLE_WATER_INVALID");
  if (available < 0 || available > 1) fail("FIELD_AVAILABLE_WATER_OUT_OF_RANGE");
  nonNegativeNumberV1(water.depletion_from_field_capacity_mm, "FIELD_DEPLETION_INVALID");
  const storage = objectV1(water.root_zone_water_storage_mm, "FIELD_ROOT_ZONE_STORAGE_REQUIRED");
  const low = nonNegativeNumberV1(storage.interval_low, "FIELD_ROOT_ZONE_STORAGE_INTERVAL_LOW_INVALID");
  const mean = nonNegativeNumberV1(storage.mean, "FIELD_ROOT_ZONE_STORAGE_MEAN_INVALID");
  const high = nonNegativeNumberV1(storage.interval_high, "FIELD_ROOT_ZONE_STORAGE_INTERVAL_HIGH_INVALID");
  nonNegativeNumberV1(storage.stddev, "FIELD_ROOT_ZONE_STORAGE_STDDEV_INVALID");
  if (low > mean || mean > high) fail("FIELD_ROOT_ZONE_STORAGE_INTERVAL_ORDER_INVALID");
  const stress = objectV1(water.water_stress_state, "FIELD_WATER_STRESS_STATE_REQUIRED");
  if (stress.status !== "NOT_ESTABLISHED") fail("FIELD_WATER_STRESS_PRODUCT_INFERENCE_FORBIDDEN");
  nonEmptyTextV1(stress.reason_code, "FIELD_WATER_STRESS_REASON_REQUIRED");
  const confidence = objectV1(water.confidence, "FIELD_CONFIDENCE_REQUIRED");
  if (confidence.status !== "NOT_ESTABLISHED") fail("FIELD_CONFIDENCE_PRODUCT_INFERENCE_FORBIDDEN");
  nonEmptyTextV1(confidence.reason_code, "FIELD_CONFIDENCE_REASON_REQUIRED");
}

function assertCurrentConditionV1(value: unknown): asserts value is FieldCurrentConditionProjectionV1 {
  const condition = objectV1(value, "FIELD_CURRENT_CONDITION_REQUIRED");
  const status = enumV1(condition.status, FIELD_CONDITION_AVAILABILITY_V1, "FIELD_CONDITION_STATUS_INVALID");
  if (condition.condition_kind !== "ROOT_ZONE_WATER_STATE") fail("FIELD_CONDITION_KIND_INVALID");
  isoOrNullV1(condition.effective_at, "FIELD_CONDITION_EFFECTIVE_AT_INVALID");
  enumV1(condition.support_state, FIELD_SUPPORT_STATES_V1, "FIELD_SUPPORT_STATE_INVALID");
  nullableTextV1(condition.source_ref_key, "FIELD_CONDITION_SOURCE_REF_INVALID");
  stringArrayV1(condition.reason_codes, "FIELD_CONDITION_REASON_CODES_INVALID");
  if (status === "AVAILABLE") {
    if (condition.root_zone_water === null) fail("FIELD_ROOT_ZONE_WATER_REQUIRED_WHEN_AVAILABLE");
    assertRootZoneWaterV1(condition.root_zone_water);
    if (condition.support_state !== "SUPPORTED") fail("FIELD_AVAILABLE_CONDITION_MUST_BE_SUPPORTED");
    if (condition.source_ref_key === null) fail("FIELD_AVAILABLE_CONDITION_SOURCE_REF_REQUIRED");
    if (condition.effective_at === null) fail("FIELD_AVAILABLE_CONDITION_EFFECTIVE_AT_REQUIRED");
  } else if (condition.root_zone_water !== null) {
    assertRootZoneWaterV1(condition.root_zone_water);
  }
}

function assertReportingV1(value: unknown, condition: FieldCurrentConditionProjectionV1): asserts value is FieldReportingProjectionV1 {
  const reporting = objectV1(value, "FIELD_REPORTING_STATE_REQUIRED");
  const state = enumV1(reporting.state, FIELD_REPORTING_STATES_V1, "FIELD_REPORTING_STATE_INVALID");
  stringArrayV1(reporting.reason_codes, "FIELD_REPORTING_REASON_CODES_INVALID");
  isoOrNullV1(reporting.last_qualified_at, "FIELD_REPORTING_LAST_QUALIFIED_INVALID");
  if (state === "CURRENT" && condition.status !== "AVAILABLE") fail("FIELD_CURRENT_REPORTING_REQUIRES_AVAILABLE_CONDITION");
}

function assertAttentionV1(value: unknown): asserts value is FieldAttentionProjectionV1 {
  const attention = objectV1(value, "FIELD_ATTENTION_REQUIRED");
  const status = enumV1(attention.status, PRODUCT_COLLECTION_STATUSES_V1, "FIELD_ATTENTION_STATUS_INVALID");
  stringArrayV1(attention.attention_item_refs, "FIELD_ATTENTION_REFS_INVALID");
  stringArrayV1(attention.reason_codes, "FIELD_ATTENTION_REASON_CODES_INVALID");
  if (status === "AVAILABLE") {
    if (typeof attention.has_attention !== "boolean") fail("FIELD_ATTENTION_BOOLEAN_REQUIRED");
  } else if (attention.has_attention !== null) {
    fail("FIELD_ATTENTION_UNKNOWN_MUST_BE_NULL");
  }
}

function assertCollectionV1(value: unknown, code: string): asserts value is ProductCollectionV1<unknown> {
  const collection = objectV1(value, code);
  enumV1(collection.status, PRODUCT_COLLECTION_STATUSES_V1, `${code}:STATUS`);
  if (!Array.isArray(collection.items)) fail(`${code}:ITEMS`);
  stringArrayV1(collection.reason_codes, `${code}:REASONS`);
}

export function assertFieldSummaryProjectionV1(input: unknown): asserts input is FieldSummaryProjectionV1 {
  const projection = objectV1(input, "FIELD_SUMMARY_PROJECTION_REQUIRED");
  assertNoProductAuthorityInferenceV1(projection, "FIELD_SUMMARY_PRODUCT_AUTHORITY_INFERENCE_FORBIDDEN");
  assertEnvelopeV1(projection.envelope, "FIELD_SUMMARY");
  nonEmptyTextV1(projection.field_ref, "FIELD_SUMMARY_FIELD_REF_REQUIRED");
  assertIdentityV1(projection.identity);
  assertCurrentConditionV1(projection.current_condition);
  assertReportingV1(projection.reporting_state, projection.current_condition as FieldCurrentConditionProjectionV1);
  assertAttentionV1(projection.attention);
  if (projection.recent_operation !== null) {
    const operation = objectV1(projection.recent_operation, "FIELD_RECENT_OPERATION_INVALID");
    nonEmptyTextV1(operation.operation_ref, "FIELD_RECENT_OPERATION_REF_REQUIRED");
    nonEmptyTextV1(operation.display_title, "FIELD_RECENT_OPERATION_TITLE_REQUIRED");
    nonEmptyTextV1(operation.lifecycle_state, "FIELD_RECENT_OPERATION_STATE_REQUIRED");
    isoOrNullV1(operation.event_at, "FIELD_RECENT_OPERATION_TIME_INVALID");
  }
  enumV1(projection.geometry_availability, FIELD_GEOMETRY_AVAILABILITY_V1, "FIELD_GEOMETRY_AVAILABILITY_INVALID");
  stringArrayV1(projection.capability_refs, "FIELD_CAPABILITY_REFS_INVALID");
  stringArrayV1(projection.limitation_reason_codes, "FIELD_LIMITATION_REASON_CODES_INVALID");
}

export function assertFieldWorkspaceProjectionV1(input: unknown): asserts input is FieldWorkspaceProjectionV1 {
  const projection = objectV1(input, "FIELD_WORKSPACE_PROJECTION_REQUIRED");
  assertNoProductAuthorityInferenceV1(projection, "FIELD_WORKSPACE_PRODUCT_AUTHORITY_INFERENCE_FORBIDDEN");
  assertEnvelopeV1(projection.envelope, "FIELD_WORKSPACE");
  nonEmptyTextV1(projection.field_ref, "FIELD_WORKSPACE_FIELD_REF_REQUIRED");
  assertIdentityV1(projection.identity);
  assertCurrentConditionV1(projection.current_condition);
  assertReportingV1(projection.reporting_state, projection.current_condition as FieldCurrentConditionProjectionV1);
  for (const key of ["recent_changes", "open_action_cases", "recent_operations", "observed_outcomes", "capability_availability"] as const) {
    assertCollectionV1(projection[key], `FIELD_WORKSPACE_${key.toUpperCase()}_INVALID`);
  }
  const evidence = objectV1(projection.evidence_summary, "FIELD_WORKSPACE_EVIDENCE_SUMMARY_REQUIRED");
  for (const key of ["field_condition", "execution_evidence"] as const) {
    const item = objectV1(evidence[key], `FIELD_WORKSPACE_EVIDENCE_${key.toUpperCase()}_INVALID`);
    enumV1(item.status, PRODUCT_COLLECTION_STATUSES_V1, `FIELD_WORKSPACE_EVIDENCE_${key.toUpperCase()}_STATUS_INVALID`);
    if (item.artifact_count !== null) nonNegativeNumberV1(item.artifact_count, `FIELD_WORKSPACE_EVIDENCE_${key.toUpperCase()}_COUNT_INVALID`);
    stringArrayV1(item.reason_codes, `FIELD_WORKSPACE_EVIDENCE_${key.toUpperCase()}_REASONS_INVALID`);
  }
  const history = objectV1(projection.history_summary, "FIELD_WORKSPACE_HISTORY_REQUIRED");
  enumV1(history.status, PRODUCT_COLLECTION_STATUSES_V1, "FIELD_WORKSPACE_HISTORY_STATUS_INVALID");
  isoOrNullV1(history.latest_event_at, "FIELD_WORKSPACE_HISTORY_LATEST_INVALID");
  stringArrayV1(history.reason_codes, "FIELD_WORKSPACE_HISTORY_REASONS_INVALID");
  stringArrayV1(projection.limitation_reason_codes, "FIELD_WORKSPACE_LIMITATIONS_INVALID");
  const provenance = objectV1(projection.provenance_summary, "FIELD_WORKSPACE_PROVENANCE_REQUIRED");
  nonNegativeNumberV1(provenance.source_authority_count, "FIELD_WORKSPACE_AUTHORITY_COUNT_INVALID");
  nonNegativeNumberV1(provenance.source_non_authority_count, "FIELD_WORKSPACE_NON_AUTHORITY_COUNT_INVALID");
}

export function assertCustomerOverviewProjectionV1(input: unknown): asserts input is CustomerOverviewProjectionV1 {
  const projection = objectV1(input, "CUSTOMER_OVERVIEW_PROJECTION_REQUIRED");
  assertNoProductAuthorityInferenceV1(projection, "CUSTOMER_OVERVIEW_PRODUCT_AUTHORITY_INFERENCE_FORBIDDEN");
  assertEnvelopeV1(projection.envelope, "CUSTOMER_OVERVIEW");
  const summary = objectV1(projection.reporting_summary, "CUSTOMER_OVERVIEW_REPORTING_SUMMARY_REQUIRED");
  const total = nonNegativeNumberV1(summary.total_fields, "CUSTOMER_OVERVIEW_TOTAL_FIELDS_INVALID");
  const current = nonNegativeNumberV1(summary.current_fields, "CUSTOMER_OVERVIEW_CURRENT_FIELDS_INVALID");
  const limited = nonNegativeNumberV1(summary.limited_fields, "CUSTOMER_OVERVIEW_LIMITED_FIELDS_INVALID");
  const unavailable = nonNegativeNumberV1(summary.unavailable_fields, "CUSTOMER_OVERVIEW_UNAVAILABLE_FIELDS_INVALID");
  if (current + limited + unavailable !== total) fail("CUSTOMER_OVERVIEW_REPORTING_SUMMARY_MISMATCH");
  for (const key of ["attention_items", "recent_operations", "latest_reports"] as const) {
    assertCollectionV1(projection[key], `CUSTOMER_OVERVIEW_${key.toUpperCase()}_INVALID`);
  }
  if (!Array.isArray(projection.field_previews)) fail("CUSTOMER_OVERVIEW_FIELD_PREVIEWS_REQUIRED");
  for (const item of projection.field_previews) assertFieldSummaryProjectionV1(item);
  if (projection.field_previews.length !== total) fail("CUSTOMER_OVERVIEW_FIELD_COUNT_MISMATCH");
  stringArrayV1(projection.limitation_reason_codes, "CUSTOMER_OVERVIEW_LIMITATIONS_INVALID");
}
