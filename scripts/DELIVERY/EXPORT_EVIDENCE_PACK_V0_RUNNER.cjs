// GEOX/scripts/DELIVERY/EXPORT_EVIDENCE_PACK_V0_RUNNER.cjs
// Sprint 23: Evidence Pack v0 export runner (zip + manifest + sha256, tenant-scoped, non-enumerable 404).

"use strict"; // Enforce strict mode for safer JS semantics.

const fs = require("node:fs"); // File system for writing evidence artifacts.
const path = require("node:path"); // Path helpers for deterministic ordering.
const crypto = require("node:crypto"); // SHA-256 hashing.
const { execFileSync } = require("node:child_process"); // Run docker/psql/powershell.

function parseArgs(argv) { // Parse CLI args of form --key value.
  const out = {}; // Accumulate parsed args.
  for (let i = 2; i < argv.length; i += 1) { // Iterate argv skipping node + script.
    const k = argv[i]; // Current token.
    const v = argv[i + 1]; // Next token as value.
    if (typeof k === "string" && k.startsWith("--")) { // Only accept --key tokens.
      out[k.slice(2)] = v; // Store without leading dashes.
      i += 1; // Consume value token.
    }
  }
  return out; // Return parsed args.
}

function ensureDir(p) { // Ensure directory exists.
  fs.mkdirSync(p, { recursive: true }); // Create directory recursively.
}

function sha256Bytes(buf) { // Compute SHA-256 of a buffer.
  return crypto.createHash("sha256").update(buf).digest("hex"); // Return hex digest.
}

function sha256File(filePath) { // Compute SHA-256 of a file.
  const buf = fs.readFileSync(filePath); // Read file.
  return sha256Bytes(buf); // Hash bytes.
}

function repoRootFromHere() { // Resolve repo root from this script location.
  return path.resolve(__dirname, "..", "..", ".."); // scripts/DELIVERY -> repo root.
}

function httpFetchJson(url, token) { // Fetch JSON using Node 20 global fetch.
  const headers = { "content-type": "application/json" }; // JSON header.
  if (token && String(token).trim().length) headers["authorization"] = `Bearer ${token}`; // Bearer token.
  return fetch(url, { method: "GET", headers }).then(async (res) => {
    const text = await res.text(); // Read body.
    let json = null; // Parsed JSON.
    try { json = text.length ? JSON.parse(text) : null; } catch { json = null; } // Best-effort parse.
    return { status: res.status, json, text }; // Return triple.
  });
}

function joinUrlWithQuery(base, pathname, query) { // Join base + path + query.
  const u = new URL(base); // Parse base URL.
  u.pathname = pathname; // Set path.
  for (const [k, v] of Object.entries(query)) { // Iterate query keys.
    if (v === undefined || v === null) continue; // Skip empty.
    u.searchParams.set(String(k), String(v)); // Set query.
  }
  return u.toString(); // Return URL.
}

function dockerPsqlJsonLines(sql) { // Execute psql inside the postgres container and return JSON lines.
  const containerName = String(process.env.GEOX_PG_CONTAINER || "geox-postgres"); // Postgres container name.
  const user = String(process.env.GEOX_PG_USER || "landos"); // Postgres user.
  const db = String(process.env.GEOX_PG_DB || "landos"); // Postgres database.
  const cmd = ["exec", containerName, "psql", "-U", user, "-d", db, "-At", "-c", sql]; // docker exec psql ...
  const out = String(execFileSync("docker", cmd, { encoding: "utf8" })); // Run docker.
  return out
    .split(/\r?\n/) // Split lines.
    .map((l) => l.trim()) // Trim.
    .filter((l) => l.length > 0); // Drop empty.
}

function safeJsonParse(line) { // Parse a JSON line.
  try { return JSON.parse(line); } catch { return null; } // Best-effort parse.
}

function writeJsonFile(filePath, obj) { // Write JSON file deterministically.
  const text = JSON.stringify(obj, null, 2) + "\n"; // Pretty JSON.
  fs.writeFileSync(filePath, text, "utf8"); // Write UTF-8.
}

function deterministicFileList(dir) { // List files relative to dir in deterministic order.
  const files = fs.readdirSync(dir).slice().sort((a, b) => a.localeCompare(b)); // Sort by filename.
  return files; // Return file list.
}

async function main() {
  const args = parseArgs(process.argv); // Parse args.
  const baseUrl = String(args.baseUrl || "http://127.0.0.1:3000"); // Base URL.
  const tenant_id = String(args.tenant_id || "").trim(); // Tenant id.
  const project_id = String(args.project_id || "").trim(); // Project id.
  const group_id = String(args.group_id || "").trim(); // Group id.
  const task_id = String(args.task_id || "").trim(); // act_task_id.

  if (!tenant_id || !project_id || !group_id || !task_id) {
    console.error("[FAIL] missing required inputs: tenant_id/project_id/group_id/task_id");
    process.exit(2);
  }

  // 1) Isolation gate binding (Sprint 22 semantics): verify scope mismatch yields 404 (non-enumerable).
  const token = String(process.env.GEOX_AO_ACT_TOKEN_EXPORT || ""); // Token required for /index read.
  const url = joinUrlWithQuery(baseUrl, "/api/control/ao_act/index", { tenant_id, project_id, group_id, act_task_id: task_id });
  const res = await httpFetchJson(url, token);
  if (res.status === 401) {
    console.error("[FAIL] export requires a valid token with ao_act.index.read; set GEOX_AO_ACT_TOKEN_EXPORT");
    process.exit(3);
  }
  if (res.status === 404) {
    console.error("[FAIL] scope mismatch or not found (non-enumerable 404)");
    process.exit(4);
  }
  if (res.status !== 200) {
    console.error(`[FAIL] unexpected status from index: ${res.status}`);
    process.exit(5);
  }

  // 2) Export from ledger via docker exec psql, filtered by tenant triple (hard isolation).
  const repoRoot = repoRootFromHere();
  const outRoot = path.join(repoRoot, "_exports", "delivery", "evidence_pack_v0", tenant_id, project_id, group_id, task_id);
  ensureDir(outRoot);

  // 2.1) Task fact.
  const taskSql = `SELECT jsonb_build_object(
    'fact_id', fact_id,
    'occurred_at', occurred_at,
    'source', source,
    'record_json', record_json
  )
  FROM facts
  WHERE (record_json::jsonb)->>'type' = 'ao_act_task_v0'
    AND (record_json::jsonb)#>> '{payload,tenant_id}' = '${tenant_id.replace(/'/g, "''")}'
    AND (record_json::jsonb)#>> '{payload,project_id}' = '${project_id.replace(/'/g, "''")}'
    AND (record_json::jsonb)#>> '{payload,group_id}' = '${group_id.replace(/'/g, "''")}'
    AND (record_json::jsonb)#>> '{payload,act_task_id}' = '${task_id.replace(/'/g, "''")}'
  ORDER BY occurred_at DESC, fact_id DESC
  LIMIT 1;`;
  const taskLines = dockerPsqlJsonLines(taskSql);
  if (taskLines.length < 1) {
    console.error("[FAIL] task fact not found in ledger for given scope");
    process.exit(6);
  }
  const taskFact = safeJsonParse(taskLines[0]);
  if (!taskFact) {
    console.error("[FAIL] failed to parse task fact json from psql");
    process.exit(7);
  }
  const taskFile = path.join(outRoot, "task_fact.json");
  writeJsonFile(taskFile, taskFact);

  // 2.2) Latest receipt fact.
  const receiptSql = `SELECT jsonb_build_object(
    'fact_id', fact_id,
    'occurred_at', occurred_at,
    'source', source,
    'record_json', record_json
  )
  FROM facts
  WHERE (record_json::jsonb)->>'type' = 'ao_act_receipt_v0'
    AND (record_json::jsonb)#>> '{payload,tenant_id}' = '${tenant_id.replace(/'/g, "''")}'
    AND (record_json::jsonb)#>> '{payload,project_id}' = '${project_id.replace(/'/g, "''")}'
    AND (record_json::jsonb)#>> '{payload,group_id}' = '${group_id.replace(/'/g, "''")}'
    AND (record_json::jsonb)#>> '{payload,act_task_id}' = '${task_id.replace(/'/g, "''")}'
  ORDER BY occurred_at DESC, fact_id DESC
  LIMIT 1;`;
  const receiptLines = dockerPsqlJsonLines(receiptSql);
  const receiptFact = receiptLines.length ? safeJsonParse(receiptLines[0]) : null;
  const receiptFile = path.join(outRoot, "receipt_fact.json");
  if (receiptFact) writeJsonFile(receiptFile, receiptFact);

  // 2.3) Device evidence facts referenced by receipt payload.device_refs[].ref (fact_id).
  const deviceFactIds = [];
  if (receiptFact && receiptFact.record_json && receiptFact.record_json.payload && Array.isArray(receiptFact.record_json.payload.device_refs)) {
    for (const dr of receiptFact.record_json.payload.device_refs) {
      if (dr && typeof dr.ref === "string" && dr.ref.length > 0) deviceFactIds.push(dr.ref);
    }
  }

  const deviceFiles = [];
  for (const fid of deviceFactIds) {
    const devSql = `SELECT jsonb_build_object(
      'fact_id', fact_id,
      'occurred_at', occurred_at,
      'source', source,
      'record_json', record_json
    )
    FROM facts
    WHERE fact_id = '${String(fid).replace(/'/g, "''")}'
      AND (record_json::jsonb)->>'type' = 'ao_act_device_ref_v0'
      AND (record_json::jsonb)#>> '{payload,meta,tenant_id}' = '${tenant_id.replace(/'/g, "''")}'
      AND (record_json::jsonb)#>> '{payload,meta,project_id}' = '${project_id.replace(/'/g, "''")}'
      AND (record_json::jsonb)#>> '{payload,meta,group_id}' = '${group_id.replace(/'/g, "''")}'
    LIMIT 1;`;
    const devLines = dockerPsqlJsonLines(devSql);
    if (!devLines.length) continue;
    const devFact = safeJsonParse(devLines[0]);
    if (!devFact) continue;
    const fname = `device_ref_${String(fid)}.json`;
    const fpath = path.join(outRoot, fname);
    writeJsonFile(fpath, devFact);
    deviceFiles.push(fname);
  }

  // 3) Manifest (deterministic ordering by filename).
  const fileList = deterministicFileList(outRoot); // Sorted.
  const files = fileList.map((name) => ({ name, sha256: sha256File(path.join(outRoot, name)) }));

  const manifest = {
    pack_generated_at: new Date().toISOString(),
    tool_version: "export_evidence_pack_v0",
    inputs: { tenant_id, project_id, group_id, task_id },
    files
  };

  const manifestPath = path.join(outRoot, "MANIFEST.json");
  writeJsonFile(manifestPath, manifest);

  // Recompute manifest sha after writing.
  const manifestSha = sha256File(manifestPath);
  const manifestShaPath = path.join(outRoot, "MANIFEST.sha256");
  fs.writeFileSync(manifestShaPath, `${manifestSha}  MANIFEST.json\n`, "utf8");

  // 4) Zip the folder using PowerShell Compress-Archive (Windows), if available.
  const zipOutDir = path.join(repoRoot, "_exports", "delivery");
  ensureDir(zipOutDir);
  const zipName = `evidence_pack_${tenant_id}_${project_id}_${group_id}_${task_id}.zip`;
  const zipPath = path.join(zipOutDir, zipName);

  try {
    const psCmd = [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${outRoot.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`
    ];
    execFileSync("powershell", psCmd, { stdio: "ignore" });
  } catch {
    // Zip creation is best-effort; manifest + files remain the audit SSOT.
  }

  console.log(`[OK] wrote ${path.relative(repoRoot, outRoot).replace(/\\/g, "/")}`);
  console.log(`[OK] zip (best-effort) ${path.relative(repoRoot, zipPath).replace(/\\/g, "/")}`);
}

main().catch((e) => {
  console.error("[FAIL]", e && e.message ? e.message : String(e));
  process.exit(1);
});
