-- apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql
-- Purpose: persist immutable non-canonical Runtime authority snapshots required to reconstruct next-tick inputs from PostgreSQL.
-- Boundary: this table is operational support state, not canonical history; canonical Runtime objects remain exclusively in public.facts.

CREATE TABLE IF NOT EXISTS public.twin_runtime_authority_snapshot_v1 (
  authority_kind text NOT NULL CHECK (authority_kind IN ('REALITY_BINDING')),
  authority_ref text NOT NULL,
  determinism_hash text NOT NULL,
  semantic_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (authority_kind, authority_ref)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_twin_runtime_authority_snapshot_v1_hash
  ON public.twin_runtime_authority_snapshot_v1 (authority_kind, determinism_hash);
