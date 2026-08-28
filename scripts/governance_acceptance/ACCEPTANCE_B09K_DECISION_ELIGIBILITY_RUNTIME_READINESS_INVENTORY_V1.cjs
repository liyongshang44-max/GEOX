#!/usr/bin/env node
const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));
const BASE="03490b4ce54cdb35f2a2965193ed87fdcab24523";

const expectedFiles=[
  "docs/architecture/semantic_convergence/GEOX-B09K-DECISION-ELIGIBILITY-RUNTIME-READINESS-INVENTORY-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09K-DECISION-ELIGIBILITY-RUNTIME-READINESS-INVENTORY-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09K_DECISION_ELIGIBILITY_RUNTIME_READINESS_INVENTORY_V1.cjs"
].sort();

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expectedFiles)) fail("B09K_BOUNDED_FOUR_FILE_DIFF_REQUIRED");

const inv=json("docs/architecture/semantic_convergence/GEOX-B09K-DECISION-ELIGIBILITY-RUNTIME-READINESS-INVENTORY-V1.json");
if(inv.schema_version!=="b09k_decision_eligibility_runtime_readiness_inventory_v1") fail("B09K_SCHEMA_INVALID");
if(inv.status!=="ANALYSIS_ONLY_NOT_READY_FOR_B07E_RUNTIME_CONNECTION") fail("B09K_STATUS_INVALID");
if(inv.authority_mode!=="GOVERNANCE_ANALYSIS_ONLY") fail("B09K_AUTHORITY_MODE_INVALID");
if(inv.stacked_base_product_head!==BASE) fail("B09K_BASE_HEAD_MISMATCH");

const anchor=inv.evidence_anchor||{};
if(anchor.exact_runtime_run_id!==33168228447) fail("B09K_B09J_RUN_MISMATCH");
if(anchor.exact_runtime_job_id!==98838685815) fail("B09K_B09J_JOB_MISMATCH");
if(anchor.validation_head!=="5ba359e42ce8e7c8a38ad6023c44be7e58dfeda0") fail("B09K_B09J_VALIDATION_HEAD_MISMATCH");
if(anchor.artifact_id!==9684515431) fail("B09K_B09J_ARTIFACT_MISMATCH");
if(anchor.artifact_digest!=="sha256:9b99dda859bf79c2256d2f2c350d3e7d00f5033b8d35a93076d5096c2c313c8e") fail("B09K_B09J_DIGEST_MISMATCH");
if(anchor.runtime_observation?.canonical_evidence_qualification_ref_count!==72) fail("B09K_RUNTIME_REF_COUNT_MISMATCH");
if(anchor.runtime_observation?.canonical_evidence_continuity_state!=="EXACT_REF_SET_MATCH") fail("B09K_RUNTIME_CONTINUITY_MISMATCH");
if(anchor.runtime_observation?.criterion_candidate_binding_state!=="BOUND_TO_SAME_CANDIDATE") fail("B09K_RUNTIME_CANDIDATE_BINDING_MISMATCH");
if(anchor.runtime_observation?.decision_eligibility_runtime_connected!==false) fail("B09K_B07E_ALREADY_CONNECTED");

const evidence=inv.b04_canonical_evidence_reconstruction||{};
if(evidence.helper_function!=="buildCanonicalRawSampleEvidenceQualificationProjectionV1") fail("B09K_B04_HELPER_MISMATCH");
if(evidence.full_objects_reconstructable_at_fixed_inputs!==true) fail("B09K_B04_RECONSTRUCTION_NOT_RECOGNIZED");
if(evidence.separate_evidence_qualification_object_store_required_by_b07e!==false) fail("B09K_FALSE_OBJECT_STORE_REQUIREMENT");
if(evidence.b07e_contract_consumes!=="canonical_inputs.evidence_qualification_refs:string[]") fail("B09K_B07E_EVIDENCE_INPUT_SHAPE_MISMATCH");

const reality=inv.b07e_contract_reality||{};
if(reality.hidden_default_required_criteria!==false) fail("B09K_HIDDEN_DEFAULT_INVENTED");
if(reality.policy_requires_explicit_policy_ref!==true||reality.policy_requires_explicit_required_criteria!==true||reality.policy_requires_explicit_applicable_action_types!==true) fail("B09K_EXPLICIT_POLICY_REQUIREMENTS_LOST");
if(reality.contract_test_example_is_normative_default!==false) fail("B09K_TEST_FIXTURE_PROMOTED_TO_POLICY");
if(reality.b07e_external_route_connected!==false) fail("B09K_B07E_ROUTE_CONNECTION_INVENTED");

const ready=inv.bounded_path_readiness||{};
if(ready.candidate_identity?.state!=="READY_SHADOW_BOUND") fail("B09K_CANDIDATE_ID_NOT_READY");
if(ready.canonical_evidence_refs?.state!=="READY_SHADOW_BOUND") fail("B09K_EVIDENCE_REFS_NOT_READY");
if(ready.qualified_evidence_criterion?.state!=="READY_SHADOW_BOUND") fail("B09K_QUALIFIED_EVIDENCE_CRITERION_NOT_READY");
if(ready.context_snapshot_ref?.state!=="NOT_BOUND_ON_B09J_CANDIDATE") fail("B09K_CONTEXT_BINDING_OVERCLAIM");
if(ready.crop_stage_state_ref?.state!=="NOT_BOUND_ON_B09J_CANDIDATE") fail("B09K_STAGE_BINDING_OVERCLAIM");
if(ready.calculation_result_refs?.state!=="NOT_BOUND_ON_B09J_CANDIDATE") fail("B09K_CALC_BINDING_OVERCLAIM");
if(ready.product_eligibility_policy?.state!=="NOT_ESTABLISHED_ON_ANALYZED_PATH") fail("B09K_POLICY_OVERCLAIM");
if(ready.state_criterion?.state!=="NOT_RUNTIME_READY_ON_ANALYZED_PATH") fail("B09K_STATE_CRITERION_OVERCLAIM");

const adj=inv.readiness_adjudication||{};
if(adj.ready_for_b07e_runtime_invocation!==false) fail("B09K_B07E_READY_OVERCLAIM");
if(adj.ready_for_consumer_migration!==false) fail("B09K_MIGRATION_READY_OVERCLAIM");
if(adj.ready_for_historical_authority_removal!==false) fail("B09K_REMOVAL_READY_OVERCLAIM");
if(!(adj.unconditional_blockers||[]).includes("EXPLICIT_PRODUCT_ELIGIBILITY_POLICY_NOT_BOUND")) fail("B09K_PRIMARY_POLICY_BLOCKER_MISSING");
if(!(adj.corrected_non_blocker||[]).includes("FULL_CANONICAL_EVIDENCE_QUALIFICATION_OBJECTS_NOT_MATERIALIZED_AT_B09J_SEAM")) fail("B09K_FALSE_OBJECT_BLOCKER_NOT_CORRECTED");

const b07e=read("apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts");
if(!b07e.includes("evidence_qualification_refs: string[]")) fail("B09K_B07E_REFS_CONTRACT_NOT_FOUND");
if(b07e.includes("EvidenceQualificationV1[]")) fail("B09K_B07E_FULL_OBJECT_CONTRACT_UNEXPECTED");
if(!b07e.includes("assertCandidateEvidenceContinuity")) fail("B09K_B07E_EVIDENCE_CONTINUITY_GUARD_MISSING");
if(!b07e.includes("assertCriterionSupportRefsAuthorized")) fail("B09K_B07E_CRITERION_SUPPORT_GUARD_MISSING");

const b04=read("apps/server/src/domain/sensing/appleii_evidence_sufficiency_v1.ts");
if(!b04.includes("buildCanonicalRawSampleEvidenceQualificationProjectionV1")) fail("B09K_B04_SHARED_READER_MISSING");
if(!b04.includes("canonical_evidence_qualification_projection_v1")) fail("B09K_B04_CANONICAL_PROJECTION_MISSING");
if(!b04.includes("raw_sample_runtime_available_v1")) fail("B09K_B04_POST_COMMIT_MARKER_BOUNDARY_MISSING");

const b04proj=read("apps/server/src/evidence/raw_sample_evidence_qualification_projection_v1.ts");
if(!b04proj.includes("qualifications: EvidenceQualificationV1[]")) fail("B09K_B04_FULL_OBJECT_BATCH_MISSING");
if(!b04proj.includes("qualification_id: `evidence_qualification_v1:${sourceRef}:${input.decision_time_ms}`")) fail("B09K_B04_QUALIFICATION_ID_POLICY_MISSING");

const b07d=read("docs/architecture/semantic_convergence/GEOX-B07D-DECISION-ELIGIBILITY-EVALUATOR-V1.md");
if(!b07d.includes("There is no built-in default list of required criteria.")) fail("B09K_B07D_NO_DEFAULT_POLICY_BOUNDARY_MISSING");
if(!b07d.includes("policy_ref + required_criteria")) fail("B09K_B07D_EXPLICIT_POLICY_BOUNDARY_MISSING");

const b07c=read("apps/server/src/domain/decision/agronomy_judge_eligibility_precursor_adapter_v1.ts");
if(!b07c.includes("B07C_CANONICAL_CALCULATION_RESULT_REQUIRED")) fail("B09K_B07C_CALC_REQUIREMENT_MISSING");

const b05b=read("docs/architecture/semantic_convergence/GEOX-B05B-FIELD-PROGRAM-CONTEXT-PROJECTION-V1.md");
if(!b05b.includes("REGISTERED_CAPABILITY_ISLAND / INTENTIONAL_NONE")) fail("B09K_B05B_CONTEXT_ISLAND_BOUNDARY_MISSING");

const b06b=read("docs/architecture/semantic_convergence/GEOX-B06B-IRRIGATION-CALCULATION-RESULT-ADAPTERS-V1.md");
if(!b06b.includes("REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE")) fail("B09K_B06B_CALC_ISLAND_BOUNDARY_MISSING");

const beforeReg=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const reg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const beforeCand=(beforeReg.semantics||[]).find(s=>s.semantic_id==="decision.candidate");
const afterCand=(reg.semantics||[]).find(s=>s.semantic_id==="decision.candidate");
const beforeElig=(beforeReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
const afterElig=(reg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
if(!beforeCand||!afterCand||!beforeElig||!afterElig) fail("B09K_REGISTER_SEMANTICS_MISSING");
if(afterCand.notes.length!==beforeCand.notes.length+1) fail("B09K_CANDIDATE_NOTE_DELTA_INVALID");
if(afterElig.notes.length!==beforeElig.notes.length+2) fail("B09K_ELIGIBILITY_NOTE_DELTA_INVALID");

const normalized=JSON.parse(JSON.stringify(reg));
const nCand=(normalized.semantics||[]).find(s=>s.semantic_id==="decision.candidate");
const nElig=(normalized.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
nCand.notes=beforeCand.notes;
nElig.notes=beforeElig.notes;
if(JSON.stringify(normalized)!==JSON.stringify(beforeReg)) fail("B09K_REGISTER_CHANGED_BEYOND_NOTES");

const flatten=(r)=>(r.semantics||[]).flatMap(s=>(s.registered_producers||[])
  .filter(p=>p.grandfathered_duplicate===true)
  .map(p=>({semantic_id:s.semantic_id,...p})))
  .sort((a,b)=>(a.semantic_id+"::"+a.producer_id).localeCompare(b.semantic_id+"::"+b.producer_id));
const beforeGrand=flatten(beforeReg),afterGrand=flatten(reg);
if(beforeGrand.length!==29||afterGrand.length!==29||JSON.stringify(beforeGrand)!==JSON.stringify(afterGrand)) fail("B09K_GRANDFATHERED_AUTHORITY_MUTATED");

for(const guardId of [
  "G-B02-11-canonical-context-instantiation",
  "G-B02-12-qualified-crop-stage-instantiation",
  "G-B02-14-calculation-result-instantiation",
  "G-B02-15-candidate-decision-instantiation",
  "G-B02-16-decision-eligibility-instantiation",
  "G-B02-17-decision-eligibility-criterion-instantiation",
  "G-B02-18-decision-eligibility-runtime-consumer"
]){
  const a=(reg.static_guards||[]).find(g=>g.guard_id===guardId);
  const b=(beforeReg.static_guards||[]).find(g=>g.guard_id===guardId);
  if(!a||!b||JSON.stringify(a)!==JSON.stringify(b)) fail("B09K_GUARD_MUTATED:"+guardId);
}

for(const p of [
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"
]){
  const now=read(p);
  const before=cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"});
  if(now!==before) fail("B09K_FORBIDDEN_GOVERNANCE_FILE_MUTATED:"+p);
}

if(cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  "apps/server/src",
  "apps/server/db",
  "packages",
  ".github/workflows",
  "docs/digital_twin",
  "docker-compose.commercial_v1.yml"
],{encoding:"utf8"}).trim()) fail("B09K_RUNTIME_SCHEMA_WORKFLOW_MCFT_MUTATION_FORBIDDEN");

console.log("B09K_B09J_RUNTIME_ANCHOR_LOCK_PASS");
console.log("B09K_B07E_REFS_NOT_OBJECTS_CONTRACT_PASS");
console.log("B09K_B04_CANONICAL_OBJECT_RECONSTRUCTION_PASS");
console.log("B09K_EXPLICIT_POLICY_NO_HIDDEN_DEFAULT_PASS");
console.log("B09K_CONTEXT_CALC_CAPABILITY_ISLANDS_PRESERVED_PASS");
console.log("B09K_B07E_REMAINS_DISCONNECTED_PASS");
console.log("B09K_REGISTER_NOTES_ONLY_PASS");
console.log("B09K_GRANDFATHERED_AUTHORITY_29_UNCHANGED_PASS");
console.log("B09K_GOVERNANCE_ACCEPTANCE_PASS");
