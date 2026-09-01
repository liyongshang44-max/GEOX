const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const files = {
  service: "apps/server/src/services/sampling/sampling_service_v1.ts",
  route: "apps/server/src/routes/v1/sampling.ts",
  projection: "apps/server/src/services/sampling/sampling_projection_v1.ts",
  fertilization: "apps/server/src/services/fertilization/fertilization_service_v1.ts",
  samplingContract: "docs/contracts/SAMPLING_DOMAIN_CONTRACT_V1.md",
  fertilizationContract: "docs/contracts/FERTILIZATION_DOMAIN_CONTRACT_V1.md",
  inventory: "docs/architecture/semantic_convergence/GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json",
  ci: ".github/workflows/ci.yml",
  samplingApi: "scripts/agronomy_acceptance/ACCEPTANCE_SAMPLING_API_V1.cjs",
};

const source = Object.fromEntries(Object.entries(files).map(([k, p]) => [k, fs.readFileSync(path.join(root, p), "utf8")]));
const failures = [];

function need(key, tokens) {
  for (const token of tokens) {
    if (!source[key].includes(token)) failures.push(`${key.toUpperCase()}_MISSING:${token}`);
  }
}
function forbid(key, tokens) {
  for (const token of tokens) {
    if (source[key].includes(token)) failures.push(`${key.toUpperCase()}_FORBIDDEN:${token}`);
  }
}

need("service", [
  "createHash",
  "JSON.stringify(canonicalParts)",
  "deterministicReceiptFactIdV1",
  "sampling_plan_fact_id: string, sample_id: string",
  "findReceiptByFactId",
  "deterministicAcceptanceFactIdV1",
  "const factId = `sp_${plan_id}`",
  "deterministicLabResultFactIdV1",
  "AMBIGUOUS:sample_receipt_v1",
  "AMBIGUOUS:lab_result_import_v1",
  "scope: SamplingScopeV1",
  "sample_receipt_fact_id') = $3",
  "LIMIT 2",
  "DUPLICATE:sample_id",
  "findExistingReceiptForCreateV1",
  "COALESCE(record_json::jsonb->>'sampling_plan_fact_id', '') = ''",
  "AMBIGUOUS:sampling_acceptance_v1",
  "CONFLICT:sampling_acceptance_exact_chain_verdict",
  "idempotent: true",
  "sampling_plan_fact_id",
  "sample_receipt_fact_id",
  "lab_result_fact_id",
  "sampling_plan_fact_id: input.sampling_plan_fact_id",
  "LIMIT 2",
]);
forbid("service", [
  "ORDER BY occurred_at DESC",
  "FIND_FACT_SQL",
]);

need("route", [
  "const planRecord = plan.record_json",
  "sample_receipt_fact_id: receipt.fact_id",
  "body.sample_receipt_fact_id",
  "findReceiptByFactId",
  "lab_result_fact_id: labResult.fact_id",
  "sampling_plan_fact_id: plan.fact_id",
  "MISSING_EXACT:sample_receipt_plan_ref",
  "const plan = await service.findPlanById(receiptPlanId)",
  "sampling_plan_fact_id: plan.fact_id",
  "MISMATCH:sampling_plan_fact_id",
  "MISMATCH:lab_sampling_plan_fact_id",
  "MISMATCH:lab_field_id",
  "tenantMatchesAuth(labRecord, auth)",
  "handleSamplingServiceError",
]);
forbid("route", [
  "findReceiptBySampleId(body.sample_id)",
  "findLabResultBySampleId(body.sample_id, body.import_id)",
]);

need("projection", [
  "AMBIGUOUS_SAMPLING_OPERATION_RELATION",
  "SAMPLING_OPERATION_RELATION_EXACT_PLAN_REF_MISSING",
  "AMBIGUOUS_SAMPLE_RECEIPT_FOR_PLAN",
  "AMBIGUOUS_LAB_RESULT_FOR_SAMPLE",
  "AMBIGUOUS_SAMPLING_ACCEPTANCE_FOR_CHAIN",
  "SAMPLING_EXACT_CHAIN_NOT_ESTABLISHED",
  "customer_visible_eligible: exactChain",
  "receiptJson?.sampling_plan_fact_id === planRow.fact_id",
  "labJson?.sampling_plan_fact_id === planRow.fact_id",
  "record_json::jsonb->>'tenant_id')=$4",
  "record_json::jsonb->>'project_id')=$5",
  "record_json::jsonb->>'group_id')=$6",
  "LIMIT 2",
]);
forbid("projection", [
  "ORDER BY occurred_at DESC",
]);

need("fertilization", [
  "requireExactSamplingChain",
  "MISSING_OR_INVALID:sampling_acceptance_fact_id",
  "loadExactFact(\"sampling_acceptance_v1\", sampling_acceptance_fact_id)",
  "SAMPLING_ACCEPTANCE_EXACT_CHAIN_REQUIRED",
  "SAMPLING_ACCEPTANCE_EXACT_CHAIN_MISMATCH",
  "SAMPLING_RECEIPT_PLAN_FACT_REF_MISMATCH",
  "SAMPLING_LAB_PLAN_FACT_REF_MISMATCH",
  "{ kind: \"sampling_plan_v1\", ref_id: samplingChain.plan.fact_id }",
  "{ kind: \"sample_receipt_v1\", ref_id: samplingChain.receipt.fact_id }",
  "{ kind: \"lab_result_import_v1\", ref_id: samplingChain.lab.fact_id }",
  "{ kind: \"sampling_acceptance_v1\", ref_id: samplingChain.acceptance.fact_id }",
]);
forbid("fertilization", [
  "findSamplingAcceptancePass",
  "private async findLabResult(scope",
]);

need("samplingContract", [
  "sampling_plan_fact_id",
  "sample_receipt_fact_id",
  "lab_result_fact_id",
  "latest-wins",
  "ambiguous receipt/lab/acceptance identity",
  "same exact plan/receipt/lab source chain is idempotent",
]);
need("fertilizationContract", [
  "sampling_acceptance_fact_id",
  "Latest-wins Sampling lookup is forbidden",
]);

need("samplingApi", [
  "concurrent_duplicate_sample_id_serialized",
  "concurrent_acceptance_identity_stable",
  "shared_import_id_is_chain_local",
  "sample_id_reuse_across_plans_allowed",
  "ambiguous_sample_locator_requires_exact_receipt_ref",
  "Promise.all",
  "concurrent acceptance must converge on one fact_id",
  "legacy_receipt_duplicate_blocked_409",
]);

need("ci", [
  "Run Sampling exact-chain scenario release gate",
  "pnpm run ci:scenario:sampling",
  "Run Fertilization Sampling-consumer regression gate",
  "pnpm run ci:scenario:fertilization",
]);

const inventory = JSON.parse(source.inventory);
const byId = new Map((inventory.surfaces || []).map((row) => [row.surface_id, row]));
const res084 = byId.get("RES-084");
const res091 = byId.get("RES-091");
const res288 = byId.get("RES-288");
const res305 = byId.get("RES-305");
const res077 = byId.get("RES-077");

if (!res084 || !String(res084.authority_class || "").includes("EXACT_CHAIN")) failures.push("INVENTORY_RES084_NOT_EXACT");
if (!res091 || !String(res091.authority_class || "").includes("EXACT_CHAIN")) failures.push("INVENTORY_RES091_NOT_EXACT");
if (!res288 || !String(res288.removal_target || "").includes("latest-wins source selection forbidden")) failures.push("INVENTORY_RES288_NOT_CLOSED");
if (!res305 || res305.source_path !== "apps/server/src/services/sampling/sampling_projection_v1.ts") failures.push("INVENTORY_RES305_PROJECTION_MISSING");
if (!res077 || !String(res077.audit_note || "").includes("P0-RES-009 remains independently open")) failures.push("FERTILIZATION_P0_MUST_REMAIN_OPEN");

const stats = {
  failures: failures.length,
  service_latest_selector_absent: !source.service.includes("ORDER BY occurred_at DESC"),
  projection_latest_selector_absent: !source.projection.includes("ORDER BY occurred_at DESC"),
  lab_import_exact_plan_preflight: source.route.includes("MISSING_EXACT:sample_receipt_plan_ref")
    && source.route.includes("const plan = await service.findPlanById(receiptPlanId)")
    && source.route.includes("sampling_plan_fact_id: plan.fact_id"),
  acceptance_exact_refs: ["sampling_plan_fact_id", "sample_receipt_fact_id", "lab_result_fact_id"].every((x) => source.service.includes(x) && source.route.includes(x)),
  acceptance_exact_chain_idempotent: source.service.includes("CONFLICT:sampling_acceptance_exact_chain_verdict") && source.service.includes("idempotent: true"),
  receipt_identity_race_safe: source.service.includes("deterministicReceiptFactIdV1") && source.samplingApi.includes("concurrent_duplicate_sample_id_serialized"),
  legacy_receipt_duplicate_fail_closed: source.service.includes("findExistingReceiptForCreateV1") && source.samplingApi.includes("legacy_receipt_duplicate_blocked_409"),
  acceptance_identity_race_safe: source.service.includes("deterministicAcceptanceFactIdV1") && source.samplingApi.includes("concurrent_acceptance_identity_stable"),
  opaque_business_ids_preserved: source.service.includes("const receipt_id = randomUUID();") && source.service.includes("const acceptance_id = randomUUID();"),
  identity_tuple_canonical_encoding: source.service.includes("JSON.stringify(canonicalParts)") && !source.service.includes('.join("\\n")'),
  lab_identity_chain_scoped: source.service.includes("deterministicLabResultFactIdV1") && !source.service.includes("const fact_id = `sl_${import_id}`"),
  shared_import_runtime_proven: source.samplingApi.includes("shared_import_id_is_chain_local"),
  sample_id_not_global_identity: source.samplingApi.includes("sample_id_reuse_across_plans_allowed") && source.service.includes("input.sampling_plan_fact_id, input.sample_id"),
  ambiguous_sample_locator_requires_exact_ref: source.samplingApi.includes("ambiguous_sample_locator_requires_exact_receipt_ref") && source.route.includes("findReceiptByFactId"),
  lab_scope_continuity_enforced: source.route.includes("tenantMatchesAuth(labRecord, auth)") && source.route.includes("MISMATCH:lab_field_id") && source.projection.includes("record_json::jsonb->>'tenant_id')=$4"),
  plan_fact_continuity: source.projection.includes("SAMPLING_OPERATION_RELATION_EXACT_PLAN_REF_MISSING")
    && source.fertilization.includes("SAMPLING_RECEIPT_PLAN_FACT_REF_MISMATCH")
    && source.fertilization.includes("SAMPLING_LAB_PLAN_FACT_REF_MISMATCH"),
  fertilization_exact_sampling_acceptance: source.fertilization.includes("requireExactSamplingChain"),
  scenario_runtime_wired: source.ci.includes("pnpm run ci:scenario:sampling") && source.ci.includes("pnpm run ci:scenario:fertilization"),
  sampling_projection_registered: Boolean(res305),
  fertilization_acceptance_p0_preserved: Boolean(res077 && String(res077.audit_note || "").includes("P0-RES-009 remains independently open")),
};
console.log("BLINE_SAMPLING_EXACT_BINDING_STATS", JSON.stringify(stats));
if (failures.length) {
  for (const failure of failures) console.error("FAIL", failure);
  console.error(`BLINE_SAMPLING_EXACT_BINDING_FAIL count=${failures.length}`);
  process.exit(1);
}
console.log("BLINE_SAMPLING_EXACT_BINDING_PASS");
