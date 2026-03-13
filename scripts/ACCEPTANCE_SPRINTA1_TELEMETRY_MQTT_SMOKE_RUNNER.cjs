#!/usr/bin/env node
/*
  Sprint A1 smoke runner.

  It performs these checks against the current credential-gated ingest flow:
  1) Ensure a test device exists.
  2) Issue a device credential.
  3) Publish telemetry(ts1) over MQTT with credential.
  4) Publish same telemetry(ts1) again and confirm query count stays the same (idempotency).
  5) Publish telemetry(ts2) and confirm query count increases (new point).

  This runner assumes apps/server is already running and telemetry-ingest is already subscribed.
*/

const mqtt = require("mqtt"); // MQTT client library used to publish test messages.

const FAIL_PREFIX = "[FAIL]"; // Standard failure prefix for grepping.
const PASS_MARKER = "[PASS] ACCEPTANCE_SPRINTA1_TELEMETRY_MQTT_SMOKE"; // Standard PASS marker.

function fail(msg) { // Throw an error to exit with non-zero status.
  throw new Error(`${FAIL_PREFIX} ${msg}`); // Standardized error format.
}

function parseArgs(argv) { // Parse CLI args like: --key value
  const out = {}; // Accumulator for parsed arguments.
  for (let i = 2; i < argv.length; i++) { // Skip node + script path.
    const a = argv[i]; // Current token.
    if (!a.startsWith("--")) { continue; } // Ignore positional args.
    const k = a.slice(2); // Key without leading dashes.
    const v = argv[i + 1]; // Next token is the value when present.
    if (!v || v.startsWith("--")) { out[k] = ""; continue; } // Handle valueless flag.
    out[k] = v; // Store parsed value.
    i++; // Skip consumed value.
  }
  return out; // Return parsed arguments map.
}

function sleep(ms) { // Simple sleep helper.
  return new Promise((resolve) => setTimeout(resolve, ms)); // Promise-based delay.
}

async function publishOnce({ mqttUrl, topic, payload }) { // Publish a single MQTT message.
  return new Promise((resolve, reject) => { // Wrap MQTT callback flow in a promise.
    const c = mqtt.connect(mqttUrl, { connectTimeout: 5000 }); // Connect to broker with timeout.

    const onError = (e) => { // Shared error handler.
      try { c.end(true); } catch (_) {} // Best-effort close on failure.
      reject(e); // Reject promise with original error.
    };

    c.on("error", onError); // Handle connection or publish errors.
    c.on("connect", () => { // Publish after successful connection.
      c.publish(topic, payload, { qos: 1 }, (err) => { // QoS1 exercises retry-safe publish path.
        if (err) { return onError(err); } // Fail immediately on publish error.
        c.end(true, () => resolve()); // Close and resolve after broker ack path completes.
      });
    });
  });
}

async function httpJson({ method, url, token, body }) { // Small JSON HTTP helper for API calls.
  const headers = { "Accept": "application/json" }; // Default request headers.
  if (token) { headers.Authorization = `Bearer ${token}`; } // Add bearer token when provided.
  if (body !== undefined) { headers["Content-Type"] = "application/json"; } // Send JSON content type only when needed.

  const res = await fetch(url, { // Execute HTTP request.
    method, // HTTP method.
    headers, // Request headers.
    body: body === undefined ? undefined : JSON.stringify(body), // Optional JSON body.
  });

  const text = await res.text(); // Read full body for better diagnostics.
  let obj = null; // Parsed JSON placeholder.
  try { obj = text ? JSON.parse(text) : {}; } catch (_) { obj = null; } // Parse JSON when possible.

  if (!res.ok) { // Non-2xx response branch.
    fail(`${method} ${url} -> http ${res.status}: ${text}`); // Fail with raw body.
  }

  if (obj === null) { // JSON parsing failed.
    fail(`${method} ${url} returned non-json: ${text}`); // Fail with response text.
  }

  return obj; // Return parsed response object.
}

async function ensureDevice({ baseUrl, token, deviceId }) { // Ensure device registration exists for the smoke run.
  const url = `${baseUrl.replace(/\/$/, "")}/api/devices`; // Device registration endpoint.
  const resp = await httpJson({ // Call device registration API.
    method: "POST", // Registration uses POST.
    url, // Endpoint URL.
    token, // Bearer token.
    body: { device_id: deviceId, display_name: "Sprint A1 smoke device" }, // Minimal deterministic payload.
  });

  if (resp.ok !== true) { // Validate ok envelope.
    fail(`device registration returned unexpected payload: ${JSON.stringify(resp)}`); // Fail on malformed response.
  }
}

async function issueCredential({ baseUrl, token, deviceId }) { // Issue a credential for the smoke device.
  const url = `${baseUrl.replace(/\/$/, "")}/api/devices/${encodeURIComponent(deviceId)}/credentials`; // Credential issue endpoint.
  const resp = await httpJson({ // Call credential issue API.
    method: "POST", // Credential issue uses POST.
    url, // Endpoint URL.
    token, // Bearer token.
    body: {}, // Minimal body.
  });

  if (resp.ok !== true) { // Validate ok envelope.
    fail(`credential issue returned unexpected payload: ${JSON.stringify(resp)}`); // Fail on malformed response.
  }

  const secret = String(resp.credential_secret || ""); // One-time secret returned by server.
  if (!secret) { // Credential secret is required for ingest auth.
    fail(`credential_secret missing in credential response: ${JSON.stringify(resp)}`); // Fail if missing.
  }

  return secret; // Return issued secret for MQTT payloads.
}

async function queryTelemetry({ baseUrl, token, deviceId, metric, fromTsMs, toTsMs }) { // Call the telemetry query API.
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/api/telemetry/v1/query`); // Build URL safely.
  url.searchParams.set("device_id", deviceId); // device_id filter.
  url.searchParams.set("metric", metric); // metric filter.
  url.searchParams.set("from_ts_ms", String(fromTsMs)); // start timestamp.
  url.searchParams.set("to_ts_ms", String(toTsMs)); // end timestamp.

  const obj = await httpJson({ // Execute GET request.
    method: "GET", // Query endpoint is GET.
    url: url.toString(), // Full URL with query string.
    token, // Bearer token.
  });

  return obj; // Return parsed response object.
}

async function waitForCount({ baseUrl, token, deviceId, metric, fromTsMs, toTsMs, expectedCount, timeoutMs }) { // Poll query API until the expected count appears.
  const started = Date.now(); // Poll start time.
  let last = null; // Last seen response for diagnostics.

  while ((Date.now() - started) < timeoutMs) { // Poll until timeout.
    last = await queryTelemetry({ baseUrl, token, deviceId, metric, fromTsMs, toTsMs }); // Query current count.
    if (last.ok === true && Number(last.count) === expectedCount) { // Expected count reached.
      return last; // Return success payload.
    }
    await sleep(300); // Back off briefly before next poll.
  }

  fail(`expected count=${expectedCount}, got ${last ? JSON.stringify(last) : "no-response"} device=${deviceId} metric=${metric}`); // Timeout failure.
}

async function main() { // Main entry point.
  const args = parseArgs(process.argv); // Parse CLI args.
  const baseUrl = args.baseUrl || "http://127.0.0.1:3001"; // Default local mapped server URL.
  const token = args.token || process.env.GEOX_AO_ACT_TOKEN || ""; // Read bearer token from CLI or env.
  const mqttUrl = args.mqttUrl || "mqtt://127.0.0.1:1883"; // Default MQTT broker URL.
  const tenantId = args.tenantId || "tenantA"; // Deterministic tenant default.
  const deviceId = args.deviceId || `devA1_${Date.now()}`; // Fresh device id to avoid cross-run contamination.
  const metric = args.metric || "soil_moisture"; // Deterministic metric.
  const value = args.value ? Number(args.value) : 21.3; // Deterministic numeric value.
  const ts1 = args.ts1 ? Number(args.ts1) : Date.now(); // First timestamp.
  const ts2 = args.ts2 ? Number(args.ts2) : (ts1 + 1000); // Second timestamp one second later.
  const timeoutMs = args.timeoutMs ? Number(args.timeoutMs) : 20000; // Poll timeout for ingest/query.

  if (!token) { fail("missing --token or GEOX_AO_ACT_TOKEN"); } // Token is required for auth.
  if (!Number.isFinite(value)) { fail("invalid --value"); } // Validate numeric value.
  if (!Number.isFinite(ts1) || !Number.isFinite(ts2) || ts2 <= ts1) { fail("invalid ts1/ts2"); } // Validate timestamps.

  const topic = `telemetry/${tenantId}/${deviceId}`; // Topic format defined by Sprint A1.
  const fromTsMs = ts1 - 1000; // Query window start.
  const toTsMs = ts2 + 1000; // Query window end.

  console.log(`[INFO] baseUrl=${baseUrl}`); // Log baseUrl.
  console.log(`[INFO] mqttUrl=${mqttUrl}`); // Log mqttUrl.
  console.log(`[INFO] tenantId=${tenantId}`); // Log tenant.
  console.log(`[INFO] deviceId=${deviceId}`); // Log device id.
  console.log(`[INFO] topic=${topic}`); // Log topic.

  await ensureDevice({ baseUrl, token, deviceId }); // Ensure device exists before issuing credential.
  const credential = await issueCredential({ baseUrl, token, deviceId }); // Issue credential for MQTT auth.
  console.log(`[INFO] credential_len=${credential.length}`); // Log credential length only, never the secret itself.

  const p1 = JSON.stringify({ metric, value, ts_ms: ts1, credential }); // Payload #1 with credential.
  const p2 = JSON.stringify({ metric, value, ts_ms: ts2, credential }); // Payload #2 with credential.

  await publishOnce({ mqttUrl, topic, payload: p1 }); // Publish first point.
  await waitForCount({ baseUrl, token, deviceId, metric, fromTsMs, toTsMs, expectedCount: 1, timeoutMs }); // Wait for first ingest.

  await publishOnce({ mqttUrl, topic, payload: p1 }); // Publish same point again for idempotency check.
  await waitForCount({ baseUrl, token, deviceId, metric, fromTsMs, toTsMs, expectedCount: 1, timeoutMs }); // Count must remain 1.

  await publishOnce({ mqttUrl, topic, payload: p2 }); // Publish new point.
  await waitForCount({ baseUrl, token, deviceId, metric, fromTsMs, toTsMs, expectedCount: 2, timeoutMs }); // Count must advance to 2.

  console.log(PASS_MARKER); // Print PASS marker.
}

main().catch((e) => { // Top-level error handling.
  console.error(String(e && e.stack ? e.stack : e)); // Print error stack when available.
  process.exit(1); // Non-zero exit code on failure.
});