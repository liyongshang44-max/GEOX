#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const OUT = "acceptance-output/MCFT_CAP_09_EA5E2_SUCCESSOR_RUNNER_QUALIFICATION.json";
const FULL_CHAIN_PROOF = "acceptance-output/MCFT_CAP_09_EA5E2_FULL_CHAIN_PREFLIGHT.json";
const DEPENDENCY_PROOF = "acceptance-output/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH.json";
const AUTH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V1.json";
const HISTORICAL_AUTH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-RUNNER-QUALIFICATION-V1.json";
const HISTORICAL_GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_RUNNER_QUALIFICATION.cjs";
const OBSERVER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts";
const FORMAL = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts";
const VIABILITY = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_LIVE_WINDOW_VIABILITY.cjs";
const POLL = "scripts/runtime_acceptance/POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py";
const LIVE = ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml";
const WATCHER = "scripts/runtime_acceptance/WATCH_MCFT_CAP_09_KBS_BATCH_QUALIFICATION_WINDOW.py";
const CADENCE = "scripts/runtime_acceptance/MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE_V1.cjs";
const PROVIDER = "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py";
const EA4 = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py";
const DRIFT = "scripts/runtime_acceptance/ASSERT_MCFT_CAP_09_EA5E2_ACTIVATION_BOUNDARY_CURRENT_MAIN.cjs";
const A0_CANONICAL = "apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v1.ts";
const WORKFLOW = ".github/workflows/mcft-cap-09-ea5e2-successor-runner-qualification.yml";
const CRITICAL = [AUTH, HISTORICAL_AUTH, HISTORICAL_GATE, OBSERVER, FORMAL, VIABILITY, POLL, LIVE, WATCHER, CADENCE, PROVIDER, EA4, DRIFT, A0_CANONICAL, WORKFLOW].sort();

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function has(text, marker, code) { assert(text.includes(marker), `${code}:${marker}`); }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`); console.log(JSON.stringify(value)); }

try {
  const exactHead = git("rev-parse", "HEAD");
  assert.equal(git("rev-parse", `HEAD:${HISTORICAL_AUTH}`), "4f0df5f9fe896bf26eda3d673e3153941f59c2e7", "HISTORICAL_AUTHORITY_MUTATED");
  assert.equal(git("rev-parse", `HEAD:${HISTORICAL_GATE}`), "af6d0fbc208ad37f7fd00084ac4636fd2c08fac6", "HISTORICAL_GATE_MUTATED");
  assert.equal(git("rev-parse", `dc9b03a0197e94f64d0d06447999290057e722f2:${OBSERVER}`), "ec18b215f10bedd66fa2a6a1efef0e41cf57ce38", "HISTORICAL_OBSERVER_NOT_PRESERVED_IN_GIT_HISTORY");

  const authority = JSON.parse(read(AUTH));
  assert.equal(authority.schema_version, "geox_mcft_cap09_ea5e2_successor_runner_qualification_v1");
  assert.equal(authority.historical_qualification_reused_as_successor_proof, false);
  assert.equal(authority.successor_qualification_reexecution_required_per_exact_head, true);
  assert.equal(authority.formal_snapshot_binding.canonical_a0_binding_source, A0_CANONICAL);
  assert.equal(authority.formal_snapshot_binding.a0_runtime_config_hash, "sha256:d6b721b0eb74b1fbd4168d0bc1d551c0c95bf60fef67c8fe4cd9b77ad60930f8");
  assert.equal(authority.exact_head_effect.protected_main_live_dispatch_authorized, false);

  const canonicalA0 = read(A0_CANONICAL);
  has(canonicalA0, authority.formal_snapshot_binding.a0_runtime_config_ref, "CANONICAL_A0_REF_MISSING");
  has(canonicalA0, authority.formal_snapshot_binding.a0_runtime_config_hash, "CANONICAL_A0_HASH_MISSING");
  const observer = read(OBSERVER);
  has(observer, "MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_REF_V1", "SUCCESSOR_A0_REF_BINDING_MISSING");
  has(observer, "MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_HASH_V1", "SUCCESSOR_A0_HASH_BINDING_MISSING");
  const formal = read(FORMAL);
  for (const marker of [authority.formal_snapshot_binding.neon_branch_id, authority.formal_snapshot_binding.simulation_branch_id_forbidden, "MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_HASH_V1", "BEGIN TRANSACTION READ ONLY", "pointer_graph_validated", "CROP_A0_AUTHORITY_MISMATCH"]) has(formal, marker, "FORMAL_READINESS_RULE_MISSING");

  const viability = read(VIABILITY);
  for (const marker of ["MIN_TARGET_SETUP_BUDGET_MINUTES = 120", ...authority.live_dispatch_blockers]) has(`${viability}\n${read(CADENCE)}`, marker, "VIABILITY_BLOCKER_MISSING");
  const poll = read(POLL);
  for (const marker of ["COLLECTOR_PROCESSING_BUDGET_MINUTES = 25", "discovery_deadline_is_collector_deadline\": False"]) has(poll, marker, "POLL_PROCESSING_MARGIN_MISSING");
  const cadence = read(CADENCE);
  for (const marker of ["CURRENT_ORCHESTRATION_INCOMPATIBLE", "globally_impossible_for_every_single_t: false", "AUTHORITY_PASS_BUT_ACTIVATION_BLOCKED"]) has(cadence, marker, "CADENCE_DECISION_SEMANTICS_MISSING");
  const watcher = read(WATCHER);
  for (const marker of ["latest_24h_duplicate_event_time_row_count", '"stop": captured', "SELFTEST_STAGED_CONTINUES", "SELFTEST_DUPLICATE_CONTINUES", '"polled_at": snapshot["retrieved_at"]']) has(watcher, marker, "WATCHER_FAIL_CLOSED_RULE_MISSING");
  const provider = read(PROVIDER);
  for (const marker of ["freshness_evaluated_at", "def command_probe_gfs", "same_cycle_pgrb2_sflux_complete"]) has(provider, marker, "PROVIDER_READINESS_RULE_MISSING");
  for (const marker of ["def select_complete_gfs_cycle", "A partially published newest cycle is not a terminal selection", "def command_selftest_gfs_selection"]) has(provider, marker, "GFS_OLDER_COMPLETE_CYCLE_FALLBACK_MISSING");

  const live = read(LIVE);
  assert(!/^\s{2}push:/m.test(live), "LIVE_AUTO_PUSH_FORBIDDEN");
  has(live, "workflow_dispatch:", "LIVE_MANUAL_DISPATCH_REQUIRED");
  has(live, "PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts", "LIVE_FORMAL_PREFLIGHT_MISSING");
  has(live, "probe-gfs", "LIVE_GFS_PREFLIGHT_MISSING");
  assert((live.match(/ASSERT_MCFT_CAP_09_EA5E2_ACTIVATION_BOUNDARY_CURRENT_MAIN\.cjs/g) || []).length >= 4, "MULTIPHASE_MAIN_DRIFT_RECHECKS_REQUIRED");
  has(live, "SUCCESSOR_RUNNER_EXACT_HEAD_QUALIFICATION_REQUIRED", "LIVE_SUCCESSOR_QUALIFICATION_CURRENCY_MISSING");

  const fullChainProof = JSON.parse(read(FULL_CHAIN_PROOF));
  const dependencyProof = JSON.parse(read(DEPENDENCY_PROOF));
  assert.equal(fullChainProof.status, "PASS", "FULL_CHAIN_STATIC_PREFLIGHT_REQUIRED");
  assert.equal(fullChainProof.subject_sha, exactHead, "FULL_CHAIN_EXACT_HEAD_SUBJECT_REQUIRED");
  assert.equal(fullChainProof.activation_readiness, "BLOCKED", "UNQUALIFIED_LIVE_DISPATCH_MUST_REMAIN_BLOCKED");
  assert.deepEqual(fullChainProof.readiness_blockers.map((item) => item.code).sort(), [...authority.live_dispatch_blockers].sort(), "FULL_CHAIN_READINESS_BLOCKER_SET_DRIFT");
  assert.equal(dependencyProof.status, "PASS", "RUNTIME_DEPENDENCY_GRAPH_REQUIRED");

  const blobs = Object.fromEntries(CRITICAL.map((file) => [file, git("rev-parse", `HEAD:${file}`)]));
  const criticalDigest = `sha256:${crypto.createHash("sha256").update(JSON.stringify(blobs)).digest("hex")}`;
  write({
    schema_version: "geox_mcft_cap09_ea5e2_successor_runner_qualification_result_v1",
    status: "PASS",
    subject_sha: exactHead,
    qualification_reexecuted: true,
    exact_head_critical_blob_digest: criticalDigest,
    runtime_dependency_graph_sha256: dependencyProof.expected_dependency_graph_sha256,
    runtime_dependency_graph_count: dependencyProof.runtime_dependency_graph_count,
    full_chain_static_preflight_pass: true,
    exact_head_critical_blobs: blobs,
    historical_authority_preserved: true,
    historical_gate_preserved: true,
    historical_observer_preserved_in_git_history: true,
    successor_observer_requalified: true,
    successor_runner_implementation_qualified: true,
    protected_main_live_dispatch_authorized: false,
    readiness_blockers: authority.live_dispatch_blockers,
    database_write_count: 0,
    provider_request_count: 0,
    formal_window_started: false,
    ea5e2_operational_activation_qualified: false,
  });
} catch (error) {
  write({ schema_version: "geox_mcft_cap09_ea5e2_successor_runner_qualification_result_v1", status: "FAIL", subject_sha: (() => { try { return git("rev-parse", "HEAD"); } catch { return null; } })(), error: String(error?.message || error), successor_runner_implementation_qualified: false, protected_main_live_dispatch_authorized: false, database_write_count: 0, formal_window_started: false });
  process.exitCode = 1;
}
