import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import { PostgresEvidenceIngressAdapterV1, DATABASE_EVIDENCE_INGRESS_CONFIG_V1 } from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import { PostgresExpiredSlotRecoveryAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_expired_slot_recovery_adapter_v1.js";
import { PostgresPersistentSequentialSchedulerAdapterV1, StrictUtcHourlySchedulerClockV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import { RestartBackfillStaleDetectionServiceV1 } from "../../apps/server/src/runtime/twin_runtime/restart_backfill_stale_detection_service_v1.js";
import type { CanonicalReplayEvidenceRecordV1, ShadowOnlineSlotClaimV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_S4_POSTGRESQL_ACCEPTANCE_RESULT.json");
const SOURCE="mcft_cap09_s4_restart_backfill_acceptance_v1";
const scope:TwinScopeKeyV1={tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",field_id:"fieldA",season_id:"seasonA",zone_id:"zoneA"};
const scopeValues=[scope.tenant_id,scope.project_id,scope.group_id,scope.field_id,scope.season_id,scope.zone_id];
const schedule={scope,schedule_start_logical_time:"2026-08-05T10:00:00.000Z",slot_interval_seconds:3600 as const};
const sha=(value:unknown)=>`sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

function evidence(id:string,observedAt:string):CanonicalReplayEvidenceRecordV1{
 const canonical_payload={value:18.2,record_type:"soil_moisture_observation_v1"};
 return {...scope,dataset_id:"cap09_s4_acceptance",source_record_id:id,source_record_hash:sha({id,canonical_payload}),record_type:"soil_moisture_observation_v1",binding_id:"binding:soil",origin_source_kind:"CONTROLLED_DATABASE_EVIDENCE",origin_source_id:"soil-sensor-1",epistemic_class:"OBSERVED",available_to_runtime_at:new Date(Date.parse(observedAt)+60_000).toISOString(),role_time:{observed_at:observedAt,ingested_at:new Date(Date.parse(observedAt)+60_000).toISOString()},quality:{status:"PASS"},source_payload:{formal_eligible:true},canonical_payload,source_unit:"percent",canonical_unit:"percent",conversion_rule:{rule_id:"IDENTITY_V1"},limitations:[]};
}
async function insertEvidence(pool:Pool,factId:string,record:CanonicalReplayEvidenceRecordV1){
 await pool.query(`INSERT INTO facts(fact_id,occurred_at,source,record_json) VALUES($1,$2::timestamptz,$3,$4::jsonb)`,[factId,record.available_to_runtime_at,SOURCE,JSON.stringify({type:record.record_type,payload:record})]);
}
async function reset(pool:Pool){
 await pool.query("DROP SCHEMA public CASCADE");await pool.query("CREATE SCHEMA public");
 await pool.query(fs.readFileSync(path.join(ROOT,"docker/postgres/init/001_schema.sql"),"utf8"));
 await pool.query(fs.readFileSync(path.join(ROOT,"apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"),"utf8"));
 await pool.query(fs.readFileSync(path.join(ROOT,"apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql"),"utf8"));
}
async function factCount(pool:Pool){return (await pool.query<{n:number}>("SELECT count(*)::int n FROM facts")).rows[0].n;}
function terminal(claim:ShadowOnlineSlotClaimV1,suffix:string){return{boundary:structuredClone(claim.boundary),state:"DEGRADED" as const,tick_ref:`tick:${suffix}`,health_ref:`health:${suffix}`,terminal_at:new Date(Date.parse(claim.boundary.logical_time)+300_000).toISOString()};}
const checkpoint={async readPersistedNextTickSnapshot(){return{checkpoint:{object_id:"checkpoint:persisted-o-minus-1"}} as never;}};

async function main(){
 if(process.env.MCFT_CAP_09_S4_DESTRUCTIVE_ACCEPTANCE!=="1")throw new Error("SET_MCFT_CAP_09_S4_DESTRUCTIVE_ACCEPTANCE_1");
 const url=process.env.DATABASE_URL;if(!url)throw new Error("DATABASE_URL_REQUIRED");const db=decodeURIComponent(new URL(url).pathname.slice(1));
 if(!/(mcft|cap.*09|s4|restart|acceptance|test)/i.test(db))throw new Error(`ISOLATED_ACCEPTANCE_DATABASE_REQUIRED:${db}`);
 const pool=new Pool({connectionString:url,max:8});
 try{
  await reset(pool);
  await insertEvidence(pool,"s4-evidence-o00",evidence("soil-0930","2026-08-05T09:30:00.000Z"));
  await insertEvidence(pool,"s4-evidence-o03",evidence("soil-1230","2026-08-05T12:30:00.000Z"));
  const baselineFacts=await factCount(pool);
  const clock=new StrictUtcHourlySchedulerClockV1(schedule,()=>new Date("2026-08-05T13:05:00.000Z"));
  const boundaries=await Promise.all((["O00","O01","O02","O03"] as const).map((slot_id)=>clock.resolveBoundary({scope,slot_id})));
  const scheduler=new PostgresPersistentSequentialSchedulerAdapterV1(pool,schedule);
  const recovery=new PostgresExpiredSlotRecoveryAdapterV1(pool,scope);
  const staleConfig={...DATABASE_EVIDENCE_INGRESS_CONFIG_V1,stale_after_seconds:900};
  const ingress=new PostgresEvidenceIngressAdapterV1(pool,staleConfig as never);
  const service=new RestartBackfillStaleDetectionServiceV1(scheduler,recovery,ingress,checkpoint as never);

  const original=await scheduler.claimDueSlot({boundary:boundaries[0],lease_owner:"writer-before-crash",lease_duration_seconds:300});
  await pool.query(`UPDATE twin_runtime_lease_v1 SET acquired_at=transaction_timestamp()-interval '10 minutes',heartbeat_at=transaction_timestamp()-interval '5 minutes',expires_at=transaction_timestamp()-interval '1 second' WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,scopeValues);
  const recovered=await service.recoverOrClaimOldestDueSlot({scope,through_logical_time:boundaries[3].scheduler_wall_clock_observed_at,lease_owner:"writer-after-restart",lease_duration_seconds:300});
  assert.equal(recovered.status,"CLAIM_READY");assert.equal(recovered.mode,"RECOVERED_EXPIRED_ACTIVE_SLOT");
  const recoveredClaim=recovered.claim;if(!recoveredClaim)throw new Error("RECOVERED_CLAIM_REQUIRED");
  assert.equal(recoveredClaim.idempotency_key,original.idempotency_key,"RECOVERY_MUST_PRESERVE_IDEMPOTENCY_KEY");
  assert(recoveredClaim.fencing_token>original.fencing_token,"RECOVERY_MUST_ADVANCE_FENCE");
  assert.equal(recovered.evidence?.freshness_status,"STALE","REAL_DATABASE_EVIDENCE_MUST_BE_STALE");
  assert.equal(recovered.runtime_health_status,"DEGRADED");assert.equal(recovered.checkpoint_ref,"checkpoint:persisted-o-minus-1");
  const retry=await service.recoverOrClaimOldestDueSlot({scope,through_logical_time:boundaries[3].scheduler_wall_clock_observed_at,lease_owner:"writer-after-restart",lease_duration_seconds:300});
  assert.equal(retry.claim?.fencing_token,recoveredClaim.fencing_token,"SAME_OWNER_RETRY_MUST_REUSE_FENCE");
  assert.equal(retry.claim?.idempotency_key,recoveredClaim.idempotency_key);
  await assert.rejects(()=>scheduler.recordTerminalResult({claim:original,result:terminal(original,"old-claim")}),/STALE_FENCING_TOKEN|LEASE_OWNER_MISMATCH/);
  await scheduler.recordTerminalResult({claim:recoveredClaim,result:terminal(recoveredClaim,"o00-recovered")});

  const backfill1=await service.recoverOrClaimOldestDueSlot({scope,through_logical_time:boundaries[3].scheduler_wall_clock_observed_at,lease_owner:"writer-backfill-1",lease_duration_seconds:300});
  assert.equal(backfill1.mode,"CLAIMED_OLDEST_MISSED_SLOT");const backfill1Claim=backfill1.claim;if(!backfill1Claim)throw new Error("BACKFILL1_CLAIM_REQUIRED");assert.equal(backfill1Claim.boundary.slot_id,"O01","OLDEST_MISSED_SLOT_MUST_BE_O01");
  await scheduler.recordTerminalResult({claim:backfill1Claim,result:terminal(backfill1Claim,"o01")});

  const restartedScheduler=new PostgresPersistentSequentialSchedulerAdapterV1(pool,schedule);
  const restartedRecovery=new PostgresExpiredSlotRecoveryAdapterV1(pool,scope);
  const restartedService=new RestartBackfillStaleDetectionServiceV1(restartedScheduler,restartedRecovery,ingress,checkpoint as never);
  const backfill2=await restartedService.recoverOrClaimOldestDueSlot({scope,through_logical_time:boundaries[3].scheduler_wall_clock_observed_at,lease_owner:"writer-backfill-2",lease_duration_seconds:300});
  const backfill2Claim=backfill2.claim;if(!backfill2Claim)throw new Error("BACKFILL2_CLAIM_REQUIRED");assert.equal(backfill2Claim.boundary.slot_id,"O02","RESTART_MUST_READ_DURABLE_CURSOR");
  const availability=await restartedService.inspectAvailability({scope,boundary:boundaries[3]});
  assert.equal(availability.checkpoint_ref,"checkpoint:persisted-o-minus-1");
  assert.equal(availability.durable_cursor_slot_id,"O02");
  assert.equal(availability.oldest_missed_slot_id,"O02");
  assert.equal(availability.scheduler_lag_seconds,3900);
  assert.equal(availability.evidence_freshness_status,"STALE");
  assert.equal(availability.runtime_health_status,"DEGRADED");
  await restartedScheduler.recordTerminalResult({claim:backfill2Claim,result:terminal(backfill2Claim,"o02")});

  const active=(await pool.query<{n:number}>("SELECT count(*)::int n FROM twin_shadow_online_scheduler_slot_v1 WHERE state IN ('CLAIMED','RUNNING')")).rows[0].n;
  const slots=(await pool.query<{slot_id:string;n:number}>("SELECT slot_id,count(*)::int n FROM twin_shadow_online_scheduler_slot_v1 GROUP BY slot_id ORDER BY slot_id")).rows;
  assert.equal(active,0);assert.deepEqual(slots,[{slot_id:"O00",n:1},{slot_id:"O01",n:1},{slot_id:"O02",n:1}]);
  assert.equal(await factCount(pool),baselineFacts,"S4_MUST_NOT_WRITE_CANONICAL_FACTS");
  const unavailable=new RestartBackfillStaleDetectionServiceV1(restartedScheduler,restartedRecovery,ingress,{async readPersistedNextTickSnapshot(){return null;}});
  const noCheckpoint=await unavailable.recoverOrClaimOldestDueSlot({scope,through_logical_time:boundaries[3].scheduler_wall_clock_observed_at,lease_owner:"writer-none",lease_duration_seconds:300});
  assert.equal(noCheckpoint.status,"UNAVAILABLE_NO_CHECKPOINT");assert.equal(noCheckpoint.runtime_health_status,"UNAVAILABLE");

  const result={status:"PASS",acceptance_mode:"REAL_POSTGRESQL_RESTART_BACKFILL_STALE_DETECTION",persisted_checkpoint_read_verified:true,expired_active_slot_recovered:true,idempotency_key_preserved:true,fencing_token_advanced:true,old_claim_rejected:true,same_owner_retry_idempotent:true,oldest_missed_slot_first_verified:true,restart_cursor_readback_verified:true,stale_database_evidence_degraded:true,scheduler_lag_runtime_health_verified:true,no_checkpoint_unavailable_verified:true,duplicate_slot_rows:0,active_slot_count:active,canonical_fact_delta:0,canonical_write_performed:false,background_scheduler_started:false,production_wiring_present:false};
  fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));
 }finally{await pool.end();}
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:String(error?.message??error)},null,2)+"\n");console.error(error);process.exitCode=1;});
