"use strict";
/**
 * Attempt-3 Permit V2 one-shot Host admission / atomic dual-ledger primitive.
 * Stage capability V2 + parent dispatcher now provide actual V2 stage routing,
 * not a V1 reinterpretation. All signed qualification, readback and signed
 * full-chain inputs remain mandatory before consumption. No automatic retry.
 * Host V2 is TEST_ONLY, with no production activation.
 */
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const c=require("../cap09_adoption_v1/contract.cjs");
const adoption=require("../cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs");
const permit=require("./MCFT_CAP09_ATTEMPT3_PERMIT_V2_READONLY.cjs");
const lineage=require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs");
const resource=require("../governance_acceptance/MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1.cjs");
const fullChain=require("../governance_acceptance/MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const accepted=new WeakSet(),consumed=new WeakSet();
// A V2-only child capability and actual six-stage parent runner now exist.
// Engineering route registration is NOT signed Adoption, Permit or production
// authority. prepare() still verifies all actual signed + resource preconditions.
const HOST_V2_STAGE_DISPATCH_ADOPTED=true;
function noLinkDirectory(d){
 assert(typeof d==="string"&&path.isAbsolute(d),"A3_V2_LEDGER_ROOT_ABSOLUTE");
 let p=path.resolve(d);
 for(;;){const s=fs.lstatSync(p);assert(s.isDirectory()&&!s.isSymbolicLink(),"A3_V2_LEDGER_ROOT_NOT_SAFE");const par=path.dirname(p);if(par===p)break;p=par;}
}
function assertLiveExactMain(root,expected){
 // A caller-supplied context is never proof of protected remote main.
 // On the actual Windows host, independently read Git HEAD, working tree,
 // and REMOTE main. No local cached origin/main fallback is accepted.
 assert(typeof root==="string"&&path.isAbsolute(root),"A3_V2_RELEASE_ROOT_REQUIRED");
 const git=(...args)=>cp.execFileSync("git",["-C",root,...args],{encoding:"utf8",timeout:20000,maxBuffer:1048576,windowsHide:true}).trim();
 assert.equal(git("rev-parse","HEAD"),expected,"A3_V2_ACTUAL_HEAD_MISMATCH");
 assert.equal(git("status","--porcelain","--untracked-files=all"),"","A3_V2_ACTUAL_WORKTREE_DIRTY");
 const remote=git("ls-remote","origin","refs/heads/main").split(String.fromCharCode(9))[0];
 assert.equal(remote,expected,"A3_V2_REMOTE_MAIN_MOVED_OR_UNVERIFIED");
 return true;
}
function writeOnce(f,obj){
 const fd=fs.openSync(f,"wx",0o600);
 try{fs.writeFileSync(fd,Buffer.from(JSON.stringify(obj,null,2)+"\n"));fs.fsyncSync(fd);}
 finally{fs.closeSync(fd);}
}
/**
 * Bound evaluation: genuine adopted evidence, two separately signed reviews,
 * a distinct signed full-chain physical receipt, exact-head signed Permit,
 * and short-lived resource owner readback are all individually mandatory.
 * Never infer execute authority from a valid signature.
 */
function prepare(args){
 assert(args&&typeof args==="object","A3_V2_HOST_ADMISSION_INPUT_REQUIRED");
 const {adoptionRequest,releaseRoot,permitEnvelope,lineageEnvelope,resourceEnvelope,
   resourceReadbackFile,trust,context,fullChainBinding,sealedFailureSha,attemptsInventorySha}=args;
 assert(context&&typeof context==="object","A3_V2_HOST_CONTEXT_REQUIRED");
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"A3_V2_WINDOWS_HOST_ONLY");
 assert(!process.env.NODE_OPTIONS&&!process.env.NODE_PATH,"A3_V2_NODE_INJECTION_FORBIDDEN");
 const now=Date.now();
 // Portable installed release may be content-verified but not itself a Git checkout.
 // Source Git identity is independently verified at the separate named clean checkout.
 assertLiveExactMain(context.source_git_root,context.head_sha);
 const a=adoption.verify(adoptionRequest,releaseRoot,{now,host:context.host_id});
 assert(adoption.isVerified(a),"A3_V2_ADOPTION_NOT_VERIFIED");
 assert.equal(context.head_sha,a.subject_sha,"A3_V2_LOCAL_MAIN_CHANGED");
 assert.equal(context.remote_main_sha,a.subject_sha,"A3_V2_REMOTE_MAIN_CHANGED");
 assert.equal(context.clean,true,"A3_V2_WORKTREE_NOT_CLEAN");
 assert.equal(context.host_id,a.host_id);
 assert.equal(context.first_parent_proven,true,"A3_V2_ANCESTRY_MISSING");
 assert.equal(context.frozen_runtime_paths_verified,108,"A3_V2_FROZEN108_UNVERIFIED");
 assert.equal(context.output_exists,false,"A3_V2_OUTPUT_ALREADY_EXISTS");
 assert.equal(context.ledger_slot_exists,false,"A3_V2_LEDGER_ALREADY_USED");
 const signedLineage=lineage.verifyLineageReview(lineageEnvelope,trust,{
  subjectSha:a.subject_sha,hostId:a.host_id,now,sealedFailureSha,attemptsInventorySha});
 const raw=resource.verifyReadbackFile(resourceReadbackFile,resourceEnvelope.payload.readback_sha256);
 assert.equal(raw.status,"RAW_READBACK_BYTES_MATCH_NOT_AUTHORITY");
 const owned=resource.verify(resourceEnvelope,trust,{subject_sha:a.subject_sha,host_id:a.host_id,
  readback_sha256:raw.sha256,now});
 resource.bindSignedToReadback(resourceEnvelope.payload,raw);
 assert.equal(owned.run_id,a.run_id);
 const full=fullChain.verify({binding:fullChainBinding,trust,subjectSha:a.subject_sha,
  attemptRunId:a.run_id,sourceRoot:releaseRoot,now});
 assert.equal(full.status,"FULL_CHAIN_PHYSICAL_INTEGRATION_SIGNED_REVIEW_VERIFIED_NOT_PERMIT_AUTHORITY");
 const envelopeSha=sha(lineage.canonical(permitEnvelope));
 const proofDigest=a.adoption_digest;
 const lineageDigest=sha(lineage.canonical(lineageEnvelope));
 const resourceDigest=owned.resources_sha256;
 assert.equal(context.resources_sha256,resourceDigest,"A3_V2_CONTEXT_RESOURCE_MISMATCH");
 assert.equal(context.adoption_v2_proof_sha256,proofDigest,"A3_V2_CONTEXT_ADOPTION_MISMATCH");
 assert.equal(context.lineage_review_sha256,lineageDigest,"A3_V2_CONTEXT_LINEAGE_MISMATCH");
 // All V2 Permit digests bind the *actual* signed evidence and plan bytes.
 const result=permit.verifyReadOnly(permitEnvelope,trust,{
  subject_sha:a.subject_sha,protected_main_sha:a.subject_sha,source_clean:true,
  host_id:a.host_id,now:new Date(now).toISOString(),
  authorized_at:permitEnvelope.payload.issued_at,expires_at:permitEnvelope.payload.expires_at,
  arm_sha256:context.arm_sha256,observations_sha256:context.observations_sha256,
  plan_sha256:context.plan_sha256,adoption_v2_proof_sha256:proofDigest,
  lineage_review_sha256:lineageDigest,resources_sha256:resourceDigest});
 assert.equal(result.run_id,a.run_id);
 assert(new Date(a.qualification_expires_at).getTime()>=new Date(permitEnvelope.payload.expires_at).getTime(),"A3_V2_PERMIT_OUTLIVES_ADOPTION");
 assert.equal(trust.host_id,a.host_id);
 assert.equal(typeof trust.ledger_root,"string");noLinkDirectory(trust.ledger_root);
 const output=Object.freeze({status:"ATTEMPT3_ALL_SIGNED_PRECONDITIONS_VERIFIED_HOST_DISPATCH_HOLD",
  run_id:a.run_id,subject_sha:a.subject_sha,permit_envelope_sha256:envelopeSha,
  nonce:permitEnvelope.payload.nonce,permit_expires_at:permitEnvelope.payload.expires_at,
  ledger_root:trust.ledger_root,adoption_digest:proofDigest,resources_sha256:resourceDigest,
  execute_authorized:false,permit_consumed:false,production_authorized:false});
 accepted.add(output);return output;
}
/**
 * Placeholder of a future Host-v2 governed transaction boundary; no exported
 * callable path may burn a real Permit until a stage capability V2 is actually
 * bound to the V2 consumed receipt. Keep old permit weaksets untouched.
 */
function consumeForQualifiedHost(prepared){
 assert(accepted.has(prepared),"A3_V2_SIGNED_PREPARE_REQUIRED");
 assert.equal(HOST_V2_STAGE_DISPATCH_ADOPTED,true,"A3_V2_STAGE_DISPATCH_NOT_ADOPTED_HOLD");
 // Never route through V1 Permit weaksets or V1 child stage capabilities.
 const v2=require("./MCFT_CAP09_STAGE_CAPABILITY_V2.cjs");
 const dispatcher=require("./MCFT_CAP09_PARENT_STAGE_DISPATCH_V2.cjs");
 const child=require("./MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.cjs");
 const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
 assert.deepEqual(v2.STAGES,scheduler.STAGES,"A3_V2_CHILD_STAGE_ORDER_UNBOUND");
 assert.equal(typeof v2.initializeStageAuthority,"function","A3_V2_STAGE_CAPABILITY_UNREGISTERED");
 assert.equal(typeof dispatcher.dispatchConsumedStageV2,"function","A3_V2_PARENT_DISPATCH_UNREGISTERED");
 assert.equal(typeof child.childTargets,"function","A3_V2_CHILD_GATE_UNREGISTERED");
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS);
 assert(Date.now()<Date.parse(prepared.permit_expires_at),"A3_V2_PERMIT_EXPIRED");
 const root=prepared.ledger_root;noLinkDirectory(root);
 const run=path.join(root,"run-"+prepared.run_id),nonce=path.join(root,"nonce-"+prepared.nonce);
 assert(!fs.existsSync(run)&&!fs.existsSync(nonce),"A3_V2_LEDGER_SLOT_REUSED");
 // Create exclusively; crash between them burns the attempt (no rollback).
 fs.mkdirSync(nonce,{mode:0o700});fs.mkdirSync(run,{mode:0o700});
 const rec={schema_version:"geox_mcft_cap09_consumed_permit_attempt3_v2",
  run_id:prepared.run_id,subject_sha:prepared.subject_sha,
  nonce:prepared.nonce,envelope_sha256:prepared.permit_envelope_sha256,
  adoption_digest:prepared.adoption_digest,resources_sha256:prepared.resources_sha256,
  consumed_at:new Date().toISOString(),status:"CONSUMED_NO_AUTOMATIC_RETRY",
  execute_authorized:false,production_authorized:false};
 writeOnce(path.join(nonce,"CONSUMED.json"),rec);
 writeOnce(path.join(run,"CONSUMED.json"),rec);
 accepted.delete(prepared);
 const res=Object.freeze({nonce_directory:nonce,run_directory:run,status:"CONSUMED_NO_AUTOMATIC_RETRY",execute_authorized:false});
 consumed.add(res);return res;
}
function assertConsumed(receipt){
 assert(consumed.has(receipt),"A3_V2_ATOMIC_CONSUMPTION_REQUIRED");
 const a=fs.readFileSync(path.join(receipt.run_directory,"CONSUMED.json"));
 const b=fs.readFileSync(path.join(receipt.nonce_directory,"CONSUMED.json"));
 assert(a.equals(b),"A3_V2_TWIN_CONSUMPTION_BYTES_DIFFER");
 return receipt;
}
module.exports={HOST_V2_STAGE_DISPATCH_ADOPTED,assertLiveExactMain,prepare,consumeForQualifiedHost,assertConsumed};
