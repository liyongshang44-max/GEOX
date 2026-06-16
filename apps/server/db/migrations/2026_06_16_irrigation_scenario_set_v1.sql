-- apps/server/db/migrations/2026_06_16_irrigation_scenario_set_v1.sql
-- Purpose: create H15 irrigation scenario set v1 projection table.
-- Boundary: comparison schema only; no recommendation, approval, operation, AO-ACT, report, frontend, or customer page behavior.

CREATE TABLE IF NOT EXISTS public.irrigation_scenario_set_index_v1 (
  scenario_set_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  source_water_state_estimate_id text,
  source_requirement_id text,
  source_forecast_id text,
  source_sensing_window_id text,
  baseline_water_state text,
  baseline_soil_moisture_percent double precision,
  target_min_soil_moisture_percent double precision,
  target_max_soil_moisture_percent double precision,
  net_irrigation_mm double precision,
  gross_irrigation_requirement_mm double precision,
  options_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_option_id text,
  input_refs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_fact_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_irrigation_scenario_set_index_v1_scope_latest
  ON public.irrigation_scenario_set_index_v1 (tenant_id, project_id, group_id, field_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_irrigation_scenario_set_index_v1_water_state
  ON public.irrigation_scenario_set_index_v1 (source_water_state_estimate_id);

CREATE INDEX IF NOT EXISTS idx_irrigation_scenario_set_index_v1_requirement
  ON public.irrigation_scenario_set_index_v1 (source_requirement_id);
