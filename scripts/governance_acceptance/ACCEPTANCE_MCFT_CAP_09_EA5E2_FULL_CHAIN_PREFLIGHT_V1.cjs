#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  evaluateExactHourPhaseAdmission,
  runDeterministicSelftest,
} = require("../runtime_acceptance/MCFT_CAP_09_EA5E2_SOIL_PHASE_ADMISSION_V1.cjs");
const {
  validateTimingBudgetEvidence,
} = require("../runtime_acceptance/MCFT_CAP_09_EA5E2_TIMING_BUDGET_EVIDENCE_V1.cjs");

const LIVE = ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml";
const VIABILITY = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_LIVE_WINDOW_VIABILITY.cjs";
const LATE_POLL = "scripts/runtime_acceptance/POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py";
const SOIL_FIRST_SEEN = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SOIL-FIRST-SEEN-EVIDENCE-V1.json";
const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts";
const PROVIDER = "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py";
const DB_SOURCE = "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts";
const OBSERVER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts";
const FORMAL_READINESS = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts";
const SUCCESSOR_RUNNER = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_SUCCESSOR_RUNNER_QUALIFICATION.cjs";
const CADENCE = "scripts/runtime_acceptance/MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE_V1.cjs";
const WATCHER = "scripts/runtime_acceptance/WATCH_MCFT_CAP_09_KBS_BATCH_QUALIFICATION_WINDOW.py";
const EA4 = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py";
const A0_CANONICAL = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-T3R1-FRESH-BOOTSTRAP-EFFECTIVENESS-V1.json";
const CROP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json";
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
  const readinessBlockers = [];
  const warnings = [];
  const live = read(LIVE);
  const viability = read(VIABILITY);
  const latePoll = read(LATE_POLL);
  const soilFirstSeen = JSON.parse(read(SOIL_FIRST_SEEN));
  const runner = read(RUNNER);
  const provider = read(PROVIDER);
  const db = read(DB_SOURCE);
  const observer = read(OBSERVER);
  const formalReadiness = read(FORMAL_READINESS);
  const successorRunner = read(SUCCESSOR_RUNNER);
  const watcher = read(WATCHER);
  const ea4 = read(EA4);
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
    && has(viability, "REQUIRED_GLOBAL_TRANSITION_COUNT = 12")
    && has(viability, "MIN_REPEAT_SAMPLES_PER_PHASE = 2")
    && has(viability, "EXACT_HOUR_PHASE_OFFSETS = [15, 10, 5]")
    && has(viability, "evaluateExactHourPhaseAdmission")
    && has(viability, 'phase_algorithm_ssot: "MCFT_CAP_09_EA5E2_SOIL_PHASE_ADMISSION_V1"')
    && has(viability, "SOIL_FIRST_SEEN_SAMPLE_COUNT_INSUFFICIENT")
    && has(viability, "SOIL_EXACT_HOUR_PHASE_REPEAT_EVIDENCE_INSUFFICIENT")
    && has(viability, "SOIL_PROVEN_PHASES_MISS_INGRESS_CUTOFF")
    && has(viability, "global_p95_max_used_as_candidate_t_authority: false")
    && has(viability, "phase_conditioned_scheduler_heuristic_only: true")
    && has(viability, "formal_database_access_count: 0")
    && has(viability, "raw_retention_count: 0")
    && has(viability, "canonical_write_count: 0")
    && has(viability, "live_activation_started: false")
    && has(viability, "KBS_RAW_HOURLY_PHASE_AWARE_PLANNING_METADATA_UNAVAILABLE")
    && has(viability, "validateTimingBudgetEvidence")
    && has(viability, "QUALIFIED_EXACT_MAIN_2X_SAFETY")
    && has(viability, "protocolCompatibility.reason")
    && has(viability, "authority_changed: false");
  blocker(blockers, !viabilityImplemented, "LIVE_WINDOW_VIABILITY_PREFLIGHT_NOT_FAIL_CLOSED");

  const dailyBatchProtocolGuardImplemented = has(viability, 'TARGET_SCHEDULING_MODE = "PHASE_AWARE_LONG_HORIZON"')
    && has(viability, "assessPhaseAwareTargetTemporalFeasibility")
    && has(viability, "MAX_TARGET_SELECTION_HORIZON_MINUTES = 180")
    && has(provider, "def command_inspect_kbs")
    && has(provider, '"late_actual_retrieval_must_reprove_authority"')
    && has(live, "EA5E2_ACTIVATION_TARGET_SPECIFIC_TEMPORAL_FEASIBILITY_REQUIRED")
    && has(live, "EA5E2_ACTIVATION_LATE_AVAILABILITY_AND_FRESHNESS_AUTHORITY_REQUIRED")
    && has(read(CADENCE), "assessPhaseAwareTargetTemporalFeasibility");
  blocker(blockers, !dailyBatchProtocolGuardImplemented, "DAILY_BATCH_PROTOCOL_AND_HEADROOM_FAIL_CLOSED_GUARD_MISSING");

  const soilLiveProofSchemaWired = has(live, "const soilP95=Number(viability.soil_global_publication_lag_diagnostic?.p95_minutes);")
    && has(live, "EA5E2_ACTIVATION_SOIL_GLOBAL_P95_PRODUCER_REQUIRED")
    && has(live, "soil_publication_lag_observed_p95_minutes:soilP95");
  blocker(blockers, !soilLiveProofSchemaWired, "LIVE_PROOF_SOIL_P95_SCHEMA_WIRING_DRIFT");

  const phaseAdmissionSelftest = runDeterministicSelftest();
  blocker(blockers, phaseAdmissionSelftest.status !== "PASS", "SOIL_PHASE_ADMISSION_DETERMINISTIC_SELFTEST_FAILED", phaseAdmissionSelftest);

  const globalDiagnostic = object(soilFirstSeen.global_first_seen_diagnostic, "SOIL_GLOBAL_FIRST_SEEN_DIAGNOSTIC_REQUIRED");
  const phaseAdmission = object(soilFirstSeen.exact_hour_phase_admission, "SOIL_EXACT_HOUR_PHASE_ADMISSION_REQUIRED");
  const declaredPhaseProfiles = Array.isArray(phaseAdmission.phase_profiles) ? phaseAdmission.phase_profiles : [];
  const exactRowPhaseEvidence = Array.isArray(soilFirstSeen.exact_row_phase_first_seen) ? soilFirstSeen.exact_row_phase_first_seen : [];
  const recomputedPhaseAdmission = evaluateExactHourPhaseAdmission(
    exactRowPhaseEvidence.map((row) => ({
      source_minute_utc: Number(row.source_minute_utc),
      first_seen_lag_minutes: Number(row.first_seen_lag_minutes),
    })),
    {
      soil_window_minutes: 15,
      minimum_ingress_margin_minutes: 5,
      minimum_repeat_samples_per_phase: 2,
    },
  );
  const phaseProfiles = recomputedPhaseAdmission.phase_profiles;
  blocker(blockers,
    soilFirstSeen.scheduler_viability_only !== true
      || soilFirstSeen.authority_effect !== false
      || Number(soilFirstSeen.observed_source_cadence_minutes) !== 5
      || globalDiagnostic.diagnostic_only !== true
      || globalDiagnostic.candidate_t_admission_authority !== false
      || phaseAdmission.phase_evidence_basis !== "EXACT_SOURCE_ROW_FIRST_SEEN"
      || phaseAdmission.scheduler_heuristic_only !== true
      || phaseAdmission.authority_effect !== false
      || Number(phaseAdmission.soil_observation_window_minutes) !== 15
      || Number(phaseAdmission.minimum_ingress_margin_minutes) !== 5
      || Number(phaseAdmission.minimum_repeat_samples_per_phase) !== 2
      || declaredPhaseProfiles.length !== 3,
    "SOIL_FIRST_SEEN_EVIDENCE_BOUNDARY_DRIFT"
  );
  blocker(blockers, JSON.stringify(declaredPhaseProfiles) !== JSON.stringify(phaseProfiles), "SOIL_PHASE_PROFILE_EVIDENCE_RECOMPUTE_MISMATCH", {
    declared: declaredPhaseProfiles,
    recomputed: phaseProfiles,
  });

  const soilTransitionCount = Number(globalDiagnostic.transition_count);
  const soilMinimumTransitionCount = Number(globalDiagnostic.minimum_transition_count);
  const soilLagP50Minutes = Number(globalDiagnostic.first_seen_lag_p50_minutes);
  const soilLagP95Minutes = Number(globalDiagnostic.first_seen_lag_p95_minutes);
  const soilLagMaxMinutes = Number(globalDiagnostic.first_seen_lag_max_minutes);
  const soilEvidenceSufficient = soilTransitionCount >= soilMinimumTransitionCount;
  const provenCompatiblePhases = phaseProfiles.filter((profile) => profile.status === "PROVEN_COMPATIBLE");
  const insufficientPhaseProfiles = phaseProfiles.filter((profile) => profile.status === "INSUFFICIENT_REPEAT_EVIDENCE");
  const incompatiblePhaseProfiles = phaseProfiles.filter((profile) => profile.status === "PROVEN_INCOMPATIBLE");

  warning(warnings, !soilEvidenceSufficient, "SOIL_FIRST_SEEN_EVIDENCE_CURRENTLY_INSUFFICIENT_FOR_LIVE", {
    global_transition_count: soilTransitionCount,
    minimum_global_transition_count: soilMinimumTransitionCount,
    implication: "LIVE_WINDOW_PREFLIGHT_MUST_RETURN_NO_VIABLE_LIVE_WINDOW_UNTIL_GLOBAL_DIAGNOSTIC_MINIMUM_EXISTS",
  });
  warning(warnings, soilEvidenceSufficient && provenCompatiblePhases.length === 0, "SOIL_EXACT_HOUR_PHASE_ADMISSION_CURRENTLY_UNPROVEN", {
    global_diagnostic: {
      transition_count: soilTransitionCount,
      first_seen_lag_p50_minutes: soilLagP50Minutes,
      first_seen_lag_p95_minutes: soilLagP95Minutes,
      first_seen_lag_max_minutes: soilLagMaxMinutes,
      candidate_t_admission_authority: false,
    },
    phase_profiles: phaseProfiles,
    insufficient_repeat_phase_count: insufficientPhaseProfiles.length,
    proven_incompatible_phase_count: incompatiblePhaseProfiles.length,
    proven_compatible_phase_count: provenCompatiblePhases.length,
    scheduler_heuristic_only: true,
    minimum_repeat_samples_per_phase: Number(phaseAdmission.minimum_repeat_samples_per_phase),
    minimum_repeat_samples_is_authority: false,
    implication: "DO_NOT_DISPATCH_EA5E2_LIVE_UNTIL_ONE_EXACT_HOUR_PHASE_HAS_REPEAT_EVIDENCE_AND_MEETS_ITS_DERIVED_INGRESS_BUDGET",
  });

  blocker(blockers, !has(runner, "const SOIL_WINDOW_MINUTES = 15;") || !has(runner, "const SOIL_FIRST_FETCH_BEFORE_T_MINUTES = 15;") || !has(runner, "observedAt >= soilWindowStart && observedAt <= Date.parse(target)"), "SOIL_SELECTOR_WINDOW_CONFORMANCE_MISSING");
  blocker(blockers, !has(runner, "Promise.allSettled([gfsPromise, soilPromise])"), "GFS_SOIL_PARALLEL_ACQUISITION_MISSING");
  blocker(blockers, !has(runner, "EA5E2_PHASE_FAILURE_TRANSIENT_CLEANUP_FAILED") || !has(runner, "deleteTrackedRetainedRawEvidence"), "ORDINARY_FAILURE_TRANSIENT_CLEANUP_MISSING");

  const latePollImplemented = has(live, "POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py")
    && has(latePoll, "POLL_INTERVAL_SECONDS = 60")
    && has(latePoll, "START_OFFSET_MINUTES = 390")
    && has(latePoll, "CUTOFF_OFFSET_MINUTES = 432")
    && has(latePoll, "MIN_INGRESS_MARGIN_MINUTES = 5")
    && has(latePoll, "COLLECTOR_PROCESSING_BUDGET_MINUTES = 25")
    && has(latePoll, "DEADLINE_OFFSET_MINUTES = CUTOFF_OFFSET_MINUTES - COLLECTOR_PROCESSING_BUDGET_MINUTES")
    && has(latePoll, '"discovery_deadline_is_collector_deadline": False')
    && has(latePoll, '"same_source_exact_t_only": True')
    && has(latePoll, '"late_semantic_availability_polling": True')
    && has(latePoll, "EA5E2_LATE_EXACT_HOUR_AVAILABILITY_DEADLINE_EXCEEDED")
    && has(latePoll, '"raw_retention_count": 0')
    && has(latePoll, '"canonical_write_count": 0');
  blocker(blockers, !latePollImplemented, "LATE_EXACT_HOUR_SEMANTIC_AVAILABILITY_POLLING_NOT_IMPLEMENTED", {
    required_envelope: "SAME_SOURCE_EXACT_T_ONLY; START_GTE_T_PLUS_390; DISCOVERY_STOP_LTE_T_PLUS_407; REAL_COLLECTOR_STOP_LTE_T_PLUS_432",
  });
  blocker(blockers, !has(runner, "response.status === 429 || response.status >= 500") || !has(runner, 'late_transport_retry_scope: "SAME_SOURCE_TRANSIENT_ONLY"'), "LATE_TRANSPORT_RETRY_SCOPE_DRIFT");
  blocker(blockers, !has(provider, "EA5E2_LIVE_KBS_EXACT_TARGET_ROW_REQUIRED"), "EXACT_TARGET_ROW_FAIL_CLOSED_DECODER_REQUIRED");

  const fiveTypes = ["soil_moisture_observation_v1", "observed_rainfall_v1", "historical_et0_estimate_v1", "future_weather_assumption_v1", "future_et0_assumption_v1"];
  blocker(blockers, !has(db, "BEGIN TRANSACTION READ ONLY"), "DB_ONLY_EVIDENCE_SOURCE_READ_ONLY_TRANSACTION_REQUIRED");
  blocker(blockers, fiveTypes.some((x) => !has(db, `\"${x}\"`)), "DB_ONLY_EXACT_FIVE_EVIDENCE_TYPES_REQUIRED");
  blocker(blockers, !has(db, "EA5E2_EXTERNAL_DB_SOURCE_IDENTITY_CONFLICT") || !has(db, "EA5E2_EXTERNAL_DB_DUPLICATE_SOURCE_RECORD_ID"), "DB_ONLY_DUPLICATE_REVISION_FAIL_CLOSED_REQUIRED");
  blocker(blockers, !has(db, "EA5E2_EXTERNAL_DB_REQUIRED_FAMILY_MISSING"), "DB_ONLY_FIVE_FAMILY_CARDINALITY_REQUIRED");

  blocker(blockers, !has(observer, "const OBSERVER_OFFSET_MINUTES = 437;") || !has(observer, "const MAX_OBSERVER_START_SKEW_MINUTES = 10;") || !has(observer, "const EXACT_INTERVAL_CUTOFF_OFFSET_MINUTES = 432;"), "T_PLUS_437_OBSERVER_CLOCK_DRIFT");
  blocker(blockers,
    !has(live, "EA5E2_ACTIVATION_OBSERVER_OPERATIONAL_START_DEADLINE_MISSED")
      || !has(live, "EA5E2_ACTIVATION_OBSERVER_FROZEN_MAX_START_SKEW_MISSED")
      || !has(live, "EA5E2_ACTIVATION_OBSERVER_PROCESSING_RESERVATION_MISSED"),
    "OBSERVER_OPERATIONAL_START_AND_PROCESSING_GUARDS_MISSING");
  blocker(blockers, !has(observer, "BEGIN TRANSACTION READ ONLY"), "FORMAL_A0_OBSERVER_READ_ONLY_REQUIRED");
  blocker(blockers, !has(observer, "EA5E2_ACTIVATION_FORMAL_SCHEDULER_MUST_REMAIN_UNSTARTED"), "FORMAL_SCHEDULER_ZERO_PRECONDITION_REQUIRED");
  blocker(blockers, !has(observer, "A1") || !has(observer, "COMPLETED") || !has(observer, "72"), "EXTERNAL_CAP04_A1_COMPLETED_72_OBSERVER_REQUIRED");
  blocker(blockers,
    !has(read(A0_CANONICAL), "sha256:5f11788fd049a3eae190d566e6faa28f428637e11f2c90b4e0aaea67e6f14e48")
      || !has(observer, "FRESH_BOOTSTRAP_EFFECTIVENESS_PATH")
      || !has(formalReadiness, "FRESH_BOOTSTRAP_EFFECTIVENESS_PATH"),
    "FORMAL_A0_CANONICAL_HASH_DRIFT");
  blocker(blockers, !has(formalReadiness, "br-cold-dust-a6j6aymz") || !has(formalReadiness, "br-falling-cake-a6lfsdak") || !has(formalReadiness, "EA5E2_FORMAL_READINESS_CROP_A0_AUTHORITY_MISMATCH") || !has(formalReadiness, "pointer_graph_validated"), "FORMAL_BRANCH_A0_POINTER_CROP_PREFLIGHT_MISSING");
  blocker(blockers, !has(successorRunner, "qualification_reexecuted: true") || !has(successorRunner, "protected_main_live_dispatch_authorized: false"), "SUCCESSOR_RUNNER_EXACT_HEAD_REQUALIFICATION_MISSING");
  blocker(blockers, !has(live, "SUCCESSOR_RUNNER_EXACT_HEAD_QUALIFICATION_REQUIRED") || !has(live, "PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts"), "LIVE_SUCCESSOR_AND_FORMAL_PREDISPATCH_GATE_MISSING");
  blocker(blockers, count(live, "ASSERT_MCFT_CAP_09_EA5E2_ACTIVATION_BOUNDARY_CURRENT_MAIN.cjs") < 4, "LONG_WINDOW_MULTIPHASE_PROTECTED_MAIN_DRIFT_GUARD_MISSING");
  blocker(blockers, !has(provider, "freshness_evaluated_at") || !has(provider, "def command_probe_gfs") || !has(live, "probe-gfs"), "FETCH_COMPLETION_FRESHNESS_OR_GFS_READINESS_MISSING");
  blocker(blockers,
    !has(provider, "def select_complete_gfs_cycle")
      || !has(provider, "A partially published newest cycle is not a terminal selection")
      || !has(provider, "def command_selftest_gfs_selection"),
    "GFS_OLDER_COMPLETE_SAME_CYCLE_FALLBACK_MISSING");
  blocker(blockers, !has(watcher, '"stop": captured') || !has(watcher, "latest_24h_duplicate_event_time_row_count") || !has(watcher, "SELFTEST_STAGED_CONTINUES"), "KBS_WATCHER_STAGED_OR_DUPLICATE_FAIL_CLOSED_MISSING");

  let dependencyGate = { status: "NOT_RUN" };
  try {
    const stdout = execFileSync(process.execPath, [DEP_GATE], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
    dependencyGate = JSON.parse(stdout[stdout.length - 1]);
  } catch (error) {
    blocker(blockers, true, "RUNTIME_DEPENDENCY_GRAPH_GATE_FAILED", { message: String(error?.message ?? error) });
  }
  blocker(blockers, dependencyGate.status !== "PASS", "RUNTIME_DEPENDENCY_GRAPH_NOT_BOUND");

  const crop = cropProfile(cropAuthority);
  let timingBudget = null;
  try {
    timingBudget = validateTimingBudgetEvidence();
  } catch (error) {
    blocker(blockers, true, "EXACT_MAIN_TIMING_BUDGET_EVIDENCE_INVALID", { message: String(error?.message ?? error) });
  }
  blocker(blockers, !dailyBatchProtocolGuardImplemented, "PHASE_AWARE_LONG_HORIZON_TARGET_SCHEDULING_NOT_BOUND");
  blocker(readinessBlockers, crop.legal_future_target_count === 0, "CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET", {
    implication: "EA5E2_LIVE_DISPATCH_FORBIDDEN_UNTIL_SUCCESSOR_OR_REQUALIFIED_CROP_CONTEXT_AUTHORITY_EXISTS",
    authority_effect: false,
  });
  blocker(readinessBlockers, !timingBudget?.collector, "LATE_EXACT_T_END_TO_END_PROCESSING_BUDGET_NOT_QUALIFIED", {
    discovery_deadline_offset_minutes: 407,
    frozen_cutoff_offset_minutes: 432,
    conservative_reserved_minutes: 25,
    implication: "POLL_PASS_MUST_NOT_RACE_REAL_COLLECTOR_CANONICALIZATION",
  });
  blocker(readinessBlockers, !timingBudget?.observer, "OBSERVER_END_TO_END_PROCESSING_BUDGET_NOT_QUALIFIED", {
    observer_offset_minutes: 437,
    maximum_start_skew_minutes: 10,
    implication: "COLLECTOR_TO_OBSERVER_PROCESSING_BUDGET_REQUIRES_EXACT_HEAD_MEASUREMENT",
  });
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
    schema_version: "geox_mcft_cap09_ea5e2_full_chain_static_preflight_v4",
    status: blockers.length ? "FAIL" : "PASS",
    subject_sha: process.env.MCFT_SUBJECT_SHA ?? process.env.GITHUB_SHA ?? null,
    blocker_count: blockers.length,
    blockers,
    activation_readiness: readinessBlockers.length ? "BLOCKED" : "READY",
    readiness_blocker_count: readinessBlockers.length,
    readiness_blockers: readinessBlockers,
    pre_dispatch_runtime_checks: [
      { code: "SUCCESSOR_RUNNER_EXACT_HEAD_QUALIFICATION_CURRENCY", status: "REQUIRED_AT_LIVE_DISPATCH" },
      { code: "FORMAL_PRIMARY_NEON_BRANCH_A0_POINTER_GRAPH", status: "REQUIRED_AT_LIVE_DISPATCH" },
      { code: "REAL_GFS_COMPLETE_SAME_CYCLE_PGRB2_SFLUX", status: "REQUIRED_AFTER_TARGET_BIND_BEFORE_PROVIDER_EXECUTION" },
      { code: "REAL_SOIL_PAYLOAD_DECODER", status: "REQUIRED_IN_PRE_BOUNDARY_PROVIDER_PHASE" },
      { code: "PROTECTED_MAIN_CRITICAL_BOUNDARY_RECHECK", status: "REQUIRED_BEFORE_PRE_LATE_OBSERVER_AND_FREEZE" }
    ],
    warning_count: warnings.length,
    warnings,
    frozen_clock_contract: frozenClock,
    dependency_graph_status: dependencyGate.status,
    dependency_graph_count: dependencyGate.runtime_dependency_graph_count ?? null,
    exact_main_timing_budget_qualification: timingBudget,
    crop_viability: crop,
    live_window_viability_preflight_implemented: viabilityImplemented,
    daily_batch_protocol_guard_implemented: dailyBatchProtocolGuardImplemented,
    minimum_operational_headroom_minutes: 60,
    operational_headroom_is_authority: false,
    soil_phase_admission_algorithm_ssot: "MCFT_CAP_09_EA5E2_SOIL_PHASE_ADMISSION_V1",
    soil_phase_admission_deterministic_selftest: phaseAdmissionSelftest,
    soil_phase_profile_evidence_recomputed_from_exact_rows: true,
    soil_global_first_seen_transition_count: soilTransitionCount,
    soil_global_first_seen_minimum_transition_count: soilMinimumTransitionCount,
    soil_global_first_seen_lag_p50_minutes: soilLagP50Minutes,
    soil_global_first_seen_lag_p95_minutes: soilLagP95Minutes,
    soil_global_first_seen_lag_max_minutes: soilLagMaxMinutes,
    soil_global_diagnostic_candidate_t_authority: false,
    soil_phase_admission_scheduler_heuristic_only: true,
    soil_phase_minimum_repeat_samples: Number(phaseAdmission.minimum_repeat_samples_per_phase),
    soil_phase_minimum_repeat_samples_is_authority: false,
    soil_phase_profiles: phaseProfiles,
    soil_phase_proven_compatible_count: provenCompatiblePhases.length,
    soil_phase_insufficient_repeat_count: insufficientPhaseProfiles.length,
    soil_phase_proven_incompatible_count: incompatiblePhaseProfiles.length,
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