const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const W4_ACCEPTED = "f23cc22eb8158a1d9840f042f13ad3fd27b5fe8a";
const BLINE_ACCEPTED = "413386acc04fa2d3404f09d2d1fa8702472e83f1";
const PROTECTED_MAIN = "ca2a96d131bc1d3b2935e7b7460752bdbf79f9bd";
const W4_GATE = "scripts/governance_acceptance/ACCEPTANCE_BLINE_W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.cjs";
const W6B2_GATE = "scripts/governance_acceptance/ACCEPTANCE_BLINE_W6B2_COMMERCIAL_PRINCIPAL_ISOLATION_V1.cjs";
const W6B2_ARTIFACT = "docs/architecture/semantic_convergence/GEOX-BLINE-W6B2-COMMERCIAL-PRINCIPAL-ISOLATION-V1.json";
const BOOTSTRAP = "apps/server/src/infra/bline_commercial_principal_bootstrap_v1.ts";
const DIST = "apps/server/scripts/write_dist_entries.cjs";
const COMPOSE = "docker-compose.commercial_v1.yml";
const ENV_EXAMPLE = ".env.commercial_v1.example";
const TOKENS = "config/auth/security_acceptance_tokens.json";

function sh(args, opts = {}) {
  return cp.execFileSync("git", ["-c", "core.quotepath=false", ...args], { encoding: "utf8", ...opts }).trim();
}
function read(p) { return fs.readFileSync(p, "utf8"); }
function show(ref, p) { return cp.execFileSync("git", ["show", `${ref}:${p}`], { encoding: "utf8" }); }
function assert(c, m, d) { if (!c) throw new Error(m + (d === undefined ? "" : ": " + JSON.stringify(d))); }
function lines(s) { return String(s || "").split(/\r?\n/).filter(Boolean).sort(); }
function assertAncestor(ancestor, descendant, label) {
  try { cp.execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { stdio: "ignore" }); }
  catch { throw new Error(`${label}: ${ancestor} is not an ancestor of ${descendant}`); }
}
function serviceBlock(compose, name) {
  const rows = compose.split(/\r?\n/);
  const start = rows.findIndex((line) => line === `  ${name}:`);
  assert(start >= 0, `missing compose service ${name}`);
  let end = rows.length;
  for (let i = start + 1; i < rows.length; i += 1) {
    if (/^  [A-Za-z0-9][A-Za-z0-9_-]*:\s*$/.test(rows[i])) { end = i; break; }
  }
  return rows.slice(start, end).join("\n");
}
function extractBlineDistEntry(text) {
  const startMarker = '  {\n    name: path.join("database", "bline_commercial_principal_bootstrap.js"),';
  const start = text.indexOf(startMarker);
  assert(start >= 0, "accepted B-Line dist bootstrap entry missing");
  const endMarker = "\n  },";
  const end = text.indexOf(endMarker, start);
  assert(end >= 0, "accepted B-Line dist bootstrap entry is unterminated");
  return text.slice(start, end + endMarker.length);
}

const head = sh(["rev-parse", "HEAD"]);
assert(head !== W4_ACCEPTED, "W4 successor dispatcher must not replace the historical accepted-head gate");
assertAncestor(W4_ACCEPTED, head, "W4 historical lineage");
assertAncestor(BLINE_ACCEPTED, head, "accepted B-Line lineage");
assertAncestor(PROTECTED_MAIN, head, "protected-main integration lineage");

const protectedFiles = [
  "docs/architecture/semantic_convergence/GEOX-BLINE-W4-EXECUTION-DEVICE-RECEIPT-PROVENANCE-V1.json",
  "docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json",
  "apps/executor/src/runtime_loop.ts",
  "apps/executor/src/run_dispatch_once.ts",
  "apps/server/src/domain/auth/roles.ts",
  "apps/server/src/auth/device_credential_auth_v1.ts",
  "apps/server/src/routes/device_heartbeat_v1.ts",
  "apps/server/src/routes/sensing_fact_envelope_v1.ts",
  "apps/server/src/routes/control_ao_sense.ts",
  "apps/server/src/domain/controlplane/task_service.ts",
  "apps/server/src/routes/control_ao_act.ts",
  "apps/server/src/routes/decision_engine_v1.ts",
  "apps/server/src/routes/fail_safe_v1.ts",
  "apps/server/src/routes/v1/operator_dispatch_actions.ts",
  "apps/server/scripts/p1_smoke_device_ready.mjs",
  "apps/server/scripts/p1_skill_loop_minimal.mjs",
  "scripts/acceptance/p1_device_identity_fixture.cjs",
  "scripts/acceptance/run_acceptance.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_P1_SMOKE_PREFLIGHT_IDEMPOTENT_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_BLINE_W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_BLINE_W4_COMMERCIAL_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.ts"
];
const w4Drift = lines(sh(["diff", "--name-only", W4_ACCEPTED, head, "--", ...protectedFiles]));
assert(w4Drift.length === 0, "W4 historical protected source/artifact drift", w4Drift);

const acceptedTokens = JSON.parse(show(W4_ACCEPTED, TOKENS));
const currentTokens = JSON.parse(read(TOKENS));
const acceptedById = new Map((acceptedTokens.tokens || []).map((x) => [String(x.token_id || "").trim(), x]));
const currentById = new Map((currentTokens.tokens || []).map((x) => [String(x.token_id || "").trim(), x]));
assert(acceptedById.size === (acceptedTokens.tokens || []).length, "W4 accepted token fixture has duplicate/missing token_id");
assert(currentById.size === (currentTokens.tokens || []).length, "W4 successor token fixture has duplicate/missing token_id");
for (const [tokenId, before] of acceptedById) {
  const after = currentById.get(tokenId);
  assert(after, "W4 predecessor principal removed", tokenId);
  assert(JSON.stringify(after) === JSON.stringify(before), "W4 predecessor principal changed", tokenId);
}
const additive = (currentTokens.tokens || []).filter((x) => !acceptedById.has(String(x.token_id || "").trim()));
const w4ForbiddenScopes = new Set(["action.task.dispatch", "action.receipt.submit", "ao_act.receipt.write", "ao_act.task.write", "telemetry.write"]);
for (const principal of additive) {
  assert(String(principal.role || "").trim() !== "executor", "W4 successor added executor principal", principal.token_id);
  const scopes = Array.isArray(principal.scopes) ? principal.scopes : [];
  const leaked = scopes.filter((scope) => w4ForbiddenScopes.has(String(scope)));
  assert(leaked.length === 0, "W4 successor additive principal gained execution/device/receipt authority", { token_id: principal.token_id, leaked });
}

const w6b2ExactFiles = [W6B2_ARTIFACT, BOOTSTRAP, COMPOSE, ENV_EXAMPLE, W6B2_GATE];
const w6b2Drift = lines(sh(["diff", "--name-only", BLINE_ACCEPTED, head, "--", ...w6b2ExactFiles]));
assert(w6b2Drift.length === 0, "frozen W6-B2 semantic source/artifact drift", w6b2Drift);

const inv = JSON.parse(read(W6B2_ARTIFACT));
assert(inv.version === "GEOX-BLINE-W6B2-COMMERCIAL-PRINCIPAL-ISOLATION-V1", "W6-B2 artifact version drift");
assert(inv.database_principals?.telemetry_ingest === "geox_telemetry_ingest_v1", "telemetry DB principal isolation drift");
assert(inv.database_principals?.jobs === "geox_jobs_v1", "jobs DB principal isolation drift");
assert(inv.database_principals?.executor === "geox_executor_runtime_v1", "executor DB principal isolation drift");

const bootstrap = read(BOOTSTRAP);
for (const marker of [
  'BLINE_COMMERCIAL_TELEMETRY_ROLE_V1 = "geox_telemetry_ingest_v1"',
  'BLINE_COMMERCIAL_JOBS_ROLE_V1 = "geox_jobs_v1"',
  'BLINE_COMMERCIAL_EXECUTOR_ROLE_V1 = "geox_executor_runtime_v1"',
  "REVOKE ${MCFT_CAP07_RUNTIME_ROLE_V1} FROM ${BLINE_COMMERCIAL_TELEMETRY_ROLE_V1}",
  "REVOKE ${MCFT_CAP07_RUNTIME_ROLE_V1} FROM ${BLINE_COMMERCIAL_JOBS_ROLE_V1}",
  "REVOKE ${MCFT_CAP07_RUNTIME_ROLE_V1} FROM ${BLINE_COMMERCIAL_EXECUTOR_ROLE_V1}",
  "BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:ROLE_GRAPH"
]) assert(bootstrap.includes(marker), "W6-B2 principal bootstrap marker missing", marker);
assert(!bootstrap.includes("GRANT ${MCFT_CAP07_RUNTIME_ROLE_V1} TO"), "W6-B2 must not reuse MCFT runtime principal membership");
assert(!bootstrap.includes("ALTER ROLE ${MCFT_CAP07_RUNTIME_ROLE_V1}"), "W6-B2 must not mutate frozen MCFT runtime role");

const compose = read(COMPOSE);
const server = serviceBlock(compose, "server");
const telemetry = serviceBlock(compose, "telemetry-ingest");
const jobs = serviceBlock(compose, "jobs");
const executor = serviceBlock(compose, "executor");
const mqtt = serviceBlock(compose, "mqtt");

assert(telemetry.includes("postgres://geox_telemetry_ingest_v1:$$(cat /run/geox/telemetry/db_password)"), "telemetry DB principal not isolated");
assert(jobs.includes("postgres://geox_jobs_v1:$$(cat /run/geox/jobs/db_password)"), "jobs DB principal not isolated");
assert(executor.includes("postgres://geox_executor_runtime_v1:$$(cat /run/geox/executor/db_password)"), "executor DB principal not isolated");
assert(telemetry.includes("GEOX_MQTT_USERNAME: ${GEOX_TELEMETRY_MQTT_USERNAME:-geox_telemetry_ingest_v1}"), "telemetry MQTT identity drift");
assert(telemetry.includes('GEOX_MQTT_PASSWORD="$$(cat /run/geox/telemetry/mqtt_password)"'), "telemetry MQTT credential isolation drift");
assert(executor.includes("GEOX_MQTT_USERNAME: ${GEOX_EXECUTOR_MQTT_USERNAME:-geox_executor_v1}"), "executor MQTT identity drift");
assert(executor.includes('GEOX_MQTT_PASSWORD="$$(cat /run/geox/executor/mqtt_password)"'), "executor MQTT credential isolation drift");
assert(mqtt.includes("topic read telemetry/+/+"), "telemetry MQTT telemetry read ACL missing");
assert(mqtt.includes("topic read heartbeat/+/+"), "telemetry MQTT heartbeat read ACL missing");
assert(mqtt.includes("topic write #"), "executor MQTT publish-only ACL missing");
for (const [name, block] of [["server", server], ["jobs", jobs]]) {
  assert(!block.includes("GEOX_MQTT_USERNAME:"), `${name} received broker username`);
  assert(!block.includes("GEOX_MQTT_PASSWORD:"), `${name} received broker password`);
}
assert(!telemetry.includes("GEOX_AO_ACT_TOKEN:"), "telemetry-ingest received shared AO-ACT token");
assert(!jobs.includes("GEOX_AO_ACT_TOKEN:"), "jobs received shared AO-ACT token");
assert(executor.includes("GEOX_AO_ACT_TOKEN: ${GEOX_EXECUTOR_TOKEN:?GEOX_EXECUTOR_TOKEN is required}"), "executor dedicated AO-ACT principal drift");

const acceptedDist = show(BLINE_ACCEPTED, DIST);
const protectedMainDist = show(PROTECTED_MAIN, DIST);
const currentDist = read(DIST);
const blineDistEntry = extractBlineDistEntry(acceptedDist);
const closeMarker = "\n];";
assert(protectedMainDist.includes(closeMarker), "protected-main dist entries closing marker missing");
const expectedDist = protectedMainDist.replace(closeMarker, `\n${blineDistEntry}${closeMarker}`);
assert(currentDist === expectedDist, "shared dist packaging seam is not exact protected-main plus frozen B-Line bootstrap entry");
assert(currentDist.includes("bline_commercial_principal_bootstrap.js"), "compiled B-Line principal bootstrap entry missing");
assert(currentDist.includes("runBlineCommercialPrincipalBootstrapFromEnvironmentV1"), "compiled B-Line principal bootstrap runner missing");

const tmpW4 = fs.mkdtempSync(path.join(os.tmpdir(), "geox-w4-historical-"));
try {
  cp.execFileSync("git", ["worktree", "add", "--detach", tmpW4, W4_ACCEPTED], { stdio: "ignore" });
  cp.execFileSync(process.execPath, [W4_GATE], { cwd: tmpW4, stdio: "inherit" });
} finally {
  try { cp.execFileSync("git", ["worktree", "remove", "--force", tmpW4], { stdio: "ignore" }); } catch {}
  try { fs.rmSync(tmpW4, { recursive: true, force: true }); } catch {}
}

const tmpW6B2 = fs.mkdtempSync(path.join(os.tmpdir(), "geox-w6b2-frozen-"));
try {
  cp.execFileSync("git", ["worktree", "add", "--detach", tmpW6B2, BLINE_ACCEPTED], { stdio: "ignore" });
  cp.execFileSync(process.execPath, [W6B2_GATE], { cwd: tmpW6B2, stdio: "inherit" });
} finally {
  try { cp.execFileSync("git", ["worktree", "remove", "--force", tmpW6B2], { stdio: "ignore" }); } catch {}
  try { fs.rmSync(tmpW6B2, { recursive: true, force: true }); } catch {}
}

console.log(JSON.stringify({
  result: "PASS",
  workstream: "BLINE_W4_GOV_RECON_03_SUCCESSOR_PRESERVATION",
  historical_w4_accepted_head: W4_ACCEPTED,
  accepted_bline_semantic_reference: BLINE_ACCEPTED,
  protected_main_base: PROTECTED_MAIN,
  successor_head: head,
  W4_HISTORICAL_INVARIANTS_PRESERVED: true,
  W6B2_AUTHORIZED_SUCCESSOR_EVOLUTION_PRESERVED: true,
  UNADJUDICATED_W4_SUCCESSOR_DRIFT: [],
  w4_protected_file_count: protectedFiles.length,
  w4_protected_drift: w4Drift,
  predecessor_principals_preserved: acceptedById.size,
  additive_non_w4_principals: additive.map((x) => String(x.token_id || "").trim()),
  w6b2_exact_file_drift: w6b2Drift,
  shared_dist_packaging: "EXACT_PROTECTED_MAIN_PLUS_FROZEN_BLINE_BOOTSTRAP_ENTRY",
  mqtt_service_health_startup_ordering: "NOT_A_FROZEN_W6B2_REQUIREMENT",
  historical_w4_exact_head_gate_replayed: true,
  frozen_w6b2_exact_head_gate_replayed: true
}, null, 2));
