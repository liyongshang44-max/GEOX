import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MCFT_CAP09_GFS_LATEST_SAFE_START_LEAD_MINUTES_V1,
  MCFT_CAP09_GFS_MAX_ATTEMPTS_PER_TARGET_WINDOW_V1,
  MCFT_CAP09_GFS_RETRY_MINIMUM_INTERVAL_SECONDS_V1,
  MCFT_CAP09_GFS_SUBSEQUENT_EARLIEST_START_LEAD_MINUTES_V1,
  evaluateProductionGfsTargetDueV1,
  nextProductionGfsTargetLogicalTimeV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_gfs_target_due_policy_v1.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_PRODUCTION_GFS_TARGET_DUE_POLICY_V1_RESULT.json");
const A0="2026-09-02T19:00:00.000Z";
const FENCE="2026-09-02T17:00:00.000Z";
function main():void{
  assert.equal(MCFT_CAP09_GFS_SUBSEQUENT_EARLIEST_START_LEAD_MINUTES_V1,70);
  assert.equal(MCFT_CAP09_GFS_LATEST_SAFE_START_LEAD_MINUTES_V1,30);
  assert.equal(MCFT_CAP09_GFS_MAX_ATTEMPTS_PER_TARGET_WINDOW_V1,3);
  assert.equal(MCFT_CAP09_GFS_RETRY_MINIMUM_INTERVAL_SECONDS_V1,60);

  assert.equal(nextProductionGfsTargetLogicalTimeV1({formal_a0_logical_time:A0,durable_paired_targets:[]}),A0);
  const warm=evaluateProductionGfsTargetDueV1({planning_time:"2026-09-02T17:30:00.000Z",activation_fence_time:FENCE,formal_a0_logical_time:A0,durable_paired_targets:[]});
  assert.equal(warm.status,"DUE");assert.equal(warm.target_logical_time,A0);assert.equal(warm.due_window_start,FENCE);assert.equal(warm.due_window_end_exclusive,A0);
  const warmMiss=evaluateProductionGfsTargetDueV1({planning_time:A0,activation_fence_time:FENCE,formal_a0_logical_time:A0,durable_paired_targets:[]});
  assert.equal(warmMiss.status,"MISSED_WINDOW");

  const pairedA0=[{paired_valid_from:A0}];
  const O00="2026-09-02T20:00:00.000Z";
  assert.equal(nextProductionGfsTargetLogicalTimeV1({formal_a0_logical_time:A0,durable_paired_targets:pairedA0}),O00);
  const early=evaluateProductionGfsTargetDueV1({planning_time:"2026-09-02T18:49:59.000Z",activation_fence_time:FENCE,formal_a0_logical_time:A0,durable_paired_targets:pairedA0});
  assert.equal(early.status,"NOT_DUE");assert.equal(early.due_window_start,"2026-09-02T18:50:00.000Z");assert.equal(early.due_window_end_exclusive,"2026-09-02T19:30:00.000Z");
  const due=evaluateProductionGfsTargetDueV1({planning_time:"2026-09-02T19:00:00.000Z",activation_fence_time:FENCE,formal_a0_logical_time:A0,durable_paired_targets:pairedA0});
  assert.equal(due.status,"DUE");assert.equal(due.target_logical_time,O00);
  const missed=evaluateProductionGfsTargetDueV1({planning_time:"2026-09-02T19:30:00.000Z",activation_fence_time:FENCE,formal_a0_logical_time:A0,durable_paired_targets:pairedA0});
  assert.equal(missed.status,"MISSED_WINDOW");

  assert.throws(()=>nextProductionGfsTargetLogicalTimeV1({
    formal_a0_logical_time:A0,
    durable_paired_targets:[{paired_valid_from:A0},{paired_valid_from:"2026-09-02T21:00:00.000Z"}],
  }),/DURABLE_PROGRESS_GAP/);
  assert.throws(()=>evaluateProductionGfsTargetDueV1({
    planning_time:"2026-09-02T18:00:00.000Z",
    activation_fence_time:A0,
    formal_a0_logical_time:A0,
    durable_paired_targets:[],
  }),/ACTIVATION_FENCE_MUST_PRECEDE_A0/);

  const proof={schema_version:"geox_mcft_cap09_production_gfs_target_due_policy_result_v1",status:"PASS",first_target_source:"EXPLICIT_FORMAL_A0",subsequent_progression:"STRICT_HOURLY_CONTIGUOUS_FROM_A0",warm_start_window:"ACTIVATION_FENCE_TO_A0_EXCLUSIVE",subsequent_due_window_lead_minutes:{earliest:70,latest_exclusive:30},max_attempts_per_target_window:3,retry_minimum_interval_seconds:60,earliest_70m_and_retry_60s_are_new_geox_operational_policy:true,latest_30m_preserves_frozen_hardening:true,max_attempts_3_preserves_qualified_hardening:true,wall_clock_read:false,environment_read:false,database_access:false,provider_request_count:0,runtime_tick_cursor_access:false,production_runtime_start:false};
  fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");console.log(JSON.stringify(proof,null,2));
}
try{main();}catch(error){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error),production_runtime_start:false},null,2)+"\n");throw error;}
