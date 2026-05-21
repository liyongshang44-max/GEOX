import crypto from "node:crypto";

import type { Pool, PoolClient } from "pg";

import { writeObservationRunPipelineAndRefreshFieldV1 } from "./device_observation_service_v1.js";

export type TelemetryIngressPayloadV1 = {
  tenant_id: string;
  device_id: string;
  metric: string;
  value: number | string | boolean | null;
  unit: string | null;
  ts_ms: number;
};

export type TelemetryIngressContextV1 = {
  source: string;
  project_id?: string | null;
  group_id?: string | null;
  field_id?: string | null;
  quality_flags?: string[];
  confidence?: number | null;
  source_lane?: "FORMAL_OPERATION" | "SIMULATED_DEV_ONLY" | "DEBUG_ONLY" | "MANUAL_IMPORT" | "UNKNOWN";
  is_simulated?: boolean;
  formal_eligible?: boolean;
  evidence_level?: "DEBUG" | "FORMAL" | "STRONG";
  dev_source?: string | null;
};

export type TelemetryIngressResultV1 = {
  raw: { fact_id: string; telemetry_id: string; occurred_at_iso: string };
  observation: { fact_id: string; occurred_at_iso: string };
};

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function normalizeMetric(v: string): string {
  return String(v ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function toIso(ts_ms: number): string {
  return new Date(ts_ms).toISOString();
}

function toNumericValue(value: number | string | boolean | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

async function resolveConn(db: Pool | PoolClient): Promise<{ conn: PoolClient; release: () => void }> {
  if (typeof (db as Pool).connect === "function") {
    const conn = await (db as Pool).connect();
    return { conn, release: () => conn.release() };
  }
  return { conn: db as PoolClient, release: () => undefined };
}

/**
 * Unified official telemetry ingest entry:
 * raw telemetry record -> observation write -> sensing pipeline -> derived/read model refresh.
 *
 * Dev/simulator boundary:
 * simulator telemetry may be recorded for debugging, but must carry simulated trust metadata and
 * must be excluded by the observation pipeline from formal Stage-1 sensing triggers.
 */
export async function ingestTelemetryV1(
  db: Pool | PoolClient,
  payload: TelemetryIngressPayloadV1,
  context: TelemetryIngressContextV1
): Promise<TelemetryIngressResultV1> {
  const ts_ms = Number.isFinite(payload.ts_ms) ? Math.floor(payload.ts_ms) : Date.now();
  const occurred_at_iso = toIso(ts_ms);
  const metric = normalizeMetric(payload.metric);
  const telemetry_id = sha256Hex(`${payload.tenant_id}|${payload.device_id}|${metric}|${ts_ms}`);
  const raw_fact_id = `raw_${telemetry_id}`;
  const value_num = toNumericValue(payload.value);
  const source_lane = context.source_lane ?? (context.is_simulated ? "SIMULATED_DEV_ONLY" : "UNKNOWN");
  const is_simulated = context.is_simulated === true || source_lane === "SIMULATED_DEV_ONLY" || source_lane === "DEBUG_ONLY";
  const formal_eligible = is_simulated ? false : context.formal_eligible === true;
  const evidence_level = context.evidence_level ?? (is_simulated ? "DEBUG" : "FORMAL");

  const { conn, release } = await resolveConn(db);
  try {
    await conn.query("BEGIN");

    await conn.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json)
       VALUES ($1, $2::timestamptz, $3, $4::jsonb)
       ON CONFLICT (fact_id) DO NOTHING`,
      [
        raw_fact_id,
        occurred_at_iso,
        context.source,
        JSON.stringify({
          type: "raw_telemetry_v1",
          schema_version: 1,
          occurred_at: occurred_at_iso,
          entity: { tenant_id: payload.tenant_id, device_id: payload.device_id },
          payload: {
            telemetry_id,
            metric,
            value: payload.value,
            unit: payload.unit,
            ts_ms,
            source: context.source,
            source_lane,
            is_simulated,
            formal_eligible,
            evidence_level,
            dev_source: context.dev_source ?? null,
          },
        }),
      ]
    );

    await conn.query(
      `INSERT INTO telemetry_index_v1 (tenant_id, device_id, metric, ts, value_num, value_text, fact_id)
       VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7)
       ON CONFLICT (tenant_id, device_id, metric, ts) DO NOTHING`,
      [
        payload.tenant_id,
        payload.device_id,
        metric,
        occurred_at_iso,
        value_num,
        payload.value == null ? null : String(payload.value),
        raw_fact_id,
      ]
    );

    await conn.query(
      `INSERT INTO device_status_index_v1 (tenant_id, device_id, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms)
       VALUES ($1, $2, $3, NULL, NULL, NULL, NULL, $4)
       ON CONFLICT (tenant_id, device_id) DO UPDATE SET
         last_telemetry_ts_ms = GREATEST(COALESCE(device_status_index_v1.last_telemetry_ts_ms, 0), EXCLUDED.last_telemetry_ts_ms),
         updated_ts_ms = EXCLUDED.updated_ts_ms`,
      [payload.tenant_id, payload.device_id, ts_ms, ts_ms]
    );

    const pipelineResult = await writeObservationRunPipelineAndRefreshFieldV1(conn, {
      tenant_id: payload.tenant_id,
      project_id: context.project_id ?? null,
      group_id: context.group_id ?? null,
      field_id: context.field_id ?? null,
      device_id: payload.device_id,
      metric,
      value: payload.value,
      unit: payload.unit,
      quality_flags: Array.isArray(context.quality_flags) ? context.quality_flags : ["OK"],
      confidence: context.confidence ?? null,
      observed_at_ts_ms: ts_ms,
      source_fact_id: raw_fact_id,
      source_lane,
      is_simulated,
      formal_eligible,
      evidence_level,
      dev_source: context.dev_source ?? null,
    });

    await conn.query("COMMIT");
    return {
      raw: { fact_id: raw_fact_id, telemetry_id, occurred_at_iso },
      observation: pipelineResult.observation,
    };
  } catch (error) {
    await conn.query("ROLLBACK");
    throw error;
  } finally {
    release();
  }
}
