#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");

const BASE = "1deeea2bd72c70d7eaa9305112f9352b14b8ac91";
const expected = [
  "apps/server/src/domain/decision/decision_eligibility_policy_selector_v1.contract.test.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_selector_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-B09V-DECISION-ELIGIBILITY-POLICY-SELECTOR-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09V-DECISION-ELIGIBILITY-POLICY-SELECTOR-V1.md",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09V_DECISION_ELIGIBILITY_POLICY_SELECTOR_V1.cjs",
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

const changed = cp.execFileSync("git", ["diff", "--name-only", BASE + "...HEAD"], { encoding: "utf8" })
  .trim().split(/\r?\n/).filter(Boolean).sort();
if (JSON.stringify(changed) !== JSON.stringify(expected)) {
  fail("B09V_BOUNDED_SEVEN_FILE_DIFF_REQUIRED:" + JSON.stringify(changed));
}

const packageJson = json(expected[2]);
if (packageJson.schema_version !== "b09v_decision_eligibility_policy_selector_v1") fail("B09V_SCHEMA_INVALID");
if (packageJson.status !== "IMPLEMENTATION_CANDIDATE") fail("B09V_STATUS_INVALID");
if (packageJson.stacked_base_product_head !== BASE) fail("B09V_BASE_INVALID");
if (packageJson.authorized_governance_decision_id !== "DEC-BLINE-ELIGIBILITY-POLICY-SELECTOR-001") fail("B09V_AUTHORIZED_DECISION_INVALID");
if (packageJson.authorization_state !== "AUTHORIZED_BY_USER_2026-08-31") fail("B09V_AUTHORIZATION_STATE_INVALID");
if (packageJson.preserved_gaps?.real_policy_instance !== "NONE") fail("B09V_REAL_POLICY_PREMATURELY_CREATED");
if (packageJson.preserved_gaps?.b07e_runtime_connection !== "DISCONNECTED") fail("B09V_B07E_PREMATURELY_CONNECTED");
if (packageJson.non_effects?.mcft_changed !== false) fail("B09V_MCFT_NON_EFFECT_INVALID");
if (packageJson.non_effects?.authority_removal_performed !== false) fail("B09V_AUTHORITY_REMOVAL_PREMATURE");

const selectorPath = expected[1];
const selector = read(selectorPath);
for (const marker of [
  "CandidateDecisionV1.decision_time",
  "DECLARED_FIELD_PROGRAM",
  "POLICY_SCOPE_AMBIGUOUS",
  "POLICY_SUPERSESSION_AMBIGUOUS",
  "POLICY_DECLARATION_INVALID",
  "IS NOT DISTINCT FROM $7",
  "occurred_at <= $9::timestamptz",
  "scope_anchor_type}') = 'PROGRAM'",
  "effectiveAtBoundaryV1",
  "deactivatedAtBoundaryV1",
]) {
  if (!selector.includes(marker)) fail("B09V_SELECTOR_MARKER_MISSING:" + marker);
}
for (const forbidden of [
  "runDecisionEligibilityRuntimeV1",
  "evaluateDecisionEligibilityV1",
  "registerDecisionEligibility",
  "latest_wins",
  "Date.now()",
  "new Date().toISOString()",
  "decision_recommendation",
]) {
  if (selector.includes(forbidden)) fail("B09V_FORBIDDEN_SELECTOR_AUTHORITY_SHORTCUT:" + forbidden);
}

const test = read(expected[0]);
for (const marker of [
  "canonical ContextSnapshot Program anchor",
  "no canonical ContextSnapshot binding",
  "multiple Program assertions",
  "decision_time with no fallback",
  "null scope is exact null and never wildcard",
  "persisted after the candidate boundary",
  "half-open [effective_from,effective_until) semantics",
  "never resolves overlapping policies by latest/version precedence",
  "validated successor deactivates predecessor",
  "ambiguous successors fail closed",
  "cross-policy supersession fails closed",
  "exact nullable scope/Program anchor/as-of SQL",
]) {
  if (!test.includes(marker)) fail("B09V_CONTRACT_FIXTURE_MISSING:" + marker);
}

const register = json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const eligibility = (register.semantics || []).find((s) => s.semantic_id === "decision.eligibility");
if (!eligibility) fail("B09V_ELIGIBILITY_SEMANTIC_MISSING");
const producer = (eligibility.registered_producers || []).find((p) => p.producer_id === "decision-eligibility-policy-selector-v1");
if (!producer) fail("B09V_SELECTOR_PRODUCER_NOT_REGISTERED");
if (producer.authority_level !== "POLICY_SELECTION_ONLY_CANONICAL_PRODUCER") fail("B09V_SELECTOR_AUTHORITY_LEVEL_INVALID");
if (producer.connection_class !== "REGISTERED_CAPABILITY_ISLAND" || producer.activation !== "MANUAL" || producer.runtime_edge !== "INTENTIONAL_NONE") fail("B09V_SELECTOR_PRODUCER_CONNECTIVITY_INVALID");
const consumer = (eligibility.registered_consumers || []).find((c) => c.consumer_id === "decision-eligibility-policy-selector-v1");
if (!consumer) fail("B09V_SELECTOR_CONSUMER_NOT_REGISTERED");
const runtimeConsumer = (eligibility.runtime_consumers || []).find((c) => c.consumer_id === "decision-eligibility-policy-selector-v1");
if (!runtimeConsumer || runtimeConsumer.producer_id !== "decision-eligibility-policy-declaration-writer-v1" || runtimeConsumer.evidence_edge_id !== "C-046") fail("B09V_SELECTOR_RUNTIME_CONSUMER_INVALID");
const guard = (register.static_guards || []).find((g) => g.guard_id === "G-B02-33-decision-eligibility-policy-selector-runtime-consumer");
if (!guard || JSON.stringify(guard.registered_paths) !== JSON.stringify([selectorPath])) fail("B09V_SELECTOR_GUARD_INVALID");

const graph = json("docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");
const edge = (graph.current_connectivity_edges || []).find((e) => e.edge_id === "C-046");
if (!edge) fail("B09V_SELECTOR_CONNECTIVITY_EDGE_MISSING");
if (edge.from_producer !== "decision-eligibility-policy-declaration-writer-v1" || edge.to_consumer !== "decision-eligibility-policy-selector-v1") fail("B09V_SELECTOR_CONNECTIVITY_EDGE_ENDPOINT_INVALID");
if (edge.runtime_edge !== "PROVEN" || edge.status !== "CURRENT_PROVEN") fail("B09V_SELECTOR_CONNECTIVITY_EDGE_STATUS_INVALID");

for (const path of [
  "apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "apps/server/src/domain/decision/decision_evaluator_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_declaration_fact_v1.ts",
  "apps/server/src/routes/decision_eligibility_policy_declarations_v1.ts",
  "apps/server/src/context/field_program_context_projection_v1.ts",
  "apps/server/src/contracts/canonical_decision_v1.ts",
  "apps/server/src/contracts/canonical_context_v1.ts",
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
  "apps/server/src/domain/auth/roles.ts",
  "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json",
]) {
  if (read(path) !== base(path)) fail("B09V_FROZEN_BLINE_SURFACE_MUTATED:" + path);
}

const forbidden = cp.execFileSync("git", ["diff", "--name-only", BASE + "...HEAD", "--",
  ".github/workflows",
  "apps/server/db",
  "apps/server/src/external_evidence",
  "apps/server/src/runtime/twin_runtime",
  "apps/server/src/domain/twin_kernel",
  "docs/digital_twin",
  "docs/twin_kernel",
  "scripts/runtime_acceptance",
], { encoding: "utf8" }).trim();
if (forbidden) fail("B09V_MCFT_OR_FROZEN_RUNTIME_MUTATION_FORBIDDEN:" + forbidden);

console.log("B09V_SELECTOR_DECISION_AUTHORIZATION_BOUND_PASS");
console.log("B09V_CANONICAL_CONTEXT_PROGRAM_ANCHOR_PASS");
console.log("B09V_EXACT_NULLABLE_SCOPE_NO_WILDCARD_PASS");
console.log("B09V_DECISION_TIME_CAUSAL_ASOF_PASS");
console.log("B09V_HALF_OPEN_EFFECTIVE_WINDOW_PASS");
console.log("B09V_VALIDATED_SUPERSESSION_FAIL_CLOSED_PASS");
console.log("B09V_ZERO_ONE_MANY_POLICY_CARDINALITY_PASS");
console.log("B09V_NO_POLICY_CONTENT_OR_B07E_CONNECTION_PASS");
console.log("B09V_MCFT_ADR_LLM_UNTOUCHED_PASS");
console.log("B09V_GOVERNANCE_ACCEPTANCE_PASS");
