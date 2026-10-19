"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {adjudicatePostExecutionTimingV2:inspect}=require("./MCFT_CAP09_POSTEXECUTION_TIMING_ADJUDICATION_V2.cjs");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-post-budget-"));
const runId="da9db7129607",subject="77cdeeefc8b27901f3cc44b4edc203d8b8f513a3";
const stages=["PRODUCER","TIMING_1","TIMING_2","TIMING_3","CONTROLLED_DELAY","AGGREGATE"];
const ledger=path.join(root,"ledger"),artifacts=path.join(root,"artifacts");
fs.mkdirSync(ledger);fs.mkdirSync(artifacts);
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const write=(file,obj)=>{const bytes=Buffer.from(JSON.stringify(obj)+"\n");fs.writeFileSync(file,bytes);return sha(bytes);};
let count=0;
try{
 let previous=write(path.join(ledger,"CONSUMED.json"),{schema_version:"geox_mcft_cap09_consumed_permit_v1",payload:{run_id:runId},status:"CONSUMED_NO_AUTOMATIC_RETRY"});
 const auditRows=[];
 for(let i=0;i<stages.length;i++){
  const id=stages[i],stageDir=path.join(ledger,id);fs.mkdirSync(stageDir);
  const artifactFile=path.join(artifacts,id+".json");
  let content={status:"PASS",subject_sha:subject};
  if(i>=1&&i<=3)content={...content,sample_id:"sample"+i,measurement_only:true,timing_budget_qualified:false};
  if(i===4)content={...content,physical_delay_cases_executed:true,provider_pipeline_injected:false};
  if(i===5)content={...content,timing_budget_qualified:false,full_six_case_pipeline_delay_qualified:false};
  const artifactSha=write(artifactFile,content);
  const receipt={id,status:"PASS",previous_sha256:previous,claim_valid:true,artifact_present:true,elapsed_ms:5000,
    artifact_sha256:artifactSha,claim_sha256:"a".repeat(64),expected_artifact:artifactFile};
  previous=write(path.join(stageDir,"COMPLETED.json"),receipt);
  auditRows.push({id,receipt_sha256:previous,artifact_sha256:artifactSha});
 }
 write(path.join(ledger,"SIX_STAGE_AUDIT.json"),{status:"SIX_STAGE_EVIDENCE_SEALED_NOT_AUTHORITY",stage_count:6,stages:auditRows,final_receipt_sha256:previous,qualified:false});
 write(path.join(artifacts,"MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1_RESULT.json"),{status:"PASS",subject_sha:subject,run_id:runId});
 write(path.join(artifacts,"MCFT_CAP09_REAL_PIPELINE_DELAY_V1_RESULT.json"),{status:"PASS",subject_sha:subject,run_id:runId});
 const args={runDirectory:ledger,artifactDirectory:artifacts,runId,subjectSha:subject};
 const result=inspect(args);assert.equal(result.real_stage_count,6);assert.equal(result.total_monotonic_stage_elapsed_ms,30000);
 assert.equal(result.execute_authorized,false);assert.equal(result.timing_budget_qualified,false);count++;
 assert.throws(()=>inspect({...args,runId:"123456abcdef"}),/CONSUMED_RUN_REQUIRED/);count++;
 const drift=path.join(artifacts,"TIMING_1.json"),original=fs.readFileSync(drift);fs.appendFileSync(drift," ");
 assert.throws(()=>inspect(args),/ARTIFACT_BYTES_CHANGED/);count++;fs.writeFileSync(drift,original);
 const c2=path.join(ledger,"TIMING_2","COMPLETED.json"),old=fs.readFileSync(c2);
 const bad=JSON.parse(old);bad.previous_sha256="f".repeat(64);write(c2,bad);
 assert.throws(()=>inspect(args),/RECEIPT_HASH_CHANGED/);count++;fs.writeFileSync(c2,old);
 const aggregate=path.join(artifacts,"AGGREGATE.json"),oldA=fs.readFileSync(aggregate);
 write(aggregate,{...JSON.parse(oldA),timing_budget_qualified:true});
 assert.throws(()=>inspect(args),/ARTIFACT_BYTES_CHANGED|AGGREGATE_FALSE_QUALIFICATION/);count++;fs.writeFileSync(aggregate,oldA);
 const scratch=path.join(artifacts,"CONTROLLED_DELAY.json"),oldS=fs.readFileSync(scratch);
 write(scratch,{...JSON.parse(oldS),provider_pipeline_injected:true});
 assert.throws(()=>inspect(args),/ARTIFACT_BYTES_CHANGED|SCRATCH_NOT_FULL_PIPELINE/);count++;fs.writeFileSync(scratch,oldS);
 console.log(JSON.stringify({status:"PASS",checks:count,provider_calls:0,database_calls:0,minio_calls:0,
  permits_consumed:0,real_stages_executed:0,execute_authorized:false,qualified:false}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
