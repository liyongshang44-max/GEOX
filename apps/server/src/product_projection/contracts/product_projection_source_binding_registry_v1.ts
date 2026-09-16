// GEOX FOUI-PROJECTION-CONTRACT-WAVE-01 — source binding registry.
//
// Purpose: constrain which exact MCFT / ADR / B-Line source objects may populate each
// product-projection role. The registry is a construction/qualification guard only.
// It does not mint authority, adjudicate domain truth, authorize commands, or become
// part of the returned customer projection.

import {
  ProductProjectionContractError,
  type GovernedActionCaseProjectionV1,
  type ProductProjectionAuthorityDomainV1,
  type ProductProjectionEnvelopeV1,
  type ProductProjectionNonAuthorityRefClassV1,
} from "./product_projection_contracts_v1.js";

export const PRODUCT_PROJECTION_SOURCE_BINDING_REGISTRY_VERSION_V1 =
  "geox.product-projection.source-binding-registry.v1" as const;

export const PRODUCT_PROJECTION_SOURCE_REF_NAMESPACES_V1 = [
  "AUTHORITY",
  "NON_AUTHORITY",
] as const;
export type ProductProjectionSourceRefNamespaceV1 =
  (typeof PRODUCT_PROJECTION_SOURCE_REF_NAMESPACES_V1)[number];

export const PRODUCT_PROJECTION_SOURCE_OBJECT_KIND_MODES_V1 = [
  "EXACT",
  "SOURCE_DECLARED",
] as const;
export type ProductProjectionSourceObjectKindModeV1 =
  (typeof PRODUCT_PROJECTION_SOURCE_OBJECT_KIND_MODES_V1)[number];

export const PRODUCT_PROJECTION_SOURCE_ROLES_V1 = [
  "ACTION_CURRENT_FIELD_STATE",
  "ACTION_CURRENT_FORECAST",
  "ACTION_DECISION_TIME_FIELD_STATE",
  "ACTION_DECISION_BASIS",
  "ACTION_APPLICABILITY",
  "ACTION_RUNTIME_ELIGIBILITY",
  "ACTION_RUNTIME_BINDING",
  "ACTION_AGRONOMIC_DECISION",
  "ACTION_RECOMMENDATION_CANDIDATE",
  "ACTION_APPROVAL_REQUEST",
  "ACTION_APPROVAL_DECISION",
  "ACTION_OPERATION_PLAN",
  "ACTION_TASK",
  "ACTION_DISPATCH",
  "ACTION_EXECUTION_RECEIPT",
  "ACTION_AS_EXECUTED",
  "ACTION_EVIDENCE_ARTIFACT",
  "ACTION_EXECUTION_EVIDENCE_ACCEPTANCE",
  "ACTION_DECISION_TIME_MANIFEST",
  "ACTION_PROVIDER_BASIS",
  "ACTION_MEASUREMENT_BASIS",
  "ACTION_VERIFICATION_STATE_BASIS",
  "ACTION_EXECUTION_MATERIAL",
  "CAPABILITY_PRODUCT_RELEASE_BASIS",
  "CAPABILITY_AUTHORITY_MATURITY_BASIS",
  "CAPABILITY_OPERATIONAL_ELIGIBILITY_BASIS",
  "ATTENTION_AUTHORITY_SOURCE",
] as const;
export type ProductProjectionSourceRoleV1 =
  (typeof PRODUCT_PROJECTION_SOURCE_ROLES_V1)[number];

export type ProductProjectionSourceBindingRegistrationV1 = {
  binding_id: string;
  ref_namespace: ProductProjectionSourceRefNamespaceV1;
  source_system: "MCFT" | "ADR" | "B_LINE" | "FOUI_GOVERNANCE" | "EXTERNAL_BASIS";
  authority_domain: ProductProjectionAuthorityDomainV1 | null;
  non_authority_ref_class: ProductProjectionNonAuthorityRefClassV1 | null;
  object_kind_mode: ProductProjectionSourceObjectKindModeV1;
  allowed_object_kinds: readonly string[];
  source_contract: string;
  source_contract_version: string | null;
  allowed_source_paths: readonly string[];
  allowed_product_roles: readonly ProductProjectionSourceRoleV1[];
  source_authority_preserved: boolean;
  non_authoritative_binding_metadata: true;
};

function authorityRegistration(input: Omit<
  ProductProjectionSourceBindingRegistrationV1,
  "ref_namespace" | "non_authority_ref_class" | "source_authority_preserved" | "non_authoritative_binding_metadata"
>): ProductProjectionSourceBindingRegistrationV1 {
  return Object.freeze({
    ...input,
    ref_namespace: "AUTHORITY" as const,
    non_authority_ref_class: null,
    source_authority_preserved: true,
    non_authoritative_binding_metadata: true as const,
  });
}

function nonAuthorityRegistration(input: Omit<
  ProductProjectionSourceBindingRegistrationV1,
  "ref_namespace" | "authority_domain" | "source_authority_preserved" | "non_authoritative_binding_metadata"
>): ProductProjectionSourceBindingRegistrationV1 {
  return Object.freeze({
    ...input,
    ref_namespace: "NON_AUTHORITY" as const,
    authority_domain: null,
    source_authority_preserved: false,
    non_authoritative_binding_metadata: true as const,
  });
}

// Important: an entry says only that a source object may be *referenced* for a product role.
// It never upgrades the source object's authority and never supplies missing authority.
export const PRODUCT_PROJECTION_SOURCE_BINDINGS_V1 = Object.freeze([
  authorityRegistration({
    binding_id: "MCFT_RUNTIME_POSTERIOR_STATE_V1",
    source_system: "MCFT",
    authority_domain: "MCFT",
    object_kind_mode: "SOURCE_DECLARED",
    allowed_object_kinds: [],
    source_contract: "MinimalFieldTwinRuntimeReadModelV1 / FieldTwinCanonicalObjectRefV1",
    source_contract_version: "minimal_field_twin_runtime_read_model_v1",
    allowed_source_paths: ["posterior_state"],
    allowed_product_roles: ["ACTION_CURRENT_FIELD_STATE", "ACTION_DECISION_TIME_FIELD_STATE"],
  }),
  authorityRegistration({
    binding_id: "MCFT_RUNTIME_FORECAST_REF_V1",
    source_system: "MCFT",
    authority_domain: "MCFT",
    object_kind_mode: "SOURCE_DECLARED",
    allowed_object_kinds: [],
    source_contract: "MinimalFieldTwinRuntimeReadModelV1 / FieldTwinCanonicalObjectRefV1",
    source_contract_version: "minimal_field_twin_runtime_read_model_v1",
    allowed_source_paths: [
      "current_tick_forecast_result",
      "latest_successful_forecast.item",
      "scenario_source_forecast.item",
    ],
    allowed_product_roles: ["ACTION_CURRENT_FORECAST"],
  }),

  authorityRegistration({
    binding_id: "ADR_APPLICABILITY_ASSESSMENT_V1",
    source_system: "ADR",
    authority_domain: "ADR",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["ApplicabilityAssessment"],
    source_contract: "packages/applicability/src/authority.mjs",
    source_contract_version: "adr.applicability-assessment.v1",
    allowed_source_paths: ["AuthorityLedger.resolve(ApplicabilityAssessment)"],
    allowed_product_roles: ["ACTION_APPLICABILITY", "ACTION_DECISION_BASIS"],
  }),
  authorityRegistration({
    binding_id: "ADR_RUNTIME_ELIGIBILITY_V1",
    source_system: "ADR",
    authority_domain: "ADR",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["RuntimeEligibility"],
    source_contract: "packages/runtime-eligibility/src/authority.mjs",
    source_contract_version: "adr.runtime-eligibility.v1",
    allowed_source_paths: ["AuthorityLedger.resolve(RuntimeEligibility)"],
    allowed_product_roles: ["ACTION_RUNTIME_ELIGIBILITY", "ACTION_DECISION_BASIS"],
  }),
  authorityRegistration({
    binding_id: "ADR_RUNTIME_BINDING_V1",
    source_system: "ADR",
    authority_domain: "ADR",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["RuntimeBinding"],
    source_contract: "packages/runtime-binding/src/authority.mjs",
    source_contract_version: "adr.runtime-binding.v1",
    allowed_source_paths: ["AuthorityLedger.resolve(RuntimeBinding)"],
    allowed_product_roles: ["ACTION_RUNTIME_BINDING", "ACTION_DECISION_BASIS"],
  }),
  authorityRegistration({
    binding_id: "ADR_DECISION_RESULT_V1",
    source_system: "ADR",
    authority_domain: "ADR",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["DecisionResult"],
    source_contract: "packages/decision-result/src/authority.mjs",
    source_contract_version: "adr.decision-result.v1",
    allowed_source_paths: ["AuthorityLedger.resolve(DecisionResult)"],
    allowed_product_roles: ["ACTION_AGRONOMIC_DECISION", "ACTION_DECISION_BASIS", "CAPABILITY_AUTHORITY_MATURITY_BASIS", "ATTENTION_AUTHORITY_SOURCE"],
  }),
  authorityRegistration({
    binding_id: "ADR_DECISION_BASIS_AUTHORITY_V1",
    source_system: "ADR",
    authority_domain: "ADR",
    object_kind_mode: "EXACT",
    allowed_object_kinds: [
      "DecisionProblem",
      "DecisionRobustness",
      "Policy",
      "ContextManifest",
      "KnowledgeRetrievalResult",
      "QualifiedKnowledge",
      "DerivedKnowledge",
      "KnowledgeRelease",
      "Deployment",
      "RuntimeProfile",
      "RuntimeAlternativeSet",
    ],
    source_contract: "ADR AuthorityLedger exact authority refs",
    source_contract_version: null,
    allowed_source_paths: ["AuthorityLedger.resolve(exact-ref)"],
    allowed_product_roles: ["ACTION_DECISION_BASIS"],
  }),

  authorityRegistration({
    binding_id: "BLINE_RECOMMENDATION_CANDIDATE_V1",
    source_system: "B_LINE",
    authority_domain: "B_LINE",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["decision_recommendation_v1"],
    source_contract: "recommendation approval predecessor fact",
    source_contract_version: "v1",
    allowed_source_paths: ["facts:decision_recommendation_v1"],
    allowed_product_roles: ["ACTION_RECOMMENDATION_CANDIDATE", "CAPABILITY_AUTHORITY_MATURITY_BASIS", "ATTENTION_AUTHORITY_SOURCE"],
  }),
  authorityRegistration({
    binding_id: "BLINE_APPROVAL_REQUEST_V1",
    source_system: "B_LINE",
    authority_domain: "B_LINE",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["approval_request_v1"],
    source_contract: "recommendation_approval_request_builder_v1.ts",
    source_contract_version: "v1",
    allowed_source_paths: ["facts:approval_request_v1"],
    allowed_product_roles: ["ACTION_APPROVAL_REQUEST", "CAPABILITY_AUTHORITY_MATURITY_BASIS", "ATTENTION_AUTHORITY_SOURCE"],
  }),
  authorityRegistration({
    binding_id: "BLINE_APPROVAL_DECISION_V1",
    source_system: "B_LINE",
    authority_domain: "B_LINE",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["approval_decision_v1"],
    source_contract: "recommendation_approval_decision_builder_v1.ts",
    source_contract_version: "v1",
    allowed_source_paths: ["facts:approval_decision_v1"],
    allowed_product_roles: ["ACTION_APPROVAL_DECISION", "CAPABILITY_AUTHORITY_MATURITY_BASIS", "ATTENTION_AUTHORITY_SOURCE"],
  }),
  authorityRegistration({
    binding_id: "BLINE_OPERATION_PLAN_V1",
    source_system: "B_LINE",
    authority_domain: "B_LINE",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["operation_plan_v1"],
    source_contract: "operation_plan_from_approval_decision_builder_v1.ts",
    source_contract_version: "v1",
    allowed_source_paths: ["facts:operation_plan_v1"],
    allowed_product_roles: ["ACTION_OPERATION_PLAN", "CAPABILITY_AUTHORITY_MATURITY_BASIS", "ATTENTION_AUTHORITY_SOURCE"],
  }),
  authorityRegistration({
    binding_id: "BLINE_AO_ACT_TASK_V0",
    source_system: "B_LINE",
    authority_domain: "B_LINE",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["ao_act_task_v0"],
    source_contract: "ao_act_task_from_operation_plan_builder_v1.ts",
    source_contract_version: "v0",
    allowed_source_paths: ["facts:ao_act_task_v0"],
    allowed_product_roles: ["ACTION_TASK", "CAPABILITY_AUTHORITY_MATURITY_BASIS", "ATTENTION_AUTHORITY_SOURCE"],
  }),
  authorityRegistration({
    binding_id: "BLINE_AO_ACT_DISPATCH_V1",
    source_system: "B_LINE",
    authority_domain: "B_LINE",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["ao_act_dispatch_v1"],
    source_contract: "operator_dispatch_actions.ts / dispatch delivery fact",
    source_contract_version: "v1",
    allowed_source_paths: ["facts:ao_act_dispatch_v1"],
    allowed_product_roles: ["ACTION_DISPATCH", "CAPABILITY_AUTHORITY_MATURITY_BASIS", "ATTENTION_AUTHORITY_SOURCE"],
  }),
  authorityRegistration({
    binding_id: "BLINE_AO_ACT_RECEIPT_V1",
    source_system: "B_LINE",
    authority_domain: "B_LINE",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["ao_act_receipt_v1"],
    source_contract: "ao_act_receipt_from_task_builder_v1.ts",
    source_contract_version: "v1",
    allowed_source_paths: ["facts:ao_act_receipt_v1"],
    allowed_product_roles: ["ACTION_EXECUTION_RECEIPT", "CAPABILITY_AUTHORITY_MATURITY_BASIS", "ATTENTION_AUTHORITY_SOURCE"],
  }),
  authorityRegistration({
    binding_id: "BLINE_AS_EXECUTED_RECORD_V1",
    source_system: "B_LINE",
    authority_domain: "B_LINE",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["as_executed_record_v1"],
    source_contract: "as_executed_from_ao_act_receipt_v1.ts",
    source_contract_version: "v1",
    allowed_source_paths: ["as_executed_record_v1"],
    allowed_product_roles: ["ACTION_AS_EXECUTED", "CAPABILITY_AUTHORITY_MATURITY_BASIS", "ATTENTION_AUTHORITY_SOURCE"],
  }),
  authorityRegistration({
    binding_id: "BLINE_EVIDENCE_ARTIFACT_V1",
    source_system: "B_LINE",
    authority_domain: "B_LINE",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["evidence_artifact_v1"],
    source_contract: "evidence_artifact_from_as_executed_v1.ts",
    source_contract_version: "v1",
    allowed_source_paths: ["facts:evidence_artifact_v1"],
    allowed_product_roles: ["ACTION_EVIDENCE_ARTIFACT", "CAPABILITY_AUTHORITY_MATURITY_BASIS", "ATTENTION_AUTHORITY_SOURCE"],
  }),
  authorityRegistration({
    binding_id: "BLINE_ACCEPTANCE_RESULT_V1",
    source_system: "B_LINE",
    authority_domain: "B_LINE",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["acceptance_result_v1"],
    source_contract: "acceptance_result_from_evidence_artifacts_v1.ts",
    source_contract_version: "v1",
    allowed_source_paths: ["facts:acceptance_result_v1"],
    allowed_product_roles: ["ACTION_EXECUTION_EVIDENCE_ACCEPTANCE", "CAPABILITY_AUTHORITY_MATURITY_BASIS", "ATTENTION_AUTHORITY_SOURCE"],
  }),

  nonAuthorityRegistration({
    binding_id: "FOUI_DECISION_TIME_AUTHORITY_MANIFEST_V1",
    source_system: "FOUI_GOVERNANCE",
    non_authority_ref_class: "COMPOSITION_MANIFEST",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["DecisionTimeAuthorityManifest"],
    source_contract: "GEOX Blueprint DecisionTimeAuthorityManifest",
    source_contract_version: "target-contract-v1",
    allowed_source_paths: ["decision_time_basis.decision_time_manifest_ref_key"],
    allowed_product_roles: ["ACTION_DECISION_TIME_MANIFEST"],
  }),
  nonAuthorityRegistration({
    binding_id: "FOUI_PRODUCT_GOVERNANCE_BASIS_V1",
    source_system: "FOUI_GOVERNANCE",
    non_authority_ref_class: "PRODUCT_GOVERNANCE",
    object_kind_mode: "SOURCE_DECLARED",
    allowed_object_kinds: [],
    source_contract: "FOUI release/product governance basis",
    source_contract_version: null,
    allowed_source_paths: ["product-governance:exact-ref"],
    allowed_product_roles: ["CAPABILITY_PRODUCT_RELEASE_BASIS"],
  }),
  nonAuthorityRegistration({
    binding_id: "EXTERNAL_PROVIDER_BASIS_V1",
    source_system: "EXTERNAL_BASIS",
    non_authority_ref_class: "PROVIDER",
    object_kind_mode: "SOURCE_DECLARED",
    allowed_object_kinds: [],
    source_contract: "provider/version basis",
    source_contract_version: null,
    allowed_source_paths: ["decision-time-provider-ref"],
    allowed_product_roles: ["ACTION_PROVIDER_BASIS"],
  }),
  nonAuthorityRegistration({
    binding_id: "MEASUREMENT_BASIS_V1",
    source_system: "EXTERNAL_BASIS",
    non_authority_ref_class: "MEASUREMENT",
    object_kind_mode: "SOURCE_DECLARED",
    allowed_object_kinds: [],
    source_contract: "measurement exact basis",
    source_contract_version: null,
    allowed_source_paths: ["decision-time-measurement-ref"],
    allowed_product_roles: ["ACTION_MEASUREMENT_BASIS"],
  }),
  nonAuthorityRegistration({
    binding_id: "VERIFICATION_STATE_BASIS_V1",
    source_system: "EXTERNAL_BASIS",
    non_authority_ref_class: "VERIFICATION_STATE",
    object_kind_mode: "SOURCE_DECLARED",
    allowed_object_kinds: [],
    source_contract: "verification-state historical basis",
    source_contract_version: null,
    allowed_source_paths: ["decision-time-verification-state-ref"],
    allowed_product_roles: ["ACTION_VERIFICATION_STATE_BASIS"],
  }),
  nonAuthorityRegistration({
    binding_id: "BLINE_AO_ACT_DEVICE_REF_V0_EVIDENCE",
    source_system: "B_LINE",
    non_authority_ref_class: "EVIDENCE",
    object_kind_mode: "EXACT",
    allowed_object_kinds: ["ao_act_device_ref_v0"],
    source_contract: "ao_act_device_ref_v0 execution material",
    source_contract_version: "v0",
    allowed_source_paths: ["ao_act_receipt_v1.device_refs[].ref"],
    allowed_product_roles: ["ACTION_EXECUTION_MATERIAL"],
  }),
] satisfies readonly ProductProjectionSourceBindingRegistrationV1[]);

export type ProductProjectionSourceBindingProofV1 = {
  ref_key: string;
  binding_id: string;
  observed_object_kind: string;
  source_path: string;
};

export type ProductProjectionSourceBindingProofSetV1 = {
  registry_version: typeof PRODUCT_PROJECTION_SOURCE_BINDING_REGISTRY_VERSION_V1;
  proofs: readonly ProductProjectionSourceBindingProofV1[];
  non_authoritative: true;
};

const registryById = new Map(
  PRODUCT_PROJECTION_SOURCE_BINDINGS_V1.map((entry) => [entry.binding_id, entry]),
);

function fail(code: string, detail?: string): never {
  throw new ProductProjectionContractError(code, detail ? `${code}:${detail}` : code);
}

type ProductProjectionSourceRefMapValueV1 =
  | {
      namespace: "AUTHORITY";
      ref: ProductProjectionEnvelopeV1["source_authority_refs"][number];
    }
  | {
      namespace: "NON_AUTHORITY";
      ref: ProductProjectionEnvelopeV1["source_non_authority_refs"][number];
    };

function sourceRefMap(envelope: ProductProjectionEnvelopeV1) {
  return new Map<string, ProductProjectionSourceRefMapValueV1>([
    ...envelope.source_authority_refs.map(
      (ref) => [ref.ref_key, { namespace: "AUTHORITY" as const, ref }] as const,
    ),
    ...envelope.source_non_authority_refs.map(
      (ref) => [ref.ref_key, { namespace: "NON_AUTHORITY" as const, ref }] as const,
    ),
  ]);
}

function proofMap(proofSet: ProductProjectionSourceBindingProofSetV1) {
  if (proofSet.registry_version !== PRODUCT_PROJECTION_SOURCE_BINDING_REGISTRY_VERSION_V1) {
    fail("PRODUCT_PROJECTION_SOURCE_BINDING_REGISTRY_VERSION_INVALID");
  }
  if (proofSet.non_authoritative !== true) {
    fail("PRODUCT_PROJECTION_SOURCE_BINDING_PROOF_MUST_BE_NON_AUTHORITATIVE");
  }
  const out = new Map<string, ProductProjectionSourceBindingProofV1>();
  for (const proof of proofSet.proofs) {
    if (!proof.ref_key || !proof.binding_id || !proof.observed_object_kind || !proof.source_path) {
      fail("PRODUCT_PROJECTION_SOURCE_BINDING_PROOF_INCOMPLETE");
    }
    if (out.has(proof.ref_key)) fail("PRODUCT_PROJECTION_SOURCE_BINDING_DUPLICATE_PROOF", proof.ref_key);
    out.set(proof.ref_key, proof);
  }
  return out;
}

export function assertProductProjectionSourceBindingsV1(
  envelope: ProductProjectionEnvelopeV1,
  proofSet: ProductProjectionSourceBindingProofSetV1,
): void {
  const refs = sourceRefMap(envelope);
  const proofs = proofMap(proofSet);
  for (const refKey of refs.keys()) {
    if (!proofs.has(refKey)) fail("PRODUCT_PROJECTION_SOURCE_BINDING_PROOF_REQUIRED", refKey);
  }
  for (const refKey of proofs.keys()) {
    if (!refs.has(refKey)) fail("PRODUCT_PROJECTION_SOURCE_BINDING_PROOF_UNKNOWN_REF", refKey);
  }

  for (const [refKey, wrapped] of refs) {
    const proof = proofs.get(refKey)!;
    const registration = registryById.get(proof.binding_id);
    if (!registration) fail("PRODUCT_PROJECTION_SOURCE_BINDING_UNREGISTERED", proof.binding_id);
    if (registration.ref_namespace !== wrapped.namespace) {
      fail("PRODUCT_PROJECTION_SOURCE_BINDING_NAMESPACE_MISMATCH", refKey);
    }
    if (!registration.allowed_source_paths.includes(proof.source_path)) {
      fail("PRODUCT_PROJECTION_SOURCE_BINDING_SOURCE_PATH_FORBIDDEN", refKey);
    }

    if (wrapped.namespace === "AUTHORITY") {
      const ref = wrapped.ref;
      if (registration.authority_domain !== ref.authority_domain) {
        fail("PRODUCT_PROJECTION_SOURCE_BINDING_AUTHORITY_DOMAIN_MISMATCH", refKey);
      }
      if (proof.observed_object_kind !== ref.authority_object_kind) {
        fail("PRODUCT_PROJECTION_SOURCE_BINDING_OBJECT_KIND_MISMATCH", refKey);
      }
    } else {
      const ref = wrapped.ref;
      if (registration.non_authority_ref_class !== ref.ref_class) {
        fail("PRODUCT_PROJECTION_SOURCE_BINDING_NON_AUTHORITY_CLASS_MISMATCH", refKey);
      }
      if (proof.observed_object_kind !== ref.object_kind) {
        fail("PRODUCT_PROJECTION_SOURCE_BINDING_OBJECT_KIND_MISMATCH", refKey);
      }
    }

    if (
      registration.object_kind_mode === "EXACT"
      && !registration.allowed_object_kinds.includes(proof.observed_object_kind)
    ) {
      fail("PRODUCT_PROJECTION_SOURCE_BINDING_OBJECT_KIND_FORBIDDEN", refKey);
    }
  }
}

function assertRole(
  refKey: string | null,
  role: ProductProjectionSourceRoleV1,
  proofSet: ProductProjectionSourceBindingProofSetV1,
  code: string,
): void {
  if (refKey === null) return;
  const proof = proofMap(proofSet).get(refKey);
  if (!proof) fail("PRODUCT_PROJECTION_SOURCE_BINDING_PROOF_REQUIRED", refKey);
  const registration = registryById.get(proof.binding_id);
  if (!registration || !registration.allowed_product_roles.includes(role)) fail(code, refKey);
}

function assertRoles(
  refKeys: readonly string[],
  role: ProductProjectionSourceRoleV1,
  proofSet: ProductProjectionSourceBindingProofSetV1,
  code: string,
): void {
  for (const refKey of refKeys) assertRole(refKey, role, proofSet, code);
}

function slotRef(chain: Record<string, unknown>, slot: string): string | null {
  const value = chain[slot];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ref = String((value as Record<string, unknown>).ref_key ?? "").trim();
  return ref || null;
}

export function assertGovernedActionCaseSourceBindingsV1(
  projection: GovernedActionCaseProjectionV1,
  proofSet: ProductProjectionSourceBindingProofSetV1,
): void {
  assertProductProjectionSourceBindingsV1(projection.envelope, proofSet);

  assertRole(
    projection.current_context.current_field_state_ref_key,
    "ACTION_CURRENT_FIELD_STATE",
    proofSet,
    "GOVERNED_ACTION_SOURCE_CURRENT_FIELD_STATE_BINDING_FORBIDDEN",
  );
  assertRoles(
    projection.current_context.current_forecast_ref_keys,
    "ACTION_CURRENT_FORECAST",
    proofSet,
    "GOVERNED_ACTION_SOURCE_CURRENT_FORECAST_BINDING_FORBIDDEN",
  );

  const basis = projection.decision_time_basis;
  assertRole(basis.decision_ref_key, "ACTION_AGRONOMIC_DECISION", proofSet, "GOVERNED_ACTION_SOURCE_DECISION_BINDING_FORBIDDEN");
  assertRole(basis.field_state_ref_at_decision_key, "ACTION_DECISION_TIME_FIELD_STATE", proofSet, "GOVERNED_ACTION_SOURCE_DECISION_STATE_BINDING_FORBIDDEN");
  assertRole(basis.applicability_ref_key, "ACTION_APPLICABILITY", proofSet, "GOVERNED_ACTION_SOURCE_APPLICABILITY_BINDING_FORBIDDEN");
  assertRole(basis.runtime_eligibility_ref_key, "ACTION_RUNTIME_ELIGIBILITY", proofSet, "GOVERNED_ACTION_SOURCE_RUNTIME_ELIGIBILITY_BINDING_FORBIDDEN");
  assertRoles(basis.runtime_binding_ref_keys, "ACTION_RUNTIME_BINDING", proofSet, "GOVERNED_ACTION_SOURCE_RUNTIME_BINDING_FORBIDDEN");
  assertRoles(basis.decision_basis_ref_keys, "ACTION_DECISION_BASIS", proofSet, "GOVERNED_ACTION_SOURCE_DECISION_BASIS_BINDING_FORBIDDEN");
  assertRole(basis.decision_time_manifest_ref_key, "ACTION_DECISION_TIME_MANIFEST", proofSet, "GOVERNED_ACTION_SOURCE_MANIFEST_BINDING_FORBIDDEN");
  assertRoles(basis.provider_ref_keys, "ACTION_PROVIDER_BASIS", proofSet, "GOVERNED_ACTION_SOURCE_PROVIDER_BINDING_FORBIDDEN");
  assertRoles(basis.measurement_ref_keys, "ACTION_MEASUREMENT_BASIS", proofSet, "GOVERNED_ACTION_SOURCE_MEASUREMENT_BINDING_FORBIDDEN");
  assertRoles(basis.verification_state_ref_keys, "ACTION_VERIFICATION_STATE_BASIS", proofSet, "GOVERNED_ACTION_SOURCE_VERIFICATION_BINDING_FORBIDDEN");

  const chain = projection.authority_chain as unknown as Record<string, unknown>;
  const slotRoles: ReadonlyArray<[string, ProductProjectionSourceRoleV1]> = [
    ["agronomic_decision", "ACTION_AGRONOMIC_DECISION"],
    ["recommendation_candidate", "ACTION_RECOMMENDATION_CANDIDATE"],
    ["approval_request", "ACTION_APPROVAL_REQUEST"],
    ["approval_decision", "ACTION_APPROVAL_DECISION"],
    ["operation_plan", "ACTION_OPERATION_PLAN"],
    ["task", "ACTION_TASK"],
    ["dispatch", "ACTION_DISPATCH"],
    ["execution_receipt", "ACTION_EXECUTION_RECEIPT"],
    ["as_executed", "ACTION_AS_EXECUTED"],
    ["execution_evidence_acceptance", "ACTION_EXECUTION_EVIDENCE_ACCEPTANCE"],
  ];
  for (const [slot, role] of slotRoles) {
    assertRole(slotRef(chain, slot), role, proofSet, `GOVERNED_ACTION_SOURCE_SLOT_BINDING_FORBIDDEN:${slot}`);
  }
  assertRoles(
    projection.authority_chain.evidence_artifact_ref_keys,
    "ACTION_EVIDENCE_ARTIFACT",
    proofSet,
    "GOVERNED_ACTION_SOURCE_EVIDENCE_ARTIFACT_BINDING_FORBIDDEN",
  );

  // Wave-01 intentionally has no proven standalone authority objects for these slots.
  // Receipt executor_id and ao_act_device_ref_v0 are provenance/material, not a substitute.
  if (projection.authority_chain.execution_authorization.ref_key !== null) {
    fail("GOVERNED_ACTION_SOURCE_EXECUTION_AUTHORIZATION_AUTHORITY_NOT_REGISTERED");
  }
  if (projection.authority_chain.executor.ref_key !== null) {
    fail("GOVERNED_ACTION_SOURCE_EXECUTOR_AUTHORITY_NOT_REGISTERED");
  }
  if (projection.authority_chain.device.ref_key !== null) {
    fail("GOVERNED_ACTION_SOURCE_DEVICE_AUTHORITY_NOT_REGISTERED");
  }

  // Outcome and attribution remain outside Wave-01 until formal source authorities are registered.
  if (projection.authority_chain.outcome_ref_keys.length !== 0) {
    fail("GOVERNED_ACTION_SOURCE_OUTCOME_AUTHORITY_NOT_REGISTERED");
  }
  if (projection.authority_chain.attribution.ref_key !== null) {
    fail("GOVERNED_ACTION_SOURCE_ATTRIBUTION_AUTHORITY_NOT_REGISTERED");
  }

  // Anchor is a product navigation anchor only; require it to be one of the already-registered
  // roles corresponding to its declared anchor kind.
  const anchorRole: Record<string, ProductProjectionSourceRoleV1> = {
    DECISION_RESULT: "ACTION_AGRONOMIC_DECISION",
    RECOMMENDATION_CANDIDATE: "ACTION_RECOMMENDATION_CANDIDATE",
    APPROVAL_REQUEST: "ACTION_APPROVAL_REQUEST",
    OPERATION_PLAN: "ACTION_OPERATION_PLAN",
    AO_ACT_TASK: "ACTION_TASK",
  };
  assertRole(
    projection.case_anchor.source_ref_key,
    anchorRole[projection.case_anchor.anchor_kind],
    proofSet,
    "GOVERNED_ACTION_SOURCE_ANCHOR_BINDING_FORBIDDEN",
  );
}

export function sourceBindingRegistrationV1(bindingId: string): ProductProjectionSourceBindingRegistrationV1 | null {
  return registryById.get(bindingId) ?? null;
}