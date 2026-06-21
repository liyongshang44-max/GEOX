-- apps/server/db/migrations/2026_06_21_root_zone_irrigation_scenario_set_v1.sql
CREATE TABLE IF NOT EXISTS public.root_zone_irrigation_scenario_set_index_v1 (
  scenario_set_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  zone_id text NOT NULL,
  source_forecast_id text NOT NULL,
  source_forecast_ref text NOT NULL,
  baseline_mode text NOT NULL,
  comparison_mode text NOT NULL,
  horizon_days integer NOT NULL,
  root_zone_depth_cm double precision NOT NULL,
  root_zone_available_water_capacity_mm double precision NOT NULL,
  baseline_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  options_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_status text NOT NULL,
  blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculation_inputs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  determinism_hash text NOT NULL,
  source_fact_id text,
  computed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_root_zone_irrigation_scenario_set_index_v1_scope_latest ON public.root_zone_irrigation_scenario_set_index_v1 (tenant_id, project_id, group_id, field_id, zone_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_root_zone_irrigation_scenario_set_index_v1_field_latest ON public.root_zone_irrigation_scenario_set_index_v1 (tenant_id, project_id, group_id, field_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_root_zone_irrigation_scenario_set_index_v1_source_forecast ON public.root_zone_irrigation_scenario_set_index_v1 (source_forecast_id);
