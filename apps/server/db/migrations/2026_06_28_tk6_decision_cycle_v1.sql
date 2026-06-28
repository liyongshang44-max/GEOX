-- path: apps/server/db/migrations/2026_06_28_tk6_decision_cycle_v1.sql
-- Purpose: create TK6 decision_cycle_v1 as the final human-in-the-loop Twin Kernel cycle object.

CREATE TABLE IF NOT EXISTS decision_cycle_v1 (
  decision_cycle_id text PRIMARY KEY,
  snapshot_id text NOT NULL REFERENCES field_state_snapshot_v1(snapshot_id),
  forecast_run_id text NOT NULL REFERENCES forecast_run_v1(forecast_run_id),
  scenario_set_id text NOT NULL REFERENCES scenario_set_v1(scenario_set_id),
  calibration_replay_id text NOT NULL REFERENCES calibration_replay_v1(calibration_replay_id),
  forecast_error_id text NOT NULL REFERENCES forecast_error_v1(forecast_error_id),
  field_learning_candidate_id text NOT NULL REFERENCES field_learning_candidate_v1(field_learning_candidate_id),
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  as_of_ts timestamptz NOT NULL,
  cycle_status text NOT NULL CHECK (cycle_status IN ('DECISION_CYCLE_READY', 'DECISION_CYCLE_BLOCKED')),
  current_stage text NOT NULL,
  external_refs_json jsonb NOT NULL,
  state_machine_json jsonb NOT NULL,
  human_gate_json jsonb NOT NULL,
  boundary_flags_json jsonb NOT NULL,
  blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  determinism_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (field_learning_candidate_id, determinism_hash)
);

CREATE INDEX IF NOT EXISTS decision_cycle_v1_learning_candidate_idx
  ON decision_cycle_v1 (field_learning_candidate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS decision_cycle_v1_forecast_error_idx
  ON decision_cycle_v1 (forecast_error_id, created_at DESC);

CREATE INDEX IF NOT EXISTS decision_cycle_v1_scope_idx
  ON decision_cycle_v1 (tenant_id, project_id, group_id, field_id, as_of_ts DESC);
