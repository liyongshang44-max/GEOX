#!/usr/bin/env node
'use strict';
const {createProducerV1}=require('./core_v1.cjs');
module.exports=createProducerV1({producerId:"mcft_cap08_s6_per_run_contiguous_sequence_witness_v1",implementationStatus:"IMPLEMENTED",select(contract,source){const p=contract.selector_parameters;const ticks=source.sequence.tick_ids;const missing=p.tick_ids.filter((x)=>!ticks.includes(x));const dup=ticks.length-new Set(ticks).size;return{bootstrap_root_count:source.sequence.bootstrap_phase===p.bootstrap_phase?source.sequence.bootstrap_root_count:0,successful_tick_count:ticks.length,tick_ids:[...ticks],missing_tick_count:missing.length,duplicate_tick_count:dup,out_of_order_tick_count:JSON.stringify(ticks)===JSON.stringify(p.tick_ids)?0:1};}});
