"use strict";
// This is an engineering QCP evidence collector / verifier / operator signer.
// Never imports a Permit signer or invokes any stage or Provider.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),cp=require("node:child_process"),rl=require("node:readline/promises");
const ROOT=path.resolve(__dirname,"../.."),verify=require("./VERIFY_MCFT_CAP09_DA9_FROZEN_SEMANTIC_SUCCESSOR_V1.cjs");
const BASE="2b63652297bb285f21c4d4c63c37d247d009142c";
const C="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-FROZEN-SEMANTIC-SUCCESSOR-V1.json";
const Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const E="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIX-CHECK-EVIDENCE-V1.json";
const TRUST="scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json";
const DOMAIN="GEOX_MCFT_CAP09_DA9_FROZEN_SEMANTIC_SUCCESSOR_SIX_CHECK_V1\n";
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8")),git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const head=()=>git("rev-parse","HEAD");
const api=async p=>{
 const token=process.env.GITHUB_TOKEN||process.env.GH_TOKEN;
 assert(token,"GITHUB_READONLY_ACTIONS_TOKEN_REQUIRED");
 const r=await fetch("https://api.github.com/repos/liyongshang44-max/GEOX"+p,
 {headers:{Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}});
 assert(r.ok,"GITHUB_ACTIONS_EVIDENCE_HTTP_"+r.status);
 return r.json();
};
function decisions(){
 const sc=verify.scope(),h=head(),p=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");
 const authority=read(Q),registry=read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json");
 const changed=git("diff","--name-only",authority.frozen_successor_subject_sha+"..."+h).split(/\r?\n/).filter(Boolean);
 const ctx=p.prepareApplicabilityContext({root:ROOT,authority,registry,generation:"v13",headSha:h});
 const result=p.planApplicability({root:ROOT,authority,registry,changedPaths:changed,
 stage:"SUCCESSOR_SUBJECT_PRE_MERGE",generation:"v13",baseSha:authority.frozen_successor_subject_sha,headSha:h,preparedContext:ctx});
 assert.equal(result.status,"PASS","GOVERNED_APPLICABILITY_PLAN_NOT_PASS:"+JSON.stringify({
  unknown_changed_paths:result.unknown_changed_paths,
  authority_errors:result.authority_errors,
  resolver_errors:result.resolver_errors,
  blockers:result.blockers,
  generation_context:result.generation_context,
}).slice(0,2400));
 assert.equal(sc.subject_sha,h);
 return new Map(result.decisions.filter(x=>verify.required.includes(x.check_id)).map(x=>[x.check_id,x]));
}
function materialDigest(id,subject){
 const authority=read(Q),planner=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");
 const resolved=planner.resolveDependencyResolvers(ROOT,authority);
 assert.deepEqual(resolved.errors,[]);
 const item=authority.checks.find(x=>x.check_id===id);assert(item);
 const files=[...new Set(item.resolver_ids.flatMap(k=>resolved.resolved[k]?.paths||[]))].map(p=>[p,git("rev-parse",subject+":"+p)]).sort((a,b)=>a[0].localeCompare(b[0]));
 assert(files.length>0);
 return sha(Buffer.from(JSON.stringify(files)));
}
async function proofAtExactRun(check,runId,subject){
 const contract=read(C),wanted=contract.proof_workflow_by_check[check];
 const run=await api("/actions/runs/"+runId);
 assert.equal(run.head_sha,subject,"SOURCE_SHA_NOT_CI_RUN_SHA");
 assert.equal(run.event,"pull_request","NON_PR_RUN_FORBIDDEN");
 assert.equal(run.path,wanted,"DEDICATED_WORKFLOW_PATH_CHANGED");
 assert.equal(run.conclusion,"success","DEDICATED_JOB_NOT_SUCCESS");
 assert((run.pull_requests||[]).some(p=>p.number===3730&&p.base?.sha===BASE),"PR_BASE_NOT_GOVERNED");
 const artifacts=await api("/actions/runs/"+runId+"/artifacts?per_page=100");
 const candidates=(artifacts.artifacts||[]).filter(a=>a.workflow_run?.id===runId&&!a.expired
  &&typeof a.digest==="string"&&/^sha256:[a-f0-9]{64}$/.test(a.digest));
 assert(candidates.length>0,"IMMUTABLE_GITHUB_ARTIFACT_MISSING");
 const selected=candidates.sort((a,b)=>a.id-b.id)[0];
 return {id:runId,workflow_path:run.path,artifact_id:selected.id,artifact_name:selected.name,artifact_sha256:selected.digest.slice(7),url:run.html_url};
}
async function collect(output){
 assert.equal(process.env.CI,"true","EVIDENCE_COLLECTION_CI_ONLY");
 const h=head(),d=decisions(),cfg=read(C);
 const data={schema_version:"geox_mcft_cap09_da9_six_qcp_unsigned_workflow_review_request_v1",
  status:"HOLD_PENDING_INDEPENDENT_OPERATOR_SIGNATURE",subject_sha:h,base_sha:BASE,run_candidates:[],missing:[],
  authorization:false,permit_signed:false,permit_consumed:false};
 const runs=await api("/actions/runs?head_sha="+h+"&event=pull_request&per_page=100");
 for(const id of verify.required){
  const match=(runs.workflow_runs||[]).filter(x=>x.path===cfg.proof_workflow_by_check[id]&&x.head_sha===h&&x.conclusion==="success");
  if(match.length!==1){data.missing.push({check_id:id,reason:"ZERO_OR_AMBIGUOUS_EXACT_HEAD_SUCCEEDED_RUNS",count:match.length});continue;}
  try{
   const ci=await proofAtExactRun(id,match[0].id,h),dep=d.get(id);
   assert(dep,"QCP_DECISION_NOT_PRESENT");
   data.run_candidates.push({check_id:id,subject_sha:h,stage:"SUCCESSOR_SUBJECT_PRE_MERGE",
    dependency_digest:dep.dependency_digest,source_blob_sha256:materialDigest(id,h),
    run_head_sha:h,run_base_sha:BASE,run_conclusion:"success",run_id:ci.id,workflow_path:ci.workflow_path,
    artifact_sha256:ci.artifact_sha256,artifact_id:ci.artifact_id,artifact_name:ci.artifact_name,source_url:ci.url,
    operator_review_status:"UNSIGNED_NOT_AUTHORITY"});
  }catch(error){data.missing.push({check_id:id,reason:String(error.message||error)});}
 }
 assert(path.isAbsolute(output)&&path.resolve(output).startsWith(path.join(ROOT,"acceptance-output")+path.sep),"OUTPUT_MUST_BE_IN_ACCEPTANCE_OUTPUT");
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(data,null,2)+"\n",{flag:"wx",mode:0o600});
 console.log(JSON.stringify({status:data.status,exact_subject_sha:h,candidates:data.run_candidates.length,
  missing:data.missing,output,permit_signed:false}));
}
async function assemble(inputDir,output){
 const sc=verify.scope(),h=head(),d=decisions(),reg=read(E),all=[];
 const ids=new Set(),artifactHashes=new Set();
 for(const id of verify.required){
  const file=path.join(inputDir,id+".signed.json");
  assert(fs.existsSync(file),"SIX_SIGNED_EVIDENCE_FILE_MISSING:"+id);
  const e=JSON.parse(fs.readFileSync(file,"utf8"));
  const payload=e.payload;assert(payload&&payload.check_id===id,"SIX_SIGNED_INPUT_CHECK_CHANGED");
  const decision=d.get(id);assert(decision);
  const r=verify.checkEnvelope(e,decision,"SUCCESSOR_SUBJECT_PRE_MERGE",h);
  assert(!ids.has(payload.run_id),"REUSED_RUN_ACROSS_DISTINCT_CHECKS");
  ids.add(payload.run_id);assert(!artifactHashes.has(payload.artifact_sha256),"REUSED_ARTIFACT_ACROSS_DISTINCT_CHECKS");
  artifactHashes.add(payload.artifact_sha256);
  const live=await proofAtExactRun(id,payload.run_id,payload.subject_sha);
  assert.equal(live.artifact_sha256,payload.artifact_sha256,"GITHUB_ARTIFACT_SHA_MISMATCH");
  all.push(e);reg.checks[id]={status:"SIGNED_REVIEW_VERIFIED",verified_evidence_ref:payload.artifact_sha256};
 }
 assert.equal(all.length,6);reg.entries=all;reg.registration_state="SIX_SIGNED_EXACT_SOURCE_CHECKS_CANDIDATE_FOR_PR_REVIEW";
 assert.equal(reg.subject_source_sha,read(C).evidence_source_anchor_sha);
 assert(path.isAbsolute(output)&&path.resolve(output).startsWith(path.join(ROOT,"acceptance-output")+path.sep),"OUTPUT_MUST_BE_IN_ACCEPTANCE_OUTPUT");
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(reg,null,2)+"\n",{flag:"wx",mode:0o600});
 console.log(JSON.stringify({status:"SIX_SIGNED_EVIDENCE_ASSEMBLED_FOR_REVIEW_NOT_QCP_PASS",exact_checkout:h,
  output,records:all.length,git_changes:false,permit_signed:false,permit_consumed:false}));
}
async function sign(inputFile,checkId,keyFile,issuerId,keyId,output){
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"ONLY_ACCOUNTABLE_LOCAL_OPERATOR_CAN_SIGN");
 assert(verify.required.includes(checkId)&&path.isAbsolute(keyFile),"SIGN_REQUEST_SCOPE_INVALID");
 const req=JSON.parse(fs.readFileSync(inputFile,"utf8"));
 assert(req.status==="HOLD_PENDING_INDEPENDENT_OPERATOR_SIGNATURE"&&!req.missing?.length,"SIX_SOURCE_PROOFS_NOT_COMPLETE");
 const item=(req.run_candidates||[]).find(x=>x.check_id===checkId);
 assert(item&&req.subject_sha===head(),"REVIEW_CANDIDATE_SHA_CHANGED");
 const t=read(TRUST),iss=(t.issuers||[]).find(x=>x.issuer_id===issuerId&&x.key_id===keyId&&!x.revoked);
 assert(iss&&["ACCOUNTABLE_SINGLE_OPERATOR","INDEPENDENT_RETRY_GOVERNANCE"].includes(iss.role),"REVIEWER_NOT_TRUSTED");
 const privateKey=crypto.createPrivateKey(fs.readFileSync(keyFile));
 const registeredPub=crypto.createPublicKey(iss.public_key_pem),actualPub=crypto.createPublicKey(privateKey);
 assert.equal(sha(actualPub.export({type:"spki",format:"der"})),sha(registeredPub.export({type:"spki",format:"der"})),"PRIVATE_KEY_REGISTRATION_MISMATCH");
 const payload={check_id:checkId,subject_sha:item.subject_sha,stage:item.stage,dependency_digest:item.dependency_digest,
  workflow_path:item.workflow_path,run_id:item.run_id,run_head_sha:item.run_head_sha,run_base_sha:item.run_base_sha,
  run_conclusion:item.run_conclusion,artifact_sha256:item.artifact_sha256,source_blob_sha256:item.source_blob_sha256,
  signed_at:new Date().toISOString(),issuer_id:issuerId,key_id:keyId,production_authorized:false,permit_consumed:false};
 const prompt=rl.createInterface({input:process.stdin,output:process.stdout});
 try{
  const answer=await prompt.question("Review independently verified run, artifact and source hashes. Type EXACT_SIGNED_QCP_ONLY to sign: ");
  assert.equal(answer.trim(),"EXACT_SIGNED_QCP_ONLY","OPERATOR_APPROVAL_MISSING");
 }finally{prompt.close()}
 const signature_base64=crypto.sign(null,Buffer.from(DOMAIN+JSON.stringify(payload)),privateKey).toString("base64");
 const out={payload,signature_base64};
 assert(path.isAbsolute(output),"OUTPUT_ABSOLUTE_REQUIRED");
 fs.writeFileSync(output,JSON.stringify(out,null,2)+"\n",{flag:"wx",mode:0o600});
 console.log(JSON.stringify({status:"ONE_QCP_REVIEW_SIGNATURE_CREATED_NOT_PERMIT",check_id:checkId,output}));
}
(async()=>{const [cmd,...arg]=process.argv.slice(2);if(cmd==="--collect"){assert.equal(arg.length,1);return collect(path.resolve(arg[0]));}
 if(cmd==="--assemble"){assert.equal(arg.length,2);return assemble(path.resolve(arg[0]),path.resolve(arg[1]));}
 if(cmd==="--sign-one"){assert.equal(arg.length,6);return sign(...arg.slice(0,5),path.resolve(arg[5]));}
 throw Error("USAGE: --collect OUTPUT | --assemble SIGNED_DIRECTORY OUTPUT | --sign-one REQUEST CHECK_ID PRIVATE_KEY ISSUER_ID KEY_ID OUTPUT");
})().catch(e=>{console.error("DA9_SIX_QCP_EVIDENCE_HOLD:"+String(e.message||e));process.exitCode=1;});
