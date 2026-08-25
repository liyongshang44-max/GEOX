#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_V13_AUTONOMOUS_FORCING_FOUNDATION_GOVERNANCE.json");
const PREDECESSOR = "26c1383f7f45abb76c99e28ec3d06714e85d1b2c";
const AUTHORITY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json";
const MIGRATION = "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql";
const LIFECYCLE_MIGRATION = "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql";
const HOLISTIC_SCHEMA_ACCEPTANCE = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_V13_HOLISTIC_SCHEMA_POSTGRES.ts";
const REPOSITORY = "apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.ts";
const BUDGET = "apps/server/src/domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.ts";
const EXPECTED_NEW_RELATIONS = [
  "twin_external_formal_forcing_base_cursor_v1",
  "twin_external_formal_forcing_base_target_v1",
  "twin_external_formal_forcing_controller_lease_v1",
];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}
function requireText(haystack, needle, code) {
  if (!haystack.includes(needle)) throw new Error(code);
}
function forbidText(haystack, needle, code) {
  if (haystack.includes(needle)) throw new Error(code);
}
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value, null, 2));
}

function main() {
  const observedBase = String(process.env.MCFT_BASE_SHA || "").trim();
  if (observedBase && observedBase !== PREDECESSOR) throw new Error(`V13_FOUNDATION_EXACT_BASE_DRIFT:${observedBase}`);

  const authority = JSON.parse(read(AUTHORITY));
  if (authority.schema_version !== "geox_mcft_cap09_t4r1_actual_formal_store_authority_v3" || authority.status !== "CANDIDATE") throw new Error("V13_FOUNDATION_AUTHORITY_CANDIDATE_REQUIRED");
  if (authority.predecessor_protected_main_sha !== PREDECESSOR) throw new Error("V13_FOUNDATION_AUTHORITY_PREDECESSOR_REQUIRED");
  if (authority.qualification_generation?.generation !== "v13" || authority.qualification_generation?.qualification_database !== "geox_mcft_cap09_s6_accel24t_am19_v13" || authority.qualification_generation?.blocked_database !== "geox_mcft_cap09_s6_accel24t_am19_blocked_v13") throw new Error("V13_FOUNDATION_FRESH_QUALIFICATION_GENERATION_REQUIRED");
  if (authority.database_identity?.database_name !== "geox_mcft_cap09_s6_formal_t4r1_24h_v5") throw new Error("V13_FOUNDATION_FORMAL_V5_REQUIRED");
  if (authority.schema_contract?.predecessor_required_public_table_count !== 26 || authority.schema_contract?.v13_required_public_table_count !== 29) throw new Error("V13_FOUNDATION_26_TO_29_SCHEMA_REQUIRED");
  if (JSON.stringify(authority.schema_contract?.new_operational_relations) !== JSON.stringify(EXPECTED_NEW_RELATIONS)) throw new Error("V13_FOUNDATION_EXACT_THREE_OPERATIONAL_RELATIONS_REQUIRED");
  if (authority.schema_contract?.holistic_v13_schema_acceptance_required !== true) throw new Error("V13_FOUNDATION_HOLISTIC_SCHEMA_ACCEPTANCE_REQUIRED");
  if (authority.schema_contract?.canonical_facts_schema_mutation_required !== false) throw new Error("V13_FOUNDATION_FACTS_SCHEMA_MUTATION_FORBIDDEN");
  if (authority.schema_contract?.fingerprints_must_be_frozen_from_exact_head_fresh_store_qualification !== true) throw new Error("V13_FOUNDATION_EXACT_HEAD_FINGERPRINT_FREEZE_REQUIRED");
  if (authority.timing_authority?.authority_id !== "FORMAL_FORCING_ACQUISITION_BUDGET_V1" || authority.timing_authority?.fixed_35_minute_lead_authorized_for_v5 !== false || authority.timing_authority?.hardcoded_replacement_budget_minutes !== null) throw new Error("V13_FOUNDATION_MEASURED_TIMING_AUTHORITY_REQUIRED");
  if (authority.physical_visibility_authority?.attestation_id !== "FORMAL_PHYSICAL_INGRESS_ATTESTATION_V1" || authority.physical_visibility_authority?.post_commit_fresh_database_transaction_required !== true || authority.physical_visibility_authority?.post_commit_db_readback_at_must_be_before_base !== true) throw new Error("V13_FOUNDATION_POST_COMMIT_VISIBILITY_AUTHORITY_REQUIRED");
  if (authority.forcing_base_continuity?.runtime_and_forcing_cursors_are_independent !== true || authority.forcing_base_continuity?.post_a0_required_base_count !== 23 || authority.forcing_base_continuity?.required_base_silent_skip_forbidden !== true) throw new Error("V13_FOUNDATION_FORCING_CURSOR_AUTHORITY_REQUIRED");
  if (authority.amendment19_selector_contract?.selector_authority_changed !== false || authority.amendment19_selector_contract?.arbitrary_older_snapshot_fallback_forbidden !== true) throw new Error("V13_FOUNDATION_SELECTOR_NONREGRESSION_REQUIRED");
  const expectedGates = [
    "HOLISTIC_V13_SCHEMA_ACCEPTANCE",
    "PRODUCER_CURSOR_CONTINUITY",
    "EXACT_PREDECESSOR_BASE_CONTINUITY",
    "NEXT_TICK_FORCING_VIABILITY",
    "FORMAL_INGRESS_BEFORE_BASE",
    "END_TO_END_EVIDENCE_SUPPLY_DEADLINE",
    "FORCING_BASE_CLAIM_LEASE_FENCING",
    "LATE_WAKE_FAIL_CLOSED",
    "A2_BLOCKED_SUCCESSOR_HANDLING",
    "HISTORICAL_SCHEDULE_RETIREMENT",
    "NO_ROUTINE_MANUAL_WAKE_REQUIRED",
  ];
  if (JSON.stringify(authority.machine_gates) !== JSON.stringify(expectedGates)) throw new Error("V13_FOUNDATION_MACHINE_GATE_SET_REQUIRED");
  if (authority.nonclaims?.timing_budget_qualified !== false || authority.nonclaims?.v13_qualification_executed !== false || authority.nonclaims?.formal_v5_o00_started !== false || authority.nonclaims?.mcft_cap09_completed !== false) throw new Error("V13_FOUNDATION_NONCLAIMS_REQUIRED");

  const migration = read(MIGRATION);
  requireText(migration, "CREATE TABLE IF NOT EXISTS public.twin_external_formal_forcing_base_cursor_v1", "V13_FOUNDATION_CURSOR_TABLE_REQUIRED");
  requireText(migration, "CREATE TABLE IF NOT EXISTS public.twin_external_formal_forcing_base_target_v1", "V13_FOUNDATION_TARGET_TABLE_REQUIRED");
  requireText(migration, "'FORMAL_VISIBLE_ATTESTED'", "V13_FOUNDATION_ATTESTED_STATE_REQUIRED");
  requireText(migration, "post_commit_db_readback_at < causal_deadline", "V13_FOUNDATION_DB_READBACK_BEFORE_BASE_CHECK_REQUIRED");
  forbidText(migration.toUpperCase(), "ALTER TABLE PUBLIC.FACTS", "V13_FOUNDATION_FACTS_ALTER_FORBIDDEN");
  forbidText(migration.toUpperCase(), "INSERT INTO PUBLIC.FACTS", "V13_FOUNDATION_FACTS_WRITE_FORBIDDEN");

  const lifecycleMigration = read(LIFECYCLE_MIGRATION);
  requireText(lifecycleMigration, "CREATE TABLE IF NOT EXISTS public.twin_external_formal_forcing_controller_lease_v1", "V13_FOUNDATION_CONTROLLER_LEASE_TABLE_REQUIRED");
  forbidText(lifecycleMigration.toUpperCase(), "ALTER TABLE PUBLIC.FACTS", "V13_FOUNDATION_LIFECYCLE_FACTS_ALTER_FORBIDDEN");
  forbidText(lifecycleMigration.toUpperCase(), "INSERT INTO PUBLIC.FACTS", "V13_FOUNDATION_LIFECYCLE_FACTS_WRITE_FORBIDDEN");

  const holistic = read(HOLISTIC_SCHEMA_ACCEPTANCE);
  requireText(holistic, "EXPECTED_PREDECESSOR_TABLE_COUNT = 26", "V13_FOUNDATION_HOLISTIC_PREDECESSOR_26_REQUIRED");
  requireText(holistic, "EXPECTED_V13_TABLE_COUNT = 29", "V13_FOUNDATION_HOLISTIC_V13_29_REQUIRED");
  for (const relation of EXPECTED_NEW_RELATIONS) requireText(holistic, `\"${relation}\"`, `V13_FOUNDATION_HOLISTIC_RELATION_REQUIRED:${relation}`);
  requireText(holistic, "information_schema.tables", "V13_FOUNDATION_HOLISTIC_TABLE_INTROSPECTION_REQUIRED");
  requireText(holistic, "information_schema.columns", "V13_FOUNDATION_HOLISTIC_COLUMN_INTROSPECTION_REQUIRED");
  requireText(holistic, "pg_constraint", "V13_FOUNDATION_HOLISTIC_CONSTRAINT_INTROSPECTION_REQUIRED");
  requireText(holistic, "pg_indexes", "V13_FOUNDATION_HOLISTIC_INDEX_INTROSPECTION_REQUIRED");

  const repository = read(REPOSITORY);
  requireText(repository, "FORMAL_FORCING_BASE_CONTINUITY_CURSOR_V1", "V13_FOUNDATION_CURSOR_IMPLEMENTATION_REQUIRED");
  requireText(repository, "REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED", "V13_FOUNDATION_DEADLINE_MISS_REQUIRED");
  requireText(repository, "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY", "V13_FOUNDATION_FRESH_POST_COMMIT_READ_TRANSACTION_REQUIRED");
  requireText(repository, "SELECT clock_timestamp() AS database_now", "V13_FOUNDATION_DATABASE_CLOCK_REQUIRED");
  requireText(repository, "FORMAL_PHYSICAL_VISIBILITY_AFTER_CAUSAL_BASE", "V13_FOUNDATION_PHYSICAL_LATE_REJECTION_REQUIRED");
  requireText(repository, "FORMAL_FORCING_STALE_FENCING_TOKEN", "V13_FOUNDATION_FENCING_REQUIRED");
  forbidText(repository.toUpperCase(), "INSERT INTO FACTS", "V13_FOUNDATION_REPOSITORY_FACT_WRITE_FORBIDDEN");
  forbidText(repository.toUpperCase(), "UPDATE FACTS", "V13_FOUNDATION_REPOSITORY_FACT_MUTATION_FORBIDDEN");

  const budget = read(BUDGET);
  requireText(budget, "FORMAL_FORCING_ACQUISITION_BUDGET_V1", "V13_FOUNDATION_BUDGET_AUTHORITY_IMPLEMENTATION_REQUIRED");
  requireText(budget, "MEASURED_ENVELOPE_PLUS_EXPLICIT_MARGIN", "V13_FOUNDATION_MEASURED_BUDGET_SELECTION_REQUIRED");
  requireText(budget, "hardcoded_default_budget_minutes: null", "V13_FOUNDATION_NO_HARDCODED_BUDGET_REQUIRED");
  for (const delayCase of ["WAKE_DELAY", "JOB_START_SETUP_DELAY", "PROVIDER_SLOW_PATH", "PROMOTION_QUEUE_SETUP_DELAY", "REHYDRATION_COMMIT_READBACK_DELAY", "CROSS_WAKE_CAPTURE_OVERLAP"]) requireText(budget, `\"${delayCase}\"`, `V13_FOUNDATION_DELAY_CASE_REQUIRED:${delayCase}`);

  write({
    status: "PASS",
    schema_version: "geox_mcft_cap09_v13_autonomous_forcing_foundation_governance_v1",
    predecessor_protected_main_sha: PREDECESSOR,
    candidate_authority_v3_present: true,
    selector_authority_changed: false,
    predecessor_public_table_count: 26,
    v13_required_public_table_count: 29,
    operational_table_delta: 3,
    exact_new_operational_relations: EXPECTED_NEW_RELATIONS,
    holistic_schema_acceptance_required: true,
    canonical_facts_schema_mutation: false,
    independent_forcing_cursor_required: true,
    post_a0_required_base_count: 23,
    per_base_claim_lease_fencing_required: true,
    physical_visibility_uses_post_commit_db_readback: true,
    physical_visibility_payload_timestamp_only_forbidden: true,
    hardcoded_35_minute_budget_authorized: false,
    measured_end_to_end_budget_required: true,
    controlled_delay_matrix_required: true,
    fresh_v13_generation_required: true,
    formal_v5_required: true,
    production_effect: false,
    formal_v4_mutation_authorized: false,
    mcft_cap09_completed: false,
  });
}

try {
  main();
} catch (error) {
  write({ status: "FAIL", error: String(error && error.message ? error.message : error) });
  process.exitCode = 1;
}
