-- apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql
-- Purpose: create only the mutable lease/idempotency guards and rebuildable A0 projection subset authorized by MCFT-CAP-01 S3A.
-- Boundary: canonical history remains exclusively in public.facts; these tables are not canonical truth.

CREATE TABLE IF NOT EXISTS public.twin_runtime_lease_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  lease_owner text NOT NULL,
  fencing_token bigint NOT NULL,
  acquired_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  heartbeat_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id),
  CHECK (expires_at > acquired_at)
);

CREATE TABLE IF NOT EXISTS public.twin_object_idempotency_index_v1 (
  identity_kind text NOT NULL CHECK (identity_kind IN ('OBJECT','A0_RECORD_SET','RUNTIME_CONFIG')),
  idempotency_key text PRIMARY KEY,
  semantic_object_id text,
  record_set_id text,
  determinism_hash text NOT NULL,
  identity_basis jsonb,
  member_object_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  member_determinism_hashes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_twin_object_idempotency_index_v1_record_set
  ON public.twin_object_idempotency_index_v1 (record_set_id)
  WHERE record_set_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.twin_active_lineage_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  active_lineage_ref text NOT NULL,
  activation_authority_kind text NOT NULL,
  activation_authority_ref text NOT NULL,
  expected_previous_active_lineage text,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id)
);

CREATE TABLE IF NOT EXISTS public.twin_state_history_projection_v1 (
  state_object_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  lineage_id text NOT NULL,
  revision_id text NOT NULL,
  logical_time timestamptz NOT NULL,
  determinism_hash text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_fact_id text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_twin_state_history_projection_v1_scope_time
  ON public.twin_state_history_projection_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, logical_time DESC);

CREATE TABLE IF NOT EXISTS public.twin_state_latest_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  state_object_id text NOT NULL,
  lineage_id text NOT NULL,
  revision_id text NOT NULL,
  logical_time timestamptz NOT NULL,
  determinism_hash text NOT NULL,
  source_fact_id text NOT NULL,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id)
);

CREATE TABLE IF NOT EXISTS public.twin_forecast_result_latest_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  forecast_object_id text NOT NULL,
  forecast_status text NOT NULL,
  logical_time timestamptz NOT NULL,
  determinism_hash text NOT NULL,
  source_fact_id text NOT NULL,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id)
);

CREATE TABLE IF NOT EXISTS public.twin_forecast_success_latest_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  forecast_object_id text NOT NULL,
  logical_time timestamptz NOT NULL,
  determinism_hash text NOT NULL,
  source_fact_id text NOT NULL,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id)
);

CREATE TABLE IF NOT EXISTS public.twin_runtime_checkpoint_latest_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  checkpoint_object_id text NOT NULL,
  lineage_id text NOT NULL,
  revision_id text NOT NULL,
  logical_time timestamptz NOT NULL,
  determinism_hash text NOT NULL,
  source_fact_id text NOT NULL,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id)
);

CREATE TABLE IF NOT EXISTS public.twin_runtime_health_latest_index_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  health_object_id text NOT NULL,
  operation_status text NOT NULL,
  logical_time timestamptz NOT NULL,
  determinism_hash text NOT NULL,
  source_fact_id text NOT NULL,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id)
);
