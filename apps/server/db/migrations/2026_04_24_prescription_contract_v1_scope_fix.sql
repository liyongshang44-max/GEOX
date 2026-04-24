ALTER TABLE prescription_contract_v1
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS group_id TEXT;

UPDATE prescription_contract_v1
SET project_id = COALESCE(NULLIF(project_id, ''), 'projectA')
WHERE project_id IS NULL OR project_id = '';

UPDATE prescription_contract_v1
SET group_id = COALESCE(NULLIF(group_id, ''), 'groupA')
WHERE group_id IS NULL OR group_id = '';

ALTER TABLE prescription_contract_v1
  ALTER COLUMN project_id SET NOT NULL,
  ALTER COLUMN group_id SET NOT NULL;

DROP INDEX IF EXISTS ux_prescription_contract_v1_recommendation_id;
CREATE UNIQUE INDEX IF NOT EXISTS ux_prescription_contract_v1_tenant_project_group_recommendation
  ON prescription_contract_v1(tenant_id, project_id, group_id, recommendation_id);
