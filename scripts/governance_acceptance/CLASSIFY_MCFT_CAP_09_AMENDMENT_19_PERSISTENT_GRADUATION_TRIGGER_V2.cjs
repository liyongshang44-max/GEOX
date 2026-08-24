#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const STORE_AUTHORITY_PATH = path.resolve(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V2.json",
);
const PERSISTENT_SCHEMA = "geox_mcft_cap09_amendment19_persistent24_qualification_result_v1";
const CROP_AUTHORITY = "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3";
const CROP_MATERIALIZATION_PROFILE = "T4R1_A18_FULL_CROP_CONTEXT_MATERIALIZATION_V3";
const REQUIRED_STATUS_KEYS = [
  "PERSISTENCE_FREE_24T",
  "PERSISTENT_24T",
  "O00_WARM_START",
  "MODE_A",
  "MODE_B",
  "PARTIAL_PAIR",
  "LATE_EXACT_NO_REWRITE",
  "RESTART",
  "MISSED_SLOT_BACKFILL",
  "IDEMPOTENCY",
  "ZERO_PROVIDER_WAIT",
  "SCHEMA_ENV_PREFLIGHT",
  "FULL_CHAIN_READBACK",
];
const READ_ONLY_ZERO_FIELDS = ["database_write_count", "runtime_write_count", "scheduler_write_count", "provider_request_count", "r2_request_count"];

function fail(code) { throw new Error(code); }
function need(value, code) { if (!value) fail(code); }
function exactSubject(value) {
  const subject = String(value || "").trim();
  if (!/^[0-9a-f]{40}$/.test(subject)) fail("AM19_GRADUATION_TRIGGER_V2_EXACT_SUBJECT_REQUIRED");
  return subject;
}
function authorityFromDisk() {
  if (!fs.existsSync(STORE_AUTHORITY_PATH)) fail("AM19_GRADUATION_TRIGGER_V2_STORE_AUTHORITY_REQUIRED");
  return JSON.parse(fs.readFileSync(STORE_AUTHORITY_PATH, "utf8"));
}
function validateAuthority(authority) {
  need(authority?.schema_version === "geox_mcft_cap09_t4r1_actual_formal_store_authority_v2", "AM19_GRADUATION_TRIGGER_V2_AUTHORITY_SCHEMA_REQUIRED");
  need(authority.status === "CANDIDATE", "AM19_GRADUATION_TRIGGER_V2_AUTHORITY_STATUS_REQUIRED");
  const q = authority.qualification_generation;
  need(q?.fresh_qualification_required === true, "AM19_GRADUATION_TRIGGER_V2_FRESH_QUALIFICATION_REQUIRED");
  need(q.previous_generation_reuse_forbidden === true, "AM19_GRADUATION_TRIGGER_V2_PREVIOUS_REUSE_FORBIDDEN");
  need(q.qualification_database === "geox_mcft_cap09_s6_accel24t_am19_v12", "AM19_GRADUATION_TRIGGER_V2_V12_DATABASE_REQUIRED");
  need(q.blocked_database === "geox_mcft_cap09_s6_accel24t_am19_blocked_v12", "AM19_GRADUATION_TRIGGER_V2_BLOCKED_V12_DATABASE_REQUIRED");
  need(q.previous_qualification_database === "geox_mcft_cap09_s6_accel24t_am19_v11", "AM19_GRADUATION_TRIGGER_V2_V11_PREDECESSOR_REQUIRED");
  need(q.previous_blocked_database === "geox_mcft_cap09_s6_accel24t_am19_blocked_v11", "AM19_GRADUATION_TRIGGER_V2_BLOCKED_V11_PREDECESSOR_REQUIRED");
  return q;
}

function classify(persistent, subject, authority = authorityFromDisk()) {
  subject = exactSubject(subject);
  const q = validateAuthority(authority);
  need(persistent?.schema_version === PERSISTENT_SCHEMA, "AM19_GRADUATION_TRIGGER_V2_PERSISTENT_SCHEMA_REQUIRED");
  need(persistent.subject_sha === subject, "AM19_GRADUATION_TRIGGER_V2_PERSISTENT_SUBJECT_REQUIRED");
  need(persistent.qualified_subject_sha === subject, "AM19_GRADUATION_TRIGGER_V2_QUALIFIED_SUBJECT_REQUIRED");
  need(persistent.main_database_name === q.qualification_database, "AM19_GRADUATION_TRIGGER_V2_MAIN_DATABASE_REQUIRED");
  need(persistent.blocked_database_name === q.blocked_database, "AM19_GRADUATION_TRIGGER_V2_BLOCKED_DATABASE_REQUIRED");
  need(persistent.main_database_name !== q.previous_qualification_database, "AM19_GRADUATION_TRIGGER_V2_V11_REUSE_FORBIDDEN");
  need(persistent.blocked_database_name !== q.previous_blocked_database, "AM19_GRADUATION_TRIGGER_V2_BLOCKED_V11_REUSE_FORBIDDEN");
  need(persistent.crop_authority_id === CROP_AUTHORITY, "AM19_GRADUATION_TRIGGER_V2_T4R1_CROP_AUTHORITY_REQUIRED");
  need(persistent.crop_context_materialization_profile === CROP_MATERIALIZATION_PROFILE, "AM19_GRADUATION_TRIGGER_V2_T4R1_CROP_MATERIALIZATION_REQUIRED");
  need(persistent.final_actual_24h_still_required === true, "AM19_GRADUATION_TRIGGER_V2_FINAL_REAL_24H_REQUIRED");
  need(persistent.future_formal_epoch_selected === false && persistent.formal_o00_started === false && persistent.mcft_cap09_completed === false, "AM19_GRADUATION_TRIGGER_V2_PREMATURE_FORMAL_EFFECT_FORBIDDEN");

  if (persistent.status === "PASS") {
    need(Number(persistent.static_blocker_count) === 0, "AM19_GRADUATION_TRIGGER_V2_ZERO_STATIC_BLOCKERS_REQUIRED");
    for (const key of REQUIRED_STATUS_KEYS) need(persistent.machine_statuses?.[key] === "PASS", `AM19_GRADUATION_TRIGGER_V2_MACHINE_STATUS_REQUIRED:${key}`);
    need(persistent.final_actual_24h_substituted_by_this_run === false, "AM19_GRADUATION_TRIGGER_V2_FINAL_REAL_24H_NON_SUBSTITUTION_REQUIRED");
    return {
      schema_version: "geox_mcft_cap09_amendment19_persistent_graduation_trigger_classification_v2",
      status: "PASS",
      subject_sha: subject,
      qualification_generation: "v12",
      main_database_name: q.qualification_database,
      blocked_database_name: q.blocked_database,
      previous_generation_reuse_forbidden: true,
      crop_authority_id: CROP_AUTHORITY,
      crop_context_materialization_profile: CROP_MATERIALIZATION_PROFILE,
      trigger_mode: "FRESH_V12_QUALIFICATION",
      fresh_pass: true,
      read_only: false,
      new_machine_gate_claim: true,
      final_actual_24h_still_required: true,
      formal_o00_started: false,
      mcft_cap09_completed: false,
    };
  }

  need(persistent.status === "ALREADY_QUALIFIED_READ_ONLY", `AM19_GRADUATION_TRIGGER_V2_FRESH_OR_V12_READ_ONLY_REQUIRED:${String(persistent.status)}`);
  for (const key of READ_ONLY_ZERO_FIELDS) need(Number(persistent[key]) === 0, `AM19_GRADUATION_TRIGGER_V2_READ_ONLY_ZERO_REQUIRED:${key}`);
  need(persistent.new_machine_gate_claim === false, "AM19_GRADUATION_TRIGGER_V2_READ_ONLY_NEW_GATE_FORBIDDEN");
  need(persistent.existing_success_evidence_unchanged === true, "AM19_GRADUATION_TRIGGER_V2_READ_ONLY_EXISTING_EVIDENCE_REQUIRED");
  return {
    schema_version: "geox_mcft_cap09_amendment19_persistent_graduation_trigger_classification_v2",
    status: "PASS",
    subject_sha: subject,
    qualification_generation: "v12",
    main_database_name: q.qualification_database,
    blocked_database_name: q.blocked_database,
    previous_generation_reuse_forbidden: true,
    crop_authority_id: CROP_AUTHORITY,
    crop_context_materialization_profile: CROP_MATERIALIZATION_PROFILE,
    trigger_mode: "IDEMPOTENT_V12_READ_ONLY_NO_GATE",
    fresh_pass: false,
    read_only: true,
    new_machine_gate_claim: false,
    existing_success_evidence_unchanged: true,
    final_actual_24h_still_required: true,
    formal_o00_started: false,
    mcft_cap09_completed: false,
  };
}

function selftest() {
  const subject = "1".repeat(40);
  const authority = {
    schema_version: "geox_mcft_cap09_t4r1_actual_formal_store_authority_v2",
    status: "CANDIDATE",
    qualification_generation: {
      fresh_qualification_required: true,
      previous_generation_reuse_forbidden: true,
      qualification_database: "geox_mcft_cap09_s6_accel24t_am19_v12",
      blocked_database: "geox_mcft_cap09_s6_accel24t_am19_blocked_v12",
      previous_qualification_database: "geox_mcft_cap09_s6_accel24t_am19_v11",
      previous_blocked_database: "geox_mcft_cap09_s6_accel24t_am19_blocked_v11",
    },
  };
  const machine_statuses = Object.fromEntries(REQUIRED_STATUS_KEYS.map((key) => [key, "PASS"]));
  const fresh = {
    schema_version: PERSISTENT_SCHEMA,
    status: "PASS",
    subject_sha: subject,
    qualified_subject_sha: subject,
    main_database_name: authority.qualification_generation.qualification_database,
    blocked_database_name: authority.qualification_generation.blocked_database,
    crop_authority_id: CROP_AUTHORITY,
    crop_context_materialization_profile: CROP_MATERIALIZATION_PROFILE,
    static_blocker_count: 0,
    machine_statuses,
    final_actual_24h_still_required: true,
    final_actual_24h_substituted_by_this_run: false,
    future_formal_epoch_selected: false,
    formal_o00_started: false,
    mcft_cap09_completed: false,
  };
  const pass = classify(fresh, subject, authority);
  need(pass.status === "PASS" && pass.qualification_generation === "v12" && pass.new_machine_gate_claim === true, "AM19_GRADUATION_TRIGGER_V2_SELFTEST_PASS_FAILED");
  const readOnly = {
    ...fresh,
    status: "ALREADY_QUALIFIED_READ_ONLY",
    database_write_count: 0,
    runtime_write_count: 0,
    scheduler_write_count: 0,
    provider_request_count: 0,
    r2_request_count: 0,
    new_machine_gate_claim: false,
    existing_success_evidence_unchanged: true,
  };
  const replay = classify(readOnly, subject, authority);
  need(replay.read_only === true && replay.new_machine_gate_claim === false, "AM19_GRADUATION_TRIGGER_V2_SELFTEST_READ_ONLY_FAILED");
  const negatives = [
    ["v11_main", { ...fresh, main_database_name: authority.qualification_generation.previous_qualification_database }, "AM19_GRADUATION_TRIGGER_V2_MAIN_DATABASE_REQUIRED"],
    ["v11_blocked", { ...fresh, blocked_database_name: authority.qualification_generation.previous_blocked_database }, "AM19_GRADUATION_TRIGGER_V2_BLOCKED_DATABASE_REQUIRED"],
    ["blocker", { ...fresh, static_blocker_count: 1 }, "AM19_GRADUATION_TRIGGER_V2_ZERO_STATIC_BLOCKERS_REQUIRED"],
    ["machine", { ...fresh, machine_statuses: { ...machine_statuses, MODE_B: "FAIL" } }, "AM19_GRADUATION_TRIGGER_V2_MACHINE_STATUS_REQUIRED:MODE_B"],
    ["premature", { ...fresh, formal_o00_started: true }, "AM19_GRADUATION_TRIGGER_V2_PREMATURE_FORMAL_EFFECT_FORBIDDEN"],
    ["read_only_write", { ...readOnly, database_write_count: 1 }, "AM19_GRADUATION_TRIGGER_V2_READ_ONLY_ZERO_REQUIRED:database_write_count"],
  ];
  for (const [name, value, expected] of negatives) {
    let observed = "";
    try { classify(value, subject, authority); } catch (error) { observed = error instanceof Error ? error.message : String(error); }
    need(observed === expected, `AM19_GRADUATION_TRIGGER_V2_SELFTEST_NEGATIVE_FAILED:${name}:${observed}`);
  }
  console.log(JSON.stringify({
    schema_version: "geox_mcft_cap09_amendment19_persistent_graduation_trigger_classification_v2_selftest",
    status: "PASS",
    qualification_generation: "v12",
    previous_generation_reuse_forbidden: true,
    v12_read_only_creates_new_gate: false,
    negative_case_count: negatives.length,
  }));
}

if (process.argv.includes("--selftest")) selftest();
else {
  const [persistentPath, subject, outPath] = process.argv.slice(2);
  if (![persistentPath, subject, outPath].every(Boolean)) fail("AM19_GRADUATION_TRIGGER_V2_USAGE:persistent-result subject output");
  const persistent = JSON.parse(fs.readFileSync(path.resolve(persistentPath), "utf8"));
  const result = classify(persistent, subject);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}
