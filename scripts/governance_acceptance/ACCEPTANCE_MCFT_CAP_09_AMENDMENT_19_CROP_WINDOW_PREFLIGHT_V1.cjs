#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PREFLIGHT = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_V1.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-amendment19-persistent-24t-qualification.yml";
const OUTPUT = "acceptance-output/MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_PREFLIGHT_GOVERNANCE_V1.json";

function requireCondition(condition, code) {
  if (!condition) throw new Error(code);
}

function count(text, marker) {
  return text.split(marker).length - 1;
}

const preflight = fs.readFileSync(PREFLIGHT, "utf8");
const workflow = fs.readFileSync(WORKFLOW, "utf8");

for (const marker of [
  "2026-08-20T21:00:00.000Z",
  'failed04.failures[0]?.context_id === "O17"',
  'failed05.failures[0]?.context_id === "O16"',
  "backward_stability_hours: 6",
  "forward_transition_guard_hours: 30",
  "exact_fao_variant_count: 6",
  "planting_time_uncertainty_carried: true",
  "future_observations_used: false",
  "rehydration_started: false",
  "qualification_subject_sentinel_write_count: 0",
  "database_write_count: 0",
  "if (proof.status !== \"PASS\") process.exitCode = 3",
]) requireCondition(preflight.includes(marker), `AM19_CROP_PREFLIGHT_MARKER_REQUIRED:${marker}`);

for (const forbidden of [
  "child_process",
  "require(\"pg\")",
  "require('pg')",
  "fetch(",
  "http.request",
  "https.request",
  "process.env.DATABASE_URL",
  "INSERT INTO",
  "UPDATE facts",
  "DELETE FROM",
]) requireCondition(!preflight.includes(forbidden), `AM19_CROP_PREFLIGHT_SIDE_EFFECT_CAPABILITY_FORBIDDEN:${forbidden}`);

requireCondition(count(preflight, "fs.writeFileSync(") === 1, "AM19_CROP_PREFLIGHT_EXACT_ONE_METADATA_WRITE_REQUIRED");
requireCondition(count(preflight, "fs.appendFileSync(") === 0, "AM19_CROP_PREFLIGHT_APPEND_WRITE_FORBIDDEN");
requireCondition(preflight.includes("acceptance-output/MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_PREFLIGHT_V1.json"), "AM19_CROP_PREFLIGHT_OUTPUT_PATH_REQUIRED");

const live = "run: node scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_V1.cjs run";
const selftest = "node scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_V1.cjs selftest";
const install = "- name: Install exact repository and decoder dependencies";
const rehydration = "- name: Governed producer-bound R2 rehydration into isolated local DB";
const persistent = "- name: Execute production-graph persistent 24T qualification";
const upload = "acceptance-output/MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_PREFLIGHT_V1.json";
requireCondition(count(workflow, live) === 1, "AM19_CROP_PREFLIGHT_EXACT_ONE_LIVE_INVOCATION_REQUIRED");
requireCondition(count(workflow, selftest) === 1, "AM19_CROP_PREFLIGHT_EXACT_ONE_SELFTEST_INVOCATION_REQUIRED");
requireCondition(count(workflow, upload) === 1, "AM19_CROP_PREFLIGHT_EXACT_ONE_ARTIFACT_PATH_REQUIRED");
const liveIndex = workflow.indexOf(live);
requireCondition(liveIndex > workflow.indexOf("- name: Require exactly one candidate file from triggering run"), "AM19_CROP_PREFLIGHT_MUST_FOLLOW_EXACT_CANDIDATE_BINDING");
requireCondition(liveIndex < workflow.lastIndexOf(install), "AM19_CROP_PREFLIGHT_MUST_PRECEDE_DECODER_INSTALL");
requireCondition(liveIndex < workflow.indexOf(rehydration), "AM19_CROP_PREFLIGHT_MUST_PRECEDE_REHYDRATION");
requireCondition(liveIndex < workflow.indexOf(persistent), "AM19_CROP_PREFLIGHT_MUST_PRECEDE_PERSISTENT_24T");
requireCondition(!workflow.slice(liveIndex - 300, liveIndex + live.length + 300).includes("continue-on-error"), "AM19_CROP_PREFLIGHT_CONTINUE_ON_ERROR_FORBIDDEN");
requireCondition(workflow.includes("- name: Upload safe qualification proof\n        if: always()"), "AM19_CROP_PREFLIGHT_ALWAYS_UPLOAD_REQUIRED");

const result = {
  schema_version: "geox_mcft_cap09_amendment19_crop_window_preflight_governance_v1",
  status: "PASS",
  exact_candidate_binding_precedes_preflight: true,
  preflight_precedes_dependency_install: true,
  preflight_precedes_rehydration: true,
  preflight_precedes_persistent_24t: true,
  fail_closed_exit_required: true,
  metadata_artifact_always_uploaded: true,
  provider_request_count: 0,
  database_read_count: 0,
  database_write_count: 0,
  authority_effect: false,
};
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
