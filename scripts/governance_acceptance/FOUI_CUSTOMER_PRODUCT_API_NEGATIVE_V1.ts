import assert from "node:assert/strict";

import {
  PRODUCT_PROJECTION_AUTHORITY_CEILING_V1,
  PRODUCT_PROJECTION_CONTRACT_VERSION_V1,
} from "../../apps/server/src/product_projection/contracts/product_projection_contracts_v1.js";
import {
  assertCustomerOverviewProjectionV1,
  assertFieldSummaryProjectionV1,
  assertFieldWorkspaceProjectionV1,
  type FieldSummaryProjectionV1,
  type FieldWorkspaceProjectionV1,
} from "../../apps/server/src/product_projection/contracts/customer_product_projection_contracts_v1.js";

const generatedAt = "2026-09-23T00:00:00.000Z";

function envelope(type: "FIELD_SUMMARY" | "FIELD_WORKSPACE" | "CUSTOMER_OVERVIEW", fieldId: string | null) {
  return {
    projection_id: `test:${type.toLowerCase()}`,
    projection_type: type,
    projection_schema_version: PRODUCT_PROJECTION_CONTRACT_VERSION_V1,
    generated_at: generatedAt,
    derivation_version: "geox.customer-product-projection.derivation.v1",
    subject_scope: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: fieldId,
      zone_id: null,
      season_id: null,
    },
    source_authority_refs: [],
    source_non_authority_refs: [],
    source_content_digests: [],
    source_effective_interval: {
      mode: "NOT_ESTABLISHED" as const,
      effective_from: null,
      effective_until: null,
      basis_ref_keys: [],
    },
    source_evidence_cutoff: null,
    authority_ceiling: PRODUCT_PROJECTION_AUTHORITY_CEILING_V1,
    limitations: [],
    freshness: {
      status: "UNKNOWN" as const,
      evaluated_at: generatedAt,
      basis: "UNESTABLISHED" as const,
      reason_codes: ["SOURCE_VALIDITY_HORIZON_NOT_DECLARED"],
    },
    projection_semantics: "CURRENT_PROJECTION" as const,
    non_authoritative: true as const,
  };
}

function summary(): FieldSummaryProjectionV1 {
  return {
    envelope: envelope("FIELD_SUMMARY", "field-1"),
    field_ref: "field-1",
    identity: {
      display_name: "Field 1",
      farm_display_name: null,
      crop_display_name: null,
      crop_stage_display: null,
      season_display: null,
      area: null,
      area_unit: null,
    },
    current_condition: null,
    reporting_state: {
      state: "UNAVAILABLE",
      reason_codes: ["MCFT_RUNTIME_SCOPE_NOT_ESTABLISHED"],
      last_qualified_at: null,
    },
    attention: {
      status: "UNAVAILABLE",
      has_attention: null,
      attention_item_refs: [],
    },
    recent_operation: {
      status: "UNAVAILABLE",
      operation: null,
    },
    geometry_availability: "UNAVAILABLE",
    capability_refs: [],
  };
}

const validSummary = summary();
assert.doesNotThrow(() => assertFieldSummaryProjectionV1(validSummary));

const inventedRisk = structuredClone(validSummary) as FieldSummaryProjectionV1 & { risk_score?: number };
inventedRisk.risk_score = 91;
assert.throws(
  () => assertFieldSummaryProjectionV1(inventedRisk),
  /CUSTOMER_PRODUCT_OWNED_AUTHORITY_FIELD_FORBIDDEN/,
);

const fakeCurrent = structuredClone(validSummary);
fakeCurrent.reporting_state.state = "CURRENT";
assert.throws(
  () => assertFieldSummaryProjectionV1(fakeCurrent),
  /FIELD_SUMMARY_CURRENT_REQUIRES_CONDITION/,
);

const fakeNoAttention = structuredClone(validSummary);
fakeNoAttention.attention.has_attention = false;
assert.throws(
  () => assertFieldSummaryProjectionV1(fakeNoAttention),
  /FIELD_SUMMARY_ATTENTION_UNAVAILABLE_MUST_BE_UNKNOWN/,
);

const workspace: FieldWorkspaceProjectionV1 = {
  envelope: envelope("FIELD_WORKSPACE", "field-1"),
  field_ref: "field-1",
  identity: validSummary.identity,
  current_condition: null,
  reporting_state: validSummary.reporting_state,
  recent_changes: { status: "UNAVAILABLE", items: [] },
  open_action_cases: { status: "UNAVAILABLE", items: [] },
  recent_operations: { status: "UNAVAILABLE", items: [] },
  evidence_summary: {
    field_condition: { status: "UNAVAILABLE", artifact_count: null, reason_codes: ["CURRENT_FIELD_CONDITION_UNAVAILABLE"] },
    execution_evidence: { status: "UNAVAILABLE", artifact_count: null, reason_codes: ["EXECUTION_EVIDENCE_NOT_PROJECTED_IN_FIRST_SLICE"] },
  },
  observed_outcomes: { status: "UNAVAILABLE", items: [] },
  capability_availability: [],
  history_summary: { status: "UNAVAILABLE", latest_event_at: null, reason_codes: ["FULL_FIELD_HISTORY_NOT_PROJECTED_IN_FIRST_SLICE"] },
  provenance_summary: { source_authority_count: 0, source_non_authority_count: 0 },
};
assert.doesNotThrow(() => assertFieldWorkspaceProjectionV1(workspace));

const fakeWorkspace = structuredClone(workspace);
fakeWorkspace.open_action_cases.items.push({
  action_case_projection_id: "fake",
  display_title: "Fake",
  display_phase: "AUTHORIZED",
  composition_status: "UNRESOLVED",
  source_ref_keys: [],
});
assert.throws(
  () => assertFieldWorkspaceProjectionV1(fakeWorkspace),
  /FIELD_WORKSPACE_OPEN_ACTION_CASES_UNAVAILABLE_MUST_BE_EMPTY/,
);

const overview = {
  envelope: envelope("CUSTOMER_OVERVIEW", null),
  reporting_summary: {
    total_fields: 1,
    current_fields: 0,
    limited_fields: 0,
    unavailable_fields: 1,
  },
  attention: { status: "UNAVAILABLE" as const, items: [] },
  field_previews: [validSummary],
  recent_operations: { status: "UNAVAILABLE" as const, items: [] },
  latest_reports: { status: "UNAVAILABLE" as const, items: [] },
};
assert.doesNotThrow(() => assertCustomerOverviewProjectionV1(overview));

const fakeOverview = structuredClone(overview);
fakeOverview.reporting_summary.current_fields = 1;
assert.throws(
  () => assertCustomerOverviewProjectionV1(fakeOverview),
  /CUSTOMER_OVERVIEW_REPORTING_SUMMARY_MISMATCH/,
);

console.log("FOUI_CUSTOMER_PRODUCT_API_NEGATIVE_V1=PASS");
