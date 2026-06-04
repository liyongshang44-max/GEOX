ALTER TABLE roi_ledger_v1
  ADD COLUMN IF NOT EXISTS operation_id text,
  ADD COLUMN IF NOT EXISTS trust_level text,
  ADD COLUMN IF NOT EXISTS source_lane text,
  ADD COLUMN IF NOT EXISTS formal_acceptance_id text,
  ADD COLUMN IF NOT EXISTS formal_evidence_passed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chain_validation_passed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_visible_value boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trust_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP INDEX IF EXISTS idx_roi_ledger_v1_formal_acceptance;
CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_formal_acceptance
  ON roi_ledger_v1 (tenant_id, project_id, group_id, formal_acceptance_id);

ALTER TABLE field_memory_v1
  ADD COLUMN IF NOT EXISTS memory_lane text,
  ADD COLUMN IF NOT EXISTS trust_level text,
  ADD COLUMN IF NOT EXISTS formal_acceptance_id text,
  ADD COLUMN IF NOT EXISTS source_lane text,
  ADD COLUMN IF NOT EXISTS customer_visible_memory boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS learning_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trust_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS before_value double precision,
  ADD COLUMN IF NOT EXISTS after_value double precision,
  ADD COLUMN IF NOT EXISTS delta_value double precision;

DROP INDEX IF EXISTS idx_field_memory_v1_formal_acceptance;
CREATE INDEX IF NOT EXISTS idx_field_memory_v1_formal_acceptance
  ON field_memory_v1 (tenant_id, project_id, group_id, formal_acceptance_id);
