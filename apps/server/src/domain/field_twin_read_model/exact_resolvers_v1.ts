// apps/server/src/domain/field_twin_read_model/exact_resolvers_v1.ts
// Purpose: implement the MCFT-CAP-07 S2 exact canonical/replay resolvers and fail-closed source, identity, binding, composite, lineage, record-set, and Runtime Health validators.
// Boundary: pure validation over exact caller-supplied rows/facts only; no database access, latest fallback, cross-database stitching, mutation, recommendation, activation, or canonical writing.

import { canonicalJsonV1, omitSemanticFieldsV1, semanticHashV1 } from "../twin_runtime/canonical_json_v1.js";
import type {
  FieldTwinCanonicalObjectRefV1,
  FieldTwinEvidenceRefV1,
  FieldTwinRecordSetValidationV1,
  FieldTwinRuntimeHealthRoleResolutionV1,
  FieldTwinScopeV1,
  FieldTwinSourceValidationObligationRowV1,
  FieldTwinSourceValidationResultV1,
  SemanticHashTextV1,
} from "./contracts_v1.js";

export const REQUIRED_CANONICAL_TWIN_FACT_TYPES_V1 = Object.freeze([
  "twin_runtime_lineage_v1",
  "twin_revision_run_v1",
  "twin_lineage_promotion_v1",
  "twin_runtime_tick_v1",
  "twin_evidence_window_v1",
  "twin_state_transition_v1",
  "twin_assimilation_update_v1",
  "twin_runtime_attempt_v1",
  "twin_forecast_failure_v1",
  "twin_runtime_checkpoint_v1",
  "twin_runtime_health_v1",
  "twin_runtime_config_v1",
  "twin_model_activation_v1",
] as const);

export const REQUIRED_REPLAY_EVIDENCE_FACT_TYPES_V1 = Object.freeze([
  "approval_assertion_evidence_v1",
  "approved_irrigation_plan_snapshot_v1",
  "external_dispatch_evidence_v1",
  "irrigation_execution_receipt_evidence_v1",
] as const);

export type RequiredCanonicalTwinFactTypeV1 = (typeof REQUIRED_CANONICAL_TWIN_FACT_TYPES_V1)[number];
export type RequiredReplayEvidenceFactTypeV1 = (typeof REQUIRED_REPLAY_EVIDENCE_FACT_TYPES_V1)[number];

export class FieldTwinExactResolverErrorV1 extends Error {
  constructor(readonly code: string, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "FieldTwinExactResolverErrorV1";
  }
}

function fail(code: string, detail?: string): never {
  throw new FieldTwinExactResolverErrorV1(code, detail);
}

function asRecord(value: unknown, code = "MCFT_SOURCE_RECORD_INVALID"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
}

function exactString(value: unknown, code: string): string {
  if (typeof value !== "string" || !value) fail(code);
  return value;
}

function semanticHash(value: unknown): SemanticHashTextV1 {
  return semanticHashV1(value) as SemanticHashTextV1;
}

function readPath(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const token of path.split(".").filter(Boolean)) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

function exactScopeFromCanonicalObject(canonicalObject: Record<string, unknown>): FieldTwinScopeV1 {
  const possibleScope = canonicalObject.scope;
  const scope = possibleScope && typeof possibleScope === "object" && !Array.isArray(possibleScope)
    ? possibleScope as Record<string, unknown>
    : canonicalObject;
  return {
    tenant_id: exactString(scope.tenant_id, "MCFT_SCOPE_INVALID:tenant_id"),
    project_id: exactString(scope.project_id, "MCFT_SCOPE_INVALID:project_id"),
    group_id: exactString(scope.group_id, "MCFT_SCOPE_INVALID:group_id"),
    field_id: exactString(scope.field_id, "MCFT_SCOPE_INVALID:field_id"),
    season_id: exactString(scope.season_id, "MCFT_SCOPE_INVALID:season_id"),
    zone_id: exactString(scope.zone_id, "MCFT_SCOPE_INVALID:zone_id"),
  };
}

function assertScopeExact(actual: FieldTwinScopeV1, expected: FieldTwinScopeV1, code: string): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[key] !== expected[key]) fail(code, key);
  }
}

function canonicalObjectFromFact(recordJson: unknown): { fact_type: string; canonical_object: Record<string, unknown> } {
  const envelope = asRecord(recordJson, "MCFT_FACT_ENVELOPE_INVALID");
  return {
    fact_type: exactString(envelope.type, "MCFT_FACT_ENVELOPE_INVALID:type"),
    canonical_object: asRecord(envelope.payload, "MCFT_FACT_ENVELOPE_INVALID:payload"),
  };
}

function canonicalObjectHash(canonicalObject: Record<string, unknown>): SemanticHashTextV1 {
  return semanticHash(omitSemanticFieldsV1(canonicalObject, ["determinism_hash", "fact_id", "created_at", "persisted_at"]));
}

export type ExactCanonicalFactResolutionV1 = {
  fact_id: string;
  object_ref: string;
  object_type: string;
  object_hash: SemanticHashTextV1;
  scope: FieldTwinScopeV1;
  canonical_object: Readonly<Record<string, unknown>>;
};

export class CanonicalTwinFactResolverV1 {
  resolve(input: {
    fact_id: string;
    record_json: unknown;
    expected_type: RequiredCanonicalTwinFactTypeV1;
    expected_object_ref: string;
    expected_scope: FieldTwinScopeV1;
    expected_hash?: SemanticHashTextV1 | null;
  }): ExactCanonicalFactResolutionV1 {
    if (!REQUIRED_CANONICAL_TWIN_FACT_TYPES_V1.includes(input.expected_type)) {
      fail("MCFT_DIRECT_CANONICAL_TWIN_FACT_INVALID", `TYPE_NOT_FROZEN:${input.expected_type}`);
    }
    const { fact_type: factType, canonical_object: canonicalObject } = canonicalObjectFromFact(input.record_json);
    if (factType !== input.expected_type) fail("MCFT_DIRECT_CANONICAL_TWIN_FACT_INVALID", "TYPE");
    const objectRef = exactString(canonicalObject.object_id, "MCFT_DIRECT_CANONICAL_TWIN_FACT_INVALID:OBJECT_ID");
    if (objectRef !== input.expected_object_ref) fail("MCFT_DIRECT_CANONICAL_TWIN_FACT_INVALID", "OBJECT_REF");
    const scope = exactScopeFromCanonicalObject(canonicalObject);
    assertScopeExact(scope, input.expected_scope, "MCFT_DIRECT_CANONICAL_TWIN_FACT_INVALID:SCOPE");
    const recomputedHash = canonicalObjectHash(canonicalObject);
    if (typeof canonicalObject.determinism_hash !== "string") {
      fail("MCFT_DIRECT_CANONICAL_TWIN_FACT_INVALID", "DETERMINISM_HASH_REQUIRED");
    }
    if (canonicalObject.determinism_hash !== recomputedHash) {
      fail("MCFT_DIRECT_CANONICAL_TWIN_FACT_INVALID", "DETERMINISM_HASH");
    }
    if (input.expected_hash && input.expected_hash !== recomputedHash) {
      fail("MCFT_DIRECT_CANONICAL_TWIN_FACT_INVALID", "EXPECTED_HASH");
    }
    return Object.freeze({
      fact_id: input.fact_id,
      object_ref: objectRef,
      object_type: factType,
      object_hash: recomputedHash,
      scope,
      canonical_object: Object.freeze({ ...canonicalObject }),
    });
  }
}

export type ExactReplayEvidenceResolutionV1 = {
  fact_id: string;
  record_type: RequiredReplayEvidenceFactTypeV1;
  source_record_id: string;
  source_record_hash: SemanticHashTextV1;
  available_to_runtime_at: string;
  canonical_payload: Readonly<Record<string, unknown>>;
};

export class ReplayEvidenceFactResolverV1 {
  resolve(input: {
    fact_id: string;
    record_json: unknown;
    expected_type: RequiredReplayEvidenceFactTypeV1;
    expected_source_record_id?: string;
    expected_source_record_hash?: SemanticHashTextV1;
  }): ExactReplayEvidenceResolutionV1 {
    if (!REQUIRED_REPLAY_EVIDENCE_FACT_TYPES_V1.includes(input.expected_type)) {
      fail("MCFT_REPLAY_EVIDENCE_RECORD_TYPE_NOT_FROZEN", input.expected_type);
    }
    const envelope = asRecord(input.record_json, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:ENVELOPE");
    const recordType = exactString(envelope.type, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:TYPE");
    if (recordType !== input.expected_type) fail("MCFT_DIRECT_REPLAY_EVIDENCE_INVALID", "TYPE");
    const payload = asRecord(envelope.payload, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:PAYLOAD");
    const sourceRecordId = exactString(payload.source_record_id, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:SOURCE_ID");
    const sourceRecordHash = exactString(payload.source_record_hash, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:SOURCE_HASH") as SemanticHashTextV1;
    const availableToRuntimeAt = exactString(payload.available_to_runtime_at, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:AVAILABLE_TO_RUNTIME_AT");
    const canonicalPayload = asRecord(payload.canonical_payload, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:CANONICAL_PAYLOAD");
    exactString(payload.evidence_identity_key, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:EVIDENCE_IDENTITY");
    const availableTimestamp = new Date(availableToRuntimeAt);
    if (!Number.isFinite(availableTimestamp.getTime()) || availableTimestamp.toISOString() !== availableToRuntimeAt) {
      fail("MCFT_DIRECT_REPLAY_EVIDENCE_INVALID", "AVAILABLE_TO_RUNTIME_AT");
    }
    const sourcePayload = asRecord(payload.source_payload, "MCFT_DIRECT_REPLAY_EVIDENCE_INVALID:SOURCE_PAYLOAD");
    if (semanticHash(sourcePayload) !== semanticHash(canonicalPayload)) {
      fail("MCFT_DIRECT_REPLAY_EVIDENCE_INVALID", "SOURCE_CANONICAL_PAYLOAD_DIVERGENCE");
    }
    const sourceRecordSemantic: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (key !== "source_record_hash" && key !== "materialized_file_location") sourceRecordSemantic[key] = value;
    }
    if (semanticHash(sourceRecordSemantic) !== sourceRecordHash) {
      fail("MCFT_DIRECT_REPLAY_EVIDENCE_INVALID", "SOURCE_HASH_MISMATCH");
    }
    if (input.expected_source_record_id && input.expected_source_record_id !== sourceRecordId) {
      fail("MCFT_DIRECT_REPLAY_EVIDENCE_INVALID", "SOURCE_ID_MISMATCH");
    }
    if (input.expected_source_record_hash && input.expected_source_record_hash !== sourceRecordHash) {
      fail("MCFT_DIRECT_REPLAY_EVIDENCE_INVALID", "SOURCE_HASH_MISMATCH");
    }
    return Object.freeze({
      fact_id: input.fact_id,
      record_type: input.expected_type,
      source_record_id: sourceRecordId,
      source_record_hash: sourceRecordHash,
      available_to_runtime_at: availableToRuntimeAt,
      canonical_payload: Object.freeze({ ...canonicalPayload }),
    });
  }
}

function validateProjectionColumns(input: {
  obligation: FieldTwinSourceValidationObligationRowV1;
  projection_row: Record<string, unknown>;
  canonical_context: Record<string, unknown>;
}): FieldTwinSourceValidationResultV1 {
  for (const rawComparison of input.obligation.required_column_comparisons) {
    const comparison = asRecord(rawComparison, input.obligation.failure_code);
    const projectionColumn = exactString(comparison.projection_column, input.obligation.failure_code);
    const canonicalPath = exactString(comparison.canonical_path, input.obligation.failure_code);
    if (canonicalJsonV1(input.projection_row[projectionColumn]) !== canonicalJsonV1(readPath(input.canonical_context, canonicalPath))) {
      fail(input.obligation.failure_code, projectionColumn);
    }
  }
  return {
    source_name: input.obligation.source_name,
    profile_family: input.obligation.profile_family,
    validation_status: "PASS",
    failure_code: null,
    validated_object_ref: null,
    validated_object_hash: null,
    evidence_refs: [],
  };
}

export class AggregateProjectionValidatorV1 {
  validate(input: {
    obligation: FieldTwinSourceValidationObligationRowV1;
    projection_row: Record<string, unknown>;
    canonical_context: Record<string, unknown>;
  }): FieldTwinSourceValidationResultV1 {
    if (input.obligation.profile_family !== "CANONICAL_AGGREGATE_PROJECTION") {
      fail("MCFT_AGGREGATE_PROJECTION_CANONICAL_DIVERGENCE", "PROFILE");
    }
    return validateProjectionColumns(input);
  }
}

export class EmbeddedChildProjectionValidatorV1 {
  validate(input: {
    obligation: FieldTwinSourceValidationObligationRowV1;
    child_row: Record<string, unknown>;
    canonical_parent_context: Record<string, unknown>;
    expected_parent_ref: string;
    actual_parent_ref: string;
  }): FieldTwinSourceValidationResultV1 {
    if (input.obligation.profile_family !== "EMBEDDED_CHILD_PROJECTION") {
      fail("MCFT_EMBEDDED_CHILD_CANONICAL_DIVERGENCE", "PROFILE");
    }
    if (input.expected_parent_ref !== input.actual_parent_ref) {
      fail("MCFT_EMBEDDED_CHILD_CANONICAL_DIVERGENCE", "PARENT_REF");
    }
    return validateProjectionColumns({
      obligation: input.obligation,
      projection_row: input.child_row,
      canonical_context: input.canonical_parent_context,
    });
  }
}

export class OperationalPointerValidatorV1 {
  validate(input: {
    pointer_ref: string;
    pointer_hash: SemanticHashTextV1 | null;
    canonical_ref: string;
    canonical_hash: SemanticHashTextV1;
    scope: FieldTwinScopeV1;
    canonical_scope: FieldTwinScopeV1;
  }): FieldTwinCanonicalObjectRefV1 {
    if (input.pointer_ref !== input.canonical_ref || (input.pointer_hash && input.pointer_hash !== input.canonical_hash)) {
      fail("MCFT_OPERATIONAL_POINTER_INVALID");
    }
    assertScopeExact(input.scope, input.canonical_scope, "MCFT_OPERATIONAL_POINTER_INVALID:SCOPE");
    return { object_ref: input.canonical_ref, object_type: "EXACT_POINTER_TARGET", object_hash: input.canonical_hash, source_fact_ref: null };
  }
}

export class RecordSetIdentityValidatorV1 {
  validate(input: {
    record_set_id: string;
    identity_kind: string;
    declared_member_refs: readonly FieldTwinCanonicalObjectRefV1[];
    actual_member_refs: readonly FieldTwinCanonicalObjectRefV1[];
    aggregate_determinism_hash: SemanticHashTextV1;
  }): FieldTwinRecordSetValidationV1 {
    const normalize = (members: readonly FieldTwinCanonicalObjectRefV1[]) => [...members]
      .map((member) => ({ object_ref: member.object_ref, object_type: member.object_type, object_hash: member.object_hash, source_fact_ref: member.source_fact_ref }))
      .sort((a, b) => a.object_ref.localeCompare(b.object_ref));
    const declared = normalize(input.declared_member_refs);
    const actual = normalize(input.actual_member_refs);
    if (canonicalJsonV1(declared) !== canonicalJsonV1(actual)) fail("MCFT_RECORD_SET_IDENTITY_INVALID", "MEMBERS");
    const recomputed = semanticHash({
      record_set_id: input.record_set_id,
      identity_kind: input.identity_kind,
      members: actual.map((member) => ({ object_ref: member.object_ref, object_hash: member.object_hash })),
    });
    if (recomputed !== input.aggregate_determinism_hash) fail("MCFT_RECORD_SET_IDENTITY_INVALID", "AGGREGATE_HASH");
    return {
      validation_status: "PASS",
      record_set_id: input.record_set_id,
      identity_kind: input.identity_kind,
      aggregate_determinism_hash: input.aggregate_determinism_hash,
      recomputed_aggregate_determinism_hash: recomputed,
      exact_member_count: actual.length,
      exact_member_refs: actual,
      failure_code: null,
    };
  }
}

export class ActiveLineageAuthorityValidatorV1 {
  validateInitial(input: {
    active_lineage_ref: string;
    activation_authority_ref: string;
    lineage_object_ref: string;
    lineage_kind: string;
    expected_previous_active_lineage: string | null;
  }): void {
    if (input.active_lineage_ref !== input.lineage_object_ref || input.activation_authority_ref !== input.lineage_object_ref ||
        input.lineage_kind !== "INITIAL" || input.expected_previous_active_lineage !== null) {
      fail("MCFT_ACTIVE_LINEAGE_AUTHORITY_INVALID", "INITIAL");
    }
  }

  validateRevision(input: {
    active_lineage_ref: string;
    promotion_candidate_lineage_ref: string;
    candidate_lineage_kind: string;
    promotion_revision_run_ref: string;
    revision_run_ref: string;
    revision_terminal_status: string;
    validated_chain_refs: readonly string[];
  }): void {
    if (input.active_lineage_ref !== input.promotion_candidate_lineage_ref || input.candidate_lineage_kind !== "REVISION_CANDIDATE" ||
        input.promotion_revision_run_ref !== input.revision_run_ref || input.revision_terminal_status !== "COMPLETED" ||
        !input.validated_chain_refs.includes(input.active_lineage_ref) || !input.validated_chain_refs.includes(input.revision_run_ref)) {
      fail("MCFT_REVISION_PROMOTION_CHAIN_INVALID");
    }
  }
}

export class EvidenceBindingValidatorV1 {
  validate(input: {
    declared_refs: readonly FieldTwinEvidenceRefV1[];
    resolved_refs: readonly FieldTwinEvidenceRefV1[];
    scope: FieldTwinScopeV1;
    resolved_scope: FieldTwinScopeV1;
  }): readonly FieldTwinEvidenceRefV1[] {
    const normalize = (refs: readonly FieldTwinEvidenceRefV1[]) => [...refs]
      .sort((a, b) => `${a.ref_type}:${a.ref_value}`.localeCompare(`${b.ref_type}:${b.ref_value}`));
    const declared = normalize(input.declared_refs);
    const resolved = normalize(input.resolved_refs);
    if (canonicalJsonV1(declared) !== canonicalJsonV1(resolved)) fail("MCFT_EVIDENCE_BINDING_INVALID");
    assertScopeExact(input.scope, input.resolved_scope, "MCFT_EVIDENCE_BINDING_INVALID:SCOPE");
    return resolved;
  }
}

export class DerivedCompositeValidatorV1 {
  validate(input: {
    exact_refs: readonly FieldTwinCanonicalObjectRefV1[];
    canonical_composite_payload: Record<string, unknown>;
    declared_projection_hash: SemanticHashTextV1;
  }): SemanticHashTextV1 {
    const recomputed = semanticHash({
      exact_refs: [...input.exact_refs].sort((a, b) => a.object_ref.localeCompare(b.object_ref)),
      canonical_composite_payload: input.canonical_composite_payload,
    });
    if (recomputed !== input.declared_projection_hash) fail("MCFT_DERIVED_COMPOSITE_REBUILD_MISMATCH");
    return recomputed;
  }
}

export class RuntimeHealthRoleResolverV1 {
  resolve(input: {
    health_object_ref: string;
    record_set_membership: { record_set_id: string; member_refs: readonly string[] } | null;
    operational_attempt_relation: { attempt_ref: string; health_ref: string; forecast_failure_ref: string | null } | null;
  }): FieldTwinRuntimeHealthRoleResolutionV1 {
    const isRecordSetMember = Boolean(input.record_set_membership?.member_refs.includes(input.health_object_ref));
    const isOperationalAttempt = Boolean(input.operational_attempt_relation &&
      input.operational_attempt_relation.health_ref === input.health_object_ref && input.operational_attempt_relation.attempt_ref);
    if (isRecordSetMember === isOperationalAttempt) fail("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED");
    if (isRecordSetMember && input.record_set_membership) {
      return {
        health_object_ref: input.health_object_ref,
        transaction_family: "A_STATE_TICK_COMMIT",
        health_role: "TERMINAL_RECORD_SET_MEMBER",
        health_resolution_basis: "EXACT_RECORD_SET_MEMBERSHIP",
        health_resolution_evidence_refs: [{ ref_type: "RECORD_SET", ref_value: input.record_set_membership.record_set_id }],
        atomic_group_ref: input.record_set_membership.record_set_id,
      };
    }
    if (!input.operational_attempt_relation) fail("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED");
    const evidenceRefs: FieldTwinEvidenceRefV1[] = [
      { ref_type: "RUNTIME_ATTEMPT", ref_value: input.operational_attempt_relation.attempt_ref },
    ];
    if (input.operational_attempt_relation.forecast_failure_ref) {
      evidenceRefs.push({ ref_type: "FORECAST_FAILURE", ref_value: input.operational_attempt_relation.forecast_failure_ref });
    }
    return {
      health_object_ref: input.health_object_ref,
      transaction_family: "F_OPERATIONAL_ATTEMPT_HEALTH",
      health_role: "OPERATIONAL_ATTEMPT_AUDIT",
      health_resolution_basis: "EXACT_OPERATIONAL_ATTEMPT_RELATION",
      health_resolution_evidence_refs: evidenceRefs,
      atomic_group_ref: null,
    };
  }
}

export class RuntimeHealthDualResolverV1 {
  resolve(input: {
    terminal_record_set_health: FieldTwinRuntimeHealthRoleResolutionV1 | null;
    latest_operational_runtime_health: FieldTwinRuntimeHealthRoleResolutionV1 | null;
  }): {
    terminal_record_set_health: FieldTwinRuntimeHealthRoleResolutionV1 | null;
    latest_operational_runtime_health: FieldTwinRuntimeHealthRoleResolutionV1 | null;
    relationship: "SAME_OBJECT" | "DISTINCT_OBJECTS" | "ONE_OR_BOTH_ABSENT";
  } {
    const terminal = input.terminal_record_set_health;
    const operational = input.latest_operational_runtime_health;
    if (terminal && terminal.health_role !== "TERMINAL_RECORD_SET_MEMBER") fail("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", "TERMINAL_ROLE");
    if (operational && operational.health_role !== "OPERATIONAL_ATTEMPT_AUDIT") fail("MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED", "OPERATIONAL_ROLE");
    return {
      terminal_record_set_health: terminal,
      latest_operational_runtime_health: operational,
      relationship: terminal && operational
        ? terminal.health_object_ref === operational.health_object_ref ? "SAME_OBJECT" : "DISTINCT_OBJECTS"
        : "ONE_OR_BOTH_ABSENT",
    };
  }
}
