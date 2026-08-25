import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";

import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
  formalForcingAcquisitionStartDeadlineV1,
  type FormalForcingAcquisitionBudgetAdjudicationV1,
} from "../../domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";
import type {
  ExternalFormalForcingBaseClaimV1,
  ExternalFormalForcingBaseContinuityConfigV1,
} from "./postgres_external_formal_forcing_base_continuity_repository_v1.js";

export const MCFT_CAP09_FORMAL_FORCING_SUPPLY_ADMISSION_ID_V1 =
  "FORMAL_FORCING_SUPPLY_ADMISSION_V1" as const;
export const MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1 =
  "FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED" as const;

export type ExternalFormalForcingSupplyAdmissionConfigV1 = ExternalFormalForcingBaseContinuityConfigV1 & {
  qualified_budget: FormalForcingAcquisitionBudgetAdjudicationV1;
};

export type ExternalFormalForcingSupplyAdmissionResultV1 =
  | {
      admission_id: typeof MCFT_CAP09_FORMAL_FORCING_SUPPLY_ADMISSION_ID_V1;
      status: "CLAIMED" | "EXISTING_ACTIVE_CLAIM";
      claim: ExternalFormalForcingBaseClaimV1;
      acquisition_start_deadline: string;
      database_now: string;
    }
  | {
      admission_id: typeof MCFT_CAP09_FORMAL_FORCING_SUPPLY_ADMISSION_ID_V1;
      status: "BUSY";
      base_target_t: string;
      current_owner: string;
      lease_expires_at: string;
      acquisition_start_deadline: string;
      database_now: string;
    }
  | {
      admission_id: typeof MCFT_CAP09_FORMAL_FORCING_SUPPLY_ADMISSION_ID_V1;
      status: "TERMINAL_LATE_WAKE";
      base_target_t: string;
      acquisition_start_deadline: string;
      physical_visibility_deadline: string;
      database_now: string;
      failure_class:
        | typeof MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1
        | "REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED";
    }
  | {
      admission_id: typeof MCFT_CAP09_FORMAL_FORCING_SUPPLY_ADMISSION_ID_V1;
      status: "NO_WORK";
      reason: "FORCING_BASE_WINDOW_COMPLETE";
    };

type ClientV1 = Pick<PoolClient, "query" | "release">;
type PoolV1 = Pick<Pool, "connect">;

type CursorRowV1 = {
  subject_sha: string;
  first_required_base: string | Date;
  last_required_base: string | Date;
  next_missing_required_base: string | Date | null;
  completed: boolean;
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
  acquisition_budget_authority_id: string | null;
  selected_acquisition_budget_ms: string | number | bigint | null;
  acquisition_start_deadline: string | Date | null;
  controller_admitted_at: string | Date | null;
  failure_class: string | null;
};

const SCOPE_KEYS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;
const ACTIVE_STATES = new Set(["CLAIMED", "ACQUIRING", "READY_TO_FINALIZE", "PROMOTING"]);

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
  return SCOPE_KEYS.map((key) => text(scope[key], `FORMAL_FORCING_ADMISSION_SCOPE_${key.toUpperCase()}_REQUIRED`));
}

function validateConfig(input: ExternalFormalForcingSupplyAdmissionConfigV1): ExternalFormalForcingSupplyAdmissionConfigV1 {
  scopeValues(input.scope);
  const epoch = text(input.epoch_id, "FORMAL_FORCING_ADMISSION_EPOCH_REQUIRED");
  const subject = text(input.subject_sha, "FORMAL_FORCING_ADMISSION_SUBJECT_REQUIRED");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("FORMAL_FORCING_ADMISSION_SUBJECT_INVALID");
  const first = canonicalHour(input.first_required_base, "FORMAL_FORCING_ADMISSION_FIRST_BASE_INVALID");
  const last = canonicalHour(input.last_required_base, "FORMAL_FORCING_ADMISSION_LAST_BASE_INVALID");
  if (Date.parse(first) > Date.parse(last)) throw new Error("FORMAL_FORCING_ADMISSION_BASE_RANGE_INVALID");
  const budget = input.qualified_budget;
  if (!budget || budget.status !== "PASS") throw new Error("FORMAL_FORCING_ADMISSION_QUALIFIED_BUDGET_REQUIRED");
  if (budget.authority_id !== MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1) throw new Error("FORMAL_FORCING_ADMISSION_BUDGET_AUTHORITY_MISMATCH");
  if (!Number.isSafeInteger(budget.selected_budget_ms) || budget.selected_budget_ms <= 0) throw new Error("FORMAL_FORCING_ADMISSION_SELECTED_BUDGET_INVALID");
  if (budget.hardcoded_default_budget_minutes !== null) throw new Error("FORMAL_FORCING_ADMISSION_HARDCODED_DEFAULT_BUDGET_FORBIDDEN");
  return {
    scope: { ...input.scope },
    epoch_id: epoch,
    subject_sha: subject,
    first_required_base: first,
    last_required_base: last,
    qualified_budget: { ...budget },
  };
}

function idempotencyKey(config: ExternalFormalForcingSupplyAdmissionConfigV1, base: string): string {
  const seed = JSON.stringify({ scope: config.scope, epoch_id: config.epoch_id, subject_sha: config.subject_sha, base_target_t: base });
  return `formal-forcing-base:${crypto.createHash("sha256").update(seed, "utf8").digest("hex")}`;
}

async function databaseNow(client: ClientV1): Promise<string> {
  const row = (await client.query<{ database_now: string | Date }>("SELECT clock_timestamp() AS database_now")).rows[0];
  if (!row) throw new Error("FORMAL_FORCING_ADMISSION_DATABASE_CLOCK_REQUIRED");
  return iso(row.database_now);
}

function claimFromTarget(config: ExternalFormalForcingSupplyAdmissionConfigV1, row: TargetRowV1): ExternalFormalForcingBaseClaimV1 {
  if (!row.claim_owner || !row.lease_expires_at || BigInt(row.fencing_token) <= 0n || !ACTIVE_STATES.has(row.state)) {
    throw new Error("FORMAL_FORCING_ADMISSION_ACTIVE_CLAIM_CORRUPT");
  }
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

function assertAdmissionMetadata(config: ExternalFormalForcingSupplyAdmissionConfigV1, row: TargetRowV1, startDeadline: string): void {
  if (
    row.acquisition_budget_authority_id !== MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1
    || row.selected_acquisition_budget_ms === null
    || BigInt(row.selected_acquisition_budget_ms) !== BigInt(config.qualified_budget.selected_budget_ms)
    || row.acquisition_start_deadline === null
    || iso(row.acquisition_start_deadline) !== startDeadline
    || row.controller_admitted_at === null
  ) {
    throw new Error("FORMAL_FORCING_ADMISSION_EXISTING_TARGET_AUTHORITY_CONFLICT");
  }
}

export class PostgresExternalFormalForcingSupplyAdmissionV1 {
  private readonly config: ExternalFormalForcingSupplyAdmissionConfigV1;

  constructor(private readonly pool: PoolV1, config: ExternalFormalForcingSupplyAdmissionConfigV1) {
    this.config = validateConfig(config);
  }

  async claimNextRequiredBase(input: { lease_owner: string; lease_duration_seconds: number }): Promise<ExternalFormalForcingSupplyAdmissionResultV1> {
    const owner = text(input.lease_owner, "FORMAL_FORCING_ADMISSION_LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0 || input.lease_duration_seconds > 1800) {
      throw new Error("FORMAL_FORCING_ADMISSION_LEASE_DURATION_INVALID");
    }
    const client = await this.pool.connect() as ClientV1;
    try {
      await client.query("BEGIN");
      const cursorResult = await client.query<CursorRowV1>(
        `SELECT subject_sha,first_required_base,last_required_base,next_missing_required_base,completed
           FROM twin_external_formal_forcing_base_cursor_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7
          FOR UPDATE`,
        [...scopeValues(this.config.scope), this.config.epoch_id],
      );
      if (cursorResult.rows.length !== 1) throw new Error("FORMAL_FORCING_ADMISSION_CURSOR_REQUIRED");
      const cursor = cursorResult.rows[0];
      if (
        cursor.subject_sha !== this.config.subject_sha
        || iso(cursor.first_required_base) !== this.config.first_required_base
        || iso(cursor.last_required_base) !== this.config.last_required_base
      ) throw new Error("FORMAL_FORCING_ADMISSION_CURSOR_CONFIG_CONFLICT");
      if (cursor.completed || cursor.next_missing_required_base === null) {
        await client.query("COMMIT");
        return { admission_id: MCFT_CAP09_FORMAL_FORCING_SUPPLY_ADMISSION_ID_V1, status: "NO_WORK", reason: "FORCING_BASE_WINDOW_COMPLETE" };
      }

      const base = iso(cursor.next_missing_required_base);
      const startDeadline = formalForcingAcquisitionStartDeadlineV1(base, this.config.qualified_budget.selected_budget_ms);
      const now = await databaseNow(client);
      const targetParams = [...scopeValues(this.config.scope), this.config.epoch_id, base];
      let targetResult = await client.query<TargetRowV1>(
        `SELECT subject_sha,base_target_t,causal_deadline,state,claim_owner,fencing_token,lease_expires_at,idempotency_key,
                acquisition_budget_authority_id,selected_acquisition_budget_ms,acquisition_start_deadline,controller_admitted_at,failure_class
           FROM twin_external_formal_forcing_base_target_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz
          FOR UPDATE`,
        targetParams,
      );
      if (targetResult.rows.length > 1) throw new Error("FORMAL_FORCING_ADMISSION_TARGET_CARDINALITY_VIOLATION");
      if (targetResult.rows.length === 0) {
        await client.query(
          `INSERT INTO twin_external_formal_forcing_base_target_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,base_target_t,causal_deadline,state,idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$9,$8::timestamptz,$8::timestamptz,'REQUIRED',$10)`,
          [...targetParams, this.config.subject_sha, idempotencyKey(this.config, base)],
        );
        targetResult = await client.query<TargetRowV1>(
          `SELECT subject_sha,base_target_t,causal_deadline,state,claim_owner,fencing_token,lease_expires_at,idempotency_key,
                  acquisition_budget_authority_id,selected_acquisition_budget_ms,acquisition_start_deadline,controller_admitted_at,failure_class
             FROM twin_external_formal_forcing_base_target_v1
            WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz
            FOR UPDATE`,
          targetParams,
        );
      }
      if (targetResult.rows.length !== 1) throw new Error("FORMAL_FORCING_ADMISSION_TARGET_REQUIRED");
      let target = targetResult.rows[0];
      if (target.subject_sha !== this.config.subject_sha || iso(target.base_target_t) !== base || iso(target.causal_deadline) !== base) {
        throw new Error("FORMAL_FORCING_ADMISSION_TARGET_IDENTITY_CONFLICT");
      }
      if (target.state === "FORMAL_VISIBLE_ATTESTED") throw new Error("FORMAL_FORCING_ADMISSION_CURSOR_DID_NOT_ADVANCE_AFTER_ATTESTATION");
      if (target.state === "DEADLINE_MISSED_TERMINAL") {
        const failure = target.failure_class;
        if (failure !== MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1 && failure !== "REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED") {
          throw new Error("FORMAL_FORCING_ADMISSION_TERMINAL_FAILURE_CLASS_INVALID");
        }
        await client.query("COMMIT");
        return {
          admission_id: MCFT_CAP09_FORMAL_FORCING_SUPPLY_ADMISSION_ID_V1,
          status: "TERMINAL_LATE_WAKE",
          base_target_t: base,
          acquisition_start_deadline: startDeadline,
          physical_visibility_deadline: base,
          database_now: now,
          failure_class: failure,
        };
      }

      if (ACTIVE_STATES.has(target.state) && target.lease_expires_at && Date.parse(iso(target.lease_expires_at)) > Date.parse(now)) {
        assertAdmissionMetadata(this.config, target, startDeadline);
        if (target.claim_owner === owner) {
          const claim = claimFromTarget(this.config, target);
          await client.query("COMMIT");
          return {
            admission_id: MCFT_CAP09_FORMAL_FORCING_SUPPLY_ADMISSION_ID_V1,
            status: "EXISTING_ACTIVE_CLAIM",
            claim,
            acquisition_start_deadline: startDeadline,
            database_now: now,
          };
        }
        await client.query("COMMIT");
        return {
          admission_id: MCFT_CAP09_FORMAL_FORCING_SUPPLY_ADMISSION_ID_V1,
          status: "BUSY",
          base_target_t: base,
          current_owner: text(target.claim_owner, "FORMAL_FORCING_ADMISSION_BUSY_OWNER_REQUIRED"),
          lease_expires_at: iso(target.lease_expires_at),
          acquisition_start_deadline: startDeadline,
          database_now: now,
        };
      }

      const terminalFailure = Date.parse(now) >= Date.parse(base)
        ? "REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED" as const
        : Date.parse(now) > Date.parse(startDeadline)
          ? MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1
          : null;
      if (terminalFailure !== null) {
        await client.query(
          `UPDATE twin_external_formal_forcing_base_target_v1
              SET state='DEADLINE_MISSED_TERMINAL',failure_class=$9,lease_expires_at=NULL,
                  acquisition_budget_authority_id=CASE WHEN clock_timestamp() < causal_deadline THEN $10 ELSE acquisition_budget_authority_id END,
                  selected_acquisition_budget_ms=CASE WHEN clock_timestamp() < causal_deadline THEN $11::bigint ELSE selected_acquisition_budget_ms END,
                  acquisition_start_deadline=CASE WHEN clock_timestamp() < causal_deadline THEN $12::timestamptz ELSE acquisition_start_deadline END,
                  controller_admitted_at=CASE WHEN clock_timestamp() < causal_deadline THEN COALESCE(controller_admitted_at,clock_timestamp()) ELSE controller_admitted_at END,
                  updated_at=clock_timestamp()
            WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz`,
          [
            ...targetParams,
            terminalFailure,
            MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
            this.config.qualified_budget.selected_budget_ms,
            startDeadline,
          ],
        );
        await client.query("COMMIT");
        return {
          admission_id: MCFT_CAP09_FORMAL_FORCING_SUPPLY_ADMISSION_ID_V1,
          status: "TERMINAL_LATE_WAKE",
          base_target_t: base,
          acquisition_start_deadline: startDeadline,
          physical_visibility_deadline: base,
          database_now: now,
          failure_class: terminalFailure,
        };
      }

      if (target.acquisition_budget_authority_id !== null || target.selected_acquisition_budget_ms !== null || target.acquisition_start_deadline !== null || target.controller_admitted_at !== null) {
        assertAdmissionMetadata(this.config, target, startDeadline);
      }
      const nextFence = BigInt(target.fencing_token) + 1n;
      const leaseExpiresAt = new Date(Math.min(Date.parse(now) + input.lease_duration_seconds * 1000, Date.parse(base))).toISOString();
      const updated = await client.query<TargetRowV1>(
        `UPDATE twin_external_formal_forcing_base_target_v1
            SET state='CLAIMED',claim_owner=$9,fencing_token=$10::bigint,lease_expires_at=$11::timestamptz,
                claimed_at=clock_timestamp(),failure_class=NULL,
                acquisition_budget_authority_id=$12,selected_acquisition_budget_ms=$13::bigint,
                acquisition_start_deadline=$14::timestamptz,controller_admitted_at=COALESCE(controller_admitted_at,clock_timestamp()),
                updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz
          RETURNING subject_sha,base_target_t,causal_deadline,state,claim_owner,fencing_token,lease_expires_at,idempotency_key,
                    acquisition_budget_authority_id,selected_acquisition_budget_ms,acquisition_start_deadline,controller_admitted_at,failure_class`,
        [
          ...targetParams,
          owner,
          nextFence.toString(),
          leaseExpiresAt,
          MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
          this.config.qualified_budget.selected_budget_ms,
          startDeadline,
        ],
      );
      if (updated.rows.length !== 1) throw new Error("FORMAL_FORCING_ADMISSION_CLAIM_UPDATE_REQUIRED");
      target = updated.rows[0];
      assertAdmissionMetadata(this.config, target, startDeadline);
      const claim = claimFromTarget(this.config, target);
      await client.query("COMMIT");
      return {
        admission_id: MCFT_CAP09_FORMAL_FORCING_SUPPLY_ADMISSION_ID_V1,
        status: "CLAIMED",
        claim,
        acquisition_start_deadline: startDeadline,
        database_now: now,
      };
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }
}
