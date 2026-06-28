-- path: apps/server/db/migrations/2026_06_28_calibration_replay_and_forecast_error_v1.sql
-- Purpose: create TK4 calibration_replay_v1 and forecast_error_v1 formal Twin Kernel objects.

CREATE TABLE IF NOT EXISTS calibration_replay_v1 (
  calibration_replay_id text PRIMARY KEY,
  forecast_run_id text NOT NULL REFERENCES forecast_run_v1(forecast_run_id),
  scenario_set_id text NOT NULL REFERENCES scenario_set_v1(scenario_set_id),
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  as_of_ts timestamptz NOT NULL,
  selected_option_id text,
  status text NOT NULL CHECK (status IN ('CALIBRATION_REPLAY_READY', 'CALIBRATION_REPLAY_BLOCKED')),
  input_refs_json jsonb NOT NULL,
  predicted_json jsonb NOT NULL,
  observed_json jsonb NOT NULL,
  error_summary_json jsonb NOT NULL,
  reason_candidates_json jsonb NOT NULL,
  evidence_refs_json jsonb NOT NULL,
  blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  determinism_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (forecast_run_id, scenario_set_id, selected_option_id, determinism_hash)
);

CREATE TABLE IF NOT EXISTS forecast_error_v1 (
  forecast_error_id text PRIMARY KEY,
  calibration_replay_id text NOT NULL REFERENCES calibration_replay_v1(calibration_replay_id),
  forecast_run_id text NOT NULL REFERENCES forecast_run_v1(forecast_run_id),
  scenario_set_id text NOT NULL REFERENCES scenario_set_v1(scenario_set_id),
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  as_of_ts timestamptz NOT NULL,
  error_metric text NOT NULL,
  error_value numeric,
  error_direction text NOT NULL,
  predicted_json jsonb NOT NULL,
  observed_json jsonb NOT NULL,
  evidence_refs_json jsonb NOT NULL,
  blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  determinism_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calibration_replay_id, error_metric, determinism_hash)
);

CREATE INDEX IF NOT EXISTS calibration_replay_v1_scope_idx
  ON calibration_replay_v1 (tenant_id, project_id, group_id, field_id, as_of_ts DESC);

CREATE INDEX IF NOT EXISTS calibration_replay_v1_scenario_idx
  ON calibration_replay_v1 (scenario_set_id, created_at DESC);

CREATE INDEX IF NOT EXISTS forecast_error_v1_replay_idx
  ON forecast_error_v1 (calibration_replay_id, created_at DESC);

CREATE INDEX IF NOT EXISTS forecast_error_v1_scope_idx
  ON forecast_error_v1 (tenant_id, project_id, group_id, field_id, as_of_ts DESC);
