#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const fail = (m) => { throw new Error(m); };
const eq = (a, e, c) => { if (a !== e) fail(`${c}: expected=${JSON.stringify(e)} actual=${JSON.stringify(a)}`); };
const truthy = (v, c) => eq(v, true, c);
const falsy = (v, c) => eq(v, false, c);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, file) => git("rev-parse", `${ref}:${file}`);
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const base = process.env.MCFT_BASE_SHA;
eq(base, "92f22f74304443ca3a16417e76581e4605252a7f", "EA5D3_EXACT_BASE_REQUIRED");
const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D3-EA5D-CLOSURE-AUTHORITY-V1.json";
const workflowPath = ".github/workflows/mcft-cap-09-ea5d3-ea5d-closure.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5D3_EA5D_CLOSURE.cjs";
const expectedChanged = [authorityPath, workflowPath, gatePath].sort();
const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify(expectedChanged), "EA5D3_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C3-EA5C-CLOSURE-AUTHORITY-V1.json": "f795a295dc241f565a595589eb94706d096f26ca",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D1-EXTERNAL-BOOTSTRAP-PERSISTENCE-QUALIFICATION-V1.json": "8bf52b4a18874f9201340528b727d7f74742b638",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D2-FORMAL-BOOTSTRAP-LIVE-PERSISTENCE-V1.json": "53136ebc4d884f3e20de033bd0ae0ae413e9be2b",
  "apps/server/src/domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.ts": "1671b13df81cba53f966a6f06765198d160601d7",
  "apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.ts": "6c94bef139f260ef61c87f751a2c627b83e58977",
  "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts": "1cc2726aace39524e84fda9762f86a3fc2e96408",
  "apps/server/src/external_evidence/formal_durable_raw_store_binding_v1.ts": "c2babdf8cee6b2e9702c6923eab8a739a40001a5"
};
for (const [file, expected] of Object.entries(predecessorPins)) {
  eq(blob(base, file), expected, `EA5D3_BASE_BLOB_PIN_MISMATCH:${file}`);
  eq(blob("HEAD", file), expected, `EA5D3_PREDECESSOR_MUTATED:${file}`);
}
eq(blob("HEAD", authorityPath), "ad6708fb4fa884a2c61c3401338a7a3eb5cb34d0", "EA5D3_AUTHORITY_CANDIDATE_BLOB_MISMATCH");

const c = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C3-EA5C-CLOSURE-AUTHORITY-V1.json");
truthy(c.success_effect_if_merged_to_protected_main.ea5d_authorized, "EA5D3_EA5D_AUTHORIZATION_REQUIRED");
falsy(c.success_effect_if_merged_to_protected_main.ea5e_authorized, "EA5D3_EA5E_MUST_NOT_PREEXIST");
const d1 = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D1-EXTERNAL-BOOTSTRAP-PERSISTENCE-QUALIFICATION-V1.json");
truthy(d1.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5d1_external_bootstrap_persistence_implementation_qualified, "EA5D3_EA5D1_QUALIFICATION_REQUIRED");
const d2 = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D2-FORMAL-BOOTSTRAP-LIVE-PERSISTENCE-V1.json");
truthy(d2.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5d2_formal_bootstrap_live_persistence_effective, "EA5D3_EA5D2_EFFECT_REQUIRED");
truthy(d2.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_neon_bootstrap_persisted, "EA5D3_FORMAL_BOOTSTRAP_REQUIRED");
truthy(d2.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_24_config_chain_persisted, "EA5D3_CONFIG_CHAIN_REQUIRED");
falsy(d2.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5d_complete, "EA5D3_EA5D2_MUST_NOT_SELF_CLOSE_EA5D");
eq(d2.next_legal_successor_if_effective, "S6-EA5D3-EA5D-CLOSURE-AND-EA5E-AUTHORIZATION", "EA5D3_LEGAL_FRONTIER_REQUIRED");

const authority = json(authorityPath);
eq(authority.base_main_sha, base, "EA5D3_AUTHORITY_BASE_MISMATCH");
eq(authority.frontier_id, "S6-EA5D3-EA5D-CLOSURE-AND-EA5E-AUTHORIZATION", "EA5D3_FRONTIER_MISMATCH");
eq(authority.record_status, "EA5D_CLOSURE_CANDIDATE_NOT_EFFECTIVE", "EA5D3_RECORD_STATUS_MISMATCH");
eq(authority.ea5d2_merge_authority.pr_number, 3025, "EA5D3_PR_NUMBER_REQUIRED");
eq(authority.ea5d2_merge_authority.merged_head_sha, "214c1ff2b3f5f8b2dccc1073a87add477632a542", "EA5D3_MERGED_HEAD_REQUIRED");
eq(authority.ea5d2_merge_authority.merge_commit_sha, base, "EA5D3_MERGE_SHA_REQUIRED");

const first = authority.formal_proof_chain.first_live_bootstrap_write;
eq(first.workflow_run_id, 31334304326, "EA5D3_FIRST_RUN_REQUIRED");
eq(first.artifact_id, 9044245246, "EA5D3_FIRST_ARTIFACT_REQUIRED");
eq(first.artifact_digest, "sha256:f85b6c50ed1c675fcfa38af187f98fbf12da31a623bda44b96f59d60e5f69401", "EA5D3_FIRST_ARTIFACT_DIGEST_REQUIRED");
eq(first.required_execution_mode, "FIRST_FORMAL_BOOTSTRAP_AFTER_FRESH_COLLECTION", "EA5D3_FIRST_EXECUTION_MODE_REQUIRED");
eq(first.required_fresh_external_evidence_write_count, 1, "EA5D3_FIRST_EVIDENCE_WRITE_REQUIRED");
eq(first.required_canonical_bootstrap_write_count, 34, "EA5D3_FIRST_BOOTSTRAP_WRITE_REQUIRED");
const final = authority.formal_proof_chain.final_exact_head_reverification;
eq(final.workflow_run_id, 31350361419, "EA5D3_FINAL_RUN_REQUIRED");
eq(final.workflow_head_sha, "214c1ff2b3f5f8b2dccc1073a87add477632a542", "EA5D3_FINAL_EXACT_HEAD_REQUIRED");
eq(final.artifact_id, 9048721860, "EA5D3_FINAL_ARTIFACT_REQUIRED");
eq(final.artifact_digest, "sha256:6cf5eea24341fdcd515835eba49787576660860ef44fef6fe6c6d7ffdb3dbb3a", "EA5D3_FINAL_ARTIFACT_DIGEST_REQUIRED");
eq(final.required_execution_mode, "EXISTING_FORMAL_BOOTSTRAP_REVERIFIED", "EA5D3_FINAL_REVERIFY_MODE_REQUIRED");
eq(final.required_fresh_external_evidence_write_count, 0, "EA5D3_FINAL_EVIDENCE_ZERO_WRITE_REQUIRED");
eq(final.required_canonical_bootstrap_write_count, 0, "EA5D3_FINAL_BOOTSTRAP_ZERO_WRITE_REQUIRED");

const inv = authority.formal_database_closure_invariants;
eq(inv.database_name, "geox_mcft_cap09_s6_formal_24h", "EA5D3_DATABASE_REQUIRED");
eq(inv.exact_scope_fact_count, 36, "EA5D3_36_SCOPE_FACTS_REQUIRED");
eq(inv.exact_external_soil_evidence_fact_count, 2, "EA5D3_TWO_SOIL_FACTS_REQUIRED");
eq(inv.exact_canonical_twin_fact_count, 34, "EA5D3_34_CANONICAL_FACTS_REQUIRED");
eq(inv.exact_runtime_config_count, 25, "EA5D3_25_CONFIGS_REQUIRED");
eq(inv.exact_hourly_runtime_config_count, 24, "EA5D3_24_HOURLY_CONFIGS_REQUIRED");
eq(inv.external_a0_non_config_member_count, 9, "EA5D3_NINE_A0_MEMBERS_REQUIRED");
eq(inv.bootstrap_logical_time, "2026-08-09T21:00:00.000Z", "EA5D3_BOOTSTRAP_TIME_REQUIRED");
eq(inv.o00_config_logical_time, "2026-08-09T22:00:00.000Z", "EA5D3_O00_CONFIG_TIME_REQUIRED");
eq(inv.config_selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY", "EA5D3_EXPLICIT_PIN_REQUIRED");
eq(inv.runtime_mode, "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY", "EA5D3_RUNTIME_MODE_REQUIRED");
eq(inv.scheduler_slot_count, 0, "EA5D3_ZERO_SCHEDULER_SLOTS_REQUIRED");
eq(inv.scheduler_cursor_count, 0, "EA5D3_ZERO_SCHEDULER_CURSORS_REQUIRED");
eq(inv.foreign_scope_relevant_fact_count, 0, "EA5D3_ZERO_FOREIGN_SCOPE_REQUIRED");
eq(inv.forbidden_c8_replay_200mm_marker_fact_count, 0, "EA5D3_ZERO_FORBIDDEN_MARKERS_REQUIRED");

const findings = authority.ea5d_closure_findings;
truthy(findings.external_bootstrap_persistence_implementation_qualified, "EA5D3_IMPLEMENTATION_QUALIFIED_REQUIRED");
truthy(findings.fresh_a0_window_soil_evidence_persisted_before_bootstrap, "EA5D3_FRESH_A0_EVIDENCE_REQUIRED");
truthy(findings.persistent_private_raw_retention_bound, "EA5D3_RAW_RETENTION_REQUIRED");
truthy(findings.formal_neon_external_a0_bootstrap_persisted, "EA5D3_A0_PERSISTED_REQUIRED");
truthy(findings.formal_exact_24_hour_runtime_config_chain_persisted, "EA5D3_24_CONFIG_CHAIN_REQUIRED");
truthy(findings.a0_runtime_config_is_exact_parent_of_o00_config, "EA5D3_A0_PARENT_REQUIRED");
truthy(findings.all_hourly_runtime_config_parent_ref_hash_links_verified, "EA5D3_PARENT_CHAIN_REQUIRED");
truthy(findings.exact_head_idempotent_reverification_zero_write_proved, "EA5D3_IDEMPOTENT_REVERIFY_REQUIRED");
falsy(findings.scheduler_slot_or_cursor_created_by_ea5d, "EA5D3_SCHEDULER_WRITE_FORBIDDEN");
falsy(findings.formal_window_started, "EA5D3_WINDOW_MUST_REMAIN_UNSTARTED");
falsy(findings.formal_o00_executed, "EA5D3_O00_EXECUTION_FORBIDDEN");
falsy(findings.runtime_public_provider_fetch_authorized, "EA5D3_RUNTIME_INTERNET_FORBIDDEN");
falsy(findings.historical_c8_scope_allowed, "EA5D3_C8_FORBIDDEN");
falsy(findings.replay_truth_marker_allowed, "EA5D3_REPLAY_MARKER_FORBIDDEN");
falsy(findings.historical_200mm_operator_allowed, "EA5D3_200MM_OPERATOR_FORBIDDEN");
falsy(findings.recommendation_action_authorized, "EA5D3_ACTION_FORBIDDEN");

const effect = authority.success_effect_if_merged_to_protected_main;
truthy(effect.ea5d_complete, "EA5D3_EA5D_COMPLETE_EFFECT_REQUIRED");
truthy(effect.formal_neon_bootstrap_persisted, "EA5D3_BOOTSTRAP_EFFECT_REQUIRED");
truthy(effect.formal_24_config_chain_persisted, "EA5D3_CONFIG_CHAIN_EFFECT_REQUIRED");
truthy(effect.ea5e_authorized, "EA5D3_EA5E_AUTHORIZATION_REQUIRED");
truthy(effect.ea5e_post_bootstrap_preflight_candidate_authorized, "EA5D3_EA5E_PREFLIGHT_AUTH_REQUIRED");
truthy(effect.ea5e_formal_window_input_manifest_candidate_authorized, "EA5D3_EA5E_MANIFEST_AUTH_REQUIRED");
truthy(effect.ea5e_collector_runtime_schedule_readiness_candidate_authorized, "EA5D3_EA5E_SCHEDULE_AUTH_REQUIRED");
truthy(effect.ea5e_formal_authority_v3_candidate_authorized, "EA5D3_AUTHORITY_V3_AUTH_REQUIRED");
falsy(effect.ea5e_complete, "EA5D3_EA5E_COMPLETION_PREMATURE");
falsy(effect.external_package_formal_eligible, "EA5D3_EXTERNAL_PACKAGE_ELIGIBILITY_PREMATURE");
falsy(effect.formal_o00_start_authorized, "EA5D3_O00_AUTH_PREMATURE");
falsy(effect.formal_window_started, "EA5D3_WINDOW_START_PREMATURE");
falsy(effect.commercial_closed_loop_connected, "EA5D3_COMMERCIAL_LOOP_FORBIDDEN");
falsy(effect.mcft_cap09_completed, "EA5D3_CAP09_COMPLETION_PREMATURE");
eq(authority.next_legal_successor_if_effective, "S6-EA5E-POST-BOOTSTRAP-PREFLIGHT-MANIFEST-SCHEDULE-READINESS-AND-FORMAL-AUTHORITY-V3", "EA5D3_NEXT_FRONTIER_REQUIRED");

for (const [name, value] of Object.entries(authority.closure_side_effect_boundary)) eq(value, 0, `EA5D3_CLOSURE_SIDE_EFFECT_MUST_BE_ZERO:${name}`);

const workflow = fs.readFileSync(workflowPath, "utf8");
if (workflow.includes("pull_request_target")) fail("EA5D3_PULL_REQUEST_TARGET_FORBIDDEN");
for (const marker of [
  "GEOX_MCFT_CAP09_S6_DATABASE_URL: ${{ secrets.GEOX_MCFT_CAP09_S6_DATABASE_URL }}",
  "31334304326",
  "9044245246",
  "31350361419",
  "9048721860",
  "92f22f74304443ca3a16417e76581e4605252a7f",
  "214c1ff2b3f5f8b2dccc1073a87add477632a542",
  "FIRST_FORMAL_BOOTSTRAP_AFTER_FRESH_COLLECTION",
  "EXISTING_FORMAL_BOOTSTRAP_REVERIFIED",
  "BEGIN TRANSACTION READ ONLY",
  "twin_shadow_online_scheduler_slot_v1",
  "twin_shadow_online_scheduler_cursor_v1",
  "EXPLICIT_REF_HASH_PIN_ONLY",
  "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY",
  "formal_o00_start_authorized !== false"
]) if (!workflow.includes(marker)) fail(`EA5D3_WORKFLOW_MARKER_MISSING:${marker}`);
if (/\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(workflow)) fail("EA5D3_DATABASE_WRITE_SQL_FORBIDDEN");
if (workflow.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY") || workflow.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID")) fail("EA5D3_RAW_STORE_CREDENTIAL_BINDING_FORBIDDEN");

const result = {
  schema_version: "geox_mcft_cap09_ea5d3_ea5d_closure_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  ea5d2_merge_and_proof_chain_pinned: true,
  closure_database_write_count: 0,
  closure_raw_object_write_count: 0,
  closure_provider_request_count: 0,
  ea5d_complete_after_effectiveness: true,
  ea5e_authorized_after_effectiveness: true,
  ea5e_complete: false,
  external_package_formal_eligible: false,
  formal_o00_start_authorized: false,
  formal_window_started: false,
  mcft_cap09_completed: false
};
fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5D3_EA5D_CLOSURE_GOVERNANCE_RESULT.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
