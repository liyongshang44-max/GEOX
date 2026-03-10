-- GEOX/docker/postgres/init/014_dispatch_queue_v1.sql
-- Sprint Control-5: Industrial runtime dispatch queue (v1).
-- Notes:
-- - This table is NOT part of the append-only ledger.
-- - facts remain the source of truth for audit and replay.
-- - dispatch_queue_v1 stores mutable runtime state for claim / lease / publish / receipt.

CREATE TABLE IF NOT EXISTS dispatch_queue_v1 (
  queue_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  act_task_id text NOT NULL,
  task_fact_id text NOT NULL,
  outbox_fact_id text NOT NULL,
  device_id text NULL,
  downlink_topic text NULL,
  qos integer NOT NULL DEFAULT 1,
  retain boolean NOT NULL DEFAULT false,
  adapter_hint text NULL,
  state text NOT NULL,
  lease_token text NULL,
  leased_by text NULL,
  lease_expires_at timestamptz NULL,
  publish_fact_id text NULL,
  ack_fact_id text NULL,
  receipt_fact_id text NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_queue_v1_state_ck CHECK (state IN ('READY','LEASED','PUBLISHED','ACKED','RECEIPTED','DEAD')),
  CONSTRAINT dispatch_queue_v1_task_unique UNIQUE (tenant_id, project_id, group_id, act_task_id)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_queue_v1_ready
  ON dispatch_queue_v1 (tenant_id, project_id, group_id, state, created_at);

CREATE INDEX IF NOT EXISTS idx_dispatch_queue_v1_outbox
  ON dispatch_queue_v1 (outbox_fact_id);
