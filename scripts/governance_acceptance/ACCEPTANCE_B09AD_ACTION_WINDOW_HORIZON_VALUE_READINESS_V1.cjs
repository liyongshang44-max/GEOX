#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const cp=require("node:child_process");
const BASE="6787989f509d96ffb0500ad7999955189b5a76c2";
const expected=[
  "docs/architecture/semantic_convergence/GEOX-B09AD-ACTION-WINDOW-HORIZON-VALUE-READINESS-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09AD-ACTION-WINDOW-HORIZON-VALUE-READINESS-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09AD_ACTION_WINDOW_HORIZON_VALUE_READINESS_V1.cjs",
].sort();

function fail(m){console.error(m);process.exit(1);}
function read(p){return fs.readFileSync(p,"utf8");}
function json(p){return JSON.parse(read(p));}
function base(p){return cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"});}

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09AD_BOUNDED_FOUR_FILE_DIFF_REQUIRED:"+JSON.stringify(changed));

const pkg=json(expected[0]);
if(pkg.schema_version!=="b09ad_action_window_horizon_value_readiness_v1") fail("B09AD_SCHEMA_INVALID");
if(pkg.phase!=="B-09ad") fail("B09AD_PHASE_INVALID");
if(pkg.status!=="ANALYSIS_ONLY_NUMERIC_HORIZON_NOT_READY") fail("B09AD_STATUS_INVALID");
if(pkg.stacked_base_product_head!==BASE) fail("B09AD_BASE_INVALID");
if(pkg.bounded_action!=="IRRIGATE") fail("B09AD_ACTION_INVALID");

const n=pkg.current_numeric_selection||{};
for(const k of ["start_offset_seconds","duration_seconds","minimum_duration_seconds","maximum_duration_seconds"]){
  if(n[k]!==null) fail("B09AD_NUMERIC_VALUE_PREMATURE:"+k);
}
if(n.status!=="NOT_SELECTED") fail("B09AD_NUMERIC_STATUS_INVALID");

const dims=new Map((pkg.readiness_dimensions||[]).map(x=>[x.dimension,x]));
for(const d of [
  "ACTION_WINDOW_SEMANTICS",
  "HORIZON_AUTHORITY_TOPOLOGY",
  "SUCCESSOR_POLICY_CONTRACT_SHAPE",
  "CANONICAL_DECISION_TIME",
  "ACTION_SPECIFIC_AGRONOMIC_HORIZON_SOURCE",
  "CANONICAL_INPUT_EXPIRY",
  "CANONICAL_FORECAST_BINDING",
  "REEVALUATION_OR_REFRESH_POLICY",
  "DOWNSTREAM_EXECUTION_WINDOWS"
]){
  if(!dims.has(d)) fail("B09AD_READINESS_DIMENSION_MISSING:"+d);
}
if(dims.get("ACTION_SPECIFIC_AGRONOMIC_HORIZON_SOURCE")?.state!=="MISSING") fail("B09AD_ACTION_SPECIFIC_SOURCE_OVERCLAIMED");
if(dims.get("CANONICAL_INPUT_EXPIRY")?.state!=="NOT_DEFINED") fail("B09AD_VALID_UNTIL_OVERCLAIMED");
if(dims.get("CANONICAL_FORECAST_BINDING")?.state!=="FROZEN_EXTERNAL_DEPENDENCY") fail("B09AD_FORECAST_NOT_FROZEN");
if(dims.get("DOWNSTREAM_EXECUTION_WINDOWS")?.state!=="AVAILABLE_BUT_INELIGIBLE_AS_SOURCE") fail("B09AD_DOWNSTREAM_SOURCE_INVALID");

const nonEvidence=new Map((pkg.explicit_non_evidence||[]).map(x=>[x.candidate,x]));
for(const c of [
  "72h weather forecast input horizon",
  "FieldProgram max_irrigation_mm_per_day",
  "FieldProgram allow_night_irrigation",
  "policy effective_until",
  "EvidenceQualification STALE/ELIGIBLE state",
  "AO-ACT task time window",
  "fixed engineering convenience such as 6h/12h/24h"
]){
  if(!nonEvidence.has(c)) fail("B09AD_NON_EVIDENCE_MISSING:"+c);
}

const a=pkg.adjudication||{};
if(a.numeric_horizon_ready!==false) fail("B09AD_NUMERIC_READY_OVERCLAIM");
if(a.blocker_code!=="NO_AUTHORIZED_ACTION_SPECIFIC_HORIZON_VALUE_BASIS") fail("B09AD_BLOCKER_INVALID");
if(a.fail_closed_rule!=="DO_NOT_SELECT_OR_BACKFILL_NUMERIC_HORIZON") fail("B09AD_FAIL_CLOSED_INVALID");
if(a.current_safe_state!=="ACTION_WINDOW_HORIZON_VALUE_UNDECIDED") fail("B09AD_SAFE_STATE_INVALID");
if(!String(a.b07e_implication||"").includes("cannot be canonically SATISFIED")) fail("B09AD_B07E_IMPLICATION_MISSING");

const g=pkg.recommended_next_gate||{};
if(g.recommendation!=="DO_NOT_CHOOSE_NUMERIC_VALUE_YET") fail("B09AD_RECOMMENDATION_INVALID");
if(g.not_authorized_by_b09ad!==true) fail("B09AD_RECOMMENDATION_MUST_NOT_AUTHORIZE");

for(const k of ["runtime_change","schema_change","db_change","route_change","graph_edge_change","policy_value_change","numeric_horizon_selected","policy_fact_written","action_window_producer","b07e_connection","mcft_change","authority_removal"]){
  if(pkg.non_effects?.[k]!==false) fail("B09AD_NON_EFFECT_INVALID:"+k);
}

const md=read(expected[1]);
for(const marker of [
  "ANALYSIS_ONLY_NUMERIC_HORIZON_NOT_READY",
  "The answer is:",
  "NO_AUTHORIZED_ACTION_SPECIFIC_HORIZON_VALUE_BASIS",
  "DO_NOT_SELECT_OR_BACKFILL_NUMERIC_HORIZON",
  "DO_NOT_CHOOSE_NUMERIC_VALUE_YET",
  "This recommendation is not authorization"
]){
  if(!md.includes(marker)) fail("B09AD_MD_MARKER_MISSING:"+marker);
}

const current=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const previous=JSON.parse(base("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"));
if(JSON.stringify(current.static_guards)!==JSON.stringify(previous.static_guards)) fail("B09AD_STATIC_GUARDS_MUTATED");
const ce=current.semantics.find(s=>s.semantic_id==="decision.eligibility");
const pe=previous.semantics.find(s=>s.semantic_id==="decision.eligibility");
for(const key of ["registered_producers","registered_consumers","runtime_consumers"]){
  if(JSON.stringify(ce?.[key])!==JSON.stringify(pe?.[key])) fail("B09AD_CONNECTIVITY_MUTATED:"+key);
}
const nc=JSON.parse(JSON.stringify(current));
const np=JSON.parse(JSON.stringify(previous));
nc.semantics.find(s=>s.semantic_id==="decision.eligibility").notes=np.semantics.find(s=>s.semantic_id==="decision.eligibility").notes;
if(JSON.stringify(nc)!==JSON.stringify(np)) fail("B09AD_REGISTER_MUTATION_MUST_BE_NOTES_ONLY");

for(const path of [
  "apps/server/src/domain/agronomy/skills/irrigation/irrigation_requirement_skill_v1.ts",
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
  "apps/server/src/contracts/canonical_evidence_v1.ts",
  "apps/server/src/contracts/canonical_context_v1.ts",
  "apps/server/src/contracts/canonical_decision_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "docs/twin_kernel/P47_AO_ACT_TIME_WINDOW_POLICY_V0.json",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json"
]){
  if(read(path)!==base(path)) fail("B09AD_FROZEN_SURFACE_MUTATED:"+path);
}

const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  ".github/workflows","apps/server/src","apps/server/db","packages","config",
  "docs/digital_twin","docs/twin_kernel","scripts/runtime_acceptance"
],{encoding:"utf8"}).trim();
if(forbidden) fail("B09AD_PRODUCTION_OR_MCFT_MUTATION_FORBIDDEN:"+forbidden);

console.log("B09AD_NO_NUMERIC_HORIZON_AUTHORITY_PASS");
console.log("B09AD_FORECAST_72H_NOT_NUMERIC_POLICY_PASS");
console.log("B09AD_NO_COMMON_VALID_UNTIL_PASS");
console.log("B09AD_DOWNSTREAM_WINDOWS_NOT_SOURCE_PASS");
console.log("B09AD_DO_NOT_CHOOSE_NUMERIC_VALUE_YET_PASS");
console.log("B09AD_NO_RUNTIME_OR_MCFT_EFFECT_PASS");
