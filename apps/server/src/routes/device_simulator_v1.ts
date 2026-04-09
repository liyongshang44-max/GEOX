import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0";
import { ingestTelemetryV1 } from "../services/telemetry_ingest_service_v1";

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

const runners = new Map<string, SimulatorRunner>(); // Process-level singleton: one runner per tenant+device.

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

async function ensureDeviceExists(pool: Pool, tenant_id: string, device_id: string): Promise<boolean> {
  const found = await pool.query(
    `SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`,
    [tenant_id, device_id]
  );
  return (found.rows ?? []).length > 0;
}

async function writeTelemetryTick(pool: Pool, runner: SimulatorRunner): Promise<void> {
  const ts_ms = Date.now();
  const metric = "sim_runner_alive";
  const value_num = 1;
  await ingestTelemetryV1(
    pool,
    {
      tenant_id: runner.tenant_id,
      device_id: runner.device_id,
      metric,
      value: value_num,
      unit: "unitless",
      ts_ms,
    },
    {
      source: "device_simulator_v1",
      quality_flags: ["OK"],
      confidence: 1,
    }
  );
  runner.last_tick_ts_ms = ts_ms;
  runner.seq += 1;
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
    const validated = await withValidatedDevice(req, reply, pool, { source: "path" });
    if (!validated) return;

    const { auth, device_id, key } = validated;
    const existing = runners.get(key);
    if (!existing) {
      return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, key, running: false, already_stopped: true });
    }

    clearInterval(existing.handle);
    runners.delete(key);
    return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, key, running: false, already_stopped: false });
  });

  app.get("/api/v1/devices/:id/simulator/status", async (req, reply) => {
    const validated = await withValidatedDevice(req, reply, pool, { source: "path" });
    if (!validated) return;

    const { auth, device_id, key } = validated;
    const existing = runners.get(key);
    if (!existing) return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, key, running: false });

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
    const validated = await withValidatedDevice(req, reply, pool, { source: "query" });
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
