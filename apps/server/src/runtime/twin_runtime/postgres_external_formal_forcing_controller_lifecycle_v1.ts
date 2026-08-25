import type { Pool, PoolClient } from "pg";

import type { TwinScopeKeyV1 } from "./ports.js";

export const MCFT_CAP09_FORMAL_FORCING_CONTROLLER_LIFECYCLE_ID_V1 =
  "FORMAL_FORCING_CONTROLLER_LIFECYCLE_V1" as const;

export type ExternalFormalForcingControllerLifecycleConfigV1 = {
  scope: TwinScopeKeyV1;
  epoch_id: string;
  subject_sha: string;
};

export type ExternalFormalForcingControllerLeaseV1 = {
  lifecycle_id: typeof MCFT_CAP09_FORMAL_FORCING_CONTROLLER_LIFECYCLE_ID_V1;
  scope: TwinScopeKeyV1;
  epoch_id: string;
  subject_sha: string;
  lease_owner: string;
  fencing_token: bigint;
  lease_expires_at: string;
  acquired_at: string;
  renewed_at: string;
};

export type ExternalFormalForcingControllerAcquireResultV1 =
  | { status: "ACQUIRED" | "RENEWED" | "TAKEN_OVER"; lease: ExternalFormalForcingControllerLeaseV1; database_now: string }
  | { status: "BUSY"; current_owner: string; fencing_token: bigint; lease_expires_at: string; database_now: string }
  | { status: "TERMINAL"; terminal_reason: string; terminal_at: string; fencing_token: bigint; database_now: string };

type ControllerRowV1 = {
  subject_sha: string;
  lifecycle_state: "ACTIVE" | "TERMINAL";
  lease_owner: string;
  fencing_token: string | number | bigint;
  lease_expires_at: string | Date | null;
  acquired_at: string | Date;
  renewed_at: string | Date;
  terminal_at: string | Date | null;
  terminal_reason: string | null;
};

type ClientV1 = Pick<PoolClient, "query" | "release">;
type PoolV1 = Pick<Pool, "connect">;
const SCOPE_KEYS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;

function requiredText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function iso(value: string | Date): string {
  return new Date(value).toISOString();
}

function scopeValues(scope: TwinScopeKeyV1): string[] {
  return SCOPE_KEYS.map((key) => requiredText(scope[key], `FORMAL_FORCING_CONTROLLER_SCOPE_${key.toUpperCase()}_REQUIRED`));
}

function sameScope(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return SCOPE_KEYS.every((key) => left[key] === right[key]);
}

function validateConfig(input: ExternalFormalForcingControllerLifecycleConfigV1): ExternalFormalForcingControllerLifecycleConfigV1 {
  scopeValues(input.scope);
  const epoch = requiredText(input.epoch_id, "FORMAL_FORCING_CONTROLLER_EPOCH_REQUIRED");
  const subject = requiredText(input.subject_sha, "FORMAL_FORCING_CONTROLLER_SUBJECT_REQUIRED");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("FORMAL_FORCING_CONTROLLER_SUBJECT_INVALID");
  return { scope: { ...input.scope }, epoch_id: epoch, subject_sha: subject };
}

async function databaseNow(client: Pick<PoolClient, "query">): Promise<string> {
  const row = (await client.query<{ database_now: string | Date }>("SELECT clock_timestamp() AS database_now")).rows[0];
  if (!row) throw new Error("FORMAL_FORCING_CONTROLLER_DATABASE_CLOCK_REQUIRED");
  return iso(row.database_now);
}

function leaseFromRow(config: ExternalFormalForcingControllerLifecycleConfigV1, row: ControllerRowV1): ExternalFormalForcingControllerLeaseV1 {
  if (row.lifecycle_state !== "ACTIVE" || !row.lease_expires_at || BigInt(row.fencing_token) <= 0n) {
    throw new Error("FORMAL_FORCING_CONTROLLER_ACTIVE_LEASE_CORRUPT");
  }
  return {
    lifecycle_id: MCFT_CAP09_FORMAL_FORCING_CONTROLLER_LIFECYCLE_ID_V1,
    scope: { ...config.scope },
    epoch_id: config.epoch_id,
    subject_sha: config.subject_sha,
    lease_owner: row.lease_owner,
    fencing_token: BigInt(row.fencing_token),
    lease_expires_at: iso(row.lease_expires_at),
    acquired_at: iso(row.acquired_at),
    renewed_at: iso(row.renewed_at),
  };
}

export class PostgresExternalFormalForcingControllerLifecycleV1 {
  private readonly config: ExternalFormalForcingControllerLifecycleConfigV1;

  constructor(private readonly pool: PoolV1, config: ExternalFormalForcingControllerLifecycleConfigV1) {
    this.config = validateConfig(config);
  }

  async acquireOrRenew(input: { lease_owner: string; lease_duration_seconds: number }): Promise<ExternalFormalForcingControllerAcquireResultV1> {
    const owner = requiredText(input.lease_owner, "FORMAL_FORCING_CONTROLLER_LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0 || input.lease_duration_seconds > 1800) {
      throw new Error("FORMAL_FORCING_CONTROLLER_LEASE_DURATION_INVALID");
    }
    const client = await this.pool.connect() as ClientV1;
    try {
      await client.query("BEGIN");
      const params = [...scopeValues(this.config.scope), this.config.epoch_id];
      const result = await client.query<ControllerRowV1>(
        `SELECT subject_sha,lifecycle_state,lease_owner,fencing_token,lease_expires_at,acquired_at,renewed_at,terminal_at,terminal_reason
           FROM twin_external_formal_forcing_controller_lease_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7
          FOR UPDATE`,
        params,
      );
      if (result.rows.length > 1) throw new Error("FORMAL_FORCING_CONTROLLER_CARDINALITY_VIOLATION");
      const now = await databaseNow(client);
      const leaseExpiresAt = new Date(Date.parse(now) + input.lease_duration_seconds * 1000).toISOString();

      if (result.rows.length === 0) {
        const inserted = (await client.query<ControllerRowV1>(
          `INSERT INTO twin_external_formal_forcing_controller_lease_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,lifecycle_state,lease_owner,fencing_token,lease_expires_at,acquired_at,renewed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',$9,1,$10::timestamptz,$11::timestamptz,$11::timestamptz)
           RETURNING subject_sha,lifecycle_state,lease_owner,fencing_token,lease_expires_at,acquired_at,renewed_at,terminal_at,terminal_reason`,
          [...params, this.config.subject_sha, owner, leaseExpiresAt, now],
        )).rows[0];
        if (!inserted) throw new Error("FORMAL_FORCING_CONTROLLER_INSERT_FAILED");
        await client.query("COMMIT");
        return { status: "ACQUIRED", lease: leaseFromRow(this.config, inserted), database_now: now };
      }

      const row = result.rows[0];
      if (row.subject_sha !== this.config.subject_sha) throw new Error("FORMAL_FORCING_CONTROLLER_SUBJECT_CONFLICT");
      const token = BigInt(row.fencing_token);
      if (row.lifecycle_state === "TERMINAL") {
        if (!row.terminal_reason || !row.terminal_at) throw new Error("FORMAL_FORCING_CONTROLLER_TERMINAL_ROW_CORRUPT");
        await client.query("COMMIT");
        return { status: "TERMINAL", terminal_reason: row.terminal_reason, terminal_at: iso(row.terminal_at), fencing_token: token, database_now: now };
      }
      if (!row.lease_expires_at) throw new Error("FORMAL_FORCING_CONTROLLER_ACTIVE_EXPIRY_REQUIRED");
      const live = Date.parse(iso(row.lease_expires_at)) > Date.parse(now);
      if (live && row.lease_owner !== owner) {
        await client.query("COMMIT");
        return { status: "BUSY", current_owner: row.lease_owner, fencing_token: token, lease_expires_at: iso(row.lease_expires_at), database_now: now };
      }

      const nextToken = live ? token : token + 1n;
      const nextStatus = live ? "RENEWED" as const : "TAKEN_OVER" as const;
      const updated = (await client.query<ControllerRowV1>(
        `UPDATE twin_external_formal_forcing_controller_lease_v1
            SET lease_owner=$8,fencing_token=$9,lease_expires_at=$10::timestamptz,
                acquired_at=CASE WHEN $11::boolean THEN $12::timestamptz ELSE acquired_at END,
                renewed_at=$12::timestamptz,updated_at=transaction_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7
          RETURNING subject_sha,lifecycle_state,lease_owner,fencing_token,lease_expires_at,acquired_at,renewed_at,terminal_at,terminal_reason`,
        [...params, owner, nextToken.toString(), leaseExpiresAt, !live, now],
      )).rows[0];
      if (!updated) throw new Error("FORMAL_FORCING_CONTROLLER_UPDATE_FAILED");
      await client.query("COMMIT");
      return { status: nextStatus, lease: leaseFromRow(this.config, updated), database_now: now };
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  async recordTerminal(input: { lease: ExternalFormalForcingControllerLeaseV1; reason: string }): Promise<void> {
    const reason = requiredText(input.reason, "FORMAL_FORCING_CONTROLLER_TERMINAL_REASON_REQUIRED");
    if (
      input.lease.epoch_id !== this.config.epoch_id
      || input.lease.subject_sha !== this.config.subject_sha
      || !sameScope(input.lease.scope, this.config.scope)
    ) {
      throw new Error("FORMAL_FORCING_CONTROLLER_TERMINAL_LEASE_IDENTITY_MISMATCH");
    }
    const client = await this.pool.connect() as ClientV1;
    try {
      await client.query("BEGIN");
      const params = [...scopeValues(this.config.scope), this.config.epoch_id];
      const result = await client.query<ControllerRowV1>(
        `SELECT subject_sha,lifecycle_state,lease_owner,fencing_token,lease_expires_at,acquired_at,renewed_at,terminal_at,terminal_reason
           FROM twin_external_formal_forcing_controller_lease_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7
          FOR UPDATE`,
        params,
      );
      if (result.rows.length !== 1) throw new Error("FORMAL_FORCING_CONTROLLER_TERMINAL_ROW_REQUIRED");
      const row = result.rows[0];
      const now = await databaseNow(client);
      if (row.subject_sha !== this.config.subject_sha || row.lifecycle_state !== "ACTIVE") throw new Error("FORMAL_FORCING_CONTROLLER_TERMINAL_STATE_INVALID");
      if (row.lease_owner !== input.lease.lease_owner || BigInt(row.fencing_token) !== input.lease.fencing_token) {
        throw new Error("FORMAL_FORCING_CONTROLLER_STALE_FENCE");
      }
      if (!row.lease_expires_at || Date.parse(iso(row.lease_expires_at)) <= Date.parse(now)) {
        throw new Error("FORMAL_FORCING_CONTROLLER_LEASE_EXPIRED");
      }
      await client.query(
        `UPDATE twin_external_formal_forcing_controller_lease_v1
            SET lifecycle_state='TERMINAL',lease_expires_at=NULL,terminal_at=$8::timestamptz,terminal_reason=$9,updated_at=transaction_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7`,
        [...params, now, reason],
      );
      await client.query("COMMIT");
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }
}
