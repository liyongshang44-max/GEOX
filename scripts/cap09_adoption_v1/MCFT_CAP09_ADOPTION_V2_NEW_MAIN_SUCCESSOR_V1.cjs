"use strict";
/**
 * CAP-09 #3748: exact new-main source-to-merge proof, NOT an Adoption signature.
 * Frozen #3747 QCP65 is verified independently by its historic identity.
 * The changed V2 executor is separately verified by its CURRENT #3748 source
 * QCP and exact Git merge. No historical signature is reissued/transferred.
 */
const assert=require("node:assert/strict");
const hist=require("./MCFT_CAP09_ADOPTION_V2_POSTMERGE_SOURCE_V1.cjs");
const c=require("./contract.cjs");
const REPO=hist.REPO,PR=3748,BASE=hist.MERGE;
const FIELDS=Object.freeze([
 "schema_version","repository","pr_number","base_sha","source_head_sha","subject_sha",
 "source_tree_sha","merge_tree_sha","merge_parents",
 "source_qcp_run_id","source_qcp_run_attempt","source_qcp_job_id",
 "source_qcp_artifact_id","source_qcp_artifact_sha256",
 "source_qcp_raw_ref","source_qcp_raw_sha256","source_qcp_artifact_ref",
 "historic_3747_qcp65_inherited_without_rewrite",
 "qcp_executed_at_merge_head","adoption_authorized","host_authorized",
 "permit_authorized","production_authorized","original_six_stage_count"
]);
function verify(d,p,n,rawBytes,zipBytes,zipRaw){
 c.exact(d,FIELDS);
 assert.equal(d.schema_version,"MCFT_CAP09_3748_NEW_MAIN_SOURCE_DERIVATION_V1");
 assert.equal(d.repository,REPO);assert.equal(d.pr_number,PR);
 assert.equal(d.base_sha,BASE);
 c.hash(d.source_qcp_artifact_sha256);c.hash(d.source_qcp_raw_sha256);
 c.hash(p.successor_derivation_sha256);
 assert.equal(d.subject_sha,p.subject_sha,"SUCCESSOR_SIGNED_MAIN_SUBJECT_CHANGED");
 assert.equal(d.source_head_sha,p.successor_source_head_sha,"SUCCESSOR_SOURCE_CHANGED");
 assert(/^[a-f0-9]{40}$/.test(d.subject_sha)&&d.subject_sha!==BASE,"SUCCESSOR_NOT_NEW_MAIN");
 assert(/^[a-f0-9]{40}$/.test(d.source_head_sha)&&d.source_head_sha!==d.subject_sha);
 assert.equal(d.historic_3747_qcp65_inherited_without_rewrite,true);
 assert.equal(d.qcp_executed_at_merge_head,false);
 for(const k of ["adoption_authorized","host_authorized","permit_authorized","production_authorized"])
  assert.equal(d[k],false,"SUCCESSOR_FALSE_AUTHORITY:"+k);
 assert.equal(d.original_six_stage_count,0);
 const {pr,sourceCommit,mergeCommit,main,qcpRun,qcpJobList,qcpArtifacts}=n;
 assert(pr&&pr.number===PR&&pr.merged===true&&pr.state==="closed","SUCCESSOR_PR_NOT_MERGED");
 assert.equal(pr.head?.sha,d.source_head_sha,"SUCCESSOR_PR_HEAD_CHANGED");
 assert.equal(pr.head?.repo?.full_name,REPO,"SUCCESSOR_REPO_WRONG");
 assert.equal(pr.base?.sha,BASE,"SUCCESSOR_PR_BASE_CHANGED");
 assert.equal(pr.merge_commit_sha,d.subject_sha,"SUCCESSOR_MERGE_IDENTITY_CHANGED");
 assert(pr.merged_at&&Number.isFinite(Date.parse(pr.merged_at)),"SUCCESSOR_MERGE_TIMESTAMP_REQUIRED");
 assert.equal(sourceCommit?.sha,d.source_head_sha);
 assert.equal(mergeCommit?.sha,d.subject_sha);
 assert.deepEqual(mergeCommit.parents?.map(x=>x.sha),[BASE,d.source_head_sha],"SUCCESSOR_MERGE_PARENTS_CHANGED");
 assert.equal(sourceCommit.tree?.sha,mergeCommit.tree?.sha,"SUCCESSOR_MERGE_TREE_NOT_EXACT_SOURCE");
 assert.equal(d.source_tree_sha,sourceCommit.tree.sha);
 assert.equal(d.merge_tree_sha,mergeCommit.tree.sha);
 assert.deepEqual(d.merge_parents,[BASE,d.source_head_sha]);
 assert.equal(main?.object?.sha,d.subject_sha,"SUCCESSOR_LIVE_PROTECTED_MAIN_NOT_EXACT");
 for(const field of ["source_qcp_run_id","source_qcp_run_attempt","source_qcp_job_id","source_qcp_artifact_id"])
  assert(Number.isSafeInteger(d[field])&&d[field]>0,"SUCCESSOR_QCP_NATIVE_ID_REQUIRED:"+field);
 assert(qcpRun&&qcpRun.id===d.source_qcp_run_id&&qcpRun.head_sha===d.source_head_sha);
 assert.equal(qcpRun.name,"mcft-cap-09-qualification-control-plane-v1");
 assert.equal(qcpRun.path,".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml");
 assert.equal(qcpRun.event,"pull_request");
 assert.equal(qcpRun.run_attempt,d.source_qcp_run_attempt);
 assert.equal(qcpRun.status,"completed");
 assert.equal(qcpRun.conclusion,"success","SUCCESSOR_QCP_NOT_SUCCESS");
 assert(Array.isArray(qcpRun.pull_requests));
 if(qcpRun.pull_requests.length>0)
  assert(qcpRun.pull_requests.some(x=>x.number===PR&&x.head?.sha===d.source_head_sha&&x.base?.sha===BASE),
   "SUCCESSOR_QCP_WRONG_PR_ASSOCIATION");
 const job=qcpJobList?.jobs?.find(x=>x.id===d.source_qcp_job_id);
 assert(job&&job.name==="applicability-and-blocker-inventory"&&job.conclusion==="success",
  "SUCCESSOR_QCP_JOB_UNQUALIFIED");
 const art=qcpArtifacts?.artifacts?.find(x=>x.id===d.source_qcp_artifact_id);
 assert(art&&!art.expired&&art.name==="mcft-cap09-qualification-control-plane-"+d.source_head_sha,
  "SUCCESSOR_QCP_ARTIFACT_WRONG");
 assert.equal(art.digest,"sha256:"+d.source_qcp_artifact_sha256);
 assert.equal(art.workflow_run?.id,qcpRun.id);
 assert.equal(art.workflow_run?.head_sha,d.source_head_sha);
 assert(Number.isFinite(Date.parse(job.started_at))&&Number.isFinite(Date.parse(job.completed_at))&&
   Number.isFinite(Date.parse(art.created_at)),"SUCCESSOR_QCP_TIMES_INVALID");
 assert(Date.parse(job.started_at)<=Date.parse(art.created_at)&&
   Date.parse(art.created_at)<=Date.parse(job.completed_at),"SUCCESSOR_QCP_ARTIFACT_JOB_TIME_CHANGED");
 assert(Buffer.isBuffer(rawBytes)&&Buffer.isBuffer(zipBytes));
 assert.equal(c.sha(rawBytes),d.source_qcp_raw_sha256,"SUCCESSOR_QCP_RAW_BYTES_CHANGED");
 assert.equal(c.sha(zipBytes),d.source_qcp_artifact_sha256,"SUCCESSOR_QCP_ZIP_BYTES_CHANGED");
 assert.equal(typeof zipRaw,"function");
 assert(zipRaw(zipBytes).equals(rawBytes),"SUCCESSOR_QCP_RAW_NOT_IN_NATIVE_ARTIFACT");
 const machine=JSON.parse(rawBytes.toString("utf8"));
 assert.equal(machine.status,"PASS","SUCCESSOR_QCP_MACHINE_NOT_PASS");
 assert.equal(machine.head_sha,d.source_head_sha,"SUCCESSOR_QCP_MACHINE_HEAD_NOT_SOURCE");
 const counts=machine.counts||{};
 for(const k of ["fail","unknown","forbidden","authority_errors","unknown_changed_paths","blocker_count"])
  assert.equal(counts[k],0,"SUCCESSOR_QCP_BLOCKER:"+k);
 assert.equal(counts.total_checks,65,"SUCCESSOR_QCP_65_REQUIRED");
 assert.equal(counts.pass+counts.not_applicable,65,"SUCCESSOR_QCP_INCOMPLETE");
 assert.deepEqual(machine.blockers,[]);
 assert(Array.isArray(machine.results)&&machine.results.length===65,"SUCCESSOR_QCP_RESULTS_INCOMPLETE");
 const ids=new Set();
 for(const r of machine.results){
  assert(typeof r.check_id==="string"&&!ids.has(r.check_id),"SUCCESSOR_QCP_DUPLICATE_CHECK");
  ids.add(r.check_id);
  assert(r.status==="PASS"||r.status==="NOT_APPLICABLE","SUCCESSOR_QCP_UNRESOLVED_CHECK");
  if(r.status==="NOT_APPLICABLE")assert(typeof r.reason_code==="string"&&r.reason_code,
    "SUCCESSOR_QCP_NA_REASON_REQUIRED");
 }
 return Object.freeze({status:"SUCCESSOR_CURRENT_SOURCE_AND_EXACT_MAIN_VERIFIED_NOT_ADOPTION",
  historical_3747_qcp_reused:true,new_source_head:d.source_head_sha,new_main_head:d.subject_sha,
  qcp_executed_at_merge_head:false,adoption_authorized:false,
  permit_authorized:false,original_six_stage_count:0,production_authorized:false});
}

function ownerApprovalText(p){
 return ["GEOX_MCFT_CAP09_ADOPTION_V2_NEW_MAIN_OWNER_APPROVAL_V1",
  "REPOSITORY="+REPO,"REVIEW_PR=3748",
  "HISTORICAL_SOURCE_PR=3747","HISTORICAL_MERGE_HEAD="+BASE,
  "SUCCESSOR_SOURCE_HEAD="+p.successor_source_head_sha,
  "NEW_MAIN_HEAD="+p.subject_sha,
  "RUN_ID="+p.run_id,"MATERIAL_DIGEST="+p.material_digest,
  "HOST_ID="+p.host_id,"OPERATOR_ID="+p.operator_id,
  "ADOPTION_ISSUER_ID="+p.issuer_id,"ADOPTION_KEY_ID="+p.key_id,
  "SCOPE=TEST_ONLY",
  "DECISION=APPROVE_EXACT_NEW_MAIN_ADOPTION_V2_SIGNING_REVIEW_ONLY",
  "HISTORICAL_3747_SIGNED_PROOF_REUSED_ONLY_FOR_UNCHANGED_SUBJECT=true",
  "SUCCESSOR_EXECUTION_BYTES_REQUIRE_CURRENT_QCP=true",
  "SIGNATURE_STILL_REQUIRED=true","OPERATOR_SCOPE_GRANT_IF_APPLICABLE=true",
  "HOST_V2_AUTHORIZED=false","PERMIT_V2_ISSUE_OR_CONSUME_AUTHORIZED=false",
  "PHYSICAL_STAGES_AUTHORIZED=false","PRODUCTION_AUTHORIZED=false",
  "ORIGINAL_FORMAL_SIX_STAGES=0"].join("\n");
}
function verifyOwnerApproval(p,comment,{sourceOwner,newMergePr}){
 assert(Number.isSafeInteger(p.adoption_owner_approval_comment_id)&&p.adoption_owner_approval_comment_id>0);
 assert.notEqual(p.adoption_owner_approval_comment_id,hist.OWNER_SOURCE_COMMENT);
 assert(comment&&comment.id===p.adoption_owner_approval_comment_id);
 assert.equal(comment.user?.login,"liyongshang44-max");
 assert.equal(comment.user?.type,"User");
 assert.equal(comment.author_association,"OWNER");
 assert.equal(comment.created_at,comment.updated_at,"SUCCESSOR_OWNER_APPROVAL_EDITED");
 assert.equal(comment.issue_url,"https://api.github.com/repos/"+REPO+"/issues/3748");
 assert.equal(comment.html_url,"https://github.com/"+REPO+"/pull/3748#issuecomment-"+comment.id);
 assert.equal(comment.body,ownerApprovalText(p),"SUCCESSOR_OWNER_APPROVAL_NOT_EXACT");
 const approved=Date.parse(comment.created_at),merged=Date.parse(newMergePr?.merged_at);
 assert(Number.isFinite(approved)&&Number.isFinite(merged)&&approved>=merged,
  "SUCCESSOR_OWNER_APPROVAL_PREMERGE");
 assert(approved>Date.parse(sourceOwner.created_at),"SUCCESSOR_OWNER_APPROVAL_STALE");
 return Object.freeze({status:"EXACT_NEW_MAIN_OWNER_ADOPTION_V2_REVIEW_APPROVED_NOT_SIGNED",
  adoption_signature_present:false,permit_authorized:false,production_authorized:false});
}

module.exports={REPO,PR,BASE,FIELDS,verify,ownerApprovalText,verifyOwnerApproval};
