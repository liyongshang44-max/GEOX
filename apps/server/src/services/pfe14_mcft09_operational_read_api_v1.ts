// PFE-14 / MCFT-CAP-09 GET-only operational read provider.
// Boundary: projects already-persisted scheduler, Evidence and qualified canonical read facts into a product read model.
// No scheduler claim/recovery, canonical write, action, dispatch, model activation or browser-derived verdict is permitted here.

import type { Pool, PoolClient } from "pg";

import { semanticHashV1 } from "../domain/twin_runtime/canonical_json_v1.js";
import { PostgresNextTickRepositoryV1 } from "../persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import {
  DATABASE_EVIDENCE_INGRESS_CONFIG_V1,
  PostgresEvidenceIngressAdapterV1,
  type FrozenDatabaseShadowOnlineEvidenceV1,
} from "../runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import type {
  EvidenceIngressPortV1,
  NextTickReadPortV1,
  PersistedNextTickSnapshotV1,
  ShadowOnlineBoundaryV1,
  ShadowOnlineSlotIdV1,
  TwinScopeKeyV1,
} from "../runtime/twin_runtime/ports.js";
import {
  McftFieldTwinReadApiErrorV1,
  PostgresMcftFieldTwinReadApiV1,
  type McftFieldTwinReadApiV1,
} from "./mcft_field_twin_read_api_v1.js";

export const PFE14_MCFT09_OPERATIONAL_READ_SCHEMA_V1 = "pfe14_mcft09_operational_summary_v1" as const;

export type Pfe14Mcft09OperationalScopeV1 = TwinScopeKeyV1;
export type Pfe14PersistedSlotStateV1 = "CLAIMED" | "RUNNING" | "COMPLETED" | "DEGRADED" | "FAILED";
export type Pfe14ProductSlotStateV1 = Pfe14PersistedSlotStateV1 | "NOT_MATERIALIZED";
export type Pfe14RuntimeDegradationStatusV1 = "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
export type Pfe14DegradationReasonCodeV1 =
  | "CHECKPOINT_NOT_ESTABLISHED"
  | "EVIDENCE_BOUNDARY_NOT_ESTABLISHED"
  | "EVIDENCE_STALE"
  | "EVIDENCE_MISSING"
  | "SCHEDULER_LAG";

export type Pfe14SchedulerSummaryV1 = {
  scheduler_status: "WAITING" | "RUNNING" | "COMPLETED" | "NOT_ESTABLISHED";
  latest_completed_slot: string | null;
  latest_tick_ref: string | null;
  latest_tick_status: "COMPLETED" | "DEGRADED" | "FAILED" | null;
  latest_tick_started_at: null;
  latest_tick_completed_at: string | null;
  next_target_slot: string | null;
  next_target_at: string | null;
  scheduler_lag_ms: number | null;
};

export type Pfe14EvidenceAvailabilityV1 = {
  eligibility_boundary: { slot_id: ShadowOnlineSlotIdV1; logical_time: string } | null;
  latest_evidence_observed_at: string | null;
  latest_evidence_ingested_at: string | null;
  evidence_age_ms: number | null;
  freshness_status: "FRESH" | "STALE" | "MISSING" | "UNKNOWN";
  freshness_threshold_ms: number;
  coverage_ratio: number | null;
  maximum_gap_ms: number | null;
  future_excluded_count: number | null;
  late_evidence_count: number | null;
  out_of_order_count: number | null;
};

export type Pfe14OperationalStatusV1 = {
  runtime_degradation_status: Pfe14RuntimeDegradationStatusV1;
  degradation_reason_codes: Pfe14DegradationReasonCodeV1[];
  forecast_status: "COMPLETED" | "BLOCKED" | null;
  scenario_source_eligible: boolean | null;
};

export type Pfe14SlotWindowEntryV1 = {
  slot_id: ShadowOnlineSlotIdV1;
  logical_time: string;
  state: Pfe14ProductSlotStateV1;
  tick_ref: string | null;
  health_ref: string | null;
  terminal_at: string | null;
};

export type Pfe14SlotWindowV1 = {
  schedule_start_logical_time: string;
  interval_seconds: 3600;
  entries: Pfe14SlotWindowEntryV1[];
};

export type Pfe14Mcft09OperationalSummaryV1 = {
  schema_version: typeof PFE14_MCFT09_OPERATIONAL_READ_SCHEMA_V1;
  request_scope: Pfe14Mcft09OperationalScopeV1;
  response_started_at: string;
  scheduler_summary: Pfe14SchedulerSummaryV1;
  evidence_availability: Pfe14EvidenceAvailabilityV1;
  operational_status: Pfe14OperationalStatusV1;
  slot_window: Pfe14SlotWindowV1 | null;
  limitations: string[];
  validation_summary: string[];
  operational_content_hash: string;
  response_instance_hash: string;
};

export interface Pfe14Mcft09OperationalReadApiV1 {
  readOperationalSummary(input: { scope: Pfe14Mcft09OperationalScopeV1 }): Promise<Pfe14Mcft09OperationalSummaryV1>;
}

type CursorRowV1 = {
  schedule_start_logical_time: string | Date;
  next_slot_index: number;
  next_slot_id: string | null;
  next_logical_time: string | Date | null;
  last_terminal_slot_id: string | null;
  last_terminal_logical_time: string | Date | null;
};

type SlotRowV1 = {
  slot_id: string;
  logical_time: string | Date;
  scheduler_wall_clock_observed_at: string | Date;
  state: Pfe14PersistedSlotStateV1;
  tick_ref: string | null;
  health_ref: string | null;
  terminal_at: string | Date | null;
};

type ReadSnapshotV1 = {
  database_now: string;
  cursor: CursorRowV1 | null;
  active: SlotRowV1 | null;
  terminal: SlotRowV1 | null;
  slots: SlotRowV1[];
};

type EvidenceReaderV1 = Pick<EvidenceIngressPortV1, "freezeEligibleEvidence">;
type RuntimeReadApiV1 = Pick<McftFieldTwinReadApiV1, "readRuntime">;

const SCOPE_KEYS_V1 = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;
const ACTUAL_EVIDENCE_TYPES_V1 = new Set<string>(DATABASE_EVIDENCE_INGRESS_CONFIG_V1.actual_observation_types);
const SLOT_IDS_V1 = Array.from({ length: 24 }, (_, index) => `O${String(index).padStart(2, "0")}` as ShadowOnlineSlotIdV1);

function scopeValuesV1(scope: Pfe14Mcft09OperationalScopeV1): string[] {
  return SCOPE_KEYS_V1.map((key) => {
    const value = scope[key];
    if (typeof value !== "string" || !value.trim()) throw new Error(`PFE14_OPERATIONAL_SCOPE_${key.toUpperCase()}_REQUIRED`);
    return value;
  });
}

function isoV1(value: string | Date): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("PFE14_OPERATIONAL_TIME_INVALID");
  return parsed.toISOString();
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function slotIdV1(value: string): ShadowOnlineSlotIdV1 {
  if (!/^O(0[0-9]|1[0-9]|2[0-3])$/.test(value)) throw new Error("PFE14_OPERATIONAL_SLOT_ID_INVALID");
  return value as ShadowOnlineSlotIdV1;
}

function terminalStateV1(value: SlotRowV1["state"]): value is "COMPLETED" | "DEGRADED" | "FAILED" {
  return value === "COMPLETED" || value === "DEGRADED" || value === "FAILED";
}

function countReasonV1(frozen: FrozenDatabaseShadowOnlineEvidenceV1, reasons: readonly string[]): number {
  const accepted = new Set(reasons);
  return frozen.excluded.filter((item) => accepted.has(item.reason)).length;
}

function latestActualIngestedAtV1(frozen: FrozenDatabaseShadowOnlineEvidenceV1): string | null {
  const values = frozen.selected
    .filter((item) => ACTUAL_EVIDENCE_TYPES_V1.has(item.evidence_kind))
    .map((item) => item.ingested_at)
    .sort();
  return values.length ? values[values.length - 1] : null;
}

function evidenceBoundaryV1(snapshot: ReadSnapshotV1, scope: TwinScopeKeyV1): ShadowOnlineBoundaryV1 | null {
  const source = snapshot.active ?? snapshot.terminal;
  if (!source) return null;
  const logicalTime = isoV1(source.logical_time);
  if (Date.parse(logicalTime) > Date.parse(snapshot.database_now)) throw new Error("PFE14_OPERATIONAL_FUTURE_BOUNDARY_MISMATCH");
  return {
    scope: { ...scope },
    slot_id: slotIdV1(source.slot_id),
    logical_time: logicalTime,
    scheduler_wall_clock_observed_at: snapshot.database_now,
    interval_seconds: 3600,
  };
}

async function readSnapshotV1(pool: Pool, scope: Pfe14Mcft09OperationalScopeV1): Promise<ReadSnapshotV1> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const databaseNowResult = await client.query<{ database_now: string | Date }>("SELECT transaction_timestamp() AS database_now");
    const cursorResult = await client.query<CursorRowV1>(
      `SELECT schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time,last_terminal_slot_id,last_terminal_logical_time
         FROM twin_shadow_online_scheduler_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      scopeValuesV1(scope),
    );
    if (cursorResult.rows.length > 1) throw new Error("PFE14_OPERATIONAL_CURSOR_CARDINALITY");
    const cursor = cursorResult.rows[0] ?? null;

    const slotResult = await client.query<SlotRowV1>(
      `SELECT slot_id,logical_time,scheduler_wall_clock_observed_at,state,tick_ref,health_ref,terminal_at
         FROM twin_shadow_online_scheduler_slot_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ORDER BY logical_time ASC`,
      scopeValuesV1(scope),
    );
    if (slotResult.rows.length > 24) throw new Error("PFE14_OPERATIONAL_SLOT_WINDOW_CARDINALITY");
    const slots = slotResult.rows;
    const activeRows = slots.filter((row) => row.state === "CLAIMED" || row.state === "RUNNING");
    if (activeRows.length > 1) throw new Error("PFE14_OPERATIONAL_ACTIVE_SLOT_CARDINALITY");
    const active = activeRows[0] ?? null;

    let terminal: SlotRowV1 | null = null;
    if (cursor?.last_terminal_logical_time) {
      const terminalTime = isoV1(cursor.last_terminal_logical_time);
      const terminalRows = slots.filter((row) => isoV1(row.logical_time) === terminalTime);
      if (terminalRows.length !== 1) throw new Error("PFE14_OPERATIONAL_TERMINAL_POINTER_CARDINALITY");
      terminal = terminalRows[0];
      if (!terminalStateV1(terminal.state)) throw new Error("PFE14_OPERATIONAL_TERMINAL_STATE_MISMATCH");
      if (cursor.last_terminal_slot_id !== terminal.slot_id) throw new Error("PFE14_OPERATIONAL_TERMINAL_SLOT_MISMATCH");
    }

    if (active && cursor && (active.slot_id !== cursor.next_slot_id || isoV1(active.logical_time) !== (cursor.next_logical_time ? isoV1(cursor.next_logical_time) : null))) {
      throw new Error("PFE14_OPERATIONAL_ACTIVE_CURSOR_MISMATCH");
    }

    await client.query("COMMIT");
    return { database_now: isoV1(databaseNowResult.rows[0].database_now), cursor, active, terminal, slots };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve source error */ }
    throw error;
  } finally {
    client.release();
  }
}

function schedulerSummaryV1(snapshot: ReadSnapshotV1): Pfe14SchedulerSummaryV1 {
  const { cursor, active, terminal, database_now: databaseNow } = snapshot;
  if (!cursor) {
    return { scheduler_status: "NOT_ESTABLISHED", latest_completed_slot: null, latest_tick_ref: null, latest_tick_status: null, latest_tick_started_at: null, latest_tick_completed_at: null, next_target_slot: null, next_target_at: null, scheduler_lag_ms: null };
  }
  const nextTarget = cursor.next_logical_time ? isoV1(cursor.next_logical_time) : null;
  const schedulerLagMs = nextTarget === null ? 0 : Math.max(0, Date.parse(databaseNow) - Date.parse(nextTarget));
  const schedulerStatus: Pfe14SchedulerSummaryV1["scheduler_status"] = cursor.next_slot_index >= 24 ? "COMPLETED" : active?.state === "RUNNING" ? "RUNNING" : "WAITING";
  return {
    scheduler_status: schedulerStatus,
    latest_completed_slot: terminal ? isoV1(terminal.logical_time) : null,
    latest_tick_ref: terminal?.tick_ref ?? null,
    latest_tick_status: terminal && terminalStateV1(terminal.state) ? terminal.state : null,
    // The operational slot ledger persists claim time, not authoritative Runtime tick-start time.
    latest_tick_started_at: null,
    latest_tick_completed_at: terminal?.terminal_at ? isoV1(terminal.terminal_at) : null,
    next_target_slot: nextTarget,
    next_target_at: nextTarget,
    scheduler_lag_ms: schedulerLagMs,
  };
}

function slotWindowV1(snapshot: ReadSnapshotV1): Pfe14SlotWindowV1 | null {
  if (!snapshot.cursor) return null;
  const start = isoV1(snapshot.cursor.schedule_start_logical_time);
  const byId = new Map<ShadowOnlineSlotIdV1, SlotRowV1>();
  for (const row of snapshot.slots) {
    const id = slotIdV1(row.slot_id);
    if (byId.has(id)) throw new Error("PFE14_OPERATIONAL_SLOT_ID_CARDINALITY");
    byId.set(id, row);
  }
  const entries = SLOT_IDS_V1.map((slot_id, index): Pfe14SlotWindowEntryV1 => {
    const logical_time = addHoursV1(start, index);
    const row = byId.get(slot_id);
    if (!row) return { slot_id, logical_time, state: "NOT_MATERIALIZED", tick_ref: null, health_ref: null, terminal_at: null };
    if (isoV1(row.logical_time) !== logical_time) throw new Error("PFE14_OPERATIONAL_SLOT_WINDOW_LOGICAL_TIME_MISMATCH");
    return {
      slot_id,
      logical_time,
      state: row.state,
      tick_ref: row.tick_ref,
      health_ref: row.health_ref,
      terminal_at: row.terminal_at ? isoV1(row.terminal_at) : null,
    };
  });
  return { schedule_start_logical_time: start, interval_seconds: 3600, entries };
}

function unavailableEvidenceV1(): Pfe14EvidenceAvailabilityV1 {
  return { eligibility_boundary: null, latest_evidence_observed_at: null, latest_evidence_ingested_at: null, evidence_age_ms: null, freshness_status: "UNKNOWN", freshness_threshold_ms: DATABASE_EVIDENCE_INGRESS_CONFIG_V1.stale_after_seconds * 1000, coverage_ratio: null, maximum_gap_ms: null, future_excluded_count: null, late_evidence_count: null, out_of_order_count: null };
}

async function evidenceAvailabilityV1(reader: EvidenceReaderV1, boundary: ShadowOnlineBoundaryV1 | null): Promise<Pfe14EvidenceAvailabilityV1> {
  if (!boundary) return unavailableEvidenceV1();
  const frozen = await reader.freezeEligibleEvidence({ boundary }) as FrozenDatabaseShadowOnlineEvidenceV1;
  const coverageRatio = Number(frozen.coverage_ratio_decimal);
  if (!Number.isFinite(coverageRatio) || coverageRatio < 0 || coverageRatio > 1) throw new Error("PFE14_OPERATIONAL_EVIDENCE_COVERAGE_INVALID");
  const freshest = frozen.freshest_observed_at;
  return {
    eligibility_boundary: { slot_id: boundary.slot_id, logical_time: boundary.logical_time },
    latest_evidence_observed_at: freshest,
    latest_evidence_ingested_at: latestActualIngestedAtV1(frozen),
    evidence_age_ms: freshest ? Math.max(0, Date.parse(boundary.logical_time) - Date.parse(freshest)) : null,
    freshness_status: frozen.freshness_status,
    freshness_threshold_ms: DATABASE_EVIDENCE_INGRESS_CONFIG_V1.stale_after_seconds * 1000,
    coverage_ratio: coverageRatio,
    maximum_gap_ms: frozen.maximum_gap_seconds === null ? null : frozen.maximum_gap_seconds * 1000,
    future_excluded_count: countReasonV1(frozen, ["OBSERVED_AFTER_BOUNDARY"]),
    late_evidence_count: countReasonV1(frozen, ["INGESTED_AFTER_BOUNDARY", "AVAILABLE_AFTER_BOUNDARY"]),
    out_of_order_count: frozen.out_of_order_evidence_refs.length,
  };
}

function canonicalSourceNotEstablishedV1(error: unknown): boolean {
  const code = error instanceof McftFieldTwinReadApiErrorV1 ? error.code : String((error as { code?: unknown })?.code ?? "");
  return code === "42P01" || code === "MCFT_RUNTIME_NOT_ESTABLISHED" || /REQUIRED_READ_SCHEMA|VISIBILITY_METADATA.*NOT_ESTABLISHED/.test(code);
}

async function nextTickSnapshotOrNullV1(reader: NextTickReadPortV1, scope: TwinScopeKeyV1): Promise<PersistedNextTickSnapshotV1 | null> {
  try { return await reader.readPersistedNextTickSnapshot(scope); }
  catch (error) { if (canonicalSourceNotEstablishedV1(error)) return null; throw error; }
}

async function runtimeModelOrNullV1(reader: RuntimeReadApiV1, scope: TwinScopeKeyV1): Promise<Record<string, unknown> | null> {
  try { return await reader.readRuntime({ scope }); }
  catch (error) { if (canonicalSourceNotEstablishedV1(error)) return null; throw error; }
}

function forecastStatusV1(snapshot: PersistedNextTickSnapshotV1 | null): "COMPLETED" | "BLOCKED" | null {
  const forecast = snapshot?.previous_forecast_result;
  if (!forecast) return null;
  const status = forecast.payload?.status;
  if (status === "COMPLETED" || status === "BLOCKED") return status;
  throw new Error("PFE14_OPERATIONAL_FORECAST_STATUS_INVALID");
}

function attachmentV1(value: unknown): { attachment_status: string; reason_code: string | null; item: unknown } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.attachment_status !== "string") return null;
  return { attachment_status: record.attachment_status, reason_code: typeof record.reason_code === "string" ? record.reason_code : null, item: record.item ?? null };
}

function scenarioSourceEligibleV1(runtime: Record<string, unknown> | null): boolean | null {
  if (!runtime) return null;
  const scenario = attachmentV1(runtime.scenario_source_forecast);
  if (scenario?.attachment_status === "ATTACHED_EXACT" && scenario.item) return true;
  const latestSuccessful = attachmentV1(runtime.latest_successful_forecast);
  if (latestSuccessful?.attachment_status === "ABSENT_OPTIONAL_DOMAIN" && latestSuccessful.reason_code === "NO_SUCCESSFUL_FORECAST_IN_SCOPE" && latestSuccessful.item === null) return false;
  return null;
}

function operationalStatusV1(input: {
  persisted: PersistedNextTickSnapshotV1 | null;
  scheduler: Pfe14SchedulerSummaryV1;
  evidence: Pfe14EvidenceAvailabilityV1;
  runtime: Record<string, unknown> | null;
}): Pfe14OperationalStatusV1 {
  const missing: Pfe14DegradationReasonCodeV1[] = [];
  if (!input.persisted?.checkpoint) missing.push("CHECKPOINT_NOT_ESTABLISHED");
  if (!input.evidence.eligibility_boundary) missing.push("EVIDENCE_BOUNDARY_NOT_ESTABLISHED");
  if (missing.length) {
    return {
      runtime_degradation_status: "UNAVAILABLE",
      degradation_reason_codes: missing,
      forecast_status: forecastStatusV1(input.persisted),
      scenario_source_eligible: scenarioSourceEligibleV1(input.runtime),
    };
  }
  const reasons: Pfe14DegradationReasonCodeV1[] = [];
  if (input.evidence.freshness_status === "STALE") reasons.push("EVIDENCE_STALE");
  else if (input.evidence.freshness_status === "MISSING") reasons.push("EVIDENCE_MISSING");
  if ((input.scheduler.scheduler_lag_ms ?? 0) > 0) reasons.push("SCHEDULER_LAG");
  return {
    runtime_degradation_status: reasons.length ? "DEGRADED" : "HEALTHY",
    degradation_reason_codes: reasons,
    forecast_status: forecastStatusV1(input.persisted),
    scenario_source_eligible: scenarioSourceEligibleV1(input.runtime),
  };
}

export class PostgresPfe14Mcft09OperationalReadApiV1 implements Pfe14Mcft09OperationalReadApiV1 {
  private readonly evidenceReader: EvidenceReaderV1;
  private readonly nextTickReader: NextTickReadPortV1;
  private readonly runtimeReadApi: RuntimeReadApiV1;

  constructor(
    private readonly pool: Pool,
    evidenceReader?: EvidenceReaderV1,
    nextTickReader?: NextTickReadPortV1,
    runtimeReadApi?: RuntimeReadApiV1,
  ) {
    this.evidenceReader = evidenceReader ?? new PostgresEvidenceIngressAdapterV1(pool);
    this.nextTickReader = nextTickReader ?? new PostgresNextTickRepositoryV1(pool);
    this.runtimeReadApi = runtimeReadApi ?? new PostgresMcftFieldTwinReadApiV1(pool);
  }

  async readOperationalSummary(input: { scope: Pfe14Mcft09OperationalScopeV1 }): Promise<Pfe14Mcft09OperationalSummaryV1> {
    scopeValuesV1(input.scope);
    const snapshot = await readSnapshotV1(this.pool, input.scope);
    const scheduler = schedulerSummaryV1(snapshot);
    const boundary = evidenceBoundaryV1(snapshot, input.scope);
    const [evidence, persisted, runtime] = await Promise.all([
      evidenceAvailabilityV1(this.evidenceReader, boundary),
      nextTickSnapshotOrNullV1(this.nextTickReader, input.scope),
      runtimeModelOrNullV1(this.runtimeReadApi, input.scope),
    ]);
    const operationalStatus = operationalStatusV1({ persisted, scheduler, evidence, runtime });
    const slotWindow = slotWindowV1(snapshot);
    const limitations = [
      "READ_ONLY_OPERATIONAL_PROJECTION_NOT_CANONICAL_TWIN_TRUTH",
      "LATEST_TICK_STARTED_AT_NOT_INFERRED_FROM_SCHEDULER_CLAIM_TIME",
      "EVIDENCE_FRESHNESS_IS_EVALUATED_AT_THE_EXPLICIT_ELIGIBILITY_BOUNDARY",
      "NO_DYNAMIC_SHADOW_ONLINE_RUNTIME_MODE_CLAIM",
      "NO_RESTART_OR_RECOVERY_HISTORY_INFERENCE",
      "ABSENT_SLOT_ROW_MEANS_NOT_MATERIALIZED_ONLY",
      ...(persisted ? [] : ["CANONICAL_NEXT_TICK_STATUS_NOT_ESTABLISHED"]),
      ...(runtime ? [] : ["CANONICAL_RUNTIME_ATTACHMENT_STATUS_NOT_ESTABLISHED"]),
    ];
    const validationSummary = [
      "EXACT_SIX_KEY_SCOPE",
      "DATABASE_CLOCK_AUTHORITY",
      "NO_FUTURE_EVIDENCE_BOUNDARY",
      "S2_EVIDENCE_INGRESS_SEMANTICS_REUSED",
      "FIXED_24_SLOT_WINDOW_SERVER_PROJECTION",
      "CANONICAL_NEXT_TICK_AUTHORITY_REUSED_WHEN_AVAILABLE",
      "CAP07_RUNTIME_ATTACHMENT_SEMANTICS_REUSED_WHEN_AVAILABLE",
      "ZERO_WRITE_PROVIDER",
    ];
    const contentCore = {
      request_scope: { ...input.scope },
      scheduler_summary: scheduler,
      evidence_availability: evidence,
      operational_status: operationalStatus,
      slot_window: slotWindow,
      limitations,
      validation_summary: validationSummary,
    };
    const operationalContentHash = semanticHashV1(contentCore);
    const responseStartedAt = snapshot.database_now;
    const responseInstanceHash = semanticHashV1({ schema_version: PFE14_MCFT09_OPERATIONAL_READ_SCHEMA_V1, ...contentCore, response_started_at: responseStartedAt, operational_content_hash: operationalContentHash });
    return {
      schema_version: PFE14_MCFT09_OPERATIONAL_READ_SCHEMA_V1,
      request_scope: { ...input.scope },
      response_started_at: responseStartedAt,
      scheduler_summary: scheduler,
      evidence_availability: evidence,
      operational_status: operationalStatus,
      slot_window: slotWindow,
      limitations,
      validation_summary: validationSummary,
      operational_content_hash: operationalContentHash,
      response_instance_hash: responseInstanceHash,
    };
  }
}
