#!/usr/bin/env node
"use strict";
// Replaces *only* the new V2 source-successor independent-approval gate with
// explicit repo-owner-directed PR qualification. Never an execution/Permit grant.
// An untrusted JSON or local CLI may NOT stand in for GitHub's PR event context.
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../..");
const DEC="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-OWNER-DIRECTED-SOURCE-ADMISSION-V1.json";
const REQ="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-FORMAL-GOVERNANCE-ADMISSION-REQUEST-V1.json";
const TECH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-QCP-TECHNICAL-ENROLLMENT-V1.json";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const PREVIOUS="scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_FORMAL_GOVERNANCE_ADMISSION_V1.cjs";
const CURRENT="scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_OWNER_DIRECTED_SOURCE_ADMISSION_V1.cjs";
const RES="DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_REQUEST_EXACT_SCOPE_V1";
const CHECK="DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING";
const POLICY_COMMIT="a7739c1cff5f3f3c1f61e0ee19cbb4e659f44c13";
const REPO="liyongshang44-max/GEOX";
const OWNER="liyongshang44-max";
const SRC="6d8fb108655d9ada4b44cc7e4709a1c2ac5832b0";
const BASE="2162f368899e9a9b5c497d332859e4196f389660";
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:4*1024*1024}).trim();
function assertOwnerEvent(ev,env,actualHead){
 assert.equal(env.GITHUB_ACTIONS,"true","HOLD_NOT_AUTHENTIC_GITHUB_ACTIONS_CONTEXT");
 assert.equal(env.GITHUB_EVENT_NAME,"pull_request","HOLD_NOT_PR_EVENT");
 assert.equal(env.GITHUB_REPOSITORY,REPO,"HOLD_OTHER_GITHUB_REPOSITORY");
 assert(ev && ev.pull_request,"HOLD_NO_GITHUB_PR_EVENT");
 const p=ev.pull_request;
 assert.equal(p.number,3732,"HOLD_WRONG_REVIEW_PR");
 assert.equal(p.user?.login,OWNER,"HOLD_PR_NOT_AUTHORED_BY_OWNER");
 assert.equal(p.head?.repo?.full_name,REPO,"HOLD_FOREIGN_HEAD_REPOSITORY");
 assert.equal(p.base?.repo?.full_name,REPO,"HOLD_FOREIGN_BASE_REPOSITORY");
 assert.equal(p.head?.sha,actualHead,"HOLD_CHECKOUT_NOT_PR_EXACT_HEAD");
 assert.equal(p.base?.sha,BASE,"HOLD_UNREVIEWED_MAIN_BASE");
 assert.equal(ev.repository?.full_name,REPO,"HOLD_EVENT_WRONG_REPOSITORY");
}
function validate(d,t,req,q,ev,env,commit){
 assert.equal(d.schema_version,"geox_mcft_cap09_da9_signed_v2_owner_directed_source_admission_v1");
 assert.equal(d.admission_id,"MCFT_CAP09_DA9_V2_OWNER_DIRECTED_SIGNED_SOURCE_QUALIFICATION_ONLY");
 assert.equal(d.decision,"APPROVE_EXACT_SIGNED_SOURCE_SUCCESSOR_WITHOUT_INDEPENDENT_REVIEW");
 assert.equal(d.decision_mode,"REPOSITORY_OWNER_DIRECTED_GOVERNANCE_POLICY_AMENDMENT_NOT_INDEPENDENT_SIGNATURE");
 assert.equal(d.requested_by,"repository_owner_in_active_conversation");
 assert.equal(d.repository,REPO);assert.equal(d.repository_owner,OWNER);
 assert.equal(d.expected_owner_pr,3732);assert.equal(d.signed_source_pr,3731);
 assert.equal(d.signed_source_head,SRC);assert.equal(d.signed_source_base,BASE);
 assert.equal(d.native_six_run_id,t.basis_original_six_native_workflow_run);
 assert.equal(d.native_six_bundle_sha256,t.basis_signed_bundle_sha256);
 assert.equal(d.operator_public_spki_sha256,t.basis_operator_public_spki_sha256);
 assert.equal(d.technical_governance_run_id,40196258357);
 assert.equal(d.technical_registration_path,TECH);
 assert.equal(d.prior_formal_request,REQ);
 assert.equal(req.source_head_sha,SRC);
 assert.equal(req.native_six_signed_bundle_sha256,d.native_six_bundle_sha256);
 assert.equal(req.independent_formal_approval_signature_received,false);
 assert.equal(t.qcp_formal_requalification_approved,false,"HISTORICAL_TECHNICAL_RECORD_MUST_REMAIN_UNMODIFIED");
 assert.equal(t.adjudications.length,2);
 assert.equal(d.decisions.length,2);
 const p=d.decisions[0],f=d.decisions[1];
 assert.equal(p.check_id,"PHASE3_EVIDENCE_RUNTIME_FOUNDATION");
 assert.equal(p.decision,"FRESH_94_PATH_SOURCE_REQUALIFICATION_ACCEPTED_NO_CARRY_FORWARD");
 assert.equal(p.path_count,94);assert.equal(p.changed_historical_paths,31);
 assert.equal(p.old_digest,t.adjudications[0].legacy_digest);
 assert.equal(p.new_digest,t.adjudications[0].registered_new_dependency_digest);
 assert.notEqual(p.old_digest,p.new_digest);
 assert.equal(p.old_evidence_inherited,false);
 assert.equal(f.check_id,"FROZEN_V13_TWO_BLOB_SEMANTIC_SUCCESSOR");
 assert.equal(f.decision,"EXACT_TWO_BLOB_ISOLATED_RETENTION_SEMANTIC_SUCCESSOR_ACCEPTED_NOT_LEGACY_FROZEN");
 assert.equal(f.frozen_scope_paths,108);assert.equal(f.changed_blobs,2);
 assert.equal(f.old_digest,t.adjudications[1].old_runtime_digest);
 assert.equal(f.new_digest,t.adjudications[1].new_runtime_digest);
 assert.deepEqual(f.changed_runtime_blob_pairs,Object.fromEntries(Object.entries(t.adjudications[1].runtime_path_blobs).map(([k,v])=>[k,v])));
 assert.equal(f.legacy_zero_delta_gate_passed,false);
 for(const k of ["requires_github_actions_event_provenance","requires_pr_author_is_repository_owner","requires_head_and_base_repository_owner","requires_complete_native_six_cryptographic_proof","requires_git_object_recompute","requires_existing_qcp_exact_path_scope","prior_independent_governance_request_superseded_for_this_qualification_scope","source_successor_qcp_premerge_owner_policy_approved"])assert.equal(d[k],true,k);
 for(const k of ["historical_frozen_runtime_unchanged","historical_frozen_contract_modified","legacy_phase3_digest_rewritten","independent_review_approval_present","independent_approval_claimed","operator_six_resigned","provider_refetched","raw_pg_s3_modified","post_merge_graduation_authorized","production_authorized","adoption_authorized","fenced_pg_admitted","permit_signing_authorized","permit_consumption_authorized"])assert.equal(d[k],false,k);
 assert.equal(d.scope,"SIGNED_3731_SOURCE_QUALIFICATION_ONLY_PR3732_REVIEWED_POLICY_NO_EXECUTION_AUTHORITY");
 assert.equal(commit.policy_blob_at_introduction,commit.policy_blob_now,"OWNER_POLICY_BYTES_MUTATED");
 assert.equal(commit.policy_introduction_ancestor,true,"OWNER_POLICY_COMMIT_NOT_ANCESTOR");
 assert.equal(commit.pinned_composer_blob, "2d1f72d92c05093537774285bda5b7200845344d");
 const c=q.checks.find(x=>x.check_id===CHECK);
 assert(c);assert.equal(c.execution_workflow_status,"OWNER_DIRECTED_SIGNED_SOURCE_PREMERGE_QUALIFIED_NO_PERMIT");
 assert.equal(c.carry_forward_evidence_id,null);
 assert.equal(c.carry_forward_policy,"NONE_NO_PREDECESSOR_FROZEN_ZERO_DELTA_CARRY_FORWARD");
 assert.equal(c.diagnostic_command,"node "+CURRENT);
 assert.deepEqual(c.authority_refs,[REQ,DEC]);
 assert.deepEqual(c.resolver_ids,[RES]);
 const own=q.dependency_resolvers[RES];
 assert(own);assert.equal(own.kind,"EXACT_PATH_SET");
 assert.deepEqual(own.paths,[
  ".github/workflows/mcft-cap09-da9-signed-v2-governance-readonly-v1.yml",DEC,REQ,PREVIOUS,CURRENT
 ].sort());
 assertOwnerEvent(ev,env,commit.current_head);
 return {status:"PASS_OWNER_DIRECTED_SIGNED_V2_SOURCE_QUALIFICATION_PREMERGE_ONLY",
   source_head:SRC,subject_bound_six_native_signatures:true,phase3_fresh_digest_pass:true,
   frozen_v13_two_blob_successor_pass:true,historical_frozen_zero_drift_pass:false,
   github_pr_author_is_repo_owner:true,owner_policy_intro_commit:POLICY_COMMIT,
   independent_approval_asserted:false,formal_source_successor_premerge_qualified:true,
   postmerge_graduated:false,provider_refetched:false,pg_or_s3_mutated:false,
   fenced_pg_admitted:false,permit:false,production:false};
}
function negative(d,t,req,q,ev,env,commit){
 let pass=0;
 const reject=(fn)=>{const x=structuredClone(d),y=structuredClone(ev),z={...env},w={...commit},Q=structuredClone(q),T=structuredClone(t),R=structuredClone(req);fn(x,y,z,w,Q,T,R);assert.throws(()=>validate(x,T,R,Q,y,z,w));pass++};
 reject(x=>{x.signed_source_head="0".repeat(40)});
 reject(x=>{x.native_six_bundle_sha256="sha256:"+"0".repeat(64)});
 reject(x=>{x.decisions[0].new_digest=x.decisions[0].old_digest});
 reject(x=>{x.decisions[1].changed_blobs=3});
 reject(x=>{x.decisions[1].legacy_zero_delta_gate_passed=true});
 reject(x=>{x.permit_signing_authorized=true});
 reject(x=>{x.fenced_pg_admitted=true});
 reject(x=>{x.production_authorized=true});
 reject(x=>{x.independent_approval_claimed=true});
 reject((x,y)=>{y.pull_request.user.login="other-user"});
 reject((x,y)=>{y.pull_request.head.sha="0".repeat(40)});
 reject((x,y)=>{y.pull_request.base.repo.full_name="malicious/fork"});
 reject((x,y,z)=>{z.GITHUB_ACTIONS="false"});
 reject((x,y,z)=>{z.GITHUB_REPOSITORY="malicious/fork"});
 reject((x,y,z)=>{z.GITHUB_EVENT_NAME="push"});
 reject((x,y,z,w)=>{w.policy_blob_at_introduction="0".repeat(40)});
 reject((x,y,z,w)=>{w.policy_introduction_ancestor=false});
 reject((x,y,z,w,Q)=>{Q.checks.find(k=>k.check_id===CHECK).carry_forward_evidence_id="legacy"});
 reject((x,y,z,w,Q)=>{Q.dependency_resolvers[RES].paths.push("apps/server/src/server.ts")});
 reject((x,y,z,w,Q,T)=>{T.adjudications[1].new_runtime_digest="sha256:"+"0".repeat(64)});
 reject((x,y,z,w,Q,T,R)=>{R.independent_formal_approval_signature_received=true});
 return pass;
}
function main(){
 const d=read(DEC),t=read(TECH),req=read(REQ),q=read(QCP);
 if(!process.env.GITHUB_EVENT_PATH)throw Error("HOLD_GITHUB_EVENT_PATH_REQUIRED");
 const ev=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
 const head=git("rev-parse","HEAD");
 const blob=git("rev-parse","HEAD:"+DEC),intro=git("rev-parse",POLICY_COMMIT+":"+DEC);
 const policy_ancestor=cp.spawnSync("git",["merge-base","--is-ancestor",POLICY_COMMIT,"HEAD"],{cwd:ROOT}).status===0;
 const composer=git("rev-parse",SRC+":"+"scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts");
 const c={policy_blob_at_introduction:intro,policy_blob_now:blob,policy_introduction_ancestor:policy_ancestor,current_head:head,pinned_composer_blob:composer};
 const v=validate(d,t,req,q,ev,process.env,c);
 const n=negative(d,t,req,q,ev,process.env,c);
 assert.equal(n,21);
 console.log(JSON.stringify({...v,negative_tests_pass:n}));
}
try{main()}catch(e){console.error("HOLD_OWNER_DIRECTED_SOURCE_ADMISSION:"+String(e.stack||e));process.exitCode=1;}
