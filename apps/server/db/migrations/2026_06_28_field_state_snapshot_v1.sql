-- path: apps/server/db/migrations/2026_06_28_field_state_snapshot_v1.sql
-- Purpose: create the first formal Twin Kernel state snapshot object.
-- Boundary: schema-only migration; no forecasts, scenarios, recommendations, approvals, tasks, receipts, ROI, Field Memory, calibration, or learning records are inserted.

CREATE TABLE IF NOT EXISTS field_state_snapshot_v1 (
  snapshot_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text,
  as_of_ts timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('SNAPSHOT_READY', 'SNAPSHOT_BLOCKED')),
  state_vector_json jsonb NOT NULL,
  confidence_json jsonb NOT NULL,
  evidence_refs_json jsonb NOT NULL,
  source_indexes_json jsonb NOT NULL,
  blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  determinism_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, project_id, group_id, field_id, as_of_ts, determinism_hash)
);

CREATE INDEX IF NOT EXISTS field_state_snapshot_v1_scope_idx
  ON field_state_snapshot_v1 (tenant_id, project_id, group_id, field_id, as_of_ts DESC);

CREATE INDEX IF NOT EXISTS field_state_snapshot_v1_hash_idx
  ON field_state_snapshot_v1 (determinism_hash);
