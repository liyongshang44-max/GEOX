ALTER TABLE device_status_index_v1
  ADD COLUMN IF NOT EXISTS project_id TEXT;

ALTER TABLE device_status_index_v1
  ADD COLUMN IF NOT EXISTS group_id TEXT;

UPDATE device_status_index_v1
SET project_id = COALESCE(project_id, 'projectA'),
    group_id = COALESCE(group_id, 'groupA')
WHERE project_id IS NULL OR group_id IS NULL;

CREATE INDEX IF NOT EXISTS device_status_index_v1_scope_device_idx
  ON device_status_index_v1 (tenant_id, project_id, group_id, device_id);
