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
} = {}) {
  const dailyBatch = providerExpectedUpdateBehavior === "DAILY_BATCH";
  const frozenExactTEnvelope = sameSourceExactTOnly === true
    && Number(exactTPollDeadlineOffsetMinutes) === AMENDMENT_07_EXACT_T_POLL_DEADLINE_OFFSET_MINUTES
    && Number(exactTCutoffOffsetMinutes) === AMENDMENT_07_EXACT_T_CUTOFF_OFFSET_MINUTES;
  const compatible = !(dailyBatch && frozenExactTEnvelope);
  return {
    status: compatible ? "COMPATIBLE" : "INCOMPATIBLE",
    compatible,
    reason: compatible ? null : "KBS_DAILY_BATCH_INCOMPATIBLE_WITH_AMENDMENT_07_EXACT_T_CUTOFF",
    provider_expected_update_behavior: providerExpectedUpdateBehavior,
    same_source_exact_t_only: sameSourceExactTOnly === true,
    exact_t_poll_deadline_offset_minutes: Number(exactTPollDeadlineOffsetMinutes),
    exact_t_cutoff_offset_minutes: Number(exactTCutoffOffsetMinutes),
    retry_or_headroom_can_resolve: false,
    required_resolution: compatible ? null : "NEW_AUTHORITY_PROTOCOL_OR_QUALIFIED_REPLACEMENT_SOURCE",
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

  if (run.decision !== "RUN" || !run.authority_pass || !run.operational_headroom.operational_headroom_pass) throw new Error("SELFTEST_RUN");
  if (run.scheduler_may_dispatch || run.activation_readiness !== "BLOCKED_PROTOCOL") throw new Error("SELFTEST_RUN_PROTOCOL_GUARD");
  if (lowHeadroom.decision !== "RUN" || !lowHeadroom.authority_pass || lowHeadroom.operational_headroom.operational_headroom_pass) throw new Error("SELFTEST_HEADROOM_BLOCK");
  if (wait.decision !== "WAIT_NEXT_BATCH" || wait.authority_pass || !wait.engineering_validation_available) throw new Error("SELFTEST_WAIT");
  if (defer.decision !== "DEFER" || defer.engineering_validation_available) throw new Error("SELFTEST_DEFER");
  if (fail.decision !== "FAIL" || fail.provider_state !== "BATCH_LATE_OR_MISSING") throw new Error("SELFTEST_FAIL");
  if (!headroom.operational_headroom_pass || headroom.remaining_authority_headroom_minutes !== 90) throw new Error("SELFTEST_HEADROOM");
  if (protocol.compatible || protocol.retry_or_headroom_can_resolve !== false) throw new Error("SELFTEST_PROTOCOL_INCOMPATIBILITY");

  return {
    status: "PASS",
    cases: 8,
    provider_expected_update_behavior: PROVIDER_EXPECTED_UPDATE_BEHAVIOR,
    authority_max_age_hours: AUTHORITY_MAX_AGE_HOURS,
    engineering_max_age_hours: ENGINEERING_MAX_AGE_HOURS,
    minimum_operational_headroom_minutes: MIN_OPERATIONAL_HEADROOM_MINUTES,
    ea5e2_live_protocol_compatible: false,
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
  evaluateOperationalHeadroom,
  assessEa5e2ProtocolCompatibility,
  evaluateCadenceState,
  selftest,
};
if (require.main === module) console.log(JSON.stringify(selftest()));
