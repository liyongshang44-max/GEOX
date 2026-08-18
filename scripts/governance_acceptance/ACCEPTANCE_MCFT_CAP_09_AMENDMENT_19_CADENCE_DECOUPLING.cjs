#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const AUTHORITY_PATH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-CADENCE-DECOUPLING-AUTHORITY-V1.json");
const DOC_PATH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-PROVIDER-RUNTIME-CADENCE-DECOUPLING-AUTHORITY.md");
const AMENDMENT11_PATH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md");
const SELECTOR_PATH = path.join(ROOT, "apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.ts");
const RUNTIME_PROOF_PATH = path.join(ROOT, "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_19_CURRENT_INTERVAL_FORCING.ts");
const OUTPUT_DIR = path.join(ROOT, "acceptance-output");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "MCFT_CAP_09_AMENDMENT_19_CADENCE_DECOUPLING_GOVERNANCE_RESULT.json");
const EXACT_BASE = "987803fbfb945b70025a010c4d72b560140c592a";

function text(file) {
  if (!fs.existsSync(file)) throw new Error(`AMENDMENT19_REQUIRED_FILE_MISSING:${path.relative(ROOT, file)}`);
  return fs.readFileSync(file, "utf8");
}
function json(file) { return JSON.parse(text(file)); }
function requireTrue(value, code) { if (!value) throw new Error(code); }
function requireContains(value, token, code) { requireTrue(value.includes(token), code); }
function requireNotContains(value, token, code) { requireTrue(!value.includes(token), code); }

const authority = json(AUTHORITY_PATH);
const doc = text(DOC_PATH);
const amendment11 = text(AMENDMENT11_PATH);
const selector = text(SELECTOR_PATH);
const runtimeProof = text(RUNTIME_PROOF_PATH);

requireTrue(authority.schema_version === "geox_mcft_cap09_amendment19_cadence_decoupling_authority_v1", "AMENDMENT19_AUTHORITY_SCHEMA_REQUIRED");
requireTrue(authority.authority_id === "GEOX-MCFT-CAP-09-AMENDMENT-19-PROVIDER-RUNTIME-CADENCE-DECOUPLING-AUTHORITY-V1", "AMENDMENT19_AUTHORITY_ID_REQUIRED");
requireTrue(authority.record_status === "CANDIDATE_NOT_EFFECTIVE_UNTIL_EXACT_HEAD_PROOF_AND_PROTECTED_MAIN_MERGE", "AMENDMENT19_CANDIDATE_STATUS_REQUIRED");
requireTrue(authority.exact_predecessor_protected_main === EXACT_BASE, "AMENDMENT19_EXACT_PREDECESSOR_MAIN_REQUIRED");
requireTrue(JSON.stringify(authority.supersedes_only) === JSON.stringify(["DELAYED_EXACT_KBS_PAIR_AS_RUNTIME_PRECLAIM_SCHEDULER_READINESS_CONDITION"]), "AMENDMENT19_NARROW_SUPERSESSION_REQUIRED");

requireTrue(authority.retains.amendment_11_provider_availability_watermark_authority === true, "AMENDMENT19_AMENDMENT11_RETAINED_REQUIRED");
requireTrue(authority.retains.kbs_observation_resolution === "HOURLY", "AMENDMENT19_KBS_HOURLY_OBSERVATION_REQUIRED");
requireTrue(authority.retains.kbs_publication_cadence === "DAILY_BATCH", "AMENDMENT19_KBS_DAILY_BATCH_REQUIRED");
requireTrue(authority.retains.historical_online_freshness_diagnostic_hours === 6 && authority.retains.freshness_is_late_authoritative_admission_gate === false, "AMENDMENT19_SIX_HOUR_DIAGNOSTIC_ONLY_REQUIRED");
for (const key of ["same_source_exact_t_identity", "real_provider_availability_chronology", "raw_retention_before_canonicalization", "conflict_fail_closed", "no_future_leakage", "no_interpolation", "no_persistence_fill", "no_timestamp_relabel", "no_source_substitution_inside_kbs_exact_evidence_authority"]) {
  requireTrue(authority.retains[key] === true, `AMENDMENT19_RETAINED_RULE_REQUIRED:${key}`);
}

const clocks = authority.clock_authority_split;
requireTrue(clocks.runtime_execution_clock === "ACTUAL_UTC_PT1H_SCHEDULER_BOUNDARIES", "AMENDMENT19_RUNTIME_CLOCK_REQUIRED");
requireTrue(clocks.external_evidence_admission_clock === "PROVIDER_AVAILABILITY_WATERMARK_V1", "AMENDMENT19_PROVIDER_WATERMARK_REQUIRED");
requireTrue(clocks.provider_watermark_controls_evidence_admission === true, "AMENDMENT19_WATERMARK_EVIDENCE_ADMISSION_REQUIRED");
requireTrue(clocks.provider_watermark_controls_runtime_scheduler_eligibility === false, "AMENDMENT19_WATERMARK_NOT_SCHEDULER_REQUIRED");
requireTrue(clocks.runtime_tick_waits_for_delayed_exact_kbs_pair === false, "AMENDMENT19_NO_PROVIDER_WAIT_REQUIRED");

const forcing = authority.current_interval_state_forcing;
requireTrue(forcing.contract_id === "MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_AUTHORITY_V1", "AMENDMENT19_FORCING_CONTRACT_REQUIRED");
requireTrue(forcing.selection_order.length === 3, "AMENDMENT19_SELECTION_ORDER_REQUIRED");
requireTrue(forcing.exact_provider_interval_pair.mixed_exact_and_assumed_pair_authorized === false, "AMENDMENT19_MIXED_PAIR_FORBIDDEN");
requireTrue(forcing.prior_step_causal_assumption_pair.weather_epistemic_class === "ASSUMED" && forcing.prior_step_causal_assumption_pair.et0_epistemic_class === "ASSUMED", "AMENDMENT19_ASSUMED_EPISTEMIC_REQUIRED");
requireTrue(forcing.prior_step_causal_assumption_pair.pair_available_to_runtime_at_lte_t_minus_1h === true && forcing.prior_step_causal_assumption_pair.pair_ingested_at_lte_t_minus_1h === true, "AMENDMENT19_PRIOR_STEP_CAUSAL_CUTOFF_REQUIRED");
requireTrue(forcing.prior_step_causal_assumption_pair.runtime_health_when_consumed === "DEGRADED", "AMENDMENT19_ASSUMPTION_DEGRADED_REQUIRED");
requireTrue(forcing.prior_step_causal_assumption_pair.is_kbs_source_substitution === false && forcing.prior_step_causal_assumption_pair.relabel_as_observation_authorized === false, "AMENDMENT19_ASSUMPTION_NOT_KBS_REQUIRED");

requireTrue(authority.o00_warm_start.required === true && authority.o00_warm_start.pair_available_and_ingested_by_a0_required === true && authority.o00_warm_start.horizon_1_covers_a0_to_o00 === true, "AMENDMENT19_O00_WARM_START_REQUIRED");
requireTrue(authority.late_exact_t.handling === "APPEND_FORWARD" && authority.late_exact_t.completed_tick_retroactive_rewrite === false && authority.late_exact_t.event_time_rewrite_authorized === false, "AMENDMENT19_LATE_APPEND_FORWARD_REQUIRED");
requireTrue(authority.engineering_lane.accelerated_24_tick_engineering_qualification_authorized === true && authority.engineering_lane.formal_effect === false, "AMENDMENT19_ACCELERATED_ENGINEERING_NONFORMAL_REQUIRED");
requireTrue(authority.final_formal_lane.actual_utc_hourly_boundaries_required === 24 && authority.final_formal_lane.accelerated_or_replay_clock_authorized === false && authority.final_formal_lane.one_real_wall_clock_o00_o23_run_still_required === true, "AMENDMENT19_FINAL_REAL_24H_REQUIRED");
requireTrue(authority.implementation_unit_1.production_runner_cutover === false && authority.implementation_unit_1.future_epoch_selected === false && authority.implementation_unit_1.formal_o00_started === false, "AMENDMENT19_IMPLEMENTATION_NONCLAIM_REQUIRED");
requireTrue(Array.isArray(authority.required_successor_implementation_before_new_epoch) && authority.required_successor_implementation_before_new_epoch.length === 6, "AMENDMENT19_SUCCESSOR_IMPLEMENTATION_SET_REQUIRED");

for (const token of [
  "provider_watermark_controls_evidence_admission = true",
  "provider_watermark_controls_runtime_scheduler_eligibility = false",
  "runtime_tick_waits_for_delayed_exact_kbs_pair = false",
  "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR",
  "completed_tick_retroactive_rewrite = false",
  "late_exact_t_handling = APPEND_FORWARD",
  "NOT_STAGE_1B_FORMAL_CLOSURE",
  "NO_NEW_FORMAL_EPOCH_SELECTED"
]) requireContains(doc, token, `AMENDMENT19_DOC_RULE_MISSING:${token}`);

// Bind Amendment-19 to Amendment-11's actual frozen normative text rather than
// inventing successor-only field names. These checks preserve exact-T identity,
// real chronology, diagnostic-only <=6h treatment, and all no-repair rules.
for (const token of [
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "kbs_raw_hourly_le_6h_delayed_admission_authority = false",
  "kbs_raw_hourly_le_6h_freshness_diagnostic_retained = true",
  "source_substitution_authorized = false",
  "future_forcing_post_T_availability_authorized = false",
  "time_relabeling_authorized = false",
  "no future leakage",
  "no interpolation",
  "no persistence fill",
  "raw retention before canonicalization"
]) requireContains(amendment11, token, `AMENDMENT19_AMENDMENT11_PREDECESSOR_RULE_MISSING:${token}`);

for (const token of [
  "MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_AUTHORITY_V1",
  "EXACT_PROVIDER_INTERVAL_PAIR",
  "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR",
  "provider_wait_required: false",
  "completed_tick_retroactive_rewrite_authorized: false",
  "relabel_assumption_as_provider_observation_authorized: false",
  "AMENDMENT19_NO_CAUSAL_CURRENT_INTERVAL_FORCING_PAIR"
]) requireContains(selector, token, `AMENDMENT19_SELECTOR_RULE_MISSING:${token}`);
for (const forbidden of ["from \"pg\"", "fetch(", "process.env", "Date.now()", "new Date().toISOString()", "INSERT INTO", "UPDATE ", "DELETE FROM"]) {
  requireNotContains(selector, forbidden, `AMENDMENT19_SELECTOR_SIDE_EFFECT_SURFACE_FORBIDDEN:${forbidden}`);
}

for (const token of [
  "accelerated_tick_count",
  "accelerated_provider_wait_count",
  "partial_exact_pair_mixing_forbidden",
  "noncausal_assumption_pair_fail_closed",
  "production_runner_cutover: false",
  "future_epoch_selected: false",
  "formal_effect: false"
]) requireContains(runtimeProof, token, `AMENDMENT19_RUNTIME_PROOF_REQUIREMENT_MISSING:${token}`);

const result = {
  schema_version: "geox_mcft_cap09_amendment19_cadence_decoupling_governance_result_v1",
  status: "PASS",
  exact_predecessor_protected_main: EXACT_BASE,
  narrow_supersession: authority.supersedes_only,
  provider_watermark_retained_for_evidence_admission: true,
  provider_watermark_removed_from_scheduler_eligibility: true,
  current_interval_forcing_modes: forcing.selection_order,
  prior_step_assumption_remains_assumed: true,
  o00_warm_start_required: true,
  late_exact_append_forward_no_rewrite: true,
  accelerated_engineering_is_nonformal: true,
  final_real_24h_formal_still_required: true,
  production_runner_cutover: false,
  future_epoch_selected: false,
  formal_o00_started: false,
  formal_effect: false
};
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
