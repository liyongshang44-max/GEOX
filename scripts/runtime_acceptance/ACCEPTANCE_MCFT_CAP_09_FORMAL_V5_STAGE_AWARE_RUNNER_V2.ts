import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  ExternalFormalV5Amendment19RunnerV2,
  EXTERNAL_FORMAL_V5_AM19_RUNNER_ID_V2,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_v5_amendment19_runner_v2.js";
import type {
  ExternalFormalV4Am19WindowManifestV2,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_v4_amendment19_runner_v2.js";
import type {
  ExternalFormalTerminalSuccessorViabilityPortV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_next_tick_viability_v1.js";
import type {
  ShadowOnlineBoundaryV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_FORMAL_V5_STAGE_AWARE_RUNNER_V2_RESULT.json");
const O00="2099-09-01T04:00:00.000Z";
const OBSERVED="2099-09-01T04:05:00.000Z";
const MANIFEST_REF="h6-v5-stage-aware-runner-manifest";
const MANIFEST_HASH="sha256:"+"1".repeat(64);
const EPOCH="h6-v5-stage-aware-runner-epoch";
const CURRENT_DIGEST="sha256:"+"2".repeat(64);

function addHours(value:string,count:number):string{
  return new Date(Date.parse(value)+count*3_600_000).toISOString();
}
function slotId(index:number):`O${string}`{
  return `O${String(index).padStart(2,"0")}`;
}
function materialization(logicalTime:string,contextRef:string,contextHash:string){
  const context={
    schema_version:"geox_mcft_cap09_t4r1_a18_formal_crop_context_v4",
    crop_stage_code:"LATE",
    logical_time:logicalTime,
    source:"H6_V5_STAGE_AWARE_RUNNER_ACCEPTANCE",
  };
  const profile="T4R1_A18_BIOLOGICAL_STAGE_AUTHORITY_CONTEXT_MATERIALIZATION_V4";
  const materializationHash=semanticHashV1({
    materialization_profile:profile,
    context_ref:contextRef,
    context_identity_hash:contextHash,
    current_crop_authority_evidence_digest:CURRENT_DIGEST,
    materialized_context:context,
  });
  return {
    identity_profile:"T4R1_A18_BIOLOGICAL_STAGE_AUTHORITY_CONTEXT_IDENTITY_V4",
    materialization_profile:profile,
    logical_time:logicalTime,
    stage_code:"LATE",
    kc:0.6,
    context_ref:contextRef,
    context_identity_hash:contextHash,
    context_materialization_hash:materializationHash,
    current_crop_authority_evidence_digest:CURRENT_DIGEST,
    water_use_stage_forward_stable_under_thermal_progression:true,
    lifecycle_requires_separate_validation:true,
    production_effective:true,
    context,
  };
}

function fixture(){
  const materializedBySlot=new Map<string,ReturnType<typeof materialization>>();
  const slots=Array.from({length:24},(_,index)=>{
    const logicalTime=addHours(O00,index);
    const contextRef=`crop-context-${index}`;
    const contextHash="sha256:"+String(index+3).padStart(64,"0");
    const m=materialization(logicalTime,contextRef,contextHash);
    materializedBySlot.set(logicalTime,m);
    return {
      manifest_ref:MANIFEST_REF,
      manifest_hash:MANIFEST_HASH,
      epoch_id:EPOCH,
      slot_id:slotId(index) as any,
      logical_time:logicalTime,
      runtime_config_ref:`runtime-config-${index}`,
      runtime_config_hash:"sha256:"+String(index+40).padStart(64,"0"),
      parent_runtime_config_ref:index===0?"a0-runtime-config":`runtime-config-${index-1}`,
      parent_runtime_config_hash:index===0?"sha256:"+"a".repeat(64):"sha256:"+String(index+39).padStart(64,"0"),
      crop_stage_context_ref:contextRef,
      crop_stage_context_hash:contextHash,
      crop_stage_context_materialization_hash:m.context_materialization_hash,
    };
  });
  const manifest:ExternalFormalV4Am19WindowManifestV2={
    manifest_ref:MANIFEST_REF,
    manifest_hash:MANIFEST_HASH,
    epoch_id:EPOCH,
    database_name:"geox_mcft_cap09_s6_formal_t4r1_24h_v5",
    scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
    o00_logical_time:O00,
    o23_logical_time:addHours(O00,23),
    slots,
  };
  const dueBoundary:ShadowOnlineBoundaryV1={
    scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
    slot_id:"O00",
    logical_time:O00,
    scheduler_wall_clock_observed_at:OBSERVED,
    interval_seconds:3600,
  };
  return {manifest,slots,materializedBySlot,dueBoundary};
}

async function main(){
  {
    const {manifest,slots,materializedBySlot,dueBoundary}=fixture();
    let underlyingClaimCount=0;
    let tickCount=0;
    const scheduler:any={
      async listMissedSlots(){return [dueBoundary];},
      async claimDueSlot(){underlyingClaimCount+=1;throw new Error("UNDERLYING_CLAIM_MUST_NOT_RUN");},
      async recordTerminalResult(){throw new Error("TERMINAL_WRITE_MUST_NOT_RUN");},
    };
    const runtimeConfigRepository:any={
      async readRuntimeConfig(ref:string){
        const slot=slots.find((row)=>row.runtime_config_ref===ref);
        if(!slot)return null;
        return {
          object_id:slot.runtime_config_ref,
          determinism_hash:slot.runtime_config_hash,
          payload:{
            effective_logical_time:slot.logical_time,
            parent_runtime_config_ref:slot.parent_runtime_config_ref,
            parent_runtime_config_hash:slot.parent_runtime_config_hash,
            crop_stage_context_authority:{context_ref:slot.crop_stage_context_ref,context_hash:slot.crop_stage_context_hash},
            config_selection_mode:"EXPLICIT_REF_HASH_PIN_ONLY",
          },
        };
      },
    };
    const cropContextMaterializer:any={
      async materialize(input:{logical_time:string;expected_identity_hash:string}){
        const m=materializedBySlot.get(input.logical_time);
        if(!m)throw new Error("CONTROLLED_MATERIALIZATION_REQUIRED");
        assert.equal(input.expected_identity_hash,m.context_identity_hash);
        return m;
      },
    };
    const evidenceSource:any={async loadCandidateRecords(){return {};}};
    const tickService:any={async executeClaimedTick(){tickCount+=1;throw new Error("TICK_MUST_NOT_RUN");}};
    const viability:ExternalFormalTerminalSuccessorViabilityPortV1={
      async checkPreclaimViability(boundary){
        return {
          viability_id:"NEXT_TICK_FORCING_VIABILITY_V1",
          status:"NOT_VIABLE",
          slot_id:boundary.slot_id,
          logical_time:boundary.logical_time,
          required_forcing_base:null,
          reason:"FORCING_CURSOR_BEHIND_REQUIRED_BASE",
          detail:"controlled-h6-preclaim-negative",
        };
      },
      async adjudicateSuccessorAfterTerminal(){throw new Error("ADJUDICATION_MUST_NOT_RUN");},
    };
    const runner=new ExternalFormalV5Amendment19RunnerV2(
      manifest,scheduler,runtimeConfigRepository,cropContextMaterializer,evidenceSource,tickService,viability,
    );
    const result=await runner.executeOneDueSlot({
      through_logical_time:O00,
      observer_started_at:OBSERVED,
      lease_owner:"h6-v5-runner",
      lease_duration_seconds:300,
    });
    assert.equal(result.runner_id,EXTERNAL_FORMAL_V5_AM19_RUNNER_ID_V2);
    assert.equal(result.status,"NOT_READY_PRECLAIM");
    if(result.status!=="NOT_READY_PRECLAIM")throw new Error("H6_V5_PRECLAIM_BLOCK_REQUIRED");
    assert.equal(result.reason,"NEXT_TICK_FORCING_NOT_VIABLE");
    assert.equal(result.claim_attempted,false);
    assert.equal(result.provider_request_count,0);
    assert.equal(result.r2_request_count,0);
    assert.equal(underlyingClaimCount,0);
    assert.equal(tickCount,0);
  }

  {
    const {manifest,slots,materializedBySlot,dueBoundary}=fixture();
    let claimCount=0,tickCount=0,terminalWriteCount=0,adjudicationCount=0;
    const scheduler:any={
      async listMissedSlots(){return [dueBoundary];},
      async claimDueSlot(input:any){
        claimCount+=1;
        return {boundary:input.boundary,lease_owner:input.lease_owner,lease_token:"h6-token",lease_expires_at:"2099-09-01T04:10:00.000Z"};
      },
      async recordTerminalResult(){terminalWriteCount+=1;},
    };
    const runtimeConfigRepository:any={
      async readRuntimeConfig(ref:string){
        const slot=slots.find((row)=>row.runtime_config_ref===ref);
        if(!slot)return null;
        return {
          object_id:slot.runtime_config_ref,
          determinism_hash:slot.runtime_config_hash,
          payload:{
            effective_logical_time:slot.logical_time,
            parent_runtime_config_ref:slot.parent_runtime_config_ref,
            parent_runtime_config_hash:slot.parent_runtime_config_hash,
            crop_stage_context_authority:{context_ref:slot.crop_stage_context_ref,context_hash:slot.crop_stage_context_hash},
            config_selection_mode:"EXPLICIT_REF_HASH_PIN_ONLY",
          },
        };
      },
    };
    const cropContextMaterializer:any={
      async materialize(input:{logical_time:string;expected_identity_hash:string}){
        const m=materializedBySlot.get(input.logical_time);
        if(!m)throw new Error("CONTROLLED_MATERIALIZATION_REQUIRED");
        assert.equal(input.expected_identity_hash,m.context_identity_hash);
        return m;
      },
    };
    const evidenceSource:any={async loadCandidateRecords(){return {};}};
    const tickService:any={
      async executeClaimedTick(){
        tickCount+=1;
        return {runtime_health:"HEALTHY",a_record_set:{record_set_id:"h6-a-record-set"}};
      },
    };
    const viability:ExternalFormalTerminalSuccessorViabilityPortV1={
      async checkPreclaimViability(boundary){
        return {
          viability_id:"NEXT_TICK_FORCING_VIABILITY_V1",
          status:"PASS",
          slot_id:boundary.slot_id,
          logical_time:boundary.logical_time,
          mode:"A0_WARM_START",
          required_forcing_base:null,
          runtime_cursor_verified:true,
          forcing_cursor_verified:false,
          physical_ingress_attestation_verified:false,
        };
      },
      async adjudicateSuccessorAfterTerminal(){
        adjudicationCount+=1;
        throw new Error("CONTROLLED_H6_POST_COMMIT_ADJUDICATION_FAILURE");
      },
    };
    const runner=new ExternalFormalV5Amendment19RunnerV2(
      manifest,scheduler,runtimeConfigRepository,cropContextMaterializer,evidenceSource,tickService,viability,
    );
    await assert.rejects(
      ()=>runner.executeOneDueSlot({
        through_logical_time:O00,
        observer_started_at:OBSERVED,
        lease_owner:"h6-v5-runner",
        lease_duration_seconds:300,
      }),
      /CONTROLLED_H6_POST_COMMIT_ADJUDICATION_FAILURE/,
    );
    assert.equal(claimCount,1);
    assert.equal(tickCount,1);
    assert.equal(terminalWriteCount,1);
    assert.equal(adjudicationCount,1);
  }

  const proof={
    schema_version:"geox_mcft_cap09_formal_v5_stage_aware_runner_v2_acceptance_v1",
    status:"PASS",
    v5_viability_gate_wrapped_around_v4_stage_aware_runner:true,
    preclaim_nonviability_prevents_underlying_claim:true,
    provider_request_count:0,
    r2_request_count:0,
    post_commit_successor_adjudication_required:true,
    post_commit_adjudication_failure_does_not_reterminalize_predecessor:true,
    scheduler_semantics_rewritten:false,
    persistent_tick_semantics_rewritten:false,
    stage_materialization_semantics_rewritten:false,
    runtime_kernel_rewritten:false,
    production_effect:false,
    formal_database_mutation:false,
    a0_bootstrap:false,
    o00_started:false,
  };
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");
  console.log(JSON.stringify(proof,null,2));
}
main().catch((error)=>{
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error)},null,2)+"\n");
  console.error(error);
  process.exitCode=1;
});
