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

function pickTenantId(req: any): string { // Best-effort tenant id derivation.
  const t1 = req?.auth?.tenant_id; // Read req.auth.tenant_id if present.
  if (typeof t1 === "string" && t1.length) return t1; // Use if available.
  const t2 = req?.user?.tenant_id; // Read req.user.tenant_id if present.
  if (typeof t2 === "string" && t2.length) return t2; // Use if available.
  return "tenantA"; // Conservative fallback.
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

async function ensureDeviceExists(pool: Pool, tenant_id: string, device_id: string): Promise<void> { // Verify device exists.
  const candidates = ["devices_v1", "devices"]; // Candidate device tables.
  for (const table of candidates) { // Iterate candidates.
    try { // Attempt query.
      const r = await pool.query(`SELECT 1 AS ok FROM ${table} WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`, [tenant_id, device_id]); // Query.
      if ((r.rowCount ?? 0) > 0) return; // Found.
    } catch { // If table doesn't exist, try next.
      continue; // Next candidate.
    }
  }
}

export function registerDeviceHeartbeatV1Routes(app: FastifyInstance, pool: Pool) { // Register routes.
  app.post("/api/v1/devices/:device_id/heartbeat", async (req: any, reply: any) => { // Heartbeat endpoint.
    try { // Begin handler.
      const tenant_id = pickTenantId(req); // Resolve tenant id.
      const device_id = normalizeDeviceId(req?.params?.device_id); // Normalize device id.
      const now_ms = nowMs(); // Timestamp.

      await ensureDeviceExists(pool, tenant_id, device_id); // Optional existence check.

      const cols = await loadDeviceStatusIndexColumns(pool); // Load schema columns.

      const insertCols: string[] = []; // Insert column list.
      const insertVals: any[] = []; // Insert values list.
      const updates: string[] = []; // Update set clauses.

      insertCols.push("tenant_id"); // tenant id column.
      insertVals.push(tenant_id); // tenant id value.
      insertCols.push("device_id"); // device id column.
      insertVals.push(device_id); // device id value.

      if (has(cols, "last_heartbeat_ts_ms")) { // If last_heartbeat exists.
        insertCols.push("last_heartbeat_ts_ms"); // Add column.
        insertVals.push(now_ms); // Set to now.
        updates.push(`last_heartbeat_ts_ms = EXCLUDED.last_heartbeat_ts_ms`); // Update on conflict.
      }

      if (has(cols, "last_seen_ts_ms")) { // Optional column: last_seen.
        insertCols.push("last_seen_ts_ms"); // Add column.
        insertVals.push(now_ms); // Set to now.
        updates.push(`last_seen_ts_ms = EXCLUDED.last_seen_ts_ms`); // Update on conflict.
      }

      if (has(cols, "updated_ts_ms")) { // Optional column: updated timestamp.
        insertCols.push("updated_ts_ms"); // Add column.
        insertVals.push(now_ms); // Set to now.
        updates.push(`updated_ts_ms = EXCLUDED.updated_ts_ms`); // Update on conflict.
      }

      if (has(cols, "status")) { // Optional column: status string.
        insertCols.push("status"); // Add column.
        insertVals.push("ONLINE"); // Set to ONLINE.
        updates.push(`status = EXCLUDED.status`); // Update on conflict.
      }

      if (has(cols, "note")) { // Optional column: note.
        insertCols.push("note"); // Add column.
        insertVals.push(null); // Insert null note.
        updates.push(`note = COALESCE(device_status_index_v1.note, EXCLUDED.note)`); // Keep existing if any.
      }

      const colSql = insertCols.map((c) => `"${c}"`).join(", "); // Quote column names.
      const phSql = insertVals.map((_, i) => `$${i + 1}`).join(", "); // Placeholders.
      const updSql = updates.length ? updates.join(", ") : `"device_id" = EXCLUDED."device_id"`; // Safe update.

      await pool.query(
        `INSERT INTO device_status_index_v1 (${colSql})
         VALUES (${phSql})
         ON CONFLICT (tenant_id, device_id) DO UPDATE SET ${updSql}`,
        insertVals
      ); // Execute.

      reply.code(200).send({ ok: true, device_id, ts_ms: now_ms }); // Reply ok.
    } catch (e: any) { // Error path.
      const msg = typeof e?.message === "string" ? e.message : "heartbeat failed"; // Normalize message.
      reply.code(500).send({ ok: false, error: "HEARTBEAT_ERROR", message: msg }); // Reply error.
    }
  }); // End route.
} // End register.
