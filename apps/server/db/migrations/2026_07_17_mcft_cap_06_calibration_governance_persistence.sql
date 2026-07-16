-- apps/server/db/migrations/2026_07_17_mcft_cap_06_calibration_governance_persistence.sql
-- Purpose: add the bounded MCFT-CAP-06 D-transaction idempotency kinds and rebuildable Candidate, Evaluation, Candidate-to-Evaluation, and embedded-case projections.
-- Boundary: exactly one additive CAP-06 migration; public.facts remains the sole canonical store; no active-config index, Model Activation table, Runtime authority, State, checkpoint, route, or scheduler is created or modified.

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
  candidate_status text NOT NULL CHECK (candidate_status IN (
    'BOUNDED_PARAMETER_DELTA_CANDIDATE',
    'NO_OP_BASE_PARAMETER_RETAINED'
  )),
  base_config_ref text NOT NULL,
  base_config_hash text NOT NULL,
  context_lineage_ref text NOT NULL,
  context_revision_ref text NOT NULL,
  parameter_key text NOT NULL,
  base_parameter_value text NOT NULL,
  candidate_parameter_value text NOT NULL,
  parameter_delta text NOT NULL,
  activation_status text NOT NULL CHECK (activation_status = 'NOT_ACTIVE'),
  eligible_for_state_input boolean NOT NULL CHECK (eligible_for_state_input = false),
  eligible_for_runtime_config_use boolean NOT NULL CHECK (eligible_for_runtime_config_use = false),
  eligible_for_human_activation_review boolean NOT NULL CHECK (eligible_for_human_activation_review = false),
  determinism_hash text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_fact_id text NOT NULL
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
  candidate_ref text NOT NULL,
  candidate_hash text NOT NULL,
  evaluation_dataset_hash text NOT NULL,
  evaluation_policy_hash text NOT NULL,
  shadow_replay_engine_id text NOT NULL,
  calibration_metric_numeric_policy_hash text NOT NULL,
  evaluation_disposition text NOT NULL CHECK (evaluation_disposition IN (
    'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW',
    'NOT_ELIGIBLE_FOR_ACTIVATION_REVIEW',
    'BASE_PARAMETER_RETAINED',
    'INCONCLUSIVE'
  )),
  eligible_for_human_activation_review boolean NOT NULL,
  determinism_hash text NOT NULL,
  canonical_payload jsonb NOT NULL,
  source_fact_id text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_twin_shadow_evaluation_projection_v1_scope_time
  ON public.twin_shadow_evaluation_projection_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, logical_time DESC);

CREATE TABLE IF NOT EXISTS public.twin_candidate_evaluation_index_v1 (
  candidate_ref text NOT NULL,
  evaluation_object_id text NOT NULL,
  evaluation_dataset_hash text NOT NULL,
  evaluation_policy_hash text NOT NULL,
  shadow_replay_engine_id text NOT NULL,
  calibration_metric_numeric_policy_hash text NOT NULL,
  evaluation_disposition text NOT NULL CHECK (evaluation_disposition IN (
    'ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW',
    'NOT_ELIGIBLE_FOR_ACTIVATION_REVIEW',
    'BASE_PARAMETER_RETAINED',
    'INCONCLUSIVE'
  )),
  source_fact_id text NOT NULL,
  PRIMARY KEY (candidate_ref, evaluation_object_id),
  UNIQUE (
    candidate_ref,
    evaluation_dataset_hash,
    evaluation_policy_hash,
    shadow_replay_engine_id,
    calibration_metric_numeric_policy_hash
  )
);

CREATE INDEX IF NOT EXISTS idx_twin_candidate_evaluation_index_v1_candidate
  ON public.twin_candidate_evaluation_index_v1 (candidate_ref, evaluation_object_id);

CREATE TABLE IF NOT EXISTS public.twin_shadow_evaluation_case_projection_v1 (
  evaluation_object_id text NOT NULL,
  case_index integer NOT NULL CHECK (case_index >= 0),
  residual_ref text NOT NULL,
  residual_hash text NOT NULL,
  source_forecast_ref text NOT NULL,
  source_forecast_hash text NOT NULL,
  source_forecast_point_ref text NOT NULL,
  source_posterior_ref text NOT NULL,
  source_runtime_config_ref text NOT NULL,
  forecast_target_time timestamptz NOT NULL,
  observation_ref text NOT NULL,
  observation_available_to_runtime_at timestamptz NOT NULL,
  base_parameter_value text NOT NULL,
  candidate_parameter_value text NOT NULL,
  base_prediction_vwc text NOT NULL,
  candidate_prediction_vwc text NOT NULL,
  actual_observation_vwc text NOT NULL,
  base_residual_vwc text NOT NULL,
  candidate_residual_vwc text NOT NULL,
  base_mass_balance_hash text NOT NULL,
  candidate_mass_balance_hash text NOT NULL,
  base_invariant_status text NOT NULL CHECK (base_invariant_status IN ('PASS','FAIL')),
  candidate_invariant_status text NOT NULL CHECK (candidate_invariant_status IN ('PASS','FAIL')),
  canonical_case_result jsonb NOT NULL,
  source_fact_id text NOT NULL,
  PRIMARY KEY (evaluation_object_id, case_index),
  UNIQUE (evaluation_object_id, residual_ref)
);

CREATE INDEX IF NOT EXISTS idx_twin_shadow_evaluation_case_projection_v1_residual
  ON public.twin_shadow_evaluation_case_projection_v1 (residual_ref, evaluation_object_id);

CREATE OR REPLACE FUNCTION public.enforce_mcft_cap06_projection_canonicality_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  fact_record jsonb;
  canonical_object jsonb;
  canonical_payload jsonb;
  canonical_scope jsonb;
  canonical_case jsonb;
BEGIN
  SELECT record_json
    INTO fact_record
    FROM public.facts
   WHERE fact_id = NEW.source_fact_id;

  IF fact_record IS NULL THEN
    RAISE EXCEPTION 'CAP06_PROJECTION_SOURCE_FACT_REQUIRED:%', NEW.source_fact_id;
  END IF;

  canonical_object := fact_record->'payload';
  canonical_payload := canonical_object->'payload';
  canonical_scope := canonical_object->'scope';

  IF TG_TABLE_NAME = 'twin_calibration_candidate_projection_v1' THEN
    IF fact_record->>'type' <> 'twin_calibration_candidate_v1'
      OR NEW.candidate_object_id <> canonical_object->>'object_id'
      OR NEW.tenant_id <> canonical_scope->>'tenant_id'
      OR NEW.project_id <> canonical_scope->>'project_id'
      OR NEW.group_id <> canonical_scope->>'group_id'
      OR NEW.field_id <> canonical_scope->>'field_id'
      OR NEW.season_id <> canonical_scope->>'season_id'
      OR NEW.zone_id <> canonical_scope->>'zone_id'
      OR NEW.logical_time <> (canonical_object->>'logical_time')::timestamptz
      OR NEW.as_of <> (canonical_object->>'as_of')::timestamptz
      OR NEW.candidate_status <> canonical_payload->>'candidate_status'
      OR NEW.base_config_ref <> canonical_payload->>'base_config_ref'
      OR NEW.base_config_hash <> canonical_payload->>'base_config_hash'
      OR NEW.context_lineage_ref <> canonical_object->>'context_lineage_ref'
      OR NEW.context_revision_ref <> canonical_object->>'context_revision_ref'
      OR NEW.parameter_key <> canonical_payload->>'parameter_key'
      OR NEW.base_parameter_value <> canonical_payload->>'base_parameter_value'
      OR NEW.candidate_parameter_value <> canonical_payload->>'candidate_parameter_value'
      OR NEW.parameter_delta <> canonical_payload->>'parameter_delta'
      OR NEW.activation_status <> canonical_payload->>'activation_status'
      OR NEW.eligible_for_state_input <> (canonical_payload->>'eligible_for_state_input')::boolean
      OR NEW.eligible_for_runtime_config_use <> (canonical_payload->>'eligible_for_runtime_config_use')::boolean
      OR NEW.eligible_for_human_activation_review <> (canonical_payload->>'eligible_for_human_activation_review')::boolean
      OR NEW.canonical_payload <> canonical_payload THEN
      RAISE EXCEPTION 'CAP06_CANDIDATE_PROJECTION_CANONICAL_DIVERGENCE:%', NEW.candidate_object_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'twin_shadow_evaluation_projection_v1' THEN
    IF fact_record->>'type' <> 'twin_shadow_evaluation_v1'
      OR NEW.evaluation_object_id <> canonical_object->>'object_id'
      OR NEW.tenant_id <> canonical_scope->>'tenant_id'
      OR NEW.project_id <> canonical_scope->>'project_id'
      OR NEW.group_id <> canonical_scope->>'group_id'
      OR NEW.field_id <> canonical_scope->>'field_id'
      OR NEW.season_id <> canonical_scope->>'season_id'
      OR NEW.zone_id <> canonical_scope->>'zone_id'
      OR NEW.logical_time <> (canonical_object->>'logical_time')::timestamptz
      OR NEW.as_of <> (canonical_object->>'as_of')::timestamptz
      OR NEW.candidate_ref <> canonical_payload->>'candidate_ref'
      OR NEW.candidate_hash <> canonical_payload->>'candidate_hash'
      OR NEW.evaluation_dataset_hash <> canonical_payload->>'evaluation_dataset_hash'
      OR NEW.evaluation_policy_hash <> canonical_payload->>'evaluation_policy_hash'
      OR NEW.shadow_replay_engine_id <> canonical_payload->>'shadow_replay_engine_id'
      OR NEW.calibration_metric_numeric_policy_hash <> canonical_payload->>'calibration_metric_numeric_policy_hash'
      OR NEW.evaluation_disposition <> canonical_payload->>'evaluation_disposition'
      OR NEW.eligible_for_human_activation_review <> (canonical_payload->>'eligible_for_human_activation_review')::boolean
      OR NEW.canonical_payload <> canonical_payload THEN
      RAISE EXCEPTION 'CAP06_EVALUATION_PROJECTION_CANONICAL_DIVERGENCE:%', NEW.evaluation_object_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'twin_candidate_evaluation_index_v1' THEN
    IF fact_record->>'type' <> 'twin_shadow_evaluation_v1'
      OR NEW.evaluation_object_id <> canonical_object->>'object_id'
      OR NEW.candidate_ref <> canonical_payload->>'candidate_ref'
      OR NEW.evaluation_dataset_hash <> canonical_payload->>'evaluation_dataset_hash'
      OR NEW.evaluation_policy_hash <> canonical_payload->>'evaluation_policy_hash'
      OR NEW.shadow_replay_engine_id <> canonical_payload->>'shadow_replay_engine_id'
      OR NEW.calibration_metric_numeric_policy_hash <> canonical_payload->>'calibration_metric_numeric_policy_hash'
      OR NEW.evaluation_disposition <> canonical_payload->>'evaluation_disposition' THEN
      RAISE EXCEPTION 'CAP06_CANDIDATE_EVALUATION_INDEX_CANONICAL_DIVERGENCE:%', NEW.evaluation_object_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'twin_shadow_evaluation_case_projection_v1' THEN
    IF fact_record->>'type' <> 'twin_shadow_evaluation_v1'
      OR NEW.evaluation_object_id <> canonical_object->>'object_id' THEN
      RAISE EXCEPTION 'CAP06_EVALUATION_CASE_SOURCE_DIVERGENCE:%', NEW.evaluation_object_id;
    END IF;

    SELECT value
      INTO canonical_case
      FROM jsonb_array_elements(canonical_payload->'case_results') AS value
     WHERE (value->>'case_index')::integer = NEW.case_index;

    IF canonical_case IS NULL
      OR NEW.residual_ref <> canonical_case->>'residual_ref'
      OR NEW.residual_hash <> canonical_case->>'residual_hash'
      OR NEW.source_forecast_ref <> canonical_case->>'source_forecast_ref'
      OR NEW.source_forecast_hash <> canonical_case->>'source_forecast_hash'
      OR NEW.source_forecast_point_ref <> canonical_case->>'source_forecast_point_ref'
      OR NEW.source_posterior_ref <> canonical_case->>'source_posterior_ref'
      OR NEW.source_runtime_config_ref <> canonical_case->>'source_runtime_config_ref'
      OR NEW.forecast_target_time <> (canonical_case->>'forecast_target_time')::timestamptz
      OR NEW.observation_ref <> canonical_case->>'observation_ref'
      OR NEW.observation_available_to_runtime_at <> (canonical_case->>'observation_available_to_runtime_at')::timestamptz
      OR NEW.base_parameter_value <> canonical_case->>'base_parameter_value'
      OR NEW.candidate_parameter_value <> canonical_case->>'candidate_parameter_value'
      OR NEW.base_prediction_vwc <> canonical_case->>'base_prediction_vwc'
      OR NEW.candidate_prediction_vwc <> canonical_case->>'candidate_prediction_vwc'
      OR NEW.actual_observation_vwc <> canonical_case->>'actual_observation_vwc'
      OR NEW.base_residual_vwc <> canonical_case->>'base_residual_vwc'
      OR NEW.candidate_residual_vwc <> canonical_case->>'candidate_residual_vwc'
      OR NEW.base_mass_balance_hash <> canonical_case->>'base_mass_balance_hash'
      OR NEW.candidate_mass_balance_hash <> canonical_case->>'candidate_mass_balance_hash'
      OR NEW.base_invariant_status <> canonical_case->>'base_invariant_status'
      OR NEW.candidate_invariant_status <> canonical_case->>'candidate_invariant_status'
      OR NEW.canonical_case_result <> canonical_case THEN
      RAISE EXCEPTION 'CAP06_EVALUATION_CASE_PROJECTION_CANONICAL_DIVERGENCE:%:%', NEW.evaluation_object_id, NEW.case_index;
    END IF;
  ELSE
    RAISE EXCEPTION 'CAP06_PROJECTION_TRIGGER_TABLE_UNSUPPORTED:%', TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_twin_calibration_candidate_projection_canonicality_v1
  ON public.twin_calibration_candidate_projection_v1;
CREATE TRIGGER trg_twin_calibration_candidate_projection_canonicality_v1
BEFORE INSERT OR UPDATE ON public.twin_calibration_candidate_projection_v1
FOR EACH ROW EXECUTE FUNCTION public.enforce_mcft_cap06_projection_canonicality_v1();

DROP TRIGGER IF EXISTS trg_twin_shadow_evaluation_projection_canonicality_v1
  ON public.twin_shadow_evaluation_projection_v1;
CREATE TRIGGER trg_twin_shadow_evaluation_projection_canonicality_v1
BEFORE INSERT OR UPDATE ON public.twin_shadow_evaluation_projection_v1
FOR EACH ROW EXECUTE FUNCTION public.enforce_mcft_cap06_projection_canonicality_v1();

DROP TRIGGER IF EXISTS trg_twin_candidate_evaluation_index_canonicality_v1
  ON public.twin_candidate_evaluation_index_v1;
CREATE TRIGGER trg_twin_candidate_evaluation_index_canonicality_v1
BEFORE INSERT OR UPDATE ON public.twin_candidate_evaluation_index_v1
FOR EACH ROW EXECUTE FUNCTION public.enforce_mcft_cap06_projection_canonicality_v1();

DROP TRIGGER IF EXISTS trg_twin_shadow_evaluation_case_projection_canonicality_v1
  ON public.twin_shadow_evaluation_case_projection_v1;
CREATE TRIGGER trg_twin_shadow_evaluation_case_projection_canonicality_v1
BEFORE INSERT OR UPDATE ON public.twin_shadow_evaluation_case_projection_v1
FOR EACH ROW EXECUTE FUNCTION public.enforce_mcft_cap06_projection_canonicality_v1();

COMMENT ON TABLE public.twin_calibration_candidate_projection_v1 IS
  'Rebuildable model-governance projection only; canonical Calibration Candidate history remains in public.facts and is never Runtime authority.';
COMMENT ON TABLE public.twin_shadow_evaluation_projection_v1 IS
  'Rebuildable historical-replay Evaluation projection only; canonical Evaluation history remains in public.facts and does not activate a model.';
COMMENT ON TABLE public.twin_candidate_evaluation_index_v1 IS
  'Rebuildable one-Candidate-to-zero-or-many-Evaluations index; candidate_ref alone is intentionally not unique.';
COMMENT ON TABLE public.twin_shadow_evaluation_case_projection_v1 IS
  'Rebuildable projection of the eight case summaries embedded in each canonical Shadow Evaluation.';
