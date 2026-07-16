-- apps/server/db/migrations/2026_07_16_mcft_cap_06_calibration_governance_persistence.sql
-- Purpose: add exactly one additive MCFT-CAP-06 S3 migration for D-transaction Candidate/Evaluation idempotency and rebuildable projections.
-- Boundary: public.facts remains the sole canonical store; all tables below are mutable support state, and no active-config index is created or modified.

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
    'C_FORECAST_RESIDUAL',
    'D_CALIBRATION_CANDIDATE',
    'D_SHADOW_EVALUATION'
  ));

CREATE TABLE IF NOT EXISTS public.twin_calibration_candidate_projection_v1 (
  candidate_object_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  logical_time timestamptz NOT NULL,
  as_of timestamptz NOT NULL,
  runtime_config_ref text NOT NULL,
  runtime_config_hash text NOT NULL,
  context_lineage_ref text NOT NULL,
  context_revision_ref text NOT NULL,
  candidate_status text NOT NULL CHECK (candidate_status IN ('BOUNDED_PARAMETER_DELTA_CANDIDATE','NO_OP_BASE_PARAMETER_RETAINED')),
  calibration_run_id text NOT NULL,
  base_parameter_value text NOT NULL,
  candidate_parameter_value text NOT NULL,
  parameter_delta text NOT NULL,
  activation_status text NOT NULL CHECK (activation_status = 'NOT_ACTIVE'),
  eligible_for_state_input boolean NOT NULL CHECK (eligible_for_state_input = false),
  eligible_for_runtime_config_use boolean NOT NULL CHECK (eligible_for_runtime_config_use = false),
  eligible_for_human_activation_review boolean NOT NULL CHECK (eligible_for_human_activation_review = false),
  determinism_hash text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_fact_id text NOT NULL,
  UNIQUE (calibration_run_id)
);

CREATE INDEX IF NOT EXISTS idx_twin_calibration_candidate_projection_v1_scope_time
  ON public.twin_calibration_candidate_projection_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, logical_time DESC);

CREATE TABLE IF NOT EXISTS public.twin_shadow_evaluation_projection_v1 (
  evaluation_object_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text NOT NULL,
  season_id text NOT NULL,
  zone_id text NOT NULL,
  logical_time timestamptz NOT NULL,
  as_of timestamptz NOT NULL,
  runtime_config_ref text NOT NULL,
  runtime_config_hash text NOT NULL,
  candidate_ref text NOT NULL,
  candidate_hash text NOT NULL,
  evaluation_kind text NOT NULL CHECK (evaluation_kind = 'PAIRED_HISTORICAL_REPLAY_SHADOW_EVALUATION'),
  evaluation_disposition text NOT NULL CHECK (evaluation_disposition IN ('ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW','NOT_ELIGIBLE_FOR_ACTIVATION_REVIEW','BASE_PARAMETER_RETAINED','INCONCLUSIVE')),
  eligible_for_human_activation_review boolean NOT NULL,
  holdout_window_ref_membership_hash text NOT NULL,
  holdout_purpose text NOT NULL CHECK (holdout_purpose = 'HIGH_EXCESS_STRESS_HOLDOUT_ONLY'),
  holdout_generalization_claim text NOT NULL CHECK (holdout_generalization_claim = 'NOT_ESTABLISHED'),
  case_results_hash text NOT NULL,
  model_activation_created boolean NOT NULL CHECK (model_activation_created = false),
  active_config_switch_performed boolean NOT NULL CHECK (active_config_switch_performed = false),
  approval_created boolean NOT NULL CHECK (approval_created = false),
  activation_authorized boolean NOT NULL CHECK (activation_authorized = false),
  determinism_hash text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_fact_id text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_twin_shadow_evaluation_projection_v1_scope_time
  ON public.twin_shadow_evaluation_projection_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, logical_time DESC);

CREATE TABLE IF NOT EXISTS public.twin_candidate_evaluation_index_v1 (
  candidate_ref text NOT NULL,
  evaluation_ref text NOT NULL,
  evaluation_hash text NOT NULL,
  evaluation_disposition text NOT NULL,
  source_fact_id text NOT NULL,
  PRIMARY KEY (candidate_ref, evaluation_ref)
);

CREATE INDEX IF NOT EXISTS idx_twin_candidate_evaluation_index_v1_candidate
  ON public.twin_candidate_evaluation_index_v1 (candidate_ref, evaluation_ref);

CREATE TABLE IF NOT EXISTS public.twin_shadow_evaluation_case_projection_v1 (
  evaluation_ref text NOT NULL,
  case_index integer NOT NULL CHECK (case_index >= 0),
  residual_ref text NOT NULL,
  residual_hash text NOT NULL,
  source_forecast_ref text NOT NULL,
  source_forecast_hash text NOT NULL,
  source_forecast_point_ref text NOT NULL,
  source_posterior_ref text NOT NULL,
  source_runtime_config_ref text NOT NULL,
  observation_ref text NOT NULL,
  forecast_target_time timestamptz NOT NULL,
  observation_available_to_runtime_at timestamptz NOT NULL,
  base_parameter_value text NOT NULL,
  candidate_parameter_value text NOT NULL,
  base_prediction_vwc text NOT NULL,
  candidate_prediction_vwc text NOT NULL,
  actual_observation_vwc text NOT NULL,
  base_residual_vwc text NOT NULL,
  candidate_residual_vwc text NOT NULL,
  base_invariant_status text NOT NULL CHECK (base_invariant_status IN ('PASS','FAIL')),
  candidate_invariant_status text NOT NULL CHECK (candidate_invariant_status IN ('PASS','FAIL')),
  base_mass_balance_status text NOT NULL CHECK (base_mass_balance_status IN ('PASS','FAIL')),
  candidate_mass_balance_status text NOT NULL CHECK (candidate_mass_balance_status IN ('PASS','FAIL')),
  source_fact_id text NOT NULL,
  PRIMARY KEY (evaluation_ref, case_index),
  UNIQUE (evaluation_ref, residual_ref)
);

CREATE INDEX IF NOT EXISTS idx_twin_shadow_evaluation_case_projection_v1_residual
  ON public.twin_shadow_evaluation_case_projection_v1 (residual_ref, evaluation_ref);

COMMENT ON TABLE public.twin_calibration_candidate_projection_v1 IS 'Rebuildable MCFT-CAP-06 Candidate projection only; canonical Candidate history remains in public.facts.';
COMMENT ON TABLE public.twin_shadow_evaluation_projection_v1 IS 'Rebuildable MCFT-CAP-06 Shadow Evaluation projection only; canonical Evaluation history remains in public.facts.';
COMMENT ON TABLE public.twin_candidate_evaluation_index_v1 IS 'Rebuildable one-to-zero-or-many Candidate-to-Evaluation index; candidate_ref is intentionally not unique.';
COMMENT ON TABLE public.twin_shadow_evaluation_case_projection_v1 IS 'Rebuildable embedded case-result projection; not independent canonical authority.';
