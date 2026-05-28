const os = require("node:os");
const { Pool } = require("pg");

function resolveWorkerId(fallback = os.hostname()) {
  return String(process.env.GEOX_WORKER_ID || fallback).trim() || fallback;
}

function createHeartbeatPool() {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED_FOR_WORKER_HEARTBEAT");
  return new Pool({ connectionString: databaseUrl });
}

function truncateWorkerError(error, max = 512) {
  if (error == null) return null;
  const raw = error instanceof Error ? (error.stack || error.message) : String(error);
  const oneLine = String(raw).replace(/\s+/g, " ").trim();
  return oneLine ? oneLine.slice(0, max) : null;
}

async function ensureWorkerRuntimeHeartbeatTable(pool) {
  await pool.query(`
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
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_worker_runtime_heartbeat_v1_last_heartbeat_at ON worker_runtime_heartbeat_v1(last_heartbeat_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_worker_runtime_heartbeat_v1_worker_type ON worker_runtime_heartbeat_v1(worker_type)`);
}

async function recordWorkerRuntimeStarted(pool, input) {
  await ensureWorkerRuntimeHeartbeatTable(pool);
  await pool.query(
    `INSERT INTO worker_runtime_heartbeat_v1 (
       worker_type, worker_id, runtime_instance_id, status, started_at, last_heartbeat_at,
       heartbeat_count, last_tick_status, last_error, metadata_json, updated_at
     ) VALUES ($1, $2, $3, $4, now(), now(), 1, $5, $6, $7::jsonb, now())
     ON CONFLICT (worker_type, worker_id) DO UPDATE SET
       runtime_instance_id = EXCLUDED.runtime_instance_id,
       status = EXCLUDED.status,
       started_at = EXCLUDED.started_at,
       last_heartbeat_at = EXCLUDED.last_heartbeat_at,
       heartbeat_count = 1,
       last_tick_status = EXCLUDED.last_tick_status,
       last_error = EXCLUDED.last_error,
       metadata_json = EXCLUDED.metadata_json,
       updated_at = now()`,
    [input.worker_type, input.worker_id, input.runtime_instance_id, input.status, input.last_tick_status || "IDLE", input.last_error || null, JSON.stringify(input.metadata_json || {})]
  );
}

async function recordWorkerRuntimeHeartbeat(pool, input) {
  await ensureWorkerRuntimeHeartbeatTable(pool);
  await pool.query(
    `INSERT INTO worker_runtime_heartbeat_v1 (
       worker_type, worker_id, runtime_instance_id, status, started_at, last_heartbeat_at,
       heartbeat_count, last_tick_status, last_error, metadata_json, updated_at
     ) VALUES ($1, $2, $3, $4, now(), now(), 1, $5, $6, $7::jsonb, now())
     ON CONFLICT (worker_type, worker_id) DO UPDATE SET
       runtime_instance_id = EXCLUDED.runtime_instance_id,
       status = EXCLUDED.status,
       last_heartbeat_at = now(),
       heartbeat_count = worker_runtime_heartbeat_v1.heartbeat_count + 1,
       last_tick_status = EXCLUDED.last_tick_status,
       last_error = EXCLUDED.last_error,
       metadata_json = worker_runtime_heartbeat_v1.metadata_json || EXCLUDED.metadata_json,
       updated_at = now()`,
    [input.worker_type, input.worker_id, input.runtime_instance_id, input.status, input.last_tick_status || "OK", input.last_error || null, JSON.stringify(input.metadata_json || {})]
  );
}

async function recordWorkerRuntimeError(pool, input) {
  await recordWorkerRuntimeHeartbeat(pool, {
    ...input,
    status: "ERROR",
    last_tick_status: "ERROR",
    last_error: truncateWorkerError(input.error),
  });
}

module.exports = {
  createHeartbeatPool,
  ensureWorkerRuntimeHeartbeatTable,
  recordWorkerRuntimeStarted,
  recordWorkerRuntimeHeartbeat,
  recordWorkerRuntimeError,
  resolveWorkerId,
  truncateWorkerError,
};
