'use strict';
// Proof-consuming context for the existing real host. Never signs or consumes permits.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const c=require('./contract.cjs'),material=require('./installed-material.cjs');
const POLICY=path.join(__dirname,'offline-trust.json');
const DOMAIN='GEOX_CAP09_ADOPTED_EXECUTION_CONTEXT_V1\n';
function verify(request,policy,root,{now=Date.now(),host=os.hostname(),environment=process.env}={}){
 assert.equal(policy.adopted,true,'OFFLINE_ADOPTION_NOT_ADOPTED');
 assert.equal(policy.schema,'CAP09_OFFLINE_ADOPTION_TRUST_V1');
 assert(c.epoch(policy.valid_until)>now,'OFFLINE_POLICY_EXPIRED');
 c.exact(request,['qualification','material','evidence_root']);
 const envelope=request.qualification;c.exact(envelope,['payload','signature_base64']);const q=envelope.payload;
 c.exact(q,['schema','subject_sha','scope','issued_at','expires_at','issuer_id','key_id','policy_digest','material_digest','checks','frozen_paths','first_parent_proven','host_id','operator_id']);
 assert.equal(q.schema,'CAP09_ADOPTED_EXECUTION_CONTEXT_V1');assert.equal(q.scope,'TEST_ONLY');
 assert.equal(q.subject_sha,policy.subject_sha);assert(/^[a-f0-9]{40}$/.test(q.subject_sha));
 assert.equal(q.policy_digest,c.digest(policy),'OFFLINE_POLICY_DRIFT');
 assert.equal(q.host_id,host,'OFFLINE_WRONG_HOST');assert.equal(q.host_id,policy.host_id);
 assert.equal(q.operator_id,policy.operator_id);
 c.window(q,now,86400000);assert(c.epoch(q.expires_at)<=c.epoch(policy.valid_until));
 const issuers=policy.issuers.filter(x=>x.issuer_id===q.issuer_id&&x.key_id===q.key_id&&x.purpose==='ADOPTION');
 assert.equal(issuers.length,1,'OFFLINE_UNKNOWN_ISSUER');const i=issuers[0];assert.equal(i.revoked,false);
 assert(['ACCOUNTABLE_SINGLE_OPERATOR','INDEPENDENT_GOVERNANCE'].includes(i.role));
 if(i.role==='INDEPENDENT_GOVERNANCE')assert.notEqual(i.issuer_id,policy.operator_id);
 assert(c.epoch(i.not_before)<=c.epoch(q.issued_at)&&c.epoch(q.expires_at)<=c.epoch(i.not_after));
 const key=crypto.createPublicKey(i.public_key_pem);assert.equal(key.asymmetricKeyType,'ed25519');assert.equal(c.sha(key.export({type:'spki',format:'der'})),i.spki_sha256);
 const sig=Buffer.from(envelope.signature_base64,'base64');assert.equal(sig.length,64);assert.equal(sig.toString('base64'),envelope.signature_base64);
 assert(crypto.verify(null,Buffer.from(DOMAIN+c.canonical(q)),key,sig),'OFFLINE_BAD_SIGNATURE');
 assert.equal(q.frozen_paths,108);assert.equal(q.first_parent_proven,true);
 assert(Array.isArray(policy.checks)&&policy.checks.length===54,'OFFLINE_CHECK_POLICY_INCOMPLETE');
 assert.equal(new Set(policy.checks.map(x=>x.check_id)).size,54);
 assert(Array.isArray(q.checks)&&q.checks.length===54,'OFFLINE_CHECKS_INCOMPLETE');
 const seen=new Set();for(const x of q.checks){
  c.exact(x,['check_id','revision','result','reason','evidence_ref','sha256']);const expected=policy.checks.find(p=>p.check_id===x.check_id);
  assert(expected&&!seen.has(x.check_id));seen.add(x.check_id);assert.equal(x.revision,expected.revision);
  assert(x.result==='PASS'||(x.result==='NOT_APPLICABLE'&&expected.allow_not_applicable===true&&typeof x.reason==='string'&&x.reason.trim()),'OFFLINE_CHECK_BLOCKED');
  assert(/^[A-Za-z0-9_.-]+\.json$/.test(x.evidence_ref));c.hash(x.sha256);
  const f=path.join(request.evidence_root,x.evidence_ref);c.noLinks(f);assert.equal(c.sha(fs.readFileSync(f)),x.sha256,'OFFLINE_EVIDENCE_DRIFT');
 }
 assert.equal(q.material_digest,c.digest(request.material),'OFFLINE_MATERIAL_BINDING_CHANGED');
 const checked=material.verify(request.material,root,environment);
 return Object.freeze({head:q.subject_sha,main:q.subject_sha,clean:true,base_ancestor:true,frozen_runtime_identical:true,
  host_id:host,now:new Date(now).toISOString(),platform:process.platform,ci:Boolean(environment.CI||environment.GITHUB_ACTIONS),
  source:'SIGNED_ADOPTION_NOT_LIVE_REMOTE_MAIN',adoption_digest:c.digest(envelope),material_digest:checked.digest,qualification_expires_at:q.expires_at});
}
function load(file,root){const policy=c.read(POLICY);assert.equal(policy.adopted,true,'OFFLINE_ADOPTION_NOT_ADOPTED');return verify(c.read(file),policy,root);}
function bindObserved(context,bundle){
 c.exact(bundle.observed.adoption_binding,['qualification_digest','material_digest']);
 assert.equal(bundle.observed.adoption_binding.qualification_digest,context.adoption_digest,'OFFLINE_PERMIT_PROOF_MISMATCH');
 assert.equal(bundle.observed.adoption_binding.material_digest,context.material_digest,'OFFLINE_PERMIT_MATERIAL_MISMATCH');
 assert(c.epoch(bundle.permit.payload.expires_at)<=c.epoch(context.qualification_expires_at),'PERMIT_OUTLIVES_ADOPTION');
}
module.exports={DOMAIN,POLICY,verify,load,bindObserved};
