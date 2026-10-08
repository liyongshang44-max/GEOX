"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),os=require("node:os");
const chain=require("./MCFT_CAP_09_AM22_START_CHAIN_V2.cjs");
const {fileDigest,digest}=require("./MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs");
const arg=name=>process.argv.slice(2).find(x=>x.startsWith(name+"="))?.slice(name.length+1);
const scripts=path.join(chain.ROOT,"scripts/runtime_acceptance");
function command(file,args){return {file:path.join(scripts,file),args};}
function preparationCommands(inputFile,rearmFile,out){return [
 command("RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V2.cjs",["--operator-authorized","--input="+inputFile]),
 command("ASSEMBLE_MCFT_CAP_09_FORMAL_V5_ARM_V2.cjs",["--operator-authorized","--input="+inputFile,"--materialized-zero-rearm-proof="+rearmFile,"--out="+path.join(out,"arm.json")]),
 command("RUN_MCFT_CAP_09_FORMAL_V5_SCHEMA_ACL_MATERIALIZATION_V1.ts",["--operator-authorized","--arm="+path.join(out,"arm.json"),"--out="+path.join(out,"schema-acl.json")]),
];}
function a0Commands(out){return [
 command("RUN_MCFT_CAP_09_FORMAL_V5_A0_PRODUCTION_REPLAY_PROMOTION_V2.cjs",["--operator-authorized","--arm="+path.join(out,"arm.json"),"--schema-proof="+path.join(out,"schema-acl.json"),"--continuity-proof="+path.join(out,"continuity-promotion.json"),"--out="+path.join(out,"promotion.json")]),
 command("RUN_MCFT_CAP_09_FORMAL_V5_A0_BOOTSTRAP_V2.cjs",["--operator-authorized","--arm="+path.join(out,"arm.json"),"--schema-proof="+path.join(out,"schema-acl.json"),"--promotion-proof="+path.join(out,"promotion.json"),"--continuity-proof="+path.join(out,"continuity-bootstrap.json"),"--manifest-out="+path.join(out,"manifest.json"),"--out="+path.join(out,"bootstrap.json")]),
];}
function runStep(operation,out,timeout){
 const step=path.basename(operation.file).replace(/\.(cjs|ts)$/,""),marker=path.join(out,step+".started.json"),receipt=path.join(out,step+".completed.json");
 chain.req(!fs.existsSync(marker),"PARTIAL_OR_PRIOR_OPERATION_REQUIRES_INDEPENDENT_RECONCILIATION");
 const start=process.hrtime.bigint();
 chain.immutable(marker,{step,status:"STARTED",started_at_utc:new Date().toISOString(),command_script:operation.file});
 const argv=operation.file.endsWith(".ts")?["--import","tsx",operation.file,...operation.args]:[operation.file,...operation.args];
 try{cp.execFileSync(process.execPath,argv,{cwd:chain.ROOT,stdio:"inherit",timeout});}catch{throw new Error("AM22_CHAIN_OPERATION_FAILED_OR_TIMED_OUT:"+step);}
 chain.immutable(receipt,{step,status:"PASS",elapsed_ms:Number((process.hrtime.bigint()-start)/1000000n),finished_at_utc:new Date().toISOString()});
 return receipt;
}
async function main(){
 chain.effectivePolicy();
 chain.req(!process.env.CI&&!process.env.GITHUB_ACTIONS,"LOCAL_HOST_REQUIRED");
 chain.req(process.argv.includes("--operator-authorized"),"OPERATOR_AUTHORIZATION_REQUIRED");
 const prepare=process.argv.includes("--prepare"),a0=process.argv.includes("--a0");
 chain.req(prepare!==a0,"EXACTLY_ONE_EXECUTION_PHASE_REQUIRED");
 if(prepare){
  chain.req(arg("--input")&&arg("--materialized-zero-rearm-proof"),"PREPARATION_ARGUMENTS_REQUIRED");
  const inputFile=path.resolve(arg("--input")),input=chain.json(inputFile);
  const c=chain.candidate(input,chain.databaseNow());
  const out=path.resolve(arg("--run-directory")||path.join(os.homedir(),".geox","mcft-cap09","formal-v5","am22-runs",c.arm_identity_hash.slice(7)));
  chain.req(!fs.existsSync(out),"DISTINCT_NEW_RUN_DIRECTORY_REQUIRED");
  chain.immutable(path.join(out,"run.json"),{schema_version:"geox_mcft_cap09_am22_execution_run_v2",status:"PREPARATION_STARTED",subject_sha:c.subject_sha,image_id:c.image_id,input_file:inputFile,input_sha256:fileDigest(inputFile),candidate_identity:c.arm_identity_hash,production_completion_authorized:false});
  const envelope=chain.json(input.qualified_envelope_file),start=process.hrtime.bigint();
  const receipts=[];
  for(const operation of preparationCommands(inputFile,path.resolve(arg("--materialized-zero-rearm-proof")),out)){
   const elapsed=Number((process.hrtime.bigint()-start)/1000000n),remaining=envelope.enforced_complete_timeout_ms-elapsed;
   chain.req(remaining>0,"COMPLETE_PREPARATION_TIMEOUT");
   receipts.push(runStep(operation,out,remaining));
  }
  const arm=chain.json(path.join(out,"arm.json"));
  chain.fixedWindow(arm,input,chain.databaseNow(),"PREPARE");
  chain.immutable(path.join(out,"prepared.json"),{status:"PREPARED_WAITING_A0",arm_identity_hash:arm.arm_identity_hash,arm_sha256:fileDigest(path.join(out,"arm.json")),schema_sha256:fileDigest(path.join(out,"schema-acl.json")),operation_receipts:receipts.map(file=>({file,sha256:fileDigest(file)})),observed_elapsed_ms:Number((process.hrtime.bigint()-start)/1000000n),measurement_scope:"CUTOVER_ARM_SCHEMA_ONLY_NOT_COMPLETE_PRE_A0_QUALIFICATION",a0:arm.a0,o00:arm.o00,o23:arm.o23,a0_execution:false,mcft_cap09_completed:false});
  console.log(JSON.stringify({status:"PREPARED_WAITING_A0",run_directory:out,a0:arm.a0,o00:arm.o00,o23:arm.o23,a0_execution:false,active_runtime_started:false},null,2));
 }else{
  chain.req(arg("--run-directory"),"RUN_DIRECTORY_REQUIRED");
  const out=path.resolve(arg("--run-directory")),run=chain.json(path.join(out,"run.json")),prepared=chain.json(path.join(out,"prepared.json"));
  chain.req(run.schema_version==="geox_mcft_cap09_am22_execution_run_v2"&&prepared.status==="PREPARED_WAITING_A0","PREPARED_RUN_REQUIRED");
  chain.req(fileDigest(run.input_file)===run.input_sha256,"INPUT_CHANGED_AFTER_PREPARATION");
  chain.req(fileDigest(path.join(out,"arm.json"))===prepared.arm_sha256&&fileDigest(path.join(out,"schema-acl.json"))===prepared.schema_sha256,"PREPARED_ARTIFACT_BYTES_CHANGED");
  for(const r of prepared.operation_receipts)chain.req(fileDigest(r.file)===r.sha256,"PREPARATION_RECEIPT_BYTES_CHANGED");
  const input=chain.json(run.input_file),arm=chain.json(path.join(out,"arm.json"));
  chain.req(arm.arm_identity_hash===prepared.arm_identity_hash&&arm.subject_sha===run.subject_sha,"RUN_ARM_IDENTITY_MISMATCH");
  const receipts=[];
  for(const operation of a0Commands(out)){
   const now=chain.databaseNow();
   chain.fixedWindow(arm,input,now,"A0");
   // T1/T2 lease, container, image and host must be observed again immediately before effects.
   cp.execFileSync(process.execPath,[path.join(scripts,"VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs"),"--live"],{cwd:chain.ROOT,stdio:"inherit",timeout:180000});
   chain.verifyOwnerBinding(chain.json(path.join(chain.ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1_RESULT.json")),input.binding);
   chain.fixedWindow(arm,input,chain.databaseNow(),"A0");
   receipts.push(runStep(operation,out,Math.max(1,Date.parse(arm.o00)-Date.parse(chain.databaseNow())-900000)));
  }
  const bootstrap=chain.json(path.join(out,"bootstrap.json"));
  chain.req(bootstrap.status==="PASS"&&bootstrap.arm_identity_hash===arm.arm_identity_hash,"ACTUAL_BOOTSTRAP_RESULT_REQUIRED");
  const result={status:"A0_BOOTSTRAPPED_NOT_ACTIVE",arm_identity_hash:arm.arm_identity_hash,bootstrap_sha256:fileDigest(path.join(out,"bootstrap.json")),operation_receipts:receipts.map(file=>({file,sha256:fileDigest(file)})),active_production_cutover_still_required:true,mcft_cap09_completed:false};
  chain.immutable(path.join(out,"a0-result.json"),result);console.log(JSON.stringify(result,null,2));
 }
}
module.exports={preparationCommands,a0Commands,runStep};
if(require.main===module)main().catch(error=>{console.error(/^AM22_|^FORMAL_ARM_/.test(error.message)?error.message:"AM22_CHAIN_EXECUTION_REJECTED");process.exitCode=1;});
