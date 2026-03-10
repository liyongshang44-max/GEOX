// GEOX/apps/telemetry-ingest/src/main.ts

import crypto from "node:crypto"; // Node crypto for sha256 telemetry_id and deterministic fact_id.
import { randomUUID } from "node:crypto"; // UUID generator for alert event fact ids.
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

const HeartbeatPayloadSchema = z.object({ // Define minimal heartbeat payload schema.
  ts_ms: z.number().int().positive(), // Heartbeat timestamp in epoch milliseconds.
  battery_percent: z.number().int().min(0).max(100).optional(), // Optional battery percent.
  rssi_dbm: z.number().int().optional(), // Optional RSSI in dBm (negative).
  fw_ver: z.string().min(1).max(64).optional(), // Optional firmware version string.
  credential: z.string().min(1), // Device credential secret (same as telemetry).
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

function parseTopicWithKind(topic: string): { kind: "telemetry" | "heartbeat"; tenant_id: string; device_id: string } | null { // Parse telemetry/{tenant}/{device} or heartbeat/{tenant}/{device}.
  const parts = topic.split("/").filter((p) => p.length > 0); // Split topic into path segments.
  if (parts.length !== 3) return null; // Must be exactly 3 segments.
  const kind = parts[0]; // Kind segment.
  if (kind !== "telemetry" && kind !== "heartbeat") return null; // Only allow known kinds.
  const tenant_id = parts[1]; // Extract tenant id.
  const device_id = parts[2]; // Extract device id.
  if (!tenant_id || !device_id) return null; // Validate.
  return { kind: kind as any, tenant_id, device_id }; // Return parsed info.
} // End helper.

  client.on("connect", () => { // MQTT connect handler.
    client.subscribe([topicFilter, heartbeatFilter], (err) => { // Subscribe to telemetry + heartbeat topics.
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

    const parsed = parseTopicWithKind(topic); // Parse topic path for tenant/device.
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

    let kindPayload: any = null; // Placeholder for validated payload (telemetry or heartbeat).
if (parsed.kind === "telemetry") { // Telemetry branch.
  const parsedPayload = TelemetryPayloadSchema.safeParse(payloadJson); // Validate telemetry schema.
  if (!parsedPayload.success) { // Schema validation failed.
    // eslint-disable-next-line no-console
    console.warn("[telemetry-ingest] drop_invalid_schema", { topic, issues: parsedPayload.error.issues }); // Log issues.
    return; // Drop invalid message.
  } // End schema check.
  kindPayload = parsedPayload.data; // Extract validated telemetry payload.
} else { // Heartbeat branch.
  const parsedPayload = HeartbeatPayloadSchema.safeParse(payloadJson); // Validate heartbeat schema.
  if (!parsedPayload.success) { // Schema validation failed.
    // eslint-disable-next-line no-console
    console.warn("[telemetry-ingest] drop_invalid_schema", { topic, issues: parsedPayload.error.issues }); // Log issues.
    return; // Drop invalid message.
  } // End schema check.
  kindPayload = parsedPayload.data; // Extract validated heartbeat payload.
} // End kind branch.

const p = kindPayload; // Unified validated payload.
    const occurredAtIso = new Date(p.ts_ms).toISOString(); // Convert ts_ms to ISO string.

const provided_hash = sha256Hex(String(p.credential)); // Hash provided credential for comparison (secret never stored).

// Build deterministic ids and record payload depending on message kind.
let fact_id = ""; // Fact id (deterministic for idempotency).
let record: any = null; // Record_json object to append.
if (parsed.kind === "telemetry") { // Telemetry event.
  const telemetry_id = sha256Hex(`${parsed.tenant_id}|${parsed.device_id}|${(p as any).metric}|${p.ts_ms}`); // Deterministic telemetry id.
  fact_id = `tel_${telemetry_id}`; // Fact id for telemetry.
  record = { // Telemetry record.
    type: "raw_telemetry_v1", // Fact type identifier.
    entity: { tenant_id: parsed.tenant_id, device_id: parsed.device_id }, // Entity envelope.
    payload: { // Payload.
      metric: (p as any).metric, // Metric name.
      value: (p as any).value, // Metric value.
      ts_ms: p.ts_ms, // Timestamp ms.
      telemetry_id, // Deterministic telemetry id.
      credential_hash: provided_hash, // Credential hash used for auth (secret never stored).
    }, // End payload.
  }; // End record.
} else { // Heartbeat event.
  const heartbeat_id = sha256Hex(`${parsed.tenant_id}|${parsed.device_id}|hb|${p.ts_ms}`); // Deterministic heartbeat id.
  fact_id = `hb_${heartbeat_id}`; // Fact id for heartbeat.
  record = { // Heartbeat record.
    type: "device_heartbeat_v1", // Heartbeat fact type.
    entity: { tenant_id: parsed.tenant_id, device_id: parsed.device_id }, // Entity envelope.
    payload: { // Payload.
      ts_ms: p.ts_ms, // Timestamp ms.
      battery_percent: (p as any).battery_percent ?? null, // Battery percent (nullable).
      rssi_dbm: (p as any).rssi_dbm ?? null, // RSSI (nullable).
      fw_ver: (p as any).fw_ver ?? null, // Firmware version (nullable).
      heartbeat_id, // Deterministic heartbeat id.
      credential_hash: provided_hash, // Credential hash used for auth (secret never stored).
    }, // End payload.
  }; // End record.
} // End kind branch.

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

      let projInserted = false; // Whether a projection row was inserted (telemetry) or updated (heartbeat).
if (parsed.kind === "telemetry") { // Telemetry projection path.
  // Insert into telemetry projection for fast querying.
  const projRes = await clientConn.query(
    `INSERT INTO telemetry_index_v1 (tenant_id, device_id, metric, ts, value_num, value_text, fact_id)
     VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7)
     ON CONFLICT (tenant_id, device_id, metric, ts) DO NOTHING
     RETURNING fact_id`,
    [parsed.tenant_id, parsed.device_id, (p as any).metric, occurredAtIso, value_num, value_text, fact_id]
  ); // End telemetry projection insert.

  // Update device status projection (last telemetry time).
  await clientConn.query(
    `INSERT INTO device_status_index_v1 (tenant_id, device_id, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms)
     VALUES ($1, $2, $3, NULL, NULL, NULL, NULL, $4)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET
       last_telemetry_ts_ms = GREATEST(COALESCE(device_status_index_v1.last_telemetry_ts_ms, 0), EXCLUDED.last_telemetry_ts_ms),
       updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [parsed.tenant_id, parsed.device_id, p.ts_ms, Date.now()]
  ); // End status update.

  projInserted = (projRes.rows ?? []).length > 0; // True if insert happened.
} else { // Heartbeat projection path.
  // Update device status projection (last heartbeat time + signal/battery/fw).
  await clientConn.query(
    `INSERT INTO device_status_index_v1 (tenant_id, device_id, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET
       last_heartbeat_ts_ms = GREATEST(COALESCE(device_status_index_v1.last_heartbeat_ts_ms, 0), EXCLUDED.last_heartbeat_ts_ms),
       battery_percent = COALESCE(EXCLUDED.battery_percent, device_status_index_v1.battery_percent),
       rssi_dbm = COALESCE(EXCLUDED.rssi_dbm, device_status_index_v1.rssi_dbm),
       fw_ver = COALESCE(EXCLUDED.fw_ver, device_status_index_v1.fw_ver),
       updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [parsed.tenant_id, parsed.device_id, p.ts_ms, (p as any).battery_percent ?? null, (p as any).rssi_dbm ?? null, (p as any).fw_ver ?? null, Date.now()]
  ); // End status update.

  projInserted = true; // For heartbeat, treat as inserted/processed.
} // End kind branch.

await clientConn.query("COMMIT"); // Commit transaction.

      // If telemetry projection insert was a no-op, this message is a duplicate delivery. Stay silent.
      if (parsed.kind === "telemetry" && !projInserted) { return; } // Duplicate telemetry event => no log.

      // eslint-disable-next-line no-console
      console.log("[telemetry-ingest] ok", { kind: parsed.kind, tenant_id: parsed.tenant_id, device_id: parsed.device_id, metric: (p as any).metric ?? "HEARTBEAT", ts_ms: p.ts_ms }); // Log success.


// Evaluate telemetry-based alert rules (DEVICE scope) after successful ingest.
if (parsed.kind === "telemetry" && projInserted) { // Only evaluate for new telemetry points.
  try { // Best-effort alert evaluation (must not break ingest).
    const rulesQ = await pool.query(
      `SELECT tenant_id, rule_id, operator, threshold_num, window_sec
         FROM alert_rule_index_v1
        WHERE tenant_id = $1
          AND status = 'ACTIVE'
          AND object_type = 'DEVICE'
          AND object_id = $2
          AND metric = $3`,
      [parsed.tenant_id, parsed.device_id, (p as any).metric]
    ); // Load matching rules.
    for (const r of rulesQ.rows) { // Iterate rules.
      const op = String(r.operator ?? "").toUpperCase(); // Operator.
      const thr = (typeof r.threshold_num === "number") ? r.threshold_num : Number(r.threshold_num); // Threshold.
      const val = (typeof (p as any).value === "number") ? (p as any).value : Number((p as any).value); // Coerce numeric value.
      if (!Number.isFinite(val) || !Number.isFinite(thr)) continue; // Skip non-numeric values.
      const ok = (op === "GT") ? (val > thr)
        : (op === "GTE") ? (val >= thr)
        : (op === "LT") ? (val < thr)
        : (op === "LTE") ? (val <= thr)
        : (op === "EQ") ? (val === thr)
        : false; // Evaluate.
      if (!ok) continue; // Not triggered.

      const bucket_ms = Math.max(60_000, (Number(r.window_sec) || 60) * 1000); // Bucket for event id stability.
      const bucket = Math.floor(p.ts_ms / bucket_ms); // Bucket index.
      const event_id = `alev_${sha256Hex("tel|" + parsed.tenant_id + "|" + r.rule_id + "|" + parsed.device_id + "|" + String(bucket))}`; // Deterministic event id.

      const existQ = await pool.query(
        `SELECT 1 FROM alert_event_index_v1 WHERE tenant_id = $1 AND event_id = $2 LIMIT 1`,
        [parsed.tenant_id, event_id]
      ); // Check already exists.
      if (existQ.rowCount > 0) continue; // Already raised.

      const fact_id2 = `alev_raise_${randomUUID()}`; // Fact id.
      const record2 = { // Fact record.
        type: "alert_event_raised_v1", // Fact type.
        entity: { tenant_id: parsed.tenant_id, event_id, rule_id: r.rule_id }, // Entity.
        payload: { // Payload.
          object_type: "DEVICE", // Object type.
          object_id: parsed.device_id, // Object id.
          metric: (p as any).metric, // Metric name.
          raised_ts_ms: Date.now(), // Raised time.
          last_value: { value_num: val, threshold_num: thr, operator: op, ts_ms: p.ts_ms }, // Snapshot.
          source: "telemetry-ingest", // Source marker.
        }, // End payload.
      }; // End record.

      const c2 = await pool.connect(); // Connection for atomic insert.
      try { // Tx.
        await c2.query("BEGIN"); // Begin.
        await c2.query(
          `INSERT INTO facts (fact_id, occurred_at, source, record_json)
           VALUES ($1, $2::timestamptz, $3, $4)`,
          [fact_id2, new Date(Date.now()).toISOString(), "system", JSON.stringify(record2)]
        ); // Insert fact.
        await c2.query(
          `INSERT INTO alert_event_index_v1
            (tenant_id, event_id, rule_id, object_type, object_id, metric, status, raised_ts_ms, acked_ts_ms, closed_ts_ms, last_value_json)
           VALUES ($1,$2,$3,$4,$5,$6,'OPEN',$7,NULL,NULL,$8)
           ON CONFLICT (tenant_id, event_id) DO NOTHING`,
          [parsed.tenant_id, event_id, r.rule_id, "DEVICE", parsed.device_id, (p as any).metric, Date.now(), JSON.stringify({ value_num: val, threshold_num: thr, operator: op, ts_ms: p.ts_ms })]
        ); // Insert event projection.
        await c2.query("COMMIT"); // Commit.
      } catch { // Swallow tx errors.
        await c2.query("ROLLBACK"); // Rollback.
      } finally { // Release.
        c2.release(); // Release.
      } // End tx.
    } // End for.
  } catch { // Swallow evaluation errors.
    // No-op.
  } // End try/catch.
} // End alert evaluation.


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
