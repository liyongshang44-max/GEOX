#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const OUT = "acceptance-output/MCFT_CAP_09_AMENDMENT_15_PROVIDER_SNAPSHOT_LIFECYCLE_AUTHORITY.json";
const A15 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-15-PROVIDER-SNAPSHOT-LIFECYCLE-AUTHORITY.md";
const A14 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-14-POSITIVE-LIFECYCLE-ANCHOR-AUTHORITY.md";
const PROBE = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_BOUNDED_LIFECYCLE_CARRY_FORWARD.mjs";
const PROBE_WORKFLOW = ".github/workflows/mcft-cap-09-bounded-lifecycle-carry-forward-qualification.yml";
const SELF = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_15_PROVIDER_SNAPSHOT_LIFECYCLE_AUTHORITY.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-amendment-15-provider-snapshot-lifecycle-authority.yml";

const EXPECTED_BASE = "2cc901168ad208873ec6558a1a712fcfe887bf14";
const EXPECTED_A14_BLOB = "299e256bed5ab8c822990f34686b310da3bcf00e";
const EXPECTED_PROBE_BLOB = "8dd32ba38f68f85b1cf8120a9b40c65c2c9e99ea";
const EXPECTED_PROBE_WORKFLOW_BLOB = "9aeef98be6b35ec7ddb2c07184dd0b44433035f5";
const EXPECTED_QUAL_SUBJECT = "277643b74c822ddda7638deffbc99ef26f32c7f0";
const EXPECTED_QUAL_RUN = 31802447763;
const EXPECTED_QUAL_ARTIFACT = 9219831976;
const EXPECTED_QUAL_DIGEST = "sha256:f62eb7255bbb4ea286a0071ad2b3420efd61e2f2da41870eadd502e80f05ceb0";
const EXPECTED_RETRIEVAL = "2026-08-14T12:56:56.184Z";
const EXPECTED_QUAL_TIME = "2026-08-14T12:57:09.596Z";

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function requireMarker(text, marker) { assert(text.includes(marker), `A15_REQUIRED_MARKER_MISSING:${marker}`); }
function forbidMarker(text, marker) { assert(!text.includes(marker), `A15_FORBIDDEN_MARKER_PRESENT:${marker}`); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value));
}

try {
  const head = git("rev-parse", "HEAD");
  assert.equal(git("merge-base", EXPECTED_BASE, head), EXPECTED_BASE, "A15_MUST_DESCEND_FROM_EXACT_BASE");
  assert.equal(git("rev-parse", `HEAD:${A14}`), EXPECTED_A14_BLOB, "A15_AMENDMENT14_MUTATED");
  assert.equal(git("rev-parse", `HEAD:${PROBE}`), EXPECTED_PROBE_BLOB, "A15_LAYER2_PROBE_MUTATED");
  assert.equal(git("rev-parse", `HEAD:${PROBE_WORKFLOW}`), EXPECTED_PROBE_WORKFLOW_BLOB, "A15_LAYER2_WORKFLOW_MUTATED");

  const changed = git("diff", "--name-only", `${EXPECTED_BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, [A15, SELF, WORKFLOW].sort(), "A15_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

  const text = read(A15);
  for (const marker of [
    "Provider Snapshot Lifecycle Boundary Correction",
    "L2_BOUNDED_LIFECYCLE_CARRY_FORWARD",
    `Exact base protected main: \`${EXPECTED_BASE}\``,
    "T1R1_SCOPE_COVERAGE_COMPLETENESS_OR_DIRECT_CURRENT_ANCHOR_REFRESH_QUALIFICATION",
    `qualification_subject_sha = ${EXPECTED_QUAL_SUBJECT}`,
    `qualification_workflow_run_id = ${EXPECTED_QUAL_RUN}`,
    `qualification_artifact_id = ${EXPECTED_QUAL_ARTIFACT}`,
    `qualification_artifact_digest = ${EXPECTED_QUAL_DIGEST}`,
    `qualification_probe_blob = ${EXPECTED_PROBE_BLOB}`,
    `qualification_workflow_blob = ${EXPECTED_PROBE_WORKFLOW_BLOB}`,
    `qualification_merge_sha = ${EXPECTED_BASE}`,
    `qualification_time_utc = ${EXPECTED_QUAL_TIME}`,
    `T1R1_area_snapshot_retrieved_at = ${EXPECTED_RETRIEVAL}`,
    "NO_PUBLISHED_RESET_OBSERVED_AS_OF_RETRIEVAL = true",
    "T1R1_SCOPE_COVERAGE_COMPLETE_THROUGH_RETRIEVAL = false",
    "T1R1_PUBLICATION_LAG_UPPER_BOUND_ESTABLISHED = false",
    "ACTIVE_VALID_THROUGH_RETRIEVAL_TIME = false",
    "CURRENT_RUNTIME_LIFECYCLE_AUTHORITY_ESTABLISHED = false",
    "RESET_SEMANTIC_CLASSIFICATION_COMPLETE = false",
    "same-day observation ID ordering is not lifecycle event chronology",
    "current_runtime_lifecycle_authority_established = false",
    "bounded_active_validity_interval_beyond_anchor_established = false",
    "scope_specific_coverage_completeness_established = false",
    "publication_lag_upper_bound_established = false",
    "future_forward_validity_hours = 0",
    "future_forward_validity_established = false",
    "future_target_wholly_inside_lifecycle_validity_established = false",
    "T1R1_SCOPE_COVERAGE_COMPLETENESS_UNRESOLVED",
    "phenology_stage.status = UNRESOLVED",
    "crop_model_parameter.status = UNRESOLVED",
    "crop_model_parameter.kc = null",
    "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false",
    "Formal execution = 0/24"
  ]) requireMarker(text, marker);

  for (const marker of [
    "provider_snapshot_lifecycle_authority = {",
    "provider_recorded management lifecycle remained ACTIVE through",
    "valid_through_provider_snapshot_utc:",
    "future_forward_validity_hours = 3",
    "future_forward_validity_established = true",
    "future_target_wholly_inside_lifecycle_validity_established = true",
    "phenology_stage.status = RESOLVED",
    "crop_model_parameter.status = RESOLVED",
    "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true"
  ]) forbidMarker(text, marker);

  write({
    schema_version: "geox_mcft_cap09_amendment15_provider_snapshot_lifecycle_boundary_correction_v1",
    status: "PASS",
    subject_sha: head,
    exact_base_protected_main: EXPECTED_BASE,
    exact_three_file_boundary: true,
    predecessor_blobs_preserved: true,
    qualification_subject_sha: EXPECTED_QUAL_SUBJECT,
    qualification_workflow_run_id: EXPECTED_QUAL_RUN,
    qualification_artifact_id: EXPECTED_QUAL_ARTIFACT,
    qualification_artifact_digest: EXPECTED_QUAL_DIGEST,
    t1r1_area_snapshot_retrieved_at: EXPECTED_RETRIEVAL,
    no_published_reset_observed_as_of_retrieval: true,
    retrieval_timestamp_is_provider_coverage_watermark: false,
    t1r1_scope_coverage_complete_through_retrieval: false,
    t1r1_publication_lag_upper_bound_established: false,
    reset_semantic_classification_complete: false,
    observation_id_order_is_event_chronology: false,
    current_runtime_lifecycle_authority_established: false,
    bounded_active_validity_interval_beyond_anchor_established: false,
    future_forward_validity_hours: 0,
    future_forward_validity_established: false,
    future_target_wholly_inside_lifecycle_validity_established: false,
    exact_remaining_lifecycle_blocker: "T1R1_SCOPE_COVERAGE_COMPLETENESS_UNRESOLVED",
    phenology_stage_status: "UNRESOLVED",
    crop_model_parameter_status: "UNRESOLVED",
    kc: null,
    next_frontier: "T1R1_SCOPE_COVERAGE_COMPLETENESS_OR_DIRECT_CURRENT_ANCHOR_REFRESH_QUALIFICATION",
    database_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    formal_execution_count: "0/24"
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_amendment15_provider_snapshot_lifecycle_boundary_correction_v1",
    status: "FAIL",
    error: String(error?.message || error),
    current_runtime_lifecycle_authority_established: false,
    bounded_active_validity_interval_beyond_anchor_established: false,
    future_forward_validity_established: false,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    formal_execution_count: "0/24"
  });
  process.exitCode = 1;
}
