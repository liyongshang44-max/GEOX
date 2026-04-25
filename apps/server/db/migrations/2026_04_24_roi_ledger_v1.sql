CREATE TABLE IF NOT EXISTS roi_ledger_v1 (
  roi_ledger_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,

  operation_id text NULL,
  task_id text NULL,
  prescription_id text NULL,
  as_executed_id text NULL,
  as_applied_id text NULL,

  field_id text NULL,
  season_id text NULL,
  zone_id text NULL,

  roi_type text NOT NULL,
  baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual jsonb NOT NULL DEFAULT '{}'::jsonb,
  delta jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculation_method text NOT NULL DEFAULT 'manual_or_external_v1',
  assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  uncertainty_notes text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_tenant_scope
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

CREATE UNIQUE INDEX IF NOT EXISTS ux_roi_ledger_v1_as_executed_type
  ON roi_ledger_v1(tenant_id, project_id, group_id, as_executed_id, roi_type);
