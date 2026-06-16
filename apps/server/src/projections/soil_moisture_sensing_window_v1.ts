// apps/server/src/projections/soil_moisture_sensing_window_v1.ts
// Purpose: read the H12 soil moisture sensing-window index for downstream chains (H14 can request a specific window_id).
// Boundary: helper only; no route, OpenAPI path, or report API coupling.

import type { Pool, PoolClient } from "pg";

export type SoilMoistureSensingWindowIndexArgsV1 = {
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  field_id?: string;
  device_id?: string;
  metric?: string;
  window_id?: string;
  quality_status?: string;
  latest?: boolean;
};

export type SoilMoistureSensingWindowIndexV1 = {
  window_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  device_id: string;
  metric: string;
  window_start: string;
  window_end: string;
  expected_interval_ms: number;
  expected_points: number;
  actual_points: number;
  coverage_ratio: number;
  max_gap_ms: number | null;
  quality_status: string;
  confidence: Record<string, unknown>;
  summary: Record<string, unknown>;
  config_snapshot: Record<string, unknown>;
  evidence_refs: string[];
  source_fact_ids: string[];
  source_observation_ids: string[];
  source_fact_id: string | null;
  created_at: string;
  updated_at: string;
};

type DbConn = Pool | PoolClient;

function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = textOrNull(value);
  if (!text) return "";
  const parsedMs = Date.parse(text);
  return Number.isFinite(parsedMs) ? new Date(parsedMs).toISOString() : text;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseJsonStringArray(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : (() => {
    if (typeof value !== "string" || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export function mapSoilMoistureSensingWindowIndexV1Row(row: any): SoilMoistureSensingWindowIndexV1 {
  return {
    window_id: String(row.window_id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    project_id: String(row.project_id ?? ""),
    group_id: String(row.group_id ?? ""),
    field_id: String(row.field_id ?? ""),
    device_id: String(row.device_id ?? ""),
    metric: String(row.metric ?? ""),
    window_start: toIsoString(row.window_start),
    window_end: toIsoString(row.window_end),
    expected_interval_ms: numberOrZero(row.expected_interval_ms),
    expected_points: numberOrZero(row.expected_points),
    actual_points: numberOrZero(row.actual_points),
    coverage_ratio: numberOrZero(row.coverage_ratio),
    max_gap_ms: numberOrNull(row.max_gap_ms),
    quality_status: String(row.quality_status ?? ""),
    confidence: parseJsonObject(row.confidence_json),
    summary: parseJsonObject(row.summary_json),
    config_snapshot: parseJsonObject(row.config_snapshot_json),
    evidence_refs: parseJsonStringArray(row.evidence_refs_json),
    source_fact_ids: parseJsonStringArray(row.source_fact_ids_json),
    source_observation_ids: parseJsonStringArray(row.source_observation_ids_json),
    source_fact_id: textOrNull(row.source_fact_id),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

export async function getSoilMoistureSensingWindowIndexV1(
  pool: DbConn,
  args: SoilMoistureSensingWindowIndexArgsV1 = {},
): Promise<SoilMoistureSensingWindowIndexV1 | null> {
  const clauses: string[] = [];
  const values: unknown[] = [];

  const addTextFilter = (column: string, value: unknown) => {
    const text = textOrNull(value);
    if (!text) return;
    values.push(text);
    clauses.push(`${column} = $${values.length}`);
  };

  addTextFilter("tenant_id", args.tenant_id);
  addTextFilter("project_id", args.project_id);
  addTextFilter("group_id", args.group_id);
  addTextFilter("field_id", args.field_id);
  addTextFilter("device_id", args.device_id);
  addTextFilter("metric", args.metric);
  addTextFilter("window_id", args.window_id);
  addTextFilter("quality_status", args.quality_status);

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const latestFirst = args.latest !== false;
  const orderSql = latestFirst
    ? "ORDER BY window_end DESC, updated_at DESC, created_at DESC, window_id DESC"
    : "ORDER BY window_start ASC, created_at ASC, window_id ASC";

  const result = await pool.query(
    `SELECT window_id,
            tenant_id,
            project_id,
            group_id,
            field_id,
            device_id,
            metric,
            window_start,
            window_end,
            expected_interval_ms,
            expected_points,
            actual_points,
            coverage_ratio,
            max_gap_ms,
            quality_status,
            confidence_json,
            summary_json,
            config_snapshot_json,
            evidence_refs_json,
            source_fact_ids_json,
            source_observation_ids_json,
            source_fact_id,
            created_at,
            updated_at
       FROM soil_moisture_sensing_window_index_v1
      ${whereSql}
      ${orderSql}
      LIMIT 1`,
    values,
  );

  const row = result.rows?.[0];
  return row ? mapSoilMoistureSensingWindowIndexV1Row(row) : null;
}
