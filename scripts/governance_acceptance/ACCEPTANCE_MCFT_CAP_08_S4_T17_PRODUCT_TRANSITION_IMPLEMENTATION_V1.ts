#!/usr/bin/env -S pnpm exec tsx
import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAP04_A2_OPERATION_VARIANT_V1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1,
  CAP08_S4_T17_TRANSITION_KIND_V1,
} from "../../apps/server/src/domain/twin_runtime/cap08_t17_transition_contracts_v1.js";
import { Cap08S4T17RoutingPersistenceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s4_t17_routing_persistence_v1.js";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const BOUNDARY="docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S4-T17-PRODUCT-TRANSITION-IMPLEMENTATION-BOUNDARY-V1.json";
const OUTPUT=path.join(ROOT,"acceptance-output/MCFT_CAP_08_S4_T17_PRODUCT_TRANSITION_IMPLEMENTATION_STATIC_RESULT.json");
const text=(p:string)=>fs.readFileSync(path.join(ROOT,p),"utf8");
const git=(...args:string[])=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();

async function main():Promise<void>{
  const boundary=JSON.parse(text(BOUNDARY));
  const base=String(process.env.MCFT_BASE_SHA||boundary.base_main_sha).trim();
  assert.equal(base,boundary.base_main_sha);
  assert.equal(git("merge-base",base,"HEAD"),base);
  assert.equal(git("diff","--check",`${base}...HEAD`),"");
  const changed=git("diff","--name-only",`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed,[...boundary.changed_files].sort());
  assert.equal(changed.length,boundary.changed_file_count);
  assert.equal(changed.includes("apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts"),false);
  assert.equal(changed.includes("apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts"),false);
  assert.equal(changed.some((p)=>/EXECUTION-AUTHORITY-V\d+\.json$/.test(p)),false);
  assert.equal(boundary.formal_authority_chain_status,"PAUSED");
  assert.equal(boundary.database_execution_authority_issued,false);
  assert.equal(boundary.formal_run_execution_authorized,false);
  assert.equal(boundary.qualification_v3_created,false);

  const repository=text("apps/server/src/persistence/twin_runtime/postgres_cap08_s4_t17_transition_repository_v1.ts");
  const routing=text("apps/server/src/runtime/twin_runtime/cap08_s4_t17_routing_persistence_v1.ts");
  const migration=text("apps/server/db/migrations/2026_08_01_mcft_cap08_s4_t17_transition.sql");
  for(const token of [
    "BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE",
    "pg_advisory_xact_lock",
    "after_replay_classification",
    "POST_TRANSITION_PROJECTION_DIVERGENCE",
    "BASE_LATEST_CAS_CONFLICT",
    "after_transition_witness_fact",
    "after_transition_guard",
    "after_state_latest",
    "after_checkpoint_latest",
    "after_forecast_result_latest",
    "after_successful_forecast_latest",
    "before_exact_readback",
  ]) assert.equal(repository.includes(token),true,`REPOSITORY_TOKEN:${token}`);
  for(const token of [
    "FORMAL_DATASET_INVARIANT_VIOLATION",
    "operation_variant !== CAP04_A1_OPERATION_VARIANT_V1",
    "await this.actualLeaseV1",
    "commitAuthorityBoundA1Transition",
  ]) assert.equal(routing.includes(token),true,`ROUTING_TOKEN:${token}`);
  assert.equal(routing.indexOf("operation_variant !== CAP04_A1_OPERATION_VARIANT_V1")<routing.indexOf("await this.actualLeaseV1"),true,"A2_MUST_FAIL_BEFORE_REAL_LEASE");
  assert.equal(migration.includes("UNIQUE\n    (tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,t17_logical_time)"),true);

  assert.deepEqual(CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1.retry_delays_ms,[25,100]);
  assert.equal(CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1.max_attempts,3);
  assert.equal(CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1.retryable_sqlstate,"40001");
  assert.equal(CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1.retry_scope,"FULL_TRANSACTION_FROM_BEGIN");
  assert.equal(CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1.exhaustion_error,"SERIALIZABLE_RETRY_EXHAUSTED");

  let realLeaseCalls=0;
  let transitionCalls=0;
  const canonical:any={
    acquireLease:async(input:any)=>{realLeaseCalls+=1;return{...input,fencing_token:1n};},
    lookupARecordSet:async()=>null,
    commitARecordSet:async()=>{throw new Error("GENERIC_COMMIT_FORBIDDEN");},
    readARecordSet:async()=>null,
    lookupScenarioSet:async()=>null,
    commitScenarioSet:async()=>{throw new Error("SCENARIO_NOT_USED");},
    readScenarioSet:async()=>null,
    readScenarioSetBySourceForecast:async()=>null,
    detectPendingScenario:async()=>null,
    rebuildForecastProjections:async()=>({rebuilt_forecast_run_count:1,rebuilt_forecast_point_count:72}),
    rebuildScenarioProjections:async()=>({rebuilt_scenario_set_count:1,rebuilt_scenario_point_count:216,rebuilt_latest_count:1}),
  };
  const transition:any={
    captureExpectedLatestBase:async()=>({}),
    commitAuthorityBoundA1Transition:async()=>{transitionCalls+=1;throw new Error("TRANSITION_NOT_EXPECTED");},
  };
  const routingPort=new Cap08S4T17RoutingPersistenceV1(canonical,transition);
  const scope={tenant_id:"t",project_id:"p",group_id:"g",field_id:"f",season_id:"s",zone_id:"z"};
  routingPort.armTransition({
    formal_run_id:"run",
    scope,
    lineage_id:"lineage",
    revision_id:"revision",
    t17_logical_time:"2026-06-01T17:00:00.000Z",
    expected_latest_base:{state:{ref:"a",hash:"sha256:"+"1".repeat(64)},checkpoint:{ref:"b",hash:"sha256:"+"2".repeat(64)},forecast_result:{ref:"c",hash:"sha256:"+"3".repeat(64)},successful_forecast:{ref:"d",hash:"sha256:"+"4".repeat(64)}},
    corrected_computation_predecessor:{state:{ref:"e",hash:"sha256:"+"5".repeat(64)},checkpoint:{ref:"f",hash:"sha256:"+"6".repeat(64)},forecast_result:{ref:"g",hash:"sha256:"+"7".repeat(64)},successful_forecast:{ref:"g",hash:"sha256:"+"7".repeat(64)},scenario_set:{ref:"h",hash:"sha256:"+"8".repeat(64)},previous_tick_sequence:17},
    correction_authority:{authority_ref:"authority",authority_hash:"sha256:"+"9".repeat(64)},
  });
  const deferred=await routingPort.acquireLease({...scope,lease_owner:"owner",lease_duration_seconds:300});
  await assert.rejects(
    routingPort.commitARecordSet({scope,lease:deferred,expected:{} as never,record_set:{operation_key:{logical_time:"2026-06-01T17:00:00.000Z",operation_variant:CAP04_A2_OPERATION_VARIANT_V1}} as never}),
    /FORMAL_DATASET_INVARIANT_VIOLATION/,
  );
  assert.equal(realLeaseCalls,0,"A2_REAL_LEASE_DELTA");
  assert.equal(transitionCalls,0,"A2_TRANSITION_DELTA");

  const result={
    schema_version:"geox_mcft_cap08_s4_t17_product_transition_implementation_static_result_v1",
    status:"PASS",
    changed_file_count:changed.length,
    generic_cap04_source_delta:0,
    a2_real_lease_delta:0,
    a2_transition_delta:0,
    serializable_max_attempts:3,
    transition_kind:CAP08_S4_T17_TRANSITION_KIND_V1,
    database_execution_performed:false,
    formal_authority_chain_status:"PAUSED",
  };
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  fs.writeFileSync(OUTPUT,`${JSON.stringify(result,null,2)}\n`);
  console.log(JSON.stringify(result,null,2));
}
main().catch((error)=>{console.error(error);process.exitCode=1;});
