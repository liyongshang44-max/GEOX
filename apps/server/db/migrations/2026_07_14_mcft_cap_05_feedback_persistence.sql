-- apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql
-- Purpose: add the bounded MCFT-CAP-05 G/H/C idempotency kinds and rebuildable Decision, Action Feedback, Residual, approved-Plan binding, Evidence-link and feedback-cycle projections.
-- Boundary: exactly one additive CAP-05 migration; public.facts remains the only canonical store and every table added here is mutable, rebuildable support state.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.twin_object_idempotency_index_v1'::regclass
      AND conname = 'twin_object_idempotency_index_v1_identity_kind_check'
  ) THEN
    ALTER TABLE public.twin_object_idempotency_index_v1
      DROP CONSTRAINT twin_object_idempotency_index_v1_identity_kind_check;
  END IF;
END
$$;

ALTER TABLE public.twin_object_idempotency_index_v1
  ADD CONSTRAINT twin_object_idempotency_index_v1_identity_kind_check
  CHECK (identity_kind IN (
    'OBJECT',
    'A0_RECORD_SET',
    'A1_RECORD_SET',
    'A2_RECORD_SET',
    'B_SCENARIO_SET',
    'RUNTIME_CONFIG',
    'G_DECISION_RECORD',
    'H_ACTION_FEEDBACK',
    'C_FORECAST_RESIDUAL'
  ));

CREATE TABLE IF NOT EXISTS public.twin_decision_record_projection_v1 (
  decision_object_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  logical_time timestamptz NOT NULL,
  as_of timestamptz NOT NULL,
  scenario_set_ref text NOT NULL,
  scenario_set_hash text NOT NULL,
  selected_option_ref text NOT NULL,
  selected_option_hash text NOT NULL,
  selected_option_id text NOT NULL CHECK (selected_option_id IN ('NO_ACTION','IRRIGATE_NOW_15MM','IRRIGATE_NOW_25MM')),
  decision_request_evidence_ref text NOT NULL,
  decision_request_evidence_hash text NOT NULL,
  actor_ref text NOT NULL,
  determinism_hash text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_fact_id text NOT NULL,
  UNIQUE (tenant_id, project_id, group_id, field_id, season_id, zone_id, scenario_set_ref)
);

CREATE INDEX IF NOT EXISTS idx_twin_decision_record_projection_v1_scope_time
  ON public.twin_decision_record_projection_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, logical_time DESC);

CREATE TABLE IF NOT EXISTS public.twin_action_feedback_projection_v1 (
  action_feedback_object_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  logical_time timestamptz NOT NULL,
  as_of timestamptz NOT NULL,
  decision_ref text NOT NULL,
  decision_hash text NOT NULL,
  approved_plan_evidence_ref text NOT NULL,
  approved_plan_evidence_hash text NOT NULL,
  dispatch_disposition text NOT NULL CHECK (dispatch_disposition IN ('NOT_OBSERVED','NOT_APPLICABLE','EXTERNALLY_RECORDED')),
  event_id text NOT NULL,
  source_record_id text NOT NULL,
  binding_id text NOT NULL,
  origin_source_id text NOT NULL,
  execution_status text NOT NULL CHECK (execution_status IN ('EXECUTED','PARTIALLY_EXECUTED','EXECUTION_UNCERTAIN','NOT_EXECUTED')),
  validation_status text NOT NULL CHECK (validation_status IN ('NOT_YET_VALIDATED','VALIDATED','REJECTED','VALIDATED_WITH_LIMITATIONS')),
  source_quality text NOT NULL CHECK (source_quality IN ('PASS','LIMITED','FAIL')),
  eligible_for_state_input boolean NOT NULL,
  actual_amount_mm text NOT NULL,
  spatial_coverage_fraction text NOT NULL,
  target_scope_equivalent_irrigation_mm text NOT NULL,
  execution_start timestamptz NOT NULL,
  execution_end timestamptz NOT NULL,
  available_to_runtime_at timestamptz NOT NULL,
  determinism_hash text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_fact_id text NOT NULL,
  UNIQUE (tenant_id, project_id, group_id, field_id, season_id, zone_id, origin_source_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_twin_action_feedback_projection_v1_scope_time
  ON public.twin_action_feedback_projection_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, logical_time DESC);

CREATE TABLE IF NOT EXISTS public.twin_action_feedback_evidence_index_v1 (
  action_feedback_object_id text NOT NULL,
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('DECISION','APPROVED_PLAN','RECEIPT','AS_EXECUTED','ACCEPTANCE','TASK')),
  evidence_ref text NOT NULL,
  evidence_hash text,
  source_fact_id text NOT NULL,
  PRIMARY KEY (action_feedback_object_id, evidence_kind, evidence_ref)
);

CREATE INDEX IF NOT EXISTS idx_twin_action_feedback_evidence_index_v1_ref
  ON public.twin_action_feedback_evidence_index_v1 (evidence_ref);

CREATE TABLE IF NOT EXISTS public.twin_forecast_residual_projection_v1 (
  residual_object_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  logical_time timestamptz NOT NULL,
  as_of timestamptz NOT NULL,
  forecast_run_ref text NOT NULL,
  forecast_run_hash text NOT NULL,
  forecast_point_ref text NOT NULL,
  forecast_point_hash text NOT NULL,
  actual_observation_ref text NOT NULL,
  actual_observation_hash text NOT NULL,
  predicted_observation_value text NOT NULL,
  predicted_observation_variance text NOT NULL,
  actual_observation_value text NOT NULL,
  actual_observation_variance text NOT NULL,
  representativeness_variance text NOT NULL,
  residual_value text NOT NULL,
  normalized_residual text,
  assimilation_update_ref text,
  assimilation_update_hash text,
  determinism_hash text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_fact_id text NOT NULL,
  UNIQUE (forecast_point_ref, actual_observation_ref)
);

CREATE INDEX IF NOT EXISTS idx_twin_forecast_residual_projection_v1_scope_time
  ON public.twin_forecast_residual_projection_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, logical_time DESC);

CREATE TABLE IF NOT EXISTS public.twin_approved_plan_binding_projection_v1 (
  approved_plan_evidence_ref text PRIMARY KEY,
  approved_plan_evidence_hash text NOT NULL,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  binding_id text NOT NULL,
  approval_assertion_ref text NOT NULL,
  approval_assertion_hash text NOT NULL,
  decision_request_ref text NOT NULL,
  decision_request_hash text NOT NULL,
  selected_option_ref text NOT NULL,
  selected_option_hash text NOT NULL,
  scenario_amount_mm text NOT NULL,
  approved_amount_mm text NOT NULL,
  plan_effective_from timestamptz NOT NULL,
  plan_effective_to timestamptz NOT NULL,
  active_for_decision boolean NOT NULL,
  canonical_evidence jsonb NOT NULL,
  source_fact_id text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_twin_approved_plan_binding_projection_v1_scope_validity
  ON public.twin_approved_plan_binding_projection_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, plan_effective_from, plan_effective_to);

CREATE TABLE IF NOT EXISTS public.twin_action_feedback_cycle_projection_v1 (
  projection_id text PRIMARY KEY,
  projection_hash text NOT NULL,
  decision_ref text NOT NULL,
  action_feedback_ref text NOT NULL,
  approved_plan_ref text NOT NULL,
  dispatch_disposition text NOT NULL CHECK (dispatch_disposition IN ('NOT_OBSERVED','NOT_APPLICABLE','EXTERNALLY_RECORDED')),
  outcome_observation_ref text NOT NULL,
  forecast_residual_ref text NOT NULL,
  assimilation_update_ref text NOT NULL,
  updated_state_ref text NOT NULL,
  canonical_projection jsonb NOT NULL,
  source_fact_refs jsonb NOT NULL,
  rebuilt_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (decision_ref, action_feedback_ref, forecast_residual_ref)
);

COMMENT ON TABLE public.twin_decision_record_projection_v1 IS 'Rebuildable projection only; canonical Decision history remains in public.facts.';
COMMENT ON TABLE public.twin_action_feedback_projection_v1 IS 'Rebuildable projection only; canonical Action Feedback history remains in public.facts.';
COMMENT ON TABLE public.twin_forecast_residual_projection_v1 IS 'Rebuildable projection only; canonical Forecast Residual history remains in public.facts.';
COMMENT ON TABLE public.twin_approved_plan_binding_projection_v1 IS 'Rebuildable Replay Evidence binding projection; not approval authority.';
COMMENT ON TABLE public.twin_action_feedback_cycle_projection_v1 IS 'Rebuildable lifecycle read model; not canonical truth or causal-effect authority.';
