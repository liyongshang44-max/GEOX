import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type {
  EvidenceRuntimeCycleWorkItemV1,
  ExecuteEvidenceRuntimeCycleResultV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_cycle_service_v1.js";
import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type EvidenceRuntimeScopeV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import type {
  GfsCyclePairProgressV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_source_progress_v1.js";
import {
  ProductionEvidenceSourcePlanExecutorV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_source_plan_executor_v1.js";
import type {
  ProductionEvidenceSourceDecisionV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_source_planner_v1.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_SOURCE_PLAN_EXECUTOR_V1_RESULT.json");
const SCOPE:EvidenceRuntimeScopeV1={tenant_id:"t",project_id:"p",group_id:"g",field_id:"f",season_id:"s",zone_id:"z"};
const REQUESTED="2026-09-02T18:55:00.000Z",TARGET="2026-09-02T20:00:00.000Z",CYCLE="2026-09-02T18:00:00.000Z",CYCLE_KEY="20260902t180000z";
function claim(){return {lease_contract_id:MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,scope:{...SCOPE},lease_owner:"owner",fencing_token:9n,acquired_at:REQUESTED,expires_at:"2026-09-02T19:05:00.000Z",heartbeat_at:REQUESTED,database_now:REQUESTED} as const;}
function item(id:string):EvidenceRuntimeCycleWorkItemV1{return {work_item_id:id,dataset_id:"fixture",request:{request_id:id,provider_id:"fixture",source_family:"fixture",locator:"https://example.invalid",allowed_final_hosts:["example.invalid"],use_policy_ref:"fixture",requested_at:REQUESTED,expected_content_type_prefixes:["application/json"],limitations:["QUALIFICATION_ONLY"]},transport:{async fetchRawEvidence(){throw new Error("EXECUTOR_ACCEPTANCE_TRANSPORT_MUST_NOT_RUN");}},decoder:{decoder_id:"fixture",decoder_version:"1",async decodeRetainedEvidence(){throw new Error("EXECUTOR_ACCEPTANCE_DECODER_MUST_NOT_RUN");}}};}
function cycleResult(workItemCount=1):ExecuteEvidenceRuntimeCycleResultV1{return {service_id:"MCFT_CAP09_EVIDENCE_RUNTIME_CYCLE_SERVICE_V1",status:"COMPLETED",lease_claim:claim(),work_item_count:workItemCount,canonical_record_count:2,visible_ingress_count:2,evidence_supply_cursor_advance_count:2,work_item_results:[{work_item_id:"fixture",canonical_record_count:2,visible_ingress_count:2}],twin_state_mutation:false,runtime_tick_cursor_mutation:false};}
function partial():GfsCyclePairProgressV1{
  return {cycle_key:CYCLE_KEY,cycle_issued_at:CYCLE,state:"PARTIAL",weather:{scope:{...SCOPE},binding_id:"noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1",origin_source_id:"gfs_"+CYCLE_KEY+"_pgrb2_0p25_kbs",fact_id:"fact_"+"a".repeat(64),record_semantic_sha256:"sha256:"+"b".repeat(64),available_to_runtime_at:REQUESTED,publication_available_through:REQUESTED,latest_event_time:CYCLE,latest_source_record_id:"source-record",event_time_contiguous_from:CYCLE,event_time_contiguous_through:CYCLE,event_time_max_seen:CYCLE,event_gap_count:0,revision_count:0,publication_event_count:1,cadence_profile_id:"fixture",role_time:{issued_at:CYCLE,valid_from:TARGET},post_commit_db_readback_at:REQUESTED,lease_owner:"owner",fencing_token:1n,advanced_at:REQUESTED},future_et0:null,paired_valid_from:null};
}
function action(operation:Extract<ProductionEvidenceSourceDecisionV1,{status:"ACTION"}>["operation"]):ProductionEvidenceSourceDecisionV1{return {source_family:operation.kind==="KBS_RAW_HOURLY_PUBLICATION_CYCLE"?"KBS_RAW_HOURLY":operation.kind==="KBS_SOIL_CURRENT_ACQUIRE"?"KBS_SOIL":"GFS_BUNDLE",status:"ACTION",authority_ref:"authority://fixture",operation};}
async function main():Promise<void>{
  let cycleCalls=0,soilBuilds=0,gfsBuilds=0,partialBuilds=0,kbsCalls=0;
  const executor=new ProductionEvidenceSourcePlanExecutorV1({
    cycle_service:{async executeCycle(input){cycleCalls++;assert.equal(input.work_items.length,1);return cycleResult();}},
    work_item_factory:{
      buildKbsSoilCurrent(input){soilBuilds++;assert.equal(input.requested_at,REQUESTED);return item("soil");},
      buildGfsBundle(input){gfsBuilds++;assert.equal(input.target_logical_time,TARGET);return item("gfs");},
    },
    gfs_partial_factory:{async buildWorkItem(input){partialBuilds++;assert.equal(input.partial.weather?.fact_id,"fact_"+"a".repeat(64));return {adapter_id:"MCFT_CAP09_GFS_PARTIAL_PAIR_REHYDRATION_ADAPTER_V1",cycle_key:CYCLE_KEY,cycle_issued_at:CYCLE,target_logical_time:TARGET,available_role:"WEATHER",missing_role:"FUTURE_ET0",source_fact_id:"fact_"+"a".repeat(64),source_record_semantic_sha256:"sha256:"+"b".repeat(64),work_item:item("gfs-partial"),exact_fact_read_count:1,private_retained_raw_read_count:1,provider_request_count:0,raw_store_write_count:0,cursor_mutation_count:0,runtime_tick_cursor_access_count:0};}},
    kbs_publication_cycle:{async executeCycle(input){kbsCalls++;assert.equal(input.runtime_start_authority_ref,"authority://runtime-start");return {service_id:"MCFT_CAP09_KBS_RAW_HOURLY_PUBLICATION_CYCLE_SERVICE_V1",status:"BASELINE_INITIALIZED",lease_claim:claim(),provider_request_count:1,raw_retention_attempt_count:1,retained_raw_read_count:1,forward_event_times:[],canonical_record_count:0,visible_ingress_count:0,evidence_supply_cursor_advance_count:0,baseline_manifest_write_count:1,baseline_pointer_advance_count:1,baseline_pointer_latest_before:null,baseline_pointer_latest_after:TARGET,blocked_reason:null,twin_state_mutation:false,runtime_process_start:false,production_target_planner_bound:false};}},
    runtime_start_authority_ref:"authority://runtime-start",
    activation_fence_time:"2026-09-02T17:00:00.000Z",
    provider_attempt_fence_factory:{
      buildForDecision(decision){
        if(decision.status==="NOT_DUE" || decision.operation.kind==="GFS_PARTIAL_PAIR_REHYDRATE") return null;
        return {async claimBeforeProviderFetch(){return {status:"AUTHORIZED" as const,durable_coordination_write_count:1 as const};}};
      },
    },
  });

  const kbs=executor.buildAttempt(action({kind:"KBS_RAW_HOURLY_PUBLICATION_CYCLE",requested_at:REQUESTED,observed_pair_state:"ABSENT",paired_contiguous_through:null,pair_skew_seconds:null,bindable_to_current_cycle_service:true}));assert(kbs);assert.equal(kbs.attempt_kind,"KBS_RAW_HOURLY_PUBLICATION_CYCLE");const kbsResult=await kbs.execute({scope:SCOPE,lease_owner:"owner",lease_duration_seconds:300});assert.equal(kbsResult.status,"COMPLETED");assert.equal(kbsCalls,1);

  const gfs=executor.buildAttempt(action({kind:"GFS_BUNDLE_ACQUIRE",target_logical_time:TARGET,requested_at:REQUESTED,due_window_start:"2026-09-02T18:50:00.000Z",due_window_end_exclusive:"2026-09-02T19:30:00.000Z",max_attempts_per_target_window:3,retry_minimum_interval_seconds:60,bindable_to_current_work_item_factory:true}));assert(gfs);assert.equal(gfs.attempt_kind,"CANONICAL_WORK_ITEM_CYCLE");await gfs.execute({scope:SCOPE,lease_owner:"owner",lease_duration_seconds:300});assert.equal(gfsBuilds,1);

  const partialProgress=partial();
  const repair=executor.buildAttempt(action({kind:"GFS_PARTIAL_PAIR_REHYDRATE",requested_at:REQUESTED,target_logical_time:TARGET,cycle_key:CYCLE_KEY,cycle_issued_at:CYCLE,available_role:"WEATHER",partial_progress:partialProgress,due_window_start:"2026-09-02T18:50:00.000Z",due_window_end_exclusive:"2026-09-02T19:30:00.000Z",bindable_to_current_cycle_service:true}));assert(repair);assert.equal(repair.attempt_kind,"GFS_PARTIAL_PAIR_REHYDRATION");await repair.execute({scope:SCOPE,lease_owner:"owner",lease_duration_seconds:300});assert.equal(partialBuilds,1);

  const soil=executor.buildAttempt(action({kind:"KBS_SOIL_CURRENT_ACQUIRE",requested_at:REQUESTED,latest_observed_event_time:null,bindable_to_current_work_item_factory:true}));assert(soil);assert.equal(soil.attempt_kind,"CANONICAL_WORK_ITEM_CYCLE");await soil.execute({scope:SCOPE,lease_owner:"owner",lease_duration_seconds:300});assert.equal(soilBuilds,1);
  assert.equal(cycleCalls,3);

  const notDue=executor.buildAttempt({source_family:"KBS_SOIL",status:"NOT_DUE",reason:"EXPLICIT_NOT_DUE",authority_ref:"authority://fixture"});
  assert.equal(notDue,null);

  const blockedExecutor=new ProductionEvidenceSourcePlanExecutorV1({
    cycle_service:{async executeCycle(){return cycleResult();}},
    work_item_factory:{buildKbsSoilCurrent(){return item("soil");},buildGfsBundle(){return item("gfs");}},
    gfs_partial_factory:{async buildWorkItem(){throw new Error("BLOCKED_EXECUTOR_PARTIAL_FORBIDDEN");}},
    kbs_publication_cycle:{async executeCycle(){return {service_id:"MCFT_CAP09_KBS_RAW_HOURLY_PUBLICATION_CYCLE_SERVICE_V1",status:"BLOCKED_FORWARD_GAP",lease_claim:claim(),provider_request_count:1,raw_retention_attempt_count:1,retained_raw_read_count:2,forward_event_times:[TARGET],canonical_record_count:0,visible_ingress_count:0,evidence_supply_cursor_advance_count:0,baseline_manifest_write_count:0,baseline_pointer_advance_count:0,baseline_pointer_latest_before:"2026-09-02T19:00:00.000Z",baseline_pointer_latest_after:"2026-09-02T19:00:00.000Z",blocked_reason:"gap",twin_state_mutation:false,runtime_process_start:false,production_target_planner_bound:false};}},
    runtime_start_authority_ref:"authority://runtime-start",
    activation_fence_time:"2026-09-02T17:00:00.000Z",
    provider_attempt_fence_factory:{
      buildForDecision(decision){
        if(decision.status==="NOT_DUE" || decision.operation.kind==="GFS_PARTIAL_PAIR_REHYDRATE") return null;
        return {async claimBeforeProviderFetch(){return {status:"AUTHORIZED" as const,durable_coordination_write_count:1 as const};}};
      },
    },
  });
  const blocked=blockedExecutor.buildAttempt(action({kind:"KBS_RAW_HOURLY_PUBLICATION_CYCLE",requested_at:REQUESTED,observed_pair_state:"PAIRED",paired_contiguous_through:"2026-09-02T19:00:00.000Z",pair_skew_seconds:0,bindable_to_current_cycle_service:true}));assert(blocked);
  await assert.rejects(()=>blocked.execute({scope:SCOPE,lease_owner:"owner",lease_duration_seconds:300}),/PRODUCTION_SOURCE_PLAN_EXECUTOR_KBS_BLOCKED:BLOCKED_FORWARD_GAP:gap/);

  const source=fs.readFileSync(path.resolve("apps/server/src/external_evidence/mcft_cap09_production_evidence_source_plan_executor_v1.ts"),"utf8");
  for(const forbidden of ["Date.now","process.env","setInterval(","setTimeout(","RuntimeTickCursor"])assert.equal(source.includes(forbidden),false,"SOURCE_PLAN_EXECUTOR_FORBIDDEN_DEPENDENCY:"+forbidden);
  const proof={schema_version:"geox_mcft_cap09_production_evidence_source_plan_executor_v1",status:"PASS",kbs_publication_maps_to_dedicated_attempt:true,gfs_fresh_maps_to_canonical_attempt:true,gfs_partial_consumes_exact_planned_progress_snapshot:true,soil_uses_target_free_specialized_work_item_path:true,kbs_blocked_state_fail_closed:true,not_due_maps_to_no_attempt:true,cycle_service_call_count:cycleCalls,provider_attempt_fence_binding_implemented:true,gfs_partial_rehydration_consumes_provider_attempt_budget:false,production_host_binding_authorized:false,runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false};
  fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");console.log(JSON.stringify(proof,null,2));
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error),production_host_binding_authorized:false},null,2)+"\n");console.error(error);process.exitCode=1;});
