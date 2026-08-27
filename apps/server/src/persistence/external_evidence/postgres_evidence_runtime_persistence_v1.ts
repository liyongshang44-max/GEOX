// MCFT-CAP-09 Production Hosting Phase 3: durable Evidence producer lease and supply cursor.
// Boundary: Evidence-plane operational persistence only. No provider fetch, raw-store access,
// Twin state, RuntimeTickCursor, timer loop, process lifecycle, environment, or production activation.

import type { Pool, PoolClient } from "pg";

import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type DurableEvidenceSupplyCursorPortV1,
  type EvidenceProducerLeaseClaimV1,
  type EvidenceProducerLeasePortV1,
  type EvidenceRuntimeScopeV1,
  type EvidenceSupplyCursorReadPortV1,
  type EvidenceSupplyCursorSnapshotV1,
} from "../../external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  MCFT_CAP09_EVIDENCE_SUPPLY_CURSOR_CONTRACT_ID_V1,
  type EvidenceSupplyCursorAdvanceInputV1,
  type EvidenceSupplyCursorAdvanceResultV1,
} from "../../external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.js";

import {
  evidenceSupplyCadenceProfileForBindingV1,
  evidenceSupplyEventTimeV1,
  summarizeEvidenceSupplyContinuityV1,
  type EvidenceSupplyContinuityEventV1,
} from "../../external_evidence/mcft_cap09_evidence_supply_cadence_profile_v1.js";

export const MCFT_CAP09_POSTGRES_EVIDENCE_RUNTIME_PERSISTENCE_ID_V1 =
  "MCFT_CAP09_POSTGRES_EVIDENCE_RUNTIME_PERSISTENCE_V1" as const;

const SCOPE_KEYS = [
  "tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id",
] as const;

type EvidencePoolV1 = Pick<Pool, "connect" | "query">;
type EvidenceClientV1 = Pick<PoolClient, "query" | "release">;

type LeaseRowV1 = {
  lease_owner: string;
  fencing_token: string | number | bigint;
  acquired_at: string | Date;
  expires_at: string | Date;
  heartbeat_at: string | Date;
  database_now: string | Date;
  expired: boolean;
};

type CursorRowV1 = {
  binding_id: string;
  origin_source_id: string;
  fact_id: string;
  record_semantic_sha256: string;
  available_to_runtime_at: string | Date;
  publication_available_through: string | Date;
  latest_event_time: string | Date;
  latest_source_record_id: string;
  event_time_contiguous_from: string | Date;
  event_time_contiguous_through: string | Date;
  event_time_max_seen: string | Date;
  event_gap_count: number;
  revision_count: number;
  publication_event_count: number;
  cadence_profile_id: string;
  role_time: Record<string, unknown>;
  post_commit_db_readback_at: string | Date;
  lease_owner: string;
  fencing_token: string | number | bigint;
  advanced_at: string | Date;
};

type EventRowV1 = {
  event_time: string | Date;
  source_record_id: string;
  fact_id: string;
  record_semantic_sha256: string;
  first_publication_available_at: string | Date;
  last_publication_available_at: string | Date;
  first_post_commit_db_readback_at: string | Date;
  last_post_commit_db_readback_at: string | Date;
  revision_count: number;
  publication_count: number;
};

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalIsoV1(value: unknown, code: string): string {
  if (value instanceof Date) return value.toISOString();
  const text = requiredTextV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return new Date(parsed).toISOString();
}

function leaseDurationV1(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) <= 0 || Number(value) > 3600) {
    throw new Error("PHASE3_EVIDENCE_LEASE_DURATION_INVALID");
  }
  return Number(value);
}

function scopeValuesV1(scope: EvidenceRuntimeScopeV1): string[] {
  return SCOPE_KEYS.map((key) => requiredTextV1(
    scope[key],
    `PHASE3_EVIDENCE_SCOPE_${key.toUpperCase()}_REQUIRED`,
  ));
}

function sameScopeV1(a: EvidenceRuntimeScopeV1, b: EvidenceRuntimeScopeV1): boolean {
  return SCOPE_KEYS.every((key) => a[key] === b[key]);
}

function assertScopeV1(actual: EvidenceRuntimeScopeV1, expected: EvidenceRuntimeScopeV1): void {
  if (!sameScopeV1(actual, expected)) throw new Error("PHASE3_EVIDENCE_EXACT_SIX_KEY_SCOPE_REQUIRED");
}

function claimFromRowV1(scope: EvidenceRuntimeScopeV1, row: LeaseRowV1): EvidenceProducerLeaseClaimV1 {
  const fence = BigInt(row.fencing_token);
  if (fence <= 0n) throw new Error("PHASE3_EVIDENCE_FENCING_TOKEN_INVALID");
  return {
    lease_contract_id: MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
    scope: { ...scope },
    lease_owner: requiredTextV1(row.lease_owner, "PHASE3_EVIDENCE_LEASE_OWNER_REQUIRED"),
    fencing_token: fence,
    acquired_at: canonicalIsoV1(row.acquired_at, "PHASE3_EVIDENCE_ACQUIRED_AT_INVALID"),
    expires_at: canonicalIsoV1(row.expires_at, "PHASE3_EVIDENCE_EXPIRES_AT_INVALID"),
    heartbeat_at: canonicalIsoV1(row.heartbeat_at, "PHASE3_EVIDENCE_HEARTBEAT_AT_INVALID"),
    database_now: canonicalIsoV1(row.database_now, "PHASE3_EVIDENCE_DATABASE_NOW_INVALID"),
  };
}

async function rollbackQuietlyV1(client: EvidenceClientV1): Promise<void> {
  try { await client.query("ROLLBACK"); } catch { /* preserve original failure */ }
}

export class PostgresEvidenceProducerLeaseV1 implements EvidenceProducerLeasePortV1 {
  readonly persistence_id = MCFT_CAP09_POSTGRES_EVIDENCE_RUNTIME_PERSISTENCE_ID_V1;

  constructor(
    private readonly pool: EvidencePoolV1,
    private readonly configuredScope: EvidenceRuntimeScopeV1,
  ) {
    scopeValuesV1(configuredScope);
  }

  private async selectLeaseV1(client: EvidenceClientV1, lock: boolean): Promise<LeaseRowV1 | null> {
    const result = await client.query<LeaseRowV1>(
      `SELECT lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at,
              transaction_timestamp() AS database_now,
              expires_at<=transaction_timestamp() AS expired
         FROM external_evidence_producer_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ${lock ? "FOR UPDATE" : ""}`,
      scopeValuesV1(this.configuredScope),
    );
    if (result.rows.length > 1) throw new Error("PHASE3_EVIDENCE_LEASE_CARDINALITY_VIOLATION");
    return result.rows[0] ?? null;
  }

  async acquireLease(input: {
    scope: EvidenceRuntimeScopeV1;
    lease_owner: string;
    lease_duration_seconds: number;
  }): Promise<EvidenceProducerLeaseClaimV1 | null> {
    assertScopeV1(input.scope, this.configuredScope);
    const owner = requiredTextV1(input.lease_owner, "PHASE3_EVIDENCE_LEASE_OWNER_REQUIRED");
    const duration = leaseDurationV1(input.lease_duration_seconds);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const current = await this.selectLeaseV1(client, true);

      let result;
      if (!current) {
        result = await client.query<LeaseRowV1>(
          `INSERT INTO external_evidence_producer_lease_v1
             (tenant_id,project_id,group_id,field_id,season_id,zone_id,
              lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,1,transaction_timestamp(),
                   transaction_timestamp()+make_interval(secs=>$8),transaction_timestamp())
           RETURNING lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at,
                     transaction_timestamp() AS database_now,false AS expired`,
          [...scopeValuesV1(this.configuredScope), owner, duration],
        );
      } else if (!current.expired && current.lease_owner !== owner) {
        await client.query("COMMIT");
        return null;
      } else if (!current.expired) {
        result = await client.query<LeaseRowV1>(
          `UPDATE external_evidence_producer_lease_v1
              SET expires_at=transaction_timestamp()+make_interval(secs=>$8),
                  heartbeat_at=transaction_timestamp()
            WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
              AND lease_owner=$7 AND fencing_token=$9 AND expires_at>transaction_timestamp()
          RETURNING lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at,
                    transaction_timestamp() AS database_now,false AS expired`,
          [...scopeValuesV1(this.configuredScope), owner, duration, BigInt(current.fencing_token).toString()],
        );
      } else {
        result = await client.query<LeaseRowV1>(
          `UPDATE external_evidence_producer_lease_v1
              SET lease_owner=$7,fencing_token=fencing_token+1,
                  acquired_at=transaction_timestamp(),
                  expires_at=transaction_timestamp()+make_interval(secs=>$8),
                  heartbeat_at=transaction_timestamp()
            WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
              AND lease_owner=$9 AND fencing_token=$10 AND expires_at<=transaction_timestamp()
          RETURNING lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at,
                    transaction_timestamp() AS database_now,false AS expired`,
          [
            ...scopeValuesV1(this.configuredScope),
            owner,
            duration,
            current.lease_owner,
            BigInt(current.fencing_token).toString(),
          ],
        );
      }

      if (result.rows.length !== 1) throw new Error("PHASE3_EVIDENCE_LEASE_COMPARE_AND_SET_FAILED");
      const claim = claimFromRowV1(this.configuredScope, result.rows[0]);
      await client.query("COMMIT");
      return claim;
    } catch (error) {
      await rollbackQuietlyV1(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async renewLease(input: {
    claim: EvidenceProducerLeaseClaimV1;
    lease_duration_seconds: number;
  }): Promise<EvidenceProducerLeaseClaimV1> {
    assertScopeV1(input.claim.scope, this.configuredScope);
    if (input.claim.lease_contract_id !== MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1) {
      throw new Error("PHASE3_EVIDENCE_LEASE_CONTRACT_ID_INVALID");
    }
    const duration = leaseDurationV1(input.lease_duration_seconds);
    const result = await this.pool.query<LeaseRowV1>(
      `UPDATE external_evidence_producer_lease_v1
          SET expires_at=transaction_timestamp()+make_interval(secs=>$9),
              heartbeat_at=transaction_timestamp()
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
          AND lease_owner=$7 AND fencing_token=$8 AND expires_at>transaction_timestamp()
      RETURNING lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at,
                transaction_timestamp() AS database_now,false AS expired`,
      [
        ...scopeValuesV1(this.configuredScope),
        requiredTextV1(input.claim.lease_owner, "PHASE3_EVIDENCE_LEASE_OWNER_REQUIRED"),
        input.claim.fencing_token.toString(),
        duration,
      ],
    );
    if (result.rows.length !== 1) throw new Error("PHASE3_EVIDENCE_LEASE_RENEW_STALE_FENCE");
    return claimFromRowV1(this.configuredScope, result.rows[0]);
  }

  async releaseLease(input: { claim: EvidenceProducerLeaseClaimV1 }): Promise<void> {
    assertScopeV1(input.claim.scope, this.configuredScope);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const current = await this.selectLeaseV1(client, true);
      if (!current
        || current.lease_owner !== input.claim.lease_owner
        || BigInt(current.fencing_token) !== input.claim.fencing_token) {
        throw new Error("PHASE3_EVIDENCE_LEASE_RELEASE_STALE_FENCE");
      }
      if (!current.expired) {
        const released = await client.query(
          `UPDATE external_evidence_producer_lease_v1
              SET expires_at=GREATEST(transaction_timestamp(),acquired_at+interval '1 microsecond'),
                  heartbeat_at=transaction_timestamp()
            WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
              AND lease_owner=$7 AND fencing_token=$8`,
          [
            ...scopeValuesV1(this.configuredScope),
            input.claim.lease_owner,
            input.claim.fencing_token.toString(),
          ],
        );
        if (released.rowCount !== 1) throw new Error("PHASE3_EVIDENCE_LEASE_RELEASE_COMPARE_AND_SET_FAILED");
      }
      await client.query("COMMIT");
    } catch (error) {
      await rollbackQuietlyV1(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

export class PostgresEvidenceSupplyCursorV1 implements DurableEvidenceSupplyCursorPortV1 {
  readonly persistence_id = MCFT_CAP09_POSTGRES_EVIDENCE_RUNTIME_PERSISTENCE_ID_V1;

  constructor(
    private readonly pool: EvidencePoolV1,
    private readonly configuredScope: EvidenceRuntimeScopeV1,
    private readonly producerClaim: EvidenceProducerLeaseClaimV1,
  ) {
    scopeValuesV1(configuredScope);
    assertScopeV1(producerClaim.scope, configuredScope);
    if (producerClaim.lease_contract_id !== MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1) {
      throw new Error("PHASE3_EVIDENCE_CURSOR_LEASE_CONTRACT_INVALID");
    }
  }

  private async assertCurrentLeaseV1(client: EvidenceClientV1): Promise<void> {
    const result = await client.query<{
      lease_owner: string;
      fencing_token: string | number | bigint;
      expired: boolean;
    }>(
      "SELECT lease_owner,fencing_token,expires_at<=transaction_timestamp() AS expired " +
      "FROM external_evidence_producer_lease_v1 " +
      "WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 " +
      "FOR UPDATE",
      scopeValuesV1(this.configuredScope),
    );
    if (result.rows.length !== 1) throw new Error("PHASE3_EVIDENCE_CURSOR_CURRENT_LEASE_REQUIRED");
    const row = result.rows[0];
    if (row.expired
      || row.lease_owner !== this.producerClaim.lease_owner
      || BigInt(row.fencing_token) !== this.producerClaim.fencing_token) {
      throw new Error("PHASE3_EVIDENCE_CURSOR_STALE_FENCE");
    }
  }

  private async selectCursorV1(
    client: EvidenceClientV1,
    bindingId: string,
    originSourceId: string,
    lock: boolean,
  ): Promise<CursorRowV1 | null> {
    const result = await client.query<CursorRowV1>(
      "SELECT binding_id,origin_source_id,fact_id,record_semantic_sha256," +
      "available_to_runtime_at,publication_available_through,latest_event_time,latest_source_record_id," +
      "event_time_contiguous_from,event_time_contiguous_through,event_time_max_seen,event_gap_count," +
      "revision_count,publication_event_count,cadence_profile_id,role_time,post_commit_db_readback_at," +
      "lease_owner,fencing_token,advanced_at " +
      "FROM external_evidence_supply_cursor_v1 " +
      "WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 " +
      "AND binding_id=$7 AND origin_source_id=$8 " +
      (lock ? "FOR UPDATE" : ""),
      [...scopeValuesV1(this.configuredScope), bindingId, originSourceId],
    );
    if (result.rows.length > 1) throw new Error("PHASE3_EVIDENCE_CURSOR_CARDINALITY_VIOLATION");
    return result.rows[0] ?? null;
  }

  private async selectEventV1(
    client: EvidenceClientV1,
    bindingId: string,
    originSourceId: string,
    eventTime: string,
  ): Promise<EventRowV1 | null> {
    const result = await client.query<EventRowV1>(
      "SELECT event_time,source_record_id,fact_id,record_semantic_sha256," +
      "first_publication_available_at,last_publication_available_at," +
      "first_post_commit_db_readback_at,last_post_commit_db_readback_at," +
      "revision_count,publication_count " +
      "FROM external_evidence_supply_event_v1 " +
      "WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 " +
      "AND binding_id=$7 AND origin_source_id=$8 AND event_time=$9::timestamptz FOR UPDATE",
      [...scopeValuesV1(this.configuredScope), bindingId, originSourceId, eventTime],
    );
    if (result.rows.length > 1) throw new Error("PHASE3_EVIDENCE_EVENT_CARDINALITY_VIOLATION");
    return result.rows[0] ?? null;
  }

  private async continuityEventsV1(
    client: EvidenceClientV1,
    bindingId: string,
    originSourceId: string,
  ): Promise<EvidenceSupplyContinuityEventV1[]> {
    const result = await client.query<{
      event_time: string | Date;
      last_publication_available_at: string | Date;
      revision_count: number;
      publication_count: number;
    }>(
      "SELECT event_time,last_publication_available_at,revision_count,publication_count " +
      "FROM external_evidence_supply_event_v1 " +
      "WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 " +
      "AND binding_id=$7 AND origin_source_id=$8 ORDER BY event_time ASC",
      [...scopeValuesV1(this.configuredScope), bindingId, originSourceId],
    );
    return result.rows.map((row) => ({
      event_time: canonicalIsoV1(row.event_time, "PHASE3_EVIDENCE_EVENT_STORED_EVENT_TIME_INVALID"),
      publication_available_at: canonicalIsoV1(
        row.last_publication_available_at,
        "PHASE3_EVIDENCE_EVENT_STORED_PUBLICATION_TIME_INVALID",
      ),
      revision_count: Number(row.revision_count),
      publication_count: Number(row.publication_count),
    }));
  }

  async advanceAfterVisibleEvidence(
    input: EvidenceSupplyCursorAdvanceInputV1,
  ): Promise<EvidenceSupplyCursorAdvanceResultV1> {
    if (input.cursor_contract_id !== MCFT_CAP09_EVIDENCE_SUPPLY_CURSOR_CONTRACT_ID_V1) {
      throw new Error("PHASE3_EVIDENCE_CURSOR_CONTRACT_ID_INVALID");
    }
    const bindingId = requiredTextV1(input.binding_id, "PHASE3_EVIDENCE_CURSOR_BINDING_ID_REQUIRED");
    const originSourceId = requiredTextV1(input.origin_source_id, "PHASE3_EVIDENCE_CURSOR_ORIGIN_SOURCE_ID_REQUIRED");
    const factId = requiredTextV1(input.visible_evidence.fact_id, "PHASE3_EVIDENCE_CURSOR_FACT_ID_REQUIRED");
    const semantic = requiredTextV1(
      input.visible_evidence.record_semantic_sha256,
      "PHASE3_EVIDENCE_CURSOR_SEMANTIC_HASH_REQUIRED",
    );
    const sourceRecordId = requiredTextV1(
      input.visible_evidence.source_record_id,
      "PHASE3_EVIDENCE_CURSOR_SOURCE_RECORD_ID_REQUIRED",
    );
    const availableAt = canonicalIsoV1(
      input.available_to_runtime_at,
      "PHASE3_EVIDENCE_CURSOR_AVAILABLE_AT_INVALID",
    );
    const readbackAt = canonicalIsoV1(
      input.visible_evidence.post_commit_db_readback_at,
      "PHASE3_EVIDENCE_CURSOR_READBACK_AT_INVALID",
    );
    if (!input.role_time || typeof input.role_time !== "object" || Array.isArray(input.role_time)) {
      throw new Error("PHASE3_EVIDENCE_CURSOR_ROLE_TIME_OBJECT_REQUIRED");
    }
    const eventTime = evidenceSupplyEventTimeV1({
      record_type: input.visible_evidence.record_type,
      role_time: input.role_time,
    });
    const profile = evidenceSupplyCadenceProfileForBindingV1(bindingId);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await this.assertCurrentLeaseV1(client);
      await this.selectCursorV1(client, bindingId, originSourceId, true);
      const currentEvent = await this.selectEventV1(client, bindingId, originSourceId, eventTime);

      let exactIdempotent = false;
      if (!currentEvent) {
        const inserted = await client.query(
          "INSERT INTO external_evidence_supply_event_v1 (" +
          "tenant_id,project_id,group_id,field_id,season_id,zone_id,binding_id,origin_source_id,event_time," +
          "source_record_id,fact_id,record_semantic_sha256,first_publication_available_at,last_publication_available_at," +
          "first_post_commit_db_readback_at,last_post_commit_db_readback_at,revision_count,publication_count," +
          "lease_owner,fencing_token,updated_at) " +
          "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11,$12,$13::timestamptz,$13::timestamptz," +
          "$14::timestamptz,$14::timestamptz,0,1,$15,$16,transaction_timestamp())",
          [
            ...scopeValuesV1(this.configuredScope),
            bindingId,
            originSourceId,
            eventTime,
            sourceRecordId,
            factId,
            semantic,
            availableAt,
            readbackAt,
            this.producerClaim.lease_owner,
            this.producerClaim.fencing_token.toString(),
          ],
        );
        if (inserted.rowCount !== 1) throw new Error("PHASE3_EVIDENCE_EVENT_INSERT_FAILED");
      } else {
        const currentAvailableAt = canonicalIsoV1(
          currentEvent.last_publication_available_at,
          "PHASE3_EVIDENCE_EVENT_STORED_PUBLICATION_TIME_INVALID",
        );
        const sameSemantic =
          currentEvent.fact_id === factId
          && currentEvent.record_semantic_sha256 === semantic
          && currentEvent.source_record_id === sourceRecordId;

        if (sameSemantic && Date.parse(availableAt) <= Date.parse(currentAvailableAt)) {
          exactIdempotent = true;
        } else if (sameSemantic) {
          const updated = await client.query(
            "UPDATE external_evidence_supply_event_v1 SET " +
            "last_publication_available_at=$10::timestamptz,last_post_commit_db_readback_at=$11::timestamptz," +
            "publication_count=publication_count+1,lease_owner=$12,fencing_token=$13,updated_at=transaction_timestamp() " +
            "WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 " +
            "AND binding_id=$7 AND origin_source_id=$8 AND event_time=$9::timestamptz",
            [
              ...scopeValuesV1(this.configuredScope),
              bindingId,
              originSourceId,
              eventTime,
              availableAt,
              readbackAt,
              this.producerClaim.lease_owner,
              this.producerClaim.fencing_token.toString(),
            ],
          );
          if (updated.rowCount !== 1) throw new Error("PHASE3_EVIDENCE_EVENT_REPUBLICATION_UPDATE_FAILED");
        } else {
          if (Date.parse(availableAt) <= Date.parse(currentAvailableAt)) {
            throw new Error("PHASE3_EVIDENCE_EVENT_REVISION_PUBLICATION_ORDER_AMBIGUOUS");
          }
          const updated = await client.query(
            "UPDATE external_evidence_supply_event_v1 SET " +
            "source_record_id=$10,fact_id=$11,record_semantic_sha256=$12," +
            "last_publication_available_at=$13::timestamptz,last_post_commit_db_readback_at=$14::timestamptz," +
            "revision_count=revision_count+1,publication_count=publication_count+1," +
            "lease_owner=$15,fencing_token=$16,updated_at=transaction_timestamp() " +
            "WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 " +
            "AND binding_id=$7 AND origin_source_id=$8 AND event_time=$9::timestamptz",
            [
              ...scopeValuesV1(this.configuredScope),
              bindingId,
              originSourceId,
              eventTime,
              sourceRecordId,
              factId,
              semantic,
              availableAt,
              readbackAt,
              this.producerClaim.lease_owner,
              this.producerClaim.fencing_token.toString(),
            ],
          );
          if (updated.rowCount !== 1) throw new Error("PHASE3_EVIDENCE_EVENT_REVISION_UPDATE_FAILED");
        }
      }

      const events = await this.continuityEventsV1(client, bindingId, originSourceId);
      const summary = summarizeEvidenceSupplyContinuityV1(events, profile);

      if (!exactIdempotent) {
        const upsert = await client.query(
          "INSERT INTO external_evidence_supply_cursor_v1 (" +
          "tenant_id,project_id,group_id,field_id,season_id,zone_id,binding_id,origin_source_id," +
          "fact_id,record_semantic_sha256,available_to_runtime_at,publication_available_through," +
          "latest_event_time,latest_source_record_id,event_time_contiguous_from,event_time_contiguous_through," +
          "event_time_max_seen,event_gap_count,revision_count,publication_event_count,cadence_profile_id," +
          "role_time,post_commit_db_readback_at,lease_owner,fencing_token,advanced_at) " +
          "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,$12::timestamptz,$13::timestamptz,$14," +
          "$15::timestamptz,$16::timestamptz,$17::timestamptz,$18,$19,$20,$21,$22::jsonb,$23::timestamptz,$24,$25,transaction_timestamp()) " +
          "ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id,binding_id,origin_source_id) DO UPDATE SET " +
          "fact_id=EXCLUDED.fact_id,record_semantic_sha256=EXCLUDED.record_semantic_sha256," +
          "available_to_runtime_at=EXCLUDED.available_to_runtime_at," +
          "publication_available_through=EXCLUDED.publication_available_through," +
          "latest_event_time=EXCLUDED.latest_event_time,latest_source_record_id=EXCLUDED.latest_source_record_id," +
          "event_time_contiguous_from=EXCLUDED.event_time_contiguous_from," +
          "event_time_contiguous_through=EXCLUDED.event_time_contiguous_through," +
          "event_time_max_seen=EXCLUDED.event_time_max_seen,event_gap_count=EXCLUDED.event_gap_count," +
          "revision_count=EXCLUDED.revision_count,publication_event_count=EXCLUDED.publication_event_count," +
          "cadence_profile_id=EXCLUDED.cadence_profile_id,role_time=EXCLUDED.role_time," +
          "post_commit_db_readback_at=EXCLUDED.post_commit_db_readback_at," +
          "lease_owner=EXCLUDED.lease_owner,fencing_token=EXCLUDED.fencing_token,advanced_at=transaction_timestamp()",
          [
            ...scopeValuesV1(this.configuredScope),
            bindingId,
            originSourceId,
            factId,
            semantic,
            availableAt,
            summary.publication_available_through,
            eventTime,
            sourceRecordId,
            summary.event_time_contiguous_from,
            summary.event_time_contiguous_through,
            summary.event_time_max_seen,
            summary.event_gap_count,
            summary.revision_count,
            summary.publication_event_count,
            summary.cadence_profile_id,
            JSON.stringify(input.role_time),
            readbackAt,
            this.producerClaim.lease_owner,
            this.producerClaim.fencing_token.toString(),
          ],
        );
        if (upsert.rowCount !== 1) throw new Error("PHASE3_EVIDENCE_CURSOR_UPSERT_FAILED");
      }

      await client.query("COMMIT");
      return {
        status: exactIdempotent ? "EXISTING_IDEMPOTENT_SUCCESS" : "ADVANCED",
        fact_id: factId,
        record_semantic_sha256: semantic,
      };
    } catch (error) {
      await rollbackQuietlyV1(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async readSupplyCursor(input: {
    scope: EvidenceRuntimeScopeV1;
    binding_id: string;
    origin_source_id: string;
  }): Promise<EvidenceSupplyCursorSnapshotV1 | null> {
    assertScopeV1(input.scope, this.configuredScope);
    const bindingId = requiredTextV1(input.binding_id, "PHASE3_EVIDENCE_CURSOR_BINDING_ID_REQUIRED");
    const originSourceId = requiredTextV1(input.origin_source_id, "PHASE3_EVIDENCE_CURSOR_ORIGIN_SOURCE_ID_REQUIRED");
    const result = await this.pool.query<CursorRowV1>(
      "SELECT binding_id,origin_source_id,fact_id,record_semantic_sha256," +
      "available_to_runtime_at,publication_available_through,latest_event_time,latest_source_record_id," +
      "event_time_contiguous_from,event_time_contiguous_through,event_time_max_seen,event_gap_count," +
      "revision_count,publication_event_count,cadence_profile_id,role_time,post_commit_db_readback_at," +
      "lease_owner,fencing_token,advanced_at " +
      "FROM external_evidence_supply_cursor_v1 " +
      "WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 " +
      "AND binding_id=$7 AND origin_source_id=$8",
      [...scopeValuesV1(this.configuredScope), bindingId, originSourceId],
    );
    if (result.rows.length > 1) throw new Error("PHASE3_EVIDENCE_CURSOR_CARDINALITY_VIOLATION");
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      scope: { ...this.configuredScope },
      binding_id: row.binding_id,
      origin_source_id: row.origin_source_id,
      fact_id: row.fact_id,
      record_semantic_sha256: row.record_semantic_sha256,
      available_to_runtime_at: canonicalIsoV1(row.available_to_runtime_at, "PHASE3_EVIDENCE_CURSOR_STORED_AVAILABLE_AT_INVALID"),
      publication_available_through: canonicalIsoV1(row.publication_available_through, "PHASE3_EVIDENCE_CURSOR_STORED_PUBLICATION_WATERMARK_INVALID"),
      latest_event_time: canonicalIsoV1(row.latest_event_time, "PHASE3_EVIDENCE_CURSOR_STORED_LATEST_EVENT_TIME_INVALID"),
      latest_source_record_id: row.latest_source_record_id,
      event_time_contiguous_from: canonicalIsoV1(row.event_time_contiguous_from, "PHASE3_EVIDENCE_CURSOR_STORED_CONTIGUOUS_FROM_INVALID"),
      event_time_contiguous_through: canonicalIsoV1(row.event_time_contiguous_through, "PHASE3_EVIDENCE_CURSOR_STORED_CONTIGUOUS_THROUGH_INVALID"),
      event_time_max_seen: canonicalIsoV1(row.event_time_max_seen, "PHASE3_EVIDENCE_CURSOR_STORED_EVENT_MAX_INVALID"),
      event_gap_count: Number(row.event_gap_count),
      revision_count: Number(row.revision_count),
      publication_event_count: Number(row.publication_event_count),
      cadence_profile_id: row.cadence_profile_id,
      role_time: structuredClone(row.role_time),
      post_commit_db_readback_at: canonicalIsoV1(row.post_commit_db_readback_at, "PHASE3_EVIDENCE_CURSOR_STORED_READBACK_AT_INVALID"),
      lease_owner: row.lease_owner,
      fencing_token: BigInt(row.fencing_token),
      advanced_at: canonicalIsoV1(row.advanced_at, "PHASE3_EVIDENCE_CURSOR_ADVANCED_AT_INVALID"),
    };
  }
}

export class PostgresEvidenceSupplyCursorReadV1
implements EvidenceSupplyCursorReadPortV1 {
  readonly persistence_id = MCFT_CAP09_POSTGRES_EVIDENCE_RUNTIME_PERSISTENCE_ID_V1;

  constructor(
    private readonly pool: EvidencePoolV1,
    private readonly configuredScope: EvidenceRuntimeScopeV1,
  ) {
    scopeValuesV1(configuredScope);
  }

  async readSupplyCursor(input: {
    scope: EvidenceRuntimeScopeV1;
    binding_id: string;
    origin_source_id: string;
  }): Promise<EvidenceSupplyCursorSnapshotV1 | null> {
    assertScopeV1(input.scope, this.configuredScope);
    const bindingId = requiredTextV1(input.binding_id, "PHASE3_EVIDENCE_CURSOR_BINDING_ID_REQUIRED");
    const originSourceId = requiredTextV1(input.origin_source_id, "PHASE3_EVIDENCE_CURSOR_ORIGIN_SOURCE_ID_REQUIRED");
    const result = await this.pool.query<CursorRowV1>(
      "SELECT binding_id,origin_source_id,fact_id,record_semantic_sha256," +
      "available_to_runtime_at,publication_available_through,latest_event_time,latest_source_record_id," +
      "event_time_contiguous_from,event_time_contiguous_through,event_time_max_seen,event_gap_count," +
      "revision_count,publication_event_count,cadence_profile_id,role_time,post_commit_db_readback_at," +
      "lease_owner,fencing_token,advanced_at " +
      "FROM external_evidence_supply_cursor_v1 " +
      "WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 " +
      "AND binding_id=$7 AND origin_source_id=$8",
      [...scopeValuesV1(this.configuredScope), bindingId, originSourceId],
    );
    if (result.rows.length > 1) throw new Error("PHASE3_EVIDENCE_CURSOR_CARDINALITY_VIOLATION");
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      scope: { ...this.configuredScope },
      binding_id: row.binding_id,
      origin_source_id: row.origin_source_id,
      fact_id: row.fact_id,
      record_semantic_sha256: row.record_semantic_sha256,
      available_to_runtime_at: canonicalIsoV1(row.available_to_runtime_at, "PHASE3_EVIDENCE_CURSOR_STORED_AVAILABLE_AT_INVALID"),
      publication_available_through: canonicalIsoV1(row.publication_available_through, "PHASE3_EVIDENCE_CURSOR_STORED_PUBLICATION_WATERMARK_INVALID"),
      latest_event_time: canonicalIsoV1(row.latest_event_time, "PHASE3_EVIDENCE_CURSOR_STORED_LATEST_EVENT_TIME_INVALID"),
      latest_source_record_id: row.latest_source_record_id,
      event_time_contiguous_from: canonicalIsoV1(row.event_time_contiguous_from, "PHASE3_EVIDENCE_CURSOR_STORED_CONTIGUOUS_FROM_INVALID"),
      event_time_contiguous_through: canonicalIsoV1(row.event_time_contiguous_through, "PHASE3_EVIDENCE_CURSOR_STORED_CONTIGUOUS_THROUGH_INVALID"),
      event_time_max_seen: canonicalIsoV1(row.event_time_max_seen, "PHASE3_EVIDENCE_CURSOR_STORED_EVENT_MAX_INVALID"),
      event_gap_count: Number(row.event_gap_count),
      revision_count: Number(row.revision_count),
      publication_event_count: Number(row.publication_event_count),
      cadence_profile_id: row.cadence_profile_id,
      role_time: structuredClone(row.role_time),
      post_commit_db_readback_at: canonicalIsoV1(row.post_commit_db_readback_at, "PHASE3_EVIDENCE_CURSOR_STORED_READBACK_AT_INVALID"),
      lease_owner: row.lease_owner,
      fencing_token: BigInt(row.fencing_token),
      advanced_at: canonicalIsoV1(row.advanced_at, "PHASE3_EVIDENCE_CURSOR_ADVANCED_AT_INVALID"),
    };
  }
}
