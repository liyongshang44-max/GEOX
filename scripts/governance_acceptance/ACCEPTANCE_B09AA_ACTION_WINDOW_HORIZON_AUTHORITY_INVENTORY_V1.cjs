#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const cp=require("node:child_process");
const BASE="4ab816a5cd612392b8d47e8849754d017418beca";
const expected=[
  "docs/architecture/semantic_convergence/GEOX-B09AA-ACTION-WINDOW-HORIZON-AUTHORITY-INVENTORY-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09AA-ACTION-WINDOW-HORIZON-AUTHORITY-INVENTORY-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09AA_ACTION_WINDOW_HORIZON_AUTHORITY_INVENTORY_V1.cjs",
].sort();

function fail(m){console.error(m);process.exit(1);}
function read(p){return fs.readFileSync(p,"utf8");}
function json(p){return JSON.parse(read(p));}
function base(p){return cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"});}

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09AA_BOUNDED_FOUR_FILE_DIFF_REQUIRED:"+JSON.stringify(changed));

const pkg=json(expected[0]);
if(pkg.schema_version!=="b09aa_action_window_horizon_authority_inventory_v1") fail("B09AA_SCHEMA_INVALID");
if(pkg.phase!=="B-09aa") fail("B09AA_PHASE_INVALID");
if(pkg.status!=="ANALYSIS_ONLY_NO_HORIZON_AUTHORITY_SELECTED") fail("B09AA_STATUS_INVALID");
if(pkg.stacked_base_product_head!==BASE) fail("B09AA_BASE_INVALID");
if(pkg.current_authorized_horizon_source!=="NONE") fail("B09AA_HORIZON_SOURCE_OVERCLAIMED");

const byId=new Map((pkg.observed_sources||[]).map(x=>[x.source_id,x]));
for(const id of [
  "IRRIGATION_SKILL_72H_FORECAST_INPUT",
  "FIELD_PROGRAM_CONSTRAINTS",
  "ELIGIBILITY_POLICY_EFFECTIVE_WINDOW",
  "CANONICAL_EVIDENCE_TEMPORAL_ELIGIBILITY",
  "CANONICAL_CONTEXT_CALCULATION_CANDIDATE",
  "PROBLEM_STATE_WINDOW",
  "TWIN_P35_CANDIDATE_POINTER_USE_WINDOW",
  "TWIN_P44_ACTIVATION_WINDOW",
  "AO_ACT_P47_TIME_WINDOW",
  "MCFT_TWIN_SCIENTIFIC_RUNTIME_WINDOWS"
]){
  if(!byId.has(id)) fail("B09AA_SOURCE_MISSING:"+id);
}
if(byId.get("IRRIGATION_SKILL_72H_FORECAST_INPUT")?.action_window_authority!=="FORBIDDEN_IMPLICIT_PROMOTION") fail("B09AA_72H_FORECAST_PROMOTION_NOT_FORBIDDEN");
if(byId.get("ELIGIBILITY_POLICY_EFFECTIVE_WINDOW")?.action_window_authority!=="FORBIDDEN_REUSE") fail("B09AA_POLICY_WINDOW_REUSE_NOT_FORBIDDEN");
if(byId.get("CANONICAL_EVIDENCE_TEMPORAL_ELIGIBILITY")?.action_window_authority!=="INSUFFICIENT") fail("B09AA_EVIDENCE_TTL_OVERCLAIMED");
if(byId.get("AO_ACT_P47_TIME_WINDOW")?.action_window_authority!=="FORBIDDEN_REUSE") fail("B09AA_AOACT_WINDOW_REUSE_NOT_FORBIDDEN");
if(byId.get("MCFT_TWIN_SCIENTIFIC_RUNTIME_WINDOWS")?.action_window_authority!=="FORBIDDEN_REUSE_AND_FROZEN") fail("B09AA_MCFT_WINDOW_REUSE_NOT_FROZEN");

const rejected=new Map((pkg.rejected_derivations||[]).map(x=>[x.derivation,x]));
for(const d of [
  "ActionWindow duration = 72 hours because forecast input is 72h",
  "ActionWindow end = policy effective_until",
  "ActionWindow end = minimum canonical input valid_until",
  "ActionWindow duration = fixed 6h/12h/24h constant",
  "ActionWindow = downstream AO-ACT task window"
]){
  if(!rejected.has(d)) fail("B09AA_REJECTED_DERIVATION_MISSING:"+d);
}
if(rejected.get("ActionWindow end = minimum canonical input valid_until")?.verdict!=="NOT_CURRENTLY_DEFINED") fail("B09AA_COMMON_VALID_UNTIL_OVERCLAIMED");

const gate=pkg.recommendation_for_next_governance_gate||{};
if(gate.recommendation!=="START_WITH_EXPLICIT_POLICY_ONLY_V1") fail("B09AA_NEXT_RECOMMENDATION_INVALID");
if(gate.not_authorized_by_b09aa!==true) fail("B09AA_RECOMMENDATION_MUST_NOT_AUTHORIZE");

for(const k of ["runtime_change","schema_change","db_change","route_change","graph_edge_change","policy_change","horizon_source_selected","action_window_producer","b07e_connection","mcft_change","authority_removal"]){
  if(pkg.non_effects?.[k]!==false) fail("B09AA_NON_EFFECT_INVALID:"+k);
}

const md=read(expected[1]);
for(const marker of [
  "ANALYSIS_ONLY_NO_HORIZON_AUTHORITY_SELECTED",
  "Current authorized ActionWindow horizon source:",
  "72h forecast horizon != 72h ActionWindow",
  "no canonical `valid_until` or `expires_at` authority",
  "START_WITH_EXPLICIT_POLICY_ONLY_V1",
  "This recommendation is not authorization"
]){
  if(!md.includes(marker)) fail("B09AA_MD_MARKER_MISSING:"+marker);
}

const current=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const previous=JSON.parse(base("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"));
if(JSON.stringify(current.static_guards)!==JSON.stringify(previous.static_guards)) fail("B09AA_STATIC_GUARDS_MUTATED");
const ce=current.semantics.find(s=>s.semantic_id==="decision.eligibility");
const pe=previous.semantics.find(s=>s.semantic_id==="decision.eligibility");
for(const key of ["registered_producers","registered_consumers","runtime_consumers"]){
  if(JSON.stringify(ce?.[key])!==JSON.stringify(pe?.[key])) fail("B09AA_CONNECTIVITY_MUTATED:"+key);
}
const nc=JSON.parse(JSON.stringify(current));
const np=JSON.parse(JSON.stringify(previous));
nc.semantics.find(s=>s.semantic_id==="decision.eligibility").notes=np.semantics.find(s=>s.semantic_id==="decision.eligibility").notes;
if(JSON.stringify(nc)!==JSON.stringify(np)) fail("B09AA_REGISTER_MUTATION_MUST_BE_NOTES_ONLY");

for(const path of [
  "apps/server/src/domain/agronomy/skills/irrigation/irrigation_requirement_skill_v1.ts",
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
  "apps/server/src/contracts/canonical_evidence_v1.ts",
  "apps/server/src/contracts/canonical_context_v1.ts",
  "apps/server/src/contracts/canonical_decision_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "docs/twin_kernel/P35_CANDIDATE_EXPIRY_USE_WINDOW_POLICY_V0.json",
  "docs/twin_kernel/P44_ACTIVATION_WINDOW_CANARY_POLICY_V0.json",
  "docs/twin_kernel/P47_AO_ACT_TIME_WINDOW_POLICY_V0.json",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json"
]){
  if(read(path)!==base(path)) fail("B09AA_FROZEN_SURFACE_MUTATED:"+path);
}

const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  ".github/workflows","apps/server/src","apps/server/db","packages","config",
  "docs/digital_twin","docs/twin_kernel","scripts/runtime_acceptance"
],{encoding:"utf8"}).trim();
if(forbidden) fail("B09AA_PRODUCTION_OR_MCFT_MUTATION_FORBIDDEN:"+forbidden);

console.log("B09AA_NO_EXISTING_HORIZON_AUTHORITY_PASS");
console.log("B09AA_72H_FORECAST_NOT_ACTION_WINDOW_PASS");
console.log("B09AA_POLICY_EFFECTIVE_WINDOW_NOT_ACTION_WINDOW_PASS");
console.log("B09AA_NO_COMMON_CANONICAL_VALID_UNTIL_PASS");
console.log("B09AA_DOWNSTREAM_TWIN_MCFT_WINDOWS_REJECTED_PASS");
console.log("B09AA_EXPLICIT_POLICY_ONLY_V1_RECOMMENDED_NOT_AUTHORIZED_PASS");
