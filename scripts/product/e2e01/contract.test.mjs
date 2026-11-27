import test from 'node:test';
import assert from 'node:assert/strict';
import {directory,field,scope,issuer,tenant,membership,managerRoute,createBodyAllowed,fieldActions} from './contract.mjs';
const subject='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', a={issuer,subject,principal_kind:'HUMAN',membership_status:'ACTIVE',mapping_version:'fdw-local-mapping-v1',canonical_tenant_ref:tenant,membership_ref:membership};
const p={schema:'geox.local-owner-land-grants.e2e01.v1',decision:'AUTHORIZE_BOUNDED_MANAGER_INTEGRATION',subject,revision:1,phase:'PREWRITE',create_status:'REVOKED',field_grants:[]};
test('exact path and method; no action or scope escape',()=>{
 assert(managerRoute('POST','/api/v1/manager/fields'));assert(managerRoute('PUT','/api/v1/manager/fields/'+field));
 for(const path of ['/api/v1/fields','/api/v1/manager/fields/other','/api/v1/manager/fields?tenant_id=x','/api/v1/manager/fields/'+field+'/historical-forecast','/api/v1/ao-act/tasks'])assert(!managerRoute('POST',path));
 assert(createBodyAllowed({field_id:field,name:'x'}));assert(!createBodyAllowed({field_id:'other',name:'x'}));assert(!createBodyAllowed({field_id:field,tenant_id:'other',name:'x'}));
});
test('explicit local owner grants independent of creation; revocation and cross tenant',async()=>{
 let policy=structuredClone(p),exists=false;
 const d=directory(()=>policy,subject,async()=>exists);
 const get=(assertion,field_id,action)=>d.resolveLandGrant({assertion,field_id,action});
 assert.equal(await get(a,null,'CREATE_FIELD'),null);
 assert.deepEqual((await d.resolveLandInventory({assertion:a})).grants,[]);
 policy={...policy,phase:'PREWRITE',create_status:'ACTIVE',revision:2};
 const g=await get(a,null,'CREATE_FIELD');assert.equal(g.tenant_id,scope.tenant_id);
 assert.equal(await get({...a,canonical_tenant_ref:{...tenant,id:'other'}},null,'CREATE_FIELD'),null);
 assert.equal(await get({...a,subject:'other'},null,'CREATE_FIELD'),null);
 policy={...policy,create_status:'REVOKED',revision:3};assert.equal(await get(a,null,'CREATE_FIELD'),null);
 policy={...policy,phase:'CREATE',create_status:'ACTIVE',revision:4};
 exists=true;assert.equal(await get(a,field,'READ_FIELD_GEOMETRY'),null);
 policy={...policy,phase:'FIELD',create_status:'REVOKED',field_grants:[...fieldActions],revision:3};
 assert.equal(await get(a,null,'CREATE_FIELD'),null);assert.equal((await get(a,field,'UPDATE_FIELD')).field_id,field);
 assert.equal(await get(a,'other','UPDATE_FIELD'),null);
 policy={...policy,field_grants:[],revision:4};assert.equal(await get(a,field,'UPDATE_FIELD'),null);
});

import {deriveGateway} from './gateway-derive.mjs';
test('gateway derivation preserves literal replacement bytes and imports actual route contract',()=>{
 const source=[
 "const fdwService='http://127.0.0.1:14174';",
 "const url=new URL(req.url,gatewayBase),path=url.pathname,method=req.method;",
 "location:'/auth/complete'",
 "!safeForward(path,method)",
 "['POST','PATCH'].includes(method)",
 "['POST','PATCH'].includes(method)",
 "const headers={authorization:'Bearer '+item.session.token,'x-fdw-tenant-ref':JSON.stringify({issuer,id:'fdw-local-tenant-a',version:'1'})};",
 "fetch(fdwService+path+url.search,"
 ].join('\n');
 const result=deriveGateway(source,{'/manager':"C:/test/$'/$&/index.html"},'file:///C:/test/contract.mjs');
 assert(result.includes(JSON.stringify({'/manager':"C:/test/$'/$&/index.html"})));
 assert(result.includes('import {managerRoute} from "file:///C:/test/contract.mjs";'));
 assert(!result.includes("['POST','PATCH'].includes(method)"));
 assert.equal(result.split("['POST','PATCH','PUT'].includes(method)").length,3);
 assert(result.includes('fetch((isManager?managerService:fdwService)+path+url.search,'));
 assert.throws(()=>deriveGateway(source.replace("location:'/auth/complete'",""),{},'file:///contract.mjs'),/GATEWAY_SOURCE_ANCHOR_MISMATCH/);
});

import {qualifyAcceptedAdapter} from './fdw-adapter-binding.mjs';
import {hash as sourceHash} from './contract.mjs';
test('accept only the exact previously qualified FDW membership fix',()=>{
 const before="prefix\nif (!proof.groups.includes(group)) throw denied('MEMBERSHIP_DENIED');\nsuffix";
 const after="prefix\nif (!proof.groups.includes(group)) return {status:'DENIED'};\nsuffix";
 assert(qualifyAcceptedAdapter(after,sourceHash(before)));
 assert(qualifyAcceptedAdapter(after.replaceAll('\n','\r\n')+'\r\n',sourceHash(before)));
 assert(!qualifyAcceptedAdapter(before,sourceHash(before)));
 assert(!qualifyAcceptedAdapter(after.replace('suffix','changed'),sourceHash(before)));
 assert(!qualifyAcceptedAdapter(after+'\n'+after,sourceHash(before)));
});

import {diagnosticPorts} from './authority-diagnostic.mjs';
test('diagnostic wrapper preserves actual port results and errors without credentials',async()=>{
 const events=[], ctx={}, error=Object.assign(new Error('private'),{code:'RESOURCE_ACCESS_DENIED'});
 const ident={kind:'FORMAL_PROVIDER_NEUTRAL_IDENTITY',async verify(){return ctx},authorize(){return {...a,credential_ref:'a'.repeat(64),valid_until:new Date(Date.now()+10000).toISOString()}},authorizeResource(){throw error},invalidate(x){assert.equal(x,ctx)}};
 const grants={async resolveLandGrant(){return null},async resolveLandInventory(){return {grants:[]}}};
 const d=diagnosticPorts(ident,grants,subject,()=>p,x=>events.push(x));
 assert.equal(await d.identity.verify('private',tenant),ctx);assert.equal(d.identity.authorize(ctx).subject,subject);
 assert.throws(()=>d.identity.authorizeResource(ctx,{action:'CREATE_FIELD'}),x=>x===error);
 assert.equal(await d.grants.resolveLandGrant({}),null);d.identity.invalidate(ctx);
 assert.equal(events.find(x=>x.stage==='FDW_CREATE_CAPABILITY').code,'RESOURCE_ACCESS_DENIED');
 assert(!JSON.stringify(events).includes('private'));assert(!JSON.stringify(events).includes(subject));assert(!JSON.stringify(events).includes('a'.repeat(64)));
});
