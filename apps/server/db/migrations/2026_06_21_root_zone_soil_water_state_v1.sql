-- apps/server/db/migrations/2026_06_21_root_zone_soil_water_state_v1.sql
CREATE TABLE IF NOT EXISTS public.root_zone_soil_water_state_index_v1 (
  state_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  zone_id text NOT NULL,
  root_zone_depth_cm double precision NOT NULL,
  layer_estimate_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  layer_count integer NOT NULL,
  estimated_layer_count integer NOT NULL,
  blocked_layer_count integer NOT NULL,
  weighted_matric_potential_kpa double precision,
  root_zone_available_water_fraction double precision,
  root_zone_water_potential_class text NOT NULL,
  worst_layer_class text NOT NULL,
  stress_layer_count integer NOT NULL,
  limited_layer_count integer NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_root_zone_soil_water_state_index_v1_scope_latest
  ON public.root_zone_soil_water_state_index_v1
  (tenant_id, project_id, group_id, field_id, zone_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_root_zone_soil_water_state_index_v1_field_latest
  ON public.root_zone_soil_water_state_index_v1
  (tenant_id, project_id, group_id, field_id, computed_at DESC);
