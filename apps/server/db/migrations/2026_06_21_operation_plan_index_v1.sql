-- apps/server/db/migrations/2026_06_21_operation_plan_index_v1.sql
CREATE TABLE IF NOT EXISTS public.operation_plan_index_v1 (
  operation_plan_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  field_id text,
  zone_id text,
  spatial_scope_json jsonb,
  season_id text,
  program_id text,
  recommendation_id text,
  recommendation_fact_id text,
  approval_request_id text,
  approval_decision text,
  approval_decision_fact_id text,
  status text NOT NULL,
  act_task_id text,
  receipt_fact_id text,
  source_fact_id text,
  created_ts bigint NOT NULL,
  updated_ts bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operation_plan_index_v1_scope_latest ON public.operation_plan_index_v1 (tenant_id, project_id, group_id, field_id, updated_ts DESC);
CREATE INDEX IF NOT EXISTS idx_operation_plan_index_v1_approval_request ON public.operation_plan_index_v1 (approval_request_id);
CREATE INDEX IF NOT EXISTS idx_operation_plan_index_v1_approval_decision_fact ON public.operation_plan_index_v1 (approval_decision_fact_id);
CREATE INDEX IF NOT EXISTS idx_operation_plan_index_v1_recommendation ON public.operation_plan_index_v1 (recommendation_id);
