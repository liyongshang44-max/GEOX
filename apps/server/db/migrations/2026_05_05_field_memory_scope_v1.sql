ALTER TABLE field_memory_v1
  ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT 'projectA',
  ADD COLUMN IF NOT EXISTS group_id TEXT NOT NULL DEFAULT 'groupA';

CREATE INDEX IF NOT EXISTS idx_field_memory_v1_scope_field_occurred
  ON field_memory_v1(tenant_id, project_id, group_id, field_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_field_memory_v1_scope_operation
  ON field_memory_v1(tenant_id, project_id, group_id, operation_id);

CREATE INDEX IF NOT EXISTS idx_field_memory_v1_scope_skill
  ON field_memory_v1(tenant_id, project_id, group_id, skill_id);
