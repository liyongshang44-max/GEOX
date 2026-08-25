-- MCFT-CAP-09 v13 autonomous Formal forcing supply operational persistence.
-- Boundary: mutable forcing-base continuity cursor plus per-base claim/lease/fencing and
-- post-COMMIT physical visibility attestation. These relations are operational control
-- state only; they never replace append-only public.facts or alter Amendment-19 forcing semantics.

CREATE TABLE IF NOT EXISTS public.twin_external_formal_forcing_base_cursor_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  epoch_id text NOT NULL,
  subject_sha text NOT NULL CHECK (subject_sha ~ '^[0-9a-f]{40}$'),
  first_required_base timestamptz NOT NULL,
  last_required_base timestamptz NOT NULL,
  last_contiguous_eligible_base timestamptz NOT NULL,
  next_missing_required_base timestamptz,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id, epoch_id),
  CHECK (first_required_base <= last_required_base),
  CHECK (
    (
      completed = false
      AND next_missing_required_base IS NOT NULL
      AND next_missing_required_base = last_contiguous_eligible_base + interval '1 hour'
      AND next_missing_required_base >= first_required_base
      AND next_missing_required_base <= last_required_base
    )
    OR
    (
      completed = true
      AND next_missing_required_base IS NULL
      AND last_contiguous_eligible_base = last_required_base
    )
  )
);

CREATE TABLE IF NOT EXISTS public.twin_external_formal_forcing_base_target_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  epoch_id text NOT NULL,
  subject_sha text NOT NULL CHECK (subject_sha ~ '^[0-9a-f]{40}$'),
  base_target_t timestamptz NOT NULL,
  causal_deadline timestamptz NOT NULL,
  state text NOT NULL CHECK (state IN (
    'REQUIRED',
    'CLAIMED',
    'ACQUIRING',
    'READY_TO_FINALIZE',
    'PROMOTING',
    'FORMAL_VISIBLE_ATTESTED',
    'FAILED_RETRYABLE',
    'DEADLINE_MISSED_TERMINAL'
  )),
  claim_owner text,
  fencing_token bigint NOT NULL DEFAULT 0 CHECK (fencing_token >= 0),
  lease_expires_at timestamptz,
  idempotency_key text NOT NULL,
  claimed_at timestamptz,
  acquisition_started_at timestamptz,
  ready_to_finalize_at timestamptz,
  promotion_started_at timestamptz,
  producer_run_id text,
  promotion_run_id text,
  candidate_artifact_digest text,
  weather_fact_id text,
  weather_source_record_hash text,
  weather_record_semantic_hash text,
  et0_fact_id text,
  et0_source_record_hash text,
  et0_record_semantic_hash text,
  soil_fact_id text,
  soil_source_record_hash text,
  soil_record_semantic_hash text,
  post_commit_db_readback_at timestamptz,
  formal_visible_attested_at timestamptz,
  failure_class text,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id, epoch_id, base_target_t),
  UNIQUE (idempotency_key),
  CHECK (causal_deadline = base_target_t),
  CHECK (lease_expires_at IS NULL OR lease_expires_at <= causal_deadline),
  CHECK (
    state <> 'FORMAL_VISIBLE_ATTESTED'
    OR (
      weather_fact_id IS NOT NULL
      AND weather_source_record_hash IS NOT NULL
      AND weather_record_semantic_hash IS NOT NULL
      AND et0_fact_id IS NOT NULL
      AND et0_source_record_hash IS NOT NULL
      AND et0_record_semantic_hash IS NOT NULL
      AND soil_fact_id IS NOT NULL
      AND soil_source_record_hash IS NOT NULL
      AND soil_record_semantic_hash IS NOT NULL
      AND post_commit_db_readback_at IS NOT NULL
      AND formal_visible_attested_at IS NOT NULL
      AND post_commit_db_readback_at < causal_deadline
      AND formal_visible_attested_at < causal_deadline
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_twin_external_formal_forcing_base_target_state_v1
  ON public.twin_external_formal_forcing_base_target_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, epoch_id, state, base_target_t);

CREATE INDEX IF NOT EXISTS idx_twin_external_formal_forcing_base_target_lease_v1
  ON public.twin_external_formal_forcing_base_target_v1
  (lease_expires_at)
  WHERE state IN ('CLAIMED','ACQUIRING','READY_TO_FINALIZE','PROMOTING');
