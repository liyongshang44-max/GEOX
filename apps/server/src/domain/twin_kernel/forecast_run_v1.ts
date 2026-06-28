// apps/server/src/domain/twin_kernel/forecast_run_v1.ts
// Purpose: build a deterministic seven-day water-state forecast from a persisted field_state_snapshot_v1 row.
// Boundary: this file only derives forecast_run_v1; it does not create scenarios, recommendations, tasks, ROI, Field Memory, calibration, learning, or decision-cycle records.

import { createHash } from "node:crypto";

export type ForecastRunSnapshotRowV1 = {
  snapshot_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string | Date;
  status: string;
  state_vector_json: Record<string, unknown>;
  confidence_json: Record<string, unknown>;
  evidence_refs_json: Array<Record<string, string>>;
  determinism_hash: string;
};

export type ForecastRunV1 = {
  forecast_run_id: string;
  snapshot_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string;
  horizon_days: 7;
  model_version: string;
  status: "FORECAST_READY" | "FORECAST_BLOCKED";
  input_refs_json: Record<string, unknown>;
  forecast_points_json: Array<Record<string, unknown>>;
  risk_timeline_json: Array<Record<string, unknown>>;
  uncertainty_json: Record<string, unknown>;
  assumptions_json: Record<string, unknown>;
  blocking_reasons_json: string[];
  determinism_hash: string;
};

export type BuildForecastRunArgsV1 = {
  snapshot: ForecastRunSnapshotRowV1;
  model_version?: string;
};

const HORIZON_DAYS = 7 as const;
const DEFAULT_MODEL_VERSION = "twin_kernel_forecast_water_v1";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dayIso(asOfTs: string, day: number): string {
  const base = new Date(asOfTs).getTime();
  return new Date(base + day * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeState(value: unknown): "NORMAL" | "LIGHT_DEFICIT" | "MODERATE_DEFICIT" | "UNKNOWN" {
  const key = text(value).toUpperCase();
  if (key === "NORMAL") return "NORMAL";
  if (key === "LIGHT_DEFICIT") return "LIGHT_DEFICIT";
  if (key === "MODERATE_DEFICIT") return "MODERATE_DEFICIT";
  return "UNKNOWN";
}

function baseRiskScore(state: string, soilMoisturePercent: number | null): number {
  if (soilMoisturePercent !== null) {
    if (soilMoisturePercent >= 28) return 0.2;
    if (soilMoisturePercent >= 22) return 0.4;
    if (soilMoisturePercent >= 16) return 0.65;
    return 0.85;
  }
  if (state === "NORMAL") return 0.25;
  if (state === "LIGHT_DEFICIT") return 0.5;
  if (state === "MODERATE_DEFICIT") return 0.75;
  return 0.6;
}

function stateFromRisk(score: number): "NORMAL" | "LIGHT_DEFICIT" | "MODERATE_DEFICIT" | "UNKNOWN" {
  if (score < 0.35) return "NORMAL";
  if (score < 0.65) return "LIGHT_DEFICIT";
  return "MODERATE_DEFICIT";
}

function confidenceForDay(snapshotConfidence: string, day: number): "MEDIUM" | "LOW" | "INSUFFICIENT" {
  if (snapshotConfidence === "INSUFFICIENT") return "INSUFFICIENT";
  if (day <= 3 && snapshotConfidence === "MEDIUM") return "MEDIUM";
  return "LOW";
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
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function buildForecastRunV1(args: BuildForecastRunArgsV1): ForecastRunV1 {
  const snapshot = args.snapshot;
  const asOfTs = new Date(snapshot.as_of_ts).toISOString();
  const modelVersion = args.model_version || DEFAULT_MODEL_VERSION;
  const stateVector = record(snapshot.state_vector_json);
  const confidenceJson = record(snapshot.confidence_json);
  const soilMoisture = record(stateVector.soil_moisture);
  const weather = record(stateVector.weather);
  const snapshotState = normalizeState(soilMoisture.state);
  const soilMoisturePercent = numberOrNull(soilMoisture.value);
  const rain72hMm = numberOrNull(weather.rain_72h_mm);
  const snapshotConfidence = text(confidenceJson.level) || "INSUFFICIENT";
  const blockingReasons: string[] = [];
  if (snapshot.status !== "SNAPSHOT_READY") blockingReasons.push("SNAPSHOT_NOT_READY");
  if (!snapshot.snapshot_id) blockingReasons.push("SNAPSHOT_ID_MISSING");
  if (snapshotState === "UNKNOWN") blockingReasons.push("SNAPSHOT_WATER_STATE_UNKNOWN");
  if (snapshotConfidence === "INSUFFICIENT") blockingReasons.push("SNAPSHOT_CONFIDENCE_INSUFFICIENT");
  const rainMitigation = rain72hMm === null ? 0 : clamp(rain72hMm / 50, 0, 0.25);
  const baseRisk = clamp(baseRiskScore(snapshotState, soilMoisturePercent) - rainMitigation, 0, 1);
  const forecastPoints: Array<Record<string, unknown>> = [];
  const riskTimeline: Array<Record<string, unknown>> = [];
  for (let day = 1; day <= HORIZON_DAYS; day += 1) {
    const riskScore = clamp(baseRisk + day * 0.045, 0, 1);
    const waterState = stateFromRisk(riskScore);
    const confidence = confidenceForDay(snapshotConfidence, day);
    const point = {
      day,
      forecast_ts: dayIso(asOfTs, day),
      water_state: waterState,
      risk_score: Number(riskScore.toFixed(3)),
      confidence,
    };
    forecastPoints.push(point);
    riskTimeline.push({
      day,
      water_state: waterState,
      risk_level: riskScore < 0.35 ? "LOW" : riskScore < 0.65 ? "MEDIUM" : "HIGH",
      confidence,
    });
  }
  const inputRefs = {
    snapshot_id: snapshot.snapshot_id,
    snapshot_determinism_hash: snapshot.determinism_hash,
    source_object_type: "field_state_snapshot_v1",
  };
  const uncertainty = {
    level: blockingReasons.length === 0 ? "MEDIUM" : "HIGH",
    horizon_days: HORIZON_DAYS,
    confidence_degrades_after_day: 3,
    source_snapshot_confidence: snapshotConfidence,
  };
  const assumptions = {
    model_version: modelVersion,
    no_action_baseline: false,
    no_irrigation_option_generated: true,
    weather_signal: {
      rain_72h_mm: rain72hMm,
      used_as_short_term_modifier: true,
    },
  };
  const hashInput = {
    snapshot_id: snapshot.snapshot_id,
    snapshot_determinism_hash: snapshot.determinism_hash,
    as_of_ts: asOfTs,
    horizon_days: HORIZON_DAYS,
    model_version: modelVersion,
    input_refs_json: inputRefs,
    forecast_points_json: forecastPoints,
    risk_timeline_json: riskTimeline,
    uncertainty_json: uncertainty,
    assumptions_json: assumptions,
    blocking_reasons_json: blockingReasons,
  };
  const determinismHash = hashPayload(hashInput);
  return {
    forecast_run_id: `fr_${determinismHash.slice(0, 24)}`,
    snapshot_id: snapshot.snapshot_id,
    tenant_id: snapshot.tenant_id,
    project_id: snapshot.project_id,
    group_id: snapshot.group_id,
    field_id: snapshot.field_id,
    as_of_ts: asOfTs,
    horizon_days: HORIZON_DAYS,
    model_version: modelVersion,
    status: blockingReasons.length === 0 ? "FORECAST_READY" : "FORECAST_BLOCKED",
    input_refs_json: inputRefs,
    forecast_points_json: forecastPoints,
    risk_timeline_json: riskTimeline,
    uncertainty_json: uncertainty,
    assumptions_json: assumptions,
    blocking_reasons_json: blockingReasons,
    determinism_hash: determinismHash,
  };
}
