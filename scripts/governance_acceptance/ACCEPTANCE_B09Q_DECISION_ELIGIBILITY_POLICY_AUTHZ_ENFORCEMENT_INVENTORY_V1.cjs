#!/usr/bin/env node
const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));
const BASE="731fe7ef62392e46d984ceafcb1bd62b17815230";

const expected=[
  "docs/architecture/semantic_convergence/GEOX-B09Q-DECISION-ELIGIBILITY-POLICY-AUTHZ-ENFORCEMENT-INVENTORY-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09Q-DECISION-ELIGIBILITY-POLICY-AUTHZ-ENFORCEMENT-INVENTORY-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09Q_DECISION_ELIGIBILITY_POLICY_AUTHZ_ENFORCEMENT_INVENTORY_V1.cjs"
].sort();

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
 .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09Q_BOUNDED_FOUR_FILE_DIFF_REQUIRED");

const inv=json("docs/architecture/semantic_convergence/GEOX-B09Q-DECISION-ELIGIBILITY-POLICY-AUTHZ-ENFORCEMENT-INVENTORY-V1.json");
if(inv.schema_version!=="b09q_decision_eligibility_policy_authz_enforcement_inventory_v1") fail("B09Q_SCHEMA_INVALID");
if(inv.status!=="ANALYSIS_ONLY_AUTHZ_ENFORCEMENT_TOPOLOGY_RECOMMENDED_NOT_AUTHORIZED") fail("B09Q_STATUS_INVALID");
if(inv.authority_mode!=="GOVERNANCE_ANALYSIS_ONLY") fail("B09Q_AUTHORITY_MODE_INVALID");
if(inv.stacked_base_product_head!==BASE) fail("B09Q_BASE_MISMATCH");
if(inv.current_authz_fact?.scope_check_semantics!=="TOKEN_EXPLICIT_SCOPE_AND_ROLE_MATRIX_PERMISSION") fail("B09Q_AUTHZ_SEMANTICS_INVALID");
if(inv.current_authz_fact?.admin_wildcard_mints_missing_token_scope!==false) fail("B09Q_ADMIN_WILDCARD_OVERCLAIM");
if(inv.current_authz_fact?.admin_with_explicit_future_scope_would_pass_role_layer!==true) fail("B09Q_ADMIN_ROLE_LAYER_FACT_INVALID");
if(inv.recommended_topology?.state!=="RECOMMENDED_NOT_AUTHORIZED") fail("B09Q_RECOMMENDATION_STATE_INVALID");
if(inv.explicitly_undecided?.state!=="INTENTIONALLY_UNDECIDED") fail("B09Q_UNDECIDED_STATE_INVALID");
for(const key of["dedicated_scope_token","allowed_roles_or_principals","admin_allowed_as_policy_author","helper_or_policy_table_shape","route_path","writer_path","policy_content"]){
  if(inv.explicitly_undecided?.[key]!==null) fail("B09Q_PREMATURE_DECISION:"+key);
}

const auth=read("apps/server/src/auth/ao_act_authz_v0.ts");
const tokenCheck=auth.indexOf("rec.scopes.includes(scope)");
const roleCheck=auth.indexOf("isScopeAllowedForRoleV1(roleFromRecord(rec) as AuthRole, scope)");
if(tokenCheck<0||roleCheck<0||tokenCheck>roleCheck) fail("B09Q_TWO_LAYER_AUTHZ_FACT_NOT_PROVEN");

const roles=read("apps/server/src/domain/auth/roles.ts");
if(!roles.includes('admin: ["*"]')) fail("B09Q_ADMIN_WILDCARD_FACT_MISSING");
if(!roles.includes('return row.includes("*") || row.includes(scope);')) fail("B09Q_ROLE_WILDCARD_BEHAVIOR_MISSING");

const tokens=json("config/auth/example_tokens.json");
const admin=tokens.tokens.find(t=>t.role==="admin");
if(!admin||!Array.isArray(admin.scopes)||admin.scopes.includes("decision.eligibility.policy.write")) fail("B09Q_EXAMPLE_ADMIN_TOKEN_SHOULD_NOT_HAVE_INVENTED_SCOPE");

const beforeReg=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const afterReg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const beforeElig=(beforeReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
const afterElig=(afterReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
if(!beforeElig||!afterElig) fail("B09Q_ELIGIBILITY_REGISTER_MISSING");
if(afterElig.notes.length!==beforeElig.notes.length+3) fail("B09Q_ELIGIBILITY_NOTE_DELTA_INVALID");
if(JSON.stringify(afterElig.registered_producers)!==JSON.stringify(beforeElig.registered_producers)) fail("B09Q_PRODUCERS_MUTATED");
if(JSON.stringify(afterElig.registered_consumers)!==JSON.stringify(beforeElig.registered_consumers)) fail("B09Q_CONSUMERS_MUTATED");

const beforeG32=(beforeReg.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation");
const afterG32=(afterReg.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation");
if(!beforeG32||!afterG32||JSON.stringify(beforeG32)!==JSON.stringify(afterG32)) fail("B09Q_G32_MUTATED");
if((afterG32.registered_paths||[]).length!==0) fail("B09Q_WRITER_REGISTERED_PREMATURELY");

const normalized=JSON.parse(JSON.stringify(afterReg));
const nElig=(normalized.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
nElig.notes=beforeElig.notes;
if(JSON.stringify(normalized)!==JSON.stringify(beforeReg)) fail("B09Q_REGISTER_CHANGED_BEYOND_NOTES");

for(const p of[
  "apps/server/src/auth/ao_act_authz_v0.ts",
  "apps/server/src/domain/auth/roles.ts",
  "config/auth/example_tokens.json",
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"
]){
  if(read(p)!==cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"})) fail("B09Q_FROZEN_SURFACE_MUTATED:"+p);
}

if(cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  "apps/server/src",
  "apps/server/db",
  "packages",
  "config/auth",
  ".github/workflows",
  "docs/twin_kernel",
  "docs/digital_twin",
  "docker-compose.commercial_v1.yml"
],{encoding:"utf8"}).trim()) fail("B09Q_RUNTIME_AUTHZ_TOKEN_SCHEMA_WORKFLOW_TWIN_MCFT_MUTATION_FORBIDDEN");

console.log("B09Q_TOKEN_SCOPE_AND_ROLE_MATRIX_AND_GATE_PROVEN_PASS");
console.log("B09Q_ADMIN_WILDCARD_DOES_NOT_MINT_TOKEN_SCOPE_PASS");
console.log("B09Q_ADMIN_EXPLICIT_SCOPE_REMAINING_RISK_PROVEN_PASS");
console.log("B09Q_CENTRAL_PRINCIPAL_ALLOWLIST_RECOMMENDED_NOT_AUTHORIZED_PASS");
console.log("B09Q_G32_ZERO_PATH_PRESERVED_PASS");
console.log("B09Q_REGISTER_NOTES_ONLY_PASS");
console.log("B09Q_GOVERNANCE_ACCEPTANCE_PASS");
