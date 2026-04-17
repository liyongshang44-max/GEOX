import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { ingestTelemetryV1 } from "../services/telemetry_ingest_service_v1.js";
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0.js";

type SimulatorRunner = {
  key: string;
  tenant_id: string;
  device_id: string;
  profile_code: string | null;
  started_ts_ms: number;
  interval_ms: number;
  handle: NodeJS.Timeout | null;
  seq: number;
  last_tick_ts_ms: number | null;
};

type SimulatorStateRow = {
  tenant_id: string;
  device_id: string;
  status: "running" | "stopped" | "error";
  profile_code: string | null;
  started_at_ts_ms: number | null;
  stopped_at_ts_ms: number | null;
  last_tick_ts_ms: number | null;
  last_error: string | null;
};

const runners = new Map<string, SimulatorRunner>(); // Process-level singleton: one runner per tenant+device.


function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function parseIntervalMs(raw: any): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 5000;
  const clamped = Math.floor(n);
  return Math.max(1000, Math.min(clamped, 60000));
}

function normalizeProfileCode(raw: any): string | null {
  if (!isNonEmptyString(raw)) return null;
  return String(raw).trim().slice(0, 128);
}

async function ensureSimulatorStateSchema(pool: Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS device_simulator_state_v1 (
      tenant_id text NOT NULL,
      device_id text NOT NULL,
      status text NOT NULL CHECK (status IN ('running','stopped','error')),
      profile_code text NULL,
      started_at_ts_ms bigint NULL,
      stopped_at_ts_ms bigint NULL,
      last_tick_ts_ms bigint NULL,
      last_error text NULL,
      PRIMARY KEY (tenant_id, device_id)
    )`
  );
}

async function upsertSimulatorState(pool: Pool, input: SimulatorStateRow): Promise<void> {
  await pool.query(
    `INSERT INTO device_simulator_state_v1 (
      tenant_id, device_id, status, profile_code,
      started_at_ts_ms, stopped_at_ts_ms, last_tick_ts_ms, last_error
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (tenant_id, device_id) DO UPDATE SET
      status = EXCLUDED.status,
      profile_code = EXCLUDED.profile_code,
      started_at_ts_ms = EXCLUDED.started_at_ts_ms,
      stopped_at_ts_ms = EXCLUDED.stopped_at_ts_ms,
      last_tick_ts_ms = EXCLUDED.last_tick_ts_ms,
      last_error = EXCLUDED.last_error`,
    [
      input.tenant_id,
      input.device_id,
      input.status,
      input.profile_code,
      input.started_at_ts_ms,
      input.stopped_at_ts_ms,
      input.last_tick_ts_ms,
      input.last_error,
    ]
  );
}

async function readSimulatorState(pool: Pool, tenant_id: string, device_id: string): Promise<SimulatorStateRow | null> {
  const r = await pool.query(
    `SELECT tenant_id, device_id, status, profile_code, started_at_ts_ms, stopped_at_ts_ms, last_tick_ts_ms, last_error
       FROM device_simulator_state_v1
      WHERE tenant_id = $1 AND device_id = $2`,
    [tenant_id, device_id]
  );
  if (!r.rows[0]) return null;
  return {
    tenant_id: String(r.rows[0].tenant_id),
    device_id: String(r.rows[0].device_id),
    status: String(r.rows[0].status) as SimulatorStateRow["status"],
    profile_code: r.rows[0].profile_code == null ? null : String(r.rows[0].profile_code),
    started_at_ts_ms: r.rows[0].started_at_ts_ms == null ? null : Number(r.rows[0].started_at_ts_ms),
    stopped_at_ts_ms: r.rows[0].stopped_at_ts_ms == null ? null : Number(r.rows[0].stopped_at_ts_ms),
    last_tick_ts_ms: r.rows[0].last_tick_ts_ms == null ? null : Number(r.rows[0].last_tick_ts_ms),
    last_error: r.rows[0].last_error == null ? null : String(r.rows[0].last_error),
  };
}

async function readLatestOutputTsMs(pool: Pool, tenant_id: string, device_id: string): Promise<number | null> {
  const r = await pool.query(
    `SELECT EXTRACT(EPOCH FROM MAX(ts)) * 1000 AS latest_ts_ms
       FROM telemetry_index_v1
      WHERE tenant_id = $1 AND device_id = $2`,
    [tenant_id, device_id]
  );
  const v = r.rows[0]?.latest_ts_ms;
  return v == null ? null : Number(v);
}

function startRunnerRuntime(pool: Pool, runner: SimulatorRunner, req: FastifyInstance["log"]): void {
  if (runner.handle) clearInterval(runner.handle);
  runner.handle = setInterval(() => {
    void writeTelemetryTick(pool, runner).catch(async (err) => {
      const message = err instanceof Error ? err.message : String(err);
      await upsertSimulatorState(pool, {
        tenant_id: runner.tenant_id,
        device_id: runner.device_id,
        status: "error",
        profile_code: runner.profile_code,
        started_at_ts_ms: runner.started_ts_ms,
        stopped_at_ts_ms: Date.now(),
        last_tick_ts_ms: runner.last_tick_ts_ms,
        last_error: message,
      });
      req.error({ err, tenant_id: runner.tenant_id, device_id: runner.device_id }, "simulator_runner_tick_failed");
    });
  }, runner.interval_ms);
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
      source: "simulator_runner_v1",
      quality_flags: ["OK"],
      confidence: 1,
    }
  );
  runner.last_tick_ts_ms = ts_ms;
  runner.seq += 1;
  await upsertSimulatorState(pool, {
    tenant_id: runner.tenant_id,
    device_id: runner.device_id,
    status: "running",
    profile_code: runner.profile_code,
    started_at_ts_ms: runner.started_ts_ms,
    stopped_at_ts_ms: null,
    last_tick_ts_ms: runner.last_tick_ts_ms,
    last_error: null,
  });
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
    const persisted = await readSimulatorState(pool, tenant_id, device_id);
    if (persisted?.status === "running") {
      const latest_output_ts_ms = await readLatestOutputTsMs(pool, tenant_id, device_id);
      return reply.send({
        ok: true,
        tenant_id,
        device_id,
        key,
        already_running: true,
        state: persisted,
        latest_output_ts_ms,
      });
    }

    const interval_ms = parseIntervalMs(body.interval_ms);
    const profile_code = normalizeProfileCode(body.profile_code);
    const started_ts_ms = Date.now();
    const runner: SimulatorRunner = {
      key,
      tenant_id,
      device_id,
      profile_code,
      started_ts_ms,
      interval_ms,
      handle: null,
      seq: 0,
      last_tick_ts_ms: null,
    };
    startRunnerRuntime(pool, runner, req.log);
    await upsertSimulatorState(pool, {
      tenant_id,
      device_id,
      status: "running",
      profile_code,
      started_at_ts_ms: started_ts_ms,
      stopped_at_ts_ms: null,
      last_tick_ts_ms: null,
      last_error: null,
    });
    await writeTelemetryTick(pool, runner);
    runners.set(key, runner);
    const latest_output_ts_ms = await readLatestOutputTsMs(pool, tenant_id, device_id);
    return reply.send({ ok: true, tenant_id, device_id, key, already_running: false, state: await readSimulatorState(pool, tenant_id, device_id), latest_output_ts_ms });
  });

  app.post("/api/v1/simulator-runner/stop", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.read");
    if (!auth) return;

    const body = (req.body ?? {}) as any;
    const device_id = isNonEmptyString(body.device_id) ? String(body.device_id).trim() : "";
    if (!device_id) return reply.status(400).send({ ok: false, error: "MISSING:device_id" });

    const tenant_id = auth.tenant_id;
    const key = `${tenant_id}::${device_id}`;
    const existing = runners.get(key);
    if (existing) {
      if (existing.handle) clearInterval(existing.handle);
      runners.delete(key);
    }
    const persisted = await readSimulatorState(pool, tenant_id, device_id);
    const stopped_at_ts_ms = Date.now();
    await upsertSimulatorState(pool, {
      tenant_id,
      device_id,
      status: "stopped",
      profile_code: persisted?.profile_code ?? existing?.profile_code ?? null,
      started_at_ts_ms: persisted?.started_at_ts_ms ?? existing?.started_ts_ms ?? null,
      stopped_at_ts_ms,
      last_tick_ts_ms: persisted?.last_tick_ts_ms ?? existing?.last_tick_ts_ms ?? null,
      last_error: null,
    });
    const latest_output_ts_ms = await readLatestOutputTsMs(pool, tenant_id, device_id);
    return reply.send({ ok: true, tenant_id, device_id, key, stopped: true, state: await readSimulatorState(pool, tenant_id, device_id), latest_output_ts_ms });
  });

  app.get("/api/v1/simulator-runner/status", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.read");
    if (!auth) return;

    const q = (req.query ?? {}) as any;
    const device_id = isNonEmptyString(q.device_id) ? String(q.device_id).trim() : "";
    if (!device_id) return reply.status(400).send({ ok: false, error: "MISSING:device_id" });

    const tenant_id = auth.tenant_id;
    const key = `${tenant_id}::${device_id}`;
    const state = await readSimulatorState(pool, tenant_id, device_id);
    const latest_output_ts_ms = await readLatestOutputTsMs(pool, tenant_id, device_id);
    if (!state) return reply.send({ ok: true, tenant_id, device_id, key, running: false, latest_output_ts_ms });
    return reply.send({
      ok: true,
      tenant_id,
      device_id,
      key,
      running: state.status === "running",
      state,
      latest_output_ts_ms,
    });
  });

  app.addHook("onReady", async () => {
    await ensureSimulatorStateSchema(pool);
    const r = await pool.query(
      `SELECT tenant_id, device_id, profile_code, started_at_ts_ms, last_tick_ts_ms
         FROM device_simulator_state_v1
        WHERE status = 'running'`
    );
    for (const row of r.rows) {
      const tenant_id = String(row.tenant_id ?? "").trim();
      const device_id = String(row.device_id ?? "").trim();
      if (!tenant_id || !device_id) continue;
      const key = `${tenant_id}::${device_id}`;
      if (runners.has(key)) continue;
      const runner: SimulatorRunner = {
        key,
        tenant_id,
        device_id,
        profile_code: row.profile_code == null ? null : String(row.profile_code),
        started_ts_ms: row.started_at_ts_ms == null ? Date.now() : Number(row.started_at_ts_ms),
        interval_ms: 5000,
        handle: null,
        seq: 0,
        last_tick_ts_ms: row.last_tick_ts_ms == null ? null : Number(row.last_tick_ts_ms),
      };
      startRunnerRuntime(pool, runner, app.log);
      runners.set(key, runner);
    }
  });

  app.addHook("onClose", async () => {
    for (const runner of runners.values()) if (runner.handle) clearInterval(runner.handle);
    runners.clear();
  });
}
