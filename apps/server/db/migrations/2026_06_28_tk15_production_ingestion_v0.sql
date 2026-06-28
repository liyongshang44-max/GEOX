-- path: apps/server/db/migrations/2026_06_28_tk15_production_ingestion_v0.sql
-- Purpose: create TK15 production_ingestion_event_v0 for production-shaped source refs before Twin Kernel decision-cycle mapping.
-- Boundary: this table stores source refs and mapping records only; it does not create recommendations, approvals, tasks, receipts, acceptance records, ROI entries, Field Memory entries, or model updates.

CREATE TABLE IF NOT EXISTS production_ingestion_event_v0 (
  production_ingestion_event_id text PRIMARY KEY,
  source_contract_version text NOT NULL DEFAULT 'production_source_refs_v0',
  source_system text NOT NULL,
  source_event_id text NOT NULL,
  field_learning_candidate_id text NOT NULL REFERENCES field_learning_candidate_v1(field_learning_candidate_id),
  decision_cycle_id text NULL REFERENCES decision_cycle_v1(decision_cycle_id),
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  as_of_ts timestamptz NOT NULL,
  occurred_at timestamptz NULL,
  ingested_by text NOT NULL,
  ingested_at timestamptz NOT NULL,
  raw_source_refs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapped_external_refs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  boundary_flags_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_event_id)
);

CREATE INDEX IF NOT EXISTS production_ingestion_event_v0_candidate_idx
  ON production_ingestion_event_v0 (field_learning_candidate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS production_ingestion_event_v0_decision_cycle_idx
  ON production_ingestion_event_v0 (decision_cycle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS production_ingestion_event_v0_scope_idx
  ON production_ingestion_event_v0 (tenant_id, project_id, group_id, field_id, as_of_ts DESC);
