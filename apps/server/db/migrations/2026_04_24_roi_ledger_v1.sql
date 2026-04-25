CREATE TABLE IF NOT EXISTS roi_ledger_v1 (
  roi_ledger_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  operation_id TEXT NULL,
  task_id TEXT NULL,
  prescription_id TEXT NULL,
  as_executed_id TEXT NULL,
  as_applied_id TEXT NULL,
  field_id TEXT NULL,
  season_id TEXT NULL,
  zone_id TEXT NULL,
  roi_type TEXT NOT NULL,
  baseline JSONB NOT NULL DEFAULT '{}'::jsonb,
  actual JSONB NOT NULL DEFAULT '{}'::jsonb,
  delta JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculation_method TEXT NOT NULL,
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  uncertainty_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_tenant_project_group
  ON roi_ledger_v1(tenant_id, project_id, group_id);

CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_task_id
  ON roi_ledger_v1(task_id);

CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_prescription_id
  ON roi_ledger_v1(prescription_id);

CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_as_executed_id
  ON roi_ledger_v1(as_executed_id);

CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_field_id
  ON roi_ledger_v1(field_id);

CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_roi_type
  ON roi_ledger_v1(roi_type);
