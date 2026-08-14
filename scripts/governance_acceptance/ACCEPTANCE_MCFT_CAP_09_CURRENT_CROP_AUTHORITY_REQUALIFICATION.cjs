#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const EXPECTED_BASE = "ff707ce624c7300a3e80fbb629d3e76aef790748";
const CONFIG = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-CROP-AUTHORITY-REQUALIFICATION-V1.json";
const PROBE = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_CURRENT_CROP_AUTHORITY_REQUALIFICATION.mjs";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_CROP_AUTHORITY_REQUALIFICATION.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-current-crop-authority-live-requalification.yml";
const OUT = "acceptance-output/MCFT_CAP_09_CURRENT_CROP_AUTHORITY_REQUALIFICATION_GOVERNANCE_RESULT.json";
const ALLOWED = [CONFIG, PROBE, GATE, WORKFLOW].sort();
const PRESERVED = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-13-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION.md": "5210001b387993cea502aac9480834400b3b8ef3",
  "scripts/runtime_acceptance/OBSERVER_MCFT_CAP_09_EA9B_CURRENT_MAIN_WINDOW_READINESS.mjs": "42d2d8447401aae7531336f937f77b4f966c44ed",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json": "b5de9d29189cb654444b3f57d00df290eefe16d3",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION-V1.json": "0e1f809c4bf63b09f4e44431ce507e3b74a966af",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-THERMAL-LANDMARK-TO-WATER-USE-STAGE-MAPPING-V1.json": "4e555183e2b69d3b7f39a7341acd89815ad871dd",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306Q-BOUNDED-GDD-STAGE-QUALIFICATION-V1.json": "f50a171ea408e89857ca6c859a19e096e34457e8"
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
  assert.equal(base, EXPECTED_BASE, "CURRENT_CROP_REQUAL_EXACT_BASE_REQUIRED");
  assert.equal(subject, head, "CURRENT_CROP_REQUAL_EXACT_HEAD_REQUIRED");
  assert.equal(git("merge-base", base, head), base, "CURRENT_CROP_REQUAL_BASE_NOT_ANCESTOR");
  const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean).sort();
  assert.deepEqual(changed, ALLOWED, "CURRENT_CROP_REQUAL_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");

  for (const [file, expectedBlob] of Object.entries(PRESERVED)) {
    assert.equal(git("rev-parse", `HEAD:${file}`), expectedBlob, `CURRENT_CROP_REQUAL_PREDECESSOR_MUTATED:${file}`);
  }

  const config = JSON.parse(read(CONFIG));
  assert.equal(config.schema_version, "geox_mcft_cap09_current_crop_authority_requalification_v1");
  assert.equal(config.frontier, "S6-CURRENT-CROP-AUTHORITY-REQUALIFICATION");
  assert.equal(config.exact_base_protected_main, EXPECTED_BASE);
  assert.equal(config.authority_predecessors.amendment_13.blob_sha, PRESERVED["docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-13-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION.md"]);
  assert.equal(config.formal_scope.season_id, "season_2026_corn");
  assert.equal(config.formal_scope.crop, "corn");
  assert.equal(config.formal_scope.hybrid_product_code, "P0306Q");
  assert.equal(config.season_lifecycle_policy.absence_of_termination_row_proves_active, false);
  assert.equal(config.season_lifecycle_policy.active_status_authorized_by_this_v1_probe, false);
  assert.equal(config.season_lifecycle_policy.fallback_without_positive_termination, "UNRESOLVED");
  assert.equal(config.phenology_stage_policy.semantic_candidate_alone_resolves_current_stage, false);
  assert.equal(config.phenology_stage_policy.fallback, "UNRESOLVED");
  assert.equal(config.crop_model_parameter_policy.required_parameter, "Kc");
  assert.equal(config.crop_model_parameter_policy.kc_may_be_invented_from_lifecycle, false);
  assert.equal(config.crop_model_parameter_policy.kc_may_be_invented_from_unmapped_phenology, false);
  assert.equal(config.crop_model_parameter_policy.fallback, "UNRESOLVED");
  assert.equal(config.readiness_interpretation.legacy_blocker_may_not_be_emitted_by_this_requalification, true);
  assert.equal(config.readiness_interpretation.ea5e2_go_requires_lifecycle_active_and_required_model_parameter_resolved, true);
  for (const claim of [
    "NO_ACTIVE_LIFECYCLE_FROM_PROVIDER_SILENCE",
    "NO_STAGE_FROM_PHENOLOGY_TOKEN_ALONE",
    "NO_KC_INVENTION",
    "NO_REWRITE_OF_SIX_FAO_MODEL_AUTHORITY",
    "NO_REWRITE_OF_BOUNDED_GDD_TERMINAL_PROOF",
    "NO_EA5E2_OPERATIONAL_ACTIVATION",
    "NO_FORMAL_WINDOW_START"
  ]) assert(config.hard_nonclaims.includes(claim), `CURRENT_CROP_REQUAL_NONCLAIM_MISSING:${claim}`);

  const probe = read(PROBE);
  for (const marker of [
    "ACTIVE_LIFECYCLE_NOT_PROVEN_BY_PROVIDER_SILENCE",
    "POSITIVE_CURRENT_SEASON_CORN_TERMINATION_EVIDENCE",
    "REQUIRED_PHENOLOGY_STAGE_UNRESOLVED",
    "REQUIRED_CROP_MODEL_PARAMETER_AUTHORITY_UNRESOLVED",
    "legacy_no_future_legal_target_blocker_emitted: false",
    "absence_of_termination_used_to_prove_active: false",
    "semantic_candidate_alone_used_as_stage: false",
    "invented_from_lifecycle: false",
    "invented_from_unmapped_phenology: false",
    "historical_six_model_authority_rewritten: false",
    "bounded_gdd_terminal_proof_rewritten: false",
    "provider_body_emitted: false",
    "formal_execution_count: '0/24'"
  ]) has(probe, marker, "CURRENT_CROP_REQUAL_PROBE_RULE_MISSING");
  assert(!probe.includes("CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET'"), "CURRENT_CROP_REQUAL_LEGACY_BLOCKER_LITERAL_FORBIDDEN_IN_PROBE");

  const workflow = read(WORKFLOW);
  has(workflow, "pull_request:", "CURRENT_CROP_REQUAL_PR_TRIGGER_REQUIRED");
  has(workflow, "merge_group:", "CURRENT_CROP_REQUAL_MERGE_GROUP_TRIGGER_REQUIRED");
  has(workflow, "persist-credentials: false", "CURRENT_CROP_REQUAL_READ_ONLY_CHECKOUT_REQUIRED");
  has(workflow, "PROBE_MCFT_CAP_09_CURRENT_CROP_AUTHORITY_REQUALIFICATION.mjs", "CURRENT_CROP_REQUAL_LIVE_PROBE_REQUIRED");
  assert(!/^\s{2}push:/m.test(workflow), "CURRENT_CROP_REQUAL_PUSH_TRIGGER_FORBIDDEN");
  assert(!workflow.includes("workflow_dispatch:"), "CURRENT_CROP_REQUAL_MANUAL_DISPATCH_FORBIDDEN");

  write({
    schema_version: "geox_mcft_cap09_current_crop_authority_requalification_governance_result_v1",
    status: "PASS",
    subject_sha: head,
    exact_base_sha: base,
    exact_four_file_boundary: true,
    amendment_13_effective_on_base: true,
    live_read_only_requalification_required: true,
    active_from_provider_silence_forbidden: true,
    semantic_token_alone_stage_authority_forbidden: true,
    kc_invention_forbidden: true,
    legacy_no_future_legal_target_interpretation_forbidden: true,
    protected_main_live_dispatch_authorized: false,
    ea5e2_operational_activation_qualified: false,
    database_write_count: 0,
    formal_window_started: false,
    formal_execution_count: "0/24"
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_current_crop_authority_requalification_governance_result_v1",
    status: "FAIL",
    error: String(error?.message || error),
    protected_main_live_dispatch_authorized: false,
    database_write_count: 0,
    formal_window_started: false
  });
  process.exitCode = 1;
}
