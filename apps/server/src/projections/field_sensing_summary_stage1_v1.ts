import type { Pool, PoolClient } from "pg";
import {
  STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS,
  type Stage1Freshness,
} from "../domain/sensing/stage1_sensing_contract_v1.js";
import { refreshFieldSensingOverviewV1 } from "./field_sensing_overview_v1.js";

type DbConn = Pool | PoolClient;

type SoilIndicatorLike = {
  metric?: unknown;
  value?: unknown;
  confidence?: unknown;
  observed_at_ts_ms?: unknown;
  freshness?: unknown;
};

export type Stage1SoilMetricSummaryItemV1 = {
  metric: typeof STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS[number];
  value: number | null;
  confidence: number | null;
  observed_at_ts_ms: number | null;
  freshness: Stage1Freshness;
};

export type FieldSensingSummaryStage1V1 = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  freshness: Stage1Freshness;
  confidence: number | null;
  canopy_temp_status: "normal" | "elevated" | "critical" | "unknown" | null;
  evapotranspiration_risk: "low" | "medium" | "high" | "unknown" | null;
  sensor_quality_level: "GOOD" | "FAIR" | "POOR" | null;
  irrigation_effectiveness: "low" | "medium" | "high" | "unknown" | null;
  leak_risk: "low" | "medium" | "high" | "unknown" | null;
  official_soil_metrics_json: Stage1SoilMetricSummaryItemV1[];
  computed_at_ts_ms: number | null;
  updated_ts_ms: number;
};

let ensurePromise: Promise<void> | null = null;

function toFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toFreshness(v: unknown): Stage1Freshness {
  const normalized = String(v ?? "").trim().toLowerCase();
  if (normalized === "fresh" || normalized === "stale" || normalized === "unknown") return normalized;
  return "unknown";
}

function pickOfficialSoilMetrics(soilIndicators: unknown): Stage1SoilMetricSummaryItemV1[] {
  const rows = Array.isArray(soilIndicators) ? soilIndicators as SoilIndicatorLike[] : [];
  const byMetric = new Map<string, SoilIndicatorLike>();

  for (const row of rows) {
    const metric = String(row?.metric ?? "").trim();
    if (!metric) continue;
    if (!STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS.includes(metric as typeof STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS[number])) continue;
    if (!byMetric.has(metric)) byMetric.set(metric, row);
  }

  return STAGE1_OFFICIAL_SUMMARY_SOIL_METRICS.map((metric) => {
    const row = byMetric.get(metric);
    return {
      metric,
      value: toFiniteNumber(row?.value),
      confidence: toFiniteNumber(row?.confidence),
      observed_at_ts_ms: toFiniteNumber(row?.observed_at_ts_ms),
      freshness: toFreshness(row?.freshness),
    };
  });
}

export async function ensureFieldSensingSummaryStage1ProjectionV1(db: DbConn): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await db.query(
        `CREATE TABLE IF NOT EXISTS field_sensing_summary_stage1_v1 (
          tenant_id text NOT NULL,
          project_id text NULL,
          group_id text NULL,
          field_id text NOT NULL,
          freshness text NOT NULL,
          confidence double precision NULL,
          canopy_temp_status text NULL,
          evapotranspiration_risk text NULL,
          sensor_quality_level text NULL,
          irrigation_effectiveness text NULL,
          leak_risk text NULL,
          official_soil_metrics_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          computed_at_ts_ms bigint NULL,
          updated_ts_ms bigint NOT NULL,
          PRIMARY KEY (tenant_id, field_id)
        )`
      );
      await db.query(`CREATE INDEX IF NOT EXISTS idx_field_sensing_summary_stage1_scope ON field_sensing_summary_stage1_v1 (tenant_id, project_id, group_id, field_id)`);
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  await ensurePromise;
}

export async function refreshFieldSensingSummaryStage1V1(db: DbConn, params: {
  tenant_id: string;
  project_id?: string | null;
  group_id?: string | null;
  field_id: string;
  now_ms?: number;
}): Promise<FieldSensingSummaryStage1V1> {
  await ensureFieldSensingSummaryStage1ProjectionV1(db);

  const overview = await refreshFieldSensingOverviewV1(db, params);
  const nowMs = Number.isFinite(params.now_ms) ? Number(params.now_ms) : Date.now();

  const payload: FieldSensingSummaryStage1V1 = {
    tenant_id: overview.tenant_id,
    project_id: overview.project_id,
    group_id: overview.group_id,
    field_id: overview.field_id,
    freshness: toFreshness(overview.freshness),
    confidence: toFiniteNumber(overview.confidence),
    canopy_temp_status: overview.canopy_temp_status,
    evapotranspiration_risk: overview.evapotranspiration_risk,
    sensor_quality_level: overview.sensor_quality_level,
    irrigation_effectiveness: overview.irrigation_effectiveness,
    leak_risk: overview.leak_risk,
    official_soil_metrics_json: pickOfficialSoilMetrics(overview.soil_indicators_json),
    computed_at_ts_ms: toFiniteNumber(overview.computed_at_ts_ms),
    updated_ts_ms: nowMs,
  };

  await db.query(
    `INSERT INTO field_sensing_summary_stage1_v1
      (tenant_id, project_id, group_id, field_id, freshness, confidence, canopy_temp_status, evapotranspiration_risk, sensor_quality_level, irrigation_effectiveness, leak_risk, official_soil_metrics_json, computed_at_ts_ms, updated_ts_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)
     ON CONFLICT (tenant_id, field_id)
     DO UPDATE SET
      project_id = EXCLUDED.project_id,
      group_id = EXCLUDED.group_id,
      freshness = EXCLUDED.freshness,
      confidence = EXCLUDED.confidence,
      canopy_temp_status = EXCLUDED.canopy_temp_status,
      evapotranspiration_risk = EXCLUDED.evapotranspiration_risk,
      sensor_quality_level = EXCLUDED.sensor_quality_level,
      irrigation_effectiveness = EXCLUDED.irrigation_effectiveness,
      leak_risk = EXCLUDED.leak_risk,
      official_soil_metrics_json = EXCLUDED.official_soil_metrics_json,
      computed_at_ts_ms = EXCLUDED.computed_at_ts_ms,
      updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [
      payload.tenant_id,
      payload.project_id,
      payload.group_id,
      payload.field_id,
      payload.freshness,
      payload.confidence,
      payload.canopy_temp_status,
      payload.evapotranspiration_risk,
      payload.sensor_quality_level,
      payload.irrigation_effectiveness,
      payload.leak_risk,
      JSON.stringify(payload.official_soil_metrics_json),
      payload.computed_at_ts_ms,
      payload.updated_ts_ms,
    ]
  );
  return payload;
}
