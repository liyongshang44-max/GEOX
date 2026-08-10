#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const fail = (message) => { throw new Error(message); };
const eq = (actual, expected, code) => {
  if (actual !== expected) fail(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
};
const yes = (value, code) => eq(value, true, code);
const no = (value, code) => eq(value, false, code);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, filePath) => git("rev-parse", `${ref}:${filePath}`);
const json = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const fileSha256 = (filePath) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;

const base = process.env.MCFT_BASE_SHA;
eq(base, "768a9d27d2871a0811422afc08b0d236d6277b05", "EA5E1_EXACT_BASE_REQUIRED");

const manifestPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-WINDOW-INPUT-MANIFEST-V1.json";
const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E1-POST-REBASE-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST-V1.json";
const executorPath = "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_EA5E1_POST_REBASE_FORMAL_DB_PREFLIGHT.ts";
const workflowPath = ".github/workflows/mcft-cap-09-ea5e1-post-rebase-formal-db-preflight-window-input-manifest.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E1_POST_REBASE_FORMAL_DB_PREFLIGHT_WINDOW_INPUT_MANIFEST.cjs";

const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(
  JSON.stringify(changed),
  JSON.stringify([manifestPath, authorityPath, executorPath, workflowPath, gatePath].sort()),
  "EA5E1_EXACT_FIVE_FILE_BOUNDARY_REQUIRED",
);

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md": "e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-V1.json": "c7788d525c56ab83117afbeeec85f2b9f990534f",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06B-REBASED-CONFIG-BUILDER-QUALIFICATION-V1.json": "89ca957829e632a21f6a4d42a9ff571d572f7302",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06C-APPEND-ONLY-REBASED-CONFIG-PERSISTENCE-V1.json": "2a4ffb9912ec27b360b099fe46036d34d4a5a9f3"
};
for (const [filePath, expectedSha] of Object.entries(predecessorPins)) {
  eq(blob(base, filePath), expectedSha, `EA5E1_BASE_PIN:${filePath}`);
  eq(blob("HEAD", filePath), expectedSha, `EA5E1_PREDECESSOR_MUTATED:${filePath}`);
}

eq(blob("HEAD", manifestPath), "b47af64277330bb46a3fc1bb171dfcaaaf91abb1", "EA5E1_MANIFEST_BLOB_REQUIRED");
eq(blob("HEAD", executorPath), "ff852ccec6d7d64bfbfa64161547fd1e419a4e3b", "EA5E1_EXECUTOR_BLOB_REQUIRED");
eq(blob("HEAD", workflowPath), "1ffea689e2927946cf986201a8d757816d6a937c", "EA5E1_WORKFLOW_BLOB_REQUIRED");
eq(blob("HEAD", authorityPath), "6f43f94212c43c1ee3f29f662cf78dfa8b983db5", "EA5E1_AUTHORITY_BLOB_REQUIRED");
eq(fileSha256(manifestPath), "sha256:060184569523aee985ea846aac5407cef1ef288367b748e1621297c03db8999d", "EA5E1_MANIFEST_CONTENT_SHA256_REQUIRED");

const a06a = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-V1.json");
const manifest = json(manifestPath);
eq(manifest.schema_version, "geox_mcft_cap09_formal_window_input_manifest_v1", "EA5E1_MANIFEST_SCHEMA_REQUIRED");
eq(manifest.manifest_id, "GEOX-MCFT-CAP-09-FORMAL-WINDOW-INPUT-MANIFEST-V1", "EA5E1_MANIFEST_ID_REQUIRED");
eq(manifest.frontier_id, "S6-EA5E1-POST-REBASE-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST", "EA5E1_MANIFEST_FRONTIER_REQUIRED");
eq(manifest.record_status, "EA5E1_FORMAL_WINDOW_INPUT_MANIFEST_CANDIDATE_NOT_EFFECTIVE", "EA5E1_MANIFEST_STATUS_REQUIRED");
eq(manifest.selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY", "EA5E1_EXPLICIT_PIN_SELECTION_REQUIRED");
yes(manifest.immutable_for_formal_window, "EA5E1_MANIFEST_IMMUTABILITY_REQUIRED");
eq(manifest.slot_count, 24, "EA5E1_EXACT_24_MANIFEST_SLOTS_REQUIRED");
eq(manifest.slots.length, 24, "EA5E1_EXACT_24_MANIFEST_ARRAY_REQUIRED");
eq(manifest.selected_epoch.epoch_id, "mcft_cap09_external_formal_window_epoch_20260811t170000z_v1", "EA5E1_EPOCH_REQUIRED");
eq(manifest.selected_epoch.o00, "2026-08-11T17:00:00.000Z", "EA5E1_O00_REQUIRED");
eq(manifest.selected_epoch.o23, "2026-08-12T16:00:00.000Z", "EA5E1_O23_REQUIRED");
eq(manifest.selected_epoch.ea5e_v3_readiness_deadline, "2026-08-11T05:00:00.000Z", "EA5E1_DEADLINE_REQUIRED");
eq(manifest.existing_a0_predecessor_authority.runtime_config_ref, "external_formal_runtime_config_7284202e3b0bdae6d32f4814", "EA5E1_A0_REF_REQUIRED");
eq(manifest.existing_a0_predecessor_authority.runtime_config_hash, "sha256:d6b721b0eb74b1fbd4168d0bc1d551c0c95bf60fef67c8fe4cd9b77ad60930f8", "EA5E1_A0_HASH_REQUIRED");
no(manifest.expired_epoch_exclusion.expired_config_ref_hash_allowed, "EA5E1_EXPIRED_CONFIG_SELECTION_FORBIDDEN");
no(manifest.expired_epoch_exclusion.implicit_latest_config_selection_allowed, "EA5E1_IMPLICIT_LATEST_FORBIDDEN");
eq(manifest.formal_database_binding.neon_project_id, "delicate-glade-62464340", "EA5E1_NEON_PROJECT_REQUIRED");
eq(manifest.formal_database_binding.neon_branch_id, "br-cold-dust-a6j6aymz", "EA5E1_NEON_BRANCH_REQUIRED");
eq(manifest.formal_database_binding.neon_compute_endpoint_id, "ep-odd-poetry-a6peeo8g", "EA5E1_NEON_ENDPOINT_REQUIRED");
eq(manifest.formal_database_binding.database_name, "geox_mcft_cap09_s6_formal_24h", "EA5E1_DATABASE_REQUIRED");
eq(manifest.formal_database_binding.minimum_postgres_version_num, 180000, "EA5E1_POSTGRES18_REQUIRED");

const refs = new Set();
const hashes = new Set();
for (let index = 0; index < manifest.slots.length; index += 1) {
  const pin = manifest.slots[index];
  const a06aSlot = a06a.slot_contexts[index];
  eq(pin.slot_id, `O${String(index).padStart(2, "0")}`, `EA5E1_SLOT_ID:${index}`);
  eq(pin.slot_id, a06aSlot.slot_id, `EA5E1_A06A_SLOT_ID:${index}`);
  eq(pin.logical_time, a06aSlot.logical_time, `EA5E1_A06A_SLOT_TIME:${index}`);
  eq(pin.crop_stage_context_hash, a06aSlot.crop_stage_context_hash, `EA5E1_A06A_CROP_CONTEXT:${index}`);
  if (refs.has(pin.runtime_config_ref)) fail(`EA5E1_DUPLICATE_REF:${index}`);
  if (hashes.has(pin.runtime_config_hash)) fail(`EA5E1_DUPLICATE_HASH:${index}`);
  refs.add(pin.runtime_config_ref);
  hashes.add(pin.runtime_config_hash);
  if (index === 0) {
    eq(pin.parent_runtime_config_ref, manifest.existing_a0_predecessor_authority.runtime_config_ref, "EA5E1_O00_PARENT_REF_REQUIRED");
    eq(pin.parent_runtime_config_hash, manifest.existing_a0_predecessor_authority.runtime_config_hash, "EA5E1_O00_PARENT_HASH_REQUIRED");
  } else {
    eq(pin.parent_runtime_config_ref, manifest.slots[index - 1].runtime_config_ref, `EA5E1_PARENT_REF_CHAIN:${index}`);
    eq(pin.parent_runtime_config_hash, manifest.slots[index - 1].runtime_config_hash, `EA5E1_PARENT_HASH_CHAIN:${index}`);
  }
}
eq(refs.size, 24, "EA5E1_24_DISTINCT_REFS_REQUIRED");
eq(hashes.size, 24, "EA5E1_24_DISTINCT_HASHES_REQUIRED");

const authority = json(authorityPath);
eq(authority.base_main_sha, base, "EA5E1_AUTHORITY_BASE_REQUIRED");
eq(authority.frontier_id, "S6-EA5E1-POST-REBASE-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST", "EA5E1_AUTHORITY_FRONTIER_REQUIRED");
eq(authority.record_status, "EA5E1_POST_REBASE_PREFLIGHT_MANIFEST_CANDIDATE_NOT_EFFECTIVE", "EA5E1_AUTHORITY_STATUS_REQUIRED");
eq(authority.a06c_effectiveness.pr_number, 3031, "EA5E1_A06C_PR_REQUIRED");
eq(authority.a06c_effectiveness.merged_head_sha, "cbd1f984c1e2201ccd150fe8db785e62ed3396c1", "EA5E1_A06C_HEAD_REQUIRED");
eq(authority.a06c_effectiveness.merge_commit_sha, "4de72f6408a3326e364ebd3b9346437cdea9d744", "EA5E1_A06C_MERGE_REQUIRED");
eq(authority.a06c_effectiveness.merged_at_utc, "2026-08-10T05:59:14.000Z", "EA5E1_A06C_MERGE_TIME_REQUIRED");
eq(authority.a06c_effectiveness.focused_workflow_run_id, 31359896349, "EA5E1_A06C_RUN_REQUIRED");
eq(authority.a06c_effectiveness.focused_artifact_id, 9051972358, "EA5E1_A06C_ARTIFACT_REQUIRED");
eq(authority.a06c_effectiveness.focused_artifact_digest, "sha256:8df1356d8909f93b76cd7d24a4d467427d3a2f5f98cffd7f7fc38b124379ece6", "EA5E1_A06C_ARTIFACT_DIGEST_REQUIRED");
eq(authority.formal_window_input_manifest_authority.manifest_blob_sha, "b47af64277330bb46a3fc1bb171dfcaaaf91abb1", "EA5E1_AUTHORITY_MANIFEST_BLOB_REQUIRED");
eq(authority.formal_window_input_manifest_authority.manifest_content_sha256, "sha256:060184569523aee985ea846aac5407cef1ef288367b748e1621297c03db8999d", "EA5E1_AUTHORITY_MANIFEST_DIGEST_REQUIRED");
eq(authority.formal_window_input_manifest_authority.exact_slot_pin_count, 24, "EA5E1_AUTHORITY_24_PINS_REQUIRED");
yes(authority.formal_window_input_manifest_authority.each_slot_binds_runtime_config_ref_hash, "EA5E1_AUTHORITY_REF_HASH_BINDING_REQUIRED");
yes(authority.formal_window_input_manifest_authority.each_slot_binds_exact_parent_ref_hash, "EA5E1_AUTHORITY_PARENT_BINDING_REQUIRED");
yes(authority.formal_window_input_manifest_authority.each_slot_binds_a06a_crop_context_hash, "EA5E1_AUTHORITY_CROP_BINDING_REQUIRED");
yes(authority.formal_window_input_manifest_authority.expired_original_epoch_refs_hashes_excluded, "EA5E1_AUTHORITY_EXPIRED_EXCLUSION_REQUIRED");
no(authority.formal_window_input_manifest_authority.implicit_latest_selection_allowed, "EA5E1_AUTHORITY_LATEST_FORBIDDEN");
no(authority.formal_window_input_manifest_authority.manual_hourly_secret_mutation_allowed, "EA5E1_MANUAL_SECRET_MUTATION_FORBIDDEN");

const required = authority.required_post_rebase_prewindow_state;
eq(required.total_fact_count, 60, "EA5E1_REQUIRED_60_FACTS");
eq(required.exact_scope_fact_count, 60, "EA5E1_REQUIRED_60_SCOPE_FACTS");
eq(required.external_soil_evidence_count, 2, "EA5E1_REQUIRED_2_SOIL");
eq(required.canonical_twin_fact_count, 58, "EA5E1_REQUIRED_58_CANONICAL");
eq(required.runtime_config_count, 49, "EA5E1_REQUIRED_49_CONFIGS");
eq(required.expired_historical_hourly_runtime_config_count, 24, "EA5E1_REQUIRED_24_EXPIRED");
eq(required.rebased_future_hourly_runtime_config_count, 24, "EA5E1_REQUIRED_24_REBASED");
eq(required.state_count, 1, "EA5E1_REQUIRED_ONE_STATE");
yes(required.existing_a0_state_anchor_preserved, "EA5E1_REQUIRED_A0_ANCHOR");
eq(required.scheduler_slot_count, 0, "EA5E1_REQUIRED_ZERO_SLOTS");
eq(required.scheduler_cursor_count, 0, "EA5E1_REQUIRED_ZERO_CURSORS");
eq(required.foreign_scope_relevant_fact_count, 0, "EA5E1_REQUIRED_ZERO_FOREIGN");
eq(required.forbidden_c8_replay_200mm_marker_fact_count, 0, "EA5E1_REQUIRED_ZERO_FORBIDDEN");
no(required.formal_window_started, "EA5E1_REQUIRED_WINDOW_UNSTARTED");

const live = authority.live_preflight_contract;
eq(live.transaction_mode, "READ_ONLY", "EA5E1_READ_ONLY_TRANSACTION_REQUIRED");
for (const key of [
  "verify_a06c_artifact_exact_chain_before_database_connection",
  "verify_current_wall_clock_before_readiness_deadline",
  "verify_current_wall_clock_before_o00",
  "verify_neon_endpoint_host_binding",
  "verify_database_name_and_postgres_version",
  "verify_exact_60_fact_49_config_inventory",
  "verify_exact_24_rebased_manifest_pins",
  "verify_exact_24_a06a_crop_context_hashes",
  "verify_exact_parent_ref_hash_chain",
  "verify_expired_epoch_exclusion",
  "verify_existing_a0_state_anchor",
  "verify_scheduler_slots_and_cursors_zero",
  "verify_foreign_scope_zero",
  "verify_c8_replay_200mm_markers_zero"
]) yes(live[key], `EA5E1_LIVE_CONTRACT_REQUIRED:${key}`);
for (const key of [
  "database_write_count",
  "provider_request_count",
  "raw_object_write_count",
  "scheduler_slot_write_count",
  "scheduler_cursor_write_count",
  "runtime_tick_count"
]) eq(live[key], 0, `EA5E1_ZERO_SIDE_EFFECT_REQUIRED:${key}`);

const effect = authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
yes(effect.ea5e1_post_rebase_formal_db_preflight_effective, "EA5E1_EFFECT_REQUIRED");
yes(effect.formal_window_input_manifest_frozen, "EA5E1_MANIFEST_FREEZE_EFFECT_REQUIRED");
eq(effect.exact_manifest_slot_pin_count, 24, "EA5E1_EFFECT_24_PINS_REQUIRED");
yes(effect.ea5e2_collector_runtime_schedule_readiness_authorized, "EA5E1_EA5E2_AUTHORIZED_AFTER_MERGE_REQUIRED");
for (const key of [
  "ea5e2_complete",
  "ea5e3_formal_authority_v3_effective",
  "ea5e_complete",
  "external_package_formal_eligible",
  "formal_o00_start_authorized",
  "formal_window_started",
  "mcft_cap09_completed"
]) no(effect[key], `EA5E1_PREMATURE_EFFECT:${key}`);
eq(effect.formal_execution_count, "0/24", "EA5E1_EXECUTION_COUNT_REQUIRED");
eq(authority.next_legal_successor_if_effective, "S6-EA5E2-COLLECTOR-RUNTIME-SCHEDULE-READINESS", "EA5E1_NEXT_FRONTIER_REQUIRED");

const executor = fs.readFileSync(executorPath, "utf8");
for (const marker of [
  "BEGIN TRANSACTION READ ONLY",
  "EA5E1_FORMAL_WINDOW_MUST_REMAIN_DISABLED",
  "EA5E1_SELECTED_EPOCH_READINESS_DEADLINE_ALREADY_PASSED",
  "EA5E1_FORMAL_NEON_BRANCH_ENDPOINT_MISMATCH",
  "EA5E1_FORMAL_DB_INVENTORY_MISMATCH",
  "EA5E1_SELECTED_CONFIG_HASH_MISMATCH",
  "EA5E1_EXPIRED_CONFIG_PRESENT_IN_MANIFEST",
  "EA5E1_A0_STATE_ANCHOR_DRIFT",
  "EA5E1_SCHEDULER_SLOT_ALREADY_EXISTS",
  "EA5E1_SCHEDULER_CURSOR_ALREADY_EXISTS",
  "EA5E1_C8_REPLAY_200MM_MARKER_FORBIDDEN",
  "database_write_count: 0",
  "formal_o00_start_authorized: false",
  "formal_execution_count: \"0/24\""
]) if (!executor.includes(marker)) fail(`EA5E1_EXECUTOR_MARKER_MISSING:${marker}`);
for (const forbidden of [
  "fetch(",
  "FORMAL_RAW_S3_ACCESS_KEY_ID",
  "FORMAL_RAW_S3_SECRET_ACCESS_KEY",
  "CONTROLLED_SYNTHETIC_REPLAY_PROXY\"",
  "field_c8_demo\"",
  "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1\""
]) {
  if (executor.includes(forbidden)) fail(`EA5E1_EXECUTOR_FORBIDDEN:${forbidden}`);
}
if (/\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE\s+|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(executor)) {
  fail("EA5E1_EXECUTOR_DATABASE_WRITE_SQL_FORBIDDEN");
}

const workflow = fs.readFileSync(workflowPath, "utf8");
if (workflow.includes("pull_request_target")) fail("EA5E1_PULL_REQUEST_TARGET_FORBIDDEN");
for (const marker of [
  "GEOX_MCFT_CAP09_S6_DATABASE_URL: ${{ secrets.GEOX_MCFT_CAP09_S6_DATABASE_URL }}",
  "GEOX_MCFT_CAP09_S6_FORMAL_WINDOW_ENABLED: ${{ vars.GEOX_MCFT_CAP09_S6_FORMAL_WINDOW_ENABLED }}",
  "3031",
  "31359896349",
  "9051972358",
  "sha256:8df1356d8909f93b76cd7d24a4d467427d3a2f5f98cffd7f7fc38b124379ece6",
  "EA5E1_MANIFEST_DOES_NOT_EQUAL_IMMUTABLE_A06C_CONFIG_CHAIN",
  "ACCEPTANCE_MCFT_CAP_09_EA5E1_POST_REBASE_FORMAL_DB_PREFLIGHT_WINDOW_INPUT_MANIFEST.cjs",
  "EXECUTE_MCFT_CAP_09_EA5E1_POST_REBASE_FORMAL_DB_PREFLIGHT.ts",
  "sha256:060184569523aee985ea846aac5407cef1ef288367b748e1621297c03db8999d",
  "Upload immutable EA5E1 proof artifact"
]) if (!workflow.includes(marker)) fail(`EA5E1_WORKFLOW_MARKER_MISSING:${marker}`);
if (/\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE\s+|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(workflow)) {
  fail("EA5E1_WORKFLOW_DIRECT_DATABASE_WRITE_SQL_FORBIDDEN");
}
if (workflow.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID") || workflow.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY")) {
  fail("EA5E1_RAW_STORE_CREDENTIALS_FORBIDDEN");
}

fs.mkdirSync("acceptance-output", { recursive: true });
const out = {
  schema_version: "geox_mcft_cap09_ea5e1_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  immutable_manifest_blob_verified: true,
  immutable_manifest_content_sha256_verified: true,
  exact_24_manifest_pins_verified_against_a06a_crop_contexts: true,
  a06c_exact_artifact_binding_required_by_workflow: true,
  read_only_formal_db_preflight_required: true,
  database_write_count: 0,
  scheduler_slot_write_count: 0,
  scheduler_cursor_write_count: 0,
  runtime_tick_count: 0,
  ea5e1_effective_after_merge: true,
  ea5e2_authorized_after_merge: true,
  ea5e_complete: false,
  formal_o00_start_authorized: false,
  formal_window_started: false,
  formal_execution_count: "0/24",
  mcft_cap09_completed: false
};
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5E1_GOVERNANCE_RESULT.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
