// apps/server/src/domain/twin_runtime/canonical_identity_v1.ts
// Purpose: derive deterministic Runtime Config and A0 aggregate/member identities without recursive fixed-point hashing.
// Boundary: pure identity logic; no persistence, wall clock, random UUID, filesystem, environment, or network.

import { canonicalJsonV1, omitSemanticFieldsV1, semanticHashV1 } from "./canonical_json_v1.js";

export const A0_MEMBER_OBJECT_TYPES_V1 = [
  "twin_runtime_lineage_v1",
  "twin_evidence_window_v1",
  "twin_state_transition_v1",
  "twin_assimilation_update_v1",
  "twin_state_estimate_v1",
  "twin_forecast_run_v1",
  "twin_runtime_tick_v1",
  "twin_runtime_checkpoint_v1",
  "twin_runtime_health_v1",
] as const;

export type A0MemberObjectTypeV1 = (typeof A0_MEMBER_OBJECT_TYPES_V1)[number];

function shortHash(value: unknown): string {
  return semanticHashV1(value).slice(7, 31);
}

export function deriveSemanticObjectIdV1(prefix: string, semanticPayload: unknown): string {
  if (!/^[a-z0-9_]+$/.test(prefix)) throw new Error("INVALID_OBJECT_ID_PREFIX");
  return `${prefix}_${shortHash(semanticPayload)}`;
}

export type A0SemanticSeedInputV1 = {
  scope: Record<string, string | null>;
  bootstrap_logical_time: string;
  reality_binding_hash: string;
  runtime_config_hash: string;
  evidence_window_semantic_digest: string;
  model_component_versions: Record<string, string>;
  operation_variant: "A0_BOOTSTRAP_STATE_COMMIT";
};

export function deriveA0IdentityV1(seed: A0SemanticSeedInputV1) {
  const a0SemanticSeed = semanticHashV1(seed);
  const a0RecordSetId = deriveSemanticObjectIdV1("a0rs", { a0_semantic_seed: a0SemanticSeed });
  const a0IdempotencyKey = deriveSemanticObjectIdV1("a0key", { a0_record_set_id: a0RecordSetId, scope: seed.scope, logical_time: seed.bootstrap_logical_time });
  const memberObjectIds = Object.fromEntries(A0_MEMBER_OBJECT_TYPES_V1.map((objectType) => [objectType, deriveSemanticObjectIdV1(objectType.replace(/_v1$/, ""), { a0_record_set_id: a0RecordSetId, object_type: objectType, schema_version: "v1" })])) as Record<A0MemberObjectTypeV1, string>;
  return { a0_semantic_seed: a0SemanticSeed, a0_record_set_id: a0RecordSetId, a0_idempotency_key: a0IdempotencyKey, member_object_ids: memberObjectIds };
}

export function computeMemberDeterminismHashV1(member: Record<string, unknown>): string {
  return semanticHashV1(omitSemanticFieldsV1(member, ["determinism_hash", "fact_id", "created_at", "persisted_at"]));
}

export function computeA0RecordSetDeterminismHashV1(input: { a0_record_set_id: string; members: readonly Record<string, unknown>[] }): string {
  const tuples = input.members.map((member) => {
    const objectType = String(member.object_type ?? "");
    const objectId = String(member.object_id ?? "");
    const memberHash = String(member.determinism_hash ?? "");
    if (!objectType || !objectId || !memberHash) throw new Error("INCOMPLETE_A0_MEMBER_IDENTITY");
    return [objectType, objectId, memberHash] as const;
  }).sort((a, b) => canonicalJsonV1(a).localeCompare(canonicalJsonV1(b)));
  return semanticHashV1({ a0_record_set_id: input.a0_record_set_id, members: tuples });
}
