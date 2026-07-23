// Fresh-PostgreSQL preparation proof for MCFT-CAP-08.S2 formal Forcing/Evidence/State/Forecast providers.
// No Candidate Declaration, review satisfaction, S2 effectiveness, S3, late correction, Residual, or production authority.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAP08_S2_FORMAL_PROVIDER_CONTRACT_DIGEST_V1 as CONTRACT,
  CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1 as PROFILE,
  buildCap08S2FormalDueObligationV1 as due,
} from "../../apps/server/src/domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.js";
import {
  A0BootstrapRuntimeServiceV1,
  Cap04ForecastScenarioSingleTickServiceV1,
  Cap08CompletionAuthorityServiceV1,
  Cap08DeferredScenarioPersistenceV1,
  Cap08FrozenEvidenceSourceV1,
  Cap08S1BaseRangeServiceV1,
  Cap08S1BaseRuntimeServiceV1,
  Cap08S1BaseTickServiceV1,
  PostgresCompletionAuthorityRepositoryV1,
  PostgresForecastScenarioRecoveryRepositoryV1,
  PostgresNextTickRepositoryV1,
  PostgresRuntimeRepositoryV1,
  PrepareNextTickInputServiceV1,
  CAP08_S1_CREATED_AT_V1 as CREATED_AT,
  admin,
  persistenceAdapterV1,
  runner,
  sourceDigestV1,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { Cap08S2FormalProviderQualificationServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s2_formal_provider_qualification_service_v1.js";
import { Cap08S2QualifiedEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s2_qualified_evidence_source_v1.js";
import {
  buildCap08S2FormalProviderFixtureV1 as fixtureV1,
  buildCap08S2MutatedEvidenceSourceV1 as mutateV1,
} from "./mcft_cap08_s2_formal_provider_fixture_v1.js";

if (process.env.MCFT_CAP08_S2_FORMAL_PROVIDER_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP08_S2_FORMAL_PROVIDER_DESTRUCTIVE_ACCEPTANCE_1");
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."), "acceptance-output/MCFT_CAP_08_S2_FORMAL_PROVIDERS_DB_RESULT.json");
const write = (v: unknown) => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(v, null, 2)}\n`); };
const count = async (type: string) => Number((await runner.query("SELECT count(*)::int n FROM facts WHERE record_json->'payload'->>'object_type'=$1", [type])).rows[0].n);

async function negatives(): Promise<string[]> {
  const cases: Array<[string, (records: any[]) => any[], string]> = [
    ["FUTURE_EVIDENCE_LEAKAGE_REJECTED", (r) => { const x=r.find(v=>v.source_record_id==="FVO-02"); x.available_to_runtime_at="2026-06-01T03:00:00.000Z"; x.role_time={...x.role_time,ingested_at:x.available_to_runtime_at}; return [...r]; }, "CAP08_S2_EVIDENCE_FUTURE_LEAKAGE:FVO-02"],
    ["WRONG_DUE_FVO_REJECTED", (r) => (r.find(v=>v.source_record_id==="FVO-02").source_record_id="FVO-99", [...r]), "CAP08_S2_EVIDENCE_DUE_FVO_SET_MISMATCH"],
    ["FOREIGN_FORCING_BINDING_REJECTED", (r) => (r.find(v=>v.record_type==="future_weather_assumption_v1").binding_id="binding_weather_foreign", [...r]), "CAP08_S2_WEATHER_BINDING_MISMATCH"],
  ];
  const passed: string[]=[];
  for (const [name,mutate,error] of cases) {
    const f=fixtureV1();
    const source=new Cap08S2QualifiedEvidenceSourceV1(mutateV1({base:f.formal_evidence_source,mutate}));
    await assert.rejects(source.loadCandidateRecords({scope:f.scope,logical_time:"2026-06-01T02:00:00.000Z"}),new RegExp(error));
    passed.push(name);
  }
  return passed;
}

async function main(): Promise<void> {
  const checks: Array<{name:string;status:"PASS"}>=[];
  const ok=(name:string)=>{checks.push({name,status:"PASS"});console.log(`PASS ${name}`);};
  try {
    assert.equal((await runner.query("SELECT current_user u")).rows[0].u,"geox_mcft_cap08_runner_v1"); ok("bounded runner identity");
    const negativeChecks=await negatives(); assert.equal(negativeChecks.length,3); ok("formal Evidence and Forcing negative source checks");
    const f=fixtureV1(); assert.match(f.formal_run_id,/^cap08_[0-9a-f]{32}$/);
    const runtimeRepo=new PostgresRuntimeRepositoryV1(runner), nextRepo=new PostgresNextTickRepositoryV1(runner);
    const forecastRepo=new PostgresForecastScenarioRecoveryRepositoryV1(runner), completionRepo=new PostgresCompletionAuthorityRepositoryV1(runner);
    assert.equal((await nextRepo.commitRealityBindingSnapshot(f.reality_binding_snapshot)).status,"INSERTED");
    for (const config of f.runtime_configs) assert.equal((await runtimeRepo.commitRuntimeConfig(config)).status,"INSERTED");
    const order:string[]=[], persistence=persistenceAdapterV1(runtimeRepo,forecastRepo,order), deferred=new Cap08DeferredScenarioPersistenceV1(persistence);
    const qualified=new Cap08S2QualifiedEvidenceSourceV1(f.formal_evidence_source), frozen=new Cap08FrozenEvidenceSourceV1(qualified);
    const handoff=new PrepareNextTickInputServiceV1(nextRepo);
    const cap04=new Cap04ForecastScenarioSingleTickServiceV1(handoff,frozen,runtimeRepo,deferred);
    const tick=new Cap08S1BaseTickServiceV1(handoff,frozen,deferred,cap04);
    const range=new Cap08S1BaseRangeServiceV1(handoff,tick,sourceDigestV1(),new Cap08CompletionAuthorityServiceV1(completionRepo));
    const runtime=new Cap08S1BaseRuntimeServiceV1(new A0BootstrapRuntimeServiceV1(runtimeRepo,runtimeRepo,f.bootstrap_evidence_source),range);
    const input={formal_run_id:f.formal_run_id,scope:f.scope,created_at:CREATED_AT,bootstrap_runtime_config:f.bootstrap_runtime_config,bootstrap_hydraulic:f.hydraulic,soil_hydraulic_config_ref:"soil_hydraulic_config_c8_v1",runtime_config_refs_by_logical_time:f.runtime_config_refs_by_logical_time,runtime_config_hashes_by_logical_time:f.runtime_config_hashes_by_logical_time,authorized_future_forcing_binding_ids:["binding_weather","binding_et0"],crop_stage_context:f.crop_stage_context,lease_owner:"mcft-cap08-s2-formal-provider-preparation",lease_duration_seconds:300};
    const first=await runtime.execute(input); assert.equal(first.status,"COMPLETED"); assert.equal(first.range.executed_tick_count,24); assert.equal(order.length,48); ok("fresh PostgreSQL B00 and T00-T23 formal provider run");
    const q=new Cap08S2FormalProviderQualificationServiceV1(qualified).qualifyRange({formal_run_id:f.formal_run_id,scope:f.scope,range:first.range});
    assert.equal(q.provider_profile_id,PROFILE); assert.equal(q.provider_contract_digest,CONTRACT); assert.deepEqual([q.tick_qualifications.length,q.selected_state_observation_count,q.quarantined_residual_only_count,q.quarantined_late_state_correction_count,q.observed_but_not_available_absence_witness_count],[24,5,17,1,15]);
    const selected=Object.fromEntries(q.tick_qualifications.filter(t=>t.selected_state_observation_ref).map(t=>[t.tick_id,t.selected_state_observation_ref]));
    assert.deepEqual(selected,{T02:"FVO-02",T03:"FVO-03",T04:"FVO-04",T10:"FVO-10",T22:"FVO-22"});
    const t16=q.tick_qualifications.find(t=>t.tick_id==="T16"); assert.ok(t16); assert.equal(t16.selected_state_observation_ref,null); assert.equal(t16.late_state_correction_applied,false); assert.deepEqual(due(t16.logical_time).late_state_correction_observation_ids,["FVO-01"]); ok("24 providers qualified and later-Slice evidence quarantined");
    assert.deepEqual(await Promise.all([count("twin_state_estimate_v1"),count("twin_forecast_run_v1"),count("twin_scenario_set_v1"),count("twin_decision_record_v1"),count("twin_action_feedback_v1"),count("twin_forecast_residual_v1"),count("twin_model_activation_v1")]),[25,25,24,0,0,0,0]); ok("canonical cardinality and nonclaims");
    const before=Number((await runner.query("SELECT count(*)::int n FROM facts")).rows[0].n), second=await runtime.execute({...input,lease_owner:`${input.lease_owner}-replay`});
    assert.equal(second.status,"ALREADY_COMPLETE"); assert.equal(Number((await runner.query("SELECT count(*)::int n FROM facts")).rows[0].n),before); assert.equal(qualified.getTraceCount(),24); ok("zero-write completion replay");
    const result={schema_version:"geox_mcft_cap08_s2_formal_providers_db_result_v1",status:"PASS",preparation_only:true,formal_candidate_created:false,independent_review_satisfied:false,provider_profile_id:PROFILE,provider_contract_digest:CONTRACT,formal_run_id:f.formal_run_id,successful_tick_count:q.successful_tick_count,forcing_window_count:q.forcing_window_count,state_count:q.state_count,forecast_count:q.forecast_count,forecast_point_count:q.forecast_point_count,selected_state_observations_by_tick:selected,quarantined_residual_only_count:q.quarantined_residual_only_count,quarantined_late_state_correction_count:q.quarantined_late_state_correction_count,observed_but_not_available_absence_witness_count:q.observed_but_not_available_absence_witness_count,phase_engine_contract_preserved:q.phase_engine_contract_preserved,late_state_correction_deferred_to_s4:q.late_state_correction_deferred_to_s4,residual_persistence_deferred_to_s5:q.residual_persistence_deferred_to_s5,decision_action_feedback_deferred_to_s3:q.decision_action_feedback_deferred_to_s3,production_runtime_source_authorized:false,s2_effectiveness_established:false,s3_authorized:false,negative_source_checks:negativeChecks,checks};
    write(result); console.log(JSON.stringify(result));
  } catch(error) { write({schema_version:"geox_mcft_cap08_s2_formal_providers_db_result_v1",status:"FAIL",error:error instanceof Error?error.message:String(error),checks}); throw error; }
  finally { await Promise.all([runner.end(),admin.end()]); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
