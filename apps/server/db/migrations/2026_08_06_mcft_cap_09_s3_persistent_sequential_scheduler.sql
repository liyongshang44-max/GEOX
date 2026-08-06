-- MCFT-CAP-09.S3 Persistent Sequential Scheduler operational persistence.
-- Boundary: mutable scheduling cursor and slot ledger only. These relations are
-- not canonical Twin truth and never replace append-only public.facts.

CREATE TABLE IF NOT EXISTS public.twin_shadow_online_scheduler_cursor_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  schedule_start_logical_time timestamptz NOT NULL,
  next_slot_index smallint NOT NULL DEFAULT 0 CHECK (next_slot_index BETWEEN 0 AND 24),
  next_slot_id text,
  next_logical_time timestamptz,
  last_terminal_slot_id text,
  last_terminal_logical_time timestamptz,
  last_fencing_token bigint,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id),
  CHECK (
    (next_slot_index < 24 AND next_slot_id IS NOT NULL AND next_logical_time IS NOT NULL)
    OR
    (next_slot_index = 24 AND next_slot_id IS NULL AND next_logical_time IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.twin_shadow_online_scheduler_slot_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  slot_id text NOT NULL CHECK (slot_id ~ '^O(0[0-9]|1[0-9]|2[0-3])$'),
  logical_time timestamptz NOT NULL,
  scheduler_wall_clock_observed_at timestamptz NOT NULL,
  interval_seconds integer NOT NULL CHECK (interval_seconds = 3600),
  state text NOT NULL CHECK (state IN ('CLAIMED','RUNNING','COMPLETED','DEGRADED','FAILED')),
  lease_owner text NOT NULL,
  fencing_token bigint NOT NULL CHECK (fencing_token > 0),
  idempotency_key text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  tick_ref text,
  health_ref text,
  terminal_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id, zone_id, logical_time),
  UNIQUE (tenant_id, project_id, group_id, field_id, season_id, zone_id, slot_id),
  UNIQUE (idempotency_key),
  CHECK (
    (state IN ('CLAIMED','RUNNING') AND terminal_at IS NULL AND health_ref IS NULL)
    OR
    (state IN ('COMPLETED','DEGRADED','FAILED') AND terminal_at IS NOT NULL AND health_ref IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_twin_shadow_online_scheduler_one_running_v1
  ON public.twin_shadow_online_scheduler_slot_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id)
  WHERE state = 'RUNNING';

CREATE UNIQUE INDEX IF NOT EXISTS idx_twin_shadow_online_scheduler_one_active_v1
  ON public.twin_shadow_online_scheduler_slot_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id)
  WHERE state IN ('CLAIMED','RUNNING');

CREATE INDEX IF NOT EXISTS idx_twin_shadow_online_scheduler_slot_scope_time_v1
  ON public.twin_shadow_online_scheduler_slot_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, logical_time);
