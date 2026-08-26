#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const PHASE1_BASE = "8943c752a354cb916cc7f144681203aa9a19f70b";
const HISTORICAL_GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_LIVE_KBS_SOIL_INGRESS_EXECUTOR.cjs";
const HISTORICAL_AUTHORITY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2B1-LIVE-KBS-SOIL-INGRESS-EXECUTOR-V1.json";
const HISTORICAL_ACCEPTANCE = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_LIVE_KBS_SOIL_INGRESS.ts";
const WORKFLOW = ".github/workflows/mcft-cap-09-ea5c2b1-live-kbs-soil-ingress-executor.yml";
const EXECUTOR = "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts";
const TRANSPORT = "apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.ts";
const PROVIDER = "apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts";
const THIS = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1.cjs";
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1_RESULT.json");

const FROZEN_DEPENDENCIES = [
  HISTORICAL_GATE,
  HISTORICAL_AUTHORITY,
  HISTORICAL_ACCEPTANCE,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA2A-KBS-SOIL-CONTINUITY-USE-POLICY-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C1-DURABLE-RAW-RESTRICTED-INGRESS-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2A-FORMAL-RAW-STORE-BINDING-CONTRACT-V1.json",
  "apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts",
  "apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts",
  "apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts",
  "apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts",
];

const ALLOWED_SENSITIVE_DELTA = new Set([EXECUTOR, TRANSPORT, PROVIDER, WORKFLOW, THIS]);

function git(...args) {
  return cp.execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}
function exactCommit(value, code) {
  const text = String(value || "").trim();
  assert.match(text, /^[0-9a-f]{40}$/, code);
  return git("rev-parse", `${text}^{commit}`);
}
function isSensitive(file) {
  return file === EXECUTOR ||
    file === WORKFLOW ||
    file === THIS ||
    file.startsWith("apps/server/src/external_evidence/provider/") ||
    file === HISTORICAL_GATE ||
    file === HISTORICAL_AUTHORITY ||
    file === HISTORICAL_ACCEPTANCE;
}
function requireMarkers(file, markers, code) {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  for (const marker of markers) assert.ok(text.includes(marker), `${code}:${marker}`);
  return text;
}

try {
  const base = exactCommit(process.env.MCFT_BASE_SHA, "EA5C2B1_PHASE2_BASE_SHA_INVALID");
  assert.equal(base, PHASE1_BASE, "EA5C2B1_PHASE2_EXACT_PHASE1_BASE_REQUIRED");
  assert.equal(git("merge-base", base, "HEAD"), base, "EA5C2B1_PHASE2_BASE_NOT_ANCESTOR");

  for (const file of FROZEN_DEPENDENCIES) {
    assert.equal(
      git("rev-parse", `HEAD:${file}`),
      git("rev-parse", `${base}:${file}`),
      `EA5C2B1_PHASE2_FROZEN_AUTHORITY_DRIFT:${file}`,
    );
  }

  const rawChanged = git("diff", "--name-only", `${base}...HEAD`);
  const changed = rawChanged ? rawChanged.split(/\r?\n/).filter(Boolean).sort() : [];
  const sensitive = changed.filter(isSensitive);
  const forbiddenSensitive = sensitive.filter((file) => !ALLOWED_SENSITIVE_DELTA.has(file));
  assert.deepEqual(forbiddenSensitive, [], "EA5C2B1_PHASE2_UNDECLARED_SENSITIVE_PATH");
  for (const required of [EXECUTOR, TRANSPORT, PROVIDER, WORKFLOW, THIS]) {
    assert.equal(sensitive.includes(required), true, `EA5C2B1_PHASE2_REQUIRED_DELTA_MISSING:${required}`);
  }

  const diffCheck = cp.spawnSync("git", ["diff", "--check", `${base}...HEAD`, "--", ...sensitive], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(diffCheck.status, 0, `EA5C2B1_PHASE2_DIFF_CHECK_FAILED:${String(diffCheck.stdout || "")}${String(diffCheck.stderr || "")}`);

  const executor = requireMarkers(EXECUTOR, [
    "KbsVariate25SoilEvidenceDecoderV1",
    "fetchKbsVariate25SoilRawV1",
    "collectRetainDecodeCanonicalizeExternalEvidenceV1",
    "PostgresExternalFormalEvidenceIngressV1",
    "runtime_public_provider_fetch_count: 0",
  ], "EA5C2B1_PHASE2_EXECUTOR_MARKER_MISSING");
  assert.equal(/\bINSERT\s+INTO\b/i.test(executor), false, "EA5C2B1_PHASE2_DIRECT_SQL_WRITE_FORBIDDEN");

  const transport = requireMarkers(TRANSPORT, [
    "class HttpsExternalEvidenceTransportV1",
    "request.allowed_final_hosts",
    "parsed.protocol === \"https:\"",
    "method: \"GET\"",
    "FINAL_HOST_NOT_ALLOWED",
    "FINAL_IDENTITY_DRIFT",
  ], "EA5C2B1_PHASE2_TRANSPORT_MARKER_MISSING");
  assert.equal(/\bINSERT\s+INTO\b/i.test(transport), false, "EA5C2B1_PHASE2_TRANSPORT_DB_WRITE_FORBIDDEN");

  const provider = requireMarkers(PROVIDER, [
    "https://lter.kbs.msu.edu/weather/variates/25",
    "KBS_LTER_CURRENT_WEATHER_VARIATE_25_VWC_DECODER_V1",
    "measurement_depth_mm: 100",
    "direct_field_equivalence: false",
    "direct_root_zone_equivalence: false",
    "root_zone_representativeness: \"PARTIAL\"",
    "raw_values_embedded: false",
    "NO_PUBLIC_RAW_VALUE_EMISSION",
    "HttpsExternalEvidenceTransportV1",
  ], "EA5C2B1_PHASE2_PROVIDER_MARKER_MISSING");
  assert.equal(/\bINSERT\s+INTO\b/i.test(provider), false, "EA5C2B1_PHASE2_PROVIDER_DB_WRITE_FORBIDDEN");

  const workflow = requireMarkers(WORKFLOW, [
    "ACCEPTANCE_MCFT_CAP_09_EA5C2B1_LIVE_KBS_SOIL_INGRESS_EXECUTOR.cjs",
    "ACCEPTANCE_MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1.cjs",
    PHASE1_BASE,
    "Execute live KBS source through frozen EA3 and EA5C1 pipeline against CI-only stores",
  ], "EA5C2B1_PHASE2_WORKFLOW_MARKER_MISSING");
  for (const forbidden of [
    "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY:",
    "GEOX_MCFT_CAP09_S6_DATABASE_URL:",
  ]) assert.equal(workflow.includes(forbidden), false, `EA5C2B1_PHASE2_FORMAL_SECRET_BINDING_FORBIDDEN:${forbidden}`);

  const result = {
    schema_version: "geox_mcft_cap09_ea5c2b1_phase2_successor_requalification_v1",
    status: "PASS",
    classification: "PHASE2_EVIDENCE_PROVIDER_EXTRACTION_SUCCESSOR_REQUALIFICATION",
    governed_base_sha: base,
    candidate_sha: git("rev-parse", "HEAD"),
    historical_ea5c2b1_gate_unchanged: true,
    historical_ea5c2b1_authority_unchanged: true,
    historical_ea5c2b1_runtime_acceptance_unchanged: true,
    sensitive_changed_files: sensitive,
    provider_semantics_promoted_without_runtime_fallback: true,
    retention_before_decode_boundary_preserved: true,
    governed_postgres_ingress_boundary_preserved: true,
    production_evidence_runtime_activated: false,
    production_twin_runtime_activated: false,
    provider_production_cadence_owner_activated: false,
    runtime_provider_fallback: false,
    formal_database_mutation: false,
    formal_v5_armed: false,
    graduation_effect: false,
    mcft_cap09_completed: false,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  const result = {
    schema_version: "geox_mcft_cap09_ea5c2b1_phase2_successor_requalification_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
  };
  write(result);
  console.error(error);
  process.exitCode = 1;
}
