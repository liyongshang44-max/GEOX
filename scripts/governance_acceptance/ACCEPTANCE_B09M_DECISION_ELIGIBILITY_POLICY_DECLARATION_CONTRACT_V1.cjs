#!/usr/bin/env node
const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));
const BASE="90e8518571bb42c5162811bf80158981057b40c4";

const expected=[
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.contract.test.ts",
  "docs/architecture/semantic_convergence/GEOX-B09M-DECISION-ELIGIBILITY-POLICY-DECLARATION-CONTRACT-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09M_DECISION_ELIGIBILITY_POLICY_DECLARATION_CONTRACT_V1.cjs"
].sort();
const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09M_BOUNDED_FIVE_FILE_DIFF_REQUIRED");

const source=read("apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts");
for(const needle of[
  'schema_version: z.literal("decision_eligibility_policy_declaration_v1")',
  'authority_state: decisionEligibilityPolicyDeclarationAuthorityV1Schema',
  'z.literal("POLICY_DECLARATION_ONLY")',
  'applicable_action_types: z.array(z.string().min(1)).min(1)',
  'required_criteria: z.array(decisionEligibilityCriterionV1Schema).min(1)',
  'lifecycle_semantics: z.literal("B07D_LIFECYCLE_STATE_V1")',
  'scope_anchor_type: z.string().min(1)',
  'scope_anchor_ref: z.string().min(1)',
  'declaration_source_type: z.string().min(1)',
  'declaration_source_ref: z.string().min(1)',
  'provenance_refs: z.array(z.string().min(1)).min(1)',
  'B09M_ACTION_TYPES_MUST_BE_UNIQUE',
  'B09M_REQUIRED_CRITERIA_MUST_BE_UNIQUE',
  'B09M_POLICY_REF_MUST_ENCODE_POLICY_ID_AND_VERSION',
  'B09M_DECLARATION_ID_MUST_ENCODE_POLICY_ID_AND_VERSION'
]){
  if(!source.includes(needle)) fail("B09M_CONTRACT_BOUNDARY_MISSING:"+needle);
}
for(const forbidden of[
  "DEFAULT_REQUIRED_CRITERIA",
  "DEFAULT_APPLICABLE_ACTION_TYPES",
  "runDecisionEligibilityRuntimeV1(",
  "evaluateDecisionEligibilityV1(",
  "decisionEligibilityDecisionV1Schema.parse(",
  "decisionEligibilityCriterionAssessmentV1Schema.parse("
]){
  if(source.includes(forbidden)) fail("B09M_FORBIDDEN_CONTRACT_AUTHORITY:"+forbidden);
}

const candidate=read("apps/server/src/contracts/canonical_decision_v1.ts");
if(!candidate.includes("action_type: z.string().min(1)")) fail("B09M_OPEN_CANDIDATE_ACTION_VOCABULARY_LOST");

const evaluator=read("apps/server/src/domain/decision/decision_eligibility_evaluator_v1.ts");
if(!evaluator.includes("export type DecisionEligibilityPolicyV1")) fail("B09M_B07D_POLICY_TYPE_MISSING");
if(!evaluator.includes("B07D_REQUIRED_CRITERIA_EMPTY")) fail("B09M_B07D_EXPLICIT_CRITERIA_BOUNDARY_MISSING");

const runtime=read("apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts");
if(!runtime.includes("applicable_action_types: string[]")) fail("B09M_B07E_ACTION_APPLICABILITY_MISSING");
if(!runtime.includes("B07E_POLICY_APPLICABLE_ACTION_TYPES_EMPTY")) fail("B09M_B07E_ACTION_APPLICABILITY_GUARD_MISSING");

for(const p of[
  "apps/server/src/domain/decision/decision_eligibility_evaluator_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "packages/contracts/src/schema/field_program_v1.ts"
]){
  if(read(p)!==cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"})) fail("B09M_EXISTING_POLICY_SURFACE_MUTATED:"+p);
}

const beforeReg=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const afterReg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const beforeElig=(beforeReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
const afterElig=(afterReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
if(!beforeElig||!afterElig) fail("B09M_ELIGIBILITY_REGISTER_MISSING");
if(afterElig.notes.length!==beforeElig.notes.length+1) fail("B09M_ELIGIBILITY_NOTE_DELTA_INVALID");
if(JSON.stringify(afterElig.registered_producers)!==JSON.stringify(beforeElig.registered_producers)) fail("B09M_ELIGIBILITY_PRODUCERS_MUTATED");
if(JSON.stringify(afterElig.registered_consumers)!==JSON.stringify(beforeElig.registered_consumers)) fail("B09M_ELIGIBILITY_CONSUMERS_MUTATED");
if(JSON.stringify(afterElig.runtime_consumers)!==JSON.stringify(beforeElig.runtime_consumers)) fail("B09M_ELIGIBILITY_RUNTIME_CONSUMERS_MUTATED");

const beforeGuards=beforeReg.static_guards||[];
const afterGuards=afterReg.static_guards||[];
if(afterGuards.length!==beforeGuards.length+1) fail("B09M_STATIC_GUARD_DELTA_INVALID");
if(JSON.stringify(afterGuards.slice(0,beforeGuards.length))!==JSON.stringify(beforeGuards)) fail("B09M_PRIOR_STATIC_GUARDS_MUTATED");
const g32=afterGuards[afterGuards.length-1];
if(g32.guard_id!=="G-B02-32-decision-eligibility-policy-declaration-instantiation") fail("B09M_G32_ID_INVALID");
if(g32.semantic_id!=="decision.eligibility") fail("B09M_G32_SEMANTIC_INVALID");
if(JSON.stringify(g32.match?.any_of)!==JSON.stringify(["decisionEligibilityPolicyDeclarationV1Schema.parse("])) fail("B09M_G32_MATCH_INVALID");
if(!Array.isArray(g32.registered_paths)||g32.registered_paths.length!==0) fail("B09M_PRODUCTION_POLICY_INSTANCE_REGISTERED_PREMATURELY");

const normalized=JSON.parse(JSON.stringify(afterReg));
const nElig=(normalized.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
nElig.notes=beforeElig.notes;
normalized.static_guards=beforeGuards;
if(JSON.stringify(normalized)!==JSON.stringify(beforeReg)) fail("B09M_REGISTER_CHANGED_BEYOND_NOTE_AND_G32");

for(const id of[
  "G-B02-16-decision-eligibility-instantiation",
  "G-B02-17-decision-eligibility-criterion-instantiation",
  "G-B02-18-decision-eligibility-runtime-consumer"
]){
  const a=afterGuards.find(g=>g.guard_id===id);
  const b=beforeGuards.find(g=>g.guard_id===id);
  if(JSON.stringify(a)!==JSON.stringify(b)) fail("B09M_EXISTING_ELIGIBILITY_GUARD_MUTATED:"+id);
}

const flatten=(r)=>(r.semantics||[]).flatMap(s=>(s.registered_producers||[])
  .filter(p=>p.grandfathered_duplicate===true)
  .map(p=>({semantic_id:s.semantic_id,...p})))
  .sort((a,b)=>(a.semantic_id+"::"+a.producer_id).localeCompare(b.semantic_id+"::"+b.producer_id));
const bg=flatten(beforeReg),ag=flatten(afterReg);
if(bg.length!==29||ag.length!==29||JSON.stringify(bg)!==JSON.stringify(ag)) fail("B09M_GRANDFATHERED_AUTHORITY_MUTATED");

const productionFiles=cp.execFileSync("git",["grep","-l","decisionEligibilityPolicyDeclarationV1Schema.parse(","--","apps/server/src"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean)
  .filter(p=>!p.endsWith(".test.ts")&&!p.endsWith(".acceptance.test.ts"));
if(productionFiles.length!==0) fail("B09M_PRODUCTION_POLICY_DECLARATION_INSTANCE_FOUND:"+productionFiles.join(","));

for(const p of[
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"
]){
  if(read(p)!==cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"})) fail("B09M_FORBIDDEN_GOVERNANCE_FILE_MUTATED:"+p);
}

if(cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  "apps/server/src/domain",
  "apps/server/src/routes",
  "apps/server/db",
  "packages",
  ".github/workflows",
  "docs/twin_kernel",
  "docs/digital_twin",
  "docker-compose.commercial_v1.yml"
],{encoding:"utf8"}).trim()) fail("B09M_RUNTIME_SCHEMA_WORKFLOW_TWIN_MCFT_MUTATION_FORBIDDEN");

console.log("B09M_VERSIONED_POLICY_IDENTITY_CONTRACT_PASS");
console.log("B09M_OPEN_ACTION_VOCABULARY_PRESERVED_PASS");
console.log("B09M_EXPLICIT_NO_DEFAULT_REQUIRED_CRITERIA_PASS");
console.log("B09M_SCOPE_SOURCE_PROVENANCE_CONTRACT_PASS");
console.log("B09M_POLICY_DECLARATION_ONLY_AUTHORITY_PASS");
console.log("B09M_ZERO_PRODUCTION_DECLARATION_INSTANCES_PASS");
console.log("B09M_G32_ZERO_PATH_GOVERNANCE_PASS");
console.log("B09M_EXISTING_B07_GUARDS_PRODUCERS_UNCHANGED_PASS");
console.log("B09M_29_GRANDFATHERED_AUTHORITY_UNCHANGED_PASS");
console.log("B09M_GOVERNANCE_ACCEPTANCE_PASS");
