"use strict";
/*
 * CAP09 #3747 QCP65 source-to-merge derivation. All metadata must be
 * independently read from GitHub. Source equivalence is NEVER Adoption,
 * Host, Permit or original six physical stages authorization.
 */
const assert=require("node:assert/strict");
const c=require("./contract.cjs");
const REPO="liyongshang44-max/GEOX",PR=3747;
const BASE="e7a8f30ffb60cb4c2bc6bd83d7bbe487eb708cc9";
const SOURCE="61820645059360ba2c8c44cc2453925a0e68f83e";
const MERGE="d38a5b07a92a63c67fbe2fcc3982ff9b9491e5ac";
const OWNER_SOURCE_COMMENT=6472189448;
const SOURCE_OWNER_TEXT=[
"GEOX_MCFT_CAP09_3747_OWNER_QCP_SOURCE_ADMISSION_V1",
"REPOSITORY="+REPO,"PR=3747","BASE="+BASE,"HEAD="+SOURCE,
"CHECK=DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING",
"POLICY_VERSION=OWNER_DIRECTED_QCP_SOURCE_ADMISSION_V1",
"DECISION=APPROVE_PURPOSE_SPECIFIC_CURRENT_HEAD_FORMAL_QCP_SOURCE_ADMISSION",
"AUTHORITY=GITHUB_REPOSITORY_OWNER_NATIVE_COMMENT",
"INDEPENDENT_ED25519_REVIEW_REQUIRED_FOR_THIS_SOURCE_QCP_SCOPE=false",
"ORIGINAL_3734_SIGNATURES_VERIFIED_FOR_ORIGINAL_SUBJECT_ONLY=true",
"CURRENT_QCP65_SOURCE_ADMISSION_APPROVED=true",
"ADOPTION_V2_SIGNED_ACCEPTANCE_AUTHORIZED=false","HOST_V2_AUTHORIZED=false",
"PERMIT_V2_ISSUE_OR_CONSUME_AUTHORIZED=false","PRODUCTION_AUTHORIZED=false",
"ORIGINAL_FORMAL_SIX_STAGES=0",
"HISTORICAL_FROZEN_V13_FAILURE_UNCHANGED=true",
"HISTORICAL_STAGE3_FAILURE_UNCHANGED=true",
"NO_PROVIDER_REFETCH_NO_OLD_RUN_REPLAY=true",
"THIS_APPROVAL_EXPIRES_ON_ANY_HEAD_OR_POLICY_CHANGE=true"].join("\n");

const FIELDS=["schema_version","repository","pr_number","base_sha","source_subject_sha","subject_sha",
 "source_tree_sha","merge_tree_sha","merge_parents","source_qcp_run_id","source_qcp_attempt",
 "source_qcp_artifact_id","source_qcp_artifact_sha256","source_qcp_results_digest",
 "source_qcp_owner_comment_id","qcp_executed_at_merge_subject","source_tree_equivalent",
 "adoption_authorized","host_authorized","permit_authorized","production_authorized","original_six_stage_count"];
function verifyHistoricalSource(d,p,n){
 c.exact(d,FIELDS);
 assert.equal(d.schema_version,"MCFT_CAP09_3747_POSTMERGE_QCP65_SOURCE_DERIVATION_V1");
 assert.equal(d.repository,REPO);assert.equal(d.pr_number,PR);assert.equal(d.base_sha,BASE);
 assert.equal(d.source_subject_sha,SOURCE);assert.equal(d.subject_sha,MERGE);
 // Historical QCP65 source proof is valid independently of a later main HEAD.
 assert.equal(p.qcp_source_subject_sha,SOURCE,"POSTMERGE_QCP_SOURCE_NOT_EXACT");
 for(const [a,b] of [["source_qcp_run_id","qcp_run_id"],["source_qcp_attempt","qcp_run_attempt"],
  ["source_qcp_artifact_id","qcp_artifact_id"],["source_qcp_artifact_sha256","qcp_artifact_sha256"],
  ["source_qcp_results_digest","qcp_results_digest"]])assert.equal(d[a],p[b],"POSTMERGE_SOURCE_IDENTITY_DRIFT:"+a);
 assert.equal(d.source_qcp_owner_comment_id,OWNER_SOURCE_COMMENT);
 assert.equal(d.qcp_executed_at_merge_subject,false,"POSTMERGE_FALSE_QCP_AT_MERGE");
 assert.equal(d.source_tree_equivalent,true);
 for(const k of ["adoption_authorized","host_authorized","permit_authorized","production_authorized"])
  assert.equal(d[k],false,"POSTMERGE_FALSE_AUTHORITY:"+k);
 assert.equal(d.original_six_stage_count,0);
 const {pr,sourceCommit,mergeCommit,main,sourceOwner}=n;
 assert(pr&&pr.number===PR&&pr.merged===true&&pr.state==="closed","POSTMERGE_PR_NOT_MERGED");
 assert.equal(pr.head?.sha,SOURCE);assert.equal(pr.base?.sha,BASE);
 assert.equal(pr.head?.repo?.full_name,REPO);
 assert.equal(pr.merge_commit_sha,MERGE);assert.equal(pr.merged_at!=null,true);
 assert.equal(sourceCommit?.sha,SOURCE);assert.equal(mergeCommit?.sha,MERGE);
 assert.deepEqual(mergeCommit.parents?.map(x=>x.sha),[BASE,SOURCE],"POSTMERGE_PARENTS_NOT_EXACT");
 assert(/^[0-9a-f]{40}$/.test(sourceCommit.tree?.sha));
 assert.equal(sourceCommit.tree.sha,mergeCommit.tree?.sha,"POSTMERGE_TREE_CHANGED");
 assert.equal(d.source_tree_sha,sourceCommit.tree.sha);
 assert.equal(d.merge_tree_sha,mergeCommit.tree.sha);
 assert.deepEqual(d.merge_parents,[BASE,SOURCE]);
 // Live protected-main assertion is done by verify() or separately by a successor verifier.
 assert.equal(sourceOwner?.id,OWNER_SOURCE_COMMENT);
 assert.equal(sourceOwner.user?.login,"liyongshang44-max");
 assert.equal(sourceOwner.user?.type,"User");
 assert.equal(sourceOwner.author_association,"OWNER");
 assert.equal(sourceOwner.created_at,sourceOwner.updated_at,"POSTMERGE_SOURCE_OWNER_EDITED");
 assert.equal(sourceOwner.issue_url,"https://api.github.com/repos/"+REPO+"/issues/3747",
  "POSTMERGE_SOURCE_APPROVAL_WRONG_PR");
 assert.equal(sourceOwner.html_url,"https://github.com/"+REPO+"/pull/3747#issuecomment-"+OWNER_SOURCE_COMMENT,
  "POSTMERGE_SOURCE_APPROVAL_NOT_NATIVE_PR");
 assert.equal(sourceOwner.body,SOURCE_OWNER_TEXT,"POSTMERGE_SOURCE_OWNER_SCOPE_CHANGED");
 const approved=Date.parse(sourceOwner.created_at),merged=Date.parse(pr.merged_at);
 const committed=Date.parse(sourceCommit.author?.date||sourceCommit.committer?.date);
 assert(Number.isFinite(approved)&&Number.isFinite(merged)&&Number.isFinite(committed)&&committed<=approved&&approved<=merged,
  "POSTMERGE_SOURCE_OWNER_TIMING");
 return Object.freeze({status:"POSTMERGE_QCP65_SOURCE_EQUIVALENCE_VERIFIED_NOT_ADOPTION",
  source_head:SOURCE,merge_head:MERGE,tree_sha:sourceCommit.tree.sha,
  qcp_executed_at_merge_subject:false,adoption_authorized:false,permit_authorized:false});
}
function verify(d,p,n){
 assert.equal(p.subject_sha,MERGE,"POSTMERGE_SIGNED_SUBJECT_NOT_MAIN");
 const result=verifyHistoricalSource(d,p,n);
 assert.equal(n.main?.object?.sha,MERGE,"POSTMERGE_LIVE_MAIN_MOVED");
 return result;
}
function ownerApprovalText(p){
 return ["GEOX_MCFT_CAP09_ADOPTION_V2_PURPOSE_SPECIFIC_OWNER_APPROVAL_V1",
  "REPOSITORY="+REPO,"REVIEW_PR=3748","SOURCE_MERGE_PR=3747","MERGE_HEAD="+MERGE,"ORIGINAL_QCP_SOURCE="+SOURCE,
  "RUN_ID="+p.run_id,"MATERIAL_DIGEST="+p.material_digest,"HOST_ID="+p.host_id,
  "OPERATOR_ID="+p.operator_id,"ADOPTION_ISSUER_ID="+p.issuer_id,
  "ADOPTION_KEY_ID="+p.key_id,"SCOPE=TEST_ONLY",
  "DECISION=APPROVE_FORMAL_ADOPTION_V2_SIGNATURE_REVIEW_ONLY",
  "SIGNATURE_STILL_REQUIRED=true","OPERATOR_SCOPE_GRANT_IF_APPLICABLE=true",
  "HOST_V2_AUTHORIZED=false","PERMIT_V2_ISSUE_OR_CONSUME_AUTHORIZED=false",
  "PHYSICAL_STAGES_AUTHORIZED=false","PRODUCTION_AUTHORIZED=false",
  "ORIGINAL_FORMAL_SIX_STAGES=0"].join("\n");
}
function verifyOwnerApproval(p,comment,sourceOwner){
 assert(Number.isSafeInteger(p.adoption_owner_approval_comment_id)&&p.adoption_owner_approval_comment_id>0);
 assert.notEqual(p.adoption_owner_approval_comment_id,OWNER_SOURCE_COMMENT,
  "ADOPTION_QCP_ONLY_APPROVAL_NOT_ELIGIBLE");
 assert(comment&&comment.id===p.adoption_owner_approval_comment_id);
 assert.equal(comment.user?.login,"liyongshang44-max");
 assert.equal(comment.user?.type,"User");
 assert.equal(comment.author_association,"OWNER");
 assert.equal(comment.created_at,comment.updated_at,"ADOPTION_OWNER_APPROVAL_EDITED");
 assert.equal(comment.issue_url,"https://api.github.com/repos/"+REPO+"/issues/3748",
  "ADOPTION_OWNER_APPROVAL_WRONG_PR");
 assert.equal(comment.html_url,"https://github.com/"+REPO+"/pull/3748#issuecomment-"+comment.id,
  "ADOPTION_OWNER_APPROVAL_NOT_NATIVE_PR");
 assert.equal(comment.body,ownerApprovalText(p),"ADOPTION_OWNER_SCOPE_NOT_EXACT");
 assert(Date.parse(comment.created_at)>Date.parse("2026-10-28T15:03:07Z")&&
  Date.parse(comment.created_at)>Date.parse(sourceOwner.created_at),
  "ADOPTION_OWNER_APPROVAL_STALE");
 return Object.freeze({status:"ADOPTION_V2_OWNER_PURPOSE_APPROVAL_VERIFIED_NOT_SIGNED",
  approval_comment_id:comment.id,host_authorized:false,permit_authorized:false,production_authorized:false});
}
module.exports={REPO,PR,BASE,SOURCE,MERGE,OWNER_SOURCE_COMMENT,FIELDS,verify,verifyHistoricalSource,ownerApprovalText,verifyOwnerApproval};
