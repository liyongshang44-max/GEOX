ALTER TABLE field_sensing_summary_stage1_v1
  ADD COLUMN IF NOT EXISTS time_coverage_v1 jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE field_sensing_summary_stage1_v1
  ADD COLUMN IF NOT EXISTS evidence_sufficiency_v1 jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE field_sensing_summary_stage1_v1
  ADD COLUMN IF NOT EXISTS device_health_snapshot_v1 jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE field_sensing_summary_stage1_v1
  ADD COLUMN IF NOT EXISTS conflict_detection_v1 jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE field_sensing_summary_stage1_v1
  ADD COLUMN IF NOT EXISTS evidence_sufficiency text NOT NULL DEFAULT 'NEEDS_EVIDENCE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'field_sensing_summary_stage1_evidence_sufficiency_v1_check'
  ) THEN
    ALTER TABLE field_sensing_summary_stage1_v1
      ADD CONSTRAINT field_sensing_summary_stage1_evidence_sufficiency_v1_check
      CHECK (evidence_sufficiency IN ('PASS','NEEDS_EVIDENCE')) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_field_sensing_summary_stage1_evidence_sufficiency_v1
  ON field_sensing_summary_stage1_v1 (tenant_id, project_id, group_id, field_id, evidence_sufficiency);
