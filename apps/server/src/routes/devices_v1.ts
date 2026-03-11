// GEOX/apps/server/src/routes/devices_v1.ts

import crypto from "node:crypto"; // Node crypto for deterministic ids and credential hashing.
import type { FastifyInstance } from "fastify"; // Fastify app instance for route registration.
import type { Pool } from "pg"; // Postgres connection pool for db access.

import { requireAoActScopeV0, requireAoActAdminV0 } from "../auth/ao_act_authz_v0"; // Reuse Sprint 19 token/scope auth (tenant isolation + scopes).
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0"; // Auth context includes tenant/project/group ids.

function isNonEmptyString(v: any): v is string { // Helper: validate non-empty string.
  return typeof v === "string" && v.trim().length > 0; // Return true only for non-empty trimmed string.
} // End helper.

function normalizeId(v: any): string | null { // Helper: normalize an id-like string (device_id / credential_id).
  if (!isNonEmptyString(v)) return null; // Missing => null.
  const s = String(v).trim(); // Trim.
  if (s.length < 1 || s.length > 128) return null; // Enforce a conservative length bound.
  if (!/^[A-Za-z0-9_\-:.]+$/.test(s)) return null; // Allow only safe id characters (no spaces).
  return s; // Return normalized id.
} // End helper.

function normalizeDeviceId(v: any): string | null { // Helper: normalize device_id strings (alias of normalizeId).
  return normalizeId(v); // Reuse shared id normalization rules.
} // End normalizeDeviceId.

function nowIso(ms: number): string { // Helper: convert ms to ISO string.
  return new Date(ms).toISOString(); // Convert.
} // End nowIso.

function sha256Hex(s: string): string { // Helper: sha256 hex digest.
  return crypto.createHash("sha256").update(s, "utf8").digest("hex"); // Hash + hex.
} // End helper.

function badRequest(reply: any, error: string) { // Helper: 400 response.
  return reply.status(400).send({ ok: false, error }); // Standard envelope.
} // End helper.

function notFound(reply: any) { // Helper: 404 response.
  return reply.status(404).send({ ok: false, error: "NOT_FOUND" }); // Standard envelope.
} // End helper.

function randomSecret(): string { // Helper: generate a credential secret for device ingest auth.
  const b = crypto.randomBytes(24); // 24 bytes => 32 chars-ish in base64url.
  return b.toString("base64url"); // Use URL-safe base64 without padding.
} // End helper.

function buildAccessInfo(tenant_id: string, device_id: string) {
  return {
    device_id,
    tenant_id,
    mqtt_client_id: `geox-${tenant_id}-${device_id}`,
    telemetry_topic: `telemetry/${tenant_id}/${device_id}`,
    heartbeat_topic: `heartbeat/${tenant_id}/${device_id}`,
    downlink_topic: `downlink/${tenant_id}/${device_id}`,
    receipt_topic: `receipt/${tenant_id}/${device_id}`,
    payload_contract_version: "v1",
    auth_mode: "DEVICE_CREDENTIAL_SECRET_ONCE",
    secret_warning: "设备密钥仅在签发时返回一次；平台只保存哈希，不保存明文 secret。",
  };
}

/**
 * Sprint A2: Devices P0 (registration + credentials)
 *
 * Goals:
 * - Devices must be registered before telemetry is accepted (enforced by telemetry-ingest).
 * - Device credentials are issued and revoked via append-only facts, with projections for fast lookup.
 * - Tenant isolation uses ao_act_tokens_v0 (tenant_id from token is authoritative).
 */
export function registerDevicesV1Routes(app: FastifyInstance, pool: Pool) { // Route registration entry.
  app.post("/api/devices", async (req, reply) => { // Register a device under the caller's tenant.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.write"); // Enforce devices.write scope.
    if (!auth) return; // Auth helper already responded.

    const body: any = (req as any).body ?? {}; // Read JSON body.
    const device_id = normalizeId(body.device_id); // Required device id.
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id"); // Validate.

    const display_name = isNonEmptyString(body.display_name) ? String(body.display_name).trim().slice(0, 256) : null; // Optional display name.

    const created_ts_ms = Date.now(); // Use server time for created_ts_ms (auditable, deterministic enough for projection).
    const occurredAtIso = new Date(created_ts_ms).toISOString(); // ISO for occurred_at.

    const telemetry_id = sha256Hex(`device_registered_v1|${auth.tenant_id}|${device_id}`); // Deterministic id for idempotency.
    const fact_id = `devreg_${telemetry_id}`; // Deterministic fact id.

    const record = { // Ledger record_json.
      type: "device_registered_v1", // Fact type.
      entity: { // Entity envelope.
        tenant_id: auth.tenant_id, // Tenant scope.
        device_id, // Device scope.
      }, // End entity.
      payload: { // Payload.
        display_name, // Optional human name.
        created_ts_ms, // Creation timestamp in ms.
        actor_id: auth.actor_id, // Actor for audit.
        token_id: auth.token_id, // Token id for audit.
      }, // End payload.
    }; // End record.

    const clientConn = await pool.connect(); // Acquire db connection.
    try { // Begin transaction.
      await clientConn.query("BEGIN"); // Start tx.

      await clientConn.query( // Insert append-only fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [fact_id, occurredAtIso, "control", JSON.stringify(record)]
      ); // End insert.

      await clientConn.query( // Upsert device projection.
        `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, created_ts_ms, last_credential_id, last_credential_status)
         VALUES ($1, $2, $3, $4, NULL, NULL)
         ON CONFLICT (tenant_id, device_id)
         DO UPDATE SET display_name = EXCLUDED.display_name`,
        [auth.tenant_id, device_id, display_name, created_ts_ms]
      ); // End upsert.

      await clientConn.query("COMMIT"); // Commit.
    } catch (e: any) { // Error handler.
      try { await clientConn.query("ROLLBACK"); } catch {} // Rollback best-effort.
      return reply.status(500).send({ ok: false, error: "DB_ERROR", message: String(e?.message ?? e) }); // Surface error (dev-only).
    } finally { // Release connection.
      clientConn.release(); // Release back to pool.
    } // End tx.

    return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, display_name, fact_id }); // Return success.
  }); // End register device route.

  app.post("/api/devices/:device_id/credentials", async (req, reply) => { // Issue a new credential for a registered device.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.credentials.write"); // Enforce credential write scope.
    if (!auth) return;
    if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_DEVICE_CREDENTIAL_ADMIN_REQUIRED" })) return; // Auth helper already responded.

    const params: any = (req as any).params ?? {}; // Read path params.
    const device_id = normalizeId(params.device_id); // Device id from path.
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id"); // Validate.

    const body: any = (req as any).body ?? {}; // Read JSON body.
    const requested_credential_id = normalizeId(body.credential_id); // Optional caller-specified credential id.
    const credential_id = requested_credential_id ?? `cred_${sha256Hex(`${auth.tenant_id}|${device_id}|${Date.now()}|${Math.random()}`).slice(0, 16)}`; // Generate id if missing.

    const secret = randomSecret(); // Generate one-time secret (returned only once).
    const credential_hash = sha256Hex(secret); // Store hash only (never store secret in DB).

    const issued_ts_ms = Date.now(); // Issue time.
    const occurredAtIso = new Date(issued_ts_ms).toISOString(); // occurred_at.

    const det = sha256Hex(`device_credential_issued_v1|${auth.tenant_id}|${device_id}|${credential_id}|${credential_hash}`); // Deterministic id.
    const fact_id = `devcred_${det}`; // Deterministic fact id.

    const record = { // Ledger record_json.
      type: "device_credential_issued_v1", // Fact type.
      entity: { // Entity.
        tenant_id: auth.tenant_id, // Tenant.
        device_id, // Device.
      }, // End entity.
      payload: { // Payload.
        credential_id, // Credential id.
        credential_hash, // Credential hash (sha256 hex).
        issued_ts_ms, // Issue time.
        status: "ACTIVE", // Issued status.
        actor_id: auth.actor_id, // Actor audit.
        token_id: auth.token_id, // Token audit.
      }, // End payload.
    }; // End record.

    const clientConn = await pool.connect(); // Acquire db connection.
    try { // Tx scope.
      await clientConn.query("BEGIN"); // Begin.

      const exists = await clientConn.query( // Ensure device exists (projection gate).
        `SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`,
        [auth.tenant_id, device_id]
      ); // End query.
      if ((exists.rows ?? []).length < 1) { // Not registered.
        await clientConn.query("ROLLBACK"); // Rollback.
        return notFound(reply); // Hide enumeration across tenants (tenant already isolated).
      } // End gate.

      await clientConn.query( // Insert append-only fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [fact_id, occurredAtIso, "control", JSON.stringify(record)]
      ); // End insert.

      await clientConn.query( // Upsert credential projection (ACTIVE).
        `INSERT INTO device_credential_index_v1 (tenant_id, device_id, credential_id, credential_hash, status, issued_ts_ms, revoked_ts_ms)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5, NULL)
         ON CONFLICT (tenant_id, device_id, credential_id)
         DO UPDATE SET credential_hash = EXCLUDED.credential_hash, status = 'ACTIVE', issued_ts_ms = EXCLUDED.issued_ts_ms, revoked_ts_ms = NULL`,
        [auth.tenant_id, device_id, credential_id, credential_hash, issued_ts_ms]
      ); // End upsert.

      await clientConn.query( // Update device_index_v1 last credential pointers.
        `UPDATE device_index_v1
         SET last_credential_id = $3, last_credential_status = 'ACTIVE'
         WHERE tenant_id = $1 AND device_id = $2`,
        [auth.tenant_id, device_id, credential_id]
      ); // End update.

      await clientConn.query("COMMIT"); // Commit.
    } catch (e: any) { // Error handler.
      try { await clientConn.query("ROLLBACK"); } catch {} // Rollback best-effort.
      return reply.status(500).send({ ok: false, error: "DB_ERROR", message: String(e?.message ?? e) }); // Return 500.
    } finally { // Release.
      clientConn.release(); // Release connection.
    } // End tx.

    return reply.send({ // Response includes secret (one-time).
      ok: true, // Success.
      tenant_id: auth.tenant_id, // Tenant.
      device_id, // Device.
      credential_id, // Credential id.
      credential_secret: secret, // One-time secret (caller must store securely).
      credential_hash, // Hash for debugging (dev-only).
      fact_id, // Ledger fact id.
    }); // End response.
  }); // End issue credential route.

  app.post("/api/devices/:device_id/credentials/:credential_id/revoke", async (req, reply) => { // Revoke a device credential.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.credentials.revoke"); // Enforce revoke scope.
    if (!auth) return;
    if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_DEVICE_CREDENTIAL_ADMIN_REQUIRED" })) return; // Auth helper already responded.

    const params: any = (req as any).params ?? {}; // Params.
    const device_id = normalizeId(params.device_id); // Device id.
    const credential_id = normalizeId(params.credential_id); // Credential id.
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id"); // Validate.
    if (!credential_id) return badRequest(reply, "MISSING_OR_INVALID:credential_id"); // Validate.

    const revoked_ts_ms = Date.now(); // Revoke time.
    const occurredAtIso = new Date(revoked_ts_ms).toISOString(); // occurred_at.

    const det = sha256Hex(`device_credential_revoked_v1|${auth.tenant_id}|${device_id}|${credential_id}|${revoked_ts_ms}`); // Deterministic-ish.
    const fact_id = `devrevoke_${det}`; // Fact id.

    const record = { // Record.
      type: "device_credential_revoked_v1", // Fact type.
      entity: { // Entity.
        tenant_id: auth.tenant_id, // Tenant.
        device_id, // Device.
      }, // End entity.
      payload: { // Payload.
        credential_id, // Credential.
        revoked_ts_ms, // Revoke time.
        actor_id: auth.actor_id, // Actor.
        token_id: auth.token_id, // Token.
      }, // End payload.
    }; // End record.

    const clientConn = await pool.connect(); // DB conn.
    try { // Tx.
      await clientConn.query("BEGIN"); // Begin.

      const exists = await clientConn.query( // Ensure credential exists in projection.
        `SELECT status FROM device_credential_index_v1 WHERE tenant_id = $1 AND device_id = $2 AND credential_id = $3 LIMIT 1`,
        [auth.tenant_id, device_id, credential_id]
      ); // End query.
      if ((exists.rows ?? []).length < 1) { // Not found.
        await clientConn.query("ROLLBACK"); // Rollback.
        return notFound(reply); // 404.
      } // End gate.

      await clientConn.query( // Insert revoke fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [fact_id, occurredAtIso, "control", JSON.stringify(record)]
      ); // End insert.

      await clientConn.query( // Mark projection as revoked.
        `UPDATE device_credential_index_v1
         SET status = 'REVOKED', revoked_ts_ms = $4
         WHERE tenant_id = $1 AND device_id = $2 AND credential_id = $3`,
        [auth.tenant_id, device_id, credential_id, revoked_ts_ms]
      ); // End update.

      await clientConn.query( // Update device last credential status if matches.
        `UPDATE device_index_v1
         SET last_credential_status = 'REVOKED'
         WHERE tenant_id = $1 AND device_id = $2 AND last_credential_id = $3`,
        [auth.tenant_id, device_id, credential_id]
      ); // End update.

      await clientConn.query("COMMIT"); // Commit.
    } catch (e: any) { // Error handler.
      try { await clientConn.query("ROLLBACK"); } catch {} // Rollback.
      return reply.status(500).send({ ok: false, error: "DB_ERROR", message: String(e?.message ?? e) }); // Return.
    } finally { // Release.
      clientConn.release(); // Release.
    } // End tx.

    return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, credential_id, fact_id }); // Success response.
  }); // End revoke route.

  app.get("/api/devices/:device_id", async (req, reply) => { // Read device projection.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.read"); // Enforce devices.read.
    if (!auth) return; // Auth helper already responded.

    const params: any = (req as any).params ?? {}; // Params.
    const device_id = normalizeId(params.device_id); // Device id.
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id"); // Validate.

    const r = await pool.query( // Query device projection.
      `SELECT tenant_id, device_id, display_name, created_ts_ms, last_credential_id, last_credential_status
       FROM device_index_v1
       WHERE tenant_id = $1 AND device_id = $2
       LIMIT 1`,
      [auth.tenant_id, device_id]
    ); // End query.

    if ((r.rows ?? []).length < 1) return notFound(reply); // Not found within tenant.

    const row: any = r.rows[0]; // Row.
    return reply.send({ // Response.
      ok: true, // Success.
      tenant_id: row.tenant_id, // Tenant.
      device_id: row.device_id, // Device.
      display_name: row.display_name ?? null, // Display name.
      created_ts_ms: Number(row.created_ts_ms), // Created.
      last_credential_id: row.last_credential_id ?? null, // Last credential.
      last_credential_status: row.last_credential_status ?? null, // Last status.
    }); // End response.
  }); // End get route.


  // ------------------------------
  // Devices v1 (Sprint C2): API surface under /api/v1/devices
  // NOTE: Keep existing /api/devices routes unchanged for backward compatibility.

  app.post("/api/v1/devices/:device_id", async (req, reply) => { // Register a device (v1 alias of /api/devices/:device_id).
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.write"); // Require devices.write.
    if (!auth) return; // Auth handled response.

    const params: any = (req as any).params ?? {}; // Params.
    const device_id = normalizeDeviceId(params.device_id); // Normalize device id.
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id"); // Validate.

    const body: any = (req as any).body ?? {}; // Body.
    const display_name = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 200) : ""; // Optional name.

    const now_ms = Date.now(); // Server time.
    const occurred_iso = nowIso(now_ms); // occurred_at.

    const det = sha256Hex(`device_registered_v1|${auth.tenant_id}|${device_id}|${display_name}`); // Deterministic hash.
    const fact_id = `device_${det}`; // Fact id.

    const record = { // Append-only fact record.
      type: "device_registered_v1", // Fact type.
      entity: { tenant_id: auth.tenant_id, device_id }, // Entity.
      payload: { display_name, created_ts_ms: now_ms, actor_id: auth.actor_id, token_id: auth.token_id }, // Payload.
    }; // End record.

    const clientConn = await pool.connect(); // Acquire db connection.
    try { // Tx.
      await clientConn.query("BEGIN"); // Begin.

      await clientConn.query( // Insert fact (idempotent by fact_id).
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [fact_id, occurred_iso, "control", JSON.stringify(record)]
      ); // End insert.

      await clientConn.query( // Upsert device projection.
        `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, created_ts_ms, last_credential_id, last_credential_status)
         VALUES ($1, $2, $3, $4, NULL, NULL)
         ON CONFLICT (tenant_id, device_id)
         DO UPDATE SET display_name = EXCLUDED.display_name`,
        [auth.tenant_id, device_id, display_name, now_ms]
      ); // End upsert.

      await clientConn.query("COMMIT"); // Commit.
    } catch (e: any) { // Error.
      try { await clientConn.query("ROLLBACK"); } catch {} // Rollback.
      return reply.status(500).send({ ok: false, error: "DB_ERROR", message: String(e?.message ?? e) }); // Return.
    } finally { // Release.
      clientConn.release(); // Release.
    } // End tx.

    return reply.send({ ok: true, device_id, tenant_id: auth.tenant_id, fact_id }); // Response.
  }); // End /api/v1 register.

  app.get("/api/v1/devices", async (req, reply) => { // List devices for tenant with minimal运营摘要.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.read"); // Require devices.read.
    if (!auth) return; // Auth handled.

    const limit = 200; // Fixed list limit for commercial UI MVP.
    const q = await pool.query(
      `SELECT
          d.tenant_id,
          d.device_id,
          d.display_name,
          d.created_ts_ms,
          d.last_credential_id,
          d.last_credential_status,
          b.field_id,
          b.bound_ts_ms,
          s.last_telemetry_ts_ms,
          s.last_heartbeat_ts_ms,
          s.battery_percent,
          s.rssi_dbm,
          s.fw_ver,
          CASE
            WHEN s.last_heartbeat_ts_ms IS NOT NULL AND s.last_heartbeat_ts_ms >= $3 THEN 'ONLINE'
            ELSE 'OFFLINE'
          END AS connection_status
        FROM device_index_v1 d
        LEFT JOIN device_binding_index_v1 b
          ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
        LEFT JOIN device_status_index_v1 s
          ON s.tenant_id = d.tenant_id AND s.device_id = d.device_id
        WHERE d.tenant_id = $1
        ORDER BY d.created_ts_ms DESC
        LIMIT $2`,
      [auth.tenant_id, limit, Date.now() - 15 * 60 * 1000]
    ); // Query joined device summary.

    return reply.send({ ok: true, devices: q.rows }); // Return summarized device list.
  }); // End list.



  app.get("/api/v1/devices/:device_id/console", async (req, reply) => { // Device integration console view: access info + credentials + recent command/receipt history.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.read"); // Require device read scope for console view.
    if (!auth) return; // Auth helper already responded.

    const params: any = (req as any).params ?? {}; // Read route params.
    const device_id = normalizeDeviceId(params.device_id); // Normalize route device id.
    if (!device_id) return notFound(reply); // Invalid ids are hidden behind 404.

    const existsQ = await pool.query( // Ensure the device exists inside the caller tenant before exposing console data.
      `SELECT tenant_id, device_id, display_name, created_ts_ms, last_credential_id, last_credential_status
         FROM device_index_v1
        WHERE tenant_id = $1 AND device_id = $2
        LIMIT 1`,
      [auth.tenant_id, device_id]
    ); // End exists query.
    if ((existsQ.rowCount ?? 0) < 1) return notFound(reply); // Keep cross-tenant enumeration hidden.

    const credentialsQ = await pool.query( // Recent credential summaries (hash never leaves the backend).
      `SELECT credential_id, status, issued_ts_ms, revoked_ts_ms
         FROM device_credential_index_v1
        WHERE tenant_id = $1 AND device_id = $2
        ORDER BY issued_ts_ms DESC, credential_id DESC
        LIMIT 10`,
      [auth.tenant_id, device_id]
    ); // End credential query.

    const commandsQ = await pool.query( // Recent dispatched commands targeted to this device.
      `SELECT
          dq.act_task_id,
          dq.outbox_fact_id,
          dq.device_id,
          dq.downlink_topic,
          dq.state,
          dq.qos,
          dq.retain,
          dq.adapter_hint,
          dq.attempt_count,
          EXTRACT(EPOCH FROM dq.created_at) * 1000 AS created_ts_ms,
          EXTRACT(EPOCH FROM dq.updated_at) * 1000 AS updated_ts_ms,
          COALESCE((task_fact.record_json::jsonb #>> '{payload,action_type}'), '') AS action_type
        FROM dispatch_queue_v1 dq
        LEFT JOIN facts task_fact
          ON task_fact.fact_id = dq.task_fact_id
       WHERE dq.tenant_id = $1
         AND dq.device_id = $2
       ORDER BY dq.created_at DESC, dq.queue_id DESC
       LIMIT 20`,
      [auth.tenant_id, device_id]
    ); // End command query.

    const receiptsQ = await pool.query( // Recent device receipt/ack facts scoped to this device.
      `SELECT
          fact_id,
          (record_json::jsonb #>> '{payload,act_task_id}') AS act_task_id,
          (record_json::jsonb #>> '{payload,status}') AS status,
          (record_json::jsonb #>> '{payload,uplink_topic}') AS uplink_topic,
          (record_json::jsonb #>> '{payload,adapter_runtime}') AS adapter_runtime,
          ((record_json::jsonb #>> '{payload,created_at_ts}'))::bigint AS created_ts_ms
        FROM facts
       WHERE (record_json::jsonb ->> 'type') = 'ao_act_device_ack_received_v1'
         AND (record_json::jsonb #>> '{payload,tenant_id}') = $1
         AND (record_json::jsonb #>> '{payload,device_id}') = $2
       ORDER BY occurred_at DESC, fact_id DESC
       LIMIT 20`,
      [auth.tenant_id, device_id]
    ); // End receipt query.

    const access_info = buildAccessInfo(auth.tenant_id, device_id); // Deterministic integration hints used by the device console page.

    return reply.send({ // Return console aggregate payload.
      ok: true, // Success envelope.
      device: existsQ.rows[0], // Base device summary.
      access_info, // Integration hints and warnings.
      credentials: credentialsQ.rows ?? [], // Recent credential summaries.
      recent_commands: commandsQ.rows ?? [], // Recent command history.
      recent_receipts: receiptsQ.rows ?? [], // Recent device receipt history.
    }); // End response.
  }); // End device console route.

  app.get("/api/v1/devices/:device_id", async (req, reply) => { // Get a single device with绑定/状态/最近遥测摘要.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.read"); // Require devices.read.
    if (!auth) return; // Auth handled.

    const params: any = (req as any).params ?? {}; // Params.
    const device_id = normalizeDeviceId(params.device_id); // Normalize.
    if (!device_id) return notFound(reply); // Invalid -> 404.

    const q = await pool.query(
      `SELECT
          d.tenant_id,
          d.device_id,
          d.display_name,
          d.created_ts_ms,
          d.last_credential_id,
          d.last_credential_status,
          b.field_id,
          b.bound_ts_ms,
          s.last_telemetry_ts_ms,
          s.last_heartbeat_ts_ms,
          s.battery_percent,
          s.rssi_dbm,
          s.fw_ver,
          CASE
            WHEN s.last_heartbeat_ts_ms IS NOT NULL AND s.last_heartbeat_ts_ms >= $3 THEN 'ONLINE'
            ELSE 'OFFLINE'
          END AS connection_status
         FROM device_index_v1 d
         LEFT JOIN device_binding_index_v1 b
           ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
         LEFT JOIN device_status_index_v1 s
           ON s.tenant_id = d.tenant_id AND s.device_id = d.device_id
        WHERE d.tenant_id = $1 AND d.device_id = $2
        LIMIT 1`,
      [auth.tenant_id, device_id, Date.now() - 15 * 60 * 1000]
    ); // Query joined detail row.
    if ((q.rowCount ?? 0) < 1) return notFound(reply); // Missing.

    const latestTelemetryQ = await pool.query(
      `SELECT metric, EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms, value_num, value_text, fact_id
         FROM telemetry_index_v1
        WHERE tenant_id = $1 AND device_id = $2
        ORDER BY ts DESC
        LIMIT 12`,
      [auth.tenant_id, device_id]
    ); // Try projection path first for latest telemetry cards.

    let latestTelemetryRows = latestTelemetryQ.rows ?? []; // Keep latest telemetry rows from projection.
    if (latestTelemetryRows.length < 1) { // Fall back to SSOT facts when projection has no rows.
      const fallbackQ = await pool.query(
        `SELECT
            (record_json::jsonb #>> '{payload,metric}') AS metric,
            ((record_json::jsonb #>> '{payload,ts_ms}'))::bigint AS ts_ms,
            (record_json::jsonb #>> '{payload,value}') AS value_text,
            fact_id
           FROM facts
          WHERE (record_json::jsonb ->> 'type') = 'raw_telemetry_v1'
            AND (record_json::jsonb #>> '{entity,tenant_id}') = $1
            AND (record_json::jsonb #>> '{entity,device_id}') = $2
          ORDER BY occurred_at DESC
          LIMIT 12`,
        [auth.tenant_id, device_id]
      ); // Query SSOT telemetry facts for fallback.
      latestTelemetryRows = (fallbackQ.rows ?? []).map((row: any) => ({
        metric: row.metric,
        ts_ms: Number(row.ts_ms),
        value_num: row.value_text != null && Number.isFinite(Number(row.value_text)) ? Number(row.value_text) : null,
        value_text: row.value_text == null ? null : String(row.value_text),
        fact_id: String(row.fact_id),
      })); // Normalize fallback rows.
    } // End fallback.

    return reply.send({ ok: true, device: q.rows[0], latest_telemetry: latestTelemetryRows }); // Return enriched detail.
  }); // End get.

  app.post("/api/v1/devices/register", async (req, reply) => { // Device onboarding helper: register + issue credential in one step.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.write");
    if (!auth) return;

    const body: any = (req as any).body ?? {};
    const device_id = normalizeDeviceId(body.device_id);
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id");

    const display_name = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 200) : "";
    const requested_credential_id = normalizeId(body.credential_id);
    const credential_id = requested_credential_id ?? `cred_${sha256Hex(`${auth.tenant_id}|${device_id}|${Date.now()}|${Math.random()}`).slice(0, 16)}`;
    const secret = randomSecret();
    const credential_hash = sha256Hex(secret);

    const now_ms = Date.now();
    const occurred_iso = nowIso(now_ms);
    const register_fact_id = `device_${sha256Hex(`device_registered_v1|${auth.tenant_id}|${device_id}|${display_name}`)}`;
    const credential_fact_id = `devcred_${sha256Hex(`device_credential_issued_v1|${auth.tenant_id}|${device_id}|${credential_id}|${credential_hash}`)}`;

    const register_record = {
      type: "device_registered_v1",
      entity: { tenant_id: auth.tenant_id, device_id },
      payload: { display_name, created_ts_ms: now_ms, actor_id: auth.actor_id, token_id: auth.token_id },
    };

    const credential_record = {
      type: "device_credential_issued_v1",
      entity: { tenant_id: auth.tenant_id, device_id },
      payload: { credential_id, credential_hash, issued_ts_ms: now_ms, status: "ACTIVE", actor_id: auth.actor_id, token_id: auth.token_id },
    };

    const clientConn = await pool.connect();
    try {
      await clientConn.query("BEGIN");

      await clientConn.query(
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [register_fact_id, occurred_iso, "control", JSON.stringify(register_record)]
      );

      await clientConn.query(
        `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, created_ts_ms, last_credential_id, last_credential_status)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
         ON CONFLICT (tenant_id, device_id)
         DO UPDATE SET display_name = EXCLUDED.display_name, last_credential_id = EXCLUDED.last_credential_id, last_credential_status = EXCLUDED.last_credential_status`,
        [auth.tenant_id, device_id, display_name, now_ms, credential_id]
      );

      await clientConn.query(
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [credential_fact_id, occurred_iso, "control", JSON.stringify(credential_record)]
      );

      await clientConn.query(
        `INSERT INTO device_credential_index_v1 (tenant_id, device_id, credential_id, credential_hash, status, issued_ts_ms, revoked_ts_ms)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5, NULL)
         ON CONFLICT (tenant_id, device_id, credential_id)
         DO UPDATE SET credential_hash = EXCLUDED.credential_hash, status = 'ACTIVE', issued_ts_ms = EXCLUDED.issued_ts_ms, revoked_ts_ms = NULL`,
        [auth.tenant_id, device_id, credential_id, credential_hash, now_ms]
      );

      await clientConn.query("COMMIT");
    } catch (e: any) {
      try { await clientConn.query("ROLLBACK"); } catch {}
      return reply.status(500).send({ ok: false, error: "DB_ERROR", message: String(e?.message ?? e) });
    } finally {
      clientConn.release();
    }

    return reply.send({
      ok: true,
      tenant_id: auth.tenant_id,
      device_id,
      display_name,
      credential_id,
      credential_secret: secret,
      credential_hash,
      access_info: buildAccessInfo(auth.tenant_id, device_id),
      register_fact_id,
      credential_fact_id,
    });
  });

  app.get("/api/v1/devices/:device_id/onboarding-status", async (req, reply) => { // Device onboarding progress: registration/credential/first telemetry.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.read");
    if (!auth) return;

    const params: any = (req as any).params ?? {};
    const device_id = normalizeDeviceId(params.device_id);
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id");

    const q = await pool.query(
      `SELECT
          d.device_id,
          d.display_name,
          d.created_ts_ms,
          d.last_credential_id,
          d.last_credential_status,
          s.last_telemetry_ts_ms,
          s.last_heartbeat_ts_ms,
          CASE WHEN s.last_telemetry_ts_ms IS NOT NULL THEN true ELSE false END AS has_first_telemetry
         FROM device_index_v1 d
         LEFT JOIN device_status_index_v1 s
           ON s.tenant_id = d.tenant_id AND s.device_id = d.device_id
        WHERE d.tenant_id = $1 AND d.device_id = $2
        LIMIT 1`,
      [auth.tenant_id, device_id]
    );

    if ((q.rowCount ?? 0) < 1) return notFound(reply);

    const row: any = q.rows[0];
    const registration_completed = typeof row.created_ts_ms === "number" || Number.isFinite(Number(row.created_ts_ms));
    const credential_ready = typeof row.last_credential_id === "string" && row.last_credential_id.length > 0 && row.last_credential_status === "ACTIVE";
    const first_telemetry_uploaded = Boolean(row.has_first_telemetry);

    return reply.send({
      ok: true,
      tenant_id: auth.tenant_id,
      device_id: row.device_id,
      display_name: row.display_name ?? null,
      registration_completed,
      credential_ready,
      first_telemetry_uploaded,
      created_ts_ms: row.created_ts_ms == null ? null : Number(row.created_ts_ms),
      last_credential_id: row.last_credential_id ?? null,
      last_credential_status: row.last_credential_status ?? null,
      last_heartbeat_ts_ms: row.last_heartbeat_ts_ms == null ? null : Number(row.last_heartbeat_ts_ms),
      last_telemetry_ts_ms: row.last_telemetry_ts_ms == null ? null : Number(row.last_telemetry_ts_ms),
      access_info: buildAccessInfo(auth.tenant_id, device_id),
    });
  });
} // End registration.
