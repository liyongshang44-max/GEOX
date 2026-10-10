-- MCFT-CAP-09 v13 autonomous Formal forcing controller lifecycle.
-- Boundary: one epoch-level controller lease/fence per scope+epoch. This is orchestration
-- control state only; it does not replace per-base forcing claims or mutate Formal facts.

CREATE TABLE IF NOT EXISTS public.twin_external_formal_forcing_controller_lease_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  epoch_id text NOT NULL,
  subject_sha text NOT NULL CHECK (subject_sha ~ '^[0-9a-f]{40}$'),
  lifecycle_state text NOT NULL CHECK (lifecycle_state IN ('ACTIVE','TERMINAL')),
  lease_owner text NOT NULL,
  fencing_token bigint NOT NULL CHECK (fencing_token > 0),
  lease_expires_at timestamptz,
  acquired_at timestamptz NOT NULL,
  renewed_at timestamptz NOT NULL,
  terminal_at timestamptz,
  terminal_reason text,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id, epoch_id),
  CHECK (
    (
      lifecycle_state = 'ACTIVE'
      AND lease_expires_at IS NOT NULL
      AND terminal_at IS NULL
      AND terminal_reason IS NULL
    )
    OR
    (
      lifecycle_state = 'TERMINAL'
      AND lease_expires_at IS NULL
      AND terminal_at IS NOT NULL
      AND terminal_reason IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_twin_external_formal_forcing_controller_live_lease_v1
  ON public.twin_external_formal_forcing_controller_lease_v1 (lease_expires_at)
  WHERE lifecycle_state = 'ACTIVE';
