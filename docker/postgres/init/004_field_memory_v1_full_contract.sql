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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

CREATE INDEX IF NOT EXISTS idx_device_observation_index_v1_scope_time
  ON device_observation_index_v1 (tenant_id, project_id, group_id, field_id, metric, observed_at_ts_ms DESC);
CREATE INDEX IF NOT EXISTS idx_device_observation_index_v1_device_metric_time
  ON device_observation_index_v1 (tenant_id, device_id, metric, observed_at_ts_ms DESC);
CREATE INDEX IF NOT EXISTS idx_device_observation_index_v1_tenant_field_time
  ON device_observation_index_v1 (tenant_id, field_id, observed_at_ts_ms DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_device_observation_index_v1_fact_id
  ON device_observation_index_v1 (fact_id);

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
