CREATE UNIQUE INDEX IF NOT EXISTS ux_roi_ledger_v1_as_executed_type
  ON roi_ledger_v1(tenant_id, project_id, group_id, as_executed_id, roi_type);
