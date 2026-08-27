// MCFT-CAP-09 Production Hosting Phase 4: read-only successor viability.
//
// After one canonical slot is terminalized, this verifier proves that the durable
// RuntimeTickCursor and canonical checkpoint agree on the next logical tick.
// It does not own forcing acquisition, provider state, EvidenceSupplyCursor,
// scheduler mutation, or canonical writes.

import type { Pool, PoolClient } from "pg";

import type {
  ShadowOnlineSlotIdV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const MCFT_CAP09_TWIN_RUNTIME_SUCCESSOR_VIABILITY_ID_V1 =
  "MCFT_CAP09_TWIN_RUNTIME_SUCCESSOR_VIABILITY_V1" as const;

export type TwinRuntimeSuccessorViabilityResultV1 =
  | {
      viability_id: typeof MCFT_CAP09_TWIN_RUNTIME_SUCCESSOR_VIABILITY_ID_V1;
      status: "SUCCESSOR_VIABLE";
      terminal_slot_id: ShadowOnlineSlotIdV1;
      terminal_logical_time: string;
      next_slot_id: ShadowOnlineSlotIdV1;
      next_logical_time: string;
      checkpoint_ref: string;
      checkpoint_next_logical_time: string;
      active_slot_count: 0;
    }
  | {
      viability_id: typeof MCFT_CAP09_TWIN_RUNTIME_SUCCESSOR_VIABILITY_ID_V1;
      status: "RANGE_COMPLETE";
      terminal_slot_id: "O23";
      terminal_logical_time: string;
      next_slot_id: null;
      next_logical_time: null;
      checkpoint_ref: string;
      checkpoint_next_logical_time: string;
      active_slot_count: 0;
    };

export interface TwinRuntimeSuccessorViabilityPortV1 {
  verifyAfterTerminal(input: {
    terminal_slot_id: ShadowOnlineSlotIdV1;
    terminal_logical_time: string;
  }): Promise<TwinRuntimeSuccessorViabilityResultV1>;
}

export type PostgresTwinRuntimeSuccessorViabilityConfigV1 = {
  scope: TwinScopeKeyV1;
  schedule_start_logical_time: string;
};

type ViabilityClientV1 = Pick<PoolClient, "query" | "release">;
type ViabilityPoolV1 = Pick<Pool, "connect">;

type CursorRowV1 = {
  schedule_start_logical_time: string | Date;
  next_slot_index: number;
  next_slot_id: string | null;
  next_logical_time: string | Date | null;
  last_terminal_slot_id: string | null;
  last_terminal_logical_time: string | Date | null;
};

type TerminalSlotRowV1 = {
  state: "COMPLETED" | "DEGRADED" | "FAILED";
  logical_time: string | Date;
};

type CheckpointRowV1 = {
  checkpoint_object_id: string;
  checkpoint_logical_time: string;
  checkpoint_next_logical_time: string;
};

const SCOPE_KEYS = [
  "tenant_id",
  "project_id",
  "group_id",
  "field_id",
  "season_id",
  "zone_id",
] as const;
const HOUR_MS = 3_600_000;

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = requiredTextV1(value, code);
  const parsed = Date.parse(text);
  if (
    !Number.isFinite(parsed)
    || new Date(parsed).toISOString() !== text
    || parsed % HOUR_MS !== 0
  ) throw new Error(code);
  return text;
}

function scopeValuesV1(scope: TwinScopeKeyV1): string[] {
  return SCOPE_KEYS.map((key) =>
    requiredTextV1(
      scope[key],
      `PHASE4_SUCCESSOR_SCOPE_${key.toUpperCase()}_REQUIRED`,
    ),
  );
}

function slotIndexV1(slot: string): number {
  if (!/^O(?:0[0-9]|1[0-9]|2[0-3])$/.test(slot)) {
    throw new Error("PHASE4_SUCCESSOR_SLOT_ID_INVALID");
  }
  return Number(slot.slice(1));
}

function slotIdV1(index: number): ShadowOnlineSlotIdV1 {
  if (!Number.isInteger(index) || index < 0 || index > 23) {
    throw new Error("PHASE4_SUCCESSOR_SLOT_INDEX_INVALID");
  }
  return `O${String(index).padStart(2, "0")}` as ShadowOnlineSlotIdV1;
}

function isoV1(value: string | Date): string {
  return new Date(value).toISOString();
}

export class PostgresTwinRuntimeSuccessorViabilityV1
implements TwinRuntimeSuccessorViabilityPortV1 {
  private readonly scope: TwinScopeKeyV1;
  private readonly scheduleStart: string;

  constructor(
    private readonly pool: ViabilityPoolV1,
    config: PostgresTwinRuntimeSuccessorViabilityConfigV1,
  ) {
    scopeValuesV1(config.scope);
    this.scope = { ...config.scope };
    this.scheduleStart = canonicalHourV1(
      config.schedule_start_logical_time,
      "PHASE4_SUCCESSOR_SCHEDULE_START_INVALID",
    );
  }

  async verifyAfterTerminal(input: {
    terminal_slot_id: ShadowOnlineSlotIdV1;
    terminal_logical_time: string;
  }): Promise<TwinRuntimeSuccessorViabilityResultV1> {
    const terminalIndex = slotIndexV1(input.terminal_slot_id);
    const terminalTime = canonicalHourV1(
      input.terminal_logical_time,
      "PHASE4_SUCCESSOR_TERMINAL_TIME_INVALID",
    );
    const expectedTerminalTime = new Date(
      Date.parse(this.scheduleStart) + terminalIndex * HOUR_MS,
    ).toISOString();
    if (terminalTime !== expectedTerminalTime) {
      throw new Error("PHASE4_SUCCESSOR_TERMINAL_SLOT_TIME_MISMATCH");
    }
    const expectedCheckpointNext = new Date(
      Date.parse(terminalTime) + HOUR_MS,
    ).toISOString();

    const client = await this.pool.connect();
    try {
      await client.query(
        "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );

      const cursor = await client.query<CursorRowV1>(
        `SELECT schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time,
                last_terminal_slot_id,last_terminal_logical_time
           FROM public.twin_shadow_online_scheduler_cursor_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
            AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
        scopeValuesV1(this.scope),
      );
      if (cursor.rows.length !== 1) {
        throw new Error("PHASE4_SUCCESSOR_RUNTIME_CURSOR_REQUIRED");
      }
      const cursorRow = cursor.rows[0];
      if (isoV1(cursorRow.schedule_start_logical_time) !== this.scheduleStart) {
        throw new Error("PHASE4_SUCCESSOR_RUNTIME_CURSOR_CONFIG_MISMATCH");
      }
      if (
        cursorRow.last_terminal_slot_id !== input.terminal_slot_id
        || cursorRow.last_terminal_logical_time === null
        || isoV1(cursorRow.last_terminal_logical_time) !== terminalTime
      ) {
        throw new Error("PHASE4_SUCCESSOR_LAST_TERMINAL_CURSOR_MISMATCH");
      }

      const terminal = await client.query<TerminalSlotRowV1>(
        `SELECT state,logical_time
           FROM public.twin_shadow_online_scheduler_slot_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
            AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND slot_id=$7`,
        [...scopeValuesV1(this.scope), input.terminal_slot_id],
      );
      if (terminal.rows.length !== 1) {
        throw new Error("PHASE4_SUCCESSOR_TERMINAL_SLOT_REQUIRED");
      }
      if (
        !["COMPLETED", "DEGRADED", "FAILED"].includes(terminal.rows[0].state)
        || isoV1(terminal.rows[0].logical_time) !== terminalTime
      ) {
        throw new Error("PHASE4_SUCCESSOR_TERMINAL_SLOT_STATE_MISMATCH");
      }

      const active = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM public.twin_shadow_online_scheduler_slot_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
            AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND state IN ('CLAIMED','RUNNING')`,
        scopeValuesV1(this.scope),
      );
      const activeCount = active.rows[0]?.n ?? -1;
      if (activeCount !== 0) {
        throw new Error("PHASE4_SUCCESSOR_ACTIVE_SLOT_MUST_BE_ZERO");
      }

      const checkpoint = await client.query<CheckpointRowV1>(
        `SELECT
            latest.checkpoint_object_id,
            fact.record_json#>>'{payload,logical_time}' AS checkpoint_logical_time,
            fact.record_json#>>'{payload,payload,next_tick_logical_time}'
              AS checkpoint_next_logical_time
           FROM public.twin_runtime_checkpoint_latest_index_v1 AS latest
           JOIN public.facts AS fact
             ON fact.record_json->>'type'='twin_runtime_checkpoint_v1'
            AND fact.record_json->'payload'->>'object_id'=latest.checkpoint_object_id
          WHERE latest.tenant_id=$1 AND latest.project_id=$2
            AND latest.group_id=$3 AND latest.field_id=$4
            AND latest.season_id=$5 AND latest.zone_id=$6`,
        scopeValuesV1(this.scope),
      );
      if (checkpoint.rows.length !== 1) {
        throw new Error("PHASE4_SUCCESSOR_CANONICAL_CHECKPOINT_REQUIRED");
      }
      const checkpointRow = checkpoint.rows[0];
      const checkpointLogical = canonicalHourV1(
        checkpointRow.checkpoint_logical_time,
        "PHASE4_SUCCESSOR_CHECKPOINT_LOGICAL_TIME_INVALID",
      );
      const checkpointNext = canonicalHourV1(
        checkpointRow.checkpoint_next_logical_time,
        "PHASE4_SUCCESSOR_CHECKPOINT_NEXT_TIME_INVALID",
      );
      if (
        checkpointLogical !== terminalTime
        || checkpointNext !== expectedCheckpointNext
      ) {
        throw new Error("PHASE4_SUCCESSOR_CHECKPOINT_TIME_MISMATCH");
      }

      if (terminalIndex === 23) {
        if (
          cursorRow.next_slot_index !== 24
          || cursorRow.next_slot_id !== null
          || cursorRow.next_logical_time !== null
        ) {
          throw new Error("PHASE4_SUCCESSOR_RANGE_COMPLETE_CURSOR_MISMATCH");
        }
        await client.query("COMMIT");
        return {
          viability_id: MCFT_CAP09_TWIN_RUNTIME_SUCCESSOR_VIABILITY_ID_V1,
          status: "RANGE_COMPLETE",
          terminal_slot_id: "O23",
          terminal_logical_time: terminalTime,
          next_slot_id: null,
          next_logical_time: null,
          checkpoint_ref: checkpointRow.checkpoint_object_id,
          checkpoint_next_logical_time: checkpointNext,
          active_slot_count: 0,
        };
      }

      const nextIndex = terminalIndex + 1;
      const expectedNextSlot = slotIdV1(nextIndex);
      if (
        cursorRow.next_slot_index !== nextIndex
        || cursorRow.next_slot_id !== expectedNextSlot
        || cursorRow.next_logical_time === null
        || isoV1(cursorRow.next_logical_time) !== expectedCheckpointNext
      ) {
        throw new Error("PHASE4_SUCCESSOR_RUNTIME_CURSOR_NEXT_MISMATCH");
      }

      await client.query("COMMIT");
      return {
        viability_id: MCFT_CAP09_TWIN_RUNTIME_SUCCESSOR_VIABILITY_ID_V1,
        status: "SUCCESSOR_VIABLE",
        terminal_slot_id: input.terminal_slot_id,
        terminal_logical_time: terminalTime,
        next_slot_id: expectedNextSlot,
        next_logical_time: expectedCheckpointNext,
        checkpoint_ref: checkpointRow.checkpoint_object_id,
        checkpoint_next_logical_time: checkpointNext,
        active_slot_count: 0,
      };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  }
}
