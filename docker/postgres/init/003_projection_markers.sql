-- 003: Projection table markers
-- Derived rows keyed by fact_id. Used by UI timeline and acceptance diagnostics.

CREATE TABLE IF NOT EXISTS markers (
  fact_id     text PRIMARY KEY,
  sensor_id   text NOT NULL,
  metric      text NOT NULL,
  ts_ms       bigint NOT NULL,
  start_ts_ms bigint NOT NULL,
  end_ts_ms   bigint NOT NULL,
  kind        text NOT NULL,
  source      text NOT NULL,
  note        text NOT NULL,
  CONSTRAINT markers_fact_fk
    FOREIGN KEY (fact_id) REFERENCES facts (fact_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_markers_sensor_ts
  ON markers (sensor_id, ts_ms);

CREATE INDEX IF NOT EXISTS idx_markers_kind_ts
  ON markers (kind, ts_ms);

CREATE OR REPLACE FUNCTION markers_append_only_guard()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'markers is append-only: UPDATE/DELETE forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS markers_no_update ON markers;
CREATE TRIGGER markers_no_update
BEFORE UPDATE ON markers
FOR EACH ROW EXECUTE FUNCTION markers_append_only_guard();

DROP TRIGGER IF EXISTS markers_no_delete ON markers;
CREATE TRIGGER markers_no_delete
BEFORE DELETE ON markers
FOR EACH ROW EXECUTE FUNCTION markers_append_only_guard();
