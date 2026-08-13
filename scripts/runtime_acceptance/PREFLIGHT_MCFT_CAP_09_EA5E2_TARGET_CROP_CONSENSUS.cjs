#!/usr/bin/env node
"use strict";

// EA5E2_RUNTIME_DEPENDENCY_GRAPH_SHA256=sha256:66d6bb1c987a3529b5c12208cbf732d4b6b847769c5a61e502944ee96e182c1c

const fs = require("node:fs");
const path = require("node:path");

const AUTHORITY_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json";
const OUTPUT = "acceptance-output/MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS_PREFLIGHT.json";
const HOUR_MS = 60 * 60 * 1000;

function required(value, code) {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function exactHour(value) {
  const text = required(value, "EA5E2_TARGET_CROP_CONSENSUS_TARGET_REQUIRED");
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) {
    throw new Error("EA5E2_TARGET_CROP_CONSENSUS_EXACT_UTC_HOUR_REQUIRED");
  }
  return text;
}

function object(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value;
}

function number(value, code) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function stageAt(ageDays, lengths) {
  if (!Array.isArray(lengths) || lengths.length !== 4 || lengths.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error("EA5E2_TARGET_CROP_CONSENSUS_VARIANT_INVALID");
  }
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

function main() {
  const targetT = exactHour(process.env.TARGET_T);
  const authority = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8"));
  const planting = object(authority.planting_authority, "EA5E2_TARGET_CROP_CONSENSUS_PLANTING_AUTHORITY_REQUIRED");
  const window = object(planting.possible_event_window_utc, "EA5E2_TARGET_CROP_CONSENSUS_PLANTING_WINDOW_REQUIRED");
  const model = object(authority.model_stage_prior, "EA5E2_TARGET_CROP_CONSENSUS_MODEL_REQUIRED");
  const policy = object(authority.as_of_derivation_policy, "EA5E2_TARGET_CROP_CONSENSUS_POLICY_REQUIRED");
  const variants = model.variant_stage_lengths_days;
  if (!Array.isArray(variants) || variants.length !== 6) throw new Error("EA5E2_TARGET_CROP_CONSENSUS_EXACT_SIX_VARIANTS_REQUIRED");
  const backwardHours = number(policy.backward_stability_hours, "EA5E2_TARGET_CROP_CONSENSUS_BACKWARD_GUARD_REQUIRED");
  const forwardHours = number(policy.forward_transition_guard_hours, "EA5E2_TARGET_CROP_CONSENSUS_FORWARD_GUARD_REQUIRED");
  if (backwardHours !== 6 || forwardHours !== 30) throw new Error("EA5E2_TARGET_CROP_CONSENSUS_GUARD_DRIFT");
  if (policy.planting_time_uncertainty_must_be_carried !== true || policy.future_observations_authorized !== false) {
    throw new Error("EA5E2_TARGET_CROP_CONSENSUS_POLICY_DRIFT");
  }

  const startInclusive = Date.parse(required(window.start_inclusive, "EA5E2_TARGET_CROP_CONSENSUS_START_REQUIRED"));
  const endExclusive = Date.parse(required(window.end_exclusive, "EA5E2_TARGET_CROP_CONSENSUS_END_REQUIRED"));
  if (!Number.isFinite(startInclusive) || !Number.isFinite(endExclusive) || startInclusive >= endExclusive) {
    throw new Error("EA5E2_TARGET_CROP_CONSENSUS_PLANTING_WINDOW_INVALID");
  }
  const plantingTimes = [startInclusive, endExclusive - 1];
  const targetMs = Date.parse(targetT);
  const guardTimes = [targetMs - backwardHours * HOUR_MS, targetMs, targetMs + forwardHours * HOUR_MS];
  const stages = new Set();
  for (const variant of variants) {
    for (const plantingMs of plantingTimes) {
      for (const timeMs of guardTimes) {
        const stage = stageAt((timeMs - plantingMs) / (24 * HOUR_MS), variant);
        if (!stage) throw new Error("EA5E2_TARGET_CROP_CONSENSUS_OUTSIDE_FROZEN_MODEL_WINDOW");
        stages.add(stage);
      }
    }
  }
  if (stages.size !== 1) {
    throw new Error(`EA5E2_TARGET_CROP_CONSENSUS_NOT_SINGLE_STAGE:${[...stages].sort().join(",")}`);
  }

  const stage = [...stages][0];
  const proof = {
    schema_version: "geox_mcft_cap09_ea5e2_target_crop_consensus_preflight_v1",
    status: "PASS",
    target_t: targetT,
    crop_stage_code: stage,
    exact_fao_variant_count: variants.length,
    exact_planting_boundary_count: plantingTimes.length,
    backward_stability_hours: backwardHours,
    forward_transition_guard_hours: forwardHours,
    planting_time_uncertainty_carried: true,
    future_observations_used: false,
    provider_request_count: 0,
    database_write_count: 0,
    formal_effectiveness: false,
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof));
}

main();
