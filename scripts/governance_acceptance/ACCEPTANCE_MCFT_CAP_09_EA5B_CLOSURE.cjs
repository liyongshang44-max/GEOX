#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function fail(message) { throw new Error(message); }
function eq(actual, expected, code) { if (actual !== expected) fail(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
function truthy(value, code) { if (value !== true) fail(`${code}: expected true`); }
function falsy(value, code) { if (value !== false) fail(`${code}: expected false`); }
function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function blob(ref, file) { return git("rev-parse", `${ref}:${file}`); }

const base = process.env.MCFT_BASE_SHA;
if (!base) fail("EA5B_CLOSURE_BASE_SHA_REQUIRED");
eq(base, "05a44c2ed56646d6e97aba83dbad64e0a82f52d8", "EA5B_CLOSURE_EXACT_BASE_REQUIRED");

const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B-CLOSURE-AUTHORITY-V1.json";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B_CLOSURE.cjs";
const workflowPath = ".github/workflows/mcft-cap-09-ea5b-closure.yml";
const expectedChanged = [authorityPath, gatePath, workflowPath].sort();
const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify(expectedChanged), "EA5B_CLOSURE_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

const pins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-STATUS.json": "be8a80345e004cf33d3993b0e26dcea01fc6644b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B1-EXTERNAL-EVIDENCE-BINDING-SEAM-V1.json": "94b8e891bb077753ef77fc7c55fc5c78f1c328e2",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B2-CAP04-EXTERNAL-BINDING-THREADING-V1.json": "09963e6bc3a64fc16d54c5f27a2a00228e4b5e24",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B3-EXTERNAL-RUNTIME-CONFIG-RESOLVER-V1.json": "bdaf311cc23c78fb45079af65fcd30a7b794fec3",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B4A-EXTERNAL-OPERATOR-AUTHORITY-V1.json": "3192e3159bffce5a23913dc7299355e1a1e322c4",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B4B-EXTERNAL-A0-PROVENANCE-PROFILE-V1.json": "503842ef473e7ccf6a6fe46a21a36e678766851b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5A-EXTERNAL-CAP04-STATE-SOURCE-V1.json": "3f4713d52272eae3fce3b05f5ab21316b87b257f",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5B-EXTERNAL-FORECAST-A1A2-V1.json": "7568566297f3e917f297fd5cf30111c57e578977",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5C-EXTERNAL-CAP04-ORCHESTRATION-V1.json": "345f54fe5b79ca69c88f8c515ea8526db2d3bc99",
  "apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts": "5fe20f988d2cd6ef038f54eec27e5a32ba6a396d",
  "apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts": "f7ea03a7f8387ce4de135dac61f0b063e91f0f25",
  "apps/server/src/domain/twin_runtime/external_formal_cap04_execution_config_resolver_v1.ts": "7c542f62b6950739187948fa60f0d4c5b3c4e8e6",
  "apps/server/src/domain/soil_water/external_formal_assimilation_authority_view_v1.ts": "06c94f7778995e94ba6008c0a31f1273a5c620a2",
  "apps/server/src/domain/soil_water/external_formal_bootstrap_posterior_authority_v1.ts": "10f00c9dc716bfd9f164c42f00701340a6b3d74b",
  "apps/server/src/runtime/twin_runtime/external_formal_a0_record_set_builder_v1.ts": "516c141cbb971d55635b500d2a99962116159588",
  "apps/server/src/runtime/twin_runtime/external_formal_cap04_input_authority_v1.ts": "b4b7448518628bcffe8eaf6a91d9967145f7647d",
  "apps/server/src/runtime/twin_runtime/external_formal_cap04_state_source_builder_v1.ts": "0d9857ea883f55a64261b58b8e56dffa1d388028",
  "apps/server/src/domain/twin_runtime/external_formal_cap04_forecast_authority_v1.ts": "cb334a55f7649a95de75a26ef30e4a5ee06fd53c",
  "apps/server/src/runtime/twin_runtime/external_formal_cap04_a_record_set_builder_v1.ts": "436a74fe1395eb5123807c148b3b6229b120cf61",
  "apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts": "f627c89d59092621dd7a4523f09b2ce4ec78433b"
};
for (const [file, expected] of Object.entries(pins)) {
  eq(blob(base, file), expected, `EA5B_CLOSURE_BASE_BLOB_PIN_MISMATCH:${file}`);
  eq(blob("HEAD", file), expected, `EA5B_CLOSURE_PREDECESSOR_MUTATED:${file}`);
}

const amendment = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md", "utf8");
for (const required of [
  "EA5B — External Formal Runtime Authority Profile + binding/profile implementation qualification",
  "EA5C — durable raw retention + restricted canonical External Evidence ingress",
  "EA5D — External canonical bootstrap config + A0 bootstrap + 24-config chain persistence",
  "EA5E — post-bootstrap DB preflight + Formal Window Input Manifest + collector/runtime schedule readiness + Formal Authority V3 effectiveness",
  "Only after EA5E is effective may O00 be enabled."
]) if (!amendment.includes(required)) fail(`EA5B_CLOSURE_AMENDMENT_SEQUENCE_MISSING:${required}`);

const b1 = readJson("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B1-EXTERNAL-EVIDENCE-BINDING-SEAM-V1.json");
const b2 = readJson("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B2-CAP04-EXTERNAL-BINDING-THREADING-V1.json");
const b3 = readJson("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B3-EXTERNAL-RUNTIME-CONFIG-RESOLVER-V1.json");
const b4a = readJson("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B4A-EXTERNAL-OPERATOR-AUTHORITY-V1.json");
const b4b = readJson("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B4B-EXTERNAL-A0-PROVENANCE-PROFILE-V1.json");
const b5a = readJson("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5A-EXTERNAL-CAP04-STATE-SOURCE-V1.json");
const b5b = readJson("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5B-EXTERNAL-FORECAST-A1A2-V1.json");
const b5c = readJson("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5C-EXTERNAL-CAP04-ORCHESTRATION-V1.json");

const expectedBindings = {
  soil_moisture: "kbs_lter_variate25_vwc_100mm_v1",
  observed_rainfall: "kbs_lter_raw_hourly_rain_mm_v1",
  historical_et0: "kbs_lter_asce_short_reference_et_hourly_v1",
  future_weather: "noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1",
  future_et0: "noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1"
};
eq(JSON.stringify(b1.formal_binding_ids), JSON.stringify(expectedBindings), "EA5B_CLOSURE_FIVE_BINDING_PROFILE_MISMATCH");
truthy(b2.implemented_boundary.cap04_threads_explicit_soil_binding_to_continuation_evidence_window, "EA5B_CLOSURE_CAP04_BINDING_THREADING_REQUIRED");
truthy(b2.implemented_boundary.idempotent_retry_requires_exact_soil_binding_authority_match, "EA5B_CLOSURE_BINDING_RETRY_AUTHORITY_REQUIRED");

eq(b3.external_canonical_runtime_config_authority.runtime_mode, "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY", "EA5B_CLOSURE_EXTERNAL_RUNTIME_MODE_REQUIRED");
eq(b3.external_canonical_runtime_config_authority.model_parameter_authority, "MODEL_PRIOR_FROM_CAP08", "EA5B_CLOSURE_MODEL_PRIOR_AUTHORITY_REQUIRED");
falsy(b3.external_canonical_runtime_config_authority.controlled_synthetic_replay_proxy_allowed, "EA5B_CLOSURE_REPLAY_PROXY_FORBIDDEN");
falsy(b3.compatibility_execution_view.compatibility_view_canonical_persistence_authorized, "EA5B_CLOSURE_COMPATIBILITY_VIEW_NOT_PERSISTABLE");

eq(b4a.external_operator_authority.observation_operator_id, "POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1", "EA5B_CLOSURE_100MM_OPERATOR_REQUIRED");
eq(b4a.external_operator_authority.measurement_depth_mm, 100, "EA5B_CLOSURE_100MM_DEPTH_REQUIRED");
eq(b4a.external_operator_authority.root_zone_representativeness, "PARTIAL", "EA5B_CLOSURE_PARTIAL_REPRESENTATIVENESS_REQUIRED");
falsy(b4a.external_operator_authority.direct_field_equivalence, "EA5B_CLOSURE_DIRECT_FIELD_EQUIVALENCE_FORBIDDEN");
falsy(b4a.external_operator_authority.direct_root_zone_equivalence, "EA5B_CLOSURE_DIRECT_ROOT_ZONE_EQUIVALENCE_FORBIDDEN");

eq(b4b.canonical_candidate_graph.member_count, 9, "EA5B_CLOSURE_A0_NINE_MEMBER_GRAPH_REQUIRED");
truthy(b4b.qualification_requirements.no_replay_or_synthetic_canonical_truth_markers, "EA5B_CLOSURE_A0_REPLAY_MARKERS_FORBIDDEN");
falsy(b4b.canonical_candidate_graph.canonical_persistence_authorized, "EA5B_CLOSURE_A0_PERSISTENCE_NOT_YET_AUTHORIZED");
truthy(b5a.effect_boundary.external_cap04_input_authority_qualified, "EA5B_CLOSURE_EXTERNAL_CAP04_INPUT_REQUIRED");
truthy(b5a.effect_boundary.external_cap04_canonical_state_source_candidate_qualified, "EA5B_CLOSURE_EXTERNAL_STATE_SOURCE_REQUIRED");
falsy(b5a.qualified_authority.recommendation_input_eligible, "EA5B_CLOSURE_RECOMMENDATION_INPUT_FORBIDDEN");
falsy(b5a.qualified_authority.action_input_eligible, "EA5B_CLOSURE_ACTION_INPUT_FORBIDDEN");
truthy(b5b.effect_boundary.external_cap04_forecast_authority_qualified, "EA5B_CLOSURE_EXTERNAL_FORECAST_REQUIRED");
truthy(b5b.effect_boundary.external_cap04_a1_a2_record_set_qualified, "EA5B_CLOSURE_EXTERNAL_A1_A2_REQUIRED");
eq(b5b.qualified_authority.completed_forecast_horizon_hours, 72, "EA5B_CLOSURE_72H_FORECAST_REQUIRED");
truthy(b5c.effect_boundary.production_external_cap04_candidate_orchestration_qualified, "EA5B_CLOSURE_PRODUCTION_ORCHESTRATION_REQUIRED");
falsy(b5c.effect_boundary.canonical_persistence_authorized, "EA5B_CLOSURE_CANONICAL_PERSISTENCE_FORBIDDEN");
falsy(b5c.effect_boundary.ea5b_complete, "EA5B_CLOSURE_PREDECESSOR_MUST_STILL_REQUIRE_CLOSURE");
falsy(b5c.effect_boundary.ea5c_authorized, "EA5B_CLOSURE_PREDECESSOR_MUST_NOT_PREAUTHORIZE_EA5C");
eq(b5c.next_frontier, "S6-EA5B-CLOSURE-AUDIT", "EA5B_CLOSURE_LEGAL_FRONTIER_REQUIRED");

const bindingProfileText = fs.readFileSync("apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts", "utf8");
for (const marker of ["OBSERVED", "ESTIMATED", "ASSUMED", "kbs_lter_variate25_vwc_100mm_v1", "noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1"]) {
  if (!bindingProfileText.includes(marker)) fail(`EA5B_CLOSURE_EPISTEMIC_OR_BINDING_MARKER_MISSING:${marker}`);
}

const authority = readJson(authorityPath);
eq(authority.base_main_sha, base, "EA5B_CLOSURE_AUTHORITY_BASE_MISMATCH");
eq(authority.frontier_id, "S6-EA5B-CLOSURE-AUDIT", "EA5B_CLOSURE_AUTHORITY_FRONTIER_MISMATCH");
truthy(authority.amendment_05_ea5b_closure.five_source_binding_profile_qualified, "EA5B_CLOSURE_AUTHORITY_BINDING_PROFILE_REQUIRED");
truthy(authority.amendment_05_ea5b_closure.external_a0_nine_member_canonical_candidate_qualified, "EA5B_CLOSURE_AUTHORITY_A0_REQUIRED");
truthy(authority.amendment_05_ea5b_closure.production_persistence_free_external_cap04_orchestration_qualified, "EA5B_CLOSURE_AUTHORITY_ORCHESTRATION_REQUIRED");
truthy(authority.deferred_by_amendment_05_internal_sequence.ea5c_durable_private_raw_retention, "EA5B_CLOSURE_EA5C_RETENTION_MUST_REMAIN_DEFERRED");
truthy(authority.deferred_by_amendment_05_internal_sequence.ea5d_exact_24_runtime_config_chain_persistence, "EA5B_CLOSURE_EA5D_24_CONFIG_MUST_REMAIN_DEFERRED");
truthy(authority.deferred_by_amendment_05_internal_sequence.ea5e_formal_window_input_manifest, "EA5B_CLOSURE_EA5E_MANIFEST_MUST_REMAIN_DEFERRED");
truthy(authority.success_effect_if_merged_to_protected_main.ea5b_complete, "EA5B_CLOSURE_EFFECT_COMPLETE_REQUIRED");
truthy(authority.success_effect_if_merged_to_protected_main.ea5c_authorized, "EA5B_CLOSURE_EFFECT_EA5C_AUTHORIZED_REQUIRED");
falsy(authority.success_effect_if_merged_to_protected_main.ea5d_authorized, "EA5B_CLOSURE_EA5D_PREMATURE_AUTHORIZATION");
falsy(authority.success_effect_if_merged_to_protected_main.ea5e_authorized, "EA5B_CLOSURE_EA5E_PREMATURE_AUTHORIZATION");
falsy(authority.success_effect_if_merged_to_protected_main.formal_o00_start_authorized, "EA5B_CLOSURE_O00_PREMATURE_AUTHORIZATION");
falsy(authority.success_effect_if_merged_to_protected_main.mcft_cap09_completed, "EA5B_CLOSURE_CAP09_PREMATURE_COMPLETION");
for (const [key, value] of Object.entries(authority.zero_side_effect_proof)) eq(value, 0, `EA5B_CLOSURE_ZERO_SIDE_EFFECT_REQUIRED:${key}`);

eq(authority.next_legal_successor_if_effective, "S6-EA5C-DURABLE-RAW-RETENTION-AND-RESTRICTED-CANONICAL-EXTERNAL-EVIDENCE-INGRESS", "EA5B_CLOSURE_NEXT_FRONTIER_REQUIRED");

const result = {
  schema_version: "geox_mcft_cap09_ea5b_closure_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_authority_count: 8,
  governing_authority_pins_verified: true,
  predecessor_blobs_verified_unchanged: true,
  five_source_binding_profile_qualified: true,
  external_100mm_operator_qualified: true,
  external_runtime_config_and_compatibility_view_qualified: true,
  external_a0_candidate_qualified: true,
  external_cap04_state_forecast_a1_a2_orchestration_qualified: true,
  historical_replay_semantics_preserved: true,
  canonical_persistence_authorized: false,
  ea5b_complete_after_effectiveness: true,
  ea5c_authorized_after_effectiveness: true,
  ea5d_authorized: false,
  ea5e_authorized: false,
  formal_o00_start_authorized: false,
  mcft_cap09_completed: false
};
fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5B_CLOSURE_GOVERNANCE_RESULT.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
