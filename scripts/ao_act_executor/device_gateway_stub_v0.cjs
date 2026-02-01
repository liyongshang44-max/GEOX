#!/usr/bin/env node // Allow running the device gateway stub as a standalone process.
"use strict"; // Enforce strict mode.

const http = require("node:http"); // Use built-in HTTP server (no external dependencies).
const process = require("node:process"); // Read argv and set exit codes.

function parseArgs(argv) { // Parse minimal CLI args for stub configuration.
  const out = { port: 18080 }; // Default port for local stub.
  for (let i = 0; i < argv.length; i++) { // Iterate argv tokens.
    const a = argv[i]; // Capture current token.
    if (a === "--port") { out.port = Number(argv[i + 1] ?? out.port); i++; } // Read --port <number>.
  } // End block.
  return out; // Return parsed args.
} // End block.

function readBody(req) { // Read request body into a string.
  return new Promise((resolve, reject) => { // Use promise to integrate with async flow.
    let buf = ""; // Accumulate body text.
    req.on("data", (c) => { buf += c; }); // Append incoming chunks.
    req.on("end", () => resolve(buf)); // Resolve when stream ends.
    req.on("error", (e) => reject(e)); // Reject on stream errors.
  }); // End call and close block.
} // End block.

function sendJson(res, statusCode, obj) { // Send JSON response with correct headers.
  const text = JSON.stringify(obj); // Serialize response deterministically.
  res.writeHead(statusCode, { "content-type": "application/json" }); // Write status and headers.
  res.end(text); // End response with body.
} // End block.

async function handle(req, res) { // Handle all incoming requests.
  if (req.method === "GET" && req.url === "/health") { // Provide a minimal health endpoint.
    return sendJson(res, 200, { ok: true }); // Return static OK.
  } // End block.

  if (req.method === "POST" && req.url === "/execute") { // Handle execute calls from device executor.
    const bodyText = await readBody(req); // Read full request body.
    let body = null; // Prepare parsed body holder.
    try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = null; } // Parse JSON if possible.
    if (!body || typeof body !== "object") return sendJson(res, 400, { ok: false, error: "BAD_JSON" }); // Reject invalid JSON.

    const parameters = body.parameters; // Extract parameters from request.
    if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) { // Validate parameters shape.
      return sendJson(res, 400, { ok: false, error: "PARAMETERS_REQUIRED" }); // Reject missing or invalid parameters.
    } // End block.

    return sendJson(res, 200, { // Respond with deterministic observed parameters.
      ok: true, // Indicate success.
      observed_parameters: parameters, // Echo parameters as observed_parameters (deterministic mapping).
      logs_ref: { kind: "device_stub", ref: "stub://execute" } // Provide a stable log reference for receipt logs_refs.
    }); // End call and close block.
  } // End block.

  return sendJson(res, 404, { ok: false, error: "NOT_FOUND" }); // Default 404 for unknown routes.
} // End block.

async function main() { // Entrypoint for stub process.
  const args = parseArgs(process.argv.slice(2)); // Parse CLI args after node + script.
  if (!Number.isFinite(args.port) || args.port <= 0) throw new Error("PORT_INVALID"); // Validate port.

  const server = http.createServer((req, res) => { // Create HTTP server with async handler.
    handle(req, res).catch((e) => { // Catch async errors and reply 500.
      sendJson(res, 500, { ok: false, error: String(e?.message ?? e) }); // Send stable error envelope.
    }); // End call and close block.
  }); // End call and close block.

  server.listen(args.port, "127.0.0.1", () => { // Bind to loopback for safety.
    console.log(`[INFO] device_gateway_stub_v0 listening on http://127.0.0.1:${args.port}`); // Log the listening address.
  }); // End call and close block.
} // End block.

main().catch((err) => { // Handle fatal startup errors.
  console.error("[FAIL] device_gateway_stub_v0 failed:"); // Print stable failure header.
  console.error(err?.stack ?? String(err)); // Print stack or string for diagnostics.
  process.exit(13); // Exit with deterministic non-zero code.
}); // End call and close block.
