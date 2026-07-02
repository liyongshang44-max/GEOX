// scripts/twin_kernel/P40_ALL_ACCEPTANCE_CHECK.cjs
'use strict';
const fs=require('node:fs'),cp=require('node:child_process');
const J=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const R=a=>JSON.parse(cp.execFileSync(process.execPath,['scripts/twin_kernel/P40_20_CONTROLLED_PRODUCTION_TWIN_RUNTIME_SCHEDULER_RUNNER_V0.cjs',...a],{encoding:'utf8'}));
const C=[],ck=(n,v)=>C.push([n,!!v]);
const contract=J('docs/twin_kernel/P40_PRODUCTION_TWIN_RUNTIME_SCHEDULER_CONTRACT_V0.json'),review=J('docs/twin_kernel/P40_PRODUCTION_TWIN_RUNTIME_SCHEDULER_COMPLETION_REVIEW_V0.json');
const dry=R([]),dry2=R([]),cs=R(['--mode','controlled-schedule']),ct=R(['--mode','controlled-tick']),cc=R(['--mode','controlled-cycle']),wr=R(['--mode','controlled-write']),ch=R(['--mode','controlled-two-step-runtime-chain']);
ck('baseline',contract.baseline_tag==='p39_model_version_candidate_shadow_activation_gate_v0_closure'&&contract.baseline_commit==='5e4fa5aead5fa5d3cd1b460130703b3168e3f9e7');
ck('p39_inheritance',contract.p39_final_commit==='e9200439eb518ee40b08d57be9516dfda576d65f'&&contract.p39_completion_review_closure_tag_created_field_is_false===true);
ck('not_background_runtime',contract.p40_is_not_background_daemon===true&&contract.p40_is_not_cron_scheduler===true&&contract.p40_is_not_server_runtime_loop===true&&contract.p40_is_not_database_scheduler===true);
ck('allowed_types',JSON.stringify(contract.allowed_created_fact_types)===JSON.stringify(['twin_runtime_schedule_v1','twin_runtime_tick_v1','twin_runtime_cycle_v1','runtime_cycle_readback_v1']));
ck('dry_deterministic',dry.determinism_hash===dry2.determinism_hash);
ck('dry_no_targets',dry.twin_runtime_schedule_v1_created===false&&dry.twin_runtime_tick_v1_created===false&&dry.twin_runtime_cycle_v1_created===false&&dry.runtime_cycle_readback_v1_created===false);
ck('envelope_modes_no_targets',cs.twin_runtime_schedule_v1_created===false&&ct.twin_runtime_tick_v1_created===false&&cc.twin_runtime_cycle_v1_created===false&&cc.runtime_cycle_readback_v1_created===false);
ck('write_creates_four_records',wr.twin_runtime_schedule_v1_created===true&&wr.twin_runtime_tick_v1_created===true&&wr.twin_runtime_cycle_v1_created===true&&wr.runtime_cycle_readback_v1_created===true);
ck('write_controlled_ledger',wr.controlled_runtime_scheduler_record_set_created===true&&wr.controlled_write_creates_target_records_only_in_controlled_runtime_scheduler_ledger_v0===true);
ck('step_order',wr.cycle_step_order.join('>')==='resolve_input_window>attempt_state_estimate>attempt_forecast>attempt_previous_forecast_residual_check>write_cycle_readback');
ck('blocked_forecast_and_deferred_residual',wr.forecast_step_status==='STEP_BLOCKED_BY_MISSING_GATE'&&wr.previous_forecast_residual_check_step_status==='STEP_DEFERRED_TO_P43');
ck('runtime_nonclaims',wr.runtime_schedule_registered_does_not_mean_scheduler_running===true&&wr.runtime_tick_emitted_does_not_authorize_cycle_execution===true&&wr.step_completed_in_p40_means_attempt_completed_not_domain_output_created===true&&wr.readback_summary_must_be_structural_only===true);
ck('chains',ch.runtime_chains_are_append_only===true&&ch.previous_runtime_schedule_payload_must_not_be_mutated===true&&ch.previous_runtime_cycle_readback_payload_must_not_be_mutated===true);
for(const f of ['sa','hg','cp','td','cu','mt','op','lp','cy','sp','rp','ft','oo','p39','ac','ma','mu','af','ds']){const r=R(['--fixture',f]);ck('blocked_'+f,r.ok&&r.twin_runtime_schedule_v1_created===false&&r.twin_runtime_tick_v1_created===false&&r.twin_runtime_cycle_v1_created===false&&r.runtime_cycle_readback_v1_created===false);}
ck('review_pr_stage',review.completion_status==='implementation_ready_for_review'&&review.final_closure_status==='not_started');
ck('no_forbidden_downstream_facts',dry.forbidden_downstream_fact_count===0&&wr.forbidden_downstream_fact_count===0&&ch.forbidden_downstream_fact_count===0);
const failed=C.filter(([,ok])=>!ok).map(([n])=>n),ok=failed.length===0;
console.log(JSON.stringify({ok,acceptance:'P40_ALL_ACCEPTANCE',phase:'P40',baseline_tag:contract.baseline_tag,baseline_commit:contract.baseline_commit,assertion_count:C.length,failed_assertion_count:failed.length,failed_assertions:failed,dry_run_determinism_hash:dry.determinism_hash,controlled_schedule_determinism_hash:cs.determinism_hash,controlled_tick_determinism_hash:ct.determinism_hash,controlled_cycle_determinism_hash:cc.determinism_hash,controlled_write_determinism_hash:wr.determinism_hash,first_runtime_chain_hash:ch.first_runtime_schedule_chain_hash,second_runtime_chain_hash:ch.second_runtime_schedule_chain_hash},null,2));
if(!ok)process.exit(1);
