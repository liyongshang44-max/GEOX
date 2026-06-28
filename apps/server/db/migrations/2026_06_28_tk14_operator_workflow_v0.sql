-- path: apps/server/db/migrations/2026_06_28_tk14_operator_workflow_v0.sql
-- Purpose: create TK14 operator workflow tables for explicit human review and explicit formalization actions.
-- Boundary: these tables record operator workflow state only; they do not create recommendations, approvals, tasks, receipts, acceptance records, Field Memory policy, or model updates.

CREATE TABLE IF NOT EXISTS operator_session_v0 (
  operator_session_id text PRIMARY KEY,
  decision_cycle_id text NOT NULL REFERENCES decision_cycle_v1(decision_cycle_id),
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  as_of_ts timestamptz NOT NULL,
  operator_id text NOT NULL,
  session_status text NOT NULL CHECK (session_status IN ('OPEN', 'CLOSED')),
  opened_at timestamptz NOT NULL,
  closed_at timestamptz NULL,
  trace_ref_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  boundary_flags_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_session_v0_decision_cycle_idx
  ON operator_session_v0 (decision_cycle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS operator_session_v0_scope_idx
  ON operator_session_v0 (tenant_id, project_id, group_id, field_id, as_of_ts DESC);

CREATE TABLE IF NOT EXISTS operator_decision_review_v0 (
  operator_review_id text PRIMARY KEY,
  operator_session_id text NOT NULL REFERENCES operator_session_v0(operator_session_id),
  decision_cycle_id text NOT NULL REFERENCES decision_cycle_v1(decision_cycle_id),
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  as_of_ts timestamptz NOT NULL,
  reviewed_by text NOT NULL,
  reviewed_at timestamptz NOT NULL,
  review_status text NOT NULL CHECK (review_status IN ('REVIEWED', 'NEEDS_FORMALIZATION', 'NO_ACTION')),
  review_notes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  boundary_flags_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_decision_review_v0_session_idx
  ON operator_decision_review_v0 (operator_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS operator_decision_review_v0_decision_cycle_idx
  ON operator_decision_review_v0 (decision_cycle_id, created_at DESC);

CREATE TABLE IF NOT EXISTS operator_formalization_action_v0 (
  operator_action_id text PRIMARY KEY,
  operator_session_id text NOT NULL REFERENCES operator_session_v0(operator_session_id),
  operator_review_id text NOT NULL REFERENCES operator_decision_review_v0(operator_review_id),
  decision_cycle_id text NOT NULL REFERENCES decision_cycle_v1(decision_cycle_id),
  action_type text NOT NULL CHECK (action_type IN ('FORMALIZE_ROI', 'FORMALIZE_FIELD_MEMORY')),
  requested_by text NOT NULL,
  requested_at timestamptz NOT NULL,
  target_object_type text NOT NULL CHECK (target_object_type IN ('roi_entry_v1', 'field_memory_v1')),
  target_object_id text NOT NULL,
  action_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  boundary_flags_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_formalization_action_v0_session_idx
  ON operator_formalization_action_v0 (operator_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS operator_formalization_action_v0_review_idx
  ON operator_formalization_action_v0 (operator_review_id, created_at DESC);

CREATE INDEX IF NOT EXISTS operator_formalization_action_v0_decision_cycle_idx
  ON operator_formalization_action_v0 (decision_cycle_id, created_at DESC);
