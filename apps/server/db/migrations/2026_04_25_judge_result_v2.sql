CREATE TABLE IF NOT EXISTS judge_result_v2 (
  judge_id TEXT PRIMARY KEY,
  judge_kind TEXT NOT NULL,

  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,

  field_id TEXT NULL,
  season_id TEXT NULL,
  device_id TEXT NULL,

  recommendation_id TEXT NULL,
  prescription_id TEXT NULL,
  task_id TEXT NULL,
  receipt_id TEXT NULL,
  as_executed_id TEXT NULL,
  as_applied_id TEXT NULL,

  verdict TEXT NOT NULL,
  severity TEXT NOT NULL,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,

  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  outputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence JSONB NOT NULL DEFAULT '{}'::jsonb,

  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_ts_ms BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_judge_result_v2_tenant_scope_kind
  ON judge_result_v2(tenant_id, project_id, group_id, judge_kind, created_ts_ms DESC);

CREATE INDEX IF NOT EXISTS idx_judge_result_v2_task_id
  ON judge_result_v2(task_id);

CREATE INDEX IF NOT EXISTS idx_judge_result_v2_receipt_id
  ON judge_result_v2(receipt_id);

CREATE INDEX IF NOT EXISTS idx_judge_result_v2_as_executed_id
  ON judge_result_v2(as_executed_id);

CREATE INDEX IF NOT EXISTS idx_judge_result_v2_recommendation_id
  ON judge_result_v2(recommendation_id);

CREATE INDEX IF NOT EXISTS idx_judge_result_v2_prescription_id
  ON judge_result_v2(prescription_id);
