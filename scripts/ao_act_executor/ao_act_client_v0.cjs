#!/usr/bin/env node // Enable direct invocation if desired.
"use strict"; // Enforce strict mode for predictable behavior.

const fs = require("node:fs"); // Node filesystem module for artifact output.
const path = require("node:path"); // Node path module for cross-platform file paths.
const process = require("node:process"); // Node process module for env vars and exit codes.

const _requestLog = []; // Internal request log (only this client's business calls).
const _requestLogPath = String(process.env.GEOX_AO_ACT_CLIENT_LOG_PATH ?? "").trim(); // Optional shared JSONL log path for cross-process negative guards.

function normalizeBaseUrl(baseUrl) { // Normalize a base URL to avoid double slashes.
  const s = String(baseUrl ?? "").trim(); // Coerce to string and trim whitespace.
  if (!s) throw new Error("BASE_URL_EMPTY"); // Fail fast if base URL is missing.
  return s.endsWith("/") ? s.slice(0, -1) : s; // Remove trailing slash for stable join.
} // End block.

function recordRequest(method, url) { // Record a business request for negative-guard assertions.
  const entry = { method: String(method), url: String(url) }; // Normalize request log entry fields.
  _requestLog.push(entry); // Append request entry to in-memory log.
  if (_requestLogPath) fs.appendFileSync(_requestLogPath, JSON.stringify(entry) + "\n", { encoding: "utf8" }); // Optionally append JSONL to shared log file.
} // End block.

async function fetchText(url, init) { // Fetch raw text with robust error reporting.
  const res = await fetch(url, init); // Issue the HTTP request using global fetch.
  const text = await res.text(); // Read the response body as text (byte-stable in artifact storage).
  return { status: res.status, text, headers: res.headers }; // Return minimal response envelope.
} // End block.

function tryParseJson(text) { // Parse JSON if possible; otherwise return null.
  try { // Guard JSON parsing errors.
    return text && text.length ? JSON.parse(text) : null; // Parse non-empty strings; treat empty as null.
  } catch { // Swallow parsing errors deterministically.
    return null; // Return null if body is not valid JSON.
  } // End block.
} // End block.

function writeFileUtf8(filePath, text) { // Write UTF-8 text without BOM using Node's default behavior.
  fs.mkdirSync(path.dirname(filePath), { recursive: true }); // Ensure parent directory exists.
  fs.writeFileSync(filePath, text, { encoding: "utf8" }); // Write with UTF-8 encoding (no BOM by default).
} // End block.

async function requestJson(baseUrl, method, routePath, bodyObj, opts = {}) { // Issue JSON request and record it.
  const b = normalizeBaseUrl(baseUrl); // Normalize base URL once per call.
  const url = `${b}${routePath}`; // Construct absolute URL for the request.
  recordRequest(method, url); // Record this call for the negative-guard acceptance.
  const headers = { "accept": "application/json" }; // Default accept header for API responses.
  if (bodyObj !== undefined) headers["content-type"] = "application/json"; // Add JSON content type when sending a body.
  const bodyText = bodyObj === undefined ? undefined : JSON.stringify(bodyObj); // Serialize body deterministically.
  const res = await fetchText(url, { method, headers: { ...headers, ...(opts.headers ?? {}) }, body: bodyText }); // Perform fetch with merged headers.
  const json = tryParseJson(res.text); // Try to parse response JSON for convenience.
  if (opts.saveRawPath) writeFileUtf8(opts.saveRawPath, res.text); // Optionally persist exact response body to disk.
  return { status: res.status, text: res.text, json }; // Return a stable envelope for callers.
} // End block.

async function postTask(baseUrl, payload, opts = {}) { // Create an AO-ACT task fact via server endpoint.
  return requestJson(baseUrl, "POST", "/api/control/ao_act/task", payload, opts); // Delegate to common JSON requester.
} // End block.

async function postReceipt(baseUrl, payload, opts = {}) { // Write an AO-ACT receipt fact via server endpoint.
  return requestJson(baseUrl, "POST", "/api/control/ao_act/receipt", payload, opts); // Delegate to common JSON requester.
} // End block.

async function getIndex(baseUrl, params = {}, opts = {}) { // Read AO-ACT index for auditing and demo-only selection.
  const q = []; // Build query string key/value pairs.
  if (params.act_task_id) q.push(`act_task_id=${encodeURIComponent(String(params.act_task_id))}`); // Add optional act_task_id filter.
  const qs = q.length ? `?${q.join("&")}` : ""; // Join query string deterministically.
  return requestJson(baseUrl, "GET", `/api/control/ao_act/index${qs}`, undefined, opts); // Issue the GET request without a body.
} // End block.

function getRequestLog() { // Return the captured business request log.
  return [..._requestLog]; // Return a shallow copy to prevent external mutation.
} // End block.

module.exports = { // Export a tiny stable API surface for executor scripts and acceptance runner.
  postTask, // Provide task creation API call.
  postReceipt, // Provide receipt write API call.
  getIndex, // Provide index read API call.
  getRequestLog, // Provide request log for negative-guard acceptance.
  writeFileUtf8, // Provide artifact writer for acceptance runner.
  normalizeBaseUrl // Provide base URL normalization for reuse.
}; // Line is part of control flow.
