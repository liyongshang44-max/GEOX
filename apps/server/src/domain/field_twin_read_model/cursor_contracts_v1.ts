// apps/server/src/domain/field_twin_read_model/cursor_contracts_v1.ts
// Purpose: freeze MCFT-CAP-07 S1 visibility-snapshot, filter, signed cursor, and base64url wire contracts.
// Boundary: pure validation and cryptographic transformation only; key material is caller-supplied and never persisted or logged.

import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalJsonV1, semanticHashV1 } from "../twin_runtime/canonical_json_v1.js";
import {
  FIELD_TWIN_CURSOR_SCHEMA_VERSION_V1,
  FIELD_TWIN_EMPTY_COLLECTION_FILTER_SCHEMA_VERSION_V1,
  FIELD_TWIN_READ_MODEL_VERSION_V1,
  FIELD_TWIN_SOURCE_PROFILE_VERSION_V1,
  FIELD_TWIN_TIMELINE_FILTER_SCHEMA_VERSION_V1,
  FIELD_TWIN_VISIBILITY_SNAPSHOT_VERSION_V1,
  type CanonicalUtcInstantV1,
  type CursorWireTextV1,
  type FieldTwinCanonicalVisibilitySnapshotV1,
  type FieldTwinCollectionKindV1,
  type FieldTwinEmptyCollectionFilterV1,
  type FieldTwinScopeV1,
  type FieldTwinTimelineFilterV1,
  type SemanticHashTextV1,
  type Xid8TextV1,
} from "./contracts_v1.js";
import {
  FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1,
  FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1,
  sortXid8TextNumericAscendingV1,
} from "./ordering_v1.js";

export const FIELD_TWIN_CURSOR_AUTHENTICATION_CONTRACT_V1 = Object.freeze({
  contract_id: "FIELD_TWIN_CURSOR_AUTHENTICATION_CONTRACT_V1",
  cursor_auth_scheme: "HMAC_SHA256_V1",
  payload_serialization: "canonicalJsonV1",
  envelope_serialization: "canonicalJsonV1",
  wire_encoding: "base64url_without_padding",
  default_ttl_seconds: 900,
  maximum_ttl_seconds: 3600,
  maximum_wire_length: 65535,
  checksum_only_forbidden: true,
  key_material_wire_exposure: false,
});

export type FieldTwinCursorContractErrorCodeV1 =
  | "MCFT_CURSOR_INVALID"
  | "MCFT_CURSOR_AUTH_INVALID"
  | "MCFT_CURSOR_EXPIRED"
  | "MCFT_CURSOR_SCOPE_MISMATCH"
  | "MCFT_CURSOR_FILTER_MISMATCH"
  | "MCFT_CURSOR_VISIBILITY_SNAPSHOT_INVALID"
  | "MCFT_CURSOR_FIXED_ROOT_MISMATCH"
  | "MCFT_CURSOR_VERSION_CONFLICT"
  | "MCFT_CURSOR_VISIBILITY_EPOCH_MISMATCH"
  | "MCFT_CURSOR_SIGNING_KEY_UNAVAILABLE"
  | "MCFT_CURSOR_WIRE_INVALID"
  | "MCFT_CURSOR_COLLECTION_KIND_MISMATCH"
  | "MCFT_CURSOR_LIMIT_MISMATCH"
  | "MCFT_TIMELINE_FILTER_INVALID"
  | "MCFT_XID8_TEXT_INVALID";

export class FieldTwinCursorContractErrorV1 extends Error {
  readonly code: FieldTwinCursorContractErrorCodeV1;
  constructor(code: FieldTwinCursorContractErrorCodeV1, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "FieldTwinCursorContractErrorV1";
    this.code = code;
  }
}

export type FieldTwinTimelineCursorSortTupleV1 = {
  cursor_kind: "TIMELINE";
  logical_time: CanonicalUtcInstantV1;
  event_rank: number;
  object_ref: string;
};

export type FieldTwinCollectionCursorSortTupleV1 = {
  cursor_kind: "OPTIONAL_COLLECTION";
  logical_time: CanonicalUtcInstantV1;
  object_ref: string;
};

export type FieldTwinCursorPayloadV1 = {
  cursor_schema_version: typeof FIELD_TWIN_CURSOR_SCHEMA_VERSION_V1;
  cursor_kind: "TIMELINE" | "OPTIONAL_COLLECTION";
  collection_kind: FieldTwinCollectionKindV1 | null;
  sort_contract_id: typeof FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1 | typeof FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1;
  read_model_version: typeof FIELD_TWIN_READ_MODEL_VERSION_V1;
  source_profile_version: typeof FIELD_TWIN_SOURCE_PROFILE_VERSION_V1;
  scope_hash: SemanticHashTextV1;
  filter_hash: SemanticHashTextV1;
  canonical_visibility_snapshot: FieldTwinCanonicalVisibilitySnapshotV1;
  fixed_root_ref: string;
  fixed_root_graph_content_hash: SemanticHashTextV1;
  sort_direction: "ASC" | "DESC";
  last_sort_tuple: FieldTwinTimelineCursorSortTupleV1 | FieldTwinCollectionCursorSortTupleV1;
  page_limit: number;
  issued_at: CanonicalUtcInstantV1;
  expires_at: CanonicalUtcInstantV1;
};

export type FieldTwinCursorEnvelopeV1 = {
  payload: FieldTwinCursorPayloadV1;
  cursor_auth_scheme: "HMAC_SHA256_V1";
  cursor_signing_key_id: string;
  cursor_auth_tag: string;
};

export type FieldTwinCursorVerificationContextV1 = {
  scope_hash: SemanticHashTextV1;
  filter_hash: SemanticHashTextV1;
  database_visibility_epoch_id: string;
  fixed_root_ref: string;
  fixed_root_graph_content_hash: SemanticHashTextV1;
  cursor_kind: "TIMELINE" | "OPTIONAL_COLLECTION";
  collection_kind: FieldTwinCollectionKindV1 | null;
  page_limit: number;
  now: CanonicalUtcInstantV1;
  signing_keys: Readonly<Record<string, string | Buffer>>;
};

function cursorError(code: FieldTwinCursorContractErrorCodeV1, detail?: string): never {
  throw new FieldTwinCursorContractErrorV1(code, detail);
}

export function xid8TextV1(value: string): Xid8TextV1 {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) cursorError("MCFT_XID8_TEXT_INVALID");
  return value as Xid8TextV1;
}

export function canonicalUtcInstantV1(value: string): CanonicalUtcInstantV1 {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) cursorError("MCFT_TIMELINE_FILTER_INVALID", "NON_CANONICAL_UTC_INSTANT");
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) cursorError("MCFT_TIMELINE_FILTER_INVALID", "INVALID_UTC_INSTANT");
  return value as CanonicalUtcInstantV1;
}

function semanticHash(value: unknown): SemanticHashTextV1 {
  return semanticHashV1(value) as SemanticHashTextV1;
}

export function buildCanonicalVisibilitySnapshotV1(input: {
  database_visibility_epoch_id: string;
  pg_snapshot_token: string;
  snapshot_xmin: string;
  snapshot_xmax: string;
  snapshot_xip_values_for_hash: readonly string[];
}): FieldTwinCanonicalVisibilitySnapshotV1 {
  if (!input.database_visibility_epoch_id || !input.pg_snapshot_token) cursorError("MCFT_CURSOR_VISIBILITY_SNAPSHOT_INVALID");
  const snapshotXmin = xid8TextV1(input.snapshot_xmin);
  const snapshotXmax = xid8TextV1(input.snapshot_xmax);
  const xip = sortXid8TextNumericAscendingV1(input.snapshot_xip_values_for_hash.map(xid8TextV1));
  const snapshotXipHash = semanticHash(xip);
  const semantic = {
    snapshot_schema_version: FIELD_TWIN_VISIBILITY_SNAPSHOT_VERSION_V1,
    database_visibility_epoch_id: input.database_visibility_epoch_id,
    pg_snapshot_token: input.pg_snapshot_token,
    snapshot_xmin: snapshotXmin,
    snapshot_xmax: snapshotXmax,
    snapshot_xip_hash: snapshotXipHash,
  };
  return { ...semantic, visibility_snapshot_hash: semanticHash(semantic) };
}

export function validateCanonicalVisibilitySnapshotV1(snapshot: FieldTwinCanonicalVisibilitySnapshotV1): void {
  xid8TextV1(snapshot.snapshot_xmin);
  xid8TextV1(snapshot.snapshot_xmax);
  if (snapshot.snapshot_schema_version !== FIELD_TWIN_VISIBILITY_SNAPSHOT_VERSION_V1) cursorError("MCFT_CURSOR_VISIBILITY_SNAPSHOT_INVALID");
  const expected = semanticHash({
    snapshot_schema_version: snapshot.snapshot_schema_version,
    database_visibility_epoch_id: snapshot.database_visibility_epoch_id,
    pg_snapshot_token: snapshot.pg_snapshot_token,
    snapshot_xmin: snapshot.snapshot_xmin,
    snapshot_xmax: snapshot.snapshot_xmax,
    snapshot_xip_hash: snapshot.snapshot_xip_hash,
  });
  if (snapshot.visibility_snapshot_hash !== expected) cursorError("MCFT_CURSOR_VISIBILITY_SNAPSHOT_INVALID");
}

export function canonicalizeTimelineFilterV1(input: { from_logical_time?: string | null; until_logical_time?: string | null }): FieldTwinTimelineFilterV1 {
  const from = input.from_logical_time == null ? null : canonicalUtcInstantV1(input.from_logical_time);
  const until = input.until_logical_time == null ? null : canonicalUtcInstantV1(input.until_logical_time);
  if (from && until && from >= until) cursorError("MCFT_TIMELINE_FILTER_INVALID", "INVALID_RANGE");
  return {
    filter_schema_version: FIELD_TWIN_TIMELINE_FILTER_SCHEMA_VERSION_V1,
    from_logical_time: from,
    until_logical_time: until,
  };
}

export function buildTimelineFilterHashV1(filter: FieldTwinTimelineFilterV1): SemanticHashTextV1 {
  return semanticHash(filter);
}

export const FIELD_TWIN_EMPTY_COLLECTION_FILTER_V1: FieldTwinEmptyCollectionFilterV1 = Object.freeze({
  filter_schema_version: FIELD_TWIN_EMPTY_COLLECTION_FILTER_SCHEMA_VERSION_V1,
  filter_kind: "NONE",
});

export function buildEmptyCollectionFilterHashV1(): SemanticHashTextV1 {
  return semanticHash(FIELD_TWIN_EMPTY_COLLECTION_FILTER_V1);
}

export function assertContinuationTimelineFilterV1(cursorFilterHash: SemanticHashTextV1, queryFilter?: { from_logical_time?: string | null; until_logical_time?: string | null }): void {
  if (queryFilter === undefined || (queryFilter.from_logical_time === undefined && queryFilter.until_logical_time === undefined)) return;
  if (buildTimelineFilterHashV1(canonicalizeTimelineFilterV1(queryFilter)) !== cursorFilterHash) cursorError("MCFT_CURSOR_FILTER_MISMATCH");
}

function parseInstantMillis(value: CanonicalUtcInstantV1): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) cursorError("MCFT_CURSOR_INVALID", "TIME_INVALID");
  return parsed;
}

export function createCursorPayloadV1(input: Omit<FieldTwinCursorPayloadV1, "cursor_schema_version" | "read_model_version" | "source_profile_version">): FieldTwinCursorPayloadV1 {
  validateCanonicalVisibilitySnapshotV1(input.canonical_visibility_snapshot);
  const ttlSeconds = (parseInstantMillis(input.expires_at) - parseInstantMillis(input.issued_at)) / 1000;
  if (ttlSeconds <= 0 || ttlSeconds > FIELD_TWIN_CURSOR_AUTHENTICATION_CONTRACT_V1.maximum_ttl_seconds) cursorError("MCFT_CURSOR_INVALID", "TTL_INVALID");
  if (!Number.isInteger(input.page_limit) || input.page_limit < 1 || input.page_limit > 200) cursorError("MCFT_CURSOR_LIMIT_MISMATCH");
  if (input.cursor_kind === "TIMELINE") {
    if (input.collection_kind !== null || input.sort_contract_id !== FIELD_TWIN_TIMELINE_SORT_CONTRACT_ID_V1 || input.sort_direction !== "ASC" || input.last_sort_tuple.cursor_kind !== "TIMELINE") cursorError("MCFT_CURSOR_INVALID", "TIMELINE_VARIANT_INVALID");
  } else if (input.cursor_kind === "OPTIONAL_COLLECTION") {
    if (input.collection_kind === null || input.sort_contract_id !== FIELD_TWIN_COLLECTION_SORT_CONTRACT_ID_V1 || input.sort_direction !== "DESC" || input.last_sort_tuple.cursor_kind !== "OPTIONAL_COLLECTION") cursorError("MCFT_CURSOR_INVALID", "COLLECTION_VARIANT_INVALID");
  } else cursorError("MCFT_CURSOR_INVALID", "KIND_INVALID");
  return {
    cursor_schema_version: FIELD_TWIN_CURSOR_SCHEMA_VERSION_V1,
    read_model_version: FIELD_TWIN_READ_MODEL_VERSION_V1,
    source_profile_version: FIELD_TWIN_SOURCE_PROFILE_VERSION_V1,
    ...input,
  };
}

function authInput(payload: FieldTwinCursorPayloadV1, keyId: string): string {
  return canonicalJsonV1({ cursor_auth_scheme: "HMAC_SHA256_V1", cursor_signing_key_id: keyId, payload });
}

function hmacHex(key: string | Buffer, input: string): string {
  return createHmac("sha256", key).update(input, "utf8").digest("hex");
}

function encodeBase64UrlCanonical(value: unknown): CursorWireTextV1 {
  const encoded = Buffer.from(canonicalJsonV1(value), "utf8").toString("base64url");
  if (!encoded || encoded.length > FIELD_TWIN_CURSOR_AUTHENTICATION_CONTRACT_V1.maximum_wire_length) cursorError("MCFT_CURSOR_WIRE_INVALID");
  return encoded as CursorWireTextV1;
}

export function signFieldTwinCursorV1(payload: FieldTwinCursorPayloadV1, keyId: string, key: string | Buffer): { envelope: FieldTwinCursorEnvelopeV1; wire: CursorWireTextV1; envelope_digest: SemanticHashTextV1 } {
  if (!keyId || (typeof key === "string" ? key.length === 0 : key.length === 0)) cursorError("MCFT_CURSOR_SIGNING_KEY_UNAVAILABLE");
  const envelope: FieldTwinCursorEnvelopeV1 = {
    payload,
    cursor_auth_scheme: "HMAC_SHA256_V1",
    cursor_signing_key_id: keyId,
    cursor_auth_tag: hmacHex(key, authInput(payload, keyId)),
  };
  return { envelope, wire: encodeBase64UrlCanonical(envelope), envelope_digest: semanticHash(envelope) };
}

export function cursorWireTextV1(value: string): CursorWireTextV1 {
  if (!value || value.length > FIELD_TWIN_CURSOR_AUTHENTICATION_CONTRACT_V1.maximum_wire_length || !/^[A-Za-z0-9_-]+$/.test(value) || value.includes("=")) cursorError("MCFT_CURSOR_WIRE_INVALID");
  return value as CursorWireTextV1;
}

function decodeEnvelope(wire: CursorWireTextV1): FieldTwinCursorEnvelopeV1 {
  let decoded: string;
  try { decoded = Buffer.from(wire, "base64url").toString("utf8"); } catch { cursorError("MCFT_CURSOR_WIRE_INVALID"); }
  let value: unknown;
  try { value = JSON.parse(decoded); } catch { cursorError("MCFT_CURSOR_WIRE_INVALID"); }
  if (canonicalJsonV1(value) !== decoded || encodeBase64UrlCanonical(value) !== wire) cursorError("MCFT_CURSOR_WIRE_INVALID");
  if (!value || typeof value !== "object" || Array.isArray(value)) cursorError("MCFT_CURSOR_INVALID");
  const envelope = value as FieldTwinCursorEnvelopeV1;
  if (envelope.cursor_auth_scheme !== "HMAC_SHA256_V1" || !envelope.cursor_signing_key_id || !/^[0-9a-f]{64}$/.test(envelope.cursor_auth_tag)) cursorError("MCFT_CURSOR_INVALID");
  return envelope;
}

function secureEqualHex(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function verifyFieldTwinCursorV1(wireValue: string, context: FieldTwinCursorVerificationContextV1): FieldTwinCursorEnvelopeV1 {
  const wire = cursorWireTextV1(wireValue);
  const envelope = decodeEnvelope(wire);
  const key = context.signing_keys[envelope.cursor_signing_key_id];
  if (key === undefined) cursorError("MCFT_CURSOR_SIGNING_KEY_UNAVAILABLE");
  const expectedTag = hmacHex(key, authInput(envelope.payload, envelope.cursor_signing_key_id));
  if (!secureEqualHex(expectedTag, envelope.cursor_auth_tag)) cursorError("MCFT_CURSOR_AUTH_INVALID");
  const payload = envelope.payload;
  if (payload.cursor_schema_version !== FIELD_TWIN_CURSOR_SCHEMA_VERSION_V1 || payload.read_model_version !== FIELD_TWIN_READ_MODEL_VERSION_V1 || payload.source_profile_version !== FIELD_TWIN_SOURCE_PROFILE_VERSION_V1) cursorError("MCFT_CURSOR_VERSION_CONFLICT");
  validateCanonicalVisibilitySnapshotV1(payload.canonical_visibility_snapshot);
  if (payload.scope_hash !== context.scope_hash) cursorError("MCFT_CURSOR_SCOPE_MISMATCH");
  if (payload.filter_hash !== context.filter_hash) cursorError("MCFT_CURSOR_FILTER_MISMATCH");
  if (payload.canonical_visibility_snapshot.database_visibility_epoch_id !== context.database_visibility_epoch_id) cursorError("MCFT_CURSOR_VISIBILITY_EPOCH_MISMATCH");
  if (payload.fixed_root_ref !== context.fixed_root_ref || payload.fixed_root_graph_content_hash !== context.fixed_root_graph_content_hash) cursorError("MCFT_CURSOR_FIXED_ROOT_MISMATCH");
  if (payload.cursor_kind !== context.cursor_kind) cursorError("MCFT_CURSOR_INVALID", "CURSOR_KIND_MISMATCH");
  if (payload.collection_kind !== context.collection_kind) cursorError("MCFT_CURSOR_COLLECTION_KIND_MISMATCH");
  if (payload.page_limit !== context.page_limit) cursorError("MCFT_CURSOR_LIMIT_MISMATCH");
  if (parseInstantMillis(context.now) >= parseInstantMillis(payload.expires_at)) cursorError("MCFT_CURSOR_EXPIRED");
  createCursorPayloadV1({
    cursor_kind: payload.cursor_kind,
    collection_kind: payload.collection_kind,
    sort_contract_id: payload.sort_contract_id,
    scope_hash: payload.scope_hash,
    filter_hash: payload.filter_hash,
    canonical_visibility_snapshot: payload.canonical_visibility_snapshot,
    fixed_root_ref: payload.fixed_root_ref,
    fixed_root_graph_content_hash: payload.fixed_root_graph_content_hash,
    sort_direction: payload.sort_direction,
    last_sort_tuple: payload.last_sort_tuple,
    page_limit: payload.page_limit,
    issued_at: payload.issued_at,
    expires_at: payload.expires_at,
  });
  return envelope;
}

export function buildScopeHashV1(scope: FieldTwinScopeV1): SemanticHashTextV1 {
  return semanticHash(scope);
}
