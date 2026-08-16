#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const fail = (m) => { throw new Error(m); };
const eq = (a, e, c) => { if (a !== e) fail(`${c}: expected=${JSON.stringify(e)} actual=${JSON.stringify(a)}`); };
const yes = (v, c) => eq(v, true, c);
const no = (v, c) => eq(v, false, c);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, p) => git("rev-parse", `${ref}:${p}`);
const json = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha256 = (p) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;

const base = process.env.MCFT_BASE_SHA;
eq(base, "2fade4617dadae81a779b80f35332545e817ff0a", "T3R1_MANIFEST_V2_EXACT_BASE_REQUIRED");

const manifestPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-FORMAL-WINDOW-INPUT-MANIFEST-V2.json";
const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST-V2.json";
const executorPath = "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T3R1_SUCCESSOR_FORMAL_DB_PREFLIGHT_WINDOW_INPUT_MANIFEST_V2.ts";
const workflowPath = ".github/workflows/mcft-cap-09-t3r1-successor-formal-db-preflight-window-input-manifest-v2.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_SUCCESSOR_FORMAL_DB_PREFLIGHT_WINDOW_INPUT_MANIFEST_V2.cjs";
const outputPath = "acceptance-output/MCFT_CAP_09_T3R1_SUCCESSOR_FORMAL_DB_PREFLIGHT_WINDOW_INPUT_MANIFEST_V2_GOVERNANCE_RESULT.json";

const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify([manifestPath, authorityPath, executorPath, workflowPath, gatePath].sort()), "T3R1_MANIFEST_V2_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md": "a037b24757992987fc24ce8b6afac6c8eabca3ed",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTED-A0-AUTHORITY-V1.json": "e44b43d71d339c39e017737d44c7c9a17a67f5be",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json": "757e4b9f4fdcd631eea97fca85614a1b61ef0c4a",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json": "9c12e31b0a9a3d33e027f0677ad1cf2d92a5097f",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-RUNTIME-CONFIG-BUILDER-QUALIFICATION-V2.json": "6a9fba30a0b8ad82305f70a43b604d76572daeee",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-RUNTIME-CONFIG-PERSISTENCE-V2.json": "3b2a3b7848622e5193372792c0b45fe66c17d359",
};
for (const [p, expected] of Object.entries(predecessorPins)) {
  eq(blob(base, p), expected, `T3R1_MANIFEST_V2_BASE_PIN:${p}`);
  eq(blob("HEAD", p), expected, `T3R1_MANIFEST_V2_PREDECESSOR_MUTATED:${p}`);
}

const manifest = json(manifestPath);
const selection = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json");
eq(manifest.schema_version, "geox_mcft_cap09_t3r1_successor_formal_window_input_manifest_v2", "T3R1_MANIFEST_V2_SCHEMA_REQUIRED");
eq(manifest.manifest_id, "GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-FORMAL-WINDOW-INPUT-MANIFEST-V2", "T3R1_MANIFEST_V2_ID_REQUIRED");
eq(manifest.frontier_id, "S6-T3R1-SUCCESSOR-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST-V2", "T3R1_MANIFEST_V2_FRONTIER_REQUIRED");
eq(manifest.record_status, "T3R1_SUCCESSOR_FORMAL_WINDOW_INPUT_MANIFEST_CANDIDATE_NOT_EFFECTIVE", "T3R1_MANIFEST_V2_STATUS_REQUIRED");
eq(manifest.base_protected_main_sha, base, "T3R1_MANIFEST_V2_BASE_BINDING_REQUIRED");
eq(manifest.selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY", "T3R1_MANIFEST_V2_EXPLICIT_SELECTION_REQUIRED");
yes(manifest.immutable_for_formal_window, "T3R1_MANIFEST_V2_IMMUTABLE_REQUIRED");
eq(manifest.slot_count, 24, "T3R1_MANIFEST_V2_24_COUNT_REQUIRED");
eq(manifest.slots.length, 24, "T3R1_MANIFEST_V2_24_ARRAY_REQUIRED");
eq(manifest.selected_epoch.epoch_id, "mcft_cap09_external_formal_window_epoch_20260817t200000z_v2", "T3R1_MANIFEST_V2_EPOCH_REQUIRED");
eq(manifest.selected_epoch.o00, "2026-08-17T20:00:00.000Z", "T3R1_MANIFEST_V2_O00_REQUIRED");
eq(manifest.selected_epoch.o23, "2026-08-18T19:00:00.000Z", "T3R1_MANIFEST_V2_O23_REQUIRED");
eq(manifest.selected_epoch.ea5e3_readiness_deadline, "2026-08-17T08:00:00.000Z", "T3R1_MANIFEST_V2_DEADLINE_REQUIRED");

eq(manifest.existing_a0_predecessor_authority.logical_time, "2026-08-15T10:00:00.000Z", "T3R1_MANIFEST_V2_A0_TIME_REQUIRED");
eq(manifest.existing_a0_predecessor_authority.runtime_config_ref, "external_formal_runtime_config_49959a28cfc9eb357bf18f9d", "T3R1_MANIFEST_V2_A0_REF_REQUIRED");
eq(manifest.existing_a0_predecessor_authority.runtime_config_hash, "sha256:5f11788fd049a3eae190d566e6faa28f428637e11f2c90b4e0aaea67e6f14e48", "T3R1_MANIFEST_V2_A0_HASH_REQUIRED");

eq(manifest.formal_database_binding.neon_project_id, "delicate-glade-62464340", "T3R1_MANIFEST_V2_PROJECT_REQUIRED");
eq(manifest.formal_database_binding.neon_branch_id, "br-cold-dust-a6j6aymz", "T3R1_MANIFEST_V2_BRANCH_REQUIRED");
eq(manifest.formal_database_binding.database_name, "geox_mcft_cap09_s6_formal_t3r1_24h", "T3R1_MANIFEST_V2_DATABASE_REQUIRED");
eq(manifest.formal_database_binding.transaction_mode_for_this_frontier, "READ_ONLY", "T3R1_MANIFEST_V2_READ_ONLY_REQUIRED");

const proofExpected = [
  [3190, "2489319aed5cea9a5cbf3844bbe8c5921b3f6df0", "c268d3ff037a01fee51061bc82daeda9309d6e85", 31934176595, 9260158509, "sha256:b7051d0611ed82223b3d9449dbe04e2699d2de497d515e39f485e3be007acac5"],
  [3191, "090a3c539e8830fac2fae71b33dd4f1abbe2cb8d", "775c5e6f1f43666c9d4fe46e14b07abcb8cfc6d0", 31934715011, 9260304898, "sha256:38f5d2cbd2d0ac169e8ac1ef4e709d2a16f37fbd252348dee03bee36123508c3"],
  [3192, "2402a95ce54b16610d0273974cc8b8bc7a0b2c58", "2fade4617dadae81a779b80f35332545e817ff0a", 31935870828, 9260626774, "sha256:4f0867b49a95da394a4ab5f84cabe8595150027a5e7daf388a4e6caf26b1f143"],
];
eq(manifest.predecessor_proof_bindings.length, 3, "T3R1_MANIFEST_V2_PREDECESSOR_PROOF_COUNT");
for (let i = 0; i < proofExpected.length; i += 1) {
  const p = manifest.predecessor_proof_bindings[i];
  const e = proofExpected[i];
  eq(p.pr_number, e[0], `T3R1_MANIFEST_V2_PR:${i}`);
  eq(p.merged_head_sha, e[1], `T3R1_MANIFEST_V2_HEAD:${i}`);
  eq(p.merge_commit_sha, e[2], `T3R1_MANIFEST_V2_MERGE:${i}`);
  eq(p.focused_workflow_run_id, e[3], `T3R1_MANIFEST_V2_RUN:${i}`);
  eq(p.focused_artifact_id, e[4], `T3R1_MANIFEST_V2_ARTIFACT:${i}`);
  eq(p.focused_artifact_digest, e[5], `T3R1_MANIFEST_V2_DIGEST:${i}`);
}

const temporal = manifest.amendment_11_temporal_authority;
eq(temporal.authority_blob_sha, "a037b24757992987fc24ce8b6afac6c8eabca3ed", "T3R1_MANIFEST_V2_AMENDMENT11_PIN");
eq(temporal.provider_availability_watermark, "PROVIDER_AVAILABILITY_WATERMARK_V1", "T3R1_MANIFEST_V2_WATERMARK_REQUIRED");
eq(temporal.observation_resolution, "hourly", "T3R1_MANIFEST_V2_HOURLY_RESOLUTION_REQUIRED");
eq(temporal.provider_publication_cadence, "daily_batch", "T3R1_MANIFEST_V2_DAILY_BATCH_REQUIRED");
eq(temporal.historical_online_freshness_diagnostic_hours, 6, "T3R1_MANIFEST_V2_6H_DIAGNOSTIC_REQUIRED");
no(temporal.freshness_is_late_authoritative_admission_gate, "T3R1_MANIFEST_V2_6H_AUTHORITY_FORBIDDEN");
no(temporal.fixed_t_plus_432_normative_cutoff, "T3R1_MANIFEST_V2_T432_AUTHORITY_FORBIDDEN");
no(temporal.cadence_engineering_observation_window_hours_is_freshness_authority, "T3R1_MANIFEST_V2_24H_AUTHORITY_FORBIDDEN");
no(temporal.rolling_candidate_retention_hours_is_freshness_authority, "T3R1_MANIFEST_V2_36H_AUTHORITY_FORBIDDEN");
yes(temporal.raw_retention_before_canonicalization, "T3R1_MANIFEST_V2_RAW_FIRST_REQUIRED");
yes(temporal.no_future_leakage, "T3R1_MANIFEST_V2_NO_FUTURE_REQUIRED");
yes(temporal.no_interpolation, "T3R1_MANIFEST_V2_NO_INTERPOLATION_REQUIRED");
yes(temporal.no_persistence_fill, "T3R1_MANIFEST_V2_NO_FILL_REQUIRED");
yes(temporal.no_source_substitution, "T3R1_MANIFEST_V2_NO_SUBSTITUTION_REQUIRED");

const refs = new Set(), hashes = new Set();
for (let i = 0; i < 24; i += 1) {
  const s = manifest.slots[i], c = selection.slot_contexts[i];
  eq(s.slot_id, `O${String(i).padStart(2, "0")}`, `T3R1_MANIFEST_V2_SLOT_ID:${i}`);
  eq(s.slot_id, c.slot_id, `T3R1_MANIFEST_V2_SELECTION_SLOT:${i}`);
  eq(s.logical_time, c.logical_time, `T3R1_MANIFEST_V2_SELECTION_TIME:${i}`);
  eq(s.crop_stage_context_hash, c.crop_stage_context_hash, `T3R1_MANIFEST_V2_CROP:${i}`);
  if (refs.has(s.runtime_config_ref)) fail(`T3R1_MANIFEST_V2_DUPLICATE_REF:${i}`);
  if (hashes.has(s.runtime_config_hash)) fail(`T3R1_MANIFEST_V2_DUPLICATE_HASH:${i}`);
  refs.add(s.runtime_config_ref); hashes.add(s.runtime_config_hash);
  if (i === 0) {
    eq(s.parent_runtime_config_ref, manifest.existing_a0_predecessor_authority.runtime_config_ref, "T3R1_MANIFEST_V2_O00_PARENT_REF");
    eq(s.parent_runtime_config_hash, manifest.existing_a0_predecessor_authority.runtime_config_hash, "T3R1_MANIFEST_V2_O00_PARENT_HASH");
  } else {
    eq(s.parent_runtime_config_ref, manifest.slots[i - 1].runtime_config_ref, `T3R1_MANIFEST_V2_PARENT_REF:${i}`);
    eq(s.parent_runtime_config_hash, manifest.slots[i - 1].runtime_config_hash, `T3R1_MANIFEST_V2_PARENT_HASH:${i}`);
  }
}
eq(refs.size, 24, "T3R1_MANIFEST_V2_DISTINCT_REFS");
eq(hashes.size, 24, "T3R1_MANIFEST_V2_DISTINCT_HASHES");

const required = manifest.required_prewindow_state;
for (const [k, v] of Object.entries({
  total_fact_count: 59, exact_scope_fact_count: 59, external_soil_evidence_count: 1,
  canonical_twin_fact_count: 58, runtime_config_count: 49, successor_hourly_runtime_config_count: 24,
  state_count: 1, scheduler_slot_count: 0, scheduler_cursor_count: 0, formal_window_runtime_tick_count: 0,
  foreign_scope_relevant_fact_count: 0,
})) eq(required[k], v, `T3R1_MANIFEST_V2_REQUIRED_STATE:${k}`);
yes(required.existing_a0_state_anchor_preserved, "T3R1_MANIFEST_V2_A0_STATE_REQUIRED");
eq(required.state_latest_logical_time, "2026-08-15T10:00:00.000Z", "T3R1_MANIFEST_V2_STATE_TIME_REQUIRED");
eq(required.formal_execution_count, "0/24", "T3R1_MANIFEST_V2_ZERO_EXECUTION_REQUIRED");
no(required.formal_window_started, "T3R1_MANIFEST_V2_WINDOW_UNSTARTED_REQUIRED");

const authority = json(authorityPath);
eq(authority.base_protected_main_sha, base, "T3R1_MANIFEST_V2_AUTHORITY_BASE");
eq(authority.frontier_id, manifest.frontier_id, "T3R1_MANIFEST_V2_AUTHORITY_FRONTIER");
eq(authority.record_status, "T3R1_SUCCESSOR_FORMAL_DB_PREFLIGHT_MANIFEST_CANDIDATE_NOT_EFFECTIVE", "T3R1_MANIFEST_V2_AUTHORITY_STATUS");
eq(authority.formal_window_input_manifest.manifest_path, manifestPath, "T3R1_MANIFEST_V2_AUTHORITY_MANIFEST_PATH");
eq(authority.formal_window_input_manifest.manifest_blob_sha, blob("HEAD", manifestPath), "T3R1_MANIFEST_V2_AUTHORITY_MANIFEST_BLOB");
eq(authority.formal_window_input_manifest.manifest_content_sha256, sha256(manifestPath), "T3R1_MANIFEST_V2_AUTHORITY_MANIFEST_SHA256");
eq(authority.candidate_implementation_blobs.executor, blob("HEAD", executorPath), "T3R1_MANIFEST_V2_EXECUTOR_BLOB");
eq(authority.candidate_implementation_blobs.workflow, blob("HEAD", workflowPath), "T3R1_MANIFEST_V2_WORKFLOW_BLOB");
eq(authority.candidate_implementation_blobs.governance_gate, blob("HEAD", gatePath), "T3R1_MANIFEST_V2_GATE_BLOB");

yes(authority.live_preflight_contract.verify_exact_59_fact_49_config_inventory, "T3R1_MANIFEST_V2_LIVE_59_49_REQUIRED");
yes(authority.live_preflight_contract.verify_exact_24_manifest_pins, "T3R1_MANIFEST_V2_LIVE_24_REQUIRED");
yes(authority.live_preflight_contract.verify_amendment_11_temporal_semantics, "T3R1_MANIFEST_V2_LIVE_AMENDMENT11_REQUIRED");
eq(authority.live_preflight_contract.transaction_mode, "READ_ONLY", "T3R1_MANIFEST_V2_LIVE_READ_ONLY");
for (const k of ["database_write_count", "provider_request_count", "raw_object_write_count", "scheduler_slot_write_count", "scheduler_cursor_write_count", "runtime_tick_count"]) eq(authority.live_preflight_contract[k], 0, `T3R1_MANIFEST_V2_ZERO_SIDE_EFFECT:${k}`);

yes(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.successor_formal_db_preflight_effective, "T3R1_MANIFEST_V2_EFFECT_PREFLIGHT");
yes(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_window_input_manifest_v2_frozen, "T3R1_MANIFEST_V2_EFFECT_MANIFEST");
no(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5e3_authorized, "T3R1_MANIFEST_V2_EFFECT_NO_EA5E3");
no(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_o00_start_authorized, "T3R1_MANIFEST_V2_EFFECT_NO_O00");
no(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_window_started, "T3R1_MANIFEST_V2_EFFECT_NO_START");
eq(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_execution_count, "0/24", "T3R1_MANIFEST_V2_EFFECT_ZERO_EXECUTION");
no(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.mcft_cap09_completed, "T3R1_MANIFEST_V2_EFFECT_NO_COMPLETION");

fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({
  schema_version: "geox_mcft_cap09_t3r1_successor_formal_db_preflight_window_input_manifest_v2_governance_result",
  status: "PASS",
  base_sha: base,
  subject_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  manifest_content_sha256: sha256(manifestPath),
  exact_manifest_slot_count: manifest.slots.length,
  exact_parent_chain_verified: true,
  exact_crop_context_hashes_verified: true,
  predecessor_proof_identity_count: manifest.predecessor_proof_bindings.length,
  amendment_11_temporal_semantics_frozen: true,
  read_only_preflight_required: true,
  ea5e3_authorized: false,
  formal_window_started: false,
  formal_execution_count: "0/24",
  mcft_cap09_completed: false,
}, null, 2) + "\n");

console.log(JSON.stringify({ status: "PASS", manifest: manifest.manifest_id, slots: 24 }));
