// MCFT-CAP-09 S6-EA5C1 restricted canonical External Evidence ingress.
// Boundary: append-only public.facts writer for the exact Amendment-05 External scope/five-source profile.
// Only a self-consistent EA3 canonicalization result may enter this writer, and durable raw verification
// MUST succeed before any facts transaction is opened.

import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_EVIDENCE_PIPELINE_VERSION_V1,
  type CanonicalizedExternalEvidenceResultV1,
} from "../../external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  RawEvidenceRetentionVerificationPortV1,
  VerifyRetainedRawEvidenceInputV1,
} from "../../external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";

export const MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_INGRESS_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_INGRESS_V1" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1 =
  "mcft_cap09_external_formal_evidence_v1" as const;

export type ExternalFormalEvidenceIngressResultV1 = {
  ingress_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_INGRESS_ID_V1;
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  fact_id: string;
  record_type: string;
  source_record_id: string;
  source_record_hash: string;
  retention_ref: string;
  raw_sha256: string;
  raw_bytes: number;
  canonical_fact_write_count: 0 | 1;
};

export type PreparedExternalFormalEvidenceIngressV1 = {
  record: CanonicalReplayEvidenceRecordV1;
  event_time: string;
  raw_proof: VerifyRetainedRawEvidenceInputV1;
  fact_id: string;
  identity_key: string;
  requested_semantic_hash: string;
};

type EvidenceAuthorityV1 = {
  binding_id: string;
  epistemic_class: "OBSERVED" | "ESTIMATED" | "ASSUMED";
  event_time_field: "observed_at" | "interval_end" | "issued_at";
};

type TransactionClientV1 = Pick<PoolClient, "query">;

const AUTHORITY_BY_RECORD_TYPE_V1: Readonly<Record<string, EvidenceAuthorityV1>> = {
  soil_moisture_observation_v1: { binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1, epistemic_class: "OBSERVED", event_time_field: "observed_at" },
  observed_rainfall_v1: { binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1, epistemic_class: "OBSERVED", event_time_field: "interval_end" },
  historical_et0_estimate_v1: { binding_id: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1, epistemic_class: "ESTIMATED", event_time_field: "interval_end" },
  future_weather_assumption_v1: { binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1, epistemic_class: "ASSUMED", event_time_field: "issued_at" },
  future_et0_assumption_v1: { binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1, epistemic_class: "ASSUMED", event_time_field: "issued_at" },
};

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredTextV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function exactScopeV1(record: CanonicalReplayEvidenceRecordV1, expected: TwinScopeKeyV1): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (record[field] !== expected[field]) throw new Error(`EA5C1_EXTERNAL_SCOPE_MISMATCH:${field}`);
  }
}

function containsBinaryV1(value: unknown, seen = new Set<object>()): boolean {
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) return true;
  if (!value || typeof value !== "object") return false;
  if (seen.has(value as object)) return false;
  seen.add(value as object);
  if (Array.isArray(value)) return value.some((item) => containsBinaryV1(item, seen));
  return Object.values(value as Record<string, unknown>).some((item) => containsBinaryV1(item, seen));
}

function assertNoForbiddenMarkersV1(record: CanonicalReplayEvidenceRecordV1): void {
  const text = JSON.stringify({
    dataset_id: record.dataset_id,
    origin_source_kind: record.origin_source_kind,
    origin_source_id: record.origin_source_id,
    binding_id: record.binding_id,
    limitations: record.limitations,
    source_payload: record.source_payload,
    canonical_payload: record.canonical_payload,
  });
  for (const marker of [
    "CONTROLLED_SYNTHETIC_REPLAY_PROXY", "CONTROLLED_REPLAY", '"runtime_mode":"REPLAY"',
    "field_c8_demo", "SIMULATED_DEV_ONLY", "DEBUG_ONLY",
  ]) {
    if (text.includes(marker)) throw new Error(`EA5C1_REPLAY_OR_DEBUG_AUTHORITY_FORBIDDEN:${marker}`);
  }
}

function objectRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function identityV1(record: CanonicalReplayEvidenceRecordV1): string {
  return [record.tenant_id, record.project_id, record.group_id, record.field_id, record.season_id, record.zone_id, record.dataset_id, record.record_type, record.source_record_id].join("|");
}

export function externalFormalEvidenceFactIdV1(record: CanonicalReplayEvidenceRecordV1): string {
  return `fact_external_evidence_${crypto.createHash("sha256").update(identityV1(record), "utf8").digest("hex")}`;
}

function parseFactRecordV1(value: unknown): CanonicalReplayEvidenceRecordV1 {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const envelope = objectRecordV1(parsed, "EA5C1_EXISTING_FACT_ENVELOPE_INVALID");
  return objectRecordV1(envelope.payload, "EA5C1_EXISTING_FACT_PAYLOAD_INVALID") as unknown as CanonicalReplayEvidenceRecordV1;
}

export function prepareExternalFormalEvidenceIngressV1(result: CanonicalizedExternalEvidenceResultV1): PreparedExternalFormalEvidenceIngressV1 {
  if (result.pipeline_version !== MCFT_CAP09_EXTERNAL_EVIDENCE_PIPELINE_VERSION_V1) throw new Error("EA5C1_EA3_PIPELINE_VERSION_REQUIRED");
  const record = result.record;
  exactScopeV1(record, { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 });
  const authority = AUTHORITY_BY_RECORD_TYPE_V1[record.record_type];
  if (!authority) throw new Error(`EA5C1_RECORD_TYPE_NOT_AUTHORIZED:${record.record_type}`);
  if (record.binding_id !== authority.binding_id) throw new Error(`EA5C1_BINDING_NOT_AUTHORIZED:${record.record_type}`);
  if (record.epistemic_class !== authority.epistemic_class) throw new Error(`EA5C1_EPISTEMIC_CLASS_MISMATCH:${record.record_type}`);
  if (record.quality?.status !== "PASS" && record.quality?.status !== "LIMITED") throw new Error(`EA5C1_QUALITY_NOT_FORMAL_INGRESS_ELIGIBLE:${record.record_type}`);
  requiredTextV1(record.dataset_id, "EA5C1_DATASET_ID_REQUIRED");
  requiredTextV1(record.source_record_id, "EA5C1_SOURCE_RECORD_ID_REQUIRED");
  if (!Array.isArray(record.limitations) || record.limitations.length === 0 || !record.limitations.every((value) => typeof value === "string" && value.trim())) throw new Error("EA5C1_LIMITATIONS_REQUIRED");
  if (containsBinaryV1(record)) throw new Error("EA5C1_RAW_BINARY_IN_CANONICAL_FACT_FORBIDDEN");
  assertNoForbiddenMarkersV1(record);

  canonicalIsoV1(record.available_to_runtime_at, "EA5C1_AVAILABLE_TO_RUNTIME_AT_INVALID");
  const eventTime = canonicalIsoV1(record.role_time?.[authority.event_time_field], "EA5C1_EVENT_TIME_INVALID");
  if (Date.parse(eventTime) > Date.parse(record.available_to_runtime_at)) throw new Error("EA5C1_EVENT_AFTER_RUNTIME_AVAILABILITY");

  const sourcePayload = objectRecordV1(record.source_payload, "EA5C1_SOURCE_PAYLOAD_REQUIRED");
  const raw = objectRecordV1(sourcePayload.raw_provenance, "EA5C1_RAW_PROVENANCE_REQUIRED");
  const rawRequestId = requiredTextV1(raw.request_id, "EA5C1_RAW_REQUEST_ID_REQUIRED");
  const rawSourceLocator = requiredTextV1(raw.source_locator, "EA5C1_RAW_SOURCE_LOCATOR_REQUIRED");
  const rawSha256 = requiredTextV1(raw.raw_sha256, "EA5C1_RAW_SHA256_REQUIRED");
  if (!/^sha256:[0-9a-f]{64}$/.test(rawSha256)) throw new Error("EA5C1_RAW_SHA256_INVALID");
  const rawBytes = raw.raw_bytes;
  if (!Number.isSafeInteger(rawBytes) || Number(rawBytes) <= 0) throw new Error("EA5C1_RAW_BYTES_INVALID");
  const retentionRef = requiredTextV1(raw.retention_ref, "EA5C1_RETENTION_REF_REQUIRED");
  if (!retentionRef.startsWith("s3-private://")) throw new Error("EA5C1_PRIVATE_S3_RETENTION_REF_REQUIRED");
  canonicalIsoV1(raw.retained_at, "EA5C1_RETAINED_AT_INVALID");
  if (raw.raw_payload_embedded !== false) throw new Error("EA5C1_RAW_PAYLOAD_EMBEDDED_FORBIDDEN");

  if (record.quality.raw_source_sha256 !== rawSha256 || record.quality.raw_retention_ref !== retentionRef || record.quality.raw_payload_embedded !== false) {
    throw new Error("EA5C1_RAW_PROVENANCE_QUALITY_BINDING_MISMATCH");
  }
  if (
    result.raw_provenance.request_id !== rawRequestId
    || result.raw_provenance.source_locator !== rawSourceLocator
    || result.raw_provenance.raw_sha256 !== rawSha256
    || result.raw_provenance.retention_ref !== retentionRef
    || result.raw_provenance.raw_bytes !== Number(rawBytes)
  ) {
    throw new Error("EA5C1_PIPELINE_RAW_PROVENANCE_MISMATCH");
  }
  if (result.decoder.decoder_id !== raw.decoder_id || result.decoder.decoder_version !== raw.decoder_version) {
    throw new Error("EA5C1_PIPELINE_DECODER_PROVENANCE_MISMATCH");
  }

  const canonicalPayloadHash = semanticHashV1(record.canonical_payload);
  if (result.canonical_payload_sha256 !== canonicalPayloadHash || record.quality.canonical_payload_sha256 !== canonicalPayloadHash) {
    throw new Error("EA5C1_CANONICAL_PAYLOAD_DIGEST_MISMATCH");
  }
  const requestedSemanticHash = semanticHashV1(record);
  if (result.record_semantic_sha256 !== requestedSemanticHash) throw new Error("EA5C1_RECORD_SEMANTIC_DIGEST_MISMATCH");

  const draftSourcePayload = structuredClone(sourcePayload);
  delete draftSourcePayload.raw_provenance;
  const expectedSourceRecordHash = semanticHashV1({
    source_record_id: record.source_record_id,
    raw_sha256: rawSha256,
    retention_ref: retentionRef,
    decoder_id: requiredTextV1(raw.decoder_id, "EA5C1_DECODER_ID_REQUIRED"),
    decoder_version: requiredTextV1(raw.decoder_version, "EA5C1_DECODER_VERSION_REQUIRED"),
    source_payload: draftSourcePayload,
  });
  if (record.source_record_hash !== expectedSourceRecordHash) throw new Error("EA5C1_SOURCE_RECORD_HASH_MISMATCH");

  return {
    record,
    event_time: eventTime,
    raw_proof: { retention_ref: retentionRef, retained_sha256: rawSha256, retained_bytes: Number(rawBytes) },
    fact_id: externalFormalEvidenceFactIdV1(record),
    identity_key: identityV1(record),
    requested_semantic_hash: requestedSemanticHash,
  };
}

export async function appendPreparedExternalFormalEvidenceUsingClientV1(
  client: TransactionClientV1,
  prepared: PreparedExternalFormalEvidenceIngressV1,
): Promise<ExternalFormalEvidenceIngressResultV1> {
  const record = prepared.record;
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [prepared.identity_key]);
  const existing = await client.query("SELECT record_json FROM facts WHERE fact_id=$1 LIMIT 2", [prepared.fact_id]);
  if (existing.rows.length > 1) throw new Error("EA5C1_FACT_ID_NOT_UNIQUE");
  if (existing.rows.length === 1) {
    const current = parseFactRecordV1(existing.rows[0].record_json);
    if (current.source_record_hash !== record.source_record_hash || semanticHashV1(current) !== prepared.requested_semantic_hash) throw new Error("EA5C1_SOURCE_IDENTITY_CONFLICT");
    return {
      ingress_id: MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_INGRESS_ID_V1,
      status: "EXISTING_IDEMPOTENT_SUCCESS",
      fact_id: prepared.fact_id,
      record_type: record.record_type,
      source_record_id: record.source_record_id,
      source_record_hash: record.source_record_hash,
      retention_ref: prepared.raw_proof.retention_ref,
      raw_sha256: prepared.raw_proof.retained_sha256,
      raw_bytes: prepared.raw_proof.retained_bytes,
      canonical_fact_write_count: 0,
    };
  }

  await client.query(
    "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)",
    [prepared.fact_id, prepared.event_time, MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1, JSON.stringify({ type: record.record_type, payload: record })],
  );
  return {
    ingress_id: MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_INGRESS_ID_V1,
    status: "INSERTED",
    fact_id: prepared.fact_id,
    record_type: record.record_type,
    source_record_id: record.source_record_id,
    source_record_hash: record.source_record_hash,
    retention_ref: prepared.raw_proof.retention_ref,
    raw_sha256: prepared.raw_proof.retained_sha256,
    raw_bytes: prepared.raw_proof.retained_bytes,
    canonical_fact_write_count: 1,
  };
}

export class PostgresExternalFormalEvidenceIngressV1 {
  constructor(private readonly pool: Pool, private readonly retentionVerifier: RawEvidenceRetentionVerificationPortV1) {}

  async appendCanonicalizedExternalEvidence(result: CanonicalizedExternalEvidenceResultV1): Promise<ExternalFormalEvidenceIngressResultV1> {
    const prepared = prepareExternalFormalEvidenceIngressV1(result);

    // Amendment-05 barrier: the durable private object is re-verified immediately before DB ingress.
    await this.retentionVerifier.verifyRetainedRawEvidence(prepared.raw_proof);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const receipt = await appendPreparedExternalFormalEvidenceUsingClientV1(client, prepared);
      await client.query("COMMIT");
      return receipt;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
