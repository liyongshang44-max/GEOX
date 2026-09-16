#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");

const BASE = "3bee4dd84eaed71d834a253e8997464e89c488f7";
const expected = [
  "docs/architecture/semantic_convergence/GEOX-B09X-CANDIDATE-CONTEXT-TIME-NONMCFT-READINESS-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09X-CANDIDATE-CONTEXT-TIME-NONMCFT-READINESS-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09X_CANDIDATE_CONTEXT_TIME_NONMCFT_READINESS_V1.cjs",
].sort();

function fail(message) {
  console.error(message);
  process.exit(1);
}
function read(path) {
  return fs.readFileSync(path, "utf8");
}
function json(path) {
  return JSON.parse(read(path));
}
function base(path) {
  return cp.execFileSync("git", ["show", BASE + ":" + path], { encoding: "utf8" });
}

const changed = cp.execFileSync(
  "git",
  ["diff", "--name-only", BASE + "...HEAD"],
  { encoding: "utf8" },
).trim().split(/\r?\n/).filter(Boolean).sort();

if (JSON.stringify(changed) !== JSON.stringify(expected)) {
  fail("B09X_BOUNDED_FOUR_FILE_DIFF_REQUIRED:" + JSON.stringify(changed));
}

const pkg = json(expected[0]);
if (pkg.schema_version !== "b09x_candidate_context_time_nonmcft_readiness_v1") fail("B09X_SCHEMA_INVALID");
if (pkg.phase !== "B-09x") fail("B09X_PHASE_INVALID");
if (pkg.status !== "ANALYSIS_ONLY_NOT_AUTHORIZED_FOR_BINDING") fail("B09X_STATUS_INVALID");
if (pkg.stacked_base_product_head !== BASE) fail("B09X_BASE_INVALID");

if (pkg.findings?.decision_time?.state !== "BLOCKED_NO_CANONICAL_SOURCE") fail("B09X_DECISION_TIME_STATE_INVALID");
for (const forbidden of [
  "legacy decision_recommendation_v1.created_ts",
  "decision_recommendation_v1 fact occurred_at",
  "wall clock",
  "evaluated_at",
  "latest",
]) {
  if (!(pkg.findings?.decision_time?.prohibited_sources || []).includes(forbidden)) {
    fail("B09X_DECISION_TIME_FORBIDDEN_SOURCE_MISSING:" + forbidden);
  }
}

if (pkg.findings?.context?.state !== "STRUCTURALLY_READY_BUT_TEMPORALLY_BLOCKED") fail("B09X_CONTEXT_STATE_INVALID");
if (pkg.findings?.context?.prohibition !== "LATEST_PROGRAM_STATE_IS_NOT_CAUSAL_CONTEXT_AUTHORITY") fail("B09X_LATEST_PROGRAM_PROHIBITION_MISSING");
if (pkg.findings?.context?.dependency !== "canonical decision_time") fail("B09X_CONTEXT_DECISION_TIME_DEPENDENCY_MISSING");

if (pkg.findings?.state?.state !== "CAPABILITY_EXISTS_NOT_BOUND") fail("B09X_STATE_READINESS_INVALID");
if (pkg.findings?.state?.mcft_dependency !== false) fail("B09X_STATE_MUST_REMAIN_BLINE_LOCAL");
if (pkg.findings?.action_window?.state !== "VOCABULARY_ONLY_NO_CANONICAL_PRODUCER") fail("B09X_ACTION_WINDOW_READINESS_INVALID");
if (pkg.findings?.forecast?.state !== "FROZEN_EXTERNAL_DEPENDENCY") fail("B09X_FORECAST_MUST_REMAIN_FROZEN");
if (pkg.findings?.forecast?.dependency !== "MCFT-9 COMPLETE + separate integration authorization") fail("B09X_FORECAST_DEPENDENCY_INVALID");

for (const key of ["runtime_change","graph_edge_change","policy_fact","candidate_binding","b07e_connection","mcft_change","authority_removal"]) {
  if (pkg.non_effects?.[key] !== false) fail("B09X_NON_EFFECT_INVALID:" + key);
}

const md = read(expected[1]);
for (const marker of [
  "No existing source may currently be promoted into canonical",
  "persistence time, not the semantic instant",
  "latest-state reader, not an as-of decision-time reader",
  "CalculationResult",
  "No canonical ActionWindow producer",
  "FORECAST",
  "MCFT-9 is not complete",
]) {
  if (!md.includes(marker)) fail("B09X_MD_MARKER_MISSING:" + marker);
}

const currentRegister = json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const baseRegister = JSON.parse(base("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"));
if (JSON.stringify(currentRegister.static_guards) !== JSON.stringify(baseRegister.static_guards)) {
  fail("B09X_STATIC_GUARDS_MUTATED");
}
const currentEligibility = currentRegister.semantics.find((s) => s.semantic_id === "decision.eligibility");
const baseEligibility = baseRegister.semantics.find((s) => s.semantic_id === "decision.eligibility");
for (const key of ["registered_producers","registered_consumers","runtime_consumers"]) {
  if (JSON.stringify(currentEligibility?.[key]) !== JSON.stringify(baseEligibility?.[key])) {
    fail("B09X_REGISTER_CONNECTIVITY_MUTATED:" + key);
  }
}

const normalizedCurrent = JSON.parse(JSON.stringify(currentRegister));
const normalizedBase = JSON.parse(JSON.stringify(baseRegister));
normalizedCurrent.semantics.find((s) => s.semantic_id === "decision.eligibility").notes =
  normalizedBase.semantics.find((s) => s.semantic_id === "decision.eligibility").notes;
if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedBase)) {
  fail("B09X_REGISTER_MUTATION_MUST_BE_NOTES_ONLY");
}

for (const path of [
  "apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts",
  "apps/server/src/domain/decision/legacy_recommendation_candidate_adapter_v1.ts",
  "apps/server/src/context/field_program_context_projection_v1.ts",
  "apps/server/src/domain/decision/irrigation_calculation_result_adapter_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_selector_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "apps/server/src/routes/decision_engine_v1.ts",
  "apps/server/src/routes/programs_core_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
]) {
  if (read(path) !== base(path)) fail("B09X_FROZEN_SURFACE_MUTATED:" + path);
}

const forbidden = cp.execFileSync(
  "git",
  ["diff", "--name-only", BASE + "...HEAD", "--",
    ".github/workflows",
    "apps/server/src",
    "apps/server/db",
    "packages",
    "config",
    "docs/digital_twin",
    "docs/twin_kernel",
    "scripts/runtime_acceptance",
  ],
  { encoding: "utf8" },
).trim();
if (forbidden) fail("B09X_PRODUCTION_OR_MCFT_MUTATION_FORBIDDEN:" + forbidden);

console.log("B09X_NO_CANONICAL_DECISION_TIME_SOURCE_PASS");
console.log("B09X_LATEST_PROGRAM_NOT_CAUSAL_CONTEXT_PASS");
console.log("B09X_STATE_BLINE_LOCAL_CAPABILITY_NOT_BOUND_PASS");
console.log("B09X_ACTION_WINDOW_NO_CANONICAL_PRODUCER_PASS");
console.log("B09X_FORECAST_MCFT_FROZEN_PASS");
console.log("B09X_NO_BINDING_OR_RUNTIME_EFFECT_PASS");
