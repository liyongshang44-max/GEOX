CREATE TABLE IF NOT EXISTS agronomy_rule_performance (
  rule_id text PRIMARY KEY,
  crop_code text NOT NULL DEFAULT 'unknown',
  crop_stage text NOT NULL DEFAULT 'unknown',
  total_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  partial_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  no_data_count integer NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  last_updated_at timestamp without time zone NOT NULL DEFAULT now()
);

ALTER TABLE agronomy_rule_performance
  ADD COLUMN IF NOT EXISTS crop_stage text NOT NULL DEFAULT 'unknown';

ALTER TABLE agronomy_rule_performance
  ADD COLUMN IF NOT EXISTS success_count integer NOT NULL DEFAULT 0;

ALTER TABLE agronomy_rule_performance
  ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0;

ALTER TABLE agronomy_rule_performance
  ADD COLUMN IF NOT EXISTS last_updated_at timestamp without time zone NOT NULL DEFAULT now();

DO $$
DECLARE
  has_effective_count boolean;
  has_ineffective_count boolean;
  has_updated_at boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agronomy_rule_performance'
      AND column_name = 'effective_count'
  ) INTO has_effective_count;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agronomy_rule_performance'
      AND column_name = 'ineffective_count'
  ) INTO has_ineffective_count;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agronomy_rule_performance'
      AND column_name = 'updated_at'
  ) INTO has_updated_at;

  IF has_effective_count AND has_ineffective_count AND has_updated_at THEN
    EXECUTE '
      UPDATE agronomy_rule_performance
      SET
        success_count = GREATEST(success_count, effective_count),
        failed_count = GREATEST(failed_count, ineffective_count),
        last_updated_at = COALESCE(last_updated_at, updated_at, now())
      WHERE
        success_count = 0
        OR failed_count = 0
        OR last_updated_at IS NULL
    ';
  ELSIF has_effective_count AND has_ineffective_count THEN
    EXECUTE '
      UPDATE agronomy_rule_performance
      SET
        success_count = GREATEST(success_count, effective_count),
        failed_count = GREATEST(failed_count, ineffective_count)
      WHERE
        success_count = 0
        OR failed_count = 0
    ';
  ELSIF has_updated_at THEN
    EXECUTE '
      UPDATE agronomy_rule_performance
      SET last_updated_at = COALESCE(last_updated_at, updated_at, now())
      WHERE last_updated_at IS NULL
    ';
  END IF;
END $$;
