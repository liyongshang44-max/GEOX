-- Preserve idempotent interim ROI signal rows while allowing formalized ROI rows
-- for the same as_executed/roi_type pair to coexist in the formal trust lane.
DROP INDEX IF EXISTS ux_roi_ledger_v1_as_executed_type;

CREATE UNIQUE INDEX IF NOT EXISTS ux_roi_ledger_v1_as_executed_type_source_lane
  ON roi_ledger_v1(tenant_id, project_id, group_id, as_executed_id, roi_type, source_lane);

CREATE INDEX IF NOT EXISTS idx_roi_ledger_v1_interim_by_as_executed
  ON roi_ledger_v1(tenant_id, project_id, group_id, as_executed_id)
  WHERE source_lane = 'AS_EXECUTED_SIGNAL'
    AND trust_level = 'INTERIM_SUPPORTED'
    AND customer_visible_value = false;
