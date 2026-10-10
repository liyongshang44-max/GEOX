#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const CONFIG_PATH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-PERSISTENT-LIFECYCLE-QUALIFICATION-V1.json");
const PROBE_PATH = path.join(ROOT, "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION.mjs");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_GOVERNANCE_RESULT.json");
const CHAIN_OUT = "acceptance-output/MCFT_CAP09_T4R1_PROTECTED_MAIN_SUCCESSOR_CHAIN_RESULT.json";
const BASE_SHA = String(process.env.MCFT_BASE_SHA || "").trim();
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || "").trim();
const DAY_MS = 86400000;

const assert = (condition, code, detail) => {
  if (!condition) throw new Error(detail === undefined ? code : `${code}:${detail}`);
};
const git = (args) => cp.execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const write = (value) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
};

try {
  assert(/^[0-9a-f]{40}$/.test(BASE_SHA), "T4R1_GOV_BASE_REQUIRED");
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), "T4R1_GOV_SUBJECT_REQUIRED");

  const currentMain = git(["rev-parse", "origin/main"]);
  assert(BASE_SHA === currentMain, "T4R1_GOV_BASE_NOT_CURRENT_PROTECTED_MAIN", `${BASE_SHA}:${currentMain}`);

  const x = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  assert(x.schema_version === "geox_mcft_cap09_t4r1_persistent_lifecycle_qualification_v2", "T4R1_GOV_SCHEMA");
  assert(x.record_status === "PROTECTED_MAIN_SUCCESSOR_CHAIN_EFFECTIVENESS_CANDIDATE", "T4R1_GOV_RECORD_STATUS");
  assert(x.frontier === "T4R1_CURRENT_SEASON_PERSISTENT_LIFECYCLE_QUALIFICATION", "T4R1_GOV_FRONTIER");
  assert(x.exact_predecessor_role === "HISTORICAL_AUTHORITY_ORIGIN_ONLY_NOT_CURRENT_BASE_ADMISSION", "T4R1_GOV_HISTORICAL_PREDECESSOR_ROLE");
  assert(x.effectiveness_rule.includes("PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_ADMISSION"), "T4R1_GOV_EFFECTIVENESS_RULE");
  assert(x.effectiveness_rule.includes("EXACT_MAIN_RERUN_IS_NOT_REQUIRED"), "T4R1_GOV_EXACT_RERUN_FORBIDDEN");

  const effect = x.protected_main_effectiveness || {};
  assert(effect.mode === "PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN", "T4R1_GOV_EFFECTIVENESS_MODE");
  assert(effect.successor_chain_status_required === "PASS", "T4R1_GOV_CHAIN_PASS_REQUIRED");
  assert(effect.current_protected_main_match_required === true, "T4R1_GOV_CURRENT_MAIN_MATCH_REQUIRED");
  assert(effect.authority_predecessor_blobs_must_match_current_protected_main === true, "T4R1_GOV_PREDECESSOR_PINS_REQUIRED");
  assert(effect.live_result_subject_must_equal_current_protected_main_for_adoption === true, "T4R1_GOV_SUBJECT_CURRENT_MAIN_REQUIRED");
  assert(effect.pr_head_may_gain_authority_before_merge === false, "T4R1_GOV_PR_AUTHORITY_FORBIDDEN");
  assert(effect.exact_main_rerun_required === false, "T4R1_GOV_EXACT_RERUN_REQUIRED_DRIFT");

  const chainPath = String(effect.successor_chain_acceptance || "");
  assert(chainPath === "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs", "T4R1_GOV_CHAIN_ACCEPTANCE_BINDING");
  cp.execFileSync("node", [path.join(ROOT, chainPath), "--base", BASE_SHA, "--out", CHAIN_OUT], { cwd: ROOT, stdio: "pipe", maxBuffer: 64 * 1024 * 1024 });
  const chain = JSON.parse(fs.readFileSync(path.join(ROOT, CHAIN_OUT), "utf8"));
  assert(chain.status === "PASS", "T4R1_GOV_CHAIN_NOT_PASS");
  assert(chain.admitted_base_sha === BASE_SHA, "T4R1_GOV_CHAIN_BASE_MISMATCH");
  assert(chain.current_protected_main_sha === BASE_SHA && chain.current_protected_main_match === true, "T4R1_GOV_CHAIN_CURRENT_MAIN_MISMATCH");
  assert(chain.first_parent_chain_complete === true && chain.merge_tree_equivalence_all === true && chain.candidate_to_merge_zero_delta_all === true, "T4R1_GOV_CHAIN_STRUCTURAL_PROOF_INCOMPLETE");
  assert(chain.historical_authority_promotion_authorized === false, "T4R1_GOV_HISTORICAL_PROMOTION_FORBIDDEN");
  assert(chain.baseline_qualification_carry_forward_authorized === false, "T4R1_GOV_BASELINE_CARRY_FORWARD_FORBIDDEN");
  for (const key of ["production_runtime_start_authorized", "production_owner_activation_authorized", "formal_v5_authorized", "a0_authorized", "o00_o23_authorized"]) {
    assert(chain[key] === false, `T4R1_GOV_CHAIN_AUTHORITY_CEILING:${key}`);
  }

  const p = x.authority_predecessors;
  assert(git(["rev-parse", `${BASE_SHA}:${p.amendment_16_path}`]) === p.amendment_16_blob_sha, "T4R1_GOV_AMENDMENT16_PIN");
  assert(git(["rev-parse", `${BASE_SHA}:${p.persistent_semantics_path}`]) === p.persistent_semantics_blob_sha, "T4R1_GOV_SEMANTICS_PIN");
  assert(git(["rev-parse", `${BASE_SHA}:${p.ea1j_formal_crop_context_path}`]) === p.ea1j_formal_crop_context_blob_sha, "T4R1_GOV_EA1J_PIN");

  const sem = JSON.parse(git(["show", `${BASE_SHA}:${p.persistent_semantics_path}`]));
  assert(sem.normative_principles?.season_lifecycle_is_persistent_state === true, "T4R1_GOV_PERSISTENT_STATE");
  assert(sem.normative_principles?.provider_silence_is_lifecycle_evidence === false, "T4R1_GOV_SILENCE_FORBIDDEN");
  assert(sem.horizon_policy?.horizon_may_only_truncate_persistence === true && sem.horizon_policy?.horizon_may_create_active === false, "T4R1_GOV_HORIZON_ASYMMETRY");

  assert(x.candidate_scope?.treatment === "T4" && x.candidate_scope?.replicate === "R1" && x.candidate_scope?.provider_area_identity === "T4R1", "T4R1_GOV_SCOPE");
  assert(x.candidate_scope?.crop === "corn" && x.candidate_scope?.hybrid_product_code === "43-96P", "T4R1_GOV_CROP");
  assert(x.establishment_source?.expected_observation_id === 6974 && x.candidate_scope?.planting_local_date === "2026-05-27", "T4R1_GOV_ESTABLISHMENT");

  const s = x.transition_sweep;
  assert(s?.provider === "KBS_AGLOG_CURRENT_OBSERVATION_INDEX_AND_DETAIL", "T4R1_GOV_PROVIDER");
  assert(s?.detail_field_contract?.whole_page_body_semantic_classification_forbidden === true, "T4R1_GOV_WHOLE_BODY_FORBIDDEN");
  assert(s?.detail_field_contract?.index_detail_date_agreement_required === true && s?.detail_field_contract?.index_detail_observation_type_agreement_required === true, "T4R1_GOV_DETAIL_CROSSCHECK");
  assert(s?.t4r1_applicability_rule?.parent_t4_in_detail_areas_requires_explicit_r1_in_comment === true, "T4R1_GOV_SCOPE_FAIL_CLOSED");
  assert(s?.provider_coverage_completeness_claimed === false && s?.proved_no_termination_occurred_may_be_emitted === false, "T4R1_GOV_NONCLAIM");

  const end = Date.parse(x.candidate_scope.possible_planting_window_utc.end_exclusive);
  const horizon = new Date(end - 1 + x.horizon_policy.maximum_total_days * DAY_MS).toISOString();
  assert(x.horizon_policy.maximum_total_days === 180 && horizon === x.horizon_policy.expected_horizon_end_utc, "T4R1_GOV_HORIZON");
  assert(x.horizon_policy.horizon_may_create_active === false && x.horizon_policy.support_event_may_renew_horizon === false, "T4R1_GOV_HORIZON_GUARDS");

  const probe = fs.readFileSync(PROBE_PATH, "utf8");
  assert(probe.includes("extractObservationDetail") && probe.includes("t4r1Applicability"), "T4R1_GOV_STRUCTURED_PROBE");
  assert(probe.includes("observationDate < targetDate") && !probe.includes("observationDate <= targetDate"), "T4R1_GOV_COMPLETE_PLANTING_DAY_PAGINATION");
  assert(probe.includes("proved_no_termination_occurred: false") && probe.includes("provider_coverage_completeness_proven: false"), "T4R1_GOV_NONCLAIM_SOURCE");
  assert(!probe.includes("lter.kbs.msu.edu/datatables/694"), "T4R1_GOV_LTAR694_FORBIDDEN");

  const boundary = x.authority_boundary || {};
  assert(boundary.successor_chain_effectiveness_required === true, "T4R1_GOV_BOUNDARY_CHAIN_REQUIRED");
  assert(boundary.authority_predecessor_blob_pins_required === true, "T4R1_GOV_BOUNDARY_PINS_REQUIRED");
  assert(boundary.live_result_subject_must_be_current_protected_main === true, "T4R1_GOV_BOUNDARY_CURRENT_MAIN_SUBJECT_REQUIRED");
  assert(boundary.exact_main_rerun_required_after_effectiveness === false, "T4R1_GOV_BOUNDARY_EXACT_RERUN_FORBIDDEN");
  assert(boundary.pr_head_authority_before_merge === false, "T4R1_GOV_BOUNDARY_PR_AUTHORITY_FORBIDDEN");
  assert(boundary.formal_site_rebind_authorized === false && boundary.ea5e2_operational_activation_qualified === false, "T4R1_GOV_NO_OPERATIONAL_EFFECT");
  assert(boundary.runtime_write_count === 0 && boundary.database_write_count === 0 && boundary.scheduler_write_count === 0 && boundary.formal_evidence_write_count === 0 && boundary.formal_execution_count === "0/24", "T4R1_GOV_ZERO_WRITES");

  const subjectIsCurrentMain = SUBJECT_SHA === currentMain;
  write({
    schema_version: "geox_mcft_cap09_t4r1_persistent_lifecycle_governance_v2",
    status: "PASS",
    base_sha: BASE_SHA,
    subject_sha: SUBJECT_SHA,
    current_protected_main_sha: currentMain,
    subject_is_current_protected_main: subjectIsCurrentMain,
    successor_chain_effectiveness_adjudicated: true,
    successor_chain_hop_count: chain.hop_count,
    authority_predecessor_blobs_pinned_on_current_protected_main: true,
    exact_main_rerun_required: false,
    post_merge_current_main_evaluation_required: !subjectIsCurrentMain,
    live_result_eligible_if_active_candidate: subjectIsCurrentMain,
    adoption_effect: subjectIsCurrentMain
      ? "CURRENT_PROTECTED_MAIN_LIVE_RESULT_ELIGIBLE_IF_ACTIVE_CANDIDATE"
      : "PR_QUALIFICATION_ONLY_POST_MERGE_CURRENT_MAIN_EVALUATION_REQUIRED",
    formal_rebind_authorized: false,
    production_runtime_start_authorized: false,
    production_owner_activation_authorized: false,
    formal_v5_authorized: false,
    a0_authorized: false,
    o00_o23_authorized: false,
    formal_execution_count: "0/24"
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_t4r1_persistent_lifecycle_governance_v2",
    status: "FAIL",
    base_sha: BASE_SHA || null,
    subject_sha: SUBJECT_SHA || null,
    authority_effect: "NONE",
    exact_main_rerun_required: false,
    formal_rebind_authorized: false,
    production_runtime_start_authorized: false,
    production_owner_activation_authorized: false,
    formal_v5_authorized: false,
    a0_authorized: false,
    o00_o23_authorized: false,
    formal_execution_count: "0/24",
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
}
