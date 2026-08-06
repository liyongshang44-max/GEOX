// PostgreSQL-backed MCFT-CAP-09.S3 ClockPort and SchedulerPort implementation.
// Boundary: one configured six-key scope, one bounded O00-O23 schedule, mutable
// operational cursor/slot ledger and the existing lease/fencing relation only.
// No daemon, timer loop, route, canonical fact, Runtime transaction or action write.

import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";

import type {
  ClockPortV1,
  SchedulerPortV1,
  ShadowOnlineBoundaryV1,
  ShadowOnlineSlotClaimV1,
  ShadowOnlineSlotIdV1,
  ShadowOnlineTerminalSlotResultV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const PERSISTENT_SEQUENTIAL_SCHEDULER_CONFIG_V1 = {
  schema_version: "geox_mcft_cap09_persistent_sequential_scheduler_config_v1",
  scheduler_contract: "SCHEDULER_PORT_V1",
  clock_contract: "CLOCK_PORT_V1",
  execution_model: "PERSISTENT_SINGLE_SCOPE_SEQUENTIAL",
  slot_ids: [
    "O00", "O01", "O02", "O03", "O04", "O05",
    "O06", "O07", "O08", "O09", "O10", "O11",
    "O12", "O13", "O14", "O15", "O16", "O17",
    "O18", "O19", "O20", "O21", "O22", "O23",
  ] as readonly ShadowOnlineSlotIdV1[],
  slot_interval_seconds: 3600 as const,
  slot_count: 24 as const,
  clock_source: "SCHEDULER_PROVIDED_UTC_WALL_CLOCK",
  formal_clock_mode: "SYSTEM_UTC_WALL_CLOCK",
  accelerated_formal_clock_allowed: false,
  future_boundary_claim_allowed: false,
  durable_cursor_table: "twin_shadow_online_scheduler_cursor_v1",
  slot_ledger_table: "twin_shadow_online_scheduler_slot_v1",
  lease_table: "twin_runtime_lease_v1",
  maximum_active_slots_per_scope: 1,
  maximum_running_slots_per_scope: 1,
  missed_slot_order: "OLDEST_ELIGIBLE_FIRST",
  duplicate_active_claim_policy: "IDEMPOTENT_SAME_OWNER_SAME_FENCE",
  terminal_success_implicit_retry_allowed: false,
  canonical_write_allowed: false,
  production_wiring_allowed: false,
  background_daemon_allowed: false,
} as const;

export type PersistentSequentialSchedulerConfigV1 = {
  scope: TwinScopeKeyV1;
  schedule_start_logical_time: string;
  slot_ids?: readonly ShadowOnlineSlotIdV1[];
  slot_interval_seconds?: 3600;
};

type SchedulerConfigResolvedV1 = {
  scope: TwinScopeKeyV1;
  schedule_start_ms: number;
  schedule_start_logical_time: string;
  slot_ids: readonly ShadowOnlineSlotIdV1[];
  slot_interval_seconds: 3600;
};

type SchedulerClientV1 = Pick<PoolClient, "query" | "release">;
type SchedulerPoolV1 = Pick<Pool, "connect" | "query">;

type CursorRowV1 = {
  schedule_start_logical_time: string | Date;
  next_slot_index: number;
  next_slot_id: string | null;
  next_logical_time: string | Date | null;
  last_fencing_token: string | number | bigint | null;
};

type SlotRowV1 = {
  slot_id: string;
  logical_time: string | Date;
  scheduler_wall_clock_observed_at: string | Date;
  interval_seconds: number;
  state: "CLAIMED" | "RUNNING" | "COMPLETED" | "DEGRADED" | "FAILED";
  lease_owner: string;
  fencing_token: string | number | bigint;
  idempotency_key: string;
  tick_ref: string | null;
  health_ref: string | null;
  terminal_at: string | Date | null;
};

const SCOPE_KEYS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;
const HOUR_MS = 3_600_000;

function requiredText(value: string, code: string): string {
  if (!String(value || "").trim()) throw new Error(code);
  return value;
}

function parseTime(value: string, code: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

function iso(value: string | Date): string {
  return new Date(value).toISOString();
}

function scopeValues(scope: TwinScopeKeyV1): string[] {
  return SCOPE_KEYS.map((key) => requiredText(scope[key], `SCHEDULER_SCOPE_${key.toUpperCase()}_REQUIRED`));
}

function sameScope(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return SCOPE_KEYS.every((key) => left[key] === right[key]);
}

function assertScope(actual: TwinScopeKeyV1, expected: TwinScopeKeyV1): void {
  if (!sameScope(actual, expected)) throw new Error("SCHEDULER_EXACT_SIX_KEY_SCOPE_REQUIRED");
}

function resolveConfig(config: PersistentSequentialSchedulerConfigV1): SchedulerConfigResolvedV1 {
  scopeValues(config.scope);
  const startMs = parseTime(config.schedule_start_logical_time, "SCHEDULE_START_LOGICAL_TIME_INVALID");
  if (startMs % HOUR_MS !== 0) throw new Error("SCHEDULE_START_EXACT_UTC_HOURLY_BOUNDARY_REQUIRED");
  const slotIds = config.slot_ids ?? PERSISTENT_SEQUENTIAL_SCHEDULER_CONFIG_V1.slot_ids;
  if (slotIds.length !== 24 || new Set(slotIds).size !== 24) throw new Error("EXACT_O00_O23_SLOT_SET_REQUIRED");
  for (let index = 0; index < slotIds.length; index += 1) {
    if (slotIds[index] !== `O${String(index).padStart(2, "0")}`) throw new Error("ORDERED_O00_O23_SLOT_SET_REQUIRED");
  }
  if ((config.slot_interval_seconds ?? 3600) !== 3600) throw new Error("PT1H_SLOT_INTERVAL_REQUIRED");
  return {
    scope: { ...config.scope },
    schedule_start_ms: startMs,
    schedule_start_logical_time: new Date(startMs).toISOString(),
    slot_ids: [...slotIds],
    slot_interval_seconds: 3600,
  };
}

function logicalTimeFor(config: SchedulerConfigResolvedV1, index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= config.slot_ids.length) throw new Error("SLOT_INDEX_OUT_OF_RANGE");
  return new Date(config.schedule_start_ms + index * HOUR_MS).toISOString();
}

function indexForBoundary(config: SchedulerConfigResolvedV1, boundary: ShadowOnlineBoundaryV1): number {
  assertScope(boundary.scope, config.scope);
  if (boundary.interval_seconds !== 3600) throw new Error("PT1H_BOUNDARY_REQUIRED");
  const logicalMs = parseTime(boundary.logical_time, "BOUNDARY_LOGICAL_TIME_INVALID");
  const observedMs = parseTime(boundary.scheduler_wall_clock_observed_at, "SCHEDULER_WALL_CLOCK_INVALID");
  if (logicalMs % HOUR_MS !== 0) throw new Error("EXACT_UTC_HOURLY_BOUNDARY_REQUIRED");
  if (logicalMs > observedMs) throw new Error("FUTURE_BOUNDARY_CLAIM_REJECTED");
  const delta = logicalMs - config.schedule_start_ms;
  if (delta < 0 || delta % HOUR_MS !== 0) throw new Error("BOUNDARY_OUTSIDE_CONFIGURED_SCHEDULE");
  const index = delta / HOUR_MS;
  if (index >= config.slot_ids.length) throw new Error("BOUNDARY_OUTSIDE_CONFIGURED_SCHEDULE");
  if (config.slot_ids[index] !== boundary.slot_id) throw new Error("BOUNDARY_SLOT_ID_LOGICAL_TIME_MISMATCH");
  return index;
}

function idempotencyKey(scope: TwinScopeKeyV1, boundary: ShadowOnlineBoundaryV1): string {
  const seed = JSON.stringify({ scope, slot_id: boundary.slot_id, logical_time: new Date(boundary.logical_time).toISOString() });
  return `shadow-slot:${crypto.createHash("sha256").update(seed).digest("hex")}`;
}

function claimFromRow(scope: TwinScopeKeyV1, row: SlotRowV1): ShadowOnlineSlotClaimV1 {
  return {
    boundary: {
      scope: { ...scope },
      slot_id: row.slot_id as ShadowOnlineSlotIdV1,
      logical_time: iso(row.logical_time),
      scheduler_wall_clock_observed_at: iso(row.scheduler_wall_clock_observed_at),
      interval_seconds: 3600,
    },
    lease_owner: row.lease_owner,
    fencing_token: BigInt(row.fencing_token),
    state: "CLAIMED",
    idempotency_key: row.idempotency_key,
  };
}

function terminalState(state: SlotRowV1["state"]): boolean {
  return state === "COMPLETED" || state === "DEGRADED" || state === "FAILED";
}

export class StrictUtcHourlySchedulerClockV1 implements ClockPortV1 {
  private readonly config: SchedulerConfigResolvedV1;

  constructor(
    config: PersistentSequentialSchedulerConfigV1,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.config = resolveConfig(config);
  }

  async resolveBoundary(input: { scope: TwinScopeKeyV1; slot_id: ShadowOnlineSlotIdV1 }): Promise<ShadowOnlineBoundaryV1> {
    assertScope(input.scope, this.config.scope);
    const index = this.config.slot_ids.indexOf(input.slot_id);
    if (index < 0) throw new Error("SLOT_ID_OUTSIDE_CONFIGURED_SCHEDULE");
    const logicalTime = logicalTimeFor(this.config, index);
    const observed = this.now();
    if (!Number.isFinite(observed.getTime())) throw new Error("SCHEDULER_WALL_CLOCK_INVALID");
    if (Date.parse(logicalTime) > observed.getTime()) throw new Error("FUTURE_BOUNDARY_CLAIM_REJECTED");
    return {
      scope: { ...this.config.scope },
      slot_id: input.slot_id,
      logical_time: logicalTime,
      scheduler_wall_clock_observed_at: observed.toISOString(),
      interval_seconds: 3600,
    };
  }
}

export class PostgresPersistentSequentialSchedulerAdapterV1 implements SchedulerPortV1 {
  private readonly config: SchedulerConfigResolvedV1;

  constructor(private readonly pool: SchedulerPoolV1, config: PersistentSequentialSchedulerConfigV1) {
    this.config = resolveConfig(config);
  }

  private async ensureCursorForUpdate(client: SchedulerClientV1): Promise<CursorRowV1> {
    const values = scopeValues(this.config.scope);
    await client.query(
      `INSERT INTO twin_shadow_online_scheduler_cursor_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,
        schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,0,$8,$7::timestamptz)
       ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO NOTHING`,
      [...values, this.config.schedule_start_logical_time, this.config.slot_ids[0]],
    );
    const result = await client.query<CursorRowV1>(
      `SELECT schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time,last_fencing_token
         FROM twin_shadow_online_scheduler_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        FOR UPDATE`,
      values,
    );
    if (result.rows.length !== 1) throw new Error("DURABLE_SCHEDULER_CURSOR_REQUIRED");
    const row = result.rows[0];
    if (iso(row.schedule_start_logical_time) !== this.config.schedule_start_logical_time) throw new Error("SCHEDULER_CURSOR_CONFIG_CONFLICT");
    const expectedId = row.next_slot_index < this.config.slot_ids.length ? this.config.slot_ids[row.next_slot_index] : null;
    const expectedTime = row.next_slot_index < this.config.slot_ids.length ? logicalTimeFor(this.config, row.next_slot_index) : null;
    if (row.next_slot_id !== expectedId) throw new Error("SCHEDULER_CURSOR_SLOT_ID_CORRUPT");
    if ((row.next_logical_time === null ? null : iso(row.next_logical_time)) !== expectedTime) throw new Error("SCHEDULER_CURSOR_LOGICAL_TIME_CORRUPT");
    return row;
  }

  private async existingSlotForUpdate(client: SchedulerClientV1, boundary: ShadowOnlineBoundaryV1): Promise<SlotRowV1 | null> {
    const result = await client.query<SlotRowV1>(
      `SELECT slot_id,logical_time,scheduler_wall_clock_observed_at,interval_seconds,state,
              lease_owner,fencing_token,idempotency_key,tick_ref,health_ref,terminal_at
         FROM twin_shadow_online_scheduler_slot_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
          AND logical_time=$7::timestamptz
        FOR UPDATE`,
      [...scopeValues(boundary.scope), boundary.logical_time],
    );
    if (result.rows.length > 1) throw new Error("SCHEDULER_SLOT_CARDINALITY_VIOLATION");
    return result.rows[0] ?? null;
  }

  private async assertDatabaseClockBoundary(client: SchedulerClientV1, boundary: ShadowOnlineBoundaryV1): Promise<void> {
    const result = await client.query<{ database_now: string | Date }>("SELECT transaction_timestamp() AS database_now");
    const databaseNow = new Date(result.rows[0].database_now).getTime();
    if (Date.parse(boundary.logical_time) > databaseNow) throw new Error("FUTURE_BOUNDARY_CLAIM_REJECTED");
    if (Date.parse(boundary.scheduler_wall_clock_observed_at) > databaseNow + 300_000) throw new Error("SCHEDULER_WALL_CLOCK_AHEAD_OF_DATABASE");
  }

  private async acquireLease(client: SchedulerClientV1, leaseOwner: string, leaseDurationSeconds: number): Promise<bigint> {
    requiredText(leaseOwner, "LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(leaseDurationSeconds) || leaseDurationSeconds <= 0 || leaseDurationSeconds > 3600) {
      throw new Error("LEASE_DURATION_SECONDS_INVALID");
    }
    const result = await client.query<{ fencing_token: string | number | bigint }>(
      `INSERT INTO twin_runtime_lease_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1,transaction_timestamp(),transaction_timestamp()+make_interval(secs=>$8),transaction_timestamp())
       ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
         lease_owner=EXCLUDED.lease_owner,
         fencing_token=twin_runtime_lease_v1.fencing_token+1,
         acquired_at=transaction_timestamp(),
         expires_at=transaction_timestamp()+make_interval(secs=>$8),
         heartbeat_at=transaction_timestamp()
       WHERE twin_runtime_lease_v1.expires_at<=transaction_timestamp()
       RETURNING fencing_token`,
      [...scopeValues(this.config.scope), leaseOwner, leaseDurationSeconds],
    );
    if (result.rows.length !== 1) throw new Error("LEASE_HELD_BY_OTHER_OWNER");
    return BigInt(result.rows[0].fencing_token);
  }

  private async assertLeaseCurrent(client: SchedulerClientV1, leaseOwner: string, fencingToken: bigint): Promise<void> {
    const result = await client.query<{ lease_owner: string; fencing_token: string | number | bigint; valid: boolean }>(
      `SELECT lease_owner,fencing_token,expires_at>transaction_timestamp() AS valid
         FROM twin_runtime_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        FOR UPDATE`,
      scopeValues(this.config.scope),
    );
    if (result.rows.length !== 1 || result.rows[0].lease_owner !== leaseOwner) throw new Error("LEASE_OWNER_MISMATCH");
    if (BigInt(result.rows[0].fencing_token) !== fencingToken) throw new Error("STALE_FENCING_TOKEN");
    if (result.rows[0].valid !== true) throw new Error("LEASE_EXPIRED");
  }

  async claimDueSlot(input: {
    boundary: ShadowOnlineBoundaryV1;
    lease_owner: string;
    lease_duration_seconds: number;
  }): Promise<ShadowOnlineSlotClaimV1> {
    const boundaryIndex = indexForBoundary(this.config, input.boundary);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.assertDatabaseClockBoundary(client, input.boundary);
      const cursor = await this.ensureCursorForUpdate(client);
      const existing = await this.existingSlotForUpdate(client, input.boundary);
      const expectedKey = idempotencyKey(this.config.scope, input.boundary);
      if (existing) {
        if (existing.slot_id !== input.boundary.slot_id || existing.idempotency_key !== expectedKey) throw new Error("SCHEDULER_SLOT_IDENTITY_CONFLICT");
        if (terminalState(existing.state)) throw new Error("TERMINAL_SLOT_ALREADY_RECORDED");
        if (existing.lease_owner !== input.lease_owner) throw new Error("SLOT_ALREADY_CLAIMED_BY_OTHER_OWNER");
        await this.assertLeaseCurrent(client, existing.lease_owner, BigInt(existing.fencing_token));
        await client.query("COMMIT");
        return claimFromRow(this.config.scope, existing);
      }
      if (cursor.next_slot_index >= this.config.slot_ids.length) throw new Error("SCHEDULER_RANGE_COMPLETE");
      if (boundaryIndex > cursor.next_slot_index) throw new Error("OLDER_MISSED_SLOT_REQUIRED");
      if (boundaryIndex < cursor.next_slot_index) throw new Error("SLOT_PRECEDES_DURABLE_CURSOR");
      const active = await client.query(
        `SELECT slot_id FROM twin_shadow_online_scheduler_slot_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND state IN ('CLAIMED','RUNNING')
          FOR UPDATE`,
        scopeValues(this.config.scope),
      );
      if (active.rows.length) throw new Error("ACTIVE_SLOT_ALREADY_PRESENT");
      const fencingToken = await this.acquireLease(client, input.lease_owner, input.lease_duration_seconds);
      const inserted = await client.query<SlotRowV1>(
        `INSERT INTO twin_shadow_online_scheduler_slot_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,slot_id,logical_time,
          scheduler_wall_clock_observed_at,interval_seconds,state,lease_owner,fencing_token,idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,3600,'CLAIMED',$10,$11,$12)
         RETURNING slot_id,logical_time,scheduler_wall_clock_observed_at,interval_seconds,state,
                   lease_owner,fencing_token,idempotency_key,tick_ref,health_ref,terminal_at`,
        [...scopeValues(this.config.scope), input.boundary.slot_id, input.boundary.logical_time,
          input.boundary.scheduler_wall_clock_observed_at, input.lease_owner, fencingToken.toString(), expectedKey],
      );
      if (inserted.rows.length !== 1) throw new Error("SCHEDULER_SLOT_INSERT_FAILED");
      await client.query("COMMIT");
      return claimFromRow(this.config.scope, inserted.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listMissedSlots(input: {
    scope: TwinScopeKeyV1;
    through_logical_time: string;
  }): Promise<readonly ShadowOnlineBoundaryV1[]> {
    assertScope(input.scope, this.config.scope);
    const throughMs = parseTime(input.through_logical_time, "THROUGH_LOGICAL_TIME_INVALID");
    const cursor = await this.pool.query<CursorRowV1>(
      `SELECT schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time,last_fencing_token
         FROM twin_shadow_online_scheduler_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      scopeValues(this.config.scope),
    );
    const nextIndex = cursor.rows.length ? cursor.rows[0].next_slot_index : 0;
    if (cursor.rows.length > 1) throw new Error("DURABLE_SCHEDULER_CURSOR_CARDINALITY");
    if (cursor.rows.length && iso(cursor.rows[0].schedule_start_logical_time) !== this.config.schedule_start_logical_time) {
      throw new Error("SCHEDULER_CURSOR_CONFIG_CONFLICT");
    }
    const active = await this.pool.query(
      `SELECT 1 FROM twin_shadow_online_scheduler_slot_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
          AND state IN ('CLAIMED','RUNNING') LIMIT 1`,
      scopeValues(this.config.scope),
    );
    if (active.rows.length) return [];
    const result: ShadowOnlineBoundaryV1[] = [];
    for (let index = nextIndex; index < this.config.slot_ids.length; index += 1) {
      const logicalTime = logicalTimeFor(this.config, index);
      if (Date.parse(logicalTime) > throughMs) break;
      result.push({
        scope: { ...this.config.scope },
        slot_id: this.config.slot_ids[index],
        logical_time: logicalTime,
        scheduler_wall_clock_observed_at: new Date(throughMs).toISOString(),
        interval_seconds: 3600,
      });
    }
    return result;
  }

  async recordTerminalResult(input: {
    claim: ShadowOnlineSlotClaimV1;
    result: ShadowOnlineTerminalSlotResultV1;
  }): Promise<void> {
    const claimIndex = indexForBoundary(this.config, input.claim.boundary);
    indexForBoundary(this.config, input.result.boundary);
    if (JSON.stringify(input.claim.boundary) !== JSON.stringify(input.result.boundary)) throw new Error("TERMINAL_RESULT_BOUNDARY_MISMATCH");
    if (!input.result.health_ref.trim()) throw new Error("TERMINAL_HEALTH_REF_REQUIRED");
    const terminalMs = parseTime(input.result.terminal_at, "TERMINAL_AT_INVALID");
    if (terminalMs < Date.parse(input.claim.boundary.logical_time)) throw new Error("TERMINAL_AT_PRECEDES_LOGICAL_TIME");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const cursor = await this.ensureCursorForUpdate(client);
      const slot = await this.existingSlotForUpdate(client, input.claim.boundary);
      if (!slot) throw new Error("CLAIMED_SLOT_NOT_FOUND");
      if (terminalState(slot.state)) throw new Error("TERMINAL_SLOT_ALREADY_RECORDED");
      if (slot.lease_owner !== input.claim.lease_owner) throw new Error("LEASE_OWNER_MISMATCH");
      if (BigInt(slot.fencing_token) !== input.claim.fencing_token) throw new Error("STALE_FENCING_TOKEN");
      if (slot.idempotency_key !== input.claim.idempotency_key) throw new Error("CLAIM_IDEMPOTENCY_KEY_MISMATCH");
      await this.assertLeaseCurrent(client, input.claim.lease_owner, input.claim.fencing_token);
      if (cursor.next_slot_index !== claimIndex) throw new Error("DURABLE_CURSOR_CLAIM_MISMATCH");
      const updated = await client.query(
        `UPDATE twin_shadow_online_scheduler_slot_v1
            SET state=$7,tick_ref=$8,health_ref=$9,terminal_at=$10::timestamptz,updated_at=transaction_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND logical_time=$11::timestamptz AND lease_owner=$12 AND fencing_token=$13
            AND state IN ('CLAIMED','RUNNING')`,
        [...scopeValues(this.config.scope), input.result.state, input.result.tick_ref, input.result.health_ref,
          input.result.terminal_at, input.claim.boundary.logical_time, input.claim.lease_owner,
          input.claim.fencing_token.toString()],
      );
      if (updated.rowCount !== 1) throw new Error("TERMINAL_SLOT_COMPARE_AND_SET_FAILED");
      const nextIndex = claimIndex + 1;
      const nextSlotId = nextIndex < this.config.slot_ids.length ? this.config.slot_ids[nextIndex] : null;
      const nextLogicalTime = nextIndex < this.config.slot_ids.length ? logicalTimeFor(this.config, nextIndex) : null;
      const advanced = await client.query(
        `UPDATE twin_shadow_online_scheduler_cursor_v1
            SET next_slot_index=$7,next_slot_id=$8,next_logical_time=$9::timestamptz,
                last_terminal_slot_id=$10,last_terminal_logical_time=$11::timestamptz,
                last_fencing_token=$12,updated_at=transaction_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND next_slot_index=$13`,
        [...scopeValues(this.config.scope), nextIndex, nextSlotId, nextLogicalTime,
          input.claim.boundary.slot_id, input.claim.boundary.logical_time,
          input.claim.fencing_token.toString(), claimIndex],
      );
      if (advanced.rowCount !== 1) throw new Error("DURABLE_CURSOR_COMPARE_AND_SET_FAILED");
      await client.query(
        `UPDATE twin_runtime_lease_v1
            SET expires_at=GREATEST(transaction_timestamp(),acquired_at+interval '1 microsecond'),heartbeat_at=transaction_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND lease_owner=$7 AND fencing_token=$8`,
        [...scopeValues(this.config.scope), input.claim.lease_owner, input.claim.fencing_token.toString()],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
