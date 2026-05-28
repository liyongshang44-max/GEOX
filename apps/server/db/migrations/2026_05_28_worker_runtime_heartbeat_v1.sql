CREATE TABLE IF NOT EXISTS worker_runtime_heartbeat_v1 (
  worker_type TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  runtime_instance_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL,
  heartbeat_count BIGINT NOT NULL DEFAULT 0,
  last_tick_status TEXT,
  last_error TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (worker_type, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_worker_runtime_heartbeat_v1_last_heartbeat_at
  ON worker_runtime_heartbeat_v1(last_heartbeat_at);

CREATE INDEX IF NOT EXISTS idx_worker_runtime_heartbeat_v1_worker_type
  ON worker_runtime_heartbeat_v1(worker_type);
