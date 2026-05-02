-- contract alignment hardening for field_memory_v1
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
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_field_memory_v1_tenant_field_occurred ON field_memory_v1(tenant_id, field_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_tenant_field_season ON field_memory_v1(tenant_id, field_id, season_id);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_operation ON field_memory_v1(operation_id);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_skill_id ON field_memory_v1(skill_id);
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_memory_type ON field_memory_v1(memory_type);
