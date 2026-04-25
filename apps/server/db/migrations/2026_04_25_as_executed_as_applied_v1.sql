CREATE TABLE IF NOT EXISTS as_executed_record_v1 (
  as_executed_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  field_id TEXT NULL,
  task_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  prescription_id TEXT NOT NULL,
  executor JSONB NOT NULL DEFAULT '{}'::jsonb,
  planned JSONB NOT NULL DEFAULT '{}'::jsonb,
  executed JSONB NOT NULL DEFAULT '{}'::jsonb,
  deviation JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  receipt_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  log_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS as_applied_map_v1 (
  as_applied_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  field_id TEXT NULL,
  task_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  prescription_id TEXT NOT NULL,
  geometry JSONB NOT NULL DEFAULT '{}'::jsonb,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  application JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  log_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_as_executed_record_v1_task_id
  ON as_executed_record_v1(task_id);

CREATE INDEX IF NOT EXISTS idx_as_executed_record_v1_receipt_id
  ON as_executed_record_v1(receipt_id);

CREATE INDEX IF NOT EXISTS idx_as_executed_record_v1_prescription_id
  ON as_executed_record_v1(prescription_id);

CREATE INDEX IF NOT EXISTS idx_as_executed_record_v1_tenant_field
  ON as_executed_record_v1(tenant_id, field_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_as_executed_record_v1_scope_task_receipt
  ON as_executed_record_v1(tenant_id, project_id, group_id, task_id, receipt_id);

CREATE INDEX IF NOT EXISTS idx_as_applied_map_v1_task_id
  ON as_applied_map_v1(task_id);

CREATE INDEX IF NOT EXISTS idx_as_applied_map_v1_receipt_id
  ON as_applied_map_v1(receipt_id);

CREATE INDEX IF NOT EXISTS idx_as_applied_map_v1_prescription_id
  ON as_applied_map_v1(prescription_id);

CREATE INDEX IF NOT EXISTS idx_as_applied_map_v1_tenant_field
  ON as_applied_map_v1(tenant_id, field_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_as_applied_map_v1_scope_task_receipt
  ON as_applied_map_v1(tenant_id, project_id, group_id, task_id, receipt_id);
