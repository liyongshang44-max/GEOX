// MCFT-CAP-09 Postgres durable GFS retry throttle + per-target attempt budget.
// The fenced claim is committed before a provider attempt may start, preserving
// retry spacing and max-three attempts across restart/owner takeover.

import type { Pool, PoolClient } from "pg";
import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type EvidenceProducerLeaseClaimV1,
  type EvidenceRuntimeScopeV1,
} from "../../external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  MCFT_CAP09_GFS_RETRY_SCHEDULE_CONTRACT_ID_V1,
  type GfsRetryAttemptClaimResultV1,
  type GfsRetrySchedulePortV1,
  type GfsRetryScheduleSnapshotV1,
} from "../../external_evidence/mcft_cap09_gfs_retry_schedule_v1.js";
import {
  MCFT_CAP09_GFS_MAX_ATTEMPTS_PER_TARGET_WINDOW_V1,
  MCFT_CAP09_GFS_RETRY_MINIMUM_INTERVAL_SECONDS_V1,
} from "../../external_evidence/mcft_cap09_production_gfs_target_due_policy_v1.js";

export const MCFT_CAP09_POSTGRES_GFS_RETRY_SCHEDULE_ID_V1 =
  "MCFT_CAP09_POSTGRES_GFS_RETRY_SCHEDULE_V1" as const;

const SCOPE_KEYS=["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const;
type EvidencePoolV1=Pick<Pool,"connect"|"query">;
type EvidenceClientV1=Pick<PoolClient,"query"|"release">;
type RowV1={
  lease_owner:string;
  fencing_token:string|number|bigint;
  expired:boolean;
  gfs_poll_target_logical_time:string|Date|null;
  gfs_poll_attempt_count:string|number|null;
  gfs_poll_last_started_at:string|Date|null;
  gfs_poll_next_eligible_at:string|Date|null;
  gfs_poll_writer_owner:string|null;
  gfs_poll_writer_fencing_token:string|number|bigint|null;
};
function textV1(value:unknown,code:string):string{if(typeof value!=="string"||!value.trim())throw new Error(code);return value.trim();}
function isoV1(value:unknown,code:string):string{if(value instanceof Date)return value.toISOString();const text=textV1(value,code);const parsed=Date.parse(text);if(!Number.isFinite(parsed)||new Date(parsed).toISOString()!==text)throw new Error(code);return text;}
function hourV1(value:unknown,code:string):string{const text=isoV1(value,code);if(!text.endsWith(":00:00.000Z"))throw new Error(code);return text;}
function addHoursV1(value:string,hours:number):string{return new Date(Date.parse(value)+hours*3_600_000).toISOString();}
function scopeValuesV1(scope:EvidenceRuntimeScopeV1):string[]{return SCOPE_KEYS.map(key=>textV1(scope[key],"GFS_RETRY_SCOPE_"+key.toUpperCase()+"_REQUIRED"));}
function assertScopeV1(actual:EvidenceRuntimeScopeV1,expected:EvidenceRuntimeScopeV1):void{if(!SCOPE_KEYS.every(key=>actual[key]===expected[key]))throw new Error("GFS_RETRY_EXACT_SIX_KEY_SCOPE_REQUIRED");}
function snapshotV1(scope:EvidenceRuntimeScopeV1,row:RowV1):GfsRetryScheduleSnapshotV1|null{
  const values=[row.gfs_poll_target_logical_time,row.gfs_poll_attempt_count,row.gfs_poll_last_started_at,row.gfs_poll_next_eligible_at,row.gfs_poll_writer_owner,row.gfs_poll_writer_fencing_token];
  if(values.every(v=>v===null))return null;
  if(values.some(v=>v===null))throw new Error("GFS_RETRY_PARTIAL_STORED_STATE_FORBIDDEN");
  const target=hourV1(row.gfs_poll_target_logical_time,"GFS_RETRY_STORED_TARGET_INVALID");
  const attempts=Number(row.gfs_poll_attempt_count);
  if(!Number.isInteger(attempts)||attempts<1||attempts>MCFT_CAP09_GFS_MAX_ATTEMPTS_PER_TARGET_WINDOW_V1)throw new Error("GFS_RETRY_STORED_ATTEMPT_COUNT_INVALID");
  const last=isoV1(row.gfs_poll_last_started_at,"GFS_RETRY_STORED_LAST_INVALID");
  const next=isoV1(row.gfs_poll_next_eligible_at,"GFS_RETRY_STORED_NEXT_INVALID");
  if(Date.parse(next)<=Date.parse(last))throw new Error("GFS_RETRY_STORED_CHRONOLOGY_INVALID");
  const fence=BigInt(row.gfs_poll_writer_fencing_token!);if(fence<=0n)throw new Error("GFS_RETRY_STORED_FENCE_INVALID");
  return {schedule_contract_id:MCFT_CAP09_GFS_RETRY_SCHEDULE_CONTRACT_ID_V1,scope:{...scope},target_logical_time:target,attempt_count:attempts,last_attempt_started_at:last,next_attempt_eligible_at:next,writer_lease_owner:textV1(row.gfs_poll_writer_owner,"GFS_RETRY_STORED_OWNER_INVALID"),writer_fencing_token:fence};
}
async function rollbackQuietlyV1(client:EvidenceClientV1):Promise<void>{try{await client.query("ROLLBACK");}catch{}}

export class PostgresGfsRetryScheduleV1 implements GfsRetrySchedulePortV1{
  readonly persistence_id=MCFT_CAP09_POSTGRES_GFS_RETRY_SCHEDULE_ID_V1;
  constructor(private readonly pool:EvidencePoolV1,private readonly configuredScope:EvidenceRuntimeScopeV1){scopeValuesV1(configuredScope);}
  private async selectRowV1(clientOrPool:Pick<Pool,"query">|Pick<PoolClient,"query">,lock:boolean):Promise<RowV1|null>{
    const result=await clientOrPool.query<RowV1>(
      `SELECT lease_owner,fencing_token,expires_at<=transaction_timestamp() AS expired,
              gfs_poll_target_logical_time,gfs_poll_attempt_count,
              gfs_poll_last_started_at,gfs_poll_next_eligible_at,
              gfs_poll_writer_owner,gfs_poll_writer_fencing_token
         FROM external_evidence_producer_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ${lock?"FOR UPDATE":""}`,
      scopeValuesV1(this.configuredScope)
    );
    if(result.rows.length>1)throw new Error("GFS_RETRY_LEASE_CARDINALITY_VIOLATION");
    return result.rows[0]??null;
  }
  async readGfsRetrySchedule(input:{scope:EvidenceRuntimeScopeV1;}):Promise<GfsRetryScheduleSnapshotV1|null>{
    assertScopeV1(input.scope,this.configuredScope);
    const row=await this.selectRowV1(this.pool,false);
    return row?snapshotV1(this.configuredScope,row):null;
  }
  async claimGfsAttemptBeforeProviderFetch(input:{
    claim:EvidenceProducerLeaseClaimV1;
    target_logical_time:string;
    requested_at:string;
    due_window_start:string;
    due_window_end_exclusive:string;
  }):Promise<GfsRetryAttemptClaimResultV1>{
    assertScopeV1(input.claim.scope,this.configuredScope);
    if(input.claim.lease_contract_id!==MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1)throw new Error("GFS_RETRY_LEASE_CONTRACT_INVALID");
    const target=hourV1(input.target_logical_time,"GFS_RETRY_TARGET_INVALID");
    const requested=isoV1(input.requested_at,"GFS_RETRY_REQUESTED_AT_INVALID");
    const windowStart=isoV1(input.due_window_start,"GFS_RETRY_DUE_WINDOW_START_INVALID");
    const windowEnd=isoV1(input.due_window_end_exclusive,"GFS_RETRY_DUE_WINDOW_END_INVALID");
    if(Date.parse(windowStart)>=Date.parse(windowEnd))throw new Error("GFS_RETRY_DUE_WINDOW_ORDER_INVALID");
    if(Date.parse(requested)<Date.parse(windowStart))throw new Error("GFS_RETRY_REQUEST_BEFORE_DUE_WINDOW");

    const client=await this.pool.connect();
    try{
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const row=await this.selectRowV1(client,true);
      if(!row)throw new Error("GFS_RETRY_CURRENT_LEASE_REQUIRED");
      if(row.expired||row.lease_owner!==input.claim.lease_owner||BigInt(row.fencing_token)!==input.claim.fencing_token)throw new Error("GFS_RETRY_STALE_FENCE");
      const current=snapshotV1(this.configuredScope,row);

      if(Date.parse(requested)>=Date.parse(windowEnd)){
        await client.query("COMMIT");
        return {status:"MISSED_WINDOW",schedule:current,provider_request_authorized:false,database_write_count:0};
      }

      let attemptCount=1;
      if(current){
        const currentMs=Date.parse(current.target_logical_time),targetMs=Date.parse(target);
        if(targetMs<currentMs)throw new Error("GFS_RETRY_TARGET_REWIND_FORBIDDEN");
        if(targetMs>currentMs){
          if(target!==addHoursV1(current.target_logical_time,1))throw new Error("GFS_RETRY_TARGET_SKIP_FORBIDDEN");
        }else{
          if(current.attempt_count>=MCFT_CAP09_GFS_MAX_ATTEMPTS_PER_TARGET_WINDOW_V1){
            await client.query("COMMIT");
            return {status:"ATTEMPT_BUDGET_EXHAUSTED",schedule:current,provider_request_authorized:false,database_write_count:0};
          }
          if(Date.parse(requested)<Date.parse(current.next_attempt_eligible_at)){
            await client.query("COMMIT");
            return {status:"NOT_DUE",schedule:current,provider_request_authorized:false,database_write_count:0};
          }
          attemptCount=current.attempt_count+1;
        }
      }
      const nextEligible=new Date(Date.parse(requested)+MCFT_CAP09_GFS_RETRY_MINIMUM_INTERVAL_SECONDS_V1*1000).toISOString();
      const updated=await client.query<RowV1>(
        `UPDATE external_evidence_producer_lease_v1
            SET gfs_poll_target_logical_time=$9::timestamptz,
                gfs_poll_attempt_count=$10::integer,
                gfs_poll_last_started_at=$11::timestamptz,
                gfs_poll_next_eligible_at=$12::timestamptz,
                gfs_poll_writer_owner=$7,
                gfs_poll_writer_fencing_token=$8
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND lease_owner=$7 AND fencing_token=$8 AND expires_at>transaction_timestamp()
        RETURNING lease_owner,fencing_token,expires_at<=transaction_timestamp() AS expired,
                  gfs_poll_target_logical_time,gfs_poll_attempt_count,
                  gfs_poll_last_started_at,gfs_poll_next_eligible_at,
                  gfs_poll_writer_owner,gfs_poll_writer_fencing_token`,
        [...scopeValuesV1(this.configuredScope),input.claim.lease_owner,input.claim.fencing_token.toString(),target,attemptCount,requested,nextEligible]
      );
      if(updated.rows.length!==1)throw new Error("GFS_RETRY_COMPARE_AND_SET_FAILED");
      const schedule=snapshotV1(this.configuredScope,updated.rows[0]!);
      if(!schedule)throw new Error("GFS_RETRY_POST_UPDATE_REQUIRED");
      await client.query("COMMIT");
      return {status:"CLAIMED",schedule,provider_request_authorized:true,database_write_count:1};
    }catch(error){await rollbackQuietlyV1(client);throw error;}finally{client.release();}
  }
}
