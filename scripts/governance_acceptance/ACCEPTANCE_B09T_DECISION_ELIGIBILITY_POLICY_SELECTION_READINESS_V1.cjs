#!/usr/bin/env node
"use strict";
const fs=require("fs"),cp=require("child_process");
const fail=m=>{throw new Error(m)};
const read=p=>fs.readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));
const BASE="3eadd13966ae7797852b3dc9e8d1535a093e6852";

const expected=[
 "docs/architecture/semantic_convergence/GEOX-B09T-DECISION-ELIGIBILITY-POLICY-SELECTION-READINESS-V1.json",
 "docs/architecture/semantic_convergence/GEOX-B09T-DECISION-ELIGIBILITY-POLICY-SELECTION-READINESS-V1.md",
 "docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json",
 "scripts/governance_acceptance/ACCEPTANCE_B09T_DECISION_ELIGIBILITY_POLICY_SELECTION_READINESS_V1.cjs"
].sort();
const changed=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean).sort();
if(JSON.stringify(changed)!==JSON.stringify(expected)) fail("B09T_BOUNDED_FOUR_FILE_DIFF_REQUIRED");

const d=json(expected[0]);
if(d.schema_version!=="b09t_decision_eligibility_policy_selection_readiness_v1") fail("B09T_SCHEMA_INVALID");
if(d.status!=="SELECTION_SEMANTICS_NOT_AUTHORIZED") fail("B09T_STATUS_INVALID");
if(d.stacked_base_product_head!==BASE) fail("B09T_BASE_INVALID");
if(d.current_authority?.declaration_writer!=="READY_B09S") fail("B09T_B09S_WRITER_NOT_RECOGNIZED");
if(d.current_authority?.real_policy_instance!=="NONE"||d.current_authority?.selector_runtime!=="NONE"||d.current_authority?.b07e_connection!=="NONE") fail("B09T_PREMATURE_AUTHORITY");
if(d.established_facts?.candidate?.has_program_id!==false||d.established_facts?.candidate?.has_policy_scope_anchor!==false) fail("B09T_CANDIDATE_ANCHOR_FACT_INVALID");
if(d.established_facts?.legacy_source?.b06c_promotes_program_id_to_candidate!==false) fail("B09T_LEGACY_PROGRAM_PROMOTION_MISSTATED");
if(d.established_facts?.context_bridge?.assertion_contains_program_id!==true||d.established_facts?.context_bridge?.current_candidate_binding!=="NOT_BOUND") fail("B09T_CONTEXT_BRIDGE_FACT_INVALID");
if(d.recommended_future_selector_shape_not_authorized?.implementation_authorized!==false) fail("B09T_SELECTOR_PREMATURELY_AUTHORIZED");
if(d.recommended_future_selector_shape_not_authorized?.latest_wins!==false) fail("B09T_LATEST_WINS_FORBIDDEN");
for(const id of["B09T-U01","B09T-U02","B09T-U03","B09T-U04","B09T-U05","B09T-U06","B09T-U07"]){
 if(!(d.unresolved_selection_semantics||[]).some(x=>x.id===id)) fail("B09T_MISSING_UNRESOLVED:"+id);
}

const candidate=read("apps/server/src/contracts/canonical_decision_v1.ts");
if(!candidate.includes("scope: evidenceScopeV1Schema")) fail("B09T_CANDIDATE_SCOPE_NOT_CANONICAL");
if(/\bprogram_id\s*:/.test(candidate)) fail("B09T_CANDIDATE_UNEXPECTED_PROGRAM_ID");
if(/policy_scope_anchor/.test(candidate)) fail("B09T_CANDIDATE_UNEXPECTED_POLICY_ANCHOR");

const b09j=read("apps/server/src/domain/decision/decision_recommendation_candidate_criterion_shadow_binding_v1.ts");
if(!b09j.includes("context_snapshot_ref: null")) fail("B09T_B09J_CONTEXT_NOT_NULL");
if(!b09j.includes('source_class: "LEGACY_RECOMMENDATION"')&&!read("apps/server/src/domain/decision/legacy_recommendation_candidate_adapter_v1.ts").includes('source_class: "LEGACY_RECOMMENDATION"')) fail("B09T_LEGACY_SOURCE_CLASS_NOT_PROVEN");

const ctx=read("apps/server/src/context/field_program_context_projection_v1.ts");
if(!ctx.includes('kind: "DECLARED_FIELD_PROGRAM"')||!ctx.includes("program_id: payload.program_id")) fail("B09T_CONTEXT_PROGRAM_ANCHOR_NOT_PROVEN");

const policy=read("apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts");
for(const n of["scope_anchor_type: z.string().min(1)","scope_anchor_ref: z.string().min(1)","effective_from: z.string().datetime","effective_until: z.string().datetime","supersedes_policy_ref: z.string().min(1).nullable()"]) if(!policy.includes(n)) fail("B09T_POLICY_CONTRACT_FACT_MISSING:"+n);

const runtime=read("apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts");
if(!runtime.includes("applicable.includes(candidate.proposed_action.action_type)")) fail("B09T_ACTION_EXACT_MEMBERSHIP_NOT_PROVEN");

for(const p of[
 "apps/server/src/domain/decision/decision_eligibility_policy_declaration_fact_v1.ts",
 "apps/server/src/routes/decision_eligibility_policy_declarations_v1.ts",
 "apps/server/src/domain/decision/decision_eligibility_runtime_v1.ts",
 "apps/server/src/domain/decision/decision_eligibility_evaluator_v1.ts",
 "apps/server/src/contracts/decision_eligibility_policy_declaration_v1.ts",
 "docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json",
 "docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json"
]){
 if(read(p)!==cp.execFileSync("git",["show",BASE+":"+p],{encoding:"utf8"})) fail("B09T_FROZEN_SURFACE_MUTATED:"+p);
}

const before=JSON.parse(cp.execFileSync("git",["show",BASE+":docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const after=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const b=(before.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
const a=(after.semantics||[]).find(s=>s.semantic_id==="decision.eligibility");
if(!b||!a||a.notes.length!==b.notes.length+4) fail("B09T_REGISTER_NOTE_DELTA_INVALID");
const normalized=JSON.parse(JSON.stringify(after));
(normalized.semantics||[]).find(s=>s.semantic_id==="decision.eligibility").notes=b.notes;
if(JSON.stringify(normalized)!==JSON.stringify(before)) fail("B09T_REGISTER_CHANGED_BEYOND_NOTES");

const forbidden=cp.execFileSync("git",["diff","--name-only",BASE+"...HEAD","--",
 "apps/server/src/auth","apps/server/src/contracts","apps/server/src/domain","apps/server/src/routes","apps/server/src/modules",
 "apps/server/db","packages","config",".github/workflows","docs/twin_kernel","docs/digital_twin"
],{encoding:"utf8"}).trim();
if(forbidden) fail("B09T_RUNTIME_CONTRACT_SCHEMA_MCFT_MUTATION_FORBIDDEN:"+forbidden);

console.log("B09T_CANDIDATE_HAS_NO_CANONICAL_POLICY_ANCHOR_PASS");
console.log("B09T_CONTEXT_PROGRAM_BRIDGE_EXISTS_BUT_UNBOUND_PASS");
console.log("B09T_NO_NULL_WILDCARD_OR_LATEST_WINS_PASS");
console.log("B09T_DECISION_TIME_FALLBACK_UNAUTHORIZED_PASS");
console.log("B09T_SUPERSESSION_SEMANTICS_UNAUTHORIZED_PASS");
console.log("B09T_NO_SELECTOR_OR_POLICY_INSTANCE_PASS");
console.log("B09T_GOVERNANCE_ACCEPTANCE_PASS");
