-- path: apps/server/db/migrations/2026_06_28_tk5_field_learning_candidate_v1.sql
-- Purpose: create TK5 field_learning_candidate_v1 as a formal Twin Kernel learning-candidate object after TK4 error evidence.

CREATE TABLE IF NOT EXISTS field_learning_candidate_v1 (
  field_learning_candidate_id text PRIMARY KEY,
  calibration_replay_id text NOT NULL REFERENCES calibration_replay_v1(calibration_replay_id),
  forecast_error_id text NOT NULL REFERENCES forecast_error_v1(forecast_error_id),
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  as_of_ts timestamptz NOT NULL,
  candidate_status text NOT NULL CHECK (candidate_status IN ('LEARNING_CANDIDATE_READY', 'LEARNING_CANDIDATE_BLOCKED')),
  learning_scope text NOT NULL,
  learning_statement_json jsonb NOT NULL,
  supporting_evidence_refs_json jsonb NOT NULL,
  counter_evidence_refs_json jsonb NOT NULL,
  confidence_json jsonb NOT NULL,
  formal_gate_refs_json jsonb NOT NULL,
  h58_gate_status_json jsonb NOT NULL,
  blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  determinism_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calibration_replay_id, forecast_error_id, learning_scope, determinism_hash)
);

CREATE INDEX IF NOT EXISTS field_learning_candidate_v1_error_idx
  ON field_learning_candidate_v1 (forecast_error_id, created_at DESC);

CREATE INDEX IF NOT EXISTS field_learning_candidate_v1_replay_idx
  ON field_learning_candidate_v1 (calibration_replay_id, created_at DESC);

CREATE INDEX IF NOT EXISTS field_learning_candidate_v1_scope_idx
  ON field_learning_candidate_v1 (tenant_id, project_id, group_id, field_id, as_of_ts DESC);
