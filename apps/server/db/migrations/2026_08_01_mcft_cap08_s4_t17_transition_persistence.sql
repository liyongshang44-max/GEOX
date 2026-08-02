-- Purpose: add the dedicated mutable guard for the authority-bound S4 corrected-T16 -> T17 transition.
-- Boundary: additive guard only; canonical transition evidence remains in public.facts and generic CAP-04 tables/contracts are unchanged.

CREATE TABLE IF NOT EXISTS public.twin_cap08_s4_t17_transition_guard_v1 (
  transition_id text PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  uniqueness_key_hash text NOT NULL UNIQUE,
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
  correction_authority_ref text NOT NULL,
  correction_authority_hash text NOT NULL,
  record_set_id text NOT NULL UNIQUE,
  record_set_determinism_hash text NOT NULL,
  witness_fact_id text NOT NULL UNIQUE,
  witness_determinism_hash text NOT NULL,
  expected_latest_base jsonb NOT NULL,
  corrected_computation_predecessor jsonb NOT NULL,
  committed_t17 jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (
    formal_run_id,
    tenant_id, project_id, group_id, field_id, season_id, zone_id,
    lineage_id, revision_id, t17_logical_time
  )
);

REVOKE ALL ON TABLE public.twin_cap08_s4_t17_transition_guard_v1 FROM PUBLIC;

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='geox_mcft_cap08_runner_v1') THEN
    GRANT SELECT, INSERT
      ON TABLE public.twin_cap08_s4_t17_transition_guard_v1
      TO geox_mcft_cap08_runner_v1;
  END IF;
END
$grant$;
