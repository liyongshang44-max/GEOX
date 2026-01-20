-- 005: View facts_replay_v1
-- Purpose: stable, replay-friendly projection from the append-only facts ledger.
-- Consumers: AppleIReader (Judge) and PgStore (Server).

CREATE OR REPLACE VIEW facts_replay_v1 AS
SELECT
  f.fact_id,
  f.occurred_at,
  (f.record_json::jsonb ->> 'type') AS type,
  (f.record_json::jsonb #>> '{entity,spatial_unit_id}') AS spatial_unit_id,
  (f.record_json::jsonb #>> '{entity,group_id}') AS group_id,
  (f.record_json::jsonb #>> '{entity,sensor_id}') AS sensor_id,
  f.record_json
FROM facts f;

CREATE INDEX IF NOT EXISTS idx_facts_occurred_at
  ON facts (occurred_at);
