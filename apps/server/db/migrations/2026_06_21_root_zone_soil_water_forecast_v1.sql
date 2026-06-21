-- apps/server/db/migrations/2026_06_21_root_zone_soil_water_forecast_v1.sql
CREATE TABLE IF NOT EXISTS public.root_zone_soil_water_forecast_index_v1 (
  forecast_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  zone_id text NOT NULL,
  source_state_id text NOT NULL,
  source_state_ref text NOT NULL,
  weather_forecast_ref text,
  baseline_mode text NOT NULL,
  horizon_days integer NOT NULL,
  root_zone_depth_cm double precision NOT NULL,
  root_zone_available_water_capacity_mm double precision NOT NULL,
  initial_available_water_fraction double precision,
  initial_weighted_matric_potential_kpa double precision,
  daily_forecast_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_available_water_fraction double precision,
  max_available_water_fraction double precision,
  first_stress_date text,
  stress_day_count integer NOT NULL,
  limited_day_count integer NOT NULL,
  forecast_status text NOT NULL,
  blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculation_inputs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  determinism_hash text NOT NULL,
  source_fact_id text,
  computed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_root_zone_soil_water_forecast_index_v1_scope_latest ON public.root_zone_soil_water_forecast_index_v1 (tenant_id, project_id, group_id, field_id, zone_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_root_zone_soil_water_forecast_index_v1_field_latest ON public.root_zone_soil_water_forecast_index_v1 (tenant_id, project_id, group_id, field_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_root_zone_soil_water_forecast_index_v1_source_state ON public.root_zone_soil_water_forecast_index_v1 (source_state_id);
