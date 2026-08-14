#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const OUT = "acceptance-output/MCFT_CAP_09_AMENDMENT_14_POSITIVE_LIFECYCLE_ANCHOR_AUTHORITY.json";
const A14 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-14-POSITIVE-LIFECYCLE-ANCHOR-AUTHORITY.md";
const A13 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-13-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION.md";
const INVENTORY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-CURRENT-SEASON-SOURCE-INVENTORY-V1.json";
const QUAL_PROBE = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_OBS6977_SEASON_CONTINUITY_QUALIFICATION.mjs";
const QUAL_WORKFLOW = ".github/workflows/mcft-cap-09-obs6977-season-continuity-qualification.yml";
const SELF = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_14_POSITIVE_LIFECYCLE_ANCHOR_AUTHORITY.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-amendment-14-positive-lifecycle-anchor-authority.yml";

const EXPECTED_BASE = "bf82b7c67f56d7814912c5b84fbe392c08496274";
const EXPECTED_A13_BLOB = "5210001b387993cea502aac9480834400b3b8ef3";
const EXPECTED_INVENTORY_BLOB = "0a8bd80a3ae0dab4d9f3a82311494167f986c159";
const EXPECTED_QUAL_PROBE_BLOB = "693de6289a0a5cc0191e9c46f122258cb87e4079";
const EXPECTED_QUAL_WORKFLOW_BLOB = "bde3e7805a72a4ef5a5205ee260dcd954eeb11f4";
const EXPECTED_QUAL_SUBJECT = "c4d8e4429cc3c037b80d246aab80887d86003692";
const EXPECTED_QUAL_RUN = 31800131893;
const EXPECTED_QUAL_ARTIFACT = 9218942740;
const EXPECTED_QUAL_DIGEST = "sha256:aac5dda23bc777c3e8a74202cb09a3ce4307e15b6989f57c3213ded2ce026ee9";
const EXPECTED_AVAILABILITY = "2026-08-14T12:24:43.798Z";
const EXPECTED_START = "2026-05-27T18:35:00.000Z";
const EXPECTED_END = "2026-05-27T20:40:00.000Z";

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function requireMarker(text, marker) { assert(text.includes(marker), `A14_REQUIRED_MARKER_MISSING:${marker}`); }
function forbidMarker(text, marker) { assert(!text.includes(marker), `A14_FORBIDDEN_MARKER_PRESENT:${marker}`); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value));
}

try {
  const head = git("rev-parse", "HEAD");
  assert.equal(git("merge-base", EXPECTED_BASE, head), EXPECTED_BASE, "A14_MUST_DESCEND_FROM_EXACT_BASE");

  assert.equal(git("rev-parse", `HEAD:${A13}`), EXPECTED_A13_BLOB, "A14_PREDECESSOR_AMENDMENT13_MUTATED");
  assert.equal(git("rev-parse", `HEAD:${INVENTORY}`), EXPECTED_INVENTORY_BLOB, "A14_SOURCE_INVENTORY_MUTATED");
  assert.equal(git("rev-parse", `HEAD:${QUAL_PROBE}`), EXPECTED_QUAL_PROBE_BLOB, "A14_QUALIFICATION_PROBE_MUTATED");
  assert.equal(git("rev-parse", `HEAD:${QUAL_WORKFLOW}`), EXPECTED_QUAL_WORKFLOW_BLOB, "A14_QUALIFICATION_WORKFLOW_MUTATED");

  const changed = git("diff", "--name-only", `${EXPECTED_BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, [A14, SELF, WORKFLOW].sort(), "A14_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

  const text = read(A14);
  for (const marker of [
    "L1_POSITIVE_LIFECYCLE_ANCHOR",
    `Exact base protected main: \`${EXPECTED_BASE}\``,
    "BOUNDED_LIFECYCLE_CARRY_FORWARD_FROM_OBS6977",
    `qualification_subject_sha = ${EXPECTED_QUAL_SUBJECT}`,
    `qualification_workflow_run_id = ${EXPECTED_QUAL_RUN}`,
    `qualification_artifact_id = ${EXPECTED_QUAL_ARTIFACT}`,
    `qualification_artifact_digest = ${EXPECTED_QUAL_DIGEST}`,
    `qualification_probe_blob = ${EXPECTED_QUAL_PROBE_BLOB}`,
    `qualification_workflow_blob = ${EXPECTED_QUAL_WORKFLOW_BLOB}`,
    `qualification_merge_sha = ${EXPECTED_BASE}`,
    "positive_anchor_observation_id: 6977",
    `start_inclusive: ${EXPECTED_START}`,
    `end_inclusive: ${EXPECTED_END}`,
    `authority_available_to_runtime_at: ${EXPECTED_AVAILABILITY}`,
    "status: ACTIVE",
    "management_lifecycle_not_biological_vitality: true",
    "current_lifecycle_as_of_now.status = UNRESOLVED",
    "phenology_stage.status = UNRESOLVED",
    "crop_model_parameter.status = UNRESOLVED",
    "Kc = null",
    "absence used only to preserve identity between two positive events",
    "No historical Formal tick or historical runtime decision before",
    "current_lifecycle_active_as_of_amendment14_time = false",
    "bounded_lifecycle_carry_forward_established = false",
    "current_phenology_stage_resolved = false",
    "current_crop_model_parameter_resolved = false",
    "future_legal_t_established = false",
    "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false",
    "Formal execution = 0/24"
  ]) requireMarker(text, marker);

  for (const marker of [
    "no harvest row observed\n=> ACTIVE",
    "planting + thermal accumulation\n=> ACTIVE today",
    "current_lifecycle_as_of_now.status = ACTIVE",
    "bounded_lifecycle_carry_forward_established = true",
    "current_phenology_stage_resolved = true",
    "current_crop_model_parameter_resolved = true",
    "future_legal_t_established = true",
    "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true"
  ]) forbidMarker(text, marker);

  const result = {
    schema_version: "geox_mcft_cap09_amendment14_positive_lifecycle_anchor_authority_acceptance_v1",
    status: "PASS",
    subject_sha: head,
    exact_base_protected_main: EXPECTED_BASE,
    exact_three_file_boundary: true,
    predecessor_blobs_preserved: true,
    qualification_subject_sha: EXPECTED_QUAL_SUBJECT,
    qualification_workflow_run_id: EXPECTED_QUAL_RUN,
    qualification_artifact_id: EXPECTED_QUAL_ARTIFACT,
    qualification_artifact_digest: EXPECTED_QUAL_DIGEST,
    positive_lifecycle_anchor: {
      status: "ACTIVE",
      season_id: "season_2026_corn",
      crop: "corn",
      hybrid_product_code: "P0306Q",
      provider_area_identity: "T1R1",
      positive_anchor_observation_id: 6977,
      anchor_event_time_window_utc: { start_inclusive: EXPECTED_START, end_inclusive: EXPECTED_END },
      authority_available_to_runtime_at: EXPECTED_AVAILABILITY
    },
    current_lifecycle_as_of_authority_adoption: "UNRESOLVED",
    bounded_lifecycle_carry_forward_established: false,
    phenology_stage_status: "UNRESOLVED",
    crop_model_parameter_status: "UNRESOLVED",
    kc: null,
    future_legal_t_established: false,
    absence_used_as_positive_anchor: false,
    thermal_used_as_active_lifecycle_proof: false,
    next_frontier: "BOUNDED_LIFECYCLE_CARRY_FORWARD_FROM_OBS6977",
    database_write_count: 0,
    formal_evidence_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    formal_execution_count: "0/24"
  };
  write(result);
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_amendment14_positive_lifecycle_anchor_authority_acceptance_v1",
    status: "FAIL",
    error: String(error?.message || error),
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    formal_execution_count: "0/24"
  });
  process.exitCode = 1;
}
