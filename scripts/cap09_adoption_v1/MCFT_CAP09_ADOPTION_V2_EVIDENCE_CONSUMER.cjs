"use strict";
/**
 * CAP09 Adoption V2: genuine current-exact-head QCP65 evidence consumption.
 * Consumes all 65 actual QCP decisions, maps only original Formal54, checks
 * signed source/material/host/issuer and NEVER authorizes Permit or stage launch.
 * No mutable state, no fallback to synthetic check PASS or legacy QCP55.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const c=require("../cap09_adoption_v1/contract.cjs");
const off=require("../cap09_adoption_v1/offline-context.cjs");
const material=require("../cap09_adoption_v1/installed-material.cjs");
const a3=require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs");
const DOMAIN="GEOX_MCFT_CAP09_ADOPTION_QUALIFICATION_V2\n";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const verified=new WeakSet();
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
   assert.equal(r.status,"PASS","A3_V2_TECHNICAL_REQUIRED_NOT_PASS:"+r.check_id);
  }
 }
 assert.equal(ids.size,65);assert.equal(formalCount,54);assert.equal(technicalCount,11);
 const observedNA=results.filter(x=>x.status==="NOT_APPLICABLE").map(x=>x.check_id).sort();
 assert.deepEqual(observedNA,[...allowedNA].sort(),"A3_V2_NOT_APPLICABLE_SET_CHANGED");
 return {formalCount,technicalCount,notApplicable:observedNA,qcp_results_digest:c.digest(results)};
}
const PAYLOAD=["schema","qualification_id","run_id","parent_run_id","attempt_ordinal","baseline_main_sha","subject_sha",
 "host_id","operator_id","scope","production_authorized","issued_at","expires_at","issuer_id","key_id",
 "policy_digest","material_digest","frozen_paths","first_parent_proven",
 "qcp_source_ref","qcp_source_sha256","qcp_artifact_sha256","qcp_run_id","qcp_event",
 "qcp_results_digest","release_binding_ref","release_binding_sha256"];
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
 const q=checkQcp65(machine,qcp,policy,p.subject_sha);
 assert.equal(p.qcp_results_digest,q.qcp_results_digest,"A3_V2_RESULT_DIGEST_CHANGED");
 assert(Number.isSafeInteger(p.qcp_run_id)&&p.qcp_run_id>0,"A3_V2_QCP_RUN_REQUIRED");
 assert.equal(p.qcp_event,"pull_request","A3_V2_QCP_EVENT_REQUIRED");
 c.hash(p.qcp_artifact_sha256);
 assert.equal(machine.qcp_artifact_sha256,p.qcp_artifact_sha256,"A3_V2_ARTIFACT_PROVENANCE_MISMATCH");
 assert.equal(machine.qcp_run_id,p.qcp_run_id,"A3_V2_QCP_RUN_MISMATCH");
 assert.equal(machine.qcp_event,p.qcp_event,"A3_V2_QCP_EVENT_MISMATCH");
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
module.exports={DOMAIN,PAYLOAD,verify,load,isVerified,checkQcp65};
