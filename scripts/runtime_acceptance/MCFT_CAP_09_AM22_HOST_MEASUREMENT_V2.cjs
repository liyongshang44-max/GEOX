"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {PHASES}=require("./MCFT_CAP_09_AM22_PREPARATION_ENVELOPE_V1.cjs");
const {SCOPE}=require("./MCFT_CAP_09_AM22_EVIDENCE_CLOCK_V2.cjs");
const ROOT=path.resolve(__dirname,"../..");
const PROFILE_FILES=["scripts/runtime_acceptance/MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs","scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.ts","scripts/runtime_acceptance/MCFT_CAP_09_AM22_PREWRITE_PROBE_V2.ts"];
const TIMEOUT_MS=600000,SAFETY_MARGIN_MS=120000;
const hash=bytes=>"sha256:"+crypto.createHash("sha256").update(bytes).digest("hex");
function profileDigest(){return hash(JSON.stringify(PROFILE_FILES.map(file=>({file,sha256:hash(fs.readFileSync(path.join(ROOT,file)))}))));}
function isolatedUrl(value){
 const u=new URL(value);assert.ok(["postgres:","postgresql:"].includes(u.protocol));
 assert.ok(["127.0.0.1","localhost","[::1]"].includes(u.hostname),"AM22_MEASUREMENT_LOCAL_DATABASE_REQUIRED");
 assert.match(u.pathname,/^\/am22_measure_[a-f0-9]{12}$/,"AM22_MEASUREMENT_DISTINCT_DATABASE_REQUIRED");
 assert.equal(u.search,"");return value;
}
function stageCoverage(stage,a0,now){
 assert.equal(stage.status,"PASS");assert.equal(stage.architecture_effective,true);assert.equal(stage.runtime_consumption_authorized,true);
 for(const [key,value] of Object.entries(SCOPE))assert.equal(stage.scope?.[key],value,"AM22_MEASUREMENT_SCOPE_MISMATCH:"+key);
 assert.equal(stage.biological_stage?.resolved_biological_stage,"R6_OR_LATER_MODEL_ESTIMATE");assert.equal(stage.crop_water_use_stage,"LATE");assert.equal(stage.crop_model_parameter?.value,0.6);
 const life=stage.lifecycle;assert.equal(life?.domain_state,"ACTIVE");assert.equal(life?.authority_status,"RESOLVED");assert.equal(life?.authority_validity,"VALID");assert.equal(life?.authority_mode,"GOVERNED_PERSISTENT_STATE");assert.equal(life?.active_consumable_candidate,true);
 const t=Date.parse(a0),n=Date.parse(now),start=Date.parse(stage.biological_stage.authority_as_of),end=Date.parse(stage.biological_stage.authority_valid_until);
 assert.ok(Number.isFinite(n)&&Number.isFinite(t)&&new Date(t).toISOString()===a0&&a0.endsWith(":00:00.000Z"));
 assert.equal(end-start,30*3600000);assert.equal(stage.biological_stage.forward_stability_hours,30);
 assert.ok(start<=n&&Date.parse(stage.graduation?.graduated_at)<=n&&n<end,"AM22_MEASUREMENT_STAGE_FUTURE_OR_STALE");
 assert.ok(t>=n+TIMEOUT_MS&&end>=t+24*3600000&&Date.parse(life.horizon_end_utc)>=t+24*3600000,"AM22_MEASUREMENT_FULL_24T_COVERAGE_REQUIRED");
 return {a0,o00:new Date(t+3600000).toISOString(),o23:new Date(t+24*3600000).toISOString(),all_25_contexts_covered:true,window_selected_for_measurement_only:true};
}
function immutable(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n",{flag:"wx",mode:0o600});}
async function measure(tasks,binding,out,clock=()=>Number(process.hrtime.bigint()/1000000n)){
 assert.deepEqual(Object.keys(tasks),PHASES,"AM22_MEASUREMENT_FIXED_ORDER_REQUIRED");
 const start=clock(),phases=[];immutable(path.join(out,"started.json"),{status:"STARTED",...binding,formal_v5_arm:false,a0_execution:false});
 for(const phase of PHASES){const began=clock();try{const evidence=await tasks[phase]();const finished=clock();assert.ok(finished>began);assert.ok(finished-start<TIMEOUT_MS,"AM22_MEASUREMENT_COMPLETE_TIMEOUT");
 const file=path.join(out,phase+".json");immutable(file,evidence);phases.push({phase,status:"PASS",evidence_file:path.basename(file),evidence_sha256:hash(fs.readFileSync(file)),started_monotonic_ms:began,finished_monotonic_ms:finished});
 }catch(error){const code=String(error?.message??"").match(/\b(?:AM22|FORMAL|EXTERNAL|GFS|PHASE7)_[A-Z0-9_]+\b/)?.[0]??"AM22_MEASUREMENT_PHASE_FAILED";immutable(path.join(out,"failed.json"),{status:"FAIL",phase,completed_phases:phases,terminal_code:code,production_authorized:false});throw error;}}
 const trace={...binding,schema_version:"geox_mcft_cap09_six_phase_host_measurement_trace_v2",synthetic:false,measurement_class:"ACTUAL_LIVE_READINESS_AND_ISOLATED_PREWRITE",qualification_scope:"LIVE_READ_ONLY_DEPENDENCIES_AND_ISOLATED_PREWRITE",production_equivalence_limitations:["PRODUCTION_DOCKER_OWNER_CUTOVER_NOT_MEASURED","FORMAL_RAW_PUT_AND_FORMAL_PROMOTION_NOT_EXECUTED"],trials:[{status:"PASS",started_monotonic_ms:start,finished_monotonic_ms:clock(),phases}],complete_production_pre_a0_qualified:false,production_authorized:false,formal_v5_arm:false,a0_execution:false};
 immutable(path.join(out,"measurement-trace.json"),trace);return trace;
}
module.exports={ROOT,PROFILE_FILES,TIMEOUT_MS,SAFETY_MARGIN_MS,hash,profileDigest,isolatedUrl,stageCoverage,immutable,measure};
if(require.main===module){
 try{
  assert.ok(!process.env.CI&&!process.env.GITHUB_ACTIONS,"AM22_MEASUREMENT_LOCAL_HOST_REQUIRED");
  assert.ok(process.argv.includes("--operator-authorized"));
  const args=process.argv.slice(2);assert.ok(!args.includes("--execute"));
  const result=require("node:child_process").spawnSync(process.execPath,["--import","tsx",path.join(ROOT,PROFILE_FILES[1]),"--run",...args],{cwd:ROOT,env:process.env,stdio:"inherit",timeout:TIMEOUT_MS});
  assert.ok(!result.error,"AM22_MEASUREMENT_COMPLETE_TIMEOUT_OR_START_FAILURE");process.exitCode=result.status??1;
 }catch{console.error("AM22_MEASUREMENT_REJECTED_OR_TIMED_OUT: no execution qualification issued");process.exitCode=1;}
}
