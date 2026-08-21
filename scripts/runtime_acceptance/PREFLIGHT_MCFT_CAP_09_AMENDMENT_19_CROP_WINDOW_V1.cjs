#!/usr/bin/env node
"use strict";

// Fail-closed, read-only crop-window preflight for Amendment-19 qualification.
// It intentionally runs before rehydration and before either fresh v4 store is opened.

const fs = require("node:fs");
const path = require("node:path");

const AUTHORITY_PATH = path.resolve(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json",
);
const DEFAULT_CANDIDATE_PATH = path.resolve(
  "rolling-candidate/MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json",
);
const OUTPUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_PREFLIGHT_V1.json",
);
const HOUR_MS = 3_600_000;

function requireCondition(condition, code) {
  if (!condition) throw new Error(code);
}

function record(value, code) {
  requireCondition(value && typeof value === "object" && !Array.isArray(value), code);
  return value;
}

function number(value, code) {
  requireCondition(typeof value === "number" && Number.isFinite(value), code);
  return value;
}

function canonicalHour(value, code) {
  requireCondition(typeof value === "string", code);
  const parsed = Date.parse(value);
  requireCondition(Number.isFinite(parsed) && new Date(parsed).toISOString() === value && value.endsWith(":00:00.000Z"), code);
  return value;
}

function addHours(value, hours) {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}

function stageAtHours(hoursSincePlanting, variant) {
  requireCondition(
    Array.isArray(variant) && variant.length === 4 && variant.every((value) => Number.isFinite(value) && value > 0),
    "AM19_CROP_PREFLIGHT_VARIANT_INVALID",
  );
  const [initial, development, mid, late] = variant;
  if (hoursSincePlanting < 0) return "PRE_PLANTING";
  if (hoursSincePlanting < initial * 24) return "INITIAL";
  if (hoursSincePlanting < (initial + development) * 24) return "DEVELOPMENT";
  if (hoursSincePlanting < (initial + development + mid) * 24) return "MID";
  if (hoursSincePlanting < (initial + development + mid + late) * 24) return "LATE";
  return "POST_MODEL_SEASON";
}

function loadAuthority() {
  const authority = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8"));
  requireCondition(
    authority.schema_version === "geox_mcft_cap09_s6_formal_crop_context_authority_v3"
      && authority.authority_id === "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3",
    "AM19_CROP_PREFLIGHT_AUTHORITY_V3_REQUIRED",
  );
  requireCondition(
    authority.scope?.site_id === "KBS_MCSE_T4R1"
      && authority.scope?.field_id === "field_kbs_mcse_t4r1"
      && authority.scope?.season_id === "season_2026_corn"
      && authority.scope?.zone_id === "zone_kbs_mcse_t4r1_crop_formal_v1"
      && authority.scope?.hybrid_product_code === "43-96P",
    "AM19_CROP_PREFLIGHT_T4R1_SCOPE_REQUIRED",
  );
  requireCondition(
    authority.planting_authority?.observation_id === 6974
      && authority.planting_authority?.provider_area_identity === "T4"
      && authority.planting_authority?.replicate === "R1"
      && authority.planting_authority?.replicate_1_explicitly_included === true,
    "AM19_CROP_PREFLIGHT_T4R1_PLANTING_AUTHORITY_REQUIRED",
  );
  return authority;
}

function authorityProfile(authority) {
  const planting = record(authority.planting_authority, "AM19_CROP_PREFLIGHT_PLANTING_AUTHORITY_REQUIRED");
  const window = record(planting.possible_event_window_utc, "AM19_CROP_PREFLIGHT_PLANTING_WINDOW_REQUIRED");
  const plantingStart = Date.parse(window.start_inclusive);
  const plantingEnd = Date.parse(window.end_exclusive);
  requireCondition(Number.isFinite(plantingStart) && Number.isFinite(plantingEnd) && plantingStart < plantingEnd, "AM19_CROP_PREFLIGHT_PLANTING_WINDOW_INVALID");

  const policy = record(authority.as_of_derivation_policy, "AM19_CROP_PREFLIGHT_POLICY_REQUIRED");
  const backwardHours = number(policy.backward_stability_hours, "AM19_CROP_PREFLIGHT_BACKWARD_GUARD_REQUIRED");
  const forwardHours = number(policy.forward_transition_guard_hours, "AM19_CROP_PREFLIGHT_FORWARD_GUARD_REQUIRED");
  requireCondition(
    backwardHours === 6
      && forwardHours === 30
      && policy.planting_time_uncertainty_must_be_carried === true
      && policy.future_observations_authorized === false,
    "AM19_CROP_PREFLIGHT_POLICY_DRIFT",
  );

  const model = record(authority.model_stage_prior, "AM19_CROP_PREFLIGHT_MODEL_REQUIRED");
  requireCondition(Array.isArray(model.variant_stage_lengths_days) && model.variant_stage_lengths_days.length === 6, "AM19_CROP_PREFLIGHT_EXACT_SIX_VARIANTS_REQUIRED");
  const variants = model.variant_stage_lengths_days.map((variant) => {
    requireCondition(Array.isArray(variant), "AM19_CROP_PREFLIGHT_VARIANT_ARRAY_REQUIRED");
    return variant.map((value) => number(value, "AM19_CROP_PREFLIGHT_VARIANT_VALUE_INVALID"));
  });
  return { plantingStart, plantingEnd, backwardHours, forwardHours, variants };
}

function evaluateLogicalTime(logicalTime, profile) {
  const target = Date.parse(canonicalHour(logicalTime, "AM19_CROP_PREFLIGHT_LOGICAL_TIME_INVALID"));
  const currentMin = (target - profile.plantingEnd) / HOUR_MS;
  const currentMax = (target - profile.plantingStart) / HOUR_MS;
  const guardMin = (target - profile.backwardHours * HOUR_MS - profile.plantingEnd) / HOUR_MS;
  const guardMax = (target + profile.forwardHours * HOUR_MS - profile.plantingStart) / HOUR_MS;
  const stages = new Set();
  for (const variant of profile.variants) {
    for (const age of [currentMin, currentMax, guardMin, guardMax]) stages.add(stageAtHours(age, variant));
  }
  const sortedStages = [...stages].sort();
  const pass = sortedStages.length === 1 && sortedStages[0] === "MID";
  return {
    logical_time: logicalTime,
    status: pass ? "PASS" : "FAIL",
    stage_code: pass ? "MID" : null,
    conservative_stage_set: sortedStages,
    reason: pass ? null : sortedStages.includes("MID") && sortedStages.includes("LATE")
      ? "STAGE_TRANSITION_RISK"
      : "MID_CONSERVATIVE_CONSENSUS_NOT_ESTABLISHED",
  };
}

function evaluateWindow(a0, authority) {
  canonicalHour(a0, "AM19_CROP_PREFLIGHT_A0_INVALID");
  const profile = authorityProfile(authority);
  const contexts = [
    { context_id: "A0", logical_time: a0 },
    ...Array.from({ length: 24 }, (_, index) => ({
      context_id: `O${String(index).padStart(2, "0")}`,
      logical_time: addHours(a0, index + 1),
    })),
  ].map((item) => ({ ...item, ...evaluateLogicalTime(item.logical_time, profile) }));
  const failures = contexts.filter((item) => item.status === "FAIL");
  return {
    a0,
    o00: addHours(a0, 1),
    o23: addHours(a0, 24),
    contexts,
    failures,
    viable: failures.length === 0,
  };
}

function writeProof(proof) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify(proof));
}

function proofForCandidate(candidate, subject, authority) {
  requireCondition(candidate.schema_version === "geox_mcft_cap09_rolling_preboundary_candidate_v1", "AM19_CROP_PREFLIGHT_CANDIDATE_SCHEMA_REQUIRED");
  requireCondition(candidate.status === "PASS" && candidate.temporal_authority === "PROVIDER_AVAILABILITY_WATERMARK_V1", "AM19_CROP_PREFLIGHT_CANDIDATE_PASS_REQUIRED");
  requireCondition(candidate.producer_subject_sha === subject && (candidate.subject_sha === undefined || candidate.subject_sha === subject), "AM19_CROP_PREFLIGHT_EXACT_SUBJECT_REQUIRED");
  const window = evaluateWindow(candidate.target_t, authority);
  return {
    schema_version: "geox_mcft_cap09_amendment19_crop_window_preflight_v1",
    status: window.viable ? "PASS" : "NO_VIABLE_A0_PLUS_O00_O23_CROP_WINDOW",
    result: window.viable ? "EXACT_A0_PLUS_O00_O23_CROP_WINDOW_VIABLE" : "CURRENT_T4R1_CROP_AUTHORITY_BLOCKS_24T_QUALIFICATION",
    subject_sha: subject,
    producer_subject_sha: candidate.producer_subject_sha,
    crop_authority_id: authority.authority_id,
    crop_authority_effect: "NONE",
    a0: window.a0,
    o00: window.o00,
    o23: window.o23,
    required_context_count: 25,
    passing_context_count: window.contexts.length - window.failures.length,
    failing_context_count: window.failures.length,
    first_failing_context: window.failures[0] ?? null,
    all_contexts: window.contexts,
    backward_stability_hours: 6,
    forward_transition_guard_hours: 30,
    exact_fao_variant_count: 6,
    planting_time_uncertainty_carried: true,
    future_observations_used: false,
    provider_request_count: 0,
    r2_request_count: 0,
    rehydration_started: false,
    database_read_count: 0,
    database_write_count: 0,
    qualification_subject_sentinel_write_count: 0,
    runtime_write_count: 0,
    scheduler_write_count: 0,
    formal_o00_started: false,
    mcft_cap09_completed: false,
  };
}

function selftest() {
  const authority = loadAuthority();
  const legal = evaluateWindow("2026-08-23T06:00:00.000Z", authority);
  requireCondition(legal.viable && legal.contexts.length === 25 && legal.o23 === "2026-08-24T06:00:00.000Z", "AM19_CROP_PREFLIGHT_SELFTEST_T4R1_LEGAL_WINDOW_REQUIRED");
  const late = evaluateWindow("2026-08-27T22:00:00.000Z", authority);
  requireCondition(!late.viable && late.failures.length > 0 && late.failures[0]?.reason === "STAGE_TRANSITION_RISK", "AM19_CROP_PREFLIGHT_SELFTEST_T4R1_TRANSITION_REQUIRED");
  console.log(JSON.stringify({ status: "PASS", legal_case_count: 1, fail_closed_case_count: 1, database_write_count: 0, provider_request_count: 0 }));
}

const mode = process.argv[2] || "run";
if (mode === "selftest") {
  selftest();
} else if (mode === "run") {
  const subject = String(process.env.SUBJECT_SHA || "").trim();
  requireCondition(/^[0-9a-f]{40}$/.test(subject), "AM19_CROP_PREFLIGHT_EXACT_SUBJECT_SHA_REQUIRED");
  const candidatePath = path.resolve(process.env.MCFT_CAP09_ROLLING_CANDIDATE_PATH || DEFAULT_CANDIDATE_PATH);
  const proof = proofForCandidate(JSON.parse(fs.readFileSync(candidatePath, "utf8")), subject, loadAuthority());
  writeProof(proof);
  if (proof.status !== "PASS") process.exitCode = 3;
} else {
  throw new Error(`AM19_CROP_PREFLIGHT_MODE_INVALID:${mode}`);
}
