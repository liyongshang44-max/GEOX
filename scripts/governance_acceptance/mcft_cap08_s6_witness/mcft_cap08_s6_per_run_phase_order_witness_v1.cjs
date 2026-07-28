#!/usr/bin/env node
'use strict';
const {createProducerV1}=require('./core_v1.cjs');
module.exports=createProducerV1({producerId:"mcft_cap08_s6_per_run_phase_order_witness_v1",implementationStatus:"IMPLEMENTED",select(contract,source){const rows=source.phase_events.filter((x)=>x.tick==='T08').sort((a,b)=>a.sequence-b.sequence);return{tick:'T08',phase_order:rows.map((x)=>x.phase),h_committed_before_a_snapshot:rows.find((x)=>x.phase==='H').sequence<rows.find((x)=>x.phase==='A').sequence,a_consumes_exact_h_ref:source.t08_a_consumes_exact_h_ref};}});
