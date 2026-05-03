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


CREATE TABLE IF NOT EXISTS field_tags_v1 (
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NULL,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, tag)
);

CREATE INDEX IF NOT EXISTS field_tags_v1_lookup_idx
  ON field_tags_v1 (tenant_id, project_id, group_id, field_id, created_at DESC);

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
  ALTER COLUMN field_name DROP NOT NULL;

ALTER TABLE field_index_v1
  ADD COLUMN IF NOT EXISTS name TEXT;

UPDATE field_index_v1
SET name = COALESCE(name, field_name)
WHERE name IS NULL;

UPDATE field_index_v1
SET field_name = COALESCE(field_name, name)
WHERE field_name IS NULL;

ALTER TABLE field_index_v1
  ADD COLUMN IF NOT EXISTS area_ha DOUBLE PRECISION;

ALTER TABLE field_index_v1
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE field_index_v1
SET area_ha = COALESCE(area_ha, area_m2 / 10000.0)
WHERE area_m2 IS NOT NULL;

UPDATE field_index_v1
SET area_m2 = COALESCE(area_m2, area_ha * 10000.0)
WHERE area_ha IS NOT NULL;

UPDATE field_index_v1
SET status = COALESCE(status, 'ACTIVE')
WHERE status IS NULL;

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
  project_id TEXT NULL,
  group_id TEXT NULL,
  device_id TEXT NOT NULL,
  last_telemetry_ts_ms BIGINT NULL,
  last_heartbeat_ts_ms BIGINT NULL,
  battery_percent INTEGER NULL,
  rssi_dbm INTEGER NULL,
  fw_ver TEXT NULL,
  updated_ts_ms BIGINT NOT NULL,
  PRIMARY KEY (tenant_id, device_id)
);

CREATE INDEX IF NOT EXISTS device_status_index_v1_scope_device_idx
  ON device_status_index_v1 (tenant_id, project_id, group_id, device_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_device_binding_index_v1_tenant_device
  ON device_binding_index_v1 (tenant_id, device_id);

CREATE TABLE IF NOT EXISTS agronomy_signal_snapshot_v1 (
  tenant_id TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS field_memory_v1 (
  memory_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  operation_id TEXT,
  prescription_id TEXT,
  recommendation_id TEXT,
  memory_type TEXT NOT NULL,
  summary TEXT,
  metrics JSONB,
  skill_refs JSONB,
  evidence_refs JSONB,
  created_at BIGINT NOT NULL
);

ALTER TABLE field_memory_v1
  ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT 'projectA',
  ADD COLUMN IF NOT EXISTS group_id TEXT NOT NULL DEFAULT 'groupA',
  ADD COLUMN IF NOT EXISTS season_id TEXT,
  ADD COLUMN IF NOT EXISTS crop_id TEXT,
  ADD COLUMN IF NOT EXISTS metric_key TEXT,
  ADD COLUMN IF NOT EXISTS metric_value NUMERIC,
  ADD COLUMN IF NOT EXISTS metric_unit TEXT,
  ADD COLUMN IF NOT EXISTS before_value NUMERIC,
  ADD COLUMN IF NOT EXISTS after_value NUMERIC,
  ADD COLUMN IF NOT EXISTS baseline_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delta_value NUMERIC,
  ADD COLUMN IF NOT EXISTS target_range JSONB,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC NOT NULL DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS source_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS task_id TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_id TEXT,
  ADD COLUMN IF NOT EXISTS roi_id TEXT,
  ADD COLUMN IF NOT EXISTS skill_id TEXT,
  ADD COLUMN IF NOT EXISTS skill_trace_ref TEXT,
  ADD COLUMN IF NOT EXISTS summary_text TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE field_memory_v1
SET
  summary_text = COALESCE(summary_text, summary),
  metric_key = COALESCE(metric_key,
    CASE
      WHEN memory_type = 'FIELD_RESPONSE_MEMORY' THEN 'soil_moisture_response'
      WHEN memory_type = 'DEVICE_RELIABILITY_MEMORY' THEN 'valve_response_status'
      WHEN memory_type = 'SKILL_PERFORMANCE_MEMORY' THEN 'irrigation_skill_outcome'
      ELSE 'field_memory_metric'
    END
  ),
  source_id = COALESCE(NULLIF(source_id, ''), operation_id, memory_id),
  source_type = COALESCE(NULLIF(source_type, ''), 'migration_backfill')
WHERE TRUE;

CREATE INDEX IF NOT EXISTS idx_field_memory_v1_scope_field_occurred
  ON field_memory_v1(tenant_id, project_id, group_id, field_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_scope_operation
  ON field_memory_v1(tenant_id, project_id, group_id, operation_id);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_scope_skill
  ON field_memory_v1(tenant_id, project_id, group_id, skill_id);

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

CREATE INDEX IF NOT EXISTS idx_device_observation_index_v1_scope_time
  ON device_observation_index_v1 (tenant_id, project_id, group_id, field_id, metric, observed_at_ts_ms DESC);
CREATE INDEX IF NOT EXISTS idx_device_observation_index_v1_device_metric_time
  ON device_observation_index_v1 (tenant_id, device_id, metric, observed_at_ts_ms DESC);
CREATE INDEX IF NOT EXISTS idx_device_observation_index_v1_tenant_field_time
  ON device_observation_index_v1 (tenant_id, field_id, observed_at_ts_ms DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_device_observation_index_v1_fact_id
  ON device_observation_index_v1 (fact_id);
