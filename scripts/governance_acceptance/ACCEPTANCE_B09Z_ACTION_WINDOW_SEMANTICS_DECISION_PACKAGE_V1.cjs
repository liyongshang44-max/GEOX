#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");
const BASE = "28b5809efefc94440cf9766f03d5b6f7d2b5944c";
const expected = [
  "docs/architecture/semantic_convergence/GEOX-B09Z-ACTION-WINDOW-SEMANTICS-DECISION-PACKAGE-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09Z-ACTION-WINDOW-SEMANTICS-DECISION-PACKAGE-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09Z_ACTION_WINDOW_SEMANTICS_DECISION_PACKAGE_V1.cjs",
].sort();

function fail(m){ console.error(m); process.exit(1); }
function read(p){ return fs.readFileSync(p,"utf8"); }
function json(p){ return JSON.parse(read(p)); }
function base(p){ return cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"}); }

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09Z_BOUNDED_FOUR_FILE_DIFF_REQUIRED:"+JSON.stringify(changed));

const pkg=json(expected[0]);
if(pkg.schema_version!=="b09z_action_window_semantics_decision_package_v1") fail("B09Z_SCHEMA_INVALID");
if(pkg.phase!=="B-09z") fail("B09Z_PHASE_INVALID");
if(pkg.status!=="RECOMMENDED_NOT_AUTHORIZED") fail("B09Z_STATUS_INVALID");
if(pkg.stacked_base_product_head!==BASE) fail("B09Z_BASE_INVALID");
if(pkg.decision_id!=="DEC-BLINE-ACTION-WINDOW-SEMANTICS-001") fail("B09Z_DECISION_ID_INVALID");

const s=pkg.proposed_semantics||{};
if(s.canonical_type_name!=="DecisionActionWindowV1") fail("B09Z_TYPE_INVALID");
if(s.authority_state!=="ELIGIBILITY_ACTION_WINDOW_ONLY") fail("B09Z_AUTHORITY_STATE_INVALID");
for(const k of [
  "candidate_ref_required","exact_scope_required","decision_time_required",
  "window_start_required","window_end_required","finite_window_required",
  "open_ended_window_forbidden","window_start_before_window_end_required",
  "window_start_must_not_precede_decision_time","horizon_source_ref_required",
  "support_refs_required","policy_ref_required","deterministic_evaluation_as_of_required"
]){
  if(s[k]!==true) fail("B09Z_REQUIRED_RULE_MISSING:"+k);
}

const lc=pkg.lifecycle_mapping||{};
if(lc.NOT_YET_ACTIVE!=="evaluated_at < window_start") fail("B09Z_NOT_YET_ACTIVE_INVALID");
if(lc.ACTIVE!=="window_start <= evaluated_at < window_end") fail("B09Z_ACTIVE_INVALID");
if(lc.EXPIRED!=="evaluated_at >= window_end") fail("B09Z_EXPIRED_INVALID");
if(!String(lc.evaluation_time_source||"").includes("never hidden Date.now")) fail("B09Z_HIDDEN_WALL_CLOCK_FORBIDDEN");

const h=pkg.horizon_authority||{};
for(const k of [
  "hidden_default_duration_forbidden","hardcoded_duration_forbidden",
  "field_program_execution_schedule_forbidden","ao_act_time_window_forbidden_as_source_authority",
  "problem_state_window_forbidden_as_source_authority","twin_candidate_expiry_window_forbidden_as_source_authority",
  "mcft_forecast_or_evidence_window_forbidden_as_source_authority"
]){
  if(h[k]!==true) fail("B09Z_HORIZON_BOUNDARY_MISSING:"+k);
}
if(h.current_authorized_horizon_source!=="NONE") fail("B09Z_HORIZON_SOURCE_OVERCLAIMED");

if(pkg.relationship_to_b09w?.no_implicit_horizon_from_policy_effective_window!==true) fail("B09Z_POLICY_EFFECTIVE_WINDOW_REUSE_FORBIDDEN");
if(pkg.current_readiness?.canonical_action_window_contract!=="NONE") fail("B09Z_CONTRACT_OVERCLAIMED");
if(pkg.current_readiness?.canonical_action_window_producer!=="NONE") fail("B09Z_PRODUCER_OVERCLAIMED");
if(pkg.current_readiness?.b07e!=="DISCONNECTED") fail("B09Z_B07E_MUST_REMAIN_DISCONNECTED");
if(pkg.current_readiness?.mcft_forecast!=="FROZEN_EXTERNAL_DEPENDENCY") fail("B09Z_MCFT_FORECAST_MUST_REMAIN_FROZEN");

for(const k of ["runtime_change","schema_change","db_change","route_change","graph_edge_change","action_window_instance","b07e_connection","mcft_change","authority_removal"]){
  if(pkg.non_effects?.[k]!==false) fail("B09Z_NON_EFFECT_INVALID:"+k);
}

const md=read(expected[1]);
for(const marker of [
  "RECOMMENDED_NOT_AUTHORIZED",
  "DecisionActionWindowV1",
  "For how long, and from what instant",
  "Open-ended windows are forbidden",
  "No hidden default horizon",
  "Current authorized horizon source:",
  "P47 AO-ACT time window",
  "ProblemStateV1.window",
  "MCFT-9 is incomplete",
]){
  if(!md.includes(marker)) fail("B09Z_MD_MARKER_MISSING:"+marker);
}

const current=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const previous=JSON.parse(base("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"));
if(JSON.stringify(current.static_guards)!==JSON.stringify(previous.static_guards)) fail("B09Z_STATIC_GUARDS_MUTATED");
const ce=current.semantics.find(s=>s.semantic_id==="decision.eligibility");
const pe=previous.semantics.find(s=>s.semantic_id==="decision.eligibility");
for(const key of ["registered_producers","registered_consumers","runtime_consumers"]){
  if(JSON.stringify(ce?.[key])!==JSON.stringify(pe?.[key])) fail("B09Z_ELIGIBILITY_CONNECTIVITY_MUTATED:"+key);
}
const nc=JSON.parse(JSON.stringify(current));
const np=JSON.parse(JSON.stringify(previous));
nc.semantics.find(s=>s.semantic_id==="decision.eligibility").notes=np.semantics.find(s=>s.semantic_id==="decision.eligibility").notes;
if(JSON.stringify(nc)!==JSON.stringify(np)) fail("B09Z_REGISTER_MUTATION_MUST_BE_ELIGIBILITY_NOTES_ONLY");

for(const path of [
  "apps/server/src/contracts/decision_eligibility_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_evaluator_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_selector_v1.ts",
  "apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts",
  "apps/server/src/routes/decision_engine_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
  "docs/twin_kernel/P47_AO_ACT_TIME_WINDOW_POLICY_V0.json",
  "docs/twin_kernel/P35_CANDIDATE_EXPIRY_USE_WINDOW_POLICY_V0.json",
  "docs/twin_kernel/P44_ACTIVATION_WINDOW_CANARY_POLICY_V0.json",
]){
  if(read(path)!==base(path)) fail("B09Z_FROZEN_SURFACE_MUTATED:"+path);
}

const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  ".github/workflows","apps/server/src","apps/server/db","packages","config",
  "docs/digital_twin","docs/twin_kernel","scripts/runtime_acceptance"
],{encoding:"utf8"}).trim();
if(forbidden) fail("B09Z_PRODUCTION_OR_MCFT_MUTATION_FORBIDDEN:"+forbidden);

console.log("B09Z_ACTION_WINDOW_SEPARATION_PASS");
console.log("B09Z_FINITE_INTERVAL_LIFECYCLE_PASS");
console.log("B09Z_NO_HIDDEN_DEFAULT_HORIZON_PASS");
console.log("B09Z_REJECT_DOWNSTREAM_TWIN_MCFT_WINDOW_REUSE_PASS");
console.log("B09Z_NO_RUNTIME_OR_GRAPH_EFFECT_PASS");
console.log("B09Z_DECISION_PACKAGE_RECOMMENDED_NOT_AUTHORIZED_PASS");
