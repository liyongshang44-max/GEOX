#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const OUTPUT = "acceptance-output/MCFT_CAP_09_EA5E2_LIVE_WINDOW_VIABILITY.json";
const EVIDENCE = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SOIL-FIRST-SEEN-EVIDENCE-V1.json";
const CROP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json";
const PROVIDER = "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py";
const SOIL_ENDPOINT = "https://lter.kbs.msu.edu/weather/variates/25";
const HOUR = 3_600_000;
const MINUTE = 60_000;
const MIN_PRE_BOUNDARY_LEAD_MINUTES = 20;
const PRE_BOUNDARY_OFFSET_MINUTES = 30;
const SOIL_WINDOW_MINUTES = 15;
const MIN_INGRESS_MARGIN_MINUTES = 5;
const REQUIRED_SOIL_CADENCE_MINUTES = 5;
const REQUIRED_GLOBAL_TRANSITION_COUNT = 12;
const MIN_REPEAT_SAMPLES_PER_PHASE = 2;
const EXACT_HOUR_PHASE_OFFSETS = [15, 10, 5];

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
function percentileNearestRank(values, percentile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(percentile * sorted.length));
  return sorted[rank - 1];
}
function writeProof(proof) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof));
}

function runKbsFreshness() {
  const python = process.env.PYTHON || "python3";
  const stdout = execFileSync(python, [PROVIDER, "precheck-kbs"], { encoding: "utf8", timeout: 120_000 });
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) throw new Error("EA5E2_VIABILITY_KBS_PREFLIGHT_OUTPUT_REQUIRED");
  const result = JSON.parse(lines[lines.length - 1]);
  if (result.status !== "PASS" || finite(result.configured_max_age_hours, "EA5E2_VIABILITY_KBS_MAX_AGE_REQUIRED") !== 6) {
    throw new Error("EA5E2_VIABILITY_KBS_CURRENT_AUTHORITY_FAILED");
  }
  return result;
}

async function fetchSoilMetadata() {
  const requestedAt = new Date();
  const response = await fetch(SOIL_ENDPOINT, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "application/json,*/*;q=0.5",
      "User-Agent": "GEOX-MCFT-CAP09-EA5E2-LIVE-WINDOW-VIABILITY/2",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    signal: AbortSignal.timeout(30_000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const retrievedAt = new Date();
  if (!response.ok) throw new Error(`EA5E2_VIABILITY_SOIL_HTTP:${response.status}`);
  const final = new URL(response.url || SOIL_ENDPOINT);
  if (final.protocol !== "https:" || final.hostname !== "lter.kbs.msu.edu" || final.pathname !== "/weather/variates/25") {
    throw new Error("EA5E2_VIABILITY_SOIL_IDENTITY_DRIFT");
  }
  const parsed = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(parsed)) throw new Error("EA5E2_VIABILITY_SOIL_ARRAY_REQUIRED");
  const timestamps = [...new Set(parsed
    .map((row) => row && typeof row === "object" && typeof row.time === "string" && Number.isFinite(Date.parse(row.time)) ? new Date(Date.parse(row.time)).toISOString() : null)
    .filter(Boolean))].sort();
  if (timestamps.length < 8) throw new Error("EA5E2_VIABILITY_SOIL_TIMESTAMP_HISTORY_REQUIRED");
  const tail = timestamps.slice(-8);
  const gaps = tail.slice(1).map((value, index) => (Date.parse(value) - Date.parse(tail[index])) / MINUTE);
  return {
    requested_at: requestedAt.toISOString(),
    retrieved_at: retrievedAt.toISOString(),
    latest_timestamp: tail[tail.length - 1],
    latest_age_minutes: Number(((retrievedAt.getTime() - Date.parse(tail[tail.length - 1])) / MINUTE).toFixed(3)),
    timestamp_tail: tail,
    timestamp_tail_gaps_minutes: gaps,
    observed_source_cadence_minutes: gaps.every((gap) => gap === REQUIRED_SOIL_CADENCE_MINUTES) ? REQUIRED_SOIL_CADENCE_MINUTES : null,
    response_bytes: bytes.length,
    raw_values_emitted: false,
  };
}

function buildExactHourPhaseProfiles(transitions) {
  return EXACT_HOUR_PHASE_OFFSETS.map((sourceOffsetBeforeTargetMinutes) => {
    const sourceMinuteUtc = (60 - sourceOffsetBeforeTargetMinutes) % 60;
    const derivedMaxFirstSeenLagMinutes = sourceOffsetBeforeTargetMinutes - MIN_INGRESS_MARGIN_MINUTES;
    const samples = transitions
      .filter((transition) => new Date(isoMs(transition.to_latest_timestamp, "EA5E2_VIABILITY_SOIL_TRANSITION_SOURCE_TIME_INVALID")).getUTCMinutes() === sourceMinuteUtc)
      .map((transition) => finite(transition.first_seen_lag_minutes, "EA5E2_VIABILITY_SOIL_TRANSITION_LAG_REQUIRED"));
    const evidenceSufficient = samples.length >= MIN_REPEAT_SAMPLES_PER_PHASE;
    const allSamplesVisibleByIngressDeadline = samples.length > 0 && samples.every((lag) => lag <= derivedMaxFirstSeenLagMinutes);
    return {
      source_offset_before_target_minutes: sourceOffsetBeforeTargetMinutes,
      source_minute_utc: sourceMinuteUtc,
      ingress_deadline_offset_before_target_minutes: MIN_INGRESS_MARGIN_MINUTES,
      derived_max_first_seen_lag_minutes: derivedMaxFirstSeenLagMinutes,
      sample_count: samples.length,
      minimum_repeat_sample_count: MIN_REPEAT_SAMPLES_PER_PHASE,
      first_seen_lag_upper_bounds_minutes: samples,
      first_seen_lag_max_minutes: samples.length ? Math.max(...samples) : null,
      evidence_sufficient: evidenceSufficient,
      all_samples_visible_by_ingress_deadline: allSamplesVisibleByIngressDeadline,
      status: evidenceSufficient
        ? (allSamplesVisibleByIngressDeadline ? "PROVEN_COMPATIBLE" : "PROVEN_INCOMPATIBLE")
        : "INSUFFICIENT_REPEAT_EVIDENCE",
    };
  });
}

function soilEvidenceSummary() {
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE, "utf8"));
  if (evidence.schema_version !== "geox_mcft_cap09_ea5e2_soil_first_seen_evidence_v1" || evidence.scheduler_viability_only !== true || evidence.authority_effect !== false) {
    throw new Error("EA5E2_VIABILITY_SOIL_EVIDENCE_CONTRACT_DRIFT");
  }
  if (finite(evidence.observed_source_cadence_minutes, "EA5E2_VIABILITY_SOIL_EVIDENCE_CADENCE_REQUIRED") !== REQUIRED_SOIL_CADENCE_MINUTES) {
    throw new Error("EA5E2_VIABILITY_SOIL_EVIDENCE_CADENCE_DRIFT");
  }
  const globalDiagnostic = object(evidence.global_first_seen_diagnostic, "EA5E2_VIABILITY_GLOBAL_DIAGNOSTIC_REQUIRED");
  const phaseContract = object(evidence.exact_hour_phase_admission, "EA5E2_VIABILITY_PHASE_ADMISSION_REQUIRED");
  if (globalDiagnostic.diagnostic_only !== true || globalDiagnostic.candidate_t_admission_authority !== false) {
    throw new Error("EA5E2_VIABILITY_GLOBAL_DIAGNOSTIC_MUST_NOT_BE_T_LEVEL_AUTHORITY");
  }
  if (phaseContract.scheduler_heuristic_only !== true || phaseContract.authority_effect !== false || finite(phaseContract.minimum_repeat_samples_per_phase, "EA5E2_VIABILITY_PHASE_REPEAT_REQUIRED") !== MIN_REPEAT_SAMPLES_PER_PHASE) {
    throw new Error("EA5E2_VIABILITY_PHASE_HEURISTIC_CONTRACT_DRIFT");
  }
  if (finite(phaseContract.soil_observation_window_minutes, "EA5E2_VIABILITY_PHASE_SOIL_WINDOW_REQUIRED") !== SOIL_WINDOW_MINUTES || finite(phaseContract.minimum_ingress_margin_minutes, "EA5E2_VIABILITY_PHASE_INGRESS_MARGIN_REQUIRED") !== MIN_INGRESS_MARGIN_MINUTES) {
    throw new Error("EA5E2_VIABILITY_PHASE_AUTHORITY_INPUT_DRIFT");
  }

  const transitions = Array.isArray(evidence.transitions) ? evidence.transitions : [];
  const lags = transitions.map((transition) => {
    const source = isoMs(transition.to_latest_timestamp, "EA5E2_VIABILITY_SOIL_TRANSITION_SOURCE_TIME_INVALID");
    const firstSeen = isoMs(transition.first_seen_at, "EA5E2_VIABILITY_SOIL_TRANSITION_FIRST_SEEN_INVALID");
    const derived = (firstSeen - source) / MINUTE;
    const stated = finite(transition.first_seen_lag_minutes, "EA5E2_VIABILITY_SOIL_TRANSITION_LAG_REQUIRED");
    if (Math.abs(derived - stated) > 0.01) throw new Error("EA5E2_VIABILITY_SOIL_TRANSITION_LAG_MISMATCH");
    if (transition.first_seen_is_upper_bound !== true) throw new Error("EA5E2_VIABILITY_SOIL_TRANSITION_UPPER_BOUND_REQUIRED");
    return stated;
  });
  const phaseProfiles = buildExactHourPhaseProfiles(transitions);
  return {
    transition_count: transitions.length,
    minimum_global_transition_count: REQUIRED_GLOBAL_TRANSITION_COUNT,
    global_diagnostic: {
      p50_minutes: percentileNearestRank(lags, 0.50),
      p95_minutes: percentileNearestRank(lags, 0.95),
      max_minutes: lags.length ? Math.max(...lags) : null,
      candidate_t_admission_authority: false,
    },
    exact_hour_phase_admission: {
      scheduler_heuristic_only: true,
      minimum_repeat_samples_per_phase: MIN_REPEAT_SAMPLES_PER_PHASE,
      phase_profiles: phaseProfiles,
      proven_compatible_phase_count: phaseProfiles.filter((profile) => profile.status === "PROVEN_COMPATIBLE").length,
    },
  };
}

function cropTargetProfile(now) {
  const authority = JSON.parse(fs.readFileSync(CROP, "utf8"));
  const planting = object(authority.planting_authority, "EA5E2_VIABILITY_PLANTING_AUTHORITY_REQUIRED");
  const window = object(planting.possible_event_window_utc, "EA5E2_VIABILITY_PLANTING_WINDOW_REQUIRED");
  const model = object(authority.model_stage_prior, "EA5E2_VIABILITY_MODEL_STAGE_REQUIRED");
  const policy = object(authority.as_of_derivation_policy, "EA5E2_VIABILITY_DERIVATION_POLICY_REQUIRED");
  const variants = model.variant_stage_lengths_days;
  if (!Array.isArray(variants) || variants.length !== 6 || variants.some((v) => !Array.isArray(v) || v.length !== 4 || v.some((n) => !Number.isFinite(Number(n))))) {
    throw new Error("EA5E2_VIABILITY_EXACT_SIX_FAO_VARIANTS_REQUIRED");
  }
  const starts = [isoMs(window.start_inclusive, "EA5E2_VIABILITY_PLANTING_START_INVALID"), isoMs(window.end_exclusive, "EA5E2_VIABILITY_PLANTING_END_INVALID") - 1];
  const backward = finite(policy.backward_stability_hours, "EA5E2_VIABILITY_BACKWARD_GUARD_REQUIRED");
  const forward = finite(policy.forward_transition_guard_hours, "EA5E2_VIABILITY_FORWARD_GUARD_REQUIRED");
  if (backward !== 6 || forward !== 30 || policy.planting_time_uncertainty_must_be_carried !== true || policy.future_observations_authorized !== false) {
    throw new Error("EA5E2_VIABILITY_CROP_AUTHORITY_DRIFT");
  }
  let target = Math.ceil((now.getTime() + (PRE_BOUNDARY_OFFSET_MINUTES + MIN_PRE_BOUNDARY_LEAD_MINUTES) * MINUTE) / HOUR) * HOUR;
  const maxEndDays = Math.max(...variants.map((variant) => variant.reduce((a, b) => a + Number(b), 0)));
  const scanEnd = Math.max(...starts) + (maxEndDays + 2) * 24 * HOUR;
  const rejected = [];
  for (; target <= scanEnd; target += HOUR) {
    const stages = new Set();
    let outside = false;
    for (const variant of variants) {
      for (const plantingMs of starts) {
        for (const guarded of [target - backward * HOUR, target, target + forward * HOUR]) {
          const stage = stageAt((guarded - plantingMs) / (24 * HOUR), variant.map(Number));
          if (!stage) outside = true;
          else stages.add(stage);
        }
      }
    }
    if (!outside && stages.size === 1) {
      const leadMinutes = ((target - PRE_BOUNDARY_OFFSET_MINUTES * MINUTE) - now.getTime()) / MINUTE;
      return {
        candidate_t: new Date(target).toISOString(),
        crop_stage_code: [...stages][0],
        pre_boundary_lead_minutes: leadMinutes,
        rejected_before_candidate: rejected,
      };
    }
    if (rejected.length < 12) rejected.push({ target_t: new Date(target).toISOString(), stages: [...stages].sort(), outside_model_window: outside });
  }
  return { candidate_t: null, crop_stage_code: null, pre_boundary_lead_minutes: null, rejected_before_candidate: rejected };
}

async function main() {
  const evaluatedAt = new Date();
  const reasons = [];
  let kbs = null;
  let soil = null;
  let soilEvidence = null;
  let crop = null;

  try { kbs = runKbsFreshness(); }
  catch (error) { reasons.push("KBS_RAW_HOURLY_CURRENT_AUTHORITY_NOT_AVAILABLE"); }

  try {
    soil = await fetchSoilMetadata();
    if (soil.observed_source_cadence_minutes !== REQUIRED_SOIL_CADENCE_MINUTES) reasons.push("SOIL_SOURCE_CADENCE_NOT_5_MINUTES");
  } catch (error) {
    reasons.push("SOIL_ENDPOINT_METADATA_UNAVAILABLE");
  }

  try {
    soilEvidence = soilEvidenceSummary();
    if (soilEvidence.transition_count < REQUIRED_GLOBAL_TRANSITION_COUNT) {
      reasons.push("SOIL_FIRST_SEEN_SAMPLE_COUNT_INSUFFICIENT");
    } else {
      const profiles = soilEvidence.exact_hour_phase_admission.phase_profiles;
      const compatible = profiles.filter((profile) => profile.status === "PROVEN_COMPATIBLE");
      if (!compatible.length) {
        if (profiles.some((profile) => profile.status === "INSUFFICIENT_REPEAT_EVIDENCE")) reasons.push("SOIL_EXACT_HOUR_PHASE_REPEAT_EVIDENCE_INSUFFICIENT");
        if (profiles.some((profile) => profile.status === "PROVEN_INCOMPATIBLE")) reasons.push("SOIL_PROVEN_PHASES_MISS_INGRESS_CUTOFF");
        if (!reasons.includes("SOIL_EXACT_HOUR_PHASE_REPEAT_EVIDENCE_INSUFFICIENT") && !reasons.includes("SOIL_PROVEN_PHASES_MISS_INGRESS_CUTOFF")) reasons.push("SOIL_NO_PROVEN_EXACT_HOUR_INGRESS_PHASE");
      }
    }
  } catch (error) {
    reasons.push("SOIL_FIRST_SEEN_EVIDENCE_INVALID");
  }

  try {
    crop = cropTargetProfile(evaluatedAt);
    if (!crop.candidate_t) reasons.push("CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET");
  } catch (error) {
    reasons.push("CURRENT_CROP_AUTHORITY_UNAVAILABLE");
  }

  const candidate = reasons.length === 0 ? crop.candidate_t : null;
  const proof = {
    schema_version: "geox_mcft_cap09_ea5e2_live_window_viability_preflight_v2",
    status: reasons.length ? "NO_VIABLE_LIVE_WINDOW" : "PASS",
    evaluated_at: evaluatedAt.toISOString(),
    subject_sha: process.env.GITHUB_SHA || process.env.SUBJECT_SHA || null,
    candidate_T: candidate,
    candidate_selection_basis: candidate ? "FIRST_CROP_LEGAL_EXACT_UTC_HOUR_AFTER_PHASE_CONDITIONED_PROVIDER_ADMISSION" : null,
    soil_window_expected: candidate ? `[${new Date(Date.parse(candidate) - SOIL_WINDOW_MINUTES * MINUTE).toISOString()},${candidate}]` : null,
    soil_required_latest_available_by: candidate ? new Date(Date.parse(candidate) - MIN_INGRESS_MARGIN_MINUTES * MINUTE).toISOString() : null,
    soil_required_observation_min: candidate ? new Date(Date.parse(candidate) - SOIL_WINDOW_MINUTES * MINUTE).toISOString() : null,
    kbs_raw_hourly: kbs ? {
      latest_timestamp: kbs.latest_raw_hourly_timestamp,
      current_age_hours: kbs.latest_age_hours,
      authority_max_age_hours: 6,
      current_authority_status: "PASS",
      future_publication_prediction_used: false,
    } : null,
    soil_endpoint25: soil,
    soil_first_seen_evidence: soilEvidence,
    soil_global_publication_lag_diagnostic: soilEvidence?.global_diagnostic ?? null,
    soil_exact_hour_phase_admission: soilEvidence?.exact_hour_phase_admission ?? null,
    crop_candidate: crop,
    window_reason: reasons.length ? null : "PROVIDER_COMPATIBLE_EXACT_HOUR_PHASE_EVIDENCE",
    reason: [...new Set(reasons)],
    authority_audit: {
      global_p95_max_used_as_candidate_t_authority: false,
      phase_conditioned_scheduler_heuristic_only: true,
      minimum_repeat_samples_per_phase: MIN_REPEAT_SAMPLES_PER_PHASE,
      minimum_repeat_samples_is_authority: false,
    },
    frozen_boundaries: {
      soil_window_minutes: SOIL_WINDOW_MINUTES,
      minimum_ingress_margin_minutes: MIN_INGRESS_MARGIN_MINUTES,
      kbs_raw_hourly_max_age_hours: 6,
      late_exact_hour_collector_offset_minutes: 390,
      late_exact_hour_cutoff_offset_minutes: 432,
      runtime_observer_offset_minutes: 437,
      accelerated_clock: false,
    },
    provider_request_count: (kbs ? 1 : 0) + (soil ? 1 : 0),
    formal_database_access_count: 0,
    formal_database_write_count: 0,
    raw_retention_count: 0,
    canonical_write_count: 0,
    scheduler_write_count: 0,
    live_activation_started: false,
    authority_changed: false,
    raw_values_emitted: false,
  };
  writeProof(proof);
  if (proof.status === "PASS" && process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `target_t=${proof.candidate_T}\n`);
  if (proof.status !== "PASS") process.exitCode = 3;
}

main().catch((error) => {
  writeProof({
    schema_version: "geox_mcft_cap09_ea5e2_live_window_viability_preflight_v2",
    status: "NO_VIABLE_LIVE_WINDOW",
    evaluated_at: new Date().toISOString(),
    candidate_T: null,
    reason: ["PREFLIGHT_INTERNAL_FAIL_CLOSED"],
    error_code: error instanceof Error ? error.message : String(error),
    formal_database_access_count: 0,
    formal_database_write_count: 0,
    raw_retention_count: 0,
    canonical_write_count: 0,
    live_activation_started: false,
    authority_changed: false,
    raw_values_emitted: false
  });
  process.exitCode = 4;
});
