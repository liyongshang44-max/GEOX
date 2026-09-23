#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const cp=require("node:child_process");
const BASE="93b00ec51eca95b6388f236ce73b4fa6d4e10c49";
const expected=[
  "docs/architecture/semantic_convergence/GEOX-B09AB-ACTION-WINDOW-HORIZON-AUTHORITY-TOPOLOGY-DECISION-PACKAGE-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09AB-ACTION-WINDOW-HORIZON-AUTHORITY-TOPOLOGY-DECISION-PACKAGE-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09AB_ACTION_WINDOW_HORIZON_AUTHORITY_TOPOLOGY_V1.cjs",
].sort();

function fail(m){console.error(m);process.exit(1);}
function read(p){return fs.readFileSync(p,"utf8");}
function json(p){return JSON.parse(read(p));}
function base(p){return cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"});}

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09AB_BOUNDED_FOUR_FILE_DIFF_REQUIRED:"+JSON.stringify(changed));

const pkg=json(expected[0]);
if(pkg.schema_version!=="b09ab_action_window_horizon_authority_topology_decision_package_v1") fail("B09AB_SCHEMA_INVALID");
if(pkg.phase!=="B-09ab") fail("B09AB_PHASE_INVALID");
if(pkg.status!=="RECOMMENDED_NOT_AUTHORIZED") fail("B09AB_STATUS_INVALID");
if(pkg.stacked_base_product_head!==BASE) fail("B09AB_BASE_INVALID");
if(pkg.decision_id!=="DEC-BLINE-ACTION-WINDOW-HORIZON-AUTHORITY-TOPOLOGY-001") fail("B09AB_DECISION_ID_INVALID");

const t=pkg.proposed_topology||{};
if(t.authority_owner!=="Decision Eligibility policy content") fail("B09AB_OWNER_INVALID");
if(t.topology!=="SUCCESSOR_ELIGIBILITY_POLICY_CONTRACT_EMBEDDED_HORIZON") fail("B09AB_TOPOLOGY_INVALID");
if(t.separate_parallel_horizon_policy_family!=="NOT_RECOMMENDED_V1") fail("B09AB_PARALLEL_POLICY_NOT_REJECTED");
for(const k of ["field_program_embedding","ao_act_execution_policy_embedding","mcft_twin_policy_embedding"]){
  if(t[k]!=="FORBIDDEN") fail("B09AB_FORBIDDEN_EMBEDDING_MISSING:"+k);
}

const c=pkg.contract_evolution_rule||{};
if(c.existing_contract_status!=="IMMUTABLE_PREDECESSOR_V1") fail("B09AB_V1_IMMUTABILITY_MISSING");
if(c.mutate_existing_v1_in_place!==false) fail("B09AB_V1_INPLACE_MUTATION_FORBIDDEN");
if(c.hidden_backfill_forbidden!==true) fail("B09AB_HIDDEN_BACKFILL_FORBIDDEN");
if(!String(c.action_window_requirement_rule||"").includes("absence fails closed")) fail("B09AB_ACTION_WINDOW_HORIZON_FAIL_CLOSED_MISSING");

const p=pkg.horizon_provenance_rule||{};
if(p.selected_policy_ref_required!==true||p.exact_selected_policy_fact_ref_required!==true) fail("B09AB_POLICY_PROVENANCE_REQUIRED");
if(p.independent_latest_horizon_lookup_forbidden!==true) fail("B09AB_LATEST_HORIZON_LOOKUP_FORBIDDEN");
for(const k of ["fallback_to_field_program_forbidden","fallback_to_ao_act_forbidden","fallback_to_mcft_window_forbidden"]){
  if(p[k]!==true) fail("B09AB_FALLBACK_FORBIDDEN_MISSING:"+k);
}

const v=pkg.value_semantics||{};
for(const k of ["concrete_duration_selected","fixed_duration_mode_selected","start_offset_selected","unit_selected","min_or_max_duration_selected","dynamic_agronomic_shortening_selected"]){
  if(v[k]!==false) fail("B09AB_VALUE_PREMATURELY_SELECTED:"+k);
}

for(const k of ["runtime_change","schema_change","db_change","route_change","graph_edge_change","existing_policy_contract_change","policy_fact_written","horizon_value_selected","action_window_producer","b07e_connection","mcft_change","authority_removal"]){
  if(pkg.non_effects?.[k]!==false) fail("B09AB_NON_EFFECT_INVALID:"+k);
}

const md=read(expected[1]);
for(const marker of [
  "RECOMMENDED_NOT_AUTHORIZED",
  "SUCCESSOR_ELIGIBILITY_POLICY_CONTRACT_EMBEDDED_HORIZON",
  "Why not a separate horizon-policy family",
  "Existing v1 contract remains immutable",
  "Numerical value is deliberately undecided",
  "MCFT-9 is COMPLETE"
]){
  if(marker==="MCFT-9 is COMPLETE") continue;
  if(!md.includes(marker)) fail("B09AB_MD_MARKER_MISSING:"+marker);
}
if(!md.includes("Forecast-dependent dynamic shortening remains blocked until MCFT-9 is COMPLETE")) fail("B09AB_MCFT_FUTURE_GATE_MISSING");

const current=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const previous=JSON.parse(base("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"));
if(JSON.stringify(current.static_guards)!==JSON.stringify(previous.static_guards)) fail("B09AB_STATIC_GUARDS_MUTATED");
const ce=current.semantics.find(s=>s.semantic_id==="decision.eligibility");
const pe=previous.semantics.find(s=>s.semantic_id==="decision.eligibility");
for(const key of ["registered_producers","registered_consumers","runtime_consumers"]){
  if(JSON.stringify(ce?.[key])!==JSON.stringify(pe?.[key])) fail("B09AB_CONNECTIVITY_MUTATED:"+key);
}
const nc=JSON.parse(JSON.stringify(current));
const np=JSON.parse(JSON.stringify(previous));
nc.semantics.find(s=>s.semantic_id==="decision.eligibility").notes=np.semantics.find(s=>s.semantic_id==="decision.eligibility").notes;
if(JSON.stringify(nc)!==JSON.stringify(np)) fail("B09AB_REGISTER_MUTATION_MUST_BE_NOTES_ONLY");

for(const path of [
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_declaration_fact_v1.ts",
  "apps/server/src/routes/decision_eligibility_policy_declarations_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_selector_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json"
]){
  if(read(path)!==base(path)) fail("B09AB_FROZEN_SURFACE_MUTATED:"+path);
}

const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  ".github/workflows","apps/server/src","apps/server/db","packages","config",
  "docs/digital_twin","docs/twin_kernel","scripts/runtime_acceptance"
],{encoding:"utf8"}).trim();
if(forbidden) fail("B09AB_PRODUCTION_OR_MCFT_MUTATION_FORBIDDEN:"+forbidden);

console.log("B09AB_POLICY_CONTENT_OWNER_TOPOLOGY_PASS");
console.log("B09AB_NO_PARALLEL_HORIZON_POLICY_FAMILY_PASS");
console.log("B09AB_V1_POLICY_CONTRACT_IMMUTABLE_PASS");
console.log("B09AB_NO_HORIZON_VALUE_SELECTED_PASS");
console.log("B09AB_NO_RUNTIME_OR_MCFT_EFFECT_PASS");
console.log("B09AB_DECISION_PACKAGE_RECOMMENDED_NOT_AUTHORIZED_PASS");
