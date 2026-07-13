-- apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql
-- Purpose: extend the existing Runtime persistence family for CAP-04 A1/A2/B idempotency, cross-variant terminal uniqueness, Scenario uniqueness, and rebuildable Forecast/Scenario projections.
-- Boundary: exactly one additive CAP-04 migration; canonical history remains exclusively in public.facts and no second canonical store is created.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.twin_object_idempotency_index_v1'::regclass
      AND conname = 'twin_object_idempotency_index_v1_identity_kind_check'
  ) THEN
    ALTER TABLE public.twin_object_idempotency_index_v1
      DROP CONSTRAINT twin_object_idempotency_index_v1_identity_kind_check;
  END IF;
END
$$;

ALTER TABLE public.twin_object_idempotency_index_v1
  ADD CONSTRAINT twin_object_idempotency_index_v1_identity_kind_check
  CHECK (identity_kind IN (
    'OBJECT',
    'A0_RECORD_SET',
    'A1_RECORD_SET',
    'A2_RECORD_SET',
    'B_SCENARIO_SET',
    'RUNTIME_CONFIG'
  ));

CREATE TABLE IF NOT EXISTS public.twin_terminal_tick_uniqueness_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  lineage_id text NOT NULL,
  revision_id text NOT NULL,
  logical_time timestamptz NOT NULL,
  terminal_tick_uniqueness_key_hash text NOT NULL,
  operation_variant text NOT NULL CHECK (operation_variant IN ('A1_COMPLETED','A2_BLOCKED_FORECAST')),
  record_set_id text NOT NULL,
  aggregate_determinism_hash text NOT NULL,
  source_tick_object_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id, lineage_id, revision_id, logical_time),
  UNIQUE (terminal_tick_uniqueness_key_hash),
  UNIQUE (record_set_id)
);

CREATE TABLE IF NOT EXISTS public.twin_scenario_set_uniqueness_v1 (
  source_forecast_ref text NOT NULL,
  source_forecast_hash text NOT NULL,
  lineage_id text NOT NULL,
  revision_id text NOT NULL,
  scenario_set_uniqueness_key_hash text NOT NULL,
  scenario_set_id text NOT NULL,
  aggregate_determinism_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (source_forecast_ref, source_forecast_hash, lineage_id, revision_id),
  UNIQUE (scenario_set_uniqueness_key_hash),
  UNIQUE (scenario_set_id)
);

CREATE TABLE IF NOT EXISTS public.twin_forecast_run_projection_v1 (
  forecast_object_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  lineage_id text NOT NULL,
  revision_id text NOT NULL,
  logical_time timestamptz NOT NULL,
  forecast_status text NOT NULL CHECK (forecast_status IN ('COMPLETED','BLOCKED')),
  source_posterior_ref text NOT NULL,
  source_posterior_hash text NOT NULL,
  runtime_config_ref text NOT NULL,
  runtime_config_hash text NOT NULL,
  forcing_window_hash text,
  point_count integer NOT NULL CHECK (point_count IN (0,72)),
  determinism_hash text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_fact_id text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_twin_forecast_run_projection_v1_scope_time
  ON public.twin_forecast_run_projection_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, logical_time DESC);

CREATE TABLE IF NOT EXISTS public.twin_forecast_point_projection_v1 (
  forecast_object_id text NOT NULL,
  horizon_hour integer NOT NULL CHECK (horizon_hour BETWEEN 1 AND 72),
  target_time timestamptz NOT NULL,
  storage_mean_mm text NOT NULL,
  storage_variance_mm2 text NOT NULL,
  available_water_fraction text NOT NULL,
  determinism_hash text NOT NULL,
  canonical_point jsonb NOT NULL,
  PRIMARY KEY (forecast_object_id, horizon_hour)
);

CREATE INDEX IF NOT EXISTS idx_twin_forecast_point_projection_v1_target_time
  ON public.twin_forecast_point_projection_v1 (target_time);

CREATE TABLE IF NOT EXISTS public.twin_scenario_set_projection_v1 (
  scenario_set_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  lineage_id text NOT NULL,
  revision_id text NOT NULL,
  logical_time timestamptz NOT NULL,
  source_forecast_ref text NOT NULL,
  source_forecast_hash text NOT NULL,
  source_posterior_ref text NOT NULL,
  source_posterior_hash text NOT NULL,
  runtime_config_ref text NOT NULL,
  runtime_config_hash text NOT NULL,
  scenario_policy_id text NOT NULL,
  option_count integer NOT NULL CHECK (option_count = 3),
  determinism_hash text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_fact_id text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_twin_scenario_set_projection_v1_scope_time
  ON public.twin_scenario_set_projection_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, logical_time DESC);

CREATE TABLE IF NOT EXISTS public.twin_scenario_point_projection_v1 (
  scenario_set_id text NOT NULL,
  option_id text NOT NULL CHECK (option_id IN ('NO_ACTION','IRRIGATE_NOW_15MM','IRRIGATE_NOW_25MM')),
  horizon_hour integer NOT NULL CHECK (horizon_hour BETWEEN 1 AND 72),
  target_time timestamptz NOT NULL,
  storage_mean_mm text NOT NULL,
  storage_variance_mm2 text NOT NULL,
  available_water_fraction text NOT NULL,
  determinism_hash text NOT NULL,
  canonical_point jsonb NOT NULL,
  PRIMARY KEY (scenario_set_id, option_id, horizon_hour)
);

CREATE INDEX IF NOT EXISTS idx_twin_scenario_point_projection_v1_target_time
  ON public.twin_scenario_point_projection_v1 (target_time);

CREATE TABLE IF NOT EXISTS public.twin_scenario_latest_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  scenario_set_id text NOT NULL,
  source_forecast_ref text NOT NULL,
  source_forecast_hash text NOT NULL,
  logical_time timestamptz NOT NULL,
  determinism_hash text NOT NULL,
  source_fact_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id)
);
