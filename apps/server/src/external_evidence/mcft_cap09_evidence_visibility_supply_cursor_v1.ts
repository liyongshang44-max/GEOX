// MCFT-CAP-09 Production Hosting Phase 2: Evidence-plane post-COMMIT visibility and supply-cursor ordering.
// Boundary: product composition only. No provider fetch, raw-store read, database implementation,
// scheduler, lease/fencing, environment, wall-clock, RuntimeTickCursor, or production host ownership.

import { semanticHashV1 } from "../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalizedExternalEvidenceResultV1 } from "./mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  ExternalFormalEvidenceIngressPortV1,
  ExternalFormalEvidenceIngressReceiptV1,
} from "./mcft_cap09_external_formal_collector_phase_orchestrator_v1.js";

export const MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1 =
  "MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_V1" as const;
export const MCFT_CAP09_EVIDENCE_SUPPLY_CURSOR_CONTRACT_ID_V1 =
  "MCFT_CAP09_EVIDENCE_SUPPLY_CURSOR_CONTRACT_V1" as const;
export const MCFT_CAP09_VISIBLE_EVIDENCE_INGRESS_ID_V1 =
  "MCFT_CAP09_VISIBLE_EVIDENCE_INGRESS_V1" as const;

export type CommittedExternalEvidenceIdentityV1 = {
  fact_id: string;
  record_type: string;
  source_record_id: string;
  source_record_hash: string;
  record_semantic_sha256: string;
  retention_ref: string;
  raw_sha256: string;
  raw_bytes: number;
};

export type ExternalEvidencePostCommitVisibilityAttestationV1 =
  CommittedExternalEvidenceIdentityV1 & {
    visibility_id: typeof MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1;
    post_commit_db_readback_at: string;
  };

export interface ExternalEvidencePostCommitVisibilityPortV1 {
  verifyCommittedEvidenceVisible(
    expected: CommittedExternalEvidenceIdentityV1,
  ): Promise<ExternalEvidencePostCommitVisibilityAttestationV1>;
}

export type EvidenceSupplyCursorAdvanceInputV1 = {
  cursor_contract_id: typeof MCFT_CAP09_EVIDENCE_SUPPLY_CURSOR_CONTRACT_ID_V1;
  visible_evidence: ExternalEvidencePostCommitVisibilityAttestationV1;
  binding_id: string;
  origin_source_id: string;
  available_to_runtime_at: string;
  role_time: Record<string, unknown>;
};

export type EvidenceSupplyCursorAdvanceResultV1 = {
  status: "ADVANCED" | "EXISTING_IDEMPOTENT_SUCCESS";
  fact_id: string;
  record_semantic_sha256: string;
};

export interface EvidenceSupplyCursorPortV1 {
  advanceAfterVisibleEvidence(
    input: EvidenceSupplyCursorAdvanceInputV1,
  ): Promise<EvidenceSupplyCursorAdvanceResultV1>;
}

export type VisibleExternalFormalEvidenceIngressReceiptV1 =
  ExternalFormalEvidenceIngressReceiptV1 & {
    visible_ingress_id: typeof MCFT_CAP09_VISIBLE_EVIDENCE_INGRESS_ID_V1;
    post_commit_visibility_verified: true;
    post_commit_db_readback_at: string;
    evidence_supply_cursor_advanced: true;
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

function requiredPositiveIntegerV1(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(code);
  return Number(value);
}

function exactIdentityV1(
  actual: CommittedExternalEvidenceIdentityV1,
  expected: CommittedExternalEvidenceIdentityV1,
  code: string,
): void {
  for (const field of [
    "fact_id",
    "record_type",
    "source_record_id",
    "source_record_hash",
    "record_semantic_sha256",
    "retention_ref",
    "raw_sha256",
  ] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
  if (actual.raw_bytes !== expected.raw_bytes) throw new Error(`${code}:raw_bytes`);
}

export function committedExternalEvidenceIdentityV1(
  result: CanonicalizedExternalEvidenceResultV1,
  receipt: ExternalFormalEvidenceIngressReceiptV1,
): CommittedExternalEvidenceIdentityV1 {
  if (receipt.record_type !== result.record.record_type || receipt.source_record_id !== result.record.source_record_id) {
    throw new Error("PHASE2_VISIBLE_INGRESS_RECEIPT_RECORD_IDENTITY_MISMATCH");
  }
  if (receipt.canonical_fact_write_count !== 0 && receipt.canonical_fact_write_count !== 1) {
    throw new Error("PHASE2_VISIBLE_INGRESS_WRITE_COUNT_INVALID");
  }

  const factId = requiredTextV1(receipt.fact_id, "PHASE2_VISIBLE_INGRESS_FACT_ID_REQUIRED");
  const sourceRecordHash = requiredTextV1(receipt.source_record_hash, "PHASE2_VISIBLE_INGRESS_SOURCE_HASH_REQUIRED");
  if (sourceRecordHash !== result.record.source_record_hash) {
    throw new Error("PHASE2_VISIBLE_INGRESS_SOURCE_HASH_MISMATCH");
  }
  const retentionRef = requiredTextV1(receipt.retention_ref, "PHASE2_VISIBLE_INGRESS_RETENTION_REF_REQUIRED");
  const rawSha256 = requiredTextV1(receipt.raw_sha256, "PHASE2_VISIBLE_INGRESS_RAW_SHA_REQUIRED");
  const rawBytes = requiredPositiveIntegerV1(receipt.raw_bytes, "PHASE2_VISIBLE_INGRESS_RAW_BYTES_REQUIRED");
  if (
    retentionRef !== result.raw_provenance.retention_ref
    || rawSha256 !== result.raw_provenance.raw_sha256
    || rawBytes !== result.raw_provenance.raw_bytes
  ) {
    throw new Error("PHASE2_VISIBLE_INGRESS_RAW_PROVENANCE_MISMATCH");
  }

  const semanticHash = semanticHashV1(result.record);
  if (semanticHash !== result.record_semantic_sha256) {
    throw new Error("PHASE2_VISIBLE_INGRESS_RECORD_SEMANTIC_HASH_MISMATCH");
  }

  return {
    fact_id: factId,
    record_type: result.record.record_type,
    source_record_id: result.record.source_record_id,
    source_record_hash: result.record.source_record_hash,
    record_semantic_sha256: semanticHash,
    retention_ref: retentionRef,
    raw_sha256: rawSha256,
    raw_bytes: rawBytes,
  };
}

export class PostCommitVisibleExternalFormalEvidenceIngressV1 implements ExternalFormalEvidenceIngressPortV1 {
  constructor(
    private readonly committedIngress: ExternalFormalEvidenceIngressPortV1,
    private readonly visibility: ExternalEvidencePostCommitVisibilityPortV1,
    private readonly supplyCursor: EvidenceSupplyCursorPortV1,
  ) {}

  async appendCanonicalizedExternalEvidence(
    result: CanonicalizedExternalEvidenceResultV1,
  ): Promise<VisibleExternalFormalEvidenceIngressReceiptV1> {
    // The wrapped ingress contract returns only after its governed COMMIT has completed.
    const receipt = await this.committedIngress.appendCanonicalizedExternalEvidence(result);
    const committed = committedExternalEvidenceIdentityV1(result, receipt);

    // A fresh visibility readback MUST succeed and match the exact committed identity before cursor advance.
    const visible = await this.visibility.verifyCommittedEvidenceVisible(committed);
    exactIdentityV1(visible, committed, "PHASE2_POST_COMMIT_VISIBILITY_IDENTITY_MISMATCH");
    canonicalIsoV1(visible.post_commit_db_readback_at, "PHASE2_POST_COMMIT_READBACK_AT_INVALID");
    if (visible.visibility_id !== MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1) {
      throw new Error("PHASE2_POST_COMMIT_VISIBILITY_ID_INVALID");
    }

    const cursorResult = await this.supplyCursor.advanceAfterVisibleEvidence({
      cursor_contract_id: MCFT_CAP09_EVIDENCE_SUPPLY_CURSOR_CONTRACT_ID_V1,
      visible_evidence: visible,
      binding_id: requiredTextV1(result.record.binding_id, "PHASE2_SUPPLY_CURSOR_BINDING_ID_REQUIRED"),
      origin_source_id: requiredTextV1(result.record.origin_source_id, "PHASE2_SUPPLY_CURSOR_ORIGIN_SOURCE_ID_REQUIRED"),
      available_to_runtime_at: canonicalIsoV1(
        result.record.available_to_runtime_at,
        "PHASE2_SUPPLY_CURSOR_RUNTIME_AVAILABILITY_INVALID",
      ),
      role_time: structuredClone(result.record.role_time),
    });
    if (cursorResult.status !== "ADVANCED" && cursorResult.status !== "EXISTING_IDEMPOTENT_SUCCESS") {
      throw new Error("PHASE2_SUPPLY_CURSOR_RESULT_STATUS_INVALID");
    }
    if (
      cursorResult.fact_id !== committed.fact_id
      || cursorResult.record_semantic_sha256 !== committed.record_semantic_sha256
    ) {
      throw new Error("PHASE2_SUPPLY_CURSOR_RESULT_IDENTITY_MISMATCH");
    }

    return {
      ...receipt,
      visible_ingress_id: MCFT_CAP09_VISIBLE_EVIDENCE_INGRESS_ID_V1,
      post_commit_visibility_verified: true,
      post_commit_db_readback_at: visible.post_commit_db_readback_at,
      evidence_supply_cursor_advanced: true,
    };
  }
}
