CREATE TABLE IF NOT EXISTS facts (
  fact_id TEXT PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  record_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS facts_occurred_at_idx
  ON facts (occurred_at DESC);

CREATE INDEX IF NOT EXISTS facts_record_json_idx
  ON facts
  USING GIN (record_json);

CREATE TABLE IF NOT EXISTS field_index_v1 (
  tenant_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  area_m2 DOUBLE PRECISION NULL,
  geojson_json TEXT NULL,
  created_ts_ms BIGINT NULL,
  updated_ts_ms BIGINT NULL,
  PRIMARY KEY (tenant_id, field_id)
);

CREATE TABLE IF NOT EXISTS field_polygon_v1 (
  tenant_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  polygon_geojson_json TEXT NOT NULL,
  area_m2 DOUBLE PRECISION NULL,
  created_ts_ms BIGINT NULL,
  updated_ts_ms BIGINT NULL,
  PRIMARY KEY (tenant_id, field_id)
);

CREATE TABLE IF NOT EXISTS device_index_v1 (
  tenant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_ts_ms BIGINT NOT NULL,
  last_credential_id TEXT NULL,
  last_credential_status TEXT NULL,
  PRIMARY KEY (tenant_id, device_id)
);

CREATE INDEX IF NOT EXISTS device_index_v1_lookup_idx
  ON device_index_v1 (tenant_id, created_ts_ms DESC);

CREATE TABLE IF NOT EXISTS device_binding_index_v1 (
  tenant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  bound_ts_ms BIGINT NULL,
  PRIMARY KEY (tenant_id, device_id, field_id)
);

CREATE INDEX IF NOT EXISTS device_binding_index_v1_lookup_idx
  ON device_binding_index_v1 (tenant_id, field_id, device_id);

CREATE TABLE IF NOT EXISTS device_capability (
  tenant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_ts_ms BIGINT NOT NULL,
  PRIMARY KEY (tenant_id, device_id)
);

CREATE INDEX IF NOT EXISTS device_capability_lookup_idx
  ON device_capability (tenant_id, device_id);

CREATE TABLE IF NOT EXISTS telemetry_index_v1 (
  tenant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  value_num DOUBLE PRECISION NULL,
  value_text TEXT NULL,
  fact_id TEXT NULL,
  PRIMARY KEY (tenant_id, device_id, metric, ts)
);

CREATE INDEX IF NOT EXISTS telemetry_index_v1_lookup_idx
  ON telemetry_index_v1 (tenant_id, device_id, metric, ts DESC);

CREATE TABLE IF NOT EXISTS alert_rule_index_v1 (
  tenant_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  status TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold_num DOUBLE PRECISION NULL,
  threshold_ms BIGINT NULL,
  window_sec INTEGER NULL,
  notify_channels_json TEXT NULL,
  created_ts_ms BIGINT NOT NULL,
  updated_ts_ms BIGINT NOT NULL,
  PRIMARY KEY (tenant_id, rule_id)
);

CREATE TABLE IF NOT EXISTS alert_event_index_v1 (
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  status TEXT NOT NULL,
  raised_ts_ms BIGINT NOT NULL,
  acked_ts_ms BIGINT NULL,
  closed_ts_ms BIGINT NULL,
  last_value_json TEXT NULL,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS alert_event_index_v1_lookup_idx
  ON alert_event_index_v1 (tenant_id, rule_id, object_type, object_id, metric, raised_ts_ms DESC);

CREATE TABLE IF NOT EXISTS alert_notification_index_v1 (
  tenant_id TEXT NOT NULL,
  notification_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  detail_json TEXT NULL,
  created_ts_ms BIGINT NOT NULL,
  delivered_ts_ms BIGINT NULL,
  error TEXT NULL,
  PRIMARY KEY (tenant_id, notification_id)
);

CREATE INDEX IF NOT EXISTS alert_notification_index_v1_lookup_idx
  ON alert_notification_index_v1 (tenant_id, event_id, rule_id, channel, created_ts_ms DESC);

ALTER TABLE field_index_v1
  ADD COLUMN IF NOT EXISTS name TEXT;

UPDATE field_index_v1
SET name = COALESCE(name, field_name)
WHERE name IS NULL;

CREATE TABLE IF NOT EXISTS device_credential_index_v1 (
  tenant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  credential_id TEXT NOT NULL,
  credential_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  issued_ts_ms BIGINT NOT NULL,
  revoked_ts_ms BIGINT NULL,
  created_ts_ms BIGINT NULL,
  updated_ts_ms BIGINT NULL,
  PRIMARY KEY (tenant_id, device_id, credential_id)
);

CREATE INDEX IF NOT EXISTS device_credential_index_v1_lookup_idx
  ON device_credential_index_v1 (tenant_id, device_id, status, issued_ts_ms DESC);

CREATE TABLE IF NOT EXISTS device_status_index_v1 (
  tenant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  last_telemetry_ts_ms BIGINT NULL,
  last_heartbeat_ts_ms BIGINT NULL,
  battery_percent INTEGER NULL,
  rssi_dbm INTEGER NULL,
  fw_ver TEXT NULL,
  updated_ts_ms BIGINT NOT NULL,
  PRIMARY KEY (tenant_id, device_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_device_binding_index_v1_tenant_device
  ON device_binding_index_v1 (tenant_id, device_id);

CREATE TABLE IF NOT EXISTS agronomy_signal_snapshot_v1 (
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  season_id TEXT NULL,
  soil_moisture_pct DOUBLE PRECISION,
  canopy_temp_c DOUBLE PRECISION,
  battery_percent INTEGER,
  observed_ts_ms BIGINT,
  updated_ts_ms BIGINT,
  PRIMARY KEY (tenant_id, device_id)
);

CREATE INDEX IF NOT EXISTS agronomy_signal_snapshot_v1_lookup_idx
  ON agronomy_signal_snapshot_v1 (tenant_id, field_id, device_id, updated_ts_ms DESC);
