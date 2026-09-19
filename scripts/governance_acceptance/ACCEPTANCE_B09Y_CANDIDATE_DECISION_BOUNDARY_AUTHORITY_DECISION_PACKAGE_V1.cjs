#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");
const BASE = "6a3d869b7658e0733af2f74b15d291e738ae890a";
const expected = [
  "docs/architecture/semantic_convergence/GEOX-B09Y-CANDIDATE-DECISION-BOUNDARY-AUTHORITY-DECISION-PACKAGE-V1.json",
  "docs/architecture/semantic_convergence/GEOX-B09Y-CANDIDATE-DECISION-BOUNDARY-AUTHORITY-DECISION-PACKAGE-V1.md",
  "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_B09Y_CANDIDATE_DECISION_BOUNDARY_AUTHORITY_DECISION_PACKAGE_V1.cjs",
].sort();

function fail(m){ console.error(m); process.exit(1); }
function read(p){ return fs.readFileSync(p,"utf8"); }
function json(p){ return JSON.parse(read(p)); }
function base(p){ return cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"}); }

const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"})
  .trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09Y_BOUNDED_FOUR_FILE_DIFF_REQUIRED:"+JSON.stringify(changed));

const pkg=json(expected[0]);
if(pkg.schema_version!=="b09y_candidate_decision_boundary_authority_decision_package_v1") fail("B09Y_SCHEMA_INVALID");
if(pkg.phase!=="B-09y") fail("B09Y_PHASE_INVALID");
if(pkg.status!=="RECOMMENDED_NOT_AUTHORIZED") fail("B09Y_STATUS_INVALID");
if(pkg.stacked_base_product_head!==BASE) fail("B09Y_BASE_INVALID");
if(pkg.decision_id!=="DEC-BLINE-CANDIDATE-DECISION-BOUNDARY-001") fail("B09Y_DECISION_ID_INVALID");

const a=pkg.proposed_authority||{};
if(a.concept!=="CANONICAL_DECISION_BOUNDARY_ENVELOPE_V1") fail("B09Y_BOUNDARY_CONCEPT_INVALID");
if(a.authority_state!=="BOUNDARY_ONLY") fail("B09Y_AUTHORITY_STATE_INVALID");
if(a.server_created!==true || a.caller_supplied_decision_time!==false) fail("B09Y_SERVER_BOUNDARY_REQUIRED");
if(a.one_boundary_per_canonical_candidate!==true) fail("B09Y_ONE_BOUNDARY_REQUIRED");
if(!String(a.placement_rule||"").includes("before canonical Candidate computation begins")) fail("B09Y_PLACEMENT_INVALID");
if(!String(a.post_boundary_rule||"").includes("as-of read explicitly bounded to the same decision_time")) fail("B09Y_POST_BOUNDARY_RULE_INVALID");

for(const x of [
  "CandidateDecisionV1.decision_time",
  "ContextSnapshotV1.decision_time",
  "CalculationResultV1.decision_time",
  "B09v policy selector as-of boundary",
  "future DecisionEligibilityDecisionV1.decision_time",
]){
  if(!(a.propagated_to||[]).includes(x)) fail("B09Y_PROPAGATION_MISSING:"+x);
}

const p=pkg.program_binding_rule||{};
if(!String(p.current_legacy_behavior||"").includes("ORDER BY occurred_at DESC LIMIT 1")) fail("B09Y_LEGACY_LATEST_NOT_RECORDED");
if(!String(p.canonical_behavior||"").includes("latest fallback is forbidden")) fail("B09Y_CANONICAL_LATEST_FORBIDDEN_MISSING");
if(p.latest_wins!==false) fail("B09Y_LATEST_WINS_FORBIDDEN");
if(p.zero_match!=="PROGRAM_CONTEXT_NOT_FOUND") fail("B09Y_ZERO_MATCH_INVALID");
if(p.multiple_or_ambiguous_identity!=="PROGRAM_CONTEXT_AMBIGUOUS") fail("B09Y_AMBIGUITY_INVALID");

for(const f of [
  "legacy recommendation created_ts",
  "decision_recommendation_v1 fact occurred_at",
  "decision_recommendation_input_facts_v1 fact occurred_at as currently written after recommendation computation",
  "request arrival time",
  "wall clock fallback inside Candidate projection",
  "evaluated_at",
  "latest persisted fact time",
]){
  if(!(pkg.explicitly_forbidden_decision_time_sources||[]).includes(f)) fail("B09Y_FORBIDDEN_TIME_SOURCE_MISSING:"+f);
}

if(pkg.existing_input_fact_adjudication?.current_state!=="NOT_CANONICAL_DECISION_BOUNDARY") fail("B09Y_INPUT_FACT_OVERPROMOTED");
for(const k of ["runtime_change","schema_change","db_change","route_change","candidate_binding","context_binding","boundary_fact_written","policy_fact_written","b07e_connection","mcft_change","consumer_migration","authority_removal"]){
  if(pkg.non_effects?.[k]!==false) fail("B09Y_NON_EFFECT_INVALID:"+k);
}

const md=read(expected[1]);
for(const marker of [
  "RECOMMENDED_NOT_AUTHORIZED",
  "Canonical Decision Boundary Envelope",
  "timestamp alone is insufficient",
  "It proves when the fact was stored",
  "no later read may change canonical Candidate fields",
  "field/season latest fallback",
  "exact FieldProgram fact identity",
  "MCFT",
]){
  if(!md.includes(marker)) fail("B09Y_MD_MARKER_MISSING:"+marker);
}

const current=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const previous=JSON.parse(base("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"));
if(JSON.stringify(current.static_guards)!==JSON.stringify(previous.static_guards)) fail("B09Y_STATIC_GUARDS_MUTATED");
const cc=current.semantics.find(s=>s.semantic_id==="decision.candidate");
const pc=previous.semantics.find(s=>s.semantic_id==="decision.candidate");
for(const key of ["registered_producers","registered_consumers","runtime_consumers"]){
  if(JSON.stringify(cc?.[key])!==JSON.stringify(pc?.[key])) fail("B09Y_CANDIDATE_CONNECTIVITY_MUTATED:"+key);
}
const nc=JSON.parse(JSON.stringify(current));
const np=JSON.parse(JSON.stringify(previous));
nc.semantics.find(s=>s.semantic_id==="decision.candidate").notes=np.semantics.find(s=>s.semantic_id==="decision.candidate").notes;
if(JSON.stringify(nc)!==JSON.stringify(np)) fail("B09Y_REGISTER_MUTATION_MUST_BE_CANDIDATE_NOTES_ONLY");

for(const path of [
  "apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts",
  "apps/server/src/domain/decision/legacy_recommendation_candidate_adapter_v1.ts",
  "apps/server/src/context/field_program_context_projection_v1.ts",
  "apps/server/src/domain/decision/irrigation_calculation_result_adapter_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_policy_selector_v1.ts",
  "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
  "apps/server/src/routes/decision_engine_v1.ts",
  "apps/server/src/routes/programs_core_v1.ts",
  "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
]){
  if(read(path)!==base(path)) fail("B09Y_FROZEN_SURFACE_MUTATED:"+path);
}

const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
  ".github/workflows","apps/server/src","apps/server/db","packages","config",
  "docs/digital_twin","docs/twin_kernel","scripts/runtime_acceptance"
],{encoding:"utf8"}).trim();
if(forbidden) fail("B09Y_PRODUCTION_OR_MCFT_MUTATION_FORBIDDEN:"+forbidden);

console.log("B09Y_DECISION_TIME_NOT_PERSISTENCE_TIME_PASS");
console.log("B09Y_BOUNDARY_ENVELOPE_PROPOSAL_PASS");
console.log("B09Y_POST_BOUNDARY_ASOF_RULE_PASS");
console.log("B09Y_PROGRAM_LATEST_FALLBACK_FORBIDDEN_PASS");
console.log("B09Y_NO_RUNTIME_BINDING_EFFECT_PASS");
console.log("B09Y_MCFT_UNTOUCHED_PASS");
console.log("B09Y_DECISION_PACKAGE_RECOMMENDED_NOT_AUTHORIZED_PASS");
