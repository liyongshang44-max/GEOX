// PostgreSQL operational recovery for an expired MCFT-CAP-09.S3 active slot.
// Boundary: rebind one existing CLAIMED/RUNNING slot to a new lease owner and
// fencing token. No new cursor, slot, canonical fact, timer, route or action write.

import type { Pool, PoolClient } from "pg";
import type {
  ShadowOnlineSlotClaimV1,
  ShadowOnlineSlotIdV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const EXPIRED_SLOT_RECOVERY_CONFIG_V1 = {
  schema_version: "geox_mcft_cap09_expired_slot_recovery_config_v1",
  cursor_table: "twin_shadow_online_scheduler_cursor_v1",
  slot_table: "twin_shadow_online_scheduler_slot_v1",
  lease_table: "twin_runtime_lease_v1",
  recovery_policy: "EXPIRED_ACTIVE_SLOT_SAME_IDEMPOTENCY_NEW_FENCE_V1",
  active_states: ["CLAIMED", "RUNNING"] as const,
  canonical_write_allowed: false,
  background_daemon_allowed: false,
  production_wiring_allowed: false,
} as const;

export type ExpiredSlotRecoverySnapshotV1 = {
  scope: TwinScopeKeyV1;
  observed_at: string;
  durable_cursor_slot_id: ShadowOnlineSlotIdV1 | null;
  durable_cursor_logical_time: string | null;
  active_slot_id: ShadowOnlineSlotIdV1 | null;
  active_slot_logical_time: string | null;
  active_slot_state: "CLAIMED" | "RUNNING" | null;
  active_lease_owner: string | null;
  active_fencing_token: bigint | null;
  active_lease_expires_at: string | null;
  active_lease_expired: boolean;
  scheduler_lag_seconds: number;
};

export interface ExpiredSlotRecoveryPortV1 {
  inspectOperationalState(input: {
    scope: TwinScopeKeyV1;
    through_logical_time: string;
  }): Promise<ExpiredSlotRecoverySnapshotV1>;
  recoverExpiredActiveSlot(input: {
    scope: TwinScopeKeyV1;
    through_logical_time: string;
    lease_owner: string;
    lease_duration_seconds: number;
  }): Promise<ShadowOnlineSlotClaimV1 | null>;
}

type RecoveryClientV1 = Pick<PoolClient, "query" | "release">;
type RecoveryPoolV1 = Pick<Pool, "connect" | "query">;
const SCOPE_KEYS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;

type CursorRowV1 = {
  next_slot_id: string | null;
  next_logical_time: string | Date | null;
};
type ActiveRowV1 = {
  slot_id: string;
  logical_time: string | Date;
  scheduler_wall_clock_observed_at: string | Date;
  state: "CLAIMED" | "RUNNING";
  lease_owner: string;
  fencing_token: string | number | bigint;
  idempotency_key: string;
};
type LeaseRowV1 = {
  lease_owner: string;
  fencing_token: string | number | bigint;
  expires_at: string | Date;
  database_now: string | Date;
  expired: boolean;
};

function required(value: string, code: string): string {
  if (!String(value || "").trim()) throw new Error(code);
  return value;
}
function parseTime(value: string, code: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}
function iso(value: string | Date): string { return new Date(value).toISOString(); }
function scopeValues(scope: TwinScopeKeyV1): string[] {
  return SCOPE_KEYS.map((key) => required(scope[key], `RECOVERY_SCOPE_${key.toUpperCase()}_REQUIRED`));
}
function sameScope(a: TwinScopeKeyV1, b: TwinScopeKeyV1): boolean {
  return SCOPE_KEYS.every((key) => a[key] === b[key]);
}
function assertScope(actual: TwinScopeKeyV1, configured: TwinScopeKeyV1): void {
  if (!sameScope(actual, configured)) throw new Error("RECOVERY_EXACT_SIX_KEY_SCOPE_REQUIRED");
}
function slotId(value: string | null): ShadowOnlineSlotIdV1 | null {
  if (value === null) return null;
  if (!/^O(0[0-9]|1[0-9]|2[0-3])$/.test(value)) throw new Error("RECOVERY_SLOT_ID_INVALID");
  return value as ShadowOnlineSlotIdV1;
}
function validateLeaseDuration(value: number): void {
  if (!Number.isInteger(value) || value <= 0 || value > 3600) throw new Error("RECOVERY_LEASE_DURATION_INVALID");
}

export class PostgresExpiredSlotRecoveryAdapterV1 implements ExpiredSlotRecoveryPortV1 {
  constructor(private readonly pool: RecoveryPoolV1, private readonly scope: TwinScopeKeyV1) {
    scopeValues(scope);
  }

  private async cursor(client: RecoveryClientV1, lock: boolean): Promise<CursorRowV1 | null> {
    const result = await client.query<CursorRowV1>(
      `SELECT next_slot_id,next_logical_time
         FROM twin_shadow_online_scheduler_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ${lock ? "FOR UPDATE" : ""}`,
      scopeValues(this.scope),
    );
    if (result.rows.length > 1) throw new Error("RECOVERY_CURSOR_CARDINALITY_VIOLATION");
    return result.rows[0] ?? null;
  }

  private async active(client: RecoveryClientV1, lock: boolean): Promise<ActiveRowV1 | null> {
    const result = await client.query<ActiveRowV1>(
      `SELECT slot_id,logical_time,scheduler_wall_clock_observed_at,state,lease_owner,fencing_token,idempotency_key
         FROM twin_shadow_online_scheduler_slot_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
          AND state IN ('CLAIMED','RUNNING')
        ORDER BY logical_time ASC
        ${lock ? "FOR UPDATE" : ""}`,
      scopeValues(this.scope),
    );
    if (result.rows.length > 1) throw new Error("RECOVERY_MULTIPLE_ACTIVE_SLOTS");
    return result.rows[0] ?? null;
  }

  private async lease(client: RecoveryClientV1, lock: boolean): Promise<LeaseRowV1 | null> {
    const result = await client.query<LeaseRowV1>(
      `SELECT lease_owner,fencing_token,expires_at,transaction_timestamp() AS database_now,
              expires_at<=transaction_timestamp() AS expired
         FROM twin_runtime_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ${lock ? "FOR UPDATE" : ""}`,
      scopeValues(this.scope),
    );
    if (result.rows.length > 1) throw new Error("RECOVERY_LEASE_CARDINALITY_VIOLATION");
    return result.rows[0] ?? null;
  }

  async inspectOperationalState(input: {
    scope: TwinScopeKeyV1;
    through_logical_time: string;
  }): Promise<ExpiredSlotRecoverySnapshotV1> {
    assertScope(input.scope, this.scope);
    const throughMs = parseTime(input.through_logical_time, "RECOVERY_THROUGH_TIME_INVALID");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");
      const cursor = await this.cursor(client, false);
      const active = await this.active(client, false);
      const lease = active ? await this.lease(client, false) : null;
      const nowResult = await client.query<{ database_now: string | Date }>("SELECT transaction_timestamp() AS database_now");
      const databaseNow = iso(nowResult.rows[0].database_now);
      if (throughMs > Date.parse(databaseNow) + 300_000) throw new Error("RECOVERY_THROUGH_TIME_AHEAD_OF_DATABASE");
      if (active && !lease) throw new Error("ACTIVE_SLOT_LEASE_REQUIRED");
      if (active && lease && (active.lease_owner !== lease.lease_owner || BigInt(active.fencing_token) !== BigInt(lease.fencing_token))) {
        throw new Error("ACTIVE_SLOT_LEASE_BINDING_CORRUPT");
      }
      if (active && cursor && (active.slot_id !== cursor.next_slot_id || iso(active.logical_time) !== (cursor.next_logical_time ? iso(cursor.next_logical_time) : null))) {
        throw new Error("ACTIVE_SLOT_CURSOR_BINDING_CORRUPT");
      }
      const nextMs = cursor?.next_logical_time ? Date.parse(iso(cursor.next_logical_time)) : null;
      const lag = nextMs === null ? 0 : Math.max(0, Math.floor((throughMs - nextMs) / 1000));
      await client.query("COMMIT");
      return {
        scope: { ...this.scope },
        observed_at: databaseNow,
        durable_cursor_slot_id: slotId(cursor?.next_slot_id ?? null),
        durable_cursor_logical_time: cursor?.next_logical_time ? iso(cursor.next_logical_time) : null,
        active_slot_id: slotId(active?.slot_id ?? null),
        active_slot_logical_time: active ? iso(active.logical_time) : null,
        active_slot_state: active?.state ?? null,
        active_lease_owner: lease?.lease_owner ?? null,
        active_fencing_token: lease ? BigInt(lease.fencing_token) : null,
        active_lease_expires_at: lease ? iso(lease.expires_at) : null,
        active_lease_expired: active ? lease?.expired === true : false,
        scheduler_lag_seconds: lag,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async recoverExpiredActiveSlot(input: {
    scope: TwinScopeKeyV1;
    through_logical_time: string;
    lease_owner: string;
    lease_duration_seconds: number;
  }): Promise<ShadowOnlineSlotClaimV1 | null> {
    assertScope(input.scope, this.scope);
    const owner = required(input.lease_owner, "RECOVERY_LEASE_OWNER_REQUIRED");
    validateLeaseDuration(input.lease_duration_seconds);
    const throughMs = parseTime(input.through_logical_time, "RECOVERY_THROUGH_TIME_INVALID");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const cursor = await this.cursor(client, true);
      const active = await this.active(client, true);
      if (!active) { await client.query("COMMIT"); return null; }
      if (!cursor || active.slot_id !== cursor.next_slot_id || iso(active.logical_time) !== (cursor.next_logical_time ? iso(cursor.next_logical_time) : null)) {
        throw new Error("RECOVERY_ACTIVE_SLOT_CURSOR_MISMATCH");
      }
      if (Date.parse(iso(active.logical_time)) > throughMs) throw new Error("RECOVERY_FUTURE_ACTIVE_SLOT_REJECTED");
      const lease = await this.lease(client, true);
      if (!lease) throw new Error("ACTIVE_SLOT_LEASE_REQUIRED");
      if (active.lease_owner !== lease.lease_owner || BigInt(active.fencing_token) !== BigInt(lease.fencing_token)) {
        throw new Error("ACTIVE_SLOT_LEASE_BINDING_CORRUPT");
      }
      if (!lease.expired) {
        if (lease.lease_owner === owner) {
          await client.query("COMMIT");
          return {
            boundary: {
              scope: { ...this.scope },
              slot_id: slotId(active.slot_id)!,
              logical_time: iso(active.logical_time),
              scheduler_wall_clock_observed_at: iso(active.scheduler_wall_clock_observed_at),
              interval_seconds: 3600,
            },
            lease_owner: active.lease_owner,
            fencing_token: BigInt(active.fencing_token),
            state: "CLAIMED",
            idempotency_key: active.idempotency_key,
          };
        }
        await client.query("COMMIT");
        return null;
      }
      const rebound = await client.query<{ fencing_token: string | number | bigint; database_now: string | Date }>(
        `UPDATE twin_runtime_lease_v1
            SET lease_owner=$7,fencing_token=fencing_token+1,acquired_at=transaction_timestamp(),
                expires_at=transaction_timestamp()+make_interval(secs=>$8),heartbeat_at=transaction_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND lease_owner=$9 AND fencing_token=$10 AND expires_at<=transaction_timestamp()
        RETURNING fencing_token,transaction_timestamp() AS database_now`,
        [...scopeValues(this.scope), owner, input.lease_duration_seconds, lease.lease_owner, BigInt(lease.fencing_token).toString()],
      );
      if (rebound.rows.length !== 1) throw new Error("RECOVERY_LEASE_COMPARE_AND_SET_FAILED");
      const newFence = BigInt(rebound.rows[0].fencing_token);
      const databaseNow = iso(rebound.rows[0].database_now);
      const updated = await client.query(
        `UPDATE twin_shadow_online_scheduler_slot_v1
            SET state='CLAIMED',lease_owner=$7,fencing_token=$8,
                scheduler_wall_clock_observed_at=$9::timestamptz,updated_at=transaction_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND logical_time=$10::timestamptz AND lease_owner=$11 AND fencing_token=$12
            AND state IN ('CLAIMED','RUNNING')`,
        [...scopeValues(this.scope), owner, newFence.toString(), databaseNow, iso(active.logical_time), active.lease_owner, BigInt(active.fencing_token).toString()],
      );
      if (updated.rowCount !== 1) throw new Error("RECOVERY_SLOT_COMPARE_AND_SET_FAILED");
      await client.query("COMMIT");
      return {
        boundary: {
          scope: { ...this.scope },
          slot_id: slotId(active.slot_id)!,
          logical_time: iso(active.logical_time),
          scheduler_wall_clock_observed_at: databaseNow,
          interval_seconds: 3600,
        },
        lease_owner: owner,
        fencing_token: newFence,
        state: "CLAIMED",
        idempotency_key: active.idempotency_key,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
}
