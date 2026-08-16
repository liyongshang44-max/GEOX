#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  AUTHORITY_PATH,
  evaluateTargetCropConsensus,
} = require("./PREFLIGHT_MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS.cjs");

const HOUR_MS = 60 * 60 * 1000;
const SLOT_COUNT = 24;
const MINIMUM_LEAD_HOURS = 36;
const EA5E3_READINESS_OFFSET_HOURS = -12;
const ACTIVATION_FREEZE_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-EVIDENCE-FREEZE-V1.json";
const ACTIVATION_EFFECTIVE_AT = "2026-08-16T07:12:23.000Z";
const OUTPUT = "acceptance-output/MCFT_CAP_09_T3R1_SUCCESSOR_WHOLE_WINDOW_SCAN_V2.json";

function exactIso(value, code) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function exactHour(value, code) {
  exactIso(value, code);
  if (!value.endsWith(":00:00.000Z")) throw new Error(code);
  return value;
}

function iso(ms) { return new Date(ms).toISOString(); }
function ceilHour(ms) { return Math.ceil(ms / HOUR_MS) * HOUR_MS; }

function scan() {
  const cropAuthority = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8"));
  const freeze = JSON.parse(fs.readFileSync(ACTIVATION_FREEZE_PATH, "utf8"));
  if (cropAuthority.schema_version !== "geox_mcft_cap09_s6_formal_crop_context_authority_v2") throw new Error("T3R1_SCAN_CROP_AUTHORITY_V2_REQUIRED");
  if (cropAuthority.scope?.site_id !== "KBS_MCSE_T3R1" || cropAuthority.scope?.field_id !== "field_kbs_mcse_t3r1" || cropAuthority.scope?.hybrid_product_code !== "P0306Q") throw new Error("T3R1_SCAN_SCOPE_REQUIRED");
  if (cropAuthority.planting_authority?.possible_event_window_utc?.start_inclusive !== "2026-05-20T04:00:00.000Z" || cropAuthority.planting_authority?.possible_event_window_utc?.end_exclusive !== "2026-05-21T04:00:00.000Z") throw new Error("T3R1_SCAN_PLANTING_WINDOW_REQUIRED");
  if (cropAuthority.as_of_derivation_policy?.backward_stability_hours !== 6 || cropAuthority.as_of_derivation_policy?.forward_transition_guard_hours !== 30 || cropAuthority.as_of_derivation_policy?.future_observations_authorized !== false) throw new Error("T3R1_SCAN_CROP_POLICY_REQUIRED");
  if (freeze.effect_if_exact_head_proof_passes_and_candidate_merges?.ea5e2_operational_activation_qualified !== true) throw new Error("T3R1_SCAN_OPERATIONAL_ACTIVATION_FREEZE_REQUIRED");
  if (freeze.effect_if_exact_head_proof_passes_and_candidate_merges?.next_legal_frontier !== "WHOLE_WINDOW_CROP_CONTEXT_SCAN") throw new Error("T3R1_SCAN_NEXT_FRONTIER_REQUIRED");

  const plantingStart = Date.parse(cropAuthority.planting_authority.possible_event_window_utc.start_inclusive);
  const variants = cropAuthority.model_stage_prior?.variant_stage_lengths_days;
  if (!Array.isArray(variants) || variants.length !== 6) throw new Error("T3R1_SCAN_EXACT_SIX_FAO_VARIANTS_REQUIRED");
  const maxSeasonDays = Math.max(...variants.map((variant) => variant.reduce((sum, value) => sum + Number(value), 0)));
  const scanStart = ceilHour(plantingStart);
  const scanEnd = plantingStart + maxSeasonDays * 24 * HOUR_MS;
  const allCandidates = [];

  for (let start = scanStart; start <= scanEnd; start += HOUR_MS) {
    const stages = [];
    let viable = true;
    for (let offset = 0; offset < SLOT_COUNT; offset += 1) {
      const target = iso(start + offset * HOUR_MS);
      try {
        const result = evaluateTargetCropConsensus(target, cropAuthority);
        if (result.status !== "PASS" || result.future_observations_used !== false || result.provider_request_count !== 0 || result.database_write_count !== 0) throw new Error("T3R1_SCAN_SLOT_SIDE_EFFECT_OR_STATUS_DRIFT");
        stages.push(result.crop_stage_code);
      } catch {
        viable = false;
        break;
      }
    }
    if (!viable || new Set(stages).size !== 1) continue;
    allCandidates.push({
      o00: exactHour(iso(start), "T3R1_SCAN_O00_EXACT_HOUR_REQUIRED"),
      o23: exactHour(iso(start + 23 * HOUR_MS), "T3R1_SCAN_O23_EXACT_HOUR_REQUIRED"),
      stage: stages[0],
      latest_selection_effectiveness_time: iso(start - MINIMUM_LEAD_HOURS * HOUR_MS),
      ea5e3_readiness_deadline: iso(start + EA5E3_READINESS_OFFSET_HOURS * HOUR_MS),
    });
  }

  const activationMs = Date.parse(exactIso(ACTIVATION_EFFECTIVE_AT, "T3R1_SCAN_ACTIVATION_TIME_INVALID"));
  const legalAfterActivation = allCandidates.filter((candidate) => Date.parse(candidate.o00) >= activationMs + MINIMUM_LEAD_HOURS * HOUR_MS);
  if (legalAfterActivation.length === 0) throw new Error("T3R1_SCAN_NO_CURRENT_SEASON_SUCCESSOR_WINDOW_AFTER_ACTIVATION");
  const earliest = legalAfterActivation[0];
  const latest = legalAfterActivation[legalAfterActivation.length - 1];
  if (Date.parse(latest.latest_selection_effectiveness_time) <= activationMs) throw new Error("T3R1_SCAN_LATEST_SELECTION_DEADLINE_ALREADY_EXPIRED_AT_ACTIVATION");

  return {
    schema_version: "geox_mcft_cap09_t3r1_successor_whole_window_scan_v2",
    status: "PASS",
    scan_role: "READ_ONLY_POST_ACTIVATION_CURRENT_SEASON_VIABILITY",
    crop_authority_path: AUTHORITY_PATH,
    activation_freeze_path: ACTIVATION_FREEZE_PATH,
    activation_effective_at: ACTIVATION_EFFECTIVE_AT,
    minimum_lead_hours: MINIMUM_LEAD_HOURS,
    ea5e3_readiness_offset_hours: EA5E3_READINESS_OFFSET_HOURS,
    exact_slot_count: SLOT_COUNT,
    legal_candidate_count_after_activation: legalAfterActivation.length,
    earliest_legal_candidate_if_selected_at_activation: earliest,
    latest_complete_current_season_candidate: latest,
    current_season_successor_window_exists: true,
    successor_epoch_selected: false,
    future_observations_used: false,
    provider_request_count: 0,
    database_write_count: 0,
    r2_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    ea5e3_authorized: false,
    formal_window_started: false,
  };
}

function main() {
  const result = scan();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
}

module.exports = { scan };
if (require.main === module) main();
