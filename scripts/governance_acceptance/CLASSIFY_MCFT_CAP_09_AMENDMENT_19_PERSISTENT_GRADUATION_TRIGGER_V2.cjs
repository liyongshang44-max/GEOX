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
  need(persistent.status === "PASS", `AM19_GRADUATION_TRIGGER_V2_FRESH_PASS_REQUIRED:${String(persistent?.status)}`);
  need(persistent.subject_sha === subject, "AM19_GRADUATION_TRIGGER_V2_PERSISTENT_SUBJECT_REQUIRED");
  need(persistent.qualified_subject_sha === subject, "AM19_GRADUATION_TRIGGER_V2_QUALIFIED_SUBJECT_REQUIRED");
  need(persistent.main_database_name === q.qualification_database, "AM19_GRADUATION_TRIGGER_V2_MAIN_DATABASE_REQUIRED");
  need(persistent.blocked_database_name === q.blocked_database, "AM19_GRADUATION_TRIGGER_V2_BLOCKED_DATABASE_REQUIRED");
  need(persistent.main_database_name !== q.previous_qualification_database, "AM19_GRADUATION_TRIGGER_V2_V11_REUSE_FORBIDDEN");
  need(persistent.blocked_database_name !== q.previous_blocked_database, "AM19_GRADUATION_TRIGGER_V2_BLOCKED_V11_REUSE_FORBIDDEN");
  need(persistent.crop_authority_id === CROP_AUTHORITY, "AM19_GRADUATION_TRIGGER_V2_T4R1_CROP_AUTHORITY_REQUIRED");
  need(persistent.crop_context_materialization_profile === CROP_MATERIALIZATION_PROFILE, "AM19_GRADUATION_TRIGGER_V2_T4R1_CROP_MATERIALIZATION_REQUIRED");
  need(Number(persistent.static_blocker_count) === 0, "AM19_GRADUATION_TRIGGER_V2_ZERO_STATIC_BLOCKERS_REQUIRED");
  for (const key of REQUIRED_STATUS_KEYS) need(persistent.machine_statuses?.[key] === "PASS", `AM19_GRADUATION_TRIGGER_V2_MACHINE_STATUS_REQUIRED:${key}`);
  need(persistent.final_actual_24h_still_required === true && persistent.final_actual_24h_substituted_by_this_run === false, "AM19_GRADUATION_TRIGGER_V2_FINAL_REAL_24H_REQUIRED");
  need(persistent.future_formal_epoch_selected === false && persistent.formal_o00_started === false && persistent.mcft_cap09_completed === false, "AM19_GRADUATION_TRIGGER_V2_PREMATURE_FORMAL_EFFECT_FORBIDDEN");
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
    trigger_mode: "FRESH_V12_QUALIFICATION_ONLY",
    fresh_pass: true,
    read_only: false,
    new_machine_gate_claim: true,
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
  const negatives = [
    ["v11_main", { ...fresh, main_database_name: authority.qualification_generation.previous_qualification_database }, "AM19_GRADUATION_TRIGGER_V2_MAIN_DATABASE_REQUIRED"],
    ["v11_blocked", { ...fresh, blocked_database_name: authority.qualification_generation.previous_blocked_database }, "AM19_GRADUATION_TRIGGER_V2_BLOCKED_DATABASE_REQUIRED"],
    ["read_only", { ...fresh, status: "ALREADY_QUALIFIED_READ_ONLY" }, "AM19_GRADUATION_TRIGGER_V2_FRESH_PASS_REQUIRED:ALREADY_QUALIFIED_READ_ONLY"],
    ["blocker", { ...fresh, static_blocker_count: 1 }, "AM19_GRADUATION_TRIGGER_V2_ZERO_STATIC_BLOCKERS_REQUIRED"],
    ["machine", { ...fresh, machine_statuses: { ...machine_statuses, MODE_B: "FAIL" } }, "AM19_GRADUATION_TRIGGER_V2_MACHINE_STATUS_REQUIRED:MODE_B"],
    ["premature", { ...fresh, formal_o00_started: true }, "AM19_GRADUATION_TRIGGER_V2_PREMATURE_FORMAL_EFFECT_FORBIDDEN"],
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
    fresh_only: true,
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
