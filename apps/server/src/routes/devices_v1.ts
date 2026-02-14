// GEOX/apps/server/src/routes/devices_v1.ts

import crypto from "node:crypto"; // Node crypto for deterministic ids and credential hashing.
import type { FastifyInstance } from "fastify"; // Fastify app instance for route registration.
import type { Pool } from "pg"; // Postgres connection pool for db access.

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0"; // Reuse Sprint 19 token/scope auth (tenant isolation + scopes).
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
    if (!auth) return; // Auth helper already responded.

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
    if (!auth) return; // Auth helper already responded.

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
} // End registration.
