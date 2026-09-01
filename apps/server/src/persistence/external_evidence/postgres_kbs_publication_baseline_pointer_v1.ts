// MCFT-CAP-09 Postgres KBS Raw Hourly durable publication-baseline pointer.
// Boundary: fenced Evidence-plane operational metadata only. No provider/raw-store I/O,
// canonical Evidence writes, Twin state, RuntimeTickCursor, timers, or process activation.

import type { Pool, PoolClient } from "pg";

import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type EvidenceProducerLeaseClaimV1,
  type EvidenceRuntimeScopeV1,
} from "../../external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  MCFT_CAP09_KBS_PUBLICATION_BASELINE_POINTER_CONTRACT_ID_V1,
  type KbsRawHourlyPublicationBaselinePointerAdvanceResultV1,
  type KbsRawHourlyPublicationBaselinePointerNextV1,
  type KbsRawHourlyPublicationBaselinePointerPortV1,
  type KbsRawHourlyPublicationBaselinePointerReadPortV1,
  type KbsRawHourlyPublicationBaselinePointerSnapshotV1,
} from "../../external_evidence/mcft_cap09_kbs_publication_baseline_pointer_v1.js";

export const MCFT_CAP09_POSTGRES_KBS_PUBLICATION_BASELINE_POINTER_ID_V1 =
  "MCFT_CAP09_POSTGRES_KBS_RAW_HOURLY_PUBLICATION_BASELINE_POINTER_V1" as const;

const SCOPE_KEYS = [
  "tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id",
] as const;

type EvidencePoolV1 = Pick<Pool, "connect" | "query">;
type EvidenceClientV1 = Pick<PoolClient, "query" | "release">;

type PointerLeaseRowV1 = {
  lease_owner: string;
  fencing_token: string | number | bigint;
  expires_at: string | Date;
  expired: boolean;
  kbs_raw_hourly_baseline_ref: string | null;
  kbs_raw_hourly_baseline_digest: string | null;
  kbs_raw_hourly_baseline_manifest_bytes: string | number | bigint | null;
  kbs_raw_hourly_baseline_latest_event_time: string | Date | null;
  kbs_raw_hourly_baseline_stored_at: string | Date | null;
  kbs_raw_hourly_baseline_writer_owner: string | null;
  kbs_raw_hourly_baseline_writer_fencing_token: string | number | bigint | null;
  kbs_raw_hourly_baseline_advanced_at: string | Date | null;
};

function textV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function isoV1(value: unknown, code: string): string {
  if (value instanceof Date) return value.toISOString();
  const text = textV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = isoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function digestV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new Error(code);
  return text;
}

function positiveIntegerV1(value: unknown, code: string): number {
  const number = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(code);
  return number;
}

function scopeValuesV1(scope: EvidenceRuntimeScopeV1): string[] {
  return SCOPE_KEYS.map((key) =>
    textV1(scope[key], "KBS_BASELINE_POINTER_SCOPE_" + key.toUpperCase() + "_REQUIRED")
  );
}

function sameScopeV1(a: EvidenceRuntimeScopeV1, b: EvidenceRuntimeScopeV1): boolean {
  return SCOPE_KEYS.every((key) => a[key] === b[key]);
}

function assertScopeV1(actual: EvidenceRuntimeScopeV1, expected: EvidenceRuntimeScopeV1): void {
  if (!sameScopeV1(actual, expected)) throw new Error("KBS_BASELINE_POINTER_EXACT_SIX_KEY_SCOPE_REQUIRED");
}

function baselineRefV1(value: unknown, digest: string): string {
  const ref = textV1(value, "KBS_BASELINE_POINTER_REF_REQUIRED");
  let parsed: URL;
  try { parsed = new URL(ref); } catch { throw new Error("KBS_BASELINE_POINTER_REF_INVALID"); }
  if (parsed.protocol !== "s3-private:" || !parsed.hostname) {
    throw new Error("KBS_BASELINE_POINTER_REF_PRIVATE_S3_REQUIRED");
  }
  const expectedSuffix =
    "/mcft-cap09-kbs-raw-hourly-publication-baseline-v1/sha256/" +
    digest.slice("sha256:".length);
  if (parsed.pathname !== expectedSuffix) {
    throw new Error("KBS_BASELINE_POINTER_REF_DIGEST_MISMATCH");
  }
  return ref;
}

function normalizeNextV1(
  input: KbsRawHourlyPublicationBaselinePointerNextV1,
): KbsRawHourlyPublicationBaselinePointerNextV1 {
  const digest = digestV1(input.baseline_digest, "KBS_BASELINE_POINTER_DIGEST_INVALID");
  return {
    baseline_ref: baselineRefV1(input.baseline_ref, digest),
    baseline_digest: digest,
    manifest_bytes: positiveIntegerV1(input.manifest_bytes, "KBS_BASELINE_POINTER_BYTES_INVALID"),
    latest_event_time: canonicalHourV1(input.latest_event_time, "KBS_BASELINE_POINTER_LATEST_EVENT_INVALID"),
    stored_at: isoV1(input.stored_at, "KBS_BASELINE_POINTER_STORED_AT_INVALID"),
  };
}

function pointerFromRowV1(
  scope: EvidenceRuntimeScopeV1,
  row: PointerLeaseRowV1,
): KbsRawHourlyPublicationBaselinePointerSnapshotV1 | null {
  const values = [
    row.kbs_raw_hourly_baseline_ref,
    row.kbs_raw_hourly_baseline_digest,
    row.kbs_raw_hourly_baseline_manifest_bytes,
    row.kbs_raw_hourly_baseline_latest_event_time,
    row.kbs_raw_hourly_baseline_stored_at,
    row.kbs_raw_hourly_baseline_writer_owner,
    row.kbs_raw_hourly_baseline_writer_fencing_token,
    row.kbs_raw_hourly_baseline_advanced_at,
  ];
  if (values.every((value) => value === null)) return null;
  if (values.some((value) => value === null)) {
    throw new Error("KBS_BASELINE_POINTER_PARTIAL_STORED_STATE_FORBIDDEN");
  }
  const digest = digestV1(
    row.kbs_raw_hourly_baseline_digest,
    "KBS_BASELINE_POINTER_STORED_DIGEST_INVALID",
  );
  const fence = BigInt(row.kbs_raw_hourly_baseline_writer_fencing_token!);
  if (fence <= 0n) throw new Error("KBS_BASELINE_POINTER_STORED_WRITER_FENCE_INVALID");
  return {
    pointer_contract_id: MCFT_CAP09_KBS_PUBLICATION_BASELINE_POINTER_CONTRACT_ID_V1,
    scope: { ...scope },
    baseline_ref: baselineRefV1(row.kbs_raw_hourly_baseline_ref, digest),
    baseline_digest: digest,
    manifest_bytes: positiveIntegerV1(
      row.kbs_raw_hourly_baseline_manifest_bytes,
      "KBS_BASELINE_POINTER_STORED_BYTES_INVALID",
    ),
    latest_event_time: canonicalHourV1(
      row.kbs_raw_hourly_baseline_latest_event_time,
      "KBS_BASELINE_POINTER_STORED_LATEST_EVENT_INVALID",
    ),
    stored_at: isoV1(
      row.kbs_raw_hourly_baseline_stored_at,
      "KBS_BASELINE_POINTER_STORED_AT_INVALID",
    ),
    writer_lease_owner: textV1(
      row.kbs_raw_hourly_baseline_writer_owner,
      "KBS_BASELINE_POINTER_STORED_WRITER_OWNER_INVALID",
    ),
    writer_fencing_token: fence,
    advanced_at: isoV1(
      row.kbs_raw_hourly_baseline_advanced_at,
      "KBS_BASELINE_POINTER_STORED_ADVANCED_AT_INVALID",
    ),
  };
}

function samePointerPayloadV1(
  current: KbsRawHourlyPublicationBaselinePointerSnapshotV1,
  next: KbsRawHourlyPublicationBaselinePointerNextV1,
): boolean {
  return current.baseline_ref === next.baseline_ref
    && current.baseline_digest === next.baseline_digest
    && current.manifest_bytes === next.manifest_bytes
    && current.latest_event_time === next.latest_event_time
    && current.stored_at === next.stored_at;
}

async function rollbackQuietlyV1(client: EvidenceClientV1): Promise<void> {
  try { await client.query("ROLLBACK"); } catch { /* preserve original failure */ }
}

async function selectPointerLeaseV1(
  clientOrPool: Pick<Pool, "query"> | Pick<PoolClient, "query">,
  scope: EvidenceRuntimeScopeV1,
  lock: boolean,
): Promise<PointerLeaseRowV1 | null> {
  const result = await clientOrPool.query<PointerLeaseRowV1>(
    `SELECT lease_owner,fencing_token,expires_at,
            expires_at<=transaction_timestamp() AS expired,
            kbs_raw_hourly_baseline_ref,kbs_raw_hourly_baseline_digest,
            kbs_raw_hourly_baseline_manifest_bytes,kbs_raw_hourly_baseline_latest_event_time,
            kbs_raw_hourly_baseline_stored_at,kbs_raw_hourly_baseline_writer_owner,
            kbs_raw_hourly_baseline_writer_fencing_token,kbs_raw_hourly_baseline_advanced_at
       FROM external_evidence_producer_lease_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
      ${lock ? "FOR UPDATE" : ""}`,
    scopeValuesV1(scope),
  );
  if (result.rows.length > 1) throw new Error("KBS_BASELINE_POINTER_LEASE_CARDINALITY_VIOLATION");
  return result.rows[0] ?? null;
}

export class PostgresKbsRawHourlyPublicationBaselinePointerReadV1
  implements KbsRawHourlyPublicationBaselinePointerReadPortV1 {
  readonly persistence_id = MCFT_CAP09_POSTGRES_KBS_PUBLICATION_BASELINE_POINTER_ID_V1;

  constructor(
    private readonly pool: EvidencePoolV1,
    private readonly configuredScope: EvidenceRuntimeScopeV1,
  ) {
    scopeValuesV1(configuredScope);
  }

  async readCurrentBaselinePointer(input: {
    scope: EvidenceRuntimeScopeV1;
  }): Promise<KbsRawHourlyPublicationBaselinePointerSnapshotV1 | null> {
    assertScopeV1(input.scope, this.configuredScope);
    const row = await selectPointerLeaseV1(this.pool, this.configuredScope, false);
    return row ? pointerFromRowV1(this.configuredScope, row) : null;
  }
}

export class PostgresKbsRawHourlyPublicationBaselinePointerV1
  implements KbsRawHourlyPublicationBaselinePointerPortV1 {
  readonly persistence_id = MCFT_CAP09_POSTGRES_KBS_PUBLICATION_BASELINE_POINTER_ID_V1;

  constructor(
    private readonly pool: EvidencePoolV1,
    private readonly configuredScope: EvidenceRuntimeScopeV1,
    private readonly producerClaim: EvidenceProducerLeaseClaimV1,
  ) {
    scopeValuesV1(configuredScope);
    assertScopeV1(producerClaim.scope, configuredScope);
    if (producerClaim.lease_contract_id !== MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1) {
      throw new Error("KBS_BASELINE_POINTER_LEASE_CONTRACT_INVALID");
    }
  }

  async readCurrentBaselinePointer(input: {
    scope: EvidenceRuntimeScopeV1;
  }): Promise<KbsRawHourlyPublicationBaselinePointerSnapshotV1 | null> {
    assertScopeV1(input.scope, this.configuredScope);
    const row = await selectPointerLeaseV1(this.pool, this.configuredScope, false);
    return row ? pointerFromRowV1(this.configuredScope, row) : null;
  }

  async advanceCurrentBaselinePointer(input: {
    claim: EvidenceProducerLeaseClaimV1;
    expected_previous_digest: string | null;
    next: KbsRawHourlyPublicationBaselinePointerNextV1;
  }): Promise<KbsRawHourlyPublicationBaselinePointerAdvanceResultV1> {
    assertScopeV1(input.claim.scope, this.configuredScope);
    if (
      input.claim.lease_contract_id !== MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1
      || input.claim.lease_owner !== this.producerClaim.lease_owner
      || input.claim.fencing_token !== this.producerClaim.fencing_token
    ) {
      throw new Error("KBS_BASELINE_POINTER_CLAIM_MISMATCH");
    }
    const next = normalizeNextV1(input.next);
    const expected = input.expected_previous_digest === null
      ? null
      : digestV1(input.expected_previous_digest, "KBS_BASELINE_POINTER_EXPECTED_DIGEST_INVALID");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const lease = await selectPointerLeaseV1(client, this.configuredScope, true);
      if (!lease) throw new Error("KBS_BASELINE_POINTER_CURRENT_LEASE_REQUIRED");
      if (
        lease.expired
        || lease.lease_owner !== this.producerClaim.lease_owner
        || BigInt(lease.fencing_token) !== this.producerClaim.fencing_token
      ) {
        throw new Error("KBS_BASELINE_POINTER_STALE_FENCE");
      }

      const current = pointerFromRowV1(this.configuredScope, lease);
      if (current && current.baseline_digest === next.baseline_digest) {
        if (!samePointerPayloadV1(current, next)) {
          throw new Error("KBS_BASELINE_POINTER_SAME_DIGEST_PAYLOAD_CONFLICT");
        }
        if (expected !== null && expected !== current.baseline_digest) {
          throw new Error("KBS_BASELINE_POINTER_EXPECTED_PREDECESSOR_MISMATCH");
        }
        await client.query("COMMIT");
        return { status: "EXISTING_IDEMPOTENT_SUCCESS", pointer: current };
      }

      if (!current) {
        if (expected !== null) {
          throw new Error("KBS_BASELINE_POINTER_INITIAL_EXPECTED_PREDECESSOR_MUST_BE_NULL");
        }
      } else {
        if (expected !== current.baseline_digest) {
          throw new Error("KBS_BASELINE_POINTER_EXPECTED_PREDECESSOR_MISMATCH");
        }
        if (Date.parse(next.latest_event_time) <= Date.parse(current.latest_event_time)) {
          throw new Error("KBS_BASELINE_POINTER_LATEST_EVENT_MUST_STRICTLY_ADVANCE");
        }
      }

      const params = [
        ...scopeValuesV1(this.configuredScope),
        this.producerClaim.lease_owner,
        this.producerClaim.fencing_token.toString(),
        next.baseline_ref,
        next.baseline_digest,
        next.manifest_bytes,
        next.latest_event_time,
        next.stored_at,
      ];
      const updated = await client.query<PointerLeaseRowV1>(
        `UPDATE external_evidence_producer_lease_v1
            SET kbs_raw_hourly_baseline_ref=$9,
                kbs_raw_hourly_baseline_digest=$10,
                kbs_raw_hourly_baseline_manifest_bytes=$11,
                kbs_raw_hourly_baseline_latest_event_time=$12::timestamptz,
                kbs_raw_hourly_baseline_stored_at=$13::timestamptz,
                kbs_raw_hourly_baseline_writer_owner=$7,
                kbs_raw_hourly_baseline_writer_fencing_token=$8,
                kbs_raw_hourly_baseline_advanced_at=transaction_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND lease_owner=$7 AND fencing_token=$8 AND expires_at>transaction_timestamp()
            AND (
              ($14::text IS NULL AND kbs_raw_hourly_baseline_digest IS NULL)
              OR kbs_raw_hourly_baseline_digest=$14
            )
        RETURNING lease_owner,fencing_token,expires_at,
                  expires_at<=transaction_timestamp() AS expired,
                  kbs_raw_hourly_baseline_ref,kbs_raw_hourly_baseline_digest,
                  kbs_raw_hourly_baseline_manifest_bytes,kbs_raw_hourly_baseline_latest_event_time,
                  kbs_raw_hourly_baseline_stored_at,kbs_raw_hourly_baseline_writer_owner,
                  kbs_raw_hourly_baseline_writer_fencing_token,kbs_raw_hourly_baseline_advanced_at`,
        [...params, current ? current.baseline_digest : null],
      );
      if (updated.rows.length !== 1) throw new Error("KBS_BASELINE_POINTER_COMPARE_AND_SET_FAILED");
      const pointer = pointerFromRowV1(this.configuredScope, updated.rows[0]);
      if (!pointer) throw new Error("KBS_BASELINE_POINTER_POST_UPDATE_REQUIRED");
      await client.query("COMMIT");
      return { status: "ADVANCED", pointer };
    } catch (error) {
      await rollbackQuietlyV1(client);
      throw error;
    } finally {
      client.release();
    }
  }
}
