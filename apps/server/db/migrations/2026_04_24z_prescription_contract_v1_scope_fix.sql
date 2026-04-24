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
      PARTITION BY record_json::jsonb#>>'{payload,tenant_id}', record_json::jsonb#>>'{payload,recommendation_id}'
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
  ALTER COLUMN project_id SET NOT NULL,
  ALTER COLUMN group_id SET NOT NULL;

DROP INDEX IF EXISTS ux_prescription_contract_v1_recommendation_id;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prescription_contract_v1'
      AND column_name = 'project_id'
  ) THEN
    RAISE EXCEPTION 'PRESCRIPTION_SCOPE_COLUMN_MISSING: project_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prescription_contract_v1'
      AND column_name = 'group_id'
  ) THEN
    RAISE EXCEPTION 'PRESCRIPTION_SCOPE_COLUMN_MISSING: group_id';
  END IF;
END $$;

DROP INDEX IF EXISTS ux_prescription_contract_v1_tenant_project_group_recommendation;
CREATE UNIQUE INDEX ux_prescription_contract_v1_tenant_project_group_recommendation
  ON prescription_contract_v1(tenant_id, project_id, group_id, recommendation_id);
