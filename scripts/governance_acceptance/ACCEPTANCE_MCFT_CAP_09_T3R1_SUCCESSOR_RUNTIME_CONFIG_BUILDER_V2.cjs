#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const BASE = "c268d3ff037a01fee51061bc82daeda9309d6e85";
const P = {
  builder: "apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v2.ts",
  acceptance: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_BUILDER_V2.ts",
  authority: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-RUNTIME-CONFIG-BUILDER-QUALIFICATION-V2.json",
  workflow: ".github/workflows/mcft-cap-09-t3r1-successor-runtime-config-builder-v2.yml",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_BUILDER_V2.cjs",
};
const OUT = "acceptance-output/MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_BUILDER_V2_GOVERNANCE_RESULT.json";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, file) => git("rev-parse", `${ref}:${file}`);
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const eq = (actual, expected, code) => { if (actual !== expected) throw new Error(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); };
const yes = (value, code) => eq(value, true, code);
const no = (value, code) => eq(value, false, code);

function main() {
  const base = process.env.MCFT_BASE_SHA;
  eq(base, BASE, "T3R1_SUCCESSOR_BUILDER_EXACT_BASE_REQUIRED");
  const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed), JSON.stringify(Object.values(P).sort()), "T3R1_SUCCESSOR_BUILDER_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");

  const predecessorPins = {
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json": "9c12e31b0a9a3d33e027f0677ad1cf2d92a5097f",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTED-A0-AUTHORITY-V1.json": "e44b43d71d339c39e017737d44c7c9a17a67f5be",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json": "757e4b9f4fdcd631eea97fca85614a1b61ef0c4a",
    "apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts": "59b1e1d177c90d72fdaf2a25c4fa7fb57689f50f",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md": "a037b24757992987fc24ce8b6afac6c8eabca3ed",
  };
  for (const [file, sha] of Object.entries(predecessorPins)) {
    eq(blob(base, file), sha, `T3R1_SUCCESSOR_BUILDER_BASE_PIN:${file}`);
    eq(blob("HEAD", file), sha, `T3R1_SUCCESSOR_BUILDER_PREDECESSOR_MUTATED:${file}`);
  }
  eq(blob("HEAD", P.builder), "ee624b14bcb279d846f6331b31fb6abee56731f9", "T3R1_SUCCESSOR_BUILDER_IMPLEMENTATION_BLOB_REQUIRED");
  eq(blob("HEAD", P.acceptance), "40df2c71696644228a8259422d87b6b7354665cf", "T3R1_SUCCESSOR_BUILDER_ACCEPTANCE_BLOB_REQUIRED");

  const selection = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json");
  const selectionEffect = selection.effect_if_exact_head_proof_passes_and_candidate_merges_before_selection_deadline;
  yes(selectionEffect.successor_epoch_selection_effective, "T3R1_SUCCESSOR_BUILDER_SELECTION_EFFECT_REQUIRED");
  yes(selectionEffect.successor_runtime_config_builder_qualification_authorized, "T3R1_SUCCESSOR_BUILDER_AUTHORIZED_REQUIRED");
  no(selectionEffect.successor_runtime_config_persistence_authorized, "T3R1_SUCCESSOR_BUILDER_PREMATURE_PERSISTENCE_FORBIDDEN");
  no(selectionEffect.ea5e3_authorized, "T3R1_SUCCESSOR_BUILDER_PREMATURE_EA5E3_FORBIDDEN");
  no(selectionEffect.formal_window_started, "T3R1_SUCCESSOR_BUILDER_PREMATURE_FORMAL_START_FORBIDDEN");

  const a = json(P.authority);
  eq(a.schema_version, "geox_mcft_cap09_t3r1_successor_runtime_config_builder_qualification_v2", "T3R1_SUCCESSOR_BUILDER_AUTHORITY_SCHEMA_REQUIRED");
  eq(a.base_protected_main_sha, base, "T3R1_SUCCESSOR_BUILDER_AUTHORITY_BASE_REQUIRED");
  eq(a.successor_epoch_selection_effectiveness.pr_number, 3190, "T3R1_SUCCESSOR_BUILDER_SELECTION_PR_REQUIRED");
  eq(a.successor_epoch_selection_effectiveness.merge_commit_sha, base, "T3R1_SUCCESSOR_BUILDER_SELECTION_MERGE_REQUIRED");
  eq(a.successor_epoch_selection_effectiveness.merged_at_utc, "2026-08-16T07:40:52.000Z", "T3R1_SUCCESSOR_BUILDER_SELECTION_TIME_REQUIRED");
  eq(a.successor_epoch_selection_effectiveness.selected_o00, "2026-08-17T20:00:00.000Z", "T3R1_SUCCESSOR_BUILDER_O00_REQUIRED");
  eq(a.successor_epoch_selection_effectiveness.ea5e3_readiness_deadline, "2026-08-17T08:00:00.000Z", "T3R1_SUCCESSOR_BUILDER_READINESS_DEADLINE_REQUIRED");

  const c = a.builder_contract;
  yes(c.pure_domain_builder, "T3R1_SUCCESSOR_BUILDER_PURE_REQUIRED");
  for (const key of ["filesystem_access", "database_access", "provider_network_access", "scheduler_access", "wall_clock_access", "environment_access", "persistence_access", "stale_a0_crop_context_reuse_for_successor_slots_allowed", "collision_with_existing_persisted_25_config_baseline_allowed"]) no(c[key], `T3R1_SUCCESSOR_BUILDER_FALSE_REQUIRED:${key}`);
  eq(c.exact_input_slot_context_count, 24, "T3R1_SUCCESSOR_BUILDER_24_INPUTS_REQUIRED");
  eq(c.exact_output_runtime_config_count, 24, "T3R1_SUCCESSOR_BUILDER_24_OUTPUTS_REQUIRED");
  eq(c.persisted_a0_parent_ref, "external_formal_runtime_config_49959a28cfc9eb357bf18f9d", "T3R1_SUCCESSOR_BUILDER_A0_REF_REQUIRED");
  eq(c.persisted_a0_parent_hash, "sha256:5f11788fd049a3eae190d566e6faa28f428637e11f2c90b4e0aaea67e6f14e48", "T3R1_SUCCESSOR_BUILDER_A0_HASH_REQUIRED");
  yes(c.o00_parent_must_equal_persisted_a0, "T3R1_SUCCESSOR_BUILDER_O00_PARENT_REQUIRED");
  yes(c.o01_o23_parent_must_equal_immediately_preceding_successor_config, "T3R1_SUCCESSOR_BUILDER_CHAIN_REQUIRED");
  yes(c.slot_crop_context_hash_must_equal_successor_selection_authority, "T3R1_SUCCESSOR_BUILDER_CONTEXT_PIN_REQUIRED");
  yes(c.deterministic_double_build_required, "T3R1_SUCCESSOR_BUILDER_DETERMINISM_REQUIRED");

  const focused = a.focused_acceptance_contract;
  eq(focused.formal_database_access_mode, "READ_ONLY_A0_AND_BASELINE_VERIFICATION", "T3R1_SUCCESSOR_BUILDER_DB_READ_ONLY_REQUIRED");
  eq(focused.persisted_runtime_config_baseline_count, 25, "T3R1_SUCCESSOR_BUILDER_25_BASELINE_REQUIRED");
  eq(focused.scheduler_slot_count_required, 0, "T3R1_SUCCESSOR_BUILDER_SLOT_ZERO_REQUIRED");
  eq(focused.scheduler_cursor_count_required, 0, "T3R1_SUCCESSOR_BUILDER_CURSOR_ZERO_REQUIRED");
  for (const key of ["database_write_count", "raw_object_write_count", "provider_request_count", "scheduler_slot_write_count", "scheduler_cursor_write_count"]) eq(focused[key], 0, `T3R1_SUCCESSOR_BUILDER_ZERO_SIDE_EFFECT:${key}`);

  const effect = a.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
  yes(effect.successor_runtime_config_builder_v2_qualified, "T3R1_SUCCESSOR_BUILDER_EFFECT_REQUIRED");
  yes(effect.successor_runtime_config_persistence_authorized, "T3R1_SUCCESSOR_BUILDER_PERSISTENCE_AUTH_REQUIRED");
  no(effect.successor_runtime_configs_persisted, "T3R1_SUCCESSOR_BUILDER_PERSISTENCE_PREMATURE");
  no(effect.ea5e3_authorized, "T3R1_SUCCESSOR_BUILDER_EA5E3_PREMATURE");
  no(effect.formal_o00_start_authorized, "T3R1_SUCCESSOR_BUILDER_O00_PREMATURE");
  no(effect.formal_window_started, "T3R1_SUCCESSOR_BUILDER_WINDOW_PREMATURE");
  eq(effect.formal_execution_count, "0/24", "T3R1_SUCCESSOR_BUILDER_ZERO_OF_24_REQUIRED");
  no(effect.mcft_cap09_completed, "T3R1_SUCCESSOR_BUILDER_COMPLETION_PREMATURE");
  eq(a.next_legal_successor_if_effective, "S6-T3R1-SUCCESSOR-RUNTIME-CONFIG-PERSISTENCE-V2", "T3R1_SUCCESSOR_BUILDER_NEXT_FRONTIER_REQUIRED");

  const source = fs.readFileSync(P.builder, "utf8");
  for (const marker of ["buildExternalFormalSuccessorRuntimeConfigBundleV2", "compileExternalFormalRuntimeConfigV1", "MCFT_CAP09_T3R1_SUCCESSOR_O00_V2", "MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_REF_V2", "context_hash: slot.crop_stage_context_hash", "parent_runtime_config_ref: parent.object_id", "runtime_config_count: 24", "database_write_count: 0", "formal_window_started: false"]) if (!source.includes(marker)) throw new Error(`T3R1_SUCCESSOR_BUILDER_MARKER_MISSING:${marker}`);
  for (const forbidden of ["process.env", "fetch(", "node:fs", "node:http", "node:https", " from \"pg\"", "INSERT INTO", "UPDATE ", "DELETE FROM", "Date.now(", "new Date()", "CONTROLLED_SYNTHETIC_REPLAY_PROXY", "field_kbs_mcse_t1r1"]) if (source.includes(forbidden)) throw new Error(`T3R1_SUCCESSOR_BUILDER_PURE_BOUNDARY_FORBIDDEN:${forbidden}`);

  const workflow = fs.readFileSync(P.workflow, "utf8");
  if (workflow.includes("pull_request_target")) throw new Error("T3R1_SUCCESSOR_BUILDER_PULL_REQUEST_TARGET_FORBIDDEN");
  for (const marker of ["2026-08-17T08:00:00.000Z", "31934176595", "9260158509", "BEGIN TRANSACTION READ ONLY", "ACCEPTANCE_MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_BUILDER_V2.ts", "successor_runtime_configs_persisted!==false", "formal_window_started!==false"]) if (!workflow.includes(marker)) throw new Error(`T3R1_SUCCESSOR_BUILDER_WORKFLOW_MARKER_REQUIRED:${marker}`);

  const out = {
    schema_version: "geox_mcft_cap09_t3r1_successor_runtime_config_builder_v2_governance_result",
    status: "PASS",
    base_sha: base,
    subject_sha: git("rev-parse", "HEAD"),
    exact_changed_file_count: changed.length,
    pure_builder_boundary_verified: true,
    persisted_a0_ref_hash_pinned: true,
    exact_successor_runtime_config_count: 24,
    builder_qualified_after_merge: true,
    successor_runtime_config_persistence_authorized_after_merge: true,
    successor_runtime_configs_persisted: false,
    ea5e3_authorized: false,
    formal_window_started: false,
    formal_execution_count: "0/24",
    mcft_cap09_completed: false,
  };
  fs.mkdirSync("acceptance-output", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out));
}

main();
