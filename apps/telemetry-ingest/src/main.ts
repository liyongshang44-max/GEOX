// GEOX/apps/telemetry-ingest/src/main.ts

import crypto from "node:crypto"; // Node crypto for sha256 telemetry_id and deterministic fact_id.
import process from "node:process"; // Access environment variables and argv.
import { Pool } from "pg"; // Postgres client pool to write ledger + projection.
import mqtt from "mqtt"; // MQTT client for telemetry subscription.
import { z } from "zod"; // Runtime schema validation for incoming telemetry payloads.

const TelemetryPayloadSchema = z.object({ // Define minimal telemetry payload schema.
  metric: z.string().min(1), // Metric name (e.g., soil_moisture).
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]), // Metric value (simple scalar types).
  ts_ms: z.number().int().positive(), // Event timestamp in epoch milliseconds.
  credential: z.string().min(1), // Device credential secret (issued by /api/devices/:id/credentials).
}); // End schema.

function resolveDatabaseUrl(): string { // Resolve DATABASE_URL from env (same logic family as server).
  const direct = process.env.DATABASE_URL; // Preferred direct url.
  if (typeof direct === "string" && direct.length) return direct; // Return if provided.
  const host = process.env.PGHOST; // Postgres host.
  const port = process.env.PGPORT; // Postgres port.
  const user = process.env.PGUSER; // Postgres user.
  const pass = process.env.PGPASSWORD; // Postgres password.
  const db = process.env.PGDATABASE; // Postgres database name.
  if (host && port && user && db) { // Ensure required parts exist.
    const cred = pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}` : encodeURIComponent(user); // Assemble credentials.
    return `postgres://${cred}@${host}:${port}/${db}`; // Build connection string.
  } // End composite env branch.
  return ""; // Return empty if no configuration found.
} // End helper.

function sha256Hex(s: string): string { // Compute sha256 hex digest from string input.
  return crypto.createHash("sha256").update(s, "utf8").digest("hex"); // Hash and hex-encode.
} // End helper.

function parseTopic(topic: string): { tenant_id: string; device_id: string } | null { // Parse telemetry/{tenant}/{device} topic.
  const parts = topic.split("/").filter((p) => p.length > 0); // Split topic into path segments.
  if (parts.length !== 3) return null; // Must be exactly 3 segments.
  if (parts[0] !== "telemetry") return null; // First segment must be telemetry.
  const tenant_id = parts[1]; // Extract tenant id.
  const device_id = parts[2]; // Extract device id.
  if (!tenant_id || !device_id) return null; // Require non-empty ids.
  return { tenant_id, device_id }; // Return parsed ids.
} // End parser.

async function main(): Promise<void> { // Entry point.
  const argv = process.argv.slice(2); // Read CLI args after node/tsx.
  const once = argv.includes("--once"); // Optional: exit after first valid message (for smoke testing).

  const mqttUrl = process.env.MQTT_URL || "mqtt://127.0.0.1:1883"; // MQTT broker URL.
  const topicFilter = process.env.MQTT_TOPIC_FILTER || "telemetry/+/+"; // Topic wildcard for subscription.

  const databaseUrl = resolveDatabaseUrl(); // Resolve Postgres URL.
  if (!databaseUrl) { // Validate Postgres config exists.
    throw new Error("MISSING_DATABASE_URL: set DATABASE_URL or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE"); // Crash fast with guidance.
  } // End validation.

  const pool = new Pool({ connectionString: databaseUrl }); // Create Postgres pool.

  const client = mqtt.connect(mqttUrl, { // Connect to MQTT broker.
    reconnectPeriod: 1000, // Reconnect every 1s on disconnect.
    connectTimeout: 10_000, // Fail connection attempt after 10s.
  }); // End connect.

  let ready = false; // Gate message handling until subscription is confirmed (avoid misleading log order).
  const seen = new Map<string, number>(); // Small in-memory dedupe map for repeated drops/logs.

  function seenRecently(key: string, windowMs: number): boolean { // Return true if key observed within window.
    const now = Date.now(); // Current time in ms.
    const prev = seen.get(key); // Previous timestamp.
    // Opportunistic pruning to keep map bounded.
    if (seen.size > 500) { // Simple cap to avoid unbounded growth in long-running dev.
      for (const [k, ts] of seen) { // Iterate keys.
        if (now - ts > 60_000) seen.delete(k); // Drop entries older than 60s.
      }
    }
    if (typeof prev === "number" && now - prev <= windowMs) return true; // Recently seen.
    seen.set(key, now); // Record observation.
    return false; // Not seen recently.
  } // End helper.

  client.on("connect", () => { // MQTT connect handler.
    client.subscribe(topicFilter, (err) => { // Subscribe to telemetry topics.
      if (err) { // Subscription error.
        // eslint-disable-next-line no-console
        console.error("[telemetry-ingest] subscribe_error", err); // Log error.
        ready = false; // Do not process messages until a successful subscribe.
        return; // Abort.
      }
      // Important: print these logs only after subscription callback completes, so they never appear after ok/drop.
      // eslint-disable-next-line no-console
      console.log(`[telemetry-ingest] connected mqtt=${mqttUrl}`); // Log connection (after subscribe confirms).
      // eslint-disable-next-line no-console
      console.log(`[telemetry-ingest] subscribed ${topicFilter}`); // Log subscription success.
      ready = true; // Enable message handling only after subscribe is confirmed.
    }); // End subscribe.
  }); // End connect handler.

  client.on("message", async (topic, payloadBuf) => { // Message handler for every incoming telemetry event.
    if (!ready) return; // Ignore messages until subscribe callback confirms readiness.

    const parsed = parseTopic(topic); // Parse topic path for tenant/device.
    if (!parsed) return; // Ignore unexpected topics (defense in depth).

    const payloadText = payloadBuf.toString("utf8"); // Decode payload as UTF-8 text.
    const msgKeyBase = sha256Hex(`${topic}|${payloadText}`); // Stable message key base for dedupe.
    let payloadJson: any = null; // Placeholder for parsed JSON.
    try { // Attempt JSON parse.
      payloadJson = JSON.parse(payloadText); // Parse JSON payload.
    } catch { // Invalid JSON.
      // eslint-disable-next-line no-console
      console.warn("[telemetry-ingest] drop_invalid_json", { topic }); // Log drop reason.
      return; // Drop invalid message.
    } // End parse.

    const parsedPayload = TelemetryPayloadSchema.safeParse(payloadJson); // Validate against schema.
    if (!parsedPayload.success) { // Schema validation failed.
      // eslint-disable-next-line no-console
      console.warn("[telemetry-ingest] drop_invalid_schema", { topic, issues: parsedPayload.error.issues }); // Log issues.
      return; // Drop invalid message.
    } // End schema check.

    const p = parsedPayload.data; // Extract validated payload.
    const occurredAtIso = new Date(p.ts_ms).toISOString(); // Convert ts_ms to ISO string.

    const provided_hash = sha256Hex(String(p.credential)); // Hash provided credential for comparison (secret never stored).

    const telemetry_id = sha256Hex(`${parsed.tenant_id}|${parsed.device_id}|${p.metric}|${p.ts_ms}`); // Deterministic telemetry id for idempotency.
    const fact_id = `tel_${telemetry_id}`; // Deterministic fact id to leverage facts primary key idempotency.

    const record = { // Construct ledger record_json envelope.
      type: "raw_telemetry_v1", // Fact type identifier.
      entity: { // Entity scope for isolation and future joins.
        tenant_id: parsed.tenant_id, // Tenant id from topic.
        device_id: parsed.device_id, // Device id from topic.
      }, // End entity.
      payload: { // Payload section for measurement.
        metric: p.metric, // Metric name.
        value: p.value, // Metric value.
        ts_ms: p.ts_ms, // Timestamp ms.
        telemetry_id, // Deterministic telemetry id.
        credential_hash: provided_hash, // Credential hash used for auth (secret never stored).
      }, // End payload.
    }; // End record.

    const recordText = JSON.stringify(record); // Serialize record_json for ledger insert.

    // Normalize value for projection (both numeric and text representations).
    const value_num = typeof p.value === "number" && Number.isFinite(p.value) ? p.value : null; // Numeric value if finite.
    const value_text = p.value === null ? null : String(p.value); // Text representation (null stays null).

    const clientConn = await pool.connect(); // Acquire a db connection for transaction. // Acquire a db connection for transaction.
    try { // Transaction scope.
      await clientConn.query("BEGIN"); // Start transaction.

      // Enforce device registration (Sprint A2).
      const devExists = await clientConn.query(
        `SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`,
        [parsed.tenant_id, parsed.device_id]
      ); // Check device registration.
      if ((devExists.rows ?? []).length < 1) { // Unregistered device.
        await clientConn.query("ROLLBACK"); // Rollback and drop message.
        const k = `drop_unregistered_device|${msgKeyBase}`; // Dedupe key.
        if (!seenRecently(k, 2000)) { // Avoid duplicate logs from QoS redelivery.
          // eslint-disable-next-line no-console
          console.warn("[telemetry-ingest] drop_unregistered_device", { tenant_id: parsed.tenant_id, device_id: parsed.device_id }); // Log drop.
        }
        return; // Stop processing.
      } // End registration gate.

      // Enforce an active credential match (Sprint A2).
      const credRow = await clientConn.query(
        `SELECT credential_hash, credential_id
         FROM device_credential_index_v1
         WHERE tenant_id = $1 AND device_id = $2 AND status = 'ACTIVE'
         ORDER BY issued_ts_ms DESC
         LIMIT 1`,
        [parsed.tenant_id, parsed.device_id]
      ); // Load most recent ACTIVE credential.
      if ((credRow.rows ?? []).length < 1) { // No active credential.
        await clientConn.query("ROLLBACK"); // Rollback and drop message.
        const k = `drop_missing_active_credential|${msgKeyBase}`; // Dedupe key.
        if (!seenRecently(k, 2000)) { // Avoid duplicate logs from QoS redelivery.
          // eslint-disable-next-line no-console
          console.warn("[telemetry-ingest] drop_missing_active_credential", { tenant_id: parsed.tenant_id, device_id: parsed.device_id }); // Log drop.
        }
        return; // Stop processing.
      } // End credential presence gate.

      const expected_hash = String(credRow.rows[0].credential_hash); // Expected credential hash from projection.
      if (expected_hash !== provided_hash) { // Credential mismatch.
        await clientConn.query("ROLLBACK"); // Rollback and drop message.
        const k = `drop_bad_credential|${msgKeyBase}`; // Dedupe key.
        if (!seenRecently(k, 2000)) { // Avoid duplicate logs from QoS redelivery.
          // eslint-disable-next-line no-console
          console.warn("[telemetry-ingest] drop_bad_credential", { tenant_id: parsed.tenant_id, device_id: parsed.device_id, credential_id: String(credRow.rows[0].credential_id) }); // Log drop.
        }
        return; // Stop processing.
      } // End credential match gate.

      // Insert into append-only ledger (facts).
      await clientConn.query(
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [fact_id, occurredAtIso, "gateway", recordText]
      ); // End ledger insert.

      // Insert into telemetry projection for fast querying.
      const projRes = await clientConn.query(
        `INSERT INTO telemetry_index_v1 (tenant_id, device_id, metric, ts, value_num, value_text, fact_id)
         VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7)
         ON CONFLICT (tenant_id, device_id, metric, ts) DO NOTHING
         RETURNING fact_id`,
        [parsed.tenant_id, parsed.device_id, p.metric, occurredAtIso, value_num, value_text, fact_id]
      ); // End projection insert.

      await clientConn.query("COMMIT"); // Commit transaction.

      // If projection insert was a no-op, this message is a duplicate delivery. Stay silent.
      if (!projRes || typeof projRes.rowCount !== "number" || projRes.rowCount < 1) { return; }

      // eslint-disable-next-line no-console
      console.log("[telemetry-ingest] ok", { tenant_id: parsed.tenant_id, device_id: parsed.device_id, metric: p.metric, ts_ms: p.ts_ms }); // Log success.

      if (once) { // If running in one-shot mode, exit after first success.
        client.end(true); // Disconnect MQTT client immediately.
        await pool.end(); // Close Postgres pool.
        process.exit(0); // Exit process successfully.
      } // End once mode.
    } catch (e: any) { // Error handler.
      try { // Attempt rollback if needed.
        await clientConn.query("ROLLBACK"); // Rollback transaction.
      } catch { // Ignore rollback errors.
        // no-op
      } // End rollback attempt.
      // eslint-disable-next-line no-console
      console.error("[telemetry-ingest] db_error", { err: String(e?.message ?? e) }); // Log db error.
    } finally { // Always release connection.
      clientConn.release(); // Release back to pool.
    } // End transaction scope.
  }); // End message handler.

  client.on("error", (err) => { // MQTT error handler.
    // eslint-disable-next-line no-console
    console.error("[telemetry-ingest] mqtt_error", err); // Log MQTT errors.
  }); // End handler.
} // End main.

main().catch((e) => { // Top-level promise rejection handler.
  // eslint-disable-next-line no-console
  console.error("[telemetry-ingest] fatal", e); // Log fatal error.
  process.exit(1); // Non-zero exit code.
}); // End bootstrap.
