#!/usr/bin/env node
const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));
const BASE="ff8968f5468c12fcfce30203622230bfd660d477";

const expected=[
  "docs/architecture/semantic_convergence/GEOX-B09P-DECISION-ELIGIBILITY-POLICY-PRINCIPAL-AUTHORITY-INVENTORY-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09P-DECISION-ELIGIBILITY-POLICY-PRINCIPAL-AUTHORITY-INVENTORY-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09P_DECISION_ELIGIBILITY_POLICY_PRINCIPAL_AUTHORITY_INVENTORY_V1.cjs"
].sort();

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
 .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09P_BOUNDED_FOUR_FILE_DIFF_REQUIRED");

const inv=json("docs/architecture/semantic_convergence/GEOX-B09P-DECISION-ELIGIBILITY-POLICY-PRINCIPAL-AUTHORITY-INVENTORY-V1.json");
if(inv.schema_version!=="b09p_decision_eligibility_policy_principal_authority_inventory_v1") fail("B09P_SCHEMA_INVALID");
if(inv.status!=="ANALYSIS_ONLY_PRINCIPAL_MODEL_NOT_AUTHORIZED") fail("B09P_STATUS_INVALID");
if(inv.authority_mode!=="GOVERNANCE_ANALYSIS_ONLY") fail("B09P_AUTHORITY_MODE_INVALID");
if(inv.stacked_base_product_head!==BASE) fail("B09P_BASE_MISMATCH");
if(inv.existing_roles?.existing_role_set_sufficient_without_explicit_policy_assignment!==false) fail("B09P_ROLE_AUTHORITY_OVERCLAIM");
if(inv.explicitly_undecided?.state!=="INTENTIONALLY_UNDECIDED") fail("B09P_UNDECIDED_STATE_INVALID");
for(const key of["capability_scope_token","authorized_human_roles","authorized_service_principals","dual_control_required","route_path","writer_service_path","policy_content"]){
  if(inv.explicitly_undecided?.[key]!==null) fail("B09P_PREMATURE_DECISION:"+key);
}

const roles=read("apps/server/src/domain/auth/roles.ts");
for(const token of['admin: ["*"]','agronomist:','approver:','operator:','support:']) if(!roles.includes(token)) fail("B09P_ROLE_FACT_MISSING:"+token);
const auth=read("apps/server/src/auth/ao_act_authz_v0.ts");
if(!auth.includes("actor_id")) fail("B09P_ACTOR_IDENTITY_MISSING");
if(!auth.includes("token_id")) fail("B09P_TOKEN_IDENTITY_MISSING");

const beforeReg=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const afterReg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const beforeElig=(beforeReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
const afterElig=(afterReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
if(!beforeElig||!afterElig) fail("B09P_ELIGIBILITY_REGISTER_MISSING");
if(afterElig.notes.length!==beforeElig.notes.length+3) fail("B09P_ELIGIBILITY_NOTE_DELTA_INVALID");
if(JSON.stringify(afterElig.registered_producers)!==JSON.stringify(beforeElig.registered_producers)) fail("B09P_PRODUCERS_MUTATED");
if(JSON.stringify(afterElig.registered_consumers)!==JSON.stringify(beforeElig.registered_consumers)) fail("B09P_CONSUMERS_MUTATED");

const beforeG32=(beforeReg.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation");
const afterG32=(afterReg.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation");
if(!beforeG32||!afterG32||JSON.stringify(beforeG32)!==JSON.stringify(afterG32)) fail("B09P_G32_MUTATED");
if((afterG32.registered_paths||[]).length!==0) fail("B09P_WRITER_REGISTERED_PREMATURELY");

const normalized=JSON.parse(JSON.stringify(afterReg));
const nElig=(normalized.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
nElig.notes=beforeElig.notes;
if(JSON.stringify(normalized)!==JSON.stringify(beforeReg)) fail("B09P_REGISTER_CHANGED_BEYOND_NOTES");

for(const p of[
  "apps/server/src/auth/ao_act_authz_v0.ts",
  "apps/server/src/domain/auth/roles.ts",
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"
]){
  if(read(p)!==cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"})) fail("B09P_FROZEN_SURFACE_MUTATED:"+p);
}

if(cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  "apps/server/src",
  "apps/server/db",
  "packages",
  ".github/workflows",
  "docs/twin_kernel",
  "docs/digital_twin",
  "docker-compose.commercial_v1.yml"
],{encoding:"utf8"}).trim()) fail("B09P_RUNTIME_AUTHZ_SCHEMA_WORKFLOW_TWIN_MCFT_MUTATION_FORBIDDEN");

console.log("B09P_ROLE_AUTHORITY_NOT_INFERRED_PASS");
console.log("B09P_PRINCIPAL_MODELS_CLASSIFIED_PASS");
console.log("B09P_ADMIN_WILDCARD_NOT_POLICY_PROVENANCE_PASS");
console.log("B09P_SERVICE_PRINCIPAL_NOT_PRODUCT_JUDGMENT_PASS");
console.log("B09P_G32_ZERO_PATH_PRESERVED_PASS");
console.log("B09P_REGISTER_NOTES_ONLY_PASS");
console.log("B09P_GOVERNANCE_ACCEPTANCE_PASS");
