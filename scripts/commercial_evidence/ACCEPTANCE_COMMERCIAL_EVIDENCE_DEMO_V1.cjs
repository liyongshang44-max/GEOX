// scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1.cjs
// Purpose: prove the off-main Commercial Evidence Demo executes existing canonical Runtime code, serves a real standalone HTTP demo, exposes all six sales-evidence sections, keeps both product and historical MCFT data paths read-only, and preserves the Chinese CEO 60-second presentation hierarchy.

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
  smoke: path.join(ROOT, "scripts/commercial_evidence/SMOKE_COMMERCIAL_EVIDENCE_DEMO_V1.mjs"),
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
const style = text(files.style);
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
requireToken("server", server, "/api/mcft-runtime-evidence");
requireToken("server", server, "COMMERCIAL_EVIDENCE_MCFT_READ_URL");
requireToken("server", server, "geox_mcft_cap09_s6_accel24t_am19_v3");
requireToken("server", server, "MCFT_DATABASE_NOT_ALLOWLISTED");
requireToken("server", server, "BEGIN READ ONLY");
requireToken("server", server, "SET LOCAL statement_timeout");
requireToken("server", server, "ROLLBACK");
requireToken("server", server, "database_write_count: 0");
requireToken("server", server, "canonical_runtime_write_count: 0");
requireToken("server", server, "COMMERCIAL_EVIDENCE_DEMO_READ_ONLY_GET_REQUIRED");
requireToken("app", app, "/api/demo");
requireToken("app", app, "/api/runtime-value-trace");
requireToken("app", app, "/api/mcft-runtime-evidence");
requireToken("app", app, "/api/twin-trace?decision_cycle_id=");
requireToken("app", app, "打开完整 GEOX Twin Trace");
requireToken("app", app, "使用上一步的合规假设值");
requireToken("app", app, "降级继续");
requireToken("app", app, "农业 AI 最大的问题");
requireToken("docs", docs, "NOT PRODUCTION AUTHORITY");
requireToken("docs", docs, "PERSISTED ENGINEERING QUALIFICATION");
requireToken("docs", docs, "COMMERCIAL_EVIDENCE_MCFT_READ_URL");
requireToken("docs", docs, "CEO default presentation path");

for (let section = 1; section <= 6; section += 1) {
  requireToken("html", html, `data-section="${section}"`);
}
requireToken("html", html, "农业 AI 决策可信性 · 60 秒证明");
requireToken("html", html, "同样一条数据，只因为“什么时候真正可知”不同");
requireToken("html", html, "这是一条真实运行留下的证据链");
requireToken("html", html, "客户应该理解什么");
requireToken("html", html, "技术细节");
requireToken("html", html, "工程证据附录");
requireToken("html", html, "证据边界");
requireToken("html", html, "mcftRuntimeStatus");
requireToken("html", html, "mcftRuntimeObjects");
requireToken("html", html, "runtimeTraceObjects");
requireToken("html", html, "persistedTraceObjects");
requireToken("style", style, ".topbar { position: relative;");
requireToken("style", style, ".executive-trace-grid { grid-template-columns: repeat(3");

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
if (selftest.ok !== true || selftest.canonical_runtime_code_executed !== true) throw new Error("COMMERCIAL_EVIDENCE_DEMO_SELFTEST_NOT_PASS");
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

const smokeEnv = { ...process.env, COMMERCIAL_EVIDENCE_MCFT_READ_URL: "" };
const smokeRun = spawnSync(process.execPath, ["scripts/commercial_evidence/SMOKE_COMMERCIAL_EVIDENCE_DEMO_V1.mjs"], {
  cwd: ROOT,
  encoding: "utf8",
  env: smokeEnv,
  timeout: 30_000,
});
if (smokeRun.status !== 0) {
  process.stderr.write(smokeRun.stdout || "");
  process.stderr.write(smokeRun.stderr || "");
  throw new Error(`COMMERCIAL_EVIDENCE_DEMO_HTTP_SMOKE_FAILED:${smokeRun.status}:${smokeRun.signal ?? "NO_SIGNAL"}`);
}
let smoke;
try {
  smoke = JSON.parse(smokeRun.stdout.trim());
} catch {
  throw new Error("COMMERCIAL_EVIDENCE_DEMO_HTTP_SMOKE_NON_JSON_OUTPUT");
}
if (smoke.ok !== true
  || smoke.standalone_server_started !== true
  || smoke.healthz_passed !== true
  || smoke.canonical_demo_endpoint_passed !== true
  || smoke.runtime_value_trace_endpoint_passed !== true
  || smoke.mcft_neon_endpoint_passed !== true
  || smoke.mcft_neon_unconfigured_fails_safe !== true
  || smoke.mcft_neon_read_only !== true
  || smoke.mcft_neon_write_count !== 0
  || smoke.six_section_page_served !== true
  || smoke.write_method_rejected !== true) {
  throw new Error("COMMERCIAL_EVIDENCE_DEMO_HTTP_SMOKE_NOT_PASS");
}

console.log(JSON.stringify({
  ok: true,
  acceptance: "ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1",
  six_pack_sections_present: true,
  chinese_sixty_second_buyer_path_guard_present: true,
  engineering_details_secondary_guard_present: true,
  evidence_boundary_present: true,
  topbar_non_overlay_guard_present: true,
  canonical_selector_selftest_passed: true,
  canonical_runtime_code_executed: true,
  provider_late_behavior: selftest.provider_late_behavior,
  source_conflict_behavior: selftest.source_conflict_behavior,
  missing_evidence_behavior: selftest.missing_evidence_behavior,
  runtime_value_trace_builder_chain_passed: true,
  runtime_value_trace_object_count: requiredTraceObjects.length,
  runtime_value_trace_determinism_stable: runtimeTrace.determinism_stable,
  runtime_value_trace_forbidden_auto_writes_absent: runtimeTrace.forbidden_auto_writes_absent,
  mcft_neon_historical_read_model_guard_present: true,
  mcft_neon_allowlisted_database: "geox_mcft_cap09_s6_accel24t_am19_v3",
  mcft_neon_read_only_transaction_guard_present: true,
  mcft_neon_ci_secret_required: false,
  standalone_microsite: true,
  standalone_http_smoke_passed: true,
  healthz_passed: smoke.healthz_passed,
  canonical_demo_endpoint_passed: smoke.canonical_demo_endpoint_passed,
  runtime_value_trace_endpoint_passed: smoke.runtime_value_trace_endpoint_passed,
  mcft_neon_endpoint_passed: smoke.mcft_neon_endpoint_passed,
  mcft_neon_unconfigured_fails_safe: smoke.mcft_neon_unconfigured_fails_safe,
  six_section_page_served: smoke.six_section_page_served,
  write_method_rejected: smoke.write_method_rejected,
  production_route_registration_changed: false,
  provider_request_count: 0,
  database_write_count: 0,
  canonical_runtime_write_count: 0,
  formal_effect: false,
}, null, 2));
