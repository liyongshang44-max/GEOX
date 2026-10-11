"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {runRecordedStage,hashFile}=require("../runtime_acceptance/MCFT_CAP09_STAGE_RECEIPTS_V1.cjs");
async function main(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-stage-tests-"));let tests=0;
 try {
  const base={directory:root,cwd:root,executable:process.execPath,timeout_ms:5000,previous_sha256:"a".repeat(64),env:{...process.env,NODE_OPTIONS:""}};
  const a=await runRecordedStage({...base,id:"SUCCESS",args:["-e","process.stdout.write('fixture-out');process.stderr.write('fixture-err')"]});
  assert.equal(a.record.exit_code,0);assert.equal(a.record.qualification_pass,false);tests++;
  assert.equal(a.record.stdout_sha256,hashFile(path.join(a.directory,"stdout.log")));tests++;
  assert.equal(a.sha256,hashFile(path.join(a.directory,"COMPLETED.json")));tests++;
  await assert.rejects(runRecordedStage({...base,id:"SUCCESS",args:[]}),/EEXIST/);tests++;
  try {await runRecordedStage({...base,id:"FAILURE",previous_sha256:a.sha256,args:["-e","process.exit(7)"]});assert.fail();}
  catch(e){assert.equal(e.receipt.record.exit_code,7);assert.equal(e.receipt.record.previous_sha256,a.sha256);tests++;}
  try {await runRecordedStage({...base,id:"TIMEOUT",timeout_ms:150,args:["-e","setInterval(()=>{},1000)"]});assert.fail();}
  catch(e){assert.equal(e.receipt.record.timed_out,true);assert.equal(e.receipt.record.status,"FAIL");tests++;}
  try {await runRecordedStage({...base,id:"MISSING",executable:path.join(root,"no-executable"),args:[]});assert.fail();}
  catch(e){assert.equal(e.receipt.record.spawn_error,"ENOENT");tests++;}
  await assert.rejects(runRecordedStage({...base,id:"../escape",args:[]}));tests++;
  console.log(JSON.stringify({status:"PASS",tests,synthetic_processes_only:true,provider_calls:0,execute_authorized:false}));
 } finally {fs.rmSync(root,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
