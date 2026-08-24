#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const WORKFLOW = ".github/workflows/mcft-cap-09-amendment19-formal-graduation-wiring.yml";
const CLASSIFIER = "scripts/governance_acceptance/CLASSIFY_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_GRADUATION_TRIGGER_V2.cjs";
const ARM = ".github/workflows/mcft-cap-09-amendment19-formal-arm.yml";
const STORE_AUTHORITY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V2.json";
const V12 = "geox_mcft_cap09_s6_accel24t_am19_v12";
const BLOCKED_V12 = "geox_mcft_cap09_s6_accel24t_am19_blocked_v12";
const V11 = "geox_mcft_cap09_s6_accel24t_am19_v11";

function fail(code) { throw new Error(code); }
function need(value, code) { if (!value) fail(code); }
function text(file) { need(fs.existsSync(file), `MCFT_CAP09_V12_GRAD_PATH_REQUIRED:${file}`); return fs.readFileSync(file, "utf8"); }

function main() {
  const workflow = text(WORKFLOW);
  const classifier = text(CLASSIFIER);
  const arm = text(ARM);
  const authority = JSON.parse(text(STORE_AUTHORITY));

  need(authority?.qualification_generation?.qualification_database === V12, "MCFT_CAP09_V12_GRAD_AUTHORITY_V12_REQUIRED");
  need(authority?.qualification_generation?.blocked_database === BLOCKED_V12, "MCFT_CAP09_V12_GRAD_AUTHORITY_BLOCKED_V12_REQUIRED");
  need(authority?.qualification_generation?.previous_qualification_database === V11, "MCFT_CAP09_V12_GRAD_AUTHORITY_V11_PREDECESSOR_REQUIRED");
  need(authority?.qualification_generation?.fresh_qualification_required === true, "MCFT_CAP09_V12_GRAD_FRESH_QUALIFICATION_REQUIRED");
  need(authority?.qualification_generation?.previous_generation_reuse_forbidden === true, "MCFT_CAP09_V12_GRAD_PREVIOUS_REUSE_FORBIDDEN");

  need(classifier.includes(V12), "MCFT_CAP09_V12_GRAD_CLASSIFIER_V12_REQUIRED");
  need(classifier.includes(BLOCKED_V12), "MCFT_CAP09_V12_GRAD_CLASSIFIER_BLOCKED_V12_REQUIRED");
  need(classifier.includes("FRESH_V12_QUALIFICATION_ONLY"), "MCFT_CAP09_V12_GRAD_FRESH_ONLY_CLASSIFIER_REQUIRED");
  need(classifier.includes("ALREADY_QUALIFIED_READ_ONLY"), "MCFT_CAP09_V12_GRAD_READ_ONLY_NEGATIVE_REQUIRED");

  need(workflow.includes("workflows: ['mcft-cap-09-t4r1-amendment19-persistent-24t-qualification']"), "MCFT_CAP09_V12_GRAD_WORKFLOW_RUN_SOURCE_REQUIRED");
  need(workflow.includes("CLASSIFY_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_GRADUATION_TRIGGER_V2.cjs"), "MCFT_CAP09_V12_GRAD_WORKFLOW_V2_CLASSIFIER_REQUIRED");
  need(workflow.includes("mcft-cap09-t4r1-am19-persistent24-${process.env.SUBJECT_SHA}-"), "MCFT_CAP09_V12_GRAD_EXACT_SUBJECT_ARTIFACT_REQUIRED");
  need(workflow.includes("AM19_GRADUATION_WIRING_PROTECTED_MAIN_DRIFT"), "MCFT_CAP09_V12_GRAD_EXACT_MAIN_REQUIRED");
  need(workflow.includes("mcft-cap09-am19-formal-graduation-${{ env.SUBJECT_SHA }}-${{ github.run_id }}"), "MCFT_CAP09_V12_GRAD_ARTIFACT_PREFIX_REQUIRED");
  need(!/^\s*workflow_dispatch\s*:/m.test(workflow), "MCFT_CAP09_V12_GRAD_V11_MANUAL_REPLAY_FORBIDDEN");
  need(!workflow.includes("CLOSURE_PERSISTENT_RUN_ID"), "MCFT_CAP09_V12_GRAD_FROZEN_V11_RUN_REUSE_FORBIDDEN");
  need(!workflow.includes("CLOSURE_PERSISTENT_ARTIFACT_ID"), "MCFT_CAP09_V12_GRAD_FROZEN_V11_ARTIFACT_REUSE_FORBIDDEN");

  need(arm.includes("workflow_id: '.github/workflows/mcft-cap-09-amendment19-formal-graduation-wiring.yml'"), "MCFT_CAP09_V12_GRAD_ARM_CONSUMER_WORKFLOW_REQUIRED");
  need(arm.includes("mcft-cap09-am19-formal-graduation-${subject}-"), "MCFT_CAP09_V12_GRAD_ARM_ARTIFACT_PREFIX_REQUIRED");
  need(arm.includes("geox_mcft_cap09_s6_formal_t4r1_24h_v4"), "MCFT_CAP09_V12_GRAD_ARM_V4_REQUIRED");

  console.log(JSON.stringify({
    schema_version: "geox_mcft_cap09_v12_graduation_gate_v2_acceptance",
    status: "PASS",
    qualification_generation: "v12",
    previous_generation_reuse_forbidden: true,
    live_graduation_source: "FRESH_EXACT_SUBJECT_V12_ONLY",
    v11_compatible_replay_active: false,
    arm_consumer_contract_preserved: true,
    formal_effect: false,
  }));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
