// GEOX/apps/telemetry-ingest/src/main.ts

import crypto from "node:crypto"; // Node crypto for sha256 telemetry_id and deterministic fact_id.
import { randomUUID } from "node:crypto"; // UUID generator for alert event fact ids.
import process from "node:process"; // Access environment variables and argv.
import { isTelemetryMetricNameV1, isValidTelemetryUnitV1, TELEMETRY_METRIC_CATALOG_V1, toCanonicalTelemetryMetricNameV1 } from "@geox/contracts"; // Canonical telemetry metric + unit mapping from contracts (single source of truth).
import { Pool } from "pg"; // Postgres client pool to write ledger + projection.
import mqtt from "mqtt"; // MQTT client for telemetry subscription.
import { z } from "zod"; // Runtime schema validation for incoming telemetry payloads.
import { updateAgronomySnapshot } from "../../server/src/projections/agronomy_signal_snapshot_v1"; // Refresh agronomy snapshot projection after telemetry commits.
import { ensureDeviceObservationProjectionV1, writeObservationRunPipelineAndRefreshFieldV1 } from "../../server/src/services/device_observation_service_v1"; // raw_telemetry_v1 -> device_observation_v1 -> sensing pipeline -> read-model refresh.

const TelemetryPayloadSchema = z.object({ // Define minimal telemetry payload schema.
  metric: z.string().min(1), // Metric name (e.g., soil_moisture).
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]), // Metric value (simple scalar types).
  unit: z.string().min(1).optional(), // Optional unit string from device payload.
  ts_ms: z.number().int().positive(), // Event timestamp in epoch milliseconds.
  credential: z.string().min(1), // Device credential secret (issued by /api/devices/:id/credentials).
  geo: z.object({ // Optional geographic point for GIS marker / trajectory extraction.
    lat: z.number().finite(), // Latitude in decimal degrees.
    lon: z.number().finite(), // Longitude in decimal degrees.
  }).optional(), // Omit when telemetry has no location.
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

function mqttOptionsFromEnv(): mqtt.IClientOptions {
  const username = String(process.env.GEOX_MQTT_USERNAME ?? process.env.MQTT_USERNAME ?? "").trim();
  const password = String(process.env.GEOX_MQTT_PASSWORD ?? process.env.MQTT_PASSWORD ?? "").trim();
  return username || password ? { username, password } : {};
}

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
  return { kind: kind as "telemetry" | "heartbeat", tenant_id, device_id }; // Return parsed info.
} // End helper.

const recentSeen = new Map<string, number>(); // In-memory recent log suppression map.

function seenRecently(key: string, ttlMs: number): boolean { // Deduplicate repeated warning logs for QoS redelivery.
  const now = Date.now(); // Current timestamp.
  const prev = recentSeen.get(key); // Previous timestamp.
  if (typeof prev === "number" && (now - prev) < ttlMs) return true; // Suppress if still within TTL.
  recentSeen.set(key, now); // Record fresh timestamp.
  if (recentSeen.size > 2000) { // Bound map growth in long-running process.
    for (const [k, ts] of recentSeen) { // Scan current entries.
      if ((now - ts) > (ttlMs * 4)) recentSeen.delete(k); // Drop stale entries.
      if (recentSeen.size <= 1500) break; // Stop once map shrinks enough.
    } // End cleanup scan.
  } // End size guard.
  return false; // Caller should emit log.
} // End helper.

function normalizeMetricAndUnit(metricRaw: string, unitRaw?: string): { metric: string; unit: string | null } { // Normalize with contracts canonical mapping + unit validation.
  const metric = toCanonicalTelemetryMetricNameV1(String(metricRaw || ""));
  const normalizedUnit = typeof unitRaw === "string" ? unitRaw.trim() : "";
  if (!isTelemetryMetricNameV1(metric)) return { metric, unit: normalizedUnit || null };
  if (normalizedUnit.length < 1) return { metric, unit: TELEMETRY_METRIC_CATALOG_V1[metric].unit };
  if (isValidTelemetryUnitV1(metric, normalizedUnit)) return { metric, unit: TELEMETRY_METRIC_CATALOG_V1[metric].unit };
  return { metric, unit: TELEMETRY_METRIC_CATALOG_V1[metric].unit };
} // End helper.

function toQualityFlags(value: unknown): string[] { // Derive basic quality flags for normalized observation contract.
  if (value == null) return ["MISSING_CONTEXT"];
  if (typeof value === "number" && !Number.isFinite(value)) return ["OUTLIER"];
  return ["OK"];
} // End helper.

async function resolveTelemetryObservationFieldId(clientConn: import("pg").PoolClient, tenant_id: string, device_id: string): Promise<string | null> { // Attach latest field dimension for observation indexing.
  try {
    const q = await clientConn.query(
      `SELECT field_id FROM device_binding_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`,
      [tenant_id, device_id]
    );
    if ((q.rows ?? []).length < 1) return null;
    const field_id = q.rows[0]?.field_id;
    return typeof field_id === "string" && field_id.trim().length > 0 ? field_id.trim() : null;
  } catch {
    return null;
  }
} // End helper.

/**
 * Data-layer contract:
 * raw_telemetry_v1 is ingress-only evidence for audit/replay and must not be consumed
 * directly by dashboard/agronomy business pipelines.
 * Business reads should consume normalized device_observation_v1 only.
 */

async function main() { // Main bootstrap for telemetry + heartbeat ingest.
  const databaseUrl = resolveDatabaseUrl(); // Resolve Postgres connection string.
  if (!databaseUrl) throw new Error("DATABASE_URL_NOT_CONFIGURED"); // Require database before starting.

  const mqttUrl = process.env.GEOX_MQTT_URL || process.env.MQTT_URL || "mqtt://127.0.0.1:1883"; // Prefer GEOX_MQTT_URL, keep MQTT_URL fallback for compatibility.
  const topicFilter = process.env.TELEMETRY_TOPIC_FILTER || "telemetry/+/+"; // Telemetry topic wildcard.
  const heartbeatFilter = process.env.HEARTBEAT_TOPIC_FILTER || "heartbeat/+/+"; // Heartbeat topic wildcard.
  const once = process.argv.includes("--once"); // One-shot mode for smoke tests.

  const pool = new Pool({ connectionString: databaseUrl }); // Create Postgres pool.
  {
    const setupConn = await pool.connect();
    try {
      await ensureDeviceObservationProjectionV1(setupConn);
    } finally {
      setupConn.release();
    }
  }
  const client = mqtt.connect(mqttUrl, mqttOptionsFromEnv()); // Connect to MQTT broker.
  let ready = false; // Gate message handling until subscribe callback succeeds.

  client.on("connect", () => { // MQTT connect handler.
    client.subscribe([topicFilter, heartbeatFilter], (err) => { // Subscribe to telemetry + heartbeat topics.
      if (err) { // Subscription error.
        // eslint-disable-next-line no-console
        console.error("[telemetry-ingest] subscribe_error", err); // Log error.
        ready = false; // Do not process messages until a successful subscribe.
        return; // Abort.
      } // End error branch.
      // Important: print these logs only after subscription callback completes, so they never appear after ok/drop.
      // eslint-disable-next-line no-console
      console.log(`[telemetry-ingest] connected mqtt=${mqttUrl}`); // Log connection (after subscribe confirms).
      // eslint-disable-next-line no-console
      console.log(`[telemetry-ingest] subscribed ${topicFilter}`); // Log telemetry subscription success.
      // eslint-disable-next-line no-console
      console.log(`[telemetry-ingest] subscribed ${heartbeatFilter}`); // Log heartbeat subscription success.
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

    let fact_id = ""; // Fact id (deterministic for idempotency).
    let record: any = null; // Record_json object to append.
    if (parsed.kind === "telemetry") { // Telemetry event.
      const telemetry_id = sha256Hex(`${parsed.tenant_id}|${parsed.device_id}|${(p as any).metric}|${p.ts_ms}`); // Deterministic telemetry id.
      fact_id = `tel_${telemetry_id}`; // Fact id for telemetry.
      const geo = (p as any).geo && typeof (p as any).geo === "object"
  && Number.isFinite((p as any).geo.lat)
  && Number.isFinite((p as any).geo.lon)
  ? { lat: Number((p as any).geo.lat), lon: Number((p as any).geo.lon) }
  : null; // Normalize optional geo payload for field GIS markers / trajectories.

record = { // Telemetry record.
  type: "raw_telemetry_v1", // Fact type identifier.
  entity: { tenant_id: parsed.tenant_id, device_id: parsed.device_id }, // Entity envelope.
  payload: {
    metric: (p as any).metric, // Metric name.
    value: (p as any).value, // Metric value.
    ts_ms: p.ts_ms, // Timestamp ms.
    telemetry_id, // Deterministic telemetry id.
    credential_hash: provided_hash, // Credential hash used for auth (secret never stored).
    geo, // Optional geo point for GIS marker / trajectory extraction.
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
    const value_num = typeof (p as any).value === "number" && Number.isFinite((p as any).value) ? (p as any).value : null; // Numeric value if finite.
    const value_text = (p as any).value === undefined || (p as any).value === null ? null : String((p as any).value); // Text representation for projection.

    const clientConn = await pool.connect(); // Acquire a db connection for transaction.
    try { // Transaction scope.
      await clientConn.query("BEGIN"); // Start transaction.

      const devExists = await clientConn.query(
        `SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`,
        [parsed.tenant_id, parsed.device_id]
      ); // Check device registration.
      if ((devExists.rows ?? []).length < 1) { // Unregistered device.
        await clientConn.query("ROLLBACK"); // Rollback and drop message.
        const k = `drop_unregistered_device|${msgKeyBase}`; // Dedupe key.
        if (!seenRecently(k, 2000)) { // Avoid duplicate logs from QoS redelivery.
          // eslint-disable-next-line no-console
          console.warn("[telemetry-ingest] drop_unregistered_device", { tenant_id: parsed.tenant_id, device_id }); // Log drop.
        } // End dedupe branch.
        return; // Stop processing.
      } // End registration gate.

      const credRow = await clientConn.query(
        `SELECT credential_hash, credential_id
           FROM device_credential_index_v1
          WHERE tenant_id = $1 AND device_id = $2 AND status = 'ACTIVE'
          ORDER BY issued_at DESC LIMIT 1`,
        [parsed.tenant_id, parsed.device_id]
      ); // Fetch active credential for device.
      if ((credRow.rows ?? []).length < 1) { // No active credential.
      await clientConn.query("ROLLBACK"); // Rollback before return.
      const k = `drop_missing_credential|${msgKeyBase}`; // Dedupe key.
      if (!seenRecently(k, 2000)) { // Avoid repeated warnings.
        // eslint-disable-next-line no-console
        console.warn("[telemetry-ingest] drop_missing_credential", { tenant_id: parsed.tenant_id, device_id: parsed.device_id }); // Log drop.
      }
      return; // Stop.
    }

    const expected_hash = String(credRow.rows[0].credential_hash ?? ""); // Stored credential hash.
    if (!expected_hash || expected_hash !== provided_hash) { // Credential mismatch.
      await clientConn.query("ROLLBACK"); // Rollback before return.
      const k = `drop_invalid_credential|${msgKeyBase}`; // Dedupe key.
      if (!seenRecently(k, 2000)) {
        // eslint-disable-next-line no-console
        console.warn("[telemetry-ingest] drop_invalid_credential", { tenant_id: parsed.tenant_id, device_id: parsed.device_id });
      }
      return;
    }

    const field_id = await resolveTelemetryObservationFieldId(clientConn, parsed.tenant_id, parsed.device_id); // Resolve current field binding for observation projection.
    const valueNumForObservation = typeof (p as any).value === "number" && Number.isFinite((p as any).value) ? (p as any).value : null; // Numeric only for observation.value_num.
    const qualityFlags = toQualityFlags((p as any).value); // Normalize simple quality flags.

    const metricNorm = parsed.kind === "telemetry"
      ? normalizeMetricAndUnit(String((p as any).metric || ""), (p as any).unit)
      : { metric: "device_heartbeat", unit: null };

    await clientConn.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (fact_id) DO NOTHING`,
      [fact_id, occurredAtIso, 'device_telemetry', recordText]
    ); // Append raw telemetry/heartbeat fact.

    await writeObservationRunPipelineAndRefreshFieldV1(clientConn, {
      tenant_id: parsed.tenant_id,
      project_id: process.env.GEOX_PROJECT_ID || "projectA",
      group_id: process.env.GEOX_GROUP_ID || "groupA",
      field_id,
      device_id: parsed.device_id,
      metric: metricNorm.metric,
      observed_at_ts_ms: p.ts_ms,
      value_num: valueNumForObservation,
      value_text,
      unit: metricNorm.unit,
      confidence: "MEDIUM",
      quality_flags: qualityFlags,
      raw_fact_id: fact_id,
      source_kind: parsed.kind,
      credential_id: String(credRow.rows[0].credential_id ?? "") || null,
      geo: parsed.kind === "telemetry" ? (record.payload.geo ?? null) : null,
    });

    await updateAgronomySnapshot(clientConn, {
      field_id: field_id ?? null,
      metric: metricNorm.metric,
      value: valueNumForObservation,
      ts_ms: p.ts_ms,
      source: parsed.kind === "telemetry" ? "mqtt" : "heartbeat",
    }); // Refresh agronomy signal snapshot for downstream recommendations.

    await clientConn.query("COMMIT"); // Commit all writes.
    if (once) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ ok: true, fact_id, kind: parsed.kind })); // Output one-shot result.
      client.end(true);
      await pool.end();
      process.exit(0);
    }
    } catch (err) {
      await clientConn.query("ROLLBACK").catch(() => undefined);
      // eslint-disable-next-line no-console
      console.error("[telemetry-ingest] process_error", { topic, error: String((err as Error)?.message ?? err) });
    } finally {
      clientConn.release();
    }
  }); // End message handler.
}

main().catch((err) => { // Process-level failure.
  // eslint-disable-next-line no-console
  console.error("[telemetry-ingest] fatal", err); // Log fatal error.
  process.exit(1); // Exit non-zero.
});