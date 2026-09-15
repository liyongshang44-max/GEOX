import assert from "node:assert/strict";
import {
  PRODUCT_PROJECTION_AUTHORITY_CEILING_V1,
  PRODUCT_PROJECTION_CONTRACT_VERSION_V1,
  ProductProjectionContractError,
  assertAttentionQueueProjectionV1,
  assertCapabilityAvailabilityProjectionV1,
  assertGovernedActionCaseProjectionV1,
  assertProductProjectionEnvelopeV1,
  assertProductProjectionInteractionHintsV1,
  deriveCapabilityAvailabilityStateV1,
  type ProductProjectionEnvelopeV1,
} from "../../apps/server/src/product_projection/contracts/product_projection_contracts_v1.ts";

const TS = "2026-09-15T12:00:00.000Z";

function envelope(
  projection_type: ProductProjectionEnvelopeV1["projection_type"],
  refs: Array<{ ref_key: string; authority_domain: "MCFT" | "ADR" | "B_LINE" | "OUTCOME" | "EXTERNAL"; authority_object_kind: string; exact_ref: string }> = [],
): ProductProjectionEnvelopeV1 {
  return {
    projection_id: `proj:${projection_type.toLowerCase()}:1`,
    projection_type,
    projection_schema_version: PRODUCT_PROJECTION_CONTRACT_VERSION_V1,
    generated_at: TS,
    derivation_version: "foui-proj-wave01-test-v1",
    subject_scope: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "field17",
      zone_id: "zoneB",
      season_id: "season2026",
    },
    source_authority_refs: refs.map((ref) => ({ ...ref, source_fact_ref: null })),
    source_content_digests: [],
    source_effective_interval: {
      mode: "NOT_ESTABLISHED",
      effective_from: null,
      effective_until: null,
      basis_ref_keys: [],
    },
    source_evidence_cutoff: null,
    authority_ceiling: PRODUCT_PROJECTION_AUTHORITY_CEILING_V1,
    limitations: [],
    freshness: {
      status: "CURRENT",
      evaluated_at: TS,
      basis: "UNESTABLISHED",
      reason_codes: [],
    },
    projection_semantics: "CURRENT_PROJECTION",
    non_authoritative: true,
  };
}

function slot(ref_key: string | null = null, source_status: string | null = null) {
  return { ref_key, source_status };
}

function chain() {
  return {
    agronomic_decision: slot(),
    recommendation_candidate: slot(),
    approval_request: slot(),
    approval_decision: slot(),
    operation_plan: slot(),
    execution_authorization: slot(),
    task: slot(),
    dispatch: slot(),
    executor: slot(),
    device: slot(),
    execution_receipt: slot(),
    as_executed: slot(),
    evidence_artifact_ref_keys: [],
    execution_evidence_acceptance: slot(),
    outcome_ref_keys: [],
    attribution: slot(),
  };
}

function unresolvedActionCase() {
  return {
    envelope: envelope("GOVERNED_ACTION_CASE", [
      { ref_key: "decision", authority_domain: "ADR" as const, authority_object_kind: "DecisionResult", exact_ref: "adr:decision:1" },
      { ref_key: "current_state", authority_domain: "MCFT" as const, authority_object_kind: "FieldState", exact_ref: "mcft:state:current" },
    ]),
    case_anchor: { source_ref_key: "decision", anchor_kind: "DECISION_RESULT" as const },
    action_type: "IRRIGATE",
    composition_status: "UNRESOLVED" as const,
    linkage_proofs: [],
    current_context: {
      current_projection_time: TS,
      current_field_state_ref_key: "current_state",
      current_state_effective_interval: null,
      current_forecast_ref_keys: [],
      current_limitation_reason_codes: [],
      current_context_status: "AVAILABLE" as const,
    },
    decision_time_basis: {
      basis_integrity: "UNAVAILABLE" as const,
      historical_basis_source: "UNAVAILABLE" as const,
      current_state_substitution_forbidden: true as const,
      decision_ref_key: "decision",
      decision_time: null,
      evidence_cutoff: null,
      decision_time_manifest_ref_key: null,
      field_state_ref_at_decision_key: null,
      applicability_ref_key: null,
      runtime_eligibility_ref_key: null,
      runtime_binding_ref_keys: [],
      decision_basis_ref_keys: [],
      provider_ref_keys: [],
      measurement_ref_keys: [],
      verification_state_ref_keys: [],
      decision_basis_digest: null,
      capture_integrity: "UNKNOWN" as const,
    },
    later_changes: {
      current_state_differs: "UNKNOWN" as const,
      later_evidence_available: "UNKNOWN" as const,
      later_arriving_or_revised_ref_keys: [],
      comparison_basis_ref_keys: [],
      comparison_limitation_reason_codes: [],
    },
    authority_chain: { ...chain(), agronomic_decision: slot("decision", "ACT") },
    derived_display_phase: "LINKAGE_INCOMPLETE" as const,
  };
}

function expectCode(code: string, fn: () => void): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof ProductProjectionContractError);
    assert.equal(error.code, code);
    return true;
  });
}

// PP-01: all projections are explicitly non-authoritative.
{
  const valid = envelope("ATTENTION_QUEUE");
  assert.doesNotThrow(() => assertProductProjectionEnvelopeV1(valid));
  expectCode("PRODUCT_PROJECTION_NON_AUTHORITATIVE_INVARIANT_VIOLATION", () =>
    assertProductProjectionEnvelopeV1({ ...valid, non_authoritative: false }),
  );
}

// Amendment-02: UI interaction hint never substitutes command authorization.
{
  const valid = envelope("GOVERNED_ACTION_CASE", [
    { ref_key: "approval", authority_domain: "B_LINE", authority_object_kind: "ApprovalRequest", exact_ref: "bline:approval:1" },
  ]);
  assert.doesNotThrow(() => assertProductProjectionInteractionHintsV1({
    caller_context_id: "caller:test",
    allowed_intents: [{
      intent: "APPROVE",
      command_owner: "B_LINE",
      required_capabilities: ["approval.decide"],
      target_authority_ref_keys: ["approval"],
      display_reason_code: "APPROVAL_PENDING_AND_CALLER_CAPABILITY_VISIBLE",
      requires_command_reauthorization: true,
    }],
  }, valid));
  expectCode("PRODUCT_PROJECTION_COMMAND_REAUTHORIZATION_REQUIRED", () =>
    assertProductProjectionInteractionHintsV1({
      caller_context_id: "caller:test",
      allowed_intents: [{
        intent: "APPROVE",
        command_owner: "B_LINE",
        required_capabilities: ["approval.decide"],
        target_authority_ref_keys: ["approval"],
        display_reason_code: "FORGED_HINT",
        requires_command_reauthorization: false,
      }],
    }, valid),
  );
}

// CAP-01/CAP-02/CAP-03: availability is derived from implementation + authority + operational eligibility.
{
  assert.deepEqual(
    deriveCapabilityAvailabilityStateV1({ product_implementation: "BUILT", authority_maturity: "AUTHORIZED", operational_eligibility: "CURRENT" }),
    { customer_state: "AVAILABLE", default_release_surface_state: "ACTIVE" },
  );
  assert.deepEqual(
    deriveCapabilityAvailabilityStateV1({ product_implementation: "BUILT", authority_maturity: "PREVIEW", operational_eligibility: "CURRENT" }),
    { customer_state: "PREVIEW", default_release_surface_state: "PREVIEW" },
  );
  assert.deepEqual(
    deriveCapabilityAvailabilityStateV1({ product_implementation: "BUILT", authority_maturity: "AUTHORIZED", operational_eligibility: "EXPIRED" }),
    { customer_state: "LIMITED", default_release_surface_state: "DISABLED" },
  );
  const preview = {
    envelope: envelope("CAPABILITY_AVAILABILITY", [
      { ref_key: "adr_shadow", authority_domain: "ADR" as const, authority_object_kind: "DecisionResultProjection", exact_ref: "adr:shadow:1" },
    ]),
    capability_id: "ADR_DECISION",
    availability_scope: { scope_kind: "FIELD" as const, field_id: "field17", zone_id: null, action_type: null },
    product_implementation: "BUILT" as const,
    authority_maturity: "PREVIEW" as const,
    operational_eligibility: "CURRENT" as const,
    customer_state: "PREVIEW" as const,
    default_release_surface_state: "PREVIEW" as const,
    reason_codes: ["ADR_AUTHORITATIVE_CUTOVER_NOT_COMPLETE"],
    product_release_basis_ref_keys: [],
    authority_maturity_basis_ref_keys: ["adr_shadow"],
    operational_eligibility_basis_ref_keys: [],
    evaluated_at: TS,
  };
  assert.doesNotThrow(() => assertCapabilityAvailabilityProjectionV1(preview));
  expectCode("CAPABILITY_AVAILABILITY_DERIVATION_MISMATCH", () =>
    assertCapabilityAvailabilityProjectionV1({ ...preview, customer_state: "AVAILABLE", default_release_surface_state: "ACTIVE" }),
  );
}

// AC-02: exact composition cannot be asserted without exact linkage proof.
{
  const action = unresolvedActionCase();
  assert.doesNotThrow(() => assertGovernedActionCaseProjectionV1(action));
  expectCode("GOVERNED_ACTION_CASE_EXACT_LINKAGE_PROOF_REQUIRED", () =>
    assertGovernedActionCaseProjectionV1({ ...action, composition_status: "EXACT_REF_LINKED" }),
  );
}

// AC-03/AC-04: historical basis never falls back to current MCFT state.
{
  const action = unresolvedActionCase();
  expectCode("GOVERNED_ACTION_CASE_UNAVAILABLE_BASIS_CANNOT_FALLBACK", () =>
    assertGovernedActionCaseProjectionV1({
      ...action,
      decision_time_basis: {
        ...action.decision_time_basis,
        field_state_ref_at_decision_key: "current_state",
      },
    }),
  );
  expectCode("GOVERNED_ACTION_CASE_CURRENT_STATE_SUBSTITUTION_FORBIDDEN", () =>
    assertGovernedActionCaseProjectionV1({
      ...action,
      decision_time_basis: {
        ...action.decision_time_basis,
        current_state_substitution_forbidden: false,
      },
    }),
  );
}

// AC-01: unresolved ADR/product linkage cannot be displayed as downstream approval state.
{
  const action = unresolvedActionCase();
  expectCode("GOVERNED_ACTION_CASE_UNRESOLVED_MUST_DISPLAY_LINKAGE_INCOMPLETE", () =>
    assertGovernedActionCaseProjectionV1({ ...action, derived_display_phase: "AWAITING_APPROVAL" }),
  );
}

// ATTN-01/02/03: product presentation rank is not domain priority/severity/risk authority.
{
  const valid = {
    envelope: envelope("ATTENTION_QUEUE", [
      { ref_key: "approval", authority_domain: "B_LINE" as const, authority_object_kind: "ApprovalRequest", exact_ref: "bline:approval:1" },
    ]),
    items: [{
      attention_id: "attention:1",
      subject_scope: envelope("ATTENTION_QUEUE").subject_scope,
      action_case_projection_id: null,
      attention_kind: "APPROVAL_PENDING",
      triage_bucket: "HUMAN_AUTHORITY_REQUIRED" as const,
      attention_reason_code: "APPROVAL_BLOCKING_ACTIVE_ACTION",
      source_authority_ref_keys: ["approval"],
      blocking_state: { source_ref_key: "approval", source_state: "PENDING" },
      source_effective_time: TS,
      source_evidence_cutoff: null,
      due: { due_at: null, due_basis: "NONE" as const, basis_ref_key: null },
      presentation_rank: 12,
      sort_reason_code: "APPROVAL_BLOCKING_ACTIVE_ACTION",
      source_declared_severity: null,
    }],
  };
  assert.doesNotThrow(() => assertAttentionQueueProjectionV1(valid));
  expectCode("ATTENTION_QUEUE_PRODUCT_OWNED_PRIORITY_FORBIDDEN", () =>
    assertAttentionQueueProjectionV1({
      ...valid,
      items: [{ ...valid.items[0], priority: "CRITICAL" }],
    }),
  );
  expectCode("ATTENTION_QUEUE_SOURCE_SEVERITY_REF_UNKNOWN", () =>
    assertAttentionQueueProjectionV1({
      ...valid,
      items: [{ ...valid.items[0], source_declared_severity: { value: "CRITICAL", source_ref_key: "missing" } }],
    }),
  );
}

console.log("FOUI_PRODUCT_PROJECTION_CONTRACT_WAVE_01_NEGATIVE_V1=PASS");
