#!/usr/bin/env node
"use strict";

const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));
const BASE="65ac424bc663c8c8ec2f148c10bc7f2193eae255";

const expected=[
  "apps/server/src/domain/decision/decision_eligibility_policy_declaration_fact_v1.contract.test.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_declaration_fact_v1.ts",
  "apps/server/src/modules/decision/registerDecisionModule.ts",
  "apps/server/src/routes/decision_eligibility_policy_declarations_v1.contract.test.ts",
  "apps/server/src/routes/decision_eligibility_policy_declarations_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-B09S-DECISION-ELIGIBILITY-POLICY-DECLARATION-WRITER-ROUTE-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09S-DECISION-ELIGIBILITY-POLICY-DECLARATION-WRITER-ROUTE-V1.md",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09S_DECISION_ELIGIBILITY_POLICY_DECLARATION_WRITER_ROUTE_V1.cjs"
].sort();

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09S_BOUNDED_TEN_FILE_DIFF_REQUIRED");

const d=json("docs/architecture/semantic_convergence/GEOX-B09S-DECISION-ELIGIBILITY-POLICY-DECLARATION-WRITER-ROUTE-V1.json");
if(d.status!=="IMPLEMENTED_AUTHORIZED_APPEND_ONLY_WRITER_NO_POLICY_INSTANCE") fail("B09S_STATUS_INVALID");
if(d.authority_source?.dedicated_capability!=="decision.eligibility.policy.declare") fail("B09S_CAPABILITY_INVALID");
if(d.authority_source?.authorized_human_role!=="agronomist") fail("B09S_ROLE_INVALID");
if(d.persistence?.append_only!==true||d.persistence?.update_delete!==false||d.persistence?.latest_wins!==false) fail("B09S_APPEND_ONLY_BOUNDARY_INVALID");
if(d.intentionally_absent?.repository_policy_instance!==false) fail("B09S_POLICY_INSTANCE_FLAG_INVALID");
if(d.intentionally_absent?.b07e_connection!==false) fail("B09S_B07E_MUST_REMAIN_DISCONNECTED");

const writer=read("apps/server/src/domain/decision/decision_eligibility_policy_declaration_fact_v1.ts");
for(const n of[
  "appendDecisionEligibilityPolicyDeclarationFactV1",
  "decisionEligibilityPolicyDeclarationV1Schema.parse(",
  "pg_advisory_xact_lock(hashtext($1))",
  "ORDER BY occurred_at ASC",
  "LIMIT 2",
  "POLICY_REF_CONFLICT",
  "POLICY_REF_AMBIGUOUS",
  "AUTHORIZED_HUMAN_API",
  "POLICY_DECLARATION_ONLY",
  "changed_by_actor_id",
  "changed_by_token_id",
  "change_reason",
  "INSERT INTO facts"
]) if(!writer.includes(n)) fail("B09S_WRITER_FINGERPRINT_MISSING:"+n);
if(/\bUPDATE\s+facts\b/i.test(writer)||/\bDELETE\s+FROM\s+facts\b/i.test(writer)) fail("B09S_FACT_MUTATION_FORBIDDEN");
if(/ORDER BY occurred_at DESC[\s\S]{0,100}LIMIT 1/i.test(writer)) fail("B09S_LATEST_WINS_FORBIDDEN");

const route=read("apps/server/src/routes/decision_eligibility_policy_declarations_v1.ts");
for(const n of[
  '"/api/v1/decision-eligibility/policy-declarations"',
  "requireDecisionEligibilityPolicyDeclarationAuthorityV1",
  "appendDecisionEligibilityPolicyDeclarationFactV1"
]) if(!route.includes(n)) fail("B09S_ROUTE_FINGERPRINT_MISSING:"+n);
for(const forbidden of[
  "evaluateDecisionEligibilityRuntimeV1",
  "evaluateDecisionEligibilityV1",
  "approval.decide",
  "action.task.dispatch"
]) if(route.includes(forbidden)||writer.includes(forbidden)) fail("B09S_AUTHORITY_LEAK:"+forbidden);

const moduleText=read("apps/server/src/modules/decision/registerDecisionModule.ts");
if(!moduleText.includes("registerDecisionEligibilityPolicyDeclarationV1Routes(app, pool)")) fail("B09S_ROUTE_NOT_REGISTERED");

for(const p of[
  "apps/server/src/auth/ao_act_authz_v0.ts",
  "apps/server/src/domain/auth/roles.ts",
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_evaluator_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "config/auth/example_tokens.json",
  "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"
]){
  if(read(p)!==cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"})) fail("B09S_FROZEN_SURFACE_MUTATED:"+p);
}

const reg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const eligibility=(reg.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
const producer=(eligibility.registered_producers||[]).find(p=>p.producer_id==="decision-eligibility-policy-declaration-writer-v1");
const consumer=(eligibility.registered_consumers||[]).find(c=>c.consumer_id==="decision-eligibility-policy-declaration-route-v1");
if(!producer||!consumer) fail("B09S_PRODUCER_CONSUMER_NOT_REGISTERED");
if(producer.connection_class!=="ROUTE_ISLAND"||producer.activation!=="API_ONLY"||producer.runtime_edge!=="PROVEN") fail("B09S_PRODUCER_CONNECTIVITY_INVALID");
const rc=(eligibility.runtime_consumers||[]).find(c=>c.consumer_id==="decision-eligibility-policy-declaration-route-v1");
if(!rc||rc.evidence_edge_id!=="C-045") fail("B09S_RUNTIME_CONSUMER_EDGE_INVALID");

const g32=(reg.static_guards||[]).find(g=>g.guard_id==="G-B02-32-decision-eligibility-policy-declaration-instantiation");
const writerPath="apps/server/src/domain/decision/decision_eligibility_policy_declaration_fact_v1.ts";
if(JSON.stringify(g32.registered_paths)!==JSON.stringify([writerPath])) fail("B09S_G32_EXACT_SINGLE_WRITER_REQUIRED");

const graph=json("docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");
const edge=(graph.current_connectivity_edges||[]).find(e=>e.edge_id==="C-045");
if(!edge||edge.from_producer!=="decision-eligibility-policy-declaration-writer-v1"||edge.to_consumer!=="decision-eligibility-policy-declaration-route-v1"||edge.runtime_edge!=="PROVEN") fail("B09S_C045_INVALID");

const productionMatches=cp.execFileSync("git",["grep","-l","decisionEligibilityPolicyDeclarationV1Schema.parse(","--","apps/server/src"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean)
  .filter((p)=>!p.endsWith(".test.ts")&&!p.endsWith(".acceptance.test.ts"));
if(JSON.stringify(productionMatches)!==JSON.stringify([writerPath])) fail("B09S_UNIQUE_PRODUCTION_INSTANTIATION_REQUIRED:"+productionMatches.join(","));

const forbiddenDiff=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  "apps/server/db",
  "apps/server/src/domain/auth/roles.ts",
  "apps/server/src/persistence/twin_runtime",
  "apps/server/src/runtime/twin_runtime",
  "apps/server/src/external_evidence",
  "config/auth",
  ".github/workflows",
  "docs/twin_kernel",
  "docs/digital_twin",
  "docker-compose.commercial_v1.yml"
],{encoding:"utf8"}).trim();
if(forbiddenDiff) fail("B09S_MCFT_SCHEMA_ROLE_TWIN_RUNTIME_MUTATION_FORBIDDEN:"+forbiddenDiff);

console.log("B09S_AUTHORIZED_ROUTE_GATE_PASS");
console.log("B09S_APPEND_ONLY_FACT_WRITER_PASS");
console.log("B09S_GLOBAL_POLICY_REF_FAIL_CLOSED_PASS");
console.log("B09S_SERVER_DERIVED_PROVENANCE_AUTHORITY_PASS");
console.log("B09S_G32_SINGLE_PRODUCTION_PATH_PASS");
console.log("B09S_C045_ROUTE_WRITER_EDGE_PASS");
console.log("B09S_NO_POLICY_INSTANCE_OR_B07E_CONNECTION_PASS");
console.log("B09S_GOVERNANCE_ACCEPTANCE_PASS");
