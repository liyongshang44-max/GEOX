import os from "node:os";
import type { Pool } from "pg";

export type WorkerTypeV1 = "jobs" | "executor";
export type WorkerHeartbeatStatusV1 = "STARTED" | "RUNNING" | "OK" | "ERROR" | "STOPPING";
export type WorkerTickStatusV1 = "OK" | "ERROR" | "IDLE" | "CLAIMED_TASK" | "NO_TASK" | "AGENT_SCANNED";

export type WorkerHeartbeatInputV1 = {
  worker_type: WorkerTypeV1;
  worker_id: string;
  runtime_instance_id: string;
  status: WorkerHeartbeatStatusV1;
  started_at?: Date;
  last_tick_status?: WorkerTickStatusV1;
  last_error?: string | null;
  metadata_json?: Record<string, unknown>;
};

export function resolveWorkerIdV1(fallback = os.hostname()): string {
  return String(process.env.GEOX_WORKER_ID ?? fallback).trim() || fallback;
}

export function truncateWorkerErrorV1(error: unknown, max = 512): string | null {
  if (error == null) return null;
  const raw = error instanceof Error ? (error.stack ?? error.message) : String(error);
  const oneLine = raw.replace(/\s+/g, " ").trim();
  return oneLine ? oneLine.slice(0, max) : null;
}

export async function ensureWorkerRuntimeHeartbeatTableV1(pool: Pool): Promise<void> {
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

export async function recordWorkerRuntimeStartedV1(pool: Pool, input: WorkerHeartbeatInputV1): Promise<void> {
  await ensureWorkerRuntimeHeartbeatTableV1(pool);
  const startedAt = input.started_at ?? new Date();
  await pool.query(
    `INSERT INTO worker_runtime_heartbeat_v1 (
       worker_type, worker_id, runtime_instance_id, status, started_at, last_heartbeat_at,
       heartbeat_count, last_tick_status, last_error, metadata_json, updated_at
     ) VALUES ($1, $2, $3, $4, $5, now(), 1, $6, $7, $8::jsonb, now())
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
    [input.worker_type, input.worker_id, input.runtime_instance_id, input.status, startedAt, input.last_tick_status ?? "IDLE", input.last_error ?? null, JSON.stringify(input.metadata_json ?? {})]
  );
}

export async function recordWorkerRuntimeHeartbeatV1(pool: Pool, input: WorkerHeartbeatInputV1): Promise<void> {
  await ensureWorkerRuntimeHeartbeatTableV1(pool);
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
    [input.worker_type, input.worker_id, input.runtime_instance_id, input.status, input.last_tick_status ?? "OK", input.last_error ?? null, JSON.stringify(input.metadata_json ?? {})]
  );
}

export async function recordWorkerRuntimeErrorV1(pool: Pool, input: Omit<WorkerHeartbeatInputV1, "status"> & { error: unknown }): Promise<void> {
  await recordWorkerRuntimeHeartbeatV1(pool, {
    ...input,
    status: "ERROR",
    last_tick_status: "ERROR",
    last_error: truncateWorkerErrorV1(input.error),
  });
}

export async function readWorkerRuntimeHeartbeatV1(pool: Pool, workerType: WorkerTypeV1, workerId: string): Promise<Record<string, unknown> | null> {
  await ensureWorkerRuntimeHeartbeatTableV1(pool);
  const res = await pool.query(
    `SELECT worker_type, worker_id, runtime_instance_id, status, started_at, last_heartbeat_at,
            heartbeat_count, last_tick_status, last_error, metadata_json, updated_at
       FROM worker_runtime_heartbeat_v1
      WHERE worker_type = $1 AND worker_id = $2
      LIMIT 1`,
    [workerType, workerId]
  );
  return res.rows?.[0] ?? null;
}
