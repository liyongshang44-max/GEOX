#!/usr/bin/env node
"use strict";
const fs=require("fs"),cp=require("child_process");
const fail=m=>{throw new Error(m)};
const read=p=>fs.readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));
const BASE="b9e0b3a3bb019c0333914e3cee432fd41d1a8228";

const expected=[
  "docs/architecture/semantic_convergence/GEOX-B09U-DECISION-ELIGIBILITY-POLICY-SELECTOR-DECISION-PACKAGE-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09U-DECISION-ELIGIBILITY-POLICY-SELECTOR-DECISION-PACKAGE-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09U_DECISION_ELIGIBILITY_POLICY_SELECTOR_DECISION_PACKAGE_V1.cjs"
].sort();

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09U_BOUNDED_FOUR_FILE_DIFF_REQUIRED");

const d=json(expected[0]);
if(d.schema_version!=="b09u_decision_eligibility_policy_selector_decision_package_v1") fail("B09U_SCHEMA_INVALID");
if(d.status!=="RECOMMENDED_NOT_AUTHORIZED") fail("B09U_STATUS_INVALID");
if(d.proposed_governance_decision_id!=="DEC-BLINE-ELIGIBILITY-POLICY-SELECTOR-001") fail("B09U_DECISION_ID_INVALID");
if(d.stacked_base_product_head!==BASE) fail("B09U_BASE_INVALID");
if(d.authorization_boundary?.selector_semantics_authorized!==false) fail("B09U_SELECTOR_SEMANTICS_PREMATURELY_AUTHORIZED");
if(d.authorization_boundary?.selector_runtime_authorized!==false) fail("B09U_SELECTOR_RUNTIME_PREMATURELY_AUTHORIZED");
if(d.authorization_boundary?.real_policy_content_authorized!==false) fail("B09U_REAL_POLICY_PREMATURELY_AUTHORIZED");
if(d.authorization_boundary?.b07e_connection_authorized!==false) fail("B09U_B07E_PREMATURELY_AUTHORIZED");

for(const id of["SEL-01","SEL-02","SEL-03","SEL-04","SEL-05","SEL-06"]){
  if(!(d.recommendations||[]).some(x=>x.id===id)) fail("B09U_MISSING_RECOMMENDATION:"+id);
}

const s1=d.recommendations.find(x=>x.id==="SEL-01");
if(s1.recommendation?.source!=="CANONICAL_CONTEXT_SNAPSHOT"||s1.recommendation?.assertion_kind!=="DECLARED_FIELD_PROGRAM"||s1.recommendation?.cardinality!=="EXACTLY_ONE_MATCHING_ASSERTION") fail("B09U_ANCHOR_RECOMMENDATION_INVALID");

const s2=d.recommendations.find(x=>x.id==="SEL-02");
if(s2.recommendation?.rule!=="EXACT_NULLABLE_STRUCTURAL_EQUALITY_V1"||s2.recommendation?.null_semantics!=="NULL_EQUALS_NULL_ONLY_NOT_WILDCARD"||s2.recommendation?.specificity_ranking!==false) fail("B09U_SCOPE_RECOMMENDATION_INVALID");

const s3=d.recommendations.find(x=>x.id==="SEL-03");
if(s3.recommendation?.source!=="CandidateDecisionV1.decision_time"||s3.recommendation?.required_non_null!==true||s3.recommendation?.fallback!==null) fail("B09U_TIME_RECOMMENDATION_INVALID");
if(JSON.stringify(s3.recommendation?.causal_cutoff)!==JSON.stringify(["declaration.declared_at <= decision_time","fact.occurred_at <= decision_time"])) fail("B09U_CAUSAL_CUTOFF_INVALID");

const s4=d.recommendations.find(x=>x.id==="SEL-04");
if(s4.recommendation?.more_than_one!=="POLICY_SCOPE_AMBIGUOUS"||s4.recommendation?.latest_wins!==false||s4.recommendation?.composition!==false) fail("B09U_MULTI_POLICY_RECOMMENDATION_INVALID");

const s5=d.recommendations.find(x=>x.id==="SEL-05");
if(s5.recommendation?.effective_window!=="HALF_OPEN_[effective_from,effective_until)") fail("B09U_WINDOW_INVALID");
if(s5.recommendation?.supersession?.same_policy_id_required!==true||s5.recommendation?.supersession?.same_scope_required!==true||s5.recommendation?.supersession?.same_anchor_required!==true||s5.recommendation?.supersession?.acyclic_chain_required!==true) fail("B09U_SUPERSESSION_RECOMMENDATION_INVALID");

const s6=d.recommendations.find(x=>x.id==="SEL-06");
if(s6.recommendation?.rule!=="EXACT_STRING_MEMBERSHIP") fail("B09U_ACTION_RULE_INVALID");

for(const p of[
  "apps/server/src/contracts/canonical_decision_v1.ts",
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
  "apps/server/src/context/field_program_context_projection_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_declaration_fact_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_evaluator_v1.ts",
  "apps/server/src/routes/decision_eligibility_policy_declarations_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"
]){
  if(read(p)!==cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"})) fail("B09U_FROZEN_SURFACE_MUTATED:"+p);
}

const before=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const after=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const b=(before.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
const a=(after.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
if(!a||!b||a.notes.length!==b.notes.length+4) fail("B09U_REGISTER_NOTE_DELTA_INVALID");
const normalized=JSON.parse(JSON.stringify(after));
(normalized.semantics||[]).find(s=>s.semantic_id==="decision.eligibility").notes=b.notes;
if(JSON.stringify(normalized)!==JSON.stringify(before)) fail("B09U_REGISTER_CHANGED_BEYOND_NOTES");

const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  "apps/server/src/auth",
  "apps/server/src/contracts",
  "apps/server/src/context",
  "apps/server/src/domain",
  "apps/server/src/routes",
  "apps/server/src/modules",
  "apps/server/db",
  "packages",
  "config",
  ".github/workflows",
  "docs/twin_kernel",
  "docs/digital_twin"
],{encoding:"utf8"}).trim();
if(forbidden) fail("B09U_RUNTIME_CONTRACT_CONTEXT_SCHEMA_MCFT_MUTATION_FORBIDDEN:"+forbidden);

console.log("B09U_CONTEXT_PROGRAM_ANCHOR_RECOMMENDED_NOT_AUTHORIZED_PASS");
console.log("B09U_EXACT_NULLABLE_SCOPE_RECOMMENDED_NOT_AUTHORIZED_PASS");
console.log("B09U_DECISION_TIME_CAUSAL_BOUNDARY_RECOMMENDED_NOT_AUTHORIZED_PASS");
console.log("B09U_MULTI_POLICY_FAIL_CLOSED_RECOMMENDED_NOT_AUTHORIZED_PASS");
console.log("B09U_HALF_OPEN_SUPERSESSION_RECOMMENDED_NOT_AUTHORIZED_PASS");
console.log("B09U_NO_SELECTOR_POLICY_INSTANCE_OR_B07E_CONNECTION_PASS");
console.log("B09U_GOVERNANCE_ACCEPTANCE_PASS");
