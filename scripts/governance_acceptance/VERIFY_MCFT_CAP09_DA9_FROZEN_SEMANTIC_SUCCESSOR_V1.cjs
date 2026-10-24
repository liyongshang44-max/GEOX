"use strict";
// Independent DA9 semantic successor. NEVER substitutes the historical 108-path zero-delta verifier.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../.."),BASE="2b63652297bb285f21c4d4c63c37d247d009142c";
const CONTRACT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-FROZEN-SEMANTIC-SUCCESSOR-V1.json",EVIDENCE="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIX-CHECK-EVIDENCE-V1.json",Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const TRUST="scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json";
const DOMAIN="GEOX_MCFT_CAP09_DA9_FROZEN_SEMANTIC_SUCCESSOR_SIX_CHECK_V1\n";
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const git=(...xs)=>cp.execFileSync("git",xs,{cwd:ROOT,encoding:"utf8",maxBuffer:32*1024*1024}).trim();
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const required=Object.freeze(["V13_AUTONOMOUS_FORCING_FOUNDATION","V13_HOLISTIC_SCHEMA","V13_NEXT_TICK_VIABILITY","EA5C1_DURABLE_RAW_RESTRICTED_INGRESS","PHASE3_EVIDENCE_RUNTIME_FOUNDATION","PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION"]);
const goodHex=(s,n)=>typeof s==="string"&&new RegExp("^[0-9a-f]{"+n+"}$").test(s);
function scope(){
 const c=read(CONTRACT);assert.equal(c.contract_id,"MCFT_CAP09_DA9_ISOLATED_RETENTION_FROZEN_SEMANTIC_SUCCESSOR_V1");
 assert.equal(c.adopted_base_sha,BASE);assert.equal(c.historical_frozen_runtime_sha,"3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a");
 assert.deepEqual(c.exact_qualification_check_ids,required);assert.equal(c.historical_frozen_zero_delta_claim,false);
 for(const key of ["permit_signing_allowed","permit_consumption_allowed","production_writes_allowed","third_attempt_authorized"])assert.equal(c[key],false);
 const head=git("rev-parse","HEAD");assert(goodHex(head,40));
 cp.execFileSync("git",["merge-base","--is-ancestor",BASE,head],{cwd:ROOT});
 const resolver=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs").resolveDependencyResolvers(ROOT,read(Q));
 assert.deepEqual(resolver.errors,[],"SUCCESSOR_DEPENDENCY_RESOLVERS_INVALID");
 const paths=resolver.resolved.V13_RUNTIME_SEMANTIC_CLOSURE.paths;
 assert.equal(paths.length,108,"HISTORICAL_FROZEN_RUNTIME_PATH_COUNT_CHANGED");
 const changed=git("diff","--name-only",BASE,head,"--",...paths).split(/\r?\n/).filter(Boolean).sort();
 const expectedPaths=Object.keys(c.expected_changed_frozen_paths).sort();
 assert.deepEqual(changed,expectedPaths,"UNREVIEWED_FROZEN_RUNTIME_CHANGED");
 for(const file of expectedPaths){
  const blobs=c.expected_changed_frozen_paths[file];
  assert(goodHex(blobs.base,40)&&goodHex(blobs.candidate,40));
  assert.equal(git("rev-parse",BASE+":"+file),blobs.base,"BASELINE_BLOB_CHANGED:"+file);
  assert.equal(git("rev-parse",head+":"+file),blobs.candidate,"CANDIDATE_SEMANTIC_BLOB_CHANGED:"+file);
 }
 const composer="scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts";
 assert.equal(git("rev-parse",head+":"+composer),c.expected_unchanged_isolated_composer_git_blob_sha,"COMPOSER_SCOPE_CHANGED");
 const promo=fs.readFileSync(path.join(ROOT,expectedPaths.find(x=>x.includes("twin_runtime/external_formal"))),"utf8");
 assert(promo.includes("if (authority === undefined) return MCFT_CAP09_FORMAL_RAW_BUCKET_V1;"),"PRODUCTION_DEFAULT_BUCKET_GUARD_REMOVED");
 assert(promo.includes('mode: "ISOLATED_QUALIFICATION_ONLY"'),"ISOLATED_MODE_MISSING");
 assert(promo.includes("key !== `${MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1}/${rawSha.slice(7)}`"),"EXACT_CONTENT_ADDRESS_GUARD_MISSING");
 return {status:"ISOLATED_SEMANTIC_DELTA_PINNED_NOT_QCP_PASS",subject_sha:head,changed_frozen_paths:changed,original_frozen_zero_delta_not_claimed:true,production_authorized:false,permit_issued:false,third_attempt_authorized:false};
}
function checkEnvelope(e,decision,stage,head){
 assert(e&&typeof e==="object"&&!Array.isArray(e),"SIX_CHECK_ENVELOPE_REQUIRED");
 assert.deepEqual(Object.keys(e).sort(),["payload","signature_base64"].sort());
 const a=e.payload;assert(a&&typeof a==="object"&&!Array.isArray(a));
 const fields=["check_id","subject_sha","stage","dependency_digest","workflow_path","run_id","run_head_sha","run_base_sha","run_conclusion","artifact_sha256","source_blob_sha256","signed_at","issuer_id","key_id","production_authorized","permit_consumed"];
 assert.deepEqual(Object.keys(a).sort(),fields.sort(),"SIX_CHECK_PAYLOAD_SCHEMA_CHANGED");
 assert.equal(a.check_id,decision.check_id,"SIX_CHECK_ID_CHANGED");
 assert.equal(a.stage,stage,"SIX_CHECK_STAGE_CHANGED");
 assert(goodHex(a.subject_sha,40)); assert.equal(a.run_head_sha,a.subject_sha,"SIX_CHECK_RUN_SUBJECT_MISMATCH");
 assert(goodHex(a.run_base_sha,40));assert.equal(a.run_base_sha,BASE,"SIX_CHECK_RUN_BASE_CHANGED");
 assert.equal(a.dependency_digest,decision.dependency_digest,"SIX_CHECK_DEPENDENCY_DIGEST_CHANGED");
 assert.equal(a.workflow_path,read(CONTRACT).proof_workflow_path,"SIX_CHECK_WORKFLOW_CHANGED");
 assert(a.run_conclusion==="success"&&Number.isSafeInteger(a.run_id)&&a.run_id>0,"SIX_CHECK_RUN_NOT_SUCCESS");
 assert(goodHex(a.artifact_sha256,64),"SIX_CHECK_ARTIFACT_DIGEST_MISSING");
 assert(goodHex(a.source_blob_sha256,64),"SIX_CHECK_SOURCE_MANIFEST_DIGEST_MISSING");
 assert.equal(a.production_authorized,false);assert.equal(a.permit_consumed,false);
 assert.equal(a.subject_sha,head,"SIX_CHECK_EXACT_HEAD_REQUIRED");
 const t=Date.parse(a.signed_at);assert(Number.isFinite(t)&&new Date(t).toISOString()===a.signed_at,"SIX_CHECK_SIGNED_TIME_INVALID");
 const tr=read(TRUST),issuer=(tr.issuers||[]).filter(i=>i.issuer_id===a.issuer_id&&i.key_id===a.key_id&&!i.revoked);
 assert.equal(issuer.length,1,"SIX_CHECK_TRUSTED_REVIEWER_REQUIRED");
 assert(["ACCOUNTABLE_SINGLE_OPERATOR","INDEPENDENT_RETRY_GOVERNANCE"].includes(issuer[0].role),"SIX_CHECK_REVIEWER_ROLE_INVALID");
 assert(t>=Date.parse(issuer[0].not_before)&&t<=Date.parse(issuer[0].not_after),"SIX_CHECK_REVIEW_KEY_TIME_INVALID");
 const key=crypto.createPublicKey(issuer[0].public_key_pem);
 assert.equal(sha(key.export({type:"spki",format:"der"})),issuer[0].spki_sha256,"SIX_CHECK_TRUST_KEY_MISMATCH");
 const sig=Buffer.from(e.signature_base64,"base64");
 assert(sig.length===64&&sig.toString("base64")===e.signature_base64,"SIX_CHECK_SIGNATURE_FORMAT");
 const bytes=Buffer.from(DOMAIN+JSON.stringify(a));
 assert(crypto.verify(null,bytes,key,sig),"SIX_CHECK_REVIEW_SIGNATURE_INVALID");
 return {id:a.check_id,run_id:a.run_id,source_sha:a.subject_sha,dependency_digest:a.dependency_digest,artifact_sha256:a.artifact_sha256};
}
function verifyRegisteredEvidence({decision,stage,head}){
 if(!required.includes(decision.check_id))return {status:"NOT_APPLICABLE"};
 try{
  const sc=scope();assert.equal(head,sc.subject_sha,"SIX_CHECK_EXACT_CHECKOUT_REQUIRED");
  const reg=read(EVIDENCE);assert.equal(reg.contract_ref,CONTRACT,"SIX_CHECK_CONTRACT_REF_INVALID");
  assert.equal(reg.subject_source_sha,head,"SIX_CHECK_REGISTRY_SUBJECT_CHANGED");
  assert.deepEqual(Object.keys(reg.checks).sort(),[...required].sort(),"SIX_CHECK_REGISTRATION_SET_CHANGED");
  assert(Array.isArray(reg.entries),"SIX_CHECK_REGISTRY_ENTRIES_REQUIRED");
  const ent=reg.entries.filter(e=>e?.payload?.check_id===decision.check_id);
  assert.equal(ent.length,1,"SIX_CHECK_PROOF_MISSING_OR_AMBIGUOUS");
  const verified=checkEnvelope(ent[0],decision,stage,head);
  assert.equal(reg.checks[decision.check_id].status,"SIGNED_REVIEW_VERIFIED","SIX_CHECK_NOT_REGISTERED");
  assert.equal(reg.checks[decision.check_id].verified_evidence_ref,verified.artifact_sha256,"SIX_CHECK_ARTIFACT_REF_MISMATCH");
  return {status:"PASS",reason_code:"SIGNED_DA9_ISOLATED_SEMANTIC_SUCCESSOR_REQUALIFICATION",
    evidence_id:"DA9_SEMANTIC_SUCCESSOR_"+decision.check_id,run_id:verified.run_id,subject_sha:head,dependency_digest:verified.dependency_digest,
    historical_frozen_zero_delta_claim:false,permit_authorized:false,production_authorized:false};
 }catch(e){return {status:"FAIL",reason_code:"DA9_SEMANTIC_SUCCESSOR_"+String(e.message||e).split(":")[0].slice(0,110),candidates:[]};}
}
function verifyAll(planned,stage,head){
 const sc=scope();assert.equal(sc.subject_sha,head);
 const results=required.map(id=>{const d=planned.find(x=>x.check_id===id);assert(d,"QCP_SIX_CHECK_NOT_PLANNED:"+id);return {id,...verifyRegisteredEvidence({decision:d,stage,head})};});
 return {status:results.every(x=>x.status==="PASS")?"PASS":"HOLD",
  scope:"ISOLATED_SEMANTIC_SUCCESSOR_ONLY_NOT_HISTORICAL_FROZEN",
  six_checks:results,permit_authorized:false,production_authorized:false};
}
module.exports={required,scope,verifyRegisteredEvidence,verifyAll};
if(require.main===module){const result=scope();if(process.argv.includes("--require-six")){const s=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");throw Error("REQUIRE_SIX_NEEDS_QCP_PLANNED_DECISIONS_AND_VERIFIED_SIGNED_RUNS")}console.log(JSON.stringify(result,null,2));}
