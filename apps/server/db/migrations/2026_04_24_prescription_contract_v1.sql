CREATE TABLE IF NOT EXISTS prescription_contract_v1 (
  prescription_id TEXT PRIMARY KEY,
  recommendation_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  season_id TEXT NULL,
  crop_id TEXT NULL,
  zone_id TEXT NULL,
  operation_type TEXT NOT NULL,
  spatial_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  timing_window JSONB NOT NULL DEFAULT '{}'::jsonb,
  operation_amount JSONB NOT NULL DEFAULT '{}'::jsonb,
  device_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_requirement JSONB NOT NULL DEFAULT '{}'::jsonb,
  acceptance_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_prescription_contract_v1_recommendation_id
  ON prescription_contract_v1(recommendation_id);

CREATE INDEX IF NOT EXISTS idx_prescription_contract_v1_tenant_field
  ON prescription_contract_v1(tenant_id, field_id);

CREATE INDEX IF NOT EXISTS idx_prescription_contract_v1_status
  ON prescription_contract_v1(status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_prescription_contract_v1_tenant_project_group_recommendation
  ON prescription_contract_v1(tenant_id, project_id, group_id, recommendation_id);
