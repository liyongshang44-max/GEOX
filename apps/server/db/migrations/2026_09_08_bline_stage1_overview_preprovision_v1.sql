-- B-Line Commercial MVP0 / Stage1 Admission & Acceptance Materialization
-- Phase B1: preprovision the Stage1 overview projection under migration/platform authority.
-- Runtime geox_runtime_v1 must remain unable to CREATE/ALTER schema objects.

CREATE TABLE IF NOT EXISTS public.field_sensing_overview_v1 (
  tenant_id text NOT NULL,
  project_id text NULL,
  group_id text NULL,
  field_id text NOT NULL,
  observed_at_ts_ms bigint NULL,
  freshness text NOT NULL,
  confidence double precision NULL,
  soil_indicators_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  irrigation_need_level text NULL,
  sensor_quality_level text NULL,
  canopy_temp_status text NULL,
  evapotranspiration_risk text NULL,
  sensor_quality text NULL,
  irrigation_effectiveness text NULL,
  leak_risk text NULL,
  irrigation_action_hint text NULL,
  computed_at_ts_ms bigint NULL,
  source_observed_at_ts_ms bigint NULL,
  explanation_codes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_ts_ms bigint NOT NULL,
  PRIMARY KEY (tenant_id, field_id)
);

-- Mirror the Runtime compatibility contract so an older partial projection is
-- fully materialized before geox_runtime_v1 starts. These statements are run by
-- the external migration/platform identity, never by Runtime.
ALTER TABLE public.field_sensing_overview_v1
  ADD COLUMN IF NOT EXISTS irrigation_need_level text NULL;
ALTER TABLE public.field_sensing_overview_v1
  ADD COLUMN IF NOT EXISTS sensor_quality_level text NULL;
ALTER TABLE public.field_sensing_overview_v1
  ADD COLUMN IF NOT EXISTS canopy_temp_status text NULL;
ALTER TABLE public.field_sensing_overview_v1
  ADD COLUMN IF NOT EXISTS evapotranspiration_risk text NULL;
ALTER TABLE public.field_sensing_overview_v1
  ADD COLUMN IF NOT EXISTS sensor_quality text NULL;
ALTER TABLE public.field_sensing_overview_v1
  ADD COLUMN IF NOT EXISTS irrigation_effectiveness text NULL;
ALTER TABLE public.field_sensing_overview_v1
  ADD COLUMN IF NOT EXISTS leak_risk text NULL;
ALTER TABLE public.field_sensing_overview_v1
  ADD COLUMN IF NOT EXISTS irrigation_action_hint text NULL;
ALTER TABLE public.field_sensing_overview_v1
  ADD COLUMN IF NOT EXISTS computed_at_ts_ms bigint NULL;
ALTER TABLE public.field_sensing_overview_v1
  ADD COLUMN IF NOT EXISTS source_observed_at_ts_ms bigint NULL;
ALTER TABLE public.field_sensing_overview_v1
  ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_field_sensing_overview_v1_scope
  ON public.field_sensing_overview_v1 (tenant_id, project_id, group_id, field_id);
