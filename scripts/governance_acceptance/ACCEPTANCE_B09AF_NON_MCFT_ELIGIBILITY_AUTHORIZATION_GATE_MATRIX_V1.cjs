#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const cp=require("node:child_process");
const BASE="6c102cb8ef7c361a3cc0ca9fbf04b22b659b8fe8";
const expected=[
  "docs/architecture/semantic_convergence/GEOX-B09AF-NON-MCFT-ELIGIBILITY-AUTHORIZATION-GATE-MATRIX-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09AF-NON-MCFT-ELIGIBILITY-AUTHORIZATION-GATE-MATRIX-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09AF_NON_MCFT_ELIGIBILITY_AUTHORIZATION_GATE_MATRIX_V1.cjs",
].sort();

const fail=m=>{console.error(m);process.exit(1)};
const read=p=>fs.readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));
const base=p=>cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"});

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09AF_BOUNDED_FOUR_FILE_DIFF_REQUIRED:"+JSON.stringify(changed));

const pkg=json(expected[0]);
if(pkg.schema_version!=="b09af_non_mcft_eligibility_authorization_gate_matrix_v1") fail("B09AF_SCHEMA_INVALID");
if(pkg.phase!=="B-09af"||pkg.status!=="ANALYSIS_ONLY_AUTHORIZATION_MATRIX") fail("B09AF_STATUS_INVALID");
if(pkg.stacked_base_product_head!==BASE) fail("B09AF_BASE_INVALID");

const gates=pkg.immediate_non_mcft_authorization_gates||[];
if(gates.length!==2) fail("B09AF_TWO_IMMEDIATE_GATES_REQUIRED");
if(gates[0]?.priority!==1||gates[0]?.decision_id!=="DEC-BLINE-IRRIGATE-STATE-CALCULATION-SHADOW-BINDING-001") fail("B09AF_PRIORITY1_INVALID");
if(gates[1]?.priority!==2||gates[1]?.decision_id!=="DEC-BLINE-CANDIDATE-DECISION-BOUNDARY-001") fail("B09AF_PRIORITY2_INVALID");

const later=new Set((pkg.qualified_but_not_immediately_actionable||[]).map(x=>x.decision_id));
for(const id of [
  "DEC-BLINE-IRRIGATE-ELIGIBILITY-POLICY-CONTENT-001",
  "DEC-BLINE-ACTION-WINDOW-SEMANTICS-001",
  "DEC-BLINE-ACTION-WINDOW-HORIZON-AUTHORITY-TOPOLOGY-001",
  "DEC-BLINE-ELIGIBILITY-POLICY-V2-ACTION-WINDOW-CONTRACT-001"
]) if(!later.has(id)) fail("B09AF_LATER_GATE_MISSING:"+id);

const blockers=new Map((pkg.hard_blockers||[]).map(x=>[x.item,x.blocker]));
if(blockers.get("ACTION_WINDOW_NUMERIC_HORIZON")!=="NO_AUTHORIZED_ACTION_SPECIFIC_HORIZON_VALUE_BASIS") fail("B09AF_ACTION_WINDOW_BLOCKER_INVALID");
if(blockers.get("FORECAST")!=="FROZEN_EXTERNAL_DEPENDENCY") fail("B09AF_FORECAST_BLOCKER_INVALID");

if(pkg.final_connection_gate?.state!=="DISCONNECTED") fail("B09AF_B07E_MUST_REMAIN_DISCONNECTED");
if(pkg.final_connection_gate?.authorization!=="SEPARATE_EXPLICIT_AUTHORIZATION_REQUIRED") fail("B09AF_B07E_AUTHORIZATION_INVALID");

if(pkg.authorization_semantics?.generic_continue_is_not_authorization!==true) fail("B09AF_GENERIC_CONTINUE_BOUNDARY_MISSING");
if(pkg.authorization_semantics?.no_decision_is_authorized_by_b09af!==true) fail("B09AF_MATRIX_MUST_NOT_AUTHORIZE");

for(const k of ["runtime_change","schema_change","db_change","route_change","graph_edge_change","policy_change","authorization_granted","b07e_connection","mcft_change","authority_removal"]){
  if(pkg.non_effects?.[k]!==false) fail("B09AF_NON_EFFECT_INVALID:"+k);
}

const md=read(expected[1]);
for(const marker of [
  "ANALYSIS_ONLY_AUTHORIZATION_MATRIX",
  "Priority 1 — B-09ae STATE shadow binding",
  "Priority 2 — B-09y decision boundary",
  "NO_AUTHORIZED_ACTION_SPECIFIC_HORIZON_VALUE_BASIS",
  "FROZEN_EXTERNAL_DEPENDENCY",
  "B-07e remains last",
  "generic `continue` instruction is not treated as authorization"
]) if(!md.includes(marker)) fail("B09AF_MD_MARKER_MISSING:"+marker);

const current=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const previous=JSON.parse(base("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"));
if(JSON.stringify(current.static_guards)!==JSON.stringify(previous.static_guards)) fail("B09AF_STATIC_GUARDS_MUTATED");
const ce=current.semantics.find(x=>x.semantic_id==="decision.eligibility");
const pe=previous.semantics.find(x=>x.semantic_id==="decision.eligibility");
for(const key of ["registered_producers","registered_consumers","runtime_consumers"]){
  if(JSON.stringify(ce?.[key])!==JSON.stringify(pe?.[key])) fail("B09AF_CONNECTIVITY_MUTATED:"+key);
}
const nc=JSON.parse(JSON.stringify(current));
const np=JSON.parse(JSON.stringify(previous));
nc.semantics.find(x=>x.semantic_id==="decision.eligibility").notes=np.semantics.find(x=>x.semantic_id==="decision.eligibility").notes;
if(JSON.stringify(nc)!==JSON.stringify(np)) fail("B09AF_REGISTER_MUTATION_MUST_BE_ELIGIBILITY_NOTES_ONLY");

for(const p of [
  "apps/server/src/domain/decision/irrigation_calculation_result_adapter_v1.ts",
  "apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_selector_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json"
]) if(read(p)!==base(p)) fail("B09AF_FROZEN_SURFACE_MUTATED:"+p);

const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  ".github/workflows","apps/server/src","apps/server/db","packages","config","docs/digital_twin","docs/twin_kernel","scripts/runtime_acceptance"
],{encoding:"utf8"}).trim();
if(forbidden) fail("B09AF_PRODUCTION_OR_MCFT_MUTATION_FORBIDDEN:"+forbidden);

console.log("B09AF_MINIMAL_AUTHORIZATION_SEQUENCE_PASS");
console.log("B09AF_STATE_FIRST_DECISION_BOUNDARY_SECOND_PASS");
console.log("B09AF_ACTION_WINDOW_NUMERIC_BLOCKER_PRESERVED_PASS");
console.log("B09AF_FORECAST_MCFT_BLOCKER_PRESERVED_PASS");
console.log("B09AF_B07E_LAST_AND_DISCONNECTED_PASS");
console.log("B09AF_NO_AUTHORIZATION_GRANTED_PASS");
