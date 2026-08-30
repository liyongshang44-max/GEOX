#!/usr/bin/env node
const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));
const BASE="8526be4611290484ccaa8550969a013b408ff557";

const expected=[
  "apps/server/src/auth/ao_act_authz_v0.ts",
  "apps/server/src/auth/decision_eligibility_policy_declaration_authz_v1.contract.test.ts",
  "apps/server/src/domain/auth/roles.ts",
  "docs/architecture/semantic_convergence/GEOX-B09R-DECISION-ELIGIBILITY-POLICY-AUTHORITY-ENFORCEMENT-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09R-DECISION-ELIGIBILITY-POLICY-AUTHORITY-ENFORCEMENT-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09R_DECISION_ELIGIBILITY_POLICY_AUTHORITY_ENFORCEMENT_V1.cjs"
].sort();

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
 .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09R_BOUNDED_SEVEN_FILE_DIFF_REQUIRED");

const d=json("docs/architecture/semantic_convergence/GEOX-B09R-DECISION-ELIGIBILITY-POLICY-AUTHORITY-ENFORCEMENT-V1.json");
if(d.schema_version!=="b09r_decision_eligibility_policy_authority_enforcement_v1") fail("B09R_SCHEMA_INVALID");
if(d.status!=="AUTHORIZED_ENFORCEMENT_IMPLEMENTED_NO_POLICY_INSTANCE") fail("B09R_STATUS_INVALID");
if(d.authorization_state!=="AUTHORIZED_BY_PRODUCT_GOVERNANCE") fail("B09R_AUTHORIZATION_MISSING");
if(d.governance_decision_id!=="DEC-BLINE-ELIGIBILITY-POLICY-PRINCIPAL-001") fail("B09R_DECISION_ID_INVALID");
if(d.stacked_base_product_head!==BASE) fail("B09R_BASE_MISMATCH");
if(d.dedicated_scope?.scope!=="decision.eligibility.policy.declare") fail("B09R_SCOPE_NOT_FROZEN");
if(JSON.stringify(d.human_principal_authority?.allowed_roles)!==JSON.stringify(["agronomist"])) fail("B09R_HUMAN_AUTHOR_SET_INVALID");
if(d.service_principal_boundary?.policy_authorship_authorized!==false) fail("B09R_SERVICE_PRINCIPAL_AUTHORSHIP_FORBIDDEN");
if(d.intentionally_not_implemented?.g_b02_32_registered_paths!==0) fail("B09R_G32_SHOULD_REMAIN_ZERO");

const auth=read("apps/server/src/auth/ao_act_authz_v0.ts");
for(const needle of[
  '"decision.eligibility.policy.declare"',
  "DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1",
  "DECISION_ELIGIBILITY_POLICY_DECLARATION_HUMAN_ROLES_V1",
  "isDecisionEligibilityPolicyDeclarationHumanAuthorRoleV1",
  "requireDecisionEligibilityPolicyDeclarationAuthorityV1",
  "AUTH_POLICY_PRINCIPAL_DENIED"
]) if(!auth.includes(needle)) fail("B09R_AUTHZ_SURFACE_MISSING:"+needle);

const scopeIdx=auth.indexOf("requireAoActScopeV0(\n    req,\n    reply,\n    DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1");
const principalIdx=auth.indexOf("isDecisionEligibilityPolicyDeclarationHumanAuthorRoleV1(auth.role)");
if(scopeIdx<0||principalIdx<0||scopeIdx>principalIdx) fail("B09R_SCOPE_MUST_PRECEDE_PRINCIPAL_GATE");

const roles=read("apps/server/src/domain/auth/roles.ts");
if(!roles.includes('admin: ["*"]')) fail("B09R_ADMIN_GENERIC_WILDCARD_SHOULD_REMAIN");
if(!roles.includes('agronomist: ["decision.eligibility.policy.declare"')) fail("B09R_AGRONOMIST_SCOPE_ASSIGNMENT_MISSING");

const tokens=json("config/auth/example_tokens.json");
for(const tok of tokens.tokens||[]){
  if((tok.scopes||[]).includes("decision.eligibility.policy.declare")) fail("B09R_EXAMPLE_TOKEN_PREGRANT_FORBIDDEN");
}

const beforeReg=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const afterReg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const beforeElig=(beforeReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
const afterElig=(afterReg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
if(!beforeElig||!afterElig) fail("B09R_ELIGIBILITY_REGISTER_MISSING");
if(afterElig.notes.length!==beforeElig.notes.length+3) fail("B09R_ELIGIBILITY_NOTE_DELTA_INVALID");
if(JSON.stringify(afterElig.registered_producers)!==JSON.stringify(beforeElig.registered_producers)) fail("B09R_PRODUCERS_MUTATED");
if(JSON.stringify(afterElig.registered_consumers)!==JSON.stringify(beforeElig.registered_consumers)) fail("B09R_CONSUMERS_MUTATED");

const beforeG32=(beforeReg.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation");
const afterG32=(afterReg.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation");
if(!beforeG32||!afterG32||JSON.stringify(beforeG32)!==JSON.stringify(afterG32)) fail("B09R_G32_MUTATED");
if((afterG32.registered_paths||[]).length!==0) fail("B09R_POLICY_WRITER_REGISTERED_PREMATURELY");

const normalized=JSON.parse(JSON.stringify(afterReg));
const nElig=(normalized.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
nElig.notes=beforeElig.notes;
if(JSON.stringify(normalized)!==JSON.stringify(beforeReg)) fail("B09R_REGISTER_CHANGED_BEYOND_NOTES");

for(const p of[
  "config/auth/example_tokens.json",
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_evaluator_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"
]){
  if(read(p)!==cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"})) fail("B09R_FROZEN_SURFACE_MUTATED:"+p);
}

const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  "apps/server/db",
  "apps/server/src/routes",
  "apps/server/src/persistence",
  "apps/server/src/runtime",
  "apps/server/src/external_evidence",
  "packages",
  "config/auth",
  ".github/workflows",
  "docs/twin_kernel",
  "docs/digital_twin",
  "docker-compose.commercial_v1.yml"
],{encoding:"utf8"}).trim();
if(forbidden) fail("B09R_ROUTE_WRITER_RUNTIME_TOKEN_SCHEMA_WORKFLOW_TWIN_MCFT_MUTATION_FORBIDDEN:"+forbidden);

console.log("B09R_DEDICATED_SCOPE_AUTHORIZED_PASS");
console.log("B09R_AGRONOMIST_HUMAN_AUTHOR_AUTHORIZED_PASS");
console.log("B09R_ADMIN_PRODUCT_AUTHOR_FAIL_CLOSED_PASS");
console.log("B09R_SERVICE_PRINCIPAL_AUTHORSHIP_FORBIDDEN_PASS");
console.log("B09R_G32_ZERO_PATH_PRESERVED_PASS");
console.log("B09R_NO_POLICY_INSTANCE_OR_B07E_CONNECTION_PASS");
console.log("B09R_GOVERNANCE_ACCEPTANCE_PASS");
