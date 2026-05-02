CREATE UNIQUE INDEX IF NOT EXISTS ux_roi_ledger_v1_as_executed_type
  ON roi_ledger_v1(tenant_id, project_id, group_id, as_executed_id, roi_type);

ALTER TABLE roi_ledger_v1
  ADD COLUMN IF NOT EXISTS baseline_type text NOT NULL DEFAULT 'DEFAULT_ASSUMPTION',
  ADD COLUMN IF NOT EXISTS baseline_value numeric NULL,
  ADD COLUMN IF NOT EXISTS planned_value numeric NULL,
  ADD COLUMN IF NOT EXISTS actual_value numeric NULL,
  ADD COLUMN IF NOT EXISTS delta_value numeric NULL,
  ADD COLUMN IF NOT EXISTS unit text NULL,
  ADD COLUMN IF NOT EXISTS estimated_money_value numeric NULL,
  ADD COLUMN IF NOT EXISTS currency text NULL,
  ADD COLUMN IF NOT EXISTS source_skill_id text NULL,
  ADD COLUMN IF NOT EXISTS skill_trace_ref text NULL,
  ADD COLUMN IF NOT EXISTS field_memory_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS value_kind text NOT NULL DEFAULT 'ASSUMPTION_BASED';

ALTER TABLE roi_ledger_v1
  DROP CONSTRAINT IF EXISTS ck_roi_ledger_v1_value_kind,
  DROP CONSTRAINT IF EXISTS ck_roi_ledger_v1_baseline_type;

ALTER TABLE roi_ledger_v1
  ADD CONSTRAINT ck_roi_ledger_v1_value_kind CHECK (value_kind IN ('MEASURED','ESTIMATED','ASSUMPTION_BASED','INSUFFICIENT_EVIDENCE')),
  ADD CONSTRAINT ck_roi_ledger_v1_baseline_type CHECK (baseline_type IN ('CUSTOMER_PROVIDED','HISTORICAL_AVERAGE','CONTROL_FIELD','SEASON_PLAN','DEFAULT_ASSUMPTION'));
