#!/usr/bin/env node
const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));
const BASE="39cab94721e73b055770b5c51d7a5073a26a28f6";

const expected=[
  "apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts",
  "apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.contract.test.ts",
  "apps/server/src/routes/judge_v2.ts",
  "docs/architecture/semantic_convergence/GEOX-B09J-DECISION-RECOMMENDATION-CANDIDATE-REFERENTIAL-SHADOW-V1.md",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09J_DECISION_RECOMMENDATION_CANDIDATE_REFERENTIAL_SHADOW_V1.cjs"
].sort();
const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09J_BOUNDED_SEVEN_FILE_DIFF_REQUIRED");

const source=read("apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts");
if(!source.includes('B09J_CANDIDATE_IDENTITY_POLICY_V1 = "SOURCE_FACT_SCOPE_SHA256_V1"')) fail("B09J_IDENTITY_POLICY_MISSING");
if(!source.includes('"candidate_sfsha256_" + digest')) fail("B09J_DETERMINISTIC_CANDIDATE_ID_MISSING");
if(!source.includes("LIMIT 2")) fail("B09J_AMBIGUITY_QUERY_BOUND_MISSING");
if(!source.includes('"SOURCE_AMBIGUOUS"')) fail("B09J_AMBIGUITY_FAIL_CLOSED_MISSING");
if(!source.includes('B09J_DECISION_RECOMMENDATION_SOURCE = "api/v1/recommendations/generate"')) fail("B09J_SOURCE_PRODUCER_BOUNDARY_MISSING");
if(!source.includes("projectLegacyRecommendationCandidateV1(sourcePayload")) fail("B09J_B06C_PROJECTOR_NOT_REUSED");
if(source.includes("candidateDecisionV1Schema.parse(")) fail("B09J_NEW_CANDIDATE_PRODUCER_FORBIDDEN");
if(!source.includes('context_snapshot_ref: null')) fail("B09J_CONTEXT_NULL_BOUNDARY_MISSING");
if(!source.includes('crop_stage_state_ref: null')) fail("B09J_STAGE_NULL_BOUNDARY_MISSING");
if(!source.includes('calculation_result_refs: []')) fail("B09J_CALCULATION_EMPTY_BOUNDARY_MISSING");
if(!source.includes('"EXACT_REF_SET_MATCH"')) fail("B09J_EXACT_REF_CONTINUITY_MISSING");
if(source.includes("runDecisionEligibilityRuntimeV1")) fail("B09J_DECISION_ELIGIBILITY_RUNTIME_CALL_FORBIDDEN");

const route=read("apps/server/src/routes/judge_v2.ts");
if(!route.includes("buildDecisionRecommendationCandidateCriterionShadowBindingV1")) fail("B09J_ROUTE_BINDER_MISSING");
if(!route.includes("decision_recommendation_candidate_criterion_shadow_binding_v1")) fail("B09J_ROUTE_SHADOW_OUTPUT_MISSING");
const legacyBuild=route.indexOf("const judgeResult = buildJudgeResultV2(evaluateAgronomyJudgeV2(body));");
const b09fIdx=route.indexOf("const evidenceDependencyShadow",legacyBuild);
const b09hIdx=route.indexOf("const qualifiedEvidenceCriterionShadow",b09fIdx);
const b09jIdx=route.indexOf("const candidateCriterionReferentialShadow",b09hIdx);
if(!(legacyBuild>=0&&b09fIdx>legacyBuild&&b09hIdx>b09fIdx&&b09jIdx>b09hIdx)) fail("B09J_LEGACY_FIRST_SHADOW_ORDER_INVALID");
if(route.includes("runDecisionEligibilityRuntimeV1")) fail("B09J_ROUTE_B07E_CONNECTION_FORBIDDEN");

const beforeB09h=cp.execFileSync("git",["show",BASE+":apps/server/src/domain/decision/agronomy_qualified_evidence_criterion_shadow_v1.ts"],{encoding:"utf8"});
if(read("apps/server/src/domain/decision/agronomy_qualified_evidence_criterion_shadow_v1.ts")!==beforeB09h) fail("B09J_B09H_CONTRACT_MUTATED");
if(!beforeB09h.includes('candidate_binding_state: z.literal("NOT_BOUND")')||!beforeB09h.includes("candidate_ref: z.null()")) fail("B09J_B09H_ORIGINAL_UNBOUND_CONTRACT_LOST");

if(read("docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json")!==cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"],{encoding:"utf8"})) fail("B09J_REPLACEMENT_READINESS_MUTATED");

const reg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const beforeReg=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const sem=(r,id)=>(r.semantics||[]).find(s=>s.semantic_id===id);
const cand=sem(reg,"decision.candidate"),beforeCand=sem(beforeReg,"decision.candidate");
if(!cand||!beforeCand) fail("B09J_CANDIDATE_REGISTER_MISSING");
if(JSON.stringify(cand.registered_producers.map(p=>p.producer_id))!==JSON.stringify(beforeCand.registered_producers.map(p=>p.producer_id))) fail("B09J_CANDIDATE_PRODUCER_SET_CHANGED");
const c40=(cand.runtime_consumers||[]).find(c=>c.producer_id==="decision-engine-recommendation"&&c.consumer_id==="b09j-decision-recommendation-candidate-criterion-shadow-binding");
const c41=(cand.runtime_consumers||[]).find(c=>c.producer_id==="legacy-recommendation-candidate-compatibility-adapter"&&c.consumer_id==="b09j-decision-recommendation-candidate-criterion-shadow-binding");
if(c40?.evidence_edge_id!=="C-040"||c41?.evidence_edge_id!=="C-041") fail("B09J_CANDIDATE_RUNTIME_REGISTRATION_INVALID");

const gov=sem(reg,"governance.semantic_authority_migration"),beforeGov=sem(beforeReg,"governance.semantic_authority_migration");
const b09f=(gov.registered_producers||[]).find(p=>p.producer_id==="agronomy-evidence-dependency-shadow-binding-v1");
if(b09f?.new_runtime_consumer_creation!=="ALLOWED_ONLY_BY_EXPLICIT_REGISTER") fail("B09J_B09F_EXPLICIT_CONSUMER_POLICY_MISSING");
const govProducer=(gov.registered_producers||[]).find(p=>p.producer_id==="b09j-decision-recommendation-candidate-criterion-shadow-binding");
if(!govProducer||govProducer.authority_level!=="SHADOW_ONLY_BINDING"||govProducer.grandfathered_duplicate!==false) fail("B09J_GOVERNANCE_SHADOW_PRODUCER_INVALID");
const govC42=(gov.runtime_consumers||[]).find(c=>c.evidence_edge_id==="C-042");
const govC44=(gov.runtime_consumers||[]).find(c=>c.evidence_edge_id==="C-044");
if(govC42?.producer_id!=="agronomy-evidence-dependency-shadow-binding-v1"||govC42?.consumer_id!=="b09j-decision-recommendation-candidate-criterion-shadow-binding") fail("B09J_C042_REGISTER_INVALID");
if(govC44?.producer_id!=="b09j-decision-recommendation-candidate-criterion-shadow-binding"||govC44?.consumer_id!=="judge-v2-agronomy-candidate-criterion-referential-shadow") fail("B09J_C044_REGISTER_INVALID");
if((gov.registered_producers||[]).length!==(beforeGov.registered_producers||[]).length+1) fail("B09J_GOVERNANCE_PRODUCER_DELTA_INVALID");

const elig=sem(reg,"decision.eligibility"),beforeElig=sem(beforeReg,"decision.eligibility");
if(JSON.stringify(elig.registered_producers.map(p=>p.producer_id))!==JSON.stringify(beforeElig.registered_producers.map(p=>p.producer_id))) fail("B09J_ELIGIBILITY_PRODUCER_SET_CHANGED");
const b09h=(elig.registered_producers||[]).find(p=>p.producer_id==="agronomy-qualified-evidence-criterion-shadow-v1");
if(b09h?.new_runtime_consumer_creation!=="ALLOWED_ONLY_BY_EXPLICIT_REGISTER") fail("B09J_B09H_EXPLICIT_CONSUMER_POLICY_MISSING");
const eligC43=(elig.runtime_consumers||[]).find(c=>c.evidence_edge_id==="C-043");
if(eligC43?.producer_id!=="agronomy-qualified-evidence-criterion-shadow-v1"||eligC43?.consumer_id!=="b09j-decision-recommendation-candidate-criterion-shadow-binding") fail("B09J_C043_REGISTER_INVALID");

for(const guardId of ["G-B02-15-candidate-decision-instantiation","G-B02-17-decision-eligibility-criterion-instantiation","G-B02-18-decision-eligibility-runtime-consumer"]){
  const a=(reg.static_guards||[]).find(g=>g.guard_id===guardId);
  const b=(beforeReg.static_guards||[]).find(g=>g.guard_id===guardId);
  if(JSON.stringify(a)!==JSON.stringify(b)) fail("B09J_GUARD_MUTATED:"+guardId);
}

const flatten=(r)=>(r.semantics||[]).flatMap(s=>(s.registered_producers||[]).filter(p=>p.grandfathered_duplicate===true).map(p=>({semantic_id:s.semantic_id,...p}))).sort((a,b)=>(a.semantic_id+"::"+a.producer_id).localeCompare(b.semantic_id+"::"+b.producer_id));
const beforeGrand=flatten(beforeReg),afterGrand=flatten(reg);
if(beforeGrand.length!==29||afterGrand.length!==29||JSON.stringify(beforeGrand)!==JSON.stringify(afterGrand)) fail("B09J_GRANDFATHERED_AUTHORITY_MUTATED");

const graph=json("docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");
const beforeGraph=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json"],{encoding:"utf8"}));
const prior=beforeGraph.current_connectivity_edges||[];
const after=graph.current_connectivity_edges||[];
if(after.length!==prior.length+5) fail("B09J_CONNECTIVITY_DELTA_NOT_FIVE");
if(JSON.stringify(after.slice(0,prior.length))!==JSON.stringify(prior)) fail("B09J_PRIOR_CONNECTIVITY_MUTATED");
const expectedEdges=[
  ["C-040","decision.candidate"],
  ["C-041","decision.candidate"],
  ["C-042","governance.semantic_authority_migration"],
  ["C-043","decision.eligibility"],
  ["C-044","governance.semantic_authority_migration"]
];
for(const [id,sid] of expectedEdges){
  const e=after.find(x=>x.edge_id===id);
  if(!e||e.semantic_id!==sid||e.runtime_edge!=="PROVEN"||e.status!=="CURRENT_PROVEN") fail("B09J_EDGE_INVALID:"+id);
  if(!e.evidence?.caller_path||!fs.existsSync(e.evidence.caller_path)) fail("B09J_EDGE_CALLER_PATH_INVALID:"+id);
  if(!e.evidence?.callee_path||!fs.existsSync(e.evidence.callee_path)) fail("B09J_EDGE_CALLEE_PATH_INVALID:"+id);
}
if(JSON.stringify(graph.semantic_edges)!==JSON.stringify(beforeGraph.semantic_edges)) fail("B09J_SEMANTIC_EDGE_AUTHORITY_MUTATED");
if(JSON.stringify(graph.current_parallel_edges)!==JSON.stringify(beforeGraph.current_parallel_edges)) fail("B09J_PARALLEL_AUTHORITY_SET_MUTATED");
if(JSON.stringify(graph.forbidden_edges)!==JSON.stringify(beforeGraph.forbidden_edges)) fail("B09J_FORBIDDEN_EDGE_SET_MUTATED");

console.log("B09J_IDENTITY_POLICY_EXPLICIT_AND_DETERMINISTIC_PASS");
console.log("B09J_B06C_ONLY_CANDIDATE_PROJECTOR_PASS");
console.log("B09J_C040_C044_B02_REGISTERED_CONNECTIVITY_PASS");
console.log("B09J_CANDIDATE_CRITERION_EXACT_EVIDENCE_REF_CONTINUITY_PASS");
console.log("B09J_B09H_ORIGINAL_UNBOUND_B07E_DISCONNECTED_PASS");
console.log("B09J_CANDIDATE_AND_ELIGIBILITY_PRODUCER_SETS_UNCHANGED_PASS");
console.log("B09J_29_GRANDFATHERED_AUTHORITY_UNCHANGED_PASS");
console.log("B09J_GOVERNANCE_ACCEPTANCE_PASS");
