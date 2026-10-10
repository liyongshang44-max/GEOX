"use strict";
const crypto = require("node:crypto");
const PHASES = Object.freeze([
  "EXACT_MAIN_IMAGE_OWNER_REVALIDATION",
  "FRESH_STAGE_AND_CAUSAL_SEED_VISIBILITY",
  "MANIFEST_AND_PROMOTION_PREPARATION",
  "FORMAL_SCHEMA_ACL_AND_PRISTINE_CAS",
  "EVIDENCE_HANDOFF_AND_FENCING",
  "A0_PREWRITE_PREPARATION",
]);
const req = (ok, code) => { if (!ok) throw new Error("AM22_PREPARATION_" + code); };
function hash(value) { return "sha256:" + crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function measureEnvelope(trace, expected) {
  req(trace?.schema_version === "geox_mcft_cap09_complete_pre_a0_measurement_trace_v1", "TRACE_SCHEMA_REQUIRED");
  req(trace.synthetic === false && trace.measurement_class === "ACTUAL_COMPLETE_PRE_A0_PREPARATION", "ACTUAL_MEASUREMENT_REQUIRED");
  for (const key of ["subject_sha", "host_id", "image_id", "preparation_profile_sha256"]) req(trace[key] === expected[key], "BINDING_MISMATCH_" + key);
  req(Array.isArray(trace.trials) && trace.trials.length > 0, "TRIALS_REQUIRED");
  const durations = trace.trials.map(trial => {
    req(trial.status === "PASS" && JSON.stringify(trial.phases?.map(x => x.phase)) === JSON.stringify(PHASES), "COMPLETE_ORDERED_WORKLOAD_REQUIRED");
    req(Number.isSafeInteger(trial.started_monotonic_ms) && trial.started_monotonic_ms >= 0, "TRIAL_START_REQUIRED");
    let end = trial.started_monotonic_ms;
    for (const phase of trial.phases) {
      req(phase.status === "PASS" && /^sha256:[a-f0-9]{64}$/.test(phase.evidence_sha256 || ""), "PHASE_EVIDENCE_REQUIRED");
      req(Number.isSafeInteger(phase.started_monotonic_ms) && phase.started_monotonic_ms >= end && Number.isSafeInteger(phase.finished_monotonic_ms) && phase.finished_monotonic_ms > phase.started_monotonic_ms, "PHASE_CHRONOLOGY_INVALID");
      end = phase.finished_monotonic_ms;
    }
    req(trial.finished_monotonic_ms >= end && Number.isSafeInteger(trial.finished_monotonic_ms), "TRIAL_END_INVALID");
    return trial.finished_monotonic_ms - trial.started_monotonic_ms;
  });
  req(Number.isSafeInteger(expected.safety_margin_ms) && expected.safety_margin_ms > 0, "SAFETY_MARGIN_REQUIRED");
  const observed = Math.max(...durations);
  // Measurements alone do not establish a worst-case bound or production authority.
  return { ...expected, schema_version: "geox_mcft_cap09_complete_pre_a0_measured_envelope_v1", status: "MEASURED_PENDING_INDEPENDENT_QUALIFICATION", trial_count: durations.length, observed_max_elapsed_ms: observed, proposed_budget_ms: observed + expected.safety_margin_ms, trace_sha256: hash(trace), synthetic: false, production_authorized: false };
}
function validateQualifiedEnvelope(value, expected, now) {
  req(value?.schema_version === "geox_mcft_cap09_qualified_complete_pre_a0_envelope_v1" && value.status === "QUALIFIED", "INDEPENDENT_QUALIFICATION_REQUIRED");
  req(value.purpose === "COMPLETE_PRE_A0_PREPARATION_NOT_V13_PER_BASE_ACQUISITION" && value.synthetic === false, "PURPOSE_OR_SOURCE_INVALID");
  for (const key of ["subject_sha", "host_id", "image_id", "preparation_profile_sha256"]) req(value[key] === expected[key], "BINDING_MISMATCH_" + key);
  req(JSON.stringify(value.workload_phases) === JSON.stringify(PHASES), "WORKLOAD_COVERAGE_REQUIRED");
  req(/^sha256:[a-f0-9]{64}$/.test(value.measurement_trace_sha256 || "") && /^sha256:[a-f0-9]{64}$/.test(value.independent_qualification_sha256 || ""), "QUALIFICATION_EVIDENCE_REQUIRED");
  req(Number.isSafeInteger(value.observed_max_elapsed_ms) && value.observed_max_elapsed_ms > 0 && Number.isSafeInteger(value.enforced_complete_timeout_ms) && value.enforced_complete_timeout_ms >= value.observed_max_elapsed_ms, "COMPLETE_TIMEOUT_BOUND_REQUIRED");
  req(Number.isSafeInteger(value.safety_margin_ms) && value.safety_margin_ms > 0 && Number.isSafeInteger(value.selected_budget_ms) && value.selected_budget_ms >= value.enforced_complete_timeout_ms + value.safety_margin_ms, "BUDGET_INSUFFICIENT");
  req(Date.parse(value.qualified_at_database_utc) <= now && Date.parse(value.expires_at_database_utc) > now, "QUALIFICATION_STALE_OR_FUTURE");
  return value.selected_budget_ms;
}
module.exports = { PHASES, measureEnvelope, validateQualifiedEnvelope };
