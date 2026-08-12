#!/usr/bin/env node
"use strict";

const HOUR_MS = 3600_000;
const AUTHORITY_MAX_AGE_HOURS = 6;
const MIN_CLASSIFICATION_TRANSITIONS = 3;

function finite(value, code) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(code);
  return n;
}

function isoMs(value, code) {
  const n = Date.parse(String(value));
  if (!Number.isFinite(n)) throw new Error(code);
  return n;
}

function percentileNearestRank(values, percentile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)];
}

function evaluateCadenceState(state, evaluatedAt = new Date()) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("KBS_CADENCE_INTELLIGENCE_STATE_REQUIRED");
  if (state.schema_version !== "geox_mcft_cap09_kbs_publication_cadence_state_v1") throw new Error("KBS_CADENCE_INTELLIGENCE_SCHEMA_DRIFT");
  if (state.candidate_publication_class_is_authority !== false || state.kbs_6h_freshness_authority_changed !== false) {
    throw new Error("KBS_CADENCE_INTELLIGENCE_AUTHORITY_BOUNDARY_DRIFT");
  }

  const nowMs = evaluatedAt instanceof Date ? evaluatedAt.getTime() : isoMs(evaluatedAt, "KBS_CADENCE_INTELLIGENCE_EVALUATED_AT_INVALID");
  const latestMs = isoMs(state.latest_event_time, "KBS_CADENCE_INTELLIGENCE_LATEST_EVENT_INVALID");
  const currentAgeHours = (nowMs - latestMs) / HOUR_MS;
  const history = Array.isArray(state.publication_transition_history) ? state.publication_transition_history : [];
  const forward = history.filter((x) => finite(x.forward_new_event_count ?? 0, "KBS_CADENCE_INTELLIGENCE_FORWARD_COUNT_INVALID") > 0);
  const transitionCount = finite(state.publication_transition_count, "KBS_CADENCE_INTELLIGENCE_TRANSITION_COUNT_INVALID");
  if (transitionCount !== forward.length) throw new Error("KBS_CADENCE_INTELLIGENCE_TRANSITION_COUNT_MISMATCH");

  const pollTimes = forward.map((x) => isoMs(x.polled_at, "KBS_CADENCE_INTELLIGENCE_TRANSITION_POLL_TIME_INVALID")).sort((a, b) => a - b);
  const publicationIntervalsHours = pollTimes.slice(1).map((value, index) => (value - pollTimes[index]) / HOUR_MS);
  const eventAdvanceHours = forward.map((x) => finite(x.latest_advanced_by_hours, "KBS_CADENCE_INTELLIGENCE_ADVANCE_INVALID"));
  const candidateClass = String(state.candidate_publication_class || "");

  const diagnostic = {
    transition_count: transitionCount,
    minimum_classification_transition_count: MIN_CLASSIFICATION_TRANSITIONS,
    candidate_publication_class: candidateClass,
    candidate_publication_class_is_authority: false,
    publication_interval_p50_hours: percentileNearestRank(publicationIntervalsHours, 0.50),
    publication_interval_p95_hours: percentileNearestRank(publicationIntervalsHours, 0.95),
    publication_interval_max_hours: publicationIntervalsHours.length ? Math.max(...publicationIntervalsHours) : null,
    event_advance_p50_hours: percentileNearestRank(eventAdvanceHours, 0.50),
    event_advance_p95_hours: percentileNearestRank(eventAdvanceHours, 0.95),
    event_advance_max_hours: eventAdvanceHours.length ? Math.max(...eventAdvanceHours) : null,
  };

  if (currentAgeHours <= AUTHORITY_MAX_AGE_HOURS) {
    return {
      decision: "PASS",
      reason: "KBS_RAW_HOURLY_WITHIN_FROZEN_6H_AUTHORITY",
      current_age_hours: currentAgeHours,
      authority_max_age_hours: AUTHORITY_MAX_AGE_HOURS,
      authority_pass: true,
      scheduler_may_dispatch: true,
      cadence_intelligence_used_as_authority: false,
      diagnostic,
    };
  }

  if (transitionCount < MIN_CLASSIFICATION_TRANSITIONS || candidateClass === "INSUFFICIENT_TRANSITIONS") {
    return {
      decision: "DEFER",
      reason: "KBS_PROVIDER_CADENCE_EVIDENCE_INSUFFICIENT",
      current_age_hours: currentAgeHours,
      authority_max_age_hours: AUTHORITY_MAX_AGE_HOURS,
      authority_pass: false,
      scheduler_may_dispatch: false,
      cadence_intelligence_used_as_authority: false,
      diagnostic,
    };
  }

  if (candidateClass === "BATCHED_OR_BURSTY_OBSERVED") {
    return {
      decision: "DEFER",
      reason: "KBS_PROVIDER_EXPECTED_BATCH_OR_BURST_DELAY",
      current_age_hours: currentAgeHours,
      authority_max_age_hours: AUTHORITY_MAX_AGE_HOURS,
      authority_pass: false,
      scheduler_may_dispatch: false,
      cadence_intelligence_used_as_authority: false,
      diagnostic,
    };
  }

  if (candidateClass === "HOURLY_INCREMENTAL_OBSERVED") {
    return {
      decision: "FAIL",
      reason: "KBS_PROVIDER_UNEXPECTED_STALENESS_AGAINST_OBSERVED_HOURLY_CADENCE",
      current_age_hours: currentAgeHours,
      authority_max_age_hours: AUTHORITY_MAX_AGE_HOURS,
      authority_pass: false,
      scheduler_may_dispatch: false,
      cadence_intelligence_used_as_authority: false,
      diagnostic,
    };
  }

  return {
    decision: "DEFER",
    reason: "KBS_PROVIDER_VARIABLE_CADENCE_REQUIRES_MORE_OBSERVATION",
    current_age_hours: currentAgeHours,
    authority_max_age_hours: AUTHORITY_MAX_AGE_HOURS,
    authority_pass: false,
    scheduler_may_dispatch: false,
    cadence_intelligence_used_as_authority: false,
    diagnostic,
  };
}

function selftest() {
  const base = {
    schema_version: "geox_mcft_cap09_kbs_publication_cadence_state_v1",
    candidate_publication_class_is_authority: false,
    kbs_6h_freshness_authority_changed: false,
    latest_event_time: "2026-08-12T10:00:00.000Z",
    publication_transition_history: [],
    publication_transition_count: 0,
    candidate_publication_class: "INSUFFICIENT_TRANSITIONS",
  };
  const now = new Date("2026-08-12T15:00:00.000Z");
  const pass = evaluateCadenceState(base, now);
  if (pass.decision !== "PASS" || pass.authority_pass !== true) throw new Error("SELFTEST_FRESH_PASS");

  const insufficient = evaluateCadenceState({ ...base, latest_event_time: "2026-08-12T04:00:00.000Z" }, now);
  if (insufficient.decision !== "DEFER" || insufficient.reason !== "KBS_PROVIDER_CADENCE_EVIDENCE_INSUFFICIENT") throw new Error("SELFTEST_INSUFFICIENT_DEFER");

  const burstHistory = [
    { polled_at: "2026-08-10T05:00:00.000Z", forward_new_event_count: 23, latest_advanced_by_hours: 23 },
    { polled_at: "2026-08-11T05:00:00.000Z", forward_new_event_count: 24, latest_advanced_by_hours: 24 },
    { polled_at: "2026-08-12T05:00:00.000Z", forward_new_event_count: 24, latest_advanced_by_hours: 24 },
  ];
  const burst = evaluateCadenceState({ ...base, latest_event_time: "2026-08-12T04:00:00.000Z", publication_transition_history: burstHistory, publication_transition_count: 3, candidate_publication_class: "BATCHED_OR_BURSTY_OBSERVED" }, now);
  if (burst.decision !== "DEFER" || burst.reason !== "KBS_PROVIDER_EXPECTED_BATCH_OR_BURST_DELAY") throw new Error("SELFTEST_BATCH_DEFER");

  const hourlyHistory = [
    { polled_at: "2026-08-12T08:17:00.000Z", forward_new_event_count: 1, latest_advanced_by_hours: 1 },
    { polled_at: "2026-08-12T09:17:00.000Z", forward_new_event_count: 1, latest_advanced_by_hours: 1 },
    { polled_at: "2026-08-12T10:17:00.000Z", forward_new_event_count: 1, latest_advanced_by_hours: 1 },
  ];
  const stopped = evaluateCadenceState({ ...base, latest_event_time: "2026-08-12T04:00:00.000Z", publication_transition_history: hourlyHistory, publication_transition_count: 3, candidate_publication_class: "HOURLY_INCREMENTAL_OBSERVED" }, now);
  if (stopped.decision !== "FAIL" || stopped.reason !== "KBS_PROVIDER_UNEXPECTED_STALENESS_AGAINST_OBSERVED_HOURLY_CADENCE") throw new Error("SELFTEST_STOPPED_FAIL");

  return { status: "PASS", cases: 4, authority_max_age_hours: AUTHORITY_MAX_AGE_HOURS, authority_changed: false };
}

module.exports = { AUTHORITY_MAX_AGE_HOURS, MIN_CLASSIFICATION_TRANSITIONS, evaluateCadenceState, selftest };

if (require.main === module) console.log(JSON.stringify(selftest()));
