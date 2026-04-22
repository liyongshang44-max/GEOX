import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0.js";
import { ingestTelemetryV1 } from "../services/telemetry_ingest_service_v1.js";

type SimulatorRunner = {
  key: string;
  tenant_id: string;
  device_id: string;
  started_ts_ms: number;
  interval_ms: number;
  handle: NodeJS.Timeout;
  seq: number;
  last_tick_ts_ms: number | null;
};

type DeviceSimulatorStateRow = {
  tenant_id: string;
  device_id: string;
  status: "running" | "stopped" | "error";
  started_ts_ms: number | null;
  stopped_ts_ms: number | null;
  interval_ms: number;
  last_tick_ts_ms: number | null;
  last_error: string | null;
  updated_ts_ms: number;
};

const runners = new Map<string, SimulatorRunner>(); // Process-level singleton: one runner per tenant+device.
let ensureDeviceSimulatorIndexPromise: Promise<void> | null = null;

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeDeviceId(v: any): string {
  return isNonEmptyString(v) ? String(v).trim() : "";
}

function parseIntervalMs(raw: any): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 5000;
  const clamped = Math.floor(n);
  return Math.max(1000, Math.min(clamped, 60000));
}

async function ensureDeviceSimulatorIndexRuntime(pool: Pool): Promise<void> {
  if (!ensureDeviceSimulatorIndexPromise) {
    ensureDeviceSimulatorIndexPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS device_simulator_index_v1 (
          tenant_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('running','stopped','error')),
          started_ts_ms BIGINT NULL,
          stopped_ts_ms BIGINT NULL,
          interval_ms INTEGER NOT NULL,
          last_tick_ts_ms BIGINT NULL,
          last_error TEXT NULL,
          updated_ts_ms BIGINT NOT NULL,
          PRIMARY KEY (tenant_id, device_id)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS device_simulator_index_status_idx ON device_simulator_index_v1 (tenant_id, status, updated_ts_ms DESC)`);
    })().catch((err) => {
      ensureDeviceSimulatorIndexPromise = null;
      throw err;
    });
  }
  await ensureDeviceSimulatorIndexPromise;
}

async function upsertDeviceSimulatorState(pool: Pool, state: DeviceSimulatorStateRow): Promise<void> {
  await pool.query(
    `INSERT INTO device_simulator_index_v1 (
      tenant_id, device_id, status, started_ts_ms, stopped_ts_ms, interval_ms, last_tick_ts_ms, last_error, updated_ts_ms
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (tenant_id, device_id) DO UPDATE SET
      status = EXCLUDED.status,
      started_ts_ms = EXCLUDED.started_ts_ms,
      stopped_ts_ms = EXCLUDED.stopped_ts_ms,
      interval_ms = EXCLUDED.interval_ms,
      last_tick_ts_ms = EXCLUDED.last_tick_ts_ms,
      last_error = EXCLUDED.last_error,
      updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [
      state.tenant_id,
      state.device_id,
      state.status,
      state.started_ts_ms,
      state.stopped_ts_ms,
      state.interval_ms,
      state.last_tick_ts_ms,
      state.last_error,
      state.updated_ts_ms,
    ]
  );
}

async function readDeviceSimulatorState(pool: Pool, tenant_id: string, device_id: string): Promise<DeviceSimulatorStateRow | null> {
  const q = await pool.query(
    `SELECT tenant_id, device_id, status, started_ts_ms, stopped_ts_ms, interval_ms, last_tick_ts_ms, last_error, updated_ts_ms
       FROM device_simulator_index_v1
      WHERE tenant_id = $1 AND device_id = $2
      LIMIT 1`,
    [tenant_id, device_id]
  );
  if (!q.rows[0]) return null;
  const row: any = q.rows[0];
  return {
    tenant_id: String(row.tenant_id),
    device_id: String(row.device_id),
    status: String(row.status) as DeviceSimulatorStateRow["status"],
    started_ts_ms: row.started_ts_ms == null ? null : Number(row.started_ts_ms),
    stopped_ts_ms: row.stopped_ts_ms == null ? null : Number(row.stopped_ts_ms),
    interval_ms: Number(row.interval_ms ?? 5000),
    last_tick_ts_ms: row.last_tick_ts_ms == null ? null : Number(row.last_tick_ts_ms),
    last_error: row.last_error == null ? null : String(row.last_error),
    updated_ts_ms: Number(row.updated_ts_ms ?? 0),
  };
}

async function ensureDeviceExists(pool: Pool, tenant_id: string, device_id: string): Promise<boolean> {
  const found = await pool.query(
    `SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`,
    [tenant_id, device_id]
  );
  return (found.rows ?? []).length > 0;
}

async function writeTelemetryTick(pool: Pool, runner: SimulatorRunner): Promise<void> {
  const ts_ms = Date.now();
  const cycle = (2 * Math.PI * runner.seq) / 144; // ~12 minutes at 5s interval.
  const tempBase = 24;
  const air_temperature = Number((tempBase + 1.4 * Math.sin(cycle) + 0.4 * Math.sin(cycle / 3)).toFixed(2));
  const air_humidity = Number((58 - 0.45 * (air_temperature - tempBase) + 1.2 * Math.sin(cycle / 2 + Math.PI / 6)).toFixed(2));
  const soil_moisture = Number((41 + 3.5 * Math.sin(cycle / 6 + Math.PI / 5) + 0.08 * runner.seq).toFixed(2));

  const telemetryPoints = [
    { metric: "sim_runner_alive", value: 1, unit: "unitless" },
    { metric: "air_temperature", value: air_temperature, unit: "celsius" },
    { metric: "air_humidity", value: air_humidity, unit: "percent" },
    { metric: "soil_moisture", value: soil_moisture, unit: "percent" },
  ] as const;

  for (const point of telemetryPoints) {
    await ingestTelemetryV1(
      pool,
      {
        tenant_id: runner.tenant_id,
        device_id: runner.device_id,
        metric: point.metric,
        value: point.value,
        unit: point.unit,
        ts_ms,
      },
      {
        source: "device_simulator_v1",
        quality_flags: ["OK"],
        confidence: 1,
      }
    );
  }

  runner.last_tick_ts_ms = ts_ms;
  runner.seq += 1;
  await upsertDeviceSimulatorState(pool, {
    tenant_id: runner.tenant_id,
    device_id: runner.device_id,
    status: "running",
    started_ts_ms: runner.started_ts_ms,
    stopped_ts_ms: null,
    interval_ms: runner.interval_ms,
    last_tick_ts_ms: runner.last_tick_ts_ms,
    last_error: null,
    updated_ts_ms: ts_ms,
  });
}

async function withValidatedDevice(
  req: any,
  reply: any,
  pool: Pool,
  opts: { source: "path" | "body" | "query" }
): Promise<{ auth: AoActAuthContextV0; device_id: string; key: string } | null> {
  const auth = requireAoActScopeV0(req, reply, "telemetry.read");
  if (!auth) return null;

  const source = opts.source;
  const rawDeviceId =
    source === "path"
      ? req.params?.id
      : source === "body"
      ? req.body?.device_id
      : req.query?.device_id;
  const device_id = normalizeDeviceId(rawDeviceId);
  if (!device_id) return reply.status(400).send({ ok: false, error: "MISSING:device_id" });

  const exists = await ensureDeviceExists(pool, auth.tenant_id, device_id);
  if (!exists) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

  const key = `${auth.tenant_id}::${device_id}`;
  return { auth, device_id, key };
}

export function registerDeviceSimulatorV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/devices/:id/simulator/start", async (req, reply) => {
    await ensureDeviceSimulatorIndexRuntime(pool);
    const validated = await withValidatedDevice(req, reply, pool, { source: "path" });
    if (!validated) return;

    const { auth, device_id, key } = validated;
    const existing = runners.get(key);
    if (existing) {
      return reply.send({
        ok: true,
        tenant_id: auth.tenant_id,
        device_id,
        key,
        running: true,
        already_running: true,
        started_ts_ms: existing.started_ts_ms,
        interval_ms: existing.interval_ms,
        last_tick_ts_ms: existing.last_tick_ts_ms,
      });
    }

    const interval_ms = parseIntervalMs((req.body ?? ({} as any)).interval_ms);
    const runner: SimulatorRunner = {
      key,
      tenant_id: auth.tenant_id,
      device_id,
      started_ts_ms: Date.now(),
      interval_ms,
      handle: setInterval(() => {
        void writeTelemetryTick(pool, runner).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          void upsertDeviceSimulatorState(pool, {
            tenant_id: auth.tenant_id,
            device_id,
            status: "error",
            started_ts_ms: runner.started_ts_ms,
            stopped_ts_ms: Date.now(),
            interval_ms: runner.interval_ms,
            last_tick_ts_ms: runner.last_tick_ts_ms,
            last_error: message,
            updated_ts_ms: Date.now(),
          }).catch(() => void 0);
          req.log.error({ err, tenant_id: auth.tenant_id, device_id }, "device_simulator_tick_failed");
        });
      }, interval_ms),
      seq: 0,
      last_tick_ts_ms: null,
    };

    await writeTelemetryTick(pool, runner);
    runners.set(key, runner);

    return reply.send({
      ok: true,
      tenant_id: auth.tenant_id,
      device_id,
      key,
      running: true,
      already_running: false,
      started_ts_ms: runner.started_ts_ms,
      interval_ms: runner.interval_ms,
      last_tick_ts_ms: runner.last_tick_ts_ms,
    });
  });

  app.post("/api/v1/devices/:id/simulator/stop", async (req, reply) => {
    await ensureDeviceSimulatorIndexRuntime(pool);
    const validated = await withValidatedDevice(req, reply, pool, { source: "path" });
    if (!validated) return;

    const { auth, device_id, key } = validated;
    const existing = runners.get(key);
    if (!existing) {
      return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, key, running: false, already_stopped: true });
    }

    clearInterval(existing.handle);
    runners.delete(key);
    await upsertDeviceSimulatorState(pool, {
      tenant_id: auth.tenant_id,
      device_id,
      status: "stopped",
      started_ts_ms: existing.started_ts_ms,
      stopped_ts_ms: Date.now(),
      interval_ms: existing.interval_ms,
      last_tick_ts_ms: existing.last_tick_ts_ms,
      last_error: null,
      updated_ts_ms: Date.now(),
    });
    return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, key, running: false, already_stopped: false });
  });

  app.get("/api/v1/devices/:id/simulator/status", async (req, reply) => {
    await ensureDeviceSimulatorIndexRuntime(pool);
    const validated = await withValidatedDevice(req, reply, pool, { source: "path" });
    if (!validated) return;

    const { auth, device_id, key } = validated;
    const existing = runners.get(key);
    if (!existing) {
      const persisted = await readDeviceSimulatorState(pool, auth.tenant_id, device_id);
      if (!persisted) return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, key, running: false });
      return reply.send({
        ok: true,
        tenant_id: auth.tenant_id,
        device_id,
        key,
        running: persisted.status === "running",
        started_ts_ms: persisted.started_ts_ms,
        stopped_ts_ms: persisted.stopped_ts_ms,
        interval_ms: persisted.interval_ms,
        last_tick_ts_ms: persisted.last_tick_ts_ms,
        status: persisted.status,
        last_error: persisted.last_error,
        persisted: true,
      });
    }

    return reply.send({
      ok: true,
      tenant_id: auth.tenant_id,
      device_id,
      key,
      running: true,
      started_ts_ms: existing.started_ts_ms,
      interval_ms: existing.interval_ms,
      last_tick_ts_ms: existing.last_tick_ts_ms,
      seq: existing.seq,
    });
  });

  // Backward-compatibility routes. Keep for short-term migration; deprecated in favor of /api/v1/devices/:id/simulator/*.
  app.post("/api/v1/simulator-runner/start", async (req, reply) => {
    await ensureDeviceSimulatorIndexRuntime(pool);
    const validated = await withValidatedDevice(req, reply, pool, { source: "body" });
    if (!validated) return;

    const { auth, device_id, key } = validated;
    const existing = runners.get(key);
    if (existing) {
      return reply.send({
        ok: true,
        tenant_id: auth.tenant_id,
        device_id,
        key,
        running: true,
        already_running: true,
        deprecated: true,
        replacement: `/api/v1/devices/${encodeURIComponent(device_id)}/simulator/start`,
        started_ts_ms: existing.started_ts_ms,
        interval_ms: existing.interval_ms,
        last_tick_ts_ms: existing.last_tick_ts_ms,
      });
    }

    const interval_ms = parseIntervalMs((req.body ?? ({} as any)).interval_ms);
    const runner: SimulatorRunner = {
      key,
      tenant_id: auth.tenant_id,
      device_id,
      started_ts_ms: Date.now(),
      interval_ms,
      handle: setInterval(() => {
        void writeTelemetryTick(pool, runner).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          void upsertDeviceSimulatorState(pool, {
            tenant_id: auth.tenant_id,
            device_id,
            status: "error",
            started_ts_ms: runner.started_ts_ms,
            stopped_ts_ms: Date.now(),
            interval_ms: runner.interval_ms,
            last_tick_ts_ms: runner.last_tick_ts_ms,
            last_error: message,
            updated_ts_ms: Date.now(),
          }).catch(() => void 0);
          req.log.error({ err, tenant_id: auth.tenant_id, device_id }, "device_simulator_tick_failed_legacy");
        });
      }, interval_ms),
      seq: 0,
      last_tick_ts_ms: null,
    };

    await writeTelemetryTick(pool, runner);
    runners.set(key, runner);

    return reply.send({
      ok: true,
      tenant_id: auth.tenant_id,
      device_id,
      key,
      running: true,
      already_running: false,
      deprecated: true,
      replacement: `/api/v1/devices/${encodeURIComponent(device_id)}/simulator/start`,
      started_ts_ms: runner.started_ts_ms,
      interval_ms: runner.interval_ms,
      last_tick_ts_ms: runner.last_tick_ts_ms,
    });
  });

  app.post("/api/v1/simulator-runner/stop", async (req, reply) => {
    await ensureDeviceSimulatorIndexRuntime(pool);
    const validated = await withValidatedDevice(req, reply, pool, { source: "body" });
    if (!validated) return;

    const { auth, device_id, key } = validated;
    const existing = runners.get(key);
    if (!existing) {
      return reply.send({
        ok: true,
        tenant_id: auth.tenant_id,
        device_id,
        key,
        running: false,
        already_stopped: true,
        deprecated: true,
        replacement: `/api/v1/devices/${encodeURIComponent(device_id)}/simulator/stop`,
      });
    }

    clearInterval(existing.handle);
    runners.delete(key);
    await upsertDeviceSimulatorState(pool, {
      tenant_id: auth.tenant_id,
      device_id,
      status: "stopped",
      started_ts_ms: existing.started_ts_ms,
      stopped_ts_ms: Date.now(),
      interval_ms: existing.interval_ms,
      last_tick_ts_ms: existing.last_tick_ts_ms,
      last_error: null,
      updated_ts_ms: Date.now(),
    });
    return reply.send({
      ok: true,
      tenant_id: auth.tenant_id,
      device_id,
      key,
      running: false,
      already_stopped: false,
      deprecated: true,
      replacement: `/api/v1/devices/${encodeURIComponent(device_id)}/simulator/stop`,
    });
  });

  app.get("/api/v1/simulator-runner/status", async (req, reply) => {
    await ensureDeviceSimulatorIndexRuntime(pool);
    const validated = await withValidatedDevice(req, reply, pool, { source: "query" });
    if (!validated) return;

    const { auth, device_id, key } = validated;
    const existing = runners.get(key);
    if (!existing) {
      const persisted = await readDeviceSimulatorState(pool, auth.tenant_id, device_id);
      if (persisted) {
        return reply.send({
          ok: true,
          tenant_id: auth.tenant_id,
          device_id,
          key,
          running: persisted.status === "running",
          deprecated: true,
          replacement: `/api/v1/devices/${encodeURIComponent(device_id)}/simulator/status`,
          started_ts_ms: persisted.started_ts_ms,
          stopped_ts_ms: persisted.stopped_ts_ms,
          interval_ms: persisted.interval_ms,
          last_tick_ts_ms: persisted.last_tick_ts_ms,
          status: persisted.status,
          last_error: persisted.last_error,
          persisted: true,
        });
      }
      return reply.send({
        ok: true,
        tenant_id: auth.tenant_id,
        device_id,
        key,
        running: false,
        deprecated: true,
        replacement: `/api/v1/devices/${encodeURIComponent(device_id)}/simulator/status`,
      });
    }

    return reply.send({
      ok: true,
      tenant_id: auth.tenant_id,
      device_id,
      key,
      running: true,
      deprecated: true,
      replacement: `/api/v1/devices/${encodeURIComponent(device_id)}/simulator/status`,
      started_ts_ms: existing.started_ts_ms,
      interval_ms: existing.interval_ms,
      last_tick_ts_ms: existing.last_tick_ts_ms,
      seq: existing.seq,
    });
  });

  app.addHook("onClose", async () => {
    for (const runner of runners.values()) clearInterval(runner.handle);
    runners.clear();
  });
}
