#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const files = {
  contract: "apps/server/src/domain/sampling/sampling_contract_v1.ts",
  service: "apps/server/src/services/sampling/sampling_service_v1.ts",
  route: "apps/server/src/routes/v1/sampling.ts",
  projection: "apps/server/src/services/sampling/sampling_projection_v1.ts",
  fertilization: "apps/server/src/services/fertilization/fertilization_service_v1.ts",
  doc: "docs/architecture/semantic_convergence/GEOX-BLINE-SAMPLING-EXACT-SOURCE-BINDING-V1.md",
};
const src = Object.fromEntries(Object.entries(files).map(([k,p]) => [k, fs.readFileSync(p, "utf8")]));
const failures = [];
const need = (k,tokens) => tokens.forEach((token) => { if (!src[k].includes(token)) failures.push(`${k.toUpperCase()}_MISSING:${token}`); });
const forbid = (k,tokens) => tokens.forEach((token) => { if (src[k].includes(token)) failures.push(`${k.toUpperCase()}_FORBIDDEN:${token}`); });

need("contract", [
  "receipt_id: string",
  "plan_fact_id: string",
  "receipt_fact_id: string",
  "lab_fact_id: string",
]);
need("service", [
  "findFactByIdAndType",
  "receipt_id",
  "plan_fact_id",
  "receipt_fact_id",
  "lab_fact_id",
]);
need("route", [
  'MISSING_OR_INVALID:plan_fact_id',
  'MISSING_OR_INVALID:receipt_fact_id',
  'MISSING_OR_INVALID:lab_fact_id',
  'MISMATCH:plan_fact_id',
  'MISMATCH:receipt_fact_id',
]);
need("projection", [
  "AMBIGUOUS_SAMPLING_PLAN_BINDING",
  "AMBIGUOUS_SAMPLE_RECEIPT_BINDING",
  "AMBIGUOUS_SAMPLING_ACCEPTANCE_BINDING",
  "customer_visible_eligible",
]);
need("fertilization", [
  "SAMPLING_ACCEPTANCE_AMBIGUOUS",
  "plan_fact_id",
  "receipt_fact_id",
  "lab_fact_id",
]);
need("doc", [
  "occurred_at is not source-selection authority",
  "does not define a supersession/current-version policy",
  "P0-RES-009",
]);

forbid("route", [
  "findReceiptBySampleId(",
  "findLabResultBySampleId(",
]);
forbid("projection", [
  "ORDER BY occurred_at DESC",
  "ORDER BY occurred_at DESC\n",
]);
forbid("service", [
  "FIND_FACT_SQL",
  "ORDER BY occurred_at DESC",
]);

const forbiddenFertilizationLatest = /sampling_acceptance_v1[\\s\\S]{0,600}ORDER BY occurred_at DESC[\\s\\S]{0,100}LIMIT 1/;
if (forbiddenFertilizationLatest.test(src.fertilization)) failures.push("FERTILIZATION_LATEST_SAMPLING_ACCEPTANCE_FORBIDDEN");

const samplingAcceptanceSelector = /sampling_acceptance_v1[\\s\\S]{0,700}sample_id[\\s\\S]{0,300}import_id[\\s\\S]{0,300}LIMIT 2/;
if (!samplingAcceptanceSelector.test(src.fertilization)) failures.push("FERTILIZATION_SAMPLING_ACCEPTANCE_LIMIT2_SELECTOR_REQUIRED");
const passPrefilter = /sampling_acceptance_v1[\\s\\S]{0,700}(?:verdict)[\\s\\S]{0,180}PASS[\\s\\S]{0,300}LIMIT 2/;
if (passPrefilter.test(src.fertilization)) failures.push("FERTILIZATION_SAMPLING_ACCEPTANCE_PASS_PREFILTER_FORBIDDEN");

console.log("BLINE_SAMPLING_EXACT_SOURCE_BINDING_STATS " + JSON.stringify({
  failures: failures.length,
  exact_fields_in_contract: ["plan_fact_id","receipt_fact_id","lab_fact_id"].every((x) => src.contract.includes(x)),
  service_latest_sampling_selector_absent: !src.service.includes("ORDER BY occurred_at DESC"),
  projection_latest_sampling_selector_absent: !src.projection.includes("ORDER BY occurred_at DESC"),
  fertilization_ambiguous_acceptance_fail_closed: src.fertilization.includes("SAMPLING_ACCEPTANCE_AMBIGUOUS"),
}));

for (const failure of failures) console.error("FAIL " + failure);
if (failures.length) process.exit(1);
console.log("BLINE_SAMPLING_EXACT_SOURCE_BINDING_PASS");
