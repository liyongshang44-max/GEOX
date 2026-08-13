#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const EVIDENCE_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-TIMING-BUDGET-QUALIFICATION-V1.json";
const EXPECTED_SUBJECT_SHA = "eb21a3e5c51a471d7eecd6118bd27a53201d49fc";
const EXPECTED_RUN_ID = 31680898174;
const EXPECTED_ARTIFACT_ID = 9173467650;
const EXPECTED_ARTIFACT_DIGEST = "sha256:3d1fc6316f2195c4ab8ddbab17b52d018d17b1c196cf471c538944f8ef59dbd6";

function requiredObject(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value;
}

function requiredNumber(value, code) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(code);
  return value;
}

function currentBlob(file) {
  return execFileSync("git", ["rev-parse", `HEAD:${file}`], { encoding: "utf8" }).trim();
}

function validatePath(result, expectedPath, expectedBudgetMs, code, budgetError) {
  const measured = requiredObject(result, `${code}_RESULT_REQUIRED`);
  if (measured.path !== expectedPath || measured.status !== "QUALIFIED") throw new Error(`${code}_PATH_OR_STATUS_DRIFT`);
  const elapsed = measured.elapsed_ms;
  if (!Array.isArray(elapsed) || elapsed.length !== 3) throw new Error(`${code}_EXACT_THREE_TRIALS_REQUIRED`);
  const values = elapsed.map((value) => requiredNumber(value, `${code}_ELAPSED_INVALID`));
  const max = Math.max(...values);
  const p95 = [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
  if (measured.max_elapsed_ms !== max || measured.p95_elapsed_ms !== p95) throw new Error(`${code}_AGGREGATE_MISMATCH`);
  if (measured.qualified_budget_ms !== expectedBudgetMs || measured.safety_adjusted_max_elapsed_ms !== max * 2) throw new Error(`${code}_BUDGET_BINDING_DRIFT`);
  if (measured.safety_adjusted_max_elapsed_ms > expectedBudgetMs || measured.p95_elapsed_ms * 2 > expectedBudgetMs) throw new Error(budgetError);
  return {
    trial_count: values.length,
    elapsed_ms: values,
    p95_elapsed_ms: p95,
    max_elapsed_ms: max,
    safety_adjusted_max_elapsed_ms: max * 2,
    qualified_budget_ms: expectedBudgetMs,
  };
}

function validateTimingBudgetEvidence() {
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, "utf8"));
  if (evidence.schema_version !== "geox_mcft_cap09_ea5e2_timing_budget_qualification_evidence_v1"
      || evidence.record_status !== "EXACT_MAIN_ENGINEERING_TIMING_QUALIFICATION_NOT_ACTIVATION_AUTHORITY") {
    throw new Error("EA5E2_TIMING_EVIDENCE_SCHEMA_OR_STATUS_DRIFT");
  }
  const binding = requiredObject(evidence.qualification_binding, "EA5E2_TIMING_EVIDENCE_BINDING_REQUIRED");
  if (binding.subject_sha !== EXPECTED_SUBJECT_SHA
      || binding.workflow_run_id !== EXPECTED_RUN_ID
      || binding.artifact_id !== EXPECTED_ARTIFACT_ID
      || binding.artifact_digest !== EXPECTED_ARTIFACT_DIGEST
      || binding.aggregate_proof_sha256 !== "sha256:e8b4e9f7e5043b736a1161eb012a05636776e3b07cfb48795d69605a7d72071c"
      || binding.exact_main_action_run !== true
      || binding.workflow_conclusion !== "success") {
    throw new Error("EA5E2_TIMING_EVIDENCE_EXACT_MAIN_BINDING_DRIFT");
  }

  const blobs = requiredObject(evidence.measured_implementation_blobs, "EA5E2_TIMING_EVIDENCE_BLOBS_REQUIRED");
  const entries = Object.entries(blobs);
  if (entries.length !== 5) throw new Error("EA5E2_TIMING_EVIDENCE_EXACT_FIVE_MEASURED_BLOBS_REQUIRED");
  for (const [file, expected] of entries) {
    if (!/^[0-9a-f]{40}$/.test(String(expected)) || currentBlob(file) !== expected) {
      throw new Error(`EA5E2_TIMING_EVIDENCE_MEASURED_BLOB_DRIFT:${file}`);
    }
  }

  const result = requiredObject(evidence.qualification_result, "EA5E2_TIMING_EVIDENCE_RESULT_REQUIRED");
  if (result.status !== "PASS" || result.trial_count !== 3 || result.safety_factor !== 2) {
    throw new Error("EA5E2_TIMING_EVIDENCE_RESULT_CONTRACT_DRIFT");
  }
  const collector = validatePath(result.collector, "REAL_KBS_GET_PRIVATE_R2_RETAIN_DECODE_ET0_CANONICALIZE_ISOLATED_DB_INGRESS", 25 * 60_000, "EA5E2_COLLECTOR_TIMING", "EA5E2_COLLECTOR_TIMING_BUDGET_NOT_QUALIFIED");
  const observer = validatePath(result.observer, "FORMAL_A0_READ_ONLY_PLUS_ISOLATED_DB_EXACT_FIVE_PLUS_REAL_EXTERNAL_CAP04_A1_72", 5 * 60_000, "EA5E2_OBSERVER_TIMING", "EA5E2_OBSERVER_TIMING_BUDGET_NOT_QUALIFIED");

  const guards = requiredObject(evidence.operational_engineering_guards, "EA5E2_TIMING_ENGINEERING_GUARDS_REQUIRED");
  const expectedGuards = {
    late_exact_t_discovery_deadline_offset_minutes: 407,
    frozen_late_collector_cutoff_offset_minutes: 432,
    collector_processing_reservation_minutes: 25,
    runtime_observer_offset_minutes: 437,
    observer_operational_start_deadline_offset_minutes: 442,
    frozen_observer_max_start_offset_minutes: 447,
    observer_processing_reservation_minutes: 5,
    tighter_engineering_guards_change_frozen_authority: false,
  };
  if (JSON.stringify(guards) !== JSON.stringify(expectedGuards)) throw new Error("EA5E2_TIMING_ENGINEERING_GUARD_DRIFT");

  const effects = requiredObject(evidence.non_effects, "EA5E2_TIMING_NON_EFFECTS_REQUIRED");
  if (effects.frozen_authority_changed !== false || effects.provider_authority_changed !== false
      || effects.crop_or_season_authority_changed !== false || effects.formal_database_write_count !== 0
      || effects.formal_r2_write_count !== 0 || effects.scheduler_write_count !== 0
      || effects.live_dispatch_authorized !== false || effects.raw_values_emitted !== false) {
    throw new Error("EA5E2_TIMING_EVIDENCE_NON_EFFECT_DRIFT");
  }

  return {
    status: "PASS",
    evidence_path: EVIDENCE_PATH,
    subject_sha: binding.subject_sha,
    workflow_run_id: binding.workflow_run_id,
    artifact_id: binding.artifact_id,
    artifact_digest: binding.artifact_digest,
    collector,
    observer,
    operational_engineering_guards: guards,
    measured_implementation_blob_count: entries.length,
    authority_effect: false,
    live_dispatch_authorized: false,
  };
}

module.exports = { EVIDENCE_PATH, validateTimingBudgetEvidence };

if (require.main === module) console.log(JSON.stringify(validateTimingBudgetEvidence()));
