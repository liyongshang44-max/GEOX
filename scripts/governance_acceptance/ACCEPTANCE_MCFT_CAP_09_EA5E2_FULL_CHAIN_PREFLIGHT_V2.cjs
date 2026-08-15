#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { validateTimingBudgetEvidence } = require("../runtime_acceptance/MCFT_CAP_09_EA5E2_TIMING_BUDGET_EVIDENCE_V2.cjs");

const OUTPUT = "acceptance-output/MCFT_CAP_09_EA5E2_FULL_CHAIN_PREFLIGHT_V2.json";
const DEP_OUTPUT = "acceptance-output/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH.json";
const LIVE = ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml";
const POLL = "scripts/runtime_acceptance/POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py";
const VIABILITY = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_LIVE_WINDOW_VIABILITY.cjs";
const FORMAL = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts";
const OBSERVER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts";
const SUCCESSOR_WF = ".github/workflows/mcft-cap-09-ea5e2-successor-runner-qualification.yml";
const SUCCESSOR_V2 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V2.json";
const PERSISTED_A0 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTED-A0-AUTHORITY-V1.json";
const CROP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json";
const HIST_SUCCESSOR_V1 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V1.json";
const HIST_TIMING_V1 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-TIMING-BUDGET-QUALIFICATION-V1.json";
const DEP_V3 = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V3.cjs";
const HOUR = 3600_000;
const PRE_BOUNDARY_OFFSET_MINUTES = 30;
const MIN_PRE_BOUNDARY_LEAD_MINUTES = 20;

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function obj(value, code) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code); return value; }
function add(list, condition, code, detail = null) { if (condition) list.push(detail ? { code, detail } : { code }); }
function has(text, marker) { return text.includes(marker); }

function stageAt(ageDays, lengths) {
  const b1 = lengths[0], b2 = b1 + lengths[1], b3 = b2 + lengths[2], b4 = b3 + lengths[3];
  if (ageDays < 0 || ageDays >= b4) return null;
  if (ageDays < b1) return "INITIAL";
  if (ageDays < b2) return "DEVELOPMENT";
  if (ageDays < b3) return "MID";
  return "LATE";
}

function cropProfile(authority) {
  const planting = obj(authority.planting_authority, "EA5E2_V2_PLANTING_AUTHORITY_REQUIRED");
  const window = obj(planting.possible_event_window_utc, "EA5E2_V2_PLANTING_WINDOW_REQUIRED");
  const model = obj(authority.model_stage_prior, "EA5E2_V2_MODEL_STAGE_PRIOR_REQUIRED");
  const policy = obj(authority.as_of_derivation_policy, "EA5E2_V2_DERIVATION_POLICY_REQUIRED");
  const variants = model.variant_stage_lengths_days;
  if (!Array.isArray(variants) || variants.length !== 6) throw new Error("EA5E2_V2_EXACT_SIX_VARIANTS_REQUIRED");
  const starts = [Date.parse(window.start_inclusive), Date.parse(window.end_exclusive) - 1];
  if (starts.some((x) => !Number.isFinite(x))) throw new Error("EA5E2_V2_PLANTING_WINDOW_INVALID");
  if (policy.backward_stability_hours !== 6 || policy.forward_transition_guard_hours !== 30
      || policy.planting_time_uncertainty_must_be_carried !== true || policy.future_observations_authorized !== false) {
    throw new Error("EA5E2_V2_CROP_POLICY_DRIFT");
  }
  const maxEnd = Math.max(...variants.map((v) => {
    if (!Array.isArray(v) || v.length !== 4 || v.some((x) => typeof x !== "number" || !Number.isFinite(x))) throw new Error("EA5E2_V2_VARIANT_INVALID");
    return v.reduce((a, b) => a + b, 0);
  }));
  const firstHour = Math.ceil(Date.now() / HOUR) * HOUR;
  const scanEnd = starts[1] + maxEnd * 24 * HOUR + 48 * HOUR;
  const legal = [];
  for (let target = firstHour; target <= scanEnd; target += HOUR) {
    const stages = new Set();
    let outside = false;
    for (const variant of variants) for (const plantingMs of starts) for (const t of [target - 6 * HOUR, target, target + 30 * HOUR]) {
      const stage = stageAt((t - plantingMs) / (24 * HOUR), variant);
      if (!stage) outside = true; else stages.add(stage);
    }
    if (!outside && stages.size === 1) legal.push({ target_t: new Date(target).toISOString(), stage: [...stages][0] });
  }
  const last = legal.at(-1) ?? null;
  return {
    legal_future_target_count: legal.length,
    first_legal_future_target: legal[0] ?? null,
    last_legal_future_target: last,
    latest_dispatch_time_for_last_legal_target: last ? new Date(Date.parse(last.target_t) - (PRE_BOUNDARY_OFFSET_MINUTES + MIN_PRE_BOUNDARY_LEAD_MINUTES) * 60_000).toISOString() : null,
  };
}

function main() {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const blockers = [], readiness = [], warnings = [];
  const head = git("rev-parse", "HEAD");
  const live = read(LIVE), poll = read(POLL), viability = read(VIABILITY), formal = read(FORMAL), observer = read(OBSERVER), successorWf = read(SUCCESSOR_WF);
  const persisted = JSON.parse(read(PERSISTED_A0));
  const cropAuthority = JSON.parse(read(CROP));
  const successor = JSON.parse(read(SUCCESSOR_V2));

  add(blockers, git("rev-parse", `HEAD:${HIST_SUCCESSOR_V1}`) !== "da6b62cb193f2b30ead31a8e788f88389e15ede0", "HISTORICAL_SUCCESSOR_V1_MUTATED");
  add(blockers, git("rev-parse", `HEAD:${HIST_TIMING_V1}`) !== "3ddd55c48d582fe29ab34273ca35ac9152dde8f5", "HISTORICAL_TIMING_V1_MUTATED");
  add(blockers, git("rev-parse", `HEAD:${PERSISTED_A0}`) !== "e44b43d71d339c39e017737d44c7c9a17a67f5be", "PERSISTED_T3R1_A0_AUTHORITY_DRIFT");
  add(blockers, git("rev-parse", `HEAD:${CROP}`) !== "757e4b9f4fdcd631eea97fca85614a1b61ef0c4a", "T3R1_CROP_AUTHORITY_DRIFT");

  add(blockers, persisted.record_status !== "PERSISTED_T3R1_A0_EFFECTIVE_NOT_EA5E2_ACTIVATION" || persisted.database_identity?.database_name !== "geox_mcft_cap09_s6_formal_t3r1_24h" || persisted.database_identity?.t1r1_database_reused !== false, "PERSISTED_T3R1_A0_SEMANTICS_INVALID");
  add(blockers, persisted.persisted_a0?.runtime_config_ref !== "external_formal_runtime_config_49959a28cfc9eb357bf18f9d" || persisted.persisted_a0?.runtime_config_hash !== "sha256:5f11788fd049a3eae190d566e6faa28f428637e11f2c90b4e0aaea67e6f14e48", "PERSISTED_T3R1_A0_REF_HASH_DRIFT");
  add(blockers, persisted.persisted_inventory?.t1r1_scope_row_count !== 0 || persisted.persisted_inventory?.scheduler_slot_count !== 0 || persisted.persisted_inventory?.scheduler_cursor_count !== 0, "PERSISTED_T3R1_ZERO_REUSE_OR_SCHEDULER_DRIFT");

  let timing = null;
  try { timing = validateTimingBudgetEvidence(); } catch (error) { add(blockers, true, "EXACT_MAIN_T3R1_TIMING_V2_INVALID", { message: String(error?.message ?? error) }); }
  if (timing) {
    add(blockers, timing.status !== "PASS" || timing.workflow_run_id !== 31890174183 || timing.collector.safety_adjusted_max_elapsed_ms !== 44580 || timing.observer.safety_adjusted_max_elapsed_ms !== 2736, "EXACT_MAIN_T3R1_TIMING_V2_DRIFT");
    add(blockers, timing.provider_temporal_authority !== "PROVIDER_AVAILABILITY_WATERMARK_V1", "TIMING_V2_PROVIDER_TEMPORAL_AUTHORITY_DRIFT");
  }

  add(blockers, /^\s{2}push:\s*$/m.test(live), "EXPENSIVE_LIVE_AUTO_PUSH_FORBIDDEN");
  add(blockers, !has(live, "workflow_dispatch:"), "LIVE_MANUAL_DISPATCH_REQUIRED");
  add(blockers, !has(live, "GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL") || has(live, "FORMAL_DATABASE_URL: ${{ secrets.GEOX_MCFT_CAP09_S6_DATABASE_URL }}"), "LIVE_FORMAL_DATABASE_NOT_T3R1_BOUND");
  add(blockers, !has(live, "SUCCESSOR_RUNNER_EXACT_HEAD_QUALIFICATION_REQUIRED"), "LIVE_EXACT_HEAD_SUCCESSOR_GATE_MISSING");
  add(blockers, !has(live, "EA5E2_ACTIVATION_LATE_SEMANTIC_AVAILABILITY_POLL_REQUIRED"), "LIVE_SEMANTIC_AVAILABILITY_GATE_MISSING");
  add(blockers, has(live, "Number(availability.latest_age_hours)>6") || has(live, "EA5E2_ACTIVATION_LATE_AVAILABILITY_AND_FRESHNESS_AUTHORITY_REQUIRED"), "LIVE_SIX_HOUR_LATE_ADMISSION_GATE_STILL_PRESENT");
  add(blockers, !has(live, "PROVIDER_AVAILABILITY_WATERMARK_V1") || !has(live, "freshness_is_late_authoritative_admission_gate"), "LIVE_AMENDMENT11_WATERMARK_PROOF_MISSING");

  add(blockers, !has(poll, 'TEMPORAL_AUTHORITY = "PROVIDER_AVAILABILITY_WATERMARK_V1"') || !has(poll, 'PROVIDER_PUBLICATION_CADENCE = "DAILY_BATCH"') || !has(poll, 'FRESHNESS_ROLE = "HISTORICAL_ONLINE_DIAGNOSTIC_ONLY"'), "LATE_POLLER_WATERMARK_SEMANTICS_MISSING");
  add(blockers, has(poll, "latest_age_hours <= float") || has(poll, "latest_age_hours <= 6"), "LATE_POLLER_SIX_HOUR_ADMISSION_GATE_STILL_PRESENT");
  add(blockers, !has(poll, '"freshness_is_late_authoritative_admission_gate": False') || !has(poll, "if len(exact_matches) == 1:"), "LATE_POLLER_EXACT_T_SEMANTIC_ADMISSION_MISSING");

  add(blockers, !has(formal, "FRESH_BOOTSTRAP_EFFECTIVENESS_PATH") || !has(formal, "EXPECTED_DATABASE") || !has(formal, "EA5E2_FORMAL_READINESS_EXACT_A0_REQUIRED") || !has(formal, "BEGIN TRANSACTION READ ONLY"), "FORMAL_T3R1_READ_ONLY_A0_PREFLIGHT_MISSING");
  add(blockers, !has(observer, "FRESH_BOOTSTRAP_EFFECTIVENESS_PATH") || !has(observer, "A0_CONFIG_REF") || !has(observer, "A0_CONFIG_HASH") || !has(observer, "EXPECTED_FORMAL_DATABASE"), "OBSERVER_T3R1_PERSISTED_A0_BINDING_MISSING");
  add(blockers, !has(viability, "validateTimingBudgetEvidence") || !has(viability, "QUALIFIED_EXACT_MAIN_2X_SAFETY"), "LIVE_VIABILITY_TIMING_BINDING_MISSING");

  add(blockers, successor.schema_version !== "geox_mcft_cap09_ea5e2_successor_runner_qualification_v2" || successor.formal_snapshot_binding?.database_name !== "geox_mcft_cap09_s6_formal_t3r1_24h" || successor.provider_temporal_semantics?.authority !== "PROVIDER_AVAILABILITY_WATERMARK_V1" || successor.provider_temporal_semantics?.six_hour_freshness_is_late_authoritative_admission_gate !== false, "SUCCESSOR_V2_AUTHORITY_SEMANTICS_DRIFT");
  add(blockers, !has(successorWf, "ACCEPTANCE_MCFT_CAP_09_EA5E2_FULL_CHAIN_PREFLIGHT_V2.cjs") || !has(successorWf, "ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V3.cjs") || !has(successorWf, "ACCEPTANCE_MCFT_CAP_09_EA5E2_SUCCESSOR_RUNNER_QUALIFICATION_V2.cjs"), "SUCCESSOR_WORKFLOW_NOT_REBOUND_TO_V2_FULL_CHAIN");

  let dep = null;
  try {
    if (!fs.existsSync(DEP_OUTPUT)) execFileSync("node", [DEP_V3], { stdio: "inherit" });
    dep = JSON.parse(read(DEP_OUTPUT));
  } catch (error) {
    if (fs.existsSync(DEP_OUTPUT)) dep = JSON.parse(read(DEP_OUTPUT));
    add(blockers, true, "RUNTIME_DEPENDENCY_GRAPH_V3_INVALID", { message: String(error?.message ?? error), expected: dep?.expected_dependency_graph_sha256 ?? null });
  }
  if (dep) add(blockers, dep.status !== "PASS" || dep.binding_carrier_in_exact_main_critical !== true, "RUNTIME_DEPENDENCY_GRAPH_V3_NOT_BOUND", { expected: dep.expected_dependency_graph_sha256, actual: dep.carrier_dependency_graph_sha256 });

  let crop = null;
  try { crop = cropProfile(cropAuthority); } catch (error) { add(blockers, true, "CURRENT_CROP_PROFILE_INVALID", { message: String(error?.message ?? error) }); }
  if (crop) add(readiness, crop.legal_future_target_count === 0, "CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET", crop);
  add(readiness, !timing || timing.status !== "PASS", "CURRENT_TIMING_V2_NOT_QUALIFIED");
  add(readiness, blockers.length > 0, "STATIC_FULL_CHAIN_BLOCKERS_PRESENT", { blocker_count: blockers.length });

  const result = {
    schema_version: "geox_mcft_cap09_ea5e2_full_chain_preflight_v2",
    status: blockers.length === 0 ? "PASS" : "FAIL",
    subject_sha: head,
    blocker_count: blockers.length,
    blockers,
    readiness_blocker_count: readiness.length,
    readiness_blockers: readiness,
    activation_readiness: blockers.length === 0 && readiness.length === 0 ? "READY" : "BLOCKED",
    timing_budget_qualification: timing,
    crop_profile: crop,
    runtime_dependency_graph_sha256: dep?.expected_dependency_graph_sha256 ?? null,
    persisted_a0_runtime_config_ref: persisted.persisted_a0?.runtime_config_ref ?? null,
    persisted_a0_runtime_config_hash: persisted.persisted_a0?.runtime_config_hash ?? null,
    formal_database_name: persisted.database_identity?.database_name ?? null,
    provider_temporal_authority: successor.provider_temporal_semantics?.authority ?? null,
    six_hour_freshness_role: successor.provider_temporal_semantics?.six_hour_freshness_role ?? null,
    database_write_count: 0,
    provider_request_count: 0,
    scheduler_write_count: 0,
    live_dispatch_started: false,
    formal_window_started: false,
    mcft_cap09_completed: false,
    warnings,
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
  if (result.status !== "PASS" || result.activation_readiness !== "READY") process.exitCode = 1;
}

main();
