#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),cp=require("node:child_process");
const BASE="9c758d4951c5e54d5571b14f438dd7ddfd49b84d";
const expected=[
"docs/architecture/semantic_convergence/GEOX-B09AE-IRRIGATE-STATE-CALCULATION-SHADOW-BINDING-DECISION-PACKAGE-V1.json",
"docs/architecture/semantic_convergence/GEOX-B09AE-IRRIGATE-STATE-CALCULATION-SHADOW-BINDING-DECISION-PACKAGE-V1.md",
"docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
"scripts/governance_acceptance/ACCEPTANCE_B09AE_IRRIGATE_STATE_CALCULATION_SHADOW_BINDING_V1.cjs"
].sort();
const fail=m=>{console.error(m);process.exit(1)},read=p=>fs.readFileSync(p,"utf8"),json=p=>JSON.parse(read(p)),base=p=>cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"});
const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09AE_BOUNDED_FOUR_FILE_DIFF_REQUIRED:"+JSON.stringify(changed));
const pkg=json(expected[0]);
if(pkg.schema_version!=="b09ae_irrigate_state_calculation_shadow_binding_decision_package_v1") fail("B09AE_SCHEMA_INVALID");
if(pkg.phase!=="B-09ae"||pkg.status!=="RECOMMENDED_NOT_AUTHORIZED") fail("B09AE_STATUS_INVALID");
if(pkg.stacked_base_product_head!==BASE) fail("B09AE_BASE_INVALID");
if(pkg.decision_id!=="DEC-BLINE-IRRIGATE-STATE-CALCULATION-SHADOW-BINDING-001") fail("B09AE_DECISION_ID_INVALID");
if(pkg.bounded_path?.action_type!=="IRRIGATE") fail("B09AE_ACTION_INVALID");
const b=pkg.proposed_binding||{};
if(!String(b.source_of_calculation_outputs||"").includes("same immutable decision_recommendation_v1")) fail("B09AE_SAME_SOURCE_REQUIRED");
if(b.required_skill_trace?.skill_id!=="irrigation_requirement_skill_v1"||b.required_skill_trace?.skill_version!=="v1") fail("B09AE_SKILL_TRACE_INVALID");
if(b.canonical_projection!=="projectIrrigationRequirementCalculationResultV1 via existing B06b adapter") fail("B09AE_B06B_PROJECTION_REQUIRED");
if(b.legacy_skill_evidence_refs_promoted!==false) fail("B09AE_LEGACY_EVIDENCE_PROMOTION_FORBIDDEN");
if(!String(b.evaluated_at_limitation||"").includes("not canonical decision_time")) fail("B09AE_TIME_LIMITATION_MISSING");
const id=pkg.calculation_identity_policy||{};
if(id.policy!=="SOURCE_FACT_SCOPE_CALCULATOR_SHA256_V1") fail("B09AE_ID_POLICY_INVALID");
if(id.output_shape!=="calculation_sfsha256_<64hex>") fail("B09AE_ID_SHAPE_INVALID");
if(id.recommendation_id_not_identity_authority!==true) fail("B09AE_RECOMMENDATION_ID_AUTHORITY_FORBIDDEN");
const s=pkg.source_integrity_rules||{};
if(s.exact_one_recommendation_source_fact!==true||s.candidate_and_source_fact_identity_must_match!==true) fail("B09AE_SOURCE_IDENTITY_RULE_MISSING");
if(s.source_action_type_must_equal!=="IRRIGATE"||s.source_skill_trace_requirement_detected_must_be_true!==true) fail("B09AE_SOURCE_SEMANTICS_INVALID");
if(s.source_skill_trace_malformed!=="FAIL_CLOSED"||s.duplicate_or_ambiguous_source!=="FAIL_CLOSED") fail("B09AE_FAIL_CLOSED_MISSING");
const j=pkg.judge_congruence_rule||{};
if(j.recommendation_id_must_match!==true||j.exact_scope_must_match!==true) fail("B09AE_JUDGE_ID_SCOPE_MATCH_REQUIRED");
for(const f of ["soil_moisture","target_soil_moisture","root_zone_depth_mm","rain_forecast_mm_72h","et0_mm_72h","crop_stage","application_efficiency"]){if(!(j.exact_input_fields||[]).includes(f)) fail("B09AE_INPUT_MATCH_FIELD_MISSING:"+f)}
if(j.expected_congruent_nonblocked_verdict!=="WATER_DEFICIT") fail("B09AE_EXPECTED_VERDICT_INVALID");
if(j.PASS_under_exact_same_inputs!=="SEMANTIC_MISMATCH_FAIL_CLOSED") fail("B09AE_PASS_MISMATCH_RULE_MISSING");
if(j.changed_inputs!=="STATE_NOT_BOUND"||j.latest_judge_result_lookup_forbidden!==true) fail("B09AE_LATER_JUDGE_REWRITE_FORBIDDEN");
const st=pkg.state_criterion_rule||{};
if(!String(st.producer||"").includes("existing B07c")) fail("B09AE_B07C_REQUIRED");
if(st.third_criterion_producer_created!==false) fail("B09AE_THIRD_CRITERION_PRODUCER_FORBIDDEN");
if(!String(st.on_exact_congruence_and_water_deficit||"").includes("STATE=SATISFIED")) fail("B09AE_STATE_RULE_INVALID");
if(st.final_eligibility_authority!=="NONE") fail("B09AE_FINAL_ELIGIBILITY_FORBIDDEN");
for(const k of ["runtime_change","schema_change","db_change","route_change","graph_edge_change","calculation_result_instance","candidate_binding_change","state_criterion_binding","b07e_connection","mcft_change","authority_removal"]){if(pkg.non_effects?.[k]!==false) fail("B09AE_NON_EFFECT_INVALID:"+k)}
const md=read(expected[1]);
for(const m of ["RECOMMENDED_NOT_AUTHORIZED","Same-source calculation basis","SOURCE_FACT_SCOPE_CALCULATOR_SHA256_V1","Judge congruence","latest JudgeResult -> Candidate STATE","new_runtime_consumer_creation = FORBIDDEN","Forecast remains a separate B-09w criterion"]){if(!md.includes(m)) fail("B09AE_MD_MARKER_MISSING:"+m)}
const cur=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"),prev=JSON.parse(base("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"));
if(JSON.stringify(cur.static_guards)!==JSON.stringify(prev.static_guards)) fail("B09AE_STATIC_GUARDS_MUTATED");
for(const sem of ["decision.calculation","decision.eligibility"]){
 const c=cur.semantics.find(x=>x.semantic_id===sem),p=prev.semantics.find(x=>x.semantic_id===sem);
 for(const key of ["registered_producers","registered_consumers","runtime_consumers"]){if(JSON.stringify(c?.[key])!==JSON.stringify(p?.[key])) fail("B09AE_CONNECTIVITY_MUTATED:"+sem+":"+key)}
}
const nc=JSON.parse(JSON.stringify(cur)),np=JSON.parse(JSON.stringify(prev));
for(const sem of ["decision.calculation","decision.eligibility"]) nc.semantics.find(x=>x.semantic_id===sem).notes=np.semantics.find(x=>x.semantic_id===sem).notes;
if(JSON.stringify(nc)!==JSON.stringify(np)) fail("B09AE_REGISTER_MUTATION_MUST_BE_NOTES_ONLY");
for(const p of [
"apps/server/src/domain/decision/irrigation_calculation_result_adapter_v1.ts",
"apps/server/src/domain/decision/agronomy_judge_eligibility_precursor_adapter_v1.ts",
"apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts",
"apps/server/src/routes/judge_v2.ts",
"apps/server/src/routes/decision_engine_v1.ts",
"docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json"]){if(read(p)!==base(p)) fail("B09AE_FROZEN_SURFACE_MUTATED:"+p)}
const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",".github/workflows","apps/server/src","apps/server/db","packages","config","docs/digital_twin","docs/twin_kernel","scripts/runtime_acceptance"],{encoding:"utf8"}).trim();
if(forbidden) fail("B09AE_PRODUCTION_OR_MCFT_MUTATION_FORBIDDEN:"+forbidden);
console.log("B09AE_SAME_SOURCE_CALCULATION_BASIS_PASS");
console.log("B09AE_JUDGE_EXACT_CONGRUENCE_GATE_PASS");
console.log("B09AE_EXISTING_B07C_ONLY_PASS");
console.log("B09AE_NO_RUNTIME_EDGE_YET_PASS");
console.log("B09AE_MCFT_UNTOUCHED_PASS");
console.log("B09AE_DECISION_PACKAGE_RECOMMENDED_NOT_AUTHORIZED_PASS");
