#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const BASE = "e1d9b6a160e7d8c897c010cfb6efe420119cbb87";
const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts";
const LIVE = ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml";
const CROP_PREFLIGHT = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS.cjs";
const HISTORICAL_OA_WORKFLOW = ".github/workflows/mcft-cap-09-ea5e2-operational-activation-runner-qualification.yml";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_SOIL_WINDOW_CONFORMANCE.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-ea5e2-soil-window-conformance.yml";

const SELECTOR = "apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts";
const AUTHORITY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-RUNNER-QUALIFICATION-V1.json";
const HISTORICAL_OA_GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_RUNNER_QUALIFICATION.cjs";
const AMENDMENT07 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md";
const CROP_AUTHORITY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json";
const PROVIDER_HELPER = "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py";
const OBSERVER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts";
const DB_SOURCE = "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts";
const INGRESS = "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts";
const SOIL_INGRESS = "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts";

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(path) { return fs.readFileSync(path, "utf8"); }
function has(text, marker, code) { if (!text.includes(marker)) throw new Error(`${code}:${marker}`); }
function lacks(text, marker, code) { if (text.includes(marker)) throw new Error(`${code}:${marker}`); }
function matches(text, pattern, code) { if (!pattern.test(text)) throw new Error(`${code}:${pattern}`); }
function eq(actual, expected, code) { if (actual !== expected) throw new Error(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
function yes(value, code) { eq(value, true, code); }
function no(value, code) { eq(value, false, code); }
function blob(ref, file) { return git("rev-parse", `${ref}:${file}`); }
function unchanged(file, code) { eq(blob(BASE, file), blob("HEAD", file), code); }
function before(text, first, second, code) {
  const a = text.indexOf(first);
  const b = text.indexOf(second);
  if (a < 0 || b < 0 || a >= b) throw new Error(`${code}:${first} !< ${second}`);
}

function main() {
  const subject = git("rev-parse", "HEAD");
  const expectedChanged = [RUNNER, LIVE, CROP_PREFLIGHT, HISTORICAL_OA_WORKFLOW, GATE, WORKFLOW].sort();
  const changed = git("diff", "--name-only", `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed), JSON.stringify(expectedChanged), "EA5E2_LIVE_HARDENING_EXACT_SIX_FILE_BOUNDARY_REQUIRED");

  // Historical authority and production/runtime semantics must remain byte-identical to the protected-main base.
  for (const [file, code] of [
    [SELECTOR, "EA5E2_LIVE_HARDENING_RUNTIME_SELECTOR_MUTATION_FORBIDDEN"],
    [AUTHORITY, "EA5E2_LIVE_HARDENING_OA_AUTHORITY_MUTATION_FORBIDDEN"],
    [HISTORICAL_OA_GATE, "EA5E2_LIVE_HARDENING_HISTORICAL_OA_GATE_MUTATION_FORBIDDEN"],
    [AMENDMENT07, "EA5E2_LIVE_HARDENING_AMENDMENT07_MUTATION_FORBIDDEN"],
    [CROP_AUTHORITY, "EA5E2_LIVE_HARDENING_CROP_AUTHORITY_MUTATION_FORBIDDEN"],
    [PROVIDER_HELPER, "EA5E2_LIVE_HARDENING_PROVIDER_DECODER_MUTATION_FORBIDDEN"],
    [OBSERVER, "EA5E2_LIVE_HARDENING_OBSERVER_MUTATION_FORBIDDEN"],
    [DB_SOURCE, "EA5E2_LIVE_HARDENING_DB_SOURCE_MUTATION_FORBIDDEN"],
    [INGRESS, "EA5E2_LIVE_HARDENING_INGRESS_MUTATION_FORBIDDEN"],
    [SOIL_INGRESS, "EA5E2_LIVE_HARDENING_SOIL_INGRESS_MUTATION_FORBIDDEN"],
  ]) unchanged(file, code);

  eq(blob(BASE, HISTORICAL_OA_WORKFLOW), "df6c2cf37a87fdbd8715181dea5667ebb6ad479f", "EA5E2_LIVE_HARDENING_HISTORICAL_OA_WORKFLOW_BASE_PIN_REQUIRED");
  eq(blob(BASE, AUTHORITY), "4f0df5f9fe896bf26eda3d673e3153941f59c2e7", "EA5E2_LIVE_HARDENING_HISTORICAL_AUTHORITY_BASE_PIN_REQUIRED");
  eq(blob(BASE, HISTORICAL_OA_GATE), "af6d0fbc208ad37f7fd00084ac4636fd2c08fac6", "EA5E2_LIVE_HARDENING_HISTORICAL_GATE_BASE_PIN_REQUIRED");
  eq(blob(BASE, OBSERVER), "ec18b215f10bedd66fa2a6a1efef0e41cf57ce38", "EA5E2_LIVE_HARDENING_HISTORICAL_OBSERVER_BASE_PIN_REQUIRED");

  const selector = read(SELECTOR);
  matches(selector, /ASSIMILATED_OBSERVATION_SELECTOR_ID_V2\s*=\s*\"LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2\"\s+as const;/, "EA5E2_LIVE_HARDENING_SELECTOR_ID_FROZEN");
  matches(selector, /ASSIMILATED_OBSERVATION_MAX_AGE_MILLISECONDS_V2\s*=\s*900_000\s+as const;/, "EA5E2_LIVE_HARDENING_15M_MAX_AGE_FROZEN");
  has(selector, "ageMilliseconds > ASSIMILATED_OBSERVATION_MAX_AGE_MILLISECONDS_V2", "EA5E2_LIVE_HARDENING_EXACT_T_MINUS_15_USABLE");

  const authority = JSON.parse(read(AUTHORITY));
  const clock = authority.provider_and_clock_contract;
  eq(clock.kbs_raw_hourly_max_age_hours, 6, "EA5E2_LIVE_HARDENING_KBS_6H_FROZEN");
  eq(clock.pre_boundary_collector_offset_minutes, -30, "EA5E2_LIVE_HARDENING_PRE_OFFSET_FROZEN");
  eq(clock.late_exact_hour_collector_offset_minutes, 390, "EA5E2_LIVE_HARDENING_LATE_OFFSET_FROZEN");
  eq(clock.scheduler_eligibility_lag_hours, 7, "EA5E2_LIVE_HARDENING_LAG_FROZEN");
  eq(clock.late_exact_hour_evidence_cutoff_offset_minutes, 432, "EA5E2_LIVE_HARDENING_CUTOFF_FROZEN");
  eq(clock.runtime_observer_offset_minutes, 437, "EA5E2_LIVE_HARDENING_OBSERVER_FROZEN");
  eq(clock.runtime_observer_max_start_skew_minutes, 10, "EA5E2_LIVE_HARDENING_OBSERVER_SKEW_FROZEN");
  eq(clock.minimum_ingestion_margin_minutes, 5, "EA5E2_LIVE_HARDENING_MARGIN_FROZEN");
  yes(clock.exact_same_cycle_gfs_required, "EA5E2_LIVE_HARDENING_SAME_CYCLE_FROZEN");
  no(clock.source_substitution_authorized, "EA5E2_LIVE_HARDENING_SOURCE_SUBSTITUTION_FORBIDDEN");
  no(clock.time_relabeling_authorized, "EA5E2_LIVE_HARDENING_TIME_RELABEL_FORBIDDEN");
  no(clock.cross_cycle_substitution_authorized, "EA5E2_LIVE_HARDENING_CROSS_CYCLE_FORBIDDEN");
  no(clock.accelerated_formal_clock_authorized, "EA5E2_LIVE_HARDENING_ACCELERATED_CLOCK_FORBIDDEN");

  const historicalWorkflow = read(HISTORICAL_OA_WORKFLOW);
  has(historicalWorkflow, "EA5E2_OA_RUNNER_QUALIFICATION_CREATION_BASE: 4e41858478bdca5989fb3388c3660105f7350559", "EA5E2_LIVE_HARDENING_HISTORICAL_CREATION_BASE_REQUIRED");
  has(historicalWorkflow, 'if [ "$MCFT_BASE_SHA" = "$EA5E2_OA_RUNNER_QUALIFICATION_CREATION_BASE" ]; then', "EA5E2_LIVE_HARDENING_HISTORICAL_CREATION_GATE_BRANCH_REQUIRED");
  has(historicalWorkflow, "node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_RUNNER_QUALIFICATION.cjs", "EA5E2_LIVE_HARDENING_HISTORICAL_CREATION_GATE_STILL_EXECUTED_REQUIRED");
  has(historicalWorkflow, "POST_QUALIFICATION_HISTORICAL_PRESERVATION_ONLY", "EA5E2_LIVE_HARDENING_POST_QUALIFICATION_APPLICABILITY_REQUIRED");
  has(historicalWorkflow, "qualification_reexecuted:false", "EA5E2_LIVE_HARDENING_NO_FALSE_REQUALIFICATION_REQUIRED");
  has(historicalWorkflow, "historical_authority_preserved:true", "EA5E2_LIVE_HARDENING_HISTORICAL_AUTHORITY_PRESERVATION_REQUIRED");
  has(historicalWorkflow, "historical_gate_preserved:true", "EA5E2_LIVE_HARDENING_HISTORICAL_GATE_PRESERVATION_REQUIRED");
  has(historicalWorkflow, "historical_observer_preserved:true", "EA5E2_LIVE_HARDENING_HISTORICAL_OBSERVER_PRESERVATION_REQUIRED");
  has(historicalWorkflow, "live_workflow_successor_hardening_must_be_proved_separately:true", "EA5E2_LIVE_HARDENING_SUCCESSOR_PROOF_SEPARATION_REQUIRED");
  has(historicalWorkflow, "gate:'af6d0fbc208ad37f7fd00084ac4636fd2c08fac6'", "EA5E2_LIVE_HARDENING_HISTORICAL_GATE_PIN_REQUIRED");
  has(historicalWorkflow, "authority:'4f0df5f9fe896bf26eda3d673e3153941f59c2e7'", "EA5E2_LIVE_HARDENING_HISTORICAL_AUTHORITY_PIN_REQUIRED");
  has(historicalWorkflow, "observer:'ec18b215f10bedd66fa2a6a1efef0e41cf57ce38'", "EA5E2_LIVE_HARDENING_HISTORICAL_OBSERVER_PIN_REQUIRED");

  const runner = read(RUNNER);
  has(runner, "const MIN_INGRESS_MARGIN_MINUTES = 5;", "EA5E2_LIVE_HARDENING_RUNNER_MARGIN_REQUIRED");
  has(runner, "const SOIL_WINDOW_MINUTES = 15;", "EA5E2_LIVE_HARDENING_RUNNER_15M_REQUIRED");
  has(runner, "const SOIL_FIRST_FETCH_BEFORE_T_MINUTES = 15;", "EA5E2_LIVE_HARDENING_POLL_FROM_WINDOW_OPEN_REQUIRED");
  has(runner, "observedAt >= soilWindowStart && observedAt <= Date.parse(target)", "EA5E2_LIVE_HARDENING_INCLUSIVE_LOWER_BOUND_REQUIRED");
  lacks(runner, "observedAt > soilWindowStart && observedAt <= Date.parse(target)", "EA5E2_LIVE_HARDENING_STRICT_LOWER_BOUND_FORBIDDEN");
  has(runner, "const gfsPromise = collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1", "EA5E2_LIVE_HARDENING_GFS_PROMISE_REQUIRED");
  has(runner, "const soilPromise = (async (): Promise", "EA5E2_LIVE_HARDENING_SOIL_PROMISE_REQUIRED");
  has(runner, "Promise.allSettled([gfsPromise, soilPromise])", "EA5E2_LIVE_HARDENING_PARALLEL_JOIN_REQUIRED");
  has(runner, "gfs_soil_acquisition_parallel: true", "EA5E2_LIVE_HARDENING_PARALLEL_PROOF_REQUIRED");
  has(runner, "soil_polling_begins_at_authorized_window_open: true", "EA5E2_LIVE_HARDENING_SOIL_WINDOW_PROOF_REQUIRED");

  has(runner, "private writeRefLedger(): void", "EA5E2_LIVE_HARDENING_REF_LEDGER_REQUIRED");
  has(runner, "async deleteTrackedRetainedRawEvidence(): Promise<string[]>", "EA5E2_LIVE_HARDENING_LOCAL_FAILURE_CLEANUP_REQUIRED");
  has(runner, "EA5E2_PHASE_FAILURE_TRANSIENT_CLEANUP_FAILED", "EA5E2_LIVE_HARDENING_CLEANUP_FAILURE_MUST_FAIL_CLOSED");
  has(runner, "MCFT_CAP_09_EA5E2_TRANSIENT_R2_PHASE_FAILURE_CLEANUP.json", "EA5E2_LIVE_HARDENING_PHASE_CLEANUP_PROOF_REQUIRED");
  const retainStart = runner.indexOf("async retainRawEvidence(input: RawEvidenceRetentionInputV1)");
  const retainEnd = runner.indexOf("async readRetainedRawEvidence", retainStart);
  if (retainStart < 0 || retainEnd < 0) throw new Error("EA5E2_LIVE_HARDENING_RETAIN_FUNCTION_REQUIRED");
  const retain = runner.slice(retainStart, retainEnd);
  before(retain, "this.recordRef(ref, input.raw_sha256, raw.byteLength);", "const probe = await this.request", "EA5E2_LIVE_HARDENING_LEDGER_BEFORE_REMOTE_MUTATION_REQUIRED");

  has(runner, "const KBS_RAW_HOURLY_TRANSPORT_MAX_ATTEMPTS = 3;", "EA5E2_LIVE_HARDENING_BOUNDED_KBS_RETRY_REQUIRED");
  has(runner, "response.status === 429 || response.status >= 500", "EA5E2_LIVE_HARDENING_TRANSIENT_HTTP_ONLY_RETRY_REQUIRED");
  has(runner, 'late_transport_retry_scope: "SAME_SOURCE_TRANSIENT_ONLY"', "EA5E2_LIVE_HARDENING_SAME_SOURCE_RETRY_PROOF_REQUIRED");
  lacks(runner, "EA5E2_LIVE_KBS_EXACT_TARGET_ROW_REQUIRED", "EA5E2_LIVE_HARDENING_DECODER_SEMANTIC_RETRY_MUST_NOT_MOVE_INTO_RUNNER");
  has(runner, "const latestIngressStartMs = Date.parse(addMinutes(slot.late_exact_hour_evidence_cutoff, -MIN_INGRESS_MARGIN_MINUTES));", "EA5E2_LIVE_HARDENING_LATE_MARGIN_REQUIRED");

  const live = read(LIVE);
  has(live, "group: mcft-cap09-ea5e2-operational-activation-live-v1", "EA5E2_LIVE_HARDENING_GLOBAL_SERIALIZATION_REQUIRED");
  has(live, "cancel-in-progress: false", "EA5E2_LIVE_HARDENING_RUNNING_WINDOW_CANCELLATION_FORBIDDEN");
  lacks(live, "pull_request:", "EA5E2_LIVE_HARDENING_LIVE_PR_TRIGGER_FORBIDDEN");
  has(live, "Fail fast unless KBS Raw Hourly is currently within unchanged 6h authority", "EA5E2_LIVE_HARDENING_KBS_FAIL_FAST_REQUIRED");
  has(live, "Fail fast unless selected T has one conservative frozen crop stage", "EA5E2_LIVE_HARDENING_CROP_FAIL_FAST_REQUIRED");
  before(live, "Fail fast unless selected T has one conservative frozen crop stage", "Execute real pre-boundary provider phase with private transient R2 and isolated DB", "EA5E2_LIVE_HARDENING_CROP_PREFLIGHT_BEFORE_PROVIDER_REQUIRED");
  has(live, "Upload PRE attempt cleanup ledger even when provider phase fails", "EA5E2_LIVE_HARDENING_PRE_FAILURE_LEDGER_REQUIRED");
  has(live, "if: ${{ always() && steps.target.outputs.target_t != '' }}", "EA5E2_LIVE_HARDENING_PRE_LEDGER_ALWAYS_REQUIRED");
  has(live, "mcft-cap09-ea5e2-pre-cleanup-refs-${{ steps.target.outputs.subject_sha }}", "EA5E2_LIVE_HARDENING_PRE_LEDGER_ARTIFACT_REQUIRED");
  has(live, "acceptance-output/pre-attempt", "EA5E2_LIVE_HARDENING_FINAL_CLEANUP_PRE_ATTEMPT_REQUIRED");
  has(live, "for dir in acceptance-output/pre-attempt acceptance-output/pre acceptance-output/late", "EA5E2_LIVE_HARDENING_ALL_CLEANUP_SOURCES_REQUIRED");
  has(live, "p.discovered_ref_count!==p.deleted_ref_count", "EA5E2_LIVE_HARDENING_CLEANUP_CARDINALITY_REQUIRED");
  has(live, "late.late_transport_max_attempts!==3", "EA5E2_LIVE_HARDENING_LATE_RETRY_VERIFICATION_REQUIRED");
  has(live, "crop.crop_stage_code!==observer.crop_stage_code", "EA5E2_LIVE_HARDENING_CROP_PREFLIGHT_OBSERVER_MATCH_REQUIRED");
  has(live, "Wait until actual Runtime observer T plus 7h17m", "EA5E2_LIVE_HARDENING_REAL_OBSERVER_CLOCK_REQUIRED");

  const crop = read(CROP_PREFLIGHT);
  has(crop, "variants.length !== 6", "EA5E2_LIVE_HARDENING_CROP_SIX_VARIANTS_REQUIRED");
  has(crop, "backwardHours !== 6 || forwardHours !== 30", "EA5E2_LIVE_HARDENING_CROP_GUARDS_REQUIRED");
  has(crop, "const plantingTimes = [startInclusive, endExclusive - 1];", "EA5E2_LIVE_HARDENING_PLANTING_UNCERTAINTY_BOUNDARIES_REQUIRED");
  has(crop, "if (stages.size !== 1)", "EA5E2_LIVE_HARDENING_NONCONSENSUS_FAIL_CLOSED_REQUIRED");
  has(crop, "future_observations_used: false", "EA5E2_LIVE_HARDENING_FUTURE_CROP_OBSERVATION_FORBIDDEN");
  has(crop, "provider_request_count: 0", "EA5E2_LIVE_HARDENING_CROP_PREFLIGHT_PROVIDER_ZERO_REQUIRED");
  has(crop, "database_write_count: 0", "EA5E2_LIVE_HARDENING_CROP_PREFLIGHT_DB_WRITE_ZERO_REQUIRED");

  console.log(JSON.stringify({
    status: "PASS",
    subject_sha: subject,
    base_sha: BASE,
    exact_changed_file_count: changed.length,
    authority_changed: false,
    production_runtime_changed: false,
    historical_qualification_rewritten: false,
    historical_qualification_applicability_repaired: true,
    selector_max_age_ms: 900000,
    soil_lower_bound_inclusive: true,
    soil_polling_begins_at_window_open_minutes_before_t: 15,
    gfs_soil_acquisition_parallel: true,
    phase_failure_local_transient_cleanup: true,
    pre_attempt_cleanup_ledger_always_uploaded: true,
    final_cleanup_discovered_equals_deleted_required: true,
    late_same_source_transient_retry_max_attempts: 3,
    target_crop_consensus_fail_fast: true,
    formal_authority_effect: false,
  }));
}

main();
