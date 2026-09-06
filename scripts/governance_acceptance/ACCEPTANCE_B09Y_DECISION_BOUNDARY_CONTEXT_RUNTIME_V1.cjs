#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const cp=require("node:child_process");

const BASE="adc04f715b8e0c2f4b0ce8da37853f1bca13baa3";
const expected=[
  "apps/server/src/context/field_program_context_projection_v1.ts",
  "apps/server/src/domain/decision/candidate_decision_boundary_context_binding_v1.contract.test.ts",
  "apps/server/src/domain/decision/candidate_decision_boundary_context_binding_v1.ts",
  "apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts",
  "apps/server/src/routes/judge_v2.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09Y_DECISION_BOUNDARY_CONTEXT_RUNTIME_V1.cjs",
].sort();

function fail(m){console.error(m);process.exit(1);}
function read(p){return fs.readFileSync(p,"utf8");}
function json(p){return JSON.parse(read(p));}
function base(p){return cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"});}

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)){
  fail("B09Y_RUNTIME_BOUNDED_EIGHT_FILE_DIFF_REQUIRED:"+JSON.stringify(changed));
}

const modulePath="apps/server/src/domain/decision/candidate_decision_boundary_context_binding_v1.ts";
const candidatePath="apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts";
const contextPath="apps/server/src/context/field_program_context_projection_v1.ts";
const routePath="apps/server/src/routes/judge_v2.ts";
const mod=read(modulePath);
const candidate=read(candidatePath);
const context=read(contextPath);
const route=read(routePath);

for(const marker of [
  "canonical_decision_boundary_envelope_v1",
  "BOUNDARY_ONLY",
  "server_created: z.literal(true)",
  "caller_supplied_decision_time: z.literal(false)",
  "EXACT_IMMUTABLE_REFS_OR_SAME_DECISION_TIME_AS_OF_ONLY",
  "pg_advisory_xact_lock(hashtext($1))",
  "field_program_fact_id",
  "context_snapshot_fact_ref",
  "forecast_refs: []",
]){
  if(!mod.includes(marker)) fail("B09Y_MODULE_MARKER_MISSING:"+marker);
}

if(mod.includes("ORDER BY occurred_at DESC")||mod.includes("loadLatestProgram")){
  fail("B09Y_LATEST_PROGRAM_READER_FORBIDDEN");
}
if(mod.includes("evaluateDecisionEligibilityV1")||mod.includes("runDecisionEligibilityRuntimeV1")){
  fail("B09Y_MUST_NOT_CONNECT_B07E");
}
if(mod.includes("getLatestWeatherForecastIndexV1")||mod.includes("mcft")){
  fail("B09Y_MUST_NOT_BIND_FORECAST_OR_MCFT");
}

for(const marker of [
  "source_ref?: string | null",
  "snapshot_id?: string | null",
  "explicitSourceRef",
]){
  if(!context.includes(marker)) fail("B09Y_B05B_EXACT_PROVENANCE_OVERRIDE_MISSING:"+marker);
}
for(const legacyMarker of [
  "FIELD_PROGRAM_COMPATIBILITY_SOURCE",
  "B05B_FIELD_PROGRAM_COMPATIBILITY_PROJECTION",
]){
  if(!context.includes(legacyMarker)||!base(contextPath).includes(legacyMarker)){
    fail("B09Y_B05B_DEFAULT_SEMANTICS_CHANGED:"+legacyMarker);
  }
}

for(const marker of [
  "expected_source_fact_id?: string | null",
  "context_snapshot_ref?: string | null",
  "decision_time?: string | null",
  "B09J_BOUNDARY_EXPECTED_SOURCE_FACT_ID_MISMATCH",
  "WHERE fact_id = $1",
]){
  if(!candidate.includes(marker)) fail("B09Y_B09J_BOUNDARY_SEAM_MISSING:"+marker);
}
if(!candidate.includes("context_snapshot_ref: text(input.context_snapshot_ref) || null")){
  fail("B09Y_B09J_CONTEXT_NOT_PROPAGATED");
}
if(!candidate.includes("decision_time: text(input.decision_time) || null")){
  fail("B09Y_B09J_DECISION_TIME_NOT_PROPAGATED");
}

for(const marker of [
  "field_program_fact_id: z.string().min(1).optional()",
  "buildCandidateDecisionBoundaryContextBindingV1",
  "boundaryBoundCandidateInput",
  "expected_source_fact_id",
  "candidate_decision_boundary_context_binding_v1",
  "buildIrrigateStateCalculationShadowBindingV1",
]){
  if(!route.includes(marker)) fail("B09Y_ROUTE_MARKER_MISSING:"+marker);
}

if(route.includes("decision_time: z.")){
  fail("B09Y_CALLER_SUPPLIED_DECISION_TIME_ROUTE_FIELD_FORBIDDEN");
}

const boundaryIdx=route.indexOf("await buildCandidateDecisionBoundaryContextBindingV1(");
const candidateIdx=route.indexOf("await buildDecisionRecommendationCandidateCriterionShadowBindingV1(");
const calcIdx=route.indexOf("await buildIrrigateStateCalculationShadowBindingV1(");
if(!(boundaryIdx>=0&&candidateIdx>boundaryIdx&&calcIdx>candidateIdx)){
  fail("B09Y_ROUTE_ORDER_MUST_BE_BOUNDARY_THEN_CANDIDATE_THEN_CALCULATION");
}

const baseRoute=base(routePath);
for(const marker of [
  "const judgeResult = buildJudgeResultV2(evaluateAgronomyJudgeV2(body));",
  "const inserted = await insertJudgeResultV2(pool, judgeResultWithShadow);",
  "return reply.send({ ok: true, judge_result: inserted });",
]){
  if(!baseRoute.includes(marker)||!route.includes(marker)) fail("B09Y_LEGACY_JUDGE_ROUTE_SEAM_CHANGED:"+marker);
}

const reg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const ctx=reg.semantics.find(s=>s.semantic_id==="context.declared_identity");
const cand=reg.semantics.find(s=>s.semantic_id==="decision.candidate");
const gov=reg.semantics.find(s=>s.semantic_id==="governance.semantic_authority_migration");
if(!ctx||!cand||!gov) fail("B09Y_REQUIRED_SEMANTIC_MISSING");

const projector=ctx.registered_producers.find(p=>p.producer_id==="field-program-context-compatibility-projector");
if(projector?.connection_class!=="ACTIVE_PARALLEL"||projector?.activation!=="API_ONLY"||projector?.runtime_edge!=="PROVEN"){
  fail("B09Y_B05B_NOT_EXPLICITLY_ACTIVATED");
}
const ctxRuntime=(ctx.runtime_consumers||[]).filter(c=>c.consumer_id==="b09y-candidate-decision-boundary-context-binding");
if(ctxRuntime.length!==1||ctxRuntime[0].evidence_edge_id!=="C-052"){
  fail("B09Y_CONTEXT_RUNTIME_EDGE_INVALID");
}
const candRuntime=(cand.runtime_consumers||[]).filter(c=>c.consumer_id==="b09y-candidate-decision-boundary-context-binding");
if(candRuntime.length!==1||candRuntime[0].evidence_edge_id!=="C-053"){
  fail("B09Y_CANDIDATE_SOURCE_RUNTIME_EDGE_INVALID");
}
const govProducer=gov.registered_producers.find(p=>p.producer_id==="b09y-candidate-decision-boundary-context-binding-v1");
if(!govProducer||govProducer.authority_level!=="BOUNDARY_ONLY_SHADOW_BINDING"){
  fail("B09Y_GOVERNANCE_BOUNDARY_PRODUCER_INVALID");
}

const graph=json("docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");
const byId=new Map((graph.current_connectivity_edges||[]).map(e=>[e.edge_id,e]));
const expectedEdges={
  "C-052":["field-program-context-compatibility-projector","b09y-candidate-decision-boundary-context-binding","context.declared_identity"],
  "C-053":["decision-engine-recommendation","b09y-candidate-decision-boundary-context-binding","decision.candidate"],
  "C-054":["b09y-candidate-decision-boundary-context-binding-v1","b09j-decision-recommendation-candidate-criterion-shadow-binding","governance.semantic_authority_migration"],
  "C-055":["b09y-candidate-decision-boundary-context-binding-v1","judge-v2-agronomy-boundary-context-shadow","governance.semantic_authority_migration"],
};
for(const [id,[from,to,semantic]] of Object.entries(expectedEdges)){
  const e=byId.get(id);
  if(!e) fail("B09Y_GRAPH_EDGE_MISSING:"+id);
  if(e.from_producer!==from||e.to_consumer!==to||e.semantic_id!==semantic||e.runtime_edge!=="PROVEN"){
    fail("B09Y_GRAPH_EDGE_INVALID:"+id);
  }
}

for(const p of [
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_selector_v1.ts",
  "apps/server/src/domain/decision/irrigate_state_calculation_shadow_binding_v1.ts",
  "apps/server/src/routes/decision_engine_v1.ts",
]){
  if(read(p)!==base(p)) fail("B09Y_FROZEN_PREDECESSOR_MUTATED:"+p);
}

const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  ".github/workflows",
  "apps/server/db",
  "packages",
  "config",
  "docs/digital_twin",
  "docs/twin_kernel",
  "scripts/runtime_acceptance",
  "apps/server/src/domain/approval",
  "apps/server/src/domain/controlplane",
],{encoding:"utf8"}).trim();
if(forbidden) fail("B09Y_MCFT_APPROVAL_OR_SHARED_INFRA_MUTATION_FORBIDDEN:"+forbidden);

console.log("B09Y_SERVER_CREATED_BOUNDARY_PASS");
console.log("B09Y_EXACT_FIELD_PROGRAM_CONTEXT_PASS");
console.log("B09Y_BOUNDARY_BEFORE_BOUND_CANDIDATE_PASS");
console.log("B09Y_B09J_DECISION_TIME_CONTEXT_PROPAGATION_PASS");
console.log("B09Y_B09AE_SAME_BOUNDARY_ORDER_PASS");
console.log("B09Y_B07E_DISCONNECTED_PASS");
console.log("B09Y_FORECAST_MCFT_FROZEN_PASS");
console.log("B09Y_LEGACY_JUDGE_UNCHANGED_PASS");
