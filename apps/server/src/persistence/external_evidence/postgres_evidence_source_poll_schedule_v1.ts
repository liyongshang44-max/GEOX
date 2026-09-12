// MCFT-CAP-09 Postgres durable Evidence source poll schedule.
// Fenced Evidence-plane operational coordination only. The claim is written before
// a provider attempt may start, so restart/stale-plan replay cannot hammer a source.

import type { Pool, PoolClient } from "pg";
import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type EvidenceProducerLeaseClaimV1,
  type EvidenceRuntimeScopeV1,
} from "../../external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  MCFT_CAP09_EVIDENCE_SOURCE_POLL_SCHEDULE_CONTRACT_ID_V1,
  type EvidenceSourcePollClaimResultV1,
  type EvidenceSourcePollFamilyV1,
  type EvidenceSourcePollScheduleClaimPortV1,
  type EvidenceSourcePollScheduleSnapshotV1,
} from "../../external_evidence/mcft_cap09_evidence_source_poll_schedule_v1.js";
import {
  nextProductionEvidenceSourcePollEligibleAtV1,
} from "../../external_evidence/mcft_cap09_production_evidence_source_due_policy_v1.js";

export const MCFT_CAP09_POSTGRES_EVIDENCE_SOURCE_POLL_SCHEDULE_ID_V1 =
  "MCFT_CAP09_POSTGRES_EVIDENCE_SOURCE_POLL_SCHEDULE_V1" as const;

const SCOPE_KEYS = ["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const;
type EvidencePoolV1 = Pick<Pool, "connect" | "query">;
type EvidenceClientV1 = Pick<PoolClient, "query" | "release">;
type RowV1 = {
  lease_owner:string; fencing_token:string|number|bigint; expired:boolean;
  kbs_raw_hourly_poll_last_started_at:string|Date|null;
  kbs_raw_hourly_poll_next_eligible_at:string|Date|null;
  kbs_raw_hourly_poll_writer_owner:string|null;
  kbs_raw_hourly_poll_writer_fencing_token:string|number|bigint|null;
  kbs_soil_poll_last_started_at:string|Date|null;
  kbs_soil_poll_next_eligible_at:string|Date|null;
  kbs_soil_poll_writer_owner:string|null;
  kbs_soil_poll_writer_fencing_token:string|number|bigint|null;
};
function textV1(value:unknown,code:string):string{if(typeof value!=="string"||!value.trim())throw new Error(code);return value.trim();}
function isoV1(value:unknown,code:string):string{if(value instanceof Date)return value.toISOString();const text=textV1(value,code);const parsed=Date.parse(text);if(!Number.isFinite(parsed)||new Date(parsed).toISOString()!==text)throw new Error(code);return text;}
function scopeValuesV1(scope:EvidenceRuntimeScopeV1):string[]{return SCOPE_KEYS.map(key=>textV1(scope[key],"EVIDENCE_SOURCE_POLL_SCOPE_"+key.toUpperCase()+"_REQUIRED"));}
function assertScopeV1(actual:EvidenceRuntimeScopeV1,expected:EvidenceRuntimeScopeV1):void{if(!SCOPE_KEYS.every(key=>actual[key]===expected[key]))throw new Error("EVIDENCE_SOURCE_POLL_EXACT_SIX_KEY_SCOPE_REQUIRED");}
function fieldsV1(source:EvidenceSourcePollFamilyV1){return source==="KBS_RAW_HOURLY"?{last:"kbs_raw_hourly_poll_last_started_at",next:"kbs_raw_hourly_poll_next_eligible_at",owner:"kbs_raw_hourly_poll_writer_owner",fence:"kbs_raw_hourly_poll_writer_fencing_token"}:{last:"kbs_soil_poll_last_started_at",next:"kbs_soil_poll_next_eligible_at",owner:"kbs_soil_poll_writer_owner",fence:"kbs_soil_poll_writer_fencing_token"};}
function scheduleFromRowV1(scope:EvidenceRuntimeScopeV1,source:EvidenceSourcePollFamilyV1,row:RowV1):EvidenceSourcePollScheduleSnapshotV1|null{
  const f=fieldsV1(source);
  const last=row[f.last as keyof RowV1] as string|Date|null;
  const next=row[f.next as keyof RowV1] as string|Date|null;
  const owner=row[f.owner as keyof RowV1] as string|null;
  const fence=row[f.fence as keyof RowV1] as string|number|bigint|null;
  const values=[last,next,owner,fence];
  if(values.every(v=>v===null))return null;
  if(values.some(v=>v===null))throw new Error("EVIDENCE_SOURCE_POLL_PARTIAL_STORED_STATE_FORBIDDEN:"+source);
  const lastIso=isoV1(last,"EVIDENCE_SOURCE_POLL_STORED_LAST_INVALID");
  const nextIso=isoV1(next,"EVIDENCE_SOURCE_POLL_STORED_NEXT_INVALID");
  if(Date.parse(nextIso)<=Date.parse(lastIso))throw new Error("EVIDENCE_SOURCE_POLL_STORED_CHRONOLOGY_INVALID");
  const writerFence=BigInt(fence!);if(writerFence<=0n)throw new Error("EVIDENCE_SOURCE_POLL_STORED_FENCE_INVALID");
  return {schedule_contract_id:MCFT_CAP09_EVIDENCE_SOURCE_POLL_SCHEDULE_CONTRACT_ID_V1,scope:{...scope},source_family:source,last_poll_started_at:lastIso,next_poll_eligible_at:nextIso,writer_lease_owner:textV1(owner,"EVIDENCE_SOURCE_POLL_STORED_OWNER_INVALID"),writer_fencing_token:writerFence};
}
async function rollbackQuietlyV1(client:EvidenceClientV1):Promise<void>{try{await client.query("ROLLBACK");}catch{}}

export class PostgresEvidenceSourcePollScheduleV1 implements EvidenceSourcePollScheduleClaimPortV1{
  readonly persistence_id=MCFT_CAP09_POSTGRES_EVIDENCE_SOURCE_POLL_SCHEDULE_ID_V1;
  constructor(private readonly pool:EvidencePoolV1,private readonly configuredScope:EvidenceRuntimeScopeV1){scopeValuesV1(configuredScope);}
  private async selectRowV1(clientOrPool:Pick<Pool,"query">|Pick<PoolClient,"query">,lock:boolean):Promise<RowV1|null>{
    const result=await clientOrPool.query<RowV1>(
      `SELECT lease_owner,fencing_token,expires_at<=transaction_timestamp() AS expired,
              kbs_raw_hourly_poll_last_started_at,kbs_raw_hourly_poll_next_eligible_at,
              kbs_raw_hourly_poll_writer_owner,kbs_raw_hourly_poll_writer_fencing_token,
              kbs_soil_poll_last_started_at,kbs_soil_poll_next_eligible_at,
              kbs_soil_poll_writer_owner,kbs_soil_poll_writer_fencing_token
         FROM external_evidence_producer_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ${lock?"FOR UPDATE":""}`,
      scopeValuesV1(this.configuredScope)
    );
    if(result.rows.length>1)throw new Error("EVIDENCE_SOURCE_POLL_LEASE_CARDINALITY_VIOLATION");
    return result.rows[0]??null;
  }
  async readSourcePollSchedule(input:{scope:EvidenceRuntimeScopeV1;source_family:EvidenceSourcePollFamilyV1;}):Promise<EvidenceSourcePollScheduleSnapshotV1|null>{
    assertScopeV1(input.scope,this.configuredScope);
    const row=await this.selectRowV1(this.pool,false);
    return row?scheduleFromRowV1(this.configuredScope,input.source_family,row):null;
  }
  async claimPollBeforeProviderFetch(input:{claim:EvidenceProducerLeaseClaimV1;source_family:EvidenceSourcePollFamilyV1;activation_fence_time:string;requested_at:string;}):Promise<EvidenceSourcePollClaimResultV1>{
    assertScopeV1(input.claim.scope,this.configuredScope);
    if(input.claim.lease_contract_id!==MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1)throw new Error("EVIDENCE_SOURCE_POLL_LEASE_CONTRACT_INVALID");
    const requestedAt=isoV1(input.requested_at,"EVIDENCE_SOURCE_POLL_REQUESTED_AT_INVALID");
    const activationFence=isoV1(input.activation_fence_time,"EVIDENCE_SOURCE_POLL_ACTIVATION_FENCE_INVALID");
    if(Date.parse(requestedAt)<Date.parse(activationFence))throw new Error("EVIDENCE_SOURCE_POLL_REQUEST_BEFORE_ACTIVATION_FENCE");
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const row=await this.selectRowV1(client,true);
      if(!row)throw new Error("EVIDENCE_SOURCE_POLL_CURRENT_LEASE_REQUIRED");
      if(row.expired||row.lease_owner!==input.claim.lease_owner||BigInt(row.fencing_token)!==input.claim.fencing_token)throw new Error("EVIDENCE_SOURCE_POLL_STALE_FENCE");
      const current=scheduleFromRowV1(this.configuredScope,input.source_family,row);
      if(current&&Date.parse(requestedAt)<Date.parse(current.next_poll_eligible_at)){
        await client.query("COMMIT");
        return {status:"NOT_DUE",schedule:current,provider_request_authorized:false,database_write_count:0};
      }
      const nextEligible=nextProductionEvidenceSourcePollEligibleAtV1({source_family:input.source_family,poll_started_at:requestedAt});
      const f=fieldsV1(input.source_family);
      const updated=await client.query<RowV1>(
        `UPDATE external_evidence_producer_lease_v1
            SET ${f.last}=$9::timestamptz,${f.next}=$10::timestamptz,${f.owner}=$7,${f.fence}=$8
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND lease_owner=$7 AND fencing_token=$8 AND expires_at>transaction_timestamp()
        RETURNING lease_owner,fencing_token,expires_at<=transaction_timestamp() AS expired,
                  kbs_raw_hourly_poll_last_started_at,kbs_raw_hourly_poll_next_eligible_at,
                  kbs_raw_hourly_poll_writer_owner,kbs_raw_hourly_poll_writer_fencing_token,
                  kbs_soil_poll_last_started_at,kbs_soil_poll_next_eligible_at,
                  kbs_soil_poll_writer_owner,kbs_soil_poll_writer_fencing_token`,
        [...scopeValuesV1(this.configuredScope),input.claim.lease_owner,input.claim.fencing_token.toString(),requestedAt,nextEligible]
      );
      if(updated.rows.length!==1)throw new Error("EVIDENCE_SOURCE_POLL_COMPARE_AND_SET_FAILED");
      const schedule=scheduleFromRowV1(this.configuredScope,input.source_family,updated.rows[0]!);
      if(!schedule)throw new Error("EVIDENCE_SOURCE_POLL_POST_UPDATE_REQUIRED");
      await client.query("COMMIT");
      return {status:"CLAIMED",schedule,provider_request_authorized:true,database_write_count:1};
    }catch(error){await rollbackQuietlyV1(client);throw error;}finally{client.release();}
  }
}
