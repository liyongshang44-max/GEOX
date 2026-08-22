#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SCHEMA = "geox_mcft_cap09_amendment19_persistent24_qualification_result_v1";
const MAIN_DATABASE = "geox_mcft_cap09_s6_accel24t_am19_v8";
const BLOCKED_DATABASE = "geox_mcft_cap09_s6_accel24t_am19_blocked_v8";
const STALE_V7_MAIN_DATABASE = "geox_mcft_cap09_s6_accel24t_am19_v7";
const STALE_V7_BLOCKED_DATABASE = "geox_mcft_cap09_s6_accel24t_am19_blocked_v7";
const STALE_V6_MAIN_DATABASE = "geox_mcft_cap09_s6_accel24t_am19_v6";
const STALE_V6_BLOCKED_DATABASE = "geox_mcft_cap09_s6_accel24t_am19_blocked_v6";
const STALE_V4_MAIN_DATABASE = "geox_mcft_cap09_s6_accel24t_am19_v4";
const STALE_V4_BLOCKED_DATABASE = "geox_mcft_cap09_s6_accel24t_am19_blocked_v4";
const CROP_AUTHORITY = "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3";
const CROP_MATERIALIZATION_PROFILE = "T4R1_A18_FULL_CROP_CONTEXT_MATERIALIZATION_V3";
const ZERO_FIELDS = [
  "database_write_count",
  "runtime_write_count",
  "scheduler_write_count",
  "provider_request_count",
  "r2_request_count",
];

function fail(code) { throw new Error(code); }
function need(value, code) { if (!value) fail(code); }
function exactSubject(value) {
  const subject = String(value || "").trim();
  if (!/^[0-9a-f]{40}$/.test(subject)) fail("AM19_GRADUATION_TRIGGER_EXACT_SUBJECT_REQUIRED");
  return subject;
}

function classify(persistent, subject) {
  subject = exactSubject(subject);
  need(persistent?.schema_version === SCHEMA, "AM19_GRADUATION_TRIGGER_PERSISTENT_SCHEMA_REQUIRED");
  need(persistent.subject_sha === subject, "AM19_GRADUATION_TRIGGER_PERSISTENT_SUBJECT_REQUIRED");
  need(persistent.qualified_subject_sha === subject, "AM19_GRADUATION_TRIGGER_QUALIFIED_SUBJECT_REQUIRED");
  need(persistent.main_database_name === MAIN_DATABASE, "AM19_GRADUATION_TRIGGER_MAIN_DATABASE_REQUIRED");
  need(persistent.blocked_database_name === BLOCKED_DATABASE, "AM19_GRADUATION_TRIGGER_BLOCKED_DATABASE_REQUIRED");
  need(persistent.crop_authority_id === CROP_AUTHORITY, "AM19_GRADUATION_TRIGGER_T4R1_CROP_AUTHORITY_REQUIRED");
  need(persistent.crop_context_materialization_profile === CROP_MATERIALIZATION_PROFILE, "AM19_GRADUATION_TRIGGER_T4R1_CROP_MATERIALIZATION_REQUIRED");

  if (persistent.status === "PASS") {
    return {
      schema_version: "geox_mcft_cap09_amendment19_persistent_graduation_trigger_classification_v1",
      status: "PASS",
      subject_sha: subject,
      crop_authority_id: CROP_AUTHORITY,
      crop_context_materialization_profile: CROP_MATERIALIZATION_PROFILE,
      trigger_mode: "FRESH_QUALIFICATION",
      fresh_pass: true,
      read_only: false,
      new_machine_gate_claim: true,
    };
  }

  need(persistent.status === "ALREADY_QUALIFIED_READ_ONLY", `AM19_GRADUATION_TRIGGER_FRESH_OR_READ_ONLY_STATUS_REQUIRED:${String(persistent.status)}`);
  for (const key of ZERO_FIELDS) {
    need(Number(persistent[key]) === 0, `AM19_GRADUATION_TRIGGER_READ_ONLY_ZERO_REQUIRED:${key}`);
  }
  need(persistent.new_machine_gate_claim === false, "AM19_GRADUATION_TRIGGER_READ_ONLY_NEW_GATE_FORBIDDEN");
  need(persistent.existing_success_evidence_unchanged === true, "AM19_GRADUATION_TRIGGER_READ_ONLY_EXISTING_EVIDENCE_REQUIRED");
  need(persistent.final_actual_24h_still_required === true, "AM19_GRADUATION_TRIGGER_READ_ONLY_FINAL_24H_REQUIRED");
  need(persistent.formal_o00_started === false && persistent.mcft_cap09_completed === false, "AM19_GRADUATION_TRIGGER_READ_ONLY_PREMATURE_COMPLETION");

  return {
    schema_version: "geox_mcft_cap09_amendment19_persistent_graduation_trigger_classification_v1",
    status: "PASS",
    subject_sha: subject,
    crop_authority_id: CROP_AUTHORITY,
    crop_context_materialization_profile: CROP_MATERIALIZATION_PROFILE,
    trigger_mode: "IDEMPOTENT_READ_ONLY_NO_GATE",
    fresh_pass: false,
    read_only: true,
    source_persistent_status: persistent.status,
    existing_success_evidence_unchanged: true,
    new_machine_gate_claim: false,
    formal_database_write_count: 0,
    formal_r2_write_count: 0,
    scheduler_write_count: 0,
    runtime_write_count: 0,
    final_actual_24h_still_required: true,
    formal_o00_started: false,
    mcft_cap09_completed: false,
  };
}

function selftest() {
  const subject = "1".repeat(40);
  const identity = {
    crop_authority_id: CROP_AUTHORITY,
    crop_context_materialization_profile: CROP_MATERIALIZATION_PROFILE,
  };
  const fresh = classify({ schema_version: SCHEMA, status: "PASS", subject_sha: subject, qualified_subject_sha: subject, main_database_name: MAIN_DATABASE, blocked_database_name: BLOCKED_DATABASE, ...identity }, subject);
  need(fresh.fresh_pass === true && fresh.read_only === false && fresh.new_machine_gate_claim === true, "AM19_GRADUATION_TRIGGER_SELFTEST_FRESH_FAILED");

  const readOnly = {
    schema_version: SCHEMA,
    status: "ALREADY_QUALIFIED_READ_ONLY",
    subject_sha: subject,
    qualified_subject_sha: subject,
    main_database_name: MAIN_DATABASE,
    blocked_database_name: BLOCKED_DATABASE,
    ...identity,
    database_write_count: 0,
    runtime_write_count: 0,
    scheduler_write_count: 0,
    provider_request_count: 0,
    r2_request_count: 0,
    new_machine_gate_claim: false,
    existing_success_evidence_unchanged: true,
    final_actual_24h_still_required: true,
    formal_o00_started: false,
    mcft_cap09_completed: false,
  };
  const replay = classify(readOnly, subject);
  need(replay.fresh_pass === false && replay.read_only === true && replay.new_machine_gate_claim === false, "AM19_GRADUATION_TRIGGER_SELFTEST_READ_ONLY_FAILED");

  const negatives = [
    ["subject", { ...readOnly, subject_sha: "2".repeat(40) }, "AM19_GRADUATION_TRIGGER_PERSISTENT_SUBJECT_REQUIRED"],
    ["qualified_subject", { ...readOnly, qualified_subject_sha: "2".repeat(40) }, "AM19_GRADUATION_TRIGGER_QUALIFIED_SUBJECT_REQUIRED"],
    ["stale_v7_main_database", { ...readOnly, main_database_name: STALE_V7_MAIN_DATABASE }, "AM19_GRADUATION_TRIGGER_MAIN_DATABASE_REQUIRED"],
    ["stale_v7_blocked_database", { ...readOnly, blocked_database_name: STALE_V7_BLOCKED_DATABASE }, "AM19_GRADUATION_TRIGGER_BLOCKED_DATABASE_REQUIRED"],
    ["stale_v6_main_database", { ...readOnly, main_database_name: STALE_V6_MAIN_DATABASE }, "AM19_GRADUATION_TRIGGER_MAIN_DATABASE_REQUIRED"],
    ["stale_v6_blocked_database", { ...readOnly, blocked_database_name: STALE_V6_BLOCKED_DATABASE }, "AM19_GRADUATION_TRIGGER_BLOCKED_DATABASE_REQUIRED"],
    ["stale_v4_main_database", { ...readOnly, main_database_name: STALE_V4_MAIN_DATABASE }, "AM19_GRADUATION_TRIGGER_MAIN_DATABASE_REQUIRED"],
    ["stale_v4_blocked_database", { ...readOnly, blocked_database_name: STALE_V4_BLOCKED_DATABASE }, "AM19_GRADUATION_TRIGGER_BLOCKED_DATABASE_REQUIRED"],
    ["main_database", { ...readOnly, main_database_name: "wrong" }, "AM19_GRADUATION_TRIGGER_MAIN_DATABASE_REQUIRED"],
    ["blocked_database", { ...readOnly, blocked_database_name: "wrong" }, "AM19_GRADUATION_TRIGGER_BLOCKED_DATABASE_REQUIRED"],
    ["crop_authority", { ...readOnly, crop_authority_id: "wrong" }, "AM19_GRADUATION_TRIGGER_T4R1_CROP_AUTHORITY_REQUIRED"],
    ["crop_materialization", { ...readOnly, crop_context_materialization_profile: "wrong" }, "AM19_GRADUATION_TRIGGER_T4R1_CROP_MATERIALIZATION_REQUIRED"],
    ["write", { ...readOnly, database_write_count: 1 }, "AM19_GRADUATION_TRIGGER_READ_ONLY_ZERO_REQUIRED:database_write_count"],
    ["new_gate", { ...readOnly, new_machine_gate_claim: true }, "AM19_GRADUATION_TRIGGER_READ_ONLY_NEW_GATE_FORBIDDEN"],
    ["evidence_changed", { ...readOnly, existing_success_evidence_unchanged: false }, "AM19_GRADUATION_TRIGGER_READ_ONLY_EXISTING_EVIDENCE_REQUIRED"],
    ["premature_formal", { ...readOnly, formal_o00_started: true }, "AM19_GRADUATION_TRIGGER_READ_ONLY_PREMATURE_COMPLETION"],
    ["unsupported", { ...readOnly, status: "FAILED" }, "AM19_GRADUATION_TRIGGER_FRESH_OR_READ_ONLY_STATUS_REQUIRED:FAILED"],
  ];
  for (const [name, value, expected] of negatives) {
    let observed = "";
    try { classify(value, subject); } catch (error) { observed = error instanceof Error ? error.message : String(error); }
    need(observed === expected, `AM19_GRADUATION_TRIGGER_SELFTEST_NEGATIVE_FAILED:${name}:${observed}`);
  }

  console.log(JSON.stringify({
    schema_version: "geox_mcft_cap09_amendment19_persistent_graduation_trigger_classification_selftest_v1",
    status: "PASS",
    t4r1_crop_authority_bound: true,
    qualification_store_generation: "v8",
    stale_v7_store_evidence_rejected: true,
    stale_v6_store_evidence_rejected: true,
    stale_v4_store_evidence_rejected: true,
    read_only_replay_creates_new_gate: false,
    negative_case_count: negatives.length,
  }));
}

if (process.argv.includes("--selftest")) {
  selftest();
} else {
  const [persistentPath, subject, outPath] = process.argv.slice(2);
  if (![persistentPath, subject, outPath].every(Boolean)) fail("AM19_GRADUATION_TRIGGER_USAGE:persistent-result subject output");
  const persistent = JSON.parse(fs.readFileSync(path.resolve(persistentPath), "utf8"));
  const result = classify(persistent, subject);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}