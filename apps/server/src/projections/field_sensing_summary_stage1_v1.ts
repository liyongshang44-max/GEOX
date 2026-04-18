import type { Pool, PoolClient } from "pg";
import {
  STAGE1_CUSTOMER_SUMMARY_FIELDS,
  STAGE1_OFFICIAL_SUMMARY_SOIL_METRIC_CONTRACT,
  type Stage1OfficialSummarySoilMetric,
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
  metric: Stage1OfficialSummarySoilMetric;
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

type Stage1CustomerSummaryField = typeof STAGE1_CUSTOMER_SUMMARY_FIELDS[number];
type Stage1CustomerSummarySubsetV1 = Pick<FieldSensingSummaryStage1V1, Stage1CustomerSummaryField>;
type Stage1SummarySourceOverviewLike = {
  freshness?: unknown;
  confidence?: unknown;
  computed_at_ts_ms?: unknown;
  soil_indicators_json?: unknown;
} & Partial<Record<Stage1CustomerSummaryField, unknown>>;

let ensurePromise: Promise<void> | null = null;

function toFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toConfidence(v: unknown): number | null {
  const n = toFiniteNumber(v);
  if (n == null) return null;
  return Math.max(0, Math.min(1, n));
}

function toFreshness(v: unknown): Stage1Freshness {
  const normalized = String(v ?? "").trim().toLowerCase();
  if (normalized === "fresh" || normalized === "stale" || normalized === "unknown") return normalized;
  return "unknown";
}

function toCanopyTempStatus(v: unknown): FieldSensingSummaryStage1V1["canopy_temp_status"] {
  const normalized = String(v ?? "").trim().toLowerCase();
  return normalized === "normal" || normalized === "elevated" || normalized === "critical" || normalized === "unknown" ? normalized : null;
}

function toRiskLevel(v: unknown): FieldSensingSummaryStage1V1["evapotranspiration_risk"] {
  const normalized = String(v ?? "").trim().toLowerCase();
  return normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "unknown" ? normalized : null;
}

function toSensorQualityLevel(v: unknown): FieldSensingSummaryStage1V1["sensor_quality_level"] {
  const normalized = String(v ?? "").trim().toUpperCase();
  return normalized === "GOOD" || normalized === "FAIR" || normalized === "POOR" ? normalized : null;
}

const STAGE1_CUSTOMER_SUMMARY_FIELD_NORMALIZERS = {
  canopy_temp_status: toCanopyTempStatus,
  evapotranspiration_risk: toRiskLevel,
  sensor_quality_level: toSensorQualityLevel,
  irrigation_effectiveness: toRiskLevel,
  leak_risk: toRiskLevel,
} as const satisfies Record<Stage1CustomerSummaryField, (v: unknown) => unknown>;

const STAGE1_SUMMARY_SOIL_METRICS_ORDERED_SUBSET = STAGE1_OFFICIAL_SUMMARY_SOIL_METRIC_CONTRACT.ordered_metrics;

// Explicit source->summary mapping for customer-facing soil summary metrics.
// This mapping is summary-subset specific and intentionally decoupled from pipeline input whitelist semantics.
const STAGE1_SUMMARY_SOIL_METRIC_SOURCE_TO_SUBSET_METRIC = {
  soil_moisture_pct: "soil_moisture_pct",
  soil_moisture: "soil_moisture_pct",
  moisture_pct: "soil_moisture_pct",
  ec_ds_m: "ec_ds_m",
  ec: "ec_ds_m",
  soil_ec_ds_m: "ec_ds_m",
  salinity_ec_ds_m: "ec_ds_m",
  fertility_index: "fertility_index",
  soil_fertility_index: "fertility_index",
  n: "n",
  nitrogen: "n",
  soil_n: "n",
  p: "p",
  phosphorus: "p",
  soil_p: "p",
  k: "k",
  potassium: "k",
  soil_k: "k",
} as const satisfies Record<string, Stage1OfficialSummarySoilMetric>;

function pickOfficialSoilMetrics(soilIndicators: unknown): Stage1SoilMetricSummaryItemV1[] {
  const rows = Array.isArray(soilIndicators) ? soilIndicators as SoilIndicatorLike[] : [];
  const byMetric = new Map<Stage1OfficialSummarySoilMetric, SoilIndicatorLike>();

  for (const row of rows) {
    const sourceMetric = String(row?.metric ?? "").trim().toLowerCase();
    if (!sourceMetric) continue;
    const summaryMetric = STAGE1_SUMMARY_SOIL_METRIC_SOURCE_TO_SUBSET_METRIC[sourceMetric as keyof typeof STAGE1_SUMMARY_SOIL_METRIC_SOURCE_TO_SUBSET_METRIC];
    if (!summaryMetric) continue;
    if (!byMetric.has(summaryMetric)) byMetric.set(summaryMetric, row);
  }

  return STAGE1_SUMMARY_SOIL_METRICS_ORDERED_SUBSET.map((metric) => {
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

function deriveStage1SummaryFreshness(overviewFreshness: unknown, soilMetrics: Stage1SoilMetricSummaryItemV1[]): Stage1Freshness {
  const normalizedOverview = toFreshness(overviewFreshness);
  if (normalizedOverview !== "unknown") return normalizedOverview;
  if (soilMetrics.some((x) => x.freshness === "fresh")) return "fresh";
  if (soilMetrics.some((x) => x.freshness === "stale")) return "stale";
  return "unknown";
}

function deriveStage1SummaryConfidence(overviewConfidence: unknown, soilMetrics: Stage1SoilMetricSummaryItemV1[]): number | null {
  const normalizedOverview = toConfidence(overviewConfidence);
  if (normalizedOverview != null) return normalizedOverview;
  const candidates = soilMetrics.map((x) => toConfidence(x.confidence)).filter((x): x is number => x != null);
  if (!candidates.length) return null;
  return Math.max(...candidates);
}

function pickStage1CustomerSummaryFields(source: Stage1SummarySourceOverviewLike): Stage1CustomerSummarySubsetV1 {
  // Customer-facing stage-1 summary is whitelist-driven:
  // any compatibility/internal key outside STAGE1_CUSTOMER_SUMMARY_FIELDS is excluded by default.
  return {
    canopy_temp_status: STAGE1_CUSTOMER_SUMMARY_FIELD_NORMALIZERS.canopy_temp_status(source.canopy_temp_status) as FieldSensingSummaryStage1V1["canopy_temp_status"],
    evapotranspiration_risk: STAGE1_CUSTOMER_SUMMARY_FIELD_NORMALIZERS.evapotranspiration_risk(source.evapotranspiration_risk) as FieldSensingSummaryStage1V1["evapotranspiration_risk"],
    sensor_quality_level: STAGE1_CUSTOMER_SUMMARY_FIELD_NORMALIZERS.sensor_quality_level(source.sensor_quality_level) as FieldSensingSummaryStage1V1["sensor_quality_level"],
    irrigation_effectiveness: STAGE1_CUSTOMER_SUMMARY_FIELD_NORMALIZERS.irrigation_effectiveness(source.irrigation_effectiveness) as FieldSensingSummaryStage1V1["irrigation_effectiveness"],
    leak_risk: STAGE1_CUSTOMER_SUMMARY_FIELD_NORMALIZERS.leak_risk(source.leak_risk) as FieldSensingSummaryStage1V1["leak_risk"],
  };
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

  // Overview is an internal aggregation source.
  // Stage-1 summary contract remains authoritative and must be built by explicit summary-subset contract rules.
  // STAGE1_OFFICIAL_SUMMARY_SOIL_METRIC_CONTRACT is customer-facing display contract only; it is not pipeline input contract.
  // Overview changes must NOT silently expand stage-1 summary fields.
  const overview = await refreshFieldSensingOverviewV1(db, params);
  const nowMs = Number.isFinite(params.now_ms) ? Number(params.now_ms) : Date.now();
  const officialSoilMetrics = pickOfficialSoilMetrics(overview.soil_indicators_json);
  const summaryFields = pickStage1CustomerSummaryFields(overview);

  const payload: FieldSensingSummaryStage1V1 = {
    tenant_id: overview.tenant_id,
    project_id: overview.project_id,
    group_id: overview.group_id,
    field_id: overview.field_id,
    freshness: deriveStage1SummaryFreshness(overview.freshness, officialSoilMetrics),
    confidence: deriveStage1SummaryConfidence(overview.confidence, officialSoilMetrics),
    ...summaryFields,
    official_soil_metrics_json: officialSoilMetrics,
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
