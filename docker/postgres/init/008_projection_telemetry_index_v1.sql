-- 008: Projection telemetry_index_v1 (Sprint A1)
-- Purpose: minimal query index for raw_telemetry_v1 facts written by MQTT ingest.
-- Notes:
-- - This is NOT a replacement for the append-only facts ledger.
-- - This table is an auxiliary projection for efficient time-range queries.

CREATE TABLE IF NOT EXISTS telemetry_index_v1 (
  tenant_id text NOT NULL,
  device_id text NOT NULL,
  metric    text NOT NULL,
  ts        timestamptz NOT NULL,
  value_num double precision NULL,
  value_text text NULL,
  fact_id   text NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, device_id, metric, ts)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_index_v1_tenant_device_ts
  ON telemetry_index_v1 (tenant_id, device_id, ts);
