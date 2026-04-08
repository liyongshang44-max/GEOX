import crypto from "node:crypto";

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0";

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

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function parseIntervalMs(raw: any): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 5000;
  const clamped = Math.floor(n);
  return Math.max(1000, Math.min(clamped, 60000));
}

async function writeTelemetryTick(pool: Pool, runner: SimulatorRunner): Promise<void> {
  const ts_ms = Date.now();
  const metric = "sim_runner_alive";
  const value_num = 1;
  const telemetry_id = sha256Hex(`${runner.tenant_id}|${runner.device_id}|${metric}|${ts_ms}`);
  const fact_id = `raw_${telemetry_id}`;
  const occurred_at = new Date(ts_ms).toISOString();
  const payload = {
    telemetry_id,
    metric,
    value: value_num,
    ts_ms,
    source: "simulator_runner_v1",
    seq: runner.seq,
  };
  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2, 'simulator_runner_v1', $3)
     ON CONFLICT (fact_id) DO NOTHING`,
    [fact_id, occurred_at, JSON.stringify({ type: "raw_telemetry_v1", schema_version: 1, occurred_at, entity: { tenant_id: runner.tenant_id, device_id: runner.device_id }, payload })]
  );
  await pool.query(
    `INSERT INTO telemetry_index_v1 (tenant_id, device_id, metric, ts, value_num, value_text, fact_id)
     VALUES ($1, $2, $3, $4::timestamptz, $5, NULL, $6)
     ON CONFLICT (tenant_id, device_id, metric, ts) DO NOTHING`,
    [runner.tenant_id, runner.device_id, metric, occurred_at, value_num, fact_id]
  );
  await pool.query(
    `INSERT INTO device_status_index_v1 (tenant_id, device_id, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms)
     VALUES ($1, $2, $3, NULL, NULL, NULL, NULL, $4)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET
       last_telemetry_ts_ms = GREATEST(COALESCE(device_status_index_v1.last_telemetry_ts_ms, 0), EXCLUDED.last_telemetry_ts_ms),
       updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [runner.tenant_id, runner.device_id, ts_ms, ts_ms]
  );
  runner.last_tick_ts_ms = ts_ms;
  runner.seq += 1;
}

export function registerSimulatorRunnerV1Routes(app: FastifyInstance, pool: Pool): void {
  // Single implementation policy: runtime state + telemetry generation live only in backend simulator runner.
  // Frontend is restricted to start/stop/status API calls and must never synthesize telemetry locally.
  app.post("/api/v1/simulator-runner/start", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.read");
    if (!auth) return;

    const body = (req.body ?? {}) as any;
    const device_id = isNonEmptyString(body.device_id) ? String(body.device_id).trim() : "";
    if (!device_id) return reply.status(400).send({ ok: false, error: "MISSING:device_id" });

    const tenant_id = auth.tenant_id;
    const key = `${tenant_id}::${device_id}`; // Runtime lock key: one active instance per tenant+device.
    const existing = runners.get(key);
    if (existing) {
      return reply.send({ ok: true, tenant_id, device_id, key, already_running: true, started_ts_ms: existing.started_ts_ms, interval_ms: existing.interval_ms, last_tick_ts_ms: existing.last_tick_ts_ms });
    }

    const interval_ms = parseIntervalMs(body.interval_ms);
    const runner: SimulatorRunner = {
      key,
      tenant_id,
      device_id,
      started_ts_ms: Date.now(),
      interval_ms,
      handle: setInterval(() => {
        void writeTelemetryTick(pool, runner).catch((err) => {
          req.log.error({ err, tenant_id, device_id }, "simulator_runner_tick_failed");
        });
      }, interval_ms),
      seq: 0,
      last_tick_ts_ms: null,
    };

    await writeTelemetryTick(pool, runner);
    runners.set(key, runner);

    return reply.send({ ok: true, tenant_id, device_id, key, already_running: false, started_ts_ms: runner.started_ts_ms, interval_ms: runner.interval_ms, last_tick_ts_ms: runner.last_tick_ts_ms });
  });

  app.post("/api/v1/simulator-runner/stop", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.read");
    if (!auth) return;

    const body = (req.body ?? {}) as any;
    const device_id = isNonEmptyString(body.device_id) ? String(body.device_id).trim() : "";
    if (!device_id) return reply.status(400).send({ ok: false, error: "MISSING:device_id" });

    const key = `${auth.tenant_id}::${device_id}`;
    const existing = runners.get(key);
    if (!existing) return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, key, stopped: false, reason: "NOT_RUNNING" });

    clearInterval(existing.handle);
    runners.delete(key);
    return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, key, stopped: true });
  });

  app.get("/api/v1/simulator-runner/status", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.read");
    if (!auth) return;

    const q = (req.query ?? {}) as any;
    const device_id = isNonEmptyString(q.device_id) ? String(q.device_id).trim() : "";
    if (!device_id) return reply.status(400).send({ ok: false, error: "MISSING:device_id" });

    const key = `${auth.tenant_id}::${device_id}`;
    const existing = runners.get(key);
    if (!existing) {
      return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, key, running: false });
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

  app.addHook("onClose", async () => {
    for (const runner of runners.values()) clearInterval(runner.handle);
    runners.clear();
  });
}
