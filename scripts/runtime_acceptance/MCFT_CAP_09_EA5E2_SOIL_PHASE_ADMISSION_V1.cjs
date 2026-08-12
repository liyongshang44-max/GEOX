"use strict";

const DEFAULT_SOIL_WINDOW_MINUTES = 15;
const DEFAULT_MIN_INGRESS_MARGIN_MINUTES = 5;
const DEFAULT_MIN_REPEAT_SAMPLES_PER_PHASE = 2;
const EXACT_HOUR_PHASE_OFFSETS = [15, 10, 5];

function finite(value, code) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

function evaluateExactHourPhaseAdmission(rows, options = {}) {
  if (!Array.isArray(rows)) throw new Error("EA5E2_PHASE_ADMISSION_ROWS_REQUIRED");
  const soilWindowMinutes = finite(options.soil_window_minutes ?? DEFAULT_SOIL_WINDOW_MINUTES, "EA5E2_PHASE_ADMISSION_SOIL_WINDOW_REQUIRED");
  const minimumIngressMarginMinutes = finite(options.minimum_ingress_margin_minutes ?? DEFAULT_MIN_INGRESS_MARGIN_MINUTES, "EA5E2_PHASE_ADMISSION_INGRESS_MARGIN_REQUIRED");
  const minimumRepeatSamplesPerPhase = finite(options.minimum_repeat_samples_per_phase ?? DEFAULT_MIN_REPEAT_SAMPLES_PER_PHASE, "EA5E2_PHASE_ADMISSION_REPEAT_REQUIRED");
  if (soilWindowMinutes !== DEFAULT_SOIL_WINDOW_MINUTES || minimumIngressMarginMinutes !== DEFAULT_MIN_INGRESS_MARGIN_MINUTES) {
    throw new Error("EA5E2_PHASE_ADMISSION_FROZEN_AUTHORITY_INPUT_DRIFT");
  }
  if (!Number.isInteger(minimumRepeatSamplesPerPhase) || minimumRepeatSamplesPerPhase < 1) {
    throw new Error("EA5E2_PHASE_ADMISSION_REPEAT_INVALID");
  }

  const normalizedRows = rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("EA5E2_PHASE_ADMISSION_ROW_INVALID");
    const sourceMinuteUtc = finite(row.source_minute_utc, "EA5E2_PHASE_ADMISSION_ROW_MINUTE_REQUIRED");
    const lag = finite(row.first_seen_lag_minutes, "EA5E2_PHASE_ADMISSION_ROW_LAG_REQUIRED");
    if (!Number.isInteger(sourceMinuteUtc) || sourceMinuteUtc < 0 || sourceMinuteUtc > 59 || lag < 0) {
      throw new Error("EA5E2_PHASE_ADMISSION_ROW_VALUE_INVALID");
    }
    return { source_minute_utc: sourceMinuteUtc, first_seen_lag_minutes: lag };
  });

  const phaseProfiles = EXACT_HOUR_PHASE_OFFSETS.map((sourceOffsetBeforeTargetMinutes) => {
    const sourceMinuteUtc = (60 - sourceOffsetBeforeTargetMinutes) % 60;
    const derivedMaxFirstSeenLagMinutes = sourceOffsetBeforeTargetMinutes - minimumIngressMarginMinutes;
    const samples = normalizedRows
      .filter((row) => row.source_minute_utc === sourceMinuteUtc)
      .map((row) => row.first_seen_lag_minutes);
    const evidenceSufficient = samples.length >= minimumRepeatSamplesPerPhase;
    const allSamplesVisibleByIngressDeadline = samples.length > 0 && samples.every((lag) => lag <= derivedMaxFirstSeenLagMinutes);
    return {
      source_offset_before_target_minutes: sourceOffsetBeforeTargetMinutes,
      source_minute_utc: sourceMinuteUtc,
      ingress_deadline_offset_before_target_minutes: minimumIngressMarginMinutes,
      derived_max_first_seen_lag_minutes: derivedMaxFirstSeenLagMinutes,
      sample_count: samples.length,
      minimum_repeat_sample_count: minimumRepeatSamplesPerPhase,
      first_seen_lag_upper_bounds_minutes: samples,
      first_seen_lag_max_minutes: samples.length ? Math.max(...samples) : null,
      evidence_sufficient: evidenceSufficient,
      all_samples_visible_by_ingress_deadline: allSamplesVisibleByIngressDeadline,
      status: evidenceSufficient
        ? (allSamplesVisibleByIngressDeadline ? "PROVEN_COMPATIBLE" : "PROVEN_INCOMPATIBLE")
        : "INSUFFICIENT_REPEAT_EVIDENCE",
    };
  });

  return {
    phase_profiles: phaseProfiles,
    proven_compatible_phase_count: phaseProfiles.filter((profile) => profile.status === "PROVEN_COMPATIBLE").length,
    proven_incompatible_phase_count: phaseProfiles.filter((profile) => profile.status === "PROVEN_INCOMPATIBLE").length,
    insufficient_repeat_phase_count: phaseProfiles.filter((profile) => profile.status === "INSUFFICIENT_REPEAT_EVIDENCE").length,
    scheduler_heuristic_only: true,
    authority_effect: false,
    minimum_repeat_samples_per_phase: minimumRepeatSamplesPerPhase,
  };
}

function runDeterministicSelftest() {
  const cases = [];
  function record(name, rows, expect) {
    const result = evaluateExactHourPhaseAdmission(rows);
    const actual = {
      compatible: result.proven_compatible_phase_count,
      incompatible: result.proven_incompatible_phase_count,
      insufficient: result.insufficient_repeat_phase_count,
      statuses: Object.fromEntries(result.phase_profiles.map((profile) => [String(profile.source_minute_utc), profile.status])),
    };
    const pass = Object.entries(expect).every(([key, value]) => {
      if (key === "statuses") return Object.entries(value).every(([minute, status]) => actual.statuses[minute] === status);
      return actual[key] === value;
    });
    cases.push({ name, pass, actual, expected: expect });
  }

  record(
    "GLOBAL_DIAGNOSTIC_MUST_NOT_OVERRIDE_COMPATIBLE_T_MINUS_15_PHASE",
    [
      { source_minute_utc: 45, first_seen_lag_minutes: 6 },
      { source_minute_utc: 45, first_seen_lag_minutes: 7 },
      { source_minute_utc: 50, first_seen_lag_minutes: 11 },
      { source_minute_utc: 55, first_seen_lag_minutes: 11 },
    ],
    { compatible: 1, statuses: { "45": "PROVEN_COMPATIBLE" } },
  );
  record(
    "TARGET_PHASE_MUST_FAIL_IF_ANY_REPEAT_MISSES_DERIVED_INGRESS_BUDGET",
    [
      { source_minute_utc: 50, first_seen_lag_minutes: 4 },
      { source_minute_utc: 50, first_seen_lag_minutes: 6 },
    ],
    { incompatible: 1, statuses: { "50": "PROVEN_INCOMPATIBLE" } },
  );
  record(
    "OBSERVATIONS_BEFORE_T_MINUS_15_MUST_NOT_COUNT_TOWARD_EXACT_HOUR_PHASE_ADMISSION",
    [
      { source_minute_utc: 40, first_seen_lag_minutes: 1 },
      { source_minute_utc: 40, first_seen_lag_minutes: 1 },
    ],
    { compatible: 0, incompatible: 0, insufficient: 3 },
  );
  record(
    "T_MINUS_15_ROW_FIRST_SEEN_AFTER_T_MINUS_5_MUST_FAIL",
    [
      { source_minute_utc: 45, first_seen_lag_minutes: 9 },
      { source_minute_utc: 45, first_seen_lag_minutes: 10.1 },
    ],
    { incompatible: 1, statuses: { "45": "PROVEN_INCOMPATIBLE" } },
  );
  record(
    "INSUFFICIENT_REPEAT_EVIDENCE_MUST_NOT_AUTHORIZE_LIVE_WINDOW",
    [
      { source_minute_utc: 45, first_seen_lag_minutes: 5 },
    ],
    { compatible: 0, statuses: { "45": "INSUFFICIENT_REPEAT_EVIDENCE" } },
  );

  return {
    status: cases.every((entry) => entry.pass) ? "PASS" : "FAIL",
    case_count: cases.length,
    cases,
    provider_request_count: 0,
    database_read_count: 0,
    database_write_count: 0,
    authority_effect: false,
  };
}

module.exports = {
  DEFAULT_SOIL_WINDOW_MINUTES,
  DEFAULT_MIN_INGRESS_MARGIN_MINUTES,
  DEFAULT_MIN_REPEAT_SAMPLES_PER_PHASE,
  EXACT_HOUR_PHASE_OFFSETS,
  evaluateExactHourPhaseAdmission,
  runDeterministicSelftest,
};
