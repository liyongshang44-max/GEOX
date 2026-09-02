#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {
  evaluateTargetCropConsensus,
} = require("../runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS.cjs");

const ROOT = path.resolve(__dirname, "../..");
const AUTHORITY_PATH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-START-READINESS-V1.json");
const CROP_PATH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json");
const AMENDMENT_PATH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md");
const OUTPUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_PRODUCTION_RUNTIME_START_READINESS_V1_RESULT.json");
const HOUR_MS = 3_600_000;

function canonicalIso(value, code) {
  const text = String(value || "").trim();
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}
function exactHour(value, code) {
  const text = canonicalIso(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}
function addHours(value, hours) {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}
function ceilHour(ms) {
  return new Date(Math.ceil(ms / HOUR_MS) * HOUR_MS).toISOString();
}
function contextId(index) {
  return index === 0 ? "A0" : `O${String(index - 1).padStart(2, "0")}`;
}
function evaluateWindow(a0, crop) {
  const contexts = [];
  for (let index = 0; index < 25; index += 1) {
    const logicalTime = addHours(a0, index);
    try {
      const proof = evaluateTargetCropConsensus(logicalTime, crop);
      const pass = proof.status === "PASS" && proof.crop_stage_code === "MID";
      contexts.push({
        context_id: contextId(index),
        logical_time: logicalTime,
        status: pass ? "PASS" : "FAIL",
        crop_stage_code: proof.crop_stage_code,
        reason: pass ? null : "MID_CONSERVATIVE_CONSENSUS_NOT_ESTABLISHED",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      contexts.push({
        context_id: contextId(index),
        logical_time: logicalTime,
        status: "FAIL",
        crop_stage_code: null,
        reason: message.includes("NOT_SINGLE_STAGE") ? "STAGE_TRANSITION_RISK" : message,
      });
    }
  }
  const failures = contexts.filter((row) => row.status !== "PASS");
  return { a0, o00: addHours(a0, 1), o23: addHours(a0, 24), contexts, failures, viable: failures.length === 0 };
}
function scan(crop) {
  const planting = crop.planting_authority?.possible_event_window_utc;
  const variants = crop.model_stage_prior?.variant_stage_lengths_days;
  assert.ok(planting && Array.isArray(variants) && variants.length === 6, "RUNTIME_START_READINESS_CROP_AUTHORITY_INVALID");
  const start = Date.parse(planting.start_inclusive);
  const maxDays = Math.max(...variants.map((v) => v.reduce((sum, n) => sum + Number(n), 0)));
  const end = Date.parse(planting.end_exclusive) + (maxDays + 3) * 24 * HOUR_MS;
  let latest = null;
  let firstAfterLatest = null;
  for (let ms = Math.ceil(start / HOUR_MS) * HOUR_MS; ms <= end; ms += HOUR_MS) {
    const window = evaluateWindow(new Date(ms).toISOString(), crop);
    if (window.viable) latest = window;
    else if (latest && !firstAfterLatest) firstAfterLatest = window;
  }
  if (!latest || !firstAfterLatest) throw new Error("RUNTIME_START_READINESS_SCAN_BOUNDARY_NOT_FOUND");
  return { latest, firstAfterLatest };
}
function main() {
  const subject = String(process.env.SUBJECT_SHA || "").trim();
  assert.match(subject, /^[0-9a-f]{40}$/, "RUNTIME_START_READINESS_SUBJECT_REQUIRED");
  const observedAt = canonicalIso(process.env.OBSERVED_AT, "RUNTIME_START_READINESS_OBSERVED_AT_REQUIRED");
  const authority = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8"));
  const crop = JSON.parse(fs.readFileSync(CROP_PATH, "utf8"));
  const amendment = fs.readFileSync(AMENDMENT_PATH, "utf8");

  assert.equal(authority.status, "BLOCKED_NO_VIABLE_FUTURE_FORMAL_WINDOW_UNDER_CURRENT_T4R1_CROP_AUTHORITY");
  assert.equal(crop.authority_id, "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3");
  assert.equal(crop.scope?.site_id, "KBS_MCSE_T4R1");
  assert.equal(crop.scope?.field_id, "field_kbs_mcse_t4r1");
  assert.equal(crop.scope?.season_id, "season_2026_corn");
  assert.equal(crop.scope?.zone_id, "zone_kbs_mcse_t4r1_crop_formal_v1");
  assert.ok(amendment.includes("36-hour minimum lead"), "RUNTIME_START_READINESS_AMENDMENT06_36H_RULE_REQUIRED");

  const { latest, firstAfterLatest } = scan(crop);
  const frozen = authority.frozen_scan_result;
  assert.equal(latest.a0, frozen.latest_viable_a0, "RUNTIME_START_READINESS_LATEST_A0_MISMATCH");
  assert.equal(latest.o00, frozen.latest_viable_o00, "RUNTIME_START_READINESS_LATEST_O00_MISMATCH");
  assert.equal(latest.o23, frozen.latest_viable_o23, "RUNTIME_START_READINESS_LATEST_O23_MISMATCH");
  assert.equal(firstAfterLatest.a0, frozen.first_nonviable_a0, "RUNTIME_START_READINESS_FIRST_NONVIABLE_A0_MISMATCH");
  assert.equal(firstAfterLatest.failures[0]?.context_id, frozen.first_nonviable_context, "RUNTIME_START_READINESS_FIRST_NONVIABLE_CONTEXT_MISMATCH");
  assert.equal(firstAfterLatest.failures[0]?.logical_time, frozen.first_nonviable_logical_time, "RUNTIME_START_READINESS_FIRST_NONVIABLE_TIME_MISMATCH");
  assert.equal(firstAfterLatest.failures[0]?.reason, frozen.first_nonviable_reason, "RUNTIME_START_READINESS_FIRST_NONVIABLE_REASON_MISMATCH");

  const earliestO00 = exactHour(ceilHour(Date.parse(observedAt) + 36 * HOUR_MS), "RUNTIME_START_READINESS_EARLIEST_O00_INVALID");
  const earliestA0 = addHours(earliestO00, -1);
  const futureWindowAvailable = Date.parse(latest.o00) >= Date.parse(earliestO00);
  assert.equal(futureWindowAvailable, false, "RUNTIME_START_READINESS_EXPECTED_BLOCKER_NOT_PRESENT");
  assert.equal(authority.ruling.runtime_start_authority_may_be_armed, false);
  assert.equal(authority.non_effects.runtime_process_start, false);
  assert.equal(authority.non_effects.production_owner_activation, false);
  assert.equal(authority.non_effects.formal_v5_arm, false);
  assert.equal(authority.non_effects.a0_bootstrap, false);
  assert.equal(authority.non_effects.o00_started, false);

  const proof = {
    schema_version: "geox_mcft_cap09_production_runtime_start_readiness_result_v1",
    status: "PASS",
    readiness_status: authority.status,
    subject_sha: subject,
    observed_at: observedAt,
    crop_authority_id: crop.authority_id,
    exact_fao_variant_count: 6,
    required_context_count: 25,
    required_stage_code: "MID",
    backward_stability_hours: 6,
    forward_transition_guard_hours: 30,
    amendment06_minimum_epoch_selection_lead_hours: 36,
    latest_viable_a0: latest.a0,
    latest_viable_o00: latest.o00,
    latest_viable_o23: latest.o23,
    first_nonviable_a0: firstAfterLatest.a0,
    first_nonviable_context: firstAfterLatest.failures[0],
    earliest_selectable_a0_from_observed_at: earliestA0,
    earliest_selectable_o00_from_observed_at: earliestO00,
    viable_future_formal_window_available: false,
    runtime_start_authority_may_be_armed: false,
    separate_t4r1_stage_or_season_authority_required: true,
    database_read_count: 0,
    database_write_count: 0,
    provider_request_count: 0,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}
try { main(); } catch (error) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify({
    schema_version: "geox_mcft_cap09_production_runtime_start_readiness_result_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    database_read_count: 0,
    database_write_count: 0,
    provider_request_count: 0,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  }, null, 2) + "\n");
  throw error;
}
