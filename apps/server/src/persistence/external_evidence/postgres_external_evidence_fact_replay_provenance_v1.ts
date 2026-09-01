// MCFT-CAP-09 Evidence-plane exact fact replay provenance reader.
// Read-only: public.facts -> replay-complete retained-raw provenance.
// No provider fetch, raw-object read, cursor mutation, scheduler, lease, environment,
// process lifecycle, or Twin-state effect is allowed here.

import type { Pool } from "pg";

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type {
  VerifiedRawEvidenceProvenanceV1,
} from "../../external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  EvidenceRuntimeScopeV1,
} from "../../external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
} from "../../runtime/twin_runtime/ports.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1,
  externalFormalEvidenceFactIdV1,
} from "../twin_runtime/postgres_external_formal_evidence_ingress_v1.js";

export const MCFT_CAP09_EXTERNAL_EVIDENCE_FACT_REPLAY_PROVENANCE_READER_ID_V1 =
  "MCFT_CAP09_EXTERNAL_EVIDENCE_FACT_REPLAY_PROVENANCE_READER_V1" as const;

export type ExternalEvidenceFactReplayExpectationV1 = {
  scope: EvidenceRuntimeScopeV1;
  fact_id: string;
  record_semantic_sha256: string;
  record_type: string;
  binding_id: string;
  origin_source_id: string;
  source_record_id: string;
};

export type ExternalEvidenceFactReplayProvenanceV1 = {
  reader_id: typeof MCFT_CAP09_EXTERNAL_EVIDENCE_FACT_REPLAY_PROVENANCE_READER_ID_V1;
  fact_id: string;
  dataset_id: string;
  record_type: string;
  binding_id: string;
  origin_source_id: string;
  source_record_id: string;
  record_semantic_sha256: string;
  replay_request_id_derivation: "FACT_ID_V1";
  replay_source_locator_derivation: "FINAL_LOCATOR_V1";
  restored_ingested_at: string;
  decoder: {
    decoder_id: string;
    decoder_version: string;
  };
  raw_provenance: VerifiedRawEvidenceProvenanceV1;
  database_write_count: 0;
  provider_request_count: 0;
  cursor_mutation_count: 0;
};

export interface ExternalEvidenceFactReplayProvenanceReadPortV1 {
  readReplayProvenance(
    expected: ExternalEvidenceFactReplayExpectationV1,
  ): Promise<ExternalEvidenceFactReplayProvenanceV1>;
}

type PoolV1 = Pick<Pool, "query">;
type FactRowV1 = {
  source: string;
  record_json: unknown;
};

const SCOPE_KEYS = [
  "tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id",
] as const;

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
function objectV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
function parseRecordV1(value: unknown): CanonicalReplayEvidenceRecordV1 {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const envelope = objectV1(parsed, "FACT_REPLAY_ENVELOPE_INVALID");
  return objectV1(envelope.payload, "FACT_REPLAY_PAYLOAD_INVALID") as unknown as CanonicalReplayEvidenceRecordV1;
}
function exactScopeV1(record: CanonicalReplayEvidenceRecordV1, expected: EvidenceRuntimeScopeV1): void {
  for (const key of SCOPE_KEYS) {
    if (record[key] !== expected[key]) throw new Error("FACT_REPLAY_SCOPE_MISMATCH:" + key);
  }
}
function optionalIsoV1(value: unknown, code: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return canonicalIsoV1(value, code);
}

export class PostgresExternalEvidenceFactReplayProvenanceV1
  implements ExternalEvidenceFactReplayProvenanceReadPortV1 {
  readonly reader_id = MCFT_CAP09_EXTERNAL_EVIDENCE_FACT_REPLAY_PROVENANCE_READER_ID_V1;

  constructor(private readonly pool: PoolV1) {}

  async readReplayProvenance(
    expected: ExternalEvidenceFactReplayExpectationV1,
  ): Promise<ExternalEvidenceFactReplayProvenanceV1> {
    const factId = requiredTextV1(expected.fact_id, "FACT_REPLAY_FACT_ID_REQUIRED");
    const expectedSemantic = requiredTextV1(
      expected.record_semantic_sha256,
      "FACT_REPLAY_RECORD_SEMANTIC_SHA256_REQUIRED",
    );
    if (!/^sha256:[0-9a-f]{64}$/.test(expectedSemantic)) {
      throw new Error("FACT_REPLAY_RECORD_SEMANTIC_SHA256_INVALID");
    }

    const result = await this.pool.query<FactRowV1>(
      `SELECT source,record_json
         FROM public.facts
        WHERE fact_id=$1
        LIMIT 2`,
      [factId],
    );
    if (result.rows.length !== 1) {
      throw new Error("FACT_REPLAY_EXACT_ONE_FACT_REQUIRED:" + result.rows.length);
    }
    const row = result.rows[0]!;
    if (row.source !== MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1) {
      throw new Error("FACT_REPLAY_FACT_SOURCE_NOT_AUTHORIZED");
    }

    const record = parseRecordV1(row.record_json);
    exactScopeV1(record, expected.scope);
    if (externalFormalEvidenceFactIdV1(record) !== factId) {
      throw new Error("FACT_REPLAY_FACT_IDENTITY_HASH_MISMATCH");
    }
    if (semanticHashV1(record) !== expectedSemantic) {
      throw new Error("FACT_REPLAY_RECORD_SEMANTIC_HASH_MISMATCH");
    }
    if (record.record_type !== requiredTextV1(expected.record_type, "FACT_REPLAY_RECORD_TYPE_REQUIRED")) {
      throw new Error("FACT_REPLAY_RECORD_TYPE_MISMATCH");
    }
    if (record.binding_id !== requiredTextV1(expected.binding_id, "FACT_REPLAY_BINDING_ID_REQUIRED")) {
      throw new Error("FACT_REPLAY_BINDING_ID_MISMATCH");
    }
    if (record.origin_source_id !== requiredTextV1(expected.origin_source_id, "FACT_REPLAY_ORIGIN_SOURCE_ID_REQUIRED")) {
      throw new Error("FACT_REPLAY_ORIGIN_SOURCE_ID_MISMATCH");
    }
    if (record.source_record_id !== requiredTextV1(expected.source_record_id, "FACT_REPLAY_SOURCE_RECORD_ID_REQUIRED")) {
      throw new Error("FACT_REPLAY_SOURCE_RECORD_ID_MISMATCH");
    }

    const sourcePayload = objectV1(record.source_payload, "FACT_REPLAY_SOURCE_PAYLOAD_REQUIRED");
    const raw = objectV1(sourcePayload.raw_provenance, "FACT_REPLAY_RAW_PROVENANCE_REQUIRED");
    const replayRequestId = "mcft-cap09-retained-replay:" + factId;
    const finalLocator = requiredTextV1(raw.final_locator, "FACT_REPLAY_FINAL_LOCATOR_REQUIRED");
    const replaySourceLocator = finalLocator;
    const rawSha256 = requiredTextV1(raw.raw_sha256, "FACT_REPLAY_RAW_SHA256_REQUIRED");
    if (!/^sha256:[0-9a-f]{64}$/.test(rawSha256)) throw new Error("FACT_REPLAY_RAW_SHA256_INVALID");
    const rawBytes = Number(raw.raw_bytes);
    if (!Number.isSafeInteger(rawBytes) || rawBytes <= 0) throw new Error("FACT_REPLAY_RAW_BYTES_INVALID");
    const retentionRef = requiredTextV1(raw.retention_ref, "FACT_REPLAY_RETENTION_REF_REQUIRED");
    if (!retentionRef.startsWith("s3-private://")) throw new Error("FACT_REPLAY_PRIVATE_RETENTION_REF_REQUIRED");

    const decoderId = requiredTextV1(raw.decoder_id, "FACT_REPLAY_DECODER_ID_REQUIRED");
    const decoderVersion = requiredTextV1(raw.decoder_version, "FACT_REPLAY_DECODER_VERSION_REQUIRED");
    const restoredIngestedAt = canonicalIsoV1(
      record.role_time?.ingested_at,
      "FACT_REPLAY_INGESTED_AT_INVALID",
    );

    const rawProvenance: VerifiedRawEvidenceProvenanceV1 = {
      request_id: replayRequestId,
      provider_id: requiredTextV1(raw.provider_id, "FACT_REPLAY_PROVIDER_ID_REQUIRED"),
      source_family: requiredTextV1(raw.source_family, "FACT_REPLAY_SOURCE_FAMILY_REQUIRED"),
      source_locator: replaySourceLocator,
      final_locator: finalLocator,
      content_type: requiredTextV1(raw.content_type, "FACT_REPLAY_CONTENT_TYPE_REQUIRED"),
      source_issue_time: optionalIsoV1(raw.source_issue_time, "FACT_REPLAY_SOURCE_ISSUE_TIME_INVALID"),
      source_event_time: optionalIsoV1(raw.source_event_time, "FACT_REPLAY_SOURCE_EVENT_TIME_INVALID"),
      retrieved_at: canonicalIsoV1(raw.retrieved_at, "FACT_REPLAY_RETRIEVED_AT_INVALID"),
      available_at: canonicalIsoV1(raw.available_at, "FACT_REPLAY_AVAILABLE_AT_INVALID"),
      raw_sha256: rawSha256,
      raw_bytes: rawBytes,
      retention_ref: retentionRef,
      retained_at: canonicalIsoV1(raw.retained_at, "FACT_REPLAY_RETAINED_AT_INVALID"),
      use_policy_ref: requiredTextV1(raw.use_policy_ref, "FACT_REPLAY_USE_POLICY_REF_REQUIRED"),
    };

    return {
      reader_id: this.reader_id,
      fact_id: factId,
      dataset_id: requiredTextV1(record.dataset_id, "FACT_REPLAY_DATASET_ID_REQUIRED"),
      record_type: record.record_type,
      binding_id: record.binding_id,
      origin_source_id: record.origin_source_id,
      source_record_id: record.source_record_id,
      record_semantic_sha256: expectedSemantic,
      replay_request_id_derivation: "FACT_ID_V1",
      replay_source_locator_derivation: "FINAL_LOCATOR_V1",
      restored_ingested_at: restoredIngestedAt,
      decoder: {
        decoder_id: decoderId,
        decoder_version: decoderVersion,
      },
      raw_provenance: rawProvenance,
      database_write_count: 0,
      provider_request_count: 0,
      cursor_mutation_count: 0,
    };
  }
}
