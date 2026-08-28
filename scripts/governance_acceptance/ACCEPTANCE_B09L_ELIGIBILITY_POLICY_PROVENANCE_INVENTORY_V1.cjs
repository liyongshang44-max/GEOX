#!/usr/bin/env node
const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));
const BASE="f8f8c45c696bbabbbddb5a859597663d30c60223";

const expected=[
  "docs/architecture/semantic_convergence/GEOX-B09L-ELIGIBILITY-POLICY-PROVENANCE-INVENTORY-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09L-ELIGIBILITY-POLICY-PROVENANCE-INVENTORY-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09L_ELIGIBILITY_POLICY_PROVENANCE_INVENTORY_V1.cjs"
].sort();
const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09L_BOUNDED_FOUR_FILE_DIFF_REQUIRED");

const inv=json("docs/architecture/semantic_convergence/GEOX-B09L-ELIGIBILITY-POLICY-PROVENANCE-INVENTORY-V1.json");
if(inv.schema_version!=="b09l_eligibility_policy_provenance_inventory_v1") fail("B09L_SCHEMA_INVALID");
if(inv.status!=="ANALYSIS_ONLY_NO_EXISTING_PRODUCT_ELIGIBILITY_POLICY_AUTHORITY") fail("B09L_STATUS_INVALID");
if(inv.stacked_base_product_head!==BASE) fail("B09L_BASE_MISMATCH");
if(inv.b09k_anchor?.completion_pr!==3363||inv.b09k_anchor?.completion_comment_id!==5452482173) fail("B09L_B09K_ANCHOR_MISMATCH");

const b07=inv.b07_policy_contract||{};
if(JSON.stringify(b07.required_fields)!==JSON.stringify(["policy_ref","required_criteria"])) fail("B09L_B07_POLICY_FIELDS_INVALID");
if(b07.runtime_additional_requirement!=="applicable_action_types") fail("B09L_B07_RUNTIME_ACTION_TYPES_MISSING");
if(b07.hidden_default_required_criteria!==false) fail("B09L_HIDDEN_DEFAULT_INVENTED");
if(b07.eligibility_pass_is_approval!==false) fail("B09L_ELIGIBILITY_APPROVAL_COLLAPSE");

const fp=inv.field_program_provenance||{};
if(fp.may_anchor_future_eligibility_policy_scope!==true) fail("B09L_FIELD_PROGRAM_SCOPE_ANCHOR_LOST");
if(fp.may_supply_existing_b07_policy_authority!==false) fail("B09L_FIELD_PROGRAM_POLICY_AUTHORITY_OVERCLAIM");
for(const key of ["acceptance_policy_ref","evidence_policy_ref","execution_policy","manual_approval_required_for","allow_night_irrigation","max_irrigation_mm_per_day"]){
  if(!fp.policy_like_fields?.[key]?.present) fail("B09L_FIELD_PROGRAM_FIELD_MISSING:"+key);
  if(fp.policy_like_fields?.[key]?.eligible_as_b07_policy_ref!==false) fail("B09L_FIELD_PROGRAM_POLICY_PROMOTION:"+key);
}
if((fp.policy_like_fields?.evidence_policy_ref?.runtime_consumers||[]).length!==0) fail("B09L_EVIDENCE_POLICY_REF_CONSUMER_INVENTED");

const de=inv.decision_engine_usage||{};
for(const key of[
  "recommendation_generation_reads_program_execution_policy",
  "recommendation_generation_reads_manual_approval_required_for",
  "recommendation_generation_reads_allow_night_irrigation",
  "recommendation_generation_reads_max_irrigation_mm_per_day",
  "recommendation_generation_reads_acceptance_policy_ref",
  "recommendation_generation_reads_evidence_policy_ref"
]){
  if(de[key]!==false) fail("B09L_DECISION_ENGINE_POLICY_READ_OVERCLAIM:"+key);
}
if(de.recommendation_generation_resolves_program_id!==true) fail("B09L_PROGRAM_ID_RESOLUTION_MISSING");
if(de.program_resolution_occurs_after_recommendation_candidates_are_built!==true) fail("B09L_PROGRAM_RESOLUTION_ORDER_INVALID");

const planner=inv.planner_boundary||{};
if(planner.reads_field_program_execution_policy!==true||planner.b07_policy_authority!==false) fail("B09L_PLANNER_BOUNDARY_INVALID");
const approval=inv.approval_boundary||{};
if(approval.human_approval_required!==true||approval.no_direct_execution!==true||approval.request_only!==true) fail("B09L_APPROVAL_BOUNDARY_INVALID");
if(approval.eligible_as_pre_decision_b07_policy_authority!==false) fail("B09L_APPROVAL_PROMOTED_TO_B07");
const acceptance=inv.acceptance_boundary||{};
if(acceptance.semantic_role!=="POST_EXECUTION_ACCEPTANCE"||acceptance.eligible_as_b07_policy_ref!==false) fail("B09L_ACCEPTANCE_POLICY_PROMOTION");

const twin=inv.twin_kernel_policy_collision||{};
if(twin.same_authority_domain!==false||twin.direct_reuse_for_b07_forbidden!==true) fail("B09L_TWIN_POLICY_DOMAIN_COLLAPSE");

const search=inv.repository_search_adjudication||{};
if(search.product_applicable_action_types_implementation_found!==false) fail("B09L_ACTION_TYPES_IMPLEMENTATION_OVERCLAIM");
if(search.product_required_criteria_policy_ref_pair_found!==false) fail("B09L_POLICY_PAIR_IMPLEMENTATION_OVERCLAIM");
if(search.product_eligibility_policy_registry_found!==false) fail("B09L_POLICY_REGISTRY_OVERCLAIM");
if(search.existing_product_policy_authority_for_bounded_irrigate_path!==false) fail("B09L_EXISTING_POLICY_AUTHORITY_OVERCLAIM");

const ready=inv.readiness_adjudication||{};
if(ready.field_program_scope_anchor_ready!==true) fail("B09L_SCOPE_ANCHOR_NOT_READY");
for(const key of[
  "explicit_product_eligibility_policy_authority_exists",
  "safe_to_reuse_acceptance_policy_ref",
  "safe_to_reuse_evidence_policy_ref",
  "safe_to_reuse_execution_policy",
  "safe_to_use_approval_request_as_permission_criterion",
  "safe_to_import_twin_kernel_policy",
  "ready_to_bind_b07_required_criteria",
  "ready_to_invoke_b07e",
  "ready_for_consumer_migration",
  "ready_for_historical_authority_removal"
]){
  if(ready[key]!==false) fail("B09L_READINESS_OVERCLAIM:"+key);
}

const fieldProgram=read("packages/contracts/src/schema/field_program_v1.ts");
for(const needle of[
  "acceptance_policy_ref?: string | null",
  "evidence_policy_ref?: string | null",
  'mode: "approval_required" | "auto_allowed"',
  "auto_execute_allowed_task_types: string[]",
  "manual_approval_required_for: string[]",
  "allow_night_irrigation: boolean"
]){
  if(!fieldProgram.includes(needle)) fail("B09L_FIELD_PROGRAM_CONTRACT_MISSING:"+needle);
}
if(!fieldProgram.includes("max_irrigation_mm_per_day?: number | null")) fail("B09L_IRRIGATION_CAP_CONTRACT_MISSING");

const decisionEngine=read("apps/server/src/routes/decision_engine_v1.ts");
const genStart=decisionEngine.indexOf('app.post("/api/v1/recommendations/generate"');
const genEnd=decisionEngine.indexOf('app.post("/api/v1/recommendations/:recommendation_id/submit-approval"',genStart);
if(genStart<0||genEnd<0) fail("B09L_RECOMMENDATION_GENERATE_BLOCK_NOT_FOUND");
const generateBlock=decisionEngine.slice(genStart,genEnd);
for(const forbidden of[
  "execution_policy",
  "manual_approval_required_for",
  "allow_night_irrigation",
  "max_irrigation_mm_per_day",
  "acceptance_policy_ref",
  "evidence_policy_ref"
]){
  if(generateBlock.includes(forbidden)) fail("B09L_RECOMMENDATION_GENERATE_READS_PROGRAM_POLICY:"+forbidden);
}
const buildIdx=generateBlock.indexOf("buildRecommendationsFromStage1Summary");
const resolveIdx=generateBlock.indexOf("resolveProgramIdForRecommendation");
if(buildIdx<0||resolveIdx<0||resolveIdx<=buildIdx) fail("B09L_PROGRAM_RESOLUTION_ORDER_NOT_PROVEN");

const plannerSource=read("apps/server/src/domain/planner/compiler_v1.ts");
for(const needle of[
  "payload?.execution_policy?.mode",
  "auto_execute_allowed_task_types",
  "acceptance_policy_ref",
  "max_irrigation_mm_per_day",
  'return "APPROVAL_REQUIRED"',
  'return allowed ? "AUTO" : "APPROVAL_REQUIRED";'
]){
  if(!plannerSource.includes(needle)) fail("B09L_PLANNER_POLICY_USE_MISSING:"+needle);
}

const approvalSource=read("apps/server/src/domain/approval/recommendation_approval_request_builder_v1.ts");
for(const needle of[
  "human_approval_required: true",
  "no_direct_execution: true",
  "approval_decision_created: false",
  "operation_plan_created: false",
  "task_created: false",
  "dispatch_created: false",
  "Creates an approval request only."
]){
  if(!approvalSource.includes(needle)) fail("B09L_APPROVAL_BOUNDARY_MISSING:"+needle);
}

const acceptanceSource=read("apps/server/src/domain/acceptance/engine_v1.ts");
if(!acceptanceSource.includes("acceptance_policy_ref: string | null")) fail("B09L_ACCEPTANCE_POLICY_INPUT_MISSING");
if(!acceptanceSource.includes("const formalGatePassed")) fail("B09L_ACCEPTANCE_FORMAL_GATE_MISSING");

const evaluator=read("apps/server/src/domain/decision/decision_eligibility_evaluator_v1.ts");
if(!evaluator.includes("export type DecisionEligibilityPolicyV1")) fail("B09L_B07_POLICY_TYPE_MISSING");
if(!evaluator.includes("B07D_POLICY_REF_REQUIRED")) fail("B09L_POLICY_REF_REQUIREMENT_MISSING");
if(!evaluator.includes("B07D_REQUIRED_CRITERIA_EMPTY")) fail("B09L_REQUIRED_CRITERIA_REQUIREMENT_MISSING");
if(!evaluator.includes("ELIGIBILITY_PASS_IS_NOT_APPROVAL")) fail("B09L_ELIGIBILITY_NOT_APPROVAL_BOUNDARY_MISSING");

for(const p of[
  "docs/twin_kernel/P35_CANDIDATE_ELIGIBILITY_POLICY_V0.json",
  "docs/twin_kernel/P46_RECOMMENDATION_ELIGIBILITY_POLICY_V0.json",
  "docs/twin_kernel/TWIN_USE_ELIGIBILITY_POLICY_CONTRACT_V0.json"
]){
  if(!fs.existsSync(p)) fail("B09L_TWIN_POLICY_REFERENCE_MISSING:"+p);
}
const twinUse=json("docs/twin_kernel/TWIN_USE_ELIGIBILITY_POLICY_CONTRACT_V0.json");
for(const key of["recommendation_generation_allowed","recommendation_approval_allowed","action_approval_allowed","ao_act_authority_allowed"]){
  if(twinUse[key]!==false) fail("B09L_TWIN_USE_AUTHORITY_BOUNDARY_CHANGED:"+key);
}

const beforeReg=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const afterReg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const beforeElig=(beforeReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
const afterElig=(afterReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
if(!beforeElig||!afterElig) fail("B09L_ELIGIBILITY_REGISTER_MISSING");
if(afterElig.notes.length!==beforeElig.notes.length+2) fail("B09L_ELIGIBILITY_NOTE_DELTA_INVALID");
const normalized=JSON.parse(JSON.stringify(afterReg));
(normalized.semantics||[]).find(s=>s.semantic_id==="decision.eligibility").notes=beforeElig.notes;
if(JSON.stringify(normalized)!==JSON.stringify(beforeReg)) fail("B09L_REGISTER_CHANGED_BEYOND_NOTES");

const flatten=(r)=>(r.semantics||[]).flatMap(s=>(s.registered_producers||[])
  .filter(p=>p.grandfathered_duplicate===true)
  .map(p=>({semantic_id:s.semantic_id,...p})))
  .sort((a,b)=>(a.semantic_id+"::"+a.producer_id).localeCompare(b.semantic_id+"::"+b.producer_id));
const bg=flatten(beforeReg),ag=flatten(afterReg);
if(bg.length!==29||ag.length!==29||JSON.stringify(bg)!==JSON.stringify(ag)) fail("B09L_GRANDFATHERED_AUTHORITY_MUTATED");

for(const p of[
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"
]){
  if(read(p)!==cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"})) fail("B09L_FORBIDDEN_GOVERNANCE_FILE_MUTATED:"+p);
}

if(cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  "apps/server/src",
  "apps/server/db",
  "packages",
  ".github/workflows",
  "docs/twin_kernel",
  "docs/digital_twin",
  "docker-compose.commercial_v1.yml"
],{encoding:"utf8"}).trim()) fail("B09L_RUNTIME_SCHEMA_WORKFLOW_TWIN_MCFT_MUTATION_FORBIDDEN");

console.log("B09L_B07_POLICY_CONTRACT_LOCK_PASS");
console.log("B09L_FIELD_PROGRAM_POLICY_SEMANTICS_CLASSIFIED_PASS");
console.log("B09L_DECISION_ENGINE_DOES_NOT_CONSUME_PROGRAM_POLICY_PASS");
console.log("B09L_PLANNER_APPROVAL_ACCEPTANCE_BOUNDARIES_PRESERVED_PASS");
console.log("B09L_TWIN_KERNEL_POLICY_DOMAIN_SEPARATION_PASS");
console.log("B09L_NO_EXISTING_PRODUCT_ELIGIBILITY_POLICY_AUTHORITY_PASS");
console.log("B09L_REGISTER_NOTES_ONLY_PASS");
console.log("B09L_29_GRANDFATHERED_AUTHORITY_UNCHANGED_PASS");
console.log("B09L_GOVERNANCE_ACCEPTANCE_PASS");
