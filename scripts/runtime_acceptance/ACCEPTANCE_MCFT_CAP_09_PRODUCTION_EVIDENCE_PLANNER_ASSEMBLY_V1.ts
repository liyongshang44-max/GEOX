import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Pool } from "pg";

import {
  assembleProductionEvidencePlannerV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_planner_assembly_v1.js";
import {
  MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_acquisition_horizon_v1.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_PLANNER_ASSEMBLY_V1_RESULT.json");
const SCOPE={tenant_id:"tenant",project_id:"project",group_id:"group",field_id:"field",season_id:"season",zone_id:"zone"};
const AUTH={
  authority_class:MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
  authority_ref:"authority://runtime-start/focused",
  activation_fence_time:"2026-09-02T18:00:00.000Z",
  formal_a0_authority_ref:"authority://formal-a0/focused",
  formal_a0_logical_time:"2026-09-02T20:00:00.000Z",
} as const;

function main():void{
  let poolCalls=0,executionCalls=0,clockCalls=0;
  const fakePool={
    query(){poolCalls+=1;throw new Error("ASSEMBLY_CONSTRUCTION_DB_QUERY_FORBIDDEN");},
    connect(){poolCalls+=1;throw new Error("ASSEMBLY_CONSTRUCTION_DB_CONNECT_FORBIDDEN");},
  } as unknown as Pool;
  const execution={
    cycle_service:{async executeCycle(){executionCalls+=1;throw new Error("ASSEMBLY_CONSTRUCTION_CYCLE_EXECUTION_FORBIDDEN");}},
    work_item_factory:{
      buildKbsSoilCurrent(){executionCalls+=1;throw new Error("ASSEMBLY_CONSTRUCTION_SOIL_BUILD_FORBIDDEN");},
      buildGfsBundle(){executionCalls+=1;throw new Error("ASSEMBLY_CONSTRUCTION_GFS_BUILD_FORBIDDEN");},
    },
    gfs_partial_factory:{async buildWorkItem(){executionCalls+=1;throw new Error("ASSEMBLY_CONSTRUCTION_REHYDRATION_FORBIDDEN");}},
    kbs_publication_cycle:{async executeCycle(){executionCalls+=1;throw new Error("ASSEMBLY_CONSTRUCTION_KBS_CYCLE_FORBIDDEN");}},
  } as never;

  const assembled=assembleProductionEvidencePlannerV1({
    pool:fakePool,
    scope:SCOPE,
    runtime_start_authority:AUTH,
    planning_clock:{now(){clockCalls+=1;throw new Error("ASSEMBLY_CONSTRUCTION_CLOCK_READ_FORBIDDEN");}},
    execution,
  });
  assert.equal(assembled.assembly_id,"MCFT_CAP09_PRODUCTION_EVIDENCE_PLANNER_ASSEMBLY_V1");
  assert.equal(assembled.host_planner.planner_id,"MCFT_CAP09_PRODUCTION_EVIDENCE_HOST_PLANNER_V1");
  assert.equal(assembled.source_plan_executor.executor_id,"MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_PLAN_EXECUTOR_V1");
  assert.equal(assembled.provider_attempt_fence_factory.factory_id,"MCFT_CAP09_PRODUCTION_PROVIDER_ATTEMPT_FENCE_FACTORY_V1");
  assert.equal(assembled.construction_database_query_count,0);
  assert.equal(assembled.construction_provider_request_count,0);
  assert.equal(assembled.construction_raw_store_request_count,0);
  assert.equal(assembled.runtime_process_started,false);
  assert.equal(poolCalls,0);assert.equal(executionCalls,0);assert.equal(clockCalls,0);

  assert.throws(()=>assembleProductionEvidencePlannerV1({
    pool:fakePool,scope:SCOPE,
    runtime_start_authority:{...AUTH,formal_a0_logical_time:AUTH.activation_fence_time},
    planning_clock:{now(){clockCalls+=1;return AUTH.activation_fence_time;}},
    execution,
  }),/PRODUCTION_EVIDENCE_HOST_PLANNER_ACTIVATION_FENCE_MUST_PRECEDE_A0/);
  assert.equal(poolCalls,0);assert.equal(executionCalls,0);assert.equal(clockCalls,0);

  const source=fs.readFileSync(path.resolve("apps/server/src/external_evidence/mcft_cap09_production_evidence_planner_assembly_v1.ts"),"utf8");
  for(const forbidden of ["process.env","Date.now","fetch(","setInterval(","setTimeout(","RuntimeTickCursor","runMcftCap09EvidenceRuntimeProcessV1"]) {
    assert.equal(source.includes(forbidden),false,"ASSEMBLY_FORBIDDEN_DEPENDENCY:"+forbidden);
  }
  const dist=fs.readFileSync(path.resolve("apps/server/scripts/write_dist_entries.cjs"),"utf8");
  assert.equal(dist.includes("MCFT_CAP09_EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND"),true);

  const proof={
    schema_version:"geox_mcft_cap09_production_evidence_planner_assembly_v1",
    status:"PASS",
    concrete_postgres_cursor_reader:true,
    concrete_source_progress_reader:true,
    concrete_source_poll_schedule:true,
    concrete_gfs_retry_schedule:true,
    concrete_canonical_gfs_target_history:true,
    provider_attempt_fence_factory_bound:true,
    source_plan_executor_bound:true,
    production_host_planner_bound_to_assembly:true,
    construction_database_query_count:poolCalls,
    construction_execution_call_count:executionCalls,
    construction_clock_read_count:clockCalls,
    production_entrypoint_bound:false,
    runtime_process_start:false,
    production_owner_activation:false,
    formal_v5_arm:false,
    a0_bootstrap:false,
    o00_started:false,
  };
  fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");console.log(JSON.stringify(proof,null,2));
}
try{main();}catch(error){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error),runtime_process_start:false},null,2)+"\n");throw error;}
