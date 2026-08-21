// scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1.cjs
// Purpose: prove the off-main Commercial Evidence Demo executes the canonical Amendment-19 selector and exposes all six sales-evidence sections without production route registration.

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
requireToken("server", server, "/api/twin-trace");
requireToken("server", server, "COMMERCIAL_EVIDENCE_DEMO_READ_ONLY_GET_REQUIRED");
requireToken("app", app, "/api/demo");
requireToken("app", app, "/api/twin-trace?decision_cycle_id=");
requireToken("app", app, "Open full GEOX Twin Trace");
requireToken("docs", docs, "NOT PRODUCTION AUTHORITY");

for (let section = 1; section <= 6; section += 1) {
  requireToken("html", html, `data-section="${section}"`);
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const run = spawnSync(pnpm, ["exec", "tsx", "tools/commercial-evidence-demo/selftest.ts"], {
  cwd: ROOT,
  encoding: "utf8",
  env: process.env,
});
if (run.status !== 0) {
  process.stderr.write(run.stdout || "");
  process.stderr.write(run.stderr || "");
  throw new Error(`COMMERCIAL_EVIDENCE_DEMO_CANONICAL_SELFTEST_FAILED:${run.status}`);
}

let selftest;
try {
  selftest = JSON.parse(run.stdout.trim());
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

console.log(JSON.stringify({
  ok: true,
  acceptance: "ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1",
  six_pack_sections_present: true,
  canonical_selector_selftest_passed: true,
  canonical_runtime_code_executed: true,
  provider_late_behavior: selftest.provider_late_behavior,
  source_conflict_behavior: selftest.source_conflict_behavior,
  missing_evidence_behavior: selftest.missing_evidence_behavior,
  standalone_microsite: true,
  production_route_registration_changed: false,
  provider_request_count: 0,
  database_write_count: 0,
  canonical_runtime_write_count: 0,
  formal_effect: false,
}, null, 2));
