import assert from 'node:assert/strict';
import {test} from 'node:test';
import {managerApi,ManagerApiError,parsePolygon,documentRef} from './managerWorkspaceV1.js';
test('exact native paths, no caller scope or implicit retry',async()=>{
 const calls:{path:string;init:RequestInit}[]=[];
 const api=managerApi(async(path,init)=>{calls.push({path,init});return new Response(JSON.stringify({ok:true}),{status:200});});
 await api.create({field_id:'f1',name:'land'});
 await api.boundary('f1');await api.updateBoundary('f1',{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]},9);
 await api.confirm('f1',{document_id:'d1',revision:2,candidate_sha256:'a'.repeat(64)});
 await api.createReview('f1',{review_id:'r1',crop_codes:['CORN','SOYBEAN'],target_start_date:'2027-01-01',target_end_date:'2027-10-01',documents:[]});
 await api.assess('f1','r1');await api.linkFollowup('f1','r1',{followup_id:'p1',successor_review_id:'r2'});
 assert.deepEqual(calls.map(c=>[c.init.method,c.path]),[['POST','/api/v1/manager/fields'],['GET','/api/v1/manager/fields/f1/geometry'],['PUT','/api/v1/manager/fields/f1'],['POST','/api/v1/fields/f1/soil-documents/d1/confirm'],['POST','/api/v1/manager/fields/f1/crop-reviews'],['POST','/api/v1/manager/fields/f1/crop-reviews/r1/native-assessment'],['POST','/api/v1/manager/fields/f1/crop-reviews/r1/followups']]);
 assert.deepEqual(JSON.parse(String(calls[3].init.body)),{revision:2,candidate_sha256:'a'.repeat(64),confirm:true});
 assert.equal(calls[5].init.body,'{}');assert.ok(calls.every(c=>c.init.redirect==='error'&&c.init.cache==='no-store'));
 assert.throws(()=>api.boundary('../other'));assert.equal(calls.length,7);
});
test('denial and uncertain write not confused with success or retried',async()=>{
 let calls=0;const api=managerApi(async()=>{calls++;throw Error('network');});
 await assert.rejects(api.assess('f1','r1'),(e:ManagerApiError)=>e.unknownWrite===true);assert.equal(calls,1);
 const denied=managerApi(async()=>new Response(JSON.stringify({ok:false,error:'DENIED'}),{status:403}));
 await assert.rejects(denied.boundary('f1'),(e:ManagerApiError)=>e.code==='DENIED'&&e.unknownWrite===false);
});
test('polygon and exact selected document ref',()=>{
 assert.deepEqual(parsePolygon('{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}').coordinates[0][0],[0,0]);
 assert.throws(()=>parsePolygon('{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[2,2]]]}'));
 const doc={document_id:'d',revision:1,candidate_sha256:'a',original_name:'x',source_label:'s',original_sha256:'b',candidates:[],latest_revision:true,current_context_eligible:true,status:'MANAGER_CONFIRMED_ASSERTION'};
 assert.deepEqual(documentRef(doc),{document_id:'d',revision:1,candidate_sha256:'a'});
});

test('my land is a scope-free read of server-authorized inventory',async()=>{
 const seen:string[]=[];const api=managerApi(async(path,init)=>{seen.push(path);assert.equal(init.method,'GET');assert.equal(init.body,undefined);return new Response(JSON.stringify({ok:true,fields:[]}));});
 assert.deepEqual(await api.lands(),{ok:true,fields:[]});assert.deepEqual(seen,['/api/v1/manager/fields']);
});

test('scientific and observation reads send no caller scope or write',async()=>{
 const calls:string[]=[];const api=managerApi(async(path,init)=>{calls.push(path);assert.equal(init.method,'GET');return new Response(JSON.stringify({ok:true}));});
 await api.scientificResult('f1','r1');await api.observations('f1','x+y');assert.deepEqual(calls,['/api/v1/manager/fields/f1/crop-reviews/r1/scientific-result','/api/v1/manager/fields/f1/observations?limit=100&cursor=x%2By']);
});
