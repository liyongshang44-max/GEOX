#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  PROVIDER_EXPECTED_UPDATE_BEHAVIOR,
  HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS,
  ENGINEERING_OBSERVATION_WINDOW_HOURS,
  evaluateCadenceState,
  selftest,
} = require("./MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE_V1.cjs");

const CADENCE_STATE = process.env.KBS_CADENCE_STATE || "acceptance-output/PREVIOUS_KBS_PUBLICATION_CADENCE_STATE.json";
const CURRENT = process.env.KBS_CURRENT_FRESHNESS || "acceptance-output/KBS_CURRENT_FRESHNESS_METADATA.json";
const OUTPUT = process.env.KBS_CADENCE_INTELLIGENCE_OUTPUT || "acceptance-output/KBS_PROVIDER_CADENCE_INTELLIGENCE.json";

function readJson(file, code) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { throw new Error(`${code}:${error.message}`); }
}
function write(proof) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof));
}
function currentSnapshotProfile(current) {
  return {
    observation_time_start: current.latest_24h_observation_start,
    observation_time_end: current.latest_24h_observation_end,
    expected_hour_count: Number(current.latest_24h_expected_hour_count),
    observed_hour_count: Number(current.latest_24h_observed_hour_count),
    missing_event_times: current.latest_24h_missing_event_times,
    contiguous_hourly_coverage: current.latest_24h_contiguous === true,
    duplicate_event_time_row_count: Number(current.latest_24h_duplicate_event_time_row_count),
    metadata_only: true,
  };
}
function main() {
  const test = selftest();
  if (test.status !== "PASS"
      || test.cases !== 13
      || test.authority_changed !== false
      || test.authority_effect !== false
      || test.provider_expected_update_behavior !== "DAILY_BATCH"
      || test.first_future_t_live_protocol_compatible !== false
      || test.rolling_preboundary_batch_intersection_live_protocol_compatible !== true
      || test.six_hour_freshness_is_late_authoritative_admission_gate !== false
      || test.scheduler_dispatch_authority !== false) {
    throw new Error("KBS_CADENCE_INTELLIGENCE_SELFTEST_FAILED");
  }
  const current = readJson(CURRENT, "KBS_CURRENT_FRESHNESS_METADATA_REQUIRED");
  if (
    current.schema_version !== "geox_mcft_cap09_kbs_current_freshness_metadata_v1"
    || current.authority_changed !== false
    || current.raw_values_emitted !== false
    || current.latest_24h_expected_hour_count !== 24
    || !Array.isArray(current.latest_24h_missing_event_times)
    || !Number.isInteger(current.latest_24h_duplicate_event_time_row_count)
  ) throw new Error("KBS_CURRENT_FRESHNESS_METADATA_CONTRACT_DRIFT");

  const state = fs.existsSync(CADENCE_STATE) ? readJson(CADENCE_STATE, "KBS_CADENCE_STATE_REQUIRED") : null;
  const alignedState = state ? { ...state, latest_event_time: current.latest_raw_hourly_timestamp } : {
    schema_version: "geox_mcft_cap09_kbs_publication_cadence_state_v1",
    candidate_publication_class_is_authority: false,
    kbs_6h_freshness_authority_changed: false,
    latest_event_time: current.latest_raw_hourly_timestamp,
  };
  const decision = evaluateCadenceState(alignedState, current.retrieved_at);
  const proof = {
    schema_version: "geox_mcft_cap09_kbs_provider_cadence_intelligence_preflight_v3",
    status: decision.decision,
    decision: decision.decision,
    reason: state ? decision.reason : `${decision.reason}_CADENCE_STATE_UNAVAILABLE`,
    evaluated_at: current.retrieved_at,
    provider_expected_update_behavior: PROVIDER_EXPECTED_UPDATE_BEHAVIOR,
    provider_state: decision.provider_state,
    latest_raw_hourly_timestamp: current.latest_raw_hourly_timestamp,
    current_age_hours: Number(current.latest_age_hours),
    historical_online_freshness_diagnostic_hours: HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS,
    historical_online_freshness_diagnostic_pass: decision.historical_online_freshness_diagnostic_pass,
    diagnostic_headroom: decision.diagnostic_headroom,
    scheduler_dispatch_authority: false,
    scheduler_dispatch_decision: "NOT_PROVIDED_BY_CADENCE_INTELLIGENCE",
    ea5e2_live_protocol_compatibility: decision.ea5e2_live_protocol_compatibility,
    activation_readiness: "NOT_DETERMINED_BY_CADENCE_INTELLIGENCE",
    engineering_observation_window_hours: ENGINEERING_OBSERVATION_WINDOW_HOURS,
    engineering_observation_available: decision.engineering_observation_available,
    current_snapshot_latest_24h_profile: currentSnapshotProfile(current),
    latest_publication_batch_profile: state?.latest_publication_batch_profile ?? null,
    provider_cadence_profile: state?.provider_cadence_profile ?? null,
    late_classification_available: decision.late_classification_available,
    next_batch_deadline_utc: decision.next_batch_deadline_utc,
    cadence_machine_transition_count: Number(state?.publication_transition_count ?? 0),
    cadence_machine_candidate_class: state?.candidate_publication_class ?? null,
    cadence_state_polled_at: state?.polled_at ?? null,
    cadence_state_subject_sha: state?.subject_sha ?? null,
    provider_operating_behavior_confirmation_is_freshness_authority: false,
    six_hour_freshness_is_late_authoritative_admission_gate: false,
    cadence_intelligence_used_as_authority: false,
    authority_changed: false,
    authority_effect: false,
    formal_effect: false,
    ea5e2_effectiveness: false,
    ea5e3_authorized: false,
    formal_window_started: false,
    database_write_count: 0,
    canonical_write_count: 0,
    raw_value_emission_count: 0,
  };
  write(proof);
}
main();
