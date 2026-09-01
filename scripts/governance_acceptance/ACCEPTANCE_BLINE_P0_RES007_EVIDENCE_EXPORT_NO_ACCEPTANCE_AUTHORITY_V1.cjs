const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const legacyPath = path.join(ROOT, "apps/server/src/routes/delivery_evidence_export_v1.ts");
const stablePath = path.join(ROOT, "apps/server/src/routes/evidence_export_jobs_v1.ts");
const executorPath = path.join(ROOT, "apps/executor/src/run_once.ts");

function fail(message) {
  console.error("ACCEPTANCE_BLINE_P0_RES007_FAIL " + message);
  process.exit(1);
}

const legacy = fs.readFileSync(legacyPath, "utf8");
const stable = fs.readFileSync(stablePath, "utf8");
const executor = fs.readFileSync(executorPath, "utf8");

if (/\bINSERT\s+INTO\s+facts\b/i.test(legacy)) {
  fail("legacy evidence export must not append to the facts ledger");
}
if (/AcceptanceResultV1PayloadSchema|type:\s*["']acceptance_result_v1["']|acceptance:written/.test(legacy)) {
  fail("legacy evidence export still contains Acceptance-minting semantics");
}
if (!legacy.includes('acceptance:not-written legacy-export-is-non-authoritative')) {
  fail("legacy evidence export must declare its non-authoritative Acceptance boundary");
}
if (!/acceptance_fact_id:\s*null/.test(legacy) || !/acceptance_result:\s*null/.test(legacy)) {
  fail("deprecated status compatibility fields must initialize to null");
}
if (!legacy.includes('app.post("/api/delivery/evidence_export/v1/jobs"') ||
    !legacy.includes('app.get("/api/delivery/evidence_export/v1/jobs/:job_id"') ||
    !legacy.includes('app.get("/api/delivery/evidence_export/v1/jobs/:job_id/download"')) {
  fail("deprecated create/status/download compatibility surface changed unexpectedly");
}
if (!legacy.includes('requireAoActScopeV0(req, reply, "ao_act.index.read")')) {
  fail("legacy export must remain read-authorized packaging only");
}
if (!stable.includes("(record_json::jsonb->>'type')='acceptance_result_v1'")) {
  fail("stable evidence export must continue to consume existing canonical Acceptance");
}
if (/job\.acceptance_fact_id|job\.acceptance_result/.test(executor)) {
  fail("executor must not treat deprecated evidence export status as an Acceptance source");
}

console.log("ACCEPTANCE_BLINE_P0_RES007_PASS");
console.log(JSON.stringify({
  legacy_fact_writer: false,
  legacy_acceptance_minter: false,
  compatibility_fields: "NULL_ONLY",
  stable_export_acceptance_semantics: "READ_EXISTING_ONLY"
}));
