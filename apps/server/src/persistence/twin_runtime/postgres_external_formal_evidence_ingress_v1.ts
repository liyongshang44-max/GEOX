// MCFT-CAP-09 S6-EA5C1 restricted canonical External Evidence ingress.
// Boundary: append-only public.facts writer for the exact Amendment-05 External scope/five-source profile.
// A durable raw object verification MUST succeed before any facts transaction is opened.
// This module never writes Runtime Config, State, Forecast, Scenario, Recommendation, Action, or scheduler state.

import crypto from "node:crypto";
import type { Pool } from "pg";

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  TwinScopeKeyV1,
} from "../../runtime/twin_runtime/ports.js";
import type {
  RawEvidenceRetentionVerificationPortV1,
  VerifyRetainedRawEvidenceInputV1,
} from "../../external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";

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

type EvidenceAuthorityV1 = {
  binding_id: string;
  epistemic_class: "OBSERVED" | "ESTIMATED" | "ASSUMED";
  event_time_field: "observed_at" | "interval_end" | "issued_at";
};

const AUTHORITY_BY_RECORD_TYPE_V1: Readonly<Record<string, EvidenceAuthorityV1>> = {
  soil_moisture_observation_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    epistemic_class: "OBSERVED",
    event_time_field: "observed_at",
  },
  observed_rainfall_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
    epistemic_class: "OBSERVED",
    event_time_field: "interval_end",
  },
  historical_et0_estimate_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
    epistemic_class: "ESTIMATED",
    event_time_field: "interval_end",
  },
  future_weather_assumption_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
    epistemic_class: "ASSUMED",
    event_time_field: "issued_at",
  },
  future_et0_assumption_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
    epistemic_class: "ASSUMED",
    event_time_field: "issued_at",
  },
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
    "CONTROLLED_SYNTHETIC_REPLAY_PROXY",
    "CONTROLLED_REPLAY",
    '"runtime_mode":"REPLAY"',
    "field_c8_demo",
    "SIMULATED_DEV_ONLY",
    "DEBUG_ONLY",
  ]) {
    if (text.includes(marker)) throw new Error(`EA5C1_REPLAY_OR_DEBUG_AUTHORITY_FORBIDDEN:${marker}`);
  }
}

function rawProofV1(record: CanonicalReplayEvidenceRecordV1): VerifyRetainedRawEvidenceInputV1 & { retained_at: string } {
  const sourcePayload = record.source_payload;
  if (!sourcePayload || typeof sourcePayload !== "object" || Array.isArray(sourcePayload)) {
    throw new Error("EA5C1_SOURCE_PAYLOAD_REQUIRED");
  }
  const raw = (sourcePayload as Record<string, unknown>).raw_provenance;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("EA5C1_RAW_PROVENANCE_REQUIRED");
  const provenance = raw as Record<string, unknown>;
  const rawSha256 = requiredTextV1(provenance.raw_sha256, "EA5C1_RAW_SHA256_REQUIRED");
  if (!/^sha256:[0-9a-f]{64}$/.test(rawSha256)) throw new Error("EA5C1_RAW_SHA256_INVALID");
  const rawBytes = provenance.raw_bytes;
  if (!Number.isSafeInteger(rawBytes) || Number(rawBytes) <= 0) throw new Error("EA5C1_RAW_BYTES_INVALID");
  const retentionRef = requiredTextV1(provenance.retention_ref, "EA5C1_RETENTION_REF_REQUIRED");
  if (!retentionRef.startsWith("s3-private://")) throw new Error("EA5C1_PRIVATE_S3_RETENTION_REF_REQUIRED");
  const retainedAt = canonicalIsoV1(provenance.retained_at, "EA5C1_RETAINED_AT_INVALID");
  if (provenance.raw_payload_embedded !== false) throw new Error("EA5C1_RAW_PAYLOAD_EMBEDDED_FORBIDDEN");

  const quality = record.quality as Record<string, unknown> | undefined;
  if (!quality || quality.raw_source_sha256 !== rawSha256 || quality.raw_retention_ref !== retentionRef || quality.raw_payload_embedded !== false) {
    throw new Error("EA5C1_RAW_PROVENANCE_QUALITY_BINDING_MISMATCH");
  }
  return {
    retention_ref: retentionRef,
    retained_sha256: rawSha256,
    retained_bytes: Number(rawBytes),
    retained_at: retainedAt,
  };
}

function validateRecordV1(record: CanonicalReplayEvidenceRecordV1): {
  event_time: string;
  raw_proof: ReturnType<typeof rawProofV1>;
} {
  exactScopeV1(record, { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 });
  const authority = AUTHORITY_BY_RECORD_TYPE_V1[record.record_type];
  if (!authority) throw new Error(`EA5C1_RECORD_TYPE_NOT_AUTHORIZED:${record.record_type}`);
  if (record.binding_id !== authority.binding_id) throw new Error(`EA5C1_BINDING_NOT_AUTHORIZED:${record.record_type}`);
  if (record.epistemic_class !== authority.epistemic_class) throw new Error(`EA5C1_EPISTEMIC_CLASS_MISMATCH:${record.record_type}`);
  if (record.quality?.status !== "PASS" && record.quality?.status !== "LIMITED") {
    throw new Error(`EA5C1_QUALITY_NOT_FORMAL_INGRESS_ELIGIBLE:${record.record_type}`);
  }
  requiredTextV1(record.dataset_id, "EA5C1_DATASET_ID_REQUIRED");
  requiredTextV1(record.source_record_id, "EA5C1_SOURCE_RECORD_ID_REQUIRED");
  const sourceHash = requiredTextV1(record.source_record_hash, "EA5C1_SOURCE_RECORD_HASH_REQUIRED");
  if (!/^sha256:[0-9a-f]{64}$/.test(sourceHash)) throw new Error("EA5C1_SOURCE_RECORD_HASH_INVALID");
  canonicalIsoV1(record.available_to_runtime_at, "EA5C1_AVAILABLE_TO_RUNTIME_AT_INVALID");
  const eventTime = canonicalIsoV1(record.role_time?.[authority.event_time_field], "EA5C1_EVENT_TIME_INVALID");
  if (Date.parse(eventTime) > Date.parse(record.available_to_runtime_at)) throw new Error("EA5C1_EVENT_AFTER_RUNTIME_AVAILABILITY");
  if (!Array.isArray(record.limitations) || record.limitations.length === 0 || !record.limitations.every((value) => typeof value === "string" && value.trim())) {
    throw new Error("EA5C1_LIMITATIONS_REQUIRED");
  }
  if (containsBinaryV1(record)) throw new Error("EA5C1_RAW_BINARY_IN_CANONICAL_FACT_FORBIDDEN");
  assertNoForbiddenMarkersV1(record);
  return { event_time: eventTime, raw_proof: rawProofV1(record) };
}

function identityV1(record: CanonicalReplayEvidenceRecordV1): string {
  return [
    record.tenant_id,
    record.project_id,
    record.group_id,
    record.field_id,
    record.season_id,
    record.zone_id,
    record.dataset_id,
    record.record_type,
    record.source_record_id,
  ].join("|");
}

function factIdV1(record: CanonicalReplayEvidenceRecordV1): string {
  const digest = crypto.createHash("sha256").update(identityV1(record), "utf8").digest("hex");
  return `fact_external_evidence_${digest}`;
}

function recordJsonV1(record: CanonicalReplayEvidenceRecordV1): string {
  return JSON.stringify({ type: record.record_type, payload: record });
}

function parseFactRecordV1(value: unknown): CanonicalReplayEvidenceRecordV1 {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("EA5C1_EXISTING_FACT_ENVELOPE_INVALID");
  const payload = (parsed as Record<string, unknown>).payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("EA5C1_EXISTING_FACT_PAYLOAD_INVALID");
  return payload as CanonicalReplayEvidenceRecordV1;
}

export class PostgresExternalFormalEvidenceIngressV1 {
  constructor(
    private readonly pool: Pool,
    private readonly retentionVerifier: RawEvidenceRetentionVerificationPortV1,
  ) {}

  async appendCanonicalExternalEvidence(record: CanonicalReplayEvidenceRecordV1): Promise<ExternalFormalEvidenceIngressResultV1> {
    const validated = validateRecordV1(record);

    // Amendment-05 barrier: durable private object existence/hash/length is re-verified
    // immediately before any canonical facts write is attempted.
    await this.retentionVerifier.verifyRetainedRawEvidence(validated.raw_proof);

    const factId = factIdV1(record);
    const identity = identityV1(record);
    const requestedSemanticHash = semanticHashV1(record);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [identity]);
      const existing = await client.query(
        "SELECT record_json FROM facts WHERE fact_id=$1 LIMIT 2",
        [factId],
      );
      if (existing.rows.length > 1) throw new Error("EA5C1_FACT_ID_NOT_UNIQUE");
      if (existing.rows.length === 1) {
        const current = parseFactRecordV1(existing.rows[0].record_json);
        if (current.source_record_hash !== record.source_record_hash || semanticHashV1(current) !== requestedSemanticHash) {
          throw new Error("EA5C1_SOURCE_IDENTITY_CONFLICT");
        }
        await client.query("COMMIT");
        return {
          ingress_id: MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_INGRESS_ID_V1,
          status: "EXISTING_IDEMPOTENT_SUCCESS",
          fact_id: factId,
          record_type: record.record_type,
          source_record_id: record.source_record_id,
          source_record_hash: record.source_record_hash,
          retention_ref: validated.raw_proof.retention_ref,
          raw_sha256: validated.raw_proof.retained_sha256,
          raw_bytes: validated.raw_proof.retained_bytes,
          canonical_fact_write_count: 0,
        };
      }

      await client.query(
        "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)",
        [factId, validated.event_time, MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1, recordJsonV1(record)],
      );
      await client.query("COMMIT");
      return {
        ingress_id: MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_INGRESS_ID_V1,
        status: "INSERTED",
        fact_id: factId,
        record_type: record.record_type,
        source_record_id: record.source_record_id,
        source_record_hash: record.source_record_hash,
        retention_ref: validated.raw_proof.retention_ref,
        raw_sha256: validated.raw_proof.retained_sha256,
        raw_bytes: validated.raw_proof.retained_bytes,
        canonical_fact_write_count: 1,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
