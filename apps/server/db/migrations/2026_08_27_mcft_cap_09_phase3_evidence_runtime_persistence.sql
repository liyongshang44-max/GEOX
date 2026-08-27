-- MCFT-CAP-09 Production Hosting Phase 3: Evidence Runtime operational persistence.
-- Boundary: Evidence-plane mutable coordination only. Canonical Evidence remains in public.facts/raw retention.
-- Publication availability and observation/event-time continuity are independent durable axes.
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

-- Durable per-event ledger. One row represents the latest governed semantic version
-- observed for one logical provider event time. Later publication of a different semantic
-- value at the same event_time is a revision, not a second event-time boundary.
CREATE TABLE IF NOT EXISTS public.external_evidence_supply_event_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  binding_id text NOT NULL,
  origin_source_id text NOT NULL,
  event_time timestamptz NOT NULL,
  source_record_id text NOT NULL,
  fact_id text NOT NULL,
  record_semantic_sha256 text NOT NULL,
  first_publication_available_at timestamptz NOT NULL,
  last_publication_available_at timestamptz NOT NULL,
  first_post_commit_db_readback_at timestamptz NOT NULL,
  last_post_commit_db_readback_at timestamptz NOT NULL,
  revision_count integer NOT NULL DEFAULT 0 CHECK (revision_count >= 0),
  publication_count integer NOT NULL DEFAULT 1 CHECK (publication_count > 0),
  lease_owner text NOT NULL,
  fencing_token bigint NOT NULL CHECK (fencing_token > 0),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (
    tenant_id, project_id, group_id, field_id, season_id, zone_id,
    binding_id, origin_source_id, event_time
  )
);

CREATE INDEX IF NOT EXISTS idx_external_evidence_supply_event_v1_event_time
  ON public.external_evidence_supply_event_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id,
   binding_id, origin_source_id, event_time);

CREATE INDEX IF NOT EXISTS idx_external_evidence_supply_event_v1_publication
  ON public.external_evidence_supply_event_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id,
   binding_id, origin_source_id, last_publication_available_at);

-- Summary cursor. available_to_runtime_at is retained as the latest processed fact's
-- publication availability for compatibility. publication_available_through is the
-- monotone publication watermark. event_time_* fields describe a separate continuity axis.
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
  publication_available_through timestamptz NOT NULL,
  latest_event_time timestamptz NOT NULL,
  latest_source_record_id text NOT NULL,
  event_time_contiguous_from timestamptz NOT NULL,
  event_time_contiguous_through timestamptz NOT NULL,
  event_time_max_seen timestamptz NOT NULL,
  event_gap_count integer NOT NULL DEFAULT 0 CHECK (event_gap_count >= 0),
  revision_count integer NOT NULL DEFAULT 0 CHECK (revision_count >= 0),
  publication_event_count integer NOT NULL DEFAULT 1 CHECK (publication_event_count > 0),
  cadence_profile_id text NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_external_evidence_supply_cursor_v1_publication
  ON public.external_evidence_supply_cursor_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, publication_available_through DESC);

CREATE INDEX IF NOT EXISTS idx_external_evidence_supply_cursor_v1_event_continuity
  ON public.external_evidence_supply_cursor_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, event_time_contiguous_through DESC);

COMMENT ON TABLE public.external_evidence_producer_lease_v1 IS
  'MCFT-CAP-09 Phase3 Evidence producer ownership only; independent from twin_runtime_lease_v1.';

COMMENT ON TABLE public.external_evidence_supply_event_v1 IS
  'MCFT-CAP-09 Phase3 durable Evidence event ledger: publication time, event time, backfill and revision state; not canonical truth.';

COMMENT ON TABLE public.external_evidence_supply_cursor_v1 IS
  'MCFT-CAP-09 Phase3 durable Evidence supply summary with independent publication watermark and event-time continuity; not RuntimeTickCursor or canonical truth.';
