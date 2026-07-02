-- apps/server/db/migrations/2026_06_28_tk9_source_index_and_decision_stage_hotfix_v1.sql
-- Purpose: provide TK9 compatibility for legacy source-index schemas and persisted decision-cycle stage semantics.
-- Boundary: this migration only adds compatibility columns/backfills and a local decision_cycle_v1 stage-normalization trigger; it does not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, ROI entries, Field Memory entries, or model updates.

-- Add project/group compatibility columns to field_index_v1 for source-index joins used by Twin Kernel snapshot construction.
ALTER TABLE field_index_v1 ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE field_index_v1 ADD COLUMN IF NOT EXISTS group_id text;

-- Backfill field_index_v1 scope columns from source indexes that already carry project_id/group_id.
WITH source_scope AS (
  SELECT DISTINCT ON (tenant_id, field_id)
    tenant_id,
    field_id,
    project_id,
    group_id
  FROM (
    SELECT tenant_id, field_id, project_id, group_id FROM water_state_estimate_index_v1
    UNION ALL
    SELECT tenant_id, field_id, project_id, group_id FROM soil_moisture_sensing_window_index_v1
    UNION ALL
    SELECT tenant_id, field_id, project_id, group_id FROM weather_forecast_index_v1
  ) s
  WHERE project_id IS NOT NULL
    AND group_id IS NOT NULL
  ORDER BY tenant_id, field_id, project_id, group_id
)
UPDATE field_index_v1 f
SET
  project_id = COALESCE(f.project_id, source_scope.project_id),
  group_id = COALESCE(f.group_id, source_scope.group_id)
FROM source_scope
WHERE f.tenant_id = source_scope.tenant_id
  AND f.field_id = source_scope.field_id
  AND (f.project_id IS NULL OR f.group_id IS NULL);

-- Add water-state compatibility aliases used by current Twin Kernel snapshot route/builder.
ALTER TABLE water_state_estimate_index_v1 ADD COLUMN IF NOT EXISTS computed_at timestamptz;
ALTER TABLE water_state_estimate_index_v1 ADD COLUMN IF NOT EXISTS soil_moisture_percent double precision;

-- Backfill computed_at from existing source-index timestamps.
UPDATE water_state_estimate_index_v1
SET computed_at = COALESCE(computed_at, updated_at, created_at)
WHERE computed_at IS NULL;

-- Backfill soil_moisture_percent from existing root-zone estimate value.
UPDATE water_state_estimate_index_v1
SET soil_moisture_percent = COALESCE(soil_moisture_percent, root_zone_soil_moisture_percent)
WHERE soil_moisture_percent IS NULL;

-- Normalize decision_cycle_v1.current_stage as the last contiguous completed stage.
-- This prevents current_stage from claiming ROI_FORMALIZED when roi_entry_id is null.
CREATE OR REPLACE FUNCTION tk9_normalize_decision_cycle_current_stage_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  stage_item jsonb;
  stage_name text;
  stage_complete boolean;
  last_contiguous_complete text := 'NOT_STARTED';
BEGIN
  IF NEW.state_machine_json IS NULL THEN
    RETURN NEW;
  END IF;

  FOR stage_item IN SELECT value FROM jsonb_array_elements(NEW.state_machine_json)
  LOOP
    stage_name := COALESCE(stage_item->>'stage', '');
    stage_complete := COALESCE((stage_item->>'complete')::boolean, false);

    IF stage_complete IS NOT TRUE THEN
      NEW.current_stage := last_contiguous_complete;
      RETURN NEW;
    END IF;

    last_contiguous_complete := stage_name;
  END LOOP;

  NEW.current_stage := 'CALIBRATED';
  RETURN NEW;
END;
$$;

-- CI/runtime compatibility guard: the TK9 stage-normalization hook is only applicable when decision_cycle_v1 exists in the active migration set.
DO $tk9_decision_cycle_guard$
BEGIN
  IF to_regclass('public.decision_cycle_v1') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tk9_decision_cycle_current_stage_normalize_v1 ON decision_cycle_v1;

    CREATE TRIGGER tk9_decision_cycle_current_stage_normalize_v1
    BEFORE INSERT OR UPDATE OF current_stage, state_machine_json ON decision_cycle_v1
    FOR EACH ROW
    EXECUTE FUNCTION tk9_normalize_decision_cycle_current_stage_v1();

    UPDATE decision_cycle_v1
    SET current_stage = current_stage
    WHERE state_machine_json IS NOT NULL;
  END IF;
END;
$tk9_decision_cycle_guard$;
