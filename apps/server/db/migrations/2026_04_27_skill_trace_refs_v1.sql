ALTER TABLE prescription_contract_v1
  ADD COLUMN IF NOT EXISTS skill_trace_id TEXT NULL;

ALTER TABLE prescription_contract_v1
  ADD COLUMN IF NOT EXISTS skill_trace JSONB NULL;

ALTER TABLE roi_ledger_v1
  ADD COLUMN IF NOT EXISTS skill_trace_id TEXT NULL;

ALTER TABLE roi_ledger_v1
  ADD COLUMN IF NOT EXISTS skill_refs JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_prescription_contract_v1_skill_trace_id
  ON prescription_contract_v1(skill_trace_id);

CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_skill_trace_id
  ON roi_ledger_v1(skill_trace_id);
