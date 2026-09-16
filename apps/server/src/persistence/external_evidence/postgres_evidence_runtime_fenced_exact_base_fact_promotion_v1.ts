// MCFT-CAP-09 post-merge v13 production-safe Evidence Runtime fenced fact promotion.
// The caller never needs direct public.facts INSERT. Raw retention is verified before mutation;
// the SECURITY DEFINER function revalidates the controller and producer fences under row locks
// and appends exactly weather + ET0 + soil in one transaction.

import type { Pool, PoolClient } from "pg";

import type { CanonicalizedExternalEvidenceResultV1 } from "../../external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type { RawEvidenceRetentionVerificationPortV1 } from "../../external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import {
  prepareExternalFormalEvidenceIngressV1,
  type PreparedExternalFormalEvidenceIngressV1,
} from "../twin_runtime/postgres_external_formal_evidence_ingress_v1.js";
import {
  MCFT_CAP09_EXACT_BASE_FACT_PROMOTION_ID_V1,
  validateExternalFormalExactBasePromotionInputV1,
  type ExternalFormalExactBaseSemanticManifestRowV1,
} from "../../runtime/twin_runtime/external_formal_exact_base_fact_promotion_v1.js";
import type {
  ExternalFormalForcingBaseClaimV1,
  ExternalFormalPhysicalFactIdentityV1,
} from "../../runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import {
  MCFT_CAP09_FORMAL_FORCING_CONTROLLER_LIFECYCLE_ID_V1,
  type ExternalFormalForcingControllerLeaseV1,
} from "../../runtime/twin_runtime/postgres_external_formal_forcing_controller_lifecycle_v1.js";
import type { TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";
import {
  MCFT_CAP09_POSTGRES_FENCED_EXACT_BASE_FACT_PROMOTION_ID_V1,
  PostgresExternalFormalFencedPromotionFailureV1,
  type PostgresExternalFormalFencedFactPromotionReceiptV1,
} from "../twin_runtime/postgres_external_formal_fenced_exact_base_fact_promotion_v1.js";

export const MCFT_CAP09_EVIDENCE_RUNTIME_FENCED_EXACT_BASE_FACT_PROMOTION_ID_V1 =
  "EVIDENCE_RUNTIME_FENCED_EXACT_BASE_FACT_PROMOTION_V1" as const;

export type EvidenceRuntimeFencedExactBaseFactPromotionConfigV1 = {
  scope: TwinScopeKeyV1;
  epoch_id: string;
  subject_sha: string;
};

export type EvidenceRuntimeFencedExactBaseFactPromotionReceiptV1 =
  PostgresExternalFormalFencedFactPromotionReceiptV1 & {
    evidence_runtime_fenced_promotion_id:
      typeof MCFT_CAP09_EVIDENCE_RUNTIME_FENCED_EXACT_BASE_FACT_PROMOTION_ID_V1;
    database_fence_commit_succeeded: true;
    controller_fencing_token: string;
    producer_fencing_token: string;
    commit_preflight_database_clock: string;
  };

type ClientV1 = Pick<PoolClient, "query" | "release">;
type PoolV1 = Pick<Pool, "connect">;
const SCOPE_KEYS = ["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const;

function required(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function canonicalHour(value: unknown, code: string): string {
  const text = required(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) {
    throw new Error(code);
  }
  return text;
}
function scopeValues(scope: TwinScopeKeyV1): string[] {
  return SCOPE_KEYS.map((key) => required(scope[key], `V13_EVIDENCE_FENCED_SCOPE_${key.toUpperCase()}_REQUIRED`));
}
function sameScope(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return SCOPE_KEYS.every((key) => left[key] === right[key]);
}
function validateConfig(
  input: EvidenceRuntimeFencedExactBaseFactPromotionConfigV1,
): EvidenceRuntimeFencedExactBaseFactPromotionConfigV1 {
  scopeValues(input.scope);
  const epoch = required(input.epoch_id, "V13_EVIDENCE_FENCED_EPOCH_REQUIRED");
  const subject = required(input.subject_sha, "V13_EVIDENCE_FENCED_SUBJECT_REQUIRED");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("V13_EVIDENCE_FENCED_SUBJECT_INVALID");
  return { scope: { ...input.scope }, epoch_id: epoch, subject_sha: subject };
}
function validateAuthority(
  config: EvidenceRuntimeFencedExactBaseFactPromotionConfigV1,
  controller: ExternalFormalForcingControllerLeaseV1,
  claim: ExternalFormalForcingBaseClaimV1,
  base: string,
): void {
  if (
    controller.lifecycle_id !== MCFT_CAP09_FORMAL_FORCING_CONTROLLER_LIFECYCLE_ID_V1
    || controller.epoch_id !== config.epoch_id
    || controller.subject_sha !== config.subject_sha
    || !sameScope(controller.scope, config.scope)
    || !controller.lease_owner
    || controller.fencing_token <= 0n
  ) throw new Error("V13_EVIDENCE_FENCED_CONTROLLER_IDENTITY_MISMATCH");

  if (
    claim.epoch_id !== config.epoch_id
    || claim.subject_sha !== config.subject_sha
    || !sameScope(claim.scope, config.scope)
    || canonicalHour(claim.base_target_t, "V13_EVIDENCE_FENCED_CLAIM_BASE_INVALID") !== base
    || canonicalHour(claim.causal_deadline, "V13_EVIDENCE_FENCED_CLAIM_DEADLINE_INVALID") !== base
    || !claim.lease_owner
    || claim.fencing_token <= 0n
    || !claim.idempotency_key
  ) throw new Error("V13_EVIDENCE_FENCED_PRODUCER_IDENTITY_MISMATCH");
}
function asCount(value: number, code: string): 0 | 1 | 2 | 3 {
  if (!Number.isInteger(value) || value < 0 || value > 3) throw new Error(code);
  return value as 0 | 1 | 2 | 3;
}
function factKind(recordType: string): ExternalFormalPhysicalFactIdentityV1["kind"] {
  if (recordType === "future_weather_assumption_v1") return "WEATHER";
  if (recordType === "future_et0_assumption_v1") return "ET0";
  if (recordType === "soil_moisture_observation_v1") return "SOIL";
  throw new Error("V13_EVIDENCE_FENCED_FACT_KIND_FORBIDDEN:" + recordType);
}

export class PostgresEvidenceRuntimeFencedExactBaseFactPromotionV1 {
  private readonly config: EvidenceRuntimeFencedExactBaseFactPromotionConfigV1;

  constructor(
    private readonly pool: PoolV1,
    private readonly retentionVerifier: RawEvidenceRetentionVerificationPortV1,
    config: EvidenceRuntimeFencedExactBaseFactPromotionConfigV1,
  ) {
    this.config = validateConfig(config);
  }

  async promote(input: {
    base_target_t: string;
    controller_lease: ExternalFormalForcingControllerLeaseV1;
    producer_claim: ExternalFormalForcingBaseClaimV1;
    results: readonly CanonicalizedExternalEvidenceResultV1[];
    expected_semantic_manifest: readonly ExternalFormalExactBaseSemanticManifestRowV1[];
  }): Promise<EvidenceRuntimeFencedExactBaseFactPromotionReceiptV1> {
    const base = canonicalHour(input.base_target_t, "V13_EVIDENCE_FENCED_BASE_INVALID");
    try {
      validateAuthority(this.config, input.controller_lease, input.producer_claim, base);
    } catch (error) {
      throw new PostgresExternalFormalFencedPromotionFailureV1({
        failure_class: error instanceof Error ? error.message : String(error),
        mutation_state: "NO_FORMAL_MUTATION",
        cause: error,
      });
    }

    let validated: { base: string; results: CanonicalizedExternalEvidenceResultV1[] };
    let rows: Array<{ result: CanonicalizedExternalEvidenceResultV1; prepared: PreparedExternalFormalEvidenceIngressV1 }>;
    try {
      validated = validateExternalFormalExactBasePromotionInputV1({
        base_target_t: base,
        results: input.results,
        expected_semantic_manifest: input.expected_semantic_manifest,
      });
      rows = validated.results.map((result) => ({
        result,
        prepared: prepareExternalFormalEvidenceIngressV1(result),
      }));
      for (const row of rows) {
        await this.retentionVerifier.verifyRetainedRawEvidence(row.prepared.raw_proof);
      }
    } catch (error) {
      throw new PostgresExternalFormalFencedPromotionFailureV1({
        failure_class: "V13_EVIDENCE_FENCED_PRETRANSACTION_VALIDATION_FAILED:"
          + (error instanceof Error ? error.message : String(error)),
        mutation_state: "NO_FORMAL_MUTATION",
        cause: error,
      });
    }

    const client = await this.pool.connect() as ClientV1;
    let transactionStarted = false;
    let commitAttempted = false;
    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const payload = rows.map(({ prepared }) => ({
        fact_id: prepared.fact_id,
        occurred_at: prepared.event_time,
        record_json: { type: prepared.record.record_type, payload: prepared.record },
      }));
      const db = await client.query<{ inserted_count: number; existing_count: number }>(
        `SELECT inserted_count,existing_count
           FROM public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(
             $1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11::bigint,$12,$13::bigint,$14,$15::jsonb)`,
        [
          ...scopeValues(this.config.scope),
          this.config.epoch_id,
          this.config.subject_sha,
          base,
          input.controller_lease.lease_owner,
          input.controller_lease.fencing_token.toString(),
          input.producer_claim.lease_owner,
          input.producer_claim.fencing_token.toString(),
          input.producer_claim.idempotency_key,
          JSON.stringify(payload),
        ],
      );
      if (db.rows.length !== 1) throw new Error("V13_EVIDENCE_FENCED_WRITER_RECEIPT_REQUIRED");
      const inserted = asCount(Number(db.rows[0]!.inserted_count), "V13_EVIDENCE_FENCED_INSERTED_COUNT_INVALID");
      const existing = asCount(Number(db.rows[0]!.existing_count), "V13_EVIDENCE_FENCED_EXISTING_COUNT_INVALID");
      if (inserted + existing !== 3) throw new Error("V13_EVIDENCE_FENCED_EXACT_THREE_PRESENT_REQUIRED");

      const nowRow = await client.query<{ database_now: string | Date }>(
        "SELECT clock_timestamp() AS database_now",
      );
      const now = new Date(nowRow.rows[0]!.database_now).toISOString();
      if (
        Date.parse(now) >= Date.parse(base)
        || Date.parse(input.controller_lease.lease_expires_at) <= Date.parse(now)
        || Date.parse(input.producer_claim.lease_expires_at) <= Date.parse(now)
      ) throw new Error("V13_EVIDENCE_FENCED_PRECOMMIT_DEADLINE_REACHED");

      // Controller/target row locks acquired inside the SECURITY DEFINER function remain held
      // by this transaction until COMMIT, so no takeover can interleave after the final check.
      commitAttempted = true;
      await client.query("COMMIT");
      transactionStarted = false;

      const facts: ExternalFormalPhysicalFactIdentityV1[] = rows.map(({ result, prepared }) => ({
        kind: factKind(result.record.record_type),
        fact_id: prepared.fact_id,
        source_record_id: result.record.source_record_id,
        source_record_hash: result.record.source_record_hash,
        record_semantic_hash: result.record_semantic_sha256,
      }));

      return {
        promotion_id: MCFT_CAP09_EXACT_BASE_FACT_PROMOTION_ID_V1,
        fenced_promotion_id: MCFT_CAP09_POSTGRES_FENCED_EXACT_BASE_FACT_PROMOTION_ID_V1,
        status: "PASS",
        base_target_t: base,
        facts,
        formal_fact_present_count: 3,
        formal_database_write_count: inserted,
        idempotent_existing_fact_count: existing,
        evidence_runtime_fenced_promotion_id:
          MCFT_CAP09_EVIDENCE_RUNTIME_FENCED_EXACT_BASE_FACT_PROMOTION_ID_V1,
        database_fence_commit_succeeded: true,
        controller_fencing_token: input.controller_lease.fencing_token.toString(),
        producer_fencing_token: input.producer_claim.fencing_token.toString(),
        commit_preflight_database_clock: now,
      };
    } catch (error) {
      if (commitAttempted) {
        throw new PostgresExternalFormalFencedPromotionFailureV1({
          failure_class: "V13_EVIDENCE_FENCED_COMMIT_OUTCOME_UNKNOWN:"
            + (error instanceof Error ? error.message : String(error)),
          mutation_state: "UNKNOWN_FORMAL_MUTATION",
          cause: error,
        });
      }
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
          transactionStarted = false;
        } catch (rollbackError) {
          throw new PostgresExternalFormalFencedPromotionFailureV1({
            failure_class: "V13_EVIDENCE_FENCED_ROLLBACK_OUTCOME_UNKNOWN:"
              + (rollbackError instanceof Error ? rollbackError.message : String(rollbackError)),
            mutation_state: "UNKNOWN_FORMAL_MUTATION",
            cause: error,
          });
        }
      }
      throw new PostgresExternalFormalFencedPromotionFailureV1({
        failure_class: error instanceof Error ? error.message : String(error),
        mutation_state: "NO_FORMAL_MUTATION",
        cause: error,
      });
    } finally {
      client.release();
    }
  }
}
