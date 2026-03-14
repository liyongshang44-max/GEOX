// GEOX/apps/server/src/routes/ws_telemetry_v1.ts
//
// Stage 1 GIS live telemetry stream.
//
// Design notes:
// - Keep telemetry ingest unchanged; the live channel only reads facts/projections.
// - Use a field-scoped WebSocket endpoint to minimize fan-out and tenant leakage.
// - Poll the database on a short interval instead of introducing an internal event bus.
// - Require both fields.read and telemetry.read scopes before upgrading the socket.

import crypto from "node:crypto"; // Build the RFC6455 Sec-WebSocket-Accept handshake value.
import type { Socket } from "node:net"; // Track the upgraded TCP sockets explicitly.
import type { FastifyInstance } from "fastify"; // Route/plugin registration surface.
import type { Pool } from "pg"; // PostgreSQL pool used for field/device lookups.

import { findAoActTokenRecordV0 } from "../auth/ao_act_authz_v0"; // Reuse AO-ACT token SSOT for WebSocket auth.

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"; // RFC6455 GUID appended to the client key.
const LIVE_POLL_INTERVAL_MS = 1000; // Stage 1 target: simple 1s polling loop.
const LIVE_BATCH_LIMIT = 200; // Bound each poll result so one noisy field cannot starve the loop.

type LiveGeoEventRow = { // Raw database row returned by the polling query.
  device_id: string; // Device identity bound to the field.
  ts_ms: number; // Event timestamp used for cursor advancement.
  geo_json: any; // Raw JSON geo payload.
  metric: string | null; // Optional metric label from telemetry payload.
  value_text: string | null; // Optional value label from telemetry payload.
};

type LiveSubscription = { // Server-side subscription state for one tenant+field channel.
  key: string; // Stable map key tenant_id|field_id.
  tenant_id: string; // Tenant isolation boundary.
  field_id: string; // Field that this channel represents.
  clients: Set<Socket>; // Active upgraded sockets for the channel.
  last_ts_ms: number; // Cursor for the last event already broadcast.
  loadingBaseline: Promise<void> | null; // Prevent concurrent baseline loads for the same channel.
};

function parseTokenFromUrl(rawUrl: string | undefined): string { // Read the token from the query string during upgrade.
  if (!rawUrl) return ""; // Missing URL => no token.
  try { // URL parsing can throw on malformed input.
    const url = new URL(rawUrl, "http://127.0.0.1"); // Use a dummy origin because only path/query matter.
    return String(url.searchParams.get("token") ?? "").trim(); // Extract the live auth token.
  } catch { // Malformed URL.
    return ""; // Treat malformed URL as unauthenticated.
  }
} // End helper.

function parseFieldIdFromUrl(rawUrl: string | undefined): string | null { // Extract /ws/fields/:field_id/live from the upgrade path.
  if (!rawUrl) return null; // No URL => no field id.
  try { // URL parsing can throw on malformed input.
    const url = new URL(rawUrl, "http://127.0.0.1"); // Normalize the path for matching.
    const match = url.pathname.match(/^\/ws\/fields\/([^/]+)\/live$/); // Conservative route matcher.
    if (!match) return null; // Only this one endpoint is supported.
    const decoded = decodeURIComponent(String(match[1] ?? "")).trim(); // Decode the field id path segment.
    return decoded || null; // Reject empty field ids.
  } catch { // Malformed URL.
    return null; // Treat malformed URL as an invalid route.
  }
} // End helper.

function makeSubscriptionKey(tenant_id: string, field_id: string): string { // Stable channel key for the in-memory subscription map.
  return `${tenant_id}|${field_id}`; // Tenant + field is sufficient for isolation.
} // End helper.

function normalizeGeoPoint(raw: any): { lat: number; lon: number } | null { // Accept several geo payload aliases from telemetry/heartbeat facts.
  if (!raw || typeof raw !== "object") return null; // Missing object => invalid point.
  const latCandidates = [raw.lat, raw.latitude, raw?.location?.lat, raw?.location?.latitude]; // Supported latitude aliases.
  const lonCandidates = [raw.lon, raw.lng, raw.longitude, raw?.location?.lon, raw?.location?.lng, raw?.location?.longitude]; // Supported longitude aliases.
  let lat: number | null = null; // Selected latitude.
  let lon: number | null = null; // Selected longitude.
  for (const value of latCandidates) { const next = Number(value); if (Number.isFinite(next)) { lat = next; break; } } // First finite latitude wins.
  for (const value of lonCandidates) { const next = Number(value); if (Number.isFinite(next)) { lon = next; break; } } // First finite longitude wins.
  if (lat == null || lon == null) return null; // Require both coordinates.
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null; // Reject invalid coordinates.
  return { lat, lon }; // Return normalized point.
} // End helper.

function socketWriteHttpError(socket: Socket, statusCode: number, message: string): void { // Send a minimal HTTP response before destroying the socket.
  if (socket.destroyed) return; // Do nothing when the socket is already gone.
  socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`); // Minimal plain-text response.
  socket.destroy(); // Close the failed upgrade immediately.
} // End helper.

function createWebSocketAccept(key: string): string { // Compute Sec-WebSocket-Accept according to RFC6455.
  return crypto.createHash("sha1").update(`${key}${WS_GUID}`, "utf8").digest("base64"); // sha1(key + GUID) => base64.
} // End helper.

function encodeTextFrame(text: string): Buffer { // Encode an unmasked server-to-client text frame.
  const payload = Buffer.from(text, "utf8"); // UTF-8 encode the JSON message.
  const len = payload.length; // Payload byte length.
  if (len < 126) return Buffer.concat([Buffer.from([0x81, len]), payload]); // Small payload frame.
  if (len < 65536) { // 16-bit payload length branch.
    const header = Buffer.alloc(4); // FIN+text + 16-bit length header.
    header[0] = 0x81; // FIN + opcode=text.
    header[1] = 126; // Extended payload marker.
    header.writeUInt16BE(len, 2); // 16-bit payload length.
    return Buffer.concat([header, payload]); // Final frame bytes.
  }
  const header = Buffer.alloc(10); // FIN+text + 64-bit length header.
  header[0] = 0x81; // FIN + opcode=text.
  header[1] = 127; // 64-bit payload marker.
  header.writeBigUInt64BE(BigInt(len), 2); // 64-bit payload length.
  return Buffer.concat([header, payload]); // Final frame bytes.
} // End helper.

function safeSendJson(socket: Socket, payload: unknown): boolean { // Send one JSON message if the upgraded socket is still writable.
  if (socket.destroyed || !socket.writable) return false; // Skip dead sockets.
  try { // socket.write can still throw in edge cases.
    socket.write(encodeTextFrame(JSON.stringify(payload))); // Send a text frame.
    return true; // Caller can keep the socket subscribed.
  } catch { // Broken pipe or similar write error.
    socket.destroy(); // Tear down the broken socket.
    return false; // Signal send failure to the caller.
  }
} // End helper.

async function ensureFieldReadable(pool: Pool, tenant_id: string, field_id: string): Promise<boolean> { // Check that the target field exists inside the caller tenant.
  const q = await pool.query( // Field existence check enforces non-enumerable tenant isolation.
    `SELECT 1 FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2 LIMIT 1`,
    [tenant_id, field_id],
  ); // End query.
  return q.rowCount > 0; // True only for same-tenant existing fields.
} // End helper.

async function queryFieldLiveEvents(pool: Pool, tenant_id: string, field_id: string, after_ts_ms: number, limit: number): Promise<LiveGeoEventRow[]> { // Pull new geo telemetry/heartbeat events after the current field cursor.
  const q = await pool.query( // Read append-only facts for devices currently bound to the field.
    `SELECT device_id, ts_ms, geo_json, metric, value_text
       FROM (
         SELECT (f.record_json::jsonb #>> '{entity,device_id}') AS device_id,
                COALESCE((f.record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM f.occurred_at) * 1000)::bigint) AS ts_ms,
                (f.record_json::jsonb #> '{payload,geo}') AS geo_json,
                NULLIF(f.record_json::jsonb #>> '{payload,metric}', '') AS metric,
                NULLIF(COALESCE(f.record_json::jsonb #>> '{payload,value}', f.record_json::jsonb #>> '{payload,status}', f.record_json::jsonb #>> '{payload,fix}'), '') AS value_text,
                f.fact_id
           FROM device_binding_index_v1 b
           JOIN facts f
             ON (f.record_json::jsonb #>> '{entity,tenant_id}') = b.tenant_id
            AND (f.record_json::jsonb #>> '{entity,device_id}') = b.device_id
          WHERE b.tenant_id = $1
            AND b.field_id = $2
            AND (f.record_json::jsonb ->> 'type') IN ('raw_telemetry_v1', 'device_heartbeat_v1')
            AND (f.record_json::jsonb #> '{payload,geo}') IS NOT NULL
        ) src
      WHERE ts_ms > $3
      ORDER BY ts_ms ASC, device_id ASC, fact_id ASC
      LIMIT $4`,
    [tenant_id, field_id, after_ts_ms, limit],
  ); // End query.
  return (q.rows ?? []).map((row: any) => ({ // Normalize the row shape for the broadcaster.
    device_id: String(row.device_id ?? ""),
    ts_ms: Number(row.ts_ms ?? 0),
    geo_json: row.geo_json,
    metric: row.metric == null ? null : String(row.metric),
    value_text: row.value_text == null ? null : String(row.value_text),
  })).filter((row) => !!row.device_id && Number.isFinite(row.ts_ms) && row.ts_ms > 0); // Drop malformed rows.
} // End helper.

async function queryFieldLiveBaselineTs(pool: Pool, tenant_id: string, field_id: string): Promise<number> { // Initialize a channel cursor so new subscribers do not replay the entire history.
  const q = await pool.query( // Ask PostgreSQL for the latest geo event currently known for the field.
    `SELECT MAX(ts_ms)::bigint AS max_ts_ms
       FROM (
         SELECT COALESCE((f.record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM f.occurred_at) * 1000)::bigint) AS ts_ms
           FROM device_binding_index_v1 b
           JOIN facts f
             ON (f.record_json::jsonb #>> '{entity,tenant_id}') = b.tenant_id
            AND (f.record_json::jsonb #>> '{entity,device_id}') = b.device_id
          WHERE b.tenant_id = $1
            AND b.field_id = $2
            AND (f.record_json::jsonb ->> 'type') IN ('raw_telemetry_v1', 'device_heartbeat_v1')
            AND (f.record_json::jsonb #> '{payload,geo}') IS NOT NULL
       ) live_geo`,
    [tenant_id, field_id],
  ); // End query.
  const max_ts_ms = Number(q.rows?.[0]?.max_ts_ms ?? 0); // Normalize the MAX() result.
  return Number.isFinite(max_ts_ms) && max_ts_ms > 0 ? max_ts_ms : 0; // Default to zero when no history exists.
} // End helper.

export function registerWsTelemetryV1Routes(app: FastifyInstance, pool: Pool): void { // Attach the WebSocket upgrade handler and the polling broadcaster.
  const subscriptions = new Map<string, LiveSubscription>(); // Active field channel state keyed by tenant+field.

  const removeSocketFromSubscriptions = (socket: Socket): void => { // Cleanly detach one socket from every channel that contains it.
    for (const [key, sub] of subscriptions.entries()) { // Scan all subscriptions because the socket count is small in stage 1.
      if (!sub.clients.has(socket)) continue; // Skip unrelated channels.
      sub.clients.delete(socket); // Detach the socket from the live channel.
      if (sub.clients.size === 0) subscriptions.delete(key); // Remove empty channels to stop polling them.
    }
  }; // End helper.

  const ensureSubscription = async (tenant_id: string, field_id: string): Promise<LiveSubscription> => { // Create or reuse one live channel per tenant+field.
    const key = makeSubscriptionKey(tenant_id, field_id); // Stable channel key.
    const existing = subscriptions.get(key); // Check for an existing live channel.
    if (existing) return existing; // Reuse the existing channel state.
    const created: LiveSubscription = { key, tenant_id, field_id, clients: new Set<Socket>(), last_ts_ms: 0, loadingBaseline: null }; // Initial in-memory state.
    created.loadingBaseline = (async () => { // Seed the cursor once for the new channel.
      created.last_ts_ms = await queryFieldLiveBaselineTs(pool, tenant_id, field_id); // Start after the newest already-rendered point.
    })().finally(() => { created.loadingBaseline = null; }); // Clear the promise handle when done.
    subscriptions.set(key, created); // Publish the channel before awaiting the baseline so later joins can reuse it.
    await created.loadingBaseline; // Wait for baseline initialization before the caller continues.
    return created; // Return the ready channel.
  }; // End helper.

  app.get("/ws/fields/:field_id/live", async (_req, reply) => { // Plain HTTP callers get a clear 426 instead of a hanging route.
    return reply.code(426).send({ ok: false, error: "UPGRADE_REQUIRED", message: "Use WebSocket upgrade for this endpoint." }); // Explicit upgrade-required response.
  }); // End GET placeholder.

  app.server.on("upgrade", async (req, socket, head) => { // Handle RFC6455 upgrade at the raw Node server layer.
    if (head && head.length > 0) { socket.destroy(); return; } // Stage 1 does not support leftover buffered bytes.
    const field_id = parseFieldIdFromUrl(req.url); // Extract the field id from the path.
    if (!field_id) return; // Ignore unrelated upgrades so other handlers remain unaffected.

    const token = parseTokenFromUrl(req.url); // Read the live auth token from the query string.
    const rec = findAoActTokenRecordV0(token); // Resolve the token against the same AO-ACT SSOT file.
    if (!rec) { socketWriteHttpError(socket, 401, "AUTH_INVALID"); return; } // Unknown or revoked token.
    if (!rec.scopes.includes("fields.read") || !rec.scopes.includes("telemetry.read")) { socketWriteHttpError(socket, 403, "AUTH_SCOPE_DENIED"); return; } // Require both read scopes.
    const fieldVisible = await ensureFieldReadable(pool, rec.tenant_id, field_id); // Enforce tenant isolation before upgrade.
    if (!fieldVisible) { socketWriteHttpError(socket, 404, "NOT_FOUND"); return; } // Never leak cross-tenant field existence.

    const upgradeHeader = String(req.headers["upgrade"] ?? "").toLowerCase(); // WebSocket upgrade header.
    const connectionHeader = String(req.headers["connection"] ?? "").toLowerCase(); // Connection header must mention upgrade.
    const wsKey = String(req.headers["sec-websocket-key"] ?? "").trim(); // Client challenge key.
    const wsVersion = String(req.headers["sec-websocket-version"] ?? "").trim(); // RFC6455 version.
    if (upgradeHeader !== "websocket" || !connectionHeader.includes("upgrade") || !wsKey || wsVersion !== "13") { socketWriteHttpError(socket, 400, "BAD_WEBSOCKET_REQUEST"); return; } // Reject malformed upgrades.

    const accept = createWebSocketAccept(wsKey); // Compute the RFC6455 accept token.
    socket.write([ // Send the successful 101 Switching Protocols response.
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "\r\n",
    ].join("\r\n")); // End response write.

    socket.setNoDelay(true); // Reduce latency for small telemetry frames.
    socket.setKeepAlive(true, 30000); // Keep the connection warm across idle periods.

    const sub = await ensureSubscription(rec.tenant_id, field_id); // Join the field channel.
    sub.clients.add(socket); // Register the upgraded socket.
    safeSendJson(socket, { type: "telemetry_stream_ready_v1", field_id, poll_interval_ms: LIVE_POLL_INTERVAL_MS }); // Optional ready event for the UI.

    socket.on("close", () => removeSocketFromSubscriptions(socket)); // Clean up on close.
    socket.on("end", () => removeSocketFromSubscriptions(socket)); // Clean up on FIN.
    socket.on("error", () => removeSocketFromSubscriptions(socket)); // Clean up on socket error.
    socket.on("data", (chunk: Buffer) => { // Ignore client messages except for close frames.
      const opcode = chunk?.length ? (chunk[0] & 0x0f) : 0; // Read the opcode from the first frame byte.
      if (opcode === 0x8) socket.end(); // Client close => acknowledge by ending the socket.
    }); // End client frame listener.
  }); // End upgrade handler.

  const pollTimer = setInterval(async () => { // Periodically poll new geo events for every active field channel.
    for (const [key, sub] of subscriptions.entries()) { // Iterate over active channels only.
      if (sub.clients.size === 0) { subscriptions.delete(key); continue; } // Drop empty channels defensively.
      if (sub.loadingBaseline) await sub.loadingBaseline; // Ensure the initial cursor is ready before polling.
      let rows: LiveGeoEventRow[] = []; // Reset the batch accumulator for this channel.
      try { // Keep one failing field from breaking the whole timer loop.
        rows = await queryFieldLiveEvents(pool, sub.tenant_id, sub.field_id, sub.last_ts_ms, LIVE_BATCH_LIMIT); // Pull incremental events after the channel cursor.
      } catch (error) { // Database or parsing failure.
        app.log.error({ err: error, field_id: sub.field_id, tenant_id: sub.tenant_id }, "ws telemetry poll failed"); // Emit a structured server log.
        continue; // Try again on the next timer tick.
      }
      if (!rows.length) continue; // No new live points for this channel.
      for (const row of rows) { // Broadcast each new point in timestamp order.
        const geo = normalizeGeoPoint(row.geo_json); // Normalize the geo payload shape.
        if (!geo) continue; // Skip malformed rows instead of poisoning the cursor.
        const payload = { // Stable stage 1 wire format consumed by the web map.
          type: "device_geo_update_v1",
          field_id: sub.field_id,
          device_id: row.device_id,
          ts_ms: row.ts_ms,
          geo,
          metric: row.metric ?? "gps",
          value: row.value_text ?? "fix",
        }; // End payload.
        for (const client of Array.from(sub.clients)) { // Snapshot the set because send failures can mutate it.
          const ok = safeSendJson(client, payload); // Send one text frame to the client.
          if (!ok) sub.clients.delete(client); // Remove dead sockets immediately.
        }
        sub.last_ts_ms = Math.max(sub.last_ts_ms, row.ts_ms); // Advance the shared channel cursor after the broadcast.
      }
      if (sub.clients.size === 0) subscriptions.delete(key); // Stop polling dead channels.
    }
  }, LIVE_POLL_INTERVAL_MS); // End polling timer.

  app.addHook("onClose", async () => { // Ensure timer and sockets are cleaned up on server shutdown.
    clearInterval(pollTimer); // Stop the polling loop first.
    for (const sub of subscriptions.values()) { // Close all upgraded sockets gracefully.
      for (const client of sub.clients) client.destroy(); // Hard close is acceptable during shutdown.
    }
    subscriptions.clear(); // Drop in-memory channel state.
  }); // End onClose hook.
} // End registerWsTelemetryV1Routes.
