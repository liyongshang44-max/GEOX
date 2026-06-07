-- path: apps/server/db/migrations/2026_06_04_decision_recommendation_summary_normalization_v1.sql
-- Ensure decision_recommendation_v1 facts expose payload.summary at insert time.
-- facts.record_json is TEXT in the current store, so all JSON operations must cast to jsonb.
-- Do not backfill existing facts here: facts are append-only and must not be updated by migration.

CREATE OR REPLACE FUNCTION normalize_decision_recommendation_summary_v1()
RETURNS trigger AS $$
DECLARE
  human text;
BEGIN
  IF NEW.record_json IS NOT NULL
     AND NEW.record_json::jsonb->>'type' = 'decision_recommendation_v1'
     AND NULLIF(BTRIM(COALESCE((NEW.record_json::jsonb)#>>'{payload,summary}', '')), '') IS NULL
     AND NULLIF(BTRIM(COALESCE((NEW.record_json::jsonb)#>>'{payload,explain,human}', '')), '') IS NOT NULL
  THEN
    human := BTRIM((NEW.record_json::jsonb)#>>'{payload,explain,human}');

    NEW.record_json := jsonb_set(
      NEW.record_json::jsonb,
      '{payload,summary}',
      to_jsonb(human),
      true
    )::text;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS facts_decision_recommendation_summary_normalize_v1 ON facts;
DROP TRIGGER IF EXISTS trg_normalize_decision_recommendation_summary_v1 ON facts;

CREATE TRIGGER trg_normalize_decision_recommendation_summary_v1
BEFORE INSERT ON facts
FOR EACH ROW
EXECUTE FUNCTION normalize_decision_recommendation_summary_v1();
