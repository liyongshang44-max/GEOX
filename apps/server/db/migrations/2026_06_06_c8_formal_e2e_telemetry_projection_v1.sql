-- apps/server/db/migrations/2026_06_06_c8_formal_e2e_telemetry_projection_v1.sql
-- Purpose: own telemetry/device-observation projection schema for raw-to-report derivation routes.

CREATE TABLE IF NOT EXISTS telemetry_index_v1 (
  tenant_id text NOT NULL,
  device_id text NOT NULL,
  metric text NOT NULL,
  ts timestamptz NOT NULL,
  value_num double precision NULL,
  value_text text NULL,
  fact_id text NOT NULL,
  PRIMARY KEY (tenant_id, device_id, metric, ts)
);

CREATE TABLE IF NOT EXISTS device_observation_index_v1 (
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
);

ALTER TABLE device_observation_index_v1
  ADD COLUMN IF NOT EXISTS project_id text;

ALTER TABLE device_observation_index_v1
  ADD COLUMN IF NOT EXISTS group_id text;

ALTER TABLE device_observation_index_v1
  ADD COLUMN IF NOT EXISTS unit text;

ALTER TABLE device_observation_index_v1
  ADD COLUMN IF NOT EXISTS confidence double precision;

ALTER TABLE device_observation_index_v1
  ADD COLUMN IF NOT EXISTS quality_flags_json jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_device_observation_index_v1_scope_time
  ON device_observation_index_v1 (tenant_id, project_id, group_id, field_id, metric, observed_at_ts_ms DESC);

CREATE INDEX IF NOT EXISTS idx_device_observation_index_v1_device_metric_time
  ON device_observation_index_v1 (tenant_id, device_id, metric, observed_at_ts_ms DESC);

CREATE INDEX IF NOT EXISTS idx_device_observation_index_v1_tenant_field_time
  ON device_observation_index_v1 (tenant_id, field_id, observed_at_ts_ms DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_device_observation_index_v1_fact_id
  ON device_observation_index_v1 (fact_id);
