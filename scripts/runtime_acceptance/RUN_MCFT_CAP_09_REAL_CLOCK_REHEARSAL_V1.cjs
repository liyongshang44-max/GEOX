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
const REHEARSAL_CROP_AUTHORITY_SOURCE=path.join(ROOT,"docs","digital_twin","mcft","cap_09","GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json");
const HOUR=3_600_000;
const MINUTE=60_000;
const DAY=24*HOUR;

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
function rehearsalPlantingWindow(a0Ms){
  req(Number.isFinite(a0Ms),"REAL_CLOCK_REHEARSAL_A0_MS_INVALID");
  const startMs=a0Ms-85*DAY;
  const endMs=startMs+DAY;
  const earliestGuardMs=a0Ms-5*HOUR;
  const latestGuardMs=a0Ms+54*HOUR;
  const minimumAgeDays=(earliestGuardMs-endMs)/DAY;
  const maximumAgeDays=(latestGuardMs-startMs)/DAY;
  req(minimumAgeDays>80&&maximumAgeDays<95,"REAL_CLOCK_REHEARSAL_SYNTHETIC_MID_WINDOW_INVALID",minimumAgeDays+":"+maximumAgeDays);
  return {
    start_inclusive:iso(startMs),
    end_exclusive:iso(endMs),
    minimum_age_days:minimumAgeDays,
    maximum_age_days:maximumAgeDays,
  };
}
function buildRehearsalCropAuthorityFixture(a0Ms,outPath){
  req(fs.existsSync(REHEARSAL_CROP_AUTHORITY_SOURCE),"REAL_CLOCK_REHEARSAL_CROP_AUTHORITY_SOURCE_REQUIRED");
  const base=readJson(REHEARSAL_CROP_AUTHORITY_SOURCE,"REAL_CLOCK_REHEARSAL_CROP_AUTHORITY_SOURCE_INVALID");
  req(base.schema_version==="geox_mcft_cap09_s6_formal_crop_context_authority_v3","REAL_CLOCK_REHEARSAL_CROP_AUTHORITY_SCHEMA_INVALID");
  const window=rehearsalPlantingWindow(a0Ms);
  const fixture=JSON.parse(JSON.stringify(base));
  fixture.planting_authority={
    ...fixture.planting_authority,
    possible_event_window_utc:{
      start_inclusive:window.start_inclusive,
      end_exclusive:window.end_exclusive,
    },
  };
  fixture.qualification_rehearsal_overlay={
    schema_version:"geox_mcft_cap09_real_clock_rehearsal_crop_authority_overlay_v1",
    status:"CONTROLLED_ENGINEERING_FIXTURE",
    synthetic_planting_window:true,
    original_planting_event_not_claimed:true,
    provider_observation_truth_claimed:false,
    production_authority:false,
    formal_evidence_claim:false,
    stage_1b_closure_claim:false,
    purpose:"KEEP_EXISTING_A18_V3_MATERIALIZER_INSIDE_STABLE_MID_TEST_ENVELOPE_WITHOUT_CHANGING_RUNTIME_KERNEL",
    synthetic_window_start:window.start_inclusive,
    synthetic_window_end_exclusive:window.end_exclusive,
    minimum_guarded_age_days:window.minimum_age_days,
    maximum_guarded_age_days:window.maximum_age_days,
  };
  writePrivateJson(outPath,fixture);
  return fixture.qualification_rehearsal_overlay;
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
function containerState(state,secrets){
  const id=compose(state,secrets,["ps","-q","twin-runtime"]).trim();
  if(!id)return {id:"",running:false,status:"ABSENT"};
  const raw=exec("docker",["inspect","-f","{{json .State}}",id]);
  const parsed=JSON.parse(raw);
  return {id,running:parsed.Running===true,status:String(parsed.Status??""),restart_count:Number(parsed.RestartCount??0)};
}
function waitForPostgresInitComplete(state,secrets){
  const deadline=Date.now()+180_000;
  let initComplete=false;
  let factsReady=false;
  let lastLogs="";
  while(Date.now()<deadline){
    try{
      lastLogs=compose(state,secrets,["logs","--no-color","postgres"]);
      initComplete=lastLogs.includes("PostgreSQL init process complete; ready for start up.");
    }catch{}
    if(initComplete){
      try{
        factsReady=query(
          state,
          secrets,
          "SELECT CASE WHEN to_regclass('public.facts') IS NULL THEN '0' ELSE '1' END;"
        )==="1";
      }catch{}
    }
    if(initComplete&&factsReady)return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);
  }
  fail(
    "REAL_CLOCK_REHEARSAL_POSTGRES_INIT_NOT_COMPLETE",
    "init_complete="+String(initComplete)+",facts_ready="+String(factsReady)
  );
}
function writeOverride(file){
  fs.writeFileSync(file,[
    "services:",
    "  minio:",
    `    image: ${MINIO_IMAGE}`,
    "  minio-init:",
    `    image: ${MC_IMAGE}`,
    "  qualification-prepare:",
    "    environment:",
    "      GEOX_MCFT_CAP09_TWIN_RUNTIME_CROP_AUTHORITY_PATH: /qualification/rehearsal-crop-authority.json",
    "    volumes:",
    "      - type: bind",
    "        source: ${GEOX_PHASE5_REHEARSAL_CROP_AUTHORITY_PATH}",
    "        target: /qualification/rehearsal-crop-authority.json",
    "        read_only: true",
    "  twin-runtime:",
    "    environment:",
    "      GEOX_MCFT_CAP09_TWIN_RUNTIME_CROP_AUTHORITY_PATH: /qualification/rehearsal-crop-authority.json",
    "    volumes:",
    "      - type: bind",
    "        source: ${GEOX_PHASE5_REHEARSAL_CROP_AUTHORITY_PATH}",
    "        target: /qualification/rehearsal-crop-authority.json",
    "        read_only: true",
    "",
  ].join("\n"),{mode:0o600});
}
function focusedSafety(){
  const pnpm=process.platform==="win32"?"pnpm.cmd":"pnpm";
  for(const script of [
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_REAL_CLOCK_REHEARSAL_BASELINE_V1.ts",
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
function supplementalFaultProofPath(state){
  return path.join(state.control_root,"rehearsal-fault-proof-supplemental.json");
}
function slotIdV1(index){
  req(Number.isInteger(index)&&index>=0&&index<=23,"REAL_CLOCK_REHEARSAL_SLOT_INDEX_INVALID",index);
  return "O"+String(index).padStart(2,"0");
}
function rehearsalLabelV1(index){
  req(Number.isInteger(index)&&index>=0&&index<=23,"REAL_CLOCK_REHEARSAL_LABEL_INDEX_INVALID",index);
  return "R"+String(index).padStart(2,"0");
}
function readSchedulerCursorV1(state,secrets){
  const raw=query(state,secrets,
    "SELECT COALESCE(next_slot_index,0)::text||'|'||COALESCE(last_fencing_token::text,'') FROM public.twin_shadow_online_scheduler_cursor_v1 LIMIT 1;"
  );
  const [nextRaw,fenceRaw=""]=raw.split("|");
  return {raw,next_slot_index:Number(nextRaw||0),fencing_token:fenceRaw};
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
  const missedBoundary=Date.parse(state.fault_plan.missed_boundary);
  req(Number.isFinite(missedBoundary),"REAL_CLOCK_REHEARSAL_FAULT_MISSED_BOUNDARY_INVALID");
  let cursorBefore="";
  let nextBefore=0;
  let fenceBeforeRaw="";
  while(Date.now()<missedBoundary){
    cursorBefore=query(state,secrets,
      "SELECT COALESCE(next_slot_index,0)::text||'|'||COALESCE(last_fencing_token::text,'') FROM public.twin_shadow_online_scheduler_cursor_v1 LIMIT 1;"
    );
    const parts=cursorBefore.split("|");
    nextBefore=Number(parts[0]||0);
    fenceBeforeRaw=parts[1]??"";
    if(nextBefore===5)break;
    await new Promise((resolve)=>setTimeout(resolve,1000));
  }
  if(nextBefore!==5){
    writePrivateJson(proofPath,{
      ...stateProofBase(state),status:"FAIL",
      error:"REHEARSAL_FAULT_PRECONDITION_R04_NOT_TERMINAL_BY_R05_BOUNDARY",
      next_slot_index_before:nextBefore,
      observed_at:new Date().toISOString(),
      missed_boundary:state.fault_plan.missed_boundary,
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

function armSupplementalFault(){
  const {state,statePath,secrets}=loadState();
  req(state.status==="RUNNING","REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_FAULT_REQUIRES_RUNNING_STATE",state.status);
  req(state.fault_plan?.enabled===true,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_FAULT_PLAN_NOT_ENABLED");
  req(fs.existsSync(state.fault_plan.proof_path),"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_ORIGINAL_FAULT_PROOF_REQUIRED");
  const original=readJson(state.fault_plan.proof_path,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_ORIGINAL_FAULT_PROOF_INVALID");
  req(
    original.status==="FAIL"&&[
      "REHEARSAL_FAULT_PRECONDITION_R04_NOT_TERMINAL",
      "REHEARSAL_FAULT_PRECONDITION_R04_NOT_TERMINAL_BY_R05_BOUNDARY",
    ].includes(String(original.error??"")),
    "REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_ONLY_FOR_CONTROLLER_TIMING_DEFECT",
    String(original.status??"")+":"+String(original.error??"")
  );
  const proofPath=supplementalFaultProofPath(state);
  if(fs.existsSync(proofPath)){
    const existing=readJson(proofPath,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_FAULT_PROOF_INVALID");
    req(!["PLANNED","RUNNING","PASS"].includes(String(existing.status??"")),"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_FAULT_ALREADY_ACTIVE",existing.status);
  }
  const cursor=readSchedulerCursorV1(state,secrets);
  req(Number.isInteger(cursor.next_slot_index)&&cursor.next_slot_index>=0,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_CURSOR_INVALID",cursor.raw);
  const r00Ms=Date.parse(state.r00);
  const r23Ms=Date.parse(state.r23);
  req(Number.isFinite(r00Ms)&&Number.isFinite(r23Ms),"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_WINDOW_INVALID");
  let targetIndex=cursor.next_slot_index;
  let boundaryMs=r00Ms+targetIndex*HOUR;
  if(boundaryMs-Date.now()<10*MINUTE){
    targetIndex+=1;
    boundaryMs=r00Ms+targetIndex*HOUR;
  }
  req(targetIndex<=22&&boundaryMs<r23Ms,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_NO_SAFE_FUTURE_BOUNDARY",targetIndex);
  const plan={
    ...stateProofBase(state),
    status:"PLANNED",
    proof_kind:"SUPPLEMENTAL_CONTROLLED_FAULT_AFTER_ORIGINAL_CONTROLLER_TIMING_DEFECT",
    original_fault_proof_path:state.fault_plan.proof_path,
    original_fault_status:original.status,
    original_fault_error:original.error,
    target_slot_index:targetIndex,
    rehearsal_label:rehearsalLabelV1(targetIndex),
    canonical_internal_slot_id:slotIdV1(targetIndex),
    planned_stop_at:iso(boundaryMs-5*MINUTE),
    missed_boundary:iso(boundaryMs),
    planned_restart_at:iso(boundaryMs+5*MINUTE),
    runtime_subject_sha:state.subject_sha,
    control_script_head:git("rev-parse","HEAD"),
  };
  writePrivateJson(proofPath,plan);
  const logFd=fs.openSync(path.join(state.control_root,"supplemental-fault-controller.log"),"a");
  const child=cp.spawn(process.execPath,[__filename,"supplemental-fault-controller","--state="+statePath,"--target-index="+String(targetIndex)],{
    detached:true,
    stdio:["ignore",logFd,logFd],
    cwd:ROOT,
  });
  child.unref();
  console.log(JSON.stringify({...plan,controller_pid:child.pid??null},null,2));
}
async function supplementalFaultController(){
  const {state,secrets}=loadState();
  const targetIndex=Number(arg("target-index"));
  req(Number.isInteger(targetIndex)&&targetIndex>=0&&targetIndex<=22,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_TARGET_INDEX_INVALID",targetIndex);
  const proofPath=supplementalFaultProofPath(state);
  req(fs.existsSync(proofPath),"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_PLAN_REQUIRED");
  const plan=readJson(proofPath,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_PLAN_INVALID");
  req(plan.status==="PLANNED","REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_PLAN_STATUS_INVALID",plan.status);
  req(plan.target_slot_index===targetIndex,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_TARGET_MISMATCH");
  const plannedStop=Date.parse(plan.planned_stop_at);
  const missedBoundary=Date.parse(plan.missed_boundary);
  const plannedRestart=Date.parse(plan.planned_restart_at);
  req(Number.isFinite(plannedStop)&&Number.isFinite(missedBoundary)&&Number.isFinite(plannedRestart),"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_TIMING_INVALID");
  await sleepUntil(plannedStop);
  const fresh=loadState().state;
  if(fresh.status!=="RUNNING"){
    writePrivateJson(proofPath,{...plan,status:"SKIPPED",reason:"REHEARSAL_NOT_RUNNING_AT_SUPPLEMENTAL_FAULT_TIME"});
    return;
  }
  let cursor=readSchedulerCursorV1(state,secrets);
  while(Date.now()<missedBoundary&&cursor.next_slot_index!==targetIndex){
    if(cursor.next_slot_index>targetIndex){
      writePrivateJson(proofPath,{...plan,status:"FAIL",error:"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_TARGET_ALREADY_PASSED",cursor_raw:cursor.raw});
      return;
    }
    await new Promise((resolve)=>setTimeout(resolve,1000));
    cursor=readSchedulerCursorV1(state,secrets);
  }
  if(cursor.next_slot_index!==targetIndex){
    writePrivateJson(proofPath,{
      ...plan,status:"FAIL",
      error:"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_PREVIOUS_SLOT_NOT_TERMINAL_BY_TARGET_BOUNDARY",
      cursor_raw:cursor.raw,
      observed_at:new Date().toISOString(),
    });
    return;
  }
  const before=containerState(state,secrets);
  req(before.running===true,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_TWIN_NOT_RUNNING_BEFORE_FAULT");
  writePrivateJson(proofPath,{...plan,status:"RUNNING",cursor_next_slot_index_before_stop:cursor.next_slot_index,fencing_token_before:cursor.fencing_token||null});
  compose(state,secrets,["stop","-t","30","twin-runtime"],{capture:false});
  const stoppedAt=new Date().toISOString();
  await sleepUntil(plannedRestart);
  compose(state,secrets,["start","twin-runtime"],{capture:false});
  const restartedAt=new Date().toISOString();

  const slotId=slotIdV1(targetIndex);
  const deadline=Date.now()+10*MINUTE;
  let row="";
  while(Date.now()<deadline){
    row=query(state,secrets,
      "SELECT slot_id||'|'||state||'|'||fencing_token::text||'|'||scheduler_wall_clock_observed_at::text||'|'||terminal_at::text FROM public.twin_shadow_online_scheduler_slot_v1 WHERE slot_id='"+slotId+"' LIMIT 1;"
    );
    if(row){
      const parts=row.split("|");
      if(["COMPLETED","DEGRADED","FAILED"].includes(parts[1]))break;
    }
    await new Promise((resolve)=>setTimeout(resolve,5000));
  }
  req(row,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_BACKFILL_NOT_OBSERVED",slotId);
  const [observedSlotId,slotState,fenceAfter,observedAt,terminalAt]=row.split("|");
  req(observedSlotId===slotId,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_SLOT_ID_MISMATCH",observedSlotId);
  req(["COMPLETED","DEGRADED"].includes(slotState),"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_NOT_SUCCESSFUL_TERMINAL",slotState);
  req(Date.parse(observedAt)>=missedBoundary,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_NOT_BACKFILLED_AFTER_BOUNDARY",observedAt);
  if(cursor.fencing_token)req(BigInt(fenceAfter)>BigInt(cursor.fencing_token),"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_FENCING_TOKEN_DID_NOT_ADVANCE");

  writePrivateJson(proofPath,{
    ...plan,
    status:"PASS",
    fault_kind:"CONTROLLED_PROCESS_RESTART_ACROSS_ONE_REAL_UTC_BOUNDARY",
    stopped_at:stoppedAt,
    restarted_at:restartedAt,
    cursor_next_slot_index_before_stop:cursor.next_slot_index,
    fencing_token_before:cursor.fencing_token||null,
    fencing_token_after:fenceAfter,
    terminal_state:slotState,
    scheduler_wall_clock_observed_at:observedAt,
    terminal_at:terminalAt,
    oldest_first_backfill_observed:true,
    controlled_restart_recovery_observed:true,
    original_fault_failure_preserved:true,
    supplemental_proof_substitutes_only_fault_mechanics_proof:true,
    formal_evidence_claim:false,
    stage_1b_closure_claim:false,
  });
}


async function recoverSupplementalFault(){
  const {state,secrets}=loadState();
  req(state.status==="RUNNING","REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_REQUIRES_RUNNING_STATE",state.status);
  const proofPath=supplementalFaultProofPath(state);
  req(fs.existsSync(proofPath),"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_PROOF_REQUIRED");
  const proof=readJson(proofPath,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_PROOF_INVALID");
  if(proof.status==="PASS"){
    console.log(JSON.stringify(proof,null,2));
    return;
  }
  req(proof.status==="RUNNING","REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_REQUIRES_RUNNING_PROOF",proof.status);
  const targetIndex=Number(proof.target_slot_index);
  req(Number.isInteger(targetIndex)&&targetIndex>=0&&targetIndex<=22,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_TARGET_INVALID",targetIndex);
  const slotId=slotIdV1(targetIndex);
  req(proof.canonical_internal_slot_id===slotId,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_SLOT_MISMATCH",proof.canonical_internal_slot_id);
  const missedBoundary=Date.parse(proof.missed_boundary);
  req(Number.isFinite(missedBoundary)&&Date.now()>missedBoundary,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_BOUNDARY_NOT_MISSED",proof.missed_boundary);

  const cursorBeforeRecovery=readSchedulerCursorV1(state,secrets);
  req(
    cursorBeforeRecovery.next_slot_index===targetIndex || cursorBeforeRecovery.next_slot_index>targetIndex,
    "REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_CURSOR_INVALID",
    cursorBeforeRecovery.raw
  );

  function targetRow(){
    return query(state,secrets,
      "SELECT slot_id||'|'||state||'|'||fencing_token::text||'|'||scheduler_wall_clock_observed_at::text||'|'||terminal_at::text FROM public.twin_shadow_online_scheduler_slot_v1 WHERE slot_id='"+slotId+"' LIMIT 1;"
    );
  }
  let row=targetRow();
  let recoveredStartAt=null;
  if(!row || !["COMPLETED","DEGRADED"].includes(row.split("|")[1])){
    const running=containerState(state,secrets);
    if(!running.running){
      try{
        compose(state,secrets,["start","twin-runtime"],{capture:false});
      }catch{}
      await new Promise((resolve)=>setTimeout(resolve,3000));
      if(!containerState(state,secrets).running){
        compose(state,secrets,["--profile","qualification-runtime","up","-d","--no-deps","twin-runtime"],{capture:false});
      }
      recoveredStartAt=new Date().toISOString();
    }
    req(containerState(state,secrets).running===true,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_TWIN_NOT_RUNNING_AFTER_START");

    const deadline=Date.now()+10*MINUTE;
    while(Date.now()<deadline){
      row=targetRow();
      if(row){
        const parts=row.split("|");
        if(["COMPLETED","DEGRADED","FAILED"].includes(parts[1]))break;
      }
      await new Promise((resolve)=>setTimeout(resolve,5000));
    }
  }

  req(row,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_BACKFILL_NOT_OBSERVED",slotId);
  const [observedSlotId,slotState,fenceAfter,observedAt,terminalAt]=row.split("|");
  req(observedSlotId===slotId,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_SLOT_ID_MISMATCH",observedSlotId);
  req(["COMPLETED","DEGRADED"].includes(slotState),"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_NOT_SUCCESSFUL_TERMINAL",slotState);
  req(Date.parse(observedAt)>=missedBoundary,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_NOT_BACKFILLED_AFTER_BOUNDARY",observedAt);
  const fenceBefore=String(proof.fencing_token_before??"");
  if(fenceBefore)req(BigInt(fenceAfter)>BigInt(fenceBefore),"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_RECOVERY_FENCING_TOKEN_DID_NOT_ADVANCE");

  const finalProof={
    ...proof,
    status:"PASS",
    recovered_after_controller_restart_gap:true,
    recovery_command:"recover-supplemental-fault",
    recovery_started_at:recoveredStartAt,
    recovery_observed_at:new Date().toISOString(),
    cursor_next_slot_index_before_recovery:cursorBeforeRecovery.next_slot_index,
    fencing_token_after:fenceAfter,
    terminal_state:slotState,
    scheduler_wall_clock_observed_at:observedAt,
    terminal_at:terminalAt,
    oldest_first_backfill_observed:true,
    controlled_restart_recovery_observed:true,
    original_fault_failure_preserved:true,
    supplemental_proof_substitutes_only_fault_mechanics_proof:true,
    formal_evidence_claim:false,
    stage_1b_closure_claim:false,
  };
  writePrivateJson(proofPath,finalProof);
  console.log(JSON.stringify(finalProof,null,2));
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
  const a0Ms=strictNextUtcHour(nowMs);
  const r00Ms=a0Ms+HOUR;
  const r23Ms=a0Ms+24*HOUR;
  req(a0Ms-nowMs>0&&a0Ms-nowMs<=HOUR,"REAL_CLOCK_REHEARSAL_A0_SELECTION_INVALID");
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
  const cropAuthorityFixturePath=path.join(fixtureRoot,"rehearsal-crop-authority-v1.json");
  writeOverride(overridePath);
  const cropAuthorityFixture=buildRehearsalCropAuthorityFixture(a0Ms,cropAuthorityFixturePath);

  const state={
    schema_version:"geox_mcft_cap09_real_clock_rehearsal_state_v1",
    status:"PREPARING",
    run_class:"QUALIFICATION_REHEARSAL",
    subject_sha:subject,
    source_branch:branch,
    project_name:projectName,
    started_at:startedAt,
    a0:iso(a0Ms),
    r00:iso(r00Ms),
    r23:iso(r23Ms),
    control_root:controlRoot,
    fixture_root:fixtureRoot,
    override_path:overridePath,
    secrets_path:secretsPath,
    prepare_proof_path:path.join(controlRoot,"prepare-proof.json"),
    final_proof_path:path.join(controlRoot,"verify-proof.json"),
    crop_authority_fixture_path:cropAuthorityFixturePath,
    crop_authority_fixture:cropAuthorityFixture,
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
    GEOX_PHASE5_FIXTURE_ROOT:fixtureRoot,
    GEOX_PHASE5_CONTROL_ROOT:controlRoot,
    GEOX_PHASE5_REHEARSAL_CROP_AUTHORITY_PATH:cropAuthorityFixturePath,
    GEOX_PHASE5_RUN_CLASS:"REAL_CLOCK_REHEARSAL",
    GEOX_PHASE5_A0:state.a0,
    GEOX_PHASE5_CREATED_AT:state.started_at,
    GEOX_PHASE5_ACCELERATED_THROUGH_LOGICAL_TIME:state.r23,
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
    waitForPostgresInitComplete(state,secrets);
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

    compose(state,secrets,["--profile","qualification-runtime","up","-d","--no-deps","twin-runtime"],{capture:false});
    const deadline=Date.now()+120_000;
    let current;
    do{
      current=containerState(state,secrets);
      if(current.running)break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2000);
    }while(Date.now()<deadline);
    req(current?.running===true,"REAL_CLOCK_REHEARSAL_TWIN_START_FAILED");

    state.status="RUNNING";
    state.twin_container_id=current.id;
    state.twin_started_readback_at=new Date().toISOString();
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
      rehearsal_crop_authority_fixture:state.crop_authority_fixture,
      twin_container_running:true,
      automatic_fault_plan:state.fault_plan.enabled?{
        label:"R05",
        stop_at:state.fault_plan.stop_at,
        restart_at:state.fault_plan.restart_at,
        purpose:"CONTROLLED_RESTART_PLUS_ONE_MISSED_BOUNDARY_OLDEST_FIRST_BACKFILL",
      }:null,
      live_provider_required_for_rehearsal_runtime_progress:false,
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
  const container=containerState(state,secrets);
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
  const supplementalPath=supplementalFaultProofPath(state);
  const supplementalFaultProof=fs.existsSync(supplementalPath)
    ?readJson(supplementalPath,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_FAULT_PROOF_INVALID")
    :null;
  const faultProofStatus=faultProof?.status==="PASS"
    ?"PASS"
    :supplementalFaultProof?.status==="PASS"
      ?"PASS_SUPPLEMENTAL"
      :supplementalFaultProof?.status??faultProof?.status??"PENDING";
  console.log(JSON.stringify({
    ...stateProofBase(state),
    status:state.status,
    now:new Date().toISOString(),
    container,
    scheduler:{slot_count:slotCount,completed,degraded,failed,cursor_raw:cursor||null},
    fault_proof_status:faultProofStatus,
    original_fault_proof_status:faultProof?.status??"PENDING",
    supplemental_fault_proof_status:supplementalFaultProof?.status??"NOT_ARMED",
    seconds_until_r23:Math.round((Date.parse(state.r23)-Date.now())/1000),
  },null,2));
}
function finalize(){
  const {state,statePath,secrets}=loadState();
  req(state.status==="RUNNING","REAL_CLOCK_REHEARSAL_FINALIZE_REQUIRES_RUNNING_STATE",state.status);
  req(Date.now()>=Date.parse(state.r23),"REAL_CLOCK_REHEARSAL_FINALIZE_BEFORE_R23_FORBIDDEN",state.r23);
  let acceptedFaultProofSource="NOT_REQUESTED";
  if(state.fault_plan?.enabled){
    req(fs.existsSync(state.fault_plan.proof_path),"REAL_CLOCK_REHEARSAL_FAULT_PROOF_REQUIRED");
    const fault=readJson(state.fault_plan.proof_path,"REAL_CLOCK_REHEARSAL_FAULT_PROOF_INVALID");
    const supplementalPath=supplementalFaultProofPath(state);
    const supplemental=fs.existsSync(supplementalPath)
      ?readJson(supplementalPath,"REAL_CLOCK_REHEARSAL_SUPPLEMENTAL_FAULT_PROOF_INVALID")
      :null;
    const originalPass=fault.status==="PASS";
    const supplementalPass=supplemental?.status==="PASS"
      && supplemental.original_fault_failure_preserved===true
      && supplemental.supplemental_proof_substitutes_only_fault_mechanics_proof===true;
    req(originalPass||supplementalPass,"REAL_CLOCK_REHEARSAL_FAULT_PROOF_NOT_PASS",String(fault.status)+":"+String(supplemental?.status??"NO_SUPPLEMENTAL"));
    acceptedFaultProofSource=originalPass?"ORIGINAL_R05":"SUPPLEMENTAL_CONTROLLED_BOUNDARY";
  }
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
    controlled_restart_backfill_proof_source:acceptedFaultProofSource,
    original_fault_failure_preserved:acceptedFaultProofSource==="SUPPLEMENTAL_CONTROLLED_BOUNDARY",
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
  const a0=strictNextUtcHour(now);
  req(iso(a0)==="2030-01-01T01:00:00.000Z","SELFTEST_A0");
  req(iso(a0+HOUR)==="2030-01-01T02:00:00.000Z","SELFTEST_R00");
  req(iso(a0+24*HOUR)==="2030-01-02T01:00:00.000Z","SELFTEST_R23");
  req(iso(a0+6*HOUR)==="2030-01-01T07:00:00.000Z","SELFTEST_R05");
  const synthetic=rehearsalPlantingWindow(a0);
  req(synthetic.minimum_age_days>80&&synthetic.maximum_age_days<95,"SELFTEST_SYNTHETIC_MID_WINDOW");
  console.log(JSON.stringify({
    schema_version:"geox_mcft_cap09_real_clock_rehearsal_launcher_selftest_v1",
    status:"PASS",
    run_class:"QUALIFICATION_REHEARSAL",
    formal_effect:false,
    production_effect:false,
    synthetic_crop_authority_fixture_guarded_mid_window:true,
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
    else if(mode==="arm-supplemental-fault")armSupplementalFault();
    else if(mode==="recover-supplemental-fault")await recoverSupplementalFault();
    else if(mode==="fault-controller")await faultController();
    else if(mode==="supplemental-fault-controller")await supplementalFaultController();
    else fail("REAL_CLOCK_REHEARSAL_MODE_REQUIRED","start|status|finalize|cleanup|arm-supplemental-fault|recover-supplemental-fault|selftest");
  }catch(error){
    console.error(error instanceof Error?error.stack??error.message:String(error));
    process.exitCode=1;
  }
})();
