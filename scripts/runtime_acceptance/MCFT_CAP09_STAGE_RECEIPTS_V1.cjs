"use strict";
// Process supervision and evidence capture only. Caller must independently
// verify and consume authority BEFORE calling this primitive. No execute grant.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const digest=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
function writeOnce(file,record) {
 const bytes=Buffer.from(JSON.stringify(record,null,2)+"\n");
 const fd=fs.openSync(file,"wx",0o600);
 try {fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
 return digest(bytes);
}
function hashFile(file) {
 assert(fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink(),"STAGE_REGULAR_EVIDENCE_REQUIRED");
 return digest(fs.readFileSync(file));
}
async function runRecordedStage(spec) {
 assert(/^[A-Z][A-Z0-9_]{0,63}$/.test(spec.id),"STAGE_ID_REQUIRED");
 assert(path.isAbsolute(spec.directory)&&path.isAbsolute(spec.cwd),"STAGE_ABSOLUTE_PATH_REQUIRED");
 assert(path.isAbsolute(spec.executable)&&Array.isArray(spec.args)&&spec.args.every(x=>typeof x==="string"),"STAGE_COMMAND_REQUIRED");
 assert(Number.isSafeInteger(spec.timeout_ms)&&spec.timeout_ms>0&&spec.timeout_ms<=86400000,"STAGE_TIMEOUT_REQUIRED");
 assert(/^[a-f0-9]{64}$/.test(spec.previous_sha256),"STAGE_PREVIOUS_RECEIPT_REQUIRED");
 const directory=path.join(spec.directory,spec.id);
 fs.mkdirSync(directory,{mode:0o700}); // exclusive stage identity; no resume
 const started={schema_version:"geox_mcft_cap09_stage_started_v1",id:spec.id,
  command:{executable:spec.executable,args:spec.args},cwd:spec.cwd,
  previous_sha256:spec.previous_sha256,timeout_ms:spec.timeout_ms,started_at:new Date().toISOString()};
 const startHash=writeOnce(path.join(directory,"STARTED.json"),started);
 const stdout=path.join(directory,"stdout.log"),stderr=path.join(directory,"stderr.log");
 const out=fs.openSync(stdout,"wx",0o600),err=fs.openSync(stderr,"wx",0o600);
 let timer,child,result;
 const beginning=process.hrtime.bigint();
 try {
  result=await new Promise(resolve=>{
   let timedOut=false,spawnError=null,killError=null;
   child=cp.spawn(spec.executable,spec.args,{cwd:spec.cwd,env:spec.env,windowsHide:true,
    shell:false,detached:process.platform!=="win32",stdio:["ignore",out,err]});
   child.once("error",e=>{spawnError=e.code||e.message;});
   timer=setTimeout(()=>{
    timedOut=true;
    if(!child.pid)return;
    if(process.platform==="win32") {
     const killed=cp.spawnSync("taskkill.exe",["/PID",String(child.pid),"/T","/F"],{windowsHide:true,timeout:15000,stdio:"ignore"});
     if(killed.status!==0) {killError=killed.error?.code||"TREE_KILL_FAILED";child.kill();}
    } else {try {process.kill(-child.pid,"SIGKILL");} catch(e) {if(e.code!=="ESRCH")killError=e.code;}}
   },spec.timeout_ms);
   child.once("close",(code,signal)=>resolve({exit_code:code,signal,timed_out:timedOut,spawn_error:spawnError,tree_kill_error:killError}));
  });
 } finally {clearTimeout(timer);fs.fsyncSync(out);fs.fsyncSync(err);fs.closeSync(out);fs.closeSync(err);}
 const record={schema_version:"geox_mcft_cap09_stage_completed_v1",id:spec.id,
  started_sha256:startHash,previous_sha256:spec.previous_sha256,completed_at:new Date().toISOString(),
  elapsed_ms:Number((process.hrtime.bigint()-beginning)/1000000n),...result,
  stdout_sha256:hashFile(stdout),stderr_sha256:hashFile(stderr),
  status:result.exit_code===0&&!result.timed_out&&!result.spawn_error&&!result.tree_kill_error?"PASS":"FAIL",
  qualification_pass:false};
 const sha256=writeOnce(path.join(directory,"COMPLETED.json"),record);
 if(record.status!=="PASS") {
  const error=new Error("STAGE_FAILED_NO_AUTOMATIC_RETRY:"+spec.id);
  error.receipt={directory,sha256,record};throw error;
 }
 return {directory,sha256,record};
}
module.exports={runRecordedStage,hashFile,writeOnce};
