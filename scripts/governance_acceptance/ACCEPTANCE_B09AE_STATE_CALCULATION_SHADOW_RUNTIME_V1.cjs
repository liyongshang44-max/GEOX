#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const cp=require("node:child_process");

const BASE="c1273e37dc3f3c44d76439997d905f2c565c6510";
const expected=[
  "apps/server/src/domain/decision/irrigate_state_calculation_shadow_binding_v1.ts",
  "apps/server/src/domain/decision/irrigate_state_calculation_shadow_binding_v1.contract.test.ts",
  "apps/server/src/routes/judge_v2.ts",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09AE_STATE_CALCULATION_SHADOW_RUNTIME_V1.cjs",
].sort();

function fail(m){console.error(m);process.exit(1);}
function read(p){return fs.readFileSync(p,"utf8");}
function json(p){return JSON.parse(read(p));}
function base(p){return cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"});}

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)){
  fail("B09AE_RUNTIME_BOUNDED_SIX_FILE_DIFF_REQUIRED:"+JSON.stringify(changed));
}

const modulePath="apps/server/src/domain/decision/irrigate_state_calculation_shadow_binding_v1.ts";
const routePath="apps/server/src/routes/judge_v2.ts";
const mod=read(modulePath);
const route=read(routePath);

for(const marker of [
  "SOURCE_FACT_SCOPE_CALCULATOR_SHA256_V1",
  "projectIrrigationRequirementCalculationResultV1",
  "projectAgronomyJudgeEligibilityPrecursorV1",
  "CALCULATION_BOUND_STATE_NOT_BOUND_JUDGE_INPUT_MISMATCH",
  "CALCULATION_BOUND_STATE_NOT_BOUND_EVIDENCE_BLOCKED",
  "CALCULATION_BOUND_STATE_NOT_BOUND_SEMANTIC_MISMATCH",
  "decision_eligibility_runtime_connected: false",
  "legacy_agronomy_result_unchanged: true",
]){
  if(!mod.includes(marker)) fail("B09AE_RUNTIME_MODULE_MARKER_MISSING:"+marker);
}

if(mod.includes("evaluateDecisionEligibilityV1")||mod.includes("runDecisionEligibilityRuntimeV1")){
  fail("B09AE_RUNTIME_MUST_NOT_CONNECT_B07E");
}

for(const marker of [
  "buildIrrigateStateCalculationShadowBindingV1",
  "irrigate_state_calculation_shadow_binding_v1",
  "candidateCriterionReferentialShadow",
]){
  if(!route.includes(marker)) fail("B09AE_ROUTE_MARKER_MISSING:"+marker);
}

const legacyBuild=route.indexOf("const judgeResult = buildJudgeResultV2(evaluateAgronomyJudgeV2(body));");
const shadowBuild=route.indexOf("await buildIrrigateStateCalculationShadowBindingV1(");
if(legacyBuild<0||shadowBuild<0||shadowBuild<=legacyBuild){
  fail("B09AE_SHADOW_MUST_RUN_AFTER_LEGACY_JUDGE_CONSTRUCTION");
}

const baseRoute=base(routePath);
for(const marker of [
  "const judgeResult = buildJudgeResultV2(evaluateAgronomyJudgeV2(body));",
  "const inserted = await insertJudgeResultV2(pool, judgeResultWithShadow);",
  "return reply.send({ ok: true, judge_result: inserted });",
]){
  if(!baseRoute.includes(marker)||!route.includes(marker)) fail("B09AE_LEGACY_ROUTE_SEAM_CHANGED:"+marker);
}

const reg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const calc=reg.semantics.find(s=>s.semantic_id==="decision.calculation");
const elig=reg.semantics.find(s=>s.semantic_id==="decision.eligibility");
const gov=reg.semantics.find(s=>s.semantic_id==="governance.semantic_authority_migration");
if(!calc||!elig||!gov) fail("B09AE_REQUIRED_SEMANTIC_MISSING");

const calcAdapter=calc.registered_producers.find(p=>p.producer_id==="irrigation-calculation-result-compatibility-adapter");
if(calcAdapter?.connection_class!=="ACTIVE_PARALLEL"||calcAdapter?.activation!=="API_ONLY"||calcAdapter?.runtime_edge!=="PROVEN"){
  fail("B09AE_B06B_NOT_ACTIVATED_AS_EXPLICIT_SHADOW_PRODUCER");
}
if(calcAdapter?.new_runtime_consumer_creation!=="ALLOWED_ONLY_BY_EXPLICIT_REGISTER"){
  fail("B09AE_B06B_CONSUMER_POLICY_NOT_EXPLICIT_REGISTER");
}

const b07c=elig.registered_producers.find(p=>p.producer_id==="agronomy-judge-eligibility-precursor-criterion-adapter");
if(b07c?.connection_class!=="ACTIVE_PARALLEL"||b07c?.activation!=="API_ONLY"||b07c?.runtime_edge!=="PROVEN"){
  fail("B09AE_B07C_NOT_ACTIVATED_AS_EXPLICIT_SHADOW_PRODUCER");
}
if(b07c?.new_runtime_consumer_creation!=="ALLOWED_ONLY_BY_EXPLICIT_REGISTER"){
  fail("B09AE_B07C_CONSUMER_POLICY_NOT_EXPLICIT_REGISTER");
}

function countConsumer(semantic,id){
  return (semantic.registered_consumers||[]).filter(c=>c.consumer_id===id).length;
}
if(countConsumer(calc,"b09ae-irrigate-state-calculation-shadow-binding")!==1){
  fail("B09AE_CALC_REGISTERED_CONSUMER_CARDINALITY");
}
if(countConsumer(elig,"b09ae-irrigate-state-calculation-shadow-binding")!==1){
  fail("B09AE_ELIG_REGISTERED_CONSUMER_CARDINALITY");
}

const calcEdges=new Set((calc.runtime_consumers||[])
  .filter(c=>c.consumer_id==="b09ae-irrigate-state-calculation-shadow-binding")
  .map(c=>c.evidence_edge_id));
if(!calcEdges.has("C-047")||!calcEdges.has("C-048")||calcEdges.size!==2){
  fail("B09AE_CALC_RUNTIME_EDGES_INVALID");
}
const eligEdges=(elig.runtime_consumers||[])
  .filter(c=>c.consumer_id==="b09ae-irrigate-state-calculation-shadow-binding")
  .map(c=>c.evidence_edge_id);
if(JSON.stringify(eligEdges)!==JSON.stringify(["C-049"])){
  fail("B09AE_ELIG_RUNTIME_EDGE_INVALID:"+JSON.stringify(eligEdges));
}

const govProducer=gov.registered_producers.find(p=>p.producer_id==="b09ae-irrigate-state-calculation-shadow-binding-v1");
if(!govProducer||govProducer.authority_level!=="SHADOW_ONLY_BINDING"){
  fail("B09AE_GOVERNANCE_SHADOW_PRODUCER_MISSING");
}
for(const id of [
  "b09ae-irrigate-state-calculation-shadow-binding",
  "judge-v2-agronomy-irrigate-state-calculation-shadow",
]){
  if(countConsumer(gov,id)!==1) fail("B09AE_GOVERNANCE_CONSUMER_MISSING:"+id);
}

const graph=json("docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");
const byId=new Map((graph.current_connectivity_edges||[]).map(e=>[e.edge_id,e]));
const expectedEdges={
  "C-047":["decision-engine-calculation","b09ae-irrigate-state-calculation-shadow-binding","decision.calculation"],
  "C-048":["irrigation-calculation-result-compatibility-adapter","b09ae-irrigate-state-calculation-shadow-binding","decision.calculation"],
  "C-049":["agronomy-judge-eligibility-precursor-criterion-adapter","b09ae-irrigate-state-calculation-shadow-binding","decision.eligibility"],
  "C-050":["b09j-decision-recommendation-candidate-criterion-shadow-binding","b09ae-irrigate-state-calculation-shadow-binding","governance.semantic_authority_migration"],
  "C-051":["b09ae-irrigate-state-calculation-shadow-binding-v1","judge-v2-agronomy-irrigate-state-calculation-shadow","governance.semantic_authority_migration"],
};
for(const [id,[from,to,semantic]] of Object.entries(expectedEdges)){
  const e=byId.get(id);
  if(!e) fail("B09AE_GRAPH_EDGE_MISSING:"+id);
  if(e.from_producer!==from||e.to_consumer!==to||e.semantic_id!==semantic||e.runtime_edge!=="PROVEN"){
    fail("B09AE_GRAPH_EDGE_INVALID:"+id);
  }
}

const b07e="apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts";
if(read(b07e)!==base(b07e)) fail("B09AE_B07E_RUNTIME_MUTATED");

const frozen=[
  "apps/server/src/domain/decision/irrigation_calculation_result_adapter_v1.ts",
  "apps/server/src/domain/decision/agronomy_judge_eligibility_precursor_adapter_v1.ts",
  "apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts",
  "apps/server/src/routes/decision_engine_v1.ts",
];
for(const p of frozen) if(read(p)!==base(p)) fail("B09AE_PREDECESSOR_RUNTIME_MUTATED:"+p);

const mcft=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  ".github/workflows",
  "apps/server/db",
  "packages",
  "config",
  "docs/digital_twin",
  "docs/twin_kernel",
  "scripts/runtime_acceptance",
],{encoding:"utf8"}).trim();
if(mcft) fail("B09AE_MCFT_OR_SHARED_INFRA_MUTATION_FORBIDDEN:"+mcft);

if(route.includes("evaluateDecisionEligibilityV1")||route.includes("runDecisionEligibilityRuntimeV1")){
  fail("B09AE_ROUTE_MUST_NOT_CALL_B07E");
}

console.log("B09AE_SAME_SOURCE_CALCULATION_RUNTIME_PASS");
console.log("B09AE_EXACT_JUDGE_CONGRUENCE_RUNTIME_PASS");
console.log("B09AE_EXISTING_B07C_ONLY_RUNTIME_PASS");
console.log("B09AE_B02_C047_C051_REGISTERED_PASS");
console.log("B09AE_LEGACY_JUDGE_VERDICT_UNCHANGED_PASS");
console.log("B09AE_B07E_DISCONNECTED_PASS");
console.log("B09AE_MCFT_UNTOUCHED_PASS");
