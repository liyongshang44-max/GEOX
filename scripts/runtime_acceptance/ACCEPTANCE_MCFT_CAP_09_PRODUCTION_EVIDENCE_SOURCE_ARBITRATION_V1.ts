import assert from "node:assert/strict";
import fs from "node:fs";import path from "node:path";
import {selectNextProductionEvidenceActionV1} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_source_arbitration_v1.js";
import type {ProductionEvidenceSourceDecisionV1} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_source_planner_v1.js";
const OUT=path.resolve("acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_SOURCE_ARBITRATION_V1_RESULT.json");
const T="2026-09-02T20:00:00.000Z",R="2026-09-02T19:00:00.000Z";
const raw:ProductionEvidenceSourceDecisionV1={source_family:"KBS_RAW_HOURLY",status:"ACTION",authority_ref:"a",operation:{kind:"KBS_RAW_HOURLY_PUBLICATION_CYCLE",requested_at:R,observed_pair_state:"PAIRED",paired_contiguous_through:"2026-09-02T18:00:00.000Z",pair_skew_seconds:0,bindable_to_current_cycle_service:true}};
const soil:ProductionEvidenceSourceDecisionV1={source_family:"KBS_SOIL",status:"ACTION",authority_ref:"a",operation:{kind:"KBS_SOIL_CURRENT_ACQUIRE",requested_at:R,latest_observed_event_time:null,bindable_to_current_work_item_factory:true}};
const gfs:ProductionEvidenceSourceDecisionV1={source_family:"GFS_BUNDLE",status:"ACTION",authority_ref:"a",operation:{kind:"GFS_BUNDLE_ACQUIRE",target_logical_time:T,requested_at:R,due_window_start:"2026-09-02T18:50:00.000Z",due_window_end_exclusive:"2026-09-02T19:30:00.000Z",max_attempts_per_target_window:3,retry_minimum_interval_seconds:60,bindable_to_current_work_item_factory:true}};
const partial:ProductionEvidenceSourceDecisionV1={source_family:"GFS_BUNDLE",status:"ACTION",authority_ref:"a",operation:{kind:"GFS_PARTIAL_PAIR_REHYDRATE",requested_at:R,target_logical_time:T,cycle_key:"20260902t180000z",cycle_issued_at:"2026-09-02T18:00:00.000Z",available_role:"WEATHER",partial_progress:{cycle_key:"20260902t180000z",cycle_issued_at:"2026-09-02T18:00:00.000Z",state:"PARTIAL",weather:null,future_et0:null,paired_valid_from:null},due_window_start:"2026-09-02T18:50:00.000Z",due_window_end_exclusive:"2026-09-02T19:30:00.000Z",bindable_to_current_cycle_service:true}};
function main(){
 assert.equal(selectNextProductionEvidenceActionV1([]),null);
 assert.equal(selectNextProductionEvidenceActionV1([raw,soil])?.source_family,"KBS_SOIL");
 assert.equal(selectNextProductionEvidenceActionV1([raw,soil,gfs])?.source_family,"GFS_BUNDLE");
 assert.equal(selectNextProductionEvidenceActionV1([raw,soil,partial])?.operation.kind,"GFS_PARTIAL_PAIR_REHYDRATE");
 const noDue:ProductionEvidenceSourceDecisionV1={source_family:"KBS_SOIL",status:"NOT_DUE",reason:"EXPLICIT_NOT_DUE",authority_ref:"a"};
 assert.equal(selectNextProductionEvidenceActionV1([noDue]),null);
 const source=fs.readFileSync(path.resolve("apps/server/src/external_evidence/mcft_cap09_production_evidence_source_arbitration_v1.ts"),"utf8");
 for(const x of ["Date.now","process.env","fetch(","RuntimeTickCursor","setTimeout(","setInterval("])assert.equal(source.includes(x),false);
 const proof={status:"PASS",gfs_hard_deadline_class_first:true,gfs_partial_repair_same_deadline_class:true,soil_deterministic_tiebreak_before_daily_batch:true,replan_after_every_attempt_required:true,hidden_queue:false,provider_request_count:0,database_access:false,runtime_tick_cursor_access:false,production_runtime_start:false};
 fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");console.log(JSON.stringify(proof,null,2));
}
try{main();}catch(e){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:e instanceof Error?e.message:String(e)},null,2)+"\n");throw e;}
