#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { validateTimingBudgetEvidence } = require("../runtime_acceptance/MCFT_CAP_09_EA5E2_TIMING_BUDGET_EVIDENCE_V2.cjs");

const OUT = "acceptance-output/MCFT_CAP_09_EA5E2_SUCCESSOR_RUNNER_QUALIFICATION_V2.json";
const FULL = "acceptance-output/MCFT_CAP_09_EA5E2_FULL_CHAIN_PREFLIGHT_V2.json";
const DEP = "acceptance-output/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH.json";
const AUTH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V2.json";
const HIST_AUTH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V1.json";
const HIST_TIMING = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-TIMING-BUDGET-QUALIFICATION-V1.json";
const PERSISTED_A0 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTED-A0-AUTHORITY-V1.json";
const LIVE = ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml";
const POLL = "scripts/runtime_acceptance/POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py";
const FORMAL = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts";
const OBSERVER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts";
const DRIFT = "scripts/runtime_acceptance/ASSERT_MCFT_CAP_09_EA5E2_ACTIVATION_BOUNDARY_CURRENT_MAIN.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-ea5e2-successor-runner-qualification.yml";
const TIMING_V2 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-TIMING-BUDGET-QUALIFICATION-V2.json";
const TIMING_VALIDATOR_V2 = "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_TIMING_BUDGET_EVIDENCE_V2.cjs";
const FULL_ACCEPTANCE_V2 = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_FULL_CHAIN_PREFLIGHT_V2.cjs";
const DEP_ACCEPTANCE_V3 = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V3.cjs";
const CARRIER_V3 = "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V3_BINDING.cjs";
const CRITICAL = [AUTH,HIST_AUTH,HIST_TIMING,PERSISTED_A0,LIVE,POLL,FORMAL,OBSERVER,DRIFT,WORKFLOW,TIMING_V2,TIMING_VALIDATOR_V2,FULL_ACCEPTANCE_V2,DEP_ACCEPTANCE_V3,CARRIER_V3].sort();

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`); console.log(JSON.stringify(value)); }

try {
  const exactHead = git("rev-parse", "HEAD");
  assert.equal(git("rev-parse", `HEAD:${HIST_AUTH}`), "da6b62cb193f2b30ead31a8e788f88389e15ede0", "HISTORICAL_SUCCESSOR_V1_MUTATED");
  assert.equal(git("rev-parse", `HEAD:${HIST_TIMING}`), "3ddd55c48d582fe29ab34273ca35ac9152dde8f5", "HISTORICAL_TIMING_V1_MUTATED");
  assert.equal(git("rev-parse", `HEAD:${PERSISTED_A0}`), "e44b43d71d339c39e017737d44c7c9a17a67f5be", "PERSISTED_A0_AUTHORITY_DRIFT");

  const authority = JSON.parse(read(AUTH));
  assert.equal(authority.schema_version, "geox_mcft_cap09_ea5e2_successor_runner_qualification_v2");
  assert.equal(authority.historical_v1_authorities_preserved, true);
  assert.equal(authority.historical_qualification_reused_as_successor_proof, false);
  assert.equal(authority.successor_qualification_reexecution_required_per_exact_head, true);
  assert.equal(authority.formal_snapshot_binding.database_name, "geox_mcft_cap09_s6_formal_t3r1_24h");
  assert.equal(authority.formal_snapshot_binding.t1r1_database_reused, false);
  assert.equal(authority.formal_snapshot_binding.cross_scope_stitching_authorized, false);
  assert.equal(authority.provider_temporal_semantics.authority, "PROVIDER_AVAILABILITY_WATERMARK_V1");
  assert.equal(authority.provider_temporal_semantics.publication_cadence, "DAILY_BATCH");
  assert.equal(authority.provider_temporal_semantics.six_hour_freshness_is_late_authoritative_admission_gate, false);
  assert.deepEqual(authority.expected_live_dispatch_blockers_after_exact_head_successor_pass, []);
  assert.equal(authority.dispatch_effect_boundary.ea5e2_operational_activation_qualified_by_this_record, false);
  assert.equal(authority.dispatch_effect_boundary.formal_window_started, false);

  const timing = validateTimingBudgetEvidence();
  assert.equal(timing.status, "PASS");
  assert.equal(timing.workflow_run_id, authority.temporal_safety.timing_budget_qualification_workflow_run_id);
  assert.equal(timing.collector.safety_adjusted_max_elapsed_ms, authority.temporal_safety.collector_safety_adjusted_max_elapsed_ms);
  assert.equal(timing.observer.safety_adjusted_max_elapsed_ms, authority.temporal_safety.observer_safety_adjusted_max_elapsed_ms);

  const full = JSON.parse(read(FULL));
  const dep = JSON.parse(read(DEP));
  assert.equal(full.schema_version, "geox_mcft_cap09_ea5e2_full_chain_preflight_v2");
  assert.equal(full.status, "PASS", "FULL_CHAIN_V2_PASS_REQUIRED");
  assert.equal(full.subject_sha, exactHead, "FULL_CHAIN_V2_EXACT_HEAD_REQUIRED");
  assert.equal(full.blocker_count, 0, "FULL_CHAIN_V2_ZERO_STATIC_BLOCKERS_REQUIRED");
  assert.equal(full.readiness_blocker_count, 0, "FULL_CHAIN_V2_ZERO_READINESS_BLOCKERS_REQUIRED");
  assert.equal(full.activation_readiness, "READY", "FULL_CHAIN_V2_READY_REQUIRED");
  assert.equal(full.formal_database_name, "geox_mcft_cap09_s6_formal_t3r1_24h");
  assert.equal(full.provider_temporal_authority, "PROVIDER_AVAILABILITY_WATERMARK_V1");
  assert.equal(dep.status, "PASS", "DEPENDENCY_GRAPH_V3_PASS_REQUIRED");
  assert.equal(dep.schema_version, "geox_mcft_cap09_ea5e2_runtime_dependency_graph_v4");
  assert.equal(dep.binding_carrier_in_exact_main_critical, true);

  const blobs = Object.fromEntries(CRITICAL.map((file) => [file, git("rev-parse", `HEAD:${file}`)]));
  const digest = `sha256:${crypto.createHash("sha256").update(JSON.stringify(blobs)).digest("hex")}`;
  write({
    schema_version: "geox_mcft_cap09_ea5e2_successor_runner_qualification_result_v2",
    status: "PASS",
    subject_sha: exactHead,
    qualification_reexecuted: true,
    exact_head_critical_blob_digest: digest,
    exact_head_critical_blobs: blobs,
    runtime_dependency_graph_sha256: dep.expected_dependency_graph_sha256,
    runtime_dependency_graph_count: dep.runtime_dependency_graph_count,
    full_chain_v2_pass: true,
    activation_readiness: "READY",
    readiness_blocker_count: 0,
    historical_v1_authorities_preserved: true,
    persisted_t3r1_a0_bound: true,
    t1r1_database_reused: false,
    exact_main_timing_v2_qualified: true,
    timing_budget_qualification_subject_sha: timing.subject_sha,
    timing_budget_qualification_workflow_run_id: timing.workflow_run_id,
    provider_temporal_authority: authority.provider_temporal_semantics.authority,
    six_hour_freshness_is_late_authoritative_admission_gate: false,
    manual_ea5e2_live_dispatch_gate_satisfied: true,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    scheduler_started: false,
    database_write_count: 0,
    provider_request_count: 0,
    mcft_cap09_completed: false
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_ea5e2_successor_runner_qualification_result_v2",
    status: "FAIL",
    subject_sha: (() => { try { return git("rev-parse", "HEAD"); } catch { return null; } })(),
    error: String(error?.message || error),
    manual_ea5e2_live_dispatch_gate_satisfied: false,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    database_write_count: 0,
    provider_request_count: 0
  });
  process.exitCode = 1;
}
