-- apps/server/db/migrations/2026_06_28_tk13_formalization_layer_v0.sql
-- Purpose: add explicit formalization records for ROI and Field Memory references used by decision_cycle_v1.
-- Boundary: this migration creates formalization tables only; it does not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, automatic ROI, automatic Field Memory, or model updates.

CREATE TABLE IF NOT EXISTS roi_entry_v1 (
  roi_entry_id text PRIMARY KEY,
  decision_cycle_id text NOT NULL REFERENCES decision_cycle_v1(decision_cycle_id),
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  as_of_ts timestamptz NOT NULL,
  roi_status text NOT NULL,
  formalized_by text NOT NULL,
  formalized_at timestamptz NOT NULL,
  roi_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_object_refs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS roi_entry_v1_decision_cycle_id_idx ON roi_entry_v1(decision_cycle_id);
CREATE INDEX IF NOT EXISTS roi_entry_v1_scope_idx ON roi_entry_v1(tenant_id, project_id, group_id, field_id);

CREATE TABLE IF NOT EXISTS field_memory_v1 (
  field_memory_id text PRIMARY KEY,
  decision_cycle_id text NOT NULL REFERENCES decision_cycle_v1(decision_cycle_id),
  field_learning_candidate_id text NOT NULL REFERENCES field_learning_candidate_v1(field_learning_candidate_id),
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  as_of_ts timestamptz NOT NULL,
  memory_status text NOT NULL,
  formalized_by text NOT NULL,
  formalized_at timestamptz NOT NULL,
  memory_statement_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_object_refs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_update_created boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS field_memory_v1_decision_cycle_id_idx ON field_memory_v1(decision_cycle_id);
CREATE INDEX IF NOT EXISTS field_memory_v1_candidate_id_idx ON field_memory_v1(field_learning_candidate_id);
CREATE INDEX IF NOT EXISTS field_memory_v1_scope_idx ON field_memory_v1(tenant_id, project_id, group_id, field_id);
