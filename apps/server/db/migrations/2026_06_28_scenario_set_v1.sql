-- path: apps/server/db/migrations/2026_06_28_scenario_set_v1.sql
-- Purpose: create scenario_set_v1 as the TK3 deterministic water-management scenario-set object.

CREATE TABLE IF NOT EXISTS scenario_set_v1 (
  scenario_set_id text PRIMARY KEY,
  forecast_run_id text NOT NULL REFERENCES forecast_run_v1(forecast_run_id),
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  as_of_ts timestamptz NOT NULL,
  scenario_model_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('SCENARIO_SET_READY', 'SCENARIO_SET_BLOCKED')),
  input_refs_json jsonb NOT NULL,
  baseline_scenario_json jsonb NOT NULL,
  option_scenarios_json jsonb NOT NULL,
  comparison_axes_json jsonb NOT NULL,
  constraints_json jsonb NOT NULL,
  assumptions_json jsonb NOT NULL,
  blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  determinism_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (forecast_run_id, scenario_model_version, determinism_hash)
);

CREATE INDEX IF NOT EXISTS scenario_set_v1_forecast_idx
  ON scenario_set_v1 (forecast_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS scenario_set_v1_scope_idx
  ON scenario_set_v1 (tenant_id, project_id, group_id, field_id, as_of_ts DESC);

CREATE INDEX IF NOT EXISTS scenario_set_v1_hash_idx
  ON scenario_set_v1 (determinism_hash);
