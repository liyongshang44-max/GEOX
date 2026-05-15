CREATE TABLE IF NOT EXISTS field_sensing_summary_stage1_v1 (
  tenant_id text NOT NULL,
  project_id text NULL,
  group_id text NULL,
  field_id text NOT NULL,
  freshness text NOT NULL DEFAULT 'unknown',
  confidence double precision NULL,
  canopy_temp_status text NULL,
  evapotranspiration_risk text NULL,
  sensor_quality_level text NULL,
  irrigation_effectiveness text NULL,
  leak_risk text NULL,
  official_soil_metrics_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at_ts_ms bigint NULL,
  updated_ts_ms bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  PRIMARY KEY (tenant_id, field_id)
);

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

CREATE INDEX IF NOT EXISTS idx_field_sensing_summary_stage1_scope
  ON field_sensing_summary_stage1_v1 (tenant_id, project_id, group_id, field_id);

CREATE INDEX IF NOT EXISTS idx_field_sensing_summary_stage1_evidence_sufficiency_v1
  ON field_sensing_summary_stage1_v1 (tenant_id, project_id, group_id, field_id, evidence_sufficiency);
