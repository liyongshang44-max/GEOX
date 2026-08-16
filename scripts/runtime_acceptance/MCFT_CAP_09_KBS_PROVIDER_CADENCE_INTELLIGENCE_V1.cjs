#!/usr/bin/env node
"use strict";

const HOUR_MS = 3_600_000;
const HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS = 6;
const ENGINEERING_OBSERVATION_WINDOW_HOURS = 24;
const MIN_BATCHES_FOR_LATE_CLASSIFICATION = 3;
const LATE_TOLERANCE_HOURS = 2;
const PROVIDER_EXPECTED_UPDATE_BEHAVIOR = "DAILY_BATCH";
const MIN_DIAGNOSTIC_HEADROOM_MINUTES = 60;
const QUALIFICATION_ATTEMPT_DISCOVERY_DEADLINE_OFFSET_MINUTES = 407;
const QUALIFICATION_ATTEMPT_END_OFFSET_MINUTES = 432;
// Planning-only empirical profile. It is neither a provider SLA nor evidence authority.
const DAILY_BATCH_PLANNING_FIRST_SEEN_HOUR_UTC = 5;
const DAILY_BATCH_PLANNING_FIRST_SEEN_MINUTE_UTC = 30;
const DAILY_BATCH_COVERAGE_START_HOUR_UTC = 5;
const DAILY_BATCH_COVERAGE_END_HOUR_UTC = 4;

function evaluateFreshnessDiagnosticHeadroom(ageHours, minimumMinutes = MIN_DIAGNOSTIC_HEADROOM_MINUTES) {
  const age = Number(ageHours);
  const minimum = Number(minimumMinutes);
  if (!Number.isFinite(age) || !Number.isFinite(minimum) || minimum < 0) {
    throw new Error("KBS_DIAGNOSTIC_HEADROOM_INPUT_INVALID");
  }
  const remaining = HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS * 60 - age * 60;
  return {
    historical_online_freshness_diagnostic_pass: age <= HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS,
    remaining_diagnostic_headroom_minutes: remaining,
    minimum_diagnostic_headroom_minutes: minimum,
    diagnostic_headroom_pass: age <= HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS && remaining >= minimum,
    diagnostic_only: true,
    evidence_admission_effect: false,
    scheduler_dispatch_effect: false,
    authority_effect: false,
  };
}

function assessEa5e2ProtocolCompatibility({
  providerExpectedUpdateBehavior = PROVIDER_EXPECTED_UPDATE_BEHAVIOR,
  sameSourceExactTOnly = true,
  qualificationAttemptDiscoveryDeadlineOffsetMinutes = QUALIFICATION_ATTEMPT_DISCOVERY_DEADLINE_OFFSET_MINUTES,
  qualificationAttemptEndOffsetMinutes = QUALIFICATION_ATTEMPT_END_OFFSET_MINUTES,
  targetSchedulingMode = "FIRST_FUTURE_T_AFTER_READINESS",
} = {}) {
  if (!["FIRST_FUTURE_T_AFTER_READINESS", "PHASE_AWARE_LONG_HORIZON", "ROLLING_PREBOUNDARY_BATCH_INTERSECTION"].includes(targetSchedulingMode)) {
    throw new Error("EA5E2_TARGET_SCHEDULING_MODE_INVALID");
  }
  const dailyBatch = providerExpectedUpdateBehavior === "DAILY_BATCH";
  const boundedAttemptEnvelope = sameSourceExactTOnly === true
    && Number(qualificationAttemptDiscoveryDeadlineOffsetMinutes) === QUALIFICATION_ATTEMPT_DISCOVERY_DEADLINE_OFFSET_MINUTES
    && Number(qualificationAttemptEndOffsetMinutes) === QUALIFICATION_ATTEMPT_END_OFFSET_MINUTES;
  const firstFuture = targetSchedulingMode === "FIRST_FUTURE_T_AFTER_READINESS";
  const rolling = targetSchedulingMode === "ROLLING_PREBOUNDARY_BATCH_INTERSECTION";
  const compatible = rolling || !(dailyBatch && boundedAttemptEnvelope && firstFuture);
  return {
    status: compatible ? "COMPATIBLE" : "CURRENT_ORCHESTRATION_INCOMPATIBLE",
    compatible,
    reason: compatible ? null : "CURRENT_FIRST_FUTURE_T_ORCHESTRATION_INCOMPATIBLE_WITH_KBS_DAILY_BATCH",
    provider_expected_update_behavior: providerExpectedUpdateBehavior,
    same_source_exact_t_only: sameSourceExactTOnly === true,
    qualification_attempt_discovery_deadline_offset_minutes: Number(qualificationAttemptDiscoveryDeadlineOffsetMinutes),
    qualification_attempt_end_offset_minutes: Number(qualificationAttemptEndOffsetMinutes),
    qualification_attempt_offsets_are_normative_evidence_authority: false,
    target_scheduling_mode: targetSchedulingMode,
    retry_or_diagnostic_headroom_can_resolve_current_orchestration: false,
    globally_impossible_for_every_single_t: false,
    rolling_preboundary_batch_intersection_preferred: dailyBatch,
    target_specific_temporal_feasibility_proof_still_required: targetSchedulingMode === "PHASE_AWARE_LONG_HORIZON",
    authority_effect: false,
  };
}

function exactUtcHourMs(value, code) {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(parsed) || parsed % HOUR_MS !== 0) throw new Error(code);
  return parsed;
}

function assessPhaseAwareTargetTemporalFeasibility(targetT, {
  planningFirstSeenHourUtc = DAILY_BATCH_PLANNING_FIRST_SEEN_HOUR_UTC,
  planningFirstSeenMinuteUtc = DAILY_BATCH_PLANNING_FIRST_SEEN_MINUTE_UTC,
} = {}) {
  const targetMs = exactUtcHourMs(targetT, "EA5E2_PHASE_AWARE_TARGET_EXACT_UTC_HOUR_REQUIRED");
  const hour = new Date(targetMs).getUTCHours();
  const batchDayStart = Date.UTC(
    new Date(targetMs).getUTCFullYear(),
    new Date(targetMs).getUTCMonth(),
    new Date(targetMs).getUTCDate() + (hour > DAILY_BATCH_COVERAGE_END_HOUR_UTC ? 1 : 0),
  );
  const coverageStart = batchDayStart - 24 * HOUR_MS + DAILY_BATCH_COVERAGE_START_HOUR_UTC * HOUR_MS;
  const coverageEnd = batchDayStart + DAILY_BATCH_COVERAGE_END_HOUR_UTC * HOUR_MS;
  const plannedFirstSeen = batchDayStart
    + Number(planningFirstSeenHourUtc) * HOUR_MS
    + Number(planningFirstSeenMinuteUtc) * 60_000;
  const attemptDiscoveryDeadline = targetMs + QUALIFICATION_ATTEMPT_DISCOVERY_DEADLINE_OFFSET_MINUTES * 60_000;
  const attemptEnd = targetMs + QUALIFICATION_ATTEMPT_END_OFFSET_MINUTES * 60_000;
  const coverageIncludesTarget = targetMs >= coverageStart && targetMs <= coverageEnd;
  const projectedDiscoveryBeforeAttemptDeadline = plannedFirstSeen <= attemptDiscoveryDeadline;
  const feasible = coverageIncludesTarget && projectedDiscoveryBeforeAttemptDeadline;
  return {
    status: feasible ? "TARGET_SPECIFIC_ENGINEERING_ATTEMPT_FEASIBLE" : "TARGET_SPECIFIC_ENGINEERING_ATTEMPT_INFEASIBLE",
    feasible,
    target_t: new Date(targetMs).toISOString(),
    target_scheduling_mode: "PHASE_AWARE_LONG_HORIZON",
    provider_operating_profile: "CONFIRMED_DAILY_BATCH",
    projected_batch_coverage_start: new Date(coverageStart).toISOString(),
    projected_batch_coverage_end: new Date(coverageEnd).toISOString(),
    projected_batch_first_seen_not_after: new Date(plannedFirstSeen).toISOString(),
    qualification_attempt_discovery_deadline: new Date(attemptDiscoveryDeadline).toISOString(),
    qualification_attempt_end: new Date(attemptEnd).toISOString(),
    projected_attempt_slack_minutes: (attemptDiscoveryDeadline - plannedFirstSeen) / 60_000,
    coverage_includes_target: coverageIncludesTarget,
    projected_discovery_before_attempt_deadline: projectedDiscoveryBeforeAttemptDeadline,
    planning_profile_is_provider_authority: false,
    qualification_attempt_offsets_are_normative_evidence_authority: false,
    actual_same_source_exact_t_watermark_still_required: true,
    historical_online_freshness_diagnostic_hours: HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS,
    freshness_is_late_authoritative_admission_gate: false,
    authority_effect: false,
  };
}

function evaluateCadenceState(state, evaluatedAt = new Date()) {
  if (!state || state.schema_version !== "geox_mcft_cap09_kbs_publication_cadence_state_v1") {
    throw new Error("KBS_CADENCE_INTELLIGENCE_SCHEMA_DRIFT");
  }
  if (state.candidate_publication_class_is_authority !== false || state.kbs_6h_freshness_authority_changed !== false) {
    throw new Error("KBS_CADENCE_INTELLIGENCE_AUTHORITY_BOUNDARY_DRIFT");
  }
  const now = evaluatedAt instanceof Date ? evaluatedAt.getTime() : Date.parse(evaluatedAt);
  const latest = Date.parse(state.latest_event_time);
  if (!Number.isFinite(now) || !Number.isFinite(latest)) throw new Error("KBS_CADENCE_INTELLIGENCE_TIME_INVALID");

  const age = (now - latest) / HOUR_MS;
  const freshnessDiagnosticPass = age <= HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS;
  const withinEngineeringObservationWindow = age <= ENGINEERING_OBSERVATION_WINDOW_HOURS;
  const diagnosticHeadroom = evaluateFreshnessDiagnosticHeadroom(age);
  const protocol = assessEa5e2ProtocolCompatibility({ targetSchedulingMode: "ROLLING_PREBOUNDARY_BATCH_INTERSECTION" });
  const profile = state.provider_cadence_profile || {};
  const latestBatch = state.latest_publication_batch_profile || {};
  const observedBatches = Number(profile.observed_batch_count || 0);
  const intervalP95 = Number(profile.p95_inter_batch_interval_hours);
  const lastFirstSeen = Date.parse(String(latestBatch.first_seen_at || ""));
  const lateClassificationAvailable = observedBatches >= MIN_BATCHES_FOR_LATE_CLASSIFICATION
    && Number.isFinite(intervalP95)
    && Number.isFinite(lastFirstSeen);
  const nextBatchDeadline = lateClassificationAvailable
    ? lastFirstSeen + (intervalP95 + LATE_TOLERANCE_HOURS) * HOUR_MS
    : null;
  const common = {
    current_age_hours: age,
    historical_online_freshness_diagnostic_hours: HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS,
    historical_online_freshness_diagnostic_pass: freshnessDiagnosticPass,
    diagnostic_headroom: diagnosticHeadroom,
    scheduler_dispatch_authority: false,
    scheduler_dispatch_decision: "NOT_PROVIDED_BY_CADENCE_INTELLIGENCE",
    ea5e2_live_protocol_compatibility: protocol,
    activation_readiness: "NOT_DETERMINED_BY_CADENCE_INTELLIGENCE",
    provider_expected_update_behavior: PROVIDER_EXPECTED_UPDATE_BEHAVIOR,
    engineering_observation_window_hours: ENGINEERING_OBSERVATION_WINDOW_HOURS,
    engineering_observation_available: withinEngineeringObservationWindow,
    cadence_intelligence_used_as_authority: false,
    authority_changed: false,
    authority_effect: false,
    late_classification_available: lateClassificationAvailable,
    next_batch_deadline_utc: nextBatchDeadline ? new Date(nextBatchDeadline).toISOString() : null,
  };

  if (lateClassificationAvailable && now > nextBatchDeadline) {
    return { ...common, decision: "FAIL_DIAGNOSTIC", provider_state: "BATCH_LATE_OR_MISSING", reason: "KBS_DAILY_BATCH_MISSED_LEARNED_PUBLICATION_DEADLINE" };
  }
  if (freshnessDiagnosticPass) {
    return { ...common, decision: "OBSERVE", provider_state: "DAILY_BATCH_NORMAL", reason: "KBS_HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_PASS" };
  }
  if (withinEngineeringObservationWindow) {
    return { ...common, decision: "WAIT_NEXT_BATCH", provider_state: "DAILY_BATCH_NORMAL_WAITING", reason: "KBS_DAILY_BATCH_NORMAL_HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_FAIL" };
  }
  return { ...common, decision: "DEFER_DIAGNOSTIC", provider_state: "DAILY_BATCH_PROFILE_NOT_YET_SUFFICIENT_FOR_LATE_CLASSIFICATION", reason: "KBS_DAILY_BATCH_OUTSIDE_ENGINEERING_OBSERVATION_WINDOW" };
}

function selftest() {
  const base = {
    schema_version: "geox_mcft_cap09_kbs_publication_cadence_state_v1",
    candidate_publication_class_is_authority: false,
    kbs_6h_freshness_authority_changed: false,
    latest_event_time: "2026-08-12T10:00:00.000Z",
  };
  const observe = evaluateCadenceState(base, "2026-08-12T15:00:00.000Z");
  const lowDiagnosticHeadroom = evaluateCadenceState({ ...base, latest_event_time: "2026-08-12T09:06:00.000Z" }, "2026-08-12T15:00:00.000Z");
  const wait = evaluateCadenceState({ ...base, latest_event_time: "2026-08-12T04:00:00.000Z" }, "2026-08-12T15:00:00.000Z");
  const defer = evaluateCadenceState({ ...base, latest_event_time: "2026-08-11T04:00:00.000Z" }, "2026-08-12T15:00:00.000Z");
  const fail = evaluateCadenceState({
    ...base,
    latest_event_time: "2026-08-11T04:00:00.000Z",
    provider_cadence_profile: { observed_batch_count: 3, p95_inter_batch_interval_hours: 24.5 },
    latest_publication_batch_profile: { first_seen_at: "2026-08-11T05:00:00.000Z" },
  }, "2026-08-12T15:00:00.000Z");
  const diagnosticHeadroom = evaluateFreshnessDiagnosticHeadroom(4.5);
  const firstFutureProtocol = assessEa5e2ProtocolCompatibility();
  const rollingProtocol = assessEa5e2ProtocolCompatibility({ targetSchedulingMode: "ROLLING_PREBOUNDARY_BATCH_INTERSECTION" });
  const phaseAware22 = assessPhaseAwareTargetTemporalFeasibility("2026-08-13T22:00:00.000Z");
  const phaseAware23 = assessPhaseAwareTargetTemporalFeasibility("2026-08-13T23:00:00.000Z");
  const phaseAware04 = assessPhaseAwareTargetTemporalFeasibility("2026-08-14T04:00:00.000Z");
  const phaseAware05 = assessPhaseAwareTargetTemporalFeasibility("2026-08-14T05:00:00.000Z");

  if (observe.decision !== "OBSERVE" || !observe.historical_online_freshness_diagnostic_pass || observe.scheduler_dispatch_authority !== false) throw new Error("SELFTEST_OBSERVE");
  if (lowDiagnosticHeadroom.decision !== "OBSERVE" || lowDiagnosticHeadroom.diagnostic_headroom.diagnostic_headroom_pass) throw new Error("SELFTEST_DIAGNOSTIC_HEADROOM");
  if (wait.decision !== "WAIT_NEXT_BATCH" || wait.historical_online_freshness_diagnostic_pass || !wait.engineering_observation_available) throw new Error("SELFTEST_WAIT");
  if (defer.decision !== "DEFER_DIAGNOSTIC" || defer.engineering_observation_available) throw new Error("SELFTEST_DEFER");
  if (fail.decision !== "FAIL_DIAGNOSTIC" || fail.provider_state !== "BATCH_LATE_OR_MISSING") throw new Error("SELFTEST_FAIL");
  if (!diagnosticHeadroom.diagnostic_headroom_pass || diagnosticHeadroom.remaining_diagnostic_headroom_minutes !== 90 || diagnosticHeadroom.authority_effect !== false) throw new Error("SELFTEST_HEADROOM");
  if (firstFutureProtocol.compatible || firstFutureProtocol.retry_or_diagnostic_headroom_can_resolve_current_orchestration !== false) throw new Error("SELFTEST_FIRST_FUTURE_PROTOCOL_INCOMPATIBILITY");
  if (!rollingProtocol.compatible || rollingProtocol.rolling_preboundary_batch_intersection_preferred !== true) throw new Error("SELFTEST_ROLLING_PROTOCOL");
  if (phaseAware22.feasible || phaseAware22.projected_attempt_slack_minutes >= 0) throw new Error("SELFTEST_PHASE_AWARE_22_REJECTED");
  if (!phaseAware23.feasible || phaseAware23.projected_attempt_slack_minutes !== 17) throw new Error("SELFTEST_PHASE_AWARE_23_ACCEPTED");
  if (!phaseAware04.feasible || phaseAware04.projected_batch_coverage_end !== phaseAware04.target_t) throw new Error("SELFTEST_PHASE_AWARE_04_ACCEPTED");
  if (phaseAware05.feasible || phaseAware05.projected_batch_coverage_start !== phaseAware05.target_t) throw new Error("SELFTEST_PHASE_AWARE_05_REJECTED");

  return {
    status: "PASS",
    cases: 13,
    provider_expected_update_behavior: PROVIDER_EXPECTED_UPDATE_BEHAVIOR,
    historical_online_freshness_diagnostic_hours: HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS,
    engineering_observation_window_hours: ENGINEERING_OBSERVATION_WINDOW_HOURS,
    minimum_diagnostic_headroom_minutes: MIN_DIAGNOSTIC_HEADROOM_MINUTES,
    first_future_t_live_protocol_compatible: false,
    rolling_preboundary_batch_intersection_live_protocol_compatible: true,
    six_hour_freshness_is_late_authoritative_admission_gate: false,
    scheduler_dispatch_authority: false,
    authority_changed: false,
    authority_effect: false,
  };
}

module.exports = {
  HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS,
  ENGINEERING_OBSERVATION_WINDOW_HOURS,
  PROVIDER_EXPECTED_UPDATE_BEHAVIOR,
  MIN_DIAGNOSTIC_HEADROOM_MINUTES,
  QUALIFICATION_ATTEMPT_DISCOVERY_DEADLINE_OFFSET_MINUTES,
  QUALIFICATION_ATTEMPT_END_OFFSET_MINUTES,
  DAILY_BATCH_PLANNING_FIRST_SEEN_HOUR_UTC,
  DAILY_BATCH_PLANNING_FIRST_SEEN_MINUTE_UTC,
  DAILY_BATCH_COVERAGE_START_HOUR_UTC,
  DAILY_BATCH_COVERAGE_END_HOUR_UTC,
  evaluateFreshnessDiagnosticHeadroom,
  assessEa5e2ProtocolCompatibility,
  assessPhaseAwareTargetTemporalFeasibility,
  evaluateCadenceState,
  selftest,
};
if (require.main === module) console.log(JSON.stringify(selftest()));
