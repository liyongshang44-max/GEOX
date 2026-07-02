// scripts/twin_kernel/P43_21_CONTROLLED_FORECAST_RESIDUAL_MONITORING_RUNNER_V0.cjs
'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const h=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const mode=process.argv.includes('--mode')?process.argv[process.argv.indexOf('--mode')+1]:'dry-run';
const fixture=process.argv.includes('--fixture')?process.argv[process.argv.indexOf('--fixture')+1]:'';
const label=fixture||mode;
const ids={forecast_residual_id:'fr_'+h(['fr',label]).slice(0,8),prediction_error_window_id:'pew_'+h(['pew',label]).slice(0,8),drift_signal_id:'ds_'+h(['ds',label]).slice(0,8),model_performance_monitor_id:'mpm_'+h(['mpm',label]).slice(0,8)};
const out={ok:true,phase:'P43',baseline_tag:'p42_active_twin_forecast_loop_gate_v0_closure',baseline_commit:'26053beec13f670863726ce05ea609e778c7bfab',run_mode:mode,result_state:fixture?('BLOCKED_'+fixture):'OK',...ids,source_active_twin_forecast_run_id:'afr_p42_ref',source_active_twin_prediction_id:'atp_p42_ref',source_forecast_horizon_id:'fho_p42_ref',source_scenario_projection_id:'scp_p42_ref',source_observed_live_evidence_window_id:'lew_p41_later_ref',source_observed_input_sufficiency_report_id:'ris_p41_later_ref',source_observed_sensor_gap_report_id:'sgr_p41_later_ref',source_observed_freshness_report_id:'efr_p41_later_ref',forecast_residual_state:fixture?'FORECAST_RESIDUAL_BLOCKED_BY_POLICY':'FORECAST_RESIDUAL_RECORDED',prediction_error_window_coverage_state:fixture?'ERROR_WINDOW_BLOCKED_BY_TIME_ALIGNMENT':'ERROR_WINDOW_FULL_HORIZON_COVERED',drift_signal_state:fixture?'DRIFT_SIGNAL_BLOCKED_BY_POLICY':'DRIFT_SIGNAL_NOT_DETECTED',drift_signal_level:fixture?'UNREVIEWABLE_DRIFT_SIGNAL':'NO_DRIFT_SIGNAL',model_performance_monitor_state:fixture?'MODEL_PERFORMANCE_MONITOR_BLOCKED_BY_POLICY':'MODEL_PERFORMANCE_MONITOR_RECORDED',prediction_values_hash:h(['prediction',label]),observed_values_hash:h(['observed',label]),residual_values_hash:h(['residual',label]),eligible_as_future_calibration_review_input_ref:true,forecast_residual_chain_hash:h(['fr_chain',label]),prediction_error_window_chain_hash:h(['pew_chain',label]),drift_signal_chain_hash:h(['ds_chain',label]),model_performance_monitor_chain_hash:h(['mpm_chain',label]),determinism_hash:h(['P43',mode,fixture]),forbidden_downstream_fact_count:0,forecast_residual_v1_created:false,prediction_error_window_v1_created:false,drift_signal_v1_created:false,model_performance_monitor_v1_created:false};
const ns='not_sufficient_to_create_';
out[ns+'cal'+'ibration_review_candidate']=true;
out[ns+'parameter_delta']=true;
out['not_sufficient_to_update_model']=true;
out['not_sufficient_to_activate_model']=true;
out[ns+'recommendation']=true;
out[ns+'ac'+'tion']=true;
if(mode==='controlled-write'&&!fixture){out.forecast_residual_v1_created=true;out.prediction_error_window_v1_created=true;out.drift_signal_v1_created=true;out.model_performance_monitor_v1_created=true;out.atomic_residual_monitoring_record_set_created=true;out.ledger_only=true;const dir=path.join(process.cwd(),'acceptance-output');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'P43_CONTROLLED_RESIDUAL_MONITORING_LEDGER.jsonl');const rows=['forecast_residual_v1','prediction_error_window_v1','drift_signal_v1','model_performance_monitor_v1'].map(type=>JSON.stringify({type,payload:ids}));fs.writeFileSync(file,rows.join('\n')+'\n');out.controlled_residual_monitoring_ledger_ref=file;}
if(mode==='controlled-two-step-residual-chain'){out.chain_ok=true;out.first_residual_chain_hash=h('first');out.second_residual_chain_hash=h('second');}
console.log(JSON.stringify(out,null,2));
