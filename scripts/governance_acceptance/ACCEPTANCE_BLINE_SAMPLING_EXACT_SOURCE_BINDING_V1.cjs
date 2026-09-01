const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const files = {
  service: "apps/server/src/services/sampling/sampling_service_v1.ts",
  route: "apps/server/src/routes/v1/sampling.ts",
  projection: "apps/server/src/services/sampling/sampling_projection_v1.ts",
  fertilization: "apps/server/src/services/fertilization/fertilization_service_v1.ts",
  contract: "apps/server/src/domain/sampling/sampling_contract_v1.ts",
  inventory: "docs/architecture/semantic_convergence/GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json",
  active: "docs/architecture/semantic_convergence/GEOX-BLINE-ACTIVE-RUNTIME-SURFACE-DISPOSITION-V1.json",
};

function read(key) {
  return fs.readFileSync(path.join(root, files[key]), "utf8");
}

function requireAll(label, text, tokens) {
  const missing = tokens.filter((token) => !text.includes(token));
  assert.deepEqual(missing, [], `${label} missing required tokens: ${missing.join(", ")}`);
}

(function main() {
  const source = Object.fromEntries(Object.keys(files).map((key) => [key, read(key)]));

  requireAll("sampling service exact identity", source.service, [
    "SAMPLE_RECEIPT_SCOPE_SAMPLE_SHA256_V1",
    "SAMPLING_ACCEPTANCE_EXACT_CHAIN_V1",
    "SAMPLING_SOURCE_AMBIGUOUS",
    "SAMPLE_ID_ALREADY_BOUND",
    "findExactFactByIdAndType",
    "findUniqueFactByTypeAndKey",
    "sampling_plan_fact_id",
    "sample_receipt_fact_id",
    "lab_result_fact_id",
    "LIMIT 2",
  ]);
  assert.equal(source.service.includes("ORDER BY occurred_at DESC"), false, "Sampling service must not use latest-wins ordering");

  requireAll("sampling route exact binding", source.route, [
    "findPlanFactById",
    "findReceiptFactBySampleId",
    "findLabResultFactBySampleId",
    "sampling_plan_fact_id: planRow.fact_id",
    "sample_receipt_fact_id: receiptRow.fact_id",
    "lab_result_fact_id: labRow.fact_id",
    "callSamplingService",
  ]);

  requireAll("sampling projection fail closed", source.projection, [
    "AMBIGUOUS_SAMPLING_OPERATION_RELATION",
    "AMBIGUOUS_SAMPLE_RECEIPT_FOR_PLAN",
    "AMBIGUOUS_SAMPLING_ACCEPTANCE_FOR_PLAN",
    "AMBIGUOUS_LAB_RESULT_FOR_SAMPLE",
    "SAMPLING_ACCEPTANCE_RECEIPT_FACT_MISMATCH",
    "LAB_RESULT_RECEIPT_FACT_MISMATCH",
  ]);
  assert.equal(source.projection.includes("ORDER BY occurred_at DESC"), false, "Sampling projection must not use latest-wins ordering");

  requireAll("fertilization exact Sampling consumer", source.fertilization, [
    "SAMPLING_EXACT_RECEIPT_REF_REQUIRED",
    "SAMPLING_ACCEPTANCE_AMBIGUOUS",
    "lab_result_fact_id",
    "sample_receipt_fact_id",
    "{ kind: \"sample_receipt_v1\", ref_id: sampleReceiptFactId }",
    "{ kind: \"lab_result_import_v1\", ref_id: lab.fact_id }",
    "{ kind: \"sampling_acceptance_v1\", ref_id: samplingAcceptance.fact_id }",
  ]);
  assert.equal(source.fertilization.includes("ORDER BY occurred_at DESC"), false, "Fertilization service must not reintroduce latest-wins source selection");

  requireAll("sampling contract exact refs", source.contract, [
    "SAMPLE_RECEIPT_SCOPE_SAMPLE_SHA256_V1",
    "SAMPLING_ACCEPTANCE_EXACT_CHAIN_V1",
    "sampling_plan_fact_id",
    "sample_receipt_fact_id",
    "lab_result_fact_id",
    "latest-wins source selection is forbidden",
  ]);

  const inventory = JSON.parse(source.inventory);
  const byId = new Map((inventory.surfaces || []).map((row) => [row.surface_id, row]));
  assert.equal(byId.get("RES-084")?.authority_class, "SAMPLING_EXACT_SOURCE_CHAIN_AUTHORITY_SERVICE");
  assert.equal(byId.get("RES-091")?.authority_class, "ACTIVE_SAMPLING_EXACT_SOURCE_BINDING_ROUTE");
  assert.equal(byId.get("RES-305")?.source_path, "apps/server/src/services/sampling/sampling_projection_v1.ts");
  assert.equal(byId.get("RES-305")?.authority_class, "SAMPLING_EXACT_CHAIN_REPORT_PROJECTION_FAIL_CLOSED");

  const active = JSON.parse(source.active);
  const ars = (active.surfaces || []).find((row) => row.surface_id === "ARS-125");
  assert.ok(ars, "ARS-125 missing");
  assert.equal(String(ars.sunset_condition || "").includes("LATEST-WINS CLOSED"), true, "ARS-125 must record latest-wins closure");

  console.log(JSON.stringify({
    ok: true,
    gate: "BLINE_SAMPLING_EXACT_SOURCE_BINDING_V1",
    checks: {
      sampling_service_latest_wins_absent: true,
      route_exact_fact_binding: true,
      report_projection_ambiguity_fail_closed: true,
      fertilization_exact_sampling_consumer: true,
      residual_projection_surface_registered: true,
    },
  }));
})();
