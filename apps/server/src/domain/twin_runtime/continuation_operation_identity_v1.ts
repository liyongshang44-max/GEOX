// apps/server/src/domain/twin_runtime/continuation_operation_identity_v1.ts
// Purpose: define the MCFT-CAP-02 continuation operation key and deterministic member identities while keeping Evidence outside the idempotency key.
// Boundary: pure identity logic only; no persistence, filesystem, environment, clock, random values, network, or Runtime orchestration.

import { deriveSemanticObjectIdV1, semanticHashV1 } from "./canonical_identity_v1.js";

export const CONTINUATION_OPERATION_VARIANT_V1 = "A2_BLOCKED_FORECAST" as const;

export const CONTINUATION_MEMBER_OBJECT_TYPES_V1 = [
  "twin_evidence_window_v1",
  "twin_state_transition_v1",
  "twin_assimilation_update_v1",
  "twin_state_estimate_v1",
  "twin_forecast_run_v1",
  "twin_runtime_tick_v1",
  "twin_runtime_checkpoint_v1",
  "twin_runtime_health_v1",
] as const;

export type ContinuationMemberObjectTypeV1 = (typeof CONTINUATION_MEMBER_OBJECT_TYPES_V1)[number];

export type ContinuationScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type ContinuationOperationKeyV1 = {
  scope: ContinuationScopeV1;
  lineage_id: string;
  revision_id: string;
  logical_time: string;
  operation_variant: typeof CONTINUATION_OPERATION_VARIANT_V1;
};

export type ContinuationOperationIdentityV1 = {
  continuation_operation_key: ContinuationOperationKeyV1;
  continuation_operation_key_hash: string;
  continuation_record_set_id: string;
  continuation_idempotency_key: string;
  member_object_ids: Record<ContinuationMemberObjectTypeV1, string>;
};

function requireStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requireHourAlignedIsoV1(value: unknown): string {
  const text = requireStringV1(value, "CONTINUATION_LOGICAL_TIME_REQUIRED");
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) throw new Error("CONTINUATION_LOGICAL_TIME_INVALID");
  const normalized = new Date(parsed).toISOString();
  if (normalized !== text) throw new Error("CONTINUATION_LOGICAL_TIME_NOT_CANONICAL_ISO");
  if (!normalized.endsWith(":00:00.000Z")) throw new Error("CONTINUATION_LOGICAL_TIME_NOT_HOUR_ALIGNED");
  return normalized;
}

export function validateContinuationScopeV1(scope: ContinuationScopeV1): void {
  requireStringV1(scope?.tenant_id, "CONTINUATION_TENANT_ID_REQUIRED");
  requireStringV1(scope?.project_id, "CONTINUATION_PROJECT_ID_REQUIRED");
  requireStringV1(scope?.group_id, "CONTINUATION_GROUP_ID_REQUIRED");
  requireStringV1(scope?.field_id, "CONTINUATION_FIELD_ID_REQUIRED");
  requireStringV1(scope?.season_id, "CONTINUATION_SEASON_ID_REQUIRED");
  requireStringV1(scope?.zone_id, "CONTINUATION_ZONE_ID_REQUIRED");
}

export function validateContinuationOperationKeyV1(key: ContinuationOperationKeyV1): void {
  if (!key || typeof key !== "object") throw new Error("CONTINUATION_OPERATION_KEY_REQUIRED");
  validateContinuationScopeV1(key.scope);
  requireStringV1(key.lineage_id, "CONTINUATION_LINEAGE_ID_REQUIRED");
  requireStringV1(key.revision_id, "CONTINUATION_REVISION_ID_REQUIRED");
  requireHourAlignedIsoV1(key.logical_time);
  if (key.operation_variant !== CONTINUATION_OPERATION_VARIANT_V1) throw new Error("CONTINUATION_OPERATION_VARIANT_MISMATCH");
  if ("evidence_window_semantic_digest" in (key as unknown as Record<string, unknown>)) throw new Error("EVIDENCE_DIGEST_FORBIDDEN_IN_CONTINUATION_OPERATION_KEY");
}

export function deriveContinuationOperationIdentityV1(key: ContinuationOperationKeyV1): ContinuationOperationIdentityV1 {
  validateContinuationOperationKeyV1(key);
  const continuationOperationKeyHash = semanticHashV1(key);
  const continuationRecordSetId = deriveSemanticObjectIdV1("a2rs", {
    continuation_operation_key_hash: continuationOperationKeyHash,
  });
  const continuationIdempotencyKey = deriveSemanticObjectIdV1("a2key", {
    continuation_operation_key_hash: continuationOperationKeyHash,
  });
  const memberObjectIds = Object.fromEntries(
    CONTINUATION_MEMBER_OBJECT_TYPES_V1.map((objectType) => [
      objectType,
      deriveSemanticObjectIdV1(objectType.replace(/_v1$/, ""), {
        continuation_record_set_id: continuationRecordSetId,
        object_type: objectType,
        schema_version: "v1",
      }),
    ]),
  ) as Record<ContinuationMemberObjectTypeV1, string>;

  return {
    continuation_operation_key: structuredClone(key),
    continuation_operation_key_hash: continuationOperationKeyHash,
    continuation_record_set_id: continuationRecordSetId,
    continuation_idempotency_key: continuationIdempotencyKey,
    member_object_ids: memberObjectIds,
  };
}
