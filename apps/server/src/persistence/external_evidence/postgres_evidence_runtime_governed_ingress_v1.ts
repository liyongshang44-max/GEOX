// MCFT-CAP-09 Production Hosting Phase 3: fenced governed External Evidence ingress.
// Boundary: this is the only DB writer used by the Evidence Runtime composition.
// It binds every canonical fact append to the current EvidenceProducerLease fence.
// Historical Phase2 ingress remains unchanged for historical qualification compatibility.

import type { Pool, PoolClient } from "pg";

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type {
  CanonicalizedExternalEvidenceResultV1,
} from "../../external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  ExternalFormalEvidenceIngressPortV1,
  ExternalFormalEvidenceIngressReceiptV1,
} from "../../external_evidence/mcft_cap09_external_formal_collector_phase_orchestrator_v1.js";
import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type EvidenceProducerLeaseClaimV1,
  type EvidenceRuntimeScopeV1,
} from "../../external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import type {
  RawEvidenceRetentionVerificationPortV1,
} from "../../external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_INGRESS_ID_V1,
  externalFormalEvidenceRevisionFactIdV1,
  prepareExternalFormalEvidenceIngressV1,
} from "../twin_runtime/postgres_external_formal_evidence_ingress_v1.js";

export const MCFT_CAP09_EVIDENCE_RUNTIME_GOVERNED_INGRESS_ID_V1 =
  "MCFT_CAP09_EVIDENCE_RUNTIME_GOVERNED_INGRESS_V1" as const;

const SCOPE_KEYS = [
  "tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id",
] as const;

type DbResultRowV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  canonical_fact_write_count: number;
};

type ExistingFactRowV1 = {
  occurred_at: string | Date;
  source: string;
  record_json: unknown;
};

type ExistingRepublicationV1 = {
  occurred_at: string;
  record_json: unknown;
  committed_record_semantic_sha256: string;
};

type EvidenceIngressPoolV1 = Pick<Pool, "connect">;
type EvidenceIngressClientV1 = Pick<PoolClient, "query" | "release">;

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function exactScopeV1(actual: EvidenceRuntimeScopeV1, expected: EvidenceRuntimeScopeV1): void {
  for (const key of SCOPE_KEYS) {
    const actualValue = requiredTextV1(
      actual[key],
      "PHASE3_EVIDENCE_DB_INGRESS_SCOPE_" + key.toUpperCase() + "_REQUIRED",
    );
    const expectedValue = requiredTextV1(
      expected[key],
      "PHASE3_EVIDENCE_DB_INGRESS_CONFIG_" + key.toUpperCase() + "_REQUIRED",
    );
    if (actualValue !== expectedValue) {
      throw new Error("PHASE3_EVIDENCE_DB_INGRESS_SCOPE_MISMATCH:" + key);
    }
  }
}

async function rollbackQuietlyV1(client: EvidenceIngressClientV1): Promise<void> {
  try { await client.query("ROLLBACK"); } catch { /* preserve original error */ }
}

function objectRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = value instanceof Date ? value.toISOString() : requiredTextV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function normalizedRepublicationRecordV1(value: Record<string, unknown>): Record<string, unknown> {
  const normalized = structuredClone(value);
  delete normalized.available_to_runtime_at;

  const roleTime = objectRecordV1(normalized.role_time, "PHASE3_EVIDENCE_DB_INGRESS_REPUBLICATION_ROLE_TIME_REQUIRED");
  delete roleTime.ingested_at;
  normalized.role_time = roleTime;

  const sourcePayload = objectRecordV1(
    normalized.source_payload,
    "PHASE3_EVIDENCE_DB_INGRESS_REPUBLICATION_SOURCE_PAYLOAD_REQUIRED",
  );
  const raw = objectRecordV1(
    sourcePayload.raw_provenance,
    "PHASE3_EVIDENCE_DB_INGRESS_REPUBLICATION_RAW_PROVENANCE_REQUIRED",
  );
  delete raw.request_id;
  delete raw.retrieved_at;
  delete raw.available_at;
  sourcePayload.raw_provenance = raw;
  normalized.source_payload = sourcePayload;
  return normalized;
}

function parseExistingFactEnvelopeV1(value: unknown): {
  type: string;
  record: Record<string, unknown>;
} {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const envelope = objectRecordV1(parsed, "PHASE3_EVIDENCE_DB_INGRESS_EXISTING_ENVELOPE_INVALID");
  const type = requiredTextV1(envelope.type, "PHASE3_EVIDENCE_DB_INGRESS_EXISTING_TYPE_REQUIRED");
  const record = objectRecordV1(envelope.payload, "PHASE3_EVIDENCE_DB_INGRESS_EXISTING_PAYLOAD_INVALID");
  return { type, record };
}

function sameSemanticRepublicationV1(
  existing: ExistingFactRowV1,
  prepared: ReturnType<typeof prepareExternalFormalEvidenceIngressV1>,
): ExistingRepublicationV1 | null {
  if (existing.source !== "mcft_cap09_external_formal_evidence_v1") return null;
  const parsed = parseExistingFactEnvelopeV1(existing.record_json);
  if (parsed.type !== prepared.record.record_type) return null;
  if (parsed.record.source_record_id !== prepared.record.source_record_id) return null;
  if (parsed.record.source_record_hash !== prepared.record.source_record_hash) return null;
  if (parsed.record.dataset_id !== prepared.record.dataset_id) return null;
  if (parsed.record.binding_id !== prepared.record.binding_id) return null;
  if (parsed.record.origin_source_kind !== prepared.record.origin_source_kind) return null;
  if (parsed.record.origin_source_id !== prepared.record.origin_source_id) return null;
  if (parsed.record.epistemic_class !== prepared.record.epistemic_class) return null;

  const existingOccurredAt = canonicalIsoV1(
    existing.occurred_at,
    "PHASE3_EVIDENCE_DB_INGRESS_EXISTING_OCCURRED_AT_INVALID",
  );
  if (existingOccurredAt !== prepared.event_time) return null;

  const existingStable = semanticHashV1(normalizedRepublicationRecordV1(parsed.record));
  const incomingStable = semanticHashV1(
    normalizedRepublicationRecordV1(prepared.record as unknown as Record<string, unknown>),
  );
  if (existingStable !== incomingStable) return null;

  return {
    occurred_at: existingOccurredAt,
    record_json: existing.record_json,
    committed_record_semantic_sha256: semanticHashV1(parsed.record),
  };
}

export class PostgresEvidenceRuntimeGovernedIngressV1 implements ExternalFormalEvidenceIngressPortV1 {
  readonly ingress_id = MCFT_CAP09_EVIDENCE_RUNTIME_GOVERNED_INGRESS_ID_V1;

  constructor(
    private readonly pool: EvidenceIngressPoolV1,
    private readonly retentionVerifier: RawEvidenceRetentionVerificationPortV1,
    private readonly configuredScope: EvidenceRuntimeScopeV1,
    private readonly producerClaim: EvidenceProducerLeaseClaimV1,
  ) {
    exactScopeV1(producerClaim.scope, configuredScope);
    if (producerClaim.lease_contract_id !== MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1) {
      throw new Error("PHASE3_EVIDENCE_DB_INGRESS_LEASE_CONTRACT_INVALID");
    }
    if (producerClaim.fencing_token <= 0n) {
      throw new Error("PHASE3_EVIDENCE_DB_INGRESS_FENCING_TOKEN_INVALID");
    }
    requiredTextV1(producerClaim.lease_owner, "PHASE3_EVIDENCE_DB_INGRESS_LEASE_OWNER_REQUIRED");
  }

  async appendCanonicalizedExternalEvidence(
    result: CanonicalizedExternalEvidenceResultV1,
  ): Promise<ExternalFormalEvidenceIngressReceiptV1> {
    const prepared = prepareExternalFormalEvidenceIngressV1(result);
    exactScopeV1(prepared.record, this.configuredScope);

    // Preserve the frozen raw-retention-first rule before opening the governed DB transaction.
    await this.retentionVerifier.verifyRetainedRawEvidence(prepared.raw_proof);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // A provider may publish the same immutable source observation more than once.
      // The canonical fact keeps its first-seen availability/provenance; later publication
      // time belongs to the Evidence supply ledger. This read is advisory only: the existing
      // SECURITY DEFINER function still performs the authoritative lease/fence check and
      // exact fact append/idempotency decision under its frozen lock ordering.
      const existing = await client.query<ExistingFactRowV1>(
        "SELECT occurred_at,source,record_json FROM public.facts WHERE fact_id=$1 LIMIT 2",
        [prepared.fact_id],
      );
      if (existing.rows.length > 1) throw new Error("PHASE3_EVIDENCE_DB_INGRESS_FACT_ID_NOT_UNIQUE");

      const baseRepublication = existing.rows.length === 1
        ? sameSemanticRepublicationV1(existing.rows[0], prepared)
        : null;

      let targetFactId = prepared.fact_id;
      let republication = baseRepublication;
      let revisionFact = false;

      if (existing.rows.length === 1 && !baseRepublication) {
        targetFactId = externalFormalEvidenceRevisionFactIdV1(prepared.record);
        const revisionExisting = await client.query<ExistingFactRowV1>(
          "SELECT occurred_at,source,record_json FROM public.facts WHERE fact_id=$1 LIMIT 2",
          [targetFactId],
        );
        if (revisionExisting.rows.length > 1) {
          throw new Error("PHASE3_EVIDENCE_DB_INGRESS_REVISION_FACT_ID_NOT_UNIQUE");
        }
        republication = revisionExisting.rows.length === 1
          ? sameSemanticRepublicationV1(revisionExisting.rows[0], prepared)
          : null;
        revisionFact = true;
      }

      const dbOccurredAt = republication?.occurred_at ?? prepared.event_time;
      const dbRecordJson = republication?.record_json
        ?? { type: prepared.record.record_type, payload: prepared.record };

      const db = await client.query<DbResultRowV1>(
        "SELECT status, canonical_fact_write_count " +
        "FROM public.mcft_cap09_evidence_runtime_append_fact_v1(" +
        "$1,$2,$3,$4,$5,$6,$7,$8::bigint,$9,$10::timestamptz,$11::jsonb)",
        [
          this.configuredScope.tenant_id,
          this.configuredScope.project_id,
          this.configuredScope.group_id,
          this.configuredScope.field_id,
          this.configuredScope.season_id,
          this.configuredScope.zone_id,
          this.producerClaim.lease_owner,
          this.producerClaim.fencing_token.toString(),
          targetFactId,
          dbOccurredAt,
          JSON.stringify(dbRecordJson),
        ],
      );
      if (db.rows.length !== 1) throw new Error("PHASE3_EVIDENCE_DB_INGRESS_RESULT_CARDINALITY");
      const row = db.rows[0];
      if (row.status !== "INSERTED" && row.status !== "EXISTING_IDEMPOTENT_SUCCESS") {
        throw new Error("PHASE3_EVIDENCE_DB_INGRESS_RESULT_STATUS_INVALID");
      }
      const writeCount = Number(row.canonical_fact_write_count);
      if (writeCount !== 0 && writeCount !== 1) {
        throw new Error("PHASE3_EVIDENCE_DB_INGRESS_WRITE_COUNT_INVALID");
      }
      if ((row.status === "INSERTED" && writeCount !== 1)
        || (row.status === "EXISTING_IDEMPOTENT_SUCCESS" && writeCount !== 0)) {
        throw new Error("PHASE3_EVIDENCE_DB_INGRESS_STATUS_WRITE_COUNT_MISMATCH");
      }

      // COMMIT is authorized only after the DB-side function has validated the current fence.
      await client.query("COMMIT");
      return {
        ingress_id: MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_INGRESS_ID_V1,
        status: row.status,
        fact_id: targetFactId,
        record_type: prepared.record.record_type,
        source_record_id: prepared.record.source_record_id,
        source_record_hash: prepared.record.source_record_hash,
        retention_ref: prepared.raw_proof.retention_ref,
        raw_sha256: prepared.raw_proof.retained_sha256,
        raw_bytes: prepared.raw_proof.retained_bytes,
        canonical_fact_write_count: writeCount as 0 | 1,
        ...(republication ? {
          republication_reused_immutable_fact: true,
          committed_record_semantic_sha256: republication.committed_record_semantic_sha256,
        } : {}),
        ...(revisionFact ? {
          revision_fact_identity_used: true,
          base_fact_id: prepared.fact_id,
        } : {}),
      };
    } catch (error) {
      await rollbackQuietlyV1(client);
      throw error;
    } finally {
      client.release();
    }
  }
}
