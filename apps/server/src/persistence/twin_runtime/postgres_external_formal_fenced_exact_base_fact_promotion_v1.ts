import type { Pool, PoolClient } from "pg";

import type { CanonicalizedExternalEvidenceResultV1 } from "../../external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type { RawEvidenceRetentionVerificationPortV1 } from "../../external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import {
  appendPreparedExternalFormalEvidenceUsingClientV1,
  prepareExternalFormalEvidenceIngressV1,
  type PreparedExternalFormalEvidenceIngressV1,
} from "./postgres_external_formal_evidence_ingress_v1.js";
import {
  promoteExternalFormalExactBaseCanonicalFactsV1,
  type ExternalFormalExactBaseFactPromotionReceiptV1,
  type ExternalFormalExactBaseSemanticManifestRowV1,
} from "../../runtime/twin_runtime/external_formal_exact_base_fact_promotion_v1.js";
import type {
  ExternalFormalForcingBaseClaimV1,
} from "../../runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import {
  MCFT_CAP09_FORMAL_FORCING_CONTROLLER_LIFECYCLE_ID_V1,
  type ExternalFormalForcingControllerLeaseV1,
} from "../../runtime/twin_runtime/postgres_external_formal_forcing_controller_lifecycle_v1.js";
import type { TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";

export const MCFT_CAP09_POSTGRES_FENCED_EXACT_BASE_FACT_PROMOTION_ID_V1 =
  "POSTGRES_FENCED_EXACT_BASE_FACT_PROMOTION_V1" as const;

export type PostgresExternalFormalFencedPromotionMutationStateV1 =
  | "NO_FORMAL_MUTATION"
  | "UNKNOWN_FORMAL_MUTATION";

export class PostgresExternalFormalFencedPromotionFailureV1 extends Error {
  readonly failure_class: string;
  readonly mutation_state: PostgresExternalFormalFencedPromotionMutationStateV1;
  readonly formal_database_write_count: 0 | null;

  constructor(input: {
    failure_class: string;
    mutation_state: PostgresExternalFormalFencedPromotionMutationStateV1;
    cause?: unknown;
  }) {
    super(input.failure_class, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "PostgresExternalFormalFencedPromotionFailureV1";
    this.failure_class = input.failure_class;
    this.mutation_state = input.mutation_state;
    this.formal_database_write_count = input.mutation_state === "NO_FORMAL_MUTATION" ? 0 : null;
  }
}

export type PostgresExternalFormalFencedFactPromotionConfigV1 = {
  scope: TwinScopeKeyV1;
  epoch_id: string;
  subject_sha: string;
};

export type PostgresExternalFormalFencedFactPromotionReceiptV1 = ExternalFormalExactBaseFactPromotionReceiptV1 & {
  fenced_promotion_id: typeof MCFT_CAP09_POSTGRES_FENCED_EXACT_BASE_FACT_PROMOTION_ID_V1;
  database_fence_commit_succeeded: true;
  controller_fencing_token: string;
  producer_fencing_token: string;
  commit_preflight_database_clock: string;
};

type ClientV1 = Pick<PoolClient, "query" | "release">;
type PoolV1 = Pick<Pool, "connect">;
type ControllerRowV1 = {
  subject_sha: string;
  lifecycle_state: "ACTIVE" | "TERMINAL";
  lease_owner: string;
  fencing_token: string | number | bigint;
  lease_expires_at: string | Date | null;
};
type TargetRowV1 = {
  subject_sha: string;
  base_target_t: string | Date;
  causal_deadline: string | Date;
  state: string;
  claim_owner: string | null;
  fencing_token: string | number | bigint;
  lease_expires_at: string | Date | null;
  idempotency_key: string;
};

const SCOPE_KEYS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;

function text(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function iso(value: string | Date): string {
  return new Date(value).toISOString();
}
function canonicalHour(value: unknown, code: string): string {
  const raw = text(value, code);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== raw || !raw.endsWith(":00:00.000Z")) throw new Error(code);
  return raw;
}
function scopeValues(scope: TwinScopeKeyV1): string[] {
  return SCOPE_KEYS.map((key) => text(scope[key], `FENCED_FACT_PROMOTION_SCOPE_${key.toUpperCase()}_REQUIRED`));
}
function sameScope(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return SCOPE_KEYS.every((key) => left[key] === right[key]);
}
function validateConfig(input: PostgresExternalFormalFencedFactPromotionConfigV1): PostgresExternalFormalFencedFactPromotionConfigV1 {
  scopeValues(input.scope);
  const epoch = text(input.epoch_id, "FENCED_FACT_PROMOTION_EPOCH_REQUIRED");
  const subject = text(input.subject_sha, "FENCED_FACT_PROMOTION_SUBJECT_REQUIRED");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("FENCED_FACT_PROMOTION_SUBJECT_INVALID");
  return { scope: { ...input.scope }, epoch_id: epoch, subject_sha: subject };
}
function validateAuthorityIdentity(
  config: PostgresExternalFormalFencedFactPromotionConfigV1,
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
  ) throw new Error("FENCED_FACT_PROMOTION_CONTROLLER_IDENTITY_MISMATCH");
  if (
    claim.epoch_id !== config.epoch_id
    || claim.subject_sha !== config.subject_sha
    || !sameScope(claim.scope, config.scope)
    || canonicalHour(claim.base_target_t, "FENCED_FACT_PROMOTION_CLAIM_BASE_INVALID") !== base
    || canonicalHour(claim.causal_deadline, "FENCED_FACT_PROMOTION_CLAIM_DEADLINE_INVALID") !== base
    || !claim.lease_owner
    || claim.fencing_token <= 0n
    || !claim.idempotency_key
  ) throw new Error("FENCED_FACT_PROMOTION_PRODUCER_CLAIM_IDENTITY_MISMATCH");
}
async function databaseNow(client: Pick<PoolClient, "query">): Promise<string> {
  const row = (await client.query<{ database_now: string | Date }>("SELECT clock_timestamp() AS database_now")).rows[0];
  if (!row) throw new Error("FENCED_FACT_PROMOTION_DATABASE_CLOCK_REQUIRED");
  return iso(row.database_now);
}
function assertLiveBeforeBase(input: {
  now: string;
  base: string;
  controller_expiry: string;
  producer_expiry: string;
}): void {
  if (Date.parse(input.now) >= Date.parse(input.base)) throw new Error("FENCED_FACT_PROMOTION_CAUSAL_DEADLINE_REACHED");
  if (Date.parse(input.controller_expiry) <= Date.parse(input.now)) throw new Error("FENCED_FACT_PROMOTION_CONTROLLER_LEASE_EXPIRED");
  if (Date.parse(input.producer_expiry) <= Date.parse(input.now)) throw new Error("FENCED_FACT_PROMOTION_PRODUCER_LEASE_EXPIRED");
}
function preparedKey(result: CanonicalizedExternalEvidenceResultV1): string {
  return `${result.record.record_type}|${result.record.source_record_id}|${result.record_semantic_sha256}`;
}

export class PostgresExternalFormalFencedExactBaseFactPromotionV1 {
  private readonly config: PostgresExternalFormalFencedFactPromotionConfigV1;

  constructor(
    private readonly pool: PoolV1,
    private readonly retentionVerifier: RawEvidenceRetentionVerificationPortV1,
    config: PostgresExternalFormalFencedFactPromotionConfigV1,
  ) {
    this.config = validateConfig(config);
  }

  async promote(input: {
    base_target_t: string;
    controller_lease: ExternalFormalForcingControllerLeaseV1;
    producer_claim: ExternalFormalForcingBaseClaimV1;
    results: readonly CanonicalizedExternalEvidenceResultV1[];
    expected_semantic_manifest: readonly ExternalFormalExactBaseSemanticManifestRowV1[];
  }): Promise<PostgresExternalFormalFencedFactPromotionReceiptV1> {
    const base = canonicalHour(input.base_target_t, "FENCED_FACT_PROMOTION_BASE_INVALID");
    try {
      validateAuthorityIdentity(this.config, input.controller_lease, input.producer_claim, base);
    } catch (error) {
      throw new PostgresExternalFormalFencedPromotionFailureV1({
        failure_class: error instanceof Error ? error.message : String(error),
        mutation_state: "NO_FORMAL_MUTATION",
        cause: error,
      });
    }

    const prepared = new Map<string, PreparedExternalFormalEvidenceIngressV1>();
    try {
      for (const result of input.results) {
        const item = prepareExternalFormalEvidenceIngressV1(result);
        const key = preparedKey(result);
        if (prepared.has(key)) throw new Error("FENCED_FACT_PROMOTION_DUPLICATE_PREPARED_RESULT");
        prepared.set(key, item);
      }
      for (const item of prepared.values()) await this.retentionVerifier.verifyRetainedRawEvidence(item.raw_proof);
    } catch (error) {
      throw new PostgresExternalFormalFencedPromotionFailureV1({
        failure_class: `FENCED_FACT_PROMOTION_PRETRANSACTION_VALIDATION_FAILED:${error instanceof Error ? error.message : String(error)}`,
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

      const controllerResult = await client.query<ControllerRowV1>(
        `SELECT subject_sha,lifecycle_state,lease_owner,fencing_token,lease_expires_at
           FROM twin_external_formal_forcing_controller_lease_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7
          FOR UPDATE`,
        [...scopeValues(this.config.scope), this.config.epoch_id],
      );
      if (controllerResult.rows.length !== 1) throw new Error("FENCED_FACT_PROMOTION_CONTROLLER_ROW_REQUIRED");
      const controller = controllerResult.rows[0];
      if (
        controller.subject_sha !== this.config.subject_sha
        || controller.lifecycle_state !== "ACTIVE"
        || controller.lease_owner !== input.controller_lease.lease_owner
        || BigInt(controller.fencing_token) !== input.controller_lease.fencing_token
      ) throw new Error("FENCED_FACT_PROMOTION_CONTROLLER_STALE_FENCE");
      if (!controller.lease_expires_at) throw new Error("FENCED_FACT_PROMOTION_CONTROLLER_LEASE_REQUIRED");

      const targetResult = await client.query<TargetRowV1>(
        `SELECT subject_sha,base_target_t,causal_deadline,state,claim_owner,fencing_token,lease_expires_at,idempotency_key
           FROM twin_external_formal_forcing_base_target_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz
          FOR UPDATE`,
        [...scopeValues(this.config.scope), this.config.epoch_id, base],
      );
      if (targetResult.rows.length !== 1) throw new Error("FENCED_FACT_PROMOTION_TARGET_ROW_REQUIRED");
      const target = targetResult.rows[0];
      if (
        target.subject_sha !== this.config.subject_sha
        || iso(target.base_target_t) !== base
        || iso(target.causal_deadline) !== base
        || target.state !== "PROMOTING"
        || target.claim_owner !== input.producer_claim.lease_owner
        || BigInt(target.fencing_token) !== input.producer_claim.fencing_token
        || target.idempotency_key !== input.producer_claim.idempotency_key
      ) throw new Error("FENCED_FACT_PROMOTION_PRODUCER_STALE_FENCE_OR_STATE");
      if (!target.lease_expires_at) throw new Error("FENCED_FACT_PROMOTION_PRODUCER_LEASE_REQUIRED");

      const controllerExpiry = iso(controller.lease_expires_at);
      const producerExpiry = iso(target.lease_expires_at);
      assertLiveBeforeBase({ now: await databaseNow(client), base, controller_expiry: controllerExpiry, producer_expiry: producerExpiry });

      const ingress = {
        appendCanonicalizedExternalEvidence: async (result: CanonicalizedExternalEvidenceResultV1) => {
          const item = prepared.get(preparedKey(result));
          if (!item) throw new Error("FENCED_FACT_PROMOTION_PREPARED_RESULT_REQUIRED");
          assertLiveBeforeBase({ now: await databaseNow(client), base, controller_expiry: controllerExpiry, producer_expiry: producerExpiry });
          return appendPreparedExternalFormalEvidenceUsingClientV1(client as PoolClient, item);
        },
      };
      const promoted = await promoteExternalFormalExactBaseCanonicalFactsV1({
        base_target_t: base,
        results: input.results,
        expected_semantic_manifest: input.expected_semantic_manifest,
      }, ingress);

      const beforeCommit = await databaseNow(client);
      assertLiveBeforeBase({ now: beforeCommit, base, controller_expiry: controllerExpiry, producer_expiry: producerExpiry });
      if (promoted.formal_fact_present_count !== 3) throw new Error("FENCED_FACT_PROMOTION_EXACT_THREE_PRESENT_REQUIRED");

      commitAttempted = true;
      await client.query("COMMIT");
      transactionStarted = false;
      return {
        ...promoted,
        fenced_promotion_id: MCFT_CAP09_POSTGRES_FENCED_EXACT_BASE_FACT_PROMOTION_ID_V1,
        database_fence_commit_succeeded: true,
        controller_fencing_token: input.controller_lease.fencing_token.toString(),
        producer_fencing_token: input.producer_claim.fencing_token.toString(),
        commit_preflight_database_clock: beforeCommit,
      };
    } catch (error) {
      if (commitAttempted) {
        throw new PostgresExternalFormalFencedPromotionFailureV1({
          failure_class: `FENCED_FACT_PROMOTION_COMMIT_OUTCOME_UNKNOWN:${error instanceof Error ? error.message : String(error)}`,
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
            failure_class: `FENCED_FACT_PROMOTION_ROLLBACK_OUTCOME_UNKNOWN:${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
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
