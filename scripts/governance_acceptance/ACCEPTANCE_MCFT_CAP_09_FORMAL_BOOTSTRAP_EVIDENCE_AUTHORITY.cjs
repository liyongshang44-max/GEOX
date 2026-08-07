#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const cp = require("node:child_process");

const boundaryPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-BOOTSTRAP-EVIDENCE-AUTHORITY-BOUNDARY-V1.json";
const candidatePath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-BOOTSTRAP-EVIDENCE-AUTHORITY-V1.json";
const boundary = JSON.parse(fs.readFileSync(boundaryPath, "utf8"));
const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
const base = process.env.MCFT_BASE_SHA || boundary.base_main_sha;
const committedOrTracked = cp.execFileSync("git", ["diff", "--name-only", base], { encoding: "utf8" })
  .trim().split(/\r?\n/).filter(Boolean);
const untracked = cp.execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" })
  .trim().split(/\r?\n/).filter((file) => file && !file.startsWith("acceptance-output/"));
const changed = [...new Set([...committedOrTracked, ...untracked])].sort();
assert.deepEqual(changed, [...boundary.changed_files].sort(), "exact nine-file repair boundary required");
assert.equal(boundary.changed_file_count, 9);
assert.equal(boundary.runtime_source_file_count, 0);
assert.equal(boundary.database_migration_file_count, 0);
assert.equal(boundary.old_s6_candidate_object_set_modified, false);
assert.equal(candidate.formal_window_started, false);
assert.equal(candidate.externally_effective, false);

const read = (file) => fs.readFileSync(file, "utf8");
const authority = read("scripts/runtime_acceptance/mcft_cap09_s6_formal_authority_v1.ts");
const ingress = read("scripts/runtime_acceptance/INGEST_MCFT_CAP_09_S6_FORMAL_EVIDENCE.ts");
const bootstrap = read("scripts/runtime_acceptance/BOOTSTRAP_MCFT_CAP_09_S6_FORMAL_AUTHORITY.ts");
const preflight = read("scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_S6_FORMAL_WINDOW.ts");
const runner = read("scripts/runtime_acceptance/RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW_V2.ts");
const workflow = read(".github/workflows/mcft-cap-09-formal-bootstrap-evidence-authority.yml");

for (const marker of [
  "67bd71560268046a7fa9a9433ee074ad3999cb71",
  "compileRuntimeConfigFromAuthorityArtifactsV1",
  "compileCap04RuntimeConfigChainV1",
  "CAP04_STANDARD_CONFIG_CHAIN_LENGTH_V1",
  "FORMAL_GOVERNED_NON_SYNTHETIC_CROP_STAGE_CONTEXT_REQUIRED",
]) assert(authority.includes(marker), `authority marker missing: ${marker}`);
for (const type of candidate.repair.required_evidence_types) {
  assert(authority.includes(type), `formal Evidence type missing: ${type}`);
}
for (const marker of [
  "FORMAL_EVIDENCE_SYNTHETIC_OR_REPLAY_MARKER_FORBIDDEN",
  "FORMAL_EVIDENCE_FUTURE_DATED_AT_INGRESS",
  "FORMAL_EVIDENCE_INGRESS_TIME_NOT_CONTEMPORANEOUS",
  "FORMAL_EVIDENCE_WRITER_RUNTIME_AUTHORITY_FORBIDDEN",
  "ON CONFLICT (fact_id) DO NOTHING",
  "mcft_cap09_formal_external_evidence_v1",
]) assert(ingress.includes(marker), `ingress marker missing: ${marker}`);
for (const marker of [
  "BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE",
  "pg_advisory_xact_lock",
  "transactionBoundPoolV1",
  "commitRealityBindingSnapshot",
  "A0BootstrapRuntimeServiceV1",
  "runtime_configs",
]) assert(bootstrap.includes(marker), `bootstrap marker missing: ${marker}`);
for (const marker of [
  "FORMAL_PREFLIGHT_EXACT_24_RUNTIME_CONFIGS_REQUIRED",
  "FORMAL_PREFLIGHT_EVIDENCE_TYPE_MISSING",
  "FORMAL_PREFLIGHT_SCHEDULER_ALREADY_STARTED",
  "formal_window_ready: true",
]) assert(preflight.includes(marker), `preflight marker missing: ${marker}`);
for (const marker of [
  "buildFormalAuthorityBundleV1",
  "FORMAL_V2_EXACT_RUNTIME_CONFIG_HASH_MISMATCH",
  "process.env.MCFT_CAP09_S6_CANONICAL_INPUT_JSON",
]) assert(runner.includes(marker), `runner marker missing: ${marker}`);
for (const marker of [
  "GEOX_MCFT_CAP09_S6_FORMAL_WINDOW_V2_ENABLED",
  "BOOTSTRAP_MCFT_CAP_09_S6_FORMAL_AUTHORITY.ts",
  "PREFLIGHT_MCFT_CAP_09_S6_FORMAL_WINDOW.ts",
  "RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW_V2.ts",
]) assert(workflow.includes(marker), `workflow marker missing: ${marker}`);

for (const text of [ingress, bootstrap, preflight, runner]) {
  assert(!text.includes("fixtures/mcft"), "formal repair must not consume MCFT fixture Evidence");
  assert(!text.includes("scripts/dev_seed"), "formal repair must not consume dev seed data");
}

fs.mkdirSync("acceptance-output", { recursive: true });
const result = {
  schema_version: "geox_mcft_cap09_formal_bootstrap_evidence_authority_acceptance_v1",
  status: "PASS",
  base_sha: base,
  changed_files: changed,
  exact_file_count: changed.length,
  database_write_performed: false,
  workflow_dispatch_performed: false,
  formal_window_started: false,
  formal_effectiveness: false,
};
fs.writeFileSync("acceptance-output/MCFT_CAP_09_FORMAL_BOOTSTRAP_EVIDENCE_AUTHORITY_RESULT.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
