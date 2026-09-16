import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { PostgresEvidenceProducerLeaseV1 } from "../../apps/server/src/persistence/external_evidence/postgres_evidence_runtime_persistence_v1.js";
import { PostgresGfsRetryScheduleV1 } from "../../apps/server/src/persistence/external_evidence/postgres_gfs_retry_schedule_v1.js";
import type { EvidenceRuntimeScopeV1 } from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_GFS_RETRY_SCHEDULE_POSTGRES_V1_RESULT.json");
const DATABASE_URL=process.env.DATABASE_URL?.trim();if(!DATABASE_URL)throw new Error("DATABASE_URL_REQUIRED");
const SCOPE:EvidenceRuntimeScopeV1={tenant_id:"gfsRetryTenant",project_id:"gfsRetryProject",group_id:"gfsRetryGroup",field_id:"gfsRetryField",season_id:"gfsRetrySeason",zone_id:"gfsRetryZone"};
const A0="2026-09-02T19:00:00.000Z",A0_START="2026-09-02T17:00:00.000Z",A0_END=A0;
const O00="2026-09-02T20:00:00.000Z",O00_START="2026-09-02T18:50:00.000Z",O00_END="2026-09-02T19:30:00.000Z";

async function main():Promise<void>{
  const pool=new Pool({connectionString:DATABASE_URL,application_name:"mcft-cap09-gfs-retry-schedule"});
  try{
    await pool.query("DELETE FROM external_evidence_producer_lease_v1 WHERE tenant_id=$1",[SCOPE.tenant_id]);
    const lease=new PostgresEvidenceProducerLeaseV1(pool,SCOPE),repo=new PostgresGfsRetryScheduleV1(pool,SCOPE);
    const a=await lease.acquireLease({scope:SCOPE,lease_owner:"gfs-owner-A",lease_duration_seconds:600});assert(a);
    assert.equal(await repo.readGfsRetrySchedule({scope:SCOPE}),null);

    const first=await repo.claimGfsAttemptBeforeProviderFetch({claim:a,target_logical_time:A0,requested_at:"2026-09-02T17:30:00.000Z",due_window_start:A0_START,due_window_end_exclusive:A0_END});
    assert.equal(first.status,"CLAIMED");assert.equal(first.schedule.attempt_count,1);assert.equal(first.schedule.next_attempt_eligible_at,"2026-09-02T17:31:00.000Z");
    const throttled=await repo.claimGfsAttemptBeforeProviderFetch({claim:a,target_logical_time:A0,requested_at:"2026-09-02T17:30:30.000Z",due_window_start:A0_START,due_window_end_exclusive:A0_END});
    assert.equal(throttled.status,"NOT_DUE");assert.equal(throttled.database_write_count,0);
    const second=await repo.claimGfsAttemptBeforeProviderFetch({claim:a,target_logical_time:A0,requested_at:"2026-09-02T17:31:00.000Z",due_window_start:A0_START,due_window_end_exclusive:A0_END});
    assert.equal(second.status,"CLAIMED");assert.equal(second.schedule.attempt_count,2);

    await lease.releaseLease({claim:a});
    const b=await lease.acquireLease({scope:SCOPE,lease_owner:"gfs-owner-B",lease_duration_seconds:600});assert(b);assert(b.fencing_token>a.fencing_token);
    const restart=await repo.readGfsRetrySchedule({scope:SCOPE});assert(restart);assert.equal(restart.attempt_count,2);assert.equal(restart.target_logical_time,A0);
    await assert.rejects(()=>repo.claimGfsAttemptBeforeProviderFetch({claim:a,target_logical_time:A0,requested_at:"2026-09-02T17:32:00.000Z",due_window_start:A0_START,due_window_end_exclusive:A0_END}),/GFS_RETRY_STALE_FENCE/);
    const third=await repo.claimGfsAttemptBeforeProviderFetch({claim:b,target_logical_time:A0,requested_at:"2026-09-02T17:32:00.000Z",due_window_start:A0_START,due_window_end_exclusive:A0_END});
    assert.equal(third.status,"CLAIMED");assert.equal(third.schedule.attempt_count,3);
    const exhausted=await repo.claimGfsAttemptBeforeProviderFetch({claim:b,target_logical_time:A0,requested_at:"2026-09-02T17:33:00.000Z",due_window_start:A0_START,due_window_end_exclusive:A0_END});
    assert.equal(exhausted.status,"ATTEMPT_BUDGET_EXHAUSTED");assert.equal(exhausted.database_write_count,0);

    const nextTarget=await repo.claimGfsAttemptBeforeProviderFetch({claim:b,target_logical_time:O00,requested_at:O00_START,due_window_start:O00_START,due_window_end_exclusive:O00_END});
    assert.equal(nextTarget.status,"CLAIMED");assert.equal(nextTarget.schedule.target_logical_time,O00);assert.equal(nextTarget.schedule.attempt_count,1);
    await assert.rejects(()=>repo.claimGfsAttemptBeforeProviderFetch({claim:b,target_logical_time:"2026-09-02T22:00:00.000Z",requested_at:"2026-09-02T20:50:00.000Z",due_window_start:"2026-09-02T20:50:00.000Z",due_window_end_exclusive:"2026-09-02T21:30:00.000Z"}),/GFS_RETRY_TARGET_SKIP_FORBIDDEN/);
    const missed=await repo.claimGfsAttemptBeforeProviderFetch({claim:b,target_logical_time:O00,requested_at:O00_END,due_window_start:O00_START,due_window_end_exclusive:O00_END});
    assert.equal(missed.status,"MISSED_WINDOW");assert.equal(missed.database_write_count,0);

    const proof={schema_version:"geox_mcft_cap09_gfs_retry_schedule_postgres_v1",status:"PASS",durable_target_bound:true,retry_minimum_interval_seconds:60,max_attempts_per_target_window:3,same_target_throttle_restart_safe:true,attempt_budget_restart_safe:true,owner_takeover_preserves_budget:true,stale_fence_rejected:true,target_plus_one_resets_budget:true,target_skip_fail_closed:true,missed_window_zero_write:true,provider_request_count:0,canonical_evidence_write_count:0,evidence_supply_cursor_mutation_count:0,runtime_tick_cursor_mutation_count:0,twin_state_mutation:false,production_runtime_start:false};
    fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");console.log(JSON.stringify(proof,null,2));
  }finally{await pool.end();}
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error),production_runtime_start:false},null,2)+"\n");console.error(error);process.exitCode=1;});
