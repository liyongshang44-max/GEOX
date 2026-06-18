-- path: apps/server/db/migrations/2026_06_18_operator_twin_source_indexes_v1.sql
-- Purpose: create the scoped source-index tables required by Operator Twin read APIs.
-- Boundary: schema-only migration; no facts, recommendations, approvals, tasks, receipts, or execution records are inserted.

CREATE TABLE IF NOT EXISTS field_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  field_name text,
  crop text,
  updated_at timestamptz,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id)
);

CREATE TABLE IF NOT EXISTS water_state_estimate_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  water_state text,
  confidence_level text,
  confidence_score numeric,
  evidence_refs_json jsonb,
  computed_at timestamptz,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id)
);

CREATE TABLE IF NOT EXISTS soil_moisture_sensing_window_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  window_id text NOT NULL,
  device_id text,
  metric text,
  window_start timestamptz,
  window_end timestamptz,
  expected_interval_ms integer,
  expected_points integer,
  actual_points integer,
  coverage_ratio numeric,
  max_gap_ms integer,
  quality_status text,
  confidence_json jsonb,
  summary_json jsonb,
  config_snapshot_json jsonb,
  evidence_refs_json jsonb,
  source_fact_ids_json jsonb,
  source_observation_ids_json jsonb,
  source_fact_id text,
  created_at timestamptz,
  updated_at timestamptz,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, window_id)
);

CREATE TABLE IF NOT EXISTS weather_forecast_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  forecast_id text NOT NULL,
  forecast_horizon text,
  provider text,
  evidence_refs_json jsonb,
  generated_at timestamptz,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, forecast_id)
);

CREATE TABLE IF NOT EXISTS irrigation_scenario_set_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  scenario_set_id text NOT NULL,
  options_json jsonb,
  evidence_refs_json jsonb,
  generated_at timestamptz,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, scenario_set_id)
);

CREATE TABLE IF NOT EXISTS decision_recommendation_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  recommendation_id text NOT NULL,
  suggested_action_json jsonb,
  action_type text,
  amount_mm numeric,
  evidence_refs_json jsonb,
  generated_at timestamptz,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, recommendation_id)
);
