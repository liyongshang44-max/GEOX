"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const b=require("./MCFT_CAP09_R4285_FORMAL_BUDGET_V4.cjs"),d=require("./MCFT_CAP09_R4285_CONTROLLED_DELAY_V1.cjs"),id=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs"),scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const mk=vector=>({schema_version:"geox_mcft_cap09_retry_stage_plan_v2",stages:scheduler.STAGES.map((id,i)=>({id,timeout_ms:vector[i]}))});
test("exact signed vector routing; legacy unchanged; new route bound to registered execution identity",()=>{
 assert.equal(b.select(mk(b.LEGACY.timeouts),id.LEGACY),b.LEGACY);
 assert.equal(b.select(mk(b.LEGACY.timeouts),id.SUCCESSOR),b.LEGACY);
 assert.equal(b.select(mk(b.SUCCESSOR.timeouts),id.SUCCESSOR),b.SUCCESSOR);
 assert.throws(()=>b.select(mk(b.SUCCESSOR.timeouts),id.LEGACY),/VECTOR_OR_RUN/);
 const bad=[...b.SUCCESSOR.timeouts];bad[4]++;
 assert.throws(()=>b.select(mk(bad),id.SUCCESSOR),/VECTOR_OR_RUN/);
 assert.equal(b.minimumRemaining(b.LEGACY.id),10860000);
 assert.equal(b.minimumRemaining(b.SUCCESSOR.id),12360000);
 assert.throws(()=>b.minimumRemaining("unknown"),/VERSION_INVALID/);
 assert.throws(()=>b.requireSuccessorDelay(id.LEGACY,"2700000"),/ROUTE_OR_TIMEOUT/);
 assert.throws(()=>b.requireSuccessorDelay(id.SUCCESSOR,"1200000"),/ROUTE_OR_TIMEOUT/);
 assert.equal(b.requireSuccessorDelay(id.SUCCESSOR,"2700000").delayScript,"MCFT_CAP09_R4285_CONTROLLED_DELAY_V2.cjs");
});
test("reported measurement values as synthetic schema fixture, never formal receipt or physical wait",async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-budget-test-"));
 try{
 const keys=["wake_delay_ms","job_start_setup_ms","provider_capture_ms","retained_raw_and_candidate_ms","promotion_queue_and_setup_ms","rehydration_promotion_commit_readback_ms"];
 const rows=[[0,811,1010236,46662,215,35472],[0,3,929142,23600,158,44626],[0,31,999837,7651,112,31468]];
 const subjectSha="a".repeat(40);
 const sampleFiles=rows.map((row,i)=>{const f=path.join(root,"MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE"+(i+1)+"_V2_RESULT.json");fs.writeFileSync(f,JSON.stringify({schema_version:"geox_mcft_cap09_v13_exact_head_timing_sample_v2",status:"PASS",subject_sha:subjectSha,sample_id:"sample"+(i+1),measurement_only:true,timing_phases:Object.fromEntries(keys.map((k,j)=>[k,row[j]]))}));return f;});
 const args={sampleFiles,runId:id.SUCCESSOR,subjectSha};
 assert.throws(()=>d.deriveDelayPlan(args),/DELAY_REAL_CASE_BUDGET_INVALID:PROVIDER_SLOW_PATH/);
 const plan=d.deriveDelayPlan({...args,maximumCaseMs:b.SUCCESSOR.caseLimit});
 assert.deepEqual(plan.cases.map(x=>x.delay_ms),[1,811,1010236,215,44626,1056898]);
 assert.equal(b.delayThreshold(plan),2535345);assert(b.delayThreshold(plan)<b.SUCCESSOR.timeouts[4]);
 await assert.rejects(d.executeRealDelay({plan,scratchParent:root,outputFile:path.join(root,"result.json"),stageTimeoutMs:b.LEGACY.timeouts[4]}),/DELAY_TOTAL_EXCEEDS_SIGNED_STAGE_TIMEOUT/);
 assert(!fs.existsSync(path.join(root,plan.target.name)));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("new entry and new budget source explicitly included in exact execution source set",()=>{
 const builder=require("./MCFT_CAP09_R4285_BUILD_ADMISSION_EXEC_V3.cjs");
 for(const f of ["MCFT_CAP09_R4285_FORMAL_BUDGET_V4.cjs","MCFT_CAP09_R4285_CONTROLLED_DELAY_V2.cjs","MCFT_CAP09_R4285_CHILD_STAGE_V1.cjs","MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs","MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3.cjs","MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs"])assert(builder.EXECUTION_SOURCES.includes("scripts/runtime_acceptance/"+f));
});

test("actual Host selects signed exact path and Child Stage rejects cross-revision paths",()=>{
 const vm=require("node:vm"),Module=require("node:module"),crypto=require("node:crypto"),c=require("../cap09_adoption_v1/contract.cjs");
 const child=require("./MCFT_CAP09_R4285_CHILD_STAGE_V1.cjs");
 const file=path.join(__dirname,"MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs"),mod={exports:{}},local=Module.createRequire(file);
 const request=name=>local(name);request.resolve=(name,options)=>name==="tsx"?"fixture-only-resolution":local.resolve(name,options);
 vm.runInThisContext("(function(exports,require,module,__filename,__dirname){"+fs.readFileSync(file,"utf8")+"\n})",{filename:file})(mod.exports,request,mod,file,__dirname);
 const host=mod.exports,releaseRoot=path.resolve(__dirname,"../.."),parent=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-route-")),out=path.join(parent,"output");
 const sha=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
 const names=[...new Set([...Object.values(child.SCRIPT),b.SUCCESSOR.delayScript])];
 const profile={tools:{node:{path:fs.realpathSync(process.execPath)}},files:names.map(n=>({path:"scripts/runtime_acceptance/"+n,sha256:sha(path.join(__dirname,n))}))};
 const first_base=new Date(Math.ceil((Date.now()+7200000)/3600000)*3600000).toISOString(),observed={};
 const env={DATABASE_URL:"postgres://unit:unit@127.0.0.1:55492/mcft_cap09_requal_"+id.LEGACY+"_positive",BLOCKED_DATABASE_URL:"postgres://unit:unit@127.0.0.1:55492/mcft_cap09_requal_"+id.LEGACY+"_negative",MCFT_CAP09_FORMAL_RAW_ENDPOINT:"http://127.0.0.1:59292/",MCFT_CAP09_FORMAL_RAW_BUCKET:"mcft-cap09-requal-"+id.LEGACY,MCFT_QUALIFICATION_FIRST_BASE:first_base};
 const run=(version,executionRun=id.SUCCESSOR,p=profile)=>{
  const plan=b.makePlan(version),permitPayload={run_id:executionRun,subject_sha:"a".repeat(40),nonce:"b".repeat(64),plan_sha256:c.digest(plan),observations_sha256:c.digest(observed)};
  return host.resolveStages({input:{release_root:releaseRoot,first_base,output_root:out},profile:p,permitPayload,trust:{ledger_root:parent},plan,observed,env,executionRun});
 };
 try{
  const legacy=run(b.LEGACY.id),successor=run(b.SUCCESSOR.id);
  assert.equal(path.basename(legacy[4].script),b.LEGACY.delayScript);
  assert.equal(path.basename(successor[4].script),b.SUCCESSOR.delayScript);
  assert.equal(successor[4].env.MCFT_GOVERNED_RETRY_DELAY_TIMEOUT_MS,"2700000");
  assert.deepEqual(legacy.filter((_,i)=>i!==4).map(x=>x.script),successor.filter((_,i)=>i!==4).map(x=>x.script));
  assert.throws(()=>run(b.SUCCESSOR.id,id.LEGACY),/LEGACY_FORBIDDEN/);
  assert.throws(()=>run(b.SUCCESSOR.id,id.SUCCESSOR,{...profile,files:profile.files.filter(x=>!x.path.endsWith(b.SUCCESSOR.delayScript))}),/UNSIGNED_STAGE_SOURCE/);
  const contract=step=>({...step.env,MCFT_R4285_PERMIT_ENVELOPE_SHA256:"c".repeat(64),MCFT_GOVERNED_RETRY_PREVIOUS_RECEIPT_SHA256:"d".repeat(64),MCFT_GOVERNED_RETRY_TICKET:path.join(parent,"run-"+id.SUCCESSOR,"STAGE_TICKET_R4285_CONTROLLED_DELAY.json")});
  assert.equal(child.assertChildContract(contract(successor[4]),successor[4].script).stage,"CONTROLLED_DELAY");
  assert.equal(child.assertChildContract(contract(legacy[4]),legacy[4].script).stage,"CONTROLLED_DELAY");
  assert.throws(()=>child.assertChildContract(contract(successor[4]),legacy[4].script),/WRONG_SCRIPT/);
  assert.throws(()=>child.assertChildContract(contract(legacy[4]),successor[4].script),/WRONG_SCRIPT/);
 }finally{fs.rmSync(parent,{recursive:true,force:true});}
});
