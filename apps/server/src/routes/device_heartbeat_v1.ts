// GEOX/apps/server/src/routes/device_heartbeat_v1.ts
// Sprint C2: Device Heartbeat v1 ingest (schema-compatible).
//
// Goal:
// - Provide POST /api/v1/devices/:device_id/heartbeat
// - Update device_status_index_v1.last_heartbeat_ts_ms (and other columns if present)
// - Avoid hard dependency on optional columns (status/last_seen_ts_ms/etc).
//
// NOTE (contract/governance):
// - This route does NOT add new control semantics.
// - It is a write endpoint only for heartbeat/status projection.
// - Facts insertion is intentionally omitted here because Sprint C2 acceptance only requires status + export jobs,
//   and different repos may have different facts append helpers. If you need heartbeat facts, add them via the
//   existing ledger append helper used elsewhere in your repo.

import type { FastifyInstance } from "fastify"; // Fastify types.
import type { Pool } from "pg"; // Postgres pool type.
import { requireDeviceCredentialAuthV1 } from "../auth/device_credential_auth_v1.js";

type ColumnsCache = { loaded: boolean; cols: Set<string> }; // Cached column set for schema compatibility.

const cache: ColumnsCache = { loaded: false, cols: new Set<string>() }; // Module-level cache (per process).

function nowMs(): number { // Current epoch ms.
  return Date.now(); // Use system clock.
}

function normalizeDeviceId(raw: unknown): string { // Normalize device_id (path param).
  const s = typeof raw === "string" ? raw : String(raw ?? ""); // Coerce to string.
  const v = s.trim(); // Remove whitespace.
  if (!v) throw new Error("invalid device_id"); // Must be non-empty.
  return v; // Return normalized id.
}

async function loadDeviceStatusIndexColumns(pool: Pool): Promise<Set<string>> { // Load columns for device_status_index_v1.
  if (cache.loaded) return cache.cols; // Return cached columns.
  const q = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'device_status_index_v1'`
  ); // Query column names.
  cache.cols = new Set<string>(q.rows.map((r: any) => String(r.column_name))); // Build column set.
  cache.loaded = true; // Mark loaded.
  return cache.cols; // Return set.
}

function has(cols: Set<string>, name: string): boolean { // Column existence helper.
  return cols.has(name); // True if column exists.
}

function pushColumn(input: {
  cols: Set<string>;
  insertCols: string[];
  insertVals: any[];
  updates: string[];
  name: string;
  value: any;
  update?: string;
}): void {
  if (!has(input.cols, input.name)) return;
  input.insertCols.push(input.name);
  input.insertVals.push(input.value);
  input.updates.push(input.update ?? `"${input.name}" = EXCLUDED."${input.name}"`);
}

export function registerDeviceHeartbeatV1Routes(app: FastifyInstance, pool: Pool) { // Register routes.
  app.post("/api/v1/devices/:device_id/heartbeat", async (req: any, reply: any) => { // Heartbeat endpoint.
    try { // Begin handler.
      const body: any = req?.body ?? {};
      const device_id = normalizeDeviceId(req?.params?.device_id); // Normalize device id.
      const deviceAuth = await requireDeviceCredentialAuthV1(pool, req, reply, { device_id });
      if (!deviceAuth) return reply;
      for (const [key, expected] of [["tenant_id", deviceAuth.tenant_id], ["project_id", deviceAuth.project_id], ["group_id", deviceAuth.group_id]] as const) {
        const provided = body?.[key] == null ? "" : String(body[key]).trim();
        if (provided && provided !== expected) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
      }
      const tenant_id = deviceAuth.tenant_id;
      const project_id = deviceAuth.project_id;
      const group_id = deviceAuth.group_id;
      const now_ms = nowMs(); // Timestamp.

      const cols = await loadDeviceStatusIndexColumns(pool); // Load schema columns.

      const insertCols: string[] = []; // Insert column list.
      const insertVals: any[] = []; // Insert values list.
      const updates: string[] = []; // Update set clauses.

      insertCols.push("tenant_id"); // tenant id column.
      insertVals.push(tenant_id); // tenant id value.
      insertCols.push("device_id"); // device id column.
      insertVals.push(device_id); // device id value.

      pushColumn({ cols, insertCols, insertVals, updates, name: "project_id", value: project_id });
      pushColumn({ cols, insertCols, insertVals, updates, name: "group_id", value: group_id });
      pushColumn({ cols, insertCols, insertVals, updates, name: "field_id", value: deviceAuth.field_id });
      pushColumn({ cols, insertCols, insertVals, updates, name: "last_heartbeat_ts_ms", value: now_ms });
      pushColumn({ cols, insertCols, insertVals, updates, name: "last_seen_ts_ms", value: now_ms });
      pushColumn({ cols, insertCols, insertVals, updates, name: "updated_ts_ms", value: now_ms });
      pushColumn({ cols, insertCols, insertVals, updates, name: "status", value: "ONLINE" });
      pushColumn({
        cols,
        insertCols,
        insertVals,
        updates,
        name: "note",
        value: null,
        update: `note = COALESCE(device_status_index_v1.note, EXCLUDED.note)`,
      });

      const colSql = insertCols.map((c) => `"${c}"`).join(", "); // Quote column names.
      const phSql = insertVals.map((_, i) => `$${i + 1}`).join(", "); // Placeholders.
      const updSql = updates.length ? updates.join(", ") : `"device_id" = EXCLUDED."device_id"`; // Safe update.

      await pool.query(
        `INSERT INTO device_status_index_v1 (${colSql})
         VALUES (${phSql})
         ON CONFLICT (tenant_id, device_id) DO UPDATE SET ${updSql}`,
        insertVals
      ); // Execute.

      reply.code(200); // Set HTTP status.
      return { ok: true, device_id, tenant_id, project_id, group_id, field_id: deviceAuth.field_id, credential_id: deviceAuth.credential_id, ts_ms: now_ms }; // Return payload (Fastify sends once).
    } catch (e: any) { // Error path.
      const msg = typeof e?.message === "string" ? e.message : "heartbeat failed"; // Normalize message.
      if (reply.sent) {
        req.log?.error?.({ err: e }, "heartbeat failed after reply was already sent");
        return;
      }
      reply.code(500); // Set HTTP status.
      return { ok: false, error: "HEARTBEAT_ERROR", message: msg }; // Return payload (Fastify sends once).
    }
  }); // End route.
} // End register.