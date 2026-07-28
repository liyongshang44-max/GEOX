#!/usr/bin/env node
'use strict';
const {createProducerV1}=require('./core_v1.cjs');
module.exports=createProducerV1({producerId:"mcft_cap08_s6_per_run_candidate_nonconsumption_witness_v1",implementationStatus:"IMPLEMENTED",select(contract,source){const x=source.candidate_governance;return{candidate_count:x.candidates.length,candidate_parameter_path:x.candidates[0]?.parameter_path??null,candidate_parameter_value:x.candidates[0]?.parameter_value??null,candidate_consumed_count:x.candidates.filter((c)=>c.consumed).length,model_activation_count:x.model_activation_count,active_runtime_config_switch_count:x.active_runtime_config_switch_count};}});
