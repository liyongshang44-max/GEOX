ALTER TABLE as_applied_map_v1
  ADD COLUMN IF NOT EXISTS as_executed_id TEXT;

UPDATE as_applied_map_v1 am
SET as_executed_id = ae.as_executed_id
FROM as_executed_record_v1 ae
WHERE am.as_executed_id IS NULL
  AND am.tenant_id = ae.tenant_id
  AND am.project_id = ae.project_id
  AND am.group_id = ae.group_id
  AND am.task_id = ae.task_id
  AND am.receipt_id = ae.receipt_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM as_applied_map_v1
    WHERE as_executed_id IS NULL
  ) THEN
    RAISE EXCEPTION 'AS_APPLIED_AS_EXECUTED_BACKFILL_FAILED';
  END IF;
END $$;

ALTER TABLE as_applied_map_v1
  ALTER COLUMN as_executed_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_as_applied_map_v1_as_executed_id
  ON as_applied_map_v1(as_executed_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_as_applied_map_v1_scope_as_executed
  ON as_applied_map_v1(tenant_id, project_id, group_id, as_executed_id);
