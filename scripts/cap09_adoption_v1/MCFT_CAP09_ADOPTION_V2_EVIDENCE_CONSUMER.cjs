"use strict";
/**
 * CAP09 Adoption V2: genuine current-exact-head QCP65 evidence consumption.
 * Consumes all 65 actual QCP decisions, maps only original Formal54, checks
 * signed source/material/host/issuer and NEVER authorizes Permit or stage launch.
 * No mutable state, no fallback to synthetic check PASS or legacy QCP55.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto"),cp=require("node:child_process"),zlib=require("node:zlib");
const c=require("../cap09_adoption_v1/contract.cjs");
const off=require("../cap09_adoption_v1/offline-context.cjs");
const material=require("../cap09_adoption_v1/installed-material.cjs");
const a3=require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs");
const merged=require("./MCFT_CAP09_ADOPTION_V2_POSTMERGE_SOURCE_V1.cjs");
const DOMAIN="GEOX_MCFT_CAP09_ADOPTION_QUALIFICATION_V2\n";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const verified=new WeakSet();

const HISTORICAL_NA=new Set([
 "CAP09_3740_3744_OWNER_DIRECTED_SOURCE_REVIEW_TECHNICAL_V1",
 "FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",
 "DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1",
 "STAGE3_20261026_DUAL_HEARTBEAT_ENGINEERING_ONLY"]);
function assertHistoricalNA(r,machine,subject){
 assert.equal(r.status,"NOT_APPLICABLE","A3_V2_HISTORIC_NA_REQUIRED");
 assert.equal(r.applicability,"REQUALIFY");
 assert.equal(r.reason_code,"HISTORICAL_SOURCE_ENROLLMENT_UNCHANGED_NOT_THIS_20_PATH_DELTA","A3_V2_NA_REASON");
 assert.equal(r.execution,"EXACT_3747_CURRENT_DELTA_PRESERVATION_NOT_HISTORICAL_REPLAY","A3_V2_NA_EXECUTION");
 assert.equal(machine.base_sha,a3.BASELINE);assert.equal(machine.stage,"SUCCESSOR_SUBJECT_PRE_MERGE");
 const e=r.inherited_scope_evidence;
 assert(e&&e.status==="PASS"&&e.scope==="PR_3747_SOURCE_PRESERVATION_ONLY","A3_V2_HISTORICAL_NA_UNPROVEN");
 assert.equal(e.check_id,r.check_id);assert.equal(e.base_sha,a3.BASELINE);
 assert.equal(e.head_sha,subject);assert.equal(e.exact_current_delta_paths,20);
 for(const k of ["frozen_qcp64_semantics_preserved","composer_current_blob_unchanged",
 "historical_composite_exact_path_verifier_unchanged","historical_da9_semantic_verifier_unchanged",
 "historical_frozen_v13_failure_preserved"])assert.equal(e[k],true,"A3_V2_NA_PROOF:"+k);
 for(const k of ["old_technical_check_requalified","old_signature_transferred",
 "new_composer_signature_claimed","adoption_authorized","permit_authorized",
 "production_authorized"])assert.equal(e[k],false,"A3_V2_NA_AUTHORITY:"+k);
 assert.equal(e.original_six_stage_count,0,"A3_V2_NA_STAGE_CLAIM");
 return true;
}

function safeFile(root,rel){
 assert(typeof rel==="string"&&!path.isAbsolute(rel)&&!rel.includes("\\")&&rel.split("/").every(x=>x&&x!=="."&&x!==".."&&/^[A-Za-z0-9_.-]+$/.test(x)),"A3_V2_EVIDENCE_PATH");
 const full=path.join(root,...rel.split("/"));c.noLinks(full);const s=fs.statSync(full);assert(s.isFile()&&s.size>0&&s.size<16*1024*1024,"A3_V2_EVIDENCE_FILE_INVALID");return full;
}
function readBound(root,rel,expected){
 c.hash(expected);const f=safeFile(root,rel);const bytes=fs.readFileSync(f);
 assert.equal(c.sha(bytes),expected,"A3_V2_EVIDENCE_BYTES_CHANGED:"+rel);
 return c.read(f);
}
function checkQcp65(machine,qcp,policy,subject){
 assert(machine?.status==="PASS"&&machine.head_sha===subject,"A3_V2_MACHINE_RESULT_NOT_EXACT_PASS");
 const cnt=machine.counts||{};
 for(const k of ["fail","unknown","forbidden","authority_errors","unknown_changed_paths","blocker_count"])assert.equal(cnt[k],0,"A3_V2_QCP_BLOCKER:"+k);
 assert.equal(cnt.total_checks,65,"A3_V2_QCP65_REQUIRED");
 assert.equal(cnt.pass+cnt.not_applicable,65,"A3_V2_QCP_RESULTS_NOT_COMPLETE");
 assert.deepEqual(machine.blockers,[],"A3_V2_QCP_BLOCKERS_PRESENT");
 const results=machine.results;assert(Array.isArray(results)&&results.length===65,"A3_V2_QCP_RESULTS_LENGTH");
 const defs=new Map(qcp.checks.map(x=>[x.check_id,x]));
 const ids=new Set(),formal=new Set(policy.checks.map(x=>x.check_id)),allowedNA=new Set(policy.allowed_not_applicable_ids);
 let formalCount=0,technicalCount=0;
 for(const r of results){
  assert(r&&typeof r==="object"&&typeof r.check_id==="string"&&defs.has(r.check_id)&&!ids.has(r.check_id),"A3_V2_UNKNOWN_DUPLICATE_CHECK");
  ids.add(r.check_id);
  assert(r.status==="PASS"||r.status==="NOT_APPLICABLE","A3_V2_UNQUALIFIED_CHECK:"+r.check_id);
  if(formal.has(r.check_id)){
   formalCount++;
   const declared=policy.checks.find(x=>x.check_id===r.check_id);
   if(r.status==="NOT_APPLICABLE"){
    assert(declared.allow_not_applicable===true&&allowedNA.has(r.check_id),"A3_V2_UNAPPROVED_FORMAL_NA");
    assert.equal(r.reason_code,"STAGE_NOT_APPLICABLE","A3_V2_NA_REASON_CHANGED");
   }
  }else{
   technicalCount++;
   if(HISTORICAL_NA.has(r.check_id))assertHistoricalNA(r,machine,subject);
   else assert.equal(r.status,"PASS","A3_V2_TECHNICAL_REQUIRED_NOT_PASS:"+r.check_id);
  }
 }
 assert.equal(ids.size,65);assert.equal(formalCount,54);assert.equal(technicalCount,11);
 const observedNA=results.filter(x=>x.status==="NOT_APPLICABLE").map(x=>x.check_id).sort();
 assert.deepEqual(observedNA,[...allowedNA,...HISTORICAL_NA].sort(),"A3_V2_NOT_APPLICABLE_SET_CHANGED");
 return {formalCount,technicalCount,notApplicable:observedNA,qcp_results_digest:c.digest(results)};
}

const REPO="liyongshang44-max/GEOX",PR=3747,RAW="MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json";
function zipRaw(zip){
 assert(Buffer.isBuffer(zip)&&zip.length>=22&&zip.length<16777216,"A3_V2_ZIP_INVALID");
 let end=-1;
 for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--)if(zip.readUInt32LE(i)===0x06054b50&&i+22+zip.readUInt16LE(i+20)===zip.length){end=i;break;}
 assert(end>=0&&zip.readUInt16LE(end+4)===0&&zip.readUInt16LE(end+6)===0,"A3_V2_ZIP_END_INVALID");
 const n=zip.readUInt16LE(end+10),total=zip.readUInt32LE(end+12),offset=zip.readUInt32LE(end+16);
 assert(n>0&&n<=64&&total>0&&offset+total<=end,"A3_V2_ZIP_DIRECTORY");
 let pos=offset,out=null;
 for(let i=0;i<n;i++){
  assert(pos+46<=end&&zip.readUInt32LE(pos)===0x02014b50,"A3_V2_ZIP_CENTRAL_INVALID");
  const flags=zip.readUInt16LE(pos+8),method=zip.readUInt16LE(pos+10),packed=zip.readUInt32LE(pos+20);
  const length=zip.readUInt32LE(pos+24),nl=zip.readUInt16LE(pos+28),extra=zip.readUInt16LE(pos+30),comment=zip.readUInt16LE(pos+32);
  const local=zip.readUInt32LE(pos+42),next=pos+46+nl+extra+comment;
  assert(next<=end&&packed<8388608&&length<8388608&&!(flags&1),"A3_V2_ZIP_ENTRY_BOUNDS");
  const name=zip.toString("utf8",pos+46,pos+46+nl);
  assert(name&&!name.includes("\\")&&!name.startsWith("/")&&!name.split("/").includes(".."),"A3_V2_ZIP_NAME");
  if(name===RAW||name==="acceptance-output/"+RAW){
   assert(out===null&&local+30<=offset&&zip.readUInt32LE(local)===0x04034b50,"A3_V2_ZIP_DUP_OR_LOCAL");
   const ln=zip.readUInt16LE(local+26),le=zip.readUInt16LE(local+28),start=local+30+ln+le;
   assert(zip.toString("utf8",local+30,local+30+ln)===name&&start+packed<=offset,"A3_V2_ZIP_LOCAL_NAME");
   const bytes=zip.subarray(start,start+packed);
   assert(method===0||method===8,"A3_V2_ZIP_METHOD");
   out=method===0?Buffer.from(bytes):zlib.inflateRawSync(bytes,{maxOutputLength:8388608});
   assert.equal(out.length,length,"A3_V2_ZIP_UNCOMPRESSED_SIZE");
  }
  pos=next;
 }
 assert.equal(pos,offset+total,"A3_V2_ZIP_CENTRAL_END");
 assert(out!==null,"A3_V2_ZIP_RAW_NOT_FOUND");
 return out;
}
function githubGet(uri){
 assert(/^\/(?:pulls\/3747|actions\/runs\/[0-9]+(?:\/artifacts\?per_page=100|\/attempts\/[0-9]+\/jobs\?per_page=100)?|git\/commits\/[0-9a-f]{40}|git\/ref\/heads\/main|issues\/comments\/[1-9][0-9]*)$/.test(uri),"A3_V2_GITHUB_URL_SCOPE");
 const curl=process.platform==="win32"?"curl.exe":"curl";
 const data=cp.execFileSync(curl,["--fail","--silent","--show-error","--location","--max-time","20",
  "-H","Accept: application/vnd.github+json","-H","X-GitHub-Api-Version: 2022-11-28",
  "https://api.github.com/repos/"+REPO+uri],{encoding:"utf8",timeout:25000,maxBuffer:2097152,windowsHide:true});
 return JSON.parse(data);
}
function checkNative(p,run,artifactList,jobList,pr,mergedProofValidated=false){
 const source=mergedProofValidated?merged.SOURCE:p.subject_sha;
 assert.equal(pr.number,PR);assert.equal(pr.head?.sha,source);
 assert.equal(pr.base?.sha,a3.BASELINE);assert.equal(pr.head?.repo?.full_name,REPO);
 assert.equal(run.id,p.qcp_run_id);assert.equal(run.head_sha,source);
 assert.equal(run.name,"mcft-cap-09-qualification-control-plane-v1");
 assert.equal(run.path,".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml");
 assert.equal(run.event,"pull_request");assert.equal(run.status,"completed");
 assert.equal(run.conclusion,"success","A3_V2_GITHUB_QCP_NOT_SUCCESS");
 assert.equal(run.run_attempt,p.qcp_run_attempt,"A3_V2_GITHUB_RUN_ATTEMPT_CHANGED");
 assert(Array.isArray(run.pull_requests),"A3_V2_GITHUB_PR_ASSOCIATIONS_INVALID");
 if(run.pull_requests.length===0)
  assert(mergedProofValidated&&pr.merged===true&&pr.merge_commit_sha===merged.MERGE,
   "A3_V2_GITHUB_PR_ASSOCIATION_MISSING_WITHOUT_MERGE_PROOF");
 else assert(run.pull_requests.some(x=>x.number===PR&&x.head?.sha===source&&x.base?.sha===a3.BASELINE),
  "A3_V2_GITHUB_PR_UNBOUND");
 const job=jobList.jobs?.find(x=>x.id===p.qcp_job_id);
 assert(job&&job.name==="applicability-and-blocker-inventory"&&job.conclusion==="success","A3_V2_GITHUB_JOB_UNQUALIFIED");
 const art=artifactList.artifacts?.find(x=>x.id===p.qcp_artifact_id);
 assert(art&&!art.expired&&art.name==="mcft-cap09-qualification-control-plane-"+source,"A3_V2_GITHUB_ARTIFACT_IDENTITY");
 assert.equal(art.digest,"sha256:"+p.qcp_artifact_sha256,"A3_V2_GITHUB_ARTIFACT_DIGEST");
 assert.equal(art.workflow_run?.id,run.id);assert.equal(art.workflow_run?.head_sha,source);
 const ms=x=>{const v=Date.parse(x);assert(Number.isFinite(v),"A3_V2_GITHUB_TIME_INVALID");return v;};
 assert(ms(job.started_at)<=ms(art.created_at)&&ms(art.created_at)<=ms(job.completed_at),"A3_V2_GITHUB_ARTIFACT_WRONG_ATTEMPT");
 return {status:"GITHUB_NATIVE_RUN_AND_ARTIFACT_VERIFIED",run_id:run.id,artifact_id:art.id,job_id:job.id};
}
function verifyNativeArtifact(p,evidenceRoot,derivation){
 for(const k of ["qcp_run_id","qcp_run_attempt","qcp_job_id","qcp_artifact_id"])
  assert(Number.isSafeInteger(p[k])&&p[k]>0,"A3_V2_NATIVE_ID_REQUIRED:"+k);
 assert.equal(p.qcp_event,"pull_request","A3_V2_EVENT_CHANGED");c.hash(p.qcp_artifact_sha256);
 const zip=fs.readFileSync(safeFile(evidenceRoot,p.qcp_artifact_ref));
 assert.equal(c.sha(zip),p.qcp_artifact_sha256,"A3_V2_ZIP_HASH_CHANGED");
 const raw=fs.readFileSync(safeFile(evidenceRoot,p.qcp_source_ref));
 assert.equal(path.posix.basename(p.qcp_source_ref),RAW,"A3_V2_RAW_FILENAME_CHANGED");
 assert(zipRaw(zip).equals(raw),"A3_V2_RAW_NOT_IN_GITHUB_ARTIFACT");
 const run=githubGet("/actions/runs/"+p.qcp_run_id);
 const arts=githubGet("/actions/runs/"+p.qcp_run_id+"/artifacts?per_page=100");
 const jobs=githubGet("/actions/runs/"+p.qcp_run_id+"/attempts/"+p.qcp_run_attempt+"/jobs?per_page=100");
 const pr=githubGet("/pulls/3747");
 const owner=githubGet("/issues/comments/"+merged.OWNER_SOURCE_COMMENT);
 const checked=merged.verify(derivation,p,{pr,
  sourceCommit:githubGet("/git/commits/"+merged.SOURCE),
  mergeCommit:githubGet("/git/commits/"+merged.MERGE),
  main:githubGet("/git/ref/heads/main"),sourceOwner:owner});
 const native=checkNative(p,run,arts,jobs,pr,true);
 return Object.freeze({native,checked,sourceOwner:owner});
}

const PAYLOAD=["schema","qualification_id","run_id","parent_run_id","attempt_ordinal","baseline_main_sha","subject_sha",
 "host_id","operator_id","scope","production_authorized","issued_at","expires_at","issuer_id","key_id",
 "policy_digest","material_digest","frozen_paths","first_parent_proven",
 "qcp_source_ref","qcp_source_sha256","qcp_artifact_ref","qcp_artifact_sha256","qcp_artifact_id","qcp_run_id","qcp_run_attempt","qcp_job_id","qcp_event",
 "qcp_results_digest","qcp_source_subject_sha","qcp_merge_derivation_ref","qcp_merge_derivation_sha256",
 "adoption_owner_approval_comment_id","release_binding_ref","release_binding_sha256"];
function verify(request,releaseRoot,opts={}){
 const now=opts.now??Date.now(),host=opts.host??os.hostname(),env=opts.environment??process.env;
 c.exact(request,["schema_version","qualification","material","evidence_root",...(Object.hasOwn(request,"operator_scope_grant")?["operator_scope_grant"]:[])]);
 assert.equal(request.schema_version,"MCFT_CAP09_SIGNED_ADOPTION_V2_REQUEST_V1");
 const envelope=request.qualification;c.exact(envelope,["payload","signature_base64"]);
 const p=envelope.payload;c.exact(p,PAYLOAD);
 assert.equal(p.schema,"MCFT_CAP09_ADOPTION_QUALIFICATION_V2");
 assert.equal(p.run_id,a3.RUN);assert.equal(p.parent_run_id,a3.PARENT);assert.equal(p.attempt_ordinal,3);
 assert.equal(p.baseline_main_sha,a3.BASELINE);
 assert(/^[a-f0-9]{40}$/.test(p.subject_sha)&&p.subject_sha!==a3.BASELINE,"A3_V2_SUBJECT_NOT_NEW");
 assert.equal(p.host_id,host);assert.equal(p.scope,"TEST_ONLY");assert.equal(p.production_authorized,false);
 assert.equal(p.frozen_paths,108);assert.equal(p.first_parent_proven,true);
 const policy=c.read(off.POLICY);assert.equal(policy.host_id,p.host_id);assert.equal(policy.operator_id,p.operator_id);
 assert.equal(p.policy_digest,c.digest(policy),"A3_V2_POLICY_DIGEST_CHANGED");
 assert(c.epoch(policy.valid_until)>now,"A3_V2_POLICY_EXPIRED");
 c.window(p,now,86400000);assert(c.epoch(p.expires_at)<=c.epoch(policy.valid_until),"A3_V2_POLICY_WINDOW");
 assert.equal(p.material_digest,c.digest(request.material),"A3_V2_MATERIAL_BINDING_CHANGED");
 const checked=material.verify(request.material,releaseRoot,env);
 const qcp=c.read(path.join(releaseRoot,...QCP.split("/")));
 const map=a3.mapAdoptionV2(qcp,policy);assert.equal(map.total_checks,65);
 const machine=readBound(request.evidence_root,p.qcp_source_ref,p.qcp_source_sha256);
 const q=checkQcp65(machine,qcp,policy,p.qcp_source_subject_sha);
 assert.equal(p.qcp_results_digest,q.qcp_results_digest,"A3_V2_RESULT_DIGEST_CHANGED");
 const derivation=readBound(request.evidence_root,p.qcp_merge_derivation_ref,p.qcp_merge_derivation_sha256);
 const provenance=verifyNativeArtifact(p,request.evidence_root,derivation);
 const ownerApproval=githubGet("/issues/comments/"+p.adoption_owner_approval_comment_id);
 merged.verifyOwnerApproval(p,ownerApproval,provenance.sourceOwner);
 const release=readBound(request.evidence_root,p.release_binding_ref,p.release_binding_sha256);
 assert.equal(release.schema_version,"MCFT_CAP09_RELEASE_MATERIAL_BINDING_V1");
 assert.equal(release.subject_commit_sha,p.subject_sha,"A3_V2_RELEASE_HEAD_CHANGED");
 off.verifyReleaseSourceBinding(release,request.material);
 const issuers=policy.issuers.filter(i=>i.issuer_id===p.issuer_id&&i.key_id===p.key_id&&i.purpose==="ADOPTION");
 assert.equal(issuers.length,1,"A3_V2_ADOPTION_ISSUER_UNKNOWN");
 off.assertFormalIssuer(issuers[0],policy,p,request.operator_scope_grant??null,now);
 const key=crypto.createPublicKey(issuers[0].public_key_pem);
 assert.equal(key.asymmetricKeyType,"ed25519");assert.equal(c.sha(key.export({type:"spki",format:"der"})),issuers[0].spki_sha256);
 assert.equal(issuers[0].revoked,false);assert(c.epoch(issuers[0].not_before)<=c.epoch(p.issued_at)&&c.epoch(p.expires_at)<=c.epoch(issuers[0].not_after));
 const sig=Buffer.from(envelope.signature_base64,"base64");
 assert(sig.length===64&&sig.toString("base64")===envelope.signature_base64,"A3_V2_ADOPTION_SIGNATURE_BYTES");
 assert(crypto.verify(null,Buffer.from(DOMAIN+c.canonical(p)),key,sig),"A3_V2_ADOPTION_SIGNATURE_INVALID");
 const result=Object.freeze({status:"SIGNED_QCP65_ADOPTION_V2_EVIDENCE_VERIFIED_NOT_PERMIT",
  schema:"MCFT_CAP09_ADOPTION_V2_CONTEXT",run_id:p.run_id,parent_run_id:p.parent_run_id,attempt_ordinal:3,
  subject_sha:p.subject_sha,host_id:p.host_id,scope:"TEST_ONLY",
  adoption_digest:c.digest(envelope),material_digest:checked.digest,
  qualification_expires_at:p.expires_at,release_inventory_sha256:release.content_inventory_sha256,
  source:"SIGNED_ADOPTION_NOT_LIVE_REMOTE_MAIN",
  execute_authorized:false,permit_authorized:false,permit_consumed:false,production_authorized:false});
 verified.add(result);return result;
}
function isVerified(context){return verified.has(context);}
function load(file,releaseRoot){return verify(c.read(file),releaseRoot);}
module.exports={DOMAIN,PAYLOAD,verify,load,isVerified,checkQcp65,HISTORICAL_NA,checkNative,zipRaw};
