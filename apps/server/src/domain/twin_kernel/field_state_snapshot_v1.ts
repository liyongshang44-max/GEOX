// apps/server/src/domain/twin_kernel/field_state_snapshot_v1.ts
// Purpose: build a deterministic Twin Kernel field-state snapshot from scoped source-index rows.
// Boundary: this file only derives a state snapshot; it does not create forecasts, scenarios, recommendations, tasks, ROI, Field Memory, calibration, or learning records.

import { createHash } from "node:crypto";

export type FieldStateSnapshotScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
};

export type FieldStateSnapshotSourceRowsV1 = {
  field: Record<string, unknown> | null;
  water: Record<string, unknown> | null;
  sensing: Record<string, unknown> | null;
  weather: Record<string, unknown> | null;
};

export type FieldStateSnapshotV1 = {
  snapshot_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string | null;
  as_of_ts: string;
  status: "SNAPSHOT_READY" | "SNAPSHOT_BLOCKED";
  state_vector_json: Record<string, unknown>;
  confidence_json: Record<string, unknown>;
  evidence_refs_json: Array<Record<string, string>>;
  source_indexes_json: Record<string, unknown>;
  blocking_reasons_json: string[];
  determinism_hash: string;
};

export type BuildFieldStateSnapshotArgsV1 = {
  scope: FieldStateSnapshotScopeV1;
  season_id?: string | null;
  as_of_ts: string;
  sources: FieldStateSnapshotSourceRowsV1;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function json(value: unknown): unknown {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function array(value: unknown): unknown[] {
  const parsed = json(value);
  if (Array.isArray(value)) return value;
  if (Array.isArray(parsed)) return parsed;
  return [];
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const raw = text(value);
    if (raw) return raw;
  }
  return "";
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const n = numberOrNull(value);
    if (n !== null) return n;
  }
  return null;
}

function normalizeWaterState(value: unknown): "NORMAL" | "LIGHT_DEFICIT" | "MODERATE_DEFICIT" | "UNKNOWN" {
  const key = text(value).toUpperCase();
  if (key === "NORMAL" || key === "OK" || key === "SUFFICIENT") return "NORMAL";
  if (key === "LIGHT_DEFICIT" || key === "MILD_DEFICIT") return "LIGHT_DEFICIT";
  if (key === "MODERATE_DEFICIT" || key === "DEFICIT" || key === "WATER_DEFICIT") return "MODERATE_DEFICIT";
  return "UNKNOWN";
}

function latestTimestamp(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const candidates = [row.updated_at, row.created_at, row.computed_at, row.generated_at, row.window_end, row.window_start];
  for (const candidate of candidates) {
    const raw = text(candidate);
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return null;
}

function collectEvidenceFromRow(source_index: string, row: Record<string, unknown> | null): Array<Record<string, string>> {
  if (!row) return [];
  const refs: Array<Record<string, string>> = [];
  const directKeys = ["source_fact_id", "fact_id", "window_id", "forecast_id", "field_id"];
  for (const key of directKeys) {
    const ref_id = text(row[key]);
    if (ref_id) refs.push({ kind: key, ref_id, source_index });
  }
  for (const item of array(row.evidence_refs_json ?? row.evidence_refs)) {
    if (typeof item === "string" && item.trim()) refs.push({ kind: "evidence_ref", ref_id: item.trim(), source_index });
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const ref_id = firstText(obj.ref_id, obj.fact_id, obj.id);
      const kind = firstText(obj.kind, obj.type) || "evidence_ref";
      if (ref_id) refs.push({ kind, ref_id, source_index });
    }
  }
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.source_index}:${ref.kind}:${ref.ref_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceSummary(source_index: string, row: Record<string, unknown> | null): Record<string, unknown> {
  return {
    source_index,
    available: Boolean(row),
    ref_id: row ? firstText(row.field_id, row.window_id, row.forecast_id, row.source_fact_id, row.fact_id) || null : null,
    latest_at: latestTimestamp(row),
  };
}

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) output[key] = canonical(input[key]);
    return output;
  }
  return value;
}

function hashPayload(value: unknown): string {
  const body = JSON.stringify(canonical(value));
  return createHash("sha256").update(body).digest("hex");
}

export function buildFieldStateSnapshotV1(args: BuildFieldStateSnapshotArgsV1): FieldStateSnapshotV1 {
  const { scope, sources } = args;
  const fieldRow = sources.field;
  const waterRow = sources.water;
  const sensingRow = sources.sensing;
  const weatherRow = sources.weather;
  const waterStateJson = record(json(waterRow?.state_json ?? waterRow?.estimate_json ?? waterRow?.response_json));
  const sensingSummary = record(json(sensingRow?.summary_json));
  const weatherSummary = record(json(weatherRow?.summary_json ?? weatherRow?.forecast_json));
  const waterState = normalizeWaterState(firstText(waterRow?.water_state, waterRow?.state, waterRow?.status, waterStateJson.water_state, waterStateJson.state));
  const soilMoistureValue = firstNumber(waterRow?.soil_moisture_percent, waterRow?.value, waterStateJson.soil_moisture_percent, waterStateJson.value, sensingSummary.soil_moisture_percent, sensingSummary.value);
  const coverageRatio = firstNumber(sensingRow?.coverage_ratio, sensingSummary.coverage_ratio);
  const rain72h = firstNumber(weatherRow?.rain_72h_mm, weatherSummary.rain_72h_mm, weatherSummary.forecast_rain_72h_mm);
  const blockingReasons: string[] = [];
  if (!fieldRow) blockingReasons.push("FIELD_NOT_FOUND");
  if (!waterRow) blockingReasons.push("WATER_STATE_MISSING");
  if (!sensingRow) blockingReasons.push("SENSING_WINDOW_MISSING");
  if (!weatherRow) blockingReasons.push("WEATHER_FORECAST_MISSING");
  if (coverageRatio !== null && coverageRatio < 0.2) blockingReasons.push("LOW_SENSING_COVERAGE");
  if (waterState === "UNKNOWN") blockingReasons.push("WATER_STATE_UNKNOWN");
  const stateVector = {
    field: {
      field_id: scope.field_id,
      field_name: firstText(fieldRow?.field_name, fieldRow?.name) || null,
      crop: firstText(fieldRow?.crop) || null,
      area_ha: firstNumber(fieldRow?.area_ha),
      area_m2: firstNumber(fieldRow?.area_m2),
    },
    soil_moisture: {
      state: waterState,
      value: soilMoistureValue,
      unit: "%",
      source: "water_state_estimate_index_v1",
      depth_profile: [],
    },
    sensing: {
      window_id: firstText(sensingRow?.window_id) || null,
      device_id: firstText(sensingRow?.device_id) || null,
      metric: firstText(sensingRow?.metric) || null,
      coverage_ratio: coverageRatio,
      quality_status: firstText(sensingRow?.quality_status) || null,
      source: "soil_moisture_sensing_window_index_v1",
    },
    weather: {
      forecast_id: firstText(weatherRow?.forecast_id) || null,
      forecast_horizon: firstText(weatherRow?.forecast_horizon) || null,
      provider: firstText(weatherRow?.provider) || null,
      rain_72h_mm: rain72h,
      source: "weather_forecast_index_v1",
    },
    operation_context: {
      recent_irrigation: false,
      last_operation_id: null,
    },
  };
  const sourceIndexes = {
    field_index_v1: sourceSummary("field_index_v1", fieldRow),
    water_state_estimate_index_v1: sourceSummary("water_state_estimate_index_v1", waterRow),
    soil_moisture_sensing_window_index_v1: sourceSummary("soil_moisture_sensing_window_index_v1", sensingRow),
    weather_forecast_index_v1: sourceSummary("weather_forecast_index_v1", weatherRow),
  };
  const evidenceRefs = [
    ...collectEvidenceFromRow("field_index_v1", fieldRow),
    ...collectEvidenceFromRow("water_state_estimate_index_v1", waterRow),
    ...collectEvidenceFromRow("soil_moisture_sensing_window_index_v1", sensingRow),
    ...collectEvidenceFromRow("weather_forecast_index_v1", weatherRow),
  ];
  const confidenceScore = Math.max(0, Math.min(1, [fieldRow, waterRow, sensingRow, weatherRow].filter(Boolean).length / 4));
  const confidence = {
    level: blockingReasons.length === 0 ? "MEDIUM" : confidenceScore >= 0.5 ? "LOW" : "INSUFFICIENT",
    score: confidenceScore,
    evidence_complete: blockingReasons.length === 0,
    reason_count: blockingReasons.length,
  };
  const hashInput = {
    scope,
    season_id: args.season_id ?? null,
    as_of_ts: new Date(args.as_of_ts).toISOString(),
    state_vector_json: stateVector,
    confidence_json: confidence,
    evidence_refs_json: evidenceRefs,
    source_indexes_json: sourceIndexes,
    blocking_reasons_json: blockingReasons,
  };
  const determinismHash = hashPayload(hashInput);
  return {
    snapshot_id: `fss_${determinismHash.slice(0, 24)}`,
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    field_id: scope.field_id,
    season_id: args.season_id ?? null,
    as_of_ts: new Date(args.as_of_ts).toISOString(),
    status: blockingReasons.length === 0 ? "SNAPSHOT_READY" : "SNAPSHOT_BLOCKED",
    state_vector_json: stateVector,
    confidence_json: confidence,
    evidence_refs_json: evidenceRefs,
    source_indexes_json: sourceIndexes,
    blocking_reasons_json: blockingReasons,
    determinism_hash: determinismHash,
  };
}
