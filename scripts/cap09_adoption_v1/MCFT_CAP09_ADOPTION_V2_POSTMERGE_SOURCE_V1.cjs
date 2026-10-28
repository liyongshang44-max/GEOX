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
const FIELDS=["schema_version","repository","pr_number","base_sha","source_subject_sha","subject_sha",
 "source_tree_sha","merge_tree_sha","merge_parents","source_qcp_run_id","source_qcp_attempt",
 "source_qcp_artifact_id","source_qcp_artifact_sha256","source_qcp_results_digest",
 "source_qcp_owner_comment_id","qcp_executed_at_merge_subject","source_tree_equivalent",
 "adoption_authorized","host_authorized","permit_authorized","production_authorized","original_six_stage_count"];
function verify(d,p,n){
 c.exact(d,FIELDS);
 assert.equal(d.schema_version,"MCFT_CAP09_3747_POSTMERGE_QCP65_SOURCE_DERIVATION_V1");
 assert.equal(d.repository,REPO);assert.equal(d.pr_number,PR);assert.equal(d.base_sha,BASE);
 assert.equal(d.source_subject_sha,SOURCE);assert.equal(d.subject_sha,MERGE);
 assert.equal(p.subject_sha,MERGE,"POSTMERGE_SIGNED_SUBJECT_NOT_MAIN");
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
 assert.equal(main?.object?.sha,MERGE,"POSTMERGE_LIVE_MAIN_MOVED");
 assert.equal(sourceOwner?.id,OWNER_SOURCE_COMMENT);
 assert.equal(sourceOwner.user?.login,"liyongshang44-max");
 assert.equal(sourceOwner.user?.type,"User");
 assert.equal(sourceOwner.author_association,"OWNER");
 assert.equal(sourceOwner.created_at,sourceOwner.updated_at,"POSTMERGE_SOURCE_OWNER_EDITED");
 const body=sourceOwner.body;
 assert(typeof body==="string"&&body.startsWith("GEOX_MCFT_CAP09_3747_OWNER_QCP_SOURCE_ADMISSION_V1\n"),
  "POSTMERGE_SOURCE_OWNER_POLICY_CHANGED");
 for(const line of ["REPOSITORY="+REPO,"PR=3747","BASE="+BASE,"HEAD="+SOURCE,
  "DECISION=APPROVE_PURPOSE_SPECIFIC_CURRENT_HEAD_FORMAL_QCP_SOURCE_ADMISSION",
  "CURRENT_QCP65_SOURCE_ADMISSION_APPROVED=true",
  "ADOPTION_V2_SIGNED_ACCEPTANCE_AUTHORIZED=false","HOST_V2_AUTHORIZED=false",
  "PERMIT_V2_ISSUE_OR_CONSUME_AUTHORIZED=false","PRODUCTION_AUTHORIZED=false",
  "ORIGINAL_FORMAL_SIX_STAGES=0"])
  assert(body.split("\n").includes(line),"POSTMERGE_SOURCE_APPROVAL_SCOPE:"+line);
 const approved=Date.parse(sourceOwner.created_at),merged=Date.parse(pr.merged_at);
 const committed=Date.parse(sourceCommit.author?.date||sourceCommit.committer?.date);
 assert(Number.isFinite(approved)&&Number.isFinite(merged)&&Number.isFinite(committed)&&committed<=approved&&approved<=merged,
  "POSTMERGE_SOURCE_OWNER_TIMING");
 return Object.freeze({status:"POSTMERGE_QCP65_SOURCE_EQUIVALENCE_VERIFIED_NOT_ADOPTION",
  source_head:SOURCE,merge_head:MERGE,tree_sha:sourceCommit.tree.sha,
  qcp_executed_at_merge_subject:false,adoption_authorized:false,permit_authorized:false});
}
function ownerApprovalText(p){
 return ["GEOX_MCFT_CAP09_ADOPTION_V2_PURPOSE_SPECIFIC_OWNER_APPROVAL_V1",
  "REPOSITORY="+REPO,"PR=3747","MERGE_HEAD="+MERGE,"ORIGINAL_QCP_SOURCE="+SOURCE,
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
 assert.equal(comment.body,ownerApprovalText(p),"ADOPTION_OWNER_SCOPE_NOT_EXACT");
 assert(Date.parse(comment.created_at)>Date.parse(sourceOwner.created_at),
  "ADOPTION_OWNER_APPROVAL_STALE");
 return Object.freeze({status:"ADOPTION_V2_OWNER_PURPOSE_APPROVAL_VERIFIED_NOT_SIGNED",
  approval_comment_id:comment.id,host_authorized:false,permit_authorized:false,production_authorized:false});
}
module.exports={REPO,PR,BASE,SOURCE,MERGE,OWNER_SOURCE_COMMENT,FIELDS,verify,ownerApprovalText,verifyOwnerApproval};
