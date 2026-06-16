-- apps/server/db/migrations/2026_06_16_weather_forecast_version_v1.sql
-- Purpose: add versioned weather forecast metadata required by H13 Weather Forecast Version v1.
-- Boundary: schema hardening only; does not create forecast data, recommendations, prescriptions, operations, tasks, reports, or customer-facing decisions.

CREATE TABLE IF NOT EXISTS public.weather_forecast_index_v1 (
  forecast_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  provider text NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  latitude double precision,
  longitude double precision,
  generated_at timestamptz NOT NULL,
  issue_time timestamptz NOT NULL DEFAULT now(),
  forecast_version text NOT NULL DEFAULT 'v1',
  provider_run_id text,
  external_forecast_id text,
  version_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  horizon_hours integer NOT NULL,
  rainfall_forecast_mm_72h double precision,
  temperature_max_c_72h double precision,
  et0_mm_72h double precision,
  hourly_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload_json jsonb,
  source_fact_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weather_forecast_index_v1
  ADD COLUMN IF NOT EXISTS issue_time timestamptz,
  ADD COLUMN IF NOT EXISTS forecast_version text,
  ADD COLUMN IF NOT EXISTS provider_run_id text,
  ADD COLUMN IF NOT EXISTS external_forecast_id text,
  ADD COLUMN IF NOT EXISTS version_json jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.weather_forecast_index_v1
   SET issue_time = COALESCE(issue_time, generated_at),
       forecast_version = COALESCE(forecast_version, forecast_id),
       version_json = CASE
         WHEN version_json IS NULL OR version_json = '{}'::jsonb THEN
           jsonb_build_object(
             'forecast_version', COALESCE(forecast_version, forecast_id),
             'issue_time', COALESCE(issue_time, generated_at),
             'provider_run_id', provider_run_id,
             'external_forecast_id', external_forecast_id
           )
         ELSE version_json
       END
 WHERE issue_time IS NULL
    OR forecast_version IS NULL
    OR version_json IS NULL
    OR version_json = '{}'::jsonb;

ALTER TABLE public.weather_forecast_index_v1
  ALTER COLUMN issue_time SET NOT NULL,
  ALTER COLUMN forecast_version SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_weather_forecast_index_v1_scope_latest
  ON public.weather_forecast_index_v1 (tenant_id, project_id, group_id, field_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_weather_forecast_index_v1_valid_window
  ON public.weather_forecast_index_v1 (field_id, valid_from, valid_to);

CREATE INDEX IF NOT EXISTS idx_weather_forecast_index_v1_usable_lookup
  ON public.weather_forecast_index_v1 (tenant_id, project_id, group_id, field_id, valid_from, valid_to, generated_at DESC);
