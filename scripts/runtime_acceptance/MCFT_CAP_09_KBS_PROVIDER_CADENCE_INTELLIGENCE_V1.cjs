#!/usr/bin/env node
"use strict";

const HOUR_MS = 3_600_000;
const AUTHORITY_MAX_AGE_HOURS = 6;
const ENGINEERING_MAX_AGE_HOURS = 24;
const MIN_BATCHES_FOR_LATE_CLASSIFICATION = 3;
const LATE_TOLERANCE_HOURS = 2;
const PROVIDER_EXPECTED_UPDATE_BEHAVIOR = "DAILY_BATCH";
const MIN_OPERATIONAL_HEADROOM_MINUTES = 60;
const AMENDMENT_07_EXACT_T_POLL_DEADLINE_OFFSET_MINUTES = 427;
const AMENDMENT_07_EXACT_T_CUTOFF_OFFSET_MINUTES = 432;
const OPERATIONAL_EXACT_T_DISCOVERY_DEADLINE_OFFSET_MINUTES = 407;
// Non-authoritative scheduler planning profile. Actual admission still requires
// one same-source exact-T row and <=6h freshness at retrieval time.
const DAILY_BATCH_PLANNING_FIRST_SEEN_HOUR_UTC = 5;
const DAILY_BATCH_PLANNING_FIRST_SEEN_MINUTE_UTC = 30;
const DAILY_BATCH_COVERAGE_START_HOUR_UTC = 5;
const DAILY_BATCH_COVERAGE_END_HOUR_UTC = 4;

function evaluateOperationalHeadroom(ageHours, minimumMinutes = MIN_OPERATIONAL_HEADROOM_MINUTES) {
  const age = Number(ageHours);
  const minimum = Number(minimumMinutes);
  if (!Number.isFinite(age) || !Number.isFinite(minimum) || minimum < 0) {
    throw new Error("KBS_OPERATIONAL_HEADROOM_INPUT_INVALID");
  }
  const remaining = AUTHORITY_MAX_AGE_HOURS * 60 - age * 60;
  return {
    authority_pass: age <= AUTHORITY_MAX_AGE_HOURS,
    remaining_authority_headroom_minutes: remaining,
    minimum_operational_headroom_minutes: minimum,
    operational_headroom_pass: age <= AUTHORITY_MAX_AGE_HOURS && remaining >= minimum,
    scheduler_only: true,
    authority_changed: false,
  };
}

function assessEa5e2ProtocolCompatibility({
  providerExpectedUpdateBehavior = PROVIDER_EXPECTED_UPDATE_BEHAVIOR,
  sameSourceExactTOnly = true,
  exactTPollDeadlineOffsetMinutes = AMENDMENT_07_EXACT_T_POLL_DEADLINE_OFFSET_MINUTES,
  exactTCutoffOffsetMinutes = AMENDMENT_07_EXACT_T_CUTOFF_OFFSET_MINUTES,
  targetSchedulingMode = "FIRST_FUTURE_T_AFTER_READINESS",
} = {}) {
  if (!["FIRST_FUTURE_T_AFTER_READINESS", "PHASE_AWARE_LONG_HORIZON"].includes(targetSchedulingMode)) {
    throw new Error("EA5E2_TARGET_SCHEDULING_MODE_INVALID");
  }
  const dailyBatch = providerExpectedUpdateBehavior === "DAILY_BATCH";
  const frozenExactTEnvelope = sameSourceExactTOnly === true
    && Number(exactTPollDeadlineOffsetMinutes) === AMENDMENT_07_EXACT_T_POLL_DEADLINE_OFFSET_MINUTES
    && Number(exactTCutoffOffsetMinutes) === AMENDMENT_07_EXACT_T_CUTOFF_OFFSET_MINUTES;
  const currentOrchestration = targetSchedulingMode === "FIRST_FUTURE_T_AFTER_READINESS";
  const compatible = !(dailyBatch && frozenExactTEnvelope && currentOrchestration);
  return {
    status: compatible ? "COMPATIBLE" : "CURRENT_ORCHESTRATION_INCOMPATIBLE",
    compatible,
    reason: compatible ? null : "CURRENT_FIRST_FUTURE_T_ORCHESTRATION_INCOMPATIBLE_WITH_KBS_DAILY_BATCH",
    provider_expected_update_behavior: providerExpectedUpdateBehavior,
    same_source_exact_t_only: sameSourceExactTOnly === true,
    exact_t_poll_deadline_offset_minutes: Number(exactTPollDeadlineOffsetMinutes),
    exact_t_cutoff_offset_minutes: Number(exactTCutoffOffsetMinutes),
    target_scheduling_mode: targetSchedulingMode,
    retry_or_headroom_can_resolve_current_orchestration: false,
    globally_impossible_for_every_single_t: false,
    phase_aware_long_horizon_target_scheduling_not_implemented: dailyBatch && frozenExactTEnvelope && currentOrchestration,
    target_specific_temporal_feasibility_proof_still_required: !currentOrchestration,
    required_resolution: compatible ? null : "PHASE_AWARE_LONG_HORIZON_SCHEDULING_OR_NEW_AUTHORITY_PROTOCOL_OR_QUALIFIED_REPLACEMENT_SOURCE",
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
  const discoveryDeadline = targetMs + OPERATIONAL_EXACT_T_DISCOVERY_DEADLINE_OFFSET_MINUTES * 60_000;
  const cutoff = targetMs + AMENDMENT_07_EXACT_T_CUTOFF_OFFSET_MINUTES * 60_000;
  const coverageIncludesTarget = targetMs >= coverageStart && targetMs <= coverageEnd;
  const plannedDiscoveryBeforeDeadline = plannedFirstSeen <= discoveryDeadline;
  const feasible = coverageIncludesTarget && plannedDiscoveryBeforeDeadline;
  return {
    status: feasible ? "TARGET_SPECIFIC_TEMPORALLY_FEASIBLE" : "TARGET_SPECIFIC_TEMPORALLY_INFEASIBLE",
    feasible,
    target_t: new Date(targetMs).toISOString(),
    target_scheduling_mode: "PHASE_AWARE_LONG_HORIZON",
    provider_operating_profile: "CONFIRMED_DAILY_BATCH",
    projected_batch_coverage_start: new Date(coverageStart).toISOString(),
    projected_batch_coverage_end: new Date(coverageEnd).toISOString(),
    projected_batch_first_seen_not_after: new Date(plannedFirstSeen).toISOString(),
    exact_t_discovery_deadline: new Date(discoveryDeadline).toISOString(),
    frozen_exact_t_cutoff: new Date(cutoff).toISOString(),
    projected_discovery_slack_minutes: (discoveryDeadline - plannedFirstSeen) / 60_000,
    coverage_includes_target: coverageIncludesTarget,
    projected_discovery_before_deadline: plannedDiscoveryBeforeDeadline,
    planning_profile_is_provider_authority: false,
    actual_same_source_exact_t_poll_still_required: true,
    actual_retrieval_freshness_max_age_hours: AUTHORITY_MAX_AGE_HOURS,
    authority_changed: false,
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
  const authorityPass = age <= AUTHORITY_MAX_AGE_HOURS;
  const withinEngineering = age <= ENGINEERING_MAX_AGE_HOURS;
  const headroom = evaluateOperationalHeadroom(age);
  const protocol = assessEa5e2ProtocolCompatibility();
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
  const schedulerMayDispatch = authorityPass && headroom.operational_headroom_pass && protocol.compatible;
  const common = {
    current_age_hours: age,
    authority_max_age_hours: AUTHORITY_MAX_AGE_HOURS,
    authority_pass: authorityPass,
    scheduler_may_dispatch: schedulerMayDispatch,
    operational_headroom: headroom,
    ea5e2_live_protocol_compatibility: protocol,
    activation_readiness: protocol.compatible ? (headroom.operational_headroom_pass ? "READY" : "BLOCKED_HEADROOM") : "BLOCKED_PROTOCOL",
    provider_expected_update_behavior: PROVIDER_EXPECTED_UPDATE_BEHAVIOR,
    engineering_max_age_hours: ENGINEERING_MAX_AGE_HOURS,
    engineering_validation_available: withinEngineering,
    cadence_intelligence_used_as_authority: false,
    authority_changed: false,
    late_classification_available: lateClassificationAvailable,
    next_batch_deadline_utc: nextBatchDeadline ? new Date(nextBatchDeadline).toISOString() : null,
  };

  if (authorityPass) {
    if (!protocol.compatible) {
      return { ...common, decision: "AUTHORITY_PASS_BUT_ACTIVATION_BLOCKED", provider_state: "DAILY_BATCH_NORMAL", reason: protocol.reason };
    }
    if (!headroom.operational_headroom_pass) {
      return { ...common, decision: "AUTHORITY_PASS_BUT_ACTIVATION_BLOCKED", provider_state: "DAILY_BATCH_NORMAL", reason: "KBS_RAW_HOURLY_OPERATIONAL_HEADROOM_INSUFFICIENT" };
    }
    return { ...common, decision: "RUN", provider_state: "DAILY_BATCH_NORMAL", reason: "KBS_RAW_HOURLY_WITHIN_FROZEN_6H_AUTHORITY" };
  }
  if (lateClassificationAvailable && now > nextBatchDeadline) {
    return { ...common, decision: "FAIL", provider_state: "BATCH_LATE_OR_MISSING", reason: "KBS_DAILY_BATCH_MISSED_LEARNED_PUBLICATION_DEADLINE" };
  }
  if (withinEngineering) {
    return { ...common, decision: "WAIT_NEXT_BATCH", provider_state: "DAILY_BATCH_NORMAL_WAITING", reason: "KBS_DAILY_BATCH_NORMAL_BUT_PRODUCTION_FRESHNESS_FAILED" };
  }
  return { ...common, decision: "DEFER", provider_state: "DAILY_BATCH_PROFILE_NOT_YET_SUFFICIENT_FOR_LATE_CLASSIFICATION", reason: "KBS_DAILY_BATCH_OUTSIDE_ENGINEERING_WINDOW" };
}

function selftest() {
  const base = {
    schema_version: "geox_mcft_cap09_kbs_publication_cadence_state_v1",
    candidate_publication_class_is_authority: false,
    kbs_6h_freshness_authority_changed: false,
    latest_event_time: "2026-08-12T10:00:00.000Z",
  };
  const run = evaluateCadenceState(base, "2026-08-12T15:00:00.000Z");
  const lowHeadroom = evaluateCadenceState({ ...base, latest_event_time: "2026-08-12T09:06:00.000Z" }, "2026-08-12T15:00:00.000Z");
  const wait = evaluateCadenceState({ ...base, latest_event_time: "2026-08-12T04:00:00.000Z" }, "2026-08-12T15:00:00.000Z");
  const defer = evaluateCadenceState({ ...base, latest_event_time: "2026-08-11T04:00:00.000Z" }, "2026-08-12T15:00:00.000Z");
  const fail = evaluateCadenceState({
    ...base,
    latest_event_time: "2026-08-11T04:00:00.000Z",
    provider_cadence_profile: { observed_batch_count: 3, p95_inter_batch_interval_hours: 24.5 },
    latest_publication_batch_profile: { first_seen_at: "2026-08-11T05:00:00.000Z" },
  }, "2026-08-12T15:00:00.000Z");
  const headroom = evaluateOperationalHeadroom(4.5);
  const protocol = assessEa5e2ProtocolCompatibility();
  const phaseAwareProtocol = assessEa5e2ProtocolCompatibility({ targetSchedulingMode: "PHASE_AWARE_LONG_HORIZON" });
  const phaseAware22 = assessPhaseAwareTargetTemporalFeasibility("2026-08-13T22:00:00.000Z");
  const phaseAware23 = assessPhaseAwareTargetTemporalFeasibility("2026-08-13T23:00:00.000Z");
  const phaseAware04 = assessPhaseAwareTargetTemporalFeasibility("2026-08-14T04:00:00.000Z");
  const phaseAware05 = assessPhaseAwareTargetTemporalFeasibility("2026-08-14T05:00:00.000Z");

  if (run.decision !== "AUTHORITY_PASS_BUT_ACTIVATION_BLOCKED" || !run.authority_pass || !run.operational_headroom.operational_headroom_pass) throw new Error("SELFTEST_RUN");
  if (run.scheduler_may_dispatch || run.activation_readiness !== "BLOCKED_PROTOCOL") throw new Error("SELFTEST_RUN_PROTOCOL_GUARD");
  if (lowHeadroom.decision !== "AUTHORITY_PASS_BUT_ACTIVATION_BLOCKED" || !lowHeadroom.authority_pass || lowHeadroom.operational_headroom.operational_headroom_pass) throw new Error("SELFTEST_HEADROOM_BLOCK");
  if (wait.decision !== "WAIT_NEXT_BATCH" || wait.authority_pass || !wait.engineering_validation_available) throw new Error("SELFTEST_WAIT");
  if (defer.decision !== "DEFER" || defer.engineering_validation_available) throw new Error("SELFTEST_DEFER");
  if (fail.decision !== "FAIL" || fail.provider_state !== "BATCH_LATE_OR_MISSING") throw new Error("SELFTEST_FAIL");
  if (!headroom.operational_headroom_pass || headroom.remaining_authority_headroom_minutes !== 90) throw new Error("SELFTEST_HEADROOM");
  if (protocol.compatible || protocol.retry_or_headroom_can_resolve_current_orchestration !== false || protocol.globally_impossible_for_every_single_t !== false) throw new Error("SELFTEST_PROTOCOL_INCOMPATIBILITY");
  if (!phaseAwareProtocol.compatible || phaseAwareProtocol.target_specific_temporal_feasibility_proof_still_required !== true) throw new Error("SELFTEST_PHASE_AWARE_PROTOCOL_PATH");
  if (phaseAware22.feasible || phaseAware22.projected_discovery_slack_minutes >= 0) throw new Error("SELFTEST_PHASE_AWARE_22_REJECTED");
  if (!phaseAware23.feasible || phaseAware23.projected_discovery_slack_minutes !== 17) throw new Error("SELFTEST_PHASE_AWARE_23_ACCEPTED");
  if (!phaseAware04.feasible || phaseAware04.projected_batch_coverage_end !== phaseAware04.target_t) throw new Error("SELFTEST_PHASE_AWARE_04_ACCEPTED");
  if (phaseAware05.feasible || phaseAware05.projected_batch_coverage_start !== phaseAware05.target_t) throw new Error("SELFTEST_PHASE_AWARE_05_REJECTED");

  return {
    status: "PASS",
    cases: 13,
    provider_expected_update_behavior: PROVIDER_EXPECTED_UPDATE_BEHAVIOR,
    authority_max_age_hours: AUTHORITY_MAX_AGE_HOURS,
    engineering_max_age_hours: ENGINEERING_MAX_AGE_HOURS,
    minimum_operational_headroom_minutes: MIN_OPERATIONAL_HEADROOM_MINUTES,
    first_future_t_live_protocol_compatible: false,
    phase_aware_single_t_live_protocol_compatible: true,
    authority_changed: false,
  };
}

module.exports = {
  AUTHORITY_MAX_AGE_HOURS,
  ENGINEERING_MAX_AGE_HOURS,
  PROVIDER_EXPECTED_UPDATE_BEHAVIOR,
  MIN_OPERATIONAL_HEADROOM_MINUTES,
  AMENDMENT_07_EXACT_T_POLL_DEADLINE_OFFSET_MINUTES,
  AMENDMENT_07_EXACT_T_CUTOFF_OFFSET_MINUTES,
  OPERATIONAL_EXACT_T_DISCOVERY_DEADLINE_OFFSET_MINUTES,
  DAILY_BATCH_PLANNING_FIRST_SEEN_HOUR_UTC,
  DAILY_BATCH_PLANNING_FIRST_SEEN_MINUTE_UTC,
  DAILY_BATCH_COVERAGE_START_HOUR_UTC,
  DAILY_BATCH_COVERAGE_END_HOUR_UTC,
  evaluateOperationalHeadroom,
  assessEa5e2ProtocolCompatibility,
  assessPhaseAwareTargetTemporalFeasibility,
  evaluateCadenceState,
  selftest,
};
if (require.main === module) console.log(JSON.stringify(selftest()));
