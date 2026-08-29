#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const EXPECTED_BASE = "23f224c701dbe0b8bd56eceff3741cb1c3dc1f78";
const CONFIG = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-FAST-PATH-REQUALIFICATION-V1.json";
const PROBE = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_FAST_PATH_REQUALIFICATION.mjs";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_FAST_PATH_REQUALIFICATION.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-t3r1-fast-path-requalification.yml";
const OUT = "acceptance-output/MCFT_CAP_09_T3R1_FAST_PATH_REQUALIFICATION_GOVERNANCE_RESULT.json";
const ALLOWED = [CONFIG, PROBE, GATE, WORKFLOW].sort();
const PRESERVED = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-13-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION.md": "5210001b387993cea502aac9480834400b3b8ef3",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-15-PROVIDER-SNAPSHOT-LIFECYCLE-AUTHORITY.md": "73eb7600bd607c871ff4af60907a0053d15dfe41",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json": "eeb7ab49ee3270421efe4d6674305426074d1541",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1M-GFS-SPATIAL-EXTRACTION-AUTHORITY-V1.json": "bb487c0c6a91dd37b0409b5d446aec4707f7b0a4",
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json": "c04c6805ab79c715781b99f8fbcf997fae3a8c48",
  "docs/digital_twin/mcft/GEOX-MCFT-00-GEOMETRY-CANONICALIZATION.md": "2f413d43c11aeff79dcf3e4e8069be426f71f018",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json": "eb9eb1880e01eb16430c177be6e2ef2dc36b3ca8",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json": "dedc8db6e2e3c902066ed94b0d3322a69775b7b6"
};

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function has(text, marker, code) { assert(text.includes(marker), `${code}:${marker}`); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(value));
}

try {
  const base = String(process.env.MCFT_BASE_SHA || "").trim();
  const subject = String(process.env.MCFT_SUBJECT_SHA || "").trim();
  const head = git("rev-parse", "HEAD");
  assert.equal(base, EXPECTED_BASE, "T3R1_FAST_PATH_EXACT_BASE_REQUIRED");
  assert.equal(subject, head, "T3R1_FAST_PATH_EXACT_HEAD_REQUIRED");
  assert.equal(git("merge-base", base, head), base, "T3R1_FAST_PATH_BASE_NOT_ANCESTOR");
  const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean).sort();
  assert.deepEqual(changed, ALLOWED, "T3R1_FAST_PATH_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");

  for (const [file, expectedBlob] of Object.entries(PRESERVED)) {
    assert.equal(git("rev-parse", `HEAD:${file}`), expectedBlob, `T3R1_FAST_PATH_PREDECESSOR_MUTATED:${file}`);
  }

  const config = JSON.parse(read(CONFIG));
  assert.equal(config.schema_version, "geox_mcft_cap09_t3r1_fast_path_requalification_v1");
  assert.equal(config.frontier, "S6-T3R1-FAST-PATH-REQUALIFICATION");
  assert.equal(config.exact_base_protected_main, EXPECTED_BASE);
  assert.equal(config.candidate_scope.treatment, "T3");
  assert.equal(config.candidate_scope.replicate, "R1");
  assert.equal(config.candidate_scope.crop, "corn");
  assert.equal(config.candidate_scope.hybrid_product_code, "P0306Q");
  assert.equal(config.candidate_scope.planting_local_date, "2026-05-20");
  assert.equal(config.candidate_scope.possible_planting_window_utc.start_inclusive, "2026-05-20T04:00:00.000Z");
  assert.equal(config.candidate_scope.possible_planting_window_utc.end_exclusive, "2026-05-21T04:00:00.000Z");
  assert.equal(config.stage_and_kc_policy.stage_algorithm_id, "FAO56_MAIZE_GRAIN_CONSENSUS_ENVELOPE_FROM_PLANTING_DATE_V1");
  assert.equal(config.stage_and_kc_policy.backward_stability_hours, 6);
  assert.equal(config.stage_and_kc_policy.forward_transition_guard_hours, 30);
  assert.equal(config.stage_and_kc_policy.minimum_contiguous_legal_target_hours_for_fast_path, 24);
  assert.equal(config.stage_and_kc_policy.single_fao_variant_selection_forbidden, true);
  assert.equal(config.stage_and_kc_policy.observed_biological_stage_claimed, false);
  assert.equal(config.lifecycle_policy.absence_of_termination_row_proves_active, false);
  assert.equal(config.lifecycle_policy.provider_retrieval_time_is_coverage_watermark, false);
  assert.equal(config.lifecycle_policy.current_active_authorized_by_this_probe, false);
  assert.equal(config.geometry_discovery.crop_only_zone_policy.whole_t3r1_polygon_may_not_be_assumed_crop_only, true);
  assert.equal(config.geometry_discovery.crop_only_zone_policy.prairie_strip_may_not_be_relabelled_corn, true);
  assert.equal(config.geometry_discovery.crop_only_zone_policy.point_geometry_for_formal_zone_forbidden_by_current_mcft00_geometry_contract, true);
  assert.equal(config.geometry_discovery.crop_only_zone_policy.automatic_main_minus_strip_authority_created_by_this_probe, false);
  assert.equal(config.readiness_policy.formal_rebind_authorized_by_this_probe, false);
  assert.equal(config.readiness_policy.ea5e2_go_authorized_by_this_probe, false);

  for (const [key, predecessor] of Object.entries(config.authority_predecessors)) {
    assert.equal(PRESERVED[predecessor.path], predecessor.blob_sha, `T3R1_FAST_PATH_PREDECESSOR_PIN_INVALID:${key}`);
  }
  for (const claim of [
    "NO_T1R1_EVIDENCE_RELABELLING_AS_T3R1",
    "NO_CROSS_SCOPE_CANONICAL_STITCHING",
    "NO_ACTIVE_LIFECYCLE_FROM_PROVIDER_SILENCE",
    "NO_HTTP_RETRIEVAL_TIME_AS_PROVIDER_COVERAGE_WATERMARK",
    "NO_PRAIRIE_STRIP_RELABELLING_AS_CORN",
    "NO_WHOLE_T3R1_POLYGON_ASSUMED_CROP_ONLY",
    "NO_SINGLE_FAO_VARIANT_BEST_FIT",
    "NO_KC_INVENTION",
    "NO_FORMAL_SITE_REBIND",
    "NO_EA5E2_OPERATIONAL_ACTIVATION",
    "NO_FORMAL_WINDOW_START"
  ]) assert(config.hard_nonclaims.includes(claim), `T3R1_FAST_PATH_NONCLAIM_MISSING:${claim}`);

  const probe = read(PROBE);
  for (const marker of [
    "T3R1_EXACT_PLANTING_MATCH_COUNT_",
    "explicit_replicate_1_inclusion",
    "FAO56_MAIZE_GRAIN_CONSENSUS_ENVELOPE_FROM_PLANTING_DATE_V1",
    "single_fao_variant_selected: false",
    "absence_of_termination_used_to_prove_active: false",
    "provider_retrieval_time_used_as_coverage_watermark: false",
    "whole_t3r1_polygon_assumed_crop_only: false",
    "prairie_strip_relabelled_corn: false",
    "automatic_main_minus_strip_authority_created: false",
    "formal_rebind_authorized: false",
    "ea5e2_operational_activation_authorized: false",
    "formal_execution_count: '0/24'"
  ]) has(probe, marker, "T3R1_FAST_PATH_PROBE_RULE_MISSING");
  assert(!probe.includes("field_kbs_mcse_t1r1"), "T3R1_FAST_PATH_T1R1_FIELD_RELABEL_FORBIDDEN");
  assert(!probe.includes("zone_kbs_mcse_t1r1_formal_v1"), "T3R1_FAST_PATH_T1R1_ZONE_RELABEL_FORBIDDEN");

  const workflow = read(WORKFLOW);
  has(workflow, "pull_request:", "T3R1_FAST_PATH_PR_TRIGGER_REQUIRED");
  has(workflow, "merge_group:", "T3R1_FAST_PATH_MERGE_GROUP_TRIGGER_REQUIRED");
  has(workflow, "persist-credentials: false", "T3R1_FAST_PATH_READ_ONLY_CHECKOUT_REQUIRED");
  has(workflow, "PROBE_MCFT_CAP_09_T3R1_FAST_PATH_REQUALIFICATION.mjs", "T3R1_FAST_PATH_LIVE_PROBE_REQUIRED");
  assert(!/^\s{2}push:/m.test(workflow), "T3R1_FAST_PATH_PUSH_TRIGGER_FORBIDDEN");
  assert(!workflow.includes("workflow_dispatch:"), "T3R1_FAST_PATH_MANUAL_DISPATCH_FORBIDDEN");

  write({
    schema_version: "geox_mcft_cap09_t3r1_fast_path_requalification_governance_result_v1",
    status: "PASS",
    subject_sha: head,
    exact_base_sha: base,
    exact_four_file_boundary: true,
    t1r1_formal_authorities_preserved: true,
    t3r1_live_read_only_requalification_required: true,
    no_cross_scope_stitching: true,
    active_from_provider_silence_forbidden: true,
    prairie_strip_crop_relabelling_forbidden: true,
    single_fao_variant_selection_forbidden: true,
    kc_invention_forbidden: true,
    formal_rebind_authorized: false,
    ea5e2_operational_activation_authorized: false,
    database_write_count: 0,
    formal_window_started: false,
    formal_execution_count: "0/24"
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_t3r1_fast_path_requalification_governance_result_v1",
    status: "FAIL",
    error: String(error?.message || error),
    formal_rebind_authorized: false,
    ea5e2_operational_activation_authorized: false,
    database_write_count: 0,
    formal_window_started: false
  });
  process.exitCode = 1;
}
