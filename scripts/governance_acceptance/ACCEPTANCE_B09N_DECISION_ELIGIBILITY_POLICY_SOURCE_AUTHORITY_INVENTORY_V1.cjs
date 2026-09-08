#!/usr/bin/env node
const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));
const BASE="dd39f74e4e44de9c0626c063522904f8e255e89c";

const expected=[
  "docs/architecture/semantic_convergence/GEOX-B09N-DECISION-ELIGIBILITY-POLICY-SOURCE-AUTHORITY-INVENTORY-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09N-DECISION-ELIGIBILITY-POLICY-SOURCE-AUTHORITY-INVENTORY-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09N_DECISION_ELIGIBILITY_POLICY_SOURCE_AUTHORITY_INVENTORY_V1.cjs"
].sort();

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09N_BOUNDED_FOUR_FILE_DIFF_REQUIRED");

const inv=json("docs/architecture/semantic_convergence/GEOX-B09N-DECISION-ELIGIBILITY-POLICY-SOURCE-AUTHORITY-INVENTORY-V1.json");
if(inv.schema_version!=="b09n_decision_eligibility_policy_source_authority_inventory_v1") fail("B09N_SCHEMA_INVALID");
if(inv.status!=="ANALYSIS_ONLY_SOURCE_TOPOLOGY_RECOMMENDED_PRODUCT_AUTHORITY_NOT_GRANTED") fail("B09N_STATUS_INVALID");
if(inv.authority_mode!=="GOVERNANCE_ANALYSIS_ONLY") fail("B09N_AUTHORITY_MODE_INVALID");
if(inv.stacked_base_product_head!==BASE) fail("B09N_BASE_MISMATCH");
if(inv.recommended_topology?.source_shape!=="APPEND_ONLY_FACT") fail("B09N_SOURCE_TOPOLOGY_INVALID");
if(inv.recommended_topology?.fact_type!=="decision_eligibility_policy_declaration_v1") fail("B09N_FACT_TYPE_INVALID");
if(inv.recommended_topology?.recommendation_state!=="RECOMMENDED_NOT_AUTHORIZED") fail("B09N_RECOMMENDATION_AUTHORITY_OVERCLAIM");
if(inv.recommended_topology?.product_authority_granted!==false) fail("B09N_PRODUCT_AUTHORITY_GRANTED_PREMATURELY");
if(inv.actual_product_policy_content?.state!=="INTENTIONALLY_UNDECIDED") fail("B09N_PRODUCT_POLICY_CONTENT_INVENTED");
for(const key of["policy_id","policy_version","policy_ref","applicable_action_types","required_criteria","source_authority","writer_authority"]){
  if(inv.actual_product_policy_content?.[key]!==null) fail("B09N_PRODUCT_POLICY_FIELD_INVENTED:"+key);
}

const contract=read("apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts");
if(!contract.includes('schema_version: z.literal("decision_eligibility_policy_declaration_v1")')) fail("B09N_B09M_CONTRACT_MISSING");
if(!contract.includes('authority_state: decisionEligibilityPolicyDeclarationAuthorityV1Schema')) fail("B09N_B09M_AUTHORITY_BOUNDARY_MISSING");

const program=read("apps/server/src/routes/programs_core_v1.ts");
if(!program.includes('type: "field_program_v1"')) fail("B09N_FIELD_PROGRAM_FACT_MISSING");
if(!program.includes('await insertFact(pool, "api/v1/programs", record)')) fail("B09N_FIELD_PROGRAM_APPEND_WRITER_MISSING");
for(const token of["execution_policy","acceptance_policy_ref","evidence_policy_ref"]) if(!program.includes(token)) fail("B09N_FIELD_PROGRAM_EXISTING_POLICY_SURFACE_MISSING:"+token);

const beforeReg=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const afterReg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const beforeElig=(beforeReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
const afterElig=(afterReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
if(!beforeElig||!afterElig) fail("B09N_ELIGIBILITY_REGISTER_MISSING");
if(afterElig.notes.length!==beforeElig.notes.length+2) fail("B09N_ELIGIBILITY_NOTE_DELTA_INVALID");
if(JSON.stringify(afterElig.registered_producers)!==JSON.stringify(beforeElig.registered_producers)) fail("B09N_PRODUCERS_MUTATED");
if(JSON.stringify(afterElig.registered_consumers)!==JSON.stringify(beforeElig.registered_consumers)) fail("B09N_CONSUMERS_MUTATED");

const beforeG32=(beforeReg.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation");
const afterG32=(afterReg.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation");
if(!beforeG32||!afterG32||JSON.stringify(beforeG32)!==JSON.stringify(afterG32)) fail("B09N_G32_MUTATED");
if((afterG32.registered_paths||[]).length!==0) fail("B09N_POLICY_WRITER_REGISTERED_PREMATURELY");

const normalized=JSON.parse(JSON.stringify(afterReg));
const nElig=(normalized.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
nElig.notes=beforeElig.notes;
if(JSON.stringify(normalized)!==JSON.stringify(beforeReg)) fail("B09N_REGISTER_CHANGED_BEYOND_NOTES");

const flatten=(r)=>(r.semantics||[]).flatMap(s=>(s.registered_producers||[])
 .filter(p=>p.grandfathered_duplicate===true)
 .map(p=>({semantic_id:s.semantic_id,...p})))
 .sort((a,b)=>(a.semantic_id+"::"+a.producer_id).localeCompare(b.semantic_id+"::"+b.producer_id));
const bg=flatten(beforeReg),ag=flatten(afterReg);
if(bg.length!==29||ag.length!==29||JSON.stringify(bg)!==JSON.stringify(ag)) fail("B09N_GRANDFATHERED_AUTHORITY_MUTATED");

for(const p of[
 "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
 "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.contract.test.ts",
 "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
 "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"
]){
 if(read(p)!==cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"})) fail("B09N_FROZEN_SURFACE_MUTATED:"+p);
}

if(cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
 "apps/server/src",
 "apps/server/db",
 "packages",
 ".github/workflows",
 "docs/twin_kernel",
 "docs/digital_twin",
 "docker-compose.commercial_v1.yml"
],{encoding:"utf8"}).trim()) fail("B09N_RUNTIME_SCHEMA_WORKFLOW_TWIN_MCFT_MUTATION_FORBIDDEN");

console.log("B09N_SOURCE_OPTIONS_CLASSIFIED_PASS");
console.log("B09N_SEPARATE_APPEND_ONLY_FACT_RECOMMENDATION_PASS");
console.log("B09N_PRODUCT_AUTHORITY_NOT_GRANTED_PASS");
console.log("B09N_POLICY_CONTENT_UNDECIDED_PASS");
console.log("B09N_G32_ZERO_PATH_PRESERVED_PASS");
console.log("B09N_REGISTER_NOTES_ONLY_PASS");
console.log("B09N_29_GRANDFATHERED_AUTHORITY_UNCHANGED_PASS");
console.log("B09N_GOVERNANCE_ACCEPTANCE_PASS");
