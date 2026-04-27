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

CREATE INDEX IF NOT EXISTS idx_field_memory_field
  ON field_memory_v1(field_id);

CREATE INDEX IF NOT EXISTS idx_field_memory_type
  ON field_memory_v1(memory_type);
