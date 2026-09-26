import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  EvidenceRuntimeHostV1,
  type EvidenceRuntimeHostHealthEventV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_host_v1.js";
import {
  MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ATTEMPT_CONTRACT_ID_V1,
  type EvidenceRuntimeHostAttemptPlanV1,
  type EvidenceRuntimeHostAttemptResultV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_host_attempt_v1.js";
import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type EvidenceProducerLeaseClaimV1,
  type EvidenceRuntimeScopeV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import { McftCap09ProductionEvidenceFailureClassifierV1 } from "../../apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_GATE_V1_RESULT.json");
const CONTRACT=path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FAILURE-DISCOVERY-GATE-V1.json");
const CORPUS=path.resolve("scripts/runtime_acceptance/fixtures/mcft_cap09_failure_corpus_v1.json");
const SCOPE:EvidenceRuntimeScopeV1={tenant_id:"fdg",project_id:"fdg",group_id:"fdg",field_id:"field_fdg",season_id:"season_2026",zone_id:"zone_root"};

function err(message:string, extra:Record<string,unknown>={}):Error{
  return Object.assign(new Error(message),extra);
}
function claim(owner:string):EvidenceProducerLeaseClaimV1{
  return {lease_contract_id:MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,scope:SCOPE,lease_owner:owner,fencing_token:1n,acquired_at:"2026-09-26T00:00:00.000Z",expires_at:"2026-09-26T00:10:00.000Z",heartbeat_at:"2026-09-26T00:00:01.000Z",database_now:"2026-09-26T00:00:01.000Z"};
}
function result(id:string,owner:string):EvidenceRuntimeHostAttemptResultV1{
  return {attempt_contract_id:MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ATTEMPT_CONTRACT_ID_V1,attempt_id:id,attempt_kind:"CANONICAL_WORK_ITEM_CYCLE",status:"COMPLETED",lease_claim:claim(owner),canonical_record_count:1,visible_ingress_count:1,evidence_supply_cursor_advance_count:1,twin_state_mutation:false,runtime_tick_cursor_mutation:false};
}
function plan(id:string,execute:EvidenceRuntimeHostAttemptPlanV1["execute"]):EvidenceRuntimeHostAttemptPlanV1{
  return {attempt_id:id,attempt_kind:"CANONICAL_WORK_ITEM_CYCLE",execute};
}
async function waitCancelled(input:{signal:AbortSignal}):Promise<"DUE"|"CANCELLED">{
  if(input.signal.aborted)return "CANCELLED";
  return await new Promise(resolve=>input.signal.addEventListener("abort",()=>resolve("CANCELLED"),{once:true}));
}

async function main():Promise<void>{
  const contract=JSON.parse(fs.readFileSync(CONTRACT,"utf8"));
  const corpus=JSON.parse(fs.readFileSync(CORPUS,"utf8"));
  assert.equal(contract.authority_effect,false);
  assert.equal(contract.production_effect,false);
  assert.equal(contract.formal_v5_arm,false);
  assert.equal(contract.final_24h_admission_requires.no_unclassified_error,true);
  assert.equal(corpus.exact_raw_materialization_required_before_final_24h,true);

  const classifier=new McftCap09ProductionEvidenceFailureClassifierV1();
  const cases=[
    ["HTTP_TIMEOUT",err("timeout",{code:"ETIMEDOUT"}),"RETRYABLE"],
    ["TCP_RESET",err("socket reset",{code:"ECONNRESET"}),"RETRYABLE"],
    ["TLS_OR_UNDICI_TERMINATED",Object.assign(new TypeError("terminated"),{cause:{code:"UND_ERR_SOCKET"}}),"RETRYABLE"],
    ["PROVIDER_503",err("KBS_RAW_HOURLY_HTTP_STATUS:503"),"RETRYABLE"],
    ["POSTGRES_RECOVERY",err("the database system is in recovery mode",{code:"57P03"}),"RETRYABLE"],
    ["POSTGRES_CONNECTION_TERMINATED",err("connection terminated",{code:"08006"}),"RETRYABLE"],
    ["KBS_CSV_FIELD_TOO_LARGE",err("MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE",{failure_token:"MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE"}),"ATTEMPT_REJECTED"],
    ["KBS_CSV_MALFORMED",err("MCFT_CAP09_KBS_RAW_HOURLY_CSV_PARSE_ERROR",{failure_token:"MCFT_CAP09_KBS_RAW_HOURLY_CSV_PARSE_ERROR"}),"ATTEMPT_REJECTED"],
    ["KBS_HEADER_MISSING",err("MCFT_CAP09_KBS_RAW_HOURLY_HEADER_NOT_FOUND",{failure_token:"MCFT_CAP09_KBS_RAW_HOURLY_HEADER_NOT_FOUND"}),"ATTEMPT_REJECTED"],
    ["KBS_EXACT_TARGET_MISSING",err("MCFT_CAP09_KBS_EXACT_TARGET_ROW_REQUIRED:0",{failure_token:"MCFT_CAP09_KBS_EXACT_TARGET_ROW_REQUIRED"}),"ATTEMPT_REJECTED"],
    ["KBS_SCIENTIFIC_INPUT_INVALID",err("MCFT_CAP09_KBS_TARGET_ET0_INPUT_RANGE",{failure_token:"MCFT_CAP09_KBS_TARGET_ET0_INPUT_RANGE"}),"ATTEMPT_REJECTED"],
    ["KBS_HISTORICAL_DRIFT",err("PRODUCTION_SOURCE_PLAN_EXECUTOR_KBS_BLOCKED:BLOCKED_HISTORICAL_DRIFT:fixture"),"ATTEMPT_REJECTED"],
    ["GFS_MEMBER_RETRY_EXHAUSTED",err("MCFT_CAP09_GFS_MEMBER_RETRY_EXHAUSTED",{code:"MCFT_CAP09_GFS_MEMBER_RETRY_EXHAUSTED"}),"RETRYABLE"],
    ["STALE_FENCE",err("PHASE3_EVIDENCE_LEASE_RENEW_STALE_FENCE"),"PROCESS_FATAL"],
    ["AUTHORITY_VIOLATION",err("MCFT_CAP09_AUTHORITY_BINDING_MISMATCH"),"PROCESS_FATAL"],
    ["SCHEDULER_STATE_CORRUPTION",err("MCFT_CAP09_SCHEDULER_STATE_CORRUPTION"),"PROCESS_FATAL"],
  ] as const;
  for(const [id,error,expected] of cases){
    assert.equal(classifier.classify(error),expected,`FDG_CLASSIFICATION_MISMATCH:${id}`);
  }

  const health:EvidenceRuntimeHostHealthEventV1[]=[];
  let planOrdinal=0, stopped=false;
  const waits:string[]=[];
  let activeClaim:EvidenceProducerLeaseClaimV1|null=null;
  const host=new EvidenceRuntimeHostV1({
    lease:{
      async acquireLease(input){activeClaim=claim(input.lease_owner);return activeClaim;},
      async renewLease(){assert(activeClaim);return activeClaim;},
      async releaseLease(){activeClaim=null;},
    },
    planner:{async nextAttemptPlan(){
      if(planOrdinal===0){
        planOrdinal+=1;
        return plan("rejected",async()=>{throw err("MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE",{failure_token:"MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE"});});
      }
      if(planOrdinal===1){
        planOrdinal+=1;
        return plan("success",async()=>result("success","fdg-owner"));
      }
      return null;
    }},
    wait:{
      waitForLeaseRenewal:waitCancelled,
      async waitAfterAttempt(input){
        waits.push(input.reason);
        if(input.reason==="SUCCESS_CADENCE")stopped=true;
      },
    },
    health:{async recordHealth(event){health.push(structuredClone(event));}},
    stop:{stopRequested:()=>stopped},
    failure_classifier:classifier,
  });
  const run=await host.run({scope:SCOPE,lease_owner:"fdg-owner",lease_duration_seconds:300});
  assert.equal(run.successful_cycle_count,1);
  assert.deepEqual(waits,["ATTEMPT_REJECTED_BACKOFF","SUCCESS_CADENCE"]);
  const rejected=health.find(e=>e.detail==="ATTEMPT_REJECTED");
  assert(rejected,"FDG_ATTEMPT_REJECTED_HEALTH_REQUIRED");
  assert.equal(rejected.failure_class,"ATTEMPT_REJECTED");
  assert.equal(rejected.failure_token,"MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE");
  assert.equal(health.some(e=>e.failure_token==="UNCLASSIFIED_ERROR"),false);
  assert.equal(health.some(e=>e.detail==="PROCESS_FATAL_ATTEMPT_FAILURE"),false);

  const proof={
    schema_version:"geox_mcft_cap09_failure_discovery_gate_result_v1",
    status:"PASS",
    taxonomy:["RETRYABLE","ATTEMPT_REJECTED","PROCESS_FATAL"],
    matrix_case_count:cases.length,
    retryable_cases:cases.filter(x=>x[2]==="RETRYABLE").map(x=>x[0]),
    rejected_cases:cases.filter(x=>x[2]==="ATTEMPT_REJECTED").map(x=>x[0]),
    process_fatal_cases:cases.filter(x=>x[2]==="PROCESS_FATAL").map(x=>x[0]),
    rejected_attempt_does_not_kill_host:true,
    rejected_attempt_does_not_promote_evidence:true,
    subsequent_attempt_completes:true,
    no_unclassified_error:true,
    exact_raw_p0h_materialization_pending:true,
    authority_effect:false,
    production_effect:false,
    formal_v5_arm:false,
    final_24h_admitted:false,
  };
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");
  console.log(JSON.stringify(proof,null,2));
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error)},null,2)+"\n");console.error(error);process.exitCode=1;});
