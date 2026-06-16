-- apps/server/db/migrations/2026_06_16_water_state_estimate_v1.sql
-- Purpose: create H14 Water State Estimate v1 projection table.
-- Boundary: schema only; no recommendation, irrigation scenario, prescription, operation, route, report, frontend, or customer-page behavior.

CREATE TABLE IF NOT EXISTS public.water_state_estimate_index_v1 (
  estimate_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  state text NOT NULL,
  root_zone_soil_moisture_percent double precision,
  target_min_soil_moisture_percent double precision,
  target_max_soil_moisture_percent double precision,
  net_irrigation_mm double precision,
  gross_irrigation_requirement_mm double precision,
  source_sensing_window_id text,
  source_forecast_id text,
  source_requirement_id text,
  source_input_id text,
  source_sensing_window_fact_id text,
  source_weather_fact_id text,
  source_requirement_fact_id text,
  input_refs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculation_inputs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_fact_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT water_state_estimate_index_v1_state_check CHECK (state IN ('NORMAL','LIGHT_DEFICIT','MODERATE_DEFICIT','UNKNOWN'))
);

CREATE INDEX IF NOT EXISTS idx_water_state_estimate_index_v1_scope_latest
  ON public.water_state_estimate_index_v1 (tenant_id, project_id, group_id, field_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_water_state_estimate_index_v1_requirement
  ON public.water_state_estimate_index_v1 (source_requirement_id);
