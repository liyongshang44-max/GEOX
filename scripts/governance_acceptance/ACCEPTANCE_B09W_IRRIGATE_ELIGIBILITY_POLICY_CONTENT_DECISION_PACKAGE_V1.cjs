#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");

const BASE = "cce900dfd4e9f412506c3988b3d63ff531ee56bb";

const expected = [
  "docs/architecture/semantic_convergence/GEOX-B09W-IRRIGATE-ELIGIBILITY-POLICY-CONTENT-DECISION-PACKAGE-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09W-IRRIGATE-ELIGIBILITY-POLICY-CONTENT-DECISION-PACKAGE-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09W_IRRIGATE_ELIGIBILITY_POLICY_CONTENT_DECISION_PACKAGE_V1.cjs",
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
  fail("B09W_BOUNDED_FOUR_FILE_DIFF_REQUIRED:" + JSON.stringify(changed));
}

const pkg = json(expected[0]);
if (pkg.schema_version !== "b09w_irrigate_eligibility_policy_content_decision_package_v1") fail("B09W_SCHEMA_INVALID");
if (pkg.phase !== "B-09w") fail("B09W_PHASE_INVALID");
if (pkg.status !== "RECOMMENDED_NOT_AUTHORIZED") fail("B09W_STATUS_MUST_REMAIN_RECOMMENDED_NOT_AUTHORIZED");
if (pkg.stacked_base_product_head !== BASE) fail("B09W_BASE_INVALID");
if (pkg.decision_id !== "DEC-BLINE-IRRIGATE-ELIGIBILITY-POLICY-CONTENT-001") fail("B09W_DECISION_ID_INVALID");
if (pkg.bounded_path?.action_type !== "IRRIGATE") fail("B09W_BOUNDED_ACTION_MUST_BE_IRRIGATE");

const profile = pkg.proposed_policy_profile || {};
if (profile.profile_name !== "IRRIGATE_BASELINE_ELIGIBILITY_V1") fail("B09W_PROFILE_NAME_INVALID");
if (profile.concrete_policy_id !== null || profile.concrete_policy_ref !== null) fail("B09W_REAL_POLICY_IDENTITY_PREMATURE");
if (profile.proposed_policy_version !== "v1") fail("B09W_PROPOSED_VERSION_INVALID");
if (profile.scope_anchor?.type !== "PROGRAM") fail("B09W_PROGRAM_SCOPE_ANCHOR_REQUIRED");
if (profile.scope_anchor?.legacy_recommendation_program_id_authority !== false) fail("B09W_LEGACY_PROGRAM_ID_AUTHORITY_FORBIDDEN");
if (profile.decision_scope?.semantics !== "EXACT_NULLABLE_STRUCTURAL_EQUALITY_V1") fail("B09W_SCOPE_SEMANTICS_INVALID");
if (profile.decision_scope?.null_is_wildcard !== false) fail("B09W_NULL_WILDCARD_FORBIDDEN");
if (profile.decision_scope?.specificity_ranking !== false) fail("B09W_SCOPE_SPECIFICITY_RANKING_FORBIDDEN");

if (JSON.stringify(profile.applicable_action_types) !== JSON.stringify(["IRRIGATE"])) {
  fail("B09W_ACTION_TYPES_INVALID");
}
const expectedCriteria = [
  "QUALIFIED_EVIDENCE",
  "CONTEXT",
  "STATE",
  "FORECAST",
  "ACTION_WINDOW",
];
if (JSON.stringify(profile.required_criteria) !== JSON.stringify(expectedCriteria)) {
  fail("B09W_REQUIRED_CRITERIA_INVALID:" + JSON.stringify(profile.required_criteria));
}
if (profile.lifecycle_semantics !== "B07D_LIFECYCLE_STATE_V1") fail("B09W_LIFECYCLE_SEMANTICS_INVALID");

const rationaleByCriterion = new Map(
  (pkg.criterion_rationale || []).map((entry) => [entry.criterion, entry]),
);
for (const criterion of expectedCriteria) {
  if (!rationaleByCriterion.has(criterion)) fail("B09W_REQUIRED_CRITERION_RATIONALE_MISSING:" + criterion);
}
if (rationaleByCriterion.get("QUALIFIED_EVIDENCE")?.readiness !== "READY_SHADOW_BOUND") {
  fail("B09W_EVIDENCE_READINESS_MISSTATED");
}
if (rationaleByCriterion.get("CONTEXT")?.readiness !== "NOT_BOUND_ON_B09J_CANDIDATE") {
  fail("B09W_CONTEXT_GAP_MUST_REMAIN_EXPLICIT");
}
if (rationaleByCriterion.get("STATE")?.readiness !== "CANONICAL_CALCULATION_RESULT_NOT_BOUND") {
  fail("B09W_STATE_GAP_MUST_REMAIN_EXPLICIT");
}
if (rationaleByCriterion.get("FORECAST")?.readiness !== "CANONICAL_FORECAST_PRODUCT_BINDING_NOT_ESTABLISHED") {
  fail("B09W_FORECAST_GAP_MUST_REMAIN_EXPLICIT");
}
if (rationaleByCriterion.get("ACTION_WINDOW")?.readiness !== "ACTION_WINDOW_PROVENANCE_NOT_ESTABLISHED") {
  fail("B09W_ACTION_WINDOW_GAP_MUST_REMAIN_EXPLICIT");
}

const excluded = new Map(
  (pkg.explicitly_not_required_in_baseline_v1 || []).map((entry) => [entry.criterion, entry.reason]),
);
for (const criterion of [
  "SCENARIO",
  "KNOWLEDGE_POLICY",
  "PERMISSION",
  "CONSEQUENCE",
  "REVERSIBILITY",
  "REMAINING_UNCERTAINTY",
  "INDEPENDENT_EVIDENCE_SUPPORT",
]) {
  if (!excluded.has(criterion)) fail("B09W_EXCLUSION_RATIONALE_MISSING:" + criterion);
}

if (pkg.current_readiness_after_policy_authorization?.real_policy_instance !== "NONE") fail("B09W_REAL_POLICY_INSTANCE_PREMATURE");
if (pkg.current_readiness_after_policy_authorization?.candidate_context_snapshot_ref !== "NULL_ON_CURRENT_B09J_PATH") fail("B09W_CONTEXT_BINDING_OVERCLAIM");
if (pkg.current_readiness_after_policy_authorization?.candidate_decision_time !== "NULL_ON_CURRENT_B09J_PATH") fail("B09W_DECISION_TIME_BINDING_OVERCLAIM");
if (pkg.current_readiness_after_policy_authorization?.b07e_runtime_connection !== "DISCONNECTED") fail("B09W_B07E_CONNECTION_OVERCLAIM");
if (pkg.repository_effects?.policy_instance_added !== false) fail("B09W_POLICY_INSTANCE_EFFECT_INVALID");
if (pkg.repository_effects?.policy_declaration_fact_written !== false) fail("B09W_POLICY_FACT_EFFECT_INVALID");
if (pkg.repository_effects?.b07e_connected !== false) fail("B09W_B07E_EFFECT_INVALID");
if (pkg.repository_effects?.mcft_changed !== false) fail("B09W_MCFT_EFFECT_INVALID");
if (pkg.repository_effects?.authority_removal_performed !== false) fail("B09W_AUTHORITY_REMOVAL_EFFECT_INVALID");

const md = read(expected[1]);
for (const marker of [
  "RECOMMENDED_NOT_AUTHORIZED",
  "QUALIFIED_EVIDENCE",
  "CONTEXT",
  "STATE",
  "FORECAST",
  "ACTION_WINDOW",
  "null is not a wildcard",
  "B-07e runtime connection",
  "policy-content authorization is not equivalent to B-07e readiness",
]) {
  if (!md.includes(marker)) fail("B09W_MD_MARKER_MISSING:" + marker);
}

const currentRegister = json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const baseRegister = JSON.parse(base("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"));
const currentEligibility = (currentRegister.semantics || []).find((s) => s.semantic_id === "decision.eligibility");
const baseEligibility = (baseRegister.semantics || []).find((s) => s.semantic_id === "decision.eligibility");
if (!currentEligibility || !baseEligibility) fail("B09W_DECISION_ELIGIBILITY_REGISTER_MISSING");

for (const key of ["registered_producers", "registered_consumers", "runtime_consumers"]) {
  if (JSON.stringify(currentEligibility[key]) !== JSON.stringify(baseEligibility[key])) {
    fail("B09W_REGISTER_CONNECTIVITY_MUTATED:" + key);
  }
}
if (JSON.stringify(currentRegister.static_guards) !== JSON.stringify(baseRegister.static_guards)) {
  fail("B09W_STATIC_GUARDS_MUTATED");
}

const note1 = "B-09w proposes DEC-BLINE-IRRIGATE-ELIGIBILITY-POLICY-CONTENT-001 as RECOMMENDED_NOT_AUTHORIZED: IRRIGATE baseline required criteria QUALIFIED_EVIDENCE, CONTEXT, STATE, FORECAST and ACTION_WINDOW; proposal creates no real policy declaration instance.";
const note2 = "B-09w explicitly preserves current readiness gaps: B-09j context_snapshot_ref/decision_time remain null, canonical State/Forecast/ActionWindow support remains unbound, B-07e remains disconnected, and MCFT/ADR/LLM/Approval/Execution/consumer migration/authority removal remain untouched.";
if (!(currentEligibility.notes || []).includes(note1) || !(currentEligibility.notes || []).includes(note2)) {
  fail("B09W_REGISTER_NOTES_MISSING");
}

const normalizedCurrent = JSON.parse(JSON.stringify(currentRegister));
const normalizedBase = JSON.parse(JSON.stringify(baseRegister));
const nc = normalizedCurrent.semantics.find((s) => s.semantic_id === "decision.eligibility");
const nb = normalizedBase.semantics.find((s) => s.semantic_id === "decision.eligibility");
nc.notes = nb.notes;
if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedBase)) {
  fail("B09W_REGISTER_MUTATION_MUST_BE_NOTES_ONLY");
}

for (const path of [
  "apps/server/src/domain/decision/decision_eligibility_policy_selector_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_declaration_fact_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_evaluator_v1.ts",
  "apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts",
  "apps/server/src/routes/decision_eligibility_policy_declarations_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json",
]) {
  if (read(path) !== base(path)) fail("B09W_FROZEN_SURFACE_MUTATED:" + path);
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
if (forbidden) fail("B09W_PRODUCTION_OR_MCFT_MUTATION_FORBIDDEN:" + forbidden);

console.log("B09W_IRRIGATE_BOUNDED_ACTION_PASS");
console.log("B09W_REQUIRED_CRITERIA_PRODUCT_RATIONALE_PASS");
console.log("B09W_EXCLUDED_CRITERIA_RATIONALE_PASS");
console.log("B09W_READINESS_GAPS_PRESERVED_PASS");
console.log("B09W_NO_REAL_POLICY_INSTANCE_PASS");
console.log("B09W_NO_B07E_CONNECTION_PASS");
console.log("B09W_REGISTER_NOTES_ONLY_PASS");
console.log("B09W_MCFT_ADR_LLM_UNTOUCHED_PASS");
console.log("B09W_DECISION_PACKAGE_RECOMMENDED_NOT_AUTHORIZED_PASS");
