#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

function fail(message) { throw new Error(message); }
function eq(actual, expected, code) { if (actual !== expected) fail(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
function truthy(value, code) { if (value !== true) fail(`${code}: expected true`); }
function falsy(value, code) { if (value !== false) fail(`${code}: expected false`); }
function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function blob(ref, file) { return git("rev-parse", `${ref}:${file}`); }
function json(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }

const base = process.env.MCFT_BASE_SHA;
if (!base) fail("EA5C3_BASE_SHA_REQUIRED");
eq(base, "aed820436de59d757e4665b92464346aae59af9e", "EA5C3_EXACT_BASE_REQUIRED");

const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C3-EA5C-CLOSURE-AUTHORITY-V1.json";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C3_EA5C_CLOSURE.cjs";
const workflowPath = ".github/workflows/mcft-cap-09-ea5c3-ea5c-closure.yml";
const expectedChanged = [authorityPath, gatePath, workflowPath].sort();
const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify(expectedChanged), "EA5C3_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-STATUS.json": "be8a80345e004cf33d3993b0e26dcea01fc6644b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B-CLOSURE-AUTHORITY-V1.json": "6377a4c5c9a587b24bfccea913bf9ebe7e8ddca2",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C1-DURABLE-RAW-RESTRICTED-INGRESS-V1.json": "110a75ea7e6d8357b4a9d26941dcf3f70a115276",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2A-FORMAL-RAW-STORE-BINDING-CONTRACT-V1.json": "ca6ee5ae9de135e21cb4e3b77a8fa170b5364812",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2B1-LIVE-KBS-SOIL-INGRESS-EXECUTOR-V1.json": "1c4eea0e8d3d8efeb2d6f6f3b606a17ae4abe701",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2B2-FORMAL-LIVE-INGRESS-PROOF-V1.json": "9d60303dfe46389aedadd4a63f7223da996c173d",
  "apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts": "dfa2c10266a5079842012426aed175851d30ca44",
  "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts": "6f7b6450d4f671c75affc2c7aba45ed71cb518c5",
  "apps/server/src/external_evidence/formal_durable_raw_store_binding_v1.ts": "c2babdf8cee6b2e9702c6923eab8a739a40001a5",
  "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts": "1cc2726aace39524e84fda9762f86a3fc2e96408",
  "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_EA5C2B2_FORMAL_LIVE_INGRESS.ts": "43c4edba5a52c6fa92d41fc148244009b46909a1"
};
for (const [file, expected] of Object.entries(predecessorPins)) {
  eq(blob(base, file), expected, `EA5C3_BASE_BLOB_PIN_MISMATCH:${file}`);
  eq(blob("HEAD", file), expected, `EA5C3_PREDECESSOR_MUTATED:${file}`);
}

const candidatePins = {
  [authorityPath]: "f795a295dc241f565a595589eb94706d096f26ca",
  [workflowPath]: "a82492460e0545caac228856ac009a2d35ed68a1"
};
for (const [file, expected] of Object.entries(candidatePins)) {
  eq(blob("HEAD", file), expected, `EA5C3_CANDIDATE_BLOB_PIN_MISMATCH:${file}`);
}

const amendment = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md", "utf8");
for (const marker of [
  "EA5C** — durable raw retention + restricted canonical External Evidence ingress",
  "EA5D** — External canonical bootstrap config + A0 bootstrap + 24-config chain persistence",
  "EA5E** — post-bootstrap DB preflight + Formal Window Input Manifest + collector/runtime schedule readiness + Formal Authority V3 effectiveness",
  "Only after EA5E is effective may O00 be enabled."
]) if (!amendment.includes(marker)) fail(`EA5C3_AMENDMENT_SEQUENCE_MISSING:${marker}`);

const ea5b = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B-CLOSURE-AUTHORITY-V1.json");
truthy(ea5b.success_effect_if_merged_to_protected_main.ea5c_authorized, "EA5C3_EA5C_MUST_ALREADY_BE_AUTHORIZED");
falsy(ea5b.success_effect_if_merged_to_protected_main.ea5d_authorized, "EA5C3_EA5B_MUST_NOT_PREAUTHORIZE_EA5D");

const ea5c1 = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C1-DURABLE-RAW-RESTRICTED-INGRESS-V1.json");
truthy(ea5c1.effect_if_merged_to_protected_main.ea5c1_implementation_qualified, "EA5C3_EA5C1_IMPLEMENTATION_REQUIRED");
eq(Object.keys(ea5c1.restricted_ingress_authority.record_type_binding_epistemic_profile).length, 5, "EA5C3_FIVE_INGRESS_FAMILIES_REQUIRED");
falsy(ea5c1.effect_if_merged_to_protected_main.ea5c_complete, "EA5C3_EA5C1_MUST_NOT_SELF_CLOSE_EA5C");

const ea5c2a = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2A-FORMAL-RAW-STORE-BINDING-CONTRACT-V1.json");
truthy(ea5c2a.effect_if_merged_to_protected_main.ea5c2a_binding_contract_qualified, "EA5C3_BINDING_CONTRACT_REQUIRED");
eq(ea5c2a.binding_contract.bucket, "geox-mcft-cap09-formal-raw-v1", "EA5C3_EXACT_FORMAL_BUCKET_REQUIRED");
falsy(ea5c2a.binding_contract.local_or_ci_fallback_allowed, "EA5C3_LOCAL_OR_CI_FORMAL_FALLBACK_FORBIDDEN");

const ea5c2b1 = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2B1-LIVE-KBS-SOIL-INGRESS-EXECUTOR-V1.json");
truthy(ea5c2b1.effect_if_merged_to_protected_main.ea5c2b1_live_kbs_soil_executor_qualified, "EA5C3_LIVE_EXECUTOR_REQUIRED");
eq(ea5c2b1.live_source_contract.binding_id, "kbs_lter_variate25_vwc_100mm_v1", "EA5C3_SOIL_BINDING_REQUIRED");
eq(ea5c2b1.live_source_contract.observation_operator_id, "POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1", "EA5C3_100MM_OPERATOR_REQUIRED");
falsy(ea5c2b1.live_source_contract.direct_field_equivalence, "EA5C3_DIRECT_FIELD_EQUIVALENCE_FORBIDDEN");
falsy(ea5c2b1.live_source_contract.direct_root_zone_equivalence, "EA5C3_DIRECT_ROOT_ZONE_EQUIVALENCE_FORBIDDEN");

const ea5c2b2 = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2B2-FORMAL-LIVE-INGRESS-PROOF-V1.json");
truthy(ea5c2b2.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.persistent_formal_24h_raw_store_bound, "EA5C3_PERSISTENT_FORMAL_STORE_PREDECESSOR_REQUIRED");
truthy(ea5c2b2.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_neon_live_ingress_proved, "EA5C3_FORMAL_NEON_LIVE_INGRESS_PREDECESSOR_REQUIRED");
truthy(ea5c2b2.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5c2b_live_formal_proof_complete, "EA5C3_EA5C2B_LIVE_PROOF_REQUIRED");
falsy(ea5c2b2.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5c_complete, "EA5C3_B2_MUST_REQUIRE_CLOSURE");
eq(ea5c2b2.next_candidate_frontier_if_effective, "S6-EA5C3-EA5C-CLOSURE-AND-EA5D-AUTHORIZATION", "EA5C3_LEGAL_FRONTIER_REQUIRED");

const authority = json(authorityPath);
eq(authority.base_main_sha, base, "EA5C3_AUTHORITY_BASE_MISMATCH");
eq(authority.frontier_id, "S6-EA5C3-EA5C-CLOSURE-AND-EA5D-AUTHORIZATION", "EA5C3_AUTHORITY_FRONTIER_MISMATCH");
eq(authority.record_status, "EA5C_CLOSURE_CANDIDATE_NOT_EFFECTIVE", "EA5C3_CANDIDATE_STATUS_REQUIRED");

const proof = authority.formal_proof_chain;
eq(proof.pr_number, 3022, "EA5C3_PROOF_PR_REQUIRED");
truthy(proof.merged, "EA5C3_PROOF_PR_MERGED_REQUIRED");
eq(proof.merged_head_sha, "50daa06971ef4afc752bbd3fc9dc5c76d9e0222a", "EA5C3_MERGED_HEAD_REQUIRED");
eq(proof.merge_commit_sha, base, "EA5C3_PROOF_MERGE_BASE_REQUIRED");
eq(proof.first_live_insert_run.workflow_run_id, 31329952830, "EA5C3_FIRST_RUN_ID_REQUIRED");
eq(proof.first_live_insert_run.workflow_head_sha, "66ebfe393d233f1122cc9eb799cbc49d82efe3d6", "EA5C3_FIRST_RUN_HEAD_REQUIRED");
eq(proof.first_live_insert_run.artifact_id, 9042626960, "EA5C3_FIRST_ARTIFACT_ID_REQUIRED");
eq(proof.first_live_insert_run.artifact_digest, "sha256:64a0ce83f6fe9995a81eeb7e7fc57cbcb7b75e90759c87970ec8a799d00916ac", "EA5C3_FIRST_ARTIFACT_DIGEST_REQUIRED");
eq(proof.first_live_insert_run.required_execution_mode, "FIRST_LIVE_INSERT", "EA5C3_FIRST_EXECUTION_MODE_REQUIRED");
eq(proof.first_live_insert_run.required_canonical_fact_write_count, 1, "EA5C3_FIRST_ONE_WRITE_REQUIRED");
eq(proof.final_exact_head_reverification_run.workflow_run_id, 31330168165, "EA5C3_FINAL_RUN_ID_REQUIRED");
eq(proof.final_exact_head_reverification_run.workflow_head_sha, "50daa06971ef4afc752bbd3fc9dc5c76d9e0222a", "EA5C3_FINAL_RUN_HEAD_REQUIRED");
eq(proof.final_exact_head_reverification_run.artifact_id, 9042689795, "EA5C3_FINAL_ARTIFACT_ID_REQUIRED");
eq(proof.final_exact_head_reverification_run.artifact_digest, "sha256:daa44a4cfc5705255fd0f6e0654dd7214abedb860459bc162778c52432604d23", "EA5C3_FINAL_ARTIFACT_DIGEST_REQUIRED");
eq(proof.final_exact_head_reverification_run.required_execution_mode, "EXISTING_PROOF_REVERIFIED", "EA5C3_FINAL_REVERIFICATION_MODE_REQUIRED");
eq(proof.final_exact_head_reverification_run.required_canonical_fact_write_count, 0, "EA5C3_FINAL_ZERO_WRITE_REQUIRED");

const findings = authority.ea5c_closure_findings;
for (const [key, value] of Object.entries({
  durable_private_hash_addressed_raw_retention_implementation_qualified: true,
  restricted_exact_scope_canonical_external_evidence_ingress_implementation_qualified: true,
  five_binding_and_epistemic_profile_enforced_by_restricted_ingress: true,
  persistent_formal_remote_private_store_binding_proved: true,
  authenticated_raw_object_reverification_proved: true,
  anonymous_raw_object_access_denial_proved: true,
  raw_retention_before_decode_proved: true,
  live_external_kbs_soil_collection_proved: true,
  formal_neon_exact_scope_append_proved: true,
  formal_neon_single_proof_retry_idempotency_proved: true
})) eq(findings[key], value, `EA5C3_CLOSURE_FINDING_REQUIRED:${key}`);
falsy(findings.raw_payload_embedded_in_formal_fact, "EA5C3_RAW_PAYLOAD_EMBEDDING_FORBIDDEN");
eq(findings.public_raw_value_emission_count, 0, "EA5C3_PUBLIC_RAW_VALUE_FORBIDDEN");
eq(findings.runtime_public_provider_fetch_count, 0, "EA5C3_RUNTIME_PROVIDER_FETCH_FORBIDDEN");
falsy(findings.historical_c8_scope_allowed, "EA5C3_C8_SCOPE_FORBIDDEN");
falsy(findings.replay_truth_marker_allowed, "EA5C3_REPLAY_TRUTH_FORBIDDEN");
falsy(findings.commercial_operation_evidence_authorized, "EA5C3_COMMERCIAL_EVIDENCE_FORBIDDEN");
falsy(findings.recommendation_action_authorized, "EA5C3_RECOMMENDATION_ACTION_FORBIDDEN");

const effect = authority.success_effect_if_merged_to_protected_main;
truthy(effect.ea5c_complete, "EA5C3_EA5C_COMPLETE_EFFECT_REQUIRED");
truthy(effect.durable_raw_retention_effective_for_external_formal_ingress, "EA5C3_RAW_RETENTION_EFFECT_REQUIRED");
truthy(effect.restricted_canonical_external_evidence_ingress_effective, "EA5C3_RESTRICTED_INGRESS_EFFECT_REQUIRED");
truthy(effect.persistent_formal_24h_raw_store_bound, "EA5C3_FORMAL_STORE_EFFECT_REQUIRED");
truthy(effect.formal_neon_live_ingress_proved, "EA5C3_FORMAL_NEON_EFFECT_REQUIRED");
truthy(effect.ea5d_authorized, "EA5C3_EA5D_AUTHORIZATION_REQUIRED");
truthy(effect.ea5d_external_bootstrap_persistence_candidate_authorized, "EA5C3_EA5D_BOOTSTRAP_CANDIDATE_REQUIRED");
falsy(effect.ea5e_authorized, "EA5C3_EA5E_PREMATURE");
falsy(effect.external_package_formal_eligible, "EA5C3_PACKAGE_FORMAL_ELIGIBILITY_PREMATURE");
falsy(effect.formal_o00_start_authorized, "EA5C3_O00_PREMATURE");
falsy(effect.formal_window_started, "EA5C3_FORMAL_WINDOW_PREMATURE");
falsy(effect.commercial_closed_loop_connected, "EA5C3_COMMERCIAL_LOOP_PREMATURE");
falsy(effect.mcft_cap09_completed, "EA5C3_CAP09_PREMATURE");

eq(authority.next_legal_successor_if_effective, "S6-EA5D-EXTERNAL-CANONICAL-BOOTSTRAP-CONFIG-A0-AND-24-CONFIG-CHAIN-PERSISTENCE", "EA5C3_NEXT_FRONTIER_REQUIRED");

for (const [key, value] of Object.entries(authority.closure_side_effect_boundary)) {
  eq(value, 0, `EA5C3_CLOSURE_SIDE_EFFECT_MUST_BE_ZERO:${key}`);
}

const workflow = fs.readFileSync(workflowPath, "utf8");
if (workflow.includes("pull_request_target")) fail("EA5C3_PULL_REQUEST_TARGET_FORBIDDEN");
for (const marker of [
  "repos/${GITHUB_REPOSITORY}/pulls/3022",
  "31329952830",
  "9042626960",
  "sha256:64a0ce83f6fe9995a81eeb7e7fc57cbcb7b75e90759c87970ec8a799d00916ac",
  "FIRST_LIVE_INSERT",
  "31330168165",
  "9042689795",
  "sha256:daa44a4cfc5705255fd0f6e0654dd7214abedb860459bc162778c52432604d23",
  "EXISTING_PROOF_REVERIFIED",
  "MCFT_CAP_09_EA5C3_PROOF_CHAIN_VERIFICATION_RESULT.json",
  "ea5c_complete_after_closure_effectiveness: true",
  "ea5d_authorized_after_closure_effectiveness: true"
]) if (!workflow.includes(marker)) fail(`EA5C3_WORKFLOW_PROOF_MARKER_MISSING:${marker}`);
for (const forbidden of [
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY",
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
  "EXECUTE_MCFT_CAP_09_EA5C2B2_FORMAL_LIVE_INGRESS.ts",
  "lter.kbs.msu.edu/weather/variates/25"
]) if (workflow.includes(forbidden)) fail(`EA5C3_CLOSURE_RUNTIME_SIDE_EFFECT_PATH_FORBIDDEN:${forbidden}`);

const result = {
  schema_version: "geox_mcft_cap09_ea5c3_ea5c_closure_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  candidate_authority_and_workflow_blobs_verified: true,
  immutable_ea5c2b2_proof_chain_declared: true,
  first_live_insert_run_id: 31329952830,
  final_exact_head_reverification_run_id: 31330168165,
  closure_database_write_count: 0,
  closure_raw_object_write_count: 0,
  closure_provider_request_count: 0,
  ea5c_complete_after_effectiveness: true,
  ea5d_authorized_after_effectiveness: true,
  ea5e_authorized: false,
  external_package_formal_eligible: false,
  formal_o00_start_authorized: false,
  formal_window_started: false,
  commercial_closed_loop_connected: false,
  mcft_cap09_completed: false
};
fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5C3_EA5C_CLOSURE_GOVERNANCE_RESULT.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
