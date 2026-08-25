import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";

export const MCFT_CAP09_FORMAL_FORCING_BASE_CURSOR_ID_V1 =
  "FORMAL_FORCING_BASE_CONTINUITY_CURSOR_V1" as const;
export const MCFT_CAP09_FORMAL_PHYSICAL_INGRESS_ATTESTATION_ID_V1 =
  "FORMAL_PHYSICAL_INGRESS_ATTESTATION_V1" as const;

export type ExternalFormalForcingBaseStateV1 =
  | "REQUIRED"
  | "CLAIMED"
  | "ACQUIRING"
  | "READY_TO_FINALIZE"
  | "PROMOTING"
  | "FORMAL_VISIBLE_ATTESTED"
  | "FAILED_RETRYABLE"
  | "DEADLINE_MISSED_TERMINAL";

export type ExternalFormalForcingBaseContinuityConfigV1 = {
  scope: TwinScopeKeyV1;
  epoch_id: string;
  subject_sha: string;
  first_required_base: string;
  last_required_base: string;
};

export type ExternalFormalForcingBaseCursorSnapshotV1 = {
  cursor_id: typeof MCFT_CAP09_FORMAL_FORCING_BASE_CURSOR_ID_V1;
  scope: TwinScopeKeyV1;
  epoch_id: string;
  subject_sha: string;
  first_required_base: string;
  last_required_base: string;
  last_contiguous_eligible_base: string;
  next_missing_required_base: string | null;
  completed: boolean;
};

export type ExternalFormalForcingBaseClaimV1 = {
  scope: TwinScopeKeyV1;
  epoch_id: string;
  subject_sha: string;
  base_target_t: string;
  causal_deadline: string;
  lease_owner: string;
  fencing_token: bigint;
  lease_expires_at: string;
  idempotency_key: string;
};

export type ExternalFormalForcingBaseClaimResultV1 =
  | { status: "CLAIMED" | "EXISTING_ACTIVE_CLAIM"; claim: ExternalFormalForcingBaseClaimV1 }
  | { status: "BUSY"; base_target_t: string; current_owner: string; lease_expires_at: string }
  | { status: "DEADLINE_MISSED"; base_target_t: string; failure_class: "REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED" }
  | { status: "NO_WORK"; reason: "FORCING_BASE_WINDOW_COMPLETE" };

export type ExternalFormalPhysicalFactIdentityV1 = {
  kind: "WEATHER" | "ET0" | "SOIL";
  fact_id: string;
  source_record_id: string;
  source_record_hash: string;
  record_semantic_hash: string;
};

export type ExternalFormalPhysicalIngressAttestationV1 = {
  attestation_id: typeof MCFT_CAP09_FORMAL_PHYSICAL_INGRESS_ATTESTATION_ID_V1;
  status: "PASS";
  scope: TwinScopeKeyV1;
  epoch_id: string;
  subject_sha: string;
  base_target_t: string;
  causal_deadline: string;
  producer_run_id: string;
  promotion_run_id: string;
  candidate_artifact_digest: string;
  facts: readonly ExternalFormalPhysicalFactIdentityV1[];
  post_commit_db_readback_at: string;
  formal_visible_attested_at: string;
  physical_visibility_before_base: true;
  cursor_advanced: boolean;
  next_missing_required_base: string | null;
};

type CursorRowV1 = {
  epoch_id: string;
  subject_sha: string;
  first_required_base: string | Date;
  last_required_base: string | Date;
  last_contiguous_eligible_base: string | Date;
  next_missing_required_base: string | Date | null;
  completed: boolean;
};

type TargetRowV1 = {
  subject_sha: string;
  base_target_t: string | Date;
  causal_deadline: string | Date;
  state: ExternalFormalForcingBaseStateV1;
  claim_owner: string | null;
  fencing_token: string | number | bigint;
  lease_expires_at: string | Date | null;
  idempotency_key: string;
  producer_run_id: string | null;
  promotion_run_id: string | null;
  candidate_artifact_digest: string | null;
  weather_fact_id: string | null;
  weather_source_record_hash: string | null;
  weather_record_semantic_hash: string | null;
  et0_fact_id: string | null;
  et0_source_record_hash: string | null;
  et0_record_semantic_hash: string | null;
  soil_fact_id: string | null;
  soil_source_record_hash: string | null;
  soil_record_semantic_hash: string | null;
  post_commit_db_readback_at: string | Date | null;
  formal_visible_attested_at: string | Date | null;
  failure_class: string | null;
};

type FactRowV1 = { fact_id: string; record_json: unknown };

type ClientLikeV1 = Pick<PoolClient, "query" | "release">;
type PoolLikeV1 = Pick<Pool, "connect" | "query">;

const SCOPE_KEYS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;
const HOUR_MS = 3_600_000;
const ACTIVE_STATES = new Set<ExternalFormalForcingBaseStateV1>(["CLAIMED", "ACQUIRING", "READY_TO_FINALIZE", "PROMOTING"]);

function requiredText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalIso(value: unknown, code: string): string {
  const text = requiredText(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function canonicalHour(value: unknown, code: string): string {
  const text = canonicalIso(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function iso(value: string | Date): string {
  return new Date(value).toISOString();
}

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}

function validateSubject(subject: string): string {
  const value = requiredText(subject, "FORMAL_FORCING_SUBJECT_SHA_REQUIRED");
  if (!/^[0-9a-f]{40}$/.test(value)) throw new Error("FORMAL_FORCING_SUBJECT_SHA_INVALID");
  return value;
}

function scopeValues(scope: TwinScopeKeyV1): string[] {
  return SCOPE_KEYS.map((key) => requiredText(scope[key], `FORMAL_FORCING_SCOPE_${key.toUpperCase()}_REQUIRED`));
}

function sameScope(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return SCOPE_KEYS.every((key) => left[key] === right[key]);
}

function validateConfig(config: ExternalFormalForcingBaseContinuityConfigV1): ExternalFormalForcingBaseContinuityConfigV1 {
  scopeValues(config.scope);
  const epoch = requiredText(config.epoch_id, "FORMAL_FORCING_EPOCH_ID_REQUIRED");
  const subject = validateSubject(config.subject_sha);
  const first = canonicalHour(config.first_required_base, "FORMAL_FORCING_FIRST_REQUIRED_BASE_INVALID");
  const last = canonicalHour(config.last_required_base, "FORMAL_FORCING_LAST_REQUIRED_BASE_INVALID");
  if (Date.parse(first) > Date.parse(last)) throw new Error("FORMAL_FORCING_BASE_RANGE_INVALID");
  return { scope: { ...config.scope }, epoch_id: epoch, subject_sha: subject, first_required_base: first, last_required_base: last };
}

function idempotencyKey(config: ExternalFormalForcingBaseContinuityConfigV1, base: string): string {
  const seed = JSON.stringify({ scope: config.scope, epoch_id: config.epoch_id, subject_sha: config.subject_sha, base_target_t: base });
  return `formal-forcing-base:${crypto.createHash("sha256").update(seed, "utf8").digest("hex")}`;
}

async function databaseNow(client: Pick<PoolClient, "query">): Promise<string> {
  const row = (await client.query<{ database_now: string | Date }>("SELECT clock_timestamp() AS database_now")).rows[0];
  if (!row) throw new Error("FORMAL_FORCING_DATABASE_CLOCK_REQUIRED");
  return iso(row.database_now);
}

function cursorSnapshot(config: ExternalFormalForcingBaseContinuityConfigV1, row: CursorRowV1): ExternalFormalForcingBaseCursorSnapshotV1 {
  return {
    cursor_id: MCFT_CAP09_FORMAL_FORCING_BASE_CURSOR_ID_V1,
    scope: { ...config.scope },
    epoch_id: row.epoch_id,
    subject_sha: row.subject_sha,
    first_required_base: iso(row.first_required_base),
    last_required_base: iso(row.last_required_base),
    last_contiguous_eligible_base: iso(row.last_contiguous_eligible_base),
    next_missing_required_base: row.next_missing_required_base === null ? null : iso(row.next_missing_required_base),
    completed: row.completed,
  };
}

function claimFromTarget(config: ExternalFormalForcingBaseContinuityConfigV1, row: TargetRowV1): ExternalFormalForcingBaseClaimV1 {
  if (!row.claim_owner || !row.lease_expires_at || BigInt(row.fencing_token) <= 0n) throw new Error("FORMAL_FORCING_ACTIVE_CLAIM_CORRUPT");
  return {
    scope: { ...config.scope },
    epoch_id: config.epoch_id,
    subject_sha: config.subject_sha,
    base_target_t: iso(row.base_target_t),
    causal_deadline: iso(row.causal_deadline),
    lease_owner: row.claim_owner,
    fencing_token: BigInt(row.fencing_token),
    lease_expires_at: iso(row.lease_expires_at),
    idempotency_key: row.idempotency_key,
  };
}

function objectRecord(value: unknown, code: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, any>;
}

function expectedRecordType(kind: ExternalFormalPhysicalFactIdentityV1["kind"]): string {
  if (kind === "WEATHER") return "future_weather_assumption_v1";
  if (kind === "ET0") return "future_et0_assumption_v1";
  return "soil_moisture_observation_v1";
}

function validatePhysicalFactPayload(
  identity: ExternalFormalPhysicalFactIdentityV1,
  value: unknown,
  baseTarget: string,
): void {
  const envelope = typeof value === "string" ? objectRecord(JSON.parse(value), "FORMAL_PHYSICAL_FACT_ENVELOPE_INVALID") : objectRecord(value, "FORMAL_PHYSICAL_FACT_ENVELOPE_INVALID");
  const record = objectRecord(envelope.payload, "FORMAL_PHYSICAL_FACT_PAYLOAD_REQUIRED");
  const expectedType = expectedRecordType(identity.kind);
  if (envelope.type !== expectedType || record.record_type !== expectedType) throw new Error(`FORMAL_PHYSICAL_FACT_TYPE_MISMATCH:${identity.kind}`);
  if (record.source_record_id !== identity.source_record_id || record.source_record_hash !== identity.source_record_hash) {
    throw new Error(`FORMAL_PHYSICAL_FACT_SOURCE_IDENTITY_MISMATCH:${identity.kind}`);
  }
  if (semanticHashV1(record) !== identity.record_semantic_hash) throw new Error(`FORMAL_PHYSICAL_FACT_SEMANTIC_HASH_MISMATCH:${identity.kind}`);

  const available = canonicalIso(record.available_to_runtime_at, `FORMAL_PHYSICAL_FACT_AVAILABLE_INVALID:${identity.kind}`);
  const ingested = canonicalIso(record.role_time?.ingested_at, `FORMAL_PHYSICAL_FACT_INGESTED_INVALID:${identity.kind}`);
  if (Date.parse(available) > Date.parse(ingested) || Date.parse(ingested) > Date.parse(baseTarget)) {
    throw new Error(`FORMAL_PHYSICAL_FACT_PAYLOAD_CAUSAL_ORDER_INVALID:${identity.kind}`);
  }

  if (identity.kind === "WEATHER" || identity.kind === "ET0") {
    const issued = canonicalIso(record.role_time?.issued_at, `FORMAL_PHYSICAL_FACT_ISSUED_INVALID:${identity.kind}`);
    if (Date.parse(issued) > Date.parse(available)) throw new Error(`FORMAL_PHYSICAL_FACT_ISSUED_AFTER_AVAILABLE:${identity.kind}`);
    if (record.role_time?.valid_from !== baseTarget || record.role_time?.valid_to !== addHours(baseTarget, 72)) {
      throw new Error(`FORMAL_PHYSICAL_FACT_WINDOW_MISMATCH:${identity.kind}`);
    }
    const canonicalPayload = objectRecord(record.canonical_payload, `FORMAL_PHYSICAL_FACT_CANONICAL_PAYLOAD_INVALID:${identity.kind}`);
    if (!Array.isArray(canonicalPayload.points) || canonicalPayload.points.length !== 72) {
      throw new Error(`FORMAL_PHYSICAL_FACT_72_POINTS_REQUIRED:${identity.kind}`);
    }
    for (let index = 0; index < canonicalPayload.points.length; index += 1) {
      const point = objectRecord(canonicalPayload.points[index], `FORMAL_PHYSICAL_FACT_POINT_INVALID:${identity.kind}:${index}`);
      if (point.valid_from !== addHours(baseTarget, index) || point.valid_to !== addHours(baseTarget, index + 1)) {
        throw new Error(`FORMAL_PHYSICAL_FACT_POINT_CONTINUITY_INVALID:${identity.kind}:${index}`);
      }
    }
  } else {
    const observed = canonicalIso(record.role_time?.observed_at, "FORMAL_PHYSICAL_SOIL_OBSERVED_INVALID");
    if (Date.parse(observed) > Date.parse(available) || Date.parse(observed) > Date.parse(baseTarget)) {
      throw new Error("FORMAL_PHYSICAL_SOIL_CAUSAL_ORDER_INVALID");
    }
  }
}

export class PostgresExternalFormalForcingBaseContinuityRepositoryV1 {
  private readonly config: ExternalFormalForcingBaseContinuityConfigV1;

  constructor(private readonly pool: PoolLikeV1, config: ExternalFormalForcingBaseContinuityConfigV1) {
    this.config = validateConfig(config);
  }

  private async cursorForUpdate(client: ClientLikeV1): Promise<CursorRowV1> {
    const result = await client.query<CursorRowV1>(
      `SELECT epoch_id,subject_sha,first_required_base,last_required_base,last_contiguous_eligible_base,next_missing_required_base,completed
         FROM twin_external_formal_forcing_base_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7
        FOR UPDATE`,
      [...scopeValues(this.config.scope), this.config.epoch_id],
    );
    if (result.rows.length !== 1) throw new Error("FORMAL_FORCING_CURSOR_NOT_INITIALIZED");
    const row = result.rows[0];
    if (row.subject_sha !== this.config.subject_sha || iso(row.first_required_base) !== this.config.first_required_base || iso(row.last_required_base) !== this.config.last_required_base) {
      throw new Error("FORMAL_FORCING_CURSOR_CONFIG_CONFLICT");
    }
    return row;
  }

  private async targetForUpdate(client: ClientLikeV1, base: string): Promise<TargetRowV1 | null> {
    const result = await client.query<TargetRowV1>(
      `SELECT subject_sha,base_target_t,causal_deadline,state,claim_owner,fencing_token,lease_expires_at,idempotency_key,
              producer_run_id,promotion_run_id,candidate_artifact_digest,
              weather_fact_id,weather_source_record_hash,weather_record_semantic_hash,
              et0_fact_id,et0_source_record_hash,et0_record_semantic_hash,
              soil_fact_id,soil_source_record_hash,soil_record_semantic_hash,
              post_commit_db_readback_at,formal_visible_attested_at,failure_class
         FROM twin_external_formal_forcing_base_target_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz
        FOR UPDATE`,
      [...scopeValues(this.config.scope), this.config.epoch_id, base],
    );
    if (result.rows.length > 1) throw new Error("FORMAL_FORCING_TARGET_CARDINALITY_VIOLATION");
    return result.rows[0] ?? null;
  }

  private assertTargetIdentity(row: TargetRowV1, base: string): void {
    if (row.subject_sha !== this.config.subject_sha || iso(row.base_target_t) !== base || iso(row.causal_deadline) !== base) {
      throw new Error("FORMAL_FORCING_TARGET_IDENTITY_CONFLICT");
    }
  }

  async initializeCursor(): Promise<ExternalFormalForcingBaseCursorSnapshotV1> {
    const client = await this.pool.connect() as ClientLikeV1;
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO twin_external_formal_forcing_base_cursor_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,
          first_required_base,last_required_base,last_contiguous_eligible_base,next_missing_required_base,completed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz,$11::timestamptz,$9::timestamptz,false)
         ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id) DO NOTHING`,
        [...scopeValues(this.config.scope), this.config.epoch_id, this.config.subject_sha, this.config.first_required_base, this.config.last_required_base, addHours(this.config.first_required_base, -1)],
      );
      const row = await this.cursorForUpdate(client);
      const snapshot = cursorSnapshot(this.config, row);
      await client.query("COMMIT");
      return snapshot;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  async readCursor(): Promise<ExternalFormalForcingBaseCursorSnapshotV1> {
    const result = await this.pool.query<CursorRowV1>(
      `SELECT epoch_id,subject_sha,first_required_base,last_required_base,last_contiguous_eligible_base,next_missing_required_base,completed
         FROM twin_external_formal_forcing_base_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7`,
      [...scopeValues(this.config.scope), this.config.epoch_id],
    );
    if (result.rows.length !== 1) throw new Error("FORMAL_FORCING_CURSOR_NOT_INITIALIZED");
    return cursorSnapshot(this.config, result.rows[0]);
  }

  async claimNextMissingBase(input: { lease_owner: string; lease_duration_seconds: number }): Promise<ExternalFormalForcingBaseClaimResultV1> {
    const owner = requiredText(input.lease_owner, "FORMAL_FORCING_LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0 || input.lease_duration_seconds > 1800) {
      throw new Error("FORMAL_FORCING_LEASE_DURATION_INVALID");
    }
    const client = await this.pool.connect() as ClientLikeV1;
    try {
      await client.query("BEGIN");
      const cursor = await this.cursorForUpdate(client);
      if (cursor.completed || cursor.next_missing_required_base === null) {
        await client.query("COMMIT");
        return { status: "NO_WORK", reason: "FORCING_BASE_WINDOW_COMPLETE" };
      }
      const base = iso(cursor.next_missing_required_base);
      const now = await databaseNow(client);
      let target = await this.targetForUpdate(client, base);
      if (!target) {
        await client.query(
          `INSERT INTO twin_external_formal_forcing_base_target_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,base_target_t,causal_deadline,state,idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$9::timestamptz,'REQUIRED',$10)`,
          [...scopeValues(this.config.scope), this.config.epoch_id, this.config.subject_sha, base, idempotencyKey(this.config, base)],
        );
        target = await this.targetForUpdate(client, base);
        if (!target) throw new Error("FORMAL_FORCING_TARGET_INSERT_READBACK_REQUIRED");
      }
      this.assertTargetIdentity(target, base);

      if (Date.parse(now) >= Date.parse(base)) {
        if (target.state !== "FORMAL_VISIBLE_ATTESTED") {
          await client.query(
            `UPDATE twin_external_formal_forcing_base_target_v1
                SET state='DEADLINE_MISSED_TERMINAL',failure_class='REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED',lease_expires_at=NULL,updated_at=clock_timestamp()
              WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz`,
            [...scopeValues(this.config.scope), this.config.epoch_id, base],
          );
        }
        await client.query("COMMIT");
        return { status: "DEADLINE_MISSED", base_target_t: base, failure_class: "REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED" };
      }
      if (target.state === "DEADLINE_MISSED_TERMINAL") {
        await client.query("COMMIT");
        return { status: "DEADLINE_MISSED", base_target_t: base, failure_class: "REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED" };
      }
      if (target.state === "FORMAL_VISIBLE_ATTESTED") throw new Error("FORMAL_FORCING_CURSOR_DID_NOT_ADVANCE_AFTER_ATTESTATION");

      if (ACTIVE_STATES.has(target.state) && target.lease_expires_at && Date.parse(iso(target.lease_expires_at)) > Date.parse(now)) {
        if (target.claim_owner === owner) {
          const claim = claimFromTarget(this.config, target);
          await client.query("COMMIT");
          return { status: "EXISTING_ACTIVE_CLAIM", claim };
        }
        await client.query("COMMIT");
        return { status: "BUSY", base_target_t: base, current_owner: requiredText(target.claim_owner, "FORMAL_FORCING_BUSY_OWNER_REQUIRED"), lease_expires_at: iso(target.lease_expires_at) };
      }

      const nextFence = BigInt(target.fencing_token) + 1n;
      const proposedExpiryMs = Math.min(Date.parse(now) + input.lease_duration_seconds * 1000, Date.parse(base));
      if (proposedExpiryMs <= Date.parse(now)) throw new Error("FORMAL_FORCING_LEASE_CANNOT_REACH_FUTURE");
      const leaseExpires = new Date(proposedExpiryMs).toISOString();
      const updated = await client.query<TargetRowV1>(
        `UPDATE twin_external_formal_forcing_base_target_v1
            SET state='CLAIMED',claim_owner=$9,fencing_token=$10::bigint,lease_expires_at=$11::timestamptz,
                claimed_at=clock_timestamp(),failure_class=NULL,updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz
          RETURNING subject_sha,base_target_t,causal_deadline,state,claim_owner,fencing_token,lease_expires_at,idempotency_key,
                    producer_run_id,promotion_run_id,candidate_artifact_digest,
                    weather_fact_id,weather_source_record_hash,weather_record_semantic_hash,
                    et0_fact_id,et0_source_record_hash,et0_record_semantic_hash,
                    soil_fact_id,soil_source_record_hash,soil_record_semantic_hash,
                    post_commit_db_readback_at,formal_visible_attested_at,failure_class`,
        [...scopeValues(this.config.scope), this.config.epoch_id, base, owner, nextFence.toString(), leaseExpires],
      );
      if (updated.rows.length !== 1) throw new Error("FORMAL_FORCING_CLAIM_UPDATE_REQUIRED");
      const claim = claimFromTarget(this.config, updated.rows[0]);
      await client.query("COMMIT");
      return { status: "CLAIMED", claim };
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  async heartbeatClaim(input: { claim: ExternalFormalForcingBaseClaimV1; lease_duration_seconds: number }): Promise<ExternalFormalForcingBaseClaimV1> {
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0 || input.lease_duration_seconds > 1800) {
      throw new Error("FORMAL_FORCING_LEASE_DURATION_INVALID");
    }
    const client = await this.pool.connect() as ClientLikeV1;
    try {
      await client.query("BEGIN");
      const base = canonicalHour(input.claim.base_target_t, "FORMAL_FORCING_CLAIM_BASE_INVALID");
      const target = await this.targetForUpdate(client, base);
      if (!target) throw new Error("FORMAL_FORCING_TARGET_REQUIRED");
      this.assertTargetIdentity(target, base);
      if (target.claim_owner !== input.claim.lease_owner || BigInt(target.fencing_token) !== input.claim.fencing_token || !ACTIVE_STATES.has(target.state)) {
        throw new Error("FORMAL_FORCING_STALE_FENCING_TOKEN");
      }
      const now = await databaseNow(client);
      if (Date.parse(now) >= Date.parse(base)) throw new Error("FORMAL_FORCING_HEARTBEAT_AFTER_CAUSAL_DEADLINE");
      const proposed = new Date(Math.min(Date.parse(now) + input.lease_duration_seconds * 1000, Date.parse(base))).toISOString();
      const currentExpiry = target.lease_expires_at ? iso(target.lease_expires_at) : now;
      const nextExpiry = Date.parse(proposed) > Date.parse(currentExpiry) ? proposed : currentExpiry;
      await client.query(
        `UPDATE twin_external_formal_forcing_base_target_v1 SET lease_expires_at=$9::timestamptz,updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz`,
        [...scopeValues(this.config.scope), this.config.epoch_id, base, nextExpiry],
      );
      target.lease_expires_at = nextExpiry;
      const claim = claimFromTarget(this.config, target);
      await client.query("COMMIT");
      return claim;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  async advanceClaimPhase(input: { claim: ExternalFormalForcingBaseClaimV1; phase: "ACQUIRING" | "READY_TO_FINALIZE" | "PROMOTING" }): Promise<void> {
    const allowed: Record<typeof input.phase, readonly ExternalFormalForcingBaseStateV1[]> = {
      ACQUIRING: ["CLAIMED", "ACQUIRING"],
      READY_TO_FINALIZE: ["ACQUIRING", "READY_TO_FINALIZE"],
      PROMOTING: ["READY_TO_FINALIZE", "PROMOTING"],
    };
    const timestampColumn = input.phase === "ACQUIRING" ? "acquisition_started_at" : input.phase === "READY_TO_FINALIZE" ? "ready_to_finalize_at" : "promotion_started_at";
    const client = await this.pool.connect() as ClientLikeV1;
    try {
      await client.query("BEGIN");
      const base = canonicalHour(input.claim.base_target_t, "FORMAL_FORCING_CLAIM_BASE_INVALID");
      const target = await this.targetForUpdate(client, base);
      if (!target) throw new Error("FORMAL_FORCING_TARGET_REQUIRED");
      this.assertTargetIdentity(target, base);
      if (target.claim_owner !== input.claim.lease_owner || BigInt(target.fencing_token) !== input.claim.fencing_token) throw new Error("FORMAL_FORCING_STALE_FENCING_TOKEN");
      if (!allowed[input.phase].includes(target.state)) throw new Error(`FORMAL_FORCING_PHASE_TRANSITION_INVALID:${target.state}:${input.phase}`);
      const now = await databaseNow(client);
      if (Date.parse(now) >= Date.parse(base) || !target.lease_expires_at || Date.parse(iso(target.lease_expires_at)) <= Date.parse(now)) {
        throw new Error("FORMAL_FORCING_PHASE_REQUIRES_LIVE_PREDEADLINE_LEASE");
      }
      await client.query(
        `UPDATE twin_external_formal_forcing_base_target_v1
            SET state=$9,${timestampColumn}=COALESCE(${timestampColumn},clock_timestamp()),updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz`,
        [...scopeValues(this.config.scope), this.config.epoch_id, base, input.phase],
      );
      await client.query("COMMIT");
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  async markRetryableFailure(input: { claim: ExternalFormalForcingBaseClaimV1; failure_class: string }): Promise<void> {
    const failureClass = requiredText(input.failure_class, "FORMAL_FORCING_FAILURE_CLASS_REQUIRED");
    const client = await this.pool.connect() as ClientLikeV1;
    try {
      await client.query("BEGIN");
      const base = canonicalHour(input.claim.base_target_t, "FORMAL_FORCING_CLAIM_BASE_INVALID");
      const target = await this.targetForUpdate(client, base);
      if (!target) throw new Error("FORMAL_FORCING_TARGET_REQUIRED");
      if (target.claim_owner !== input.claim.lease_owner || BigInt(target.fencing_token) !== input.claim.fencing_token || !ACTIVE_STATES.has(target.state)) {
        throw new Error("FORMAL_FORCING_STALE_FENCING_TOKEN");
      }
      const now = await databaseNow(client);
      if (Date.parse(now) >= Date.parse(base)) throw new Error("FORMAL_FORCING_RETRYABLE_FAILURE_AFTER_DEADLINE_FORBIDDEN");
      await client.query(
        `UPDATE twin_external_formal_forcing_base_target_v1
            SET state='FAILED_RETRYABLE',failure_class=$9,lease_expires_at=clock_timestamp(),updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz`,
        [...scopeValues(this.config.scope), this.config.epoch_id, base, failureClass],
      );
      await client.query("COMMIT");
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  async attestFormalPhysicalVisibility(input: {
    claim: ExternalFormalForcingBaseClaimV1;
    facts: readonly ExternalFormalPhysicalFactIdentityV1[];
    producer_run_id: string;
    promotion_run_id: string;
    candidate_artifact_digest: string;
  }): Promise<ExternalFormalPhysicalIngressAttestationV1> {
    const base = canonicalHour(input.claim.base_target_t, "FORMAL_PHYSICAL_ATTESTATION_BASE_INVALID");
    if (!sameScope(input.claim.scope, this.config.scope) || input.claim.epoch_id !== this.config.epoch_id || input.claim.subject_sha !== this.config.subject_sha) {
      throw new Error("FORMAL_PHYSICAL_ATTESTATION_CLAIM_SCOPE_OR_EPOCH_MISMATCH");
    }
    const producerRun = requiredText(input.producer_run_id, "FORMAL_PHYSICAL_PRODUCER_RUN_ID_REQUIRED");
    const promotionRun = requiredText(input.promotion_run_id, "FORMAL_PHYSICAL_PROMOTION_RUN_ID_REQUIRED");
    const artifactDigest = requiredText(input.candidate_artifact_digest, "FORMAL_PHYSICAL_ARTIFACT_DIGEST_REQUIRED");
    if (!/^sha256:[0-9a-f]{64}$/.test(artifactDigest)) throw new Error("FORMAL_PHYSICAL_ARTIFACT_DIGEST_INVALID");
    if (!Array.isArray(input.facts) || input.facts.length !== 3 || new Set(input.facts.map((item) => item.kind)).size !== 3) {
      throw new Error("FORMAL_PHYSICAL_EXACT_WEATHER_ET0_SOIL_FACTS_REQUIRED");
    }
    for (const item of input.facts) {
      requiredText(item.fact_id, `FORMAL_PHYSICAL_FACT_ID_REQUIRED:${item.kind}`);
      requiredText(item.source_record_id, `FORMAL_PHYSICAL_SOURCE_RECORD_ID_REQUIRED:${item.kind}`);
      requiredText(item.source_record_hash, `FORMAL_PHYSICAL_SOURCE_RECORD_HASH_REQUIRED:${item.kind}`);
      requiredText(item.record_semantic_hash, `FORMAL_PHYSICAL_RECORD_SEMANTIC_HASH_REQUIRED:${item.kind}`);
    }

    // This transaction starts only after the caller's facts ingress transactions have committed.
    // The DB clock is read after exact fact identity readback, producing an upper-bound time at
    // which all three committed facts were observably visible to a fresh database transaction.
    const reader = await this.pool.connect() as ClientLikeV1;
    let readbackAt: string;
    try {
      await reader.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const rows = await reader.query<FactRowV1>(
        "SELECT fact_id,record_json FROM facts WHERE fact_id=ANY($1::text[]) ORDER BY fact_id ASC",
        [input.facts.map((item) => item.fact_id)],
      );
      if (rows.rows.length !== 3) throw new Error(`FORMAL_PHYSICAL_FACT_READBACK_CARDINALITY:${rows.rows.length}`);
      const byId = new Map(rows.rows.map((row) => [row.fact_id, row.record_json]));
      for (const identity of input.facts) {
        if (!byId.has(identity.fact_id)) throw new Error(`FORMAL_PHYSICAL_FACT_NOT_VISIBLE:${identity.kind}`);
        validatePhysicalFactPayload(identity, byId.get(identity.fact_id), base);
      }
      readbackAt = await databaseNow(reader);
      if (Date.parse(readbackAt) >= Date.parse(base)) throw new Error(`FORMAL_PHYSICAL_VISIBILITY_AFTER_CAUSAL_BASE:${readbackAt}:${base}`);
      await reader.query("COMMIT");
    } catch (error) {
      try { await reader.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      reader.release();
    }

    const writer = await this.pool.connect() as ClientLikeV1;
    try {
      await writer.query("BEGIN");
      const target = await this.targetForUpdate(writer, base);
      if (!target) throw new Error("FORMAL_PHYSICAL_TARGET_REQUIRED");
      this.assertTargetIdentity(target, base);
      const cursor = await this.cursorForUpdate(writer);

      if (target.state === "FORMAL_VISIBLE_ATTESTED") {
        const existingFacts = [
          ["WEATHER", target.weather_fact_id, target.weather_source_record_hash, target.weather_record_semantic_hash],
          ["ET0", target.et0_fact_id, target.et0_source_record_hash, target.et0_record_semantic_hash],
          ["SOIL", target.soil_fact_id, target.soil_source_record_hash, target.soil_record_semantic_hash],
        ].map(([kind, fact_id, source_record_hash, record_semantic_hash]) => ({ kind, fact_id, source_record_hash, record_semantic_hash }));
        for (const identity of input.facts) {
          const existing = existingFacts.find((item) => item.kind === identity.kind);
          if (!existing || existing.fact_id !== identity.fact_id || existing.source_record_hash !== identity.source_record_hash || existing.record_semantic_hash !== identity.record_semantic_hash) {
            throw new Error("FORMAL_PHYSICAL_EXISTING_ATTESTATION_CONFLICT");
          }
        }
        const result: ExternalFormalPhysicalIngressAttestationV1 = {
          attestation_id: MCFT_CAP09_FORMAL_PHYSICAL_INGRESS_ATTESTATION_ID_V1,
          status: "PASS",
          scope: { ...this.config.scope },
          epoch_id: this.config.epoch_id,
          subject_sha: this.config.subject_sha,
          base_target_t: base,
          causal_deadline: base,
          producer_run_id: requiredText(target.producer_run_id, "FORMAL_PHYSICAL_EXISTING_PRODUCER_RUN_REQUIRED"),
          promotion_run_id: requiredText(target.promotion_run_id, "FORMAL_PHYSICAL_EXISTING_PROMOTION_RUN_REQUIRED"),
          candidate_artifact_digest: requiredText(target.candidate_artifact_digest, "FORMAL_PHYSICAL_EXISTING_ARTIFACT_REQUIRED"),
          facts: input.facts.map((item) => ({ ...item })),
          post_commit_db_readback_at: iso(target.post_commit_db_readback_at!),
          formal_visible_attested_at: iso(target.formal_visible_attested_at!),
          physical_visibility_before_base: true,
          cursor_advanced: false,
          next_missing_required_base: cursor.next_missing_required_base === null ? null : iso(cursor.next_missing_required_base),
        };
        await writer.query("COMMIT");
        return result;
      }

      if (target.state !== "PROMOTING" || target.claim_owner !== input.claim.lease_owner || BigInt(target.fencing_token) !== input.claim.fencing_token) {
        throw new Error("FORMAL_PHYSICAL_ATTESTATION_REQUIRES_CURRENT_PROMOTING_FENCE");
      }
      const now = await databaseNow(writer);
      if (Date.parse(now) >= Date.parse(base) || !target.lease_expires_at || Date.parse(iso(target.lease_expires_at)) <= Date.parse(now)) {
        throw new Error("FORMAL_PHYSICAL_ATTESTATION_REQUIRES_LIVE_PREDEADLINE_LEASE");
      }
      if (cursor.next_missing_required_base === null || iso(cursor.next_missing_required_base) !== base) {
        throw new Error("FORMAL_PHYSICAL_ATTESTATION_MUST_MATCH_NEXT_MISSING_CONTIGUOUS_BASE");
      }

      const byKind = new Map(input.facts.map((item) => [item.kind, item]));
      const weather = byKind.get("WEATHER")!;
      const et0 = byKind.get("ET0")!;
      const soil = byKind.get("SOIL")!;
      const updated = await writer.query<{ formal_visible_attested_at: string | Date }>(
        `UPDATE twin_external_formal_forcing_base_target_v1
            SET state='FORMAL_VISIBLE_ATTESTED',producer_run_id=$9,promotion_run_id=$10,candidate_artifact_digest=$11,
                weather_fact_id=$12,weather_source_record_hash=$13,weather_record_semantic_hash=$14,
                et0_fact_id=$15,et0_source_record_hash=$16,et0_record_semantic_hash=$17,
                soil_fact_id=$18,soil_source_record_hash=$19,soil_record_semantic_hash=$20,
                post_commit_db_readback_at=$21::timestamptz,formal_visible_attested_at=clock_timestamp(),failure_class=NULL,updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz
          RETURNING formal_visible_attested_at`,
        [
          ...scopeValues(this.config.scope), this.config.epoch_id, base,
          producerRun, promotionRun, artifactDigest,
          weather.fact_id, weather.source_record_hash, weather.record_semantic_hash,
          et0.fact_id, et0.source_record_hash, et0.record_semantic_hash,
          soil.fact_id, soil.source_record_hash, soil.record_semantic_hash,
          readbackAt,
        ],
      );
      if (updated.rows.length !== 1) throw new Error("FORMAL_PHYSICAL_ATTESTATION_UPDATE_REQUIRED");
      const attestedAt = iso(updated.rows[0].formal_visible_attested_at);
      if (Date.parse(attestedAt) >= Date.parse(base)) throw new Error("FORMAL_PHYSICAL_ATTESTATION_PERSISTED_AFTER_CAUSAL_BASE");

      const lastRequired = iso(cursor.last_required_base);
      const completes = base === lastRequired;
      const next = completes ? null : addHours(base, 1);
      await writer.query(
        `UPDATE twin_external_formal_forcing_base_cursor_v1
            SET last_contiguous_eligible_base=$8::timestamptz,next_missing_required_base=$9::timestamptz,completed=$10,updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7`,
        [...scopeValues(this.config.scope), this.config.epoch_id, base, next, completes],
      );
      await writer.query("COMMIT");
      return {
        attestation_id: MCFT_CAP09_FORMAL_PHYSICAL_INGRESS_ATTESTATION_ID_V1,
        status: "PASS",
        scope: { ...this.config.scope },
        epoch_id: this.config.epoch_id,
        subject_sha: this.config.subject_sha,
        base_target_t: base,
        causal_deadline: base,
        producer_run_id: producerRun,
        promotion_run_id: promotionRun,
        candidate_artifact_digest: artifactDigest,
        facts: input.facts.map((item) => ({ ...item })),
        post_commit_db_readback_at: readbackAt,
        formal_visible_attested_at: attestedAt,
        physical_visibility_before_base: true,
        cursor_advanced: true,
        next_missing_required_base: next,
      };
    } catch (error) {
      try { await writer.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      writer.release();
    }
  }
}
