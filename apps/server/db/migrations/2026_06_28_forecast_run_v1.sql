-- path: apps/server/db/migrations/2026_06_28_forecast_run_v1.sql
-- Purpose: create forecast_run_v1 as the TK2 deterministic seven-day water-state forecast object.

CREATE TABLE IF NOT EXISTS forecast_run_v1 (
  forecast_run_id text PRIMARY KEY,
  snapshot_id text NOT NULL REFERENCES field_state_snapshot_v1(snapshot_id),
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  as_of_ts timestamptz NOT NULL,
  horizon_days integer NOT NULL CHECK (horizon_days = 7),
  model_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('FORECAST_READY', 'FORECAST_BLOCKED')),
  input_refs_json jsonb NOT NULL,
  forecast_points_json jsonb NOT NULL,
  risk_timeline_json jsonb NOT NULL,
  uncertainty_json jsonb NOT NULL,
  assumptions_json jsonb NOT NULL,
  blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  determinism_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, horizon_days, model_version, determinism_hash)
);

CREATE INDEX IF NOT EXISTS forecast_run_v1_snapshot_idx
  ON forecast_run_v1 (snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS forecast_run_v1_scope_idx
  ON forecast_run_v1 (tenant_id, project_id, group_id, field_id, as_of_ts DESC);

CREATE INDEX IF NOT EXISTS forecast_run_v1_hash_idx
  ON forecast_run_v1 (determinism_hash);
