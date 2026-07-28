#!/usr/bin/env node
'use strict';
const {createProducerV1}=require('./core_v1.cjs');
module.exports=createProducerV1({producerId:"mcft_cap08_s6_per_run_late_append_forward_witness_v1",implementationStatus:"IMPLEMENTED",select(contract,source){const x=source.late_append_forward;return{correction_tick:x.correction_tick,append_forward_correction_count:x.append_forward_correction_count,historical_hash_rewrite_count:x.historical_hash_rewrite_count,t17_consumes_corrected_posterior:x.t17_consumes_corrected_posterior,source_observation:x.source_observation,ordinary_observation_at_t16:x.ordinary_observation_at_t16,late_correction_vector_count:x.late_correction_vector_count,historical_revision_created:x.historical_revision_created};}});
