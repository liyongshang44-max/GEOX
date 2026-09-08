#!/usr/bin/env node
const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));
const BASE="8acb1b9e39f84a498e0a794cae0837537a452383";

const expectedFiles=[
  "docs/architecture/semantic_convergence/GEOX-B09I-CANDIDATE-PROVENANCE-READINESS-INVENTORY-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09I-CANDIDATE-PROVENANCE-READINESS-INVENTORY-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09I_CANDIDATE_PROVENANCE_READINESS_INVENTORY_V1.cjs"
].sort();

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expectedFiles)) fail("B09I_BOUNDED_FOUR_FILE_DIFF_REQUIRED");

const inv=json("docs/architecture/semantic_convergence/GEOX-B09I-CANDIDATE-PROVENANCE-READINESS-INVENTORY-V1.json");
if(inv.schema_version!=="b09i_candidate_provenance_readiness_inventory_v1") fail("B09I_INVENTORY_SCHEMA_INVALID");
if(inv.status!=="ANALYSIS_ONLY_NOT_READY_FOR_CANDIDATE_BINDING") fail("B09I_STATUS_INVALID");
if(inv.stacked_base_product_head!==BASE) fail("B09I_BASE_HEAD_MISMATCH");
if(inv.runtime_corpus?.run_id!==33163943525) fail("B09I_CORPUS_RUN_MISMATCH");
if(inv.runtime_corpus?.job_id!==98824762777) fail("B09I_CORPUS_JOB_MISMATCH");
if(inv.runtime_corpus?.validation_head!=="78e925914a174407446db870637ee6706ca440f7") fail("B09I_VALIDATION_HEAD_MISMATCH");
if(inv.runtime_corpus?.artifact_id!==9682819929) fail("B09I_ARTIFACT_ID_MISMATCH");
if(inv.runtime_corpus?.artifact_digest!=="sha256:693df9ff04e32ea07656963c14eb715af44063d35d50dcc503197071ac5ea9d9") fail("B09I_ARTIFACT_DIGEST_MISMATCH");
if(inv.runtime_corpus?.observation_scope_class!=="SYNTHETIC_ACCEPTANCE_RUNTIME") fail("B09I_SCOPE_CLASS_MISMATCH");
if(inv.runtime_corpus?.source_fact_observation?.type!=="decision_recommendation_v1") fail("B09I_SOURCE_TYPE_INVALID");
if(inv.runtime_corpus?.source_fact_observation?.has_candidate_id!==false) fail("B09I_SOURCE_ALREADY_HAS_CANDIDATE_ID");
if(inv.runtime_corpus?.candidate_persistence_observation?.candidate_decision_fact_count!==0) fail("B09I_UNEXPECTED_CANDIDATE_FACT");
if(inv.runtime_corpus?.candidate_persistence_observation?.candidate_decision_table_exists!==false) fail("B09I_UNEXPECTED_CANDIDATE_TABLE");
if(inv.runtime_corpus?.candidate_persistence_observation?.candidate_decision_index_exists!==false) fail("B09I_UNEXPECTED_CANDIDATE_INDEX");

const proj=inv.b06c_projection_context_readiness||{};
if(proj.candidate_id?.state!=="UNRESOLVED") fail("B09I_CANDIDATE_ID_NOT_UNRESOLVED");
if(proj.source_ref?.state!=="RESOLVABLE"||proj.source_ref?.basis!=="IMMUTABLE_FACT_ID") fail("B09I_SOURCE_REF_NOT_RESOLVABLE");
if(proj.scope?.state!=="RESOLVABLE") fail("B09I_SCOPE_NOT_RESOLVABLE");
if(proj.context_snapshot_ref?.contract_shape!=="NULLABLE") fail("B09I_CONTEXT_NULLABILITY_LOST");
if(proj.crop_stage_state_ref?.contract_shape!=="NULLABLE") fail("B09I_STAGE_NULLABILITY_LOST");
if(proj.decision_time?.contract_shape!=="NULLABLE") fail("B09I_DECISION_TIME_NULLABILITY_LOST");

const forbidden=new Map((inv.prohibited_promotions||[]).map(x=>[x.source,x.forbidden_target]));
for(const [source,target] of [
  ["recommendation_id","candidate_id"],
  ["fact_id","candidate_id"],
  ["evidence_refs","evidence_qualification_refs"],
  ["snapshot_id","context_snapshot_ref"],
  ["crop_stage","crop_stage_state_ref"],
  ["created_ts","created_at"]
]){
  if(forbidden.get(source)!==target) fail("B09I_PROHIBITED_PROMOTION_MISSING:"+source);
}

const binding=inv.referential_binding_readiness||{};
if(binding.b09h_candidate_binding_state!=="NOT_BOUND") fail("B09I_B09H_BINDING_STATE_CHANGED");
if(binding.b09h_candidate_ref!==null) fail("B09I_B09H_CANDIDATE_REF_BOUND");
if(binding.b09h_decision_eligibility_runtime_connected!==false) fail("B09I_B09H_RUNTIME_CONNECTED");
if(binding.proven_join_from_analyzed_recommendation_to_b09h_agronomy_shadow!==false) fail("B09I_UNPROVEN_JOIN_PROMOTED");
if(binding.ready_for_candidate_projection_runtime_binding!==false) fail("B09I_CANDIDATE_RUNTIME_PREMATURELY_READY");
if(binding.ready_for_decision_eligibility_runtime_binding!==false) fail("B09I_ELIGIBILITY_RUNTIME_PREMATURELY_READY");

const migration=inv.migration_state||{};
for(const key of ["candidate_projection_runtime_connected","decision_eligibility_runtime_connected","consumer_migration_performed","legacy_authority_removed","authority_removal_permitted"]){
  if(migration[key]!==false) fail("B09I_FORBIDDEN_MIGRATION_STATE:"+key);
}

const b06c=read("apps/server/src/domain/decision/legacy_recommendation_candidate_adapter_v1.ts");
if(!b06c.includes("candidate_id: string;")) fail("B09I_B06C_CANDIDATE_ID_REQUIREMENT_MISSING");
if(!b06c.includes("source_ref: string;")) fail("B09I_B06C_SOURCE_REF_REQUIREMENT_MISSING");
if(!b06c.includes("LEGACY_EVIDENCE_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION")) fail("B09I_B06C_EVIDENCE_PROMOTION_GUARD_MISSING");
if(!b06c.includes("LEGACY_CREATED_TS_NOT_USED_AS_CANONICAL_CREATED_AT")) fail("B09I_B06C_CREATED_TS_PROMOTION_GUARD_MISSING");

const b09h=read("apps/server/src/domain/decision/agronomy_qualified_evidence_criterion_shadow_v1.ts");
if(!b09h.includes('candidate_binding_state: z.literal("NOT_BOUND")')) fail("B09I_B09H_NOT_BOUND_CONTRACT_MISSING");
if(!b09h.includes("candidate_ref: z.null()")) fail("B09I_B09H_NULL_CANDIDATE_REF_MISSING");
if(!b09h.includes("decision_eligibility_runtime_connected: z.literal(false)")) fail("B09I_B09H_RUNTIME_DISCONNECT_MISSING");
if(b09h.includes("runDecisionEligibilityRuntimeV1")) fail("B09I_B09H_RUNTIME_CONNECTION_OPENED");

const b07e=read("apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts");
if(!b07e.includes('"candidate_decision_v1:" + candidate.candidate_id')) fail("B09I_B07E_CANDIDATE_REF_BASIS_CHANGED");
if(!b07e.includes("assertCandidateEvidenceContinuity")) fail("B09I_B07E_EVIDENCE_CONTINUITY_MISSING");
if(!b07e.includes("assertCriterionSupportRefsAuthorized")) fail("B09I_B07E_SUPPORT_REF_AUTHORIZATION_MISSING");

const graph=json("docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");
const beforeGraph=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json"],{encoding:"utf8"}));
if(JSON.stringify(graph)!==JSON.stringify(beforeGraph)) fail("B09I_PARALLEL_AUTHORITY_GRAPH_MUTATED");

const readiness=json("docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json");
const beforeReadiness=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"],{encoding:"utf8"}));
if(JSON.stringify(readiness)!==JSON.stringify(beforeReadiness)) fail("B09I_REPLACEMENT_READINESS_MUTATED");
if(readiness.authority_removal_performed!==false) fail("B09I_AUTHORITY_REMOVAL_PERFORMED");

const reg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const beforeReg=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const afterCand=(reg.semantics||[]).find(s=>s.semantic_id==="decision.candidate");
const beforeCand=(beforeReg.semantics||[]).find(s=>s.semantic_id==="decision.candidate");
if(!afterCand||!beforeCand) fail("B09I_CANDIDATE_REGISTER_MISSING");
if((afterCand.notes||[]).length!==(beforeCand.notes||[]).length+2) fail("B09I_REGISTER_NOTE_DELTA_INVALID");
if(JSON.stringify(afterCand.registered_producers)!==JSON.stringify(beforeCand.registered_producers)) fail("B09I_CANDIDATE_PRODUCERS_MUTATED");
if(JSON.stringify(afterCand.registered_consumers)!==JSON.stringify(beforeCand.registered_consumers)) fail("B09I_CANDIDATE_CONSUMERS_MUTATED");
if(JSON.stringify(afterCand.runtime_consumers)!==JSON.stringify(beforeCand.runtime_consumers)) fail("B09I_CANDIDATE_RUNTIME_CONSUMERS_MUTATED");

const normalizedReg=JSON.parse(JSON.stringify(reg));
const normalizedCand=(normalizedReg.semantics||[]).find(s=>s.semantic_id==="decision.candidate");
normalizedCand.notes=beforeCand.notes;
if(JSON.stringify(normalizedReg)!==JSON.stringify(beforeReg)) fail("B09I_REGISTER_CHANGED_BEYOND_TWO_NOTES");

const flatten=(r)=>(r.semantics||[]).flatMap(s=>(s.registered_producers||[]).filter(p=>p.grandfathered_duplicate===true).map(p=>({semantic_id:s.semantic_id,...p}))).sort((a,b)=>(a.semantic_id+"::"+a.producer_id).localeCompare(b.semantic_id+"::"+b.producer_id));
const beforeGrandfathered=flatten(beforeReg),afterGrandfathered=flatten(reg);
if(beforeGrandfathered.length!==29||afterGrandfathered.length!==29||JSON.stringify(beforeGrandfathered)!==JSON.stringify(afterGrandfathered)) fail("B09I_GRANDFATHERED_AUTHORITY_MUTATED");

for(const guardId of ["G-B02-15-candidate-decision-instantiation","G-B02-17-decision-eligibility-criterion-instantiation","G-B02-18-decision-eligibility-runtime-consumer"]){
  const a=(reg.static_guards||[]).find(g=>g.guard_id===guardId);
  const b=(beforeReg.static_guards||[]).find(g=>g.guard_id===guardId);
  if(!a||!b||JSON.stringify(a)!==JSON.stringify(b)) fail("B09I_GUARD_MUTATED:"+guardId);
}

console.log("B09I_RUNTIME_CORPUS_IDENTITY_LOCK_PASS");
console.log("B09I_CANDIDATE_IDENTITY_NOT_INVENTED_PASS");
console.log("B09I_B09H_CANDIDATE_UNBOUND_B07E_DISCONNECTED_PASS");
console.log("B09I_GRAPH_READINESS_RUNTIME_SCHEMA_UNCHANGED_PASS");
console.log("B09I_GRANDFATHERED_AUTHORITY_29_UNCHANGED_PASS");
console.log("B09I_GOVERNANCE_ACCEPTANCE_PASS");
