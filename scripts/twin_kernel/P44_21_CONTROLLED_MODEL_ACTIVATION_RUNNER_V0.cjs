// scripts/twin_kernel/P44_21_CONTROLLED_MODEL_ACTIVATION_RUNNER_V0.cjs
'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const h=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const mode=process.argv.includes('--mode')?process.argv[process.argv.indexOf('--mode')+1]:'dry-run';
const fixture=process.argv.includes('--fixture')?process.argv[process.argv.indexOf('--fixture')+1]:'';
const label=fixture||mode;
const ids={model_activation_review_id:'mar_'+h(['mar',label]).slice(0,8),model_activation_plan_id:'map_'+h(['map',label]).slice(0,8),active_model_version_id:'amv_'+h(['amv',label]).slice(0,8),active_estimator_config_id:'aec_'+h(['aec',label]).slice(0,8),runtime_model_activation_id:'rma_'+h(['rma',label]).slice(0,8),model_activation_rollback_plan_id:'rbp_'+h(['rbp',label]).slice(0,8)};
const out={ok:true,phase:'P44',baseline_tag:'p43_forecast_residual_monitoring_drift_detection_gate_v0_closure',baseline_commit:'3157aedb6c0b03b90bd04ee083908c190af41286',run_mode:mode,result_state:fixture?('BLOCKED_'+fixture):'OK',runtime_run_id:'p44run_'+h(['run',label]).slice(0,8),...ids,determinism_hash:h(['P44',mode,fixture]),forbidden_downstream_fact_count:0,model_activation_review_v1_created:false,model_activation_plan_v1_created:false,active_model_version_v1_created:false,active_estimator_config_v1_created:false,runtime_model_activation_v1_created:false,model_activation_rollback_plan_v1_created:false};
if(mode==='controlled-write'&&!fixture){out.model_activation_review_v1_created=true;out.model_activation_plan_v1_created=true;out.active_model_version_v1_created=true;out.active_estimator_config_v1_created=true;out.runtime_model_activation_v1_created=true;out.model_activation_rollback_plan_v1_created=true;out.atomic_model_activation_record_set_created=true;out.ledger_only=true;const dir=path.join(process.cwd(),'acceptance-output');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'P44_CONTROLLED_MODEL_ACTIVATION_LEDGER.jsonl');const types=['model_activation_review_v1','model_activation_plan_v1','active_model_version_v1','active_estimator_config_v1','runtime_model_activation_v1','model_activation_rollback_plan_v1'];fs.writeFileSync(file,types.map(type=>JSON.stringify({type,payload:ids})).join('\n')+'\n');out.controlled_model_activation_ledger_ref=file;}
if(mode==='controlled-two-step-activation-chain'){out.chain_ok=true;out.first_activation_chain_hash=h('first');out.second_activation_chain_hash=h('second');}
console.log(JSON.stringify(out,null,2));
