#!/usr/bin/env node
'use strict';
const {createProducerV1}=require('./core_v1.cjs');
module.exports=createProducerV1({producerId:"mcft_cap08_s6_per_run_state_chain_witness_v1",implementationStatus:"IMPLEMENTED",select(contract,source){const s=source.states;return{bootstrap_state_count:s.filter((x)=>x.role==='BOOTSTRAP_STATE').length,posterior_state_count:s.filter((x)=>x.role==='POSTERIOR_STATE').length,state_chain_count:s.length,exact_predecessor_edge_count:s.filter((x)=>x.role==='POSTERIOR_STATE'&&x.predecessor_exact).length,historical_hash_rewrite_count:source.state_chain_historical_hash_rewrite_count,foreign_state_ref_count:source.foreign_state_ref_count};}});
