// scripts/commercial_evidence/PREPARE_COMMERCIAL_EVIDENCE_TRACE_V1.cjs
// Purpose: execute the existing persisted TK10 runtime chain against a prepared controlled GEOX environment and emit the exact Commercial Evidence Demo URL for its decision trace.
// Boundary: this is a controlled demo preparation script. It must not target production databases or be represented as MCFT-CAP-09 Formal evidence.

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const GEOX_BASE_URL = String(process.env.GEOX_BASE_URL ?? process.env.TWIN_KERNEL_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const GEOX_OPERATOR_BASE_URL = String(process.env.GEOX_OPERATOR_BASE_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
const COMMERCIAL_EVIDENCE_DEMO_URL = String(process.env.COMMERCIAL_EVIDENCE_DEMO_URL ?? "http://127.0.0.1:4177").replace(/\/$/, "");

if (process.env.NODE_ENV === "production" && process.env.COMMERCIAL_EVIDENCE_ALLOW_PRODUCTION !== "true") {
  throw new Error("COMMERCIAL_EVIDENCE_DEMO_PRODUCTION_ENV_FORBIDDEN");
}

const run = spawnSync(process.execPath, ["scripts/governance_acceptance/TK10_PERSISTED_TWIN_TRACE_RUNTIME_ACCEPTANCE_V1.cjs"], {
  cwd: ROOT,
  encoding: "utf8",
  env: {
    ...process.env,
    TWIN_KERNEL_BASE_URL: GEOX_BASE_URL,
  },
});

if (run.status !== 0) {
  process.stderr.write(run.stdout || "");
  process.stderr.write(run.stderr || "");
  throw new Error(`COMMERCIAL_EVIDENCE_TK10_PREPARATION_FAILED:${run.status}`);
}

let result;
try {
  result = JSON.parse(run.stdout.trim());
} catch {
  throw new Error("COMMERCIAL_EVIDENCE_TK10_NON_JSON_OUTPUT");
}

const decisionCycleId = String(result?.persisted_chain?.decision_cycle_id ?? "").trim();
if (!decisionCycleId) throw new Error("COMMERCIAL_EVIDENCE_DECISION_CYCLE_ID_MISSING");
if (result?.trace?.read_only !== true || result?.trace?.forbidden_auto_writes_absent !== true) {
  throw new Error("COMMERCIAL_EVIDENCE_TRACE_BOUNDARY_NOT_PROVED");
}

const demoUrl = `${COMMERCIAL_EVIDENCE_DEMO_URL}/?decision_cycle_id=${encodeURIComponent(decisionCycleId)}`;
const operatorTraceUrl = `${GEOX_OPERATOR_BASE_URL}/operator/twin/traces/${encodeURIComponent(decisionCycleId)}`;

console.log(JSON.stringify({
  ok: true,
  preparation: "PREPARE_COMMERCIAL_EVIDENCE_TRACE_V1",
  geox_base_url: GEOX_BASE_URL,
  decision_cycle_id: decisionCycleId,
  persisted_chain: result.persisted_chain,
  trace: result.trace,
  commercial_evidence_demo_url: demoUrl,
  operator_trace_url: operatorTraceUrl,
  hard_nonclaims: [
    "CONTROLLED_DEMO_RUNTIME_ONLY",
    "NOT_PRODUCTION_AUTHORITY",
    "NOT_MCFT_CAP09_FORMAL_EVIDENCE",
    "NO_FORMAL_O00_O23_CLAIM"
  ]
}, null, 2));
