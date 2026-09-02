#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const files={
 route:"apps/server/src/routes/v1/fertilization.ts",
 service:"apps/server/src/services/fertilization/fertilization_service_v1.ts",
 contract:"apps/server/src/domain/fertilization/fertilization_contract_v1.ts",
 doc:"docs/architecture/semantic_convergence/GEOX-BLINE-FERTILIZATION-EXECUTION-PROVENANCE-V1.md"
};
const src=Object.fromEntries(Object.entries(files).map(([k,p])=>[k,fs.readFileSync(p,"utf8")]));
const failures=[];
const need=(k,tokens)=>tokens.forEach(t=>{if(!src[k].includes(t)) failures.push(`${k.toUpperCase()}_MISSING:${t}`)});
const forbid=(k,tokens)=>tokens.forEach(t=>{if(src[k].includes(t)) failures.push(`${k.toUpperCase()}_FORBIDDEN:${t}`)});

need("route",[
  'requireFertilizationAcceptanceAuth',
  'requireAoActScopeV0(req, reply, "acceptance.evaluate")',
  'ACCEPTANCE_EVALUATE_ROLE_DENIED'
]);
need("service",[
  'receipt_fact_id',
  'as_executed_id',
  'as_applied_id',
  'acceptance_result_fact_id',
  'CALLER_ZONE_APPLICATIONS_FORBIDDEN',
  'loadExactExecutionProvenance',
  'CANONICAL_ACCEPTANCE_PASS_REQUIRED',
  'as_applied_map_v1',
  'as_executed_record_v1',
  'acceptance_result_v1',
  'fert_bridge_'
]);
need("contract",[
  'fertilization_prescription_fact_id',
  'variable_prescription_id',
  'receipt_fact_id',
  'as_executed_id',
  'as_applied_id',
  'acceptance_result_fact_id'
]);
need("doc",[
  'caller-supplied execution evidence must not determine the verdict',
  'formal_execution_passed = true',
  'fields.write',
  'prescription.write'
]);

const evalStart=src.service.indexOf("async evaluateAcceptance(");
const evalBlock=evalStart>=0?src.service.slice(evalStart):"";
if(evalStart<0) failures.push("SERVICE_EVALUATE_ACCEPTANCE_MISSING");
if(evalBlock.includes("Array.isArray(input.zone_applications)")) failures.push("CALLER_ZONE_APPLICATIONS_AUTHORITY_FORBIDDEN");
if(evalBlock.includes("input.receipt_status")) failures.push("CALLER_RECEIPT_STATUS_AUTHORITY_FORBIDDEN");

const routeStart=src.route.indexOf('app.post("/api/v1/fertilization/acceptance/evaluate"');
const routeEnd=routeStart>=0?src.route.indexOf('app.get("/api/v1/fertilization/assessment',routeStart):-1;
const routeBlock=routeStart>=0?src.route.slice(routeStart,routeEnd>=0?routeEnd:undefined):"";
if(routeBlock.includes("requireFertilizationWriteAuth")) failures.push("FERTILIZATION_ACCEPTANCE_GENERIC_WRITE_AUTH_FORBIDDEN");

console.log("BLINE_FERTILIZATION_EXECUTION_PROVENANCE_STATS "+JSON.stringify({
 failures:failures.length,
 exact_ids:["receipt_fact_id","as_executed_id","as_applied_id","acceptance_result_fact_id"].every(x=>src.service.includes(x)),
 caller_zone_authority_absent:!evalBlock.includes("Array.isArray(input.zone_applications)"),
 dedicated_acceptance_auth:routeBlock.includes("requireFertilizationAcceptanceAuth")
}));
for(const f of failures) console.error("FAIL "+f);
if(failures.length) process.exit(1);
console.log("BLINE_FERTILIZATION_EXECUTION_PROVENANCE_PASS");
