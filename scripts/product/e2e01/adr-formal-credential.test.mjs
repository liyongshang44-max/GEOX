import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,sign} from 'node:crypto';
import {formalMode,createFormalPrivateCredentialBinding} from './adr-formal-credential.mjs';
const ids={'geox-adr-e2e01-a01-local-v1':'7d227ff8-f193-44ca-b56e-20fec0988f7f','geox-adr-e2e01-a07-local-v1':'857c0705-3019-4628-b4f8-aba6bcfe8d23'};
const issuer='https://auth.fdw.localhost:18443/realms/fdw-local',at=Date.parse('2026-11-28T12:00:00Z');
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk={...publicKey.export({format:'jwk'}),kid:'fixture',alg:'RS256',use:'sig'};
const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function world(){
 let now=at,active=true,revoked=false,wrongSubject=false,wrongClient=false,badSig=false;const calls=[];
 const permit={status:'ACTIVE',decision:'AUTHORIZE_E2E01_FORMAL_LOCAL_RUN',approval_ref:'sha256:'+'a'.repeat(64),checkpoint_sha256:'sha256:9a89440e8d044223232dc72faca88d03ce95418881ee2c0f46a8fce44dd91b54',valid_until:new Date(at+600000).toISOString(),manager_execution_authorized:true,pilot_authorized:true,service_clients_enabled_authorized:true,viewer_jurisdiction:'CN'};
 const runtime={ready:true,metadata:{mode:formalMode,runAdmissionRef:permit.approval_ref},tokenBindings:new Map(),tokenOperationPolicies:new Map()};
 const requestJson=async(endpoint,form)=>{
  calls.push(endpoint);
  if(endpoint==='certs')return {keys:[jwk]};
  if(endpoint==='token'){
   assert.ok(Object.hasOwn(ids,form.client_id));assert.equal(form.grant_type,'client_credentials');
   const h=b({alg:'RS256',kid:'fixture'}),p=b({iss:issuer,sub:wrongSubject?'other':ids[form.client_id],azp:wrongClient?'other':form.client_id,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+120}),sig=sign('RSA-SHA256',Buffer.from(h+'.'+p),privateKey).toString('base64url');
   return {token_type:'Bearer',expires_in:120,access_token:h+'.'+p+'.'+(badSig?'AAAA':sig)};
  }
  assert.equal(endpoint,'token/introspect');const t=JSON.parse(Buffer.from(form.token.split('.')[1],'base64url'));
  return {active,sub:t.sub,client_id:t.azp,iss:t.iss,exp:t.exp};
 };
 const cfg={runtime,expectedPermit:permit,readRunAdmission:async()=>revoked?null:permit,clientSecrets:{A01:'TEST_ONLY_A01_secret_abcdefghijkl',A07:'TEST_ONLY_A07_secret_abcdefghijkl'},clock:()=>now,requestJson};
 return {cfg,permit,runtime,calls,setNow:x=>now=x,setActive:x=>active=x,setRevoked:x=>revoked=x,setWrongSubject:x=>wrongSubject=x,setWrongClient:x=>wrongClient=x,setBadSig:x=>badSig=x};
}
test('formal gate refuses conditional or missing execution approval before network',async()=>{for(const changed of [{decision:'AUTHORIZE_BOUNDED_DISPLAY_ADMISSION'},{manager_execution_authorized:false},{pilot_authorized:false},{service_clients_enabled_authorized:false},{viewer_jurisdiction:'NL'}]){const w=world();await assert.rejects(createFormalPrivateCredentialBinding({...w.cfg,expectedPermit:{...w.permit,...changed}}));assert.equal(w.calls.length,0);}const w=world();w.setRevoked(true);await assert.rejects(createFormalPrivateCredentialBinding(w.cfg));assert.equal(w.calls.length,0);});
test('both actual expected subject contracts verified against signed fixture tokens; private grants separate',async()=>{const w=world();const p=await createFormalPrivateCredentialBinding(w.cfg);try{assert.equal(w.runtime.tokenBindings.size,0);const a=await p.getCredential('A01'),b=await p.getCredential('A07');assert.ok(a&&b&&a!==b);assert.equal(w.runtime.tokenBindings.get(a).principalId,ids['geox-adr-e2e01-a01-local-v1']);assert.equal(w.runtime.tokenBindings.get(b).principalId,ids['geox-adr-e2e01-a07-local-v1']);assert.deepEqual([...w.runtime.tokenOperationPolicies.values()],[['createDecisionProblem'],['executeKnowledgeRetrieval','resolveCustomerEvidence']]);assert.equal(await p.getCredential('A08'),null);assert.equal(w.runtime.tokenBindings.size,0);}finally{p.close();}});
test('wrong subject, wrong authorized party, invalid signature and inactive service deny',async()=>{for(const mutation of ['setWrongSubject','setWrongClient','setBadSig','setActive']){const w=world();w[mutation](mutation!=='setActive');await assert.rejects(createFormalPrivateCredentialBinding(w.cfg));assert.equal(w.runtime.tokenBindings.size,0);assert.equal(w.runtime.tokenOperationPolicies.size,0);}});
test('live revocation and service inactivity close all host bindings; expiry fails closed',async()=>{for(const kind of ['revoked','inactive','expired']){const w=world();const p=await createFormalPrivateCredentialBinding(w.cfg);try{assert.ok(await p.getCredential('A07'));if(kind==='revoked')w.setRevoked(true);else if(kind==='inactive')w.setActive(false);else w.setNow(at+600000);assert.equal(await p.getCredential('A07'),null);assert.equal(w.runtime.tokenBindings.size,0);assert.equal(w.runtime.tokenOperationPolicies.size,0);}finally{p.close();}}});
