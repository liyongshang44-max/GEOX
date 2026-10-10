#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const cp=require("node:child_process");
const BASE="88ed1f6139f12b2ca61d1c494d2ec979b1f96500";
const expected=[
  "docs/architecture/semantic_convergence/GEOX-B09AC-ELIGIBILITY-POLICY-V2-ACTION-WINDOW-CONTRACT-SHAPE-DECISION-PACKAGE-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09AC-ELIGIBILITY-POLICY-V2-ACTION-WINDOW-CONTRACT-SHAPE-DECISION-PACKAGE-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09AC_ELIGIBILITY_POLICY_V2_ACTION_WINDOW_CONTRACT_SHAPE_V1.cjs",
].sort();

function fail(m){console.error(m);process.exit(1);}
function read(p){return fs.readFileSync(p,"utf8");}
function json(p){return JSON.parse(read(p));}
function base(p){return cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"});}

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09AC_BOUNDED_FOUR_FILE_DIFF_REQUIRED:"+JSON.stringify(changed));

const pkg=json(expected[0]);
if(pkg.schema_version!=="b09ac_eligibility_policy_v2_action_window_contract_shape_decision_package_v1") fail("B09AC_SCHEMA_INVALID");
if(pkg.phase!=="B-09ac") fail("B09AC_PHASE_INVALID");
if(pkg.status!=="RECOMMENDED_NOT_AUTHORIZED") fail("B09AC_STATUS_INVALID");
if(pkg.stacked_base_product_head!==BASE) fail("B09AC_BASE_INVALID");
if(pkg.decision_id!=="DEC-BLINE-ELIGIBILITY-POLICY-V2-ACTION-WINDOW-CONTRACT-001") fail("B09AC_DECISION_ID_INVALID");

const s=pkg.proposed_successor_contract||{};
if(s.nominal_name!=="DecisionEligibilityPolicyDeclarationV2") fail("B09AC_SUCCESSOR_NAME_INVALID");
if(s.predecessor!=="DecisionEligibilityPolicyDeclarationV1") fail("B09AC_PREDECESSOR_INVALID");
if(s.predecessor_mutation!==false || s.successor_required!==true) fail("B09AC_V1_MUTATION_FORBIDDEN");
if(s.proposed_new_field!=="action_window_policy") fail("B09AC_FIELD_INVALID");
const shape=s.field_shape||{};
if(shape.authority_state!=="ELIGIBILITY_ACTIONABILITY_HORIZON_ONLY") fail("B09AC_AUTHORITY_INVALID");
if(shape.anchor!=="CANDIDATE_DECISION_TIME") fail("B09AC_ANCHOR_INVALID");
if(shape.start_offset_seconds!=="EXPLICIT_NONNEGATIVE_SAFE_INTEGER") fail("B09AC_START_OFFSET_INVALID");
if(shape.duration_seconds!=="EXPLICIT_POSITIVE_SAFE_INTEGER") fail("B09AC_DURATION_INVALID");
if(shape.interval_semantics!=="HALF_OPEN_[START_END)") fail("B09AC_INTERVAL_INVALID");
if(shape.derivation_mode!=="POLICY_ONLY_V1") fail("B09AC_MODE_INVALID");

const d=pkg.deterministic_materialization_rule||{};
if(d.window_start_formula!=="decision_time + start_offset_seconds") fail("B09AC_START_FORMULA_INVALID");
if(d.window_end_formula!=="window_start + duration_seconds") fail("B09AC_END_FORMULA_INVALID");
for(const k of ["hidden_wall_clock_forbidden","hidden_default_offset_forbidden","hidden_default_duration_forbidden"]){
  if(d[k]!==true) fail("B09AC_HIDDEN_DEFAULT_FORBIDDEN_MISSING:"+k);
}
for(const k of ["overflow_or_invalid_arithmetic","missing_decision_time","missing_action_window_policy_when_required"]){
  if(d[k]!=="FAIL_CLOSED") fail("B09AC_FAIL_CLOSED_RULE_INVALID:"+k);
}

const coupling=pkg.criterion_coupling_rule||{};
if(!String(coupling.if_required_criteria_contains_ACTION_WINDOW||"").includes("MUST be non-null")) fail("B09AC_REQUIRED_COUPLING_INVALID");
if(!String(coupling.if_required_criteria_excludes_ACTION_WINDOW||"").includes("MUST be null")) fail("B09AC_UNUSED_AUTHORITY_FORBIDDEN");

const u=pkg.unit_and_representation_adjudication||{};
if(u.duration_unit!=="SECONDS") fail("B09AC_DURATION_UNIT_INVALID");
if(u.iso8601_duration_string!=="NOT_RECOMMENDED_V1") fail("B09AC_ISO_DURATION_NOT_REJECTED");
if(u.milliseconds!=="NOT_RECOMMENDED_V1") fail("B09AC_MILLISECONDS_NOT_REJECTED");
if(u.absolute_window_start_end_in_policy!=="FORBIDDEN") fail("B09AC_ABSOLUTE_POLICY_WINDOW_FORBIDDEN");

const x=pkg.explicit_non_selections||{};
for(const k of ["actual_start_offset_seconds","actual_duration_seconds","maximum_allowed_duration_seconds","minimum_allowed_duration_seconds","irrigate_specific_value"]){
  if(x[k]!==null) fail("B09AC_CONCRETE_VALUE_SELECTED:"+k);
}
if(x.dynamic_agronomic_shortening!==false || x.forecast_dependent_shortening!==false) fail("B09AC_DYNAMIC_MODE_PREMATURE");

const v=pkg.versioning_and_identity||{};
for(const k of ["v1_declarations_remain_valid","v1_policy_refs_not_reinterpreted","v2_policy_identity_must_be_explicit","no_automatic_v1_to_v2_upgrade","no_default_action_window_backfill"]){
  if(v[k]!==true) fail("B09AC_VERSIONING_RULE_MISSING:"+k);
}

for(const k of ["runtime_change","schema_change","db_change","route_change","graph_edge_change","existing_v1_contract_change","successor_contract_implemented","concrete_horizon_value_selected","policy_fact_written","action_window_producer","b07e_connection","mcft_change","authority_removal"]){
  if(pkg.non_effects?.[k]!==false) fail("B09AC_NON_EFFECT_INVALID:"+k);
}

const md=read(expected[1]);
for(const marker of [
  "RECOMMENDED_NOT_AUTHORIZED",
  "DecisionEligibilityPolicyDeclarationV2",
  "action_window_policy",
  "start_offset_seconds",
  "duration_seconds",
  "HALF_OPEN_[START_END)",
  "No field has a hidden default",
  "Existing v1 declarations remain valid",
  "No 6h/12h/24h/72h policy value is created"
]){
  if(!md.includes(marker)) fail("B09AC_MD_MARKER_MISSING:"+marker);
}

const current=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const previous=JSON.parse(base("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"));
if(JSON.stringify(current.static_guards)!==JSON.stringify(previous.static_guards)) fail("B09AC_STATIC_GUARDS_MUTATED");
const ce=current.semantics.find(s=>s.semantic_id==="decision.eligibility");
const pe=previous.semantics.find(s=>s.semantic_id==="decision.eligibility");
for(const key of ["registered_producers","registered_consumers","runtime_consumers"]){
  if(JSON.stringify(ce?.[key])!==JSON.stringify(pe?.[key])) fail("B09AC_CONNECTIVITY_MUTATED:"+key);
}
const nc=JSON.parse(JSON.stringify(current));
const np=JSON.parse(JSON.stringify(previous));
nc.semantics.find(s=>s.semantic_id==="decision.eligibility").notes=np.semantics.find(s=>s.semantic_id==="decision.eligibility").notes;
if(JSON.stringify(nc)!==JSON.stringify(np)) fail("B09AC_REGISTER_MUTATION_MUST_BE_NOTES_ONLY");

for(const path of [
  "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_declaration_fact_v1.ts",
  "apps/server/src/routes/decision_eligibility_policy_declarations_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_selector_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json"
]){
  if(read(path)!==base(path)) fail("B09AC_FROZEN_SURFACE_MUTATED:"+path);
}

const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  ".github/workflows","apps/server/src","apps/server/db","packages","config",
  "docs/digital_twin","docs/twin_kernel","scripts/runtime_acceptance"
],{encoding:"utf8"}).trim();
if(forbidden) fail("B09AC_PRODUCTION_OR_MCFT_MUTATION_FORBIDDEN:"+forbidden);

console.log("B09AC_SUCCESSOR_CONTRACT_SHAPE_PASS");
console.log("B09AC_RELATIVE_SECONDS_REPRESENTATION_PASS");
console.log("B09AC_ACTION_WINDOW_CRITERION_COUPLING_PASS");
console.log("B09AC_V1_POLICY_IMMUTABLE_PASS");
console.log("B09AC_NO_CONCRETE_HORIZON_VALUE_PASS");
console.log("B09AC_NO_RUNTIME_OR_MCFT_EFFECT_PASS");
console.log("B09AC_DECISION_PACKAGE_RECOMMENDED_NOT_AUTHORIZED_PASS");
