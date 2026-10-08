import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_FORMAL_V5_DATABASE_V1,
  validateMcftCap09FormalV5ArmV1,
} from "./mcft_cap09_formal_v5_manifest_from_stage_authority_v1.js";

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
function iso(value:unknown):string{return new Date(value as any).toISOString();}
function scopeValues():string[]{
  return SCOPE_KEYS.map((key)=>required(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1[key],"FORMAL_V5_WATCHDOG_SCOPE_"+key.toUpperCase()));
}
function phase(now:string,arm:any):string{
  const t=Date.parse(now);
  if(t<Date.parse(arm.a0))return "PRE_A0";
  if(t<Date.parse(arm.o00))return "A0_TO_O00";
  if(t<=Date.parse(arm.o23))return "O00_TO_O23";
  return "POST_O23";
}
async function run():Promise<void>{
  const armPath=path.resolve(required(arg("--arm"),"FORMAL_V5_WATCHDOG_ARM_PATH_REQUIRED"));
  if(!fs.existsSync(armPath))throw new Error("FORMAL_V5_WATCHDOG_ARM_FILE_MISSING");
  const arm=JSON.parse(fs.readFileSync(armPath,"utf8"));
  validateMcftCap09FormalV5ArmV1(arm);

  const databaseUrl=required(process.env.GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL,"FORMAL_V5_WATCHDOG_DATABASE_URL_REQUIRED");
  const url=new URL(databaseUrl);
  assert.equal(decodeURIComponent(url.pathname.replace(/^\//,"")),MCFT_CAP09_FORMAL_V5_DATABASE_V1,"FORMAL_V5_WATCHDOG_EXACT_DATABASE_REQUIRED");

  const pool=new Pool({connectionString:databaseUrl,max:1,application_name:"mcft-cap09-formal-v5-watchdog"});
  const client=await pool.connect();
  try{
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const identity=(await client.query<{db:string;user_name:string;read_only:string;database_now:Date}>(
      "SELECT current_database()::text AS db,current_user::text AS user_name,current_setting('transaction_read_only')::text AS read_only,transaction_timestamp() AS database_now"
    )).rows[0];
    if(!identity)throw new Error("FORMAL_V5_WATCHDOG_DATABASE_IDENTITY_REQUIRED");
    assert.equal(identity.db,MCFT_CAP09_FORMAL_V5_DATABASE_V1,"FORMAL_V5_WATCHDOG_DATABASE_IDENTITY");
    assert.equal(identity.read_only,"on","FORMAL_V5_WATCHDOG_READ_ONLY_REQUIRED");
    const now=iso(identity.database_now),scope=scopeValues();

    const slotCounts=(await client.query(
      `SELECT state,count(*)::int AS n FROM twin_shadow_online_scheduler_slot_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        GROUP BY state ORDER BY state`,scope,
    )).rows;
    const slotByState=Object.fromEntries(slotCounts.map((r)=>[String(r.state),Number(r.n)]));
    const failedSlots=Number(slotByState.FAILED??0);

    const cursor=(await client.query(
      `SELECT schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time,last_terminal_slot_id,last_terminal_logical_time
         FROM twin_shadow_online_scheduler_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,scope,
    )).rows[0]??null;

    const terminalTicks=Number((await client.query(
      `SELECT count(*)::int AS n FROM twin_terminal_tick_uniqueness_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,scope,
    )).rows[0]?.n??0);

    const twinLease=(await client.query(
      `SELECT lease_owner,fencing_token,expires_at,expires_at>transaction_timestamp() AS live
         FROM twin_runtime_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,scope,
    )).rows[0]??null;

    const forcingCursor=(await client.query(
      `SELECT subject_sha,first_required_base,last_required_base,last_contiguous_eligible_base,next_missing_required_base,completed
         FROM twin_external_formal_forcing_base_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7`,
      [...scope,arm.epoch_id],
    )).rows[0]??null;

    const targetCounts=(await client.query(
      `SELECT state,count(*)::int AS n FROM twin_external_formal_forcing_base_target_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7
        GROUP BY state ORDER BY state`,
      [...scope,arm.epoch_id],
    )).rows;
    const targetByState=Object.fromEntries(targetCounts.map((r)=>[String(r.state),Number(r.n)]));
    const terminalForcingFailures=Number(targetByState.DEADLINE_MISSED_TERMINAL??0);

    const controller=(await client.query(
      `SELECT lifecycle_state,lease_owner,fencing_token,lease_expires_at,
              CASE WHEN lease_expires_at IS NOT NULL AND lease_expires_at>transaction_timestamp() THEN true ELSE false END AS live,
              terminal_at,terminal_reason
         FROM twin_external_formal_forcing_controller_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7`,
      [...scope,arm.epoch_id],
    )).rows[0]??null;

    const health=(await client.query(
      `SELECT operation_status,logical_time,health_object_id
         FROM twin_runtime_health_latest_index_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,scope,
    )).rows[0]??null;

    const alertReasons:string[]=[];
    if(failedSlots>0)alertReasons.push("FAILED_SCHEDULER_SLOT");
    if(terminalForcingFailures>0)alertReasons.push("FORCING_DEADLINE_MISSED_TERMINAL");
    if(cursor&&Number(cursor.next_slot_index)>24)alertReasons.push("SCHEDULER_CURSOR_OUT_OF_RANGE");
    if(forcingCursor&&forcingCursor.subject_sha!==arm.subject_sha)alertReasons.push("FORCING_SUBJECT_DRIFT");
    if(health&&!new Set(["HEALTHY","DEGRADED"]).has(String(health.operation_status)))alertReasons.push("RUNTIME_HEALTH_FORBIDDEN");

    const result={
      schema_version:"geox_mcft_cap09_formal_v5_active_watchdog_v1",
      status:alertReasons.length===0?"PASS":"ALERT",
      runtime_semantic_subject_sha:arm.subject_sha,
      epoch_id:arm.epoch_id,
      database_name:identity.db,
      database_principal:identity.user_name,
      database_now:now,
      phase:phase(now,arm),
      a0:arm.a0,o00:arm.o00,o23:arm.o23,
      scheduler_slot_states:slotByState,
      scheduler_slot_total:Object.values(slotByState).reduce((a,b)=>a+Number(b),0),
      terminal_tick_count:terminalTicks,
      scheduler_cursor:cursor?{
        next_slot_index:Number(cursor.next_slot_index),
        next_slot_id:cursor.next_slot_id,
        next_logical_time:cursor.next_logical_time?iso(cursor.next_logical_time):null,
        last_terminal_slot_id:cursor.last_terminal_slot_id,
        last_terminal_logical_time:cursor.last_terminal_logical_time?iso(cursor.last_terminal_logical_time):null,
      }:null,
      twin_lease:twinLease?{
        lease_owner:twinLease.lease_owner,
        fencing_token:String(twinLease.fencing_token),
        expires_at:iso(twinLease.expires_at),
        live:twinLease.live===true,
      }:null,
      forcing_cursor:forcingCursor?{
        first_required_base:iso(forcingCursor.first_required_base),
        last_required_base:iso(forcingCursor.last_required_base),
        last_contiguous_eligible_base:iso(forcingCursor.last_contiguous_eligible_base),
        next_missing_required_base:forcingCursor.next_missing_required_base?iso(forcingCursor.next_missing_required_base):null,
        completed:forcingCursor.completed===true,
      }:null,
      forcing_target_states:targetByState,
      forcing_controller:controller?{
        lifecycle_state:controller.lifecycle_state,
        lease_owner:controller.lease_owner,
        fencing_token:String(controller.fencing_token),
        lease_expires_at:controller.lease_expires_at?iso(controller.lease_expires_at):null,
        live:controller.live===true,
        terminal_at:controller.terminal_at?iso(controller.terminal_at):null,
        terminal_reason:controller.terminal_reason,
      }:null,
      latest_health:health?{
        operation_status:health.operation_status,
        logical_time:iso(health.logical_time),
        health_object_id:health.health_object_id,
      }:null,
      irreversible_alert_count:alertReasons.length,
      alert_reasons:alertReasons,
      database_write_count:0,
      provider_request_count:0,
      scheduler_write_count:0,
      mcft_cap09_completed:false,
    };
    await client.query("COMMIT");
    process.stdout.write(JSON.stringify(result,null,2)+"\n");
    if(alertReasons.length>0)process.exitCode=2;
  }catch(error){
    try{await client.query("ROLLBACK");}catch{}
    throw error;
  }finally{
    client.release();
    await pool.end();
  }
}
function selftest():void{
  assert.equal(phase("2099-01-01T00:00:00.000Z",{a0:"2099-01-01T01:00:00.000Z",o00:"2099-01-01T02:00:00.000Z",o23:"2099-01-02T01:00:00.000Z"}),"PRE_A0");
  assert.equal(phase("2099-01-01T01:30:00.000Z",{a0:"2099-01-01T01:00:00.000Z",o00:"2099-01-01T02:00:00.000Z",o23:"2099-01-02T01:00:00.000Z"}),"A0_TO_O00");
  assert.equal(phase("2099-01-01T05:00:00.000Z",{a0:"2099-01-01T01:00:00.000Z",o00:"2099-01-01T02:00:00.000Z",o23:"2099-01-02T01:00:00.000Z"}),"O00_TO_O23");
  process.stdout.write(JSON.stringify({
    schema_version:"geox_mcft_cap09_formal_v5_active_watchdog_selftest_v1",
    status:"PASS",
    read_only:true,
    database_write_count:0,
    provider_request_count:0,
    mcft_cap09_completed:false,
  },null,2)+"\n");
}
if(has("--selftest"))selftest();
else run().catch((error)=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
