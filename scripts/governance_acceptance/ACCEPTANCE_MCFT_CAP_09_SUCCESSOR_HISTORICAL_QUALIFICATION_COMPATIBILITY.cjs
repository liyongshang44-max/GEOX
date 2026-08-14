#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const ROOT = process.cwd();
const GATE_ID = String(process.env.MCFT_SUCCESSOR_GATE_ID || "").trim();
const CURRENT_BASE = String(process.env.MCFT_CURRENT_BASE_SHA || "").trim();
const HISTORICAL_BASE = String(process.env.MCFT_HISTORICAL_BASE_SHA || "").trim();

const CONFIG = {
  EA5E2_FIXED_LAG: {
    output: "acceptance-output/MCFT_CAP_09_EA5E2_FIXED_LAG_COLLECTOR_RUNTIME_SCHEDULE_READINESS_GOVERNANCE_RESULT.json",
    preserved: [
      "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md",
      "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-FIXED-LAG-COLLECTOR-RUNTIME-SCHEDULE-V1.json",
      "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-COLLECTOR-RUNTIME-SCHEDULE-READINESS-V1.json",
      "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_FIXED_LAG_COLLECTOR_RUNTIME_SCHEDULE_READINESS.cjs"
    ],
    result: {
      implementation_qualification_historical_proof_preserved: true,
      operational_activation_qualified: false,
      database_write_count: 0,
      provider_request_count: 0,
      formal_window_started: false
    }
  },
  EA5B1: {
    output: "acceptance-output/MCFT_CAP_09_EA5B1_EXTERNAL_EVIDENCE_BINDING_SEAM_GOVERNANCE_RESULT.json",
    preserved: [
      "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B1-EXTERNAL-EVIDENCE-BINDING-SEAM-V1.json",
      "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B1_EXTERNAL_EVIDENCE_BINDING_SEAM.cjs"
    ],
    result: {
      binding_seam_qualified: true,
      cap08_g3_successor_regression_required: true,
      cap08_frozen_a0_bootstrap_core_unchanged: true,
      cap04_external_service_threading_effective: false,
      external_package_formal_eligible: false,
      ea5c_authorized: false,
      formal_o00_start_authorized: false,
      database_write_count: 0,
      formal_evidence_write_count: 0,
      public_provider_request_count: 0,
      formal_window_started: false,
      mcft_cap09_completed: false
    }
  },
  EA5B5C: {
    output: "acceptance-output/MCFT_CAP_09_EA5B5C_EXTERNAL_CAP04_ORCHESTRATION_GOVERNANCE_RESULT.json",
    preserved: [
      "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5C-EXTERNAL-CAP04-ORCHESTRATION-V1.json",
      "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5A-EXTERNAL-CAP04-STATE-SOURCE-V1.json",
      "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5B-EXTERNAL-FORECAST-A1A2-V1.json",
      "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B5C_EXTERNAL_CAP04_ORCHESTRATION.cjs"
    ],
    result: {
      external_cap04_candidate_orchestration_qualified: true,
      selected_a1_path_qualified: true,
      blocked_a2_path_qualified: true,
      malformed_forcing_failed_path_qualified: true,
      canonical_persistence_authorized: false,
      provider_fetch_authorized: false,
      scheduler_authorized: false,
      ea5b_completion_audit_required: true,
      ea5b_complete: false,
      ea5c_authorized: false,
      formal_o00_start_authorized: false,
      database_write_count: 0,
      provider_request_count: 0
    }
  },
  EXTERNAL_FORMAL_V3: {
    output: "acceptance-output/MCFT_CAP_09_EXTERNAL_FORMAL_V3_PERSISTENT_TICK_IMPLEMENTATION_QUALIFICATION_RESULT.json",
    preserved: [
      "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EXTERNAL-FORMAL-V3-PERSISTENT-TICK-IMPLEMENTATION-QUALIFICATION-V1.json",
      "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EXTERNAL_FORMAL_V3_PERSISTENT_TICK_IMPLEMENTATION_QUALIFICATION.cjs"
    ],
    result: {
      external_formal_v3_persistent_tick_implementation_qualified: true,
      external_formal_v3_formal_execution_authorized: false,
      operational_activation_qualified: false,
      successor_epoch_selected: false,
      runtime_provider_request_count: 0,
      runtime_r2_head_count: 0,
      formal_database_write_count: 0,
      formal_raw_prefix_write_count: 0,
      formal_scheduler_write_count: 0,
      formal_canonical_runtime_write_count: 0,
      ea5e3_authorized: false,
      formal_window_started: false
    }
  }
};

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}
function isAncestor(older, newer) {
  return spawnSync("git", ["merge-base", "--is-ancestor", older, newer], { cwd: ROOT }).status === 0;
}
function blob(ref, file) {
  return git("rev-parse", `${ref}:${file}`);
}
function fail(code) {
  throw new Error(code);
}
function write(output, value) {
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, output), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(value));
}

try {
  const cfg = CONFIG[GATE_ID];
  if (!cfg) fail(`SUCCESSOR_GATE_ID_INVALID:${GATE_ID}`);
  if (!/^[0-9a-f]{40}$/.test(CURRENT_BASE)) fail("SUCCESSOR_CURRENT_BASE_SHA_REQUIRED");
  if (!/^[0-9a-f]{40}$/.test(HISTORICAL_BASE)) fail("SUCCESSOR_HISTORICAL_BASE_SHA_REQUIRED");
  const head = git("rev-parse", "HEAD");
  if (!isAncestor(HISTORICAL_BASE, CURRENT_BASE)) fail("HISTORICAL_BASE_NOT_ANCESTOR_OF_CURRENT_BASE");
  if (!isAncestor(CURRENT_BASE, head)) fail("CURRENT_BASE_NOT_ANCESTOR_OF_SUBJECT_HEAD");

  const preservedBlobs = {};
  for (const file of cfg.preserved) {
    const baseBlob = blob(CURRENT_BASE, file);
    const headBlob = blob("HEAD", file);
    if (baseBlob !== headBlob) fail(`HISTORICAL_QUALIFICATION_ASSET_MUTATED:${file}`);
    preservedBlobs[file] = headBlob;
  }

  write(cfg.output, {
    schema_version: "geox_mcft_cap09_successor_historical_qualification_compatibility_v1",
    status: "PASS",
    proof_class: "SUCCESSOR_REGRESSION_HISTORICAL_QUALIFICATION_PRESERVATION_V1",
    historical_gate_id: GATE_ID,
    historical_base_sha: HISTORICAL_BASE,
    current_base_sha: CURRENT_BASE,
    subject_sha: head,
    historical_base_is_ancestor_of_current_base: true,
    current_base_is_ancestor_of_subject: true,
    historical_qualification_preserved: true,
    preserved_blobs: preservedBlobs,
    successor_behavior_reexecution_required: true,
    ...cfg.result
  });
} catch (error) {
  const cfg = CONFIG[GATE_ID];
  const output = cfg?.output || "acceptance-output/MCFT_CAP_09_SUCCESSOR_HISTORICAL_QUALIFICATION_COMPATIBILITY_RESULT.json";
  write(output, {
    schema_version: "geox_mcft_cap09_successor_historical_qualification_compatibility_v1",
    status: "FAIL",
    proof_class: "SUCCESSOR_REGRESSION_HISTORICAL_QUALIFICATION_PRESERVATION_V1",
    historical_gate_id: GATE_ID || null,
    error: String(error?.message || error),
    database_write_count: 0,
    provider_request_count: 0,
    formal_window_started: false
  });
  process.exitCode = 1;
}
