import crypto from "node:crypto";
import type { PoolClient } from "pg";

export type DeviceObservationV1Input = {
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

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function clampConfidence(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(1, v));
}

/**
 * NOTE (contract): raw_telemetry_v1 is ingress-only evidence and MUST NOT be used directly
 * as dashboard/agronomy business input. Downstream readers should consume normalized
 * device_observation_v1 (fact + index projection) instead.
 */
export async function appendDeviceObservationV1(clientConn: PoolClient, input: DeviceObservationV1Input): Promise<{ fact_id: string; occurred_at_iso: string }> {
  const occurred_at_iso = new Date(input.observed_at_ts_ms).toISOString();
  const normalizedMetric = String(input.metric || "").trim();
  const fact_id = `obs_${sha256Hex(`${input.tenant_id}|${input.device_id}|${normalizedMetric}|${input.observed_at_ts_ms}`)}`;

  const record = {
    type: "device_observation_v1",
    entity: {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      device_id: input.device_id,
      field_id: input.field_id,
    },
    payload: {
      metric: normalizedMetric,
      value: input.value,
      unit: input.unit,
      quality_flags: Array.isArray(input.quality_flags) ? input.quality_flags.filter(Boolean) : [],
      confidence: clampConfidence(input.confidence),
      observed_at_ts_ms: input.observed_at_ts_ms,
      source_fact_id: input.source_fact_id,
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
      input.project_id,
      input.group_id,
      input.device_id,
      input.field_id,
      normalizedMetric,
      occurred_at_iso,
      input.observed_at_ts_ms,
      typeof input.value === "number" && Number.isFinite(input.value) ? input.value : null,
      input.value == null ? null : String(input.value),
      input.unit,
      clampConfidence(input.confidence),
      JSON.stringify(Array.isArray(input.quality_flags) ? input.quality_flags.filter(Boolean) : []),
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
  await clientConn.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_device_observation_index_v1_fact_id ON device_observation_index_v1 (fact_id)`);
}
