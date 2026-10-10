import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { Pool, type PoolClient } from "pg";

import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1 } from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import {
  validateMcftCap09FormalV5ActiveActivationAuthorityV1,
} from "../../apps/server/src/runtime/mcft_cap09_formal_v5_active_activation_authority_v1.js";
import {
  MCFT_CAP09_FORMAL_V5_DATABASE_V1,
  validateMcftCap09FormalV5ArmV1,
} from "./mcft_cap09_formal_v5_manifest_from_stage_authority_v1.js";

const ROOT=process.cwd();
const OUTPUT=path.resolve("acceptance-output/MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_V1.json");
const EVIDENCE_SOURCE="mcft_cap09_external_formal_evidence_v1";
const TERMINAL_SLOT_STATES=new Set(["COMPLETED","DEGRADED"]);
const ALLOWED_FORCING_MODES=new Set(["EXACT_PROVIDER_INTERVAL_PAIR","PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR"]);
const SCOPE_KEYS=["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const;

function arg(name:string):string|null{
  const row=process.argv.slice(2).find((value)=>value.startsWith(name+"="));
  return row?row.slice(name.length+1):null;
}
function has(name:string):boolean{return process.argv.includes(name);}
function required(value:unknown,code:string):string{
  const text=String(value??"").trim();
  if(!text)throw new Error(code);
  return text;
}
function exactSha(value:unknown,code:string):string{
  const text=required(value,code);
  if(!/^[0-9a-f]{40}$/.test(text))throw new Error(code);
  return text;
}
function digest(value:unknown,code:string):string{
  const text=required(value,code);
  if(!/^sha256:[0-9a-f]{64}$/.test(text))throw new Error(code);
  return text;
}
function canonicalIso(value:unknown,code:string):string{
  const text=required(value,code),ms=Date.parse(text);
  if(!Number.isFinite(ms)||new Date(ms).toISOString()!==text)throw new Error(code);
  return text;
}
function canonicalHour(value:unknown,code:string):string{
  const text=canonicalIso(value,code);
  if(!text.endsWith(":00:00.000Z"))throw new Error(code);
  return text;
}
function iso(value:unknown):string{return new Date(value as any).toISOString();}
function addHours(value:string,hours:number):string{
  return new Date(Date.parse(value)+hours*3_600_000).toISOString();
}
function series(start:string,count:number):string[]{
  return Array.from({length:count},(_,index)=>addHours(start,index));
}
function exactSet(actual:readonly string[],expected:readonly string[],code:string):void{
  const a=[...actual].sort(),e=[...expected].sort();
  if(JSON.stringify(a)!==JSON.stringify(e))throw new Error(code+":"+JSON.stringify({actual:a,expected:e}));
}
function readJson(file:string):any{return JSON.parse(fs.readFileSync(file,"utf8"));}
function git(...args:string[]):string{
  return execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();
}
function scopeValues():string[]{
  return SCOPE_KEYS.map((key)=>required(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1[key],"FORMAL_V5_FINAL_SCOPE_"+key.toUpperCase()+"_REQUIRED"));
}
function formalRawRef(value:unknown,code:string):string{
  const ref=required(value,code);
  let parsed:URL;
  try{parsed=new URL(ref);}catch{throw new Error(code);}
  const key=parsed.pathname.replace(/^\/+/, "");
  if(
    parsed.protocol!=="s3-private:"
    || parsed.hostname!=="geox-mcft-cap09-formal-raw-v1"
    || !key.startsWith(MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1+"/")
    || key.includes("mcft-cap09-ea5e2-readiness-transient-v1")
  )throw new Error(code);
  return ref;
}
function assertSameScope(value:any,code:string):void{
  for(const key of SCOPE_KEYS){
    assert.equal(value?.[key],MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1[key],code+":"+key);
  }
}
function loadInputs(){
  const armPath=path.resolve(required(arg("--arm"),"FORMAL_V5_FINAL_ARM_PATH_REQUIRED"));
  const bootstrapPath=path.resolve(required(arg("--bootstrap"),"FORMAL_V5_FINAL_BOOTSTRAP_PATH_REQUIRED"));
  const activationPath=path.resolve(required(arg("--activation"),"FORMAL_V5_FINAL_ACTIVATION_PATH_REQUIRED"));
  const cutoverPath=path.resolve(required(arg("--cutover"),"FORMAL_V5_FINAL_CUTOVER_PATH_REQUIRED"));
  for(const file of [armPath,bootstrapPath,activationPath,cutoverPath]){
    if(!fs.existsSync(file))throw new Error("FORMAL_V5_FINAL_INPUT_FILE_MISSING:"+file);
  }
  const arm=readJson(armPath);
  validateMcftCap09FormalV5ArmV1(arm);
  const bootstrap=readJson(bootstrapPath);
  const activation=validateMcftCap09FormalV5ActiveActivationAuthorityV1(readJson(activationPath));
  const cutover=readJson(cutoverPath);
  return {arm,bootstrap,activation,cutover};
}
function assertEvidenceIdentity(inputs:ReturnType<typeof loadInputs>,head:string):void{
  const {arm,bootstrap,activation,cutover}=inputs;
  const subject=exactSha(arm.subject_sha,"FORMAL_V5_FINAL_ARM_SUBJECT_INVALID");
  const continuityHead=exactSha(bootstrap.authority_continuity_head_sha,"FORMAL_V5_FINAL_BOOTSTRAP_CONTINUITY_HEAD_INVALID");
  assert.equal(continuityHead,head,"FORMAL_V5_FINAL_CURRENT_MAIN_MUST_EQUAL_A0_CONTINUITY_HEAD");
  execFileSync("git",["merge-base","--is-ancestor",subject,head],{cwd:ROOT,stdio:"ignore"});

  assert.equal(bootstrap.schema_version,"geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1","FORMAL_V5_FINAL_BOOTSTRAP_SCHEMA");
  assert.equal(bootstrap.status,"PASS","FORMAL_V5_FINAL_BOOTSTRAP_PASS");
  assert.equal(bootstrap.arm_runtime_semantic_subject_sha,subject,"FORMAL_V5_FINAL_BOOTSTRAP_RUNTIME_SUBJECT");
  assert.equal(bootstrap.arm_identity_hash,arm.arm_identity_hash,"FORMAL_V5_FINAL_BOOTSTRAP_ARM_IDENTITY");
  assert.equal(bootstrap.epoch_id,arm.epoch_id,"FORMAL_V5_FINAL_BOOTSTRAP_EPOCH");
  assert.equal(bootstrap.formal_database_name,MCFT_CAP09_FORMAL_V5_DATABASE_V1,"FORMAL_V5_FINAL_BOOTSTRAP_DB");
  assert.equal(bootstrap.a0,arm.a0,"FORMAL_V5_FINAL_BOOTSTRAP_A0");
  assert.equal(bootstrap.o00,arm.o00,"FORMAL_V5_FINAL_BOOTSTRAP_O00");
  assert.equal(bootstrap.o23,arm.o23,"FORMAL_V5_FINAL_BOOTSTRAP_O23");
  assert.equal(bootstrap.formal_a0_bootstrapped,true,"FORMAL_V5_FINAL_A0_MUST_BE_BOOTSTRAPPED");
  assert.equal(bootstrap.formal_o00_started,false,"FORMAL_V5_FINAL_BOOTSTRAP_PRE_O00_BOUNDARY");
  digest(bootstrap.manifest_hash,"FORMAL_V5_FINAL_MANIFEST_HASH_REQUIRED");

  assert.equal(activation.subject_sha,subject,"FORMAL_V5_FINAL_ACTIVATION_SUBJECT");
  assert.equal(activation.authority_continuity_head_sha,head,"FORMAL_V5_FINAL_ACTIVATION_CONTINUITY_HEAD");
  assert.equal(activation.epoch_id,arm.epoch_id,"FORMAL_V5_FINAL_ACTIVATION_EPOCH");
  assert.equal(activation.a0,arm.a0,"FORMAL_V5_FINAL_ACTIVATION_A0");
  assert.equal(activation.o00,arm.o00,"FORMAL_V5_FINAL_ACTIVATION_O00");
  assert.equal(activation.o23,arm.o23,"FORMAL_V5_FINAL_ACTIVATION_O23");
  assert.equal(activation.manifest_hash,bootstrap.manifest_hash,"FORMAL_V5_FINAL_ACTIVATION_MANIFEST");
  assertSameScope(activation.scope,"FORMAL_V5_FINAL_ACTIVATION_SCOPE");

  assert.equal(cutover.schema_version,"geox_mcft_cap09_formal_v5_active_cutover_result_v1","FORMAL_V5_FINAL_CUTOVER_SCHEMA");
  assert.equal(cutover.status,"PASS","FORMAL_V5_FINAL_CUTOVER_PASS");
  assert.equal(cutover.subject_sha,subject,"FORMAL_V5_FINAL_CUTOVER_SUBJECT");
  assert.equal(cutover.authority_continuity_head_sha,head,"FORMAL_V5_FINAL_CUTOVER_CONTINUITY_HEAD");
  assert.equal(cutover.epoch_id,arm.epoch_id,"FORMAL_V5_FINAL_CUTOVER_EPOCH");
  assert.equal(cutover.formal_database_name,MCFT_CAP09_FORMAL_V5_DATABASE_V1,"FORMAL_V5_FINAL_CUTOVER_DB");
  assert.equal(cutover.formal_v5_active,true,"FORMAL_V5_FINAL_CUTOVER_ACTIVE_REQUIRED");
  assert.equal(cutover.v13_forcing_process_active,true,"FORMAL_V5_FINAL_CUTOVER_FORCING_REQUIRED");
  assert.equal(cutover.operational_preformal_owner_released,true,"FORMAL_V5_FINAL_PREFORMAL_OWNER_RELEASE_REQUIRED");
  assert.equal(cutover.no_cross_store_double_twin_owner_window,true,"FORMAL_V5_FINAL_DOUBLE_OWNER_FORBIDDEN");
  assert.equal(cutover.new_fencing_token_strictly_greater_than_a0_bootstrap,true,"FORMAL_V5_FINAL_FENCE_SUCCESSOR_REQUIRED");
}
async function oneLatest(
  client:PoolClient,
  table:string,
  idColumn:string,
  params:string[],
  o23:string,
):Promise<any>{
  const rows=(await client.query(
    `SELECT ${idColumn} AS object_id,logical_time,determinism_hash
       FROM ${table}
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    params,
  )).rows;
  if(rows.length!==1||iso(rows[0].logical_time)!==o23||!rows[0].object_id||!rows[0].determinism_hash){
    throw new Error("FORMAL_V5_FINAL_LATEST_O23_REQUIRED:"+table);
  }
  return rows[0];
}

async function readback():Promise<void>{
  if(process.env.GITHUB_ACTIONS||process.env.CI){
    // GitHub is allowed to run a read-only final audit, but never with effectful
    // credentials. The database session itself is forced read-only below.
  }
  const head=git("rev-parse","HEAD");
  const originMain=git("rev-parse","origin/main");
  assert.equal(head,originMain,"FORMAL_V5_FINAL_HEAD_MUST_EQUAL_CURRENT_MAIN");
  assert.equal(git("status","--porcelain"),"","FORMAL_V5_FINAL_WORKTREE_MUST_BE_CLEAN");

  const inputs=loadInputs();
  assertEvidenceIdentity(inputs,head);
  const {arm,bootstrap}=inputs;
  const databaseUrl=required(process.env.GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL,"FORMAL_V5_FINAL_DATABASE_URL_REQUIRED");
  const url=new URL(databaseUrl);
  assert.ok(["postgres:","postgresql:"].includes(url.protocol),"FORMAL_V5_FINAL_POSTGRES_URL_REQUIRED");
  assert.equal(decodeURIComponent(url.pathname.replace(/^\//,"")),MCFT_CAP09_FORMAL_V5_DATABASE_V1,"FORMAL_V5_FINAL_EXACT_DATABASE_REQUIRED");

  const pool=new Pool({connectionString:databaseUrl,max:1,application_name:"mcft-cap09-formal-v5-final-readback"});
  const client=await pool.connect();
  try{
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const identity=(await client.query<{db:string;user_name:string;read_only:string;database_now:Date}>(
      "SELECT current_database()::text AS db,current_user::text AS user_name,current_setting('transaction_read_only')::text AS read_only,transaction_timestamp() AS database_now"
    )).rows[0];
    if(!identity)throw new Error("FORMAL_V5_FINAL_DATABASE_IDENTITY_REQUIRED");
    assert.equal(identity.db,MCFT_CAP09_FORMAL_V5_DATABASE_V1,"FORMAL_V5_FINAL_SESSION_DATABASE_MISMATCH");
    assert.equal(identity.read_only,"on","FORMAL_V5_FINAL_READ_ONLY_TRANSACTION_REQUIRED");
    const databaseNow=iso(identity.database_now);
    if(Date.parse(databaseNow)<Date.parse(arm.o23))throw new Error("FORMAL_V5_FINAL_BEFORE_O23:"+databaseNow+":"+arm.o23);

    const scope=scopeValues();
    const tickTimes=series(arm.o00,24);
    const baseTimes=series(arm.a0,24); // A0, O00..O22
    const forcingBases=series(arm.o00,23); // O00..O22; O23 would seed O24
    const slotIds=Array.from({length:24},(_,i)=>"O"+String(i).padStart(2,"0"));

    const slots=(await client.query(
      `SELECT slot_id,logical_time,state,fencing_token,tick_ref,health_ref,terminal_at
         FROM twin_shadow_online_scheduler_slot_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ORDER BY logical_time ASC`,scope,
    )).rows;
    assert.equal(slots.length,24,"FORMAL_V5_FINAL_EXACT_24_SLOTS_REQUIRED");
    exactSet(slots.map((r)=>String(r.slot_id)),slotIds,"FORMAL_V5_FINAL_SLOT_IDS");
    exactSet(slots.map((r)=>iso(r.logical_time)),tickTimes,"FORMAL_V5_FINAL_SLOT_TIMES");
    for(const row of slots){
      if(!TERMINAL_SLOT_STATES.has(String(row.state)))throw new Error("FORMAL_V5_FINAL_NON_SUCCESS_TERMINAL_SLOT:"+row.slot_id+":"+row.state);
      if(!row.tick_ref||!row.health_ref||!row.terminal_at||row.fencing_token==null)throw new Error("FORMAL_V5_FINAL_SLOT_LINKAGE_REQUIRED:"+row.slot_id);
    }

    const terminalTicks=(await client.query(
      `SELECT logical_time,source_tick_object_id,record_set_id,aggregate_determinism_hash
         FROM twin_terminal_tick_uniqueness_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ORDER BY logical_time ASC`,scope,
    )).rows;
    assert.equal(terminalTicks.length,24,"FORMAL_V5_FINAL_EXACT_24_TERMINAL_TICKS_REQUIRED");
    exactSet(terminalTicks.map((r)=>iso(r.logical_time)),tickTimes,"FORMAL_V5_FINAL_TERMINAL_TICK_TIMES");
    for(const row of terminalTicks){
      if(!row.source_tick_object_id||!row.record_set_id||!row.aggregate_determinism_hash)throw new Error("FORMAL_V5_FINAL_TERMINAL_TICK_LINKAGE_REQUIRED");
    }

    const schedulerCursor=(await client.query(
      `SELECT schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time,last_terminal_slot_id,last_terminal_logical_time,last_fencing_token
         FROM twin_shadow_online_scheduler_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,scope,
    )).rows;
    assert.equal(schedulerCursor.length,1,"FORMAL_V5_FINAL_EXACT_ONE_SCHEDULER_CURSOR_REQUIRED");
    const sc=schedulerCursor[0];
    if(
      iso(sc.schedule_start_logical_time)!==arm.o00
      || Number(sc.next_slot_index)!==24
      || sc.next_slot_id!==null
      || sc.next_logical_time!==null
      || sc.last_terminal_slot_id!=="O23"
      || iso(sc.last_terminal_logical_time)!==arm.o23
      || sc.last_fencing_token==null
    )throw new Error("FORMAL_V5_FINAL_SCHEDULER_CURSOR_NOT_TERMINAL");

    const latestState=await oneLatest(client,"twin_state_latest_index_v1","state_object_id",scope,arm.o23);
    const latestCheckpoint=await oneLatest(client,"twin_runtime_checkpoint_latest_index_v1","checkpoint_object_id",scope,arm.o23);
    const latestHealth=await oneLatest(client,"twin_runtime_health_latest_index_v1","health_object_id",scope,arm.o23);
    const latestForecast=await oneLatest(client,"twin_forecast_result_latest_index_v1","forecast_object_id",scope,arm.o23);
    void latestState;void latestCheckpoint;void latestForecast;
    const healthStatus=String((await client.query(
      "SELECT operation_status FROM twin_runtime_health_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
      scope,
    )).rows[0]?.operation_status??"");
    if(!new Set(["HEALTHY","DEGRADED"]).has(healthStatus))throw new Error("FORMAL_V5_FINAL_HEALTH_FORBIDDEN:"+healthStatus);
    void latestHealth;

    const twinLeases=(await client.query(
      `SELECT lease_owner,fencing_token,expires_at,transaction_timestamp() AS database_now
         FROM twin_runtime_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,scope,
    )).rows;
    assert.equal(twinLeases.length,1,"FORMAL_V5_FINAL_EXACT_ONE_TWIN_LEASE_ROW_REQUIRED");
    if(Date.parse(iso(twinLeases[0].expires_at))>Date.parse(iso(twinLeases[0].database_now))){
      throw new Error("FORMAL_V5_FINAL_ACTIVE_TWIN_LEASE_FORBIDDEN");
    }

    const forcingCursor=(await client.query(
      `SELECT subject_sha,first_required_base,last_required_base,last_contiguous_eligible_base,next_missing_required_base,completed
         FROM twin_external_formal_forcing_base_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7`,
      [...scope,arm.epoch_id],
    )).rows;
    assert.equal(forcingCursor.length,1,"FORMAL_V5_FINAL_EXACT_ONE_FORCING_CURSOR_REQUIRED");
    const fc=forcingCursor[0];
    if(
      fc.subject_sha!==arm.subject_sha
      || iso(fc.first_required_base)!==arm.o00
      || iso(fc.last_required_base)!==addHours(arm.o23,-1)
      || iso(fc.last_contiguous_eligible_base)!==addHours(arm.o23,-1)
      || fc.next_missing_required_base!==null
      || fc.completed!==true
    )throw new Error("FORMAL_V5_FINAL_FORCING_CURSOR_INCOMPLETE");

    const targets=(await client.query(
      `SELECT subject_sha,base_target_t,causal_deadline,state,fencing_token,producer_run_id,promotion_run_id,candidate_artifact_digest,
              weather_fact_id,weather_source_record_hash,weather_record_semantic_hash,
              et0_fact_id,et0_source_record_hash,et0_record_semantic_hash,
              soil_fact_id,soil_source_record_hash,soil_record_semantic_hash,
              post_commit_db_readback_at,formal_visible_attested_at,failure_class
         FROM twin_external_formal_forcing_base_target_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7
        ORDER BY base_target_t ASC`,
      [...scope,arm.epoch_id],
    )).rows;
    assert.equal(targets.length,23,"FORMAL_V5_FINAL_EXACT_23_FORCING_RECEIPTS_REQUIRED");
    exactSet(targets.map((r)=>iso(r.base_target_t)),forcingBases,"FORMAL_V5_FINAL_FORCING_BASE_SERIES");
    const targetWeatherFactIds=new Set(targets.map((row)=>String(row.weather_fact_id??"")));
    const targetEt0FactIds=new Set(targets.map((row)=>String(row.et0_fact_id??"")));
    const targetSoilFactIds=new Set(targets.map((row)=>String(row.soil_fact_id??"")));
    for(const row of targets){
      const base=iso(row.base_target_t);
      if(row.subject_sha!==arm.subject_sha||iso(row.causal_deadline)!==base||row.state!=="FORMAL_VISIBLE_ATTESTED"||row.failure_class!==null){
        throw new Error("FORMAL_V5_FINAL_FORCING_RECEIPT_STATE_INVALID:"+base);
      }
      if(BigInt(row.fencing_token??0)<=0n)throw new Error("FORMAL_V5_FINAL_FORCING_RECEIPT_FENCE_REQUIRED:"+base);
      for(const field of [
        "producer_run_id","promotion_run_id","candidate_artifact_digest",
        "weather_fact_id","weather_source_record_hash","weather_record_semantic_hash",
        "et0_fact_id","et0_source_record_hash","et0_record_semantic_hash",
        "soil_fact_id","soil_source_record_hash","soil_record_semantic_hash",
        "post_commit_db_readback_at","formal_visible_attested_at",
      ]){
        required(row[field],"FORMAL_V5_FINAL_FORCING_RECEIPT_FIELD_REQUIRED:"+base+":"+field);
      }
      digest(row.candidate_artifact_digest,"FORMAL_V5_FINAL_FORCING_ARTIFACT_DIGEST_INVALID:"+base);
      if(Date.parse(iso(row.post_commit_db_readback_at))>=Date.parse(base)||Date.parse(iso(row.formal_visible_attested_at))>=Date.parse(base)){
        throw new Error("FORMAL_V5_FINAL_FORCING_RECEIPT_AFTER_DEADLINE:"+base);
      }
    }

    const controller=(await client.query(
      `SELECT subject_sha,lifecycle_state,lease_owner,fencing_token,lease_expires_at,terminal_at,terminal_reason,transaction_timestamp() AS database_now
         FROM twin_external_formal_forcing_controller_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7`,
      [...scope,arm.epoch_id],
    )).rows;
    assert.equal(controller.length,1,"FORMAL_V5_FINAL_EXACT_ONE_FORCING_CONTROLLER_REQUIRED");
    const controllerRow=controller[0];
    assert.equal(controllerRow.subject_sha,arm.subject_sha,"FORMAL_V5_FINAL_FORCING_CONTROLLER_SUBJECT");
    if(BigInt(controllerRow.fencing_token??0)<=0n)throw new Error("FORMAL_V5_FINAL_FORCING_CONTROLLER_FENCE_REQUIRED");
    if(controllerRow.lifecycle_state==="ACTIVE"){
      if(!controllerRow.lease_expires_at||Date.parse(iso(controllerRow.lease_expires_at))>Date.parse(iso(controllerRow.database_now))){
        throw new Error("FORMAL_V5_FINAL_LIVE_FORCING_CONTROLLER_LEASE_FORBIDDEN");
      }
    }else if(controllerRow.lifecycle_state==="TERMINAL"){
      if(controllerRow.lease_expires_at!==null||!controllerRow.terminal_at||!controllerRow.terminal_reason){
        throw new Error("FORMAL_V5_FINAL_TERMINAL_FORCING_CONTROLLER_INVALID");
      }
    }else{
      throw new Error("FORMAL_V5_FINAL_FORCING_CONTROLLER_STATE_INVALID:"+controllerRow.lifecycle_state);
    }

    const runtimeConfigs=(await client.query(
      `SELECT record_json#>>'{payload,logical_time}' AS logical_time
         FROM facts
        WHERE source='twin_runtime' AND record_json->>'type'='twin_runtime_config_v1'
          AND record_json#>>'{payload,tenant_id}'=$1 AND record_json#>>'{payload,project_id}'=$2 AND record_json#>>'{payload,group_id}'=$3
          AND record_json#>>'{payload,field_id}'=$4 AND record_json#>>'{payload,season_id}'=$5 AND record_json#>>'{payload,zone_id}'=$6
        ORDER BY (record_json#>>'{payload,logical_time}')::timestamptz ASC`,scope,
    )).rows;
    assert.equal(runtimeConfigs.length,25,"FORMAL_V5_FINAL_EXACT_25_RUNTIME_CONFIGS_REQUIRED");
    exactSet(runtimeConfigs.map((r)=>canonicalIso(r.logical_time,"FORMAL_V5_FINAL_RUNTIME_CONFIG_TIME_INVALID")),series(arm.a0,25),"FORMAL_V5_FINAL_RUNTIME_CONFIG_SERIES");

    const evidenceFactIds:Record<string,Set<string>>={
      future_weather_assumption_v1:new Set<string>(),
      future_et0_assumption_v1:new Set<string>(),
    };
    for(const recordType of ["future_weather_assumption_v1","future_et0_assumption_v1"]){
      const rows=(await client.query(
        `SELECT fact_id,record_json#>>'{payload,role_time,valid_from}' AS valid_from,
                record_json#>>'{payload,source_payload,raw_provenance,retention_ref}' AS retention_ref,
                record_json#>>'{payload,quality,raw_retention_ref}' AS quality_ref,
                record_json#>>'{payload,source_record_id}' AS source_record_id
           FROM facts
          WHERE source=$1 AND record_json->>'type'=$2
            AND record_json#>>'{payload,tenant_id}'=$3 AND record_json#>>'{payload,project_id}'=$4 AND record_json#>>'{payload,group_id}'=$5
            AND record_json#>>'{payload,field_id}'=$6 AND record_json#>>'{payload,season_id}'=$7 AND record_json#>>'{payload,zone_id}'=$8
          ORDER BY (record_json#>>'{payload,role_time,valid_from}')::timestamptz ASC`,
        [EVIDENCE_SOURCE,recordType,...scope],
      )).rows;
      assert.equal(rows.length,24,"FORMAL_V5_FINAL_EXACT_24_EVIDENCE_FACTS_REQUIRED:"+recordType);
      exactSet(rows.map((r)=>canonicalIso(r.valid_from,"FORMAL_V5_FINAL_VALID_FROM_INVALID:"+recordType)),baseTimes,"FORMAL_V5_FINAL_BASE_SERIES:"+recordType);
      for(const row of rows){
        evidenceFactIds[recordType]!.add(String(row.fact_id));
        const a=formalRawRef(row.retention_ref,"FORMAL_V5_FINAL_FORMAL_RAW_REQUIRED:"+recordType);
        const b=formalRawRef(row.quality_ref,"FORMAL_V5_FINAL_QUALITY_RAW_REQUIRED:"+recordType);
        if(a!==b||!row.fact_id||!row.source_record_id)throw new Error("FORMAL_V5_FINAL_RAW_IDENTITY_REQUIRED:"+recordType);
      }
    }
    const soils=(await client.query(
      `SELECT fact_id,record_json#>>'{payload,role_time,observed_at}' AS observed_at,
              record_json#>>'{payload,source_payload,raw_provenance,retention_ref}' AS retention_ref,
              record_json#>>'{payload,quality,raw_retention_ref}' AS quality_ref,
              record_json#>>'{payload,source_record_id}' AS source_record_id
         FROM facts
        WHERE source=$1 AND record_json->>'type'='soil_moisture_observation_v1'
          AND record_json#>>'{payload,tenant_id}'=$2 AND record_json#>>'{payload,project_id}'=$3 AND record_json#>>'{payload,group_id}'=$4
          AND record_json#>>'{payload,field_id}'=$5 AND record_json#>>'{payload,season_id}'=$6 AND record_json#>>'{payload,zone_id}'=$7`,
      [EVIDENCE_SOURCE,...scope],
    )).rows;
    assert.equal(soils.length,24,"FORMAL_V5_FINAL_EXACT_24_SOIL_FACTS_REQUIRED");
    const soilFactIds=new Set<string>();
    for(const row of soils){
      soilFactIds.add(String(row.fact_id));
      const a=formalRawRef(row.retention_ref,"FORMAL_V5_FINAL_SOIL_FORMAL_RAW_REQUIRED");
      const b=formalRawRef(row.quality_ref,"FORMAL_V5_FINAL_SOIL_QUALITY_RAW_REQUIRED");
      if(a!==b||!row.fact_id||!row.source_record_id)throw new Error("FORMAL_V5_FINAL_SOIL_RAW_IDENTITY_REQUIRED");
    }
    for(const id of targetWeatherFactIds)if(!evidenceFactIds.future_weather_assumption_v1.has(id))throw new Error("FORMAL_V5_FINAL_RECEIPT_WEATHER_FACT_NOT_VISIBLE:"+id);
    for(const id of targetEt0FactIds)if(!evidenceFactIds.future_et0_assumption_v1.has(id))throw new Error("FORMAL_V5_FINAL_RECEIPT_ET0_FACT_NOT_VISIBLE:"+id);
    for(const id of targetSoilFactIds)if(!soilFactIds.has(id))throw new Error("FORMAL_V5_FINAL_RECEIPT_SOIL_FACT_NOT_VISIBLE:"+id);

    const evidenceWindows=(await client.query(
      `SELECT record_json#>>'{payload,logical_time}' AS logical_time,
              record_json#>>'{payload,payload,base_continuation_window,current_interval_forcing,mode}' AS forcing_mode,
              record_json#>>'{payload,payload,base_continuation_window,current_interval_forcing,provider_wait_required}' AS provider_wait_required,
              record_json#>>'{payload,payload,base_continuation_window,current_interval_forcing,completed_tick_retroactive_rewrite_authorized}' AS rewrite_authorized,
              record_json#>>'{payload,payload,base_continuation_window,current_interval_forcing,relabel_assumption_as_provider_observation_authorized}' AS relabel_authorized
         FROM facts
        WHERE source='twin_runtime' AND record_json->>'type'='twin_evidence_window_v1'
          AND record_json#>>'{payload,tenant_id}'=$1 AND record_json#>>'{payload,project_id}'=$2 AND record_json#>>'{payload,group_id}'=$3
          AND record_json#>>'{payload,field_id}'=$4 AND record_json#>>'{payload,season_id}'=$5 AND record_json#>>'{payload,zone_id}'=$6
          AND (record_json#>>'{payload,logical_time}')::timestamptz >= $7::timestamptz
          AND (record_json#>>'{payload,logical_time}')::timestamptz <= $8::timestamptz
        ORDER BY (record_json#>>'{payload,logical_time}')::timestamptz ASC`,
      [...scope,arm.o00,arm.o23],
    )).rows;
    assert.equal(evidenceWindows.length,24,"FORMAL_V5_FINAL_EXACT_24_EVIDENCE_WINDOWS_REQUIRED");
    exactSet(evidenceWindows.map((r)=>canonicalIso(r.logical_time,"FORMAL_V5_FINAL_EVIDENCE_WINDOW_TIME_INVALID")),tickTimes,"FORMAL_V5_FINAL_EVIDENCE_WINDOW_SERIES");
    const forcingModeCounts:Record<string,number>={};
    for(const row of evidenceWindows){
      const mode=String(row.forcing_mode??"");
      if(!ALLOWED_FORCING_MODES.has(mode))throw new Error("FORMAL_V5_FINAL_FORCING_MODE_FORBIDDEN:"+row.logical_time+":"+mode);
      forcingModeCounts[mode]=(forcingModeCounts[mode]??0)+1;
      if(row.provider_wait_required!=="false"||row.rewrite_authorized!=="false"||row.relabel_authorized!=="false"){
        throw new Error("FORMAL_V5_FINAL_FORCING_AUTHORITY_DRIFT:"+row.logical_time);
      }
    }

    await client.query("COMMIT");
    const result={
      schema_version:"geox_mcft_cap09_formal_v5_final_readback_v1",
      status:"PASS",
      runtime_semantic_subject_sha:arm.subject_sha,
      authority_continuity_head_sha:head,
      arm_identity_hash:arm.arm_identity_hash,
      epoch_id:arm.epoch_id,
      manifest_hash:bootstrap.manifest_hash,
      formal_database_name:MCFT_CAP09_FORMAL_V5_DATABASE_V1,
      database_readback_at:databaseNow,
      database_principal:identity.user_name,
      read_only_transaction:true,
      a0:arm.a0,o00:arm.o00,o23:arm.o23,
      scheduler_slot_count:24,
      terminal_tick_count:24,
      terminal_slot_states:Object.fromEntries([...TERMINAL_SLOT_STATES].map((state)=>[state,slots.filter((row)=>row.state===state).length])),
      scheduler_cursor_terminal:true,
      latest_state_logical_time:arm.o23,
      latest_checkpoint_logical_time:arm.o23,
      latest_health_logical_time:arm.o23,
      latest_health_status:healthStatus,
      latest_forecast_logical_time:arm.o23,
      runtime_config_count:25,
      exact_base_fact_count_per_type:24,
      evidence_window_count:24,
      forcing_mode_counts:forcingModeCounts,
      forcing_cursor_completed:true,
      forcing_receipt_count:23,
      forcing_receipt_base_start:arm.o00,
      forcing_receipt_base_end:addHours(arm.o23,-1),
      forcing_all_physical_visibility_before_deadline:true,
      forcing_controller_lifecycle_state:String(controllerRow.lifecycle_state),
      forcing_controller_live_lease:false,
      twin_live_lease:false,
      o23_seed_for_o24_written:false,
      provider_wait_required_count:0,
      late_rewrite_authorized_count:0,
      assumption_relabel_authorized_count:0,
      database_readback_pass:true,
      final_actual_24h_still_required:false,
      completion_adjudication_required:true,
      human_override_used:false,
      mcft_cap09_completed:false,
    };
    const out=path.resolve(arg("--out")||OUTPUT);
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n");
    process.stdout.write(JSON.stringify(result,null,2)+"\n");
  }catch(error){
    try{await client.query("ROLLBACK");}catch{}
    throw error;
  }finally{
    client.release();
    await pool.end();
  }
}

function selftest():void{
  const a0="2099-01-01T00:00:00.000Z",o00=addHours(a0,1),o23=addHours(o00,23);
  assert.equal(series(o00,24).at(-1),o23);
  assert.equal(series(a0,24).at(-1),addHours(o23,-1));
  assert.equal(series(o00,23).at(-1),addHours(o23,-1));
  assert.equal(TERMINAL_SLOT_STATES.has("COMPLETED"),true);
  assert.equal(TERMINAL_SLOT_STATES.has("DEGRADED"),true);
  assert.equal(TERMINAL_SLOT_STATES.has("FAILED"),false);
  process.stdout.write(JSON.stringify({
    schema_version:"geox_mcft_cap09_formal_v5_final_readback_selftest_v1",
    status:"PASS",
    required_scheduler_slots:24,
    required_terminal_ticks:24,
    required_runtime_configs:25,
    required_base_facts_per_type:24,
    required_v13_forcing_receipts:23,
    terminal_slot_states:["COMPLETED","DEGRADED"],
    database_write_count:0,
    provider_request_count:0,
    mcft_cap09_completed:false,
  },null,2)+"\n");
}

if(has("--selftest"))selftest();
else readback().catch((error)=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
