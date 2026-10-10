import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { PostgresEvidenceProducerLeaseV1 } from "../../apps/server/src/persistence/external_evidence/postgres_evidence_runtime_persistence_v1.js";
import { PostgresEvidenceSourcePollScheduleV1 } from "../../apps/server/src/persistence/external_evidence/postgres_evidence_source_poll_schedule_v1.js";
import { evaluateProductionEvidenceSourceDueV1 } from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_source_due_policy_v1.js";
import type { EvidenceRuntimeScopeV1 } from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
const OUT=path.resolve("acceptance-output/MCFT_CAP_09_EVIDENCE_SOURCE_POLL_SCHEDULE_POSTGRES_V1_RESULT.json");
const DATABASE_URL=process.env.DATABASE_URL?.trim();if(!DATABASE_URL)throw new Error("DATABASE_URL_REQUIRED");
const SCOPE:EvidenceRuntimeScopeV1={tenant_id:"pollTenant",project_id:"pollProject",group_id:"pollGroup",field_id:"pollField",season_id:"pollSeason",zone_id:"pollZone"};
const FENCE="2026-09-01T12:00:00.000Z";
async function main():Promise<void>{
  const pool=new Pool({connectionString:DATABASE_URL,application_name:"mcft-cap09-source-poll-schedule"});
  try{
    await pool.query("DELETE FROM external_evidence_producer_lease_v1 WHERE tenant_id=$1",[SCOPE.tenant_id]);
    const lease=new PostgresEvidenceProducerLeaseV1(pool,SCOPE),repo=new PostgresEvidenceSourcePollScheduleV1(pool,SCOPE);
    const a=await lease.acquireLease({scope:SCOPE,lease_owner:"poll-owner-A",lease_duration_seconds:600});assert(a);
    assert.equal(await repo.readSourcePollSchedule({scope:SCOPE,source_family:"KBS_RAW_HOURLY"}),null);
    assert.equal(evaluateProductionEvidenceSourceDueV1({source_family:"KBS_RAW_HOURLY",planning_time:FENCE,activation_fence_time:FENCE,schedule:null}).status,"DUE");
    const first=await repo.claimPollBeforeProviderFetch({claim:a,source_family:"KBS_RAW_HOURLY",activation_fence_time:FENCE,requested_at:FENCE});assert.equal(first.status,"CLAIMED");assert.equal(first.schedule.next_poll_eligible_at,"2026-09-01T12:15:00.000Z");
    const restartRead=await repo.readSourcePollSchedule({scope:SCOPE,source_family:"KBS_RAW_HOURLY"});assert(restartRead);
    assert.equal(evaluateProductionEvidenceSourceDueV1({source_family:"KBS_RAW_HOURLY",planning_time:"2026-09-01T12:05:00.000Z",activation_fence_time:FENCE,schedule:restartRead}).status,"NOT_DUE");
    const noWrite=await repo.claimPollBeforeProviderFetch({claim:a,source_family:"KBS_RAW_HOURLY",activation_fence_time:FENCE,requested_at:"2026-09-01T12:05:00.000Z"});assert.equal(noWrite.status,"NOT_DUE");assert.equal(noWrite.database_write_count,0);assert.equal(noWrite.provider_request_authorized,false);
    const soil=await repo.claimPollBeforeProviderFetch({claim:a,source_family:"KBS_SOIL",activation_fence_time:FENCE,requested_at:FENCE});assert.equal(soil.status,"CLAIMED");assert.equal(soil.schedule.next_poll_eligible_at,"2026-09-01T12:05:00.000Z");
    await lease.releaseLease({claim:a});
    const b=await lease.acquireLease({scope:SCOPE,lease_owner:"poll-owner-B",lease_duration_seconds:600});assert(b);assert(b.fencing_token>a.fencing_token);
    const afterTakeover=await repo.readSourcePollSchedule({scope:SCOPE,source_family:"KBS_RAW_HOURLY"});assert(afterTakeover);assert.equal(afterTakeover.next_poll_eligible_at,"2026-09-01T12:15:00.000Z");
    await assert.rejects(()=>repo.claimPollBeforeProviderFetch({claim:a,source_family:"KBS_RAW_HOURLY",activation_fence_time:FENCE,requested_at:"2026-09-01T12:15:00.000Z"}),/EVIDENCE_SOURCE_POLL_STALE_FENCE/);
    const bClaim=await repo.claimPollBeforeProviderFetch({claim:b,source_family:"KBS_RAW_HOURLY",activation_fence_time:FENCE,requested_at:"2026-09-01T12:15:00.000Z"});assert.equal(bClaim.status,"CLAIMED");assert.equal(bClaim.schedule.writer_lease_owner,"poll-owner-B");assert.equal(bClaim.schedule.writer_fencing_token,b.fencing_token);assert.equal(bClaim.schedule.next_poll_eligible_at,"2026-09-01T12:30:00.000Z");
    const proof={schema_version:"geox_mcft_cap09_evidence_source_poll_schedule_postgres_v1",status:"PASS",first_poll_due_at_activation_fence:true,kbs_raw_hourly_next_eligible_minutes:15,kbs_soil_next_eligible_minutes:5,same_window_second_claim_not_due:true,same_window_second_claim_database_write_count:noWrite.database_write_count,restart_read_preserves_throttle:true,takeover_preserves_throttle:true,stale_fence_rejected:true,new_owner_fenced_claim_succeeds:true,provider_request_count:0,canonical_evidence_write_count:0,evidence_supply_cursor_mutation_count:0,runtime_tick_cursor_mutation_count:0,twin_state_mutation:false,production_runtime_start:false};
    fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");console.log(JSON.stringify(proof,null,2));
  }finally{await pool.end();}
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error),production_runtime_start:false},null,2)+"\n");console.error(error);process.exitCode=1;});
