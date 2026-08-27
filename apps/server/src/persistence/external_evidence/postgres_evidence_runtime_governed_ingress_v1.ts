// MCFT-CAP-09 Production Hosting Phase 3: fenced governed External Evidence ingress.
// Boundary: this is the only DB writer used by the Evidence Runtime composition.
// It binds every canonical fact append to the current EvidenceProducerLease fence.
// Historical Phase2 ingress remains unchanged for historical qualification compatibility.

import type { Pool, PoolClient } from "pg";

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
          prepared.fact_id,
          prepared.event_time,
          JSON.stringify({ type: prepared.record.record_type, payload: prepared.record }),
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
        fact_id: prepared.fact_id,
        record_type: prepared.record.record_type,
        source_record_id: prepared.record.source_record_id,
        source_record_hash: prepared.record.source_record_hash,
        retention_ref: prepared.raw_proof.retention_ref,
        raw_sha256: prepared.raw_proof.retained_sha256,
        raw_bytes: prepared.raw_proof.retained_bytes,
        canonical_fact_write_count: writeCount as 0 | 1,
      };
    } catch (error) {
      await rollbackQuietlyV1(client);
      throw error;
    } finally {
      client.release();
    }
  }
}
