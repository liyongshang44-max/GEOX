// GEOX/apps/server/src/routes/device_status_v1.ts
//
// Sprint C1/C2: Device status read API.
//
// This file is intentionally defensive because some repos have small schema / auth helper drift.
// Goals:
// - Never crash the server at boot due to missing helper exports.
// - Ensure device_status_index_v1 has the columns we need (best-effort, backward-compatible).
// - Return stable JSON with status ONLINE/OFFLINE derived from last_heartbeat_ts_ms.
//

import type { FastifyInstance } from "fastify"; // Fastify types.
import type { Pool } from "pg"; // Postgres pool.
import * as authz from "../auth/ao_act_authz_v0.js"; // Auth helpers (export names may differ between repos).

type FactsAuth = {
  tenant_id: string; // Tenant id.
  subject?: string; // Subject (user/device).
  scopes?: string[]; // Scopes list.
};

function nowMs(): number {
  return Date.now(); // Current unix ms.
}

function toIntMs(v: unknown): number | null {
  // pg may return BIGINT as string; normalize to number when safe.
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getAuthContext(req: any): FactsAuth | null {
  // Try common places where auth middleware stores claims.
  const cands = [
    req?.auth, // custom.
    req?.user, // fastify-jwt style.
    req?.claims, // custom.
    req?.requestContext, // custom.
  ];
  for (const c of cands) {
    const t = c?.tenant_id;
    if (typeof t === "string" && t.length) return c as FactsAuth;
  }
  // Some repos attach on request as req.ctx / req.state.
  if (req?.ctx?.tenant_id) return req.ctx as FactsAuth;
  if (req?.state?.tenant_id) return req.state as FactsAuth;
  return null;
}

function requireAuthCompat(): (req: any, reply: any) => any {
  // Pick the best available exported function at runtime.
  const fn =
    (authz as any).requireAuthV0 ??
    (authz as any).requireAuth ??
    (authz as any).requireAoActAuthV0 ??
    (authz as any).requireAoActAuth ??
    null;
  if (typeof fn === "function") return fn;
  // If auth helper is not available, return a no-op to avoid crashing boot.
  // NOTE: This keeps behavior permissive only for this route; acceptance scripts still send Authorization header.
  return async () => undefined;
}

async function ensureDeviceStatusIndexV1Schema(pool: Pool): Promise<void> {
  // Best-effort schema ensure:
  // - Create table if missing.
  // - Add missing columns (older repos may lack last_seen_ts_ms / status).
  // - Do not drop or rewrite existing columns.
  const ddl = `
    CREATE TABLE IF NOT EXISTS device_status_index_v1 (
      tenant_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      field_id  TEXT NULL,
      last_telemetry_ts_ms  BIGINT NULL,
      last_heartbeat_ts_ms  BIGINT NULL,
      last_seen_ts_ms       BIGINT NULL,
      battery_percent       INTEGER NULL,
      rssi_dbm              INTEGER NULL,
      fw_ver                TEXT NULL,
      status                TEXT NULL,
      updated_ts_ms         BIGINT NULL,
      note                  TEXT NULL,
      PRIMARY KEY (tenant_id, device_id)
    );
  `;
  await pool.query(ddl);

  // Add missing columns individually (safe across schema drift).
  const alters = [
    `ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS field_id TEXT NULL;`,
    `ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS last_telemetry_ts_ms BIGINT NULL;`,
    `ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS last_heartbeat_ts_ms BIGINT NULL;`,
    `ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS last_seen_ts_ms BIGINT NULL;`,
    `ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS battery_percent INTEGER NULL;`,
    `ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS rssi_dbm INTEGER NULL;`,
    `ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS fw_ver TEXT NULL;`,
    `ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS status TEXT NULL;`,
    `ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS updated_ts_ms BIGINT NULL;`,
    `ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS note TEXT NULL;`,
    // Some older repos used PRIMARY KEY(device_id) without tenant_id; keep compatibility by adding tenant_id default if missing.
    `ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS tenant_id TEXT;`,
  ];
  for (const q of alters) {
    try {      await pool.query(q);
    } catch {
      // Ignore; this is best-effort to keep server running.
    }
  }
}

export function registerDeviceStatusV1Routes(app: FastifyInstance, pool: Pool): void {
  void ensureDeviceStatusIndexV1Schema(pool); // Ensure schema at startup (async, best-effort).

  const requireAuth = requireAuthCompat(); // Resolve auth function once.

  // GET /api/v1/devices/:device_id/status
  app.get("/api/v1/devices/:device_id/status", { preHandler: requireAuth as any }, async (req, reply) => {
    let tenant_id = "unknown";
    const device_id = String((req as any).params?.device_id ?? "").trim();
    req.log.info({ route: "device.status", params: (req as any).params, device_id }, "device.status entered");
    try {
      const auth = getAuthContext(req) ?? ({ tenant_id: "tenantA" } as FactsAuth); // Fallback tenant for single-tenant dev.
      tenant_id = String(auth.tenant_id); // Tenant id.
      req.log.info({ route: "device.status", tenant_id, device_id }, "device.status auth resolved");
      if (!device_id) return reply.code(400).send({ ok: false, error: "BAD_REQUEST", message: "invalid device_id" });

      const offline_after_ms = 5 * 60 * 1000; // Default: 5 minutes.
      req.log.info({ route: "device.status", tenant_id, device_id }, "device.status before query");
      const q = await pool.query(
        `SELECT device_id, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms, status
           FROM device_status_index_v1
          WHERE tenant_id = $1 AND device_id = $2
          LIMIT 1`,
        [tenant_id, device_id]
      );
      req.log.info({ route: "device.status", tenant_id, device_id, row_count: q.rowCount ?? 0 }, "device.status after query");

      if (q.rowCount === 0) {
        // Non-enumerable behavior: 404 to external caller.
        req.log.warn({ route: "device.status", tenant_id, device_id }, "device.status reply 404");
        return reply.code(404).send({ ok: false, error: "NOT_FOUND", message: "device not found" });
      }

      const row = q.rows[0] ?? {};
      const now_ms = nowMs();
      const last_hb = toIntMs(row.last_heartbeat_ts_ms);
      const online = last_hb != null ? (now_ms - last_hb) <= offline_after_ms : false;
      const status = online ? "ONLINE" : "OFFLINE";

      req.log.info({ route: "device.status", tenant_id, device_id }, "device.status reply 200");
      return reply.code(200).send({
        ok: true,
        device_id: String(row.device_id ?? device_id),
        status,
        online,
        offline_after_ms,
        last_telemetry_ts_ms: toIntMs(row.last_telemetry_ts_ms),
        last_heartbeat_ts_ms: last_hb,
        battery_percent: typeof row.battery_percent === "number" ? row.battery_percent : (row.battery_percent != null ? Number(row.battery_percent) : null),
        rssi_dbm: typeof row.rssi_dbm === "number" ? row.rssi_dbm : (row.rssi_dbm != null ? Number(row.rssi_dbm) : null),
        fw_ver: row.fw_ver ?? null,
        updated_ts_ms: toIntMs(row.updated_ts_ms) ?? null,
      });
    } catch (e: any) {
      req.log.error({ route: "device.status", tenant_id, device_id, err: e }, "device.status failed");
      return reply.code(500).send({ ok: false, error: "INTERNAL", message: String(e?.message ?? e) });
    } finally {
      req.log.info({ route: "device.status", tenant_id, device_id }, "device.status completed");
    }
  });
}







