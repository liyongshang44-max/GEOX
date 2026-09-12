import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  EvidenceRuntimeHostV1,
  MCFT_CAP09_EVIDENCE_RUNTIME_DURABLE_RESTART_COMPONENTS_V1,
  type EvidenceRuntimeHostHealthEventV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_host_v1.js";
import {
  MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ATTEMPT_CONTRACT_ID_V1,
  type EvidenceRuntimeHostAttemptKindV1,
  type EvidenceRuntimeHostAttemptPlanV1,
  type EvidenceRuntimeHostAttemptResultV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_host_attempt_v1.js";
import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type EvidenceRuntimeScopeV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
const OUT=path.resolve("acceptance-output/MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_HOST_V1_RESULT.json");
const SCOPE:EvidenceRuntimeScopeV1={tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",field_id:"field_e3r1",season_id:"season_2026",zone_id:"zone_root"};
function resultV1(input:{id:string;kind:EvidenceRuntimeHostAttemptKindV1;status:"COMPLETED"|"LEASE_HELD_BY_OTHER_OWNER"|"PROVIDER_NOT_DUE";owner?:string;}):EvidenceRuntimeHostAttemptResultV1{
  return {attempt_contract_id:MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ATTEMPT_CONTRACT_ID_V1,attempt_id:input.id,attempt_kind:input.kind,status:input.status,lease_claim:input.status!=="LEASE_HELD_BY_OTHER_OWNER"?{lease_contract_id:MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,scope:{...SCOPE},lease_owner:input.owner??"host-A",fencing_token:3n,acquired_at:"2026-08-27T02:00:00.000Z",expires_at:"2026-08-27T02:10:00.000Z",heartbeat_at:"2026-08-27T02:00:01.000Z",database_now:"2026-08-27T02:00:01.000Z"}:null,canonical_record_count:input.status==="COMPLETED"?2:0,visible_ingress_count:input.status==="COMPLETED"?2:0,evidence_supply_cursor_advance_count:input.status==="COMPLETED"?2:0,twin_state_mutation:false,runtime_tick_cursor_mutation:false};
}
function planV1(id:string,kind:EvidenceRuntimeHostAttemptKindV1,execute:EvidenceRuntimeHostAttemptPlanV1["execute"]):EvidenceRuntimeHostAttemptPlanV1{return {attempt_id:id,attempt_kind:kind,execute};}
async function expectReject(fn:()=>Promise<unknown>,pattern:RegExp):Promise<void>{let caught:unknown=null;try{await fn();}catch(error){caught=error;}assert(caught instanceof Error,"PHASE3_HOST_EXPECTED_ERROR");assert.match(caught.message,pattern);}
async function main():Promise<void>{
  const health:EvidenceRuntimeHostHealthEventV1[]=[],waits:string[]=[];let calls=0;
  const host=new EvidenceRuntimeHostV1({
    planner:{async nextAttemptPlan(input){if(input.cycle_attempt>=3)return null;const id="normal-"+input.cycle_attempt;return planV1(id,"CANONICAL_WORK_ITEM_CYCLE",async()=>{calls+=1;if(calls===1)throw new Error("RETRYABLE:provider-temporary");if(calls===2)return resultV1({id,kind:"CANONICAL_WORK_ITEM_CYCLE",status:"LEASE_HELD_BY_OTHER_OWNER"});return resultV1({id,kind:"CANONICAL_WORK_ITEM_CYCLE",status:"COMPLETED"});});}},
    wait:{async waitAfterAttempt(input){waits.push(input.reason);}},
    health:{async recordHealth(event){health.push(structuredClone(event));}},
    stop:{stopRequested:()=>false},
    failure_classifier:{classify(error){return error instanceof Error&&error.message.startsWith("RETRYABLE:")?"RETRYABLE":"FATAL";}},
  });
  const run=await host.run({scope:SCOPE,lease_owner:"host-A",lease_duration_seconds:300});
  assert.equal(run.stop_reason,"PLANNER_EXHAUSTED");assert.equal(run.cycle_attempt_count,3);assert.equal(run.successful_cycle_count,1);assert.equal(run.standby_cycle_count,1);assert.equal(run.retryable_failure_count,1);
  assert.equal(run.durable_restart_authority,"EVIDENCE_PLANE_DURABLE_PROGRESS_SET");assert.deepEqual(run.durable_restart_components,MCFT_CAP09_EVIDENCE_RUNTIME_DURABLE_RESTART_COMPONENTS_V1);
  assert.deepEqual(waits,["RETRY_BACKOFF","LEASE_STANDBY","SUCCESS_CADENCE"]);
  assert.deepEqual(health.map(e=>[e.status,e.detail]),[["STARTING","HOST_START"],["DEGRADED","RETRYABLE_ATTEMPT_FAILURE"],["STANDBY","LEASE_HELD_BY_OTHER_OWNER"],["HEALTHY","ATTEMPT_COMPLETED"],["STOPPING","PLANNER_EXHAUSTED"]]);

  const kinds:EvidenceRuntimeHostAttemptKindV1[]=["KBS_RAW_HOURLY_PUBLICATION_CYCLE","GFS_PARTIAL_PAIR_REHYDRATION","CANONICAL_WORK_ITEM_CYCLE"],executed:EvidenceRuntimeHostAttemptKindV1[]=[];let stop=false;
  const heterogeneousHost=new EvidenceRuntimeHostV1({
    planner:{async nextAttemptPlan(input){const kind=kinds[input.successful_cycle_count];if(!kind)return null;const id="heterogeneous-"+input.successful_cycle_count;return planV1(id,kind,async()=>{executed.push(kind);return resultV1({id,kind,status:"COMPLETED"});});}},
    wait:{async waitAfterAttempt(){if(executed.length===3)stop=true;}},
    health:{async recordHealth(){}},stop:{stopRequested:()=>stop},failure_classifier:{classify:()=> "FATAL"},
  });
  const heterogeneous=await heterogeneousHost.run({scope:SCOPE,lease_owner:"host-A",lease_duration_seconds:300});
  assert.equal(heterogeneous.stop_reason,"STOP_REQUESTED");assert.deepEqual(executed,kinds);assert.equal(heterogeneous.successful_cycle_count,3);

  const fatalHealth:EvidenceRuntimeHostHealthEventV1[]=[];
  const fatalHost=new EvidenceRuntimeHostV1({planner:{async nextAttemptPlan(){return planV1("fatal","CANONICAL_WORK_ITEM_CYCLE",async()=>{throw new Error("FATAL:identity-corruption");});}},wait:{async waitAfterAttempt(){throw new Error("FATAL_HOST_WAIT_FORBIDDEN");}},health:{async recordHealth(event){fatalHealth.push(structuredClone(event));}},stop:{stopRequested:()=>false},failure_classifier:{classify:()=> "FATAL"}});
  await expectReject(()=>fatalHost.run({scope:SCOPE,lease_owner:"host-fatal",lease_duration_seconds:300}),/FATAL:identity-corruption/);
  assert.deepEqual(fatalHealth.map(e=>[e.status,e.detail]),[["STARTING","HOST_START"],["DEGRADED","FATAL_ATTEMPT_FAILURE"]]);

  let plannerCalls=0;
  const stoppedHost=new EvidenceRuntimeHostV1({planner:{async nextAttemptPlan(){plannerCalls+=1;throw new Error("STOPPED_PLANNER_FORBIDDEN");}},wait:{async waitAfterAttempt(){throw new Error("STOPPED_WAIT_FORBIDDEN");}},health:{async recordHealth(){}},stop:{stopRequested:()=>true},failure_classifier:{classify:()=> "FATAL"}});
  const stopped=await stoppedHost.run({scope:SCOPE,lease_owner:"host-stop",lease_duration_seconds:300});assert.equal(stopped.stop_reason,"STOP_REQUESTED");assert.equal(plannerCalls,0);

  let notDueStopped=false;
  const notDueHost=new EvidenceRuntimeHostV1({planner:{async nextAttemptPlan(){return {status:"NOT_DUE" as const};}},wait:{async waitAfterAttempt(input){assert.equal(input.reason,"PLANNER_NOT_DUE");notDueStopped=true;}},health:{async recordHealth(){}},stop:{stopRequested:()=>notDueStopped},failure_classifier:{classify:()=> "FATAL"}});
  const notDue=await notDueHost.run({scope:SCOPE,lease_owner:"host-not-due",lease_duration_seconds:300});assert.equal(notDue.cycle_attempt_count,0);assert.equal(notDue.not_due_wait_count,1);

  let providerFenceStopped=false;
  const providerFenceHealth:EvidenceRuntimeHostHealthEventV1[]=[];
  const providerFenceHost=new EvidenceRuntimeHostV1({
    planner:{async nextAttemptPlan(){return planV1("provider-not-due","CANONICAL_WORK_ITEM_CYCLE",async()=>resultV1({id:"provider-not-due",kind:"CANONICAL_WORK_ITEM_CYCLE",status:"PROVIDER_NOT_DUE"}));}},
    wait:{async waitAfterAttempt(input){assert.equal(input.reason,"PROVIDER_NOT_DUE");providerFenceStopped=true;}},
    health:{async recordHealth(event){providerFenceHealth.push(structuredClone(event));}},
    stop:{stopRequested:()=>providerFenceStopped},
    failure_classifier:{classify:()=> "FATAL"},
  });
  const providerFenceRun=await providerFenceHost.run({scope:SCOPE,lease_owner:"host-provider-not-due",lease_duration_seconds:300});
  assert.equal(providerFenceRun.successful_cycle_count,0);
  assert.equal(providerFenceRun.not_due_wait_count,1);
  assert.deepEqual(providerFenceHealth.map(e=>[e.status,e.detail]),[["STARTING","HOST_START"],["STANDBY","PROVIDER_NOT_DUE"],["STOPPING","STOP_REQUESTED"]]);

  const source=fs.readFileSync(path.resolve("apps/server/src/external_evidence/mcft_cap09_evidence_runtime_host_v1.ts"),"utf8");
  for(const forbidden of ["process.env","setInterval(","setTimeout(","child_process","fetch(","INSERT INTO","UPDATE ","DELETE FROM","EvidenceRuntimeCycleServiceV1","scripts/runtime_acceptance"])assert.equal(source.includes(forbidden),false,"PHASE3_HOST_FORBIDDEN_DEPENDENCY:"+forbidden);
  assert.equal(source.includes("EvidenceRuntimeHostAttemptPlanV1"),true);assert.equal(source.includes("EVIDENCE_PLANE_DURABLE_PROGRESS_SET"),true);
  for(const component of MCFT_CAP09_EVIDENCE_RUNTIME_DURABLE_RESTART_COMPONENTS_V1)assert.equal(source.includes(component),true);

  const proof={schema_version:"geox_mcft_cap09_phase3_evidence_runtime_host_qualification_v1",status:"PASS",retryable_attempt_retried:true,lease_standby_waited:true,successful_attempt_waited_for_cadence:true,fatal_attempt_fail_closed:true,immediate_stop_skips_planner_and_attempt:true,planner_not_due_waits_without_attempt_or_provider:true,provider_not_due_is_nonfailure_standby:true,heterogeneous_attempt_kinds_executed_in_single_host:executed,second_evidence_host_required:false,host_attempt_execution_seam:true,host_direct_cycle_service_dependency:false,provider_direct_call_from_host:false,database_direct_call_from_host:false,durable_restart_authority:run.durable_restart_authority,durable_restart_components:run.durable_restart_components,canonical_gfs_hourly_target_history_in_restart_authority:run.durable_restart_components.includes("CANONICAL_GFS_HOURLY_TARGET_PAIR_HISTORY"),production_activation:false,runtime_tick_cursor_mutation:false,twin_state_mutation:false,formal_v5_armed:false,graduation_effect:false};
  fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");console.log(JSON.stringify(proof,null,2));
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error)},null,2)+"\n");console.error(error);process.exitCode=1;});
