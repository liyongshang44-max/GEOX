#!/usr/bin/env -S pnpm exec tsx
// Purpose: prove the dedicated S4 corrected-T16 -> T17 product transition on a fresh PostgreSQL 16 database.
// Boundary: development implementation acceptance only; no formal execution authority, RUN_A/RUN_B, S6 Candidate or ledger settlement.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { DirectCap04ExecutionConfigResolverV1 } from "../../apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.js";
import type { Cap04ARecordSetV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import { PostgresCap08S4T17TransitionRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_t17_transition_repository_v1.js";
import { Cap08DeferredScenarioPersistenceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_deferred_scenario_persistence_v1.js";
import { Cap08S4T17CorrectedHandoffServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_t17_corrected_handoff_service_v1.js";
import { Cap08S4T17TransitionPersistenceAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_t17_transition_persistence_adapter_v1.js";
import { Cap08S4T17ExplicitRoutingTickServiceV1, Cap08S4T17TransitionTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_t17_transition_tick_service_v1.js";
import { Cap04ForecastScenarioSingleTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import type { Cap04SingleTickPersistencePortV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { runner } from "./mcft_cap08_s2_g3_acceptance_support_v1.js";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const OUTPUT=path.join(ROOT,"acceptance-output/MCFT_CAP_08_S4_T17_PRODUCT_IMPLEMENTATION_DB_RESULT.json");
const MODE=String(process.env.MCFT_CAP08_T17_ACCEPTANCE_MODE||"normal");
const ADMIN_URL=String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL||"");
if(!ADMIN_URL)throw new Error("CAP08_S4_T17_ADMIN_DATABASE_URL_REQUIRED");
const require=createRequire(import.meta.url);
const {loadProduct}=require("./mcft_cap08_s6_single_run_ports/product_loader_v1.cjs");
const {bindResolverRepositorySeamV2}=require("./mcft_cap08_s6_run_a_qualification_ports_v2/qualification_product_chain_v2.cjs");
const {createS6PrefixTransportReaderV1}=require("./mcft_cap08_s6_single_run_ports/product_chain_v1.cjs");
const {persistenceAdapter}=require("./mcft_cap08_s6_single_run_ports/persistence_authority_v1.cjs");
const {createFinalFormalEvidenceSourceV1,DATASET_ID,PROFILE_ID,OUTCOME_PROFILE_ID,CONTRACT_DIGEST,HIDDEN_PARAMETER}=require("./mcft_cap08_s6_single_run_ports/final_evidence_source_v1.cjs");

function memberV1(recordSet:Cap04ARecordSetV1,objectType:string):CanonicalObjectEnvelopeV1{const matches=recordSet.members.filter((member)=>member.object_type===objectType);if(matches.length!==1)throw new Error(`CAP08_S4_T17_ACCEPTANCE_MEMBER_CARDINALITY:${objectType}`);return matches[0];}
function ordinaryPersistenceV1(runtime:any,forecast:any):Cap04SingleTickPersistencePortV1{return persistenceAdapter(runtime,forecast) as Cap04SingleTickPersistencePortV1;}

async function establishT16AndS4V1(){
  const p=bindResolverRepositorySeamV2(await loadProduct(ROOT));
  const fixture=await p.buildCap08S2FormalProviderFixtureV1(ROOT);
  const sourceManifest=p.computeCap08S3SourceManifestV1(ROOT);
  const sourceDigest=p.semanticHashV1({base_manifest_digest:sourceManifest.manifest_digest,final_formal_closure_input_contract_digest:CONTRACT_DIGEST,dataset_id:DATASET_ID,profile_id:PROFILE_ID,outcome_profile_id:OUTCOME_PROFILE_ID,hidden_parameter_value:HIDDEN_PARAMETER,materializer_profile:"MCFT_CAP08_S6_DIRECT_PRODUCT_SERVICE_ASSEMBLY_V1"});
  const runtimeRepository=new p.PostgresRuntimeRepositoryV1(runner);
  const forecastRepository=new p.PostgresForecastScenarioRecoveryRepositoryV1(runner);
  const nextTickRepository=new p.PostgresNextTickRepositoryV1(runner);
  assert.equal((await nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot)).status,"INSERTED");
  for(const config of fixture.runtime_configs)assert.equal((await runtimeRepository.commitRuntimeConfig(config)).status,"INSERTED");
  const evidence=createFinalFormalEvidenceSourceV1({pool:runner,baseSource:fixture.bootstrap_evidence_source,runtimeRepository,formalRunId:fixture.formal_run_id,scope:fixture.scope,product:p});
  const frozen=new p.Cap08FrozenEvidenceSourceV1(new p.Cap08S2QualifiedEvidenceSourceV1(evidence));
  const deferred=new p.Cap08DeferredScenarioPersistenceV1(ordinaryPersistenceV1(runtimeRepository,forecastRepository));
  const handoff=new p.PrepareNextTickInputServiceV1(nextTickRepository);
  const normal=new p.Cap04ForecastScenarioSingleTickServiceV1(handoff,frozen,runtimeRepository,deferred,new p.DirectCap04ExecutionConfigResolverV1());
  const receipt=new p.Cap08S3ReceiptConsumingForecastScenarioTickServiceV1(handoff,frozen,new p.PostgresActionFeedbackTickSourceV1(runner),runtimeRepository,deferred,new p.DirectCap04ExecutionConfigResolverV1());
  const tick=new p.Cap08S3FormalTickServiceV1(handoff,frozen,deferred,normal,receipt,new p.Cap08S3DecisionActionProviderServiceV1(runner),new p.Cap08S3ReceiptEpisodeGuardV1(runner),new p.Cap08S3AuthorityGuardV1(runner));
  const completion=new p.Cap08S3CompletionEvidenceTickServiceV1(tick,new p.Cap08S3OutcomeCompletionEvidenceServiceV1(runner));
  const bootstrapLogicalTime=new Date(Date.parse(p.CAP08_S1_RUNTIME_START_V1)-3_600_000).toISOString();
  const leaseOwner=`cap08-s4-t17-product-implementation-${MODE}`;
  await new p.A0BootstrapRuntimeServiceV1(runtimeRepository,runtimeRepository,fixture.bootstrap_evidence_source).execute({scope:fixture.scope,logical_time:bootstrapLogicalTime,created_at:fixture.bootstrap_runtime_config.created_at,runtime_config:fixture.bootstrap_runtime_config,hydraulic:fixture.hydraulic,soil_hydraulic_config_ref:"soil_hydraulic_config_c8_v1",lease_owner:leaseOwner,lease_duration_seconds:300});
  const tickResults=[];
  for(let index=0;index<=16;index+=1){const logicalTime=p.cap08TickLogicalTimeV1(index);tickResults.push(await completion.executeOneTick({formal_run_id:fixture.formal_run_id,scope:fixture.scope,logical_time:logicalTime,created_at:fixture.bootstrap_runtime_config.created_at,runtime_config_ref:fixture.runtime_config_refs_by_logical_time[logicalTime],runtime_config_hash:fixture.runtime_config_hashes_by_logical_time[logicalTime],authorized_future_forcing_binding_ids:["binding_weather","binding_et0"],crop_stage_context:fixture.crop_stage_context,lease_owner:leaseOwner,lease_duration_seconds:300}));}
  assert.equal(tickResults.length,17);
  const s4Service=new p.Cap08S4AppendForwardServiceV1(runner,evidence);
  s4Service.chainReader=createS6PrefixTransportReaderV1({pool:runner,p});
  const s4=await s4Service.execute({formal_run_id:fixture.formal_run_id,scope:fixture.scope,created_at:fixture.bootstrap_runtime_config.created_at,phase_engine_source_digest:sourceDigest});
  assert.equal(s4.status,"COMPLETED");
  return{p,fixture,runtimeRepository,forecastRepository,nextTickRepository,evidence,frozen,tickResults,s4,leaseOwner};
}

async function main():Promise<void>{
  if(!["normal","rollback"].includes(MODE))throw new Error(`CAP08_S4_T17_ACCEPTANCE_MODE_INVALID:${MODE}`);
  const admin=new Pool({connectionString:ADMIN_URL,max:2});
  try{
    const established=await establishT16AndS4V1();
    const {p,fixture,runtimeRepository,forecastRepository,nextTickRepository,frozen,s4,leaseOwner}=established;
    const transitionRepository=new PostgresCap08S4T17TransitionRepositoryV1(runner);
    const contextResolved=await transitionRepository.resolvePersistenceContext({formal_run_id:fixture.formal_run_id,scope:fixture.scope,expected_t17_logical_time:p.cap08TickLogicalTimeV1(17)});
    assert.equal(contextResolved.expected_latest_base.state.ref,s4.authority.identity_input.base_t16_state.ref);
    assert.equal(contextResolved.expected_latest_base.checkpoint.ref,s4.authority.identity_input.base_t16_checkpoint.ref);
    assert.equal(contextResolved.expected_latest_base.forecast_result.ref,s4.authority.identity_input.base_t16_forecast.ref);

    const adapter=new Cap08S4T17TransitionPersistenceAdapterV1(ordinaryPersistenceV1(runtimeRepository,forecastRepository),transitionRepository);
    const deferred=new Cap08DeferredScenarioPersistenceV1(adapter);
    const t17=p.cap08TickLogicalTimeV1(17);
    const correctedHandoff=new Cap08S4T17CorrectedHandoffServiceV1(fixture.formal_run_id,t17,new p.PrepareNextTickInputServiceV1(nextTickRepository),transitionRepository);
    const generic=new Cap04ForecastScenarioSingleTickServiceV1(correctedHandoff,frozen,runtimeRepository,deferred,new DirectCap04ExecutionConfigResolverV1());
    const transitionService=new Cap08S4T17TransitionTickServiceV1(generic,adapter,frozen,runtimeRepository,transitionRepository);
    const resolver={async resolve(input:{formal_run_id:string;scope:any;t17_logical_time:string}){const context=await transitionRepository.resolvePersistenceContext({formal_run_id:input.formal_run_id,scope:input.scope,expected_t17_logical_time:input.t17_logical_time});return{formal_run_id:input.formal_run_id,scope:structuredClone(input.scope),lineage_id:String(context.corrected_state.lineage_id),revision_id:String(context.corrected_state.revision_id),t17_logical_time:input.t17_logical_time,expected_latest_base:context.expected_latest_base,corrected_computation_predecessor:context.corrected_computation_predecessor,correction_authority:context.correction_authority};}};
    const router=new Cap08S4T17ExplicitRoutingTickServiceV1(generic,transitionService,resolver);
    const context=await resolver.resolve({formal_run_id:fixture.formal_run_id,scope:fixture.scope,t17_logical_time:t17});
    await frozen.freeze({scope:fixture.scope,logical_time:t17});
    let serializationInjected=false;
    const fault=(stage:string)=>{if(MODE==="normal"&&stage==="after_replay_classification"&&!serializationInjected){serializationInjected=true;throw Object.assign(new Error("CONTROLLED_40001"),{code:"40001"});}if(MODE==="rollback"&&stage==="after_transition_witness_fact")throw new Error("CONTROLLED_ROLLBACK_AFTER_WITNESS");};
    const executeInput={formal_run_id:fixture.formal_run_id,scope:fixture.scope,logical_time:t17,created_at:fixture.bootstrap_runtime_config.created_at,runtime_config_ref:fixture.runtime_config_refs_by_logical_time[t17],runtime_config_hash:fixture.runtime_config_hashes_by_logical_time[t17],authorized_future_forcing_binding_ids:["binding_weather","binding_et0"],crop_stage_context:fixture.crop_stage_context,lease_owner:leaseOwner,lease_duration_seconds:300,fault_injection_a:fault};

    if(MODE==="rollback"){
      await assert.rejects(()=>router.executeOneTick(executeInput),/CONTROLLED_ROLLBACK_AFTER_WITNESS/);
      const counts=await admin.query(`SELECT (SELECT count(*)::int FROM twin_cap08_s4_t17_transition_guard_v1) AS guards,(SELECT count(*)::int FROM facts WHERE record_json->>'type'='geox_mcft_cap08_s4_t17_transition_witness_v1') AS witnesses,(SELECT count(*)::int FROM twin_terminal_tick_uniqueness_v1 WHERE logical_time=$1::timestamptz) AS t17_terminal`,[t17]);
      assert.deepEqual(counts.rows[0],{guards:0,witnesses:0,t17_terminal:0});
      assert.deepEqual(await transitionRepository.readExpectedLatestBase(fixture.scope),context.expected_latest_base);
      const result={schema_version:"geox_mcft_cap08_s4_t17_product_implementation_db_result_v1",status:"PASS",mode:MODE,rollback_complete:true,latest_remained_base_t16:true,formal_authority_chain_status:"PAUSED"};fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,`${JSON.stringify(result,null,2)}\n`);console.log(JSON.stringify(result,null,2));return;
    }

    const executed=await router.executeOneTick(executeInput);
    assert.equal(executed.transition_status,"INSERTED_ATOMIC_TRANSITION");
    assert.equal(executed.transition_write_delta,10);
    assert.equal(serializationInjected,true);
    if(!executed.b_record)throw new Error("CAP08_S4_T17_A1_SCENARIO_REQUIRED");
    await deferred.flushScenarioSet(executed.b_record);
    const replayLease=await runtimeRepository.acquireLease({...fixture.scope,lease_owner:leaseOwner,lease_duration_seconds:300});
    const replay=await transitionRepository.commitAuthorityBoundA1Transition({scope:fixture.scope,lease:replayLease,formal_run_id:fixture.formal_run_id,expected_latest_base:context.expected_latest_base,corrected_computation_predecessor:context.corrected_computation_predecessor,correction_authority:context.correction_authority,record_set:executed.a_record_set,transition_witness:executed.transition_witness});
    assert.equal(replay.status,"EXISTING_IDEMPOTENT_SUCCESS");assert.equal(replay.write_delta,0);
    const t17State=memberV1(executed.a_record_set,"twin_state_estimate_v1");
    await admin.query(`UPDATE twin_state_latest_index_v1 SET state_object_id=$7,determinism_hash=$8 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,[fixture.scope.tenant_id,fixture.scope.project_id,fixture.scope.group_id,fixture.scope.field_id,fixture.scope.season_id,fixture.scope.zone_id,context.expected_latest_base.state.ref,context.expected_latest_base.state.hash]);
    await assert.rejects(()=>transitionRepository.commitAuthorityBoundA1Transition({scope:fixture.scope,lease:replayLease,formal_run_id:fixture.formal_run_id,expected_latest_base:context.expected_latest_base,corrected_computation_predecessor:context.corrected_computation_predecessor,correction_authority:context.correction_authority,record_set:executed.a_record_set,transition_witness:executed.transition_witness}),/POST_TRANSITION_PROJECTION_DIVERGENCE/);
    assert.equal((await transitionRepository.readExpectedLatestBase(fixture.scope)).state.ref,context.expected_latest_base.state.ref);
    await admin.query(`UPDATE twin_state_latest_index_v1 SET state_object_id=$7,determinism_hash=$8 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,[fixture.scope.tenant_id,fixture.scope.project_id,fixture.scope.group_id,fixture.scope.field_id,fixture.scope.season_id,fixture.scope.zone_id,t17State.object_id,t17State.determinism_hash]);
    const guard=await admin.query(`SELECT count(*)::int AS n FROM twin_cap08_s4_t17_transition_guard_v1 WHERE transition_id=$1 AND witness_determinism_hash=$2`,[executed.transition_witness.transition_id,executed.transition_witness.determinism_hash]);assert.equal(guard.rows[0].n,1);
    const result={schema_version:"geox_mcft_cap08_s4_t17_product_implementation_db_result_v1",status:"PASS",mode:MODE,first_commit:"INSERTED_ATOMIC_TRANSITION",serializable_40001_full_transaction_retry:true,exact_replay:"EXISTING_IDEMPOTENT_SUCCESS",exact_replay_write_delta:0,post_transition_projection_divergence:"FAIL_CLOSED_NO_REPAIR",four_pointer_base_to_t17_cas:true,transition_witness_persisted:true,formal_a1_proof_hash:executed.formal_a1_proof.determinism_hash,transition_id:executed.transition_witness.transition_id,formal_authority_chain_status:"PAUSED"};fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,`${JSON.stringify(result,null,2)}\n`);console.log(JSON.stringify(result,null,2));
  }finally{await admin.end();await runner.end();}
}
main().catch((error)=>{console.error(error);process.exitCode=1;});
