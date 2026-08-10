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
eq(base, "11d5e78caa0f54541cc0d6d4daa4e3c98b473d24", "EA5D2_EXACT_BASE_REQUIRED");
const runnerPath = "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_EA5D2_FORMAL_BOOTSTRAP_LIVE_PERSISTENCE.ts";
const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D2-FORMAL-BOOTSTRAP-LIVE-PERSISTENCE-V1.json";
const workflowPath = ".github/workflows/mcft-cap-09-ea5d2-formal-bootstrap-live-persistence.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5D2_FORMAL_BOOTSTRAP_LIVE_PERSISTENCE.cjs";
const expectedChanged = [runnerPath, authorityPath, workflowPath, gatePath].sort();
const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify(expectedChanged), "EA5D2_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C3-EA5C-CLOSURE-AUTHORITY-V1.json": "f795a295dc241f565a595589eb94706d096f26ca",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D1-EXTERNAL-BOOTSTRAP-PERSISTENCE-QUALIFICATION-V1.json": "8bf52b4a18874f9201340528b727d7f74742b638",
  "apps/server/src/domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.ts": "1671b13df81cba53f966a6f06765198d160601d7",
  "apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.ts": "6c94bef139f260ef61c87f751a2c627b83e58977",
  "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts": "1cc2726aace39524e84fda9762f86a3fc2e96408",
  "apps/server/src/external_evidence/formal_durable_raw_store_binding_v1.ts": "c2babdf8cee6b2e9702c6923eab8a739a40001a5"
};
for (const [file, expected] of Object.entries(predecessorPins)) {
  eq(blob(base, file), expected, `EA5D2_BASE_BLOB_PIN_MISMATCH:${file}`);
  eq(blob("HEAD", file), expected, `EA5D2_PREDECESSOR_MUTATED:${file}`);
}
const candidatePins = {
  [runnerPath]: "47082b3a9ce3df10e8186e62fa4d208ab76690a9",
  [authorityPath]: "53136ebc4d884f3e20de033bd0ae0ae413e9be2b",
  [workflowPath]: "2114fe87ce03d7e9e8864d9ac2fcf3b1d4ea79a7"
};
for (const [file, expected] of Object.entries(candidatePins)) eq(blob("HEAD", file), expected, `EA5D2_CANDIDATE_BLOB_PIN_MISMATCH:${file}`);

const closure = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C3-EA5C-CLOSURE-AUTHORITY-V1.json");
truthy(closure.success_effect_if_merged_to_protected_main.ea5d_authorized, "EA5D2_EA5D_AUTHORIZATION_REQUIRED");
const d1 = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D1-EXTERNAL-BOOTSTRAP-PERSISTENCE-QUALIFICATION-V1.json");
truthy(d1.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5d1_external_bootstrap_persistence_implementation_qualified, "EA5D2_EA5D1_REQUIRED");
falsy(d1.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5d_complete, "EA5D2_D1_MUST_NOT_SELF_CLOSE_EA5D");
eq(d1.next_legal_successor_if_effective, "S6-EA5D2-FORMAL-BOOTSTRAP-AND-24-CONFIG-CHAIN-LIVE-PERSISTENCE", "EA5D2_LEGAL_FRONTIER_REQUIRED");

const authority = json(authorityPath);
eq(authority.base_main_sha, base, "EA5D2_AUTHORITY_BASE_MISMATCH");
eq(authority.frontier_id, "S6-EA5D2-FORMAL-BOOTSTRAP-AND-24-CONFIG-CHAIN-LIVE-PERSISTENCE", "EA5D2_FRONTIER_MISMATCH");
eq(authority.frozen_time_authority.bootstrap_logical_time, "2026-08-09T21:00:00.000Z", "EA5D2_BOOTSTRAP_BOUNDARY_REQUIRED");
eq(authority.frozen_time_authority.o00_logical_time, "2026-08-09T22:00:00.000Z", "EA5D2_O00_BOUNDARY_REQUIRED");
eq(authority.frozen_time_authority.evidence_window_start_exclusive, "2026-08-09T20:00:00.000Z", "EA5D2_WINDOW_START_REQUIRED");
truthy(authority.frozen_time_authority.bootstrap_must_not_execute_before_wall_clock_boundary, "EA5D2_ACTUAL_CLOCK_REQUIRED");
falsy(authority.frozen_time_authority.future_boundary_claim_allowed, "EA5D2_FUTURE_BOUNDARY_CLAIM_FORBIDDEN");
falsy(authority.frozen_time_authority.accelerated_or_replay_clock_allowed, "EA5D2_ACCELERATED_CLOCK_FORBIDDEN");
eq(authority.fresh_evidence_authority.binding_id, "kbs_lter_variate25_vwc_100mm_v1", "EA5D2_SOIL_BINDING_REQUIRED");
eq(authority.fresh_evidence_authority.maximum_new_evidence_facts, 1, "EA5D2_MAX_ONE_NEW_EVIDENCE_REQUIRED");
truthy(authority.fresh_evidence_authority.crash_recovery_may_reuse_existing_fresh_authorized_evidence, "EA5D2_CRASH_RECOVERY_REQUIRED");
falsy(authority.fresh_evidence_authority.crash_recovery_may_append_second_fresh_evidence, "EA5D2_DOUBLE_FRESH_APPEND_FORBIDDEN");
eq(authority.formal_bootstrap_persistence_authority.exact_hourly_runtime_config_count, 24, "EA5D2_24_CONFIG_REQUIRED");
eq(authority.formal_bootstrap_persistence_authority.exact_total_runtime_config_count, 25, "EA5D2_25_CONFIG_REQUIRED");
eq(authority.formal_bootstrap_persistence_authority.exact_canonical_twin_fact_count, 34, "EA5D2_34_CANONICAL_REQUIRED");
truthy(authority.formal_bootstrap_persistence_authority.a0_config_is_exact_parent_of_o00_config, "EA5D2_A0_PARENT_O00_REQUIRED");
truthy(authority.formal_bootstrap_persistence_authority.each_hourly_config_parent_ref_hash_must_match_predecessor, "EA5D2_CONFIG_PARENT_CHAIN_REQUIRED");
eq(authority.formal_bootstrap_persistence_authority.config_selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY", "EA5D2_EXPLICIT_PIN_REQUIRED");
falsy(authority.formal_bootstrap_persistence_authority.formal_window_started, "EA5D2_WINDOW_START_FORBIDDEN");
const effect = authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
truthy(effect.ea5d2_formal_bootstrap_live_persistence_effective, "EA5D2_EFFECT_REQUIRED");
truthy(effect.formal_neon_bootstrap_persisted, "EA5D2_FORMAL_BOOTSTRAP_EFFECT_REQUIRED");
truthy(effect.formal_24_config_chain_persisted, "EA5D2_FORMAL_CHAIN_EFFECT_REQUIRED");
falsy(effect.ea5d_complete, "EA5D2_EA5D_CLOSURE_STILL_REQUIRED");
falsy(effect.ea5e_authorized, "EA5D2_EA5E_PREMATURE");
falsy(effect.formal_o00_start_authorized, "EA5D2_O00_PREMATURE");
falsy(effect.formal_window_started, "EA5D2_WINDOW_PREMATURE");
falsy(effect.mcft_cap09_completed, "EA5D2_CAP09_PREMATURE");
eq(authority.next_legal_successor_if_effective, "S6-EA5D3-EA5D-CLOSURE-AND-EA5E-AUTHORIZATION", "EA5D2_NEXT_FRONTIER_REQUIRED");

const runner = fs.readFileSync(runnerPath, "utf8");
for (const marker of [
  'BOOTSTRAP_LOGICAL_TIME = "2026-08-09T21:00:00.000Z"',
  'O00_LOGICAL_TIME = "2026-08-09T22:00:00.000Z"',
  'EVIDENCE_WINDOW_START = "2026-08-09T20:00:00.000Z"',
  "executeFormalLiveKbsSoilIngressV1",
  "waitForBootstrapBoundaryV1",
  "deriveCropStageAtBootstrapV1",
  "RECOVER_FORMAL_BOOTSTRAP_FROM_EXISTING_FRESH_EVIDENCE",
  "validateAuthorizedSoilEvidenceSetV1",
  "formal_neon_bootstrap_persisted: true",
  "formal_24_config_chain_persisted: true",
  "formal_window_started: false"
]) if (!runner.includes(marker)) fail(`EA5D2_RUNNER_MARKER_MISSING:${marker}`);
if (runner.includes('"runtime_mode":"REPLAY"') || runner.includes("field_c8_demo") || runner.includes("POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1")) fail("EA5D2_REPLAY_C8_200MM_FORBIDDEN");

const requiredSecrets = authority.required_github_actions_secrets;
const workflow = fs.readFileSync(workflowPath, "utf8");
if (workflow.includes("pull_request_target")) fail("EA5D2_PULL_REQUEST_TARGET_FORBIDDEN");
for (const secret of requiredSecrets) if (!workflow.includes(`${secret}: \${{ secrets.${secret} }}`)) fail(`EA5D2_SECRET_BINDING_MISSING:${secret}`);
for (const marker of [
  "EXECUTE_MCFT_CAP_09_EA5D2_FORMAL_BOOTSTRAP_LIVE_PERSISTENCE.ts",
  "timeout-minutes: 90",
  "formal_neon_bootstrap_persisted !== true",
  "formal_24_config_chain_persisted !== true",
  "formal_o00_start_authorized !== false"
]) if (!workflow.includes(marker)) fail(`EA5D2_WORKFLOW_MARKER_MISSING:${marker}`);

const result = {
  schema_version: "geox_mcft_cap09_ea5d2_formal_bootstrap_live_persistence_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  candidate_blobs_verified: true,
  actual_utc_bootstrap_boundary_required: true,
  crash_safe_fresh_evidence_recovery_required: true,
  maximum_new_external_evidence_facts: 1,
  exact_canonical_twin_fact_count: 34,
  exact_runtime_config_count: 25,
  exact_hourly_runtime_config_count: 24,
  formal_neon_bootstrap_persisted_after_live_proof: true,
  formal_24_config_chain_persisted_after_live_proof: true,
  ea5d_complete: false,
  ea5e_authorized: false,
  formal_o00_start_authorized: false,
  formal_window_started: false,
  mcft_cap09_completed: false
};
fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5D2_FORMAL_BOOTSTRAP_LIVE_PERSISTENCE_GOVERNANCE_RESULT.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
