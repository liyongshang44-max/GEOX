BEGIN;

CREATE TABLE IF NOT EXISTS twin_cap08_s4_t17_transition_guard_v1 (
  transition_id text PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  formal_run_id text NOT NULL,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  lineage_id text NOT NULL,
  revision_id text NOT NULL,
  t17_logical_time timestamptz NOT NULL,
  record_set_id text NOT NULL,
  aggregate_determinism_hash text NOT NULL,
  witness_fact_id text NOT NULL UNIQUE,
  witness_determinism_hash text NOT NULL,
  authority_ref text NOT NULL,
  authority_hash text NOT NULL,
  identity_basis jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT twin_cap08_s4_t17_transition_unique_v1 UNIQUE
    (tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,t17_logical_time),
  CONSTRAINT twin_cap08_s4_t17_transition_hashes_v1 CHECK (
    aggregate_determinism_hash ~ '^sha256:[0-9a-f]{64}$'
    AND witness_determinism_hash ~ '^sha256:[0-9a-f]{64}$'
    AND authority_hash ~ '^sha256:[0-9a-f]{64}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_twin_cap08_s4_t17_transition_scope_v1
  ON twin_cap08_s4_t17_transition_guard_v1
  (tenant_id,project_id,group_id,field_id,season_id,zone_id,t17_logical_time);

COMMIT;
