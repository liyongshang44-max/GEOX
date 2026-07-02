// scripts/twin_kernel/P43_ALL_ACCEPTANCE_CHECK.cjs
'use strict';
const fs=require('node:fs');
const cp=require('node:child_process');
const J=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const R=a=>JSON.parse(cp.execFileSync(process.execPath,['scripts/twin_kernel/P43_21_CONTROLLED_FORECAST_RESIDUAL_MONITORING_RUNNER_V0.cjs',...a],{encoding:'utf8'}));
const C=[];const ck=(n,v)=>C.push([n,!!v]);
const c=J('docs/twin_kernel/P43_FORECAST_RESIDUAL_MONITORING_DRIFT_DETECTION_CONTRACT_V0.json');
const r=J('docs/twin_kernel/P43_FORECAST_RESIDUAL_MONITORING_DRIFT_DETECTION_COMPLETION_REVIEW_V0.json');
const dry=R([]),dry2=R([]),cr=R(['--mode','controlled-residual']),wr=R(['--mode','controlled-write']),ch=R(['--mode','controlled-two-step-residual-chain']);
ck('baseline',c.baseline_tag==='p42_active_twin_forecast_loop_gate_v0_closure'&&c.baseline_commit==='26053beec13f670863726ce05ea609e778c7bfab');
ck('p42_final',c.p42_final_commit==='658cdba17ccd2a37327b52a0ff8becb694ffdf47');
ck('types',Array.isArray(c.allowed_created_fact_types)&&c.allowed_created_fact_types.length===4);
ck('doc_count',fs.readdirSync('docs/twin_kernel').filter(x=>x.startsWith('P43_')).length===21);
ck('script_count',fs.readdirSync('scripts/twin_kernel').filter(x=>x.startsWith('P43_')).length===3);
ck('task_file',fs.existsSync('docs/tasks/P43-Forecast-Residual-Monitoring-Drift-Detection-Gate-v0.md'));
ck('dry_stable',dry.determinism_hash===dry2.determinism_hash);
ck('dry_none',dry.forecast_residual_v1_created===false&&dry.prediction_error_window_v1_created===false&&dry.drift_signal_v1_created===false&&dry.model_performance_monitor_v1_created===false);
ck('cr_none',cr.forecast_residual_v1_created===false&&cr.prediction_error_window_v1_created===false&&cr.drift_signal_v1_created===false&&cr.model_performance_monitor_v1_created===false);
ck('write_four',wr.forecast_residual_v1_created&&wr.prediction_error_window_v1_created&&wr.drift_signal_v1_created&&wr.model_performance_monitor_v1_created&&wr.atomic_residual_monitoring_record_set_created);
ck('ledger',wr.ledger_only===true&&wr.forbidden_downstream_fact_count===0);
ck('chain',ch.chain_ok===true);
ck('review',r.completion_status==='implementation_ready_for_review'&&r.final_closure_status==='not_started');
for(let i=0;i<63;i++){const x=R(['--fixture','b'+i]);ck('blocked_'+i,x.ok&&x.forecast_residual_v1_created===false&&x.prediction_error_window_v1_created===false&&x.drift_signal_v1_created===false&&x.model_performance_monitor_v1_created===false);}
const failed=C.filter(([,ok])=>!ok).map(([n])=>n),ok=failed.length===0;
console.log(JSON.stringify({ok,acceptance:'P43_ALL_ACCEPTANCE',phase:'P43',baseline_tag:c.baseline_tag,baseline_commit:c.baseline_commit,assertion_count:C.length,failed_assertion_count:failed.length,failed_assertions:failed,dry_run_determinism_hash:dry.determinism_hash,controlled_residual_determinism_hash:cr.determinism_hash,controlled_write_determinism_hash:wr.determinism_hash,first_residual_chain_hash:ch.first_residual_chain_hash,second_residual_chain_hash:ch.second_residual_chain_hash},null,2));
if(!ok)process.exit(1);
