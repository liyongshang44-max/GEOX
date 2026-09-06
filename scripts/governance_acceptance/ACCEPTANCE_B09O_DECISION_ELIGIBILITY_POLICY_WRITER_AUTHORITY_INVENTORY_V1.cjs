#!/usr/bin/env node
const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));
const BASE="5f8012f90882e94203a2407e718dcb963ced1375";

const expected=[
  "docs/architecture/semantic_convergence/GEOX-B09O-DECISION-ELIGIBILITY-POLICY-WRITER-AUTHORITY-INVENTORY-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09O-DECISION-ELIGIBILITY-POLICY-WRITER-AUTHORITY-INVENTORY-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09O_DECISION_ELIGIBILITY_POLICY_WRITER_AUTHORITY_INVENTORY_V1.cjs"
].sort();

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09O_BOUNDED_FOUR_FILE_DIFF_REQUIRED");

const inv=json("docs/architecture/semantic_convergence/GEOX-B09O-DECISION-ELIGIBILITY-POLICY-WRITER-AUTHORITY-INVENTORY-V1.json");
if(inv.schema_version!=="b09o_decision_eligibility_policy_writer_authority_inventory_v1") fail("B09O_SCHEMA_INVALID");
if(inv.status!=="ANALYSIS_ONLY_DEDICATED_WRITER_AUTHORITY_REQUIRED_NOT_AUTHORIZED") fail("B09O_STATUS_INVALID");
if(inv.authority_mode!=="GOVERNANCE_ANALYSIS_ONLY") fail("B09O_AUTHORITY_MODE_INVALID");
if(inv.stacked_base_product_head!==BASE) fail("B09O_BASE_MISMATCH");
if(inv.existing_authz_surface?.adjudication!=="NO_EXISTING_SCOPE_CAN_BE_REUSED_WITHOUT_SEMANTIC_AUTHORITY_COLLAPSE") fail("B09O_AUTHZ_ADJUDICATION_INVALID");
if(inv.existing_authz_surface?.exact_future_policy_scope_token!==null) fail("B09O_SCOPE_TOKEN_INVENTED");
if(inv.existing_authz_surface?.exact_future_allowed_roles!==null) fail("B09O_ROLE_SET_INVENTED");
if(inv.role_adjudication?.policy_declaration_role_set_established!==false) fail("B09O_ROLE_AUTHORITY_OVERCLAIM");
if(inv.explicitly_undecided?.state!=="INTENTIONALLY_UNDECIDED") fail("B09O_UNDECIDED_STATE_INVALID");
for(const key of["scope_token","allowed_roles","route_path","writer_service_path","policy_id","policy_version","policy_ref","applicable_action_types","required_criteria"]){
  if(inv.explicitly_undecided?.[key]!==null) fail("B09O_PREMATURE_DECISION:"+key);
}

const auth=read("apps/server/src/auth/ao_act_authz_v0.ts");
for(const token of[
  '"ao_act.task.write"',
  '"recommendation.write"',
  '"prescription.write"',
  '"approval.decide"',
  '"security.admin"',
  '"skill.binding.write"'
]) if(!auth.includes(token)) fail("B09O_EXPECTED_AUTH_SCOPE_MISSING:"+token);

const roles=read("apps/server/src/domain/auth/roles.ts");
if(!roles.includes('admin: ["*"]')) fail("B09O_ADMIN_WILDCARD_FACT_MISSING");
if(!roles.includes('"recommendation.write"')) fail("B09O_AGRONOMIST_RECOMMENDATION_FACT_MISSING");
if(!roles.includes('"approval.decide"')) fail("B09O_APPROVER_FACT_MISSING");

const skillFacts=read("apps/server/src/domain/skill_registry/facts.ts");
for(const token of[
  "changed_by_actor_id",
  "changed_by_token_id",
  "change_reason",
  "SKILL_CHANGE_REASON_REQUIRED",
  "INSERT INTO facts"
]) if(!skillFacts.includes(token)) fail("B09O_AUDITABILITY_PRECEDENT_MISSING:"+token);

const beforeReg=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const afterReg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const beforeElig=(beforeReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
const afterElig=(afterReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
if(!beforeElig||!afterElig) fail("B09O_ELIGIBILITY_REGISTER_MISSING");
if(afterElig.notes.length!==beforeElig.notes.length+3) fail("B09O_ELIGIBILITY_NOTE_DELTA_INVALID");
if(JSON.stringify(afterElig.registered_producers)!==JSON.stringify(beforeElig.registered_producers)) fail("B09O_PRODUCERS_MUTATED");
if(JSON.stringify(afterElig.registered_consumers)!==JSON.stringify(beforeElig.registered_consumers)) fail("B09O_CONSUMERS_MUTATED");

const beforeG32=(beforeReg.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation");
const afterG32=(afterReg.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation");
if(!beforeG32||!afterG32||JSON.stringify(beforeG32)!==JSON.stringify(afterG32)) fail("B09O_G32_MUTATED");
if((afterG32.registered_paths||[]).length!==0) fail("B09O_POLICY_WRITER_REGISTERED_PREMATURELY");

const normalized=JSON.parse(JSON.stringify(afterReg));
const nElig=(normalized.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
nElig.notes=beforeElig.notes;
if(JSON.stringify(normalized)!==JSON.stringify(beforeReg)) fail("B09O_REGISTER_CHANGED_BEYOND_NOTES");

for(const p of[
  "apps/server/src/auth/ao_act_authz_v0.ts",
  "apps/server/src/domain/auth/roles.ts",
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"
]){
  if(read(p)!==cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"})) fail("B09O_FROZEN_SURFACE_MUTATED:"+p);
}

const flatten=(r)=>(r.semantics||[]).flatMap(s=>(s.registered_producers||[])
  .filter(p=>p.grandfathered_duplicate===true)
  .map(p=>({semantic_id:s.semantic_id,...p})))
  .sort((a,b)=>(a.semantic_id+"::"+a.producer_id).localeCompare(b.semantic_id+"::"+b.producer_id));
const bg=flatten(beforeReg),ag=flatten(afterReg);
if(bg.length!==29||ag.length!==29||JSON.stringify(bg)!==JSON.stringify(ag)) fail("B09O_GRANDFATHERED_AUTHORITY_MUTATED");

if(cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  "apps/server/src",
  "apps/server/db",
  "packages",
  ".github/workflows",
  "docs/twin_kernel",
  "docs/digital_twin",
  "docker-compose.commercial_v1.yml"
],{encoding:"utf8"}).trim()) fail("B09O_RUNTIME_AUTHZ_SCHEMA_WORKFLOW_TWIN_MCFT_MUTATION_FORBIDDEN");

console.log("B09O_EXISTING_AUTHZ_SCOPES_CLASSIFIED_PASS");
console.log("B09O_DEDICATED_POLICY_WRITE_AUTHORITY_REQUIRED_PASS");
console.log("B09O_EXACT_SCOPE_TOKEN_ROLE_SET_UNDECIDED_PASS");
console.log("B09O_SKILL_BINDING_AUDIT_PATTERN_ONLY_PASS");
console.log("B09O_G32_ZERO_PATH_PRESERVED_PASS");
console.log("B09O_REGISTER_NOTES_ONLY_PASS");
console.log("B09O_29_GRANDFATHERED_AUTHORITY_UNCHANGED_PASS");
console.log("B09O_GOVERNANCE_ACCEPTANCE_PASS");
