#!/usr/bin/env node
const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));

const impl=read("apps/server/src/domain/decision/agronomy_qualified_evidence_criterion_shadow_v1.ts");
if(!impl.includes("decisionEligibilityCriterionAssessmentV1Schema.parse")) fail("B09H_CRITERION_SCHEMA_NOT_USED");
if(!impl.includes('criterion: "QUALIFIED_EVIDENCE"')) fail("B09H_WRONG_CRITERION");
if(!impl.includes('candidate_binding_state: "NOT_BOUND"')) fail("B09H_CANDIDATE_NOT_EXPLICITLY_UNBOUND");
if(!impl.includes("decision_eligibility_runtime_connected: false")) fail("B09H_RUNTIME_CONNECTION_OPENED");
if(impl.includes("runDecisionEligibilityRuntimeV1")) fail("B09H_DECISION_ELIGIBILITY_RUNTIME_FORBIDDEN");
if(impl.includes("evaluateDecisionEligibilityV1")) fail("B09H_FINAL_EVALUATOR_FORBIDDEN");

const route=read("apps/server/src/routes/judge_v2.ts");
if(!route.includes("projectAgronomyQualifiedEvidenceCriterionShadowV1(evidenceDependencyShadow)")) fail("B09H_ROUTE_SHADOW_ATTACHMENT_MISSING");
if(!route.includes("agronomy_qualified_evidence_criterion_shadow_v1: qualifiedEvidenceCriterionShadow")) fail("B09H_ROUTE_PERSISTENCE_MISSING");

const reg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const guard=(reg.static_guards||[]).find(g=>g.guard_id==="G-B02-17-decision-eligibility-criterion-instantiation");
const expected=[
  "apps/server/src/domain/decision/stage1_eligibility_precursor_adapter_v1.ts",
  "apps/server/src/domain/decision/agronomy_judge_eligibility_precursor_adapter_v1.ts",
  "apps/server/src/domain/decision/agronomy_qualified_evidence_criterion_shadow_v1.ts"
];
if(!guard||JSON.stringify(guard.registered_paths)!==JSON.stringify(expected)) fail("B09H_CRITERION_PRODUCER_SET_INVALID");

const elig=(reg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
const prod=(elig?.registered_producers||[]).find(p=>p.producer_id==="agronomy-qualified-evidence-criterion-shadow-v1");
if(!prod||prod.authority_level!=="SHADOW_ONLY_ELIGIBILITY_CRITERION"||prod.grandfathered_duplicate!==false) fail("B09H_PRODUCER_CLASSIFICATION_INVALID");

const graph=json("docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");
for(const id of ["C-038","C-039"]){
  const edge=(graph.current_connectivity_edges||[]).find(e=>e.edge_id===id);
  if(!edge||edge.runtime_edge!=="PROVEN"||edge.status!=="CURRENT_PROVEN") fail("B09H_EDGE_INVALID:"+id);
}
const beforeGraph=JSON.parse(cp.execFileSync("git",["show","1abb9c2fa818efb455c43da93e4efeadd492e199:docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json"],{encoding:"utf8"}));
if(JSON.stringify(beforeGraph.current_parallel_edges)!==JSON.stringify(graph.current_parallel_edges)) fail("B09H_PARALLEL_AUTHORITY_EDGES_CHANGED");
const beforeConnectivity=beforeGraph.current_connectivity_edges||[];
const afterConnectivity=graph.current_connectivity_edges||[];
if(afterConnectivity.length!==beforeConnectivity.length+2) fail("B09H_UNEXPECTED_CONNECTIVITY_DELTA");
if(JSON.stringify(afterConnectivity.slice(0,beforeConnectivity.length))!==JSON.stringify(beforeConnectivity)) fail("B09H_EXISTING_CONNECTIVITY_MUTATED");

const readiness=json("docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json");
if(readiness.authority_removal_performed!==false) fail("B09H_AUTHORITY_REMOVAL_PERFORMED");
const family=(readiness.families||[]).find(x=>x.semantic_id==="evidence.qualification");
if(!family||family.consumer_migration_state!=="PARTIAL"||family.authority_removal_state!=="PENDING_CONSUMER_MIGRATION") fail("B09H_READINESS_CHANGED");

const beforeReg=JSON.parse(cp.execFileSync("git",["show","1abb9c2fa818efb455c43da93e4efeadd492e199:docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const flatten=(r)=>(r.semantics||[]).flatMap(s=>(s.registered_producers||[]).filter(p=>p.grandfathered_duplicate===true).map(p=>({semantic_id:s.semantic_id,...p}))).sort((a,b)=>(a.semantic_id+"::"+a.producer_id).localeCompare(b.semantic_id+"::"+b.producer_id));
const b=flatten(beforeReg),a=flatten(reg);
if(b.length!==29||a.length!==29||JSON.stringify(b)!==JSON.stringify(a)) fail("B09H_GRANDFATHERED_AUTHORITY_MUTATED");

console.log("B09H_SHADOW_CRITERION_REGISTERED_PASS");
console.log("B09H_CANDIDATE_UNBOUND_RUNTIME_DISCONNECTED_PASS");
console.log("B09H_CONNECTIVITY_PLUS_TWO_PARALLEL_AUTHORITY_UNCHANGED_PASS");
console.log("B09H_ZERO_CONSUMER_MIGRATION_ZERO_AUTHORITY_REMOVAL_PASS");
console.log("B09H_GOVERNANCE_ACCEPTANCE_PASS");
