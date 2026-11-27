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
