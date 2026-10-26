#!/usr/bin/env node
"use strict";
// An INDEPENDENT, READ-ONLY GOVERNANCE REVIEW. This never updates QCP,
// impersonates the independent retry-governance issuer, or grants a Permit.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const cp=require("node:child_process");
const path=require("node:path");
const crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../..");
const CONTRACT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-PHASE3-FROZEN-V13-GOVERNANCE-REVIEW-V1.json";
const Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const OLD="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-FROZEN-SEMANTIC-SUCCESSOR-V1.json";
const FROZEN="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FROZEN-V13-REQUALIFICATION-CONTRACT-V1.json";
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",maxBuffer:32*1024*1024,stdio:["ignore","pipe","pipe"]}).trim();
const SHA=/^[0-9a-f]{40}$/;
function assertReadOnlyContract(review) {
 assert.equal(review.contract_id,"MCFT_CAP09_SIGNED_COMPOSER_V2_PHASE3_FROZEN_V13_SEPARATE_GOVERNANCE_REVIEW_V1");
 assert.equal(review.status,"EVIDENCE_TECHNICALLY_VERIFIED_REVIEW_ONLY_NOT_ENROLLED");
 for(const k of ["qcp_enrollment_approved","legacy_frozen_v13_qualified","old_signed_evidence_reused","separate_independent_governance_approver_recorded","production_authorized","permit_signing_authorized","permit_consumption_authorized","new_isolated_fenced_pg_authorized","provider_refetch_authorized","third_attempt_authorized"])
  assert.equal(review[k],false,"UNAUTHORIZED_REVIEW_CLAIM:"+k);
 const old=read(OLD),frozen=read(FROZEN);
 assert.equal(old.expected_unchanged_isolated_composer_git_blob_sha,review.previous_composer_git_blob,"OLD_DA9_BLOB_MUTATED");
 assert.equal(old.historical_frozen_runtime_sha,review.frozen_v13.historical_runtime_sha,"DA9_HISTORICAL_FROZEN_CHANGED");
 assert.equal(frozen.frozen_runtime_sha,review.frozen_v13.historical_runtime_sha,"FROZEN_HISTORICAL_ANCHOR_CHANGED");
 assert.equal(review.frozen_v13.historical_zero_drift_gate_status,"FAIL");
 assert.equal(review.frozen_v13.historical_zero_drift_verifier_retained,true);
 assert.equal(review.phase3.no_legacy_digest_rewrite,true);
 assert.equal(review.phase3.disposition,"HISTORICAL_DIGEST_REJECTED_FRESH_SIGNED_V2_SUBJECT_REQUALIFICATION_PROVEN_NOT_AUTOMATIC_QCP_CARRY_FORWARD");
 assert.equal(review.signed_bundle_sha256,"sha256:a98f40c3ed017b017a8459d02655b9f206f6716d1402abcc0e579487c63901df");
 assert.equal(review.signed_public_spki_sha256,"223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365");
 assert.equal(review.source_head,"6d8fb108655d9ada4b44cc7e4709a1c2ac5832b0");
 assert.equal(review.source_base,"2162f368899e9a9b5c497d332859e4196f389660");
 assert.equal(review.source_workflow_run_id,40188383138);
 assert.equal(review.source_workflow_run_attempt,1);
 assert.equal(review.evidence_entries.length,6);
 assert.equal(new Set(review.evidence_entries.map(x=>x.check_id)).size,6);
 for(const e of review.evidence_entries){
  assert(/^sha256:[0-9a-f]{64}$/.test(e.reviewed_dependency_digest),"NONCANONICAL_DEPENDENCY_DIGEST");
  assert.equal(e.legacy_wire_digest,"sha256:"+e.reviewed_dependency_digest,"DOUBLE_PREFIX_MAPPING_CHANGED");
  assert(/^sha256:[0-9a-f]{64}$/.test(e.zip_sha256));
  assert(/^sha256:[0-9a-f]{64}$/.test(e.receipt_sha256));
 }
 assert(SHA.test(review.source_head)&&SHA.test(review.phase3.historical_subject));
 assert.equal(git("rev-parse",review.source_head+":"+"scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts"),review.signed_composer_git_blob,"PINNED_PYTHON_COMPOSER_DRIFT");
 assert.equal(git("rev-parse",review.source_head+":"+review.source_workflow_path).length,40);
 return review;
}
function phase3(review) {
 const planner=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");
 const q=read(Q),r=planner.resolveDependencyResolvers(ROOT,q);
 assert.deepEqual(r.errors,[],"QCP_RESOLVER_INVALID");
 const s=r.resolved.PHASE3_EVIDENCE_RUNTIME_FOUNDATION;
 assert(s&&s.paths.length===94,"PHASE3_EXACT_94_PATH_SCOPE_CHANGED");
 assert.deepEqual(q.checks.find(x=>x.check_id==="PHASE3_EVIDENCE_RUNTIME_FOUNDATION").resolver_ids,["PHASE3_EVIDENCE_RUNTIME_FOUNDATION"]);
 const now=planner.dependencyDigestForPaths(ROOT,review.source_head,s.paths,false);
 assert.deepEqual(now.missing,[],"PHASE3_PINNED_SOURCE_UNRESOLVED");
 const cat={PHASE3_EVIDENCE_RUNTIME_FOUNDATION:{current:now}};
 const aggregate=planner.aggregateCheckDependencyDigest(["PHASE3_EVIDENCE_RUNTIME_FOUNDATION"],cat,"current");
 assert.deepEqual(aggregate.missing,[],"PHASE3_AGGREGATE_DIGEST_UNRESOLVED");
 assert.equal(aggregate.digest,review.phase3.new_subject_dependency_digest,"NEW_PHASE3_EXACT_SUBJECT_DIGEST_MISMATCH");
 assert.notEqual(aggregate.digest,review.phase3.historical_dependency_digest,"OLD_PHASE3_DIGEST_MUST_NOT_CARRY_FORWARD");
 const missing=[];const changed=[];
 for(const rel of s.paths){
  let historical=null;try{historical=git("rev-parse",review.phase3.historical_subject+":"+rel)}catch{missing.push(rel);}
  const current=git("rev-parse",review.source_head+":"+rel);
  if(historical!==current)changed.push({path:rel,historical_blob:historical,current_blob:current});
 }
 assert.equal(changed.length,review.phase3.historical_changed_paths,"PHASE3_CHANGE_SET_SCOPE_DRIFT");
 assert.equal(missing.length,review.phase3.historical_missing_paths,"PHASE3_NEW_PATH_SET_DRIFT");
 assert.deepEqual(missing,["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_GFS_MEMBER_RETRY_RESILIENCE_V1.ts"],"PHASE3_HISTORICALLY_MISSING_PATH_CHANGED");
 assert.equal(review.evidence_entries.find(e=>e.check_id==="PHASE3_EVIDENCE_RUNTIME_FOUNDATION").reviewed_dependency_digest,aggregate.digest);
 const report={status:"PASS_PHASE3_FRESH_SOURCE_DIGEST_RECONCILED_LEGACY_NOT_INHERITED",
   old_subject:review.phase3.historical_subject,source_subject:review.source_head,legacy_dependency_digest:review.phase3.historical_dependency_digest,
   native_v2_dependency_digest:aggregate.digest,paths:s.paths.length,changed_path_count:changed.length,
   legacy_missing_paths:missing,changed_paths:changed,old_evidence_carry_forward:false,new_run_already_signed_and_independently_verified:true,
   production_authorized:false,permit:false};
 return report;
}
function frozen(review) {
 const planner=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs"),q=read(Q);
 const r=planner.resolveDependencyResolvers(ROOT,q);
 assert.deepEqual(r.errors,[],"FROZEN_V13_RESOLVER_INVALID");
 const scope=r.resolved[review.frozen_v13.runtime_resolver_id];
 assert(scope&&scope.paths.length===108,"FROZEN_V13_RUNTIME_108_COUNT_CHANGED");
 const base=review.frozen_v13.historical_runtime_sha,head=review.source_head;
 const expected=review.frozen_v13.known_semantic_successor_paths;
 assert.equal(Object.keys(expected).length,2,"EXPECTED_TWO_RUNTIME_DELTAS_CHANGED");
 const changed=scope.paths.filter(rel=>{
  let old=null,current=null;
  try{old=git("rev-parse",base+":"+rel)}catch{}
  try{current=git("rev-parse",head+":"+rel)}catch{}
  return old!==current;
 }).sort();
 const expectedPaths=Object.keys(expected).sort();
 const report={status:JSON.stringify(changed)===JSON.stringify(expectedPaths)?"PASS_EXACT_TWO_RUNTIME_SUCCESSOR_PATHS_NOT_HISTORICAL_ZERO_DRIFT":"HOLD_UNREVIEWED_FROZEN_RUNTIME_DRIFT",
   source_subject:head,frozen_subject:base,scope_paths:scope.paths.length,
   changed_runtime_paths:changed,expected_changed_paths:expectedPaths,
   historical_frozen_zero_drift_pass:false,old_frozen_verifier_changed:false,
   successor_two_path_review_technical_only:true,independent_governance_approval:false,
   production_authorized:false,permit:false};
 assert.deepEqual(changed,expectedPaths,"UNREVIEWED_FROZEN_RUNTIME_PATH_DIFF:"+JSON.stringify(report));
 for(const rel of expectedPaths){
  const current=git("rev-parse",head+":"+rel),prior=git("rev-parse",base+":"+rel);
  assert.equal(prior,expected[rel].frozen_blob,"FROZEN_RUNTIME_BASE_BLOB_CHANGED:"+rel);
  assert.equal(current,expected[rel].reviewed_blob,"FROZEN_RUNTIME_CANDIDATE_BLOB_CHANGED:"+rel);
 }
 const frozenDigest=planner.dependencyDigestForPaths(ROOT,base,scope.paths,false);
 const currentDigest=planner.dependencyDigestForPaths(ROOT,head,scope.paths,false);
 assert.deepEqual(frozenDigest.missing,[]);assert.deepEqual(currentDigest.missing,[]);
 assert.notEqual(frozenDigest.digest,currentDigest.digest,"FROZEN_V13_NOT_ACTUALLY_CHANGED");
 report.historical_frozen_runtime_digest=frozenDigest.digest;
 report.successor_runtime_digest=currentDigest.digest;
 return report;
}
function main(){
 const review=assertReadOnlyContract(read(CONTRACT));
 const p=phase3(review),f=frozen(review);
 const output={schema_version:"geox_mcft_cap09_da9_v2_independent_governance_technical_audit_v1",
  status:"PASS_NONAUTHORIZING_PHASE3_AND_FROZEN_SEMANTIC_DIAGNOSTICS_ONLY",
  source_subject:review.source_head,source_base:review.source_base,
  original_six_signed_review_digest:review.signed_bundle_sha256,
  six_operator_signatures_independently_verified_in_prior_readonly_audit:true,
  six_new_source_ci_jobs_verified_in_prior_readonly_audit:true,
  phase3:p,frozen_v13:f,signature_key_custody_independence_verified:false,
  qcp_enrollment_approved:false,old_frozen_gate_cleared:false,
  new_isolated_fenced_pg_admitted:false,production_authorized:false,permit:false};
 const out="acceptance-output/MCFT_CAP09_DA9_V2_SIGNED_GOVERNANCE_TECHNICAL_AUDIT_V1.json";
 fs.mkdirSync(path.join(ROOT,"acceptance-output"),{recursive:true});
 fs.writeFileSync(path.join(ROOT,out),JSON.stringify(output,null,2)+"\n",{flag:"w",mode:0o600});
 console.log(JSON.stringify({status:output.status,subject:output.source_subject,phase3_paths:p.paths,phase3_changed:p.changed_path_count,
 frozen_paths:f.scope_paths,frozen_changed:f.changed_runtime_paths.length,qcp:false,permit:false}));
}
try{main()}catch(e){console.error("HOLD_INDEPENDENT_DA9_GOVERNANCE:"+String(e.stack||e));process.exitCode=1}
