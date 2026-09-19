import type { Pool } from "pg";

import type { McftCap09OwnerCutoverScopeV1 } from "../mcft_cap09_production_owner_cutover_authority_v1.js";

function values(scope:McftCap09OwnerCutoverScopeV1): string[] {
  return [scope.tenant_id,scope.project_id,scope.group_id,scope.field_id,scope.season_id,scope.zone_id];
}
function sleep(ms:number):Promise<void>{return new Promise((resolve)=>setTimeout(resolve,ms));}

export async function runMcftCap09TwinPreFormalOwnerStandbyV1(input:{
  pool:Pool;
  scope:McftCap09OwnerCutoverScopeV1;
  lease_owner:string;
  lease_duration_seconds:number;
  stop_requested:()=>boolean;
}):Promise<void>{
  if(!input.lease_owner.trim()) throw new Error("MCFT_CAP09_TWIN_PREFORMAL_LEASE_OWNER_REQUIRED");
  if(!Number.isInteger(input.lease_duration_seconds)||input.lease_duration_seconds<30||input.lease_duration_seconds>3600) {
    throw new Error("MCFT_CAP09_TWIN_PREFORMAL_LEASE_DURATION_INVALID");
  }
  const cadenceMs=Math.max(5_000,Math.min(60_000,Math.floor(input.lease_duration_seconds*1000/3)));
  let fencingToken:bigint|null=null;
  try{
    while(!input.stop_requested()){
      const result=await input.pool.query<{
        lease_owner:string;fencing_token:string|number|bigint;acquired_at:string|Date;
        expires_at:string|Date;heartbeat_at:string|Date;database_now:string|Date;
      }>(
        `INSERT INTO twin_runtime_lease_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,1,transaction_timestamp(),transaction_timestamp()+make_interval(secs=>$8),transaction_timestamp())
         ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
           lease_owner=CASE WHEN twin_runtime_lease_v1.expires_at<=transaction_timestamp() THEN EXCLUDED.lease_owner ELSE twin_runtime_lease_v1.lease_owner END,
           fencing_token=CASE WHEN twin_runtime_lease_v1.expires_at<=transaction_timestamp() THEN twin_runtime_lease_v1.fencing_token+1 ELSE twin_runtime_lease_v1.fencing_token END,
           acquired_at=CASE WHEN twin_runtime_lease_v1.expires_at<=transaction_timestamp() THEN transaction_timestamp() ELSE twin_runtime_lease_v1.acquired_at END,
           expires_at=transaction_timestamp()+make_interval(secs=>$8),
           heartbeat_at=transaction_timestamp()
         WHERE twin_runtime_lease_v1.expires_at<=transaction_timestamp() OR twin_runtime_lease_v1.lease_owner=EXCLUDED.lease_owner
         RETURNING lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at,transaction_timestamp() AS database_now`,
        [...values(input.scope),input.lease_owner,input.lease_duration_seconds],
      );
      if(result.rows.length===0){
        process.stdout.write(JSON.stringify({runtime_role:"TWIN_RUNTIME",mode:"PRE_FORMAL_OWNER_STANDBY",status:"LEASE_HELD_BY_OTHER_OWNER"})+"\n");
        await sleep(cadenceMs); continue;
      }
      if(result.rows.length!==1||result.rows[0].lease_owner!==input.lease_owner) throw new Error("MCFT_CAP09_TWIN_PREFORMAL_LEASE_CARDINALITY");
      fencingToken=BigInt(result.rows[0].fencing_token);
      process.stdout.write(JSON.stringify({
        runtime_role:"TWIN_RUNTIME",mode:"PRE_FORMAL_OWNER_STANDBY",status:"OWNER_LEASE_HEALTHY",
        lease_owner:input.lease_owner,fencing_token:fencingToken.toString(),
        scheduler_cursor_mutation:false,scheduler_slot_mutation:false,formal_runner_started:false
      })+"\n");
      await sleep(cadenceMs);
    }
  } finally {
    if(fencingToken!==null){
      await input.pool.query(
        `UPDATE twin_runtime_lease_v1
            SET expires_at=GREATEST(transaction_timestamp(),acquired_at+interval '1 microsecond'),
                heartbeat_at=transaction_timestamp()
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND lease_owner=$7 AND fencing_token=$8 AND expires_at>transaction_timestamp()`,
        [...values(input.scope),input.lease_owner,fencingToken.toString()],
      );
    }
  }
}
