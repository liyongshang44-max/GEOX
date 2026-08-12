#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const LIVE = ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml";
const VIABILITY = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_LIVE_WINDOW_VIABILITY.cjs";
const LATE_POLL = "scripts/runtime_acceptance/POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py";
const SOIL_FIRST_SEEN = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SOIL-FIRST-SEEN-EVIDENCE-V1.json";
const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts";
const PROVIDER = "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py";
const DB_SOURCE = "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts";
const OBSERVER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts";
const CROP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json";
const OA = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-RUNNER-QUALIFICATION-V1.json";
const DEP_GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V2.cjs";
const OUTPUT = "acceptance-output/MCFT_CAP_09_EA5E2_FULL_CHAIN_PREFLIGHT.json";
const HOUR = 3600_000;
const MINUTE = 60_000;
const MIN_PRE_BOUNDARY_LEAD_MINUTES = 20;
const PRE_BOUNDARY_OFFSET_MINUTES = 30;

function read(file) { return fs.readFileSync(file, "utf8"); }
function object(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value;
}
function number(value, code) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}
function has(text, marker) { return text.includes(marker); }
function count(text, marker) { return text.split(marker).length - 1; }
function blocker(list, condition, code, detail = null) {
  if (condition) list.push(detail ? { code, detail } : { code });
}
function warning(list, condition, code, detail = null) {
  if (condition) list.push(detail ? { code, detail } : { code });
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

function cropProfile(authority) {
  const planting = object(authority.planting_authority, "EA5E2_PREFLIGHT_PLANTING_AUTHORITY_REQUIRED");
  const window = object(planting.possible_event_window_utc, "EA5E2_PREFLIGHT_PLANTING_WINDOW_REQUIRED");
  const model = object(authority.model_stage_prior, "EA5E2_PREFLIGHT_MODEL_STAGE_PRIOR_REQUIRED");
  const policy = object(authority.as_of_derivation_policy, "EA5E2_PREFLIGHT_DERIVATION_POLICY_REQUIRED");
  const variants = model.variant_stage_lengths_days;
  if (!Array.isArray(variants) || variants.length !== 6) throw new Error("EA5E2_PREFLIGHT_EXACT_SIX_FAO_VARIANTS_REQUIRED");
  const starts = [Date.parse(window.start_inclusive), Date.parse(window.end_exclusive) - 1];
  if (starts.some((x) => !Number.isFinite(x))) throw new Error("EA5E2_PREFLIGHT_PLANTING_WINDOW_INVALID");
  const backward = number(policy.backward_stability_hours, "EA5E2_PREFLIGHT_BACKWARD_GUARD_REQUIRED");
  const forward = number(policy.forward_transition_guard_hours, "EA5E2_PREFLIGHT_FORWARD_GUARD_REQUIRED");
  if (backward !== 6 || forward !== 30) throw new Error("EA5E2_PREFLIGHT_CROP_GUARD_DRIFT");
  if (policy.planting_time_uncertainty_must_be_carried !== true || policy.future_observations_authorized !== false) {
    throw new Error("EA5E2_PREFLIGHT_CROP_POLICY_DRIFT");
  }

  const maxEnd = Math.max(...variants.map((v) => {
    if (!Array.isArray(v) || v.length !== 4 || v.some((x) => typeof x !== "number" || !Number.isFinite(x))) {
      throw new Error("EA5E2_PREFLIGHT_FAO_VARIANT_INVALID");
    }
    return v.reduce((a, b) => a + b, 0);
  }));
  const scanEnd = starts[1] + maxEnd * 24 * HOUR + 48 * HOUR;
  const firstHour = Math.ceil(Date.now() / HOUR) * HOUR;
  const legal = [];
  const rejected = [];
  for (let target = firstHour; target <= scanEnd; target += HOUR) {
    const stages = new Set();
    let outside = false;
    for (const variant of variants) {
      for (const plantingMs of starts) {
        for (const t of [target - backward * HOUR, target, target + forward * HOUR]) {
          const stage = stageAt((t - plantingMs) / (24 * HOUR), variant);
          if (!stage) outside = true;
          else stages.add(stage);
        }
      }
    }
    if (!outside && stages.size === 1) legal.push({ target_t: new Date(target).toISOString(), stage: [...stages][0] });
    else if (rejected.length < 72) rejected.push({ target_t: new Date(target).toISOString(), stages: [...stages].sort(), outside_model_window: outside });
  }
  const last = legal.length ? legal[legal.length - 1] : null;
  const latestDispatch = last
    ? new Date(Date.parse(last.target_t) - (PRE_BOUNDARY_OFFSET_MINUTES + MIN_PRE_BOUNDARY_LEAD_MINUTES) * MINUTE).toISOString()
    : null;
  return {
    legal_future_target_count: legal.length,
    first_legal_future_target: legal[0] ?? null,
    last_legal_future_target: last,
    latest_dispatch_time_for_last_legal_target: latestDispatch,
    first_rejections: rejected,
    backward_stability_hours: backward,
    forward_transition_guard_hours: forward,
  };
}

function main() {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const blockers = [];
  const warnings = [];
  const live = read(LIVE);
  const viability = read(VIABILITY);
  const latePoll = read(LATE_POLL);
  const soilFirstSeen = JSON.parse(read(SOIL_FIRST_SEEN));
  const runner = read(RUNNER);
  const provider = read(PROVIDER);
  const db = read(DB_SOURCE);
  const observer = read(OBSERVER);
  const cropAuthority = JSON.parse(read(CROP));
  const oa = JSON.parse(read(OA));
  const clock = object(oa.provider_and_clock_contract, "EA5E2_PREFLIGHT_CLOCK_AUTHORITY_REQUIRED");

  const frozenClock = {
    kbs_raw_hourly_max_age_hours: clock.kbs_raw_hourly_max_age_hours,
    pre_boundary_collector_offset_minutes: clock.pre_boundary_collector_offset_minutes,
    late_exact_hour_collector_offset_minutes: clock.late_exact_hour_collector_offset_minutes,
    scheduler_eligibility_lag_hours: clock.scheduler_eligibility_lag_hours,
    late_exact_hour_evidence_cutoff_offset_minutes: clock.late_exact_hour_evidence_cutoff_offset_minutes,
    runtime_observer_offset_minutes: clock.runtime_observer_offset_minutes,
    runtime_observer_max_start_skew_minutes: clock.runtime_observer_max_start_skew_minutes,
    minimum_ingestion_margin_minutes: clock.minimum_ingestion_margin_minutes,
  };
  const expectedClock = { kbs_raw_hourly_max_age_hours: 6, pre_boundary_collector_offset_minutes: -30, late_exact_hour_collector_offset_minutes: 390, scheduler_eligibility_lag_hours: 7, late_exact_hour_evidence_cutoff_offset_minutes: 432, runtime_observer_offset_minutes: 437, runtime_observer_max_start_skew_minutes: 10, minimum_ingestion_margin_minutes: 5 };
  blocker(blockers, JSON.stringify(frozenClock) !== JSON.stringify(expectedClock), "FROZEN_CLOCK_AUTHORITY_DRIFT", { expected: expectedClock, actual: frozenClock });
  blocker(blockers, clock.exact_same_cycle_gfs_required !== true, "SAME_CYCLE_GFS_AUTHORITY_DRIFT");
  blocker(blockers, clock.source_substitution_authorized !== false || clock.time_relabeling_authorized !== false || clock.cross_cycle_substitution_authorized !== false || clock.accelerated_formal_clock_authorized !== false, "FROZEN_NON_SUBSTITUTION_AUTHORITY_DRIFT");

  const autoPush = /^\s{2}push:\s*$/m.test(live);
  blocker(blockers, autoPush, "EXPENSIVE_LIVE_AUTO_PUSH_TRIGGER_STILL_ENABLED", { required_mode: "WORKFLOW_DISPATCH_ONLY_AFTER_VIABILITY_PREFLIGHT" });
  blocker(blockers, !has(live, "workflow_dispatch:"), "LIVE_MANUAL_DISPATCH_ENTRY_REQUIRED");
  blocker(blockers, !has(live, "live-window-viability:") || !has(live, "needs: live-window-viability") || !has(live, "PREFLIGHT_MCFT_CAP_09_EA5E2_LIVE_WINDOW_VIABILITY.cjs"), "LIVE_WINDOW_VIABILITY_JOB_NOT_BOUND");
  blocker(blockers, !has(live, "cancel-in-progress: false"), "IN_PROGRESS_LIVE_CANCELLATION_POLICY_DRIFT");
  blocker(blockers, !has(live, "const MIN_PRE_BOUNDARY_LEAD_MINUTES=20;") || !has(live, "const PRE_BOUNDARY_OFFSET_MINUTES=30;"), "TARGET_MINIMUM_LEAD_GUARD_MISSING");
  blocker(blockers, !has(live, "timeout-minutes: 180") || count(live, "timeout-minutes: 190") < 2 || !has(live, "timeout-minutes: 150") || !has(live, "timeout-minutes: 30"), "LIVE_JOB_TIMEOUT_ENVELOPE_DRIFT");
  blocker(blockers, !has(live, "for dir in acceptance-output/pre-attempt acceptance-output/pre acceptance-output/late") || !has(live, "p.discovered_ref_count!==p.deleted_ref_count"), "FAIL_CLOSED_TRANSIENT_CLEANUP_CARDINALITY_MISSING");

  const viabilityImplemented = has(viability, "SOIL_WINDOW_MINUTES = 15")
    && has(viability, "MIN_INGRESS_MARGIN_MINUTES = 5")
    && has(viability, "REQUIRED_SOIL_CADENCE_MINUTES = 5")
    && has(viability, "REQUIRED_TRANSITION_COUNT = 12")
    && has(viability, "SOIL_FIRST_SEEN_SAMPLE_COUNT_INSUFFICIENT")
    && has(viability, "formal_database_access_count: 0")
    && has(viability, "raw_retention_count: 0")
    && has(viability, "canonical_write_count: 0")
    && has(viability, "live_activation_started: false")
    && has(viability, "authority_changed: false");
  blocker(blockers, !viabilityImplemented, "LIVE_WINDOW_VIABILITY_PREFLIGHT_NOT_FAIL_CLOSED");
  blocker(blockers, soilFirstSeen.scheduler_viability_only !== true || soilFirstSeen.authority_effect !== false || Number(soilFirstSeen.observed_source_cadence_minutes) !== 5 || Number(soilFirstSeen.required_max_first_seen_lag_minutes) !== 10, "SOIL_FIRST_SEEN_EVIDENCE_BOUNDARY_DRIFT");
  warning(warnings, Number(soilFirstSeen.transition_count) < Number(soilFirstSeen.minimum_transition_count_for_viability), "SOIL_FIRST_SEEN_EVIDENCE_CURRENTLY_INSUFFICIENT_FOR_LIVE", {
    transition_count: Number(soilFirstSeen.transition_count),
    minimum_transition_count_for_viability: Number(soilFirstSeen.minimum_transition_count_for_viability),
    implication: "LIVE_WINDOW_PREFLIGHT_MUST_RETURN_NO_VIABLE_LIVE_WINDOW_UNTIL_MORE_REAL_TRANSITIONS_EXIST",
  });

  blocker(blockers, !has(runner, "const SOIL_WINDOW_MINUTES = 15;") || !has(runner, "const SOIL_FIRST_FETCH_BEFORE_T_MINUTES = 15;") || !has(runner, "observedAt >= soilWindowStart && observedAt <= Date.parse(target)"), "SOIL_SELECTOR_WINDOW_CONFORMANCE_MISSING");
  blocker(blockers, !has(runner, "Promise.allSettled([gfsPromise, soilPromise])"), "GFS_SOIL_PARALLEL_ACQUISITION_MISSING");
  blocker(blockers, !has(runner, "EA5E2_PHASE_FAILURE_TRANSIENT_CLEANUP_FAILED") || !has(runner, "deleteTrackedRetainedRawEvidence"), "ORDINARY_FAILURE_TRANSIENT_CLEANUP_MISSING");

  const latePollImplemented = has(live, "POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py")
    && has(latePoll, "POLL_INTERVAL_SECONDS = 60")
    && has(latePoll, "START_OFFSET_MINUTES = 390")
    && has(latePoll, "CUTOFF_OFFSET_MINUTES = 432")
    && has(latePoll, "MIN_INGRESS_MARGIN_MINUTES = 5")
    && has(latePoll, "DEADLINE_OFFSET_MINUTES = CUTOFF_OFFSET_MINUTES - MIN_INGRESS_MARGIN_MINUTES")
    && has(latePoll, '"same_source_exact_t_only": True')
    && has(latePoll, '"late_semantic_availability_polling": True')
    && has(latePoll, "EA5E2_LATE_EXACT_HOUR_AVAILABILITY_DEADLINE_EXCEEDED")
    && has(latePoll, '"raw_retention_count": 0')
    && has(latePoll, '"canonical_write_count": 0');
  blocker(blockers, !latePollImplemented, "LATE_EXACT_HOUR_SEMANTIC_AVAILABILITY_POLLING_NOT_IMPLEMENTED", {
    required_envelope: "SAME_SOURCE_EXACT_T_ONLY; START_GTE_T_PLUS_390; STOP_LTE_T_PLUS_427; T_PLUS_432_CUTOFF_UNCHANGED",
  });
  blocker(blockers, !has(runner, "response.status === 429 || response.status >= 500") || !has(runner, 'late_transport_retry_scope: "SAME_SOURCE_TRANSIENT_ONLY"'), "LATE_TRANSPORT_RETRY_SCOPE_DRIFT");
  blocker(blockers, !has(provider, "EA5E2_LIVE_KBS_EXACT_TARGET_ROW_REQUIRED"), "EXACT_TARGET_ROW_FAIL_CLOSED_DECODER_REQUIRED");

  const fiveTypes = ["soil_moisture_observation_v1", "observed_rainfall_v1", "historical_et0_estimate_v1", "future_weather_assumption_v1", "future_et0_assumption_v1"];
  blocker(blockers, !has(db, "BEGIN TRANSACTION READ ONLY"), "DB_ONLY_EVIDENCE_SOURCE_READ_ONLY_TRANSACTION_REQUIRED");
  blocker(blockers, fiveTypes.some((x) => !has(db, `\"${x}\"`)), "DB_ONLY_EXACT_FIVE_EVIDENCE_TYPES_REQUIRED");
  blocker(blockers, !has(db, "EA5E2_EXTERNAL_DB_SOURCE_IDENTITY_CONFLICT") || !has(db, "EA5E2_EXTERNAL_DB_DUPLICATE_SOURCE_RECORD_ID"), "DB_ONLY_DUPLICATE_REVISION_FAIL_CLOSED_REQUIRED");
  blocker(blockers, !has(db, "EA5E2_EXTERNAL_DB_REQUIRED_FAMILY_MISSING"), "DB_ONLY_FIVE_FAMILY_CARDINALITY_REQUIRED");

  blocker(blockers, !has(observer, "const OBSERVER_OFFSET_MINUTES = 437;") || !has(observer, "const MAX_OBSERVER_START_SKEW_MINUTES = 10;") || !has(observer, "const EXACT_INTERVAL_CUTOFF_OFFSET_MINUTES = 432;"), "T_PLUS_437_OBSERVER_CLOCK_DRIFT");
  blocker(blockers, !has(observer, "BEGIN TRANSACTION READ ONLY"), "FORMAL_A0_OBSERVER_READ_ONLY_REQUIRED");
  blocker(blockers, !has(observer, "EA5E2_ACTIVATION_FORMAL_SCHEDULER_MUST_REMAIN_UNSTARTED"), "FORMAL_SCHEDULER_ZERO_PRECONDITION_REQUIRED");
  blocker(blockers, !has(observer, "A1") || !has(observer, "COMPLETED") || !has(observer, "72"), "EXTERNAL_CAP04_A1_COMPLETED_72_OBSERVER_REQUIRED");

  let dependencyGate = { status: "NOT_RUN" };
  try {
    const stdout = execFileSync(process.execPath, [DEP_GATE], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
    dependencyGate = JSON.parse(stdout[stdout.length - 1]);
  } catch (error) {
    blocker(blockers, true, "RUNTIME_DEPENDENCY_GRAPH_GATE_FAILED", { message: String(error?.message ?? error) });
  }
  blocker(blockers, dependencyGate.status !== "PASS", "RUNTIME_DEPENDENCY_GRAPH_NOT_BOUND");

  const crop = cropProfile(cropAuthority);
  blocker(blockers, crop.legal_future_target_count === 0, "CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET");
  warning(warnings, crop.last_legal_future_target !== null, "CURRENT_CROP_AUTHORITY_HAS_TERMINAL_TARGET_CLIFF", {
    last_legal_target: crop.last_legal_future_target,
    latest_dispatch_time_for_last_legal_target: crop.latest_dispatch_time_for_last_legal_target,
    implication: "A_LATER_EA5E2_LIVE_REQUIRES_SUCCESSOR_OR_REQUALIFIED_CROP_CONTEXT_AUTHORITY",
  });
  warning(warnings, true, "HARD_PROCESS_TERMINATION_CAN_BYPASS_IN_PROCESS_TRANSIENT_LEDGER_CLEANUP", {
    ordinary_failure_cleanup: "FAIL_CLOSED_AND_TRACKED",
    residual_class: "RUNNER_LOSS_OR_HARD_WORKFLOW_TERMINATION",
  });

  const proof = {
    schema_version: "geox_mcft_cap09_ea5e2_full_chain_static_preflight_v2",
    status: blockers.length ? "FAIL" : "PASS",
    subject_sha: process.env.GITHUB_SHA ?? null,
    blocker_count: blockers.length,
    blockers,
    warning_count: warnings.length,
    warnings,
    frozen_clock_contract: frozenClock,
    dependency_graph_status: dependencyGate.status,
    dependency_graph_count: dependencyGate.runtime_dependency_graph_count ?? null,
    crop_viability: crop,
    live_window_viability_preflight_implemented: viabilityImplemented,
    soil_first_seen_transition_count: Number(soilFirstSeen.transition_count),
    soil_first_seen_minimum_transition_count: Number(soilFirstSeen.minimum_transition_count_for_viability),
    late_exact_hour_semantic_polling_implemented: latePollImplemented,
    expensive_live_auto_push_trigger_present: autoPush,
    live_dispatch_mode: autoPush ? "INVALID_AUTO_PUSH" : "EXPLICIT_WORKFLOW_DISPATCH",
    db_only_five_family_static_audit_pass: !blockers.some((x) => x.code.startsWith("DB_ONLY_")),
    observer_static_audit_pass: !blockers.some((x) => x.code.includes("OBSERVER") || x.code.includes("FORMAL_SCHEDULER") || x.code.includes("EXTERNAL_CAP04")),
    provider_request_count: 0,
    database_read_count: 0,
    database_write_count: 0,
    raw_value_emission_count: 0,
    formal_effect: false,
    ea5e3_authorized: false,
    formal_window_started: false,
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof));
  if (proof.status !== "PASS") throw new Error(`EA5E2_FULL_CHAIN_STATIC_PREFLIGHT_BLOCKED:${blockers.map((x) => x.code).join(",")}`);
}

main();
