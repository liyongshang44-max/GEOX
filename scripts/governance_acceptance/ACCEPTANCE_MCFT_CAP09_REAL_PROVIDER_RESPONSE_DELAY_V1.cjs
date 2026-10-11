"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto');
const {validatePlan,makeGate,verifyEvidence}=require('../runtime_acceptance/MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mcft-real-provider-delay-'));let count=0;let actualCalls=0;
const first=new Date(Date.now()+3600000);first.setUTCMinutes(0,0,0);const firstBase=first.toISOString();
const plan={schema_version:'geox_mcft_cap09_real_provider_response_delay_v1',run_id:'fedcba987654',subject_sha:'d'.repeat(40),first_base:firstBase,response_delay_ms:28,expected_distinct_bases:3,mode:'REAL_HTTPS_RESPONSE_BEFORE_CANONICAL_DECODER'};
(async()=>{const server=http.createServer((req,res)=>{actualCalls++;res.writeHead(200,{'content-type':'application/octet-stream'});res.end('actual-provider-bytes-'+actualCalls)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 const url='http://127.0.0.1:'+server.address().port+'/provider/actual?phase=1';
 assert.equal(validatePlan(plan,{runId:plan.run_id,subjectSha:plan.subject_sha,firstBase,producerStageTimeoutMs:5500}).expected_distinct_bases,3);count++;
 for(const f of [p=>p.response_delay_ms=0,p=>p.response_delay_ms=16000,p=>p.first_base='2020-01-01',p=>p.run_id='000',p=>p.mode='SYNTHETIC',p=>p.extra='allowed',p=>p.expected_distinct_bases=6]){
  const bad={...plan};f(bad);assert.throws(()=>validatePlan(bad));count++;
 }
 const gate=makeGate({plan,outputDir:dir,realFetch:fetch,allowLoopbackTest:true});
 assert.throws(()=>gate.assertBaseCaptured(firstBase),/ACTIVE_BASE/);count++;
 for(let i=0;i<3;i++){
  const base=new Date(Date.parse(firstBase)+i*3600000).toISOString();gate.activateBase(base);
  const t=process.hrtime.bigint(),response=await gate.fetch_impl(url,{method:'GET'});
  const duration=Number(process.hrtime.bigint()-t)/1e6;
  assert.equal(response.status,200);assert(duration>=plan.response_delay_ms);count++;
  assert((await response.text()).startsWith('actual-provider-bytes-'));count++;
  gate.assertBaseCaptured(base);count++;
  assert.throws(()=>gate.activateBase(base),/BASE_REPLAY/);count++;
 }
 assert.equal(actualCalls,3);count++;
 const proof=gate.seal();assert.equal(proof.actual_real_https_response_delay_events,3);count++;
 const file=path.join(dir,'MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1_RESULT.json');
 assert.equal(verifyEvidence(file,{runId:plan.run_id,subjectSha:plan.subject_sha,plan}).count,3);count++;
 assert.throws(()=>gate.seal(),/EXACT_THREE/);count++;
 assert.deepEqual(fs.readdirSync(dir).sort(),['MCFT_CAP09_PROVIDER_RESPONSE_DELAY_1.json','MCFT_CAP09_PROVIDER_RESPONSE_DELAY_2.json','MCFT_CAP09_PROVIDER_RESPONSE_DELAY_3.json','MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1_RESULT.json'].sort());count++;
 assert.throws(()=>makeGate({plan,outputDir:path.join(dir,'missing'),realFetch:fetch,allowLoopbackTest:true}));count++;
 assert.throws(()=>verifyEvidence(file,{runId:'aaaaaaaaaaaa',subjectSha:plan.subject_sha,plan}));count++;
 assert.throws(()=>verifyEvidence(file,{runId:plan.run_id,subjectSha:plan.subject_sha,
  plan:{...plan,response_delay_ms:plan.response_delay_ms+1}}),/PROVIDER_DELAY_SIGNED_WAIT_MISMATCH/);count++;
 const dataPath=path.join(dir,'MCFT_CAP09_PROVIDER_RESPONSE_DELAY_2.json');
 fs.appendFileSync(dataPath,'tamper');assert.throws(()=>verifyEvidence(file,{runId:plan.run_id,subjectSha:plan.subject_sha,plan}),/TAMPERED/);count++;
 console.log(JSON.stringify({status:'PASS',count,real_network_loopback_requests:actualCalls,physical_waits:3,provider_response_bytes_preserved:true,synthetic_provider_only:true,authorizes_execute:false}));
 }finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
