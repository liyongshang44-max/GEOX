"use strict";
// Synthetic fixture for exact NEW MAIN proof; never signs Adoption/Permit.
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const s=require("./MCFT_CAP09_ADOPTION_V2_NEW_MAIN_SUCCESSOR_V1.cjs");
const historical=require("./MCFT_CAP09_ADOPTION_V2_POSTMERGE_SOURCE_V1.cjs");
const adoption=require("./MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs");
const c=require("./contract.cjs");
const digest=b=>crypto.createHash("sha256").update(b).digest("hex");
function storedZip(name,data){
 const nm=Buffer.from(name),a=Buffer.alloc(30),b=Buffer.alloc(46),e=Buffer.alloc(22);
 a.writeUInt32LE(0x04034b50,0);a.writeUInt32LE(data.length,18);a.writeUInt32LE(data.length,22);a.writeUInt16LE(nm.length,26);
 b.writeUInt32LE(0x02014b50,0);b.writeUInt32LE(data.length,20);b.writeUInt32LE(data.length,24);b.writeUInt16LE(nm.length,28);
 const offset=a.length+nm.length+data.length;
 e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(1,8);e.writeUInt16LE(1,10);e.writeUInt32LE(b.length+nm.length,12);e.writeUInt32LE(offset,16);
 return Buffer.concat([a,nm,data,b,nm,e]);
}
function fixture(){
 const source="a".repeat(40),subject="b".repeat(40),tree="c".repeat(40);
 const qcp={
  status:"PASS",head_sha:source,counts:{total_checks:65,pass:65,not_applicable:0,fail:0,unknown:0,
   forbidden:0,authority_errors:0,unknown_changed_paths:0,blocker_count:0},
  blockers:[],results:Array.from({length:65},(_,i)=>({check_id:"CURRENT_CHECK_"+i,status:"PASS"}))
 };
 const raw=Buffer.from(JSON.stringify(qcp));
 const zip=storedZip("MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json",raw);
 const proof={schema_version:"MCFT_CAP09_3748_NEW_MAIN_SOURCE_DERIVATION_V1",
  repository:s.REPO,pr_number:3748,base_sha:s.BASE,source_head_sha:source,subject_sha:subject,
  source_tree_sha:tree,merge_tree_sha:tree,merge_parents:[s.BASE,source],
  source_qcp_run_id:44501000000,source_qcp_run_attempt:1,source_qcp_job_id:177700000,
  source_qcp_artifact_id:177700001,source_qcp_artifact_sha256:digest(zip),
  source_qcp_raw_ref:"SUCCESSOR_QCP_RAW.json",source_qcp_raw_sha256:digest(raw),
  source_qcp_artifact_ref:"SUCCESSOR_QCP_ARTIFACT.zip",
  historic_3747_qcp65_inherited_without_rewrite:true,qcp_executed_at_merge_head:false,
  adoption_authorized:false,host_authorized:false,permit_authorized:false,
  production_authorized:false,original_six_stage_count:0};
 const p={subject_sha:subject,successor_source_head_sha:source,successor_derivation_sha256:c.digest(proof),
  adoption_owner_approval_comment_id:7900000000,material_digest:"d".repeat(64),
  run_id:"6ff9b41f6f7f",host_id:"LAPTOP-STN2A2P1",
  operator_id:"mcft_cap09_operator_mylr1",issuer_id:"mcft_cap09_operator_mylr1",
  key_id:"mcft_cap09_ed25519_223c806e"};
 const pr={number:3748,merged:true,state:"closed",
  head:{sha:source,repo:{full_name:s.REPO}},base:{sha:s.BASE},
  merge_commit_sha:subject,merged_at:"2026-10-28T19:00:00Z"};
 const n={pr,sourceCommit:{sha:source,tree:{sha:tree}},
  mergeCommit:{sha:subject,tree:{sha:tree},parents:[{sha:s.BASE},{sha:source}]},
  main:{object:{sha:subject}},
  qcpRun:{id:proof.source_qcp_run_id,head_sha:source,
   name:"mcft-cap-09-qualification-control-plane-v1",
   path:".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
   event:"pull_request",run_attempt:1,status:"completed",conclusion:"success",
   pull_requests:[]},
  qcpJobList:{jobs:[{id:proof.source_qcp_job_id,name:"applicability-and-blocker-inventory",
    conclusion:"success",started_at:"2026-10-28T18:00:00Z",completed_at:"2026-10-28T18:10:00Z"}]},
  qcpArtifacts:{artifacts:[{id:proof.source_qcp_artifact_id,expired:false,
   name:"mcft-cap09-qualification-control-plane-"+source,
   digest:"sha256:"+proof.source_qcp_artifact_sha256,
   workflow_run:{id:proof.source_qcp_run_id,head_sha:source},created_at:"2026-10-28T18:05:00Z"}]}
 };
 return {proof,p,n,raw,zip};
}
test("new exact merge + native successor QCP can inherit only immutable historic proof",()=>{
 const x=fixture();const result=s.verify(x.proof,x.p,x.n,x.raw,x.zip,adoption.zipRaw);
 assert.equal(result.status,"SUCCESSOR_CURRENT_SOURCE_AND_EXACT_MAIN_VERIFIED_NOT_ADOPTION");
 assert.equal(result.historical_3747_qcp_reused,true);
 assert.equal(result.qcp_executed_at_merge_head,false);
 assert.equal(result.production_authorized,false);
});
test("no premerge, changed main, altered source, QCP forgery or false authority",()=>{
 const original=fixture();
 const attacks=[
 x=>x.n.pr.merged=false,
 x=>x.n.pr.state="open",
 x=>x.n.pr.base.sha="0".repeat(40),
 x=>x.n.pr.head.sha="0".repeat(40),
 x=>x.n.pr.merge_commit_sha="0".repeat(40),
 x=>x.n.mergeCommit.parents.reverse(),
 x=>x.n.mergeCommit.tree.sha="0".repeat(40),
 x=>x.n.main.object.sha=s.BASE,
 x=>x.proof.source_head_sha="0".repeat(40),
 x=>x.proof.adoption_authorized=true,
 x=>x.proof.permit_authorized=true,
 x=>x.proof.historic_3747_qcp65_inherited_without_rewrite=false,
 x=>x.proof.qcp_executed_at_merge_head=true,
 x=>x.n.qcpRun.conclusion="failure",
 x=>x.n.qcpRun.head_sha=s.BASE,
 x=>x.n.qcpArtifacts.artifacts[0].expired=true,
 x=>x.n.qcpArtifacts.artifacts[0].digest="sha256:"+"0".repeat(64),
 x=>x.n.qcpJobList.jobs[0].conclusion="failure",
 x=>{const v=JSON.parse(x.raw);v.status="FAIL";x.raw=Buffer.from(JSON.stringify(v));},
 x=>{const v=JSON.parse(x.raw);v.counts.blocker_count=1;x.raw=Buffer.from(JSON.stringify(v));},
 x=>{x.zip=Buffer.from(x.zip);x.zip[0]=0;}
 ];
 for(const attack of attacks){
  const x=fixture();attack(x);
  assert.throws(()=>s.verify(x.proof,x.p,x.n,x.raw,x.zip,adoption.zipRaw));
 }
 assert.equal(attacks.length,21);
});
test("formal Owner approval only for exact new merged subject and material after merge",()=>{
 const x=fixture(),p=x.p,n=x.n;
 const id=p.adoption_owner_approval_comment_id;
 const sourceOwner={created_at:"2026-10-28T14:48:20Z"};
 const when="2026-10-28T19:10:00Z";
 const comment={id,created_at:when,updated_at:when,user:{login:"liyongshang44-max",type:"User"},
  author_association:"OWNER",
  issue_url:"https://api.github.com/repos/"+s.REPO+"/issues/3748",
  html_url:"https://github.com/"+s.REPO+"/pull/3748#issuecomment-"+id,
  body:s.ownerApprovalText(p)};
 const input={sourceOwner,newMergePr:n.pr};
 assert.equal(s.verifyOwnerApproval(p,comment,input).permit_authorized,false);
 for(const attack of [
  x=>x.comment.body=x.comment.body.replace("NEW_MAIN_HEAD="+p.subject_sha,"NEW_MAIN_HEAD="+s.BASE),
  x=>x.comment.body=x.comment.body.replace("PRODUCTION_AUTHORIZED=false","PRODUCTION_AUTHORIZED=true"),
  x=>x.comment.created_at="2026-10-28T18:59:59Z",
  x=>x.comment.updated_at="2026-10-28T20:00:00Z",
  x=>x.comment.issue_url="https://api.github.com/repos/"+s.REPO+"/issues/3747",
  x=>x.p.material_digest="f".repeat(64),
  x=>x.p.subject_sha="0".repeat(40),
  x=>x.p.adoption_owner_approval_comment_id=historical.OWNER_SOURCE_COMMENT
 ]){
  const v={p:structuredClone(p),comment:structuredClone(comment)};
  attack(v);assert.throws(()=>s.verifyOwnerApproval(v.p,v.comment,input));
 }
});
