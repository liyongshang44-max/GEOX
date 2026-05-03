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

DO $$
DECLARE
  created_at_type text;
BEGIN
  SELECT data_type
    INTO created_at_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'field_memory_v1'
     AND column_name = 'created_at';

  IF created_at_type IN ('bigint', 'integer', 'numeric') THEN
    ALTER TABLE field_memory_v1 RENAME COLUMN created_at TO created_at_legacy_ms;
    ALTER TABLE field_memory_v1 ADD COLUMN created_at TIMESTAMPTZ;
    UPDATE field_memory_v1
       SET created_at = COALESCE(
         to_timestamp((created_at_legacy_ms::text)::double precision / 1000.0),
         now()
       )
     WHERE created_at IS NULL;
  ELSIF created_at_type = 'timestamp with time zone' THEN
    NULL;
  ELSIF created_at_type = 'timestamp without time zone' THEN
    ALTER TABLE field_memory_v1
      ALTER COLUMN created_at TYPE TIMESTAMPTZ
      USING created_at AT TIME ZONE 'UTC';
  ELSE
    ALTER TABLE field_memory_v1
      ALTER COLUMN created_at TYPE TIMESTAMPTZ
      USING now();
  END IF;

  ALTER TABLE field_memory_v1 ALTER COLUMN created_at SET DEFAULT now();
  ALTER TABLE field_memory_v1 ALTER COLUMN created_at SET NOT NULL;
END $$;

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
