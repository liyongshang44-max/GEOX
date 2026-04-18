import crypto from "node:crypto";
import {
  DeviceObservationV1Schema,
  isTelemetryMetricNameV1,
  isValidTelemetryUnitV1,
  TELEMETRY_METRIC_CATALOG_V1,
  toCanonicalTelemetryMetricNameV1,
  type DeviceObservationQualityFlagV1
} from "@geox/contracts";
import type { PoolClient } from "pg";
import { mapStage1ObservationMetricToPipelineObservationV1 } from "../domain/sensing/stage1_sensing_input_mapping_v1.js";
import { runSensingInferencePipelineV1, type RunSensingInferencePipelineV1Result } from "../domain/sensing/run_sensing_inference_pipeline_v1.js";
import { refreshFieldReadModelsWithObservabilityV1 } from "./field_read_model_refresh_v1.js";

export type DeviceObservationServiceV1Input = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  device_id: string;
  field_id: string | null;
  metric: string;
  value: number | string | boolean | null;
  unit: string | null;
  quality_flags: string[];
  confidence: number | null;
  observed_at_ts_ms: number;
  source_fact_id: string;
};

type DeviceObservationDbConn = PoolClient;

type DeviceObservationPipelineResultV1 = {
  observation: { fact_id: string; occurred_at_iso: string };
  pipeline: RunSensingInferencePipelineV1Result | null;
  read_model_refresh:
    | Awaited<ReturnType<typeof refreshFieldReadModelsWithObservabilityV1>>
    | null;
};

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function normalizeNonEmpty(v: string | null | undefined, fallback: string): string {
  const normalized = String(v ?? "").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeMetricAndUnit(metricRaw: string, unitRaw: string | null): { metric: string; unit: string } {
  const fallbackMetric = normalizeNonEmpty(metricRaw, "unknown_metric").toLowerCase().replace(/\s+/g, "_");
  const metric = toCanonicalTelemetryMetricNameV1(fallbackMetric);
  const incomingUnit = normalizeNonEmpty(unitRaw, "");
  if (!isTelemetryMetricNameV1(metric)) return { metric, unit: normalizeNonEmpty(unitRaw, "unitless").toLowerCase() };
  if (!incomingUnit) return { metric, unit: TELEMETRY_METRIC_CATALOG_V1[metric].unit };
  if (!isValidTelemetryUnitV1(metric, incomingUnit)) return { metric, unit: TELEMETRY_METRIC_CATALOG_V1[metric].unit };
  return { metric, unit: TELEMETRY_METRIC_CATALOG_V1[metric].unit };
}

function normalizeNumericValue(value: number | string | boolean | null): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error("DEVICE_OBSERVATION_VALUE_NOT_NUMERIC");
}

function clampConfidence(v: number | null): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function normalizeQualityFlags(input: string[]): DeviceObservationQualityFlagV1[] {
  const out = new Set<DeviceObservationQualityFlagV1>();
  for (const raw of Array.isArray(input) ? input : []) {
    const k = String(raw || "").trim().toUpperCase();
    if (k === "OK") out.add("OK");
    else if (k === "SUSPECT") out.add("SUSPECT");
    else if (k === "OUTLIER" || k === "NOT_FINITE") out.add("OUTLIER");
    else if (k === "MISSING_VALUE" || k === "MISSING_CONTEXT") out.add("MISSING_CONTEXT");
    else if (k === "CALIBRATION_DUE") out.add("CALIBRATION_DUE");
  }
  if (out.size < 1) out.add("OK");
  return [...out.values()];
}

/**
 * Contract boundary:
 * raw_telemetry_v1 is ingress evidence only and MUST NOT be consumed by business read models.
 * Business pipelines must consume device_observation_v1 only.
 */
export async function writeDeviceObservationFactV1(clientConn: PoolClient, input: DeviceObservationServiceV1Input): Promise<{ fact_id: string; occurred_at_iso: string }> {
  const nowIso = new Date().toISOString();
  const occurred_at_iso = new Date(input.observed_at_ts_ms).toISOString();
  const normalizedTelemetry = normalizeMetricAndUnit(input.metric, input.unit);
  const metric = normalizedTelemetry.metric;
  const unit = normalizedTelemetry.unit;
  const value_num = normalizeNumericValue(input.value);
  const confidence = clampConfidence(input.confidence);
  const quality_flags = normalizeQualityFlags(input.quality_flags);
  const project_id = normalizeNonEmpty(input.project_id, "_na_project");
  const group_id = normalizeNonEmpty(input.group_id, "_na_group");
  const field_id = normalizeNonEmpty(input.field_id, "_na_field");

  const contractPayload = {
    type: "device_observation_v1" as const,
    schema_version: "1.0.0" as const,
    tenant_id: normalizeNonEmpty(input.tenant_id, ""),
    project_id,
    group_id,
    field_id,
    device_id: normalizeNonEmpty(input.device_id, ""),
    observed_at: occurred_at_iso,
    ingested_at: nowIso,
    metric_key: metric,
    metric_value: value_num,
    metric_unit: unit,
    confidence,
    quality_flags,
    explanation_codes: ["normalized_from_raw_telemetry_v1"],
  };
  const parsed = DeviceObservationV1Schema.safeParse(contractPayload);
  if (!parsed.success) {
    throw new Error(`DEVICE_OBSERVATION_CONTRACT_VIOLATION:${parsed.error.issues.map((x) => x.message).join("|")}`);
  }

  const fact_id = `obs_${sha256Hex(`${input.tenant_id}|${field_id}|${input.device_id}|${metric}|${input.observed_at_ts_ms}|${input.source_fact_id}`)}`;

  const record = {
    type: "device_observation_v1",
    entity: {
      tenant_id: input.tenant_id,
      project_id,
      group_id,
      device_id: input.device_id,
      field_id,
    },
    payload: {
      metric,
      value: value_num,
      unit,
      quality_flags,
      confidence,
      observed_at_ts_ms: input.observed_at_ts_ms,
      source_fact_id: input.source_fact_id,
      contract: parsed.data,
    },
  };

  await clientConn.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2::timestamptz, $3, $4)
     ON CONFLICT (fact_id) DO NOTHING`,
    [fact_id, occurred_at_iso, "gateway", JSON.stringify(record)]
  );

  await clientConn.query(
    `INSERT INTO device_observation_index_v1
      (tenant_id, project_id, group_id, device_id, field_id, metric, observed_at, observed_at_ts_ms, value_num, value_text, unit, confidence, quality_flags_json, fact_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10, $11, $12, $13::jsonb, $14)
     ON CONFLICT (tenant_id, device_id, metric, observed_at_ts_ms) DO NOTHING`,
    [
      input.tenant_id,
      project_id,
      group_id,
      input.device_id,
      field_id,
      metric,
      occurred_at_iso,
      input.observed_at_ts_ms,
      value_num,
      String(value_num),
      unit,
      confidence,
      JSON.stringify(quality_flags),
      fact_id,
    ]
  );

  return { fact_id, occurred_at_iso };
}

export async function ensureDeviceObservationProjectionV1(clientConn: PoolClient): Promise<void> {
  await clientConn.query(
    `CREATE TABLE IF NOT EXISTS device_observation_index_v1 (
      tenant_id text NOT NULL,
      project_id text NULL,
      group_id text NULL,
      device_id text NOT NULL,
      field_id text NULL,
      metric text NOT NULL,
      observed_at timestamptz NOT NULL,
      observed_at_ts_ms bigint NOT NULL,
      value_num double precision NULL,
      value_text text NULL,
      unit text NULL,
      confidence double precision NULL,
      quality_flags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      fact_id text NOT NULL,
      PRIMARY KEY (tenant_id, device_id, metric, observed_at_ts_ms)
    )`
  );
  await clientConn.query(`CREATE INDEX IF NOT EXISTS idx_device_observation_index_v1_scope_time ON device_observation_index_v1 (tenant_id, project_id, group_id, field_id, metric, observed_at_ts_ms DESC)`);
  await clientConn.query(`CREATE INDEX IF NOT EXISTS idx_device_observation_index_v1_device_metric_time ON device_observation_index_v1 (tenant_id, device_id, metric, observed_at_ts_ms DESC)`);
  await clientConn.query(`CREATE INDEX IF NOT EXISTS idx_device_observation_index_v1_tenant_field_time ON device_observation_index_v1 (tenant_id, field_id, observed_at_ts_ms DESC)`);
  await clientConn.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_device_observation_index_v1_fact_id ON device_observation_index_v1 (fact_id)`);
}

function toFiniteNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapObservationMetricToPipelineShape(metric: string, valueNum: number, device_id: string): Record<string, unknown> {
  return mapStage1ObservationMetricToPipelineObservationV1(metric, valueNum, device_id);
}

async function loadRecentFieldObservationsForPipelineV1(db: DeviceObservationDbConn, params: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
}): Promise<Array<Record<string, unknown>>> {
  const rows = await db.query(
    `SELECT device_id, metric, value_num, fact_id
       FROM device_observation_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND field_id = $4
      ORDER BY observed_at_ts_ms DESC
      LIMIT 256`,
    [params.tenant_id, params.project_id, params.group_id, params.field_id]
  );

  return (rows.rows ?? [])
    .map((row: any): Record<string, unknown> | null => {
      const metric = String(row.metric ?? "").trim();
      const device_id = String(row.device_id ?? "").trim();
      const observation_id = String(row.fact_id ?? "").trim();
      const valueNum = toFiniteNumber(row.value_num);
      if (!metric || !device_id || !observation_id || valueNum == null) return null;
      return {
        ...mapObservationMetricToPipelineShape(metric, valueNum, device_id),
        observation_id,
        fact_id: observation_id,
      };
    })
    .filter((row: Record<string, unknown> | null): row is Record<string, unknown> => Boolean(row));
}

/**
 * Unified official sensing path:
 * observation write -> runSensingInferencePipelineV1 -> derived states -> read model refresh.
 */
export async function writeObservationRunPipelineAndRefreshFieldV1(
  db: DeviceObservationDbConn,
  input: DeviceObservationServiceV1Input
): Promise<DeviceObservationPipelineResultV1> {
  const observation = await writeDeviceObservationFactV1(db, input);
  const project_id = normalizeNonEmpty(input.project_id, "_na_project");
  const group_id = normalizeNonEmpty(input.group_id, "_na_group");
  const field_id = normalizeNonEmpty(input.field_id, "_na_field");

  if (field_id === "_na_field") {
    return { observation, pipeline: null, read_model_refresh: null };
  }

  const observations = await loadRecentFieldObservationsForPipelineV1(db, {
    tenant_id: input.tenant_id,
    project_id,
    group_id,
    field_id,
  });
  const source_device_ids = Array.from(
    new Set(
      observations
        .map((item) => String(item.device_id ?? "").trim())
        .filter(Boolean)
    )
  );
  const source_observation_ids = Array.from(
    new Set(
      observations
        .map((item) => String(item.observation_id ?? item.fact_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const pipeline = await runSensingInferencePipelineV1({
    db,
    tenant_id: input.tenant_id,
    project_id,
    group_id,
    field_id,
    source_device_ids,
    source_observation_ids,
    observations,
    now: Number.isFinite(input.observed_at_ts_ms) ? input.observed_at_ts_ms : Date.now(),
  });

  const read_model_refresh = await refreshFieldReadModelsWithObservabilityV1(db, {
    tenant_id: input.tenant_id,
    project_id,
    group_id,
    field_id,
  });

  return { observation, pipeline, read_model_refresh };
}
