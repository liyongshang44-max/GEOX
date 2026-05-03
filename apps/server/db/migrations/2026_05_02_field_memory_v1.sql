ALTER TABLE field_memory_v1
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
  ADD COLUMN IF NOT EXISTS confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS task_id TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_id TEXT,
  ADD COLUMN IF NOT EXISTS roi_id TEXT,
  ADD COLUMN IF NOT EXISTS skill_id TEXT,
  ADD COLUMN IF NOT EXISTS skill_trace_ref TEXT,
  ADD COLUMN IF NOT EXISTS summary_text TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

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

  IF created_at_type = 'bigint' THEN
    UPDATE field_memory_v1
       SET occurred_at = COALESCE(occurred_at, to_timestamp(created_at / 1000.0));
  ELSE
    UPDATE field_memory_v1
       SET occurred_at = COALESCE(occurred_at, created_at::timestamptz);
  END IF;
END $$;

UPDATE field_memory_v1
SET metric_key = COALESCE(metric_key, 'legacy_metric'),
    confidence = COALESCE(confidence, 0.5),
    source_type = COALESCE(source_type, 'legacy'),
    source_id = COALESCE(source_id, memory_id),
    evidence_refs = COALESCE(evidence_refs, '[]'::jsonb),
    summary_text = COALESCE(summary_text, summary);

ALTER TABLE field_memory_v1 ALTER COLUMN metric_key SET NOT NULL;
ALTER TABLE field_memory_v1 ALTER COLUMN confidence SET NOT NULL;
ALTER TABLE field_memory_v1 ALTER COLUMN source_type SET NOT NULL;
ALTER TABLE field_memory_v1 ALTER COLUMN source_id SET NOT NULL;
ALTER TABLE field_memory_v1 ALTER COLUMN evidence_refs SET DEFAULT '[]'::jsonb;
ALTER TABLE field_memory_v1 ALTER COLUMN evidence_refs SET NOT NULL;
ALTER TABLE field_memory_v1 ALTER COLUMN occurred_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_field_memory_v1_tenant_field_occurred ON field_memory_v1(tenant_id, field_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_tenant_field_season ON field_memory_v1(tenant_id, field_id, season_id);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_operation ON field_memory_v1(operation_id);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_skill_id ON field_memory_v1(skill_id);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_memory_type ON field_memory_v1(memory_type);
