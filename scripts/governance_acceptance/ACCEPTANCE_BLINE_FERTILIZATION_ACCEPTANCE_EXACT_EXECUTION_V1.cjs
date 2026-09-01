#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const files = {
  route: "apps/server/src/routes/v1/fertilization.ts",
  service: "apps/server/src/services/fertilization/fertilization_service_v1.ts",
  proof: "apps/server/src/services/fertilization/fertilization_acceptance_exact_execution_v1.ts",
  contract: "docs/contracts/FERTILIZATION_DOMAIN_CONTRACT_V1.md",
  e2e: "scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_FERTILIZATION_E2E_V1.cjs",
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, rel]) => [key, fs.readFileSync(path.join(root, rel), "utf8")]),
);

const failures = [];
function need(key, tokens) {
  for (const token of tokens) if (!source[key].includes(token)) failures.push(`${key.toUpperCase()}_MISSING:${token}`);
}
function forbid(key, tokens) {
  for (const token of tokens) if (source[key].includes(token)) failures.push(`${key.toUpperCase()}_FORBIDDEN:${token}`);
}

need("route", [
  'app.post("/api/v1/fertilization/acceptance/evaluate"',
  "requireFertilizationAcceptanceAuth",
  'requireAoActAnyScopeV0(req, reply, ["acceptance.evaluate"])',
  "service.getPrescription(tenant, fertilizationPrescriptionId)",
  "requireFieldAllowedOr404V1(reply, auth, fieldId)",
]);
need("service", [
  "CALLER_EXECUTION_ASSERTIONS_FORBIDDEN",
  "requireFertilizationAcceptanceExactExecutionV1",
  "as_executed_id",
  "as_applied_id",
  "proof.zone_results",
  "proof.evidence_refs",
  'source: "prescription_contract_v1.acceptance_conditions"',
]);
forbid("service", [
  "const apps = Array.isArray(input.zone_applications)",
  "coverage_percent < 0.9",
  "deviation_percent > 0.15",
]);

need("proof", [
  "fert_bridge_",
  "FROM prescription_contract_v1",
  "FROM as_executed_record_v1",
  "FROM as_applied_map_v1",
  "receipt_refs",
  "fact_id = $4",
  "FERTILIZATION_AS_EXECUTED_NOT_CONFIRMED",
  "FERTILIZATION_AS_EXECUTED_PRESCRIPTION_MISMATCH",
  "FERTILIZATION_AS_APPLIED_AS_EXECUTED_MISMATCH",
  "FERTILIZATION_AS_APPLIED_RECEIPT_MISMATCH",
  "FERTILIZATION_AS_APPLIED_PRESCRIPTION_MISMATCH",
  "FERTILIZATION_RECEIPT_OPERATION_MISMATCH",
  "FERTILIZATION_RECEIPT_TASK_MISMATCH",
  'text(application.mode) !== "VARIABLE_BY_ZONE"',
  "required_coverage_percent",
  "amount_tolerance_percent",
  "coverage < thresholds.required_coverage_percent",
  "deviation > thresholds.amount_tolerance_percent",
  '{ kind: "as_executed_record_v1", ref_id: input.as_executed_id }',
  '{ kind: "as_applied_map_v1", ref_id: input.as_applied_id }',
]);
forbid("proof", [
  "ORDER BY occurred_at DESC",
  "LIMIT 1\n    [input.tenant_id, input.project_id, input.group_id, input.act_task_id]",
]);

need("contract", [
  "caller-supplied zone application assertions ≠ execution evidence",
  "exact receipt -> AsExecuted -> AsApplied identity continuity",
  "exact AsApplied VARIABLE_BY_ZONE evidence",
  "0-100 percent units",
  "fields.write / prescription.write ≠ acceptance.evaluate authority",
]);

need("e2e", [
  "caller_zone_assertions_rejected",
  "wrong_as_applied_identity_rejected",
  "CALLER_EXECUTION_ASSERTIONS_FORBIDDEN",
  "FERTILIZATION_AS_APPLIED_NOT_FOUND",
  "as_executed_id: receiptFlow.as_executed?.as_executed_id",
  "as_applied_id: receiptFlow.as_applied?.as_applied_id",
  "coverage_percent: 97",
  "coverage_percent: 96",
]);
forbid("e2e", [
  "coverage < 0.9",
  "deviation > 0.15",
]);

const stats = {
  failures: failures.length,
  dedicated_acceptance_scope: source.route.includes('requireAoActAnyScopeV0(req, reply, ["acceptance.evaluate"])'),
  caller_zone_authority_removed: !source.service.includes("const apps = Array.isArray(input.zone_applications)"),
  exact_as_executed_required: source.proof.includes("FROM as_executed_record_v1"),
  exact_as_applied_required: source.proof.includes("FROM as_applied_map_v1"),
  receipt_fact_bound_from_as_executed: source.proof.includes("receipt_refs"),
  threshold_policy_bound: source.proof.includes("prescription_contract_v1") && source.proof.includes("acceptance_conditions"),
  percent_units_0_100: source.contract.includes("0-100 percent units"),
};

console.log("BLINE_FERTILIZATION_ACCEPTANCE_EXACT_EXECUTION_STATS", JSON.stringify(stats));
if (failures.length) {
  for (const failure of failures) console.error("FAIL", failure);
  console.error(`BLINE_FERTILIZATION_ACCEPTANCE_EXACT_EXECUTION_FAIL count=${failures.length}`);
  process.exit(1);
}
console.log("BLINE_FERTILIZATION_ACCEPTANCE_EXACT_EXECUTION_PASS");
