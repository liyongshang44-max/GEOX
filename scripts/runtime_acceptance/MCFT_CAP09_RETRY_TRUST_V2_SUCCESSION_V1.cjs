"use strict";
/* R4285 Trust V2 independent successor gate. No permission from comments alone.
 * This gate can ACCEPT only with an actual Owner-authored, unedited exact-scope
 * governance approval AND Owner-attributed protected-main native merge AND
 * same-source Trust bytes, ruleset, and key registration. READ ONLY.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const crypto=require("node:crypto"),cp=require("node:child_process");
const SHA=/^[a-f0-9]{64}$/,HEAD=/^[a-f0-9]{40}$/;
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const utc=s=>typeof s==="string"&&Number.isFinite(Date.parse(s))&&new Date(Date.parse(s)).toISOString()===s;
const OLD_SHA="dce2a16f6a82779873dfe25b30194f0445f23b894f5eb41c41a7274b1eb19cf7";
const RUN="4285c3ce342c",HOST="LAPTOP-STN2A2P1",OP="mcft_cap09_operator_mylr1";
const REPO="liyongshang44-max/GEOX",PR=3772,BASE="9ed82b7c92c7e0ecaaa53a452568e7def7f8a8e6";
const REGISTRATION_DECISION="APPROVE_R4285_TRUST_V2_EXACT_REGISTRATION_NOT_PERMIT";
const TRUST_V2_PATH="scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2.json";
function json(bytes){assert(Buffer.isBuffer(bytes));return JSON.parse(bytes.toString("utf8"))}
function candidate(v1Raw,v2Raw,{now=Date.now(),allowFuture=false}={}){
 assert(Buffer.isBuffer(v1Raw)&&Buffer.isBuffer(v2Raw),"TRUST_V2_RAW_BYTES_REQUIRED");
 assert.equal(sha(v1Raw),OLD_SHA,"TRUST_V2_HISTORIC_V1_DRIFT");
 const old=json(v1Raw),next=json(v2Raw);
 assert.equal(old.schema_version,"geox_mcft_cap09_retry_trust_v1");
 assert.equal(next.schema_version,old.schema_version,"TRUST_V2_LEGACY_WIRE_SCHEMA_DRIFT");
 for(const k of ["host_id","operator_id","ledger_root","adopted","execution_enabled",
  "real_delay_controller_adopted","stage_capability_adopted",
  "real_provider_transport_delay_adopted","real_pipeline_delay_adopted"]){
  assert.deepEqual(next[k],old[k],"TRUST_V2_FROZEN_FIELD_DRIFT:"+k);
 }
 assert.equal(next.host_id,HOST);assert.equal(next.operator_id,OP);
 assert.equal(next.adopted,false);assert.equal(next.execution_enabled,false);
 assert(Array.isArray(old.issuers)&&old.issuers.length===2&&Array.isArray(next.issuers),
  "TRUST_V2_ISSUER_SHAPE");
 assert([2,3].includes(next.issuers.length),"TRUST_V2_EXACTLY_ONE_SUCCESSOR");
 for(let i=0;i<2;i++)assert.deepEqual(next.issuers[i],old.issuers[i],"TRUST_V2_OLD_ISSUER_CHANGED");
 const s=next.succession;
 assert(s&&s.schema_version==="MCFT_CAP09_TRUST_V2_REGISTRATION_CANDIDATE_V1");
 assert.equal(s.prior_trust_raw_sha256,OLD_SHA);
 assert.equal(s.registration_scope,"CAP09_ISOLATED_TEST_ONLY");
 assert.equal(s.resource_run_id,RUN);assert.equal(s.attempt_ordinal,4);
 assert.equal(s.production_authorized,false);assert.equal(s.permit_authorized,false);
 assert.equal(s.trust_successor_activated,false,"TRUST_V2_SELF_ACTIVATION_FORBIDDEN");
 assert.equal(s.owner_registration_approval,null,"TRUST_V2_SELF_APPROVAL_FORBIDDEN");
 if(next.issuers.length===2){
  assert.equal(s.operator_successor_key_id,null,"TRUST_V2_MISSING_PUBLIC_REGISTRATION");
  assert.equal(s.registration_state,"PENDING_NEW_OPERATOR_PUBLIC_KEY_AND_INDEPENDENT_OWNER_AUTHORITY");
  return Object.freeze({status:"TRUST_V2_CANDIDATE_MISSING_OPERATOR_KEY_HOLD",registered:false,
   authorized:false,production_authorized:false,permit_authorized:false});
 }
 const k=next.issuers[2];
 assert.equal(k.issuer_id,OP,"TRUST_V2_OPERATOR_ID_MUST_REMAIN");
 assert.equal(k.role,"ACCOUNTABLE_SINGLE_OPERATOR","TRUST_V2_ROLE_NOT_OWNER");
 assert.equal(k.revoked,false,"TRUST_V2_NEW_KEY_REVOKED");
 assert(/^[A-Za-z0-9_-]{1,128}$/.test(k.key_id)&&!old.issuers.some(x=>x.key_id===k.key_id),
  "TRUST_V2_DUPLICATE_KEY_ID");
 assert(utc(k.not_before)&&utc(k.not_after),"TRUST_V2_NEW_KEY_TIME");
 const start=Date.parse(k.not_before),end=Date.parse(k.not_after);
 assert((allowFuture||start<=now)&&now<end&&end>start&&end-start<=90*86400000,"TRUST_V2_WINDOW_NOT_ELIGIBLE");
 assert.equal(s.operator_successor_key_id,k.key_id,"TRUST_V2_KEY_ID_UNBOUND");
 assert(SHA.test(k.spki_sha256),"TRUST_V2_SPKI_SHA");
 const key=crypto.createPublicKey(k.public_key_pem);
 assert.equal(key.asymmetricKeyType,"ed25519","TRUST_V2_ED25519");
 assert.equal(sha(key.export({format:"der",type:"spki"})),k.spki_sha256,"TRUST_V2_SPKI_DRIFT");
 assert.equal(s.registration_state,"PENDING_INDEPENDENT_OWNER_AUTHORITY");
 return Object.freeze({status:"TRUST_V2_PUBLIC_KEY_CANDIDATE_ONLY_NOT_AUTHORIZED",
  registered:false,authorized:false,key_id:k.key_id,spki_sha256:k.spki_sha256,
  not_before:k.not_before,production_authorized:false,permit_authorized:false});
}
function regular(file){
 assert(typeof file==="string"&&path.isAbsolute(file),"TRUST_V2_AUTHORITY_ABSOLUTE");
 const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=65536,"TRUST_V2_AUTHORITY_FILE");
 return fs.readFileSync(file);
}
function github(api){
 assert(/^\/(?:pulls\/(?:3772|3752)|issues\/comments\/[1-9][0-9]*|git\/ref\/heads\/main|git\/commits\/[a-f0-9]{40}|rulesets)$/.test(api),"TRUST_V2_GITHUB_API_OUTSIDE_SCOPE");
 const c=process.platform==="win32"?"curl.exe":"curl";
 const s=cp.execFileSync(c,["--fail","--silent","--show-error","--location","--max-time","20",
  "-H","Accept: application/vnd.github+json","-H","X-GitHub-Api-Version: 2022-11-28",
  "https://api.github.com/repos/"+REPO+api],{encoding:"utf8",timeout:25000,maxBuffer:2*1024*1024,windowsHide:true});
 return JSON.parse(s);
}
function verifyEffective({authority_file,source_root,trust_v2_bytes}={}){
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"TRUST_V2_WINDOWS_NATIVE_ONLY");
 assert(typeof source_root==="string"&&path.isAbsolute(source_root),"TRUST_V2_EXACT_SOURCE_ROOT");
 const v1=regular(path.join(source_root,"scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json"));
 const current=regular(path.join(source_root,TRUST_V2_PATH));
 assert(Buffer.isBuffer(trust_v2_bytes)&&current.equals(trust_v2_bytes),"TRUST_V2_REGISTERED_SOURCE_BYTES_CHANGED");
 const state=candidate(v1,current);
 assert.equal(state.status,"TRUST_V2_PUBLIC_KEY_CANDIDATE_ONLY_NOT_AUTHORIZED","TRUST_V2_PUBLIC_REGISTRATION_REQUIRED");
 const auth=json(regular(authority_file));
 assert.deepEqual(Object.keys(auth).sort(),[
  "approval_comment_id","expected_merge_commit_sha","expected_source_head_sha",
  "pr_number","trust_v2_sha256","schema_version"].sort(),"TRUST_V2_AUTHORITY_INPUT_SCHEMA");
 assert.equal(auth.schema_version,"MCFT_CAP09_TRUST_V2_EXACT_OWNER_MERGE_PROOF_V1");
 assert.equal(auth.pr_number,PR);assert(Number.isSafeInteger(auth.approval_comment_id)&&auth.approval_comment_id>0);
 assert(HEAD.test(auth.expected_source_head_sha)&&HEAD.test(auth.expected_merge_commit_sha));
 assert(SHA.test(auth.trust_v2_sha256)&&auth.trust_v2_sha256===sha(current),"TRUST_V2_BYTES_NOT_APPROVED");
 const git=cp.execFileSync("git",["-C",source_root,"rev-parse","HEAD"],{encoding:"utf8",timeout:20000,windowsHide:true}).trim();
 assert.equal(git,auth.expected_merge_commit_sha,"TRUST_V2_GIT_SUBJECT_CHANGED");
 assert.equal(github("/git/ref/heads/main").object.sha,git,"TRUST_V2_PROTECTED_MAIN_CHANGED");
 const origin=github("/pulls/3752");
 assert(origin.merged===true&&origin.merged_by?.login==="liyongshang44-max",
  "TRUST_V2_PRIOR_REGISTRATION_POLICY_NOT_ADOPTED");
 const pr=github("/pulls/3772");
 assert(pr.state==="closed"&&pr.merged===true&&pr.merged_by?.login==="liyongshang44-max",
  "TRUST_V2_OWNER_NATIVE_MERGE_REQUIRED");
 assert.equal(pr.merge_commit_sha,git);assert.equal(pr.head?.sha,auth.expected_source_head_sha);
 assert.equal(pr.base?.sha,BASE,"TRUST_V2_WRONG_BASE");
 const commit=github("/git/commits/"+git),head=github("/git/commits/"+auth.expected_source_head_sha);
 assert.deepEqual(commit.parents.map(p=>p.sha),[BASE,auth.expected_source_head_sha],
  "TRUST_V2_NATIVE_MERGE_PARENTS");
 assert.equal(commit.tree.sha,head.tree.sha,"TRUST_V2_MERGED_SOURCE_TREE_CHANGED");
 const approved=github("/issues/comments/"+auth.approval_comment_id);
 assert.equal(approved.user?.login,"liyongshang44-max","TRUST_V2_OWNER_APPROVAL_ACTOR");
 assert.equal(approved.author_association,"OWNER");
 assert.equal(approved.created_at,approved.updated_at,"TRUST_V2_APPROVAL_EDITED");
 assert(approved.issue_url?.endsWith("/issues/"+PR),"TRUST_V2_APPROVAL_WRONG_PR");
 const a=JSON.parse(approved.body||"null");
 assert.deepEqual(Object.keys(a).sort(),["decision","pr_number","source_head_sha",
  "trust_v2_sha256","spki_sha256","key_id","registration_scope",
  "production_authorized","permit_authorized"].sort(),"TRUST_V2_APPROVAL_FIELDS");
 assert.equal(a.decision,REGISTRATION_DECISION);
 assert.equal(a.pr_number,PR);assert.equal(a.source_head_sha,auth.expected_source_head_sha);
 assert.equal(a.trust_v2_sha256,auth.trust_v2_sha256);
 assert.equal(a.spki_sha256,state.spki_sha256);assert.equal(a.key_id,state.key_id);
 assert.equal(a.registration_scope,"CAP09_ISOLATED_TEST_ONLY");
 assert.equal(a.production_authorized,false);assert.equal(a.permit_authorized,false);
 assert(utc(new Date(approved.created_at).toISOString())&&Date.parse(approved.created_at)<=Date.parse(state.not_before),
  "TRUST_V2_EFFECTIVE_BEFORE_GOVERNANCE_APPROVAL");
 assert(Date.parse(approved.created_at)<=Date.parse(pr.merged_at),"TRUST_V2_APPROVAL_AFTER_MERGE");
 const rules=github("/rulesets");
 assert(Array.isArray(rules)&&rules.some(r=>r.name==="main-strict-delivery-v1"&&r.enforcement==="active"),
  "TRUST_V2_PROTECTED_MAIN_RULESET_UNVERIFIED");
 return Object.freeze({status:"TRUST_V2_OWNER_NATIVE_GOVERNANCE_AND_REGISTERED_KEY_VERIFIED_NOT_PERMIT",
  subject_sha:git,trust_v2_sha256:sha(current),operator_key_id:state.key_id,permit_authorized:false,
  production_authorized:false,execution_authorized:false});
}
module.exports={candidate,verifyEffective,OLD_SHA,RUN,HOST,OP,PR};
