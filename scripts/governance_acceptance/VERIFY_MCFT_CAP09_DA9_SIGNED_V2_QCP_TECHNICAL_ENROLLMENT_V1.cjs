#!/usr/bin/env node
"use strict";
// Technical CTO evidence registration, NOT the independent retry-governance
// signing authority, not Frozen V13 historical graduation, and not a Permit.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../..");
const REG="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-QCP-TECHNICAL-ENROLLMENT-V1.json";
const REVIEW="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-PHASE3-FROZEN-V13-GOVERNANCE-REVIEW-V1.json";
const Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const OLD="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-FROZEN-SEMANTIC-SUCCESSOR-V1.json";
const FROZEN="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FROZEN-V13-REQUALIFICATION-CONTRACT-V1.json";
const OUT="acceptance-output/MCFT_CAP09_DA9_V2_SIGNED_GOVERNANCE_TECHNICAL_AUDIT_V1.json";
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",maxBuffer:16*1024*1024}).trim();
const REVIEW_ID="DA9_SIGNED_COMPOSER_V2_PHASE3_FROZEN_RUNTIME_REVIEW_ONLY";
const RESOLVER="DA9_SIGNED_COMPOSER_V2_GOVERNANCE_READONLY_EXACT_PATHS";
function verify(reg,review,report,q,old,frozen){
 assert.equal(reg.schema_version,"geox_mcft_cap09_da9_signed_v2_qcp_technical_enrollment_v1");
 assert.equal(reg.registration_id,"MCFT_CAP09_DA9_SIGNED_V2_TWO_SEPARATE_TECHNICAL_SUCCESSOR_ADJUDICATIONS_V1");
 assert.equal(reg.registration_status,"REGISTERED_TWO_NEW_SUBJECT_TECHNICAL_DECISIONS_WITH_EXECUTION_HOLD");
 assert.equal(reg.adjudicator_capacity,"CTO_TECHNICAL_REVIEW_DELEGATED_IN_CONVERSATION_NO_SEPARATE_GOVERNANCE_KEY");
 assert.equal(reg.adjudicator_independence_cryptographically_attested,false);
 assert.equal(reg.basis_signed_source_pr,3731);assert.equal(reg.basis_governance_pr,3732);
 assert.equal(reg.basis_source_sha,"6d8fb108655d9ada4b44cc7e4709a1c2ac5832b0");
 assert.equal(reg.basis_base_sha,"2162f368899e9a9b5c497d332859e4196f389660");
 assert.equal(reg.basis_original_six_native_workflow_run,40188383138);
 assert.equal(reg.basis_signed_bundle_sha256,review.signed_bundle_sha256);
 assert.equal(reg.basis_operator_public_spki_sha256,review.signed_public_spki_sha256);
 assert.equal(reg.basis_independent_signature_audit_sha256,review.independent_cryptography_report_sha256);
 assert.equal(reg.independent_technical_review_contract,REVIEW);
 assert.equal(reg.basis_independent_technical_workflow_run,40195303139);
 assert.equal(reg.basis_technical_evidence_zip_sha256,"sha256:0475d14ee3c1646ba0b9933b3b156237b59735905bc7867175595318f6241caa");
 assert.equal(reg.adjudications.length,2);
 assert.deepEqual(reg.adjudications.map(x=>x.check_id),["PHASE3_EVIDENCE_RUNTIME_FOUNDATION","FROZEN_V13_TWO_BLOB_SEMANTIC_SUCCESSOR"]);
 const a=reg.adjudications[0],b=reg.adjudications[1];
 assert.equal(a.decision,"ACCEPT_FRESH_EXACT_SIGNED_COMPOSER_SOURCE_TECHNICAL_REQUALIFICATION_ONLY");
 assert.equal(a.source_sha,review.source_head);assert.equal(a.historical_subject,review.phase3.historical_subject);
 assert.equal(a.legacy_digest,review.phase3.historical_dependency_digest);
 assert.equal(a.registered_new_dependency_digest,review.phase3.new_subject_dependency_digest);
 assert.notEqual(a.legacy_digest,a.registered_new_dependency_digest);
 assert.equal(a.dependency_path_count,report.phase3.paths);
 assert.equal(a.historical_changed_count,report.phase3.changed_path_count);
 assert.equal(a.historical_missing_count,report.phase3.legacy_missing_paths.length);
 assert.equal(a.legacy_digest_carryforward_allowed,false);assert.equal(a.old_physical_evidence_promoted,false);
 assert.equal(a.real_signed_native_job_completed,true);
 assert.equal(review.evidence_entries.find(x=>x.check_id===a.check_id).reviewed_dependency_digest,a.registered_new_dependency_digest);
 assert.equal(b.decision,"ACCEPT_EXACT_TWO_PATH_ISOLATED_RETENTION_SEMANTIC_DELTA_TECHNICAL_ONLY");
 assert.equal(b.source_sha,review.source_head);
 assert.equal(b.old_frozen_runtime_sha,review.frozen_v13.historical_runtime_sha);
 assert.equal(b.frozen_runtime_scope_path_count,report.frozen_v13.scope_paths);
 assert.equal(b.reviewed_changed_runtime_path_count,2);
 assert.deepEqual(Object.keys(b.runtime_path_blobs).sort(),report.frozen_v13.changed_runtime_paths);
 assert.equal(b.old_runtime_digest,report.frozen_v13.historical_frozen_runtime_digest);
 assert.equal(b.new_runtime_digest,report.frozen_v13.successor_runtime_digest);
 assert.notEqual(b.old_runtime_digest,b.new_runtime_digest);
 assert.equal(b.frozen_zero_drift_gate_passed,false);
 for(const [p,v] of Object.entries(b.runtime_path_blobs)){
   assert.equal(v.old,git("rev-parse",b.old_frozen_runtime_sha+":"+p));
   assert.equal(v.new,git("rev-parse",review.source_head+":"+p));
 }
 assert.equal(old.historical_frozen_runtime_sha,b.old_frozen_runtime_sha);
 assert.equal(frozen.frozen_runtime_sha,b.old_frozen_runtime_sha);
 assert.equal(old.expected_unchanged_isolated_composer_git_blob_sha,review.previous_composer_git_blob);
 assert.equal(report.status,"PASS_NONAUTHORIZING_PHASE3_AND_FROZEN_SEMANTIC_DIAGNOSTICS_ONLY");
 assert.equal(report.phase3.native_v2_dependency_digest,a.registered_new_dependency_digest);
 assert.equal(report.frozen_v13.historical_frozen_zero_drift_pass,false);
 assert.equal(report.frozen_v13.status,"PASS_EXACT_TWO_RUNTIME_SUCCESSOR_PATHS_NOT_HISTORICAL_ZERO_DRIFT");
 const c=q.checks.find(x=>x.check_id===REVIEW_ID);
 assert(c&&c.carry_forward_evidence_id===null&&c.carry_forward_policy==="NONE_NO_LEGACY_DIGEST_INHERITANCE");
 assert.equal(c.execution_workflow,".github/workflows/mcft-cap09-da9-signed-v2-governance-readonly-v1.yml");
 assert.equal(c.execution_workflow_status,"NONAUTHORIZING_CTO_TECHNICAL_QCP_REGISTERED_FORMAL_APPROVAL_REQUIRED");
 assert.deepEqual(c.resolver_ids,[RESOLVER]);
 assert(c.authority_refs.includes(REG)&&c.authority_refs.includes(REVIEW));
 const own=q.dependency_resolvers[RESOLVER];
 assert(own&&own.kind==="EXACT_PATH_SET");
 assert.deepEqual(own.paths,[
   ".github/workflows/mcft-cap09-da9-signed-v2-governance-readonly-v1.yml",
   REG,REVIEW,
   "scripts/governance_acceptance/REVIEW_MCFT_CAP09_DA9_SIGNED_V2_PHASE3_FROZEN_V13_V1.cjs",
   "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_SIGNED_V2_QCP_TECHNICAL_ENROLLMENT_V1.cjs"
 ].sort());
 assert.equal(reg.qcp_technical_evidence_registered,true);
 assert.equal(reg.qcp_formal_requalification_approved,false);
 assert.equal(reg.independent_retry_governance_approval,false);
 assert.equal(reg.independent_human_governance_signature_recorded,false);
 for(const k of ["signed_bundle_raw_bytes_committed","historical_da9_contract_mutated","historical_frozen_v13_gate_mutated","historical_phase3_digest_rewritten","old_candidate_or_lease_reused","production_authorized","permit_signing_authorized","permit_consumption_authorized","fenced_pg_admitted"])assert.equal(reg[k],false,"AUTHORITY_ESCALATION_FORBIDDEN:"+k);
 for(const a of reg.adjudications)assert.equal(a.formal_registration_claim,false);
 assert.equal(reg.no_provider_refetch,true);assert.equal(reg.no_pg_or_minio_write,true);
 assert.equal(reg.separate_admission_pending.length,4);
 return {status:"PASS_CTO_TECHNICAL_SUCCESSOR_QCP_REGISTRATION_ONLY",
  signed_head:reg.basis_source_sha,phase3_new_digest:a.registered_new_dependency_digest,
  frozen_exact_changed_paths:b.reviewed_changed_runtime_path_count,
  technical_registered:true,old_frozen_gate_still_fails:true,independent_governance_approved:false,
  formal_qcp_qualified:false,isolated_fenced_pg_admitted:false,permit:false,production:false};
}
function negative(reg,review,report,q,old,frozen) {
 let count=0;
 function reject(modify){const clone=structuredClone(reg);modify(clone);assert.throws(()=>verify(clone,review,report,q,old,frozen));count++;}
 reject(v=>v.qcp_formal_requalification_approved=true);
 reject(v=>v.independent_retry_governance_approval=true);
 reject(v=>v.permit_signing_authorized=true);
 reject(v=>v.fenced_pg_admitted=true);
 reject(v=>v.adjudications[0].registered_new_dependency_digest=v.adjudications[0].legacy_digest);
 reject(v=>v.adjudications[1].runtime_path_blobs["apps/server/src/runtime/twin_runtime/external_formal_exact_base_fact_promotion_v1.ts"].new="0".repeat(40));
 reject(v=>v.adjudications[1].frozen_zero_drift_gate_passed=true);
 reject(v=>v.basis_source_sha="0".repeat(40));
 reject(v=>v.basis_signed_bundle_sha256="sha256:"+"0".repeat(64));
 reject(v=>v.qcp_technical_evidence_registered=false);
 return count;
}
function main(){
 const reg=read(REG),review=read(REVIEW),report=read(OUT),q=read(Q),old=read(OLD),frozen=read(FROZEN);
 const v=verify(reg,review,report,q,old,frozen);
 const n=negative(reg,review,report,q,old,frozen);
 console.log(JSON.stringify({...v,negative_tests_pass:n}));
}
try{main()}catch(e){console.error("HOLD_DA9_SIGNED_V2_QCP_TECHNICAL_ENROLLMENT:"+String(e.stack||e));process.exitCode=1;}
