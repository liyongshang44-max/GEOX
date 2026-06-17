-- apps/server/db/migrations/2026_06_17_decision_recommendation_index_v1.sql
-- Purpose: create H16 decision_recommendation_index_v1 projection for scenario-derived irrigation recommendations.
-- Boundary: projection/index only; no approval, operation plan, AO-ACT, report API, frontend, or customer-page behavior.

CREATE TABLE IF NOT EXISTS public.decision_recommendation_index_v1 (
  recommendation_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text,
  recommendation_status text NOT NULL,
  selected_scenario_option_id text,
  source_water_state_estimate_id text,
  source_scenario_set_id text,
  source_requirement_id text,
  suggested_action_json jsonb,
  scenario_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_refs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  human_approval_required boolean NOT NULL DEFAULT true,
  source_fact_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT decision_recommendation_index_v1_status_check
    CHECK (recommendation_status IN ('RECOMMENDED', 'UNKNOWN')),
  CONSTRAINT decision_recommendation_index_v1_unknown_empty_action_check
    CHECK (recommendation_status <> 'UNKNOWN' OR (selected_scenario_option_id IS NULL AND suggested_action_json IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_decision_recommendation_index_v1_scope_latest
  ON public.decision_recommendation_index_v1 (tenant_id, project_id, group_id, field_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_decision_recommendation_index_v1_scenario_set
  ON public.decision_recommendation_index_v1 (source_scenario_set_id);

CREATE INDEX IF NOT EXISTS idx_decision_recommendation_index_v1_requirement
  ON public.decision_recommendation_index_v1 (source_requirement_id);
