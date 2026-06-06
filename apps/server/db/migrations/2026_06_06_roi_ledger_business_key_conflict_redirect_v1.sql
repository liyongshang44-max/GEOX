-- apps/server/db/migrations/2026_06_06_roi_ledger_business_key_conflict_redirect_v1.sql
-- Purpose: keep legacy seed callers that use ON CONFLICT (roi_ledger_id) idempotent after adding the formal ROI business-key unique index.

CREATE OR REPLACE FUNCTION roi_ledger_v1_redirect_business_key_conflict_v1()
RETURNS trigger AS $$
DECLARE
  existing_roi_ledger_id text;
BEGIN
  SELECT roi_ledger_id
    INTO existing_roi_ledger_id
    FROM roi_ledger_v1
   WHERE tenant_id = NEW.tenant_id
     AND project_id = NEW.project_id
     AND group_id = NEW.group_id
     AND as_executed_id = NEW.as_executed_id
     AND roi_type = NEW.roi_type
     AND source_lane = NEW.source_lane
