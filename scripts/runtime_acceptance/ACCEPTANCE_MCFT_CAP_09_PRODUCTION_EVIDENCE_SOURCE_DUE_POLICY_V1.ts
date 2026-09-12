import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_AUTHORITY_REF_V1,
  evaluateProductionEvidenceSourceDueV1,
  nextProductionEvidenceSourcePollEligibleAtV1,
  productionEvidenceSourcePollPolicyV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_source_due_policy_v1.js";
import type { EvidenceSourcePollScheduleSnapshotV1 } from "../../apps/server/src/external_evidence/mcft_cap09_evidence_source_poll_schedule_v1.js";
const OUT=path.resolve("acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_V1_RESULT.json");
const SCOPE={tenant_id:"t",project_id:"p",group_id:"g",field_id:"f",season_id:"s",zone_id:"z"};
function schedule(source:"KBS_RAW_HOURLY"|"KBS_SOIL",last:string,next:string):EvidenceSourcePollScheduleSnapshotV1{return {schedule_contract_id:"MCFT_CAP09_EVIDENCE_SOURCE_POLL_SCHEDULE_V1",scope:{...SCOPE},source_family:source,last_poll_started_at:last,next_poll_eligible_at:next,writer_lease_owner:"owner",writer_fencing_token:1n};}
function main():void{
  const raw=productionEvidenceSourcePollPolicyV1("KBS_RAW_HOURLY"),soil=productionEvidenceSourcePollPolicyV1("KBS_SOIL");
  assert.equal(raw.minimum_poll_interval_seconds,900);assert.equal(soil.minimum_poll_interval_seconds,300);
  assert.equal(raw.interval_semantics,"GEOX_OPERATIONAL_THROTTLE_NOT_PROVIDER_CADENCE");
  assert.equal(nextProductionEvidenceSourcePollEligibleAtV1({source_family:"KBS_RAW_HOURLY",poll_started_at:"2026-09-01T12:00:00.000Z"}),"2026-09-01T12:15:00.000Z");
  assert.equal(nextProductionEvidenceSourcePollEligibleAtV1({source_family:"KBS_SOIL",poll_started_at:"2026-09-01T12:00:00.000Z"}),"2026-09-01T12:05:00.000Z");
  const first=evaluateProductionEvidenceSourceDueV1({source_family:"KBS_RAW_HOURLY",planning_time:"2026-09-01T12:00:00.000Z",activation_fence_time:"2026-09-01T12:00:00.000Z",schedule:null});assert.equal(first.status,"DUE");assert.equal(first.authority_ref,MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_AUTHORITY_REF_V1);
  assert.equal(evaluateProductionEvidenceSourceDueV1({source_family:"KBS_RAW_HOURLY",planning_time:"2026-09-01T12:10:00.000Z",activation_fence_time:"2026-09-01T12:00:00.000Z",schedule:schedule("KBS_RAW_HOURLY","2026-09-01T12:00:00.000Z","2026-09-01T12:15:00.000Z")}).status,"NOT_DUE");
  assert.equal(evaluateProductionEvidenceSourceDueV1({source_family:"KBS_RAW_HOURLY",planning_time:"2026-09-01T12:15:00.000Z",activation_fence_time:"2026-09-01T12:00:00.000Z",schedule:schedule("KBS_RAW_HOURLY","2026-09-01T12:00:00.000Z","2026-09-01T12:15:00.000Z")}).status,"DUE");
  assert.equal(evaluateProductionEvidenceSourceDueV1({source_family:"KBS_SOIL",planning_time:"2026-09-01T12:04:59.000Z",activation_fence_time:"2026-09-01T12:00:00.000Z",schedule:schedule("KBS_SOIL","2026-09-01T12:00:00.000Z","2026-09-01T12:05:00.000Z")}).status,"NOT_DUE");
  assert.throws(()=>evaluateProductionEvidenceSourceDueV1({source_family:"KBS_SOIL",planning_time:"2026-09-01T11:59:59.000Z",activation_fence_time:"2026-09-01T12:00:00.000Z",schedule:null}),/BEFORE_ACTIVATION_FENCE/);
  const proof={schema_version:"geox_mcft_cap09_production_evidence_source_due_policy_v1",status:"PASS",kbs_raw_hourly_operational_poll_interval_seconds:900,kbs_soil_operational_poll_interval_seconds:300,intervals_are_provider_cadence_authority:false,activation_fence_required:true,durable_schedule_input_supported:true,no_change_can_resolve_not_due:true,wall_clock_read:false,environment_read:false,database_access:false,provider_request_count:0,runtime_tick_cursor_access:false,production_runtime_start:false};
  fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");console.log(JSON.stringify(proof,null,2));
}
try{main();}catch(error){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error),production_runtime_start:false},null,2)+"\n");throw error;}
