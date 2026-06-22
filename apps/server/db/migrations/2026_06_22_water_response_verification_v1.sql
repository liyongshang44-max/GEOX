-- apps/server/db/migrations/2026_06_22_water_response_verification_v1.sql
CREATE TABLE IF NOT EXISTS public.water_response_verification_index_v1 (
  verification_id text PRIMARY KEY, tenant_id text NOT NULL, project_id text NOT NULL, group_id text NOT NULL, field_id text NOT NULL, zone_id text NOT NULL,
  acceptance_id text NOT NULL, acceptance_result_fact_id text NOT NULL, as_executed_id text NOT NULL, task_id text NOT NULL, receipt_id text NOT NULL, operation_plan_id text,
  pre_state_id text NOT NULL, post_state_id text NOT NULL, response_verdict text NOT NULL, available_water_fraction_delta double precision, weighted_matric_potential_kpa_delta double precision, class_transition text NOT NULL,
  blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb, evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb, source_fact_id text NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_water_response_verification_index_v1_scope_latest ON public.water_response_verification_index_v1 (tenant_id, project_id, group_id, field_id, zone_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_water_response_verification_index_v1_acceptance ON public.water_response_verification_index_v1 (tenant_id, project_id, group_id, acceptance_id);
