-- MCFT-CAP-09 Production Hosting Phase 3: Evidence Runtime operational persistence.
-- Boundary: Evidence-plane mutable coordination only. Canonical Evidence remains in public.facts/raw retention.
-- These tables MUST NOT be used as Twin-state authority or RuntimeTickCursor state.

CREATE TABLE IF NOT EXISTS public.external_evidence_producer_lease_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  lease_owner text NOT NULL,
  fencing_token bigint NOT NULL CHECK (fencing_token > 0),
  acquired_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  heartbeat_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id),
  CHECK (expires_at > acquired_at)
);

CREATE TABLE IF NOT EXISTS public.external_evidence_supply_cursor_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  binding_id text NOT NULL,
  origin_source_id text NOT NULL,
  fact_id text NOT NULL,
  record_semantic_sha256 text NOT NULL,
  available_to_runtime_at timestamptz NOT NULL,
  role_time jsonb NOT NULL,
  post_commit_db_readback_at timestamptz NOT NULL,
  lease_owner text NOT NULL,
  fencing_token bigint NOT NULL CHECK (fencing_token > 0),
  advanced_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (
    tenant_id, project_id, group_id, field_id, season_id, zone_id,
    binding_id, origin_source_id
  ),
  UNIQUE (fact_id),
  CHECK (jsonb_typeof(role_time) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_external_evidence_supply_cursor_v1_runtime_availability
  ON public.external_evidence_supply_cursor_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, available_to_runtime_at DESC);

COMMENT ON TABLE public.external_evidence_producer_lease_v1 IS
  'MCFT-CAP-09 Phase3 Evidence producer ownership only; independent from twin_runtime_lease_v1.';

COMMENT ON TABLE public.external_evidence_supply_cursor_v1 IS
  'MCFT-CAP-09 Phase3 durable post-COMMIT Evidence supply watermark; not RuntimeTickCursor or canonical truth.';
