#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const BASE = process.env.MCFT_BASE_SHA || "";
const SUBJECT = process.env.MCFT_SUBJECT_SHA || "";
const CREATION_BASE = "08310e5f50bf5df7580b27fd35285f560320b9df";
const HISTORICAL_WORKFLOW_COMMIT = "2af9095c560edf70b6e8809c1b80b96120f1b87f";
const FILES = {
  authority: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-LIVE-SOURCE-EXACT-HEAD-QUALIFICATION-V1.json",
  probe: "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py",
  historicalGate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.cjs",
  workflow: ".github/workflows/mcft-cap-09-ea4-live-source-exact-head-qualification.yml",
  successorGate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA4_HISTORICAL_REJECTION_PRESERVATION.cjs",
  ea5e2Provider: "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py",
  ea5e2Qualification: ".github/workflows/mcft-cap-09-ea5e2-successor-runner-qualification.yml",
};
const PINS = {
  authority: "791e3d24bdc862641c77ddd26778495cb8e6a7dd",
  probe: "ff2ad210387402a74731968e14746210fd2440dd",
  historicalGate: "48fce99790dcc4e3ca76f99112da8b6517507c22",
  historicalWorkflow: "35812eb480e198b70defdecfe6279cdb359575bf",
};
const OUT = "acceptance-output/MCFT_CAP_09_EA4_HISTORICAL_REJECTION_PRESERVATION.json";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, file) => git("rev-parse", `${ref}:${file}`);
const read = (file) => fs.readFileSync(file, "utf8");

function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value));
}

try {
  const head = git("rev-parse", "HEAD");
  assert(BASE && BASE !== CREATION_BASE, `EA4_SUCCESSOR_BASE_REQUIRED:${BASE}`);
  assert.equal(SUBJECT, head, "EA4_SUCCESSOR_EXACT_HEAD_REQUIRED");
  assert.equal(blob("HEAD", FILES.authority), PINS.authority, "EA4_HISTORICAL_AUTHORITY_MUTATED");
  assert.equal(blob("HEAD", FILES.probe), PINS.probe, "EA4_HISTORICAL_PROBE_MUTATED");
  assert.equal(blob("HEAD", FILES.historicalGate), PINS.historicalGate, "EA4_HISTORICAL_GATE_MUTATED");
  assert.equal(blob(HISTORICAL_WORKFLOW_COMMIT, FILES.workflow), PINS.historicalWorkflow, "EA4_HISTORICAL_WORKFLOW_NOT_PRESERVED_IN_GIT_HISTORY");

  const authority = JSON.parse(read(FILES.authority));
  assert.equal(authority.record_status, "EA4_LIVE_SOURCE_EXACT_HEAD_REJECTION_CANDIDATE_NOT_EFFECTIVE");
  assert.equal(authority.live_qualification?.current_result, "REJECTED_EA4_KBS_RAW_HOURLY_FRESHNESS_AUTHORITY");
  assert.equal(authority.authority_effect?.live_source_qualified, false);
  assert.equal(authority.authority_effect?.ea5_candidate_development_authorized, false);

  const workflow = read(FILES.workflow);
  for (const marker of [
    "historical_boundary",
    "ACCEPTANCE_MCFT_CAP_09_EA4_HISTORICAL_REJECTION_PRESERVATION.cjs",
    "steps.authority.outputs.historical_boundary == 'true'",
    "steps.authority.outputs.historical_boundary != 'true'",
  ]) assert(workflow.includes(marker), `EA4_SUCCESSOR_WORKFLOW_MODE_GUARD_MISSING:${marker}`);

  const provider = read(FILES.ea5e2Provider);
  for (const marker of ["def select_complete_gfs_cycle", "def command_selftest_gfs_selection", "A partially published newest cycle is not a terminal selection"]) {
    assert(provider.includes(marker), `EA4_SUCCESSOR_PROVIDER_PROOF_MISSING:${marker}`);
  }
  assert(read(FILES.ea5e2Qualification).includes("selftest-gfs-selection"), "EA4_SUCCESSOR_PROVIDER_EXACT_HEAD_SELFTEST_MISSING");

  write({
    schema_version: "geox_mcft_cap09_ea4_historical_rejection_preservation_v1",
    status: "PASS",
    subject_sha: head,
    base_sha: BASE,
    historical_qualification_reexecuted: false,
    historical_rejection_evidence_preserved: true,
    historical_authority_preserved: true,
    historical_probe_preserved: true,
    historical_gate_preserved: true,
    historical_workflow_preserved_in_git_history: true,
    successor_ea5e2_provider_qualification_required_separately: true,
    live_source_qualified_by_this_proof: false,
    provider_request_count: 0,
    database_write_count: 0,
    formal_window_started: false,
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_ea4_historical_rejection_preservation_v1",
    status: "FAIL",
    subject_sha: (() => { try { return git("rev-parse", "HEAD"); } catch { return null; } })(),
    base_sha: BASE || null,
    error: String(error?.message || error),
    live_source_qualified_by_this_proof: false,
    provider_request_count: 0,
    database_write_count: 0,
    formal_window_started: false,
  });
  process.exitCode = 1;
}
