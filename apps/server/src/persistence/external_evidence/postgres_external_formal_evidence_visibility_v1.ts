// MCFT-CAP-09 Production Hosting Phase 2: fresh post-COMMIT readback for governed External Evidence.
// Boundary: read-only Evidence-plane adapter. No cursor write, RuntimeTickCursor, scheduler, lease/fencing,
// provider fetch, raw-object fallback, environment, or production host ownership.

import type { Pool } from "pg";

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1,
  type CommittedExternalEvidenceIdentityV1,
  type ExternalEvidencePostCommitVisibilityAttestationV1,
  type ExternalEvidencePostCommitVisibilityPortV1,
} from "../../external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.js";

export const MCFT_CAP09_POSTGRES_EXTERNAL_FORMAL_EVIDENCE_VISIBILITY_ID_V1 =
  "MCFT_CAP09_POSTGRES_EXTERNAL_FORMAL_EVIDENCE_VISIBILITY_V1" as const;

type PoolV1 = Pick<Pool, "query">;
type VisibleRecordV1 = {
  record_type: string;
  source_record_id: string;
  source_record_hash: string;
  source_payload: Record<string, unknown>;
  [key: string]: unknown;
};
type VisibilityRowV1 = {
  record_json: unknown;
  post_commit_db_readback_at: string | Date;
};

function objectRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalIsoV1(value: string | Date, code: string): string {
  const text = value instanceof Date ? value.toISOString() : requiredTextV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function parseFactRecordV1(value: unknown): VisibleRecordV1 {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const envelope = objectRecordV1(parsed, "PHASE2_VISIBILITY_FACT_ENVELOPE_INVALID");
  return objectRecordV1(envelope.payload, "PHASE2_VISIBILITY_FACT_PAYLOAD_INVALID") as VisibleRecordV1;
}

function verifyIdentityV1(record: VisibleRecordV1, expected: CommittedExternalEvidenceIdentityV1): void {
  if (record.record_type !== expected.record_type) throw new Error("PHASE2_VISIBILITY_RECORD_TYPE_MISMATCH");
  if (record.source_record_id !== expected.source_record_id) throw new Error("PHASE2_VISIBILITY_SOURCE_RECORD_ID_MISMATCH");
  if (record.source_record_hash !== expected.source_record_hash) throw new Error("PHASE2_VISIBILITY_SOURCE_RECORD_HASH_MISMATCH");
  if (semanticHashV1(record) !== expected.record_semantic_sha256) throw new Error("PHASE2_VISIBILITY_RECORD_SEMANTIC_HASH_MISMATCH");

  const sourcePayload = objectRecordV1(record.source_payload, "PHASE2_VISIBILITY_SOURCE_PAYLOAD_REQUIRED");
  const raw = objectRecordV1(sourcePayload.raw_provenance, "PHASE2_VISIBILITY_RAW_PROVENANCE_REQUIRED");
  if (raw.retention_ref !== expected.retention_ref) throw new Error("PHASE2_VISIBILITY_RETENTION_REF_MISMATCH");
  if (raw.raw_sha256 !== expected.raw_sha256) throw new Error("PHASE2_VISIBILITY_RAW_SHA256_MISMATCH");
  if (raw.raw_bytes !== expected.raw_bytes) throw new Error("PHASE2_VISIBILITY_RAW_BYTES_MISMATCH");
}

export class PostgresExternalFormalEvidenceVisibilityV1
  implements ExternalEvidencePostCommitVisibilityPortV1 {
  readonly visibility_adapter_id = MCFT_CAP09_POSTGRES_EXTERNAL_FORMAL_EVIDENCE_VISIBILITY_ID_V1;

  constructor(private readonly pool: PoolV1) {}

  async verifyCommittedEvidenceVisible(
    expected: CommittedExternalEvidenceIdentityV1,
  ): Promise<ExternalEvidencePostCommitVisibilityAttestationV1> {
    const factId = requiredTextV1(expected.fact_id, "PHASE2_VISIBILITY_FACT_ID_REQUIRED");

    // This query is intentionally issued only after the governed ingress has returned from COMMIT.
    // It is a fresh readback from public.facts and has no fallback to raw object storage.
    const result = await this.pool.query<VisibilityRowV1>(
      `SELECT record_json,clock_timestamp() AS post_commit_db_readback_at
         FROM public.facts
        WHERE fact_id=$1
        LIMIT 2`,
      [factId],
    );
    if (result.rows.length !== 1) {
      throw new Error(`PHASE2_VISIBILITY_EXACT_ONE_FACT_REQUIRED:${result.rows.length}`);
    }
    const row = result.rows[0];
    const record = parseFactRecordV1(row.record_json);
    verifyIdentityV1(record, expected);

    return {
      visibility_id: MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1,
      ...expected,
      post_commit_db_readback_at: canonicalIsoV1(
        row.post_commit_db_readback_at,
        "PHASE2_VISIBILITY_READBACK_AT_INVALID",
      ),
    };
  }
}
