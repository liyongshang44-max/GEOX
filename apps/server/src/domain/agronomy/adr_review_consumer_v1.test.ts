import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import type {Pool} from 'pg';
import {registerProductModule} from '../../modules/product/registerProductModule.js';
import {registerManagerPilotModuleV1} from '../../modules/product/registerManagerPilotModuleV1.js';
import {createManagerAuthorizerV1,type ManagerAuthorityV1} from '../../auth/manager_authority_v1.js';
import {createAdrReviewConsumerV1,type AdrReviewBindingV1} from './adr_review_consumer_v1.js';
const tenant={issuer:'directory',id:'tenant-ref',version:'1'},membership={issuer:'directory',id:'member',version:'1'};
function setup(){
 const active=new WeakSet<object>();
 const cfg:Parameters<typeof createManagerAuthorizerV1>[0]={
  issuer:'https://id.invalid/realm',canonicalTenantRef:tenant,
  identity:{kind:'FORMAL_PROVIDER_NEUTRAL_IDENTITY',async verify(token){if(token!=='fixture-manager')throw Error('DENIED');const c={};active.add(c);return c;},
   authorize(c){if(!active.has(c as object))throw Error('DENIED');return {issuer:'https://id.invalid/realm',subject:'manager',principal_kind:'HUMAN',canonical_tenant_ref:tenant,membership_ref:membership,membership_status:'ACTIVE',mapping_version:'1',credential_ref:'a'.repeat(64),valid_until:new Date(Date.now()+50000).toISOString()};},
   authorizeResource(){return {};},invalidate(c){active.delete(c as object);}},
  async resolveLandGrant({assertion,field_id,action}){if(field_id!=='field-1'||action!=='REQUEST_CROP_REVIEW')return null;return {status:'ACTIVE',issuer:assertion.issuer,subject:assertion.subject,canonical_tenant_ref:tenant,membership_ref:membership,mapping_version:'1',source_ref:membership,actor_id:'actor',tenant_id:'tenant',project_id:'project',group_id:'group',field_id,action,checked_at:new Date().toISOString(),valid_until:new Date(Date.now()+40000).toISOString()};}
 };
 return {cfg,authority:createManagerAuthorizerV1(cfg)};
}
function binding(a:ManagerAuthorityV1,request_sha256:string):AdrReviewBindingV1{
 return {request_sha256,authority_scope:{actor_id:a.actor_id,tenant_id:a.tenant_id,project_id:a.project_id,group_id:a.group_id,field_id:a.field_id!,mapping_version:a.mapping_version,credential_ref:a.credential_ref},principal:{principal_id:'adr-service',type:'SERVICE_ACCOUNT',organization_id:'org',tenant_id:'adr-tenant',program_ids:['program']},authorization_ref:{kind:'AuthorizationDecisionAudit',logical_id:'auth-1',version:'1',semantic_hash:'sha256:'+'b'.repeat(64)},credential_ref:'secret-ref',valid_until_ms:a.valid_until_ms};
}
const input={logical_id:'problem-1',version:'1',resource:{contract_version:'adr.decision-problem.v1'},idempotency_key:'same-key'};
test('default Product module does not expose manager writes; explicit composition requires original authorization',async()=>{
 const {cfg}=setup();const app=Fastify(),opt=Fastify(),pool={} as Pool;
 try{
  registerProductModule(app,pool);registerManagerPilotModuleV1(opt,pool,cfg);await app.ready();await opt.ready();
  assert.equal(app.hasRoute({method:'POST',url:'/api/v1/manager/fields'}),false);
  assert.equal(opt.hasRoute({method:'POST',url:'/api/v1/manager/fields'}),true);
  assert.equal((await opt.inject({method:'POST',url:'/api/v1/manager/fields',payload:{}})).statusCode,401);
  assert.equal((await opt.inject({method:'POST',url:'/api/v1/manager/fields',headers:{authorization:'Bearer fixture-manager'},payload:{}})).statusCode,403);
 }finally{await app.close();await opt.close();}
});
test('fixed native wire route, exact binding and receipt',async()=>{
 const {authority}=setup();const manager=await authority.authorize('fixture-manager','field-1','REQUEST_CROP_REVIEW');
 let calls=0;
 const c=createAdrReviewConsumerV1({baseUrl:'https://adr.invalid/',authority,resolveBinding:async x=>binding(manager,x.request_sha256),getCredential:async r=>{assert.equal(r,'secret-ref');return 'fixture-adr';},transport:async (url,init)=>{
  calls++;assert.equal(String(url),'https://adr.invalid/v1/decision-problems');assert.equal(init?.redirect,'error');
  const h=init?.headers as Record<string,string>;assert.equal(h.Authorization,'Bearer fixture-adr');assert.equal(h['Idempotency-Key'],'same-key');
  const body=JSON.parse(String(init?.body));assert.equal(body.principal.principal_id,'adr-service');assert.equal(body.authorization_decision_ref.logical_id,'auth-1');
  return new Response(JSON.stringify({ref:{kind:'DecisionProblem',logical_id:'problem-1',version:'1',semantic_hash:'sha256:'+'c'.repeat(64)},resource:input.resource}),{status:201});
 }});
 const result=await c.write(manager,'createDecisionProblem',input);assert.equal(result.ref.logical_id,'problem-1');assert.match(result.request_sha256,/^[a-f0-9]{64}$/);assert.match(result.wire_body_sha256,/^[a-f0-9]{64}$/);assert.equal(result.idempotency_key,'same-key');assert.equal(calls,1);
 await assert.rejects(c.write({...manager},'createDecisionProblem',input),/MANAGER_AUTHORITY_DENIED/);assert.equal(calls,1);
 await assert.rejects(c.write(manager,'createDecisionProblem',{...input,resource:{contract_version:'wrong'}}),/ADR_REQUEST_CONTRACT_INVALID/);assert.equal(calls,1);
 await assert.rejects(c.write(manager,'createDecisionProblem',{...input,resource:{...input.resource,invalid:Infinity}}),/ADR_REQUEST_JSON_INVALID/);assert.equal(calls,1);
});
test('absent, expired, wrong-field or wrong-request binding cannot transmit',async()=>{
 const {authority}=setup();const manager=await authority.authorize('fixture-manager','field-1','REQUEST_CROP_REVIEW');
 for(const mode of ['missing','expired','field','request']){
  const c=createAdrReviewConsumerV1({baseUrl:'https://adr.invalid/',authority,resolveBinding:async x=>{
   const b=binding(manager,x.request_sha256);
   if(mode==='missing')return null;if(mode==='expired')b.valid_until_ms=0;if(mode==='field')b.authority_scope.field_id='other';if(mode==='request')b.request_sha256='wrong';return b;
  },getCredential:async()=>{assert.fail('credential accessed');},transport:async()=>{assert.fail('transmitted');}});
  await assert.rejects(c.write(manager,'createDecisionProblem',input),/ADR_AUTHORITY_BINDING/);
 }
});
test('unknown outcome is not retried or represented as a result',async()=>{
 const {authority}=setup();const manager=await authority.authorize('fixture-manager','field-1','REQUEST_CROP_REVIEW');
 for(const response of [new Response('{}',{status:201}),new Response('{}',{status:503}),null]){
  let calls=0;const c=createAdrReviewConsumerV1({baseUrl:'https://adr.invalid/',authority,resolveBinding:async x=>binding(manager,x.request_sha256),getCredential:async()=> 'fixture-adr',transport:async()=>{calls++;if(!response)throw Error('network');return response;}});
  await assert.rejects(c.write(manager,'createDecisionProblem',input),/ADR_WRITE_OUTCOME_UNKNOWN/);assert.equal(calls,1);
 }
 assert.throws(()=>createAdrReviewConsumerV1({baseUrl:'http://adr.invalid/',authority,resolveBinding:async()=>null,getCredential:async()=>''}),/ADR_HTTPS_ORIGIN_REQUIRED/);
});
