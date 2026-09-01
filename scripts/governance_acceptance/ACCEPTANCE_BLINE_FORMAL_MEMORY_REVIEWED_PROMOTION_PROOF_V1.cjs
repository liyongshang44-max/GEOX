#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const files = {
  route: "apps/server/src/routes/field_memory_v1.ts",
  service: "apps/server/src/services/field_memory_service.ts",
  verifier: "apps/server/src/services/formal_field_memory_promotion_authority_v1.ts",
  seed: "scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs",
  dataset: "scripts/demo_seed/datasets/C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.cjs",
  openapi: "apps/server/src/routes/openapi_v1.ts",
  migration: "README_MIGRATION.md",
};

const source = Object.fromEntries(Object.entries(files).map(([k, p]) => [k, fs.readFileSync(p, "utf8")]));
const failures = [];
const fail = (code) => failures.push(code);
const need = (key, tokens) => {
  for (const token of tokens) if (!source[key].includes(token)) fail(`${key.toUpperCase()}_MISSING:${token}`);
};
const forbid = (key, tokens) => {
  for (const token of tokens) if (source[key].includes(token)) fail(`${key.toUpperCase()}_FORBIDDEN:${token}`);
};

need("route", [
  "field_memory_record_ref",
  "MISSING_FIELD_MEMORY_RECORD_REF",
  "createFormalFieldMemoryFromAcceptanceV1(pool, tenant, { operation_plan_id, acceptance_id, field_memory_record_ref })",
]);

need("service", [
  "requireFormalFieldMemoryPromotionAuthorityV1",
  "field_memory_record_ref: string",
  "P29_FIELD_MEMORY_CANDIDATE_BOUND",
  "P30_REVIEWED_PROMOTION_COMMITTED",
  'source_type: "field_memory_record_v1"',
]);

need("verifier", [
  "OUTCOME_ROI_BOUNDARY_GATE_CONTRACT_V0",
  "ROI_BOUNDARY_PAYLOAD_SCHEMA_V0",
  "ROI_LEDGER_GATE_CONTRACT_V0",
  "FIELD_MEMORY_RECORD_GATE_CONTRACT_V0",
  "FIELD_MEMORY_CANDIDATE_GATE_CONTRACT_V0",
  "RECORD_COMMITTED",
  "CANDIDATE_RECORDED",
  "memory_relevance_review_v1",
  "agronomic_context_v1",
  "recurrence_context_v1",
  "operator_review_v1",
  "promotion_review_v1",
  "memory_record_policy_v1",
  "agronomic_reviewer_approval_v1",
  "operator_context_ack_v1",
  "reuse_boundary_review_v1",
  "formal_eligible !== true",
  "FIELD_MEMORY_PROMOTION_BASIS_MUST_BE_DISTINCT_FROM_CANDIDATE_BASIS",
  "tenant_id",
  "project_id",
  "group_id",
  "operation_plan_id",
  "act_task_id",
  "field_id",
  "acceptance_result_fact_id",
  "outcome_review_fact_id",
  "roi_boundary_fact_id",
  "roi_ledger_fact_id",
  "FIELD_MEMORY_OUTCOME_REVIEW_NOT_REVIEWED",
  "FIELD_MEMORY_ROI_LEDGER_NOT_RECORDED",
  "FIELD_MEMORY_RECORD_REVIEW_ONLY_SCOPE_BLOCKED",
  "FIELD_MEMORY_RECORD_SCOPE_NOT_SAME_FIELD_ONLY",
  "FIELD_MEMORY_RECORD_REUSE_BOUNDARY_SCOPE_MISMATCH",
  "FIELD_MEMORY_ROI_COST_BASIS_REF_MISSING",
  "FIELD_MEMORY_ROI_VALUE_BASIS_REF_MISSING",
  "FIELD_MEMORY_ROI_ACCOUNTING_POLICY_REF_MISSING",
  "SOURCE_LANE_BLOCKED",
]);

forbid("verifier", [
  "P30_09_FIELD_MEMORY_RECORD_GATE_V0.cjs",
  "P29_09_FIELD_MEMORY_CANDIDATE_GATE_V0.cjs",
  "child_process",
  "spawnSync",
  "execSync",
  "INSERT INTO facts",
]);

need("dataset", [
  "FIELD_MEMORY_CANDIDATE_ID",
  "FIELD_MEMORY_RECORD_ID",
  "outcome_review_v1",
  "roi_boundary_v1",
  "roi_ledger_v1",
  "field_memory_candidate_v1",
  "field_memory_record_v1",
  "controlled_fixture_only: true",
  "FIELD_MEMORY_CANDIDATE_GATE_CONTRACT_V0",
  "FIELD_MEMORY_RECORD_GATE_CONTRACT_V0",
  "roiCostBasisRefs",
  "roiValueBasisRefs",
  "roiAccountingPolicyRef",
  "memoryCandidateBasisRefs",
  "memoryPromotionBasisRefs",
  "record_scope: 'same_field_only'",
  "controlled_p26_p30_proof_is_pre_authorized_fixture_only",
]);

need("seed", [
  "FIELD_MEMORY_RECORD_ID",
  "field_memory_record_ref: FIELD_MEMORY_RECORD_ID",
]);

need("openapi", [
  'required: ["tenant_id", "project_id", "group_id", "operation_plan_id", "acceptance_id", "field_memory_record_ref"]',
  "Acceptance is necessary provenance but never sufficient authority",
]);

need("migration", [
  "Candidate is not committed Field Memory",
  "Explicit reviewed Field Memory promotion/commit gate",
]);

if (source.route.includes("field_memory_record_ref") && !source.service.includes("requireFormalFieldMemoryPromotionAuthorityV1")) {
  fail("ROUTE_PROOF_REF_NOT_VERIFIED_BY_SERVICE");
}

console.log("BLINE_FORMAL_MEMORY_REVIEWED_PROMOTION_PROOF_STATS " + JSON.stringify({
  failures: failures.length,
  route_requires_record_ref: source.route.includes("MISSING_FIELD_MEMORY_RECORD_REF"),
  verifier_consumes_only: !source.verifier.includes("INSERT INTO facts"),
  c8_has_outcome_review: source.dataset.includes("outcome_review_v1"),
  c8_has_roi_boundary: source.dataset.includes("roi_boundary_v1"),
  c8_has_recorded_roi_ledger: source.dataset.includes("roi_ledger_v1"),
  c8_has_candidate: source.dataset.includes("field_memory_candidate_v1"),
  c8_has_committed_record: source.dataset.includes("field_memory_record_v1"),
  review_only_scope_blocked: source.verifier.includes("FIELD_MEMORY_RECORD_REVIEW_ONLY_SCOPE_BLOCKED"),
  same_field_scope_required: source.verifier.includes("FIELD_MEMORY_RECORD_SCOPE_NOT_SAME_FIELD_ONLY"),
  frozen_runner_invoked_by_verifier: /P(?:29|30)_09_FIELD_MEMORY/.test(source.verifier),
}));

for (const failure of failures) console.error("FAIL " + failure);
if (failures.length) {
  console.error("BLINE_FORMAL_MEMORY_REVIEWED_PROMOTION_PROOF_FAIL count=" + failures.length);
  process.exit(1);
}
console.log("BLINE_FORMAL_MEMORY_REVIEWED_PROMOTION_PROOF_PASS");
