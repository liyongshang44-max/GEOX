#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const BASE = "6d05ed166a847b05e9488a8b2f8152c3dc70ce03";
const DOC = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-T1R1-COMPLETENESS-PUBLICATION-LAG-ADJUDICATION.md";
const SELF = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_T1R1_COMPLETENESS_PUBLICATION_LAG_ADJUDICATION.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-kbs-t1r1-completeness-publication-lag-adjudication.yml";
const PREDECESSOR_PROBE = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T1R1_SCOPE_COVERAGE_RESET_SEMANTICS.mjs";
const PREDECESSOR_WORKFLOW = ".github/workflows/mcft-cap-09-t1r1-scope-coverage-reset-semantics-qualification.yml";
const EXPECTED_PROBE_BLOB = "d8968aee1649b01aae52629e104fe7e763128588";
const EXPECTED_WORKFLOW_BLOB = "a2daf71ef1fd4c189c0f6fbdc791f4e09623eb59";
const OUT = "acceptance-output/MCFT_CAP_09_KBS_T1R1_COMPLETENESS_PUBLICATION_LAG_ADJUDICATION.json";

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function requireMarker(text, marker) { assert(text.includes(marker), `KBS_T1R1_ADJ_REQUIRED_MARKER_MISSING:${marker}`); }
function forbidMarker(text, marker) { assert(!text.includes(marker), `KBS_T1R1_ADJ_FORBIDDEN_MARKER_PRESENT:${marker}`); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value));
}

try {
  const head = git("rev-parse", "HEAD");
  assert.equal(git("merge-base", BASE, head), BASE, "KBS_T1R1_ADJ_MUST_DESCEND_FROM_EXACT_BASE");
  assert.equal(git("rev-parse", `HEAD:${PREDECESSOR_PROBE}`), EXPECTED_PROBE_BLOB, "KBS_T1R1_ADJ_PREDECESSOR_PROBE_DRIFT");
  assert.equal(git("rev-parse", `HEAD:${PREDECESSOR_WORKFLOW}`), EXPECTED_WORKFLOW_BLOB, "KBS_T1R1_ADJ_PREDECESSOR_WORKFLOW_DRIFT");

  const changed = git("diff", "--name-only", `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, [DOC, SELF, WORKFLOW].sort(), "KBS_T1R1_ADJ_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

  const text = fs.readFileSync(DOC, "utf8");
  for (const marker of [
    "KBS T1R1 Completeness / Publication-Lag Adjudication",
    `Exact base protected main: \`${BASE}\``,
    "https://lter.kbs.msu.edu/datatables/16",
    "https://lter.kbs.msu.edu/datatables/150",
    "https://lter.kbs.msu.edu/data/data-submission-guidelines/",
    "usually the date on which the observation was **authored**",
    "timely manner",
    "KBS_PUBLIC_T1R1_SCOPE_COVERAGE_COMPLETENESS_AUTHORITY = NOT_ESTABLISHED",
    "KBS_PUBLIC_T1R1_PUBLICATION_LAG_UPPER_BOUND_AUTHORITY = NOT_ESTABLISHED",
    "KBS_PUBLIC_T1R1_COMPLETE_THROUGH_EVENT_TIME_WATERMARK = UNRESOLVED",
    "BOUNDED_LIFECYCLE_CARRY_FORWARD_FROM_KBS_PUBLIC_AGLOG_ABSENCE = NOT_AUTHORIZED",
    "current_runtime_lifecycle_authority_established = false",
    "future_forward_validity_hours = 0",
    "DIRECT_CURRENT_ANCHOR_REFRESH",
    "phenology_stage.status = UNRESOLVED",
    "crop_model_parameter.status = UNRESOLVED",
    "future_legal_t_established = false",
    "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false",
    "Formal execution = 0/24",
    "does not permanently forbid that future evidence"
  ]) requireMarker(text, marker);

  for (const marker of [
    "KBS has no internal or unpublished completeness/SLA semantics",
    "ACTIVE valid through retrieval = true",
    "future_forward_validity_hours = 3",
    "future_forward_validity_established = true",
    "phenology_stage.status = RESOLVED",
    "crop_model_parameter.status = RESOLVED",
    "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true"
  ]) forbidMarker(text, marker);

  write({
    schema_version: "geox_mcft_cap09_kbs_t1r1_completeness_publication_lag_adjudication_v1",
    status: "PASS",
    subject_sha: head,
    exact_base_protected_main: BASE,
    exact_three_file_boundary: true,
    predecessor_probe_blob_preserved: true,
    predecessor_workflow_blob_preserved: true,
    reviewed_public_authority_set_establishes_t1r1_scope_completeness: false,
    reviewed_public_authority_set_establishes_publication_lag_upper_bound: false,
    reviewed_public_authority_set_establishes_complete_through_event_time_watermark: false,
    bounded_lifecycle_carry_forward_from_kbs_public_aglog_absence_authorized: false,
    current_runtime_lifecycle_authority_established: false,
    future_forward_validity_hours: 0,
    future_forward_validity_established: false,
    next_frontier: "DIRECT_CURRENT_ANCHOR_REFRESH",
    phenology_stage_status: "UNRESOLVED",
    crop_model_parameter_status: "UNRESOLVED",
    future_legal_t_established: false,
    ea5e2_operational_activation_qualified: false,
    database_write_count: 0,
    runtime_write_count: 0,
    scheduler_write_count: 0,
    formal_window_started: false,
    formal_execution_count: "0/24"
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_kbs_t1r1_completeness_publication_lag_adjudication_v1",
    status: "FAIL",
    error: String(error?.message || error),
    current_runtime_lifecycle_authority_established: false,
    future_forward_validity_established: false,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    formal_execution_count: "0/24"
  });
  process.exitCode = 1;
}
