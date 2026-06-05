-- apps/server/db/migrations/2026_06_05_device_observation_fact_id_idempotent_v1.sql
-- Purpose: preserve the unique fact_id contract while allowing controlled seed re-apply to refresh the same observation fact idempotently.

CREATE OR REPLACE FUNCTION device_observation_index_v1_fact_id_upsert_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.fact_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM device_observation_index_v1
       WHERE fact_id = NEW.fact_id
     ) THEN
    UPDATE device_observation_index_v1
       SET tenant_id = NEW.tenant_id,
           project_id = NEW.project_id,
           group_id = NEW.group_id,
           device_id = NEW.device_id,
           field_id = NEW.field_id,
           metric = NEW.metric,
           metric_label = NEW.metric_label,
           metric_role = NEW.metric_role,
           diagnostic_use = NEW.diagnostic_use,
           threshold_ref = NEW.threshold_ref,
           ts = NEW.ts,
           observed_at = NEW.observed_at,
           observed_at_ts_ms = NEW.observed_at_ts_ms,
           value_num = NEW.value_num,
           value_text = NEW.value_text,
           unit = NEW.unit,
           confidence = NEW.confidence,
           quality_flags_json = NEW.quality_flags_json
     WHERE fact_id = NEW.fact_id;

    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.device_observation_index_v1') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_device_observation_index_v1_fact_id_upsert_guard
      ON device_observation_index_v1;

    CREATE TRIGGER trg_device_observation_index_v1_fact_id_upsert_guard
      BEFORE INSERT ON device_observation_index_v1
      FOR EACH ROW
      EXECUTE FUNCTION device_observation_index_v1_fact_id_upsert_guard();
  END IF;
END $$;
