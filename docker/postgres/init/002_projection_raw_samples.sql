-- 002: Projection table raw_samples
-- Derived rows keyed by fact_id. Used by /api/series and frozen Judge acceptance.

CREATE TABLE IF NOT EXISTS raw_samples (
  fact_id     text PRIMARY KEY,
  sensor_id   text NOT NULL,
  metric      text NOT NULL,
  ts_ms       bigint NOT NULL,
  occurred_at timestamptz NOT NULL,
  value       double precision NOT NULL,
  quality     text NOT NULL,
  CONSTRAINT raw_samples_fact_fk
    FOREIGN KEY (fact_id) REFERENCES facts (fact_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_raw_samples_sensor_ts
  ON raw_samples (sensor_id, ts_ms);

CREATE INDEX IF NOT EXISTS idx_raw_samples_sensor_metric_ts
  ON raw_samples (sensor_id, metric, ts_ms);

CREATE INDEX IF NOT EXISTS idx_raw_samples_metric_ts
  ON raw_samples (metric, ts_ms);

CREATE OR REPLACE FUNCTION raw_samples_append_only_guard()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'raw_samples is append-only: UPDATE/DELETE forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS raw_samples_no_update ON raw_samples;
CREATE TRIGGER raw_samples_no_update
BEFORE UPDATE ON raw_samples
FOR EACH ROW EXECUTE FUNCTION raw_samples_append_only_guard();

DROP TRIGGER IF EXISTS raw_samples_no_delete ON raw_samples;
CREATE TRIGGER raw_samples_no_delete
BEFORE DELETE ON raw_samples
FOR EACH ROW EXECUTE FUNCTION raw_samples_append_only_guard();
