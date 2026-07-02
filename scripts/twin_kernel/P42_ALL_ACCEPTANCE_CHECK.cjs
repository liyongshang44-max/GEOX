// scripts/twin_kernel/P42_ALL_ACCEPTANCE_CHECK.cjs
'use strict';
const fs=require('node:fs'),cp=require('node:child_process');
const J=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const R=a=>JSON.parse(cp.execFileSync(process.execPath,['scripts/twin_kernel/P42_21_CONTROLLED_ACTIVE_TWIN_FORECAST_LOOP_RUNNER_V0.cjs',...a],{encoding:'utf8'}));
const C=[],ck=(n,v)=>C.push([n,!!v]);
const c=J('docs/twin_kernel/P42_ACTIVE_TWIN_FORECAST_LOOP_CONTRACT_V0.json');
const r=J('docs/twin_kernel/P42_ACTIVE_TWIN_FORECAST_LOOP_COMPLETION_REVIEW_V0.json');
const dry=R([]),dry2=R([]),cf=R(['--mode','controlled-forecast']),wr=R(['--mode','controlled-write']),ch=R(['--mode','controlled-two-step-forecast-chain']);
ck('baseline',c.baseline_tag==='p41_live_evidence_ingestion_sla_runtime_input_contract_v0_closure'&&c.baseline_commit==='8326cf87fb01f7377a8b55d784ffa9027fbd725b');
ck('upstream',c.p41_final_commit==='649988feac9d57bd929d2b13137a5e2ec8c0f903'&&c.p41_controlled_live_input_ledger_v0===true);
ck('not_service',c.p42_is_controlled_active_forecast_record_gate&&c.p42_is_not_background_forecast_loop&&c.p42_is_not_daemon&&c.p42_is_not_server_runtime_loop&&c.p42_is_not_production_forecast_api);
ck('types',JSON.stringify(c.allowed_created_fact_types)===JSON.stringify(['active_twin_forecast_run_v1','active_twin_prediction_v1','forecast_horizon_v1','scenario_projection_v1']));
ck('dry_stable',dry.determinism_hash===dry2.determinism_hash);
ck('dry_none',dry.active_twin_forecast_run_v1_created===false&&dry.active_twin_prediction_v1_created===false&&dry.forecast_horizon_v1_created===false&&dry.scenario_projection_v1_created===false);
ck('cf_none',cf.active_twin_forecast_run_v1_created===false&&cf.active_twin_prediction_v1_created===false&&cf.forecast_horizon_v1_created===false&&cf.scenario_projection_v1_created===false);
ck('write_four',wr.active_twin_forecast_run_v1_created&&wr.active_twin_prediction_v1_created&&wr.forecast_horizon_v1_created&&wr.scenario_projection_v1_created&&wr.atomic_active_forecast_record_set_created);
ck('ledger_only',wr.controlled_write_creates_target_records_only_in_controlled_active_forecast_ledger_v0===true&&wr.forbidden_downstream_fact_count===0);
ck('future_marks',wr.eligible_as_future_residual_monitoring_input_ref&&wr.not_sufficient_to_create_residual&&wr.not_sufficient_to_create_drift_signal&&wr.not_sufficient_to_create_recommendation&&wr.not_sufficient_to_update_model);
ck('chain',ch.active_forecast_chains_are_append_only&&ch.previous_active_twin_forecast_run_payload_must_not_be_mutated&&ch.previous_active_twin_prediction_payload_must_not_be_mutated&&ch.previous_forecast_horizon_payload_must_not_be_mutated&&ch.previous_scenario_projection_payload_must_not_be_mutated);
ck('review',r.completion_status==='implementation_ready_for_review'&&r.final_closure_status==='not_started');
for(let i=0;i<60;i++){const x=R(['--fixture','b'+i]);ck('blocked_'+i,x.ok&&x.active_twin_forecast_run_v1_created===false&&x.active_twin_prediction_v1_created===false&&x.forecast_horizon_v1_created===false&&x.scenario_projection_v1_created===false);}
const failed=C.filter(([,ok])=>!ok).map(([n])=>n),ok=failed.length===0;
console.log(JSON.stringify({ok,acceptance:'P42_ALL_ACCEPTANCE',phase:'P42',baseline_tag:c.baseline_tag,baseline_commit:c.baseline_commit,assertion_count:C.length,failed_assertion_count:failed.length,failed_assertions:failed,dry_run_determinism_hash:dry.determinism_hash,controlled_forecast_determinism_hash:cf.determinism_hash,controlled_write_determinism_hash:wr.determinism_hash,first_active_forecast_chain_hash:ch.first_active_twin_forecast_run_chain_hash,second_active_forecast_chain_hash:ch.second_active_twin_forecast_run_chain_hash},null,2));
if(!ok)process.exit(1);
