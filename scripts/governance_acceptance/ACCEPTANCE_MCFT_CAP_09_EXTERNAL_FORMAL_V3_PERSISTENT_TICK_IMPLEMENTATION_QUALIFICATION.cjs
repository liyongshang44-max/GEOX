#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const BASE = "c31a5533521a671d6059cadfe4209182ce3b1926";
const OUT = "acceptance-output/MCFT_CAP_09_EXTERNAL_FORMAL_V3_PERSISTENT_TICK_IMPLEMENTATION_QUALIFICATION_RESULT.json";
const P = {
  service: "apps/server/src/runtime/twin_runtime/external_formal_v3_persistent_tick_service_v1.ts",
  acceptance: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EXTERNAL_FORMAL_V3_PERSISTENT_TICK.ts",
  authority: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EXTERNAL-FORMAL-V3-PERSISTENT-TICK-IMPLEMENTATION-QUALIFICATION-V1.json",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EXTERNAL_FORMAL_V3_PERSISTENT_TICK_IMPLEMENTATION_QUALIFICATION.cjs",
  workflow: ".github/workflows/mcft-cap-09-external-formal-v3-persistent-tick-qualification.yml",
};

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function json(file) { return JSON.parse(read(file)); }
function blob(ref, file) { return git("rev-parse", `${ref}:${file}`); }
function eq(actual, expected, code) { if (actual !== expected) throw new Error(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
function yes(value, code) { eq(value, true, code); }
function no(value, code) { eq(value, false, code); }
function has(text, marker, code) { if (!text.includes(marker)) throw new Error(`${code}:${marker}`); }
function lacks(text, marker, code) { if (text.includes(marker)) throw new Error(`${code}:${marker}`); }
function result(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
}

function main() {
  const base = process.env.MCFT_BASE_SHA;
  eq(base, BASE, "EXTERNAL_FORMAL_V3_EXACT_BASE_REQUIRED");
  const subject = git("rev-parse", "HEAD");
  const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed), JSON.stringify(Object.values(P).sort()), "EXTERNAL_FORMAL_V3_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");

  const immutable = {
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md": "e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md": "c5a98ca789027e1bf051ec56bf1b7e76b98a0891",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md": "ef1e4344e5915e2c591cf7cfc9b6c2bf27f8bc3b",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-POST-ACTIVATION-READINESS-AUDIT-V1.json": "df8b60cdcd21ad6b92665d8fc92e45f95836cffe",
    "apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts": "71df4e47b0c62b7c6f2126e33896849af56273ca",
    "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts": "e5ed3c677bf55e4eee3cbb67a52e3b6886b8f259",
    "apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.ts": "b8ef889de8d846e6ae74e3235f25944a38ccaa1f",
    "apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts": "efc3bcdf06dc236af28226c76458dd8633adfd82",
  };
  for (const [file, sha] of Object.entries(immutable)) {
    eq(blob(base, file), sha, `EXTERNAL_FORMAL_V3_BASE_PIN:${file}`);
    eq(blob("HEAD", file), sha, `EXTERNAL_FORMAL_V3_PREDECESSOR_MUTATED:${file}`);
  }
  eq(blob("HEAD", P.service), "32a7084b5fff1b801f4491cdb46fc60ceed82d90", "EXTERNAL_FORMAL_V3_SERVICE_BLOB_REQUIRED");
  eq(blob("HEAD", P.acceptance), "b798a188189376510d6a0f1b8be488af120e589c", "EXTERNAL_FORMAL_V3_ACCEPTANCE_BLOB_REQUIRED");
  eq(blob("HEAD", P.authority), "961294d5ac9b37d9f8147260a4606e1a9f2ffaef", "EXTERNAL_FORMAL_V3_AUTHORITY_BLOB_REQUIRED");

  const a = json(P.authority);
  eq(a.schema_version, "geox_mcft_cap09_external_formal_v3_persistent_tick_implementation_qualification_v1", "EXTERNAL_FORMAL_V3_AUTHORITY_SCHEMA_REQUIRED");
  eq(a.base_protected_main_sha, base, "EXTERNAL_FORMAL_V3_AUTHORITY_BASE_REQUIRED");
  eq(a.record_status, "IMPLEMENTATION_QUALIFICATION_ONLY_NOT_FORMAL_EXECUTION_AUTHORITY", "EXTERNAL_FORMAL_V3_IMPLEMENTATION_ONLY_STATUS_REQUIRED");
  eq(a.qualification_boundary.exact_changed_file_count, 5, "EXTERNAL_FORMAL_V3_FIVE_FILE_AUTHORITY_REQUIRED");
  eq(a.qualification_boundary.runtime_service_source_change_count, 1, "EXTERNAL_FORMAL_V3_ONE_RUNTIME_SERVICE_REQUIRED");
  eq(a.qualification_boundary.legacy_formal_workflow_change_count, 0, "EXTERNAL_FORMAL_V3_LEGACY_WORKFLOW_CHANGE_FORBIDDEN");
  eq(a.qualification_boundary.operational_activation_critical_boundary_change_count, 0, "EXTERNAL_FORMAL_V3_ACTIVATION_BOUNDARY_CHANGE_FORBIDDEN");

  const c = a.implementation_contract;
  yes(c.new_separate_external_formal_entrypoint, "EXTERNAL_FORMAL_V3_SEPARATE_ENTRYPOINT_REQUIRED");
  no(c.legacy_stage_1b_runner_delegation, "EXTERNAL_FORMAL_V3_LEGACY_RUNNER_FORBIDDEN");
  no(c.legacy_stage_1b_v2_runner_delegation, "EXTERNAL_FORMAL_V3_LEGACY_V2_FORBIDDEN");
  no(c.static_canonical_input_secret_used, "EXTERNAL_FORMAL_V3_STATIC_INPUT_FORBIDDEN");
  no(c.implicit_latest_runtime_config_lookup, "EXTERNAL_FORMAL_V3_IMPLICIT_LATEST_CONFIG_FORBIDDEN");
  yes(c.exact_manifest_slot_pin_required, "EXTERNAL_FORMAL_V3_MANIFEST_PIN_REQUIRED");
  yes(c.scheduler_claim_must_already_exist, "EXTERNAL_FORMAL_V3_PRECLAIMED_SLOT_REQUIRED");
  no(c.service_may_claim_scheduler_slot, "EXTERNAL_FORMAL_V3_SERVICE_CLAIM_FORBIDDEN");
  yes(c.scheduler_claim_reused_as_runtime_lease, "EXTERNAL_FORMAL_V3_SAME_CLAIM_LEASE_REQUIRED");
  no(c.second_runtime_write_lease_authorized, "EXTERNAL_FORMAL_V3_SECOND_LEASE_FORBIDDEN");
  yes(c.same_fencing_token_for_a_and_b_required, "EXTERNAL_FORMAL_V3_SAME_FENCE_REQUIRED");
  eq(c.scheduler_eligibility_offset_minutes, 420, "EXTERNAL_FORMAL_V3_420M_REQUIRED");
  eq(c.exact_interval_cutoff_offset_minutes, 432, "EXTERNAL_FORMAL_V3_432M_REQUIRED");
  eq(c.runtime_observer_offset_minutes, 437, "EXTERNAL_FORMAL_V3_437M_REQUIRED");
  eq(c.runtime_observer_max_start_skew_minutes, 10, "EXTERNAL_FORMAL_V3_OBSERVER_SKEW_REQUIRED");
  yes(c.database_only_external_evidence_source_required, "EXTERNAL_FORMAL_V3_DB_ONLY_REQUIRED");
  no(c.runtime_provider_fetch_authorized, "EXTERNAL_FORMAL_V3_PROVIDER_FETCH_FORBIDDEN");
  no(c.runtime_r2_head_authorized, "EXTERNAL_FORMAL_V3_R2_HEAD_FORBIDDEN");
  yes(c.runtime_config_exact_ref_hash_read_required, "EXTERNAL_FORMAL_V3_CONFIG_PIN_REQUIRED");
  yes(c.runtime_config_parent_matches_previous_persisted_state_required, "EXTERNAL_FORMAL_V3_PARENT_CONFIG_REQUIRED");
  yes(c.a1_pending_b_recovery_from_canonical_forecast_no_evidence_reload_required, "EXTERNAL_FORMAL_V3_PENDING_B_RECOVERY_REQUIRED");
  yes(c.a2_blocked_scenario_forbidden, "EXTERNAL_FORMAL_V3_A2_SCENARIO_FORBIDDEN");
  eq(c.a1_scenario_point_count, 216, "EXTERNAL_FORMAL_V3_216_SCENARIO_POINTS_REQUIRED");

  const service = read(P.service);
  for (const marker of [
    "EXTERNAL_FORMAL_V3_SCHEDULER_ELIGIBILITY_OFFSET_MINUTES_V1 = 420",
    "EXTERNAL_FORMAL_V3_EXACT_INTERVAL_CUTOFF_OFFSET_MINUTES_V1 = 432",
    "EXTERNAL_FORMAL_V3_RUNTIME_OBSERVER_OFFSET_MINUTES_V1 = 437",
    "EXTERNAL_FORMAL_V3_RUNTIME_OBSERVER_MAX_START_SKEW_MINUTES_V1 = 10",
    "ExternalFormalV3ManifestSlotPinV1",
    "runtime_config_ref",
    "runtime_config_hash",
    "crop_stage_context_ref",
    "crop_stage_context_hash",
    "executeExternalFormalCap04CandidateV1",
    "commitARecordSet",
    "readARecordSet",
    "commitScenarioSet",
    "readScenarioSetBySourceForecast",
    "RECOVERED_PENDING_SCENARIO",
    "EXISTING_A1_WITH_SCENARIO",
    "EXTERNAL_FORMAL_V3_A2_SCENARIO_FORBIDDEN",
    "scheduler_claim_reused_as_runtime_lease: true",
    "second_runtime_write_lease_acquired: false",
    "runtime_provider_request_count: 0",
    "runtime_r2_head_count: 0"
  ]) has(service, marker, "EXTERNAL_FORMAL_V3_SERVICE_RULE_MISSING");
  for (const forbidden of [
    "acquireLease(",
    "fetch(",
    "axios",
    "process.env",
    "node:fs",
    "node:http",
    "node:https",
    "GEOX_MCFT_CAP09_S6_CANONICAL_INPUT_JSON",
    "RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW",
    "RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW_V2",
    "mcft_cap09_s6_formal_authority_v1"
  ]) lacks(service, forbidden, "EXTERNAL_FORMAL_V3_FORBIDDEN_CAPABILITY_PRESENT");

  const acceptance = read(P.acceptance);
  for (const marker of [
    "INSERTED_A1_WITH_SCENARIO",
    "EXISTING_A1_WITH_SCENARIO",
    "RECOVERED_PENDING_SCENARIO",
    "QUALIFICATION_INJECTED_SCENARIO_COMMIT_FAILURE",
    "EXTERNAL_FORMAL_V3_OBSERVER_START_SKEW_OUT_OF_RANGE",
    "EXTERNAL_FORMAL_V3_RUNTIME_CONFIG_HASH_MISMATCH",
    "EXISTING_A2_BLOCKED",
    "existing canonical A must not reload provider/ingress evidence",
    "pending-B recovery must use canonical Forecast without reloading Evidence",
    "scheduler_claim_reused_as_runtime_lease: true",
    "second_runtime_write_lease_acquired: false",
    "real_formal_database_write_count: 0"
  ]) has(acceptance, marker, "EXTERNAL_FORMAL_V3_ACCEPTANCE_RULE_MISSING");
  for (const forbidden of [
    "GEOX_MCFT_CAP09_S6_DATABASE_URL",
    "MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY",
    "fetch(\"http",
    "workflow_dispatch:"
  ]) lacks(acceptance, forbidden, "EXTERNAL_FORMAL_V3_ACCEPTANCE_SECRET_OR_LIVE_CAPABILITY_FORBIDDEN");

  for (const [key, value] of Object.entries(a.side_effect_boundary)) {
    if (key.endsWith("_write_count")) eq(value, 0, `EXTERNAL_FORMAL_V3_ZERO_SIDE_EFFECT:${key}`);
  }
  no(a.side_effect_boundary.operational_activation_qualified, "EXTERNAL_FORMAL_V3_PREMATURE_ACTIVATION_FORBIDDEN");
  no(a.side_effect_boundary.successor_epoch_selected, "EXTERNAL_FORMAL_V3_PREMATURE_EPOCH_FORBIDDEN");
  no(a.side_effect_boundary.ea5e3_authorized, "EXTERNAL_FORMAL_V3_PREMATURE_EA5E3_FORBIDDEN");
  no(a.side_effect_boundary.formal_window_started, "EXTERNAL_FORMAL_V3_PREMATURE_O00_FORBIDDEN");
  yes(a.effect_if_exact_head_qualification_passes_and_candidate_merges.external_formal_v3_persistent_tick_implementation_qualified, "EXTERNAL_FORMAL_V3_IMPL_EFFECT_REQUIRED");
  no(a.effect_if_exact_head_qualification_passes_and_candidate_merges.external_formal_v3_formal_execution_authorized, "EXTERNAL_FORMAL_V3_FORMAL_EXECUTION_EFFECT_FORBIDDEN");

  const workflow = read(P.workflow);
  has(workflow, "ACCEPTANCE_MCFT_CAP_09_EXTERNAL_FORMAL_V3_PERSISTENT_TICK.ts", "EXTERNAL_FORMAL_V3_FOCUSED_ACCEPTANCE_REQUIRED");
  has(workflow, "ACCEPTANCE_MCFT_CAP_09_EXTERNAL_FORMAL_V3_PERSISTENT_TICK_IMPLEMENTATION_QUALIFICATION.cjs", "EXTERNAL_FORMAL_V3_FOCUSED_GATE_REQUIRED");
  lacks(workflow, "workflow_dispatch:", "EXTERNAL_FORMAL_V3_MANUAL_LIVE_TRIGGER_FORBIDDEN");
  lacks(workflow, "GEOX_MCFT_CAP09_S6_DATABASE_URL", "EXTERNAL_FORMAL_V3_FORMAL_SECRET_FORBIDDEN");
  lacks(workflow, "MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY", "EXTERNAL_FORMAL_V3_R2_SECRET_FORBIDDEN");

  result({
    schema_version: "geox_mcft_cap09_external_formal_v3_persistent_tick_implementation_qualification_result_v1",
    status: "PASS",
    base_sha: base,
    subject_sha: subject,
    exact_changed_file_count: changed.length,
    exact_boundary: "FIVE_FILES",
    external_formal_v3_persistent_tick_implementation_qualified: true,
    external_formal_v3_formal_execution_authorized: false,
    operational_activation_qualified: false,
    successor_epoch_selected: false,
    scheduler_eligibility_offset_minutes: 420,
    exact_interval_cutoff_offset_minutes: 432,
    runtime_observer_offset_minutes: 437,
    observer_max_start_skew_minutes: 10,
    scheduler_claim_reused_as_runtime_lease: true,
    second_runtime_write_lease_authorized: false,
    runtime_provider_request_count: 0,
    runtime_r2_head_count: 0,
    formal_database_write_count: 0,
    formal_raw_prefix_write_count: 0,
    formal_scheduler_write_count: 0,
    formal_canonical_runtime_write_count: 0,
    ea5e3_authorized: false,
    formal_window_started: false,
    next_preparatory_frontier: a.next_preparatory_frontier_if_qualified
  });
}

try { main(); }
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  let subject = null;
  try { subject = git("rev-parse", "HEAD"); } catch {}
  result({
    schema_version: "geox_mcft_cap09_external_formal_v3_persistent_tick_implementation_qualification_result_v1",
    status: "FAIL",
    base_sha: process.env.MCFT_BASE_SHA ?? null,
    subject_sha: subject,
    error: message,
    fail_closed: true,
    external_formal_v3_persistent_tick_implementation_qualified: false,
    external_formal_v3_formal_execution_authorized: false,
    operational_activation_qualified: false,
    successor_epoch_selected: false,
    ea5e3_authorized: false,
    formal_window_started: false,
    formal_database_write_count: 0,
    formal_raw_prefix_write_count: 0,
    formal_scheduler_write_count: 0,
    formal_canonical_runtime_write_count: 0
  });
  process.exitCode = 1;
}
