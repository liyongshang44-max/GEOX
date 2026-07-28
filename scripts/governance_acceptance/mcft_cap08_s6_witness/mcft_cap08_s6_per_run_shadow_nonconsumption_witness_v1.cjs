#!/usr/bin/env node
'use strict';
const {createProducerV1}=require('./core_v1.cjs');
module.exports=createProducerV1({producerId:"mcft_cap08_s6_per_run_shadow_nonconsumption_witness_v1",implementationStatus:"IMPLEMENTED",select(contract,source){const x=source.shadow_governance;return{shadow_evaluation_count:x.evaluations.length,holdout_case_count:x.evaluations[0]?.holdout_case_count??0,future_leakage_count:x.future_leakage_count,shadow_consumed_count:x.evaluations.filter((e)=>e.consumed).length,model_activation_count:x.model_activation_count,state_pointer_delta:x.state_pointer_delta,checkpoint_pointer_delta:x.checkpoint_pointer_delta};}});
