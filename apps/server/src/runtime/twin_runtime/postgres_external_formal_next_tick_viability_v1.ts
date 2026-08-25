import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";

import type { ShadowOnlineBoundaryV1, TwinScopeKeyV1 } from "./ports.js";

export const MCFT_CAP09_FORMAL_NEXT_TICK_VIABILITY_ID_V1 =
  "NEXT_TICK_FORCING_VIABILITY_V1" as const;
export const MCFT_CAP09_FORMAL_SUCCESSOR_TERMINAL_ADJUDICATION_ID_V1 =
  "SUCCESSOR_FORCING_VIABILITY_AT_PREDECESSOR_TERMINALIZATION_V1" as const;

export type ExternalFormalNextTickViabilityFailureV1 =
  | "RUNTIME_CURSOR_MISSING"
  | "RUNTIME_CURSOR_BOUNDARY_MISMATCH"
  | "FORCING_CURSOR_MISSING"
  | "FORCING_CURSOR_CONFIG_CONFLICT"
  | "FORCING_CURSOR_BEHIND_REQUIRED_BASE"
  | "REQUIRED_FORCING_BASE_TERMINAL"
  | "REQUIRED_FORCING_BASE_ATTESTATION_MISSING"
  | "REQUIRED_FORCING_BASE_ATTESTATION_LATE";

export type ExternalFormalNextTickViabilityResultV1 =
  | {
      viability_id: typeof MCFT_CAP09_FORMAL_NEXT_TICK_VIABILITY_ID_V1;
      status: "PASS";
      slot_id: string;
      logical_time: string;
      mode: "A0_WARM_START";
      required_forcing_base: null;
      runtime_cursor_verified: true;
      forcing_cursor_verified: false;
      physical_ingress_attestation_verified: false;
    }
  | {
      viability_id: typeof MCFT_CAP09_FORMAL_NEXT_TICK_VIABILITY_ID_V1;
      status: "PASS";
      slot_id: string;
      logical_time: string;
      mode: "POST_A0_EXACT_PREDECESSOR_FORCING_BASE";
      required_forcing_base: string;
      runtime_cursor_verified: true;
      forcing_cursor_verified: true;
      physical_ingress_attestation_verified: true;
      forcing_last_contiguous_eligible_base: string;
      post_commit_db_readback_at: string;
      formal_visible_attested_at: string;
    }
  | {
      viability_id: typeof MCFT_CAP09_FORMAL_NEXT_TICK_VIABILITY_ID_V1;
      status: "NOT_VIABLE";
      slot_id: string;
      logical_time: string;
      required_forcing_base: string | null;
      reason: ExternalFormalNextTickViabilityFailureV1;
      detail: string;
    };

export type ExternalFormalSuccessorTerminalAdjudicationResultV1 =
  | {
      adjudication_id: typeof MCFT_CAP09_FORMAL_SUCCESSOR_TERMINAL_ADJUDICATION_ID_V1;
      status: "NO_SUCCESSOR";
      terminal_slot_id: "O23";
      terminal_logical_time: string;
      forcing_target_terminalized: false;
    }
  | {
      adjudication_id: typeof MCFT_CAP09_FORMAL_SUCCESSOR_TERMINAL_ADJUDICATION_ID_V1;
      status: "SUCCESSOR_VIABLE";
      terminal_slot_id: string;
      terminal_logical_time: string;
      successor_slot_id: string;
      successor_logical_time: string;
      required_forcing_base: string;
      forcing_target_terminalized: false;
      viability: Extract<ExternalFormalNextTickViabilityResultV1, { status: "PASS" }>;
    }
  | {
      adjudication_id: typeof MCFT_CAP09_FORMAL_SUCCESSOR_TERMINAL_ADJUDICATION_ID_V1;
      status: "SUCCESSOR_NOT_VIABLE";
      terminal_slot_id: string;
      terminal_logical_time: string;
      successor_slot_id: string;
      successor_logical_time: string;
      required_forcing_base: string;
      forcing_target_terminalized: boolean;
      viability: Extract<ExternalFormalNextTickViabilityResultV1, { status: "NOT_VIABLE" }>;
    };

export type ExternalFormalNextTickViabilityPortV1 = {
  checkPreclaimViability(boundary: ShadowOnlineBoundaryV1): Promise<ExternalFormalNextTickViabilityResultV1>;
};

export type ExternalFormalTerminalSuccessorViabilityPortV1 = ExternalFormalNextTickViabilityPortV1 & {
  adjudicateSuccessorAfterTerminal(input: {
    terminal_boundary: ShadowOnlineBoundaryV1;
    terminal_at: string;
  }): Promise<ExternalFormalSuccessorTerminalAdjudicationResultV1>;
};

export type PostgresExternalFormalNextTickViabilityConfigV1 = {
  scope: TwinScopeKeyV1;
  epoch_id: string;
  subject_sha: string;
  o00_logical_time: string;
};

type PoolV1 = Pick<Pool, "query" | "connect">;
type ClientV1 = Pick<PoolClient, "query" | "release">;
type RuntimeCursorRowV1 = {
  schedule_start_logical_time: string | Date;
  next_slot_index: number;
  next_slot_id: string | null;
  next_logical_time: string | Date | null;
};
type ForcingCursorRowV1 = {
  subject_sha: string;
  first_required_base: string | Date;
  last_required_base: string | Date;
  last_contiguous_eligible_base: string | Date;
  next_missing_required_base: string | Date | null;
  completed: boolean;
};
type ForcingTargetRowV1 = {
  subject_sha: string;
  state: string;
  failure_class: string | null;
  post_commit_db_readback_at: string | Date | null;
  formal_visible_attested_at: string | Date | null;
  weather_fact_id: string | null;
  weather_source_record_hash: string | null;
  weather_record_semantic_hash: string | null;
  et0_fact_id: string | null;
  et0_source_record_hash: string | null;
  et0_record_semantic_hash: string | null;
  soil_fact_id: string | null;
  soil_source_record_hash: string | null;
  soil_record_semantic_hash: string | null;
};
type TerminalTargetRowV1 = {
  subject_sha: string;
  state: string;
  idempotency_key: string;
};

type SlotIdentityV1 = { slot_id: string; logical_time: string };

const SCOPE_KEYS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;
const HOUR_MS = 3_600_000;
const LATCHABLE_FAILURES = new Set<ExternalFormalNextTickViabilityFailureV1>([
  "FORCING_CURSOR_BEHIND_REQUIRED_BASE",
  "REQUIRED_FORCING_BASE_TERMINAL",
  "REQUIRED_FORCING_BASE_ATTESTATION_MISSING",
  "REQUIRED_FORCING_BASE_ATTESTATION_LATE",
]);

function text(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function iso(value: string | Date): string {
  return new Date(value).toISOString();
}
function canonicalIso(value: unknown, code: string): string {
  const raw = text(value, code);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== raw) throw new Error(code);
  return raw;
}
function hour(value: unknown, code: string): string {
  const raw = canonicalIso(value, code);
  if (!raw.endsWith(":00:00.000Z")) throw new Error(code);
  return raw;
}
function addHours(value: string, count: number): string {
  return new Date(Date.parse(value) + count * HOUR_MS).toISOString();
}
function scopeValues(scope: TwinScopeKeyV1): string[] {
  return SCOPE_KEYS.map((key) => text(scope[key], `NEXT_TICK_VIABILITY_SCOPE_${key.toUpperCase()}_REQUIRED`));
}
function sameScope(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return SCOPE_KEYS.every((key) => left[key] === right[key]);
}
function slotIndex(slotId: string): number {
  if (!/^O(?:0[0-9]|1[0-9]|2[0-3])$/.test(slotId)) throw new Error("NEXT_TICK_VIABILITY_SLOT_ID_INVALID");
  return Number(slotId.slice(1));
}
function slotId(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 23) throw new Error("NEXT_TICK_VIABILITY_SLOT_INDEX_INVALID");
  return `O${String(index).padStart(2, "0")}`;
}
function fail(slot: SlotIdentityV1, base: string | null, reason: ExternalFormalNextTickViabilityFailureV1, detail: string): ExternalFormalNextTickViabilityResultV1 {
  return {
    viability_id: MCFT_CAP09_FORMAL_NEXT_TICK_VIABILITY_ID_V1,
    status: "NOT_VIABLE",
    slot_id: slot.slot_id,
    logical_time: slot.logical_time,
    required_forcing_base: base,
    reason,
    detail,
  };
}
function targetIdempotencyKey(config: PostgresExternalFormalNextTickViabilityConfigV1, base: string): string {
  const seed = JSON.stringify({ scope: config.scope, epoch_id: config.epoch_id, subject_sha: config.subject_sha, base_target_t: base });
  return `formal-forcing-base:${crypto.createHash("sha256").update(seed, "utf8").digest("hex")}`;
}

export class PostgresExternalFormalNextTickViabilityV1 implements ExternalFormalTerminalSuccessorViabilityPortV1 {
  private readonly config: PostgresExternalFormalNextTickViabilityConfigV1;

  constructor(private readonly pool: PoolV1, config: PostgresExternalFormalNextTickViabilityConfigV1) {
    scopeValues(config.scope);
    const epoch = text(config.epoch_id, "NEXT_TICK_VIABILITY_EPOCH_REQUIRED");
    const subject = text(config.subject_sha, "NEXT_TICK_VIABILITY_SUBJECT_REQUIRED");
    if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("NEXT_TICK_VIABILITY_SUBJECT_INVALID");
    this.config = {
      scope: { ...config.scope },
      epoch_id: epoch,
      subject_sha: subject,
      o00_logical_time: hour(config.o00_logical_time, "NEXT_TICK_VIABILITY_O00_INVALID"),
    };
  }

  private async evaluateSlot(index: number, slot: SlotIdentityV1): Promise<ExternalFormalNextTickViabilityResultV1> {
    const runtime = await this.pool.query<RuntimeCursorRowV1>(
      `SELECT schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time
         FROM twin_shadow_online_scheduler_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      scopeValues(this.config.scope),
    );
    if (runtime.rows.length !== 1) {
      return fail(slot, index === 0 ? null : addHours(slot.logical_time, -1), "RUNTIME_CURSOR_MISSING", `runtime_cursor_count=${runtime.rows.length}`);
    }
    const runtimeRow = runtime.rows[0];
    const runtimeMatches =
      iso(runtimeRow.schedule_start_logical_time) === this.config.o00_logical_time
      && runtimeRow.next_slot_index === index
      && runtimeRow.next_slot_id === slot.slot_id
      && runtimeRow.next_logical_time !== null
      && iso(runtimeRow.next_logical_time) === slot.logical_time;
    if (!runtimeMatches) {
      return fail(slot, index === 0 ? null : addHours(slot.logical_time, -1), "RUNTIME_CURSOR_BOUNDARY_MISMATCH", JSON.stringify({
        next_slot_index: runtimeRow.next_slot_index,
        next_slot_id: runtimeRow.next_slot_id,
        next_logical_time: runtimeRow.next_logical_time === null ? null : iso(runtimeRow.next_logical_time),
      }));
    }

    if (index === 0) {
      return {
        viability_id: MCFT_CAP09_FORMAL_NEXT_TICK_VIABILITY_ID_V1,
        status: "PASS",
        slot_id: slot.slot_id,
        logical_time: slot.logical_time,
        mode: "A0_WARM_START",
        required_forcing_base: null,
        runtime_cursor_verified: true,
        forcing_cursor_verified: false,
        physical_ingress_attestation_verified: false,
      };
    }

    const requiredBase = addHours(slot.logical_time, -1);
    const forcing = await this.pool.query<ForcingCursorRowV1>(
      `SELECT subject_sha,first_required_base,last_required_base,last_contiguous_eligible_base,next_missing_required_base,completed
         FROM twin_external_formal_forcing_base_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7`,
      [...scopeValues(this.config.scope), this.config.epoch_id],
    );
    if (forcing.rows.length !== 1) {
      return fail(slot, requiredBase, "FORCING_CURSOR_MISSING", `forcing_cursor_count=${forcing.rows.length}`);
    }
    const forcingRow = forcing.rows[0];
    const expectedFirst = this.config.o00_logical_time;
    const expectedLast = addHours(this.config.o00_logical_time, 22);
    if (
      forcingRow.subject_sha !== this.config.subject_sha
      || iso(forcingRow.first_required_base) !== expectedFirst
      || iso(forcingRow.last_required_base) !== expectedLast
    ) {
      return fail(slot, requiredBase, "FORCING_CURSOR_CONFIG_CONFLICT", JSON.stringify({
        subject_sha: forcingRow.subject_sha,
        first_required_base: iso(forcingRow.first_required_base),
        last_required_base: iso(forcingRow.last_required_base),
      }));
    }
    const lastContiguous = iso(forcingRow.last_contiguous_eligible_base);
    if (Date.parse(lastContiguous) < Date.parse(requiredBase)) {
      const targetFailure = await this.pool.query<{ state: string; failure_class: string | null }>(
        `SELECT state,failure_class FROM twin_external_formal_forcing_base_target_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz`,
        [...scopeValues(this.config.scope), this.config.epoch_id, requiredBase],
      );
      if (targetFailure.rows.length === 1 && targetFailure.rows[0].state === "DEADLINE_MISSED_TERMINAL") {
        return fail(slot, requiredBase, "REQUIRED_FORCING_BASE_TERMINAL", targetFailure.rows[0].failure_class ?? "UNKNOWN_TERMINAL_FAILURE");
      }
      return fail(slot, requiredBase, "FORCING_CURSOR_BEHIND_REQUIRED_BASE", `last_contiguous_eligible_base=${lastContiguous}`);
    }

    const target = await this.pool.query<ForcingTargetRowV1>(
      `SELECT subject_sha,state,failure_class,post_commit_db_readback_at,formal_visible_attested_at,
              weather_fact_id,weather_source_record_hash,weather_record_semantic_hash,
              et0_fact_id,et0_source_record_hash,et0_record_semantic_hash,
              soil_fact_id,soil_source_record_hash,soil_record_semantic_hash
         FROM twin_external_formal_forcing_base_target_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz`,
      [...scopeValues(this.config.scope), this.config.epoch_id, requiredBase],
    );
    if (target.rows.length !== 1) {
      return fail(slot, requiredBase, "REQUIRED_FORCING_BASE_ATTESTATION_MISSING", `target_count=${target.rows.length}`);
    }
    const row = target.rows[0];
    if (row.state === "DEADLINE_MISSED_TERMINAL") {
      return fail(slot, requiredBase, "REQUIRED_FORCING_BASE_TERMINAL", row.failure_class ?? "UNKNOWN_TERMINAL_FAILURE");
    }
    const identityComplete = [
      row.weather_fact_id,row.weather_source_record_hash,row.weather_record_semantic_hash,
      row.et0_fact_id,row.et0_source_record_hash,row.et0_record_semantic_hash,
      row.soil_fact_id,row.soil_source_record_hash,row.soil_record_semantic_hash,
    ].every((value) => typeof value === "string" && value.length > 0);
    if (row.subject_sha !== this.config.subject_sha || row.state !== "FORMAL_VISIBLE_ATTESTED" || !identityComplete || row.post_commit_db_readback_at === null || row.formal_visible_attested_at === null) {
      return fail(slot, requiredBase, "REQUIRED_FORCING_BASE_ATTESTATION_MISSING", `state=${row.state};identity_complete=${identityComplete}`);
    }
    const readbackAt = iso(row.post_commit_db_readback_at);
    const attestedAt = iso(row.formal_visible_attested_at);
    if (Date.parse(readbackAt) >= Date.parse(requiredBase) || Date.parse(attestedAt) >= Date.parse(requiredBase)) {
      return fail(slot, requiredBase, "REQUIRED_FORCING_BASE_ATTESTATION_LATE", `readback=${readbackAt};attested=${attestedAt};base=${requiredBase}`);
    }

    return {
      viability_id: MCFT_CAP09_FORMAL_NEXT_TICK_VIABILITY_ID_V1,
      status: "PASS",
      slot_id: slot.slot_id,
      logical_time: slot.logical_time,
      mode: "POST_A0_EXACT_PREDECESSOR_FORCING_BASE",
      required_forcing_base: requiredBase,
      runtime_cursor_verified: true,
      forcing_cursor_verified: true,
      physical_ingress_attestation_verified: true,
      forcing_last_contiguous_eligible_base: lastContiguous,
      post_commit_db_readback_at: readbackAt,
      formal_visible_attested_at: attestedAt,
    };
  }

  private async latchDeadlineMiss(requiredBase: string): Promise<boolean> {
    const client = await this.pool.connect() as ClientV1;
    try {
      await client.query("BEGIN");
      const nowRow = (await client.query<{ database_now: string | Date }>("SELECT clock_timestamp() AS database_now")).rows[0];
      if (!nowRow) throw new Error("SUCCESSOR_VIABILITY_DATABASE_CLOCK_REQUIRED");
      const databaseNow = iso(nowRow.database_now);
      if (Date.parse(databaseNow) < Date.parse(requiredBase)) throw new Error("SUCCESSOR_VIABILITY_DEADLINE_NOT_YET_REACHED");
      const params = [...scopeValues(this.config.scope), this.config.epoch_id, requiredBase];
      let target = await client.query<TerminalTargetRowV1>(
        `SELECT subject_sha,state,idempotency_key
           FROM twin_external_formal_forcing_base_target_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz
          FOR UPDATE`,
        params,
      );
      const expectedKey = targetIdempotencyKey(this.config, requiredBase);
      if (target.rows.length > 1) throw new Error("SUCCESSOR_VIABILITY_TARGET_CARDINALITY_VIOLATION");
      if (target.rows.length === 0) {
        await client.query(
          `INSERT INTO twin_external_formal_forcing_base_target_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,base_target_t,causal_deadline,state,idempotency_key,failure_class)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$9,$8::timestamptz,$8::timestamptz,'DEADLINE_MISSED_TERMINAL',$10,'REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED')`,
          [...params, this.config.subject_sha, expectedKey],
        );
        await client.query("COMMIT");
        return true;
      }
      const row = target.rows[0];
      if (row.subject_sha !== this.config.subject_sha || row.idempotency_key !== expectedKey) throw new Error("SUCCESSOR_VIABILITY_TARGET_IDENTITY_CONFLICT");
      if (row.state === "FORMAL_VISIBLE_ATTESTED") {
        await client.query("COMMIT");
        return false;
      }
      await client.query(
        `UPDATE twin_external_formal_forcing_base_target_v1
            SET state='DEADLINE_MISSED_TERMINAL',failure_class='REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED',lease_expires_at=NULL,updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz`,
        params,
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  async checkPreclaimViability(boundary: ShadowOnlineBoundaryV1): Promise<ExternalFormalNextTickViabilityResultV1> {
    if (!sameScope(boundary.scope, this.config.scope)) throw new Error("NEXT_TICK_VIABILITY_BOUNDARY_SCOPE_MISMATCH");
    if (boundary.interval_seconds !== 3600) throw new Error("NEXT_TICK_VIABILITY_PT1H_REQUIRED");
    const index = slotIndex(boundary.slot_id);
    const logicalTime = hour(boundary.logical_time, "NEXT_TICK_VIABILITY_LOGICAL_TIME_INVALID");
    const expectedLogical = addHours(this.config.o00_logical_time, index);
    if (logicalTime !== expectedLogical) throw new Error("NEXT_TICK_VIABILITY_SLOT_TIME_MISMATCH");
    return this.evaluateSlot(index, { slot_id: boundary.slot_id, logical_time: logicalTime });
  }

  async adjudicateSuccessorAfterTerminal(input: {
    terminal_boundary: ShadowOnlineBoundaryV1;
    terminal_at: string;
  }): Promise<ExternalFormalSuccessorTerminalAdjudicationResultV1> {
    const boundary = input.terminal_boundary;
    if (!sameScope(boundary.scope, this.config.scope)) throw new Error("SUCCESSOR_VIABILITY_TERMINAL_SCOPE_MISMATCH");
    if (boundary.interval_seconds !== 3600) throw new Error("SUCCESSOR_VIABILITY_PT1H_REQUIRED");
    const terminalIndex = slotIndex(boundary.slot_id);
    const terminalLogical = hour(boundary.logical_time, "SUCCESSOR_VIABILITY_TERMINAL_LOGICAL_TIME_INVALID");
    if (terminalLogical !== addHours(this.config.o00_logical_time, terminalIndex)) throw new Error("SUCCESSOR_VIABILITY_TERMINAL_SLOT_TIME_MISMATCH");
    const terminalAt = canonicalIso(input.terminal_at, "SUCCESSOR_VIABILITY_TERMINAL_AT_INVALID");
    if (Date.parse(terminalAt) < Date.parse(terminalLogical)) throw new Error("SUCCESSOR_VIABILITY_TERMINAL_AT_PRECEDES_LOGICAL_TIME");
    if (terminalIndex === 23) {
      return {
        adjudication_id: MCFT_CAP09_FORMAL_SUCCESSOR_TERMINAL_ADJUDICATION_ID_V1,
        status: "NO_SUCCESSOR",
        terminal_slot_id: "O23",
        terminal_logical_time: terminalLogical,
        forcing_target_terminalized: false,
      };
    }

    const successorIndex = terminalIndex + 1;
    const successor = { slot_id: slotId(successorIndex), logical_time: addHours(this.config.o00_logical_time, successorIndex) };
    const viability = await this.evaluateSlot(successorIndex, successor);
    if (viability.status === "PASS") {
      if (viability.required_forcing_base === null) throw new Error("SUCCESSOR_VIABILITY_POST_A0_BASE_REQUIRED");
      return {
        adjudication_id: MCFT_CAP09_FORMAL_SUCCESSOR_TERMINAL_ADJUDICATION_ID_V1,
        status: "SUCCESSOR_VIABLE",
        terminal_slot_id: boundary.slot_id,
        terminal_logical_time: terminalLogical,
        successor_slot_id: successor.slot_id,
        successor_logical_time: successor.logical_time,
        required_forcing_base: viability.required_forcing_base,
        forcing_target_terminalized: false,
        viability,
      };
    }

    const requiredBase = viability.required_forcing_base ?? terminalLogical;
    let forcingTargetTerminalized = false;
    if (viability.required_forcing_base !== null && LATCHABLE_FAILURES.has(viability.reason)) {
      forcingTargetTerminalized = await this.latchDeadlineMiss(viability.required_forcing_base);
    }
    return {
      adjudication_id: MCFT_CAP09_FORMAL_SUCCESSOR_TERMINAL_ADJUDICATION_ID_V1,
      status: "SUCCESSOR_NOT_VIABLE",
      terminal_slot_id: boundary.slot_id,
      terminal_logical_time: terminalLogical,
      successor_slot_id: successor.slot_id,
      successor_logical_time: successor.logical_time,
      required_forcing_base: requiredBase,
      forcing_target_terminalized: forcingTargetTerminalized,
      viability,
    };
  }
}
