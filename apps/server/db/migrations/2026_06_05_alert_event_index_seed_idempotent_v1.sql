-- apps/server/db/migrations/2026_06_05_alert_event_index_seed_idempotent_v1.sql
-- Purpose: preserve alert_event_index_v1 primary-key semantics while allowing controlled full-review seed re-apply to skip already-written alert rows idempotently.

CREATE OR REPLACE FUNCTION alert_event_index_v1_seed_reinsert_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.event_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM alert_event_index_v1
       WHERE tenant_id = NEW.tenant_id
         AND event_id = NEW.event_id
     ) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.alert_event_index_v1') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_alert_event_index_v1_seed_reinsert_guard
      ON alert_event_index_v1;

    CREATE TRIGGER trg_alert_event_index_v1_seed_reinsert_guard
      BEFORE INSERT ON alert_event_index_v1
      FOR EACH ROW
      EXECUTE FUNCTION alert_event_index_v1_seed_reinsert_guard();
  END IF;
END $$;
