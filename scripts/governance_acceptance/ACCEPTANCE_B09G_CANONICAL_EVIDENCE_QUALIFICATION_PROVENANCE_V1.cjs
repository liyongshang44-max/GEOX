#!/usr/bin/env node
const fs=require("fs");
const cp=require("child_process");
const fail=(m)=>{throw new Error(m)};
const read=(p)=>fs.readFileSync(p,"utf8");
const json=(p)=>JSON.parse(read(p));

const evidence=read("apps/server/src/domain/judge/evidence_judge_v2.ts");
if(!evidence.includes("canonical_evidence_qualification_refs: string[]")) fail("B09G_EVIDENCE_REFS_FIELD_MISSING");
if(!evidence.includes('canonical_evidence_qualification_ref_basis: "QUALIFICATION_ID_DIRECT"')) fail("B09G_REF_BASIS_MISSING");
if(!evidence.includes("(batch.qualifications ?? []).map((qualification) => qualification.qualification_id)")) fail("B09G_REFS_NOT_DIRECT_QUALIFICATION_IDENTITIES");
if(evidence.includes('"evidence_qualification_v1:" + qualification.qualification_id')) fail("B09G_REF_REWRAP_FORBIDDEN");
if(!evidence.includes("EMPTY_NO_CANONICAL_QUALIFICATIONS")) fail("B09G_EMPTY_SET_STATE_MISSING");
if(!evidence.includes("B09G_CANONICAL_EVIDENCE_QUALIFICATION_IDENTITY_MISSING_OR_DUPLICATE")) fail("B09G_IDENTITY_FAIL_CLOSED_MISSING");

const binding=read("apps/server/src/domain/decision/agronomy_evidence_dependency_shadow_binding_v1.ts");
if(!binding.includes("AVAILABLE_FROM_PERSISTED_CANONICAL_SHADOW")) fail("B09G_BIND_AVAILABLE_STATE_MISSING");
if(!binding.includes("LEGACY_SHADOW_WITHOUT_QUALIFICATION_REFS")) fail("B09G_LEGACY_ROW_STATE_MISSING");
if(!binding.includes("READY_FOR_CRITERION_SHADOW")) fail("B09G_CRITERION_SHADOW_READINESS_MISSING");
if(!binding.includes('migration_readiness: "NOT_READY_FOR_CRITERION_CUTOVER"')) fail("B09G_MIGRATION_READINESS_OPENED");
if(!binding.includes("consumer_migration_performed: false")) fail("B09G_CONSUMER_MIGRATION_OPENED");
if(!binding.includes("authority_removal_permitted: false")) fail("B09G_AUTHORITY_REMOVAL_OPENED");

const reg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const criterionGuard=(reg.static_guards||[]).find(g=>g.guard_id==="G-B02-17-decision-eligibility-criterion-instantiation");
const expected=[
  "apps/server/src/domain/decision/stage1_eligibility_precursor_adapter_v1.ts",
  "apps/server/src/domain/decision/agronomy_judge_eligibility_precursor_adapter_v1.ts"
];
if(!criterionGuard||JSON.stringify(criterionGuard.registered_paths)!==JSON.stringify(expected)) fail("B09G_CRITERION_PRODUCER_SET_CHANGED");

const stageGuard=(reg.static_guards||[]).find(g=>g.guard_id==="G-B02-25-stage1-shadow-comparator-runtime-disconnection");
if(!stageGuard||JSON.stringify(stageGuard.registered_paths)!==JSON.stringify(["apps/server/src/domain/decision/evidence_semantic_shadow_comparator_v1.ts"])) fail("B09G_STAGE1_COMPARATOR_CONNECTED");

const readiness=json("docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json");
if(readiness.authority_removal_performed!==false) fail("B09G_AUTHORITY_REMOVAL_PERFORMED");
const family=(readiness.families||[]).find(x=>x.semantic_id==="evidence.qualification");
if(!family||family.consumer_migration_state!=="PARTIAL"||family.authority_removal_state!=="PENDING_CONSUMER_MIGRATION") fail("B09G_READINESS_CHANGED");

const before=JSON.parse(cp.execFileSync("git",["show","f3fa6e4a27f833859e6d5bea77a43a02272a265d:docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json"],{encoding:"utf8"}));
const flatten=(r)=>(r.semantics||[]).flatMap(s=>(s.registered_producers||[]).filter(p=>p.grandfathered_duplicate===true).map(p=>({semantic_id:s.semantic_id,...p}))).sort((a,b)=>(a.semantic_id+"::"+a.producer_id).localeCompare(b.semantic_id+"::"+b.producer_id));
const b=flatten(before),a=flatten(reg);
if(b.length!==29||a.length!==29||JSON.stringify(b)!==JSON.stringify(a)) fail("B09G_GRANDFATHERED_AUTHORITY_MUTATED");

console.log("B09G_DIRECT_CANONICAL_QUALIFICATION_IDENTITY_PASS");
console.log("B09G_KNOWN_EMPTY_SET_NO_FABRICATION_PASS");
console.log("B09G_CRITERION_SHADOW_READINESS_SEPARATED_PASS");
console.log("B09G_ZERO_CONSUMER_MIGRATION_ZERO_AUTHORITY_REMOVAL_PASS");
console.log("B09G_PROVENANCE_ACCEPTANCE_PASS");
