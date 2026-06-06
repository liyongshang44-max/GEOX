-- apps/server/db/migrations/2026_06_05_device_observation_fact_id_idempotent_v1.sql
-- Purpose: preserve the unique fact_id contract while allowing controlled seed re-apply to skip already-written observation facts idempotently.

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
