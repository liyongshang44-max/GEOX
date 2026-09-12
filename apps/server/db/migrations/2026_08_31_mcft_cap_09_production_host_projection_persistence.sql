-- MCFT-CAP-09 production-host persistence surfaces required by the canonical
-- Twin Runtime repository but not part of the 29-table Formal/V13 core schema.
-- These are operational/projection/uniqueness relations only. Applying this
-- migration must not create canonical facts or activate any Runtime owner.

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
  operation_variant text NOT NULL,
  record_set_id text NOT NULL,
  aggregate_determinism_hash text NOT NULL,
  source_tick_object_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_twin_terminal_tick_record_set_v1
  ON public.twin_terminal_tick_uniqueness_v1(record_set_id);

CREATE TABLE IF NOT EXISTS public.twin_scenario_set_uniqueness_v1 (
  source_forecast_ref text NOT NULL,
  source_forecast_hash text NOT NULL,
  lineage_id text NOT NULL,
  revision_id text NOT NULL,
  scenario_set_uniqueness_key_hash text NOT NULL,
  scenario_set_id text NOT NULL,
  aggregate_determinism_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (source_forecast_ref,source_forecast_hash,lineage_id,revision_id),
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
  forecast_status text NOT NULL,
  source_posterior_ref text NOT NULL,
  source_posterior_hash text NOT NULL,
  runtime_config_ref text NOT NULL,
  runtime_config_hash text NOT NULL,
  forcing_window_hash text NOT NULL,
  point_count integer NOT NULL CHECK (point_count >= 0),
  determinism_hash text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_fact_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_twin_forecast_run_projection_scope_time_v1
  ON public.twin_forecast_run_projection_v1
  (tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time);

CREATE TABLE IF NOT EXISTS public.twin_forecast_point_projection_v1 (
  forecast_object_id text NOT NULL,
  horizon_hour integer NOT NULL CHECK (horizon_hour >= 0),
  target_time timestamptz NOT NULL,
  storage_mean_mm double precision NOT NULL,
  storage_variance_mm2 double precision NOT NULL,
  available_water_fraction double precision NOT NULL,
  determinism_hash text NOT NULL,
  canonical_point jsonb NOT NULL,
  PRIMARY KEY (forecast_object_id,horizon_hour)
);

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
  option_count integer NOT NULL CHECK (option_count >= 0),
  determinism_hash text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_fact_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_twin_scenario_set_projection_scope_time_v1
  ON public.twin_scenario_set_projection_v1
  (tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time);

CREATE TABLE IF NOT EXISTS public.twin_scenario_point_projection_v1 (
  scenario_set_id text NOT NULL,
  option_id text NOT NULL,
  horizon_hour integer NOT NULL CHECK (horizon_hour >= 0),
  target_time timestamptz NOT NULL,
  storage_mean_mm double precision NOT NULL,
  storage_variance_mm2 double precision NOT NULL,
  available_water_fraction double precision NOT NULL,
  determinism_hash text NOT NULL,
  canonical_point jsonb NOT NULL,
  PRIMARY KEY (scenario_set_id,option_id,horizon_hour)
);

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
  PRIMARY KEY (tenant_id,project_id,group_id,field_id,season_id,zone_id)
);

COMMENT ON TABLE public.twin_terminal_tick_uniqueness_v1 IS
  'MCFT-CAP-09 production Twin Runtime terminal-tick uniqueness guard for canonical CAP-04 persistence/recovery.';
COMMENT ON TABLE public.twin_scenario_set_uniqueness_v1 IS
  'MCFT-CAP-09 canonical scenario-set uniqueness guard keyed by source forecast identity and lineage/revision.';
