#!/usr/bin/env node
"use strict";
// Purpose-limited V2 successor proof. Verifies ORIGINAL Ed25519 operator signatures
// against original GitHub ZIP + receipt hashes already independently audited.
// No historical Frozen-V13 zero-drift claim, no permit, no Provider/DB/S3 access.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),cp=require("node:child_process");
const assert=require("node:assert/strict");
const ROOT=path.resolve(__dirname,"../..");
const SIGNED="docs/digital_twin/mcft/cap_09/evidence/MCFT-CAP09-DA9-SIGNED-V2-SIX-OPERATOR-REVIEW-20261025.json";
const REVIEW="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-PHASE3-FROZEN-V13-GOVERNANCE-REVIEW-V1.json";
const TRUST="scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json";
const BIND="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-TWO-PARENT-SOURCE-BINDING-V1.json";
const OWNER="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-OWNER-DIRECTED-SOURCE-ADMISSION-V1.json";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const DOMAIN=Buffer.from("GEOX_MCFT_CAP09_STAGE3_SIX_NATIVE_SUCCESSOR_REVIEW_V2\n","utf8");
const SOURCE="6d8fb108655d9ada4b44cc7e4709a1c2ac5832b0";
const GOV="bc367f2ead25b9f28dfd61b1aed394fd864d73b2";
const BASE="2162f368899e9a9b5c497d332859e4196f389660";
const MERGE="876cdcff39fe9c252b591236afd3b9bcdf27a4f4";
const CHECKS=Object.freeze([
 "V13_AUTONOMOUS_FORCING_FOUNDATION","V13_HOLISTIC_SCHEMA",
 "V13_NEXT_TICK_VIABILITY","EA5C1_DURABLE_RAW_RESTRICTED_INGRESS",
 "PHASE3_EVIDENCE_RUNTIME_FOUNDATION","PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION"
]);
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const raw=p=>fs.readFileSync(path.join(ROOT,p));
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:16*1024*1024}).trim();
const blob=(sha,p)=>git("rev-parse",sha+":"+p);
const ancestor=(sha,head)=>cp.spawnSync("git",["merge-base","--is-ancestor",sha,head],{cwd:ROOT,stdio:"ignore"}).status===0;
function validateBundle(a,review,trust,binding,owner,base,head){
 assert.equal(a.schema_version,"geox_mcft_cap09_stage3_six_native_operator_signed_bundle_v2");
 assert.equal(a.status,"SIX_INDEPENDENT_NEW_SUBJECT_OPERATOR_REVIEWS_SIGNED_NO_EXECUTION_AUTHORITY");
 assert.equal(a.subject_sha,SOURCE);
 assert.equal(a.run_id,40188383138);
 assert.equal(a.workflow_path,".github/workflows/mcft-cap09-stage3-composer-six-native-successor-v2.yml");
 assert.equal(a.reviewer_id,"mcft_cap09_operator_mylr1");
 assert.equal(a.all_six_signed,true);
 for(const x of ["original_frozen_v13_qualified","qcp_enrollment_authorized","permit_authorized","production_authorized"])assert.equal(a[x],false);
 assert.equal(review.source_head,SOURCE);assert.equal(review.source_base,BASE);
 assert.equal(review.signed_bundle_sha256,binding.original_signed_bundle_sha256);
 assert.equal(review.signed_composer_git_blob,"2d1f72d92c05093537774285bda5b7200845344d");
 assert.equal(binding.integrated_two_parent_merge,MERGE);assert.equal(binding.source_head,SOURCE);
 assert.equal(binding.governance_head,GOV);assert.equal(binding.historic_main_base,BASE);
 assert.equal(binding.original_signed_bundle_sha256,"sha256:a98f40c3ed017b017a8459d02655b9f206f6716d1402abcc0e579487c63901df");
 assert.equal(owner.signed_source_head,SOURCE);
 assert.equal(owner.independent_approval_claimed,false);
 assert.equal(owner.production_authorized,false);
 assert.equal(owner.permit_signing_authorized,false);
 assert.equal(base,BASE,"HOLD_OTHER_BASE_REQUIRES_FRESH_REBINDING");
 assert(/^([0-9a-f]{40})$/.test(head));
 assert(ancestor(MERGE,head),"HOLD_SIGNED_V2_MERGE_NOT_ANCESTOR");
 assert(ancestor(SOURCE,head)&&ancestor(GOV,head),"HOLD_DA9_PARENT_NOT_ANCESTOR");
 assert.equal(blob(SOURCE,"scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts"),review.signed_composer_git_blob);
 assert.equal(blob(head,"scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts"),review.signed_composer_git_blob);
 assert.equal(a.entries.length,6);assert.equal(review.evidence_entries.length,6);
 assert.equal(new Set(a.entries.map(x=>x.payload.qualification_check_id)).size,6);
 assert.deepEqual(new Set(a.entries.map(x=>x.payload.qualification_check_id)),new Set(CHECKS));
 const issuer=(trust.issuers||[]).find(x=>x.issuer_id==="mcft_cap09_operator_mylr1");
 assert(issuer&&issuer.revoked===false&&issuer.key_id==="mcft_cap09_ed25519_223c806e");
 assert.equal(issuer.role,"ACCOUNTABLE_SINGLE_OPERATOR");
 assert.equal(issuer.spki_sha256,review.signed_public_spki_sha256);
 assert.equal(issuer.spki_sha256,"223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365");
 const key=crypto.createPublicKey(issuer.public_key_pem);
 assert.equal(crypto.createHash("sha256").update(key.export({format:"der",type:"spki"})).digest("hex"),issuer.spki_sha256);
 const report=[];
 for(const item of a.entries){
  const p=item.payload, id=p.qualification_check_id;
  const proof=review.evidence_entries.find(v=>v.check_id===id);
  assert(proof,"HOLD_UNREVIEWED_SIX_CHECK:"+id);
  assert.equal(p.schema_version,"geox_mcft_cap09_stage3_six_native_signed_review_payload_v2");
  assert.equal(p.qualification_check_id,id);
  assert.equal(p.subject_sha,SOURCE);assert.equal(p.base_sha,BASE);
  assert.equal(p.run_id,a.run_id);assert.equal(p.run_attempt,1);assert.equal(p.run_conclusion,"success");
  assert.equal(p.new_workflow_path,a.workflow_path);
  assert.equal(p.evidence_artifact_id,proof.artifact_id);
  assert.equal(p.evidence_artifact_zip_sha256,proof.zip_sha256);
  assert.equal(p.evidence_receipt_sha256,proof.receipt_sha256);
  assert.equal(p.dependency_digest,proof.reviewed_dependency_digest);
  assert.equal(p.original_receipt_dependency_digest,proof.legacy_wire_digest);
  assert.equal(p.original_receipt_dependency_digest,"sha256:"+p.dependency_digest);
  assert.equal(p.issuer_id,issuer.issuer_id);assert.equal(p.key_id,issuer.key_id);
  const signedAt=Date.parse(p.signed_at);
  assert(Number.isFinite(signedAt)&&signedAt>=Date.parse(issuer.not_before)&&signedAt<=Date.parse(issuer.not_after));
  assert.equal(p.original_frozen_v13_requalification_claim,false);
  assert.equal(p.original_six_legacy_signatures_reused,false);
  assert.equal(p.production_authorized,false);
  assert.equal(p.permit_consumed,false);
  assert.equal(p.new_isolated_fenced_pg_authorized,false);
  assert(/^[A-Za-z0-9+/]{86}==$/.test(item.signature_base64));
  const sig=Buffer.from(item.signature_base64,"base64");
  assert.equal(sig.length,64);
  const bytes=Buffer.concat([DOMAIN,Buffer.from(JSON.stringify(p),"utf8")]);
  assert(crypto.verify(null,bytes,key,sig),"HOLD_SIGNATURE_INVALID:"+id);
  assert.equal(blob(SOURCE,p.native_workflow_path),p.native_workflow_blob,"HOLD_NATIVE_WORKFLOW_BLOB_DRIFT:"+id);
  assert.equal(blob(head,p.native_workflow_path),p.native_workflow_blob,"HOLD_MERGE_CHANGED_NATIVE_WORKFLOW:"+id);
  report.push({check_id:id,signature_verified:true,zip_sha256:proof.zip_sha256,receipt_sha256:proof.receipt_sha256,dependency_digest:p.dependency_digest});
 }
 return report;
}
function verifyRegisteredEvidence({decision,stage,head,base}){
 if(!decision||!CHECKS.includes(decision.check_id))return null;
 if(stage!=="SUCCESSOR_SUBJECT_PRE_MERGE"||base!==BASE||!head||!ancestor(MERGE,head))return null;
 try {
  const bytes=raw(SIGNED),sha=crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha,"a98f40c3ed017b017a8459d02655b9f206f6716d1402abcc0e579487c63901df");
  const a=JSON.parse(bytes),review=read(REVIEW),trust=read(TRUST),binding=read(BIND),owner=read(OWNER);
  const rows=validateBundle(a,review,trust,binding,owner,base,head);
  const row=rows.find(x=>x.check_id===decision.check_id);
  assert(row&&row.dependency_digest===decision.dependency_digest,"HOLD_QCP_PLANNER_DEPENDENCY_DIGEST_MISMATCH");
  const q=read(QCP),check=q.checks.find(x=>x.check_id==="DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING");
  assert(check&&check.diagnostic_command==="node scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_TWO_PARENT_SOURCE_BINDING_V1.cjs");
  assert.equal(check.carry_forward_evidence_id,null);
  return {status:"PASS",reason_code:"DA9_SIGNED_SIX_ED25519_EXACT_PARENT_SUCCESSOR_AND_DIGEST_VERIFIED",
   evidence_id:"DA9_V2_ORIGINAL_OPERATOR_SIX_"+row.check_id,run_id:a.run_id,subject_sha:SOURCE,
   artifact_id:a.entries.find(x=>x.payload.qualification_check_id===row.check_id).payload.evidence_artifact_id,
   dependency_digest:row.dependency_digest,signature_verification:"ED25519_VALID_ORIGINAL_SOURCE_ONLY",
   frozen_v13_historical_zero_drift_claim:false,old_signed_evidence_reused:false,permit_authorized:false};
 }catch(error){
  return {status:"FAIL",reason_code:"DA9_V2_SIGNED_SUCCESSOR_VERIFICATION_FAILED:"+String(error.message||error).slice(0,180),
    check_id:decision.check_id,candidates:[],permit_authorized:false};
 }
}
function main(){
 const requested=process.argv.includes("--selftest");
 const base=BASE,head=git("rev-parse","HEAD");
 const bytes=raw(SIGNED),bundle=JSON.parse(bytes),review=read(REVIEW),trust=read(TRUST),binding=read(BIND),owner=read(OWNER);
 const report=validateBundle(bundle,review,trust,binding,owner,base,head);
 assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),"a98f40c3ed017b017a8459d02655b9f206f6716d1402abcc0e579487c63901df");
 const q=read(QCP);
 let checked=0;
 for(const row of report){
  const d=q.checks.find(x=>x.check_id===row.check_id);
  assert(d);
  // QCP planner independently binds dependency digest. Here check signed data and native artifact anchor.
  const v=verifyRegisteredEvidence({decision:{check_id:row.check_id,dependency_digest:row.dependency_digest},stage:"SUCCESSOR_SUBJECT_PRE_MERGE",head,base});
  assert(v&&v.status==="PASS");checked++;
 }
 let negatives=0;
 function rejects(mod){const altered=structuredClone(bundle);mod(altered);assert.throws(()=>validateBundle(altered,review,trust,binding,owner,base,head));negatives++;}
 rejects(x=>x.entries[0].signature_base64=x.entries[0].signature_base64.replace(/^./,"A"));
 rejects(x=>x.entries[0].payload.production_authorized=true);
 rejects(x=>x.entries[0].payload.subject_sha="0".repeat(40));
 rejects(x=>x.entries[0].payload.dependency_digest=x.entries[0].payload.original_receipt_dependency_digest);
 rejects(x=>x.entries[0].payload.evidence_artifact_id=0);
 rejects(x=>x.entries.pop());
 rejects(x=>x.original_frozen_v13_qualified=true);
 rejects(x=>x.permit_authorized=true);
 assert.equal(checked,6);assert.equal(negatives,8);
 console.log(JSON.stringify({status:"PASS_SIX_ORIGINAL_ED25519_SIGNATURES_AND_EXACT_SOURCE_ARTIFACT_BINDING",
   signed_bundle_sha256:"sha256:a98f40c3ed017b017a8459d02655b9f206f6716d1402abcc0e579487c63901df",
   signer_spki_sha256:review.signed_public_spki_sha256,original_operator_signed_subject:SOURCE,
   integration_head:head,verified_checks:checked,negative_tests_pass:negatives,
   historical_frozen_v13_zero_drift_pass:false,production:false,permit:false}));
}
module.exports={required:CHECKS,verifyRegisteredEvidence};
if(require.main===module){try{main()}catch(e){console.error("HOLD_DA9_V2_SIX_SIGNED_QCP_VERIFICATION:"+String(e.stack||e));process.exitCode=1;}}
