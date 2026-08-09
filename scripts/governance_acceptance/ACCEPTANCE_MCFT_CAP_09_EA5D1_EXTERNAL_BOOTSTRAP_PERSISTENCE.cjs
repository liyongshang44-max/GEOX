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
eq(base, "8dca58a7c103619ce6d0238c8812a52e91581717", "EA5D1_EXACT_BASE_REQUIRED");

const bundlePath = "apps/server/src/domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.ts";
const servicePath = "apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.ts";
const acceptancePath = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5D1_EXTERNAL_BOOTSTRAP_PERSISTENCE.ts";
const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D1-EXTERNAL-BOOTSTRAP-PERSISTENCE-QUALIFICATION-V1.json";
const workflowPath = ".github/workflows/mcft-cap-09-ea5d1-external-bootstrap-persistence-qualification.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5D1_EXTERNAL_BOOTSTRAP_PERSISTENCE.cjs";
const expectedChanged = [bundlePath, servicePath, acceptancePath, authorityPath, workflowPath, gatePath].sort();
const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify(expectedChanged), "EA5D1_EXACT_SIX_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C3-EA5C-CLOSURE-AUTHORITY-V1.json": "f795a295dc241f565a595589eb94706d096f26ca",
  "apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts": "f7ea03a7f8387ce4de135dac61f0b063e91f0f25",
  "apps/server/src/runtime/twin_runtime/external_formal_a0_evidence_window_service_v1.ts": "1a02cd7c39da8a17ebd161f487c7d2c3c7c704e1",
  "apps/server/src/runtime/twin_runtime/external_formal_a0_record_set_builder_v1.ts": "516c141cbb971d55635b500d2a99962116159588",
  "apps/server/src/runtime/twin_runtime/ports.ts": "9f62818498a645d554925dcf8569cdd19c0f1c34",
  "apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts": "9650d2875c6737714d22de7cc2b1d9229aea33a5",
  "apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts": "910e4852f2debd898fdd2ce8d5495a4cb364b6e4"
};
for (const [file, expected] of Object.entries(predecessorPins)) {
  eq(blob(base, file), expected, `EA5D1_BASE_BLOB_PIN_MISMATCH:${file}`);
  eq(blob("HEAD", file), expected, `EA5D1_PREDECESSOR_MUTATED:${file}`);
}

const candidatePins = {
  [bundlePath]: "1671b13df81cba53f966a6f06765198d160601d7",
  [servicePath]: "6c94bef139f260ef61c87f751a2c627b83e58977",
  [acceptancePath]: "c7e5cd00acaabd25c7dedfb3c0869988f70f8d8c",
  [authorityPath]: "8bf52b4a18874f9201340528b727d7f74742b638",
  [workflowPath]: "3f41beb187c64bd730465e09f55f9e05b6f79e46"
};
for (const [file, expected] of Object.entries(candidatePins)) {
  eq(blob("HEAD", file), expected, `EA5D1_CANDIDATE_BLOB_PIN_MISMATCH:${file}`);
}

const amendment = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md", "utf8");
for (const marker of [
  "External A0 bootstrap Runtime Config is the predecessor of O00 config",
  "each config `effective_logical_time` equals its slot logical time",
  "every ref and determinism hash is frozen before O00",
  "implicit “latest config” lookup is forbidden",
  "EA5D** — External canonical bootstrap config + A0 bootstrap + 24-config chain persistence",
  "Only after EA5E is effective may O00 be enabled."
]) if (!amendment.includes(marker)) fail(`EA5D1_AMENDMENT_REQUIREMENT_MISSING:${marker}`);

const closure = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C3-EA5C-CLOSURE-AUTHORITY-V1.json");
truthy(closure.success_effect_if_merged_to_protected_main.ea5c_complete, "EA5D1_EA5C_COMPLETE_REQUIRED");
truthy(closure.success_effect_if_merged_to_protected_main.ea5d_authorized, "EA5D1_EA5D_AUTHORIZATION_REQUIRED");
falsy(closure.success_effect_if_merged_to_protected_main.ea5e_authorized, "EA5D1_EA5E_MUST_REMAIN_UNAUTHORIZED");
falsy(closure.success_effect_if_merged_to_protected_main.formal_o00_start_authorized, "EA5D1_O00_MUST_REMAIN_UNAUTHORIZED");

const authority = json(authorityPath);
eq(authority.base_main_sha, base, "EA5D1_AUTHORITY_BASE_MISMATCH");
eq(authority.frontier_id, "S6-EA5D1-EXTERNAL-BOOTSTRAP-PERSISTENCE-IMPLEMENTATION-QUALIFICATION", "EA5D1_FRONTIER_MISMATCH");
eq(authority.candidate_implementation_blobs.external_formal_bootstrap_authority_bundle, candidatePins[bundlePath], "EA5D1_AUTHORITY_BUNDLE_PIN_MISMATCH");
eq(authority.candidate_implementation_blobs.external_formal_bootstrap_persistence_service, candidatePins[servicePath], "EA5D1_AUTHORITY_SERVICE_PIN_MISMATCH");
for (const key of [
  "exact_external_scope_only",
  "reality_binding_snapshot_materialized_from_external_authority",
  "external_a0_nine_member_graph_required",
  "crop_stage_derivation_authority_must_not_be_after_bootstrap_logical_time",
  "a0_config_is_exact_parent_of_o00_config",
  "each_hourly_config_is_exact_parent_of_successor"
]) truthy(authority.qualified_design[key], `EA5D1_DESIGN_REQUIRED:${key}`);
eq(authority.qualified_design.hourly_runtime_config_count, 24, "EA5D1_24_CONFIG_CHAIN_REQUIRED");
falsy(authority.qualified_design.implicit_latest_config_lookup_allowed, "EA5D1_IMPLICIT_LATEST_FORBIDDEN");
eq(authority.qualified_design.runtime_mode, "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY", "EA5D1_EXTERNAL_RUNTIME_MODE_REQUIRED");
eq(authority.qualified_design.config_selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY", "EA5D1_EXPLICIT_CONFIG_PIN_REQUIRED");
for (const key of [
  "historical_replay_scope_reuse_allowed",
  "historical_200mm_operator_allowed_in_external_canonical_graph",
  "controlled_synthetic_replay_proxy_allowed_in_external_canonical_graph"
]) falsy(authority.qualified_design[key], `EA5D1_FORBIDDEN_DESIGN:${key}`);
falsy(authority.qualification_proof_boundary.formal_neon_write_authorized, "EA5D1_FORMAL_NEON_WRITE_FORBIDDEN");
eq(authority.qualification_proof_boundary.expected_first_runtime_config_writes, 25, "EA5D1_25_RUNTIME_CONFIG_WRITES_REQUIRED");
eq(authority.qualification_proof_boundary.expected_first_a0_member_writes, 9, "EA5D1_9_A0_WRITES_REQUIRED");
eq(authority.qualification_proof_boundary.expected_first_total_canonical_facts, 34, "EA5D1_34_CANONICAL_FACTS_REQUIRED");
eq(authority.qualification_proof_boundary.expected_retry_runtime_config_writes, 0, "EA5D1_RETRY_CONFIG_ZERO_WRITE_REQUIRED");
eq(authority.qualification_proof_boundary.expected_retry_a0_member_writes, 0, "EA5D1_RETRY_A0_ZERO_WRITE_REQUIRED");
falsy(authority.qualification_proof_boundary.formal_window_started, "EA5D1_FORMAL_WINDOW_START_FORBIDDEN");

const effect = authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
truthy(effect.ea5d1_external_bootstrap_persistence_implementation_qualified, "EA5D1_EFFECT_REQUIRED");
truthy(effect.ea5d_authorized, "EA5D1_EA5D_AUTHORIZED_MUST_REMAIN_TRUE");
for (const key of [
  "ea5d_complete",
  "formal_neon_bootstrap_persisted",
  "formal_24_config_chain_persisted",
  "ea5e_authorized",
  "formal_o00_start_authorized",
  "formal_window_started",
  "mcft_cap09_completed"
]) falsy(effect[key], `EA5D1_PREMATURE_EFFECT:${key}`);
eq(authority.next_legal_successor_if_effective, "S6-EA5D2-FORMAL-BOOTSTRAP-AND-24-CONFIG-CHAIN-LIVE-PERSISTENCE", "EA5D1_NEXT_FRONTIER_REQUIRED");

const bundle = fs.readFileSync(bundlePath, "utf8");
for (const marker of [
  "compileExternalFormalRuntimeConfigV1",
  "GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1",
  "KBS039-006_MCSE_PLOT_POLYGONS",
  "MODEL_PRIOR_FROM_CAP08",
  "NOT_FIELD_CALIBRATED",
  'role: "A0_BOOTSTRAP"',
  'role: "HOURLY_CAP04"',
  "for (let index = 0; index < 24; index += 1)",
  "EXTERNAL_FORMAL_CROP_STAGE_AUTHORITY_AFTER_BOOTSTRAP_FORBIDDEN"
]) if (!bundle.includes(marker)) fail(`EA5D1_BUNDLE_MARKER_MISSING:${marker}`);
for (const forbidden of ["field_c8_demo", "CONTROLLED_SYNTHETIC_REPLAY_PROXY", "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1"]) if (bundle.includes(forbidden)) fail(`EA5D1_BUNDLE_FORBIDDEN_MARKER:${forbidden}`);

const service = fs.readFileSync(servicePath, "utf8");
for (const marker of [
  "ExternalFormalA0EvidenceWindowServiceV1",
  "buildExternalFormalA0RecordSetV1",
  "commitRealityBindingSnapshot",
  "commitRuntimeConfig",
  "commitBootstrapState",
  "bundle.runtime_configs.length !== 24",
  "formal_window_started: false"
]) if (!service.includes(marker)) fail(`EA5D1_SERVICE_MARKER_MISSING:${marker}`);
for (const forbidden of ["fetch(", "http://", "https://", "claimSlot(", "claimWindow(", "RecommendationService", "AO_ACT_"]) if (service.includes(forbidden)) fail(`EA5D1_SERVICE_SIDE_EFFECT_PATH_FORBIDDEN:${forbidden}`);

const acceptance = fs.readFileSync(acceptancePath, "utf8");
for (const marker of [
  "EA5D1_DATABASE_URL",
  "EXTERNAL_FORMAL_CROP_STAGE_AUTHORITY_AFTER_BOOTSTRAP_FORBIDDEN",
  "crop_stage_authority_not_after_bootstrap_proved: true",
  "optionalTableCountV1",
  "LEASE_OWNER",
  "exact_total_canonical_fact_count: 34",
  "exact_hourly_runtime_config_count: 24",
  "idempotent_retry_zero_canonical_writes: true",
  "formal_neon_write_performed: false",
  "scheduler_slot_write_count: 0",
  "scheduler_cursor_write_count: 0",
  "provider_request_count: 0",
  "formal_window_started: false"
]) if (!acceptance.includes(marker)) fail(`EA5D1_ACCEPTANCE_MARKER_MISSING:${marker}`);
if (acceptance.includes("GEOX_MCFT_CAP09_S6_DATABASE_URL") || acceptance.includes("lter.kbs.msu.edu")) fail("EA5D1_ACCEPTANCE_EXTERNAL_SIDE_EFFECT_REFERENCE_FORBIDDEN");

const workflow = fs.readFileSync(workflowPath, "utf8");
if (workflow.includes("pull_request_target") || workflow.includes("GEOX_MCFT_CAP09_S6_DATABASE_URL")) fail("EA5D1_WORKFLOW_PRIVILEGE_OR_FORMAL_DB_FORBIDDEN");
for (const marker of [
  "postgres:18",
  "EA5D1_DATABASE_URL: postgres://postgres:postgres@127.0.0.1:55432/ea5d1",
  "ACCEPTANCE_MCFT_CAP_09_EA5D1_EXTERNAL_BOOTSTRAP_PERSISTENCE.ts",
  "ACCEPTANCE_MCFT_CAP_09_EA5B4B_EXTERNAL_A0_PROVENANCE_PROFILE.ts",
  "ACCEPTANCE_MCFT_CAP_09_EA5B3_EXTERNAL_RUNTIME_CONFIG_RESOLVER.ts"
]) if (!workflow.includes(marker)) fail(`EA5D1_WORKFLOW_MARKER_MISSING:${marker}`);

const result = {
  schema_version: "geox_mcft_cap09_ea5d1_external_bootstrap_persistence_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  candidate_blobs_verified: true,
  exact_external_scope_only: true,
  causal_crop_stage_authority_required: true,
  exact_runtime_config_count: 25,
  exact_hourly_runtime_config_count: 24,
  external_a0_member_count: 9,
  isolated_ci_postgres_only: true,
  formal_neon_write_performed: false,
  provider_request_count: 0,
  scheduler_slot_write_count: 0,
  ea5d_authorized: true,
  ea5d_complete: false,
  ea5e_authorized: false,
  formal_o00_start_authorized: false,
  formal_window_started: false,
  mcft_cap09_completed: false
};
fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5D1_EXTERNAL_BOOTSTRAP_PERSISTENCE_GOVERNANCE_RESULT.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
