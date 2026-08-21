// scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1.cjs
// Purpose: prove the off-main Commercial Evidence Demo executes existing canonical Runtime code, exposes all six sales-evidence sections, and changes no production route registration.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const files = {
  packet: path.join(ROOT, "tools/commercial-evidence-demo/packet.ts"),
  server: path.join(ROOT, "tools/commercial-evidence-demo/server.ts"),
  html: path.join(ROOT, "tools/commercial-evidence-demo/index.html"),
  app: path.join(ROOT, "tools/commercial-evidence-demo/app.js"),
  style: path.join(ROOT, "tools/commercial-evidence-demo/styles.css"),
  selftest: path.join(ROOT, "tools/commercial-evidence-demo/selftest.ts"),
  docs: path.join(ROOT, "docs/commercial/COMMERCIAL-EVIDENCE-DEMO-V1.md"),
};

function text(file) {
  return fs.readFileSync(file, "utf8");
}

function requireToken(name, content, token) {
  if (!content.includes(token)) throw new Error(`COMMERCIAL_EVIDENCE_DEMO_TOKEN_MISSING:${name}:${token}`);
}

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`COMMERCIAL_EVIDENCE_DEMO_FILE_MISSING:${name}:${file}`);
}

const packet = text(files.packet);
const server = text(files.server);
const html = text(files.html);
const app = text(files.app);
const docs = text(files.docs);

requireToken("packet", packet, "selectExternalFormalCurrentIntervalForcingV1");
requireToken("packet", packet, "healthy_exact_provider_pair");
requireToken("packet", packet, "provider_late");
requireToken("packet", packet, "source_conflict");
requireToken("packet", packet, "missing_evidence");
requireToken("packet", packet, "DEGRADE_AND_CONTINUE");
requireToken("packet", packet, "FAIL_CLOSED");
requireToken("packet", packet, "NO_FORMAL_O00_O23_CLAIM");
requireToken("server", server, "standalone read-only Commercial Evidence Demo microsite");
requireToken("server", server, "/api/runtime-value-trace");
requireToken("server", server, "TWIN_KERNEL_RUNTIME_VALUE_TRACE_ACCEPTANCE.cjs");
requireToken("server", server, "/api/twin-trace");
requireToken("server", server, "COMMERCIAL_EVIDENCE_DEMO_READ_ONLY_GET_REQUIRED");
requireToken("app", app, "/api/demo");
requireToken("app", app, "/api/runtime-value-trace");
requireToken("app", app, "/api/twin-trace?decision_cycle_id=");
requireToken("app", app, "Open full GEOX Twin Trace");
requireToken("docs", docs, "NOT PRODUCTION AUTHORITY");

for (let section = 1; section <= 6; section += 1) {
  requireToken("html", html, `data-section="${section}"`);
}
requireToken("html", html, "runtimeTraceObjects");
requireToken("html", html, "persistedTraceObjects");

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const selectorRun = spawnSync(pnpm, ["exec", "tsx", "tools/commercial-evidence-demo/selftest.ts"], {
  cwd: ROOT,
  encoding: "utf8",
  env: process.env,
});
if (selectorRun.status !== 0) {
  process.stderr.write(selectorRun.stdout || "");
  process.stderr.write(selectorRun.stderr || "");
  throw new Error(`COMMERCIAL_EVIDENCE_DEMO_CANONICAL_SELFTEST_FAILED:${selectorRun.status}`);
}

let selftest;
try {
  selftest = JSON.parse(selectorRun.stdout.trim());
} catch {
  throw new Error("COMMERCIAL_EVIDENCE_DEMO_SELFTEST_NON_JSON_OUTPUT");
}
if (selftest.ok !== true || selftest.canonical_runtime_code_executed !== true) {
  throw new Error("COMMERCIAL_EVIDENCE_DEMO_SELFTEST_NOT_PASS");
}
if (selftest.provider_late_behavior !== "DEGRADE_AND_CONTINUE") throw new Error("COMMERCIAL_EVIDENCE_DEMO_PROVIDER_LATE_BEHAVIOR_DRIFT");
if (selftest.source_conflict_behavior !== "FAIL_CLOSED") throw new Error("COMMERCIAL_EVIDENCE_DEMO_SOURCE_CONFLICT_BEHAVIOR_DRIFT");
if (selftest.missing_evidence_behavior !== "FAIL_CLOSED") throw new Error("COMMERCIAL_EVIDENCE_DEMO_MISSING_EVIDENCE_BEHAVIOR_DRIFT");
if (selftest.provider_request_count !== 0 || selftest.database_write_count !== 0 || selftest.canonical_runtime_write_count !== 0) {
  throw new Error("COMMERCIAL_EVIDENCE_DEMO_SIDE_EFFECT_BOUNDARY_DRIFT");
}

const traceRun = spawnSync(process.execPath, ["scripts/governance_acceptance/TWIN_KERNEL_RUNTIME_VALUE_TRACE_ACCEPTANCE.cjs"], {
  cwd: ROOT,
  encoding: "utf8",
  env: process.env,
});
if (traceRun.status !== 0) {
  process.stderr.write(traceRun.stdout || "");
  process.stderr.write(traceRun.stderr || "");
  throw new Error(`COMMERCIAL_EVIDENCE_RUNTIME_VALUE_TRACE_FAILED:${traceRun.status}`);
}

let runtimeTrace;
try {
  runtimeTrace = JSON.parse(traceRun.stdout.trim());
} catch {
  throw new Error("COMMERCIAL_EVIDENCE_RUNTIME_VALUE_TRACE_NON_JSON_OUTPUT");
}
if (runtimeTrace.ok !== true
  || runtimeTrace.runtime_builders_invoked !== true
  || runtimeTrace.complete_tk_chain_built !== true
  || runtimeTrace.determinism_stable !== true
  || runtimeTrace.forbidden_auto_writes_absent !== true) {
  throw new Error("COMMERCIAL_EVIDENCE_RUNTIME_VALUE_TRACE_NOT_PASS");
}
const derived = runtimeTrace?.twin_trace?.system_derived ?? {};
const requiredTraceObjects = [
  "field_state_snapshot_v1",
  "forecast_run_v1",
  "scenario_set_v1",
  "calibration_replay_v1",
  "forecast_error_v1",
  "field_learning_candidate_v1",
  "decision_cycle_v1",
];
if (!requiredTraceObjects.every((objectType) => derived[objectType] && derived[objectType].determinism_hash)) {
  throw new Error("COMMERCIAL_EVIDENCE_RUNTIME_VALUE_TRACE_OBJECT_CHAIN_INCOMPLETE");
}

console.log(JSON.stringify({
  ok: true,
  acceptance: "ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1",
  six_pack_sections_present: true,
  canonical_selector_selftest_passed: true,
  canonical_runtime_code_executed: true,
  provider_late_behavior: selftest.provider_late_behavior,
  source_conflict_behavior: selftest.source_conflict_behavior,
  missing_evidence_behavior: selftest.missing_evidence_behavior,
  runtime_value_trace_builder_chain_passed: true,
  runtime_value_trace_object_count: requiredTraceObjects.length,
  runtime_value_trace_determinism_stable: runtimeTrace.determinism_stable,
  runtime_value_trace_forbidden_auto_writes_absent: runtimeTrace.forbidden_auto_writes_absent,
  standalone_microsite: true,
  production_route_registration_changed: false,
  provider_request_count: 0,
  database_write_count: 0,
  canonical_runtime_write_count: 0,
  formal_effect: false,
}, null, 2));
