// Formal local credential candidate. Not an activation tool or public issuer.
import {request as httpsRequest} from 'node:https';
import {createPublicKey,verify,randomBytes,X509Certificate} from 'node:crypto';
import {canonical} from './adr-private-admission.mjs';
export const formalMode='GEOX_E2E01_FORMAL_LOCAL_PILOT';
const issuer='https://auth.fdw.localhost:18443/realms/fdw-local';
const realm='/realms/fdw-local/protocol/openid-connect/';
const checkpoint='sha256:9a89440e8d044223232dc72faca88d03ce95418881ee2c0f46a8fce44dd91b54';
const rightsEnd=Date.parse('2026-12-05T10:44:58.383Z');
const fixed=Object.freeze({
 A01:Object.freeze({clientId:'geox-adr-e2e01-a01-local-v1',subject:'7d227ff8-f193-44ca-b56e-20fec0988f7f',operations:Object.freeze(['createDecisionProblem'])}),
 A07:Object.freeze({clientId:'geox-adr-e2e01-a07-local-v1',subject:'857c0705-3019-4628-b4f8-aba6bcfe8d23',operations:Object.freeze(['executeKnowledgeRetrieval','resolveCustomerEvidence'])})
});
const principal=x=>({principalId:x.subject,type:'SERVICE_ACCOUNT',organizationId:'org_geox',tenantId:'tenant_geox_e2e01',programIds:['program_geox_e2e01']});
const principalKey=x=>JSON.stringify(principal(x));
const need=x=>{if(!x)throw Error('E2E01_FORMAL_CREDENTIAL_DENIED');};
const hash=x=>typeof x==='string'&&/^sha256:[a-f0-9]{64}$/.test(x);
const same=(a,b)=>canonical(a)===canonical(b);
const safeSecret=x=>typeof x==='string'&&x.length>=16&&x.length<=512&&!/[\x00-\x20\x7f]/.test(x);
const sameKeys=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&same(Object.keys(x).sort(),[...keys].sort());
export function createLocalKeycloakServiceTransport(ca){
 // Use the already accepted local FDW trust anchor, not system TLS bypass.
 const cert=new X509Certificate(ca);
 need(cert.fingerprint.replaceAll(':','')==='9DDB1DE78D7FFE64A78C8FF70AD48696F8569400');
 return (endpoint,form)=>new Promise((ok,bad)=>{
  try{
   need(['certs','token','token/introspect'].includes(endpoint)&&(endpoint==='certs'?form===undefined:!!form));
   const body=form?Buffer.from(new URLSearchParams(form).toString()):null;
   const req=httpsRequest({hostname:'127.0.0.1',port:18443,servername:'auth.fdw.localhost',path:realm+endpoint,method:body?'POST':'GET',ca,rejectUnauthorized:true,timeout:5000,headers:{host:'auth.fdw.localhost:18443',accept:'application/json',...(body?{'content-type':'application/x-www-form-urlencoded','content-length':body.length}:{})}},res=>{
    let n=0;const chunks=[];
    res.on('data',v=>{n+=v.length;if(n>262144)req.destroy();else chunks.push(v);});
    res.on('end',()=>{try{need(res.statusCode===200&&n<=262144);ok(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{bad(Error('E2E01_KEYCLOAK_SERVICE_RESPONSE_DENIED'));}});
    res.on('error',()=>bad(Error('E2E01_KEYCLOAK_SERVICE_RESPONSE_FAILED')));
   });
   req.on('timeout',()=>req.destroy());req.on('error',()=>bad(Error('E2E01_KEYCLOAK_SERVICE_TRANSPORT_FAILED')));req.end(body??undefined);
  }catch{bad(Error('E2E01_KEYCLOAK_SERVICE_TRANSPORT_DENIED'));}
 });
}
function jwtProof(token,jwks,client,now){
 need(typeof token==='string'&&token.length<=32768&&token.split('.').length===3);
 const [h,p,s]=token.split('.'),header=JSON.parse(Buffer.from(h,'base64url')),claims=JSON.parse(Buffer.from(p,'base64url'));
 need(header.alg==='RS256'&&typeof header.kid==='string'&&Array.isArray(jwks?.keys));
 const keys=jwks.keys.filter(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
 need(keys.length===1&&verify('RSA-SHA256',Buffer.from(h+'.'+p),createPublicKey({key:keys[0],format:'jwk'}),Buffer.from(s,'base64url')));
 need(claims.iss===issuer&&claims.sub===client.subject&&claims.azp===client.clientId&&Number.isInteger(claims.exp)&&Number.isInteger(claims.iat)&&claims.exp*1000>now&&claims.iat*1000<=now+10000&&claims.iat*1000>=now-60000&&(!claims.nbf||claims.nbf*1000<=now));
 return claims.exp*1000;
}
// Only explicit trusted composition can call this. The permit must have been
// verified by an independent local run-admission loader; it is NOT the
// conditional display preparation approval. Client secrets are provided by
// the authorized local operator after activation, never read from environment.
export async function createFormalPrivateCredentialBinding({runtime,expectedPermit,readRunAdmission,clientSecrets,ca,clock=Date.now,requestJson}){
 const permit=structuredClone(expectedPermit);
 need(runtime?.ready===true&&runtime.metadata?.mode===formalMode&&runtime.metadata.runAdmissionRef===permit?.approval_ref&&runtime.tokenBindings instanceof Map&&runtime.tokenBindings.size===0&&runtime.tokenOperationPolicies instanceof Map&&runtime.tokenOperationPolicies.size===0);
 need(sameKeys(permit,['status','decision','approval_ref','checkpoint_sha256','valid_until','manager_execution_authorized','pilot_authorized','service_clients_enabled_authorized','viewer_jurisdiction'])&&permit.status==='ACTIVE'&&permit.decision==='AUTHORIZE_E2E01_FORMAL_LOCAL_RUN'&&hash(permit.approval_ref)&&permit.checkpoint_sha256===checkpoint&&permit.manager_execution_authorized===true&&permit.pilot_authorized===true&&permit.service_clients_enabled_authorized===true&&permit.viewer_jurisdiction==='CN');
 const end=Date.parse(permit.valid_until);
 need(Number.isFinite(end)&&end>clock()&&end<=rightsEnd&&end<=clock()+3600000&&typeof readRunAdmission==='function');
 need(sameKeys(clientSecrets,['A01','A07'])&&safeSecret(clientSecrets.A01)&&safeSecret(clientSecrets.A07)&&clientSecrets.A01!==clientSecrets.A07);
 const transport=requestJson??createLocalKeycloakServiceTransport(ca);
 const secrets=new Map(Object.entries(clientSecrets)),access=new Map(),issued=new Map(),timers=new Map(),tokens=runtime.tokenBindings,policies=runtime.tokenOperationPolicies;
 let closed=false,expiryTimer;
 const remove=ref=>{const token=issued.get(ref);if(token)tokens.delete(token);issued.delete(ref);clearTimeout(timers.get(ref));timers.delete(ref);};
 const close=()=>{closed=true;for(const ref of Object.keys(fixed)){remove(ref);policies.delete(principalKey(fixed[ref]));}access.clear();secrets.clear();clearTimeout(expiryTimer);};
 async function current(){need(!closed&&runtime.ready&&!runtime.persistenceFault&&clock()<end&&same(await readRunAdmission(),permit)&&!closed&&clock()<end);}
 async function inspect(ref,token,exp){
  const x=fixed[ref],now=clock();
  const live=await transport('token/introspect',{client_id:x.clientId,client_secret:secrets.get(ref),token,token_type_hint:'access_token'});
  // Introspection identifies the same client and actual subject. No substitution
  // of a manager token, historical compiler or another service principal.
  need(live?.active===true&&live.sub===x.subject&&(live.client_id??live.azp)===x.clientId&&(!live.iss||live.iss===issuer)&&Number.isInteger(live.exp)&&live.exp*1000>now&&live.exp*1000<=exp);
  return Math.min(exp,live.exp*1000);
 }
 async function authenticate(ref){
  await current();const x=fixed[ref],r=await transport('token',{grant_type:'client_credentials',client_id:x.clientId,client_secret:secrets.get(ref)});
  need(typeof r?.token_type==='string'&&r.token_type.toLowerCase()==='bearer'&&Number.isFinite(r.expires_in)&&r.expires_in>0);
  const t=r.access_token,jwks=await transport('certs'),exp=Math.min(jwtProof(t,jwks,x,clock()),clock()+r.expires_in*1000);
  const valid=await inspect(ref,t,exp+1000);await current();need(valid>clock());
  access.set(ref,{token:t,exp:Math.min(exp,valid)});
 }
 try{
  await current();
  // Successful Keycloak client_credentials + verified exact subject on BOTH
  // clients is required before any native Host bearer is installed.
  await authenticate('A01');await authenticate('A07');await current();
  for(const x of Object.values(fixed))policies.set(principalKey(x),[...x.operations]);
  expiryTimer=setTimeout(close,Math.max(1,end-clock()));expiryTimer.unref?.();
  return Object.freeze({
   async getCredential(ref){
    try{
     need(Object.hasOwn(fixed,ref));await current();let a=access.get(ref);
     if(!a||a.exp-clock()<15000){await authenticate(ref);a=access.get(ref);}
     const valid=await inspect(ref,a.token,a.exp+1000);await current();
     const until=Math.min(valid,a.exp,end,clock()+15000);need(until>clock());
     remove(ref);const token=randomBytes(32).toString('base64url');tokens.set(token,principal(fixed[ref]));issued.set(ref,token);
     const timer=setTimeout(()=>{if(issued.get(ref)===token)remove(ref);},Math.max(1,until-clock()));timer.unref?.();timers.set(ref,timer);return token;
    }catch{close();return null;}
   },
   close
  });
 }catch{close();throw Error('E2E01_FORMAL_CREDENTIAL_ADMISSION_FAILED');}
}
