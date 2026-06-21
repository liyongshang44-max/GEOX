-- apps/server/db/migrations/2026_06_21_soil_water_potential_foundation_v1.sql
-- Purpose: create H31 soil hydraulic profile and soil water potential estimate projection tables.
-- Boundary: schema only; no forecast, scenario, recommendation, approval, operation, AO-ACT, dispatch, ROI, field memory, UI, or customer exposure.

CREATE TABLE IF NOT EXISTS public.soil_hydraulic_profile_index_v1 (
  profile_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  zone_id text NOT NULL,
  layer_depth_cm double precision NOT NULL,
  texture_class text NOT NULL,
  theta_r double precision NOT NULL,
  theta_s double precision NOT NULL,
  alpha_per_kpa double precision NOT NULL,
  n double precision NOT NULL,
  m double precision NOT NULL,
  parameter_source text NOT NULL,
  calibration_status text NOT NULL,
  confidence_level text NOT NULL,
  confidence_score double precision NOT NULL,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_fact_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, project_id, group_id, field_id, zone_id, layer_depth_cm)
);

CREATE INDEX IF NOT EXISTS idx_soil_hydraulic_profile_index_v1_scope_latest
  ON public.soil_hydraulic_profile_index_v1
  (tenant_id, project_id, group_id, field_id, zone_id, layer_depth_cm, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_soil_hydraulic_profile_index_v1_field
  ON public.soil_hydraulic_profile_index_v1
  (tenant_id, project_id, group_id, field_id);

CREATE TABLE IF NOT EXISTS public.soil_water_potential_estimate_index_v1 (
  estimate_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  zone_id text NOT NULL,
  layer_depth_cm double precision NOT NULL,
  source_window_id text,
  source_profile_id text,
  observed_theta double precision,
  theta_unit text NOT NULL,
  normalized_theta_m3_m3 double precision,
  matric_potential_kpa double precision,
  matric_potential_class text NOT NULL,
  available_water_fraction double precision,
  root_zone_weight double precision NOT NULL,
  input_status text NOT NULL,
  blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  hydraulic_profile_ref text,
  data_quality_ref text,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculation_inputs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  determinism_hash text NOT NULL,
  source_fact_id text,
  computed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soil_water_potential_estimate_index_v1_scope_latest
  ON public.soil_water_potential_estimate_index_v1
  (tenant_id, project_id, group_id, field_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_soil_water_potential_estimate_index_v1_window
  ON public.soil_water_potential_estimate_index_v1
  (source_window_id);

CREATE INDEX IF NOT EXISTS idx_soil_water_potential_estimate_index_v1_profile
  ON public.soil_water_potential_estimate_index_v1
  (source_profile_id);
