-- apps/server/db/migrations/2026_06_30_p12_controlled_twin_object_persistence_v0.sql
-- Purpose: declare P12 controlled Twin Object persistence tables.
-- Boundary: no raw_samples, facts, AO-ACT, Field Memory, model, dashboard, or recommendation table mutation.

CREATE TABLE IF NOT EXISTS twin_objects (
  object_id text PRIMARY KEY,
  object_type text NOT NULL,
  object_identity_key text NOT NULL UNIQUE,
  current_version_id text NULL,
  lifecycle_state text NOT NULL CHECK (lifecycle_state IN ('active', 'superseded', 'retracted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  authorization_ref text NOT NULL,
  operator_review_ref text NOT NULL,
  policy_version text NOT NULL,
  source_candidate_id text NOT NULL,
  source_case_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS twin_object_versions (
  version_id text PRIMARY KEY,
  object_id text NOT NULL REFERENCES twin_objects(object_id),
  payload_hash text NOT NULL,
  payload_json jsonb NOT NULL,
  schema_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  audit_event_id text NOT NULL,
  UNIQUE (object_id, payload_hash)
);

CREATE TABLE IF NOT EXISTS twin_object_idempotency_keys (
  idempotency_key text PRIMARY KEY,
  object_identity_key text NOT NULL,
  payload_hash text NOT NULL,
  object_id text NOT NULL,
  version_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL
);

CREATE TABLE IF NOT EXISTS twin_object_source_refs (
  source_ref_id text PRIMARY KEY,
  object_id text NOT NULL,
  version_id text NOT NULL,
  source_candidate_id text NOT NULL,
  source_artifact_kind text NOT NULL,
  source_line_id text NOT NULL,
  target_line_id text NOT NULL,
  case_id text NOT NULL,
  evidence_refs_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS twin_object_audit_events (
  audit_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  decision text NOT NULL,
  object_id text NULL,
  version_id text NULL,
  source_candidate_id text NOT NULL,
  future_object_identity_key text NOT NULL,
  idempotency_key text NOT NULL,
  actor text NOT NULL,
  authorization_ref text NOT NULL,
  operator_review_ref text NOT NULL,
  policy_version text NOT NULL,
  blocked_reason text NULL,
  source_evidence_refs_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
