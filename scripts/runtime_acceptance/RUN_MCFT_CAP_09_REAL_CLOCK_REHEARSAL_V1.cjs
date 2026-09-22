#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const os=require("node:os");
const cp=require("node:child_process");
const crypto=require("node:crypto");

const ROOT=path.resolve(__dirname,"../..");
const COMPOSE=path.join(ROOT,"docker-compose.mcft-cap09-phase5-qualification.yml");
const STATE_ROOT=path.join(os.homedir(),".geox","mcft-cap09","real-clock-rehearsal");
const ACTIVE_POINTER=path.join(STATE_ROOT,"active.json");
const HOUR=3_600_000;
const MINUTE=60_000;
const LIVE_EVIDENCE_PRE_A0_SELECTION_LEAD=2*HOUR;
const LIVE_EVIDENCE_MINIMUM_RUNTIME_BEFORE_A0=45*MINUTE;

const MINIO_IMAGE="quay.io/minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e";
const MC_IMAGE="quay.io/minio/mc@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727";

function fail(code,detail){throw new Error(detail===undefined?code:code+":"+String(detail));}
function req(ok,code,detail){if(!ok)fail(code,detail);}
function iso(ms){return new Date(ms).toISOString();}
function arg(name){
  const prefix="--"+name+"=";
  const hit=process.argv.find((value)=>value.startsWith(prefix));
  return hit?hit.slice(prefix.length):null;
}
function flag(name){return process.argv.includes("--"+name);}
function git(...args){
  return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}
function exec(command,args,options={}){
  return cp.execFileSync(command,args,{
    cwd:ROOT,
    encoding:"utf8",
    stdio:options.capture===false?"inherit":["ignore","pipe","pipe"],
    env:options.env??process.env,
  });
}
function writePrivateJson(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n",{mode:0o600});
  try{fs.chmodSync(file,0o600);}catch{}
}
function readJson(file,code){
  try{return JSON.parse(fs.readFileSync(file,"utf8"));}
  catch(error){fail(code,error instanceof Error?error.message:String(error));}
}
function sha12(value){return String(value).slice(0,12);}
function stamp(ms){
  return iso(ms).replace(/[-:.]/g,"").replace("Z","z").toLowerCase();
}
function randomHex(bytes=18){return crypto.randomBytes(bytes).toString("hex");}
function strictNextUtcHour(nowMs){
  return Math.floor(nowMs/HOUR)*HOUR+HOUR;
}
function composeArgs(state,args){
  return [
    "compose",
    "--project-name",state.project_name,
    "-f",COMPOSE,
    "-f",state.override_path,
    ...args,
  ];
}
function compose(state,secrets,args,options={}){
  return exec("docker",composeArgs(state,args),{
    env:{...process.env,...secrets},
    capture:options.capture,
  });
}
function loadState(){
  const explicit=arg("state");
  let statePath=explicit?path.resolve(explicit):"";
  if(!statePath){
    req(fs.existsSync(ACTIVE_POINTER),"REAL_CLOCK_REHEARSAL_ACTIVE_STATE_REQUIRED");
    const pointer=readJson(ACTIVE_POINTER,"REAL_CLOCK_REHEARSAL_ACTIVE_POINTER_INVALID");
    statePath=String(pointer.state_path??"");
  }
  req(statePath&&fs.existsSync(statePath),"REAL_CLOCK_REHEARSAL_STATE_NOT_FOUND",statePath);
  const state=readJson(statePath,"REAL_CLOCK_REHEARSAL_STATE_INVALID");
  req(state.schema_version==="geox_mcft_cap09_real_clock_rehearsal_state_v1","REAL_CLOCK_REHEARSAL_STATE_SCHEMA_INVALID");
  req(state.run_class==="QUALIFICATION_REHEARSAL","REAL_CLOCK_REHEARSAL_RUN_CLASS_INVALID");
  req(String(state.project_name??"").startsWith("mcftcap09-rehearsal-"),"REAL_CLOCK_REHEARSAL_PROJECT_NAME_INVALID");
  const secrets=readJson(state.secrets_path,"REAL_CLOCK_REHEARSAL_SECRETS_INVALID");
  return {state,statePath,secrets};
}
function query(state,secrets,sql){
  return compose(state,secrets,[
    "exec","-T","postgres",
    "psql","-U",secrets.GEOX_PHASE5_POSTGRES_USER,
    "-d",secrets.GEOX_PHASE5_DATABASE_NAME,
    "-Atc",sql,
  ]).trim();
}
function containerState(state,secrets,service="twin-runtime"){
  const id=compose(state,secrets,["ps","-q",service]).trim();
  if(!id)return {id:"",running:false,status:"ABSENT"};
  const raw=exec("docker",["inspect","-f","{{json .State}}",id]);
  const parsed=JSON.parse(raw);
  return {id,running:parsed.Running===true,status:String(parsed.Status??""),restart_count:Number(parsed.RestartCount??0)};
}
function sanitizedEvidenceHealthEventV1(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  if(value.runtime_role!=="EVIDENCE_RUNTIME")return null;
  const allowed=[
    "runtime_role","lifecycle_id","host_id","status","cycle_attempt",
    "successful_cycle_count","standby_cycle_count","retryable_failure_count",
    "consecutive_failure_count","detail","attempt_kind","failure_class",
    "failure_stage","failure_token","error_name","error_code","member_kind",
    "lead","local_retry_ordinal",
  ];
  const out={};
  for(const key of allowed){
    const item=value[key];
    if(typeof item==="string"||typeof item==="number"||typeof item==="boolean"||item===null){
      out[key]=item;
    }
  }
  return out;
}
function evidenceRuntimeHealthProof(state,secrets){
  const output=compose(state,secrets,["logs","--no-color","--no-log-prefix","evidence-runtime"]);
  const events=[];
  for(const rawLine of output.split(/\r?\n/)){
    const start=rawLine.indexOf("{"),end=rawLine.lastIndexOf("}");
    if(start<0||end<start)continue;
    try{
      const event=sanitizedEvidenceHealthEventV1(JSON.parse(rawLine.slice(start,end+1)));
      if(event)events.push(event);
    }catch{}
  }
  const detailCount=(detail)=>events.filter((event)=>event.detail===detail).length;
  const starting=detailCount("HOST_START");
  const completed=detailCount("ATTEMPT_COMPLETED");
  const retryable=detailCount("RETRYABLE_ATTEMPT_FAILURE");
  const fatal=detailCount("FATAL_ATTEMPT_FAILURE");
  return {
    schema_version:"geox_mcft_cap09_real_clock_rehearsal_evidence_health_proof_v1",
    run_class:"QUALIFICATION_REHEARSAL",
    subject_sha:state.subject_sha,
    project_name:state.project_name,
    status:starting>=1&&(completed+retryable)>=1&&fatal===0?"PASS":"FAIL",
    live_production_evidence_runtime:true,
    isolated_qualification_database:true,
    isolated_raw_namespace:true,
    health_event_count:events.length,
    host_start_count:starting,
    attempt_completed_count:completed,
    retryable_attempt_failure_count:retryable,
    fatal_attempt_failure_count:fatal,
    provider_attempt_outcome_count:completed+retryable,
    sanitized_health_events:events,
    unsafe_raw_log_retained:false,
    formal_v5_arm:false,
    a0_execution:false,
    o00_started:false,
  };
}
function writeOverride(file){
  fs.writeFileSync(file,[
    "services:",
    "  minio:",
    `    image: ${MINIO_IMAGE}`,
    "  minio-init:",
    `    image: ${MC_IMAGE}`,
    "  evidence-runtime:",
    "    environment:",
    "      GEOX_MCFT_CAP09_ZONE_ID: ${GEOX_PHASE5_EVIDENCE_BURNIN_ZONE_ID:?GEOX_PHASE5_EVIDENCE_BURNIN_ZONE_ID is required}",
    "",
  ].join("\n"),{mode:0o600});
}
function focusedSafety(){
  const pnpm=process.platform==="win32"?"pnpm.cmd":"pnpm";
  for(const script of [
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_REAL_CLOCK_REHEARSAL_BASELINE_V1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_GFS_MEMBER_RETRY_RESILIENCE_V1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_HOST_V1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_TWIN_QUALIFICATION_CLOCK_V1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_QUALIFICATION_COMPOSE_V1.ts",
  ]){
    exec(pnpm,["exec","tsx",script],{capture:false});
  }
}
function stateProofBase(state){
  return {
    schema_version:"geox_mcft_cap09_real_clock_rehearsal_control_v1",
    run_class:"QUALIFICATION_REHEARSAL",
    subject_sha:state.subject_sha,
    project_name:state.project_name,
    a0:state.a0,
    r00:state.r00,
    r23:state.r23,
    formal_v5_arm:false,
    formal_o00_o23:false,
    stage_1b_closure_claim:false,
    mcft_cap09_completion_claim:false,
    production_database_mutation:false,
    production_raw_namespace_mutation:false,
  };
}
async function sleepUntil(targetMs){
  while(Date.now()<targetMs){
    const remaining=targetMs-Date.now();
    await new Promise((resolve)=>setTimeout(resolve,Math.min(60_000,Math.max(1000,remaining))));
  }
}
async function faultController(){
  const {state,statePath,secrets}=loadState();
  req(state.fault_plan?.enabled===true,"REAL_CLOCK_REHEARSAL_FAULT_PLAN_NOT_ENABLED");
  const proofPath=state.fault_plan.proof_path;
  const plannedStop=Date.parse(state.fault_plan.stop_at);
  const plannedRestart=Date.parse(state.fault_plan.restart_at);
  req(Number.isFinite(plannedStop)&&Number.isFinite(plannedRestart)&&plannedRestart>plannedStop,"REAL_CLOCK_REHEARSAL_FAULT_PLAN_INVALID");
  await sleepUntil(plannedStop);

  const fresh=readJson(statePath,"REAL_CLOCK_REHEARSAL_STATE_INVALID");
  if(fresh.status!=="RUNNING"){
    writePrivateJson(proofPath,{...stateProofBase(state),status:"SKIPPED",reason:"REHEARSAL_NOT_RUNNING_AT_FAULT_TIME"});
    return;
  }
  const cursorBefore=query(state,secrets,
    "SELECT COALESCE(next_slot_index,0)::text||'|'||COALESCE(last_fencing_token::text,'') FROM public.twin_shadow_online_scheduler_cursor_v1 LIMIT 1;"
  );
  const [nextBeforeRaw,fenceBeforeRaw=""]=cursorBefore.split("|");
  const nextBefore=Number(nextBeforeRaw||0);
  if(nextBefore!==5){
    writePrivateJson(proofPath,{
      ...stateProofBase(state),status:"FAIL",
      error:"REHEARSAL_FAULT_PRECONDITION_R04_NOT_TERMINAL",
      next_slot_index_before:nextBefore,
    });
    return;
  }

  const before=containerState(state,secrets);
  req(before.running===true,"REAL_CLOCK_REHEARSAL_TWIN_NOT_RUNNING_BEFORE_FAULT");
  compose(state,secrets,["stop","-t","30","twin-runtime"],{capture:false});
  const stoppedAt=new Date().toISOString();
  await sleepUntil(plannedRestart);
  compose(state,secrets,["start","twin-runtime"],{capture:false});
  const restartedAt=new Date().toISOString();

  const deadline=Date.now()+10*MINUTE;
  let row="";
  while(Date.now()<deadline){
    row=query(state,secrets,
      "SELECT slot_id||'|'||state||'|'||fencing_token::text||'|'||scheduler_wall_clock_observed_at::text||'|'||terminal_at::text FROM public.twin_shadow_online_scheduler_slot_v1 WHERE slot_id='O05' LIMIT 1;"
    );
    if(row){
      const parts=row.split("|");
      if(["COMPLETED","DEGRADED","FAILED"].includes(parts[1]))break;
    }
    await new Promise((resolve)=>setTimeout(resolve,5000));
  }
  req(row,"REAL_CLOCK_REHEARSAL_R05_BACKFILL_NOT_OBSERVED");
  const [slotId,slotState,fenceAfter,observedAt,terminalAt]=row.split("|");
  req(slotId==="O05","REAL_CLOCK_REHEARSAL_FAULT_SLOT_ID_MISMATCH");
  req(["COMPLETED","DEGRADED"].includes(slotState),"REAL_CLOCK_REHEARSAL_R05_NOT_SUCCESSFUL_TERMINAL",slotState);
  req(Date.parse(observedAt)>=Date.parse(state.fault_plan.missed_boundary),"REAL_CLOCK_REHEARSAL_R05_NOT_BACKFILLED_AFTER_BOUNDARY");
  if(fenceBeforeRaw)req(BigInt(fenceAfter)>BigInt(fenceBeforeRaw),"REAL_CLOCK_REHEARSAL_FENCING_TOKEN_DID_NOT_ADVANCE");

  writePrivateJson(proofPath,{
    ...stateProofBase(state),
    status:"PASS",
    fault_kind:"CONTROLLED_PROCESS_RESTART_ACROSS_ONE_REAL_UTC_BOUNDARY",
    rehearsal_label:"R05",
    canonical_internal_slot_id:"O05",
    planned_stop_at:state.fault_plan.stop_at,
    stopped_at:stoppedAt,
    missed_boundary:state.fault_plan.missed_boundary,
    planned_restart_at:state.fault_plan.restart_at,
    restarted_at:restartedAt,
    cursor_next_slot_index_before_stop:nextBefore,
    fencing_token_before:fenceBeforeRaw||null,
    fencing_token_after:fenceAfter,
    terminal_state:slotState,
    scheduler_wall_clock_observed_at:observedAt,
    terminal_at:terminalAt,
    oldest_first_backfill_observed:true,
    controlled_restart_recovery_observed:true,
  });
}
function start(){
  req(fs.existsSync(COMPOSE),"REAL_CLOCK_REHEARSAL_COMPOSE_REQUIRED");
  req(git("status","--porcelain")==="","REAL_CLOCK_REHEARSAL_CLEAN_WORKTREE_REQUIRED");
  const subject=git("rev-parse","HEAD");
  req(/^[0-9a-f]{40}$/.test(subject),"REAL_CLOCK_REHEARSAL_HEAD_INVALID");
  const branch=git("rev-parse","--abbrev-ref","HEAD");
  req(branch!=="HEAD","REAL_CLOCK_REHEARSAL_NAMED_BRANCH_REQUIRED");

  if(fs.existsSync(ACTIVE_POINTER)){
    const pointer=readJson(ACTIVE_POINTER,"REAL_CLOCK_REHEARSAL_ACTIVE_POINTER_INVALID");
    if(pointer?.state_path&&fs.existsSync(pointer.state_path)){
      const active=readJson(pointer.state_path,"REAL_CLOCK_REHEARSAL_STATE_INVALID");
      if(active.status==="RUNNING")fail("REAL_CLOCK_REHEARSAL_ALREADY_RUNNING",pointer.state_path);
    }
  }

  focusedSafety();

  const nowMs=Date.now();
  const startedAt=iso(nowMs);
  const a0Ms=strictNextUtcHour(nowMs+LIVE_EVIDENCE_PRE_A0_SELECTION_LEAD);
  const r00Ms=a0Ms+HOUR;
  const r23Ms=a0Ms+24*HOUR;
  const selectedPreA0LeadMs=a0Ms-nowMs;
  req(
    selectedPreA0LeadMs>LIVE_EVIDENCE_PRE_A0_SELECTION_LEAD
      && selectedPreA0LeadMs<=LIVE_EVIDENCE_PRE_A0_SELECTION_LEAD+HOUR,
    "REAL_CLOCK_REHEARSAL_A0_SELECTION_INVALID",
  );
  const runId=stamp(nowMs)+"-"+sha12(subject);
  const runRoot=path.join(STATE_ROOT,subject,runId);
  const controlRoot=path.join(runRoot,"control");
  const fixtureRoot=path.join(runRoot,"fixtures");
  fs.mkdirSync(controlRoot,{recursive:true});
  fs.mkdirSync(fixtureRoot,{recursive:true});

  const projectName=("mcftcap09-rehearsal-"+sha12(subject)+"-"+stamp(nowMs).slice(0,15))
    .replace(/[^a-z0-9_-]/g,"")
    .slice(0,63);
  const databaseName=("geox_mcft_cap09_rehearsal_"+sha12(subject)+"_"+stamp(nowMs).slice(0,14))
    .replace(/[^a-zA-Z0-9_]/g,"")
    .slice(0,63);
  const overridePath=path.join(runRoot,"compose-pins.yml");
  const statePath=path.join(runRoot,"state.json");
  const secretsPath=path.join(runRoot,"secrets.json");
  const faultProofPath=path.join(controlRoot,"rehearsal-fault-proof.json");
  writeOverride(overridePath);

  const state={
    schema_version:"geox_mcft_cap09_real_clock_rehearsal_state_v1",
    status:"PREPARING",
    run_class:"QUALIFICATION_REHEARSAL",
    subject_sha:subject,
    source_branch:branch,
    project_name:projectName,
    started_at:startedAt,
    a0:iso(a0Ms),
    selected_pre_a0_lead_seconds:Math.round(selectedPreA0LeadMs/1000),
    minimum_live_evidence_runtime_before_a0_seconds:
      Math.round(LIVE_EVIDENCE_MINIMUM_RUNTIME_BEFORE_A0/1000),
    r00:iso(r00Ms),
    r23:iso(r23Ms),
    control_root:controlRoot,
    fixture_root:fixtureRoot,
    override_path:overridePath,
    secrets_path:secretsPath,
    prepare_proof_path:path.join(controlRoot,"prepare-proof.json"),
    final_proof_path:path.join(controlRoot,"verify-proof.json"),
    evidence_health_proof_path:path.join(controlRoot,"evidence-runtime-health-proof.json"),
    fault_plan:{
      enabled:!flag("no-fault"),
      rehearsal_label:"R05",
      canonical_internal_slot_id:"O05",
      stop_at:iso(a0Ms+6*HOUR-5*MINUTE),
      missed_boundary:iso(a0Ms+6*HOUR),
      restart_at:iso(a0Ms+6*HOUR+5*MINUTE),
      proof_path:faultProofPath,
    },
    nonclaims:[
      "R00_R23_IS_NOT_O00_O23",
      "NO_FORMAL_V5_EFFECT_FROM_REHEARSAL",
      "NO_STAGE_1B_CLOSURE_FROM_REHEARSAL",
      "NO_MCFT_CAP09_COMPLETION_FROM_REHEARSAL",
    ],
  };
  const secrets={
    GEOX_DEPLOYMENT_SUBJECT_COMMIT:subject,
    GEOX_PHASE5_POSTGRES_USER:"postgres",
    GEOX_PHASE5_POSTGRES_PASSWORD:randomHex(),
    GEOX_PHASE5_MIGRATOR_PASSWORD:randomHex(),
    GEOX_PHASE5_GENERIC_RUNTIME_PASSWORD:randomHex(),
    GEOX_PHASE5_EVIDENCE_DATABASE_PASSWORD:randomHex(),
    GEOX_PHASE5_TWIN_DATABASE_PASSWORD:randomHex(),
    GEOX_PHASE5_MINIO_ACCESS_KEY:"rehearsal"+randomHex(8),
    GEOX_PHASE5_MINIO_SECRET_KEY:randomHex(24),
    GEOX_PHASE5_DATABASE_NAME:databaseName,
    GEOX_PHASE5_RAW_BUCKET:("mcft-cap09-rehearsal-"+sha12(subject)+"-"+stamp(nowMs).slice(0,14)).toLowerCase(),
    GEOX_PHASE5_S3_REGION:"us-east-1",
    GEOX_PHASE5_TENANT_ID:"tenant_mcft_external",
    GEOX_PHASE5_PROJECT_ID:"project_mcft_cap09",
    GEOX_PHASE5_GROUP_ID:"group_public_research",
    GEOX_PHASE5_FIELD_ID:"field_kbs_mcse_t4r1",
    GEOX_PHASE5_SEASON_ID:"season_2026_corn",
    GEOX_PHASE5_ZONE_ID:"zone_kbs_mcse_t4r1_crop_formal_v1",
    GEOX_PHASE5_EVIDENCE_BURNIN_ZONE_ID:"zone_kbs_mcse_t4r1_evidence_burnin_v1",
    GEOX_PHASE5_FIXTURE_ROOT:fixtureRoot,
    GEOX_PHASE5_CONTROL_ROOT:controlRoot,
    GEOX_PHASE5_RUN_CLASS:"REAL_CLOCK_REHEARSAL",
    GEOX_PHASE5_A0:state.a0,
    GEOX_PHASE5_CREATED_AT:state.started_at,
    GEOX_PHASE5_ACCELERATED_THROUGH_LOGICAL_TIME:state.r23,
    GEOX_PHASE5_EVIDENCE_LEASE_DURATION_SECONDS:"300",
    GEOX_PHASE5_EVIDENCE_SUCCESS_CADENCE_MS:"60000",
    GEOX_PHASE5_EVIDENCE_LEASE_STANDBY_MS:"5000",
    GEOX_PHASE5_EVIDENCE_RETRY_BASE_MS:"1000",
    GEOX_PHASE5_EVIDENCE_RETRY_MAXIMUM_MS:"60000",
    GEOX_PHASE5_TWIN_LEASE_DURATION_SECONDS:"300",
    GEOX_PHASE5_TWIN_IDLE_POLL_MS:"5000",
    GEOX_PHASE5_TWIN_NOT_READY_POLL_MS:"15000",
    GEOX_PHASE5_TWIN_TERMINAL_POLL_MS:"0",
    GEOX_PHASE5_TWIN_RETRY_BASE_MS:"1000",
    GEOX_PHASE5_TWIN_RETRY_MAXIMUM_MS:"60000",
  };
  writePrivateJson(secretsPath,secrets);
  writePrivateJson(statePath,state);
  writePrivateJson(ACTIVE_POINTER,{state_path:statePath,subject_sha:subject,project_name:projectName});

  try{
    compose(state,secrets,["build","database-platform-bootstrap"],{capture:false});
    compose(state,secrets,["up","-d","postgres","minio"],{capture:false});
    compose(state,secrets,["run","--rm","--no-deps","minio-init"],{capture:false});
    compose(state,secrets,["run","--rm","--no-deps","database-platform-bootstrap"],{capture:false});
    compose(state,secrets,["run","--rm","--no-deps","service-principal-bootstrap"],{capture:false});
    compose(state,secrets,["--profile","qualification-orchestration","run","--rm","--no-deps","qualification-prepare"],{capture:false});

    const prepare=readJson(state.prepare_proof_path,"REAL_CLOCK_REHEARSAL_PREPARE_PROOF_INVALID");
    req(prepare.status==="PASS","REAL_CLOCK_REHEARSAL_PREPARE_NOT_PASS");
    req(prepare.run_class==="QUALIFICATION_REHEARSAL","REAL_CLOCK_REHEARSAL_PREPARE_RUN_CLASS_MISMATCH");
    req(prepare.engineering_bootstrap_fixture_count===49,"REAL_CLOCK_REHEARSAL_BASELINE_COUNT_MISMATCH");
    req(prepare.rehearsal_is_non_authority_bearing===true,"REAL_CLOCK_REHEARSAL_PREPARE_NONAUTHORITY_REQUIRED");
    req(prepare.formal_evidence_claim===false&&prepare.formal_v5_arm===false&&prepare.stage_1b_closure_claim===false,"REAL_CLOCK_REHEARSAL_PREPARE_CEILING_DRIFT");

    compose(state,secrets,["--profile","qualification-runtime","up","-d","--no-deps","evidence-runtime","twin-runtime"],{capture:false});
    const deadline=Date.now()+120_000;
    let twinCurrent;
    let evidenceCurrent;
    do{
      twinCurrent=containerState(state,secrets,"twin-runtime");
      evidenceCurrent=containerState(state,secrets,"evidence-runtime");
      if(twinCurrent.running&&evidenceCurrent.running)break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2000);
    }while(Date.now()<deadline);
    req(twinCurrent?.running===true,"REAL_CLOCK_REHEARSAL_TWIN_START_FAILED");
    req(evidenceCurrent?.running===true,"REAL_CLOCK_REHEARSAL_EVIDENCE_START_FAILED");

    state.status="RUNNING";
    state.twin_container_id=twinCurrent.id;
    state.evidence_container_id=evidenceCurrent.id;
    state.twin_started_readback_at=new Date().toISOString();
    state.evidence_started_readback_at=state.twin_started_readback_at;
    const evidenceRuntimePreA0Ms=
      Date.parse(state.a0)-Date.parse(state.evidence_started_readback_at);
    req(
      evidenceRuntimePreA0Ms>=LIVE_EVIDENCE_MINIMUM_RUNTIME_BEFORE_A0,
      "REAL_CLOCK_REHEARSAL_EVIDENCE_RUNTIME_PRE_A0_WINDOW_TOO_SHORT",
      JSON.stringify({
        evidence_started_readback_at:state.evidence_started_readback_at,
        a0:state.a0,
        available_seconds:Math.floor(evidenceRuntimePreA0Ms/1000),
        required_seconds:Math.floor(LIVE_EVIDENCE_MINIMUM_RUNTIME_BEFORE_A0/1000),
      }),
    );
    state.evidence_runtime_pre_a0_seconds=Math.floor(evidenceRuntimePreA0Ms/1000);
    if(state.fault_plan.enabled){
      const logFd=fs.openSync(path.join(controlRoot,"fault-controller.log"),"a");
      const child=cp.spawn(process.execPath,[__filename,"fault-controller","--state="+statePath],{
        cwd:ROOT,detached:true,stdio:["ignore",logFd,logFd],env:process.env,
      });
      child.unref();
      state.fault_plan.controller_pid=child.pid??null;
    }
    writePrivateJson(statePath,state);

    console.log(JSON.stringify({
      ...stateProofBase(state),
      status:"RUNNING",
      state_path:statePath,
      source_branch:branch,
      started_at:state.started_at,
      r00:state.r00,
      r23:state.r23,
      evidence_container_running:true,
      twin_container_running:true,
      live_production_evidence_runtime:true,
      live_production_provider_path:true,
      evidence_runtime_pre_a0_seconds:state.evidence_runtime_pre_a0_seconds,
      automatic_fault_plan:state.fault_plan.enabled?{
        label:"R05",
        stop_at:state.fault_plan.stop_at,
        restart_at:state.fault_plan.restart_at,
        purpose:"CONTROLLED_RESTART_PLUS_ONE_MISSED_BOUNDARY_OLDEST_FIRST_BACKFILL",
      }:null,
      twin_progress_uses_controlled_baseline:true,
      evidence_runtime_live_provider_burn_in:true,
      formal_closure_substituted:false,
    },null,2));
  }catch(error){
    state.status="START_FAILED";
    state.start_error=error instanceof Error?error.message:String(error);
    writePrivateJson(statePath,state);
    throw error;
  }
}
function status(){
  const {state,secrets}=loadState();
  const container=containerState(state,secrets,"twin-runtime");
  const evidenceContainer=containerState(state,secrets,"evidence-runtime");
  let slots="0|0|0|0";
  let cursor="";
  try{
    slots=query(state,secrets,
      "SELECT count(*)::text||'|'||count(*) FILTER (WHERE state='COMPLETED')::text||'|'||count(*) FILTER (WHERE state='DEGRADED')::text||'|'||count(*) FILTER (WHERE state='FAILED')::text FROM public.twin_shadow_online_scheduler_slot_v1;"
    );
    cursor=query(state,secrets,
      "SELECT next_slot_index::text||'|'||COALESCE(next_slot_id,'')||'|'||COALESCE(last_terminal_slot_id,'')||'|'||COALESCE(last_terminal_logical_time::text,'') FROM public.twin_shadow_online_scheduler_cursor_v1 LIMIT 1;"
    );
  }catch{}
  const [slotCount,completed,degraded,failed]=slots.split("|").map((v)=>Number(v||0));
  const faultProof=state.fault_plan?.proof_path&&fs.existsSync(state.fault_plan.proof_path)
    ?readJson(state.fault_plan.proof_path,"REAL_CLOCK_REHEARSAL_FAULT_PROOF_INVALID")
    :null;
  console.log(JSON.stringify({
    ...stateProofBase(state),
    status:state.status,
    now:new Date().toISOString(),
    container,
    evidence_container:evidenceContainer,
    scheduler:{slot_count:slotCount,completed,degraded,failed,cursor_raw:cursor||null},
    fault_proof_status:faultProof?.status??"PENDING",
    seconds_until_r23:Math.round((Date.parse(state.r23)-Date.now())/1000),
  },null,2));
}
function finalize(){
  const {state,statePath,secrets}=loadState();
  req(state.status==="RUNNING","REAL_CLOCK_REHEARSAL_FINALIZE_REQUIRES_RUNNING_STATE",state.status);
  req(Date.now()>=Date.parse(state.r23),"REAL_CLOCK_REHEARSAL_FINALIZE_BEFORE_R23_FORBIDDEN",state.r23);
  if(state.fault_plan?.enabled){
    req(fs.existsSync(state.fault_plan.proof_path),"REAL_CLOCK_REHEARSAL_FAULT_PROOF_REQUIRED");
    const fault=readJson(state.fault_plan.proof_path,"REAL_CLOCK_REHEARSAL_FAULT_PROOF_INVALID");
    req(fault.status==="PASS","REAL_CLOCK_REHEARSAL_FAULT_PROOF_NOT_PASS",fault.status);
  }
  const twinContainer=containerState(state,secrets,"twin-runtime");
  const evidenceContainer=containerState(state,secrets,"evidence-runtime");
  req(twinContainer.running===true,"REAL_CLOCK_REHEARSAL_TWIN_NOT_RUNNING_AT_FINALIZE");
  req(evidenceContainer.running===true,"REAL_CLOCK_REHEARSAL_EVIDENCE_NOT_RUNNING_AT_FINALIZE");
  const evidenceProof=evidenceRuntimeHealthProof(state,secrets);
  writePrivateJson(state.evidence_health_proof_path,evidenceProof);
  req(evidenceProof.status==="PASS","REAL_CLOCK_REHEARSAL_EVIDENCE_HEALTH_PROOF_NOT_PASS",JSON.stringify({
    host_start_count:evidenceProof.host_start_count,
    provider_attempt_outcome_count:evidenceProof.provider_attempt_outcome_count,
    fatal_attempt_failure_count:evidenceProof.fatal_attempt_failure_count,
  }));
  compose(state,secrets,["--profile","qualification-orchestration","run","--rm","--no-deps","qualification-verify"],{capture:false});
  const proof=readJson(state.final_proof_path,"REAL_CLOCK_REHEARSAL_FINAL_PROOF_INVALID");
  req(proof.status==="PASS","REAL_CLOCK_REHEARSAL_FINAL_PROOF_NOT_PASS");
  req(proof.run_class==="QUALIFICATION_REHEARSAL","REAL_CLOCK_REHEARSAL_FINAL_RUN_CLASS_MISMATCH");
  req(proof.scheduler_slot_count===24&&proof.terminal_tick_count===24,"REAL_CLOCK_REHEARSAL_EXACT_24_TERMINALS_REQUIRED");
  req(proof.qualification_rehearsal_baseline_fact_count===49,"REAL_CLOCK_REHEARSAL_BASELINE_READBACK_REQUIRED");
  req(proof.rehearsal_is_non_authority_bearing===true&&proof.formal_closure_substituted_by_rehearsal===false,"REAL_CLOCK_REHEARSAL_FINAL_NONCLAIM_DRIFT");

  state.status="COMPLETE";
  state.completed_at=new Date().toISOString();
  state.final_proof_status="PASS";
  writePrivateJson(statePath,state);
  console.log(JSON.stringify({
    ...stateProofBase(state),
    status:"PASS",
    completed_at:state.completed_at,
    scheduler_slot_count:proof.scheduler_slot_count,
    terminal_tick_count:proof.terminal_tick_count,
    rehearsal_labels:"R00-R23",
    runtime_clock:"SYSTEM_AND_POSTGRESQL_UTC_WALL_CLOCK",
    controlled_restart_backfill:state.fault_plan?.enabled?"PASS":"NOT_REQUESTED",
    live_production_evidence_runtime:"PASS",
    evidence_provider_attempt_outcome_count:evidenceProof.provider_attempt_outcome_count,
    evidence_retryable_attempt_failure_count:evidenceProof.retryable_attempt_failure_count,
    evidence_fatal_attempt_failure_count:evidenceProof.fatal_attempt_failure_count,
    evidence_health_proof_path:state.evidence_health_proof_path,
    formal_closure_substituted:false,
    next_action:"KEEP_PROOFS_THEN_RUN_FULL_EXACT_HEAD_QUALIFICATION_BEFORE_ANY_FORMAL_ARM",
  },null,2));
}
function cleanup(){
  const {state,statePath,secrets}=loadState();
  compose(state,secrets,["--profile","qualification-runtime","--profile","qualification-orchestration","down","-v","--remove-orphans"],{capture:false});
  state.status="CLEANED";
  state.cleaned_at=new Date().toISOString();
  writePrivateJson(statePath,state);
  if(fs.existsSync(ACTIVE_POINTER)){
    const pointer=readJson(ACTIVE_POINTER,"REAL_CLOCK_REHEARSAL_ACTIVE_POINTER_INVALID");
    if(pointer.state_path===statePath)fs.rmSync(ACTIVE_POINTER,{force:true});
  }
  console.log(JSON.stringify({...stateProofBase(state),status:"CLEANED",proofs_preserved_under:state.control_root},null,2));
}
function selftest(){
  const now=Date.parse("2030-01-01T00:29:30.000Z");
  const a0=strictNextUtcHour(now+LIVE_EVIDENCE_PRE_A0_SELECTION_LEAD);
  req(iso(a0)==="2030-01-01T03:00:00.000Z","SELFTEST_A0");
  req(iso(a0+HOUR)==="2030-01-01T04:00:00.000Z","SELFTEST_R00");
  req(iso(a0+24*HOUR)==="2030-01-02T03:00:00.000Z","SELFTEST_R23");
  req(iso(a0+6*HOUR)==="2030-01-01T09:00:00.000Z","SELFTEST_R05");
  req(
    a0-now>LIVE_EVIDENCE_PRE_A0_SELECTION_LEAD
      && a0-now<=LIVE_EVIDENCE_PRE_A0_SELECTION_LEAD+HOUR,
    "SELFTEST_PRE_A0_SELECTION_LEAD",
  );
  req(
    LIVE_EVIDENCE_MINIMUM_RUNTIME_BEFORE_A0===45*MINUTE,
    "SELFTEST_MINIMUM_LIVE_EVIDENCE_PRE_A0_RUNTIME",
  );
  console.log(JSON.stringify({
    schema_version:"geox_mcft_cap09_real_clock_rehearsal_launcher_selftest_v1",
    status:"PASS",
    run_class:"QUALIFICATION_REHEARSAL",
    formal_effect:false,
    production_effect:false,
  },null,2));
}

(async()=>{
  const mode=process.argv[2]??"";
  try{
    if(mode==="--selftest"||mode==="selftest")selftest();
    else if(mode==="start")start();
    else if(mode==="status")status();
    else if(mode==="finalize")finalize();
    else if(mode==="cleanup")cleanup();
    else if(mode==="fault-controller")await faultController();
    else fail("REAL_CLOCK_REHEARSAL_MODE_REQUIRED","start|status|finalize|cleanup|selftest");
  }catch(error){
    console.error(error instanceof Error?error.stack??error.message:String(error));
    process.exitCode=1;
  }
})();
