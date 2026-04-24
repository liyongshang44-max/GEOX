CREATE TABLE IF NOT EXISTS prescription_contract_v1 (
  prescription_id TEXT PRIMARY KEY,
  recommendation_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  season_id TEXT NULL,
  crop_id TEXT NULL,
  zone_id TEXT NULL,
  operation_type TEXT NOT NULL,
  spatial_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  timing_window JSONB NOT NULL DEFAULT '{}'::jsonb,
  operation_amount JSONB NOT NULL DEFAULT '{}'::jsonb,
  device_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_requirement JSONB NOT NULL DEFAULT '{}'::jsonb,
  acceptance_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NULL
);

ALTER TABLE prescription_contract_v1
  ADD COLUMN IF NOT EXISTS project_id TEXT;

ALTER TABLE prescription_contract_v1
  ADD COLUMN IF NOT EXISTS group_id TEXT;

WITH recommendation_scope AS (
  SELECT
    record_json::jsonb#>>'{payload,recommendation_id}' AS recommendation_id,
    record_json::jsonb#>>'{payload,tenant_id}' AS tenant_id,
    record_json::jsonb#>>'{payload,project_id}' AS project_id,
    record_json::jsonb#>>'{payload,group_id}' AS group_id,
    ROW_NUMBER() OVER (
      PARTITION BY record_json::jsonb#>>'{payload,tenant_id}',
                   record_json::jsonb#>>'{payload,recommendation_id}'
      ORDER BY occurred_at DESC, fact_id DESC
    ) AS rn
  FROM facts
  WHERE (record_json::jsonb->>'type') = 'decision_recommendation_v1'
)
UPDATE prescription_contract_v1 p
SET
  project_id = COALESCE(NULLIF(p.project_id, ''), NULLIF(rs.project_id, '')),
  group_id = COALESCE(NULLIF(p.group_id, ''), NULLIF(rs.group_id, ''))
FROM recommendation_scope rs
WHERE rs.rn = 1
  AND p.tenant_id = rs.tenant_id
  AND p.recommendation_id = rs.recommendation_id
  AND (
    p.project_id IS NULL OR p.project_id = ''
    OR p.group_id IS NULL OR p.group_id = ''
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM prescription_contract_v1
    WHERE project_id IS NULL OR project_id = '' OR group_id IS NULL OR group_id = ''
  ) THEN
    RAISE EXCEPTION 'PRESCRIPTION_SCOPE_BACKFILL_FAILED: missing project_id/group_id in prescription_contract_v1';
  END IF;
END $$;

ALTER TABLE prescription_contract_v1
  ALTER COLUMN project_id SET NOT NULL;

ALTER TABLE prescription_contract_v1
  ALTER COLUMN group_id SET NOT NULL;

DROP INDEX IF EXISTS ux_prescription_contract_v1_recommendation_id;
DROP INDEX IF EXISTS ux_prescription_contract_v1_tenant_project_group_recommendation;

CREATE UNIQUE INDEX ux_prescription_contract_v1_tenant_project_group_recommendation
  ON prescription_contract_v1(tenant_id, project_id, group_id, recommendation_id);

CREATE INDEX IF NOT EXISTS idx_prescription_contract_v1_recommendation_id
  ON prescription_contract_v1(recommendation_id);

CREATE INDEX IF NOT EXISTS idx_prescription_contract_v1_tenant_field
  ON prescription_contract_v1(tenant_id, field_id);

CREATE INDEX IF NOT EXISTS idx_prescription_contract_v1_status
  ON prescription_contract_v1(status);
