// scripts/commercial_evidence/SMOKE_COMMERCIAL_EVIDENCE_DEMO_V1.mjs
// Purpose: start the standalone Commercial Evidence Demo and prove canonical Runtime execution, complete builder trace, connected read-only persisted-data plumbing, and safe Neon MCFT read-model behavior without CI database credentials.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(process.cwd());
const PORT = 43000 + (process.pid % 500);
const UPSTREAM_PORT = 44000 + (process.pid % 500);
const BASE = `http://127.0.0.1:${PORT}`;
const UPSTREAM_BASE = `http://127.0.0.1:${UPSTREAM_PORT}`;
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const LIVE_DECISION_CYCLE_ID = "dc_smoke_live_001";
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

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

const mockDerived = {
  field_state_snapshot_v1: { snapshot_id: "snapshot_smoke_live_001", determinism_hash: "hash_snapshot_smoke_live_001" },
  forecast_run_v1: { forecast_run_id: "forecast_smoke_live_001", determinism_hash: "hash_forecast_smoke_live_001" },
  scenario_set_v1: { scenario_set_id: "scenario_smoke_live_001", determinism_hash: "hash_scenario_smoke_live_001" },
  calibration_replay_v1: { calibration_replay_id: "replay_smoke_live_001", determinism_hash: "hash_replay_smoke_live_001" },
  forecast_error_v1: { forecast_error_id: "error_smoke_live_001", determinism_hash: "hash_error_smoke_live_001" },
  field_learning_candidate_v1: { field_learning_candidate_id: "learning_smoke_live_001", determinism_hash: "hash_learning_smoke_live_001" },
  decision_cycle_v1: { decision_cycle_id: LIVE_DECISION_CYCLE_ID, determinism_hash: "hash_decision_smoke_live_001" },
};

const mockTwinTrace = {
  object_type: "twin_trace_v1_read_model",
  decision_cycle_id: LIVE_DECISION_CYCLE_ID,
  read_only: true,
  system_derived: mockDerived,
  answers: {
    current_field_state: { water_state: "NORMAL", soil_moisture_percent: 23.4, confidence_level: "HIGH" },
    seven_day_forecast: { horizon_days: 7, point_count: 7 },
    scenario_comparison: { option_count: 2 },
    decision_cycle: { current_stage: "ACCEPTED", forbidden_auto_writes_absent: true },
  },
};

const upstream = createServer((req, res) => {
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "GET_ONLY" });
  const url = new URL(req.url ?? "/", UPSTREAM_BASE);
  if (url.pathname === "/api/v1/twin-kernel/operator-workflow/decision-cycles") {
    return sendJson(res, 200, {
      ok: true,
      object_type: "operator_decision_queue_v0",
      read_only: true,
      write_ready: false,
      decision_cycles: [{ decision_cycle_id: LIVE_DECISION_CYCLE_ID, field_id: "field_smoke_live", current_stage: "ACCEPTED" }],
    });
  }
  if (url.pathname === `/api/v1/twin-kernel/traces/${LIVE_DECISION_CYCLE_ID}`) {
    return sendJson(res, 200, { ok: true, twin_trace: mockTwinTrace });
  }
  return sendJson(res, 404, { ok: false, error: "MOCK_UPSTREAM_NOT_FOUND" });
});

await new Promise((resolve) => upstream.listen(UPSTREAM_PORT, "127.0.0.1", resolve));

const child = spawn(pnpm, ["exec", "tsx", "tools/commercial-evidence-demo/server.ts"], {
  cwd: ROOT,
  env: {
    ...process.env,
    COMMERCIAL_EVIDENCE_DEMO_PORT: String(PORT),
    COMMERCIAL_EVIDENCE_MCFT_READ_URL: "",
    GEOX_BASE_URL: UPSTREAM_BASE,
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
      if (response.ok
        && body.ok === true
        && body.read_only === true
        && body.connected_data_capable === true
        && body.mcft_neon_data_capable === true) {
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
  assert.equal(demo.body.runtime_context.mcft_historical_database, "geox_mcft_cap09_s6_accel24t_am19_v3");
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

  const mcft = await getJson("/api/mcft-runtime-evidence");
  assert.equal(mcft.response.status, 200);
  assert.equal(mcft.body.ok, true);
  assert.equal(mcft.body.connected, false);
  assert.equal(mcft.body.read_only, true);
  assert.equal(mcft.body.source_mode, "NEON_MCFT_HISTORICAL_QUALIFICATION_READ_MODEL_V1");
  assert.equal(mcft.body.database_name, "geox_mcft_cap09_s6_accel24t_am19_v3");
  assert.equal(mcft.body.production_live, false);
  assert.equal(mcft.body.formal_o00_o23_closure, false);
  assert.equal(mcft.body.error, "MCFT_READ_URL_NOT_CONFIGURED");
  assert.equal(mcft.body.database_write_count, 0);
  assert.equal(mcft.body.canonical_runtime_write_count, 0);

  const live = await getJson("/api/live-data");
  assert.equal(live.response.status, 200);
  assert.equal(live.body.ok, true);
  assert.equal(live.body.connected, true);
  assert.equal(live.body.read_only, true);
  assert.equal(live.body.source_mode, "OPERATOR_DECISION_QUEUE");
  assert.equal(live.body.decision_cycle_id, LIVE_DECISION_CYCLE_ID);
  assert.equal(live.body.twin_trace.read_only, true);
  assert.equal(Object.keys(live.body.twin_trace.system_derived).length, 7);
  assert.equal(live.body.database_write_count, 0);
  assert.equal(live.body.canonical_runtime_write_count, 0);

  const explicitLive = await getJson(`/api/live-data?decision_cycle_id=${LIVE_DECISION_CYCLE_ID}`);
  assert.equal(explicitLive.body.connected, true);
  assert.equal(explicitLive.body.source_mode, "EXPLICIT_DECISION_CYCLE_ID");

  const pageResponse = await fetch(`${BASE}/`, { cache: "no-store" });
  const page = await pageResponse.text();
  assert.equal(pageResponse.status, 200);
  for (let section = 1; section <= 6; section += 1) assert.ok(page.includes(`data-section="${section}"`));
  assert.ok(page.includes("mcftRuntimeStatus"));
  assert.ok(page.includes("mcftRuntimeObjects"));
  assert.ok(page.includes("connectedDataStatus"));
  assert.ok(page.includes("connectedTraceObjects"));
  assert.ok(page.includes("runtimeTraceObjects"));
  assert.ok(page.includes("persistedTraceObjects"));

  const rejectedWrite = await fetch(`${BASE}/api/mcft-runtime-evidence`, { method: "POST" });
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
    mcft_neon_endpoint_passed: true,
    mcft_neon_unconfigured_fails_safe: true,
    mcft_neon_read_only: true,
    mcft_neon_write_count: 0,
    connected_data_endpoint_passed: true,
    connected_data_auto_discovery_passed: true,
    connected_data_explicit_cycle_passed: true,
    connected_data_read_only: true,
    connected_data_write_count: 0,
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
  await new Promise((resolve) => upstream.close(() => resolve()));
}
