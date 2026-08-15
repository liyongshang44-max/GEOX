#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const AUTH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTED-A0-AUTHORITY-V1.json";
const SOURCE = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-T3R1-FRESH-BOOTSTRAP-EFFECTIVENESS-V1.json";
const CROP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json";
const HISTORICAL_SUCCESSOR = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V1.json";
const FORMAL_PREFLIGHT = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts";
const OBSERVER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts";

const EXPECTED_SOURCE_BLOB = "15ca30e69e18f9f41c7000d6bc1395deebac7211";
const EXPECTED_CROP_BLOB = "757e4b9f4fdcd631eea97fca85614a1b61ef0c4a";
const EXPECTED_HISTORICAL_SUCCESSOR_BLOB = "da6b62cb193f2b30ead31a8e788f88389e15ede0";

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function blob(file) { return execFileSync("git", ["rev-parse", `HEAD:${file}`], { encoding: "utf8" }).trim(); }

const authority = readJson(AUTH);
const source = readJson(SOURCE);
const crop = readJson(CROP);

assert.equal(authority.schema_version, "geox_mcft_cap09_t3r1_persisted_a0_authority_v1");
assert.equal(authority.record_status, "PERSISTED_T3R1_A0_EFFECTIVE_NOT_EA5E2_ACTIVATION");
assert.equal(blob(SOURCE), EXPECTED_SOURCE_BLOB, "FRESH_BOOTSTRAP_EFFECTIVENESS_BLOB_DRIFT");
assert.equal(blob(CROP), EXPECTED_CROP_BLOB, "T3R1_CROP_AUTHORITY_BLOB_DRIFT");
assert.equal(blob(HISTORICAL_SUCCESSOR), EXPECTED_HISTORICAL_SUCCESSOR_BLOB, "HISTORICAL_SUCCESSOR_AUTHORITY_MUTATED");

assert.equal(authority.source_effectiveness.path, SOURCE);
assert.equal(authority.source_effectiveness.blob_sha, EXPECTED_SOURCE_BLOB);
assert.equal(source.status, "PASS");
assert.equal(source.effect_boundary.fresh_t3r1_bootstrap_complete, true);
assert.equal(authority.bootstrap_execution.workflow_run_id, source.bootstrap_workflow_run_id);
assert.equal(authority.bootstrap_execution.subject_sha, source.bootstrap_subject_sha);
assert.equal(authority.bootstrap_execution.artifact_id, source.bootstrap_artifact_id);
assert.equal(authority.bootstrap_execution.artifact_zip_sha256, source.bootstrap_artifact_zip_sha256);

assert.deepEqual(authority.formal_scope, source.formal_scope);
assert.equal(authority.database_identity.database_name, source.database_identity.database_name);
assert.equal(authority.database_identity.neon_project_id, source.database_identity.neon_project_id);
assert.equal(authority.database_identity.neon_branch_id, source.database_identity.neon_branch_id);
assert.equal(authority.database_identity.t1r1_database_reused, false);
assert.equal(authority.database_identity.simulation_branch_reused, false);
assert.notEqual(authority.database_identity.database_name, authority.database_identity.forbidden_t1r1_database_name);
assert.notEqual(authority.database_identity.neon_branch_id, authority.database_identity.forbidden_simulation_branch_id);

assert.equal(authority.crop_context.path, source.crop_authority_path);
assert.equal(authority.crop_context.blob_sha, source.crop_authority_blob_sha);
assert.equal(authority.crop_context.blob_sha, EXPECTED_CROP_BLOB);
assert.equal(crop.scope.field_id, authority.formal_scope.field_id);
assert.equal(crop.scope.season_id, authority.formal_scope.season_id);
assert.equal(crop.scope.zone_id, authority.formal_scope.zone_id);
assert.equal(authority.crop_context.bootstrap_stage_code, source.crop_stage_code);

assert.equal(authority.persisted_a0.logical_time, source.bootstrap_logical_time);
assert.equal(authority.persisted_a0.runtime_config_ref, source.persisted_a0.runtime_config_ref);
assert.equal(authority.persisted_a0.runtime_config_hash, source.persisted_a0.runtime_config_hash);
assert.equal(authority.persisted_a0.binding_mode, source.persisted_a0.binding_mode);
assert.equal(authority.persisted_a0.config_parent_chain_verified, true);
assert.equal(authority.persisted_a0.explicit_ref_hash_pin_only, true);
assert.equal(authority.persisted_a0.external_a0_member_count, source.persisted_counts.external_a0_member_count);

assert.equal(authority.persisted_successor_config_chain.total_runtime_config_count, source.persisted_counts.runtime_config_total);
assert.equal(authority.persisted_successor_config_chain.hourly_successor_runtime_config_count, source.persisted_counts.hourly_runtime_config_total);
assert.equal(authority.persisted_successor_config_chain.o00_candidate_logical_time, source.o00_candidate_logical_time);
assert.equal(authority.persisted_successor_config_chain.o00_candidate_runtime_config_ref, source.o00_candidate_runtime_config.runtime_config_ref);
assert.equal(authority.persisted_successor_config_chain.o00_candidate_runtime_config_hash, source.o00_candidate_runtime_config.runtime_config_hash);

assert.equal(authority.persisted_inventory.facts_total, source.persisted_counts.facts_total);
assert.equal(authority.persisted_inventory.canonical_twin_facts_total, source.persisted_counts.canonical_twin_facts_total);
assert.equal(authority.persisted_inventory.runtime_config_total, source.persisted_counts.runtime_config_total);
assert.equal(authority.persisted_inventory.t1r1_scope_row_count, 0);
assert.equal(authority.persisted_inventory.scheduler_slot_count, 0);
assert.equal(authority.persisted_inventory.scheduler_cursor_count, 0);
assert.equal(authority.fresh_external_soil_metadata.observed_at, source.fresh_soil_observed_at);
assert.equal(authority.fresh_external_soil_metadata.available_to_runtime_at, source.fresh_soil_available_to_runtime_at);
assert.equal(authority.fresh_external_soil_metadata.raw_values_published, false);

assert.equal(authority.immutability_and_successor_rules.t1r1_state_config_fact_relabeling_authorized, false);
assert.equal(authority.immutability_and_successor_rules.cross_scope_stitching_authorized, false);
assert.equal(authority.immutability_and_successor_rules.a0_ref_hash_rewrite_authorized, false);
assert.equal(authority.immutability_and_successor_rules.implicit_latest_runtime_config_lookup_authorized, false);
assert.equal(authority.effect_boundary.persisted_a0_authority_effective, true);
assert.equal(authority.effect_boundary.ea5e2_timing_budget_requalification_required_separately, true);
assert.equal(authority.effect_boundary.ea5e2_operational_activation_authorized, false);
assert.equal(authority.effect_boundary.formal_o00_start_authorized, false);
assert.equal(authority.effect_boundary.formal_window_started, false);
assert.equal(authority.effect_boundary.scheduler_started, false);
assert.equal(authority.effect_boundary.mcft_cap09_completed, false);

for (const consumer of [FORMAL_PREFLIGHT, OBSERVER]) {
  const text = read(consumer);
  assert(text.includes("GEOX-MCFT-CAP-09-EA5E2-T3R1-FRESH-BOOTSTRAP-EFFECTIVENESS-V1.json"), `FRESH_T3R1_A0_CONSUMER_BINDING_MISSING:${consumer}`);
  assert(text.includes("persisted_a0"), `PERSISTED_A0_REF_HASH_CONSUMER_MISSING:${consumer}`);
}

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_t3r1_persisted_a0_authority_acceptance_v1",
  status: "PASS",
  authority_path: AUTH,
  fresh_bootstrap_effectiveness_blob_sha: EXPECTED_SOURCE_BLOB,
  crop_authority_blob_sha: EXPECTED_CROP_BLOB,
  formal_scope: authority.formal_scope,
  database_name: authority.database_identity.database_name,
  a0_runtime_config_ref: authority.persisted_a0.runtime_config_ref,
  a0_runtime_config_hash: authority.persisted_a0.runtime_config_hash,
  o00_candidate_runtime_config_ref: authority.persisted_successor_config_chain.o00_candidate_runtime_config_ref,
  exact_runtime_config_count: authority.persisted_inventory.runtime_config_total,
  scheduler_slot_count: authority.persisted_inventory.scheduler_slot_count,
  scheduler_cursor_count: authority.persisted_inventory.scheduler_cursor_count,
  ea5e2_operational_activation_authorized: false,
  formal_o00_start_authorized: false,
  database_write_count: 0,
  raw_values_emitted: false
}));
