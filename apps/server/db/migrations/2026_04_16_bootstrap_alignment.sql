CREATE TABLE IF NOT EXISTS raw_samples (
  sample_id text PRIMARY KEY,
  sensor_id text NOT NULL,
  ts_ms bigint NOT NULL,
  metric text NOT NULL,
  value double precision NOT NULL,
  qc_quality text NOT NULL DEFAULT 'unknown',
  source text NOT NULL DEFAULT 'device',
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_samples_sensor_ts ON raw_samples (sensor_id, ts_ms DESC);
CREATE INDEX IF NOT EXISTS idx_raw_samples_metric_ts ON raw_samples (metric, ts_ms DESC);

CREATE TABLE IF NOT EXISTS markers (
  marker_id text PRIMARY KEY,
  sensor_id text,
  group_id text,
  kind text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_markers_group_occurred ON markers (group_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_markers_sensor_occurred ON markers (sensor_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS sensor_groups (
  group_id text PRIMARY KEY,
  project_id text NOT NULL,
  plot_id text,
  block_id text,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_sensor_groups_project_id ON sensor_groups (project_id);

CREATE TABLE IF NOT EXISTS sensor_group_members (
  group_id text NOT NULL,
  sensor_id text NOT NULL,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  PRIMARY KEY (group_id, sensor_id)
);

CREATE INDEX IF NOT EXISTS idx_sensor_group_members_sensor_id ON sensor_group_members (sensor_id);

CREATE OR REPLACE VIEW facts_replay_v1 AS
SELECT
  fact_id,
  occurred_at,
  source,
  record_json,
  record_json::jsonb ->> 'type' AS fact_type,
  record_json::jsonb -> 'entity' ->> 'sensor_id' AS sensor_id,
  record_json::jsonb -> 'entity' ->> 'group_id' AS group_id,
  record_json::jsonb -> 'entity' ->> 'project_id' AS project_id,
  record_json::jsonb -> 'payload' ->> 'metric' AS metric
FROM facts;
