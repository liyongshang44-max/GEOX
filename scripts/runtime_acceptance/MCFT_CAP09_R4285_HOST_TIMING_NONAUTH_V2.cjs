"use strict";
/* R4285 NON-AUTHORIZED measurement. Does not inspect or write Permit, Owner
 * envelopes, ledger, stage artifacts, keys, or create a resource receipt.
 * The numbers are real local operations, NOT proof of Native Adoption,
 * Resource Owner, signed Preflight, Permit or physical Host readiness.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),
 cp=require("node:child_process"),os=require("node:os");
const {performance}=require("node:perf_hooks");
const installed=require("../cap09_adoption_v1/installed-material.cjs");
const parallel=require("./MCFT_CAP09_R4285_MATERIAL_FULL_PARALLEL_V2.cjs");
const v1=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs");
const RUN="4285c3ce342c",HOST="LAPTOP-STN2A2P1";
const FIELDS=["source_root","release_root","material_file"];
const stageNames=["MATERIAL_AND_TOOL_BYTES","GIT_SOURCE_AND_REMOTE","GITHUB_NATIVE_READS",
 "PG_SCOPED_READ_ONLY","S3_SCOPED_READ_ONLY","PYTHON_REAL_SELFTEST"];
const rejectSecrets=(s)=>!/(?:password|secret|token|access_key|credential|authorization)/i.test(s);
function jsonRegular(p){
 assert(typeof p==="string"&&path.isAbsolute(p),"TIMING_ABSOLUTE_PATH");
 const st=fs.lstatSync(p);
 assert(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<16*1024*1024,"TIMING_REGULAR_FILE");
 return JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,""));
}
function input(x){assert(x&&Object.keys(x).sort().join(",")===FIELDS.slice().sort().join(","),
 "TIMING_EXACT_INPUT");for(const p of Object.values(x))assert(typeof p==="string"&&path.isAbsolute(p));
 return x;}
function checkWindows(){
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,
 "TIMING_WINDOWS_ONLY");
 assert.equal(os.hostname().toUpperCase(),HOST,"TIMING_WRONG_MACHINE");
 for(const k of ["NODE_OPTIONS","NODE_PATH","PYTHONPATH","PYTHONHOME","MCFT_R4285_CHILD"])
  assert(!process.env[k],"TIMING_INJECTION:"+k);
}
async function measure(name,fn){
 const start=performance.now();
 try{const result=await fn();return {name,status:"MEASURED_NONAUTH",elapsed_ms:Math.round((performance.now()-start)*1000)/1000,result};}
 catch(e){const code=e?.code==="ERR_ASSERTION"&&rejectSecrets(e.message||"")?
  String(e.message||"").slice(0,140):"READONLY_COMPONENT_UNAVAILABLE_OR_FAILED";
  return {name,status:"HOLD",elapsed_ms:Math.round((performance.now()-start)*1000)/1000,
   reason_code:code};}
}
function command(exe,args,timeout){
 const r=cp.spawnSync(exe,args,{encoding:"utf8",timeout,windowsHide:true,maxBuffer:524288});
 assert.equal(r.status,0,"TIMING_NATIVE_PROCESS_FAILURE");
 return {completed:true};
}
async function pgReadOnly(release){
 const pg=require(require.resolve("pg",{paths:[release]}));
 const rows=[["positive","mcft_cap09_requal_"+RUN+"_positive",process.env.DATABASE_URL],
  ["negative","mcft_cap09_requal_"+RUN+"_negative",process.env.BLOCKED_DATABASE_URL]];
 const result=[];
 for(const [side,expected,raw] of rows){
  assert(typeof raw==="string"&&raw.length>0,"TIMING_PG_CREDENTIAL_ABSENT");
  const u=new URL(raw);
  assert(["postgres:","postgresql:"].includes(u.protocol)&&
   u.hostname==="127.0.0.1"&&u.port==="55492"&&decodeURIComponent(u.pathname.slice(1))===expected,
   "TIMING_PG_NOT_EXACT_ISOLATED_TARGET");
  assert(u.password.length>0,"TIMING_PG_MISSING_SCOPED_PASSWORD");
  const pool=new pg.Pool({connectionString:raw,max:1,connectionTimeoutMillis:6000,
   query_timeout:6000,statement_timeout:6000});
  let client,opened=false;
  try{
   client=await pool.connect();await client.query("BEGIN TRANSACTION READ ONLY");opened=true;
   const r=await client.query("SELECT session_user::text AS who,current_database()::text AS db");
   assert.equal(r.rows[0]?.db,expected,"TIMING_PG_WRONG_DATABASE");
   result.push({side,database:expected,read_only_transaction:true});
  }finally{
   if(client){if(opened){try{await client.query("ROLLBACK");}catch{}}
    client.release();}
   await pool.end();
  }
 }
 return {checks:result};
}
async function s3ReadOnly(release){
 const bucket="mcft-cap09-requal-"+RUN,endpoint=process.env.MCFT_CAP09_FORMAL_RAW_ENDPOINT;
 assert(endpoint==="http://127.0.0.1:59292"||endpoint==="http://127.0.0.1:59292/",
  "TIMING_S3_NOT_EXACT_ISOLATED_ENDPOINT");
 assert(process.env.MCFT_CAP09_FORMAL_RAW_BUCKET===bucket,"TIMING_S3_WRONG_BUCKET");
 for(const k of ["MCFT_CAP09_FORMAL_RAW_REGION","MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID","MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY"])
  assert(process.env[k]&&typeof process.env[k]==="string","TIMING_S3_SCOPED_AUTH_ABSENT");
 assert(!["minioadmin","root"].includes(process.env.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID),
  "TIMING_S3_BOOTSTRAP_ROOT_FORBIDDEN");
 return v1.probeS3ReadOnly(release,{bucket,bucket_endpoint:endpoint},process.env);
}
async function run(x){
 checkWindows();input(x);
 const profile=jsonRegular(x.material_file);
 const steps=[];
 steps.push(await measure(stageNames[0],()=>installed.verify(profile,x.release_root,process.env)));
 steps.push(await measure(stageNames[1],()=>{
  command("git",["-C",x.source_root,"rev-parse","HEAD"],20000);
  command("git",["-C",x.source_root,"status","--porcelain"],20000);
  command("git",["-C",x.source_root,"ls-remote","origin","refs/heads/main"],25000);
  return {real_native_git_commands:3};
 }));
 steps.push(await measure(stageNames[2],()=>{
  const base="https://api.github.com/repos/liyongshang44-max/GEOX";
  for(const suffix of ["/pulls/3757","/git/ref/heads/main"]){
   command("curl.exe",["--fail","--silent","--show-error","--location",
    "--max-time","20","-H","Accept: application/vnd.github+json",base+suffix],25000);
  }
  return {real_github_api_calls:2};
 }));
 steps.push(await measure(stageNames[3],()=>pgReadOnly(x.release_root)));
 steps.push(await measure(stageNames[4],()=>s3ReadOnly(x.release_root)));
 steps.push(await measure(stageNames[5],()=>{
  const py=process.env.MCFT_PYTHON_EXECUTABLE;
  assert(py&&path.isAbsolute(py),"TIMING_PYTHON_PATH_UNBOUND");
  const script=path.join(x.release_root,"apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py");
  command(py,[script,"selftest"],65000);
  return {real_python_selftest:true};
 }));
 const pre_ms=steps.filter(x=>x.status==="MEASURED_NONAUTH").reduce((sum,x)=>sum+x.elapsed_ms,0);
 const missing=steps.filter(x=>x.status==="HOLD").map(x=>x.name);
 return {schema_version:"MCFT_CAP09_R4285_V2_NATIVE_WINDOWS_NONAUTH_TIMING_V1",
  status:"NON_AUTHORIZED_COMPONENT_TIMING_NOT_HOST_OR_OWNER_ADMISSION",
  measured_at_utc:new Date().toISOString(),run_id:RUN,host_id:HOST,
  steps,measured_component_total_ms:Math.round(pre_ms*1000)/1000,
  missing_components:missing,
  owner_producer_original_raw_capture:"NOT_MEASURED_NO_OWNER_PRODUCER_INVOKED",
  native_adoption_crypto:"NOT_INVOKED_NO_SIGNATURE_REQUIRED",
  post_observation_signature_elapsed_ms:null,post_observation_cto_native_elapsed_ms:null,
  post_observation_complete_ms:null,owner_120s_actual_satisfiable:"HOLD_NO_GENUINE_OWNER_TO_CONSUMPTION_CHAIN",
  owner_age_reset_or_simulated:false,permit_issued:false,permit_consumed:false,
  execution_authorized:false,original_six_stages_executed:0,production_authorized:false};
}
async function parallelRun(x){
 checkWindows();input(x);
 const profile=jsonRegular(x.material_file);
 const record=await measure("FULL_MATERIAL_SHA256_PARALLEL_V2",
  ()=>parallel.verify(profile,x.release_root,process.env));
 return {schema_version:"MCFT_CAP09_R4285_V2_PARALLEL_FULL_MATERIAL_TIMING_V1",
  status:"NON_AUTHORIZED_FULL_SHA256_COMPONENT_TIMING_NOT_HOST_OR_OWNER_ADMISSION",
  measured_at_utc:new Date().toISOString(),run_id:RUN,host_id:HOST,
  material:record,all_material_and_tools_bytes_revalidated:record.status==="MEASURED_NONAUTH",
  immutable_runtime_source_qualified:false,
  owner_producer_invoked:false,owner_fresh:false,
  permit_issued:false,permit_consumed:false,execution_authorized:false,
  original_six_stages_executed:0,production_authorized:false};
}
function parse(argv){
 assert(argv.length===3&&["--timing-only","--timing-parallel-only"].includes(argv[0])&&argv[1]==="--input"&&path.isAbsolute(argv[2]),
  "TIMING_ONLY_MODE_AND_INPUT_REQUIRED");
 return jsonRegular(argv[2]);
}
if(require.main===module)(process.argv[2]==="--timing-parallel-only"?
 parallelRun(parse(process.argv.slice(2))):run(parse(process.argv.slice(2)))).then(x=>console.log(JSON.stringify(x,null,2)))
 .catch(e=>{console.error(JSON.stringify({status:"HOLD_NONAUTH_TIMING",reason_code:
  e?.code==="ERR_ASSERTION"&&rejectSecrets(e.message||"")?String(e.message).slice(0,140):
  "NONAUTH_TIMING_FAILED",permit_issued:false,permit_consumed:false,
  execution_authorized:false,original_six_stages_executed:0}));process.exitCode=1;});
module.exports={FIELDS,input,parse,run,parallelRun};
