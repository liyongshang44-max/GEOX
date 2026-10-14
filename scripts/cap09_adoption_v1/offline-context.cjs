'use strict';
// Proof-consuming context for the existing real host. Never signs or consumes permits.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const c=require('./contract.cjs'),material=require('./installed-material.cjs');
const POLICY=path.join(__dirname,'offline-trust.json');
const DOMAIN='GEOX_CAP09_ADOPTED_EXECUTION_CONTEXT_V1\n';
const ADOPTION_DOMAIN='GEOX_MCFT_CAP09_ADOPTION_QUALIFICATION_V1\n';
const QCP_REL='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json';
const ENGINEERING_ONLY_CHECK='A44_ADOPTION_QUALIFICATION_LOCAL_EXECUTION_ADMISSION_ENGINEERING_ONLY';
const verifiedFormalContexts=new WeakSet();

function safeRef(root,rel){
 assert(typeof rel==='string'&&rel.length>0&&!path.isAbsolute(rel)&&!rel.includes('\\'),'OFFLINE_EVIDENCE_PATH_INVALID');
 const parts=rel.split('/');assert(parts.every(x=>x&&x!=='.'&&x!=='..'&&/^[A-Za-z0-9_.-]+$/.test(x)),'OFFLINE_EVIDENCE_PATH_INVALID');
 const file=path.join(root,...parts);c.noLinks(file);return file;
}
function validateStaticPolicy(policy,now){
 c.exact(policy,['schema','activation_mode','adopted','subject_sha','host_id','operator_id','valid_until','checks','allowed_not_applicable_ids','issuers']);
 assert.equal(policy.schema,'CAP09_OFFLINE_ADOPTION_TRUST_V1');
 assert.equal(policy.activation_mode,'SIGNED_ADOPTION_REQUIRED');
 // Repository defaults remain visibly disabled; the signed qualification is the activation fact.
 assert.equal(policy.adopted,false,'STATIC_POLICY_MUST_NOT_SELF_ACTIVATE');
 assert.equal(policy.subject_sha,null,'STATIC_POLICY_MUST_NOT_PIN_MUTABLE_SUBJECT');
 assert(c.epoch(policy.valid_until)>now,'OFFLINE_POLICY_EXPIRED');
 assert(Array.isArray(policy.checks)&&policy.checks.length===54,'OFFLINE_CHECK_POLICY_INCOMPLETE');
 assert.equal(new Set(policy.checks.map(x=>x.check_id)).size,54,'OFFLINE_CHECK_POLICY_DUPLICATE');
 for(const x of policy.checks){
  c.exact(x,['check_id','check_revision','allow_not_applicable']);c.id(x.check_id);
  assert.equal(x.check_revision,'LOCAL_QCP_DEFINITION_SHA256');
  assert(typeof x.allow_not_applicable==='boolean','OFFLINE_CHECK_POLICY_INVALID');
 }
 assert(Array.isArray(policy.allowed_not_applicable_ids),'OFFLINE_NA_POLICY_REQUIRED');
 const allowed=new Set(policy.allowed_not_applicable_ids);
 assert.equal(allowed.size,policy.allowed_not_applicable_ids.length,'OFFLINE_NA_POLICY_DUPLICATE');
 for(const id of allowed)assert(policy.checks.some(x=>x.check_id===id&&x.allow_not_applicable===true),'OFFLINE_NA_POLICY_INVALID');
 assert(Array.isArray(policy.issuers)&&policy.issuers.length>0,'OFFLINE_ISSUER_REQUIRED');
}
function verifySignature(envelope,policy,domain){
 const q=envelope.payload;
 const issuers=policy.issuers.filter(x=>x.issuer_id===q.issuer_id&&x.key_id===q.key_id&&x.purpose==='ADOPTION');
 assert.equal(issuers.length,1,'OFFLINE_UNKNOWN_ISSUER');const i=issuers[0];assert.equal(i.revoked,false,'OFFLINE_ISSUER_REVOKED');
 assert(['ACCOUNTABLE_SINGLE_OPERATOR','INDEPENDENT_GOVERNANCE'].includes(i.role),'OFFLINE_ISSUER_ROLE_INVALID');
 if(i.role==='INDEPENDENT_GOVERNANCE')assert.notEqual(i.issuer_id,policy.operator_id,'OFFLINE_INDEPENDENCE_REQUIRED');
 assert(c.epoch(i.not_before)<=c.epoch(q.issued_at)&&c.epoch(q.expires_at)<=c.epoch(i.not_after),'OFFLINE_KEY_LIFETIME_INVALID');
 const key=crypto.createPublicKey(i.public_key_pem);assert.equal(key.asymmetricKeyType,'ed25519');
 assert.equal(c.sha(key.export({type:'spki',format:'der'})),i.spki_sha256,'OFFLINE_KEY_FINGERPRINT_INVALID');
 const sig=Buffer.from(envelope.signature_base64,'base64');assert.equal(sig.length,64);assert.equal(sig.toString('base64'),envelope.signature_base64,'OFFLINE_SIGNATURE_ENCODING_INVALID');
 assert(crypto.verify(null,Buffer.from(domain+c.canonical(q)),key,sig),'OFFLINE_BAD_SIGNATURE');
}
function validateFormal(request,policy,root,{now=Date.now(),host=os.hostname(),environment=process.env}={}){
 validateStaticPolicy(policy,now);
 c.exact(request,['qualification','material','evidence_root']);
 const envelope=request.qualification;c.exact(envelope,['payload','signature_base64']);const q=envelope.payload;
 c.exact(q,['qualification_id','schema','subject_sha','scope','issued_at','expires_at','issuer_id','key_id','policy_digest','material_digest','checks','frozen_paths','first_parent_proven','host_id','operator_id','qcp_proof_ref','qcp_proof_sha256','release_binding_ref','release_binding_sha256']);
 assert.equal(q.schema,'MCFT_CAP09_ADOPTION_QUALIFICATION_V1');c.id(q.qualification_id);
 assert.equal(q.scope,'TEST_ONLY');assert(/^[a-f0-9]{40}$/.test(q.subject_sha),'OFFLINE_SUBJECT_INVALID');
 assert.equal(q.policy_digest,c.digest(policy),'OFFLINE_POLICY_DRIFT');
 assert.equal(q.host_id,host,'OFFLINE_WRONG_HOST');assert.equal(q.host_id,policy.host_id,'OFFLINE_POLICY_HOST_MISMATCH');
 assert.equal(q.operator_id,policy.operator_id,'OFFLINE_OPERATOR_MISMATCH');
 c.window(q,now,86400000);assert(c.epoch(q.expires_at)<=c.epoch(policy.valid_until),'OFFLINE_QUALIFICATION_OUTLIVES_POLICY');
 assert.equal(q.frozen_paths,108,'OFFLINE_FROZEN_SCOPE_INVALID');assert.equal(q.first_parent_proven,true,'OFFLINE_FIRST_PARENT_REQUIRED');
 c.hash(q.qcp_proof_sha256);c.hash(q.release_binding_sha256);c.hash(q.material_digest);

 const qcp=c.read(path.join(root,...QCP_REL.split('/')));
 assert(Array.isArray(qcp.checks)&&qcp.checks.length===55,'OFFLINE_LOCAL_QCP_SET_CHANGED');
 const definitions=new Map(qcp.checks.map(x=>[x.check_id,x]));
 const policyIds=policy.checks.map(x=>x.check_id),extras=qcp.checks.map(x=>x.check_id).filter(x=>!policyIds.includes(x));
 assert.deepEqual(extras,[ENGINEERING_ONLY_CHECK],'OFFLINE_LOCAL_QCP_EXTRA_SET_CHANGED');
 assert(policyIds.every(id=>definitions.has(id)),'OFFLINE_LOCAL_QCP_CHECK_MISSING');
 assert(Array.isArray(q.checks)&&q.checks.length===54,'OFFLINE_CHECKS_INCOMPLETE');
 const seen=new Set(),allowedNA=new Set(policy.allowed_not_applicable_ids);
 for(const x of q.checks){
  c.exact(x,['check_id','revision','result','reason','evidence_ref','sha256']);
  const declared=policy.checks.find(p=>p.check_id===x.check_id),definition=definitions.get(x.check_id);
  assert(declared&&definition&&!seen.has(x.check_id),'OFFLINE_CHECK_MISSING_OR_DUPLICATE');seen.add(x.check_id);
  c.hash(x.revision);assert.equal(x.revision,c.digest(definition),'OFFLINE_CHECK_REVISION_CHANGED');
  const accepted=x.result==='PASS'||(x.result==='NOT_APPLICABLE'&&declared.allow_not_applicable===true&&allowedNA.has(x.check_id)&&typeof x.reason==='string'&&x.reason.trim());
  assert(accepted,'OFFLINE_CHECK_BLOCKED');assert(typeof x.reason==='string','OFFLINE_CHECK_REASON_REQUIRED');c.hash(x.sha256);
  const file=safeRef(request.evidence_root,x.evidence_ref);assert.equal(c.sha(fs.readFileSync(file)),x.sha256,'OFFLINE_EVIDENCE_DRIFT');
  const evidence=c.read(file);
  assert.equal(evidence.schema,'MCFT_CAP09_ADOPTION_CHECK_EVIDENCE_V1');assert.equal(evidence.subject_sha,q.subject_sha);
  assert.equal(evidence.check_id,x.check_id);assert.equal(evidence.revision,x.revision);assert.equal(evidence.result,x.result);
 }
 assert.equal(seen.size,54,'OFFLINE_CHECKS_INCOMPLETE');

 const qcpProofFile=safeRef(request.evidence_root,q.qcp_proof_ref);
 assert.equal(c.sha(fs.readFileSync(qcpProofFile)),q.qcp_proof_sha256,'OFFLINE_QCP_PROOF_DRIFT');
 const proof=c.read(qcpProofFile);
 assert.equal(proof.schema,'MCFT_CAP09_FINAL_QCP_ADOPTION_PROOF_V1');assert.equal(proof.subject_sha,q.subject_sha);
 assert.equal(proof.status,'PASS');assert.equal(proof.total_checks,55);assert.equal(proof.adoption_checks,54);assert.equal(proof.blocker_count,0);
 const releaseFile=safeRef(request.evidence_root,q.release_binding_ref);
 assert.equal(c.sha(fs.readFileSync(releaseFile)),q.release_binding_sha256,'OFFLINE_RELEASE_BINDING_DRIFT');
 const release=c.read(releaseFile);assert.equal(release.schema_version,'MCFT_CAP09_RELEASE_MATERIAL_BINDING_V1');assert.equal(release.subject_commit_sha,q.subject_sha);

 assert.equal(q.material_digest,c.digest(request.material),'OFFLINE_MATERIAL_BINDING_CHANGED');
 const checked=material.verify(request.material,root,environment);
 return {q,checked};
}
function verifyFormal(request,policy,root,options={}){
 const {q,checked}=validateFormal(request,policy,root,options);
 verifySignature(request.qualification,policy,ADOPTION_DOMAIN);
 const now=options.now??Date.now(),host=options.host??os.hostname(),environment=options.environment??process.env;
 const result=Object.freeze({head:q.subject_sha,main:q.subject_sha,clean:true,base_ancestor:true,frozen_runtime_identical:true,
  host_id:host,now:new Date(now).toISOString(),platform:process.platform,ci:Boolean(environment.CI||environment.GITHUB_ACTIONS),
  source:'SIGNED_ADOPTION_NOT_LIVE_REMOTE_MAIN',scope:'TEST_ONLY',adoption_digest:c.digest(request.qualification),material_digest:checked.digest,
  qualification_id:q.qualification_id,qualification_expires_at:q.expires_at,execution_authorized:true,production_authorized:false});
 verifiedFormalContexts.add(result);return result;
}

// Retained candidate verifier for synthetic tests only. It is unreachable from the fixed production policy.
function verifyLegacy(request,policy,root,{now=Date.now(),host=os.hostname(),environment=process.env}={}){
 assert.equal(policy.adopted,true,'OFFLINE_ADOPTION_NOT_ADOPTED');
 assert.equal(policy.schema,'CAP09_OFFLINE_ADOPTION_TRUST_V1');assert(c.epoch(policy.valid_until)>now,'OFFLINE_POLICY_EXPIRED');
 c.exact(request,['qualification','material','evidence_root']);
 const envelope=request.qualification;c.exact(envelope,['payload','signature_base64']);const q=envelope.payload;
 c.exact(q,['schema','subject_sha','scope','issued_at','expires_at','issuer_id','key_id','policy_digest','material_digest','checks','frozen_paths','first_parent_proven','host_id','operator_id']);
 assert.equal(q.schema,'CAP09_ADOPTED_EXECUTION_CONTEXT_V1');assert.equal(q.scope,'TEST_ONLY');
 assert.equal(q.subject_sha,policy.subject_sha);assert(/^[a-f0-9]{40}$/.test(q.subject_sha));
 assert.equal(q.policy_digest,c.digest(policy),'OFFLINE_POLICY_DRIFT');assert.equal(q.host_id,host,'OFFLINE_WRONG_HOST');assert.equal(q.host_id,policy.host_id);
 assert.equal(q.operator_id,policy.operator_id);c.window(q,now,86400000);assert(c.epoch(q.expires_at)<=c.epoch(policy.valid_until));
 verifySignature(envelope,{...policy,issuers:policy.issuers.map(x=>({...x,purpose:'ADOPTION'}))},DOMAIN);
 assert.equal(q.frozen_paths,108);assert.equal(q.first_parent_proven,true);
 assert(Array.isArray(policy.checks)&&policy.checks.length===54,'OFFLINE_CHECK_POLICY_INCOMPLETE');assert.equal(new Set(policy.checks.map(x=>x.check_id)).size,54);
 assert(Array.isArray(q.checks)&&q.checks.length===54,'OFFLINE_CHECKS_INCOMPLETE');
 const seen=new Set();for(const x of q.checks){
  c.exact(x,['check_id','revision','result','reason','evidence_ref','sha256']);const expected=policy.checks.find(p=>p.check_id===x.check_id);
  assert(expected&&!seen.has(x.check_id));seen.add(x.check_id);assert.equal(x.revision,expected.revision);
  assert(x.result==='PASS'||(x.result==='NOT_APPLICABLE'&&expected.allow_not_applicable===true&&typeof x.reason==='string'&&x.reason.trim()),'OFFLINE_CHECK_BLOCKED');
  assert(/^[A-Za-z0-9_.-]+\.json$/.test(x.evidence_ref));c.hash(x.sha256);
  const file=path.join(request.evidence_root,x.evidence_ref);c.noLinks(file);assert.equal(c.sha(fs.readFileSync(file)),x.sha256,'OFFLINE_EVIDENCE_DRIFT');
 }
 assert.equal(q.material_digest,c.digest(request.material),'OFFLINE_MATERIAL_BINDING_CHANGED');
 const checked=material.verify(request.material,root,environment);
 return Object.freeze({head:q.subject_sha,main:q.subject_sha,clean:true,base_ancestor:true,frozen_runtime_identical:true,
  host_id:host,now:new Date(now).toISOString(),platform:process.platform,ci:Boolean(environment.CI||environment.GITHUB_ACTIONS),
  source:'SIGNED_ADOPTION_NOT_LIVE_REMOTE_MAIN',adoption_digest:c.digest(envelope),material_digest:checked.digest,qualification_expires_at:q.expires_at,
  execution_authorized:false,production_authorized:false});
}
function verify(request,policy,root,options={}){
 return policy.activation_mode==='SIGNED_ADOPTION_REQUIRED'?verifyFormal(request,policy,root,options):verifyLegacy(request,policy,root,options);
}
function load(file,root){const policy=c.read(POLICY);return verify(c.read(file),policy,root);}
function isFormalVerified(context){return verifiedFormalContexts.has(context);}
function bindObserved(context,bundle){
 c.exact(bundle.observed.adoption_binding,['qualification_digest','material_digest']);
 assert.equal(bundle.observed.adoption_binding.qualification_digest,context.adoption_digest,'OFFLINE_PERMIT_PROOF_MISMATCH');
 assert.equal(bundle.observed.adoption_binding.material_digest,context.material_digest,'OFFLINE_PERMIT_MATERIAL_MISMATCH');
 assert(c.epoch(bundle.permit.payload.expires_at)<=c.epoch(context.qualification_expires_at),'PERMIT_OUTLIVES_ADOPTION');
}
module.exports={DOMAIN,ADOPTION_DOMAIN,POLICY,QCP_REL,verify,verifyFormal,validateFormal,load,isFormalVerified,bindObserved};
