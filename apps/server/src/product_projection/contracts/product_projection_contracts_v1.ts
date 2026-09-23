// GEOX FOUI-PROJECTION-CONTRACT-WAVE-01
// Purpose: freeze non-authoritative product projection contracts before UI implementation.
// Boundary: pure contracts/validators/derivations only. No database, route, network, wall-clock,
// authority mutation, domain adjudication, or command authorization is permitted here.

export const PRODUCT_PROJECTION_CONTRACT_VERSION_V1 = "geox.product-projection.v1" as const;
export const PRODUCT_PROJECTION_AUTHORITY_CEILING_V1 = "NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY" as const;

export const PRODUCT_PROJECTION_TYPES_V1 = [
  "GOVERNED_ACTION_CASE",
  "CAPABILITY_AVAILABILITY",
  "ATTENTION_QUEUE",
  "CUSTOMER_OVERVIEW",
  "FIELD_SUMMARY",
  "FIELD_WORKSPACE",
  "FIELD_PORTFOLIO",
  "DECISION_PRODUCT",
  "GOVERNED_ACTION_LIST",
  "EVIDENCE_CASE",
] as const;
export type ProductProjectionTypeV1 = (typeof PRODUCT_PROJECTION_TYPES_V1)[number];

export const PRODUCT_PROJECTION_AUTHORITY_DOMAINS_V1 = ["MCFT", "ADR", "B_LINE", "OUTCOME", "EXTERNAL"] as const;
export type ProductProjectionAuthorityDomainV1 = (typeof PRODUCT_PROJECTION_AUTHORITY_DOMAINS_V1)[number];

// These refs are deliberately not authority refs. Keeping them in a distinct namespace prevents
// replay envelopes, product governance, measurements, provider metadata, and evidence pointers
// from acquiring authority semantics merely because FOUI references them.
export const PRODUCT_PROJECTION_NON_AUTHORITY_REF_CLASSES_V1 = [
  "COMPOSITION_MANIFEST",
  "PRODUCT_GOVERNANCE",
  "OPERATIONAL_QUALIFICATION",
  "PROVIDER",
  "MEASUREMENT",
  "VERIFICATION_STATE",
  "EVIDENCE",
  "OTHER_NON_AUTHORITY",
] as const;
export type ProductProjectionNonAuthorityRefClassV1 = (typeof PRODUCT_PROJECTION_NON_AUTHORITY_REF_CLASSES_V1)[number];

export const PRODUCT_PROJECTION_FRESHNESS_STATUSES_V1 = ["CURRENT", "STALE", "EXPIRED", "UNKNOWN"] as const;
export type ProductProjectionFreshnessStatusV1 = (typeof PRODUCT_PROJECTION_FRESHNESS_STATUSES_V1)[number];

export const PRODUCT_PROJECTION_FRESHNESS_BASES_V1 = [
  "SOURCE_DECLARED_VALIDITY",
  "PRODUCT_CACHE_FRESHNESS",
  "MIXED",
  "UNESTABLISHED",
] as const;
export type ProductProjectionFreshnessBasisV1 = (typeof PRODUCT_PROJECTION_FRESHNESS_BASES_V1)[number];

export const PRODUCT_PROJECTION_SEMANTICS_V1 = ["CURRENT_PROJECTION", "DECISION_TIME_SNAPSHOT", "HISTORICAL_REPLAY"] as const;
export type ProductProjectionSemanticsV1 = (typeof PRODUCT_PROJECTION_SEMANTICS_V1)[number];

export const PRODUCT_PROJECTION_EFFECTIVE_INTERVAL_MODES_V1 = [
  "SINGLE_EXACT",
  "COMMON_INTERSECTION",
  "MIXED",
  "NOT_ESTABLISHED",
  "NOT_APPLICABLE",
] as const;
export type ProductProjectionEffectiveIntervalModeV1 = (typeof PRODUCT_PROJECTION_EFFECTIVE_INTERVAL_MODES_V1)[number];

export type ProductProjectionSubjectScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string | null;
  zone_id: string | null;
  season_id: string | null;
};

export type ProductProjectionAuthorityRefV1 = {
  ref_key: string;
  authority_domain: ProductProjectionAuthorityDomainV1;
  authority_object_kind: string;
  exact_ref: string;
  source_fact_ref: string | null;
};

export type ProductProjectionNonAuthorityRefV1 = {
  ref_key: string;
  ref_class: ProductProjectionNonAuthorityRefClassV1;
  object_kind: string;
  exact_ref: string;
  source_fact_ref: string | null;
};

export type ProductProjectionSourceDigestV1 = {
  source_ref_key: string;
  digest: string;
  digest_kind: string;
};

export type ProductProjectionEffectiveIntervalV1 = {
  mode: ProductProjectionEffectiveIntervalModeV1;
  effective_from: string | null;
  effective_until: string | null;
  basis_ref_keys: readonly string[];
};

export type ProductProjectionEvidenceCutoffV1 = {
  cutoff: string;
  basis_ref_keys: readonly string[];
};

export type ProductProjectionLimitationV1 = {
  reason_code: string;
  source_ref_key: string | null;
  detail: string | null;
};

export type ProductProjectionFreshnessV1 = {
  status: ProductProjectionFreshnessStatusV1;
  evaluated_at: string;
  basis: ProductProjectionFreshnessBasisV1;
  reason_codes: readonly string[];
};

export type ProductProjectionEnvelopeV1 = {
  projection_id: string;
  projection_type: ProductProjectionTypeV1;
  projection_schema_version: typeof PRODUCT_PROJECTION_CONTRACT_VERSION_V1;
  generated_at: string;
  derivation_version: string;
  subject_scope: ProductProjectionSubjectScopeV1;
  source_authority_refs: readonly ProductProjectionAuthorityRefV1[];
  source_non_authority_refs: readonly ProductProjectionNonAuthorityRefV1[];
  source_content_digests: readonly ProductProjectionSourceDigestV1[];
  source_effective_interval: ProductProjectionEffectiveIntervalV1;
  source_evidence_cutoff: ProductProjectionEvidenceCutoffV1 | null;
  authority_ceiling: typeof PRODUCT_PROJECTION_AUTHORITY_CEILING_V1;
  limitations: readonly ProductProjectionLimitationV1[];
  freshness: ProductProjectionFreshnessV1;
  projection_semantics: ProductProjectionSemanticsV1;
  non_authoritative: true;
};

export const PRODUCT_PROJECTION_COMMAND_OWNERS_V1 = ["B_LINE", "MCFT", "ADR", "OUTCOME", "EXTERNAL"] as const;
export type ProductProjectionCommandOwnerV1 = (typeof PRODUCT_PROJECTION_COMMAND_OWNERS_V1)[number];

export type ProductProjectionInteractionIntentHintV1 = {
  intent: string;
  command_owner: ProductProjectionCommandOwnerV1;
  required_capabilities: readonly string[];
  target_authority_ref_keys: readonly string[];
  display_reason_code: string;
  requires_command_reauthorization: true;
};

export type ProductProjectionInteractionHintsV1 = {
  caller_context_id: string;
  allowed_intents: readonly ProductProjectionInteractionIntentHintV1[];
};

export type ProductProjectionResponseV1<TProjection> = {
  projection: TProjection;
  interaction_hints: ProductProjectionInteractionHintsV1;
};

export const GOVERNED_ACTION_CASE_ANCHOR_KINDS_V1 = [
  "DECISION_RESULT",
  "RECOMMENDATION_CANDIDATE",
  "APPROVAL_REQUEST",
  "OPERATION_PLAN",
  "AO_ACT_TASK",
] as const;
export type GovernedActionCaseAnchorKindV1 = (typeof GOVERNED_ACTION_CASE_ANCHOR_KINDS_V1)[number];

export const GOVERNED_ACTION_COMPOSITION_STATUSES_V1 = ["EXACT_REF_LINKED", "PARTIAL_REF_LINKED", "UNRESOLVED"] as const;
export type GovernedActionCompositionStatusV1 = (typeof GOVERNED_ACTION_COMPOSITION_STATUSES_V1)[number];

export const GOVERNED_ACTION_LINKAGE_KINDS_V1 = ["EXACT_PREDECESSOR_REF", "EXACT_SOURCE_FACT_REF", "EXACT_DIGEST_BOUND_REF"] as const;
export type GovernedActionLinkageKindV1 = (typeof GOVERNED_ACTION_LINKAGE_KINDS_V1)[number];

export type GovernedActionLinkageProofV1 = {
  from_source_ref_key: string;
  to_source_ref_key: string;
  linkage_kind: GovernedActionLinkageKindV1;
  evidence_ref_key: string | null;
};

export type GovernedActionCaseAnchorV1 = {
  source_ref_key: string;
  anchor_kind: GovernedActionCaseAnchorKindV1;
};

export const GOVERNED_ACTION_CURRENT_CONTEXT_STATUSES_V1 = ["AVAILABLE", "AVAILABLE_WITH_LIMITATIONS", "UNAVAILABLE"] as const;
export type GovernedActionCurrentContextStatusV1 = (typeof GOVERNED_ACTION_CURRENT_CONTEXT_STATUSES_V1)[number];

export type GovernedActionCurrentContextV1 = {
  current_projection_time: string;
  current_field_state_ref_key: string | null;
  current_state_effective_interval: ProductProjectionEffectiveIntervalV1 | null;
  current_forecast_ref_keys: readonly string[];
  current_limitation_reason_codes: readonly string[];
  current_context_status: GovernedActionCurrentContextStatusV1;
};

export const DECISION_BASIS_INTEGRITY_STATUSES_V1 = ["EXACT_MANIFEST", "EXACT_DOMAIN_LOCAL_REFS", "PARTIAL_RECONSTRUCTION", "UNAVAILABLE"] as const;
export type DecisionBasisIntegrityStatusV1 = (typeof DECISION_BASIS_INTEGRITY_STATUSES_V1)[number];

export const DECISION_BASIS_SOURCE_MODES_V1 = ["DECISION_TIME_CAPTURE", "HISTORICAL_REPLAY", "LATER_RECONSTRUCTION", "UNAVAILABLE"] as const;
export type DecisionBasisSourceModeV1 = (typeof DECISION_BASIS_SOURCE_MODES_V1)[number];

export const DECISION_CAPTURE_INTEGRITY_STATUSES_V1 = [
  "CONTEMPORANEOUS_INGEST",
  "PROVIDER_NATIVE_VERSION_CONFIRMED",
  "EXTERNALLY_ATTESTED",
  "LATER_RECONSTRUCTED",
  "MIXED",
  "UNKNOWN",
] as const;
export type DecisionCaptureIntegrityStatusV1 = (typeof DECISION_CAPTURE_INTEGRITY_STATUSES_V1)[number];

export type GovernedActionDecisionTimeBasisV1 = {
  basis_integrity: DecisionBasisIntegrityStatusV1;
  historical_basis_source: DecisionBasisSourceModeV1;
  current_state_substitution_forbidden: true;
  decision_ref_key: string | null;
  decision_time: string | null;
  evidence_cutoff: string | null;
  decision_time_manifest_ref_key: string | null;
  field_state_ref_at_decision_key: string | null;
  applicability_ref_key: string | null;
  runtime_eligibility_ref_key: string | null;
  runtime_binding_ref_keys: readonly string[];
  decision_basis_ref_keys: readonly string[];
  provider_ref_keys: readonly string[];
  measurement_ref_keys: readonly string[];
  verification_state_ref_keys: readonly string[];
  decision_basis_digest: string | null;
  capture_integrity: DecisionCaptureIntegrityStatusV1;
};

export const TRI_STATE_COMPARISON_VALUES_V1 = ["YES", "NO", "UNKNOWN"] as const;
export type TriStateComparisonV1 = (typeof TRI_STATE_COMPARISON_VALUES_V1)[number];

export type GovernedActionLaterChangesV1 = {
  current_state_differs: TriStateComparisonV1;
  later_evidence_available: TriStateComparisonV1;
  later_arriving_or_revised_ref_keys: readonly string[];
  comparison_basis_ref_keys: readonly string[];
  comparison_limitation_reason_codes: readonly string[];
};

export type GovernedActionAuthoritySlotV1 = { ref_key: string | null; source_status: string | null };

export type GovernedActionAuthorityChainV1 = {
  agronomic_decision: GovernedActionAuthoritySlotV1;
  recommendation_candidate: GovernedActionAuthoritySlotV1;
  approval_request: GovernedActionAuthoritySlotV1;
  approval_decision: GovernedActionAuthoritySlotV1;
  operation_plan: GovernedActionAuthoritySlotV1;
  execution_authorization: GovernedActionAuthoritySlotV1;
  task: GovernedActionAuthoritySlotV1;
  dispatch: GovernedActionAuthoritySlotV1;
  executor: GovernedActionAuthoritySlotV1;
  device: GovernedActionAuthoritySlotV1;
  execution_receipt: GovernedActionAuthoritySlotV1;
  as_executed: GovernedActionAuthoritySlotV1;
  evidence_artifact_ref_keys: readonly string[];
  execution_evidence_acceptance: GovernedActionAuthoritySlotV1;
  outcome_ref_keys: readonly string[];
  attribution: GovernedActionAuthoritySlotV1;
};

export const GOVERNED_ACTION_DISPLAY_PHASES_V1 = [
  "LINKAGE_INCOMPLETE",
  "DECISION_ONLY",
  "NO_ACTION_CURRENTLY_AUTHORIZED",
  "AWAITING_APPROVAL",
  "APPROVAL_REJECTED",
  "APPROVED",
  "PLAN_PREPARING",
  "PLAN_READY",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "ACKNOWLEDGED",
  "EXECUTION_REPORTED",
  "EVIDENCE_REVIEW",
  "EXECUTION_EVIDENCE_ACCEPTED",
  "EXCEPTION",
] as const;
export type GovernedActionDisplayPhaseV1 = (typeof GOVERNED_ACTION_DISPLAY_PHASES_V1)[number];

export type GovernedActionCaseProjectionV1 = {
  envelope: ProductProjectionEnvelopeV1 & { projection_type: "GOVERNED_ACTION_CASE" };
  case_anchor: GovernedActionCaseAnchorV1;
  action_type: string;
  composition_status: GovernedActionCompositionStatusV1;
  linkage_proofs: readonly GovernedActionLinkageProofV1[];
  current_context: GovernedActionCurrentContextV1;
  decision_time_basis: GovernedActionDecisionTimeBasisV1;
  later_changes: GovernedActionLaterChangesV1;
  authority_chain: GovernedActionAuthorityChainV1;
  derived_display_phase: GovernedActionDisplayPhaseV1;
};

export const CAPABILITY_PRODUCT_IMPLEMENTATION_STATUSES_V1 = ["BUILT", "PARTIAL", "NOT_BUILT"] as const;
export type CapabilityProductImplementationStatusV1 = (typeof CAPABILITY_PRODUCT_IMPLEMENTATION_STATUSES_V1)[number];
export const CAPABILITY_AUTHORITY_MATURITY_STATUSES_V1 = ["AUTHORIZED", "PREVIEW", "NOT_AUTHORIZED"] as const;
export type CapabilityAuthorityMaturityStatusV1 = (typeof CAPABILITY_AUTHORITY_MATURITY_STATUSES_V1)[number];
export const CAPABILITY_OPERATIONAL_ELIGIBILITY_STATUSES_V1 = ["CURRENT", "DEGRADED", "EXPIRED", "UNAVAILABLE"] as const;
export type CapabilityOperationalEligibilityStatusV1 = (typeof CAPABILITY_OPERATIONAL_ELIGIBILITY_STATUSES_V1)[number];
export const CAPABILITY_CUSTOMER_STATES_V1 = ["AVAILABLE", "LIMITED", "PREVIEW", "NOT_YET_AVAILABLE"] as const;
export type CapabilityCustomerStateV1 = (typeof CAPABILITY_CUSTOMER_STATES_V1)[number];
export const CAPABILITY_RELEASE_SURFACE_STATES_V1 = ["ACTIVE", "LIMITED", "PREVIEW", "DISABLED"] as const;
export type CapabilityReleaseSurfaceStateV1 = (typeof CAPABILITY_RELEASE_SURFACE_STATES_V1)[number];
export const CAPABILITY_AVAILABILITY_SCOPE_KINDS_V1 = ["PRODUCT_GLOBAL", "TENANT", "FIELD", "FIELD_ACTION_TYPE"] as const;
export type CapabilityAvailabilityScopeKindV1 = (typeof CAPABILITY_AVAILABILITY_SCOPE_KINDS_V1)[number];

export type CapabilityAvailabilityScopeV1 = {
  scope_kind: CapabilityAvailabilityScopeKindV1;
  field_id: string | null;
  zone_id: string | null;
  action_type: string | null;
};

export type CapabilityAvailabilityProjectionV1 = {
  envelope: ProductProjectionEnvelopeV1 & { projection_type: "CAPABILITY_AVAILABILITY" };
  capability_id: string;
  availability_scope: CapabilityAvailabilityScopeV1;
  product_implementation: CapabilityProductImplementationStatusV1;
  authority_maturity: CapabilityAuthorityMaturityStatusV1;
  operational_eligibility: CapabilityOperationalEligibilityStatusV1;
  customer_state: CapabilityCustomerStateV1;
  default_release_surface_state: CapabilityReleaseSurfaceStateV1;
  reason_codes: readonly string[];
  product_release_basis_ref_keys: readonly string[];
  authority_maturity_basis_ref_keys: readonly string[];
  operational_eligibility_basis_ref_keys: readonly string[];
  evaluated_at: string;
};

export type CapabilityAvailabilityDerivedStateV1 = {
  customer_state: CapabilityCustomerStateV1;
  default_release_surface_state: CapabilityReleaseSurfaceStateV1;
};

export const ATTENTION_TRIAGE_BUCKETS_V1 = [
  "HUMAN_AUTHORITY_REQUIRED",
  "INFORMATION_REQUIRED",
  "EXECUTION_INTERVENTION",
  "EVIDENCE_REVIEW",
  "CAPABILITY_LIMITATION",
  "TIME_BOUND_REVIEW",
] as const;
export type AttentionTriageBucketV1 = (typeof ATTENTION_TRIAGE_BUCKETS_V1)[number];
export const ATTENTION_DUE_BASES_V1 = ["DOMAIN_SOURCE", "PRODUCT_SLA", "NONE"] as const;
export type AttentionDueBasisV1 = (typeof ATTENTION_DUE_BASES_V1)[number];

export type AttentionBlockingStateV1 = { source_ref_key: string; source_state: string };
export type AttentionDueV1 = { due_at: string | null; due_basis: AttentionDueBasisV1; basis_ref_key: string | null };
export type AttentionSourceDeclaredSeverityV1 = { value: string; source_ref_key: string };

export type AttentionQueueItemV1 = {
  attention_id: string;
  subject_scope: ProductProjectionSubjectScopeV1;
  action_case_projection_id: string | null;
  attention_kind: string;
  triage_bucket: AttentionTriageBucketV1;
  attention_reason_code: string;
  source_authority_ref_keys: readonly string[];
  blocking_state: AttentionBlockingStateV1 | null;
  source_effective_time: string | null;
  source_evidence_cutoff: string | null;
  due: AttentionDueV1;
  presentation_rank: number;
  sort_reason_code: string;
  source_declared_severity: AttentionSourceDeclaredSeverityV1 | null;
};

export type AttentionQueueProjectionV1 = {
  envelope: ProductProjectionEnvelopeV1 & { projection_type: "ATTENTION_QUEUE" };
  items: readonly AttentionQueueItemV1[];
};

export class ProductProjectionContractError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ProductProjectionContractError";
  }
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProductProjectionContractError(code, code);
  return value as Record<string, unknown>;
}

function text(value: unknown, code: string): string {
  const v = String(value ?? "").trim();
  if (!v) throw new ProductProjectionContractError(code, code);
  return v;
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
}

function explicitIso(value: unknown, code: string): string {
  const v = text(value, code);
  const epoch = Date.parse(v);
  if (!Number.isFinite(epoch) || !/(Z|[+-]\d{2}:\d{2})$/.test(v)) throw new ProductProjectionContractError(code, code);
  return new Date(epoch).toISOString();
}

function array(value: unknown, code: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new ProductProjectionContractError(code, code);
  return value;
}

function stringArray(value: unknown, code: string): readonly string[] {
  const values = array(value, code).map((item, index) => text(item, `${code}:${index}`));
  if (new Set(values).size !== values.length) throw new ProductProjectionContractError(`${code}:DUPLICATE`, `${code}:DUPLICATE`);
  return values;
}

function nonEmptyStringArray(value: unknown, code: string): readonly string[] {
  const values = stringArray(value, code);
  if (values.length === 0) throw new ProductProjectionContractError(code, code);
  return values;
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T, code: string): T[number] {
  const v = text(value, code);
  if (!(allowed as readonly string[]).includes(v)) throw new ProductProjectionContractError(code, code);
  return v as T[number];
}

function authorityRefMap(envelope: ProductProjectionEnvelopeV1): Map<string, ProductProjectionAuthorityRefV1> {
  return new Map(envelope.source_authority_refs.map((ref) => [ref.ref_key, ref]));
}

function nonAuthorityRefMap(envelope: ProductProjectionEnvelopeV1): Map<string, ProductProjectionNonAuthorityRefV1> {
  return new Map(envelope.source_non_authority_refs.map((ref) => [ref.ref_key, ref]));
}

function sourceRefKeySet(envelope: ProductProjectionEnvelopeV1): Set<string> {
  return new Set([...envelope.source_authority_refs, ...envelope.source_non_authority_refs].map((ref) => ref.ref_key));
}

function assertKnownSourceRef(value: string | null, refs: Set<string>, code: string): void {
  if (value !== null && !refs.has(value)) throw new ProductProjectionContractError(code, `${code}:${value}`);
}

function assertKnownSourceRefs(values: readonly string[], refs: Set<string>, code: string): void {
  for (const value of values) assertKnownSourceRef(value, refs, code);
}

function assertKnownAuthorityRef(value: string | null, refs: Map<string, ProductProjectionAuthorityRefV1>, code: string): void {
  if (value !== null && !refs.has(value)) throw new ProductProjectionContractError(code, `${code}:${value}`);
}

function assertKnownAuthorityRefs(values: readonly string[], refs: Map<string, ProductProjectionAuthorityRefV1>, code: string): void {
  for (const value of values) assertKnownAuthorityRef(value, refs, code);
}

function assertNonAuthorityRefClass(
  value: string | null,
  refs: Map<string, ProductProjectionNonAuthorityRefV1>,
  expectedClass: ProductProjectionNonAuthorityRefClassV1,
  code: string,
): void {
  if (value === null) return;
  const ref = refs.get(value);
  if (!ref || ref.ref_class !== expectedClass) throw new ProductProjectionContractError(code, `${code}:${value}`);
}

function assertNonAuthorityRefClasses(
  values: readonly string[],
  refs: Map<string, ProductProjectionNonAuthorityRefV1>,
  expectedClass: ProductProjectionNonAuthorityRefClassV1,
  code: string,
): void {
  for (const value of values) assertNonAuthorityRefClass(value, refs, expectedClass, code);
}

export function assertProductProjectionEnvelopeV1(input: unknown): asserts input is ProductProjectionEnvelopeV1 {
  const obj = record(input, "PRODUCT_PROJECTION_ENVELOPE_REQUIRED");
  text(obj.projection_id, "PRODUCT_PROJECTION_ID_REQUIRED");
  enumValue(obj.projection_type, PRODUCT_PROJECTION_TYPES_V1, "PRODUCT_PROJECTION_TYPE_INVALID");
  if (obj.projection_schema_version !== PRODUCT_PROJECTION_CONTRACT_VERSION_V1) throw new ProductProjectionContractError("PRODUCT_PROJECTION_SCHEMA_VERSION_INVALID", "PRODUCT_PROJECTION_SCHEMA_VERSION_INVALID");
  explicitIso(obj.generated_at, "PRODUCT_PROJECTION_GENERATED_AT_INVALID");
  text(obj.derivation_version, "PRODUCT_PROJECTION_DERIVATION_VERSION_REQUIRED");

  const scope = record(obj.subject_scope, "PRODUCT_PROJECTION_SUBJECT_SCOPE_REQUIRED");
  text(scope.tenant_id, "PRODUCT_PROJECTION_TENANT_REQUIRED");
  text(scope.project_id, "PRODUCT_PROJECTION_PROJECT_REQUIRED");
  text(scope.group_id, "PRODUCT_PROJECTION_GROUP_REQUIRED");
  optionalText(scope.field_id); optionalText(scope.zone_id); optionalText(scope.season_id);

  const authorityKeys: string[] = [];
  for (const [index, value] of array(obj.source_authority_refs, "PRODUCT_PROJECTION_AUTHORITY_REFS_REQUIRED").entries()) {
    const ref = record(value, `PRODUCT_PROJECTION_AUTHORITY_REF_INVALID:${index}`);
    authorityKeys.push(text(ref.ref_key, `PRODUCT_PROJECTION_AUTHORITY_REF_KEY_REQUIRED:${index}`));
    enumValue(ref.authority_domain, PRODUCT_PROJECTION_AUTHORITY_DOMAINS_V1, `PRODUCT_PROJECTION_AUTHORITY_DOMAIN_INVALID:${index}`);
    text(ref.authority_object_kind, `PRODUCT_PROJECTION_AUTHORITY_OBJECT_KIND_REQUIRED:${index}`);
    text(ref.exact_ref, `PRODUCT_PROJECTION_AUTHORITY_EXACT_REF_REQUIRED:${index}`);
    optionalText(ref.source_fact_ref);
  }

  const nonAuthorityKeys: string[] = [];
  for (const [index, value] of array(obj.source_non_authority_refs, "PRODUCT_PROJECTION_NON_AUTHORITY_REFS_REQUIRED").entries()) {
    const ref = record(value, `PRODUCT_PROJECTION_NON_AUTHORITY_REF_INVALID:${index}`);
    nonAuthorityKeys.push(text(ref.ref_key, `PRODUCT_PROJECTION_NON_AUTHORITY_REF_KEY_REQUIRED:${index}`));
    enumValue(ref.ref_class, PRODUCT_PROJECTION_NON_AUTHORITY_REF_CLASSES_V1, `PRODUCT_PROJECTION_NON_AUTHORITY_REF_CLASS_INVALID:${index}`);
    text(ref.object_kind, `PRODUCT_PROJECTION_NON_AUTHORITY_OBJECT_KIND_REQUIRED:${index}`);
    text(ref.exact_ref, `PRODUCT_PROJECTION_NON_AUTHORITY_EXACT_REF_REQUIRED:${index}`);
    optionalText(ref.source_fact_ref);
  }

  const allKeys = [...authorityKeys, ...nonAuthorityKeys];
  if (new Set(allKeys).size !== allKeys.length) throw new ProductProjectionContractError("PRODUCT_PROJECTION_DUPLICATE_SOURCE_REF_KEY", "PRODUCT_PROJECTION_DUPLICATE_SOURCE_REF_KEY");
  const sourceRefs = new Set(allKeys);

  for (const [index, value] of array(obj.source_content_digests, "PRODUCT_PROJECTION_SOURCE_DIGESTS_REQUIRED").entries()) {
    const digest = record(value, `PRODUCT_PROJECTION_SOURCE_DIGEST_INVALID:${index}`);
    const sourceRefKey = text(digest.source_ref_key, `PRODUCT_PROJECTION_SOURCE_DIGEST_REF_REQUIRED:${index}`);
    assertKnownSourceRef(sourceRefKey, sourceRefs, "PRODUCT_PROJECTION_SOURCE_DIGEST_UNKNOWN_REF");
    text(digest.digest, `PRODUCT_PROJECTION_SOURCE_DIGEST_VALUE_REQUIRED:${index}`);
    text(digest.digest_kind, `PRODUCT_PROJECTION_SOURCE_DIGEST_KIND_REQUIRED:${index}`);
  }

  const interval = record(obj.source_effective_interval, "PRODUCT_PROJECTION_EFFECTIVE_INTERVAL_REQUIRED");
  const mode = enumValue(interval.mode, PRODUCT_PROJECTION_EFFECTIVE_INTERVAL_MODES_V1, "PRODUCT_PROJECTION_EFFECTIVE_INTERVAL_MODE_INVALID");
  const from = optionalText(interval.effective_from);
  const until = optionalText(interval.effective_until);
  if (from) explicitIso(from, "PRODUCT_PROJECTION_EFFECTIVE_FROM_INVALID");
  if (until) explicitIso(until, "PRODUCT_PROJECTION_EFFECTIVE_UNTIL_INVALID");
  const intervalRefs = stringArray(interval.basis_ref_keys, "PRODUCT_PROJECTION_EFFECTIVE_INTERVAL_BASIS_REFS_INVALID");
  assertKnownSourceRefs(intervalRefs, sourceRefs, "PRODUCT_PROJECTION_EFFECTIVE_INTERVAL_UNKNOWN_REF");
  if (["SINGLE_EXACT", "COMMON_INTERSECTION"].includes(mode) && (!from || !until || intervalRefs.length === 0)) throw new ProductProjectionContractError("PRODUCT_PROJECTION_EFFECTIVE_INTERVAL_INCOMPLETE", "PRODUCT_PROJECTION_EFFECTIVE_INTERVAL_INCOMPLETE");

  if (obj.source_evidence_cutoff !== null) {
    const cutoff = record(obj.source_evidence_cutoff, "PRODUCT_PROJECTION_EVIDENCE_CUTOFF_INVALID");
    explicitIso(cutoff.cutoff, "PRODUCT_PROJECTION_EVIDENCE_CUTOFF_TIME_INVALID");
    const refs = nonEmptyStringArray(cutoff.basis_ref_keys, "PRODUCT_PROJECTION_EVIDENCE_CUTOFF_BASIS_REQUIRED");
    assertKnownSourceRefs(refs, sourceRefs, "PRODUCT_PROJECTION_EVIDENCE_CUTOFF_UNKNOWN_REF");
  }

  if (obj.authority_ceiling !== PRODUCT_PROJECTION_AUTHORITY_CEILING_V1) throw new ProductProjectionContractError("PRODUCT_PROJECTION_AUTHORITY_CEILING_INVALID", "PRODUCT_PROJECTION_AUTHORITY_CEILING_INVALID");
  if (obj.non_authoritative !== true) throw new ProductProjectionContractError("PRODUCT_PROJECTION_NON_AUTHORITATIVE_INVARIANT_VIOLATION", "PRODUCT_PROJECTION_NON_AUTHORITATIVE_INVARIANT_VIOLATION");

  for (const [index, value] of array(obj.limitations, "PRODUCT_PROJECTION_LIMITATIONS_REQUIRED").entries()) {
    const limitation = record(value, `PRODUCT_PROJECTION_LIMITATION_INVALID:${index}`);
    text(limitation.reason_code, `PRODUCT_PROJECTION_LIMITATION_REASON_REQUIRED:${index}`);
    assertKnownSourceRef(optionalText(limitation.source_ref_key), sourceRefs, "PRODUCT_PROJECTION_LIMITATION_UNKNOWN_REF");
    optionalText(limitation.detail);
  }

  const freshness = record(obj.freshness, "PRODUCT_PROJECTION_FRESHNESS_REQUIRED");
  enumValue(freshness.status, PRODUCT_PROJECTION_FRESHNESS_STATUSES_V1, "PRODUCT_PROJECTION_FRESHNESS_STATUS_INVALID");
  explicitIso(freshness.evaluated_at, "PRODUCT_PROJECTION_FRESHNESS_EVALUATED_AT_INVALID");
  enumValue(freshness.basis, PRODUCT_PROJECTION_FRESHNESS_BASES_V1, "PRODUCT_PROJECTION_FRESHNESS_BASIS_INVALID");
  stringArray(freshness.reason_codes, "PRODUCT_PROJECTION_FRESHNESS_REASON_CODES_INVALID");
  enumValue(obj.projection_semantics, PRODUCT_PROJECTION_SEMANTICS_V1, "PRODUCT_PROJECTION_SEMANTICS_INVALID");
}

export function assertProductProjectionInteractionHintsV1(input: unknown, envelope: ProductProjectionEnvelopeV1): asserts input is ProductProjectionInteractionHintsV1 {
  const obj = record(input, "PRODUCT_PROJECTION_INTERACTION_HINTS_REQUIRED");
  text(obj.caller_context_id, "PRODUCT_PROJECTION_CALLER_CONTEXT_REQUIRED");
  const authorityRefs = authorityRefMap(envelope);
  for (const [index, value] of array(obj.allowed_intents, "PRODUCT_PROJECTION_ALLOWED_INTENTS_REQUIRED").entries()) {
    const hint = record(value, `PRODUCT_PROJECTION_INTENT_INVALID:${index}`);
    text(hint.intent, `PRODUCT_PROJECTION_INTENT_NAME_REQUIRED:${index}`);
    enumValue(hint.command_owner, PRODUCT_PROJECTION_COMMAND_OWNERS_V1, `PRODUCT_PROJECTION_COMMAND_OWNER_INVALID:${index}`);
    stringArray(hint.required_capabilities, `PRODUCT_PROJECTION_REQUIRED_CAPABILITIES_INVALID:${index}`);
    const targets = stringArray(hint.target_authority_ref_keys, `PRODUCT_PROJECTION_TARGET_REFS_INVALID:${index}`);
    assertKnownAuthorityRefs(targets, authorityRefs, "PRODUCT_PROJECTION_INTENT_UNKNOWN_AUTHORITY_TARGET_REF");
    text(hint.display_reason_code, `PRODUCT_PROJECTION_DISPLAY_REASON_REQUIRED:${index}`);
    if (hint.requires_command_reauthorization !== true) throw new ProductProjectionContractError("PRODUCT_PROJECTION_COMMAND_REAUTHORIZATION_REQUIRED", "PRODUCT_PROJECTION_COMMAND_REAUTHORIZATION_REQUIRED");
  }
}

export function assertGovernedActionCaseProjectionV1(input: unknown): asserts input is GovernedActionCaseProjectionV1 {
  const obj = record(input, "GOVERNED_ACTION_CASE_REQUIRED");
  assertProductProjectionEnvelopeV1(obj.envelope);
  const envelope = obj.envelope as ProductProjectionEnvelopeV1;
  if (envelope.projection_type !== "GOVERNED_ACTION_CASE") throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_PROJECTION_TYPE_INVALID", "GOVERNED_ACTION_CASE_PROJECTION_TYPE_INVALID");
  const authorityRefs = authorityRefMap(envelope);
  const nonAuthorityRefs = nonAuthorityRefMap(envelope);
  const sourceRefs = sourceRefKeySet(envelope);

  const anchor = record(obj.case_anchor, "GOVERNED_ACTION_CASE_ANCHOR_REQUIRED");
  assertKnownAuthorityRef(text(anchor.source_ref_key, "GOVERNED_ACTION_CASE_ANCHOR_REF_REQUIRED"), authorityRefs, "GOVERNED_ACTION_CASE_ANCHOR_UNKNOWN_AUTHORITY_REF");
  enumValue(anchor.anchor_kind, GOVERNED_ACTION_CASE_ANCHOR_KINDS_V1, "GOVERNED_ACTION_CASE_ANCHOR_KIND_INVALID");
  text(obj.action_type, "GOVERNED_ACTION_CASE_ACTION_TYPE_REQUIRED");
  const composition = enumValue(obj.composition_status, GOVERNED_ACTION_COMPOSITION_STATUSES_V1, "GOVERNED_ACTION_CASE_COMPOSITION_STATUS_INVALID");

  const proofs = array(obj.linkage_proofs, "GOVERNED_ACTION_CASE_LINKAGE_PROOFS_REQUIRED");
  for (const [index, value] of proofs.entries()) {
    const proof = record(value, `GOVERNED_ACTION_CASE_LINKAGE_PROOF_INVALID:${index}`);
    assertKnownAuthorityRef(text(proof.from_source_ref_key, `GOVERNED_ACTION_CASE_LINKAGE_FROM_REQUIRED:${index}`), authorityRefs, "GOVERNED_ACTION_CASE_LINKAGE_FROM_UNKNOWN_AUTHORITY_REF");
    assertKnownAuthorityRef(text(proof.to_source_ref_key, `GOVERNED_ACTION_CASE_LINKAGE_TO_REQUIRED:${index}`), authorityRefs, "GOVERNED_ACTION_CASE_LINKAGE_TO_UNKNOWN_AUTHORITY_REF");
    enumValue(proof.linkage_kind, GOVERNED_ACTION_LINKAGE_KINDS_V1, `GOVERNED_ACTION_CASE_LINKAGE_KIND_INVALID:${index}`);
    assertKnownSourceRef(optionalText(proof.evidence_ref_key), sourceRefs, "GOVERNED_ACTION_CASE_LINKAGE_EVIDENCE_UNKNOWN_REF");
  }
  if (composition === "EXACT_REF_LINKED" && proofs.length === 0) throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_EXACT_LINKAGE_PROOF_REQUIRED", "GOVERNED_ACTION_CASE_EXACT_LINKAGE_PROOF_REQUIRED");

  const current = record(obj.current_context, "GOVERNED_ACTION_CASE_CURRENT_CONTEXT_REQUIRED");
  explicitIso(current.current_projection_time, "GOVERNED_ACTION_CASE_CURRENT_PROJECTION_TIME_INVALID");
  assertKnownAuthorityRef(optionalText(current.current_field_state_ref_key), authorityRefs, "GOVERNED_ACTION_CASE_CURRENT_FIELD_STATE_UNKNOWN_AUTHORITY_REF");
  if (current.current_state_effective_interval !== null) {
    assertProductProjectionEnvelopeV1({ ...envelope, source_effective_interval: current.current_state_effective_interval });
  }
  assertKnownAuthorityRefs(stringArray(current.current_forecast_ref_keys, "GOVERNED_ACTION_CASE_CURRENT_FORECAST_REFS_INVALID"), authorityRefs, "GOVERNED_ACTION_CASE_CURRENT_FORECAST_UNKNOWN_AUTHORITY_REF");
  stringArray(current.current_limitation_reason_codes, "GOVERNED_ACTION_CASE_CURRENT_LIMITATIONS_INVALID");
  enumValue(current.current_context_status, GOVERNED_ACTION_CURRENT_CONTEXT_STATUSES_V1, "GOVERNED_ACTION_CASE_CURRENT_CONTEXT_STATUS_INVALID");

  const basis = record(obj.decision_time_basis, "GOVERNED_ACTION_CASE_DECISION_TIME_BASIS_REQUIRED");
  const integrity = enumValue(basis.basis_integrity, DECISION_BASIS_INTEGRITY_STATUSES_V1, "GOVERNED_ACTION_CASE_BASIS_INTEGRITY_INVALID");
  const sourceMode = enumValue(basis.historical_basis_source, DECISION_BASIS_SOURCE_MODES_V1, "GOVERNED_ACTION_CASE_BASIS_SOURCE_INVALID");
  if (basis.current_state_substitution_forbidden !== true) throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_CURRENT_STATE_SUBSTITUTION_FORBIDDEN", "GOVERNED_ACTION_CASE_CURRENT_STATE_SUBSTITUTION_FORBIDDEN");

  const decisionRef = optionalText(basis.decision_ref_key);
  const manifestRef = optionalText(basis.decision_time_manifest_ref_key);
  const stateAtDecision = optionalText(basis.field_state_ref_at_decision_key);
  const applicabilityRef = optionalText(basis.applicability_ref_key);
  const eligibilityRef = optionalText(basis.runtime_eligibility_ref_key);
  assertKnownAuthorityRef(decisionRef, authorityRefs, "GOVERNED_ACTION_CASE_DECISION_REF_UNKNOWN_AUTHORITY_REF");
  assertNonAuthorityRefClass(manifestRef, nonAuthorityRefs, "COMPOSITION_MANIFEST", "GOVERNED_ACTION_CASE_MANIFEST_MUST_BE_NON_AUTHORITY_COMPOSITION_REF");
  assertKnownAuthorityRef(stateAtDecision, authorityRefs, "GOVERNED_ACTION_CASE_DECISION_STATE_UNKNOWN_AUTHORITY_REF");
  assertKnownAuthorityRef(applicabilityRef, authorityRefs, "GOVERNED_ACTION_CASE_APPLICABILITY_UNKNOWN_AUTHORITY_REF");
  assertKnownAuthorityRef(eligibilityRef, authorityRefs, "GOVERNED_ACTION_CASE_ELIGIBILITY_UNKNOWN_AUTHORITY_REF");

  const bindingRefs = stringArray(basis.runtime_binding_ref_keys, "GOVERNED_ACTION_CASE_RUNTIME_BINDING_REFS_INVALID");
  assertKnownAuthorityRefs(bindingRefs, authorityRefs, "GOVERNED_ACTION_CASE_RUNTIME_BINDING_UNKNOWN_AUTHORITY_REF");
  const decisionBasisRefs = stringArray(basis.decision_basis_ref_keys, "GOVERNED_ACTION_CASE_DECISION_BASIS_REFS_INVALID");
  assertKnownSourceRefs(decisionBasisRefs, sourceRefs, "GOVERNED_ACTION_CASE_DECISION_BASIS_UNKNOWN_REF");
  const providerRefs = stringArray(basis.provider_ref_keys, "GOVERNED_ACTION_CASE_PROVIDER_REFS_INVALID");
  const measurementRefs = stringArray(basis.measurement_ref_keys, "GOVERNED_ACTION_CASE_MEASUREMENT_REFS_INVALID");
  const verificationRefs = stringArray(basis.verification_state_ref_keys, "GOVERNED_ACTION_CASE_VERIFICATION_REFS_INVALID");
  assertNonAuthorityRefClasses(providerRefs, nonAuthorityRefs, "PROVIDER", "GOVERNED_ACTION_CASE_PROVIDER_MUST_BE_NON_AUTHORITY_REF");
  assertNonAuthorityRefClasses(measurementRefs, nonAuthorityRefs, "MEASUREMENT", "GOVERNED_ACTION_CASE_MEASUREMENT_MUST_BE_NON_AUTHORITY_REF");
  assertNonAuthorityRefClasses(verificationRefs, nonAuthorityRefs, "VERIFICATION_STATE", "GOVERNED_ACTION_CASE_VERIFICATION_MUST_BE_NON_AUTHORITY_REF");
  enumValue(basis.capture_integrity, DECISION_CAPTURE_INTEGRITY_STATUSES_V1, "GOVERNED_ACTION_CASE_CAPTURE_INTEGRITY_INVALID");

  if (integrity === "UNAVAILABLE") {
    if (sourceMode !== "UNAVAILABLE") throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_UNAVAILABLE_BASIS_SOURCE_MISMATCH", "GOVERNED_ACTION_CASE_UNAVAILABLE_BASIS_SOURCE_MISMATCH");
    const forbidden = [manifestRef, stateAtDecision, applicabilityRef, eligibilityRef, optionalText(basis.decision_basis_digest), ...bindingRefs, ...decisionBasisRefs, ...providerRefs, ...measurementRefs, ...verificationRefs].filter(Boolean);
    if (forbidden.length > 0) throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_UNAVAILABLE_BASIS_CANNOT_FALLBACK", "GOVERNED_ACTION_CASE_UNAVAILABLE_BASIS_CANNOT_FALLBACK");
  } else {
    if (!decisionRef || !optionalText(basis.decision_time) || !optionalText(basis.evidence_cutoff)) throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_DECISION_TIME_BASIS_INCOMPLETE", "GOVERNED_ACTION_CASE_DECISION_TIME_BASIS_INCOMPLETE");
    explicitIso(basis.decision_time, "GOVERNED_ACTION_CASE_DECISION_TIME_INVALID");
    explicitIso(basis.evidence_cutoff, "GOVERNED_ACTION_CASE_EVIDENCE_CUTOFF_INVALID");
    if (integrity === "EXACT_MANIFEST" && !manifestRef) throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_EXACT_MANIFEST_REF_REQUIRED", "GOVERNED_ACTION_CASE_EXACT_MANIFEST_REF_REQUIRED");
  }

  const later = record(obj.later_changes, "GOVERNED_ACTION_CASE_LATER_CHANGES_REQUIRED");
  enumValue(later.current_state_differs, TRI_STATE_COMPARISON_VALUES_V1, "GOVERNED_ACTION_CASE_CURRENT_STATE_DIFFERS_INVALID");
  enumValue(later.later_evidence_available, TRI_STATE_COMPARISON_VALUES_V1, "GOVERNED_ACTION_CASE_LATER_EVIDENCE_INVALID");
  assertKnownSourceRefs(stringArray(later.later_arriving_or_revised_ref_keys, "GOVERNED_ACTION_CASE_LATER_REFS_INVALID"), sourceRefs, "GOVERNED_ACTION_CASE_LATER_UNKNOWN_REF");
  assertKnownSourceRefs(stringArray(later.comparison_basis_ref_keys, "GOVERNED_ACTION_CASE_COMPARISON_REFS_INVALID"), sourceRefs, "GOVERNED_ACTION_CASE_COMPARISON_UNKNOWN_REF");
  stringArray(later.comparison_limitation_reason_codes, "GOVERNED_ACTION_CASE_COMPARISON_LIMITATIONS_INVALID");

  const chain = record(obj.authority_chain, "GOVERNED_ACTION_CASE_AUTHORITY_CHAIN_REQUIRED");
  const slotNames = [
    "agronomic_decision", "recommendation_candidate", "approval_request", "approval_decision", "operation_plan",
    "execution_authorization", "task", "dispatch", "executor", "device", "execution_receipt", "as_executed",
    "execution_evidence_acceptance", "attribution",
  ] as const;
  for (const slotName of slotNames) {
    const slot = record(chain[slotName], `GOVERNED_ACTION_CASE_SLOT_REQUIRED:${slotName}`);
    assertKnownAuthorityRef(optionalText(slot.ref_key), authorityRefs, `GOVERNED_ACTION_CASE_SLOT_UNKNOWN_AUTHORITY_REF:${slotName}`);
    optionalText(slot.source_status);
  }
  assertKnownAuthorityRefs(stringArray(chain.evidence_artifact_ref_keys, "GOVERNED_ACTION_CASE_EVIDENCE_ARTIFACT_REFS_INVALID"), authorityRefs, "GOVERNED_ACTION_CASE_EVIDENCE_ARTIFACT_UNKNOWN_AUTHORITY_REF");
  assertKnownAuthorityRefs(stringArray(chain.outcome_ref_keys, "GOVERNED_ACTION_CASE_OUTCOME_REFS_INVALID"), authorityRefs, "GOVERNED_ACTION_CASE_OUTCOME_UNKNOWN_AUTHORITY_REF");

  const display = enumValue(obj.derived_display_phase, GOVERNED_ACTION_DISPLAY_PHASES_V1, "GOVERNED_ACTION_CASE_DISPLAY_PHASE_INVALID");
  if (composition === "UNRESOLVED" && display !== "LINKAGE_INCOMPLETE") throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_UNRESOLVED_MUST_DISPLAY_LINKAGE_INCOMPLETE", "GOVERNED_ACTION_CASE_UNRESOLVED_MUST_DISPLAY_LINKAGE_INCOMPLETE");

  const approvalRequest = record(chain.approval_request, "GOVERNED_ACTION_CASE_APPROVAL_REQUEST_SLOT_REQUIRED");
  const approvalDecision = record(chain.approval_decision, "GOVERNED_ACTION_CASE_APPROVAL_DECISION_SLOT_REQUIRED");
  const receipt = record(chain.execution_receipt, "GOVERNED_ACTION_CASE_RECEIPT_SLOT_REQUIRED");
  const asExecuted = record(chain.as_executed, "GOVERNED_ACTION_CASE_AS_EXECUTED_SLOT_REQUIRED");
  const acceptance = record(chain.execution_evidence_acceptance, "GOVERNED_ACTION_CASE_ACCEPTANCE_SLOT_REQUIRED");
  if (display === "AWAITING_APPROVAL" && (!optionalText(approvalRequest.ref_key) || optionalText(approvalDecision.ref_key))) throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_AWAITING_APPROVAL_PHASE_REQUIRES_PENDING_APPROVAL_REF", "GOVERNED_ACTION_CASE_AWAITING_APPROVAL_PHASE_REQUIRES_PENDING_APPROVAL_REF");
  if (["APPROVED", "PLAN_PREPARING", "PLAN_READY", "READY_FOR_DISPATCH"].includes(display) && !optionalText(approvalDecision.ref_key)) throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_POST_APPROVAL_PHASE_REQUIRES_APPROVAL_DECISION_REF", "GOVERNED_ACTION_CASE_POST_APPROVAL_PHASE_REQUIRES_APPROVAL_DECISION_REF");
  if (display === "EXECUTION_REPORTED" && !optionalText(receipt.ref_key) && !optionalText(asExecuted.ref_key)) throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_EXECUTION_REPORTED_REQUIRES_SOURCE_REF", "GOVERNED_ACTION_CASE_EXECUTION_REPORTED_REQUIRES_SOURCE_REF");
  if (display === "EVIDENCE_REVIEW" && array(chain.evidence_artifact_ref_keys, "GOVERNED_ACTION_CASE_EVIDENCE_ARTIFACT_REFS_REQUIRED").length === 0) throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_EVIDENCE_REVIEW_REQUIRES_EVIDENCE_REF", "GOVERNED_ACTION_CASE_EVIDENCE_REVIEW_REQUIRES_EVIDENCE_REF");
  if (display === "EXECUTION_EVIDENCE_ACCEPTED" && !optionalText(acceptance.ref_key)) throw new ProductProjectionContractError("GOVERNED_ACTION_CASE_ACCEPTED_PHASE_REQUIRES_ACCEPTANCE_REF", "GOVERNED_ACTION_CASE_ACCEPTED_PHASE_REQUIRES_ACCEPTANCE_REF");
}

export function deriveCapabilityAvailabilityStateV1(input: {
  product_implementation: CapabilityProductImplementationStatusV1;
  authority_maturity: CapabilityAuthorityMaturityStatusV1;
  operational_eligibility: CapabilityOperationalEligibilityStatusV1;
}): CapabilityAvailabilityDerivedStateV1 {
  if (input.product_implementation === "NOT_BUILT" || input.authority_maturity === "NOT_AUTHORIZED") return { customer_state: "NOT_YET_AVAILABLE", default_release_surface_state: "DISABLED" };
  if (input.authority_maturity === "PREVIEW") {
    return ["CURRENT", "DEGRADED"].includes(input.operational_eligibility)
      ? { customer_state: "PREVIEW", default_release_surface_state: "PREVIEW" }
      : { customer_state: "PREVIEW", default_release_surface_state: "DISABLED" };
  }
  if (["EXPIRED", "UNAVAILABLE"].includes(input.operational_eligibility)) return { customer_state: "LIMITED", default_release_surface_state: "DISABLED" };
  if (input.operational_eligibility === "DEGRADED" || input.product_implementation === "PARTIAL") return { customer_state: "LIMITED", default_release_surface_state: "LIMITED" };
  return { customer_state: "AVAILABLE", default_release_surface_state: "ACTIVE" };
}

export function assertCapabilityAvailabilityProjectionV1(input: unknown): asserts input is CapabilityAvailabilityProjectionV1 {
  const obj = record(input, "CAPABILITY_AVAILABILITY_PROJECTION_REQUIRED");
  assertProductProjectionEnvelopeV1(obj.envelope);
  const envelope = obj.envelope as ProductProjectionEnvelopeV1;
  if (envelope.projection_type !== "CAPABILITY_AVAILABILITY") throw new ProductProjectionContractError("CAPABILITY_AVAILABILITY_PROJECTION_TYPE_INVALID", "CAPABILITY_AVAILABILITY_PROJECTION_TYPE_INVALID");
  const authorityRefs = authorityRefMap(envelope);
  const nonAuthorityRefs = nonAuthorityRefMap(envelope);
  const sourceRefs = sourceRefKeySet(envelope);
  text(obj.capability_id, "CAPABILITY_AVAILABILITY_ID_REQUIRED");

  const scope = record(obj.availability_scope, "CAPABILITY_AVAILABILITY_SCOPE_REQUIRED");
  const scopeKind = enumValue(scope.scope_kind, CAPABILITY_AVAILABILITY_SCOPE_KINDS_V1, "CAPABILITY_AVAILABILITY_SCOPE_KIND_INVALID");
  const fieldId = optionalText(scope.field_id);
  const actionType = optionalText(scope.action_type);
  optionalText(scope.zone_id);
  if (["FIELD", "FIELD_ACTION_TYPE"].includes(scopeKind) && !fieldId) throw new ProductProjectionContractError("CAPABILITY_AVAILABILITY_FIELD_SCOPE_REQUIRED", "CAPABILITY_AVAILABILITY_FIELD_SCOPE_REQUIRED");
  if (scopeKind === "FIELD_ACTION_TYPE" && !actionType) throw new ProductProjectionContractError("CAPABILITY_AVAILABILITY_ACTION_TYPE_REQUIRED", "CAPABILITY_AVAILABILITY_ACTION_TYPE_REQUIRED");

  const implementation = enumValue(obj.product_implementation, CAPABILITY_PRODUCT_IMPLEMENTATION_STATUSES_V1, "CAPABILITY_AVAILABILITY_IMPLEMENTATION_INVALID");
  const authority = enumValue(obj.authority_maturity, CAPABILITY_AUTHORITY_MATURITY_STATUSES_V1, "CAPABILITY_AVAILABILITY_AUTHORITY_INVALID");
  const operational = enumValue(obj.operational_eligibility, CAPABILITY_OPERATIONAL_ELIGIBILITY_STATUSES_V1, "CAPABILITY_AVAILABILITY_OPERATIONAL_INVALID");
  const customerState = enumValue(obj.customer_state, CAPABILITY_CUSTOMER_STATES_V1, "CAPABILITY_AVAILABILITY_CUSTOMER_STATE_INVALID");
  const releaseState = enumValue(obj.default_release_surface_state, CAPABILITY_RELEASE_SURFACE_STATES_V1, "CAPABILITY_AVAILABILITY_RELEASE_STATE_INVALID");
  const expected = deriveCapabilityAvailabilityStateV1({ product_implementation: implementation, authority_maturity: authority, operational_eligibility: operational });
  if (customerState !== expected.customer_state || releaseState !== expected.default_release_surface_state) throw new ProductProjectionContractError("CAPABILITY_AVAILABILITY_DERIVATION_MISMATCH", "CAPABILITY_AVAILABILITY_DERIVATION_MISMATCH");

  const reasons = stringArray(obj.reason_codes, "CAPABILITY_AVAILABILITY_REASON_CODES_INVALID");
  if (customerState !== "AVAILABLE" && reasons.length === 0) throw new ProductProjectionContractError("CAPABILITY_AVAILABILITY_REASON_REQUIRED", "CAPABILITY_AVAILABILITY_REASON_REQUIRED");

  const productRefs = stringArray(obj.product_release_basis_ref_keys, "CAPABILITY_AVAILABILITY_PRODUCT_BASIS_REFS_INVALID");
  const authorityBasis = stringArray(obj.authority_maturity_basis_ref_keys, "CAPABILITY_AVAILABILITY_AUTHORITY_BASIS_REFS_INVALID");
  const operationalBasis = stringArray(obj.operational_eligibility_basis_ref_keys, "CAPABILITY_AVAILABILITY_OPERATIONAL_BASIS_REFS_INVALID");
  assertNonAuthorityRefClasses(productRefs, nonAuthorityRefs, "PRODUCT_GOVERNANCE", "CAPABILITY_AVAILABILITY_PRODUCT_BASIS_MUST_BE_PRODUCT_GOVERNANCE_REF");
  assertKnownAuthorityRefs(authorityBasis, authorityRefs, "CAPABILITY_AVAILABILITY_AUTHORITY_BASIS_UNKNOWN_AUTHORITY_REF");
  assertKnownSourceRefs(operationalBasis, sourceRefs, "CAPABILITY_AVAILABILITY_OPERATIONAL_BASIS_UNKNOWN_REF");
  if (implementation !== "NOT_BUILT" && productRefs.length === 0) throw new ProductProjectionContractError("CAPABILITY_AVAILABILITY_PRODUCT_RELEASE_BASIS_REQUIRED", "CAPABILITY_AVAILABILITY_PRODUCT_RELEASE_BASIS_REQUIRED");
  if (authority !== "NOT_AUTHORIZED" && authorityBasis.length === 0) throw new ProductProjectionContractError("CAPABILITY_AVAILABILITY_AUTHORITY_BASIS_REQUIRED", "CAPABILITY_AVAILABILITY_AUTHORITY_BASIS_REQUIRED");
  if (operational !== "UNAVAILABLE" && operationalBasis.length === 0) throw new ProductProjectionContractError("CAPABILITY_AVAILABILITY_OPERATIONAL_BASIS_REQUIRED", "CAPABILITY_AVAILABILITY_OPERATIONAL_BASIS_REQUIRED");
  explicitIso(obj.evaluated_at, "CAPABILITY_AVAILABILITY_EVALUATED_AT_INVALID");
}

export function assertAttentionQueueProjectionV1(input: unknown): asserts input is AttentionQueueProjectionV1 {
  const obj = record(input, "ATTENTION_QUEUE_PROJECTION_REQUIRED");
  assertProductProjectionEnvelopeV1(obj.envelope);
  const envelope = obj.envelope as ProductProjectionEnvelopeV1;
  if (envelope.projection_type !== "ATTENTION_QUEUE") throw new ProductProjectionContractError("ATTENTION_QUEUE_PROJECTION_TYPE_INVALID", "ATTENTION_QUEUE_PROJECTION_TYPE_INVALID");
  const authorityRefs = authorityRefMap(envelope);
  const nonAuthorityRefs = nonAuthorityRefMap(envelope);
  for (const [index, value] of array(obj.items, "ATTENTION_QUEUE_ITEMS_REQUIRED").entries()) {
    const item = record(value, `ATTENTION_QUEUE_ITEM_INVALID:${index}`);
    for (const forbidden of ["priority", "severity", "risk_score"]) {
      if (Object.prototype.hasOwnProperty.call(item, forbidden)) throw new ProductProjectionContractError(`ATTENTION_QUEUE_PRODUCT_OWNED_${forbidden.toUpperCase()}_FORBIDDEN`, `ATTENTION_QUEUE_PRODUCT_OWNED_${forbidden.toUpperCase()}_FORBIDDEN`);
    }
    text(item.attention_id, `ATTENTION_QUEUE_ATTENTION_ID_REQUIRED:${index}`);
    const itemScope = record(item.subject_scope, `ATTENTION_QUEUE_SUBJECT_SCOPE_REQUIRED:${index}`);
    text(itemScope.tenant_id, `ATTENTION_QUEUE_TENANT_REQUIRED:${index}`);
    text(itemScope.project_id, `ATTENTION_QUEUE_PROJECT_REQUIRED:${index}`);
    text(itemScope.group_id, `ATTENTION_QUEUE_GROUP_REQUIRED:${index}`);
    optionalText(item.action_case_projection_id);
    text(item.attention_kind, `ATTENTION_QUEUE_KIND_REQUIRED:${index}`);
    enumValue(item.triage_bucket, ATTENTION_TRIAGE_BUCKETS_V1, `ATTENTION_QUEUE_TRIAGE_BUCKET_INVALID:${index}`);
    text(item.attention_reason_code, `ATTENTION_QUEUE_REASON_REQUIRED:${index}`);
    const sources = nonEmptyStringArray(item.source_authority_ref_keys, `ATTENTION_QUEUE_SOURCE_REFS_REQUIRED:${index}`);
    assertKnownAuthorityRefs(sources, authorityRefs, "ATTENTION_QUEUE_SOURCE_UNKNOWN_AUTHORITY_REF");

    if (item.blocking_state !== null) {
      const blocking = record(item.blocking_state, `ATTENTION_QUEUE_BLOCKING_STATE_INVALID:${index}`);
      assertKnownAuthorityRef(text(blocking.source_ref_key, `ATTENTION_QUEUE_BLOCKING_REF_REQUIRED:${index}`), authorityRefs, "ATTENTION_QUEUE_BLOCKING_UNKNOWN_AUTHORITY_REF");
      text(blocking.source_state, `ATTENTION_QUEUE_BLOCKING_STATE_REQUIRED:${index}`);
    }
    const effective = optionalText(item.source_effective_time);
    const cutoff = optionalText(item.source_evidence_cutoff);
    if (effective) explicitIso(effective, `ATTENTION_QUEUE_EFFECTIVE_TIME_INVALID:${index}`);
    if (cutoff) explicitIso(cutoff, `ATTENTION_QUEUE_EVIDENCE_CUTOFF_INVALID:${index}`);

    const due = record(item.due, `ATTENTION_QUEUE_DUE_REQUIRED:${index}`);
    const dueBasis = enumValue(due.due_basis, ATTENTION_DUE_BASES_V1, `ATTENTION_QUEUE_DUE_BASIS_INVALID:${index}`);
    const dueAt = optionalText(due.due_at);
    const dueRef = optionalText(due.basis_ref_key);
    if (dueAt) explicitIso(dueAt, `ATTENTION_QUEUE_DUE_AT_INVALID:${index}`);
    if (dueBasis === "DOMAIN_SOURCE") {
      if (!dueAt || !dueRef) throw new ProductProjectionContractError("ATTENTION_QUEUE_DOMAIN_DUE_BASIS_INCOMPLETE", "ATTENTION_QUEUE_DOMAIN_DUE_BASIS_INCOMPLETE");
      assertKnownAuthorityRef(dueRef, authorityRefs, "ATTENTION_QUEUE_DUE_DOMAIN_BASIS_UNKNOWN_AUTHORITY_REF");
    }
    if (dueBasis === "PRODUCT_SLA") {
      if (!dueAt || !dueRef) throw new ProductProjectionContractError("ATTENTION_QUEUE_PRODUCT_SLA_BASIS_INCOMPLETE", "ATTENTION_QUEUE_PRODUCT_SLA_BASIS_INCOMPLETE");
      assertNonAuthorityRefClass(dueRef, nonAuthorityRefs, "PRODUCT_GOVERNANCE", "ATTENTION_QUEUE_PRODUCT_SLA_MUST_USE_PRODUCT_GOVERNANCE_REF");
    }
    if (dueBasis === "NONE" && (dueAt || dueRef)) throw new ProductProjectionContractError("ATTENTION_QUEUE_NONE_DUE_MUST_BE_EMPTY", "ATTENTION_QUEUE_NONE_DUE_MUST_BE_EMPTY");

    if (!Number.isInteger(item.presentation_rank) || Number(item.presentation_rank) < 0) throw new ProductProjectionContractError("ATTENTION_QUEUE_PRESENTATION_RANK_INVALID", "ATTENTION_QUEUE_PRESENTATION_RANK_INVALID");
    text(item.sort_reason_code, `ATTENTION_QUEUE_SORT_REASON_REQUIRED:${index}`);
    if (item.source_declared_severity !== null) {
      const severity = record(item.source_declared_severity, `ATTENTION_QUEUE_SOURCE_SEVERITY_INVALID:${index}`);
      text(severity.value, `ATTENTION_QUEUE_SOURCE_SEVERITY_VALUE_REQUIRED:${index}`);
      assertKnownAuthorityRef(text(severity.source_ref_key, `ATTENTION_QUEUE_SOURCE_SEVERITY_REF_REQUIRED:${index}`), authorityRefs, "ATTENTION_QUEUE_SOURCE_SEVERITY_REF_UNKNOWN");
    }
  }
}

export const PRODUCT_PROJECTION_FORBIDDEN_AUTHORITY_EFFECTS_V1 = [
  "authority_minted",
  "approval_created",
  "execution_authorized",
  "dispatch_created",
  "receipt_created",
  "domain_fact_created",
  "decision_re_adjudicated",
  "applicability_re_adjudicated",
  "evidence_sufficiency_re_adjudicated",
] as const;
