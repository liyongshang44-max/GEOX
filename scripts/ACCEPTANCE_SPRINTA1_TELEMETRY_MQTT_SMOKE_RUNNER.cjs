#!/usr/bin/env node
/*
  Sprint A1 smoke runner.

  It performs three checks:
  1) Publish telemetry(ts1) over MQTT.
  2) Publish same telemetry(ts1) again and confirm query count stays the same (idempotency).
  3) Publish telemetry(ts2) and confirm query count increases (new point).

  This runner is intentionally dependency-light and deterministic.
*/

const mqtt = require("mqtt"); // MQTT client library (available via apps/telemetry-ingest dependencies).

const FAIL_PREFIX = "[FAIL]"; // Standard failure prefix for grepping.
const PASS_MARKER = "[PASS] ACCEPTANCE_SPRINTA1_TELEMETRY_MQTT_SMOKE"; // Standard PASS marker.

function fail(msg) { // Throw an error to exit with non-zero status.
  throw new Error(`${FAIL_PREFIX} ${msg}`); // Standardized error format.
}

function parseArgs(argv) { // Parse CLI args like: --key value
  const out = {}; // Accumulator for parsed arguments.
  for (let i = 2; i < argv.length; i++) { // Skip node + script.
    const a = argv[i]; // Current token.
    if (!a.startsWith("--")) { continue; } // Ignore positional args.
    const k = a.slice(2); // Key without leading dashes.
    const v = argv[i + 1]; // Next token is the value.
    if (!v || v.startsWith("--")) { out[k] = ""; continue; } // Handle missing value.
    out[k] = v; // Store the value.
    i++; // Advance past the value.
  }
  return out; // Return parsed result.
}

function sleep(ms) { // Simple sleep helper.
  return new Promise((r) => setTimeout(r, ms)); // Promise-based delay.
}

async function publishOnce({ mqttUrl, topic, payload }) { // Publish a single MQTT message.
  return new Promise((resolve, reject) => { // Promise wrapper around mqtt callbacks.
    const c = mqtt.connect(mqttUrl, { connectTimeout: 5000 }); // Connect with a timeout.

    const onError = (e) => { // Unified error handler.
      try { c.end(true); } catch (_) {} // Best-effort close.
      reject(e); // Reject the promise.
    };

    c.on("error", onError); // Handle connection errors.
    c.on("connect", () => { // Once connected, publish.
      c.publish(topic, payload, { qos: 1 }, (err) => { // QoS1 to exercise retry-safe publish.
        if (err) { return onError(err); } // Fail on publish error.
        c.end(true, () => resolve()); // Close connection and resolve.
      });
    });
  });
}

async function queryTelemetry({ baseUrl, token, deviceId, metric, fromTsMs, toTsMs }) { // Call the telemetry query API.
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/api/telemetry/v1/query`); // Build URL safely.
  url.searchParams.set("device_id", deviceId); // device_id filter.
  url.searchParams.set("metric", metric); // metric filter.
  url.searchParams.set("from_ts_ms", String(fromTsMs)); // start timestamp.
  url.searchParams.set("to_ts_ms", String(toTsMs)); // end timestamp.

  const res = await fetch(url.toString(), { // Execute HTTP request.
    method: "GET", // Read-only.
    headers: {
      "Accept": "application/json", // Request JSON.
      "Authorization": `Bearer ${token}`, // Use bearer token.
    },
  });

  const text = await res.text(); // Read body as text for better error messages.
  if (!res.ok) { fail(`query http ${res.status}: ${text}`); } // Fail on non-2xx.

  let obj; // Parsed JSON.
  try { obj = JSON.parse(text); } catch (e) { fail(`query returned non-json: ${text}`); } // Ensure JSON.
  return obj; // Return response object.
}

async function main() { // Main entry point.
  const args = parseArgs(process.argv); // Parse CLI args.
  const baseUrl = args.baseUrl || "http://127.0.0.1:3000"; // Default server base URL.
  const token = args.token || ""; // Bearer token.
  const mqttUrl = args.mqttUrl || "mqtt://127.0.0.1:1883"; // Default MQTT broker.

  if (!token) { fail("missing --token"); } // Token is required for auth.

  const tenantId = "tenantA"; // Deterministic tenant for smoke.
  const deviceId = "dev1"; // Deterministic device for smoke.
  const metric = "soil_moisture"; // Deterministic metric.
  const value = 21.3; // Deterministic value.
  const ts1 = 1700000000000; // Deterministic timestamp for idempotency check.
  const ts2 = 1700000001000; // Deterministic timestamp for new-point check.

  const topic = `telemetry/${tenantId}/${deviceId}`; // Topic format defined by Sprint A1.
  const p1 = JSON.stringify({ metric, value, ts_ms: ts1 }); // Payload #1.
  const p2 = JSON.stringify({ metric, value, ts_ms: ts2 }); // Payload #2.

  console.log(`[INFO] baseUrl=${baseUrl}`); // Log baseUrl.
  console.log(`[INFO] mqttUrl=${mqttUrl}`); // Log mqttUrl.
  console.log(`[INFO] topic=${topic}`); // Log topic.

  await publishOnce({ mqttUrl, topic, payload: p1 }); // Publish first point.
  await sleep(200); // Give ingest a brief moment to persist.

  const q1 = await queryTelemetry({ baseUrl, token, deviceId, metric, fromTsMs: ts1 - 1000, toTsMs: ts2 + 1000 }); // Query window.
  if (q1.ok !== true) { fail(`expected ok=true, got: ${JSON.stringify(q1)}`); } // Response must be ok.
  if (q1.count !== 1) { fail(`expected count=1 after first publish, got ${q1.count}`); } // First publish should yield 1.

  await publishOnce({ mqttUrl, topic, payload: p1 }); // Publish same point again (idempotency).
  await sleep(200); // Allow ingest to apply ON CONFLICT DO NOTHING.

  const q2 = await queryTelemetry({ baseUrl, token, deviceId, metric, fromTsMs: ts1 - 1000, toTsMs: ts2 + 1000 }); // Query same window.
  if (q2.count !== 1) { fail(`expected count=1 after duplicate publish, got ${q2.count}`); } // Count must remain 1.

  await publishOnce({ mqttUrl, topic, payload: p2 }); // Publish new point.
  await sleep(200); // Allow ingest to persist.

  const q3 = await queryTelemetry({ baseUrl, token, deviceId, metric, fromTsMs: ts1 - 1000, toTsMs: ts2 + 1000 }); // Query window.
  if (q3.count !== 2) { fail(`expected count=2 after new publish, got ${q3.count}`); } // Now should be 2.

  console.log(PASS_MARKER); // Print PASS marker.
}

main().catch((e) => { // Top-level error handling.
  console.error(String(e && e.stack ? e.stack : e)); // Print error.
  process.exit(1); // Non-zero exit code.
});
