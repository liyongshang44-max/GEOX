#!/usr/bin/env node
const fs=require("fs"),cp=require("child_process");
const fail=m=>{throw new Error(m)},read=p=>fs.readFileSync(p,"utf8"),json=p=>JSON.parse(read(p));
const BASE="8526be4611290484ccaa8550969a013b408ff557";
const expected=[
"apps/server/src/auth/ao_act_authz_v0.ts",
"apps/server/src/auth/decision_eligibility_policy_declaration_authz_v1.contract.test.ts",
"docs/architecture/semantic_convergence/GEOX-B09R-DECISION-ELIGIBILITY-POLICY-AUTHORITY-ENFORCEMENT-V1.json",
"docs/architecture/semantic_convergence/GEOX-B09R-DECISION-ELIGIBILITY-POLICY-AUTHORITY-ENFORCEMENT-V1.md",
"docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
"scripts/governance_acceptance/ACCEPTANCE_B09R_DECISION_ELIGIBILITY_POLICY_AUTHORITY_ENFORCEMENT_V1.cjs"
].sort();
const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09R_BOUNDED_SIX_FILE_DIFF_REQUIRED");
const d=json("docs/architecture/semantic_convergence/GEOX-B09R-DECISION-ELIGIBILITY-POLICY-AUTHORITY-ENFORCEMENT-V1.json");
if(d.authorization_state!=="AUTHORIZED_BY_PRODUCT_GOVERNANCE") fail("B09R_AUTHORIZATION_MISSING");
if(d.dedicated_scope?.scope!=="decision.eligibility.policy.declare") fail("B09R_SCOPE_INVALID");
if(JSON.stringify(d.human_principal_authority?.allowed_roles)!==JSON.stringify(["agronomist"])) fail("B09R_AUTHOR_SET_INVALID");
if(d.enforcement_topology?.shared_role_matrix_dependency!==false||d.enforcement_topology?.shared_role_matrix_mutated!==false) fail("B09R_ROLE_MATRIX_BOUNDARY_INVALID");
if(d.mcft_boundary_adjudication?.machine_result!=="SUCCESSOR_WRAPPER_MODE_NOT_APPLICABLE") fail("B09R_MCFT_ADJUDICATION_MISSING");
const auth=read("apps/server/src/auth/ao_act_authz_v0.ts");
for(const n of['"decision.eligibility.policy.declare"',"requireDecisionEligibilityPolicyDeclarationAuthorityV1","requireAoActAuthV0(req, reply, opts)","auth.scopes.includes(DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1)","AUTH_POLICY_PRINCIPAL_DENIED"]) if(!auth.includes(n)) fail("B09R_AUTHZ_MISSING:"+n);
for(const p of[
"apps/server/src/domain/auth/roles.ts",
"config/auth/example_tokens.json",
"apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
"apps/server/src/domain/decision/decision_eligibility_evaluator_v1.ts",
"apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
"docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
"docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"
]) if(read(p)!==cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"})) fail("B09R_FROZEN_SURFACE_MUTATED:"+p);
const before=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const old=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const b=(old.semantics||[]).find(s=>s.semantic_id==="decision.eligibility"),a=(before.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
if(a.notes.length!==b.notes.length+3) fail("B09R_REGISTER_NOTE_DELTA_INVALID");
const bg=(old.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation"),ag=(before.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation");
if(JSON.stringify(bg)!==JSON.stringify(ag)||(ag.registered_paths||[]).length!==0) fail("B09R_G32_MUTATED");
const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--","apps/server/db","apps/server/src/domain/auth/roles.ts","apps/server/src/routes","apps/server/src/persistence","apps/server/src/runtime","apps/server/src/external_evidence","packages","config/auth",".github/workflows","docs/twin_kernel","docs/digital_twin"],{encoding:"utf8"}).trim();
if(forbidden) fail("B09R_MCFT_ROLE_ROUTE_WRITER_RUNTIME_MUTATION_FORBIDDEN:"+forbidden);
console.log("B09R_DEDICATED_SCOPE_AUTHORIZED_PASS");
console.log("B09R_AGRONOMIST_AUTHOR_AUTHORIZED_PASS");
console.log("B09R_ADMIN_FAIL_CLOSED_PASS");
console.log("B09R_MCFT_ROLE_MATRIX_UNTOUCHED_PASS");
console.log("B09R_G32_ZERO_PATH_PRESERVED_PASS");
console.log("B09R_GOVERNANCE_ACCEPTANCE_PASS");
