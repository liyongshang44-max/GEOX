'use strict';
// Explicit offline signing command. Never imported by local admission or launcher.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const c = require('./contract.cjs');
function sign(kind, payload, privateKey, policy, now = Date.now()) {
  c.validatePolicy(policy, now);
  const key = crypto.createPrivateKey(privateKey); assert.equal(key.asymmetricKeyType, 'ed25519');
  const envelope = {payload, signature_base64:crypto.sign(null, Buffer.from(c.DOMAINS[kind] + c.canonical(payload)), key).toString('base64')};
  c.verifyEnvelope(envelope, kind, policy, now); return envelope;
}
function qualification(report, materials, evidence, key, policy, now = Date.now()) {
  const {validateQualificationPayload,validateQualification} = require('./verifier.cjs');
  c.validatePolicy(policy, now); c.validateChecks(report.check_manifest, policy, evidence);
  validateQualificationPayload(report, policy, materials, now);
  const envelope = sign('qualification', report, key, policy, now);
  validateQualification(envelope, policy, materials, now); return envelope;
}
function permit(payload, qualificationEnvelope, materials, evidence, context, key, policy, now = Date.now()) {
  const v = require('./verifier.cjs');
  v.validateQualification(qualificationEnvelope, policy, materials, now);
  const envelope = sign('permit', payload, key, policy, now);
  v.admit({qualification:qualificationEnvelope, permit:envelope, policy, materials, evidence, context, now}); return envelope;
}

const ROOT=path.resolve(__dirname,'../..');
function outsideRepo(file){const rel=path.relative(ROOT,path.resolve(file));return rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel);}
function formalAdoption(candidateFile,materialFile,releaseRoot,keyFile,ttlMinutes,outputFile,now=Date.now()){
 const offline=require('./offline-context.cjs'),policy=c.read(offline.POLICY),candidate=c.read(candidateFile),material=c.read(materialFile),evidenceRoot=path.dirname(path.resolve(candidateFile));
 releaseRoot=fs.realpathSync(path.resolve(releaseRoot));outputFile=path.resolve(outputFile);c.noLinks(keyFile);c.noLinks(releaseRoot);assert(outsideRepo(keyFile),'ADOPTION_PRIVATE_KEY_MUST_BE_OUTSIDE_REPOSITORY');
 const coreFields=['schema','subject_sha','scope','checks','frozen_paths','first_parent_proven','qcp_proof_ref','qcp_proof_sha256','qcp_artifact_sha256','engineering_check_id','release_binding_ref','release_binding_sha256','installed_material_required','signature_required','execution_authorized','production_authorized'];
 const merged=candidate.qualification_method==='ZERO_DELTA_MERGE_DERIVATION';
 c.exact(candidate,merged?[...coreFields,...offline.MERGED_FIELDS]:coreFields);
 const proofFile=path.resolve(evidenceRoot,candidate.qcp_proof_ref);c.noLinks(proofFile);
 assert.equal(c.sha(fs.readFileSync(proofFile)),candidate.qcp_proof_sha256,'ADOPTION_QCP_PROOF_DRIFT');
 offline.validateMergedDerivation(candidate.subject_sha,c.read(proofFile),candidate.checks,evidenceRoot,candidate);
 assert.equal(candidate.schema,'MCFT_CAP09_ADOPTION_CANDIDATE_V1');assert.equal(candidate.scope,'TEST_ONLY');assert(/^[a-f0-9]{40}$/.test(candidate.subject_sha));assert.equal(candidate.checks.length,54);assert.equal(new Set(candidate.checks.map(x=>x.check_id)).size,54);assert.equal(candidate.frozen_paths,108);assert.equal(candidate.first_parent_proven,true);assert.equal(candidate.installed_material_required,true);assert.equal(candidate.signature_required,true);assert.equal(candidate.execution_authorized,false);assert.equal(candidate.production_authorized,false);
 const releasePath=path.resolve(evidenceRoot,candidate.release_binding_ref);c.noLinks(releasePath);assert.equal(c.sha(fs.readFileSync(releasePath)),candidate.release_binding_sha256,'ADOPTION_RELEASE_BINDING_DRIFT');const release=c.read(releasePath);assert.equal(release.schema_version,'MCFT_CAP09_RELEASE_MATERIAL_BINDING_V1');assert.equal(release.subject_commit_sha,candidate.subject_sha);assert.equal(material.schema,'CAP09_INSTALLED_MATERIAL_V1');assert.equal(fs.realpathSync(material.root),releaseRoot,'ADOPTION_MATERIAL_ROOT_MISMATCH');
 const ttl=Number(ttlMinutes);assert(Number.isSafeInteger(ttl)&&ttl>=1&&ttl<=1440,'ADOPTION_TTL_INVALID');const privateKey=crypto.createPrivateKey(fs.readFileSync(keyFile));assert.equal(privateKey.asymmetricKeyType,'ed25519');const publicKey=crypto.createPublicKey(privateKey);
 const fingerprint=c.sha(publicKey.export({type:'spki',format:'der'}));
 const registered=policy.issuers.filter(x=>x.purpose==='ADOPTION'&&x.spki_sha256===fingerprint&&x.revoked===false);
 assert.equal(registered.length,1,'ADOPTION_PRIVATE_KEY_NOT_REGISTERED');const issuer=registered[0];
 assert.equal(publicKey.export({type:'spki',format:'pem'}),issuer.public_key_pem,'ADOPTION_PUBLIC_KEY_MISMATCH');
 offline.assertFormalIssuer(issuer,policy,{subject_sha:candidate.subject_sha,material_digest:c.digest(material),host_id:policy.host_id,operator_id:policy.operator_id,scope:candidate.scope});
 const issued=new Date(now).toISOString(),expires=new Date(now+ttl*60000).toISOString();assert(c.epoch(issuer.not_before)<=now&&Date.parse(expires)<=c.epoch(issuer.not_after),'ADOPTION_KEY_LIFETIME_TOO_SHORT');assert(Date.parse(expires)<=c.epoch(policy.valid_until),'ADOPTION_POLICY_LIFETIME_TOO_SHORT');
 const q={qualification_id:'mcft_cap09_adoption_'+candidate.subject_sha.slice(0,12)+'_v1',schema:'MCFT_CAP09_ADOPTION_QUALIFICATION_V1',subject_sha:candidate.subject_sha,scope:'TEST_ONLY',issued_at:issued,expires_at:expires,issuer_id:issuer.issuer_id,key_id:issuer.key_id,policy_digest:c.digest(policy),material_digest:c.digest(material),checks:candidate.checks,frozen_paths:108,first_parent_proven:true,host_id:policy.host_id,operator_id:policy.operator_id,qcp_proof_ref:candidate.qcp_proof_ref,qcp_proof_sha256:candidate.qcp_proof_sha256,release_binding_ref:candidate.release_binding_ref,release_binding_sha256:candidate.release_binding_sha256};
 const envelope={payload:q,signature_base64:crypto.sign(null,Buffer.from(offline.ADOPTION_DOMAIN+c.canonical(q)),privateKey).toString('base64')};const request={qualification:envelope,material,evidence_root:evidenceRoot};const verified=offline.verifyFormal(request,policy,releaseRoot,{now,host:os.hostname(),environment:process.env});
 assert.equal(offline.isFormalVerified(verified),true);assert.equal(verified.execution_authorized,true);assert.equal(verified.production_authorized,false);c.writeOnce(outputFile,request);
 return {status:'SIGNED_ADOPTION_QUALIFICATION_V1_ISSUED_TEST_ONLY',qualification_id:q.qualification_id,subject_sha:q.subject_sha,issuer_id:q.issuer_id,key_id:q.key_id,expires_at:q.expires_at,adoption_digest:verified.adoption_digest,material_digest:verified.material_digest,output:path.resolve(outputFile),execution_authorized:true,production_authorized:false};
}
function provisionAdoptionKey(issuerId,keyId,notBefore,notAfter,privateOut,registrationOut){
 const offline=require('./offline-context.cjs'),policy=c.read(offline.POLICY);c.id(issuerId);c.id(keyId);assert.notEqual(issuerId,policy.operator_id,'INDEPENDENT_SIGNER_MUST_DIFFER_FROM_OPERATOR');assert(c.epoch(notBefore)<c.epoch(notAfter),'SIGNER_KEY_WINDOW_INVALID');
 privateOut=path.resolve(privateOut);registrationOut=path.resolve(registrationOut);assert(outsideRepo(privateOut)&&outsideRepo(registrationOut),'SIGNER_OUTPUT_MUST_BE_OUTSIDE_REPOSITORY');const pair=crypto.generateKeyPairSync('ed25519'),privatePem=pair.privateKey.export({type:'pkcs8',format:'pem'}),publicPem=pair.publicKey.export({type:'spki',format:'pem'}),spki=pair.publicKey.export({type:'spki',format:'der'});
 const registration={issuer_id:issuerId,key_id:keyId,purpose:'ADOPTION',role:'INDEPENDENT_GOVERNANCE',revoked:false,not_before:notBefore,not_after:notAfter,public_key_pem:publicPem,spki_sha256:c.sha(spki)};
 c.noLinks(path.dirname(privateOut));fs.mkdirSync(path.dirname(privateOut),{recursive:true});fs.writeFileSync(privateOut,privatePem,{flag:'wx',mode:0o600});c.writeOnce(registrationOut,registration);
 return {status:'INDEPENDENT_ADOPTION_SIGNER_PROVISIONED_OFFLINE',issuer_id:issuerId,key_id:keyId,spki_sha256:registration.spki_sha256,private_key_file:privateOut,registration_file:registrationOut,repository_modified:false};
}
if(require.main===module){try{const args=process.argv.slice(2),kind=args[0];
 if(['qualification','permit'].includes(kind)){assert(args.length===5,'USAGE: signer kind request policy private-key output');const r=c.read(args[1]),policy=c.read(args[2]);c.noLinks(args[3]);const key=fs.readFileSync(args[3],'utf8');const result=kind==='qualification'?qualification(r.report,r.materials,r.evidence,key,policy):permit(r.payload,r.qualification,r.materials,r.evidence,r.context,key,policy);c.writeOnce(args[4],result);console.log(JSON.stringify({status:'SYNTHETIC_ARTIFACT_SIGNED',execution_authorized:false,production_authorized:false}));}
 else if(kind==='formal-adoption'){assert(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'FORMAL_ADOPTION_WINDOWS_OFFLINE_ONLY');assert(args.length===7,'USAGE: formal-adoption candidate material release-root private-key ttl-minutes output');console.log(JSON.stringify(formalAdoption(args[1],args[2],args[3],args[4],args[5],args[6])));}
 else if(kind==='provision-adoption-key'){assert(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'SIGNER_PROVISION_WINDOWS_OFFLINE_ONLY');assert(args.length===7,'USAGE: provision-adoption-key issuer key-id not-before not-after private-key registration');console.log(JSON.stringify(provisionAdoptionKey(args[1],args[2],args[3],args[4],args[5],args[6])));}
 else throw new Error('SIGNER_MODE_REQUIRED');
}catch{console.error(JSON.stringify({status:'ADOPTION_INCOMPLETE',reason_code:'SIGNING_REJECTED',execution_authorized:false,production_authorized:false}));process.exitCode=1;}}
module.exports={qualification,permit,formalAdoption,provisionAdoptionKey,outsideRepo};
