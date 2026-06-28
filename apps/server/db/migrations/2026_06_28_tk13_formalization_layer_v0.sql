-- apps/server/db/migrations/2026_06_28_tk13_formalization_layer_v0.sql
-- Purpose: add explicit formalization records for ROI and Field Memory references used by decision_cycle_v1.
-- Boundary: this migration creates or extends formalization tables only; it does not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, automatic ROI, automatic Field Memory, or model updates.

CREATE TABLE IF NOT EXISTS roi_entry_v1 (
  roi_entry_id text PRIMARY KEY,
  decision_cycle_id text,
  tenant_id text,
  project_id text,
  group_id text,
  field_id text,
  as_of_ts timestamptz,
  roi_status text,
  formalized_by text,
  formalized_at timestamptz,
  roi_summary_json jsonb DEFAULT '{}'::jsonb,
  evidence_refs_json jsonb DEFAULT '[]'::jsonb,
  source_object_refs_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS decision_cycle_id text;
ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS group_id text;
ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS field_id text;
ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS as_of_ts timestamptz;
ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS roi_status text;
ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS formalized_by text;
ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS formalized_at timestamptz;
ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS roi_summary_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS evidence_refs_json jsonb DEFAULT '[]'::jsonb;
ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS source_object_refs_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE roi_entry_v1 ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE roi_entry_v1 SET roi_summary_json = '{}'::jsonb WHERE roi_summary_json IS NULL;
UPDATE roi_entry_v1 SET evidence_refs_json = '[]'::jsonb WHERE evidence_refs_json IS NULL;
UPDATE roi_entry_v1 SET source_object_refs_json = '{}'::jsonb WHERE source_object_refs_json IS NULL;
UPDATE roi_entry_v1 SET created_at = now() WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS roi_entry_v1_decision_cycle_id_idx ON roi_entry_v1(decision_cycle_id);
CREATE INDEX IF NOT EXISTS roi_entry_v1_scope_idx ON roi_entry_v1(tenant_id, project_id, group_id, field_id);

CREATE TABLE IF NOT EXISTS field_memory_v1 (
  memory_id text PRIMARY KEY,
  field_memory_id text,
  decision_cycle_id text,
  field_learning_candidate_id text,
  tenant_id text,
  project_id text,
  group_id text,
  field_id text,
  as_of_ts timestamptz,
  memory_status text,
  formalized_by text,
  formalized_at timestamptz,
  memory_statement_json jsonb DEFAULT '{}'::jsonb,
  evidence_refs_json jsonb DEFAULT '[]'::jsonb,
  source_object_refs_json jsonb DEFAULT '{}'::jsonb,
  model_update_created boolean NOT NULL DEFAULT false,
  memory_type text DEFAULT 'FORMAL_FIELD_MEMORY',
  evidence_refs jsonb DEFAULT '[]'::jsonb,
  source_type text DEFAULT 'twin_kernel_formalization_v0',
  source_id text DEFAULT '',
  occurred_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS field_memory_id text;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS decision_cycle_id text;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS field_learning_candidate_id text;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS group_id text;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS field_id text;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS as_of_ts timestamptz;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS memory_status text;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS formalized_by text;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS formalized_at timestamptz;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS memory_statement_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS evidence_refs_json jsonb DEFAULT '[]'::jsonb;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS source_object_refs_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS model_update_created boolean DEFAULT false;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS memory_type text DEFAULT 'FORMAL_FIELD_MEMORY';
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS evidence_refs jsonb DEFAULT '[]'::jsonb;
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'twin_kernel_formalization_v0';
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS source_id text DEFAULT '';
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS occurred_at timestamptz DEFAULT now();
ALTER TABLE field_memory_v1 ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE field_memory_v1 SET field_memory_id = memory_id WHERE field_memory_id IS NULL;
UPDATE field_memory_v1 SET memory_statement_json = '{}'::jsonb WHERE memory_statement_json IS NULL;
UPDATE field_memory_v1 SET evidence_refs_json = '[]'::jsonb WHERE evidence_refs_json IS NULL;
UPDATE field_memory_v1 SET source_object_refs_json = '{}'::jsonb WHERE source_object_refs_json IS NULL;
UPDATE field_memory_v1 SET model_update_created = false WHERE model_update_created IS NULL;
UPDATE field_memory_v1 SET memory_type = 'FORMAL_FIELD_MEMORY' WHERE memory_type IS NULL;
UPDATE field_memory_v1 SET evidence_refs = '[]'::jsonb WHERE evidence_refs IS NULL;
UPDATE field_memory_v1 SET source_type = 'twin_kernel_formalization_v0' WHERE source_type IS NULL;
UPDATE field_memory_v1 SET source_id = '' WHERE source_id IS NULL;
UPDATE field_memory_v1 SET occurred_at = now() WHERE occurred_at IS NULL;
UPDATE field_memory_v1 SET created_at = now() WHERE created_at IS NULL;

ALTER TABLE field_memory_v1 ALTER COLUMN model_update_created SET DEFAULT false;
ALTER TABLE field_memory_v1 ALTER COLUMN model_update_created SET NOT NULL;

CREATE INDEX IF NOT EXISTS field_memory_v1_id_idx ON field_memory_v1(field_memory_id);
CREATE INDEX IF NOT EXISTS field_memory_v1_decision_cycle_id_idx ON field_memory_v1(decision_cycle_id);
CREATE INDEX IF NOT EXISTS field_memory_v1_candidate_id_idx ON field_memory_v1(field_learning_candidate_id);
CREATE INDEX IF NOT EXISTS field_memory_v1_scope_idx ON field_memory_v1(tenant_id, project_id, group_id, field_id);
