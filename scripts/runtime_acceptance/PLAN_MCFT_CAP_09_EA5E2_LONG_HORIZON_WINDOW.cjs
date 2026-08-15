#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  assessPhaseAwareTargetTemporalFeasibility,
} = require("./MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE_V1.cjs");

const CROP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json";
const OUTPUT = "acceptance-output/MCFT_CAP_09_EA5E2_LONG_HORIZON_WINDOW_PLAN.json";
const HOUR = 3_600_000;
const MINUTE = 60_000;
const MIN_TARGET_SETUP_BUDGET_MINUTES = 120;
const PRE_BOUNDARY_OFFSET_MINUTES = 30;
const MIN_PRE_BOUNDARY_LEAD_MINUTES = 20;
const MAX_LONG_HORIZON_MINUTES = 24 * 60;
const VIABILITY_ENTRY_LEAD_MINUTES = 175;

function object(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value;
}
function finite(value, code) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}
function isoMs(value, code) {
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}
function stageAt(ageDays, lengths) {
  const b1 = lengths[0];
  const b2 = b1 + lengths[1];
  const b3 = b2 + lengths[2];
  const b4 = b3 + lengths[3];
  if (ageDays < 0 || ageDays >= b4) return null;
  if (ageDays < b1) return "INITIAL";
  if (ageDays < b2) return "DEVELOPMENT";
  if (ageDays < b3) return "MID";
  return "LATE";
}
function write(proof) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify(proof));
}

function main() {
  const now = new Date();
  const authority = JSON.parse(fs.readFileSync(CROP, "utf8"));
  const planting = object(authority.planting_authority, "EA5E2_LONG_HORIZON_PLANTING_AUTHORITY_REQUIRED");
  const window = object(planting.possible_event_window_utc, "EA5E2_LONG_HORIZON_PLANTING_WINDOW_REQUIRED");
  const model = object(authority.model_stage_prior, "EA5E2_LONG_HORIZON_MODEL_STAGE_REQUIRED");
  const policy = object(authority.as_of_derivation_policy, "EA5E2_LONG_HORIZON_DERIVATION_POLICY_REQUIRED");
  const variants = model.variant_stage_lengths_days;
  if (!Array.isArray(variants) || variants.length !== 6 || variants.some((variant) => !Array.isArray(variant) || variant.length !== 4 || variant.some((n) => !Number.isFinite(Number(n))))) {
    throw new Error("EA5E2_LONG_HORIZON_EXACT_SIX_FAO_VARIANTS_REQUIRED");
  }
  const starts = [
    isoMs(window.start_inclusive, "EA5E2_LONG_HORIZON_PLANTING_START_INVALID"),
    isoMs(window.end_exclusive, "EA5E2_LONG_HORIZON_PLANTING_END_INVALID") - 1,
  ];
  const backward = finite(policy.backward_stability_hours, "EA5E2_LONG_HORIZON_BACKWARD_GUARD_REQUIRED");
  const forward = finite(policy.forward_transition_guard_hours, "EA5E2_LONG_HORIZON_FORWARD_GUARD_REQUIRED");
  if (backward !== 6 || forward !== 30 || policy.planting_time_uncertainty_must_be_carried !== true || policy.future_observations_authorized !== false) {
    throw new Error("EA5E2_LONG_HORIZON_CROP_AUTHORITY_DRIFT");
  }

  const earliest = Math.ceil((now.getTime() + (PRE_BOUNDARY_OFFSET_MINUTES + MIN_PRE_BOUNDARY_LEAD_MINUTES + MIN_TARGET_SETUP_BUDGET_MINUTES) * MINUTE) / HOUR) * HOUR;
  const latest = now.getTime() + MAX_LONG_HORIZON_MINUTES * MINUTE;
  let selected = null;
  let legalCount = 0;
  const rejected = [];

  for (let target = earliest; target <= latest; target += HOUR) {
    const stages = new Set();
    let outside = false;
    for (const variant of variants) {
      const lengths = variant.map(Number);
      for (const plantingMs of starts) {
        for (const guarded of [target - backward * HOUR, target, target + forward * HOUR]) {
          const stage = stageAt((guarded - plantingMs) / (24 * HOUR), lengths);
          if (!stage) outside = true;
          else stages.add(stage);
        }
      }
    }
    if (outside || stages.size !== 1) {
      if (rejected.length < 24) rejected.push({ target_t: new Date(target).toISOString(), reason: outside ? "OUTSIDE_MODEL_WINDOW" : "NO_UNIQUE_CONSERVATIVE_STAGE", stages: [...stages].sort() });
      continue;
    }
    legalCount += 1;
    const targetIso = new Date(target).toISOString();
    const temporal = assessPhaseAwareTargetTemporalFeasibility(targetIso);
    if (!temporal.feasible) {
      if (rejected.length < 24) rejected.push({ target_t: targetIso, reason: temporal.status, projected_discovery_slack_minutes: temporal.projected_discovery_slack_minutes });
      continue;
    }
    selected = { target_t: targetIso, crop_stage_code: [...stages][0], temporal };
    break;
  }

  if (!selected) {
    const proof = {
      schema_version: "geox_mcft_cap09_ea5e2_long_horizon_window_plan_v1",
      status: "NO_TARGET_WITHIN_24H_ENGINEERING_HORIZON",
      evaluated_at: now.toISOString(),
      max_long_horizon_minutes: MAX_LONG_HORIZON_MINUTES,
      max_long_horizon_is_authority: false,
      crop_legal_target_count_scanned: legalCount,
      rejected,
      provider_request_count: 0,
      database_read_count: 0,
      database_write_count: 0,
      authority_changed: false,
      live_activation_started: false,
    };
    write(proof);
    process.exitCode = 3;
    return;
  }

  const targetMs = Date.parse(selected.target_t);
  const checkpoints = {
    t_minus_20h: new Date(targetMs - 20 * 60 * MINUTE).toISOString(),
    t_minus_15h: new Date(targetMs - 15 * 60 * MINUTE).toISOString(),
    t_minus_10h: new Date(targetMs - 10 * 60 * MINUTE).toISOString(),
    t_minus_5h: new Date(targetMs - 5 * 60 * MINUTE).toISOString(),
    viability_entry: new Date(targetMs - VIABILITY_ENTRY_LEAD_MINUTES * MINUTE).toISOString(),
  };
  const proof = {
    schema_version: "geox_mcft_cap09_ea5e2_long_horizon_window_plan_v1",
    status: "PASS",
    evaluated_at: now.toISOString(),
    planned_target_t: selected.target_t,
    planned_crop_stage_code: selected.crop_stage_code,
    target_scheduling_mode: "PHASE_AWARE_LONG_HORIZON",
    provider_operating_profile: "CONFIRMED_DAILY_BATCH",
    target_temporal_feasibility: selected.temporal,
    max_long_horizon_minutes: MAX_LONG_HORIZON_MINUTES,
    max_long_horizon_is_authority: false,
    viability_entry_lead_minutes: VIABILITY_ENTRY_LEAD_MINUTES,
    viability_entry_lead_is_authority: false,
    checkpoints,
    crop_legal_target_count_scanned: legalCount,
    rejected_before_target: rejected,
    actual_same_source_exact_t_poll_still_required: true,
    provider_availability_watermark_required_at_late_phase: true,
    six_hour_freshness_is_late_authoritative_admission_gate: false,
    provider_request_count: 0,
    database_read_count: 0,
    database_write_count: 0,
    authority_changed: false,
    live_activation_started: false,
  };
  write(proof);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `planned_target_t=${selected.target_t}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `wake_t_minus_20h=${checkpoints.t_minus_20h}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `wake_t_minus_15h=${checkpoints.t_minus_15h}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `wake_t_minus_10h=${checkpoints.t_minus_10h}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `wake_t_minus_5h=${checkpoints.t_minus_5h}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `viability_entry=${checkpoints.viability_entry}\n`);
  }
}

try {
  main();
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_ea5e2_long_horizon_window_plan_v1",
    status: "FAIL_CLOSED",
    evaluated_at: new Date().toISOString(),
    error_code: error instanceof Error ? error.message : String(error),
    provider_request_count: 0,
    database_read_count: 0,
    database_write_count: 0,
    authority_changed: false,
    live_activation_started: false,
  });
  process.exitCode = 4;
}
