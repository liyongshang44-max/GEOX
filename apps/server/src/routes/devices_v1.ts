// GEOX/apps/server/src/routes/devices_v1.ts

import crypto from "node:crypto"; // Node crypto for deterministic ids and credential hashing.
import type { FastifyInstance } from "fastify"; // Fastify app instance for route registration.
import type { Pool } from "pg"; // Postgres connection pool for db access.

import { requireAoActScopeV0, requireAoActAdminV0 } from "../auth/ao_act_authz_v0"; // Reuse Sprint 19 token/scope auth (tenant isolation + scopes).
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0"; // Auth context includes tenant/project/group ids.
import { getDeviceTemplateOrThrow } from "../domain/device_templates/device_templates_v1";
import { ensureDeviceSkillBindings } from "../services/device_skill_bindings";
import { ensureDeviceSkillBindingStatusRuntimeV1, reconcileDeviceTemplateSkillBindingsV1 } from "../services/skill_binding_validation_service_v1";

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

function normalizeDeviceMode(v: any): "real" | "simulator" | null {
  if (v == null || v === "") return "simulator";
  const s = String(v).trim().toLowerCase();
  if (s === "real" || s === "simulator") return s;
  return null;
}

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
    cmd_topic: `/device/${device_id}/cmd`,
    ack_topic: `/device/${device_id}/ack`,
    payload_contract_version: "v1",
    auth_mode: "DEVICE_CREDENTIAL_SECRET_ONCE",
    secret_warning: "设备密钥仅在签发时返回一次；平台只保存哈希，不保存明文 secret。",
  };
}

function relativeTimeLabel(tsMs: number | null | undefined): string {
  if (!Number.isFinite(Number(tsMs))) return "-";
  const delta = Date.now() - Number(tsMs);
  if (delta < 60_000) return "刚刚";
  if (delta < 3_600_000) return `${Math.max(1, Math.floor(delta / 60_000))} 分钟前`;
  if (delta < 86_400_000) return `${Math.max(1, Math.floor(delta / 3_600_000))} 小时前`;
  return `${Math.max(1, Math.floor(delta / 86_400_000))} 天前`;
}

function deviceStatusMeta(status: string | null | undefined): { code: string; label: string; tone: "success" | "warning" } {
  const code = String(status ?? "").toUpperCase() === "ONLINE" ? "ONLINE" : "OFFLINE";
  return { code, label: code === "ONLINE" ? "在线" : "离线", tone: code === "ONLINE" ? "success" : "warning" };
}

function normalizeCapabilities(input: any): string[] | null {
  if (!Array.isArray(input)) return null;
  const allowed = new Set(["irrigation", "valve"]);
  const normalized = Array.from(
    new Set(
      input
        .map((v) => String(v ?? "").trim().toLowerCase())
        .filter((v) => allowed.has(v))
    )
  );
  return normalized;
}

function parseDeviceTemplateOrReply(body: any, reply: any): string | null {
  const rawTemplate = typeof body?.device_template === "string"
    ? body.device_template
    : body?.template_code;
  const device_template = typeof rawTemplate === "string" ? rawTemplate.trim() : "";
  if (!device_template) {
    badRequest(reply, "MISSING_OR_INVALID:device_template");
    return null;
  }
  try {
    getDeviceTemplateOrThrow(device_template);
    return device_template;
  } catch {
    badRequest(reply, `UNKNOWN_TEMPLATE_CODE:${device_template}`);
    return null;
  }
}

let ensureDeviceCapabilityRuntimePromise: Promise<void> | null = null;
let ensureDeviceModeRuntimePromise: Promise<void> | null = null;

async function ensureDeviceCapabilityRuntime(pool: Pool): Promise<void> {
  if (!ensureDeviceCapabilityRuntimePromise) {
    ensureDeviceCapabilityRuntimePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS device_capability (
          tenant_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
          updated_ts_ms BIGINT NOT NULL,
          PRIMARY KEY (tenant_id, device_id)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS device_capability_lookup_idx ON device_capability (tenant_id, device_id)`);
    })().catch((err) => {
      ensureDeviceCapabilityRuntimePromise = null;
      throw err;
    });
  }
  await ensureDeviceCapabilityRuntimePromise;
}

async function ensureDeviceModeRuntime(pool: Pool): Promise<void> {
  if (!ensureDeviceModeRuntimePromise) {
    ensureDeviceModeRuntimePromise = (async () => {
      await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS device_mode TEXT NOT NULL DEFAULT 'simulator'`);
    })().catch((err) => {
      ensureDeviceModeRuntimePromise = null;
      throw err;
    });
  }
  await ensureDeviceModeRuntimePromise;
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
    const device_mode = normalizeDeviceMode(body.device_mode);
    if (!device_mode) return badRequest(reply, "MISSING_OR_INVALID:device_mode");
    const device_template = parseDeviceTemplateOrReply(body, reply);
    if (!device_template) return;

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
        device_mode,
        device_template,
        created_ts_ms, // Creation timestamp in ms.
        actor_id: auth.actor_id, // Actor for audit.
        token_id: auth.token_id, // Token id for audit.
      }, // End payload.
    }; // End record.
    await ensureDeviceModeRuntime(pool);

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
        `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, device_mode, created_ts_ms, last_credential_id, last_credential_status)
         VALUES ($1, $2, $3, $4, $5, NULL, NULL)
         ON CONFLICT (tenant_id, device_id)
         DO UPDATE SET display_name = EXCLUDED.display_name, device_mode = EXCLUDED.device_mode`,
        [auth.tenant_id, device_id, display_name, device_mode, created_ts_ms]
      ); // End upsert.
      await reconcileDeviceTemplateSkillBindingsV1(clientConn, {
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        device_id,
        template_code: device_template,
        missing_required_mode: "autofill",
      });

      await clientConn.query("COMMIT"); // Commit.
    } catch (e: any) { // Error handler.
      try { await clientConn.query("ROLLBACK"); } catch {} // Rollback best-effort.
      return reply.status(500).send({ ok: false, error: "DB_ERROR", message: String(e?.message ?? e) }); // Surface error (dev-only).
    } finally { // Release connection.
      clientConn.release(); // Release back to pool.
    } // End tx.

    return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, display_name, device_mode, device_template, template_code: device_template, fact_id }); // Return success.
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
    if (device_id === "register") return badRequest(reply, "RESERVED_DEVICE_ID:register"); // Avoid confusion with onboarding register endpoint.

    const body: any = (req as any).body ?? {}; // Body.
    const display_name = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 200) : ""; // Optional name.
    const device_mode = normalizeDeviceMode(body.device_mode);
    if (!device_mode) return badRequest(reply, "MISSING_OR_INVALID:device_mode");
    const device_template = parseDeviceTemplateOrReply(body, reply);
    if (!device_template) return;

    const now_ms = Date.now(); // Server time.
    const occurred_iso = nowIso(now_ms); // occurred_at.

    const det = sha256Hex(`device_registered_v1|${auth.tenant_id}|${device_id}|${display_name}`); // Deterministic hash.
    const fact_id = `device_${det}`; // Fact id.

    const record = { // Append-only fact record.
      type: "device_registered_v1", // Fact type.
      entity: { tenant_id: auth.tenant_id, device_id }, // Entity.
      payload: { display_name, device_mode, device_template, created_ts_ms: now_ms, actor_id: auth.actor_id, token_id: auth.token_id }, // Payload.
    }; // End record.
    await ensureDeviceModeRuntime(pool);

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
        `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, device_mode, created_ts_ms, last_credential_id, last_credential_status)
         VALUES ($1, $2, $3, $4, $5, NULL, NULL)
         ON CONFLICT (tenant_id, device_id)
         DO UPDATE SET display_name = EXCLUDED.display_name, device_mode = EXCLUDED.device_mode`,
        [auth.tenant_id, device_id, display_name, device_mode, now_ms]
      ); // End upsert.
      await reconcileDeviceTemplateSkillBindingsV1(clientConn, {
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        device_id,
        template_code: device_template,
        missing_required_mode: "autofill",
      });

      await clientConn.query("COMMIT"); // Commit.
    } catch (e: any) { // Error.
      try { await clientConn.query("ROLLBACK"); } catch {} // Rollback.
      return reply.status(500).send({ ok: false, error: "DB_ERROR", message: String(e?.message ?? e) }); // Return.
    } finally { // Release.
      clientConn.release(); // Release.
    } // End tx.

    const skillBindings = await ensureDeviceSkillBindings({
      pool,
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      device_id,
      trigger: "DEVICE_CREATED",
      allow_write: true,
    });

    return reply.send({ ok: true, device_id, tenant_id: auth.tenant_id, device_mode, device_template, template_code: device_template, fact_id, skill_bindings: skillBindings }); // Response.
  }); // End /api/v1 register.

  app.get("/api/v1/devices", async (req, reply) => { // List devices for tenant with minimal运营摘要.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.read"); // Require devices.read.
    if (!auth) return; // Auth handled.
    await ensureDeviceSkillBindingStatusRuntimeV1(pool);
    await ensureDeviceModeRuntime(pool);

    const limit = 200; // Fixed list limit for commercial UI MVP.
    const q = await pool.query(
      `SELECT
          d.tenant_id,
          d.device_id,
          d.display_name,
          d.device_mode,
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
          COALESCE(sb.binding_status, 'binding_valid') AS binding_status,
          COALESCE(sb.missing_required_observation_skills_json, '[]'::jsonb) AS missing_required_observation_skills,
          CASE
            WHEN s.last_heartbeat_ts_ms IS NOT NULL AND s.last_heartbeat_ts_ms >= $3 THEN 'ONLINE'
            ELSE 'OFFLINE'
          END AS connection_status
        FROM device_index_v1 d
        LEFT JOIN device_binding_index_v1 b
          ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
        LEFT JOIN device_status_index_v1 s
          ON s.tenant_id = d.tenant_id AND s.device_id = d.device_id
        LEFT JOIN device_skill_binding_status_v1 sb
          ON sb.tenant_id = d.tenant_id
         AND sb.project_id = $4
         AND sb.group_id = $5
         AND sb.device_id = d.device_id
        WHERE d.tenant_id = $1
        ORDER BY d.created_ts_ms DESC
        LIMIT $2`,
      [auth.tenant_id, limit, Date.now() - 15 * 60 * 1000, auth.project_id, auth.group_id]
    ); // Query joined device summary.

    const devices = await Promise.all((q.rows ?? []).map(async (row: any) => {
      const health = await ensureDeviceSkillBindings({
        pool,
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        device_id: String(row.device_id ?? ""),
        trigger: "EXPLICIT_RECONCILE",
        allow_write: false,
      });
      return { ...row, binding_health: health.binding_health, binding_repair: health.repair };
    }));

    return reply.send({ ok: true, devices }); // Return summarized device list.
  }); // End list.

  app.put("/api/v1/devices/:device_id/capabilities", async (req, reply) => { // Upsert device capability projection + fact.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.write");
    if (!auth) return;

    const params: any = (req as any).params ?? {};
    const body: any = (req as any).body ?? {};
    const device_id = normalizeDeviceId(params.device_id);
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id");
    const capabilities = normalizeCapabilities(body.capabilities);
    if (!capabilities) return badRequest(reply, "MISSING_OR_INVALID:capabilities");

    await ensureDeviceCapabilityRuntime(pool);

    const existsQ = await pool.query(
      `SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`,
      [auth.tenant_id, device_id]
    );
    if ((existsQ.rowCount ?? 0) < 1) return notFound(reply);

    const updated_ts_ms = Date.now();
    const occurred_iso = nowIso(updated_ts_ms);
    const fact_id = `devcap_${sha256Hex(`device_capability_v1|${auth.tenant_id}|${device_id}|${capabilities.join(",")}`)}`;
    const record = {
      type: "device_capability_v1",
      entity: { tenant_id: auth.tenant_id, device_id },
      payload: { capabilities, updated_ts_ms, actor_id: auth.actor_id, token_id: auth.token_id }
    };

    const clientConn = await pool.connect();
    try {
      await clientConn.query("BEGIN");
      await clientConn.query(
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [fact_id, occurred_iso, "control", JSON.stringify(record)]
      );
      await clientConn.query(
        `INSERT INTO device_capability (tenant_id, device_id, capabilities, updated_ts_ms)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (tenant_id, device_id)
         DO UPDATE SET capabilities = EXCLUDED.capabilities, updated_ts_ms = EXCLUDED.updated_ts_ms`,
        [auth.tenant_id, device_id, JSON.stringify(capabilities), updated_ts_ms]
      );
      await clientConn.query("COMMIT");
    } catch (e: any) {
      try { await clientConn.query("ROLLBACK"); } catch {}
      return reply.status(500).send({ ok: false, error: "DB_ERROR", message: String(e?.message ?? e) });
    } finally {
      clientConn.release();
    }

    return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, capabilities, updated_ts_ms, fact_id });
  });

  app.get("/api/v1/devices/:device_id/capabilities", async (req, reply) => { // Read device capability projection.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.read");
    if (!auth) return;
    const device_id = normalizeDeviceId((req.params as any)?.device_id);
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id");

    await ensureDeviceCapabilityRuntime(pool);

    const q = await pool.query(
      `SELECT capabilities, updated_ts_ms
         FROM device_capability
        WHERE tenant_id = $1 AND device_id = $2
        LIMIT 1`,
      [auth.tenant_id, device_id]
    );
    if ((q.rowCount ?? 0) < 1) return notFound(reply);

    const row: any = q.rows[0];
    const capabilities = Array.isArray(row.capabilities) ? row.capabilities.map((v: any) => String(v)) : [];
    return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, capabilities, updated_ts_ms: Number(row.updated_ts_ms) });
  });



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
    await ensureDeviceCapabilityRuntime(pool);
    const capabilityQ = await pool.query(
      `SELECT capabilities, updated_ts_ms
         FROM device_capability
        WHERE tenant_id = $1 AND device_id = $2
        LIMIT 1`,
      [auth.tenant_id, device_id]
    );
    const capabilityRow: any = capabilityQ.rows?.[0] ?? null;

    const access_info = buildAccessInfo(auth.tenant_id, device_id); // Deterministic integration hints used by the device console page.

    return reply.send({ // Return console aggregate payload.
      ok: true, // Success envelope.
      device: existsQ.rows[0], // Base device summary.
      capabilities: Array.isArray(capabilityRow?.capabilities) ? capabilityRow.capabilities : [],
      capabilities_updated_ts_ms: capabilityRow?.updated_ts_ms == null ? null : Number(capabilityRow.updated_ts_ms),
      access_info, // Integration hints and warnings.
      credentials: credentialsQ.rows ?? [], // Recent credential summaries.
      recent_commands: commandsQ.rows ?? [], // Recent command history.
      recent_receipts: receiptsQ.rows ?? [], // Recent device receipt history.
    }); // End response.
  }); // End device console route.

  app.get("/api/v1/devices/:device_id/control-plane", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.read");
    if (!auth) return;
    const params: any = (req as any).params ?? {};
    const device_id = normalizeDeviceId(params.device_id);
    if (!device_id) return notFound(reply);

    const detailQ = await pool.query(
      `SELECT
          d.device_id,
          d.display_name,
          d.last_credential_id,
          d.last_credential_status,
          b.field_id,
          b.bound_ts_ms,
          f.name AS field_name,
          s.last_telemetry_ts_ms,
          s.last_heartbeat_ts_ms,
          s.battery_percent,
          s.fw_ver,
          s.rssi_dbm,
          CASE WHEN s.last_heartbeat_ts_ms IS NOT NULL AND s.last_heartbeat_ts_ms >= $3 THEN 'ONLINE' ELSE 'OFFLINE' END AS connection_status
       FROM device_index_v1 d
       LEFT JOIN device_binding_index_v1 b ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
       LEFT JOIN field_index_v1 f ON f.tenant_id = d.tenant_id AND f.field_id = b.field_id
       LEFT JOIN device_status_index_v1 s ON s.tenant_id = d.tenant_id AND s.device_id = d.device_id
      WHERE d.tenant_id = $1 AND d.device_id = $2
      LIMIT 1`,
      [auth.tenant_id, device_id, Date.now() - 15 * 60 * 1000]
    );
    if ((detailQ.rowCount ?? 0) < 1) return notFound(reply);
    const row: any = detailQ.rows[0];
    const status = deviceStatusMeta(row.connection_status);

    const access_info = buildAccessInfo(auth.tenant_id, device_id);
    const commandsQ = await pool.query(
      `SELECT dq.act_task_id, dq.state, EXTRACT(EPOCH FROM dq.created_at) * 1000 AS ts_ms, COALESCE((task_fact.record_json::jsonb #>> '{payload,action_type}'), '') AS action_type
       FROM dispatch_queue_v1 dq
       LEFT JOIN facts task_fact ON task_fact.fact_id = dq.task_fact_id
       WHERE dq.tenant_id = $1 AND dq.device_id = $2
       ORDER BY dq.created_at DESC, dq.queue_id DESC
       LIMIT 20`,
      [auth.tenant_id, device_id]
    );
    const receiptsQ = await pool.query(
      `SELECT fact_id, (record_json::jsonb #>> '{payload,status}') AS status, ((record_json::jsonb #>> '{payload,created_at_ts}'))::bigint AS ts_ms
         FROM facts
        WHERE (record_json::jsonb ->> 'type') = 'ao_act_device_ack_received_v1'
          AND (record_json::jsonb #>> '{payload,tenant_id}') = $1
          AND (record_json::jsonb #>> '{payload,device_id}') = $2
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 20`,
      [auth.tenant_id, device_id]
    );

    const latestCommand: any = (commandsQ.rows ?? [])[0] ?? null;
    const latestReceipt: any = (receiptsQ.rows ?? [])[0] ?? null;
    const nowTs = Date.now();
    const updatedTs = Number(row.last_heartbeat_ts_ms ?? row.last_telemetry_ts_ms ?? nowTs);

    return reply.send({
      ok: true,
      item: {
        device: {
          device_id: row.device_id,
          display_name: row.display_name || row.device_id,
          title: row.display_name || row.device_id,
          subtitle: "用于查看设备在线状态、接入信息、最近命令与执行回执。",
          status,
          updated_ts_ms: updatedTs,
          updated_at_label: relativeTimeLabel(updatedTs)
        },
        summary: {
          online_status: status,
          bound_field: {
            field_id: row.field_id,
            field_name: row.field_name || row.field_id || "未绑定",
            bound_ts_ms: row.bound_ts_ms == null ? null : Number(row.bound_ts_ms),
            bound_at_label: row.bound_ts_ms == null ? "未绑定" : "近期已绑定"
          },
          recent_commands: { count: commandsQ.rows?.length ?? 0, label: "最近 20 条 device 定向下发" },
          recent_receipts: { count: receiptsQ.rows?.length ?? 0, label: "设备 ACK / 执行回执留痕" }
        },
        overview: {
          device_id: row.device_id,
          display_name: row.display_name || row.device_id,
          credential_id: row.last_credential_id,
          credential_status: {
            code: String(row.last_credential_status ?? "UNKNOWN").toUpperCase(),
            label: String(row.last_credential_status ?? "").toUpperCase() === "ACTIVE" ? "有效" : "无效",
            tone: String(row.last_credential_status ?? "").toUpperCase() === "ACTIVE" ? "success" : "warning"
          },
          last_heartbeat_ts_ms: row.last_heartbeat_ts_ms == null ? null : Number(row.last_heartbeat_ts_ms),
          last_heartbeat_label: relativeTimeLabel(row.last_heartbeat_ts_ms == null ? null : Number(row.last_heartbeat_ts_ms)),
          last_telemetry_ts_ms: row.last_telemetry_ts_ms == null ? null : Number(row.last_telemetry_ts_ms),
          last_telemetry_label: relativeTimeLabel(row.last_telemetry_ts_ms == null ? null : Number(row.last_telemetry_ts_ms)),
          battery_percent: row.battery_percent == null ? null : Number(row.battery_percent),
          fw_ver: row.fw_ver ?? null,
          rssi_dbm: row.rssi_dbm == null ? null : Number(row.rssi_dbm)
        },
        connectivity: {
          mqtt_client_id: access_info.mqtt_client_id,
          telemetry_topic: access_info.telemetry_topic,
          heartbeat_topic: access_info.heartbeat_topic,
          downlink_topic: access_info.downlink_topic,
          receipt_topic: access_info.receipt_topic,
          protocol_version: access_info.payload_contract_version
        },
        latest_command: latestCommand ? {
          command_id: latestCommand.act_task_id,
          title: latestCommand.action_type || "设备命令",
          status: { code: String(latestCommand.state ?? "DISPATCHED").toUpperCase(), label: "已下发", tone: "info" },
          ts_ms: Number(latestCommand.ts_ms ?? nowTs),
          ts_label: relativeTimeLabel(Number(latestCommand.ts_ms ?? nowTs)),
          summary: "最新作业命令已发送到设备执行链路。"
        } : null,
        latest_receipt: latestReceipt ? {
          receipt_fact_id: latestReceipt.fact_id,
          title: "执行回执",
          status: { code: String(latestReceipt.status ?? "EXECUTED").toUpperCase(), label: "已回执", tone: "success" },
          ts_ms: Number(latestReceipt.ts_ms ?? nowTs),
          ts_label: relativeTimeLabel(Number(latestReceipt.ts_ms ?? nowTs)),
          summary: "设备回执已记录。"
        } : null,
        lifecycle_hints: [
          { kind: "status", title: status.code === "ONLINE" ? "设备当前在线" : "设备当前离线", description: status.code === "ONLINE" ? "最近已收到心跳与遥测数据。" : "长时间未收到心跳，请检查网络与供电。" },
          { kind: "binding", title: row.field_id ? "设备已绑定田块" : "设备尚未绑定田块", description: row.field_id ? `当前绑定到 ${row.field_name || row.field_id}。` : "请先绑定田块，便于联动作业编排。" },
          { kind: "credential", title: String(row.last_credential_status ?? "").toUpperCase() === "ACTIVE" ? "凭据状态正常" : "凭据状态异常", description: String(row.last_credential_status ?? "").toUpperCase() === "ACTIVE" ? "当前凭据有效，可继续接入。" : "请签发新凭据或检查凭据状态。" }
        ],
        recent_activity: {
          commands: (commandsQ.rows ?? []).map((x: any) => ({ id: x.act_task_id, title: x.action_type || "设备命令", status: { code: String(x.state ?? "DISPATCHED").toUpperCase(), label: "已下发", tone: "info" }, ts_label: relativeTimeLabel(Number(x.ts_ms ?? nowTs)) })),
          receipts: (receiptsQ.rows ?? []).map((x: any) => ({ id: x.fact_id, title: "执行回执", status: { code: String(x.status ?? "EXECUTED").toUpperCase(), label: "已回执", tone: "success" }, ts_label: relativeTimeLabel(Number(x.ts_ms ?? nowTs)) }))
        },
        technical_details: {
          device_id: row.device_id,
          credential_id: row.last_credential_id,
          raw_status: row.connection_status,
          mqtt_client_id: access_info.mqtt_client_id,
          topics: {
            telemetry: access_info.telemetry_topic,
            heartbeat: access_info.heartbeat_topic,
            downlink: access_info.downlink_topic,
            receipt: access_info.receipt_topic
          }
        }
      }
    });
  });

  app.get("/api/v1/devices/:device_id", async (req, reply) => { // Get a single device with绑定/状态/最近遥测摘要.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.read"); // Require devices.read.
    if (!auth) return; // Auth handled.

    const params: any = (req as any).params ?? {}; // Params.
    const device_id = normalizeDeviceId(params.device_id); // Normalize.
    if (!device_id) return notFound(reply); // Invalid -> 404.
    await ensureDeviceSkillBindingStatusRuntimeV1(pool);
    await ensureDeviceModeRuntime(pool);

    const q = await pool.query(
      `SELECT
          d.tenant_id,
          d.device_id,
          d.display_name,
          d.device_mode,
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
          COALESCE(sb.binding_status, 'binding_valid') AS binding_status,
          COALESCE(sb.missing_required_observation_skills_json, '[]'::jsonb) AS missing_required_observation_skills,
          CASE
            WHEN s.last_heartbeat_ts_ms IS NOT NULL AND s.last_heartbeat_ts_ms >= $3 THEN 'ONLINE'
            ELSE 'OFFLINE'
          END AS connection_status
         FROM device_index_v1 d
         LEFT JOIN device_binding_index_v1 b
           ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
         LEFT JOIN device_status_index_v1 s
           ON s.tenant_id = d.tenant_id AND s.device_id = d.device_id
         LEFT JOIN device_skill_binding_status_v1 sb
           ON sb.tenant_id = d.tenant_id
          AND sb.project_id = $4
          AND sb.group_id = $5
          AND sb.device_id = d.device_id
        WHERE d.tenant_id = $1 AND d.device_id = $2
        LIMIT 1`,
      [auth.tenant_id, device_id, Date.now() - 15 * 60 * 1000, auth.project_id, auth.group_id]
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
    await ensureDeviceCapabilityRuntime(pool);
    const capabilityQ = await pool.query(
      `SELECT capabilities, updated_ts_ms
         FROM device_capability
        WHERE tenant_id = $1 AND device_id = $2
        LIMIT 1`,
      [auth.tenant_id, device_id]
    );
    const capabilityRow: any = capabilityQ.rows?.[0] ?? null;

    return reply.send({
      ok: true,
      device: q.rows[0],
      capabilities: Array.isArray(capabilityRow?.capabilities) ? capabilityRow.capabilities : [],
      capabilities_updated_ts_ms: capabilityRow?.updated_ts_ms == null ? null : Number(capabilityRow.updated_ts_ms),
      latest_telemetry: latestTelemetryRows,
      ...(await ensureDeviceSkillBindings({
        pool,
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        device_id,
        trigger: "EXPLICIT_RECONCILE",
        allow_write: false,
      }))
    }); // Return enriched detail.
  }); // End get.

  app.post("/api/v1/devices/onboarding/register", async (req, reply) => { // Stable onboarding endpoint that cannot collide with :device_id route.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.write");
    if (!auth) return;

    const body: any = (req as any).body ?? {};
    const device_id = normalizeDeviceId(body.device_id);
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id");
    const device_mode = normalizeDeviceMode(body.device_mode);
    if (!device_mode) return badRequest(reply, "MISSING_OR_INVALID:device_mode");
    const device_template = parseDeviceTemplateOrReply(body, reply);
    if (!device_template) return;

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
      payload: { display_name, device_mode, device_template, created_ts_ms: now_ms, actor_id: auth.actor_id, token_id: auth.token_id },
    };
    await ensureDeviceModeRuntime(pool);

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
        `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, device_mode, created_ts_ms, last_credential_id, last_credential_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
         ON CONFLICT (tenant_id, device_id)
         DO UPDATE SET display_name = EXCLUDED.display_name, device_mode = EXCLUDED.device_mode, last_credential_id = EXCLUDED.last_credential_id, last_credential_status = EXCLUDED.last_credential_status`,
        [auth.tenant_id, device_id, display_name, device_mode, now_ms, credential_id]
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
      await reconcileDeviceTemplateSkillBindingsV1(clientConn, {
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        device_id,
        template_code: device_template,
        missing_required_mode: "autofill",
      });

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
      device_mode,
      device_template,
      template_code: device_template,
      credential_id,
      credential_secret: secret,
      credential_hash,
      access_info: buildAccessInfo(auth.tenant_id, device_id),
      register_fact_id,
      credential_fact_id,
      skill_bindings: await ensureDeviceSkillBindings({
        pool,
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        device_id,
        trigger: "DEVICE_CREATED",
        allow_write: true,
      }),
    });
  });

  app.post("/api/v1/devices/register", async (req, reply) => { // Device onboarding helper: register + issue credential in one step.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.write");
    if (!auth) return;

    const body: any = (req as any).body ?? {};
    const device_id = normalizeDeviceId(body.device_id);
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id");
    const device_mode = normalizeDeviceMode(body.device_mode);
    if (!device_mode) return badRequest(reply, "MISSING_OR_INVALID:device_mode");
    const device_template = parseDeviceTemplateOrReply(body, reply);
    if (!device_template) return;

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
      payload: { display_name, device_mode, device_template, created_ts_ms: now_ms, actor_id: auth.actor_id, token_id: auth.token_id },
    };
    await ensureDeviceModeRuntime(pool);

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
        `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, device_mode, created_ts_ms, last_credential_id, last_credential_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
         ON CONFLICT (tenant_id, device_id)
         DO UPDATE SET display_name = EXCLUDED.display_name, device_mode = EXCLUDED.device_mode, last_credential_id = EXCLUDED.last_credential_id, last_credential_status = EXCLUDED.last_credential_status`,
        [auth.tenant_id, device_id, display_name, device_mode, now_ms, credential_id]
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
      await reconcileDeviceTemplateSkillBindingsV1(clientConn, {
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        device_id,
        template_code: device_template,
        missing_required_mode: "autofill",
      });

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
      device_mode,
      device_template,
      template_code: device_template,
      credential_id,
      credential_secret: secret,
      credential_hash,
      access_info: buildAccessInfo(auth.tenant_id, device_id),
      register_fact_id,
      credential_fact_id,
      skill_bindings: await ensureDeviceSkillBindings({
        pool,
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        device_id,
        trigger: "DEVICE_CREATED",
        allow_write: true,
      }),
    });
  });

    app.post("/api/v1/devices/:device_id/credentials", async (req, reply) => { // Alias: issue credential under /api/v1 namespace.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.credentials.write");
    if (!auth) return;

    const device_id = normalizeDeviceId((req.params as any)?.device_id);
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id");

    const internalBaseUrl =
      process.env.GEOX_INTERNAL_BASE_URL ||
      process.env.INTERNAL_BASE_URL ||
      "http://127.0.0.1:3000";

    const delegated = await fetch(
      `${internalBaseUrl}/api/devices/${encodeURIComponent(device_id)}/credentials`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: String((req.headers as any)?.authorization ?? ""),
        },
        body: JSON.stringify((req as any).body ?? {}),
      }
    );

    const text = await delegated.text();
    let parsed: any = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }

    return reply.status(delegated.status).send(parsed);
  });

    app.post("/api/v1/devices/:device_id/credentials/:credential_id/revoke", async (req, reply) => { // Alias: revoke credential under /api/v1 namespace.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.credentials.revoke");
    if (!auth) return;

    const device_id = normalizeDeviceId((req.params as any)?.device_id);
    const credential_id = normalizeId((req.params as any)?.credential_id);
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id");
    if (!credential_id) return badRequest(reply, "MISSING_OR_INVALID:credential_id");

    const internalBaseUrl =
      process.env.GEOX_INTERNAL_BASE_URL ||
      process.env.INTERNAL_BASE_URL ||
      "http://127.0.0.1:3000";

    const delegated = await fetch(
      `${internalBaseUrl}/api/devices/${encodeURIComponent(device_id)}/credentials/${encodeURIComponent(credential_id)}/revoke`,
      {
        method: "POST",
        headers: {
          authorization: String((req.headers as any)?.authorization ?? ""),
        },
      }
    );

    const text = await delegated.text();
    let parsed: any = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }

    return reply.status(delegated.status).send(parsed);
  });

  app.post("/api/v1/devices/:device_id/skill-bindings/reconcile", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.write");
    if (!auth) return;

    const device_id = normalizeDeviceId((req.params as any)?.device_id);
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id");

    const existsQ = await pool.query(
      `SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`,
      [auth.tenant_id, device_id]
    );
    if ((existsQ.rowCount ?? 0) < 1) return notFound(reply);

    const ensured = await ensureDeviceSkillBindings({
      pool,
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      device_id,
      trigger: "EXPLICIT_RECONCILE",
      allow_write: true,
    });

    return reply.send({ ok: true, device_id, ...ensured });
  });

  app.get("/api/v1/devices/:device_id/onboarding-status", async (req, reply) => { // Device onboarding progress: registration/credential/first telemetry.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.read");
    if (!auth) return;
    await ensureDeviceModeRuntime(pool);

    const params: any = (req as any).params ?? {};
    const device_id = normalizeDeviceId(params.device_id);
    if (!device_id) return badRequest(reply, "MISSING_OR_INVALID:device_id");

    const q = await pool.query(
      `SELECT
          d.device_id,
          d.display_name,
          d.device_mode,
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
      device_mode: String(row.device_mode ?? "simulator"),
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
