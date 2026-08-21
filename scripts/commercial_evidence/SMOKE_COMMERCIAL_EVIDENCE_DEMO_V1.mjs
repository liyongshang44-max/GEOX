// scripts/commercial_evidence/SMOKE_COMMERCIAL_EVIDENCE_DEMO_V1.mjs
// Purpose: start the standalone Commercial Evidence Demo and prove its real HTTP surfaces execute the canonical selector and Twin Kernel Runtime Value Trace.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(process.cwd());
const PORT = 43000 + (process.pid % 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
let stdout = "";
let stderr = "";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(pathname) {
  const response = await fetch(`${BASE}${pathname}`, { cache: "no-store" });
  const body = await response.json();
  return { response, body };
}

const child = spawn(pnpm, ["exec", "tsx", "tools/commercial-evidence-demo/server.ts"], {
  cwd: ROOT,
  env: {
    ...process.env,
    COMMERCIAL_EVIDENCE_DEMO_PORT: String(PORT),
    GEOX_BASE_URL: "http://127.0.0.1:1",
    GEOX_OPERATOR_BASE_URL: "http://127.0.0.1:5173",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (chunk) => { stdout += String(chunk); });
child.stderr.on("data", (chunk) => { stderr += String(chunk); });

try {
  let healthy = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`COMMERCIAL_EVIDENCE_DEMO_SERVER_EXITED_EARLY:${child.exitCode}:${stderr.slice(0, 800)}`);
    try {
      const { response, body } = await getJson("/healthz");
      if (response.ok && body.ok === true && body.read_only === true) {
        healthy = true;
        break;
      }
    } catch {}
    await sleep(100);
  }
  assert.equal(healthy, true, `COMMERCIAL_EVIDENCE_DEMO_HEALTH_TIMEOUT:${stdout.slice(0, 500)}:${stderr.slice(0, 500)}`);

  const demo = await getJson("/api/demo");
  assert.equal(demo.response.status, 200);
  assert.equal(demo.body.ok, true);
  assert.equal(demo.body.canonical_runtime_code_executed, true);
  const late = demo.body.cases.find((item) => item.case_id === "provider_late");
  const conflict = demo.body.cases.find((item) => item.case_id === "source_conflict");
  const missing = demo.body.cases.find((item) => item.case_id === "missing_evidence");
  assert.equal(late.outcome.action, "DEGRADE_AND_CONTINUE");
  assert.equal(conflict.outcome.action, "FAIL_CLOSED");
  assert.equal(missing.outcome.action, "FAIL_CLOSED");

  const trace = await getJson("/api/runtime-value-trace");
  assert.equal(trace.response.status, 200);
  assert.equal(trace.body.ok, true);
  assert.equal(trace.body.runtime_builders_invoked, true);
  assert.equal(trace.body.complete_tk_chain_built, true);
  assert.equal(trace.body.determinism_stable, true);
  assert.equal(trace.body.forbidden_auto_writes_absent, true);
  assert.equal(Object.keys(trace.body.twin_trace.system_derived).length, 7);

  const pageResponse = await fetch(`${BASE}/`, { cache: "no-store" });
  const page = await pageResponse.text();
  assert.equal(pageResponse.status, 200);
  for (let section = 1; section <= 6; section += 1) assert.ok(page.includes(`data-section="${section}"`));
  assert.ok(page.includes("runtimeTraceObjects"));
  assert.ok(page.includes("persistedTraceObjects"));

  const rejectedWrite = await fetch(`${BASE}/api/demo`, { method: "POST" });
  const rejectedWriteBody = await rejectedWrite.json();
  assert.equal(rejectedWrite.status, 405);
  assert.equal(rejectedWriteBody.error, "COMMERCIAL_EVIDENCE_DEMO_READ_ONLY_GET_REQUIRED");

  console.log(JSON.stringify({
    ok: true,
    smoke: "SMOKE_COMMERCIAL_EVIDENCE_DEMO_V1",
    standalone_server_started: true,
    healthz_passed: true,
    canonical_demo_endpoint_passed: true,
    runtime_value_trace_endpoint_passed: true,
    six_section_page_served: true,
    write_method_rejected: true,
    provider_late_behavior: late.outcome.action,
    source_conflict_behavior: conflict.outcome.action,
    missing_evidence_behavior: missing.outcome.action,
    runtime_value_trace_object_count: Object.keys(trace.body.twin_trace.system_derived).length,
  }, null, 2));
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(2000),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
