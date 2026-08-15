#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const OUT = "acceptance-output/MCFT_CAP_09_EA5E2_SUCCESSOR_RUNNER_QUALIFICATION_V3.json";
const DEP = "acceptance-output/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.json";
const AUTH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V3.json";
const HIST_V2 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V2.json";
const HIST_TIMING_V2 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-TIMING-BUDGET-QUALIFICATION-V2.json";
const PERSISTED_A0 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTED-A0-AUTHORITY-V1.json";
const CROP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json";
const AMENDMENT11 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const LIVE = ".github/workflows/mcft-cap-09-ea5e2-rolling-operational-activation-live.yml";
const HIST_LONG = ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml";
const CAPTURE = ".github/workflows/mcft-cap-09-rolling-preboundary-capture.yml";
const INTERSECTION = ".github/workflows/mcft-cap-09-rolling-kbs-intersection.yml";
const OBSERVER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_ROLLING_OPERATIONAL_ACTIVATION_OBSERVER_V1.ts";
const DRIFT = "scripts/runtime_acceptance/ASSERT_MCFT_CAP_09_EA5E2_ROLLING_ACTIVATION_BOUNDARY_CURRENT_MAIN.cjs";
const CADENCE = "scripts/runtime_acceptance/MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE_V1.cjs";
const CADENCE_PREFLIGHT = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE.cjs";
const POLLER = "scripts/runtime_acceptance/POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py";
const CROP_BUILDER = "scripts/runtime_acceptance/BUILD_MCFT_CAP_09_ROLLING_CROP_LEGALITY_V1.cjs";
const SELECTOR = "scripts/runtime_acceptance/SELECT_MCFT_CAP_09_ROLLING_KBS_INTERSECTION_V1.py";
const CRITICAL = [AUTH,HIST_V2,HIST_TIMING_V2,PERSISTED_A0,CROP,AMENDMENT11,LIVE,HIST_LONG,CAPTURE,INTERSECTION,OBSERVER,DRIFT,CADENCE,CADENCE_PREFLIGHT,POLLER,CROP_BUILDER,SELECTOR].sort();

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function run(file) { return execFileSync("node", [file], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim(); }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`); console.log(JSON.stringify(value)); }

try {
  const exactHead = git("rev-parse", "HEAD");
  assert.equal(git("rev-parse", `HEAD:${HIST_V2}`), "655f918cbc70be9541da04de5340349a166f72f6", "HISTORICAL_SUCCESSOR_V2_MUTATED");
  assert.equal(git("rev-parse", `HEAD:${HIST_TIMING_V2}`), "baf280b4703fe1cdbc398193e415991c30bb869f", "HISTORICAL_TIMING_V2_MUTATED");
  assert.equal(git("rev-parse", `HEAD:${PERSISTED_A0}`), "e44b43d71d339c39e017737d44c7c9a17a67f5be", "PERSISTED_T3R1_A0_MUTATED");
  assert.equal(git("rev-parse", `HEAD:${CROP}`), "757e4b9f4fdcd631eea97fca85614a1b61ef0c4a", "T3R1_CROP_AUTHORITY_MUTATED");
  assert.equal(git("rev-parse", `HEAD:${AMENDMENT11}`), "a037b24757992987fc24ce8b6afac6c8eabca3ed", "AMENDMENT11_AUTHORITY_MUTATED");

  const authority = JSON.parse(read(AUTH));
  assert.equal(authority.schema_version, "geox_mcft_cap09_ea5e2_successor_runner_qualification_v3");
  assert.equal(authority.final_activation_orchestration.mode, "ROLLING_PREBOUNDARY_BATCH_INTERSECTION");
  assert.equal(authority.final_activation_orchestration.live_workflow, LIVE);
  assert.equal(authority.final_activation_orchestration.future_t_long_horizon_wait_activation_authority, false);
  assert.equal(authority.final_activation_orchestration.historical_long_horizon_workflow_classification, "ENGINEERING_PROBE_ONLY_NOT_CURRENT_ACTIVATION_AUTHORITY");
  assert.equal(authority.provider_temporal_semantics.authority, "PROVIDER_AVAILABILITY_WATERMARK_V1");
  assert.equal(authority.provider_temporal_semantics.six_hour_freshness_is_late_authoritative_admission_gate, false);
  assert.equal(authority.provider_temporal_semantics.fixed_t_plus_432_normative_evidence_cutoff, false);
  assert.equal(authority.provider_temporal_semantics.fixed_t_plus_437_normative_observer_time, false);
  assert.equal(authority.rolling_candidate_contract.selection_policy, "OLDEST_CROP_LEGAL_EXACT_TARGET_FIRST");
  assert.equal(authority.rolling_candidate_contract.crop_authority_intersection_required_before_kbs_selection, true);
  assert.equal(authority.qualification_attempt_budget_semantics.these_offsets_are_normative_evidence_authority, false);
  assert.equal(authority.qualification_attempt_budget_semantics.evidence_eligibility_has_fixed_t_plus_432_cutoff, false);
  assert.equal(authority.formal_snapshot_binding.database_name, "geox_mcft_cap09_s6_formal_t3r1_24h");
  assert.equal(authority.formal_snapshot_binding.neon_branch_id, "br-cold-dust-a6j6aymz");
  assert.equal(authority.formal_snapshot_binding.formal_write_authorized, false);
  assert.deepEqual(authority.expected_live_dispatch_blockers_after_exact_head_successor_pass, []);
  assert.equal(authority.dispatch_effect_boundary.ea5e2_operational_activation_qualified_by_this_record, false);

  const cadence = read(CADENCE);
  for (const forbidden of ["AUTHORITY_MAX_AGE_HOURS", "remaining_authority_headroom", "authority_pass =", "scheduler_may_dispatch"]) {
    assert.equal(cadence.includes(forbidden), false, `CADENCE_STALE_AUTHORITY_TERM_FORBIDDEN:${forbidden}`);
  }
  for (const required of ["HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS", "scheduler_dispatch_authority: false", "ROLLING_PREBOUNDARY_BATCH_INTERSECTION"]) {
    assert.equal(cadence.includes(required), true, `CADENCE_DIAGNOSTIC_TERM_REQUIRED:${required}`);
  }
  const cadencePreflight = read(CADENCE_PREFLIGHT);
  assert.equal(cadencePreflight.includes("frozen_authority_max_age_hours"), false, "CADENCE_PREFLIGHT_STALE_AUTHORITY_TERM_FORBIDDEN");
  assert.equal(cadencePreflight.includes("scheduler_may_dispatch"), false, "CADENCE_PREFLIGHT_SCHEDULER_DECISION_FORBIDDEN");
  assert.equal(cadencePreflight.includes("six_hour_freshness_is_late_authoritative_admission_gate: false"), true, "CADENCE_PREFLIGHT_DIAGNOSTIC_BOUNDARY_REQUIRED");

  const poller = read(POLLER);
  assert.equal(poller.includes("frozen evidence cutoff"), false, "POLLER_FROZEN_EVIDENCE_CUTOFF_TERM_FORBIDDEN");
  assert.equal(poller.includes("late_exact_hour_cutoff"), false, "POLLER_LATE_CUTOFF_OUTPUT_FORBIDDEN");
  assert.equal(poller.includes("QUALIFICATION_ATTEMPT_DISCOVERY_DEADLINE_OFFSET_MINUTES"), true, "POLLER_ATTEMPT_DEADLINE_REQUIRED");
  assert.equal(poller.includes('"evidence_eligibility_has_fixed_t_plus_432_cutoff": False'), true, "POLLER_NO_FIXED_EVIDENCE_CUTOFF_REQUIRED");

  run("scripts/runtime_acceptance/MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE_V1.cjs");
  run("scripts/runtime_acceptance/BUILD_MCFT_CAP_09_ROLLING_CROP_LEGALITY_V1.cjs");
  run("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CAPTURE.cjs");
  run("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_ROLLING_KBS_INTERSECTION.cjs");
  run("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_ROLLING_OPERATIONAL_ACTIVATION.cjs");

  const dep = JSON.parse(read(DEP));
  assert.equal(dep.schema_version, "geox_mcft_cap09_ea5e2_rolling_runtime_dependency_graph_v5");
  assert.equal(dep.status, "PASS", "ROLLING_RUNTIME_DEPENDENCY_GRAPH_V4_PASS_REQUIRED");
  assert.equal(dep.final_activation_orchestration, "ROLLING_PREBOUNDARY_BATCH_INTERSECTION");
  assert.equal(dep.future_t_long_wait_activation_authority, false);
  assert.equal(dep.fixed_t_plus_432_normative_authority, false);
  assert.equal(dep.six_hour_freshness_late_admission_authority, false);

  const blobs = Object.fromEntries(CRITICAL.map((file) => [file, git("rev-parse", `HEAD:${file}`)]));
  const digest = `sha256:${crypto.createHash("sha256").update(JSON.stringify(blobs)).digest("hex")}`;
  write({
    schema_version: "geox_mcft_cap09_ea5e2_successor_runner_qualification_result_v3",
    status: "PASS",
    subject_sha: exactHead,
    qualification_reexecuted: true,
    exact_head_critical_blob_digest: digest,
    exact_head_critical_blobs: blobs,
    runtime_dependency_graph_sha256: dep.expected_dependency_graph_sha256,
    runtime_dependency_graph_count: dep.runtime_dependency_graph_count,
    final_activation_orchestration: "ROLLING_PREBOUNDARY_BATCH_INTERSECTION",
    historical_long_horizon_workflow_classification: "ENGINEERING_PROBE_ONLY_NOT_CURRENT_ACTIVATION_AUTHORITY",
    amendment11_provider_availability_watermark_bound: true,
    crop_legal_intersection_required: true,
    six_hour_freshness_late_admission_authority: false,
    fixed_t_plus_432_normative_authority: false,
    fixed_t_plus_437_observer_normative_authority: false,
    manual_rolling_ea5e2_live_dispatch_gate_satisfied: true,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    scheduler_started: false,
    database_write_count: 0,
    provider_request_count: 0,
    mcft_cap09_completed: false
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_ea5e2_successor_runner_qualification_result_v3",
    status: "FAIL",
    subject_sha: (() => { try { return git("rev-parse", "HEAD"); } catch { return null; } })(),
    error: String(error?.message || error),
    manual_rolling_ea5e2_live_dispatch_gate_satisfied: false,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    database_write_count: 0,
    provider_request_count: 0
  });
  process.exitCode = 1;
}
