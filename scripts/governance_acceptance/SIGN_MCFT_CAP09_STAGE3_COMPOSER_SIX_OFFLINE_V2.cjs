#!/usr/bin/env node
"use strict";
// Accountable operator ONLY. Verifies real completed GitHub Actions and six
// artifact ZIP bytes, then signs six exact-source receipts with a LOCAL Ed25519
// key. NEVER uploads or prints private key; no PG / MinIO / Provider / Permit.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const cp=require("node:child_process");
const crypto=require("node:crypto");
const REPO="liyongshang44-max/GEOX";
const CONTRACT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-STAGE3-PYTHON-COMPOSER-SIX-CHECK-SUCCESSOR-V2.json";
const TRUST="scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json";
const WORKFLOW=".github/workflows/mcft-cap09-stage3-composer-six-native-successor-v2.yml";
const DOMAIN="GEOX_MCFT_CAP09_STAGE3_SIX_NATIVE_SUCCESSOR_REVIEW_V2\\n";
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const trim=s=>String(s||"").trim();
const args=process.argv.slice(2);
const value=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
const apiBase="https://api.github.com/repos/"+REPO;
const token=trim(process.env.GITHUB_TOKEN||process.env.GH_TOKEN);
async function api(url,binary=false){
 const target=new URL(url);
 assert(target.protocol==="https:"&&["api.github.com","raw.githubusercontent.com"].includes(target.host),"SOURCE_URL_NOT_GITHUB");
 const h={"Accept":binary?"application/octet-stream":"application/vnd.github+json","User-Agent":"geox-cap09-stage3-six-independent-review",
 "X-GitHub-Api-Version":"2022-11-28"};
 if(token)h.Authorization="Bearer "+token;
 const response=await fetch(url,{headers:h,redirect:"follow",signal:AbortSignal.timeout(30000)});
 assert(response.ok,"GITHUB_EVIDENCE_QUERY_FAILED:"+response.status+":"+target.pathname);
 return binary?Buffer.from(await response.arrayBuffer()):response.json();
}
async function getPinned(head,rel){
 assert(/^[0-9a-f]{40}$/.test(head),"SUBJECT_SHA_INVALID");
 const response=await fetch("https://raw.githubusercontent.com/"+REPO+"/"+head+"/"+rel,
 {headers:{"User-Agent":"geox-cap09-stage3-six-independent-review"},signal:AbortSignal.timeout(30000)});
 assert(response.ok,"PINNED_SOURCE_FETCH_FAILED:"+rel);
 return response.json();
}
function verifiedPrivateKey(privatePem,trust,now){
 const privateKey=crypto.createPrivateKey(privatePem);
 assert.equal(privateKey.asymmetricKeyType,"ed25519","ED25519_SIGNER_REQUIRED");
 const publicKey=crypto.createPublicKey(privateKey);
 const spki=sha(publicKey.export({type:"spki",format:"der"}));
 const matches=(trust.issuers||[]).filter(x=>!x.revoked&&x.spki_sha256===spki&&x.role==="ACCOUNTABLE_SINGLE_OPERATOR"&&
 x.issuer_id==="mcft_cap09_operator_mylr1"&&x.key_id==="mcft_cap09_ed25519_223c806e"&&
 now>=Date.parse(x.not_before)&&now<=Date.parse(x.not_after));
 assert.equal(matches.length,1,"UNAUTHORIZED_OR_EXPIRED_REVIEW_KEY");
 assert.equal(spki,"223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365","SIGNER_IDENTITY_MISMATCH");
 return {privateKey,issuer:matches[0]};
}
function signPayload(payload,privateKey){
 const bytes=Buffer.from(DOMAIN+JSON.stringify(payload));
 return crypto.sign(null,bytes,privateKey).toString("base64");
}
function verifyPayload(payload,signature,publicKey){
 const bytes=Buffer.from(DOMAIN+JSON.stringify(payload));
 return crypto.verify(null,bytes,publicKey,Buffer.from(signature,"base64"));
}
function exactReceipt(item,receipt,run,job){
 assert.equal(receipt.schema_version,"geox_mcft_cap09_stage3_composer_six_native_source_receipt_v2");
 assert.equal(receipt.status,"NATIVE_JOB_STEPS_COMPLETED_PENDING_GITHUB_RUN_COMPLETION_AND_EXTERNAL_SIGNER_REVIEW");
 assert.equal(receipt.qualification_check_id,item.check_id);
 assert.equal(receipt.source_subject_sha,run.head_sha);
 assert.equal(receipt.base_sha,"2162f368899e9a9b5c497d332859e4196f389660");
 assert.equal(receipt.composer_source_blob,"2d1f72d92c05093537774285bda5b7200845344d");
 assert.equal(receipt.old_signed_composer_blob,"7e74b1df502e159dd49ceb21889cbfff86408e50");
 assert.equal(receipt.native_acceptance_script,item.acceptance_entry);
 assert.equal(receipt.original_native_workflow_path,item.historical_workflow_path);
 assert.equal(receipt.github_run_id,run.id);
 assert.equal(receipt.github_run_attempt,run.run_attempt);
 assert.equal(receipt.github_job,job.id?job.name:item.new_successor_ci_job); // Original official job name, not a synthetic alias
 assert(/^sha256:[0-9a-f]{64}$/.test(receipt.dependency_digest),"NEW_DEPENDENCY_DIGEST_MISSING");
 assert(/^[0-9a-f]{64}$/.test(receipt.source_blob_sha256),"NEW_SOURCE_BLOB_DIGEST_MISSING");
 assert(Array.isArray(receipt.artifacts)&&receipt.artifacts.length>0,"ACTUAL_NATIVE_RESULT_ARTIFACTS_MISSING");
 assert.equal(receipt.prior_six_signed_evidence_reused,false);
 for(const k of ["verified_run_final_conclusion","external_reviewer_signature_present","old_frozen_v13_qualified","phase3_signed_successor_qualified","new_isolated_fenced_pg_qualified","permit_authorized","production_authorized"])assert.equal(receipt[k],false,"UNAUTHORIZED_RECEIPT_CLAIM:"+k);
}
function unpackOne(zip,expected){
 const d=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-six-offline-review-"));
 try{
  const z=path.join(d,"artifact.zip");
  fs.writeFileSync(z,zip,{flag:"wx",mode:0o600});
  const listing=cp.execFileSync("tar",["-tf",z],{encoding:"utf8",timeout:15000}).trim().split(/\\r?\\n/);
  assert.deepEqual(listing,[expected],"GITHUB_ARTIFACT_ZIP_NOT_EXACT_SINGLE_FILE");
  cp.execFileSync("tar",["-xf",z,"-C",d],{timeout:15000});
  const f=path.join(d,expected),st=fs.lstatSync(f);
  assert(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<10*1024*1024,"RECEIPT_BYTES_INVALID");
  const bytes=fs.readFileSync(f);
  return {receipt:JSON.parse(bytes.toString("utf8")),receipt_sha256:sha(bytes)};
 }finally{fs.rmSync(d,{recursive:true,force:true});}
}
async function main(){
 if(args.includes("--selftest")){
  const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519");
  const p={test_only:true,subject:"0".repeat(40),qualified:false,permit:false};
  const sig=signPayload(p,privateKey);
  assert(verifyPayload(p,sig,publicKey));
  assert(!verifyPayload({...p,qualified:true},sig,publicKey));
  console.log(JSON.stringify({status:"PASS_CRYPTO_SELFTEST_ONLY_NO_TRUST_NO_SIGNATURES",permit:false}));
  return;
 }
 const runId=Number(value("--run-id")),keyFile=value("--key-file"),outFile=value("--out");
 assert(Number.isSafeInteger(runId)&&runId>0&&keyFile&&outFile,"USAGE: node SIGN...cjs --run-id N --key-file ABS_PEM --out ABS_JSON");
 assert(path.isAbsolute(keyFile)&&path.isAbsolute(outFile),"EXPLICIT_ABSOLUTE_PATHS_REQUIRED");
 assert(!fs.existsSync(outFile),"SIGNED_EVIDENCE_OVERWRITE_FORBIDDEN");
 for(const k of ["MCFT_GOVERNED_RETRY_TICKET","MCFT_GOVERNED_RETRY_STAGE","MCFT_CAP09_ADOPTION_REQUEST","DATABASE_URL","PGPASSWORD","AWS_SECRET_ACCESS_KEY"])
  assert(!process.env[k],"INHERITED_EXECUTION_AUTHORITY_FORBIDDEN:"+k);
 const run=await api(apiBase+"/actions/runs/"+runId);
 assert.equal(run.name,"mcft-cap09-stage3-composer-six-native-successor-v2","NEW_SIX_WORKFLOW_MISMATCH");
 assert.equal(run.path,WORKFLOW,"NEW_SIX_WORKFLOW_PATH_MISMATCH");
 assert.equal(run.event,"pull_request","NOT_PR_REAL_RUN");
 assert.equal(run.status,"completed","RUN_NOT_COMPLETE");
 assert.equal(run.conclusion,"success","SIX_REAL_JOBS_NOT_ALL_SUCCESS");
 assert(/^[0-9a-f]{40}$/.test(run.head_sha),"RUN_HEAD_INVALID");
 assert(run.pull_requests?.some(p=>p.base?.sha==="2162f368899e9a9b5c497d332859e4196f389660"),"RUN_PR_BASE_NOT_PINNED_MAIN");
 const [c,trust,jobData,artData]=await Promise.all([
  getPinned(run.head_sha,CONTRACT),getPinned(run.head_sha,TRUST),
  api(apiBase+"/actions/runs/"+runId+"/jobs?per_page=100&filter=latest"),
  api(apiBase+"/actions/runs/"+runId+"/artifacts?per_page=100")
 ]);
 assert.equal(c.contract_id,"MCFT_CAP09_STAGE3_PYTHON_COMPOSER_SIX_CHECK_SUCCESSOR_V2");
 assert.equal(c.signed_entries.length,0,"INHERITED_SIX_SIGNATURES_REJECTED");
 assert.equal(c.qualified_six_checks,false);
 const now=Date.now();
 const keyPem=fs.readFileSync(keyFile,"utf8");
 const {privateKey,issuer}=verifiedPrivateKey(keyPem,trust,now);
 const entries=[];
 for(const item of c.checks){
  const name=item.new_successor_ci_job;
  const selected=jobData.jobs.filter(j=>j.name===name&&j.run_attempt===run.run_attempt);
  assert.equal(selected.length,1,"SIX_JOB_MISSING_OR_DUPLICATE:"+name);
  const job=selected[0];
  assert.equal(job.status,"completed","SIX_JOB_PENDING:"+name);
  assert.equal(job.conclusion,"success","SIX_JOB_FAILED:"+name);
  assert.equal(job.head_sha,run.head_sha,"SIX_JOB_HEAD_MISMATCH:"+name);
  const artifactName="cap09-stage3-six-"+item.check_id+"-"+run.head_sha;
  const matches=artData.artifacts.filter(a=>a.name===artifactName&&!a.expired);
  assert.equal(matches.length,1,"SIX_ARTIFACT_NOT_UNIQUE:"+artifactName);
  const a=matches[0];
  assert(/^sha256:[0-9a-f]{64}$/.test(a.digest),"SIX_ZIP_DIGEST_MISSING");
  const zip=await api(apiBase+"/actions/artifacts/"+a.id+"/zip",true);
  assert.equal("sha256:"+sha(zip),a.digest,"GITHUB_ARTIFACT_ZIP_BYTES_CHANGED:"+item.check_id);
  const filename="MCFT_CAP09_STAGE3_SIX_NATIVE_"+item.check_id+"_RECEIPT_V2.json";
  const unpack=unpackOne(zip,filename);
  exactReceipt(item,unpack.receipt,run,job);
  const payload={
   schema_version:"geox_mcft_cap09_stage3_six_native_signed_review_payload_v2",
   qualification_check_id:item.check_id,
   subject_sha:run.head_sha,base_sha:"2162f368899e9a9b5c497d332859e4196f389660",
   run_id:run.id,run_attempt:run.run_attempt,run_conclusion:run.conclusion,
   new_workflow_path:WORKFLOW,job_name:job.name,
   native_workflow_path:item.historical_workflow_path,native_workflow_blob:unpack.receipt.original_native_workflow_blob,
   dependency_digest:unpack.receipt.dependency_digest,
   source_blob_sha256:unpack.receipt.source_blob_sha256,
   evidence_artifact_id:a.id,evidence_artifact_zip_sha256:a.digest,
   evidence_receipt_sha256:"sha256:"+unpack.receipt_sha256,
   signed_at:new Date().toISOString(),issuer_id:issuer.issuer_id,key_id:issuer.key_id,
   original_frozen_v13_requalification_claim:false,
   original_six_legacy_signatures_reused:false,
   production_authorized:false,permit_consumed:false,new_isolated_fenced_pg_authorized:false
  };
  entries.push({payload,signature_base64:signPayload(payload,privateKey)});
 }
 assert.equal(entries.length,6);
 const bundle={schema_version:"geox_mcft_cap09_stage3_six_native_operator_signed_bundle_v2",
  status:"SIX_INDEPENDENT_NEW_SUBJECT_OPERATOR_REVIEWS_SIGNED_NO_EXECUTION_AUTHORITY",
  subject_sha:run.head_sha,run_id:run.id,workflow_path:WORKFLOW,
  contract_path:CONTRACT,reviewer_id:issuer.issuer_id,
  all_six_signed:true,original_frozen_v13_qualified:false,
  qcp_enrollment_authorized:false,permit_authorized:false,production_authorized:false,
  entries};
 fs.mkdirSync(path.dirname(outFile),{recursive:true});
 fs.writeFileSync(outFile,JSON.stringify(bundle,null,2)+"\\n",{flag:"wx",mode:0o600});
 console.log(JSON.stringify({status:bundle.status,run_id:run.id,subject_sha:run.head_sha,checks:entries.length,
  output:outFile,sha256:"sha256:"+sha(fs.readFileSync(outFile)),permit:false}));
}
main().catch(e=>{console.error("HOLD_OPERATOR_SIGNING:"+String(e.message||e));process.exitCode=1;});
