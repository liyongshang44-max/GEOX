#!/usr/bin/env node
'use strict';
const {createProducerV1}=require('./core_v1.cjs');
module.exports=createProducerV1({producerId:"mcft_cap08_s6_per_run_residual_phase_witness_v1",implementationStatus:"IMPLEMENTED",select(contract,source){const x=source.residual_phase;return{phase:x.phase,residual_refs:[...x.residual_refs],same_transaction_family:x.same_transaction_family,cross_phase_split_count:x.cross_phase_split_count};}});
